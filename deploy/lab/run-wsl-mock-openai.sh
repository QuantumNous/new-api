#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/deploy/lab/runtime/wsl"
LOG_DIR="${RUNTIME_DIR}/logs"
BIN_PATH="${RUNTIME_DIR}/mock-openai-upstream"
MOCK_PORT="${MOCK_PORT:-8080}"
MOCK_DELAY_MS="${MOCK_DELAY_MS:-1500}"
MOCK_RESPONSE_TEXT="${MOCK_RESPONSE_TEXT:-ok}"
MOCK_MODELS="${MOCK_MODELS:-gpt-4o-mini}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd go

mkdir -p "${RUNTIME_DIR}" "${LOG_DIR}"

echo "Building mock OpenAI upstream..."
pushd "${ROOT_DIR}" >/dev/null
go build -o "${BIN_PATH}" ./deploy/lab/cmd/mock-openai-upstream
popd >/dev/null

echo "Starting mock OpenAI upstream on port ${MOCK_PORT}..."
exec "${BIN_PATH}" \
  --listen ":${MOCK_PORT}" \
  --delay-ms "${MOCK_DELAY_MS}" \
  --response-text "${MOCK_RESPONSE_TEXT}" \
  --models "${MOCK_MODELS}"
