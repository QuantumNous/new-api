#!/usr/bin/env bash
# Publish a staged desktop release to Cloudflare R2 (bucket boxai-desktop, served at
# https://dl.you-box.com). GitHub Releases are NOT used: they are unusably slow from mainland
# China, and the desktop updater plus the website both read from this one origin.
#
# Shared by both desktop products. BOXAI_RELEASE_PRODUCT selects which one:
#   desktop (default)  BoxAI Desktop, from desktop/surfaces/gui
#   connect            BoxAI Connect, from connect/
# Each publishes under its own key prefix, so one product can never overwrite the
# other's manifests.
#
#   1. verify the staged version matches tauri.conf.json (a mismatch ships an update that
#      installs and then immediately re-offers itself);
#   2. compose latest.json (updater) + releases.json (website) from the staged artifacts;
#   3. upload the artifacts under desktop/<version>/ as immutable objects, then the two
#      manifests under desktop/ as short-lived ones — artifacts FIRST, so no client can ever
#      read a manifest pointing at an object that is not there yet;
#   4. purge the manifests from the edge cache so the release is live immediately.
#
# Credentials come from .env.cloudflare at the repo root (gitignored):
#   R2_DESKTOP_ACCESS_KEY_ID / R2_DESKTOP_SECRET_ACCESS_KEY  bucket-scoped S3 keys
#   R2_ENDPOINT                                              account R2 S3 endpoint
#   CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID                for the cache purge
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PLATFORM="$(cd "$HERE/.." && pwd)"
REPO="$(cd "$PLATFORM/.." && pwd)"
PRODUCT="${BOXAI_RELEASE_PRODUCT:-desktop}"
case "$PRODUCT" in
  desktop) SOURCE_DIR="$PLATFORM/surfaces/gui"; PRODUCT_NAME="BoxAI Desktop"; STAGE_ROOT="$PLATFORM/release" ;;
  connect) SOURCE_DIR="$REPO/connect";          PRODUCT_NAME="BoxAI Connect"; STAGE_ROOT="$REPO/connect/release" ;;
  *) echo "ERROR: unknown BOXAI_RELEASE_PRODUCT '$PRODUCT' (expected desktop or connect)" >&2; exit 1 ;;
esac

VERSION="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "$SOURCE_DIR/src-tauri/tauri.conf.json")"
STAGE="${BOXAI_RELEASE_STAGE:-$STAGE_ROOT/$VERSION}"
BUCKET="${BOXAI_RELEASE_BUCKET:-boxai-desktop}"
PREFIX="$PRODUCT"
BASE_URL="${BOXAI_RELEASE_BASE_URL:-https://dl.you-box.com/$PREFIX}"

[ -d "$STAGE" ] || { echo "ERROR: no staged release at $STAGE — run stage_release.sh first" >&2; exit 1; }

ENV_FILE="${BOXAI_CLOUDFLARE_ENV:-$REPO/.env.cloudflare}"
if [ -f "$ENV_FILE" ]; then
  set -a; # shellcheck disable=SC1090
  source "$ENV_FILE"; set +a
fi
for v in R2_DESKTOP_ACCESS_KEY_ID R2_DESKTOP_SECRET_ACCESS_KEY R2_ENDPOINT; do
  [ -n "${!v:-}" ] || { echo "ERROR: $v is not set (expected in $ENV_FILE)" >&2; exit 1; }
done

echo "==> [1/4] composing manifests for $VERSION"
python3 "$HERE/make_release_manifests.py" \
  --version "$VERSION" --dist "$STAGE" --base-url "$BASE_URL" --product "$PRODUCT" \
  --notes "${BOXAI_RELEASE_NOTES:-$PRODUCT_NAME $VERSION}"

export AWS_ACCESS_KEY_ID="$R2_DESKTOP_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_DESKTOP_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto

echo "==> [2/4] uploading artifacts to s3://$BUCKET/$PREFIX/$VERSION/"
# Versioned objects never change, so they are cached forever; the manifests below are what
# moves a release forward.
aws s3 sync "$STAGE" "s3://$BUCKET/$PREFIX/$VERSION/" \
  --endpoint-url "$R2_ENDPOINT" \
  --exclude "latest.json" --exclude "releases.json" \
  --cache-control "public, max-age=31536000, immutable" \
  --no-progress

echo "==> [3/4] publishing manifests"
for manifest in latest.json releases.json; do
  aws s3 cp "$STAGE/$manifest" "s3://$BUCKET/$PREFIX/$manifest" \
    --endpoint-url "$R2_ENDPOINT" \
    --content-type "application/json" \
    --cache-control "public, max-age=60" \
    --no-progress
done

echo "==> [4/4] purging the edge cache"
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ZONE_ID:-}" ]; then
  curl -fsS -X POST \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
    -d "{\"files\":[\"$BASE_URL/latest.json\",\"$BASE_URL/releases.json\"]}" >/dev/null
  echo "    purged latest.json + releases.json"
else
  echo "    WARNING: CLOUDFLARE_API_TOKEN/ZONE_ID unset — manifests stay cached for up to 60s"
fi

echo ""
echo "Published BoxAI Desktop $VERSION"
echo "  updater  $BASE_URL/latest.json"
echo "  website  $BASE_URL/releases.json"
