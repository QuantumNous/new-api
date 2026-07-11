#!/usr/bin/env bash
set -euo pipefail
OUT="${1:-.env}"
if [[ -f "$OUT" ]]; then
  echo "exists: $OUT (refuse overwrite)" >&2
  exit 1
fi
rand() { openssl rand -base64 24 | tr -d '=+/' | cut -c1-24; }
hex() { openssl rand -hex 32; }
cat >"$OUT" <<E
NEW_API_IMAGE=new-api-modelroute:test
POSTGRES_USER=mrtest
POSTGRES_PASSWORD=$(rand)
POSTGRES_DB=new_api_mrtest
REDIS_PASSWORD=$(rand)
SESSION_SECRET=$(hex)
CRYPTO_SECRET=$(hex)
E
chmod 600 "$OUT"
echo "wrote $OUT"
