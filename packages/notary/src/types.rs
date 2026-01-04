use serde::{Deserialize, Serialize};
use tlsn::transcript::{hash::PlaintextHash, Direction, TranscriptCommitment};

#[derive(Serialize, Deserialize, Debug)]
pub struct ZKProofBundle {
    pub vk: Vec<u8>,
    pub proof: Vec<u8>,
    /// Public inputs used to generate this proof
    /// These are the EXACT values that were used in the ZK circuit
    pub public_inputs: PublicInputs,
}

/// Public inputs for the ZK proof
/// These must match exactly what was used during proof generation
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PublicInputs {
    pub recipient: [u8; 20],
    pub server_hash: [u8; 32],
    pub id_commitment: [u8; 32],
    pub status_commitment: [u8; 32],
}

/// Proof bundle formatted for Solidity contract consumption
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SolidityProofBundle {
    /// ZK proof bytes (hex-encoded for JSON)
    pub proof: String,
    /// Public inputs as array of 32-byte hex strings (116 fields total)
    pub public_inputs: Vec<String>,
}

// extract commitment from prover output
pub fn received_commitments(
    transcript_commitments: &[TranscriptCommitment],
) -> Vec<&PlaintextHash> {
    transcript_commitments
        .iter()
        .filter_map(|commitment| match commitment {
            TranscriptCommitment::Hash(hash) if hash.direction == Direction::Received => Some(hash),
            _ => None,
        })
        .collect()
}

/// Converts a single byte to a 32-byte field element (little-endian)
/// Used for serializing public inputs to Solidity format
pub fn byte_to_field(byte: u8) -> [u8; 32] {
    let mut field = [0u8; 32];
    field[31] = byte; // Store byte in least significant position
    field
}

/// Serializes public inputs to Solidity-compatible format (116 fields)
/// Format: [recipient(20) | server_hash(32) | id_commitment(32) | status_commitment(32)]
pub fn serialize_public_inputs_for_solidity(
    recipient: [u8; 20],
    server_hash: [u8; 32],
    id_commitment: [u8; 32],
    status_commitment: &[u8],
) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    if status_commitment.len() != 32 {
        return Err(format!("status_commitment must be 32 bytes, got {}", status_commitment.len()).into());
    }
    
    let mut fields = Vec::new();
    
    // Recipient (20 bytes → 20 fields)
    for byte in recipient {
        let field = byte_to_field(byte);
        fields.push(format!("0x{}", hex::encode(field)));
    }
    
    // Server hash (32 bytes → 32 fields)
    for byte in server_hash {
        let field = byte_to_field(byte);
        fields.push(format!("0x{}", hex::encode(field)));
    }
    
    // ID commitment (32 bytes → 32 fields)
    for byte in id_commitment {
        let field = byte_to_field(byte);
        fields.push(format!("0x{}", hex::encode(field)));
    }
    
    // Status commitment (32 bytes → 32 fields)
    for byte in status_commitment {
        let field = byte_to_field(*byte);
        fields.push(format!("0x{}", hex::encode(field)));
    }
    
    assert_eq!(fields.len(), 116, "Public inputs must have exactly 116 fields");
    Ok(fields)
}
