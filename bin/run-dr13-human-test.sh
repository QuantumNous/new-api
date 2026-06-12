#!/usr/bin/env bash
# Run DR-13 human test with current token set.
# Set the required environment variables before running:
#
#   export RPM_KEY="sk-..."
#   export TPM_KEY="sk-..."
#   export MONTHLY_KEY="sk-..."
#   export ROOT_KEY="sk-..."
#   export RPM1_KEY="sk-..."
#   export MONTHLY1_KEY="sk-..."
#   export COMBO_KEY="sk-..."
#   export COMBO_TOKEN_ID=<id>      # token DB id for COMBO_KEY
#   export MONTHLY1_TOKEN_ID=<id>   # token DB id for MONTHLY1_KEY
#   export MONTHLY_TOKEN_ID=<id>    # token DB id for MONTHLY_KEY
#   export BASE_URL="http://localhost:3000"  # optional, defaults to localhost:3000
#
# Or pass them inline:
#   RPM_KEY=sk-... ROOT_KEY=sk-... ... bash bin/run-dr13-human-test.sh

set -euo pipefail

required_vars=(RPM_KEY TPM_KEY MONTHLY_KEY ROOT_KEY RPM1_KEY MONTHLY1_KEY COMBO_KEY
               COMBO_TOKEN_ID MONTHLY1_TOKEN_ID MONTHLY_TOKEN_ID)
missing=()
for v in "${required_vars[@]}"; do
  [[ -z "${!v:-}" ]] && missing+=("$v")
done
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: missing required env vars: ${missing[*]}"
  echo "See the header of this script for instructions."
  exit 1
fi

export BASE_URL="${BASE_URL:-http://localhost:3000}"

# Reset monthly counters before each run so the test is repeatable.
YYYYMM=$(date +%Y%m)
docker compose exec redis redis-cli DEL \
  "tq:monthly:${COMBO_TOKEN_ID}:${YYYYMM}" \
  "tq:monthly:${MONTHLY1_TOKEN_ID}:${YYYYMM}" \
  "tq:monthly:${MONTHLY_TOKEN_ID}:${YYYYMM}" > /dev/null 2>&1
echo "  [reset] Monthly counters cleared for COMBO/MONTHLY1/MONTHLY tokens"

bash "$(dirname "$0")/test-dr13-human.sh"
