#!/usr/bin/env bash
# Pack a deployable smartstay-local release archive (built dist + manifests).
# Usage: ./scripts/pack-release.sh [version] [output.tar.gz]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-$(node -p "require('./package.json').version")}"
OUT="${2:-$ROOT/dist-release/smartstay-local-${VERSION}.tar.gz}"

echo "Building smartstay-local ${VERSION}…"
pnpm install --frozen-lockfile
pnpm build

STAGE="$(mktemp -d /tmp/smartstay-pack-XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT

DEST="$STAGE/smartstay-local"
mkdir -p "$DEST/backend" "$DEST/frontend" "$DEST/scripts"

cp package.json pnpm-lock.yaml pnpm-workspace.yaml start.sh service.conf "$DEST/"
cp -R scripts "$DEST/"
cp backend/package.json "$DEST/backend/"
cp -R backend/dist "$DEST/backend/dist"
cp frontend/package.json "$DEST/frontend/"
cp -R frontend/dist "$DEST/frontend/dist"

# Keep workspace tooling available for pnpm install on device.
if [[ -f .npmrc ]]; then
  cp .npmrc "$DEST/"
fi

mkdir -p "$(dirname "$OUT")"
tar -czf "$OUT" -C "$STAGE" smartstay-local

SHA="$(sha256sum "$OUT" | awk '{print $1}')"
echo "Packed $OUT"
echo "sha256=$SHA"
echo "version=$VERSION"
