# ProofHeir Smart Contracts

Solidity smart contracts for ProofHeir's decentralized inheritance protocol using ZK proofs and EIP-7702 delegation.

## 📦 Package Contents

### Smart Contracts (`src/`)

- **`ProofHeir.sol`** - Main inheritance contract
  - Handles registration and claim verification
  - Integrates with ZK proof verifier
  - Manages asset transfers to heirs

- **`Verifier.sol`** - UltraHonk ZK proof verifier
  - Generated from Noir circuit
  - Verifies 116 public input fields
  - Validates proof authenticity

- **`MockVerifier.sol`** - Mock verifier for testing
  - Always returns true
  - Used for development/testing

- **`MockERC20.sol`** - Test token
  - For testing asset transfers
  - Mintable for demo purposes

### Tests (`test/`)

- **`ProofHeir.t.sol`** - Core contract tests
- **`VerifierIntegration.t.sol`** - ZK proof integration tests
- **`fixtures/`** - Test data and proof fixtures

### Deployment (`script/`)

- **`DeployProofHeir.s.sol`** - Deployment script
  - Deploys Verifier, ProofHeir, and MockERC20
  - Configures trusted server domain
  - Mints test tokens

## 🚀 Quick Start

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Installation

```bash
cd packages/contracts
forge install
```

## 🧪 Testing

### Run All Tests

```bash
forge test
```

### Run Specific Test

```bash
# Test ProofHeir contract
forge test --match-contract ProofHeirTest

# Test Verifier integration
forge test --match-contract VerifierIntegrationTest
```

### Run with Verbosity

```bash
# Show logs
forge test -vv

# Show traces
forge test -vvv

# Show stack traces
forge test -vvvv
```

### Gas Report

```bash
forge test --gas-report
```

## 🏗️ Building

### Compile Contracts

```bash
forge build
```

### Format Code

```bash
forge fmt
```

### Check Coverage

```bash
forge coverage
```

## 🚢 Deployment

### Local Deployment (Anvil)

1. **Start local node:**
```bash
anvil
```

2. **Deploy contracts:**
```bash
forge script script/DeployProofHeir.s.sol:DeployProofHeir \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

### Testnet Deployment (Mantle Sepolia)

1. **Set environment variables:**
```bash
export PRIVATE_KEY=your_private_key_here
export RPC_URL=https://rpc.sepolia.mantle.xyz
```

2. **Deploy:**
```bash
forge script script/DeployProofHeir.s.sol:DeployProofHeir \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

### Mainnet Deployment (Mantle)

```bash
export PRIVATE_KEY=your_private_key_here
export RPC_URL=https://rpc.mantle.xyz

forge script script/DeployProofHeir.s.sol:DeployProofHeir \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --slow
```

## 🔧 Configuration

### Foundry Configuration (`foundry.toml`)

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
cache_path = "cache"
fs_permissions = [{ access = "read", path = "test/fixtures" }]
```

### Network Configuration

Add to `foundry.toml` for network aliases:

```toml
[rpc_endpoints]
mantle = "https://rpc.mantle.xyz"
mantle_sepolia = "https://rpc.sepolia.mantle.xyz"
```

## 📝 Contract Addresses

### Mantle Sepolia (Testnet)

```
ProofHeir: TBD
Verifier: TBD
MockERC20: TBD
```

### Mantle (Mainnet)

```
ProofHeir: TBD
Verifier: TBD
```

## 🔍 Verification

### Verify on Mantle Explorer

```bash
forge verify-contract \
  --chain-id 5003 \
  --compiler-version v0.8.20 \
  <CONTRACT_ADDRESS> \
  src/ProofHeir.sol:ProofHeir \
  --etherscan-api-key <API_KEY>
```

## 🛠️ Development Tools

### Cast - Interact with Contracts

```bash
# Call a view function
cast call <CONTRACT_ADDRESS> "trustedServerDomain()(string)"

# Send a transaction
cast send <CONTRACT_ADDRESS> "register(address,bytes32)" <HEIR> <ID_COMMITMENT> \
  --private-key $PRIVATE_KEY
```

### Chisel - Solidity REPL

```bash
chisel
```

## 📚 Additional Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Mantle Documentation](https://docs.mantle.xyz/)
- [ProofHeir Architecture](../../README.md)
- [Noir Circuit](../circuits/README.md)

## 🔐 Security

- ⚠️ **MockVerifier** is for testing only - DO NOT use in production
- ✅ Use the real **Verifier.sol** generated from Noir circuit
- 🔒 Always verify contracts on explorer after deployment
- 🛡️ Audit smart contracts before mainnet deployment

## 📄 License

MIT
