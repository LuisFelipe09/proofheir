pub mod prover;
pub mod types;
pub mod proof_gen;
pub mod verifier;  // Already public

pub use prover::prover;
pub use types::{SolidityProofBundle, ZKProofBundle, PublicInputs, serialize_public_inputs_for_solidity};
pub use proof_gen::{generate_death_proof, ProofGenerationResult};

/// High-level API for generating a ZK proof bundle ready for smart contract verification
/// 
/// This function orchestrates the full proof generation flow:
/// 1. Connects to target server via MPC-TLS
/// 2. Extracts authenticated data from response
/// 3. Generates ZK proof using Noir circuit
/// 4. Serializes proof and public inputs for Solidity
/// 
/// # Arguments
/// * `recipient` - Ethereum address of the heir (20 bytes)
/// * `nuip` - National ID number (e.g., "123456789")
/// * `salt` - 32-byte salt for identity commitment
/// 
/// # Returns
/// `SolidityProofBundle` containing hex-encoded proof and 116 public input fields
pub async fn generate_proof_for_contract(
    recipient: [u8; 20],
    nuip: String,
    salt: [u8; 32],
) -> anyhow::Result<SolidityProofBundle> {
    let result = proof_gen::generate_death_proof(recipient, nuip, salt).await?;
    
    Ok(SolidityProofBundle {
        proof: hex::encode(&result.proof),
        public_inputs: result.public_inputs,
    })
}
