# ===========================================
# ProofHeir Rust API - Dockerfile
# ===========================================
# Multi-stage build optimized for size and caching
# Context: Repository root (monorepo)

# Stage 1: Build
FROM rust:1.83-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    clang \
    llvm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace Cargo files first for dependency caching
COPY Cargo.toml Cargo.lock ./

# Copy only what's needed for compilation:
# - notary package (includes circuits.json for include_str!)
COPY packages/notary ./packages/notary

# Copy api source
COPY apps/api ./apps/api

# Build release binary
# Note: circuits.json is embedded via include_str! at compile time
RUN cargo build --release --package proofheir-api

# Stage 2: Runtime (minimal image)
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/proofheir-api /app/proofheir-api

# Expose port (Render sets PORT env var)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3001}/health || exit 1

# Run the binary
CMD ["/app/proofheir-api"]
