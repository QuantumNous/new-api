#!/usr/bin/env bash
# Run DR-13 human test.
#
# Setup (one-time):
#   cp bin/.env.dr13.example bin/.env.dr13
#   # edit bin/.env.dr13 and fill in your real keys
#
# Then just run:
#   bash bin/run-dr13-human-test.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.dr13"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
else
  echo "ERROR: $ENV_FILE not found."
  echo "Run: cp bin/.env.dr13.example bin/.env.dr13  then fill in your keys."
  exit 1
fi

required_vars=(RPM_KEY TPM_KEY MONTHLY_KEY ROOT_KEY RPM1_KEY MONTHLY1_KEY COMBO_KEY
               COMBO_TOKEN_ID MONTHLY1_TOKEN_ID MONTHLY_TOKEN_ID)
missing=()
for v in "${required_vars[@]}"; do
  [[ -z "${!v:-}" ]] && missing+=("$v")
done
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: missing vars in .env.dr13: ${missing[*]}"
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

bash "${SCRIPT_DIR}/test-dr13-human.sh"
