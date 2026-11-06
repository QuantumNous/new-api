#!/bin/bash
# Test script for issue #1899
# https://github.com/i18next/react-i18next/issues/1899
#
# This script runs TypeScript with skipLibCheck: false and checks for errors
# in index.d.ts. It ignores errors in node_modules (like @types/node issues).

set -e

cd "$(dirname "$0")/../../.."

# Run tsc and capture output
OUTPUT=$(npx tsc -p test/typescript/issue-1899/tsconfig.json --noEmit 2>&1 || true)

# Check for errors in index.d.ts (our code)
INDEX_ERRORS=$(echo "$OUTPUT" | grep "^index.d.ts" || true)

if [ -n "$INDEX_ERRORS" ]; then
  echo "ERROR: Type errors found in index.d.ts:"
  echo "$INDEX_ERRORS"
  exit 1
fi

echo "OK: No type errors in index.d.ts"
exit 0
