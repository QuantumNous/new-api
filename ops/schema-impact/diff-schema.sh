#!/usr/bin/env bash
set -euo pipefail

# Compare two schema snapshots produced by export-schema.sh.

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <before.sql> <after.sql>" >&2
  exit 2
fi

before="$1"
after="$2"

if [ ! -f "$before" ]; then
  echo "missing before schema: $before" >&2
  exit 2
fi

if [ ! -f "$after" ]; then
  echo "missing after schema: $after" >&2
  exit 2
fi

diff -u "$before" "$after"
