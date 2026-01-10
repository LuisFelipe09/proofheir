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
    /// Ethereum address of the testator (delegated account)
    pub testator_address: String,
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

    // Validate and parse testator address (20 bytes) - accept with or without 0x
    let testator_address = hex::decode(strip_0x(&request.testator_address))
        .map_err(|e| {
            tracing::error!("Invalid testator address hex: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Invalid testator address: {}", e),
                }),
            )
        })?
        .try_into()
        .map_err(|v: Vec<u8>| {
            tracing::error!("Testator address must be exactly 20 bytes, got {}", v.len());
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Testator address must be exactly 20 bytes, got {}", v.len()),
                }),
            )
        })?;

    tracing::info!("✅ Input validation passed");
    tracing::info!("   Recipient: 0x{}", hex::encode(&recipient));
    tracing::info!("   Testator: 0x{}", hex::encode(&testator_address));
    // NUIP and salt are sensitive - not logged

    // Generate proof using the notary library
    tracing::info!("🚀 Starting proof generation...");
    
    let result = notary::proof_gen::generate_death_proof(recipient, request.nuip, salt, testator_address)
        .await
        .map_err(|e| {
            let error_str = e.to_string();
            tracing::error!("Proof generation failed: {}", error_str);
            
            // Classify errors and return appropriate HTTP status codes
            let (status, user_message) = classify_proof_error(&error_str);
            
            (
                status,
                Json(ErrorResponse {
                    error: user_message,
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

/// Classify proof generation errors and return appropriate HTTP status codes
/// This prevents the service from crashing due to unhandled errors in prover/verifier
fn classify_proof_error(error: &str) -> (StatusCode, String) {
    let error_lower = error.to_lowercase();
    
    // ============================================================================
    // 1. BAD REQUEST (400) - Client input validation errors
    // ============================================================================
    if error_lower.contains("invalid nuip")
        || error_lower.contains("uri must use https")
        || error_lower.contains("uri must have authority")
        || error_lower.contains("invalid recipient")
        || error_lower.contains("invalid salt")
        || error_lower.contains("invalid testator")
    {
        return (
            StatusCode::BAD_REQUEST,
            format!("Invalid request parameters: {}", error),
        );
    }
    
    // ============================================================================
    // 2. UNPROCESSABLE ENTITY (422) - Business logic errors (subject is alive)
    // ============================================================================
    if error_lower.contains("subject is alive")
        || error_lower.contains("proof of death")
        || error_lower.contains("vigente (vivo)")
    {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            "Cannot generate proof: subject is still alive according to registry".to_string(),
        );
    }
    
    // ============================================================================
    // 3. BAD GATEWAY (502) - External service errors (Civil Registry, TLS)
    // ============================================================================
    if error_lower.contains("failed to query civil registry")
        || error_lower.contains("mpc-tls request failed")
        || error_lower.contains("tls")
        || error_lower.contains("certificate")
        || error_lower.contains("connection refused")
        || error_lower.contains("dns")
        || error_lower.contains("lookup host")
        || error_lower.contains("connection reset")
        || error_lower.contains("timeout")
    {
        return (
            StatusCode::BAD_GATEWAY,
            format!("External service error: Unable to connect to civil registry. Please try again later. Details: {}", error),
        );
    }
    
    // ============================================================================
    // 4. UNPROCESSABLE ENTITY (422) - ZK proof generation/verification errors
    // ============================================================================
    if error_lower.contains("prover error")
        || error_lower.contains("verifier error")
        || error_lower.contains("zk proof")
        || error_lower.contains("witness")
        || error_lower.contains("bytecode")
        || error_lower.contains("srs")
        || error_lower.contains("verification key")
        || error_lower.contains("commitment")
        || error_lower.contains("hash")
        || error_lower.contains("noir")
        || error_lower.contains("barretenberg")
        || error_lower.contains("computed hash does not match")
        || error_lower.contains("received commitments")
        || error_lower.contains("received secrets")
        || error_lower.contains("no responses found")
        || error_lower.contains("vigencia field not found")
        || error_lower.contains("status_commitment")
        || error_lower.contains("mpc-tls commitment")
        || error_lower.contains("proof too short")
    {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            format!("ZK proof generation failed: {}. This may indicate an incompatible data format from the registry.", error),
        );
    }
    
    // ============================================================================
    // 5. SERVICE UNAVAILABLE (503) - Blockchain/on-chain errors
    // ============================================================================
    if error_lower.contains("verifier_private_key")
        || error_lower.contains("rpc")
        || error_lower.contains("transaction")
        || error_lower.contains("send transaction")
        || error_lower.contains("receipt")
        || error_lower.contains("reverted")
        || error_lower.contains("gas")
        || error_lower.contains("contract")
        || error_lower.contains("provedeathandregisterheir")
    {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            format!("Blockchain service temporarily unavailable: {}. Please try again later.", error),
        );
    }
    
    // ============================================================================
    // 6. INTERNAL SERVER ERROR (500) - Unexpected/unknown errors
    // ============================================================================
    // Log the full error for debugging but return a generic message
    tracing::error!("Unclassified error (please add classification): {}", error);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        "An unexpected error occurred during proof generation. The team has been notified.".to_string(),
    )
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
