#!/usr/bin/env bash
# Build desktop widget for macOS (.dmg + .app)
set -e

echo "[TextPilot] Building for macOS..."
cd "$(dirname "$0")/.."

pnpm install
pnpm --filter @textpilot/desktop build
pnpm --filter @textpilot/desktop tauri build

echo ""
echo "[TextPilot] Done. Artifacts:"
echo "  packages/desktop/src-tauri/target/release/bundle/dmg/*.dmg"
echo "  packages/desktop/src-tauri/target/release/bundle/macos/*.app"
