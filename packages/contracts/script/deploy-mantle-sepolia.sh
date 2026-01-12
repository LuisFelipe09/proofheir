#!/bin/bash
# Deploy ProofHeir contracts to Mantle Sepolia Testnet
# 
# Prerequisites:
# 1. Set DEPLOYER_PRIVATE_KEY environment variable
# 2. Ensure wallet has MNT for gas on Mantle Sepolia
#    - Faucet: https://faucet.sepolia.mantle.xyz/
#
# Usage:
#   ./script/deploy-mantle-sepolia.sh
#
# Or with environment variable inline:
#   DEPLOYER_PRIVATE_KEY=0x... ./script/deploy-mantle-sepolia.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Deploying ProofHeir to Mantle Sepolia...${NC}"

# Check for private key
if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
  # Try to load from .env in project root
  if [ -f "../../.env" ]; then
    echo -e "${YELLOW}📦 Loading configuration from .env...${NC}"
    set -a
    source ../../.env
    set +a
  fi
fi

if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
  echo -e "${RED}❌ Error: DEPLOYER_PRIVATE_KEY not set${NC}"
  echo "Set it via: export DEPLOYER_PRIVATE_KEY=0x..."
  echo "Or add it to the root .env file"
  exit 1
fi

# Check for civil registry domain
if [ -z "$CIVIL_REGISTRY_DOMAIN" ]; then
  export CIVIL_REGISTRY_DOMAIN="web-production-05160.up.railway.app"
  echo -e "${YELLOW}ℹ️  Using default CIVIL_REGISTRY_DOMAIN: ${CIVIL_REGISTRY_DOMAIN}${NC}"
fi

# Check for trusted verifier address (backend wallet that verifies ZK proofs off-chain)
if [ -z "$TRUSTED_VERIFIER_ADDRESS" ]; then
  echo -e "${YELLOW}ℹ️  TRUSTED_VERIFIER_ADDRESS not set - will use deployer address${NC}"
else
  echo -e "${GREEN}🔐 Trusted verifier: ${TRUSTED_VERIFIER_ADDRESS}${NC}"
fi

# Network configuration
RPC_URL="https://rpc.sepolia.mantle.xyz"
CHAIN_ID=5003

echo -e "${GREEN}📡 Network: Mantle Sepolia (Chain ID: ${CHAIN_ID})${NC}"
echo -e "${GREEN}🔗 RPC: ${RPC_URL}${NC}"
echo ""

# Run the deployment
forge script script/DeployProofHeir.s.sol:DeployProofHeir \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --legacy \
  -vvv

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Copy the contract addresses from above"
echo "2. Update your .env.local in apps/web with:"
echo "   NEXT_PUBLIC_PROOF_HEIR_ADDRESS=<ProofHeir address>"
echo "   NEXT_PUBLIC_MOCK_TOKEN_ADDRESS=<MockERC20 address>"
echo ""
echo "3. Verify contracts on explorer (optional):"
echo "   forge verify-contract <address> src/ProofHeir.sol:ProofHeir --chain-id 5003"
