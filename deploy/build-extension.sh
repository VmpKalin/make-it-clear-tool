#!/usr/bin/env bash
# Build Chrome/Firefox extension
set -e

echo "[TextPilot] Building extension..."
cd "$(dirname "$0")/.."

pnpm install
pnpm --filter @textpilot/extension build

echo ""
echo "[TextPilot] Done."
echo "  Load unpacked: packages/extension/dist/"
echo "  Chrome: chrome://extensions → Developer mode → Load unpacked"
