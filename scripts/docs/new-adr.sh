#!/usr/bin/env bash
set -euo pipefail

ADR_DIR="docs/20-architecture/decisions"
TITLE="${1:?missing ADR title}"

mkdir -p "$ADR_DIR"
LAST=$(find "$ADR_DIR" -maxdepth 1 -type f -name '[0-9][0-9][0-9][0-9]-*.md' -print | sed -E 's#.*/([0-9]+)-.*#\1#' | sort -n | tail -1 || true)
NEXT=$((10#${LAST:-0} + 1))
NUM=$(printf "%04d" "$NEXT")
SAFE_TITLE=$(printf '%s' "$TITLE" | tr '/:' '--' | sed -E 's/[[:space:]]+/-/g; s/^-+//; s/-+$//')
TARGET="$ADR_DIR/$NUM-$SAFE_TITLE.md"

if [ -e "$TARGET" ]; then
  echo "ADR already exists: $TARGET" >&2
  exit 1
fi

cp docs/templates/adr.md "$TARGET"
sed -i.bak "s/^adr: .*/adr: $NUM/" "$TARGET"
sed -i.bak "s/^date: .*/date: $(date +%F)/" "$TARGET"
sed -i.bak "s/^# ADR-NNNN: 标题/# ADR-$NUM: $TITLE/" "$TARGET"
rm -f "$TARGET.bak"
echo "Created $TARGET"
