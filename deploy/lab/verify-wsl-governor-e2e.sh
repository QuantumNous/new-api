#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/deploy/lab/runtime/wsl"
SESSION_FILE="${RUNTIME_DIR}/session.env"
BOOTSTRAP_ENV_FILE="${RUNTIME_DIR}/governor-lab.env"
APP_PORT_DEFAULT=3000
APP_PORT="${PORT:-}"

if [[ -f "${SESSION_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${SESSION_FILE}"
fi

APP_PORT="${APP_PORT:-${LAB_APP_PORT:-${APP_PORT_DEFAULT}}}"
MOCK_PORT="${MOCK_PORT:-8080}"
MODEL="${MODEL:-gpt-4o-mini}"
LAB_ADMIN_USERNAME="${LAB_ADMIN_USERNAME:-rootlab}"
LAB_ADMIN_PASSWORD="${LAB_ADMIN_PASSWORD:-rootpass123}"
CHANNEL_NAME="${CHANNEL_NAME:-governor-lab-mock}"
TOKEN_NAME="${TOKEN_NAME:-governor-lab-token}"
CHANNEL_KEY="${CHANNEL_KEY:-mock-upstream-key}"
CHANNEL_GROUP="${CHANNEL_GROUP:-default}"
TOKEN_GROUP="${TOKEN_GROUP:-default}"
CHANNEL_SETTINGS_FILE="${CHANNEL_SETTINGS_FILE:-${ROOT_DIR}/deploy/lab/channel-settings.governor.example.json}"
TOTAL_REQUESTS="${TOTAL_REQUESTS:-12}"
CONCURRENCY="${CONCURRENCY:-4}"
PROMPT="${PROMPT:-Reply with ok.}"
EXPECT_HTTP_200_MIN="${EXPECT_HTTP_200_MIN:-1}"
EXPECT_HTTP_429_MIN="${EXPECT_HTTP_429_MIN:-1}"
EXPECT_GOVERNOR_REJECTIONS_MIN="${EXPECT_GOVERNOR_REJECTIONS_MIN:-1}"
BASE_URL="http://127.0.0.1:${APP_PORT}"
MOCK_BASE_URL="http://127.0.0.1:${MOCK_PORT}"

if ! curl -fsS "${BASE_URL}/api/status" >/dev/null 2>&1; then
  echo "new-api lab is not healthy at ${BASE_URL}/api/status" >&2
  echo "Start it first with deploy/lab/start-wsl-lab.sh" >&2
  exit 1
fi

"${ROOT_DIR}/deploy/lab/start-wsl-mock-openai.sh"

pushd "${ROOT_DIR}" >/dev/null
go run ./deploy/lab/cmd/governor-lab-bootstrap \
  --base-url "${BASE_URL}" \
  --username "${LAB_ADMIN_USERNAME}" \
  --password "${LAB_ADMIN_PASSWORD}" \
  --channel-name "${CHANNEL_NAME}" \
  --channel-key "${CHANNEL_KEY}" \
  --channel-model "${MODEL}" \
  --channel-group "${CHANNEL_GROUP}" \
  --channel-base-url "${MOCK_BASE_URL}" \
  --channel-settings-file "${CHANNEL_SETTINGS_FILE}" \
  --token-name "${TOKEN_NAME}" \
  --token-group "${TOKEN_GROUP}" \
  --output-env-file "${BOOTSTRAP_ENV_FILE}"
popd >/dev/null

# shellcheck disable=SC1090
source "${BOOTSTRAP_ENV_FILE}"

BASE_URL="${BASE_URL}" \
API_KEY="${GOVERNOR_LAB_API_KEY}" \
MODEL="${GOVERNOR_LAB_MODEL}" \
TOTAL_REQUESTS="${TOTAL_REQUESTS}" \
CONCURRENCY="${CONCURRENCY}" \
PROMPT="${PROMPT}" \
EXPECT_HTTP_200_MIN="${EXPECT_HTTP_200_MIN}" \
EXPECT_HTTP_429_MIN="${EXPECT_HTTP_429_MIN}" \
EXPECT_GOVERNOR_REJECTIONS_MIN="${EXPECT_GOVERNOR_REJECTIONS_MIN}" \
"${ROOT_DIR}/deploy/lab/verify-governor.sh"
