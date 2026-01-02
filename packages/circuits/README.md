# ProofHeir Circuits

Noir ZK circuit for verifying death certificate proofs using SHA256 hashing.

## Prerequisites

```bash
# Install Noir compiler
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup -v 1.0.0-beta.17

# Install Barretenberg prover
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash
bbup -v 3.0.0-nightly.20251104
```

## Circuit Compilation & Testing

```bash
# Compile the circuit
nargo compile

# Run unit tests
nargo test
```

## Proof Generation

> **Important:** Always use `--oracle_hash keccak` flag for Solidity compatibility.

```bash
# 1. Execute circuit (generates witness)
nargo execute

# 2. Generate verification key
bb write_vk -b ./target/circuits.json -o ./target --oracle_hash keccak

# 3. Generate proof
bb prove -b ./target/circuits.json -w ./target/circuits.gz -o ./target --oracle_hash keccak

# 4. (Optional) Verify proof locally
bb verify -p ./target/proof -k ./target/vk
```

## Solidity Verifier Generation

```bash
bb write_solidity_verifier -k ./target/vk -o ./target/Verifier.sol

# Copy to contracts package
cp ./target/Verifier.sol ../contracts/src/Verifier.sol
```

## Output Files

| File | Description |
|------|-------------|
| `target/circuits.json` | Compiled circuit (ACIR) |
| `target/circuits.gz` | Witness data |
| `target/vk` | Verification key |
| `target/proof` | ZK proof |
| `target/public_inputs` | Serialized public inputs |
| `target/Verifier.sol` | Solidity verifier contract |

## Public Inputs Format

The circuit expects 116 public inputs (each byte serialized as a 32-byte field element):

| Input | Size | Description |
|-------|------|-------------|
| `recipient` | 20 bytes | Ethereum address to prevent front-running |
| `server_hash` | 32 bytes | SHA256 hash of trusted server domain |
| `id_commitment` | 32 bytes | SHA256(nuip + salt) |
| `status_commitment` | 32 bytes | SHA256(status + blinder) |

## Configuration

Edit `Prover.toml` with your inputs before generating proofs.
