#!/usr/bin/env bash
set -euo pipefail

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler not found. Install first: npm i -g wrangler"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

GLOBAL_JSON="${1:-}"
if [[ -z "$GLOBAL_JSON" ]]; then
  cat <<'EOF'
Usage:
  ./scripts/seed-kv.sh '{"warehouseOrigin":{"city":"Jakarta Selatan","cityId":"151"},"analytics":{"fbPixelId":"123"}}'

Tips:
- Secrets (admin token, lincah key, capi token) should be set via wrangler secret put
- This script writes only non-secret global config into KV key: config:global
EOF
  exit 1
fi

echo "Writing config:global to KV (binding KV)..."
wrangler kv key put --binding KV "config:global" "$GLOBAL_JSON"

echo "Initializing slugs:index if missing..."
# Safe overwrite to empty index for first setup; rerun manually if needed.
wrangler kv key put --binding KV "slugs:index" "[]"

echo "Uploading admin/index.html to static:admin.html..."
wrangler kv key put --binding KV "static:admin.html" --path ./admin/index.html

echo "Seed done ✅"
