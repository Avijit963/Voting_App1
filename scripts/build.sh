#!/bin/bash

echo "Building Solana Voting DApp..."

# Build the Rust program
echo "Building Solana program..."
cd program
cargo build-bpf --manifest-path=Cargo.toml --bpf-out-dir=../target/deploy

echo "Program built successfully!"
echo ""
echo "Next steps:"
echo "1. Deploy program: solana program deploy target/deploy/solana_voting_program.so"
echo "2. Open index.html in your browser"
echo "3. Connect your Phantom wallet with Devnet SOL"
echo ""
echo "Make sure you have:"
echo "- Solana CLI installed"
echo "- Phantom wallet extension"
echo "- Some Devnet SOL for testing"
