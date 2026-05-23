# Data model — Postgres tables + Redis keys

A reference for the schema + cache layers. Read this when you need to know what's in the database without grepping `model/*.go`, or when you need to invalidate / look up a Redis key.

Triple-DB compatibility constraint applies (see [`adr/0005-triple-db-compatibility.md`](./adr/0005-triple-db-compatibility.md)) — all tables run on SQLite, MySQL ≥ 5.7.8, and PostgreSQL ≥ 9.6.

## Primary tables

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Identity, quota, OAuth bindings, **5 Airbotix tenancy columns** | PK `id`; UNQ `username`, `access_token`, `aff_code`; IDX on OAuth provider IDs (`github_id`, `discord_id`, `oidc_id`, `wechat_id`, `telegram_id`, `linux_do_id`, `email`, `stripe_customer`); FK `inviter_id` |
| `channels` | Upstream provider configuration. **`key` column stores plaintext API keys** (see [ADR 0004](./adr/0004-channel-key-plaintext.md)) | PK `id`; IDX `name`, `tag`, `group`; JSON `channel_info`; TEXT `model_mapping`, `param_override`, `header_override`, `setting`; CSV `models` |
| `tokens` | API tokens (user-facing keys for calling `/v1/*`) | PK `id`; UNQ `key` (varchar(128)); FK `user_id`; IDX `name`, `group`; SOFT-DELETE `deleted_at`; TEXT `model_limits` |
| `abilities` | Denormalized **(group, model) → channels** lookup. Drives Layer-2 channel selection | Composite PK `(group, model, channel_id)`; IDX `priority`, `weight`, `tag` |
| `logs` | Request log (one row per relay call) | PK `id`; composite IDX `(created_at, id)`, `(user_id, id)`, `(created_at, type)`; many single-column IDXes |
| `redemptions` | One-time / multi-use quota codes | PK `id`; UNQ `key` (char(32)); IDX `name`; SOFT-DELETE |
| `topups` | Payment top-up records | PK `id`; FK `user_id`; UNQ `trade_no` |
| `tasks` | Async task records (video gen, etc.) | PK `id` (bigint AI); FK `user_id`, `channel_id`; IDX `task_id`, `status`, time fields |
| `midjourneys` | Midjourney-specific task records | Same shape as `tasks` |
| `subscription_plans` | Recurring billing plan definitions | PK `id`; DECIMAL(10,6) `price_amount` |
| `subscription_orders` | Pending payment orders (before webhook → user_subscriptions) | PK `id`; FK `user_id`, `plan_id` |
| `user_subscriptions` | Active subscription state per user | FK `user_id`, `plan_id` |
| `subscription_pre_consume_records` | Pre-consumption quota tracking for subscriptions | FK `user_id` |
| `passkey_credentials` | WebAuthn credentials | PK `id`; UNQ `credential_id`; FK `user_id` (UNIQUE); SOFT-DELETE |
| `twofas` | TOTP secret + lockout state | PK `id`; FK `user_id` (UNIQUE) |
| `twofa_backup_codes` | Single-use TOTP backup codes | FK `user_id` |
| `checkins` | Daily check-in quota awards | PK `id`; composite UNQ `(user_id, checkin_date)` |
| `options` | KV table for system settings, SMTP, feature flags | PK `key` (varchar) |

Smaller / less-used tables: `Model` (metadata), `Vendor`, `PrefillGroup`, `CustomOAuthProvider`, `UserOAuthBinding`, `PerfMetric`.

## The 5 Airbotix columns on `users`

Added by this fork (`model/user.go:60-66`). Stored plaintext like the upstream columns.

| Column | Type | Default | Purpose |
|---|---|---|---|
| `kids_mode` | `boolean` | `false` | Master switch: enforce all kids constraints (model whitelist, ZDR, prompt injection, metadata strip) |
| `policy_profile` | `varchar(32)` | `'passthrough'` | Tenant profile: `kid-safe`, `adult`, or `passthrough` |
| `billing_webhook_url` | `varchar(512)` | `''` | Where to POST billing events (consumed by `internal/billing/` once Phase 2 wires it) |
| `custom_pricing_id` | `varchar(64)` | `''` | Reference to a non-default pricing expression |
| `webhook_secret` | `varchar(128)` | `''` | HMAC-SHA256 signing secret for billing webhook payloads (plaintext — see [ADR 0004](./adr/0004-channel-key-plaintext.md)) |

Plus 3 auto-topup columns (also added in the same `User` extension): `auto_topup_enabled`, `auto_topup_threshold`, `auto_topup_amount`.

## Layer-2 routing: the `abilities` table

This is the lookup that powers `model/channel_cache.go:GetRandomSatisfiedChannel`. It's flat and denormalized:

```sql
CREATE TABLE abilities (
  "group"     varchar NOT NULL,
  model       varchar NOT NULL,
  channel_id  integer NOT NULL,
  priority    integer,
  weight      integer,
  tag         varchar,
  PRIMARY KEY ("group", model, channel_id)
);
CREATE INDEX abilities_channel_id  ON abilities (channel_id);
CREATE INDEX abilities_priority    ON abilities (priority);
CREATE INDEX abilities_weight      ON abilities (weight);
CREATE INDEX abilities_tag         ON abilities (tag);
```

It's regenerated whenever a `Channel` is created / updated, by exploding `channel.models` (CSV) × `channel.groups` (CSV) → one row per (group, model, channel). The in-memory channel cache loads the full table on startup and again every `SYNC_FREQUENCY` seconds (default 60).

The selection algorithm:
1. Look up `(group, model)` in the in-memory `group2model2channels` map.
2. Group results by `priority` (descending). On retry N, jump to the Nth priority tier.
3. Within the tier, pick weighted-random by `weight`. Special cases: all-zero weights → equal allocation; average weight < 10 → multiply all by 100 to smooth.

If you're tempted to add a composite index on `(group, model)` for performance: the in-memory cache makes the DB index academic. The DB index that **does** matter is `channel_id` for joining when admin UI lists channel ability lists.

## Important upstream columns to know

These come from upstream and matter to fork code:

- `users.id` — used as `user_id` in Gin context across all middleware
- `users.group` — the tenant's group; influences `abilities` lookup
- `users.quota` — current quota (atomic counter; deducted per request)
- `users.access_token` — long-lived admin session token (separate from API `tokens`)
- `channels.type` — integer enum from `constant/channel.go` (e.g., `ChannelTypeOpenAI=1`)
- `channels.key` — **plaintext** upstream API key. See [ADR 0004](./adr/0004-channel-key-plaintext.md). Can be multi-line for multi-key channels (`channel.ChannelInfo.IsMultiKey=true`); newline-delimited.
- `channels.priority`, `channels.weight` — used by Layer-2 channel selection (see above)
- `channels.status` — integer: 1=enabled, 2=manually-disabled, 3=auto-disabled (e.g., key invalid)
- `tokens.key` — the customer-facing API key prefix `sk-...`; used for token authentication

## Redis keys

Redis is **optional** (`REDIS_CONN_STRING` env var). When disabled, all caches fall back to in-memory + DB.

| Key pattern | Type | TTL | Contents | Set / read |
|---|---|---|---|---|
| `token:<hmac_key>` | HASH | `SYNC_FREQUENCY` (60s) | User Token struct fields. Cache key is `HMAC-SHA256(token.Key, CryptoSecret)` to keep plaintext tokens out of Redis | `model/token_cache.go:cacheSetToken` / `cacheGetTokenByKey` |
| `user:<user_id>` | HASH | `SYNC_FREQUENCY` (60s) | UserBase fields (id, group, quota, status, username, setting, email) | `model/user_cache.go:updateUserCache` / `GetUserCache` |
| `file_cache_<hmac_url>` | STRING | (Gin request scope; not Redis TTL) | URL→file content cache for image/video inputs. Key is `HMAC-SHA256(url, CryptoSecret)` | `service/file_service.go:LoadFileSource` |
| `b64_cache_<hmac_material>` | STRING | Same | Base64-encoded file data cache | `service/file_service.go:LoadFileSource` |
| `new-api:subscription_plan:v1:<plan_id>` | STRING (JSON) | In-memory 300s + Redis | `SubscriptionPlan` struct | `model/subscription.go:getSubscriptionPlanCache` |
| `new-api:subscription_plan_info:v1:<plan_id>` | STRING (JSON) | In-memory 120s + Redis | `SubscriptionPlanInfo` | `model/subscription.go:getSubscriptionPlanInfoCache` |
| Rate-limit buckets | (Lua) | Sliding window | Per-token / per-IP rate-limit counters (Redis Lua script in `common/limiter/`) | `middleware/rate-limit.go` |

In-memory caches that don't go through Redis:
- **Channel cache** (`model/channel_cache.go`) — `group2model2channels[group][model] → []channel`. Loaded from `abilities` table on startup, refreshed every `SYNC_FREQUENCY` seconds.
- **Settings** (`setting/*`) — atomic pointers to settings structs for hot reload.

## CRYPTO_SECRET — what it really does

Just to be crystal clear (this has bitten before): `CRYPTO_SECRET` is the secret for **HMAC-SHA256**, not for encryption.

```go
// common/crypto.go:17
func GenerateHMAC(data string) string {
    h := hmac.New(sha256.New, []byte(CryptoSecret))
    h.Write([]byte(data))
    return hex.EncodeToString(h.Sum(nil))
}
```

It's used in two places:
1. `model/token_cache.go` — hash user access tokens to form Redis cache keys (so plaintext tokens never appear in Redis).
2. `service/file_service.go` — hash file URLs / contents to form cache keys.

It is **not** used to encrypt `channel.key`, `users.webhook_secret`, or any other field. There is no encryption layer in this codebase. See [ADR 0004](./adr/0004-channel-key-plaintext.md).

## Migrations

GORM `AutoMigrate` runs on each boot via `model.InitDB()` in `model/main.go`. For schema additions:
- Add the column to the GORM struct with appropriate tags (`gorm:"type:varchar(64);default:''"`).
- On next boot, GORM detects the missing column and runs `ALTER TABLE ... ADD COLUMN`.
- **SQLite** doesn't support `ALTER COLUMN`, so changing an existing column's type requires the add-new + backfill + drop-old dance. Migrations that work on all three databases are validated by CI.

There is no separate migrations directory or version table. The schema-of-record is the GORM struct definitions.

## When extending

- **New table** → new file in `model/`, register in `model.InitDB()` if it needs migration, define indexes via GORM tags, write a `*_cache.go` if it needs caching.
- **New column on existing table** → modify struct, add the column with a default (don't break old rows), update DTO (`dto/*.go`) and admin UI if user-facing.
- **New Redis-cached entity** → mirror `model/token_cache.go` / `model/user_cache.go` patterns: `cacheSet*`, `cacheGet*`, invalidation hook on the model save path.
- **New index** → GORM struct tag `gorm:"index"` (simple) or `gorm:"index:idx_name,composite:..."`. For composite indexes that span tables, do it in raw SQL inside an init function — but mind the cross-DB compatibility (see [ADR 0005](./adr/0005-triple-db-compatibility.md)).
