# Notary Package

TLSNotary-based prover and verifier for ProofHeir's "Proof of Death" mechanism. This package combines **MPC-TLS** (via TLSNotary) with **Zero-Knowledge proofs** (via Noir) to privately verify web activity without revealing sensitive data.

## 🎯 Purpose

This package implements the core attestation logic for ProofHeir:

1. **Prover**: Connects to a web service (e.g., civil registry API) via MPC-TLS, extracts authenticated data, and generates a ZK proof
2. **Verifier**: Validates the MPC-TLS transcript and verifies the ZK proof to confirm the prover's claims

## 🏗 Architecture

```
┌─────────────┐
│   Prover    │
│             │
│  1. MPC-TLS │──────► Connect to target server
│             │        (e.g., civil-registry-mock.onrender.com)
│  2. Extract │──────► Parse authenticated response
│     Data    │        (status, NUIP, etc.)
│             │
│  3. Generate│──────► Create ZK proof using Noir circuit
│     Proof   │        (proves status without revealing identity)
│             │
│  4. Send    │──────► Transmit proof to Verifier
└─────────────┘

┌─────────────┐
│  Verifier   │
│             │
│  1. Receive │◄────── Get MPC-TLS transcript + ZK proof
│     Data    │
│             │
│  2. Validate│──────► Check transcript commitments
│     MPC-TLS │        (ensure data authenticity)
│             │
│  3. Verify  │──────► Validate ZK proof
│     Proof   │        (confirm public inputs match commitments)
└─────────────┘
```

## 🚀 Usage

### As a Library (Recommended for API Integration)

The notary package can be used as a library for programmatic proof generation:

```rust
use notary::proof_gen::generate_death_proof;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let recipient = [0xab; 20]; // Heir's Ethereum address
    let nuip = "454545454".to_string();
    let salt = [0x11; 32];
    
    // Generates proof with pre-verification, MPC-TLS, and ZK proof
    let result = generate_death_proof(recipient, nuip, salt).await?;
    
    println!("Proof: {} bytes", result.proof.len());
    println!("Public inputs: {} fields", result.public_inputs.len());
    Ok(())
}
```

**High-level API for Solidity:**
```rust
use notary::generate_proof_for_contract;

// Returns hex-encoded proof + 116 public input fields
let bundle = generate_proof_for_contract(recipient, nuip, salt).await?;
// bundle.proof: "0x..."
// bundle.public_inputs: ["0x...", ...] (116 fields)
```

### As a CLI Tool (For Testing)

**⚠️ CRITICAL: Always use `--release` mode**

```bash
# Run with default parameters
cargo run --release

# Custom parameters
cargo run --release -- \
  --recipient abababababababababababababababababababab \
  --nuip 454545454 \
  --salt 1111111111111111111111111111111111111111111111111111111111111111
```

**Expected output**:
```
✅ Pre-verification passed. Starting MPC-TLS...
✅ ZK Proof generated successfully!
   Proof size: 19968 bytes
   VK size: 1816 bytes
✅ ZK Proof Public Input matches MPC-TLS commitment!
✅ ZK Proof successfully verified
```

## ⚡ Performance

### Proof Generation Time

| Phase | Duration |
|-------|----------|
| Pre-verification (HTTP) | ~500ms |
| MPC-TLS | ~1-2s |
| ZK Proof Generation (Noir) | ~2s |
| **Total** | **~3-4s** |

### Build Mode Comparison

| Mode | Proof Generation | Memory Usage |
|------|-----------------|---------------|
| Debug | ~5-10 minutes | ~2GB |
| Release | ~3-4 seconds | ~200MB |

**⚠️ Always use `--release` mode for production!**

## 📁 Project Structure

```
packages/notary/
├── src/
│   ├── lib.rs           # Public API exports
│   ├── main.rs          # CLI entry point
│   ├── prover.rs        # MPC-TLS prover (returns ZKProofBundle)
│   ├── verifier.rs      # MPC-TLS verifier
│   ├── proof_gen.rs     # High-level API wrapper
│   └── types.rs         # Shared types (ZKProofBundle, PublicInputs)
├── circuits.json        # Compiled Noir circuit (from packages/circuits)
├── examples/            # Usage examples
└── Cargo.toml
```

### `circuits.json`

This file contains the compiled Noir circuit bytecode and is **required** for proof generation. It is embedded into the binary at compile time via `include_str!`.

**To regenerate after circuit changes:**
```bash
# 1. Compile the circuit
cd packages/circuits
nargo compile

# 2. Copy to notary package
cp target/circuits.json ../notary/circuits.json
```

> [!IMPORTANT]
> After any changes to `packages/circuits/src/main.nr`, you must recompile the circuit and copy the updated `circuits.json` to this package.

## 🔧 Key Components

### 1. Proof Gen (`proof_gen.rs`) - **API Entry Point**

**Purpose**: High-level wrapper for proof generation

**What it does**:
1. Pre-verification HTTP check (fails fast if subject alive)
2. Orchestrates prover + verifier flow
3. Extracts public inputs from proof bundle
4. Serializes to 116 Solidity fields

**Main function**: `generate_death_proof(recipient, nuip, salt)`

### 2. Prover (`prover.rs`)

**Responsibilities**:
1. MPC-TLS connection to civil registry
2. Extract authenticated data from TLS session
3. Generate ZK proof using Noir circuit
4. **Returns** `ZKProofBundle` with proof, VK, and public inputs

**Key change**: Now returns `ZKProofBundle` instead of sending via socket

### 3. Verifier (`verifier.rs`)

**Responsibilities**:
1. Participates in MPC-TLS protocol
2. Validates transcript commitments
3. Verifies ZK proof validity
4. Checks public inputs match MPC-TLS data

### 4. Types (`types.rs`)

**`ZKProofBundle`**:
```rust
pub struct ZKProofBundle {
    pub vk: Vec<u8>,
    pub proof: Vec<u8>,
    pub public_inputs: PublicInputs, // NEW: includes all public inputs
}

pub struct PublicInputs {
    pub recipient: [u8; 20],
    pub server_hash: [u8; 32],
    pub id_commitment: [u8; 32],
    pub status_commitment: [u8; 32], // From MPC-TLS
}
```

## 🔐 Security Model

### MPC-TLS Layer
- **Prover** and **Verifier** jointly perform TLS handshake
- Server's response is authenticated via MPC
- Commitments (SHA256 hashes) ensure data integrity
- Neither party sees full plaintext alone

### ZK Proof Layer

**Public Inputs** (visible on-chain):
1. **Recipient** (20 bytes): Heir's Ethereum address
2. **Server Hash** (32 bytes): SHA256(civil registry domain)
3. **ID Commitment** (32 bytes): SHA256(NUIP || salt)
4. **Status Commitment** (32 bytes): SHA256(status || blinder) from MPC-TLS

**Private Inputs** (hidden):
- NUIP (National ID)
- Salt (for privacy)
- Server domain
- Status value
- Blinder (from MPC-TLS)

**Circuit Validates**:
- ✅ Server identity matches expected domain
- ✅ Identity commitment = SHA256(NUIP || salt)
- ✅ Status commitment matches MPC-TLS commitment
- ✅ Status indicates "No Vigente (Fallecido)" (deceased)

### Why 116 Fields for Solidity?

Each public input byte is expanded to a 32-byte field:
- Recipient: 20 bytes × 1 field/byte = 20 fields
- Server Hash: 32 bytes × 1 field/byte = 32 fields  
- ID Commitment: 32 bytes × 1 field/byte = 32 fields
- Status Commitment: 32 bytes × 1 field/byte = 32 fields
- **Total**: 116 fields

## 🧪 Testing

### Unit Tests
```bash
cargo test --release
```

### Integration Test (Live Server)
```bash
cargo run --release --bin notary
```

This connects to the live civil registry mock API at:
`https://web-production-05160.up.railway.app/VigenciaCedula/consulta`

## 🐛 Troubleshooting

### "Cannot drop a runtime" panic
**Cause**: Running in debug mode causes `noir-rs` runtime conflicts.  
**Solution**: Always use `--release` mode.

### Slow proof generation
**Cause**: Debug mode or insufficient CPU.  
**Solution**: Use `--release` and ensure at least 4 CPU cores.

### "Sumcheck failed" or verification errors
**Cause**: Toolchain version mismatch.  
**Solution**: Ensure exact versions:
```bash
nargo --version  # Should be 1.0.0-beta.8
bb --version     # Should be 1.0.0-nightly.20250723
```

## 📚 Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| `tlsn` | 0.1.0-alpha.13 | MPC-TLS protocol |
| `noir` | 1.0.0-beta.8 | ZK proof generation/verification |
| `tokio` | 1.48 | Async runtime |
| `hyper` | 1.x | HTTP client for MPC-TLS |
| `serde` | 1.x | Serialization |
| `bincode` | 1.x | Binary encoding for proofs |

## 🔗 Related Packages

- **`packages/circuits`**: Noir ZK circuit definitions
- **`packages/contracts`**: Solidity verifier contracts
- **`apps/api`**: REST API wrapping this functionality

## 📖 Further Reading

- [TLSNotary Documentation](https://docs.tlsnotary.org/)
- [Noir Language Guide](https://noir-lang.org/docs)
- [ProofHeir Architecture](../../README.md)
