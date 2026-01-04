/// Example to test proof_gen module directly
use notary::proof_gen::generate_death_proof;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("🧪 Testing proof_gen module...\n");

    // Test parameters (same as main.rs test)
    let recipient = [0xab; 20]; // abababababababababababababababababababab
    let nuip = "454545454".to_string();
    let salt = [0x11; 32]; // 1111...1111

    println!("📋 Test Parameters:");
    println!("   Recipient: 0x{}", hex::encode(&recipient));
    println!("   NUIP: {}", nuip);
    println!("   Salt: 0x{}\n", hex::encode(&salt));

    // Call the proof generation function
    println!("🚀 Calling generate_death_proof()...\n");
    
    let result = generate_death_proof(recipient, nuip, salt).await?;

    println!("\n✅ Proof generation successful!\n");
    println!("📦 Results:");
    println!("   Proof size: {} bytes", result.proof.len());
    println!("   VK size: {} bytes", result.vk.len());
    println!("   Public inputs: {} fields", result.public_inputs.len());
    println!("   First public input: {}", result.public_inputs[0]);
    println!("   Last public input: {}", result.public_inputs[115]);

    // Verify we have exactly 116 fields
    assert_eq!(result.public_inputs.len(), 116, "Must have exactly 116 public input fields");
    println!("\n✅ All assertions passed!");

    Ok(())
}
