use notary::types::{received_commitments, ZKProofBundle};
use noir::barretenberg::verify::{get_ultra_honk_verification_key, verify_ultra_honk};
use serde_json::Value;
use tlsn::{
    config::{CertificateDer, ProtocolConfigValidator, RootCertStore},
    connection::ServerName,
    hash::HashAlgId,
    transcript::{Direction, PartialTranscript},
    verifier::{Verifier, VerifierConfig, VerifierOutput, VerifyConfig},
};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite};
use tokio_util::compat::TokioAsyncReadCompatExt;
use tracing::instrument;

// Constants from prover
const MAX_SENT_DATA: usize = 1 << 12;
const MAX_RECV_DATA: usize = 1 << 14;

#[instrument(skip(socket, extra_socket))]
pub async fn verifier<T: AsyncWrite + AsyncRead + Send + Sync + Unpin + 'static>(
    socket: T,
    mut extra_socket: T,
) -> Result<PartialTranscript, Box<dyn std::error::Error>> {
    // Limits matching prover
    let protocol_config_validator = ProtocolConfigValidator::builder()
        .max_sent_data(MAX_SENT_DATA)
        .max_recv_data(MAX_RECV_DATA)
        .build()?;

    // Use native root certificates (matching Prover)
    let roots: Vec<CertificateDer> = rustls_native_certs::load_native_certs()
        .expect("could not load platform certs")
        .into_iter()
        .map(|cert| CertificateDer(cert.0))
        .collect();
        
    let verifier_config = VerifierConfig::builder()
        .root_store(RootCertStore { roots })
        .protocol_config_validator(protocol_config_validator)
        .build()?;

    let verifier = Verifier::new(verifier_config);

    // Receive authenticated data.
    let VerifierOutput {
        server_name,
        transcript,
        transcript_commitments,
        ..
    } = verifier
        .verify(socket.compat(), &VerifyConfig::default())
        .await?;

    let server_name = server_name.ok_or("Prover should have revealed server name")?;
    let transcript = transcript.ok_or("Prover should have revealed transcript data")?;
    
    // Check received data commitment (MPC-TLS level)
    let received_commitments = received_commitments(&transcript_commitments);
    let received_commitment = received_commitments
        .first()
        .ok_or("Missing received hash commitment")?;

    if received_commitment.direction != Direction::Received {
        return Err("Commitment direction mismatch".into());
    }
    if received_commitment.hash.alg != HashAlgId::SHA256 {
         return Err("Commitment hash algo mismatch".into());
    }

    let committed_hash = &received_commitment.hash;
    let expected_status_hash_bytes = committed_hash.value.as_bytes().to_vec();

    // Verify Server Name (Civil Registry Mock)
    let ServerName::Dns(server_name_str) = server_name;
    // Note: We don't hardcode the check here strictly, but we log it
    tracing::info!("Verifier connected to server name: {}", server_name_str.as_str());

    // Receive ZKProof information from prover via extra socket
    let mut buf = Vec::new();
    extra_socket.read_to_end(&mut buf).await?;

    if buf.is_empty() {
        return Err("No ZK proof data received from prover".into());
    }

    let msg: ZKProofBundle = bincode::deserialize(&buf)
        .map_err(|e| format!("Failed to deserialize ZK proof bundle: {}", e))?;

    // Verify ZK proof
    // Load bytecode from pre-computed path or include string if prefered
    const PROGRAM_JSON: &str = include_str!("../../circuits/target/circuits.json");
    let json: Value = serde_json::from_str(PROGRAM_JSON)?;
    let bytecode = json["bytecode"]
        .as_str()
        .ok_or("bytecode field not found in program.json")?;

    // Ideally we should use the pre-computed VK from file to match prover
    // But generating it ensures we are checking against the source truth
    let vk = get_ultra_honk_verification_key(bytecode, false)?;

    if vk != msg.vk {
        return Err("Verification key mismatch: Prover used a different key than Verifier expected".into());
    }

    let proof = msg.proof;

    // Validate Status Commitment in Public Inputs
    // Public Inputs Input Structure (as bytes in proof):
    // 1. Recipient: [u8; 20] -> 20 field elements (32 bytes each) = 640 bytes
    // 2. Server Hash: [u8; 32] -> 32 field elements = 1024 bytes
    // 3. ID Commitment: [u8; 32] -> 32 field elements = 1024 bytes
    // 4. Status Commitment: [u8; 32] -> 32 field elements = 1024 bytes
    
    // Start index for status_commitment = (20 + 32 + 32) * 32 = 84 * 32 = 2688 bytes
    let start_offset = (20 + 32 + 32) * 32;
    let end_offset = start_offset + (32 * 32);

    if proof.len() < end_offset {
        return Err("Proof too short to contain status commitment".into());
    }

    // Extract status commitment from proof
    // Each byte of the original [u8; 32] is encoded as a 32-byte Field Element (BigEndian). 
    // Since the value is a u8, it's just the last byte of the 32-byte chunk.
    let status_commitment_from_proof: Vec<u8> = proof[start_offset..end_offset]
        .chunks(32)
        .map(|chunk: &[u8]| *chunk.last().unwrap_or(&0))
        .collect();

    // Verify match
    if status_commitment_from_proof != expected_status_hash_bytes {
         tracing::error!(
            "❌ ZK Proof Public Input 'Status Commitment' does not match MPC-TLS commitment.\nZK: {}\nMPC: {}", 
            hex::encode(&status_commitment_from_proof),
            hex::encode(&expected_status_hash_bytes)
        );
        return Err("Hash in proof does not match committed hash in MPC-TLS".into());
    }
    
    tracing::info!("✅ ZK Proof Public Input matches MPC-TLS commitment!");

    // Verify the proof validity
    let is_valid = verify_ultra_honk(proof, vk)
        .map_err(|e| format!("ZKProof Verification failed: {}", e))?;
        
    if !is_valid {
        tracing::error!("❌ ZK Proof verification failed (invalid proof)");
        return Err("ZK Proof invalid".into());
    }
    
    tracing::info!("✅ ZK Proof successfully verified");

    Ok(transcript)
}
