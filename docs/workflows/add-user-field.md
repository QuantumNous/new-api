# How to add a per-tenant configuration field

Walkthrough for adding a new column to the `users` table that holds tenant-level configuration — same shape as the 5 existing Airbotix columns (`kids_mode`, `policy_profile`, `billing_webhook_url`, `custom_pricing_id`, `webhook_secret`). Use this when you need a per-tenant knob that doesn't fit existing fields.

Estimated effort: **half a day** including admin UI + tests.

This procedure follows [ADR 0006 (`internal/` isolation)](../adr/0006-internal-isolation.md): the new field goes on `model/user.go` (sanctioned upstream-adjacent edit), and behaviour driven by the field goes in `internal/`.

## Decision: do you actually need a new column?

Before adding a column, check:

1. **Can existing fields cover it?** `policy_profile` is an enum string with `"kid-safe" | "adult" | "passthrough"`. If your new behaviour is a fourth profile variant, add a profile value instead of a column.
2. **Is it per-tenant or per-channel?** Per-channel config goes in `channels.channel_info` (JSON) — see `model/channel.go`. Don't add tenant-level columns for behaviour scoped to a single channel.
3. **Is it static or dynamic?** Truly static config (e.g. system-wide feature flags) belongs in `options` table, not on `users`.

If you've decided it's a new tenant column, continue.

## Step-by-step

### 1. Add the column to `model/user.go`

Find the existing Airbotix block (currently lines 60–66):

```go
type User struct {
    // ... upstream fields above

    // Airbotix tenancy columns
    KidsMode          bool   `json:"kids_mode" gorm:"type:boolean;default:false;column:kids_mode"`
    PolicyProfile    string  `json:"policy_profile" gorm:"type:varchar(32);default:'passthrough';column:policy_profile"`
    BillingWebhookURL string `json:"billing_webhook_url,omitempty" gorm:"type:varchar(512);column:billing_webhook_url"`
    CustomPricingID   string `json:"custom_pricing_id,omitempty" gorm:"type:varchar(64);column:custom_pricing_id"`
    WebhookSecret     string `json:"webhook_secret,omitempty" gorm:"type:varchar(128);column:webhook_secret"`
    NewField          string `json:"new_field,omitempty" gorm:"type:varchar(64);column:new_field"` // ← add here
    // ... existing fields below
}
```

Rules:
- **Type choice**: prefer `varchar(N)` over `text` (cleaner index behaviour); prefer `boolean` over `int` for flags; for JSON values, use `type:text` and `json.RawMessage` so it works on SQLite (no JSONB — see [ADR 0005](../adr/0005-triple-db-compatibility.md)).
- **Default**: set one in the GORM tag so old rows don't trip null checks.
- **Column name**: snake_case, prefixed with the feature area if it could collide with upstream fields.
- **JSON tag**: use `omitempty` for optional strings so empty values don't pollute the JSON output.

### 2. Update the DTO if necessary

Open `dto/user.go` (or whichever file defines the user request/response DTO if separate from `model.User`). If the DTO mirrors `User`, add the same field. Make sure the field's JSON tag matches.

If you want to expose the field via the admin API but **not** via the user-facing API, define a separate struct or use `json:"-"` and explicitly copy in the admin handler.

### 3. Update the user update handler

Open `controller/user.go`. Find the PUT/PATCH handler for user updates (usually `UpdateUser` or similar). The field needs to be one of:

- **Auto-handled** if you're using `c.ShouldBindJSON(&user)` and the field is on `User` (most likely path — minimal code change).
- **Allowlisted** if there's an explicit field list (less common).

Find where the admin updates user via:

```go
err := updateUser.Update()
```

Make sure `NewField` is included in the GORM `Updates` map. If it uses raw `Update`, you may need:

```go
db.Model(&user).Updates(map[string]any{
    // ... existing
    "new_field": user.NewField,
})
```

### 4. Add the admin UI control

Open `web/default/src/pages/User/` (path may vary post-1.0; search for the user-edit page by string `policy_profile`). Find where existing Airbotix fields are rendered. Add yours:

```tsx
<Form.Item label="New field" tooltip="What this field controls">
    <Input
        value={user.new_field}
        onChange={(v) => setUser({ ...user, new_field: v })}
        placeholder="Example value"
    />
</Form.Item>
```

Use the right component:
- `Switch` for bool
- `Select` for enum-of-strings
- `Input` for free-text
- `InputNumber` for numbers

Use `bun run dev` (from `web/default/`) for hot-reload while iterating.

### 5. Use the field in `internal/` code

The column is now in the DB and the admin UI, but no behaviour uses it yet. Decide where the behaviour lives:

- **Policy decision** → `internal/policy/` (add a field to `Decision` and a check in `DecisionFor`)
- **Kids enforcement** → `internal/kids/` (add a new helper, wire it from `relay/airbotix_policy.go`)
- **Billing** → `internal/billing/`
- **Smart-router routing** → cross-repo change to `internal/smart_router_client/` request + `smart-router/internal/api/types.go`

Read [ADR 0006](../adr/0006-internal-isolation.md) for which `internal/*` package is the right home.

Wire from the sanctioned upstream-adjacent files (`relay/airbotix_policy.go`, `middleware/smart_router.go`):

```go
// relay/airbotix_policy.go (or wherever)
if user.NewField == "some-value" {
    // apply behaviour via internal/<package>/
}
```

### 6. Migration check

Restart the docker compose stack. GORM will detect the missing column and run `ALTER TABLE users ADD COLUMN new_field VARCHAR(64) DEFAULT ''` automatically (on all three databases).

```bash
docker compose -f docker-compose.dev.yml up -d --build new-api

# Verify in Postgres
docker compose exec postgres psql -U root -d new-api -c "\d users" | grep new_field
# Should show: new_field | character varying(64) | not null default ''
```

### 7. Tests

Add tests for the behaviour you wired up — at minimum:

- The `internal/<package>/` unit test for the new logic (table-driven: NewField=A → behaviour A; NewField=B → behaviour B; empty → no behaviour).
- An integration test in `relay/airbotix_policy_test.go` (or wherever you wired it) that asserts request transformation when the field is set.

DB-level tests are usually unnecessary — GORM is well-tested; if your column works in dev, it works in prod.

### 8. Document

- [`AIRBOTIX.md`](../../AIRBOTIX.md) — update the "What we customise" table with the new column.
- [`docs/data-model.md`](../data-model.md) — add to the "5 Airbotix columns" table (and update the count if you're adding more).
- [`AGENTS.md`](../../AGENTS.md) Rule 8 — update the "sanctioned upstream edits" list if needed (usually not — adding a column doesn't change that list, just extends the existing User edit zone).

## Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Field saves but doesn't take effect | Forgot to wire it in `internal/` (step 5) | Add the read + behaviour |
| Migration fails on SQLite | Used a complex DDL operation | Use `add column` only; never `alter column` (see [ADR 0005](../adr/0005-triple-db-compatibility.md)) |
| Admin UI field doesn't persist | Forgot to include in update handler (step 3) | Trace the PUT request payload in browser devtools; ensure field is in the update map |
| Old rows have null/empty values | No default in GORM tag | Set `default:'something'` and consider a backfill if it matters |
| Field exposed to user-facing API by accident | Used same DTO for admin + user | Split DTOs or use `json:"-"` |

## When done

Make sure you've also updated:
- [`AIRBOTIX.md`](../../AIRBOTIX.md) (status table)
- [`docs/data-model.md`](../data-model.md) (column count + table)
- Any "5 columns" mentions in docs (search: `grep -rn "5 columns\|5 Airbotix" docs/`)

These tend to drift if every PR doesn't update them.
