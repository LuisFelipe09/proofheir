#!/bin/bash

# Development script to run both servers concurrently

echo "🚀 Starting ProofHeir Development Servers"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $RUST_PID $NEXT_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Rust API server
echo -e "${BLUE}[1/2]${NC} Starting Rust API server on port 3001..."
cd apps/api
cargo run --release &
RUST_PID=$!
cd ../..

# Wait for Rust server to start
sleep 3

# Start Next.js frontend
echo -e "${BLUE}[2/2]${NC} Starting Next.js frontend on port 3000..."
cd apps/web
npm run dev &
NEXT_PID=$!
cd ../..

echo ""
echo -e "${GREEN}✅ Servers started!${NC}"
echo ""
echo "📡 Endpoints:"
echo "   Frontend:  http://localhost:3000"
echo "   Rust API:  http://localhost:3001"
echo "   Health:    http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait
