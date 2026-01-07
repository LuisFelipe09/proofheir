/// Proof generation module - wraps the prover+verifier flow for API usage
use crate::prover::prover;
use crate::types::serialize_public_inputs_for_solidity;

/// Result of proof generation
pub struct ProofGenerationResult {
    /// ZK proof bytes
    pub proof: Vec<u8>,
    /// Verification key
    pub vk: Vec<u8>,
    /// Public inputs formatted for Solidity (116 fields)
    pub public_inputs: Vec<String>,
}

/// Generate a complete ZK proof for death certificate verification
///
/// This function:
/// 1. Runs pre-verification check against the civil registry API
/// 2. Executes MPC-TLS prover to get authenticated data
/// 3. Generates ZK proof using Noir circuit
/// 4. Serializes public inputs for Solidity
///
/// # Arguments
/// * `recipient` - Ethereum address of the heir (20 bytes)
/// * `nuip` - National ID number (e.g., "123456789")
/// * `salt` - 32-byte salt for identity commitment
///
/// # Returns
/// `ProofGenerationResult` containing proof, VK, and public inputs
pub async fn generate_death_proof(
    recipient: [u8; 20],
    nuip: String,
    salt: [u8; 32],
    testator_address: [u8; 20],
) -> anyhow::Result<ProofGenerationResult> {
    // Configuration for the target server (Civil Registry Mock)
    // Use environment variable or default to Railway deployment
    let host = std::env::var("CIVIL_REGISTRY_DOMAIN")
        .unwrap_or_else(|_| "web-production-05160.up.railway.app".to_string());
    let port = 443;
    let server_addr = tokio::net::lookup_host((host.as_str(), port))
        .await?
        .next()
        .ok_or_else(|| anyhow::anyhow!("Failed to lookup host"))?;
    
    let uri = std::env::var("CIVIL_REGISTRY_URL")
        .unwrap_or_else(|_| "https://web-production-05160.up.railway.app/VigenciaCedula/consulta".to_string());

    tracing::info!("🔍 Running pre-verification check...");
    
    // Pre-verification check to fail fast if subject is alive
    let client = reqwest::Client::new();
    let nuip_number: u64 = nuip.parse()
        .map_err(|_| anyhow::anyhow!("Invalid NUIP format"))?;
    
    let res = client.post(&uri)  // Use reference here
        .json(&serde_json::json!({
            "nuip": nuip_number,
            "ip": "143.137.96.53"
        }))
        .send()
        .await?;

    if !res.status().is_success() {
        return Err(anyhow::anyhow!("Failed to query civil registry: {}", res.status()));
    }

    let response_data: serde_json::Value = res.json().await?;
    tracing::info!("Server response: {:?}", response_data);

    if let Some(vigencia) = response_data.get("vigencia").and_then(|v| v.as_str()) {
        if vigencia == "Vigente (Vivo)" {
            tracing::error!("❌ Pre-verification FAILED: Subject is 'Vigente (Vivo)'");
            anyhow::bail!("Cannot generate 'Proof of Death' - subject is alive");
        }
    }
    
    tracing::info!("✅ Pre-verification passed. Starting MPC-TLS...");

    // Create duplex channels for prover-verifier communication
    let (prover_socket, verifier_socket) = tokio::io::duplex(1 << 23);
    let (prover_extra_socket, verifier_extra_socket) = tokio::io::duplex(1 << 23);

    // Clone nuip before moving into spawn
    let nuip_for_prover = nuip.clone();

    // Spawn prover task
    let prover_handle = tokio::spawn(async move {
        prover(
            prover_socket,
            prover_extra_socket,
            &server_addr,
            &uri,
            recipient,
            &nuip_for_prover,
            salt,
        ).await
        .map_err(|e| anyhow::anyhow!("Prover error: {}", e))
    });

    // Spawn verifier task - NOW WITH TESTATOR ADDRESS
    let verifier_handle = tokio::spawn(async move {
        crate::verifier::verifier(verifier_socket, verifier_extra_socket, testator_address)
            .await
            .map_err(|e| anyhow::anyhow!("Verifier error: {}", e))
    });

    // Wait for both tasks
    let (prover_result, verifier_result) = tokio::try_join!(prover_handle, verifier_handle)?;
    
    // Get the proof bundle from prover
    let proof_bundle = prover_result?;
    
    // Verify that verifier completed successfully
    let _transcript = verifier_result?;

    tracing::info!("📦 Received proof bundle:");
    tracing::info!("   VK size: {} bytes", proof_bundle.vk.len());
    tracing::info!("   Proof size: {} bytes", proof_bundle.proof.len());
    tracing::info!("   Recipient: 0x{}", hex::encode(&proof_bundle.public_inputs.recipient));
    tracing::info!("   Server hash: {}", hex::encode(&proof_bundle.public_inputs.server_hash));
    tracing::info!("   ID commitment: {}", hex::encode(&proof_bundle.public_inputs.id_commitment));
    tracing::info!("   Status commitment: {}", hex::encode(&proof_bundle.public_inputs.status_commitment));

    // Use the public inputs directly from the proof bundle
    // These are the EXACT values that were used to generate the proof
    let public_inputs = serialize_public_inputs_for_solidity(
        proof_bundle.public_inputs.recipient,
        proof_bundle.public_inputs.server_hash,
        proof_bundle.public_inputs.id_commitment,
        &proof_bundle.public_inputs.status_commitment,
    ).map_err(|e| anyhow::anyhow!("Failed to serialize public inputs: {}", e))?;

    Ok(ProofGenerationResult {
        proof: proof_bundle.proof,
        vk: proof_bundle.vk,
        public_inputs,
    })
}
