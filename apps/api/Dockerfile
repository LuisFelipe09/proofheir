# ===========================================
# ProofHeir Rust API - Dockerfile
# ===========================================
# Multi-stage build optimized for size and caching
# Context: Repository root (monorepo)

# Stage 1: Build
# Using Ubuntu 24.04 for GCC 14 / libstdc++ with newer symbols needed by Barretenberg
FROM ubuntu:24.04 AS builder

# Install Rust nightly (required for TLSNotary edition = "2024")
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    libssl-dev \
    cmake \
    clang \
    llvm \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Rust nightly
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain nightly
ENV PATH="/root/.cargo/bin:${PATH}"

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
FROM ubuntu:24.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3t64 \
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
