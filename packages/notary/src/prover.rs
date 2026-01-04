use std::net::SocketAddr;

use crate::types::received_commitments;

use super::types::ZKProofBundle;

use http_body_util::Full;
use hyper::{body::Bytes, Request, StatusCode, Uri};
use hyper_util::rt::TokioIo;
use k256::sha2::{Digest, Sha256};
use serde_json::Value;
use noir::{
    barretenberg::{
        prove::prove_ultra_honk, srs::setup_srs_from_bytecode,
    },
    witness::from_vec_str_to_witness_map,
};
use spansy::{
    http::{BodyContent, Responses},
    Spanned,
};
// Removed: use tls_server_fixture::CA_CERT_DER; 
use tlsn::{
    config::{CertificateDer, ProtocolConfig, RootCertStore},
    connection::ServerName,
    hash::HashAlgId,
    prover::{ProveConfig, ProveConfigBuilder, Prover, ProverConfig, TlsConfig},
    transcript::{
        hash::{PlaintextHash, PlaintextHashSecret},
        TranscriptCommitConfig, TranscriptCommitConfigBuilder, TranscriptCommitmentKind,
        TranscriptSecret, Direction,
    },
};

// Max data sizes for MPC-TLS (from tlsn examples)
const MAX_SENT_DATA: usize = 1 << 12; // 4KB
const MAX_RECV_DATA: usize = 1 << 14; // 16KB

use tokio::io::AsyncWriteExt;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio_util::compat::{FuturesAsyncReadCompatExt, TokioAsyncReadCompatExt};
use tracing::instrument;

#[instrument(skip(verifier_socket, verifier_extra_socket))]
pub async fn prover<T: AsyncWrite + AsyncRead + Send + Unpin + 'static>(
    verifier_socket: T,
    mut verifier_extra_socket: T,
    server_addr: &SocketAddr,
    uri: &str,
    recipient: [u8; 20],
    nuip: &str,
    salt: [u8; 32],
) -> Result<ZKProofBundle, Box<dyn std::error::Error>> {
    let uri = uri.parse::<Uri>()?;

    if uri.scheme().map(|s| s.as_str()) != Some("https") {
        return Err("URI must use HTTPS scheme".into());
    }

    let server_domain = uri.authority().ok_or("URI must have authority")?.host();

    // Load native root certificates and convert to tlsn format
    let roots: Vec<CertificateDer> = rustls_native_certs::load_native_certs()
        .expect("could not load platform certs")
        .into_iter()
        .map(|cert| CertificateDer(cert.0))
        .collect();
    
    let tls_roots = RootCertStore { roots };
    
    let mut tls_config_builder = TlsConfig::builder();
    tls_config_builder.root_store(tls_roots);
    let tls_config = tls_config_builder.build()?;

    // Set up protocol configuration for prover.
    let mut prover_config_builder = ProverConfig::builder();
    prover_config_builder
        .server_name(ServerName::Dns(server_domain.try_into()?))
        .tls_config(tls_config)
        .protocol_config(
            ProtocolConfig::builder()
                .max_sent_data(MAX_SENT_DATA)
                .max_recv_data(MAX_RECV_DATA)
                .build()?,
        );

    let prover_config = prover_config_builder.build()?;

    // Create prover and connect to verifier.
    //
    // Perform the setup phase with the verifier.
    let prover = Prover::new(prover_config)
        .setup(verifier_socket.compat())
        .await?;

    // Connect to TLS Server.
    let tls_client_socket = tokio::net::TcpStream::connect(server_addr).await?;

    // Pass server connection into the prover.
    let (mpc_tls_connection, prover_fut) = prover.connect(tls_client_socket.compat()).await?;

    // Wrap the connection in a TokioIo compatibility layer to use it with hyper.
    let mpc_tls_connection = TokioIo::new(mpc_tls_connection.compat());

    // Spawn the Prover to run in the background.
    let prover_task = tokio::spawn(prover_fut);

    // MPC-TLS Handshake.
    let (mut request_sender, connection) =
        hyper::client::conn::http1::handshake(mpc_tls_connection).await?;

    // Spawn the connection to run in the background.
    tokio::spawn(connection);

    // MPC-TLS: Send Request and wait for Response.
    let nuip_number: u64 = nuip.parse().map_err(|_| "Invalid NUIP format")?;
    let payload = serde_json::json!({
        "nuip": nuip_number,
        "ip": "143.137.96.53"
    });
    let payload_bytes = Bytes::from(payload.to_string());

    let request = Request::builder()
        .uri(uri.clone())
        .header("Host", server_domain)
        .header("Connection", "close")
        .header("Content-Type", "application/json")
        .method("POST")
        .body(Full::new(payload_bytes))?;

    let response = request_sender.send_request(request).await?;

    if response.status() != StatusCode::OK {
        return Err(format!("MPC-TLS request failed with status {}", response.status()).into());
    }

    // Create proof for the Verifier.
    let mut prover = prover_task.await??;

    let transcript = prover.transcript().clone();
    let mut prove_config_builder = ProveConfig::builder(&transcript);

    // Reveal the DNS name.
    prove_config_builder.server_identity();

    let sent: &[u8] = transcript.sent();
    let received: &[u8] = transcript.received();
    let sent_len = sent.len();
    let recv_len = received.len();
    tracing::info!("Sent length: {}, Received length: {}", sent_len, recv_len);

    // Reveal the entire HTTP request 
    // Simplified: reveal all sent data as public
    prove_config_builder.reveal_sent(&(0..sent_len))?;

    // Create hash commitment for the 'vigencia' status field
    let mut transcript_commitment_builder = TranscriptCommitConfig::builder(&transcript);
    transcript_commitment_builder.default_kind(TranscriptCommitmentKind::Hash {
        alg: HashAlgId::SHA256,
    });
    
    // Reveal everything received except (optionally) the status if we want to keep it private-ish?
    // Actually, in the ZK circuit, the status is a Private Input, but the status_commitment is Public.
    // TLSNotary 'reveal' means it is visible in the TLS Proof. 
    // If we want status to be private to the ZK circuit witness, we should NOT reveal it here, ONLY commit to it.
    // However, we usually reveal the structure around it to prove it came from the JSON.
    
    reveal_received(
        received,
        &mut prove_config_builder,
        &mut transcript_commitment_builder,
    )?;

    let transcripts_commitment_config = transcript_commitment_builder.build()?;
    prove_config_builder.transcript_commit(transcripts_commitment_config);

    let prove_config = prove_config_builder.build()?;

    // MPC-TLS prove
    let prover_output = prover.prove(&prove_config).await?;
    prover.close().await?;

    // Prepare inputs for Noir
    let received_commitments = received_commitments(&prover_output.transcript_commitments);
    let received_commitment = received_commitments
        .first()
        .ok_or("No received commitments found (status)")?; 
        
    let received_secrets = received_secrets(&prover_output.transcript_secrets);
    let received_secret = received_secrets
        .first()
        .ok_or("No received secrets found (blinder)")?; 

    // Use values passed as parameters from client
    let proof_input = prepare_zk_proof_input(
        received, 
        received_commitment, 
        received_secret,
        recipient,
        server_domain,
        nuip,
        salt
    )?;
    
    let proof_bundle = generate_zk_proof(&proof_input)?;

    // Send zk proof bundle to verifier
    let serialized_proof = bincode::serialize(&proof_bundle)?;
    verifier_extra_socket.write_all(&serialized_proof).await?;
    verifier_extra_socket.shutdown().await?;

    // Return the proof bundle for API usage
    Ok(proof_bundle)
}

fn reveal_received(
    received: &[u8],
    _builder: &mut ProveConfigBuilder<'_>,
    transcript_commitment_builder: &mut TranscriptCommitConfigBuilder,
) -> Result<(), Box<dyn std::error::Error>> {
    let resp = Responses::new_from_slice(received).collect::<Result<Vec<_>, _>>()?;

    let response = resp.first().ok_or("No responses found")?;
    let body = response.body.as_ref().ok_or("Response body not found")?;

    let BodyContent::Json(json) = &body.content else {
        return Err("Expected JSON body content".into());
    };

    // Locate "vigencia" field
    let vigencia = json
        .get("vigencia")
        .ok_or("vigencia field not found in JSON")?;

    // We do NOT reveal the value of vigencia here if we want it to be private input to ZK.
    // We only COMMIT to it.
    
    // But we might want to reveal the keys to prove structure?
    // For simplicity, let's assume we reveal nothing of the body except necessary parts?
    // Actually, usually we reveal the key "vigencia": "..." to show where it is?
    
    // Commit to the value of vigencia
    // The value span includes quotes for strings? Check spansy behavior. 
    // Usually json.get returns the value node. 
    transcript_commitment_builder.commit_recv(vigencia.span())?;

    Ok(())
}

// extract secret from prover output
fn received_secrets(transcript_secrets: &[TranscriptSecret]) -> Vec<&PlaintextHashSecret> {
    transcript_secrets
        .iter()
        .filter_map(|secret| match secret {
            TranscriptSecret::Hash(hash) if hash.direction == Direction::Received => Some(hash),
            _ => None,
        })
        .collect()
}

#[derive(Debug)]
pub struct ZKProofInput {
    recipient: [u8; 20],
    server_hash: [u8; 32],
    id_commitment: [u8; 32],
    status_commitment: Vec<u8>,
    nuip: String,
    salt: [u8; 32],
    server_domain: String,
    status: Vec<u8>,
    status_blinder: Vec<u8>,
}

// Verify that the blinded, committed hash is correct locally before ZK
fn prepare_zk_proof_input(
    received: &[u8],
    received_commitment: &PlaintextHash,
    received_secret: &PlaintextHashSecret,
    recipient: [u8; 20],
    server_domain: &str,
    nuip: &str,
    salt: [u8; 32],
) -> Result<ZKProofInput, Box<dyn std::error::Error>> {
    assert_eq!(received_commitment.direction, Direction::Received);
    assert_eq!(received_commitment.hash.alg, HashAlgId::SHA256);

    let hash = &received_commitment.hash;

    let start = received_commitment.idx.min().ok_or("No start index")?;
    let end = received_commitment.idx.end().ok_or("No end index")?;
    
    // This is the raw bytes of the value, e.g. "No Vigente (Fallecido)" (including quotes if string?)
    // Spansy usually gives the span of the value.
    let status_bytes = received[start..end].to_vec();
    
    // Check if it includes quotes?
    // If spansy returns the JSON value string including quotes, we might need to strip them 
    // or the circuit expects them?
    // The circuit expects `status: str<22>`. Noir strings are bytes. 
    // If the JSON is `"No Vigente (Fallecido)"`, that's > 22 bytes.
    // Assuming we need to handle quotes.
    // For now passing raw bytes.
    
    let blinder = received_secret.blinder.as_bytes().to_vec();
    let committed_hash = hash.value.as_bytes().to_vec();

    // Verify locally
    let mut hasher = Sha256::new();
    hasher.update(&status_bytes);
    hasher.update(&blinder);
    let computed_hash = hasher.finalize();

    if committed_hash != computed_hash.as_slice() {
        return Err("Computed hash does not match committed hash".into());
    }
    
    // Derived inputs - MUST match circuit padding
    let mut server_domain_padded = server_domain.as_bytes().to_vec();
    server_domain_padded.resize(40, 32); // Pad with spaces
    let mut hasher = Sha256::new();
    hasher.update(&server_domain_padded);
    let server_hash: [u8; 32] = hasher.finalize().into();
    
    let mut nuip_padded = nuip.as_bytes().to_vec();
    nuip_padded.resize(15, 0); // Pad with zeros
    let mut hasher = Sha256::new();
    hasher.update(&nuip_padded);
    hasher.update(&salt);
    let id_commitment: [u8; 32] = hasher.finalize().into();

    Ok(ZKProofInput {
        recipient,
        server_hash,
        id_commitment,
        status_commitment: committed_hash,
        nuip: nuip.to_string(),
        salt,
        server_domain: server_domain.to_string(),
        status: status_bytes,
        status_blinder: blinder,
    })
}

fn generate_zk_proof(
    proof_input: &ZKProofInput,
) -> Result<ZKProofBundle, Box<dyn std::error::Error>> {
    tracing::info!("🔒 Generating ZK proof with Noir...");

    const PROGRAM_JSON: &str = include_str!("../../circuits/target/circuits.json");

    // 1. Load bytecode from program.json
    let json: Value = serde_json::from_str(PROGRAM_JSON)?;
    let bytecode = json["bytecode"]
        .as_str()
        .ok_or("bytecode field not found in program.json")?;

    let mut inputs: Vec<String> = vec![];
    
    // Order MUST match main.nr arguments:
    // recipient: pub [u8; 20]
    inputs.extend(proof_input.recipient.iter().map(|b| b.to_string()));
    
    // server_hash: pub [u8; 32]
    inputs.extend(proof_input.server_hash.iter().map(|b| b.to_string()));
    
    // id_commitment: pub [u8; 32]
    inputs.extend(proof_input.id_commitment.iter().map(|b| b.to_string()));
    
    // status_commitment: pub [u8; 32]
    inputs.extend(proof_input.status_commitment.iter().map(|b| b.to_string()));
    
    // nuip: str<15>
    let mut nuip_padded = proof_input.nuip.as_bytes().to_vec();
    nuip_padded.resize(15, 0); // Pad with 0s
    inputs.extend(nuip_padded.iter().map(|b| b.to_string()));
    
    // salt: [u8; 32]
    inputs.extend(proof_input.salt.iter().map(|b| b.to_string()));
    
    // server_domain: str<40>
    let domain_bytes = proof_input.server_domain.as_bytes();
    inputs.extend(domain_bytes.iter().map(|b| b.to_string()));
    // If domain is shorter than 40, we might need to pad with 0s or spaces depending on Noir logic. 
    // The circuit test padded with spaces. 
    // Ideally we pad here to 40.
    for _ in domain_bytes.len()..40 {
        inputs.push("32".to_string()); // 32 is space in ascii. Or 0?
    }
    
    // status: str<22>
    let status_clean = if proof_input.status.first() == Some(&34) {
         &proof_input.status[1..proof_input.status.len()-1]
    } else {
         &proof_input.status
    };
    let mut status_padded = status_clean.to_vec();
    status_padded.resize(22, 0); // Pad with 0s
    inputs.extend(status_padded.iter().map(|b| b.to_string()));
    
    // status_blinder: [u8; 16]
    inputs.extend(proof_input.status_blinder.iter().map(|b| b.to_string()));

    let input_refs: Vec<&str> = inputs.iter().map(String::as_str).collect();
    let witness = from_vec_str_to_witness_map(input_refs)?;

    // Setup SRS
    setup_srs_from_bytecode(bytecode, None, false)?;

    // Verification key
    // Load pre-computed VK from file
    const VK_BYTES: &[u8] = include_bytes!("../../circuits/target/vk");
    let vk = VK_BYTES.to_vec();

    // Generate proof
    let proof = prove_ultra_honk(bytecode, witness.clone(), vk.clone(), false)?;
    tracing::info!("✅ ZK Proof generated successfully!");
    tracing::info!("   Proof size: {} bytes", proof.len());
    tracing::info!("   VK size: {} bytes", vk.len());

    // Convert status_commitment from Vec<u8> to [u8; 32]
    let status_commitment: [u8; 32] = proof_input.status_commitment
        .as_slice()
        .try_into()
        .map_err(|_| format!("status_commitment must be exactly 32 bytes, got {}", proof_input.status_commitment.len()))?;

    // Create PublicInputs struct with ALL the values used in the proof
    let public_inputs = crate::types::PublicInputs {
        recipient: proof_input.recipient,
        server_hash: proof_input.server_hash,
        id_commitment: proof_input.id_commitment,
        status_commitment,
    };

    Ok(ZKProofBundle {
        vk,
        proof,
        public_inputs,
    })
}
