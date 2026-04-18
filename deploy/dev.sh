#!/usr/bin/env bash
# Start desktop widget in dev mode (hot reload)
set -e

echo "[TextPilot] Starting dev mode..."
cd "$(dirname "$0")/.."
pnpm --filter @textpilot/desktop tauri dev
