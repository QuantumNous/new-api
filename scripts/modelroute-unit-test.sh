#!/usr/bin/env bash
# modelroute 本地单元/集成/基准测试
# Usage:
#   ./scripts/modelroute-unit-test.sh              # 默认：build + 核心包 + integration
#   ./scripts/modelroute-unit-test.sh --all        # 全仓 go test ./...
#   ./scripts/modelroute-unit-test.sh --bench      # 额外跑路由 benchmark
#   ./scripts/modelroute-unit-test.sh --verbose    # -v
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ALL=0
BENCH=0
VERBOSE=0
for arg in "$@"; do
  case "$arg" in
    --all) ALL=1 ;;
    --bench) BENCH=1 ;;
    --verbose|-v) VERBOSE=1 ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

VFLAG=""
if [[ "$VERBOSE" -eq 1 ]]; then
  VFLAG="-v"
fi

ts() { date '+%H:%M:%S'; }
step() { echo; echo "==> [$(ts)] $*"; }

step "go build ."
go build .

step "go test modelroute (unit + engine)"
# shellcheck disable=SC2086
go test ./modelroute/ -count=1 $VFLAG

step "go test model (DAO / constants)"
# shellcheck disable=SC2086
go test ./model/ -count=1 $VFLAG

step "go test service (channel select)"
# shellcheck disable=SC2086
go test ./service/ -count=1 $VFLAG

step "go test integration (4 chains + live hook)"
# shellcheck disable=SC2086
go test ./integration/ -count=1 $VFLAG

if [[ "$BENCH" -eq 1 ]]; then
  step "benchmark BuildProductionCandidateChain"
  go test ./modelroute/ -bench=BenchmarkBuildProductionCandidateChain -benchmem -count=1 -run=^$
fi

if [[ "$ALL" -eq 1 ]]; then
  step "go test ./... (full repo)"
  # shellcheck disable=SC2086
  go test ./... -count=1 $VFLAG
fi

step "OK — modelroute local tests passed"
