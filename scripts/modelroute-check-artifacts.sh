#!/usr/bin/env bash
# 检查 modelroute 产出物文件是否存在（Goal 验证面）
# Usage: ./scripts/modelroute-check-artifacts.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

miss=0
need() {
  if [[ -e "$1" ]]; then
    echo "  OK  $1"
  else
    echo "  MISS $1"
    miss=1
  fi
}

echo "== DB / model =="
need migrations/20260711_add_channel_model_policy.sql
need migrations/20260711_add_channel_model_metrics.sql
need model/channel_model_policy.go
need model/channel_model_metrics.go
need model/route_constants.go
need model/route_candidate.go

echo "== engine modelroute =="
for f in policy_key.go candidate_chain.go route_plan.go route_state.go cold_start.go transparent_retry.go \
  shadow_builder.go shadow_dispatcher.go shadow_http.go experience_score.go overflow_lease.go emergency.go \
  takeover.go live_hooks.go migration.go stale.go; do
  need "modelroute/$f"
done

echo "== admin / wiring =="
need controller/model_route.go
need service/channel_select.go
need web/default/src/features/model-route/index.tsx
need integration/modelroute_chain_test.go

echo
if [[ "$miss" -ne 0 ]]; then
  echo "FAIL: missing artifacts"
  exit 1
fi
echo "OK: all expected artifacts present"
