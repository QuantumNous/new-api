# DeepRouter — Tenant Onboarding Guide

> **Audience**: Super Admins provisioning B2B tenants (Airbotix Kids, JR Academy, future enterprise clients)
> **Status**: Phase 1 complete — UI and backend fields fully wired
> **Related**: [`PLAN.md`](../PLAN.md) · [`CLAUDE.md`](../CLAUDE.md) · [`internal/policy/`](../internal/policy/) · [`internal/billing/`](../internal/billing/)

---

## What is a Tenant?

A **tenant** in DeepRouter is a standard user account extended with per-tenant policy and billing fields. Each tenant:

- Gets their own **API key** (token) to authenticate requests
- Has their own **quota** (usage budget)
- Can have **kids_mode** hard-constraints enforced on every request
- Can receive **billing webhook** events for every completed request
- Never sees another tenant's data, keys, or logs

### Tenant Fields Reference

| Field | Type | Values | Purpose |
|-------|------|--------|---------|
| `kids_mode` | `bool` | `true` / `false` | Hard-enables all child-safety constraints (model whitelist, ZDR, system prompt injection, content filter). Overrides `policy_profile`. |
| `policy_profile` | `string` | `passthrough` / `adult` / `kid-safe` | Soft policy layer. When `kids_mode=true`, this is locked to `kid-safe` at runtime. |
| `billing_webhook_url` | `string` | HTTPS URL | Where DeepRouter POSTs per-request billing events. Empty = billing disabled. |
| `webhook_secret` | `string` | 64-char hex | HMAC-SHA256 key used to sign `X-DeepRouter-Signature` header on outbound webhooks. |
| `custom_pricing_id` | `string` | Free text | Reference into your external pricing table. Passed through on billing events. V1 feature — stored now for forward compatibility. |

---

## Tenant Types

### Type A — Kids Platform (`kids_mode = true`)
*Airbotix Kids, primary school coding workshops*

Every request through this tenant:
1. Validates the requested model against the kids whitelist → rejects non-whitelisted models with `400`
2. Strips `user` field and any identifying metadata from the upstream payload
3. Injects `store: false` (OpenAI Zero Data Retention)
4. Prepends child-safe system prompt if no system prompt already present
5. Fires billing webhook on completion

**Set**: `kids_mode=true`, `policy_profile=kid-safe`

### Type B — Professional / Academy (`kids_mode = false`)
*JR Academy, adult developer tools, enterprise API clients*

Standard routing — no content constraints, full model catalogue. Billing webhook optional.

**Set**: `kids_mode=false`, `policy_profile=adult` or `passthrough`

---

## Option 1 — Automated Seed Script (Recommended for Launch)

The seed script provisions both launch tenants idempotently. Run it once on each environment.

```bash
# Local development
./bin/seed-airbotix-kids.sh

# Staging / production
BASE_URL=https://api.deeprouter.ai                                  \
ROOT_PASSWORD="$(cat /run/secrets/deeprouter-root-password)"        \
KIDS_WEBHOOK_URL=https://platform.airbotix.com/api/billing/deeprouter \
JR_WEBHOOK_URL=https://platform.jracademy.com/api/billing/deeprouter   \
./bin/seed-airbotix-kids.sh

# Preview without changes
DRY_RUN=1 ./bin/seed-airbotix-kids.sh
```

The script outputs a summary table with API keys and webhook secrets.
**Save this output immediately** — secrets cannot be recovered after the terminal session ends.

---

## Option 2 — Manual Provisioning (5 Steps)

Use this for any tenant outside the two launch tenants.

### Step 1 — Authenticate as Super Admin

```bash
BASE_URL="https://api.deeprouter.ai"   # or http://localhost:3000

curl -s -c /tmp/dr-session.txt -b /tmp/dr-session.txt \
  -X POST "${BASE_URL}/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"root","password":"<root-password>"}' \
  | jq '{success, data: .data.username}'
# → {"success": true, "data": "root"}
```

### Step 2 — Create the Tenant User Account

```bash
# Generate a strong password (20 chars, alphanumeric)
TENANT_PASS=$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20)
echo "Tenant password: $TENANT_PASS"   # save this

curl -s -c /tmp/dr-session.txt -b /tmp/dr-session.txt \
  -X POST "${BASE_URL}/api/user/" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\":     \"my-tenant\",
    \"password\":     \"${TENANT_PASS}\",
    \"display_name\": \"My Organisation\",
    \"role\":         1
  }" | jq '{success, message}'
```

Password requirements: 8–20 characters. Role `1` = common user (correct — tenants are not admins).

### Step 3 — Get the User ID

```bash
USER_ID=$(curl -s -c /tmp/dr-session.txt -b /tmp/dr-session.txt \
  "${BASE_URL}/api/user/search?keyword=my-tenant" \
  | jq -r '.data[] | select(.username=="my-tenant") | .id')

echo "User ID: ${USER_ID}"
```

### Step 4 — Apply Tenant Policy Fields

Generate a secure webhook signing secret:

```bash
WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "Webhook secret: ${WEBHOOK_SECRET}"   # save this — share only with the receiver
```

**Kids Platform:**

```bash
curl -s -c /tmp/dr-session.txt -b /tmp/dr-session.txt \
  -X PUT "${BASE_URL}/api/user/" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\":                  ${USER_ID},
    \"username\":            \"my-tenant\",
    \"display_name\":        \"My Organisation\",
    \"password\":            \"\",
    \"kids_mode\":           true,
    \"policy_profile\":      \"kid-safe\",
    \"billing_webhook_url\": \"https://your-platform.com/api/billing/deeprouter\",
    \"webhook_secret\":      \"${WEBHOOK_SECRET}\",
    \"custom_pricing_id\":   \"v1-standard\"
  }" | jq '{success, message}'
```

**Professional / Academy:**

```bash
curl -s -c /tmp/dr-session.txt -b /tmp/dr-session.txt \
  -X PUT "${BASE_URL}/api/user/" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\":                  ${USER_ID},
    \"username\":            \"my-tenant\",
    \"display_name\":        \"My Organisation\",
    \"password\":            \"\",
    \"kids_mode\":           false,
    \"policy_profile\":      \"adult\",
    \"billing_webhook_url\": \"https://your-platform.com/api/billing/deeprouter\",
    \"webhook_secret\":      \"${WEBHOOK_SECRET}\",
    \"custom_pricing_id\":   \"v1-standard\"
  }" | jq '{success, message}'
```

### Step 5 — Add Initial Quota and Verify

```bash
# Add 5,000,000 quota units (~$10)
curl -s -c /tmp/dr-session.txt -b /tmp/dr-session.txt \
  -X POST "${BASE_URL}/api/user/manage" \
  -H "Content-Type: application/json" \
  -d "{\"id\": ${USER_ID}, \"action\": \"add_quota\", \"value\": 5000000, \"mode\": \"add\"}" \
  | jq '{success}'

# Verify final state
curl -s -c /tmp/dr-session.txt -b /tmp/dr-session.txt \
  "${BASE_URL}/api/user/${USER_ID}" \
  | jq '{id, username, kids_mode, policy_profile, billing_webhook_url, quota}'
```

---

## Creating the API Token

The API token is what client applications send as `Authorization: Bearer <token>`.

Log in as the tenant user to create their token:

```bash
curl -s -c /tmp/tenant-session.txt -b /tmp/tenant-session.txt \
  -X POST "${BASE_URL}/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"my-tenant","password":"<tenant-password>"}' | jq '.success'

API_KEY=$(curl -s -c /tmp/tenant-session.txt -b /tmp/tenant-session.txt \
  -X POST "${BASE_URL}/api/token/" \
  -H "Content-Type: application/json" \
  -d '{
    "name":            "production-key",
    "unlimited_quota": true,
    "expired_time":    -1
  }' | jq -r '.data')

echo "API Key: ${API_KEY}"   # sk-... — shown ONCE, save immediately
```

Hand the `API_KEY` to the client integration team via a **secure channel** (1Password share, AWS Secrets Manager — never plain Slack or email).

---

## Verification Checklist

Run after provisioning every tenant before handing off the key:

```bash
API_KEY="sk-..."

# 1. List available models (expect 200)
curl -s -H "Authorization: Bearer ${API_KEY}" \
  "${BASE_URL}/v1/models" | jq '.data | length'

# 2. Kids tenants only — non-whitelisted model must return 400
curl -s -X POST "${BASE_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4-turbo","messages":[{"role":"user","content":"hello"}]}' \
  | jq '.error.code'
# expect: "model_not_eligible_for_kids_mode"

# 3. Whitelisted model must return 200
curl -s -X POST "${BASE_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}]}' \
  | jq '{model: .model, finish: .choices[0].finish_reason}'

# 4. Check your platform-backend logs — billing webhook should have fired
```

---

## Quota Reference

| Quota units | USD equivalent | Typical use |
|-------------|---------------|-------------|
| 500,000 | ~$1.00 | Default trial grant |
| 5,000,000 | ~$10.00 | Recommended starting quota |
| 50,000,000 | ~$100.00 | Workshop (200 students × 1hr) |
| 500,000,000 | ~$1,000.00 | Large deployment |

Formula: `USD = quota_units ÷ 500,000`

---

## Billing Webhook Reference

DeepRouter POSTs to `billing_webhook_url` after each successful request:

```json
{
  "request_id":        "dr-abc123xyz",
  "tenant_id":         "airbotix-kids",
  "provider":          "openai",
  "model":             "gpt-4o-mini",
  "prompt_tokens":     150,
  "completion_tokens": 80,
  "image_count":       0,
  "cost_usd":          1,
  "timestamp":         "2026-05-31T04:00:00Z"
}
```

> The event type is sent via the `X-DeepRouter-Event: request.completed` HTTP header, not in the JSON body.
> `cost_usd` is a Go `float64` serialized by `encoding/json`: whole numbers appear as `1` not `1.00`; fractional costs appear with full precision (e.g. `0.000234`). Receivers must not assume fixed decimal places.
> Fields `family_id`, `kid_profile_id`, `product_line` are omitted when empty (kids_mode V1 features).
> `image_count` is always `0` in V0 — multi-modal tracking is a V1 feature.
> `stars` is omitted when 0 (Airbotix Stars credit mapping, V1).

### Signature Verification

Every POST includes `X-DeepRouter-Signature: <hex>` — a raw HMAC-SHA256 hex digest over the raw request body, signed with `webhook_secret`. There is no `sha256=` prefix.

**Python:**
```python
import hmac, hashlib

def verify(body: bytes, header: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)
```

**TypeScript / Node.js:**
```typescript
import crypto from 'crypto'

function verify(body: Buffer, header: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header))
}
```

**Always use `timingSafeEqual` / `compare_digest` to prevent timing attacks.**

### Idempotency

The receiver must treat `request_id` as an idempotency key — DeepRouter may retry on network failure. Charge exactly once per `request_id`.

---

## Launch Tenant Reference

| Username | kids_mode | policy_profile | Notes |
|----------|-----------|---------------|-------|
| `airbotix-kids` | `true` | `kid-safe` | Airbotix workshop platform |
| `jr-academy` | `false` | `adult` | JR Academy coding school |

---

## Rotating a Webhook Secret

1. Generate: `openssl rand -hex 32`
2. Update DeepRouter: `PUT /api/user/` with `webhook_secret: <new>`
3. Update receiver (platform-backend) with the new secret
4. Confirm webhooks arrive and signatures verify

> There is no grace period. Coordinate the rotation — old and new secret cannot coexist simultaneously.

---

## Updating a Tenant Field

Use the same `PUT /api/user/` endpoint. Specify the full user object; only listed fields are modified.

```bash
# Example: disable billing webhook
curl -s -c /tmp/dr-session.txt -b /tmp/dr-session.txt \
  -X PUT "${BASE_URL}/api/user/" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\":                  ${USER_ID},
    \"username\":            \"my-tenant\",
    \"display_name\":        \"My Organisation\",
    \"password\":            \"\",
    \"billing_webhook_url\": \"\"
  }" | jq '{success}'
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `kids_mode` returns unconstrained response | Phase 2 relay wiring not deployed | See `PLAN.md` Phase 2 |
| Billing webhook not firing | URL empty or Phase 2 not wired | Check tenant fields; check deploy |
| `401 Unauthorized` on API call | Token expired or wrong key | Regenerate in admin UI |
| User not found after creation | Search is case-sensitive | Use exact username |
| Quota add fails | Caller role is admin not root | Log in as `root` |
| `400 model_not_eligible` on non-kids tenant | `kids_mode` accidentally set to `true` | Verify tenant fields |

---

## Security Considerations

1. **Webhook secrets** are stored plaintext in PostgreSQL. The database is in a private VPC subnet (enforced by `infra/`) — no direct internet access.
2. **Never log** `webhook_secret` or API keys. Both fields use `omitempty` in JSON serialisation.
3. **Token handoff**: always use a secrets manager (1Password, AWS Secrets Manager) or one-time-share link. Never plain Slack, email, or WeChat.
4. **Secret rotation**: rotate webhook secrets every 90 days or immediately on suspected compromise.
5. **Least-privilege tokens**: use `model_limits_enabled=true` on tenant tokens to restrict to only the models they should access.
6. **Audit**: every admin action is recorded in the `logs` table (`model_type=manage`) with the acting admin's `user_id`.

---

*Updated: 2026-05-31 — Phase 1 complete. Phase 2 (relay wiring) in progress.*
