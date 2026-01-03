use notary::prover::prover;


mod verifier;
use verifier::verifier;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    // Configuration for the target server (Civil Registry Mock on Railway)
    let host = "web-production-05160.up.railway.app";
    let port = 443;
    let server_addr = tokio::net::lookup_host((host, port))
        .await?
        .next()
        .ok_or("Failed to lookup host")?;
    
    // URI to access
    let uri = "https://web-production-05160.up.railway.app/VigenciaCedula/consulta";

    println!("Starting prover test against {} ({})", uri, server_addr);

    // [New] Pre-verification check to fail fast if subject is Alive
    println!("🔍 Running pre-verification check...");
    let client = reqwest::Client::new();
    let res = client.post(uri)
        .json(&serde_json::json!({
            "nuip": 454545454,
            "ip": "143.137.96.53"
        }))
        .send()
        .await?;

    let body: serde_json::Value = res.json().await?;
    println!("Server response: {:?}", body);

    if let Some(vigencia) = body.get("vigencia").and_then(|v| v.as_str()) {
        if vigencia == "Vigente (Vivo)" {
            tracing::error!("❌ Pre-verification FAILED: Subject is 'Vigente (Vivo)'.\nCannot generate 'Proof of Death'. Aborting.");
            return Ok(());
        }
    }
    println!("✅ Pre-verification passed. Starting MPC-TLS...");

    // Connect prover and verifier.
    let (prover_socket, verifier_socket) = tokio::io::duplex(1 << 23);
    let (prover_extra_socket, verifier_extra_socket) = tokio::io::duplex(1 << 23);

    let (_, transcript) = tokio::try_join!(
        prover(prover_socket, prover_extra_socket, &server_addr, &uri),
        verifier(verifier_socket, verifier_extra_socket)
    )?;

    println!("---");
    println!("Successfully verified endpoint: {}", &uri);
    println!("MPC-TLS + ZK Proof generation complete ✅\n");

    println!(
        "Verified sent data:\n{}",
        bytes_to_redacted_string(transcript.sent_unsafe())
    );
    println!(
        "Verified received data:\n{}",
        bytes_to_redacted_string(transcript.received_unsafe())
    );

    println!("---");
    println!("Prover execution finished.");

    Ok(())
}

/// Render redacted bytes as `🙈`.
pub fn bytes_to_redacted_string(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).replace('\0', "🙈")
}

