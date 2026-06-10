#!/usr/bin/env bash
# Run DR-13 human test with current token set.
# Edit the keys below when tokens change.

export RPM_KEY="sk-3YPwBEJ2XJqRV3pcmEKpENgJep5vdKbzxr4M3lLt9uozcPqY"
export TPM_KEY="sk-NloE6t0iqSRiqlospCzcP2nY9UvdeCUUfmPsv5UtIqfCFIYF"
export MONTHLY_KEY="sk-Exj1lG0ESvJLgaxV2MzZX9STImI2t39lKwm4QhcsPCLbXMlN"
export ROOT_KEY="sk-gUPAOZwklx6nsa61im7haCvzRdw43tEYI3yHRUgsGQFdmo3g"
export RPM1_KEY="sk-ipmPi83LvPwhjzuxDrWcyCflVI7E14FLgZzmqiVlDzQJVjFF"
export MONTHLY1_KEY="sk-ABn8v3Li5O7yvqJdgKul8BbI3nR4Rj7Hrwr8PyG9joLGD1w8"
export COMBO_KEY="sk-QUtxSaYBglOgum40aiQXuuOkwCCgcmg1ssSCJYtYi3vVDZu4"
export BASE_URL="http://localhost:3000"

# Reset monthly counters before each run so the test is repeatable.
# Token IDs: 16=COMBO, 20=MONTHLY1, 21=MONTHLY
# Monthly counters are permanent; without this reset, re-runs exhaust the quota.
YYYYMM=$(date +%Y%m)
docker compose exec redis redis-cli DEL \
  "tq:monthly:16:${YYYYMM}" \
  "tq:monthly:20:${YYYYMM}" \
  "tq:monthly:21:${YYYYMM}" > /dev/null 2>&1
echo "  [reset] Monthly counters cleared for COMBO/MONTHLY1/MONTHLY tokens"

bash "$(dirname "$0")/test-dr13-human.sh"
