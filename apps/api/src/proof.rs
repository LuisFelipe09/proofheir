use axum::{http::StatusCode, Json};
use serde::{Deserialize, Serialize};

/// Request body for proof generation
#[derive(Debug, Deserialize)]
pub struct ProofRequest {
    /// Ethereum address of the heir (hex string without 0x prefix)
    pub recipient: String,
    /// National ID number (NUIP)
    pub nuip: String,
    /// Salt for identity commitment (hex string without 0x prefix)
    pub salt: String,
}

/// Response body for proof generation
#[derive(Debug, Serialize)]
pub struct ProofResponse {
    /// Hex-encoded ZK proof
    pub proof: String,
    /// Public inputs as array of hex strings (116 fields)
    pub public_inputs: Vec<String>
}

/// Error response
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// Generate a ZK proof for death certificate verification
///
/// This endpoint:
/// 1. Validates input parameters
/// 2. Calls the notary proof generation
/// 3. Returns proof and public inputs ready for smart contract
pub async fn generate_proof(
    Json(request): Json<ProofRequest>,
) -> Result<Json<ProofResponse>, (StatusCode, Json<ErrorResponse>)> {
    tracing::info!("Received proof generation request");

    // Helper to strip 0x prefix if present
    let strip_0x = |s: &str| -> String {
        s.strip_prefix("0x")
            .or_else(|| s.strip_prefix("0X"))
            .unwrap_or(s)
            .to_string()
    };

    // Validate and parse recipient address (20 bytes) - accept with or without 0x
    let recipient = hex::decode(strip_0x(&request.recipient))
        .map_err(|e| {
            tracing::error!("Invalid recipient hex: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Invalid recipient address: {}", e),
                }),
            )
        })?
        .try_into()
        .map_err(|v: Vec<u8>| {
            tracing::error!("Recipient must be exactly 20 bytes, got {}", v.len());
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Recipient must be exactly 20 bytes, got {}", v.len()),
                }),
            )
        })?;

    // Validate and parse salt (32 bytes) - accept with or without 0x
    let salt = hex::decode(strip_0x(&request.salt))
        .map_err(|e| {
            tracing::error!("Invalid salt hex: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Invalid salt: {}", e),
                }),
            )
        })?
        .try_into()
        .map_err(|v: Vec<u8>| {
            tracing::error!("Salt must be exactly 32 bytes, got {}", v.len());
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Salt must be exactly 32 bytes, got {}", v.len()),
                }),
            )
        })?;

    tracing::info!("✅ Input validation passed");
    tracing::info!("   Recipient: 0x{}", hex::encode(&recipient));
    // NUIP and salt are sensitive - not logged

    // Generate proof using the notary library
    tracing::info!("🚀 Starting proof generation...");
    
    let result = notary::proof_gen::generate_death_proof(recipient, request.nuip, salt)
        .await
        .map_err(|e| {
            tracing::error!("Proof generation failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Proof generation failed: {}", e),
                }),
            )
        })?;

    tracing::info!("✅ Proof generation successful!");
    tracing::info!("   Proof size: {} bytes", result.proof.len());
    tracing::info!("   VK size: {} bytes", result.vk.len());
    tracing::info!("   Public inputs: {} fields", result.public_inputs.len());

    // Return the proof bundle
    Ok(Json(ProofResponse {
        proof: hex::encode(&result.proof),
        public_inputs: result.public_inputs,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proof_request_deserialization() {
        let json = r#"{
            "recipient": "abababababababababababababababababababab",
            "nuip": "454545454",
            "salt": "1111111111111111111111111111111111111111111111111111111111111111"
        }"#;

        let request: ProofRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.recipient, "abababababababababababababababababababab");
        assert_eq!(request.nuip, "454545454");
        assert_eq!(
            request.salt,
            "1111111111111111111111111111111111111111111111111111111111111111"
        );
    }

    #[test]
    fn test_recipient_validation() {
        // Valid 20-byte hex
        let valid = hex::decode("abababababababababababababababababababab").unwrap();
        assert_eq!(valid.len(), 20);

        // Invalid length
        let invalid = hex::decode("abab").unwrap();
        assert_ne!(invalid.len(), 20);
    }

    #[test]
    fn test_salt_validation() {
        // Valid 32-byte hex
        let valid =
            hex::decode("1111111111111111111111111111111111111111111111111111111111111111")
                .unwrap();
        assert_eq!(valid.len(), 32);

        // Invalid length
        let invalid = hex::decode("1111").unwrap();
        assert_ne!(invalid.len(), 32);
    }
}
