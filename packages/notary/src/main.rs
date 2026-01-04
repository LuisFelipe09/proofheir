use notary::prover::prover;
use notary::verifier::verifier;
use clap::Parser;

/// TLSNotary Prover for generating ZK proofs of death certificates
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Recipient Ethereum address (40 hex characters without 0x prefix)
    #[arg(short, long, default_value = "abababababababababababababababababababab")]
    recipient: String,

    /// National ID number (NUIP)
    #[arg(short, long, default_value = "454545454")]
    nuip: String,

    /// Salt for ID commitment (64 hex characters)
    #[arg(short, long, default_value = "1111111111111111111111111111111111111111111111111111111111111111")]
    salt: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    // Parse recipient address
    let recipient_hex = args.recipient.trim_start_matches("0x");
    if recipient_hex.len() != 40 {
        return Err("Recipient address must be 40 hex characters (20 bytes)".into());
    }
    let recipient_bytes = hex::decode(recipient_hex)
        .map_err(|_| "Invalid recipient address hex")?;
    let mut recipient = [0u8; 20];
    recipient.copy_from_slice(&recipient_bytes);

    // Parse salt
    let salt_hex = args.salt.trim_start_matches("0x");
    if salt_hex.len() != 64 {
        return Err("Salt must be 64 hex characters (32 bytes)".into());
    }
    let salt_bytes = hex::decode(salt_hex)
        .map_err(|_| "Invalid salt hex")?;
    let mut salt = [0u8; 32];
    salt.copy_from_slice(&salt_bytes);

    // Validate NUIP
    let nuip = args.nuip.clone();
    if nuip.is_empty() {
        return Err("NUIP cannot be empty".into());
    }

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
    let nuip_number: u64 = nuip.parse()
        .map_err(|_| "Invalid NUIP format for pre-verification")?;
    let res = client.post(uri)
        .json(&serde_json::json!({
            "nuip": nuip_number,
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

    let (proof_bundle, transcript) = tokio::try_join!(
        prover(prover_socket, prover_extra_socket, &server_addr, &uri, recipient, &nuip, salt),
        verifier(verifier_socket, verifier_extra_socket)
    )?;

    // Log proof bundle info
    println!("\n📦 Proof Bundle Generated:");
    println!("   Proof size: {} bytes", proof_bundle.proof.len());
    println!("   VK size: {} bytes", proof_bundle.vk.len());

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

/// Render redacted bytes as `*`.
pub fn bytes_to_redacted_string(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).replace('\0', "*")
}

