#!/usr/bin/env bash
# Start Cursor Agent sidecar for new-api channel type 61.
#
# Direct-egress host (default): no proxy.
#   ./start.sh
#
# CN / laptop behind region block:
#   CURSOR_AGENT_FORCE_PROXY=1 CURSOR_AGENT_PROXY=http://127.0.0.1:7890 ./start.sh
#   PROXYCHAINS=1 ./start.sh   # TCP-level wrap (strongest)
set -euo pipefail
cd "$(dirname "$0")"

export CURSOR_AGENT_SIDECAR_HOST="${CURSOR_AGENT_SIDECAR_HOST:-127.0.0.1}"
export CURSOR_AGENT_SIDECAR_PORT="${CURSOR_AGENT_SIDECAR_PORT:-3927}"

if [[ -n "${CURSOR_AGENT_PROXY:-}" ]] || [[ "${CURSOR_AGENT_FORCE_PROXY:-0}" == "1" ]]; then
  export CURSOR_AGENT_FORCE_PROXY="${CURSOR_AGENT_FORCE_PROXY:-1}"
  export CURSOR_AGENT_PROXY="${CURSOR_AGENT_PROXY:-http://127.0.0.1:7890}"
  export HTTP_PROXY="${HTTP_PROXY:-$CURSOR_AGENT_PROXY}"
  export HTTPS_PROXY="${HTTPS_PROXY:-$CURSOR_AGENT_PROXY}"
  export ALL_PROXY="${ALL_PROXY:-$CURSOR_AGENT_PROXY}"
  export NODE_USE_ENV_PROXY=1
  # Prefer HTTP/1 when proxying (HTTP/2 often leaks past system proxy).
  export CURSOR_AGENT_FORCE_HTTP1="${CURSOR_AGENT_FORCE_HTTP1:-1}"

  if [[ "${PROXYCHAINS:-0}" == "1" ]] && command -v proxychains4 >/dev/null 2>&1; then
    echo "[start] US-region workaround: proxychains4 + proxy=${CURSOR_AGENT_PROXY}"
    exec proxychains4 -q -f ./proxychains-agent.conf node server.mjs
  fi
  echo "[start] US-region workaround: force_proxy=${CURSOR_AGENT_PROXY}"
else
  echo "[start] direct egress (US host friendly). Proxy off."
fi

exec node server.mjs
