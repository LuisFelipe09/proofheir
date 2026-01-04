# ProofHeir API Server

Rust API server for generating ZK proofs of death certificates using TLSNotary and Noir.

## Environment Variables

### Required for Production

- `ALLOWED_ORIGIN`: CORS allowed origin (e.g., `https://proofheir.com`)

### Platform-Specific

**Render:**
- `PORT`: Automatically set by Render (no need to configure)
- Only set `ALLOWED_ORIGIN`

**Other platforms:**
- `BIND_ADDRESS`: Server bind address (e.g., `0.0.0.0:3001`)
  - Or use `PORT` env var for just the port number

### Optional

- `RUST_LOG`: Log level (default: `proofheir_api=info,tower_http=debug`)

## Running Locally

```bash
# Development (uses defaults)
cargo run --release

# With custom configuration
ALLOWED_ORIGIN=http://localhost:3000 \
BIND_ADDRESS=127.0.0.1:3001 \
cargo run --release
```

## Running in Production

```bash
# Example for production deployment
ALLOWED_ORIGIN=https://your-frontend.com \
BIND_ADDRESS=0.0.0.0:8080 \
RUST_LOG=proofheir_api=info \
./proofheir-api
```

## Endpoints

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

### POST /api/generate-proof
Generate a ZK proof for death certificate verification

**Request:**
```json
{
  "recipient": "abababababababababababababababababababab",
  "nuip": "454545454",
  "salt": "1111111111111111111111111111111111111111111111111111111111111111"
}
```

**Response:**
```json
{
  "proof": "0x...",
  "public_inputs": ["0x...", "0x...", ...]
}
```

## Security Notes

- NUIP and salt are **never logged** to prevent information leakage
- CORS must be configured properly for production
- Use HTTPS in production
- Consider adding rate limiting for production deployments

## Performance

- Proof generation: ~3-4 seconds
- Pre-verification: ~500ms
- MPC-TLS: ~1-2s
- ZK Proof: ~2s
