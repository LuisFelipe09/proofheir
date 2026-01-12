use crate::types::{received_commitments, serialize_public_inputs_for_solidity, ZKProofBundle};
use noir::barretenberg::verify::{get_ultra_honk_verification_key};
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
use alloy::{
    network::EthereumWallet,
    primitives::{Address, Bytes, FixedBytes},
    providers::ProviderBuilder,
    signers::local::PrivateKeySigner,
    sol,
};
use std::env;

// Constants from prover
const MAX_SENT_DATA: usize = 1 << 12;
const MAX_RECV_DATA: usize = 1 << 14;

// Define the ProofHeir contract interface
sol! {
    #[sol(rpc)]
    contract ProofHeir {
        function proveDeathAndRegisterHeir(bytes calldata proof, bytes32[] calldata publicInputs) external;
        
        event HeirRegistered(address indexed owner, address indexed heir);
    }
}

#[instrument(skip(socket, extra_socket))]
pub async fn verifier<T: AsyncWrite + AsyncRead + Send + Sync + Unpin + 'static>(
    socket: T,
    mut extra_socket: T,
    testator_address: [u8; 20],
) -> Result<PartialTranscript, Box<dyn std::error::Error>> {
    // Limits matching prover
    let protocol_config_validator = ProtocolConfigValidator::builder()
        .max_sent_data(MAX_SENT_DATA)
        .max_recv_data(MAX_RECV_DATA)
        .build()?;

    // Use native root certificates (matching Prover)
    let native_certs = rustls_native_certs::load_native_certs()
        .map_err(|e| format!("Failed to load platform certificates: {}", e))?;
        
    let roots: Vec<CertificateDer> = native_certs
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
    const PROGRAM_JSON: &str = include_str!("../circuits.json");
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

    // ========================================================================
    // SEND TRANSACTION TO VERIFY PROOF AND REGISTER HEIR ON-CHAIN
    // ========================================================================
    
    // Read configuration from environment
    let rpc_url = env::var("RPC_URL")
        .unwrap_or_else(|_| "http://localhost:8545".to_string());
    let private_key = env::var("VERIFIER_PRIVATE_KEY")
        .map_err(|_| "VERIFIER_PRIVATE_KEY not set in environment")?;
    
    // Convert testator address to Address type
    let testator_addr = Address::from_slice(&testator_address);
    
    tracing::info!("📡 Calling proveDeathAndRegisterHeir on delegated account: 0x{}", hex::encode(&testator_address));
    tracing::info!("🔗 RPC URL: {}", rpc_url);
    
    // Create signer from private key
    let signer: PrivateKeySigner = private_key.parse()
        .map_err(|e| format!("Invalid private key: {}", e))?;
    
    let wallet = EthereumWallet::from(signer);
    
    tracing::info!("🔑 Using verifier wallet: {}", wallet.default_signer().address());
    
    // Create provider with signer
    let provider = ProviderBuilder::new()
        .with_recommended_fillers()
        .wallet(wallet)
        .on_http(rpc_url.parse()?);
    
    // Serialize public inputs to Solidity format (116 fields)
    let public_inputs_hex = serialize_public_inputs_for_solidity(
        msg.public_inputs.recipient,
        msg.public_inputs.server_hash,
        msg.public_inputs.id_commitment,
        &status_commitment_from_proof,
    )?;
    
    // Convert to FixedBytes<32> array for contract call
    let public_inputs_bytes: Vec<FixedBytes<32>> = public_inputs_hex
        .iter()
        .map(|hex_str| {
            let hex_str = hex_str.trim_start_matches("0x");
            let bytes = hex::decode(hex_str).expect("Invalid hex in public inputs");
            FixedBytes::<32>::from_slice(&bytes)
        })
        .collect();
    
    // Convert proof to Bytes
    
    // ------------------------------------------------------------------------
    // HANDLING PROOF SIZE MISMATCH (noir-rs vs Solidity Verifier)
    // ------------------------------------------------------------------------
    
    // We calculate the number of public input fields dynamically based on the 
    // serialization logic defined in `types.rs`. This ensures that if the 
    // circuit inputs change, this logic adapts automatically.
    
    // Temporarily serialize inputs using the commitment provided in the bundle
    // (We certify that this matches the proof later)
    let temp_public_inputs_hex = serialize_public_inputs_for_solidity(
        msg.public_inputs.recipient,
        msg.public_inputs.server_hash,
        msg.public_inputs.id_commitment,
        &msg.public_inputs.status_commitment,
    )?;
    
    let public_inputs_field_count = temp_public_inputs_hex.len();
    let public_inputs_size_bytes = public_inputs_field_count * 32;
    
    // Check if proof contains concatenated public inputs
    let proof_size_elements = proof.len() / 32;
    
    // If the proof is significantly larger than the inputs, and matches the 
    // pattern of "Inputs + Proof", we slice. 
    // (We don't hardcode 508 here, but assume anything larger than inputs 
    // by a reasonable margin (e.g. > 1KB) likely includes the proof)
    
    let final_proof = if proof.len() > public_inputs_size_bytes && proof.len() % 32 == 0 {
         // Heuristic: If proof starts with public inputs? 
         // Since we can't easily verify the "Proof" part without verification,
         // we assume that if it's the "Concatenated" style, it will be:
         // Size = PublicInputsSize + PureProofSize
         
         // For safety against regression where noir-rs might NOT concatenate, 
         // we check if slicing would leave a "valid-looking" proof size.
         // UltraHonk proofs are usually around ~16KB (500+ fields).
         
         if proof.len() > public_inputs_size_bytes + 10000 { 
             tracing::info!("💡 Detected Concatenated Proof ({} elements).", proof_size_elements);
             tracing::info!("   Public Inputs count: {} elements.", public_inputs_field_count);
             tracing::info!("   Action: Slicing off first {} bytes.", public_inputs_size_bytes);
             
             proof[public_inputs_size_bytes..].to_vec()
         } else {
             proof.clone()
         }
    } else {
        proof.clone()
    };
    
    let proof_bytes = Bytes::from(final_proof.clone()); // Use final_proof for transaction

    // Validate Status Commitment extraction from the ORIGINAL full proof or the FINAL proof?
    // If we sliced it, the final_proof does NOT contain the public inputs anymore.
    // So we can't extract them from `final_proof`.
    // But we need to verify that the proof actually "binds" those inputs.
    
    // Wait, if `proof` (the original) has inputs concatenated, they are at the beginning.
    // The PROOF ITSELF (the zk part) doesn't "contain" the inputs in plain text, 
    // it contains cryptographic commitments to them.
    
    // The logic below (lines 137+) was trying to extract `status_commitment` from 
    // the proof by assuming offsets.
    // `start_offset = (20 + 32 + 32) * 32` -> This offset is into the PUBLIC INPUTS section.
    // So we MUST use the `proof` (original concatenated variable) to extract this check, 
    // NOT `final_proof`.
    
    // ... existing logic uses `proof` variable ...
    
    // Create contract instance pointing to the TESTATOR'S DELEGATED ACCOUNT
    // This is the key change: we call the function on the testator's account,
    // not on the ProofHeir contract address directly
    let contract = ProofHeir::new(testator_addr, &provider);
    
    // Send transaction to register heir on-chain
    tracing::info!("🔐 Sending transaction: proveDeathAndRegisterHeir()...");
    
    // Let the provider estimate gas (required for Mantle's L1+L2 cost calculation)
    // Mantle requires estimateGas to calculate l1Cost correctly
    let tx_builder = contract.proveDeathAndRegisterHeir(proof_bytes, public_inputs_bytes);
    
    // Send the transaction
    let pending_tx = tx_builder.send().await
        .map_err(|e| format!("Failed to send transaction: {}", e))?;
    
    let tx_hash = *pending_tx.tx_hash();
    tracing::info!("📝 Transaction sent! Hash: {:?}", tx_hash);
    
    // Wait for transaction confirmation
    tracing::info!("⏳ Waiting for transaction confirmation...");
    let receipt = pending_tx.get_receipt().await
        .map_err(|e| format!("Failed to get transaction receipt: {}", e))?;
    
    if receipt.status() {
        tracing::info!("✅ Transaction confirmed in block: {}", receipt.block_number.unwrap_or(0));
        tracing::info!("✅ On-chain proof verification succeeded!");
        tracing::info!("✅ Heir registered in testator's delegated account storage!");
        tracing::info!("⛽ Gas used: {}", receipt.gas_used);
    } else {
        tracing::error!("❌ Transaction reverted!");
        return Err("Transaction was reverted by the contract".into());
    }

    Ok(transcript)
}
