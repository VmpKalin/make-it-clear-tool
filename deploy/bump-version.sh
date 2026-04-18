#!/usr/bin/env bash
# Bump version across all files that need it
# Usage: ./scripts/bump-version.sh 0.2.0
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.2.0"
  exit 1
fi

ROOT="$(dirname "$0")/.."
cd "$ROOT"

echo "[TextPilot] Bumping version to $VERSION..."

# root package.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json && rm package.json.bak

# desktop package.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" packages/desktop/package.json && rm packages/desktop/package.json.bak

# extension package.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" packages/extension/package.json && rm packages/extension/package.json.bak

# extension manifest.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" packages/extension/manifest.json && rm packages/extension/manifest.json.bak

# tauri.conf.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" packages/desktop/src-tauri/tauri.conf.json && rm packages/desktop/src-tauri/tauri.conf.json.bak

# Cargo.toml
sed -i.bak "s/^version = \".*\"/version = \"$VERSION\"/" packages/desktop/src-tauri/Cargo.toml && rm packages/desktop/src-tauri/Cargo.toml.bak

echo "[TextPilot] Done. Files updated:"
echo "  package.json"
echo "  packages/desktop/package.json"
echo "  packages/desktop/src-tauri/tauri.conf.json"
echo "  packages/desktop/src-tauri/Cargo.toml"
echo "  packages/extension/package.json"
echo "  packages/extension/manifest.json"
echo ""
echo "Next: pnpm install (updates lockfile), then build."
