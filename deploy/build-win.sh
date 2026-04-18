#!/usr/bin/env bash
# Build desktop widget for Windows (.msi + .exe)
# Run this from Git Bash or WSL on Windows
set -e

echo "[TextPilot] Building for Windows..."
cd "$(dirname "$0")/.."

pnpm install
pnpm --filter @textpilot/desktop build
pnpm --filter @textpilot/desktop tauri build

echo ""
echo "[TextPilot] Done. Artifacts:"
echo "  packages/desktop/src-tauri/target/release/bundle/msi/*.msi"
echo "  packages/desktop/src-tauri/target/release/bundle/nsis/*-setup.exe"
