#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_PATH="${API_PATH:-/v1/chat/completions}"
API_KEY="${API_KEY:-}"
MODEL="${MODEL:-}"
TOTAL_REQUESTS="${TOTAL_REQUESTS:-20}"
CONCURRENCY="${CONCURRENCY:-5}"
PROMPT="${PROMPT:-Reply with ok.}"
REQUEST_BODY_FILE="${REQUEST_BODY_FILE:-}"
EXPECT_HTTP_200_MIN="${EXPECT_HTTP_200_MIN:-}"
EXPECT_HTTP_429_MIN="${EXPECT_HTTP_429_MIN:-}"
EXPECT_GOVERNOR_REJECTIONS_MIN="${EXPECT_GOVERNOR_REJECTIONS_MIN:-}"

if [[ -z "${API_KEY}" ]]; then
  echo "API_KEY is required." >&2
  exit 1
fi

if [[ -z "${MODEL}" && -z "${REQUEST_BODY_FILE}" ]]; then
  echo "MODEL is required when REQUEST_BODY_FILE is not provided." >&2
  exit 1
fi

if ! [[ "${TOTAL_REQUESTS}" =~ ^[0-9]+$ ]] || ! [[ "${CONCURRENCY}" =~ ^[0-9]+$ ]]; then
  echo "TOTAL_REQUESTS and CONCURRENCY must be integers." >&2
  exit 1
fi

for expected_value in "${EXPECT_HTTP_200_MIN}" "${EXPECT_HTTP_429_MIN}" "${EXPECT_GOVERNOR_REJECTIONS_MIN}"; do
  if [[ -n "${expected_value}" ]] && ! [[ "${expected_value}" =~ ^[0-9]+$ ]]; then
    echo "Expectation values must be integers when provided." >&2
    exit 1
  fi
done

if [[ "${TOTAL_REQUESTS}" -le 0 || "${CONCURRENCY}" -le 0 ]]; then
  echo "TOTAL_REQUESTS and CONCURRENCY must be greater than zero." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
payload_file="${tmp_dir}/payload.json"

cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

if [[ -n "${REQUEST_BODY_FILE}" ]]; then
  cp "${REQUEST_BODY_FILE}" "${payload_file}"
else
  cat >"${payload_file}" <<EOF
{"model":"${MODEL}","messages":[{"role":"user","content":"${PROMPT}"}],"stream":false}
EOF
fi

run_one() {
  local index="$1"
  local body_file="${tmp_dir}/${index}.body"
  local code_file="${tmp_dir}/${index}.code"

  curl -sS \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -o "${body_file}" \
    -w "%{http_code}" \
    -X POST "${BASE_URL%/}${API_PATH}" \
    --data-binary "@${payload_file}" >"${code_file}"
}

for index in $(seq 1 "${TOTAL_REQUESTS}"); do
  run_one "${index}" &
  while [[ "$(jobs -pr | wc -l | tr -d ' ')" -ge "${CONCURRENCY}" ]]; do
    wait -n
  done
done
wait

declare -A counts=()
governor_rejections=0

for code_path in "${tmp_dir}"/*.code; do
  code="$(cat "${code_path}")"
  counts["${code}"]=$(( ${counts["${code}"]:-0} + 1 ))

  body_path="${code_path%.code}.body"
  if grep -q 'governor:selection_rejected' "${body_path}"; then
    governor_rejections=$((governor_rejections + 1))
  fi
done

echo "Base URL: ${BASE_URL%/}${API_PATH}"
echo "Total requests: ${TOTAL_REQUESTS}"
echo "Configured concurrency: ${CONCURRENCY}"
echo
echo "HTTP status summary:"

for code in "${!counts[@]}"; do
  echo "  HTTP ${code}: ${counts["${code}"]}"
done | sort

echo
echo "governor:selection_rejected responses: ${governor_rejections}"

sample_body="$(grep -l 'governor:selection_rejected' "${tmp_dir}"/*.body 2>/dev/null | head -n 1 || true)"
if [[ -n "${sample_body}" ]]; then
  echo
  echo "Sample governor rejection body:"
  sed -n '1,20p' "${sample_body}"
fi

get_count() {
  local key="$1"
  echo "${counts["${key}"]:-0}"
}

expectation_failed=0

if [[ -n "${EXPECT_HTTP_200_MIN}" ]] && (( "$(get_count 200)" < EXPECT_HTTP_200_MIN )); then
  echo "Expectation failed: expected at least ${EXPECT_HTTP_200_MIN} HTTP 200 responses." >&2
  expectation_failed=1
fi

if [[ -n "${EXPECT_HTTP_429_MIN}" ]] && (( "$(get_count 429)" < EXPECT_HTTP_429_MIN )); then
  echo "Expectation failed: expected at least ${EXPECT_HTTP_429_MIN} HTTP 429 responses." >&2
  expectation_failed=1
fi

if [[ -n "${EXPECT_GOVERNOR_REJECTIONS_MIN}" ]] && (( governor_rejections < EXPECT_GOVERNOR_REJECTIONS_MIN )); then
  echo "Expectation failed: expected at least ${EXPECT_GOVERNOR_REJECTIONS_MIN} governor:selection_rejected responses." >&2
  expectation_failed=1
fi

if (( expectation_failed != 0 )); then
  exit 1
fi
