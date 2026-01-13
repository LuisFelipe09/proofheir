# ProofHeir - Development Guide

## 🚀 Quick Start

### Option 1: Automated (Recommended)
```bash
# Run both servers concurrently
./dev.sh
```

### Option 2: Manual

**Terminal 1 - Rust API Server:**
```bash
cd apps/api
cargo run --release
```

**Terminal 2 - Next.js Frontend:**
```bash
# From project root
pnpm dev:web
```

## 📡 Architecture

```
┌─────────────────┐
│  Next.js (3000) │
│   Frontend      │
└────────┬────────┘
         │ HTTP Proxy
         ▼
┌─────────────────┐
│  Axum (3001)    │
│  Rust API       │
└────────┬────────┘
         │ Calls
         ▼
┌─────────────────┐
│  Notary Package │
│  TLSNotary+Noir │
└─────────────────┘
```

## 🔧 Environment Variables

Create `.env.local` in `apps/web/`:
```bash
# Rust API URL (default: http://localhost:3001)
RUST_API_URL=http://localhost:3001

# RPC URL for blockchain
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

## 📝 Testing the Integration

### 1. Health Check
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

### 2. Generate Proof (Mock)
```bash
curl -X POST http://localhost:3001/api/generate-proof \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "0x03f72d5859858AFF7b93096B4AD9593442DD2327",
    "nuip": "123456789",
    "salt": "0x1111111111111111111111111111111111111111111111111111111111111111"
  }'
```

### 3. Test via Next.js Proxy
```bash
curl -X POST http://localhost:3000/api/generate-proof \
  -H "Content-Type": "application/json" \
  -d '{
    "recipient": "0x03f72d5859858AFF7b93096B4AD9593442DD2327",
    "nuip": "123456789",
    "salt": "0x1111111111111111111111111111111111111111111111111111111111111111"
  }'
```

## 🏗 Project Structure

```
proofheir/
├── apps/
│   ├── api/              # Rust Axum server
│   │   ├── src/
│   │   │   ├── main.rs   # Server setup
│   │   │   └── proof.rs  # Proof service
│   │   └── Cargo.toml
│   └── web/              # Next.js frontend
│       └── src/app/api/generate-proof/
│           └── route.ts  # Proxy to Rust API
├── packages/
│   ├── notary/           # TLSNotary + Noir
│   ├── circuits/         # Noir ZK circuits
│   └── contracts/        # Solidity contracts
└── dev.sh                # Development script
```

## 🔄 Current Status

- ✅ Rust API server (Axum)
- ✅ Next.js proxy endpoint
- ✅ CORS configuration
- ✅ Request validation
- ✅ TLSNotary + Noir integration
- ✅ On-chain ZK proof verification

## 🐛 Troubleshooting

### Port already in use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Rust compilation errors
```bash
cd apps/api
cargo clean
cargo build --release
```

### Next.js not connecting to Rust API
Check that:
1. Rust server is running on port 3001
2. CORS is configured correctly
3. `RUST_API_URL` environment variable is set
