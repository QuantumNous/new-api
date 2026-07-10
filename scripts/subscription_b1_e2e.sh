#!/usr/bin/env bash
# B1 subscription robustness HTTP E2E against a running new-api instance.
# Requires: curl, python3, docker (for optional DB asserts), env:
#   BASE_URL (default http://127.0.0.1:3000)
#   ACCESS_TOKEN  admin access token (no Bearer prefix required)
#   API_USER_ID   admin user id (default 1)
#   RELAY_TOKEN   sk-... or raw key for /v1/chat/completions
#   RELAY_MODEL   (default gpt-5.4-mini)
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ACCESS_TOKEN="${ACCESS_TOKEN:?set ACCESS_TOKEN}"
API_USER_ID="${API_USER_ID:-1}"
RELAY_TOKEN="${RELAY_TOKEN:?set RELAY_TOKEN}"
RELAY_MODEL="${RELAY_MODEL:-gpt-5.4-mini}"

AUTH_H=("Authorization: ${ACCESS_TOKEN}" "New-Api-User: ${API_USER_ID}" "Content-Type: application/json")

pass=0
fail=0
assert_json() {
  local name="$1" expr="$2" payload="$3"
  if python3 -c "import sys,json; d=json.loads(sys.argv[1]); assert (${expr}), d" "$payload"; then
    echo "PASS  $name"
    pass=$((pass+1))
  else
    echo "FAIL  $name"
    echo "$payload" | head -c 500; echo
    fail=$((fail+1))
  fi
}

echo "== status =="
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/status" | grep -q 200

echo "== create on_first_use plan with windows =="
PLAN=$(curl -sS -X POST "$BASE_URL/api/subscription/admin/plans" -H "${AUTH_H[0]}" -H "${AUTH_H[1]}" -H "${AUTH_H[2]}" -d '{
  "plan": {
    "title": "B1-E2E-on-first-use",
    "price_amount": 0,
    "currency": "USD",
    "duration_unit": "day",
    "duration_value": 30,
    "enabled": true,
    "total_amount": 0,
    "activation_mode": "on_first_use",
    "activation_window_seconds": 604800,
    "window_limit_5h": 50000,
    "window_limit_24h": 200000,
    "window_limit_7d": 500000,
    "window_limit_30d": 1000000
  }
}')
assert_json "create plan" "d.get('success') is True" "$PLAN"
PLAN_ID=$(python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" <<<"$PLAN")
echo "PLAN_ID=$PLAN_ID"

echo "== bind to user $API_USER_ID =="
# Admin bind force-activates; for true pending use purchase. We still check windows stay closed until consume for immediate path separately.
# Create via model path is hard over HTTP without payment; admin create user subscription force-activates.
# So for on_first_use pending we use SQL if docker postgres available, else skip pending assert.
BIND=$(curl -sS -X POST "$BASE_URL/api/subscription/admin/users/${API_USER_ID}/subscriptions" -H "${AUTH_H[0]}" -H "${AUTH_H[1]}" -H "${AUTH_H[2]}" -d "{\"plan_id\": $PLAN_ID}")
assert_json "bind plan" "d.get('success') is True" "$BIND"

SELF0=$(curl -sS "$BASE_URL/api/subscription/self" -H "${AUTH_H[0]}" -H "${AUTH_H[1]}")
assert_json "self after bind" "d.get('success') is True" "$SELF0"
SUB_ID=$(python3 - <<PY
import json,sys
d=json.loads('''$SELF0''')
for s in d['data'].get('usable_subscriptions') or []:
  sub=s.get('subscription') or {}
  if sub.get('plan_id')==$PLAN_ID:
    print(sub['id']); break
PY
)
echo "SUB_ID=$SUB_ID"
test -n "$SUB_ID"

# Prefer this sub
curl -sS -X PUT "$BASE_URL/api/subscription/self/priority" -H "${AUTH_H[0]}" -H "${AUTH_H[1]}" -H "${AUTH_H[2]}" \
  -d "{\"subscription_ids\":[$SUB_ID]}" >/dev/null || true
curl -sS -X PUT "$BASE_URL/api/subscription/self/preference" -H "${AUTH_H[0]}" -H "${AUTH_H[1]}" -H "${AUTH_H[2]}" \
  -d '{"billing_preference":"subscription_first"}' >/dev/null

# Disable other actives if docker postgres present
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx postgres; then
  docker exec postgres psql -U root -d new-api -c \
    "UPDATE user_subscriptions SET disabled=true WHERE user_id=${API_USER_ID} AND id<>${SUB_ID} AND status='active'; UPDATE user_subscriptions SET disabled=false, priority=100 WHERE id=${SUB_ID};" >/dev/null
fi

echo "== real /v1 consume =="
CHAT=$(curl -sS -X POST "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer ${RELAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"${RELAY_MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"reply with exactly: ok\"}],\"max_tokens\":5,\"stream\":false}" || true)
echo "$CHAT" | head -c 400; echo
python3 -c "import sys,json; d=json.loads(sys.argv[1]); assert 'choices' in d or d.get('error'), d" "$CHAT"

SELF1=$(curl -sS "$BASE_URL/api/subscription/self" -H "${AUTH_H[0]}" -H "${AUTH_H[1]}")
python3 - <<PY
import json,time
d=json.loads('''$SELF1''')
assert d.get('success')
hit=None
for s in d['data'].get('usable_subscriptions') or []:
  if (s.get('subscription') or {}).get('id')==$SUB_ID:
    hit=s; break
assert hit, 'sub missing'
wu=hit.get('window_usage') or {}
print('window_usage', json.dumps(wu, ensure_ascii=False))
ok=False
now=int(time.time())
for k,v in wu.items():
  used=int(v.get('used') or 0)
  if used>0:
    ok=True
    assert int(v.get('reset_at') or 0)>now
    assert int(v.get('since') or 0)>0
assert ok or int((hit.get('subscription') or {}).get('amount_used') or 0)>0
print('PASS  e2e window activated after /v1')
PY
pass=$((pass+1))

# ---------------------------------------------------------------------------
# Fill 24h + backdate window_start past 24h (no wall-clock wait), then reopen.
# Requires docker postgres + redis for DB/cache control.
# ---------------------------------------------------------------------------
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx postgres; then
  echo "== fill 24h used, backdate start 25h, assert clear/reopen =="
  # Use a dedicated tiny-limit plan for this path
  PLAN2=$(curl -sS -X POST "$BASE_URL/api/subscription/admin/plans" -H "${AUTH_H[0]}" -H "${AUTH_H[1]}" -H "${AUTH_H[2]}" -d '{
    "plan": {
      "title": "B1-E2E-fill-backdate",
      "price_amount": 0,
      "currency": "USD",
      "duration_unit": "day",
      "duration_value": 30,
      "enabled": true,
      "total_amount": 0,
      "activation_mode": "immediate",
      "window_limit_5h": 0,
      "window_limit_24h": 100,
      "window_limit_7d": 10000,
      "window_limit_30d": 0
    }
  }')
  assert_json "create fill-backdate plan" "d.get('success') is True" "$PLAN2"
  PLAN2_ID=$(python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" <<<"$PLAN2")
  BIND2=$(curl -sS -X POST "$BASE_URL/api/subscription/admin/bind" -H "${AUTH_H[0]}" -H "${AUTH_H[1]}" -H "${AUTH_H[2]}" -d "{\"user_id\": ${API_USER_ID}, \"plan_id\": ${PLAN2_ID}}")
  assert_json "bind fill-backdate plan" "d.get('success') is True" "$BIND2"
  SELF2=$(curl -sS "$BASE_URL/api/subscription/self" -H "${AUTH_H[0]}" -H "${AUTH_H[1]}")
  SUB2_ID=$(python3 - <<PY
import json
d=json.loads('''$SELF2''')
for s in d['data'].get('usable_subscriptions') or []:
  sub=s.get('subscription') or {}
  if sub.get('plan_id')==$PLAN2_ID:
    print(sub['id']); break
PY
  )
  echo "SUB2_ID=$SUB2_ID"
  docker exec postgres psql -U root -d new-api -c \
    "UPDATE user_subscriptions SET disabled=true WHERE user_id=${API_USER_ID} AND id<>${SUB2_ID} AND status='active'; UPDATE user_subscriptions SET disabled=false, priority=999 WHERE id=${SUB2_ID};" >/dev/null

  curl -sS -X POST "$BASE_URL/v1/chat/completions" \
    -H "Authorization: Bearer ${RELAY_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"${RELAY_MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"reply with exactly: ok\"}],\"max_tokens\":5,\"stream\":false}" >/dev/null

  # fill used + backdate start 25h
  docker exec postgres psql -U root -d new-api -c "
    UPDATE user_subscriptions
    SET window_used_24h = 100,
        window_used_7d = 100,
        window_start_24h = EXTRACT(EPOCH FROM NOW())::bigint - 25*3600,
        window_start_7d  = EXTRACT(EPOCH FROM NOW())::bigint - 25*3600
    WHERE id = ${SUB2_ID};
  " >/dev/null
  docker exec redis redis-cli -a 123456 FLUSHDB >/dev/null 2>&1 || true

  SELF_BD=$(curl -sS "$BASE_URL/api/subscription/self" -H "${AUTH_H[0]}" -H "${AUTH_H[1]}")
  python3 - <<PY
import json,time
d=json.loads('''$SELF_BD''')
hit=None
for s in d['data'].get('usable_subscriptions') or []:
  if (s.get('subscription') or {}).get('id')==$SUB2_ID:
    hit=s; break
assert hit
wu=hit.get('window_usage') or {}
w24=wu.get('24h') or {}
w7=wu.get('7d') or {}
assert int(w24.get('used') or 0)==0 and int(w24.get('reset_at') or 0)==0, w24
assert int(w7.get('used') or 0)==100 and int(w7.get('reset_at') or 0)>0, w7
ra=int(w7.get('reset_after_seconds') or 0)
assert 140*3600 < ra < 150*3600, ra
print('PASS  fill+backdate: 24h cleared, 7d still ~6d left')
PY
  pass=$((pass+1))

  curl -sS -X POST "$BASE_URL/v1/chat/completions" \
    -H "Authorization: Bearer ${RELAY_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"${RELAY_MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"reply with exactly: ok\"}],\"max_tokens\":5,\"stream\":false}" >/dev/null
  docker exec redis redis-cli -a 123456 FLUSHDB >/dev/null 2>&1 || true
  SELF_RO=$(curl -sS "$BASE_URL/api/subscription/self" -H "${AUTH_H[0]}" -H "${AUTH_H[1]}")
  python3 - <<PY
import json,time
d=json.loads('''$SELF_RO''')
hit=None
for s in d['data'].get('usable_subscriptions') or []:
  if (s.get('subscription') or {}).get('id')==$SUB2_ID:
    hit=s; break
w24=(hit.get('window_usage') or {}).get('24h') or {}
assert int(w24.get('used') or 0)>0
assert int(w24.get('reset_after_seconds') or 0) > 23*3600
print('PASS  fill+backdate reopen: 24h fresh ~24h countdown')
PY
  pass=$((pass+1))
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx postgres; then
  docker exec postgres psql -U root -d new-api -c \
    "SELECT id,status,amount_used,window_start_5h,window_used_5h,window_start_24h,window_used_24h FROM user_subscriptions WHERE id=${SUB_ID};"
  docker exec postgres psql -U root -d new-api -c \
    "UPDATE user_subscriptions SET disabled=false WHERE user_id=${API_USER_ID} AND status='active';" >/dev/null || true
fi

echo
echo "RESULT pass=$pass fail=$fail"
test "$fail" -eq 0
