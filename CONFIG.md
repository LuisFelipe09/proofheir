# ProofHeir Configuration Guide

## Single Source of Truth: `.env`

All configuration is managed through the `.env` file at the root of the monorepo.

### Quick Start

1. **Create `.env` from template:**
   ```bash
   cp .env.example .env
   ```

2. **Deploy contracts:**
   ```bash
   ./scripts/deploy.sh
   ```

3. **Start API server:**
   ```bash
   cd apps/api
   cargo run --release
   ```

## Configuration Variables

Edit `.env` to configure:

```bash
# Civil Registry Server
CIVIL_REGISTRY_DOMAIN=web-production-05160.up.railway.app
CIVIL_REGISTRY_URL=https://web-production-05160.up.railway.app/VigenciaCedula/consulta

# API Server
API_PORT=3001
API_CORS_ORIGIN=http://localhost:3000

# Blockchain
RPC_URL=http://localhost:8545
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Changing the Civil Registry Server

1. **Update `.env`:**
   ```bash
   CIVIL_REGISTRY_DOMAIN=your-server.example.com
   CIVIL_REGISTRY_URL=https://your-server.example.com/VigenciaCedula/consulta
   ```

2. **Redeploy:**
   ```bash
   ./scripts/deploy.sh
   cd apps/api && cargo run --release
   ```

**Note:** The deployment script automatically pads the domain to 40 characters in Solidity.

## Troubleshooting

### "Invalid data source (server domain)" Error

The `server_hash` in the ZK proof doesn't match the contract's `trustedServerHash`.

**Solution:**
1. Verify `CIVIL_REGISTRY_DOMAIN` in `.env` is correct
2. Redeploy contracts: `./scripts/deploy.sh`
3. Restart API: `cd apps/api && cargo run --release`
4. Generate new proof
