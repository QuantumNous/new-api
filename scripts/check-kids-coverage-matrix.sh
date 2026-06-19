#!/usr/bin/env bash
# scripts/check-kids-coverage-matrix.sh
#
# Parses docs/kids-coverage-matrix.md for explicit Go test function names,
# runs `go test -list` for the packages that own those tests, and fails if
# any named function is absent from the compiled test binary.
#
# Usage (from repo root):
#   bash scripts/check-kids-coverage-matrix.sh
#
# Called automatically by .github/workflows/airbotix-internal.yml on every
# PR that touches docs/kids-coverage-matrix.md or internal/**  relay/ middleware/ controller/.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

MATRIX="docs/kids-coverage-matrix.md"

# ── 1. Extract required function names from matrix table rows ──────────────
# Only lines containing "|" are table rows. Strips trailing "_" produced by
# wildcard patterns like `TestFoo_*`.
mapfile -t REQUIRED < <(
  grep '|' "$MATRIX" \
    | grep -oE '\bTest[A-Za-z0-9_]+' \
    | sed 's/_$//' \
    | sort -u
)

if [[ ${#REQUIRED[@]} -eq 0 ]]; then
  echo "ERROR: no Test* names found in $MATRIX — file missing or malformed." >&2
  exit 1
fi

echo "Matrix requires ${#REQUIRED[@]} function(s). Verifying with go test -list..."

# ── 2. Collect available test names from the packages referenced by the matrix ─
PACKAGES=(./internal/... ./model/ ./relay/ ./middleware/ ./controller/)
mapfile -t AVAILABLE < <(
  go test -list '.' "${PACKAGES[@]}" 2>/dev/null \
    | grep '^Test' \
    | sort -u
)

# ── 3. Compare ─────────────────────────────────────────────────────────────
# Write AVAILABLE to a tempfile so grep reads from a file rather than a
# pipeline. The printf|grep pattern triggers SIGPIPE on Linux when grep -q
# exits early after finding a match; with pipefail that makes the `if`
# evaluate to false even though the function was found.
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT
[[ ${#AVAILABLE[@]} -gt 0 ]] && printf '%s\n' "${AVAILABLE[@]}" > "$tmpfile"

MISSING=()
for fn in "${REQUIRED[@]}"; do
  # Exact match
  if grep -qx "$fn" "$tmpfile"; then
    continue
  fi
  # Prefix match for wildcard entries: TestFoo matches TestFoo_Bar, TestFoo_Baz
  if grep -q "^${fn}_" "$tmpfile"; then
    continue
  fi
  MISSING+=("$fn")
done

# ── 4. Report ──────────────────────────────────────────────────────────────
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo "FAIL: kids-coverage-matrix.md lists ${#MISSING[@]} function(s) not found in go test -list:"
  for m in "${MISSING[@]}"; do
    echo "  missing: $m"
  done
  echo ""
  echo "Either implement the missing tests or remove them from the matrix."
  exit 1
fi

echo "OK: all ${#REQUIRED[@]} matrix-listed functions confirmed present."
