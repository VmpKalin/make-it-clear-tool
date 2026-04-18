#!/usr/bin/env bash
# Run typecheck across all TS packages + cargo check for Rust
set -e

echo "[TextPilot] Typechecking TypeScript..."
cd "$(dirname "$0")/.."
pnpm typecheck

echo ""
echo "[TextPilot] Checking Rust..."
cd packages/desktop/src-tauri
cargo check

echo ""
echo "[TextPilot] All good."
