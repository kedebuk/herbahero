#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== Herbahero deploy precheck =="

echo "[1/5] File checks"
for f in worker/index.js worker/lp-shell.js worker/wrangler.toml admin/index.html; do
  [[ -f "$f" ]] || { echo "Missing: $f"; exit 1; }
  echo "  OK $f"
done

echo "[2/5] Required env placeholders in wrangler.toml"
rg -q "kv_namespaces" worker/wrangler.toml || { echo "Missing kv_namespaces config"; exit 1; }
rg -q "r2_buckets" worker/wrangler.toml || { echo "Missing r2_buckets config"; exit 1; }
echo "  OK wrangler bindings"

echo "[3/5] Legacy shipping refs should be gone"
if rg -n "RajaOngkir|RAJAONGKIR|rajaongkir\\.komerce" worker admin >/dev/null; then
  echo "Found legacy shipping references. Please clean before deploy."
  rg -n "RajaOngkir|RAJAONGKIR|rajaongkir\\.komerce" worker admin || true
  exit 1
fi
echo "  OK no RajaOngkir refs"

echo "[4/5] JS syntax sanity"
node --check worker/index.js
node --check worker/lp-shell.js

echo "[5/5] Git status"
git status --short

echo
cat <<'EOF'
Precheck passed ✅

Next:
1) Fill worker/wrangler.toml IDs (KV + R2)
2) wrangler secret put ADMIN_TOKEN
3) wrangler secret put LINCAH_API_KEY
4) wrangler secret put LINCAH_API_URL
5) wrangler deploy
EOF
