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

### Prerequisites

1. **Noir toolchain** (for circuit compilation):
   ```bash
   noirup --version 1.0.0-beta.8
   bbup -v 1.0.0-nightly.20250723
   ```

2. **Rust** (1.70+):
   ```bash
   rustup update stable
   ```

### Running the Example

**⚠️ CRITICAL: Always use `--release` mode**

ZK proof generation is computationally intensive. Debug mode can be **10-50x slower** and may cause runtime issues.

```bash
cd packages/notary
cargo run --release
```

**Expected output**:
```
✅ Pre-verification passed. Starting MPC-TLS...
✅ Proof generated (19968 bytes)
✅ ZK Proof Public Input matches MPC-TLS commitment!
✅ ZK Proof successfully verified
MPC-TLS + ZK Proof generation complete ✅
```

### Performance Comparison

| Mode | Proof Generation Time | Memory Usage |
|------|----------------------|--------------|
| Debug (`cargo run`) | ~5-10 minutes | ~2GB |
| Release (`cargo run --release`) | ~3-5 seconds | ~200MB |

## 📁 Project Structure

```
packages/notary/
├── src/
│   ├── main.rs          # Entry point (runs prover + verifier)
│   ├── lib.rs           # Public API exports
│   ├── prover.rs        # MPC-TLS prover + ZK proof generation
│   ├── verifier.rs      # MPC-TLS verifier + ZK proof validation
│   └── types.rs         # Shared types (ZKProofBundle, etc.)
├── Cargo.toml           # Dependencies (tlsn, noir-rs, etc.)
└── README.md            # This file
```

## 🔧 Key Components

### Prover (`prover.rs`)

**Responsibilities**:
1. Establish MPC-TLS connection to target server
2. Send authenticated HTTP request
3. Extract and commit to specific response fields (e.g., "vigencia")
4. Generate ZK proof using Noir circuit
5. Transmit proof to verifier

**Key functions**:
- `prover()`: Main async function orchestrating the flow
- `prepare_zk_proof_input()`: Extracts and validates data from MPC-TLS transcript
- `generate_zk_proof()`: Calls Noir circuit to create proof

### Verifier (`verifier.rs`)

**Responsibilities**:
1. Receive MPC-TLS transcript from prover
2. Validate transcript commitments (hash-based)
3. Receive and deserialize ZK proof bundle
4. Verify proof matches committed data
5. Validate proof cryptographically

**Key functions**:
- `verifier()`: Main async function
- Validates server name, transcript commitments, and ZK proof

### Types (`types.rs`)

**`ZKProofBundle`**:
```rust
pub struct ZKProofBundle {
    pub vk: Vec<u8>,    // Verification key
    pub proof: Vec<u8>, // ZK proof
}
```

## 🔐 Security Model

### MPC-TLS Layer
- **Prover** and **Verifier** jointly perform TLS handshake
- Server's response is authenticated via MPC (neither party sees full plaintext alone)
- Commitments (SHA256 hashes) ensure data integrity

### ZK Proof Layer
- **Public inputs**: Recipient address, server hash, identity commitment, status commitment
- **Private inputs**: NUIP, salt, server domain, status, blinder
- **Circuit validates**:
  - Server identity matches expected domain
  - Identity commitment = SHA256(NUIP || salt)
  - Status commitment matches MPC-TLS commitment
  - Status indicates "No Vigente (Fallecido)" (deceased)

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
