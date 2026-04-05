#!/usr/bin/env bash
# verify-model-api.sh — Probe an LLM API and extract verification signals.
set -euo pipefail

step() { echo ""; echo "[*] $*"; }
ok() { echo "[+] $*"; }
warn() { echo "[!] $*" >&2; }
die() { echo "[x] $*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage:
  verify-model-api.sh --provider PROVIDER --api-key KEY --model MODEL [options]

Providers:
  openai       OpenAI Responses API or OpenAI-compatible /v1/responses endpoint
  anthropic    Anthropic Messages API
  gemini       Google Gemini GenerateContent API
  openrouter   OpenRouter chat completions API

Required:
  --provider PROVIDER      openai | anthropic | gemini | openrouter
  --api-key KEY            API key
  --model MODEL            Requested model name

Optional:
  --base-url URL           Override base URL
  --prompt TEXT            Probe prompt
  --repeat N               Number of identical probe requests (default: 3)
  --timeout SEC            curl timeout in seconds (default: 90)
  --out-dir DIR            Save headers/body under this directory
  --provider-order LIST    OpenRouter provider order, comma separated
  --no-fallbacks           Disable OpenRouter fallbacks
  --help                   Show this help

Examples:
  ./verify-model-api.sh \
    --provider openai \
    --api-key "$OPENAI_API_KEY" \
    --model gpt-5.4-mini

  ./verify-model-api.sh \
    --provider anthropic \
    --api-key "$ANTHROPIC_API_KEY" \
    --model claude-opus-4-1-20250805 \
    --repeat 5
EOF
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

sha256_text() {
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 | awk '{print $1}'
    elif command -v sha256sum >/dev/null 2>&1; then
        sha256sum | awk '{print $1}'
    else
        die "Need shasum or sha256sum"
    fi
}

json_get() {
    local file="$1"
    local expr="$2"
    jq -r "$expr // empty" "$file" 2>/dev/null || true
}

trim_body_for_hash() {
    local body_file="$1"
    local provider="$2"
    case "$provider" in
        openai)
            jq -c '{model, output_text, usage}' "$body_file" 2>/dev/null || cat "$body_file"
            ;;
        anthropic)
            jq -c '{model, content, usage, stop_reason}' "$body_file" 2>/dev/null || cat "$body_file"
            ;;
        gemini)
            jq -c '{modelVersion, responseId, candidates, usageMetadata}' "$body_file" 2>/dev/null || cat "$body_file"
            ;;
        openrouter)
            jq -c '{model, provider, choices, usage}' "$body_file" 2>/dev/null || cat "$body_file"
            ;;
        *)
            cat "$body_file"
            ;;
    esac
}

extract_text_preview() {
    local body_file="$1"
    local provider="$2"
    case "$provider" in
        openai)
            jq -r '.output_text // (.output[]?.content[]?.text // empty)' "$body_file" 2>/dev/null | head -c 300
            ;;
        anthropic)
            jq -r '.content[]? | select(.type=="text") | .text' "$body_file" 2>/dev/null | head -c 300
            ;;
        gemini)
            jq -r '.candidates[0].content.parts[]?.text // empty' "$body_file" 2>/dev/null | head -c 300
            ;;
        openrouter)
            jq -r '.choices[0].message.content // empty' "$body_file" 2>/dev/null | head -c 300
            ;;
    esac
}

extract_signals() {
    local body_file="$1"
    local header_file="$2"
    local provider="$3"

    local declared_model=""
    local response_id=""
    local request_id=""
    local fingerprint=""
    local provider_hint=""

    case "$provider" in
        openai)
            declared_model="$(json_get "$body_file" '.model')"
            response_id="$(json_get "$body_file" '.id')"
            request_id="$(awk 'BEGIN{IGNORECASE=1} /^x-request-id:/ {print $2}' "$header_file" | tr -d '\r' | tail -1)"
            fingerprint="$(json_get "$body_file" '.system_fingerprint')"
            ;;
        anthropic)
            declared_model="$(json_get "$body_file" '.model')"
            response_id="$(json_get "$body_file" '.id')"
            request_id="$(awk 'BEGIN{IGNORECASE=1} /^request-id:/ {print $2}' "$header_file" | tr -d '\r' | tail -1)"
            ;;
        gemini)
            declared_model="$(json_get "$body_file" '.modelVersion')"
            response_id="$(json_get "$body_file" '.responseId')"
            request_id="$(awk 'BEGIN{IGNORECASE=1} /^x-request-id:/ {print $2}' "$header_file" | tr -d '\r' | tail -1)"
            ;;
        openrouter)
            declared_model="$(json_get "$body_file" '.model')"
            response_id="$(json_get "$body_file" '.id')"
            request_id="$(awk 'BEGIN{IGNORECASE=1} /^x-request-id:/ {print $2}' "$header_file" | tr -d '\r' | tail -1)"
            provider_hint="$(json_get "$body_file" '.provider')"
            ;;
    esac

    printf 'declared_model=%s\n' "${declared_model:-}"
    printf 'response_id=%s\n' "${response_id:-}"
    printf 'request_id=%s\n' "${request_id:-}"
    printf 'system_fingerprint=%s\n' "${fingerprint:-}"
    printf 'provider_hint=%s\n' "${provider_hint:-}"
}

build_payload() {
    local payload_file="$1"
    case "$PROVIDER" in
        openai)
            jq -n \
                --arg model "$MODEL" \
                --arg prompt "$PROMPT" \
                '{
                    model: $model,
                    input: $prompt,
                    max_output_tokens: 120
                }' >"$payload_file"
            ;;
        anthropic)
            jq -n \
                --arg model "$MODEL" \
                --arg prompt "$PROMPT" \
                '{
                    model: $model,
                    max_tokens: 120,
                    messages: [
                        {role: "user", content: $prompt}
                    ]
                }' >"$payload_file"
            ;;
        gemini)
            jq -n \
                --arg prompt "$PROMPT" \
                '{
                    contents: [
                        {
                            parts: [
                                {text: $prompt}
                            ]
                        }
                    ],
                    generationConfig: {
                        maxOutputTokens: 120,
                        temperature: 0
                    }
                }' >"$payload_file"
            ;;
        openrouter)
            if [[ -n "$PROVIDER_ORDER" ]]; then
                jq -n \
                    --arg model "$MODEL" \
                    --arg prompt "$PROMPT" \
                    --argjson order "$(printf '%s\n' "$PROVIDER_ORDER" | jq -Rc 'split(",") | map(select(length > 0))')" \
                    --argjson allow_fallbacks "$ALLOW_FALLBACKS" \
                    '{
                        model: $model,
                        messages: [
                            {role: "user", content: $prompt}
                        ],
                        temperature: 0,
                        provider: {
                            order: $order,
                            allow_fallbacks: $allow_fallbacks
                        }
                    }' >"$payload_file"
            else
                jq -n \
                    --arg model "$MODEL" \
                    --arg prompt "$PROMPT" \
                    --argjson allow_fallbacks "$ALLOW_FALLBACKS" \
                    '{
                        model: $model,
                        messages: [
                            {role: "user", content: $prompt}
                        ],
                        temperature: 0,
                        provider: {
                            allow_fallbacks: $allow_fallbacks
                        }
                    }' >"$payload_file"
            fi
            ;;
    esac
}

run_probe() {
    local run_id="$1"
    local run_dir="$OUT_DIR/run-$run_id"
    local payload_file="$run_dir/payload.json"
    local body_file="$run_dir/body.json"
    local header_file="$run_dir/headers.txt"
    local status_file="$run_dir/status.txt"
    mkdir -p "$run_dir"

    build_payload "$payload_file"

    case "$PROVIDER" in
        openai)
            curl -sS \
                --max-time "$TIMEOUT" \
                -D "$header_file" \
                -o "$body_file" \
                -w '%{http_code}' \
                -X POST "${BASE_URL%/}/responses" \
                -H "Authorization: Bearer $API_KEY" \
                -H "Content-Type: application/json" \
                --data-binary "@$payload_file" >"$status_file"
            ;;
        anthropic)
            curl -sS \
                --max-time "$TIMEOUT" \
                -D "$header_file" \
                -o "$body_file" \
                -w '%{http_code}' \
                -X POST "${BASE_URL%/}/messages" \
                -H "x-api-key: $API_KEY" \
                -H "anthropic-version: 2023-06-01" \
                -H "Content-Type: application/json" \
                --data-binary "@$payload_file" >"$status_file"
            ;;
        gemini)
            curl -sS \
                --max-time "$TIMEOUT" \
                -D "$header_file" \
                -o "$body_file" \
                -w '%{http_code}' \
                -X POST "${BASE_URL%/}/models/${MODEL}:generateContent?key=${API_KEY}" \
                -H "Content-Type: application/json" \
                --data-binary "@$payload_file" >"$status_file"
            ;;
        openrouter)
            curl -sS \
                --max-time "$TIMEOUT" \
                -D "$header_file" \
                -o "$body_file" \
                -w '%{http_code}' \
                -X POST "${BASE_URL%/}/chat/completions" \
                -H "Authorization: Bearer $API_KEY" \
                -H "Content-Type: application/json" \
                --data-binary "@$payload_file" >"$status_file"
            ;;
    esac

    local http_code
    http_code="$(cat "$status_file")"
    if [[ ! "$http_code" =~ ^2 ]]; then
        warn "Probe $run_id returned HTTP $http_code"
        warn "Saved payload to: $payload_file"
        warn "Saved headers to: $header_file"
        warn "Saved body to: $body_file"
        return 1
    fi

    local preview signals normalized digest
    preview="$(extract_text_preview "$body_file" "$PROVIDER")"
    signals="$(extract_signals "$body_file" "$header_file" "$PROVIDER")"
    normalized="$(trim_body_for_hash "$body_file" "$PROVIDER")"
    digest="$(printf '%s' "$normalized" | sha256_text)"

    echo "run=$run_id"
    echo "http_code=$http_code"
    echo "$signals"
    echo "content_sha256=$digest"
    echo "preview=${preview//$'\n'/ }"
}

PROVIDER=""
API_KEY=""
MODEL=""
BASE_URL=""
PROMPT="Reply with one short sentence containing the exact words: verification-probe-94721."
REPEAT=3
TIMEOUT=90
OUT_DIR=""
PROVIDER_ORDER=""
ALLOW_FALLBACKS="true"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --provider) PROVIDER="${2:-}"; shift 2 ;;
        --api-key) API_KEY="${2:-}"; shift 2 ;;
        --model) MODEL="${2:-}"; shift 2 ;;
        --base-url) BASE_URL="${2:-}"; shift 2 ;;
        --prompt) PROMPT="${2:-}"; shift 2 ;;
        --repeat) REPEAT="${2:-}"; shift 2 ;;
        --timeout) TIMEOUT="${2:-}"; shift 2 ;;
        --out-dir) OUT_DIR="${2:-}"; shift 2 ;;
        --provider-order) PROVIDER_ORDER="${2:-}"; shift 2 ;;
        --no-fallbacks) ALLOW_FALLBACKS="false"; shift ;;
        --help|-h) usage; exit 0 ;;
        *) die "Unknown argument: $1" ;;
    esac
done

[[ -n "$PROVIDER" ]] || die "--provider is required"
[[ -n "$API_KEY" ]] || die "--api-key is required"
[[ -n "$MODEL" ]] || die "--model is required"
[[ "$REPEAT" =~ ^[1-9][0-9]*$ ]] || die "--repeat must be a positive integer"
[[ "$TIMEOUT" =~ ^[1-9][0-9]*$ ]] || die "--timeout must be a positive integer"

require_cmd curl
require_cmd jq

case "$PROVIDER" in
    openai)
        BASE_URL="${BASE_URL:-https://api.openai.com/v1}"
        ;;
    anthropic)
        BASE_URL="${BASE_URL:-https://api.anthropic.com/v1}"
        ;;
    gemini)
        BASE_URL="${BASE_URL:-https://generativelanguage.googleapis.com/v1beta}"
        ;;
    openrouter)
        BASE_URL="${BASE_URL:-https://openrouter.ai/api/v1}"
        ;;
    *)
        die "Unsupported provider: $PROVIDER"
        ;;
esac

OUT_DIR="${OUT_DIR:-./verify-output-${PROVIDER}-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT_DIR"

step "Probe configuration"
echo "provider=$PROVIDER"
echo "base_url=$BASE_URL"
echo "requested_model=$MODEL"
echo "repeat=$REPEAT"
echo "out_dir=$OUT_DIR"
if [[ "$PROVIDER" == "openrouter" ]]; then
    echo "provider_order=${PROVIDER_ORDER:-<default>}"
    echo "allow_fallbacks=$ALLOW_FALLBACKS"
fi

step "Running verification probes"
summary_file="$OUT_DIR/summary.txt"
: >"$summary_file"

for i in $(seq 1 "$REPEAT"); do
    run_probe "$i" | tee -a "$summary_file"
done

step "Stability summary"
declared_models="$(awk -F= '/^declared_model=/{print $2}' "$summary_file" | sort -u | sed '/^$/d')"
request_ids="$(awk -F= '/^request_id=/{print $2}' "$summary_file" | sed '/^$/d' | wc -l | tr -d ' ')"
hash_count="$(awk -F= '/^content_sha256=/{print $2}' "$summary_file" | sort -u | wc -l | tr -d ' ')"

if [[ -n "$declared_models" ]]; then
    echo "declared_models:"
    printf '%s\n' "$declared_models"
else
    echo "declared_models:<none>"
fi
echo "request_id_count=$request_ids"
echo "unique_content_hashes=$hash_count"

if (( hash_count > 1 )); then
    warn "Identical probes produced different normalized outputs. That may be normal randomness, fallback routing, or model switching."
else
    ok "Identical probes produced the same normalized response hash."
fi

ok "Saved raw payloads, headers, and bodies under: $OUT_DIR"
