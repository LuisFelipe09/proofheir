#!/bin/bash
# Deploy contracts using configuration from .env

set -e

# Check that .env exists
if [ ! -f ".env" ]; then
  echo "❌ Error: .env file not found"
  echo "Run: cp .env.example .env"
  exit 1
fi

echo "📦 Loading configuration from .env..."

# Load .env into current shell
set -a
source .env
set +a

echo "🚀 Deploying contracts..."

cd packages/contracts

# Foundry will use the environment variables we just loaded
forge script script/DeployProofHeir.s.sol:DeployProofHeir \
  --rpc-url "${RPC_URL:-http://localhost:8545}" \
  --private-key "${DEPLOYER_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}" \
  --broadcast

echo "✅ Deployment complete!"
