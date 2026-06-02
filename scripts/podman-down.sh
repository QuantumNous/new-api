#!/usr/bin/env bash
# podman-down.sh — stop and remove the stack
#
# Usage:
#   ./scripts/podman-down.sh            # stop + remove (preserves data/)
#   ./scripts/podman-down.sh --volumes # also drop the pg_data volume

set -euo pipefail
cd "$(dirname "$0")/.."

VOLUMES=""
for arg in "$@"; do
  case "$arg" in
    --volumes|-v) VOLUMES="--volumes" ;;
    -h|--help)
      sed -n '2,10p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

podman-compose -f podman-compose.yml down $VOLUMES
echo "[podman-down] done"
