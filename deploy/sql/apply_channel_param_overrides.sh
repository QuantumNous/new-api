#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SQL_DSN:-}" ]]; then
  echo "SQL_DSN is required" >&2
  exit 1
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
deploy_dir=$(cd -- "$script_dir/.." && pwd)
azure_profile="$deploy_dir/channel-overrides/azure-gpt-5.6-sol.json"
fable_profile="$deploy_dir/channel-overrides/claude-fable-5.json"

compact_json() {
  python3 -c \
    'import json,sys; print(json.dumps(json.load(open(sys.argv[1], encoding="utf-8")), separators=(",", ":")))' \
    "$1"
}

azure_override=$(compact_json "$azure_profile")
fable_override=$(compact_json "$fable_profile")

psql "$SQL_DSN" \
  -v azure_override="$azure_override" \
  -v fable_override="$fable_override" \
  -f "$script_dir/channel_param_compatibility.sql"
