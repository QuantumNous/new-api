# Partner Server Accounts

## 1. Scope / Trigger

Read this contract before changing partner server access: the
`client_credentials` grant on `/oauth/token`, `/api/partner/v1/*`, the admin
routes `/api/partner-oauth/clients/{id}/server*`, `/server-secrets*`,
`/server-keys/revoke-all` and `/accounts`, the tables `partner_server_*`,
`partner_accounts` and `partner_account_payment_orders`, or anything that
creates, disables or credits a partner sub-account.

A partner (first: Kede Finance) runs its own users. Its backend holds a
server secret and, without any user sign-in, creates one YesChoy sub-account
per partner user on first use, issues that sub-account a long-lived model API
key, takes top-ups for it through Epay (ZPay `mapi.php`) and reads its usage.
Users pay YesChoy; the money lands in the sub-account wallet. It coexists with
Partner OAuth (`partner-oauth.md`), whose behaviour is unchanged.

## 2. Signatures

```text
POST /oauth/token   grant_type=client_credentials[&scope=partner:accounts]
                    Authorization: Basic base64(client_id:server_secret)
                    -> {access_token "pst_…", token_type, expires_in 3600, scope}

/api/partner/v1 (Bearer pst_…; main host only; no CORS; preflight 403)
GET  /accounts/{eid}                         never creates; 404 account_not_found
POST /accounts/{eid}/credential              {} ; creates account+key on first use; same key afterwards
POST /accounts/{eid}/credential/rotate       Idempotency-Key; {"revoke_old":"after_grace"|"immediately"}
POST /accounts/{eid}/disable | /enable       {}
POST /accounts/{eid}/payment/orders          Idempotency-Key; {"amount","payment_method","client_ip"?}; creates account on first use
GET  /accounts/{eid}/usage?start_time&end_time&page&page_size
GET  /payment/options
GET  /payment/orders/{order_id}

Admin (AdminAuth + Casbin partner_oauth_client; writes need sensitive_write + security proof)
GET    /api/partner-oauth/clients/{id}/server                       (read)
PUT    /api/partner-oauth/clients/{id}/server                       proof action update_server
POST   /api/partner-oauth/clients/{id}/server-secrets               proof action issue_server_secret
DELETE /api/partner-oauth/clients/{id}/server-secrets/{secret_id}   proof action revoke_server_secret (+secret_id)
POST   /api/partner-oauth/clients/{id}/server-keys/revoke-all       proof action revoke_server_keys
GET    /api/partner-oauth/clients/{id}/accounts                     (read)
POST   /api/partner-oauth/clients/{id}/status                       existing; now also suspends/resumes
GET    /api/user/search?partner_client_id=…                         list items carry partner_client_id/name
```

`{eid}` (external user ID) is `^[A-Za-z0-9._-]{32,64}$`, case-sensitive.

Tables (all new; no existing table was altered): `partner_server_configs`
(one per client), `partner_server_secrets`, `partner_server_tokens`,
`partner_accounts` (unique `(client_id, external_user_id_hash)` with
`hash = sha256(eid)` so case-sensitive uniqueness holds on every dialect;
unique `user_id`), `partner_account_payment_orders` (unique
`(client_id, idempotency_key_hash)` and `top_up_id`).

## 3. Contracts

### Authentication

- Server secrets (`pss_` + 64 hex, SHA-256 stored, shown once) are separate
  from the OAuth client secret. At most two are active. An OAuth secret never
  authenticates `client_credentials`; a server secret never authenticates the
  authorization code or refresh grants. `pst_` tokens are rejected by
  `/api/integrations/v1` and `oa_` tokens by `/api/partner/v1`.
- Every `client_credentials` failure (unknown client, wrong or revoked secret,
  client disabled, server access off, partner suspended, IP not allowed) is the
  same `401 invalid_client`, compared against every active secret or a
  placeholder, and counts toward `PartnerOAuthClientAuthLimited`.
- `PartnerServerBearer` checks, on every request: token unexpired; its secret
  still active; client enabled, server access on, not suspended; caller IP
  allowed. Budgets per partner per minute: 3000 overall, 120 shared by
  credential and rotate, 60 for usage; plus 1200 per IP.
- The IP allowlist is optional (user decision, 2026-10-28). Empty allows every
  address and the admin UI warns. It is reliable only for requests entering
  through Cloudflare → nginx, which overwrite `X-Forwarded-For`; the
  WireGuard `8009` TCP passthrough can spoof it (see the task's
  `security-review.md` M2).

### Caching

- Partner snapshot (client state, server config, IP allowlist, active secret
  IDs; never secret hashes) in `HybridCache`, 60 s. Every admin write to the
  client, its config or secrets, and suspension, evicts it after commit; a
  failed eviction is bounded by the TTL, so security changes apply at worst
  60 s later.
- Access tokens (`client_id`, `secret_id`, `expires_at`) cached for
  `min(remaining, 5 min)`; only found tokens are cached. Revocation relies on
  the snapshot's active secret list, not on evicting tokens.
- Never cached: secret verification at `/oauth/token`, sub-account state,
  balances, idempotency, limits, orders, usage, "not found" results.

### Sub-accounts

- Created only by credential issue or order creation, inside the caller's
  transaction, after locking the partner's config row: server access must be
  on and not suspended; total `< max_accounts` (default 100 000); created in
  the last 60 s `< accounts_per_minute` (default 60). Lookups never create.
- The user row: `pa_` + 16 random chars, 16-char random `aff_code`, no password,
  no email, no inviter, quota 0, partner's `account_group`, plus the zero
  `registration` wallet opening event. It bypasses `User.Insert`, so there is no
  sign-up bonus or log. No sign-in path reaches it; admins cannot set its
  password (`UpdateUser` refuses).
- Three independent switches decide the user's status: the partner's
  `status` (`active`/`disabled`), the administrator's `admin_disabled`, and
  the partner's suspension. `users.status` is enabled only when the partner
  and administrators both allow it and the partner is not suspended; every
  change recomputes it in the same transaction (auth version bump, sessions
  revoked and key caches dropped after commit). No switch can undo another:
  an admin enable does not lift a partner disable or a suspension, and a
  partner cannot enable an admin-disabled account (`403
  account_disabled_by_admin`). Partners and the admin list see
  `admin_disabled` when the admin switch is on.
- `ManageUser` disable/enable of a sub-account sets only the admin switch and
  answers with the resulting status. Sub-account users cannot be deleted
  (`ManageUser` delete and `DeleteUser` refuse), because the mapping is
  permanent.
- Disabling the partner client sets the client status and `suspended_at` in
  one transaction, then runs a background, resumable reconciliation (batches
  of 500, each account re-reading the suspension under its row lock) that
  applies the status and records `suspended_by_partner`. Keys keep working
  until each account's batch commits. A job triggered while running re-runs
  afterwards, also after a failure. Startup resumes suspension jobs and any
  pending key revocation. Jobs and progress live in-process (single instance;
  multi-instance needs a DB lock).
- A client that owns sub-accounts cannot be deleted.
- The 2FA adoption denominator excludes sub-accounts. Consumption, usage and
  revenue reports include them.

### Keys

- One key per account: `UnlimitedQuota`, `ExpiredTime -1`, group `auto` with
  auto groups `[account_group, "default"]` (`["default"]` when the group is
  default). Spending is still bounded by the wallet.
- The credential endpoint returns the plaintext key every time (user decision,
  rate limited); a disabled or expired key is reported (`credential_disabled`),
  never silently replaced.
- Rotation (Idempotency-Key, replay returns the same new key, other body
  `409`): `immediately` disables the old key; `after_grace` sets its expiry to
  now + 24 h. A key still in grace is disabled first, so at most two work. Every
  token write raises the token cache fence before writing.
- Admin revoke-all persists `key_revocation_requested_at`, then disables every
  current and graced key in the background, locking each account before
  reading its key IDs so a concurrent rotation cannot leave a fresh key. Only
  a complete pass clears the marker it started for; a restart resumes it.
  Rotation then issues working keys.
- Keys use the sub-account user's own group (then `default`), read in the
  transaction, so changing the partner's group affects only new sub-accounts.

### Payments

- Epay only, through ZPay `mapi.php` over HTTPS (refused otherwise), signed
  with the merchant key, `device=pc`, `clientip` = partner-supplied payer IP or
  the caller IP. The order (and account) commit first; the gateway is called
  after commit. The QR code (preferred) or pay URL is stored on the order link
  so idempotent replays return it; a replay of an order without one retries the
  gateway. Gateway responses are never logged; ZPay's order query API is not
  used (it puts the merchant key in the URL).
- Amount rules, wallet capacity and settlement are the web Epay ones (shared
  quote helper with the OAuth flow); the price uses the sub-account user's
  group, read inside the order transaction. Only one request contacts the
  gateway per order: creation claims it, a replay claims it only when the
  previous claim is older than 15 s (the gateway timeout is 10 s) and otherwise
  answers `503` with `Retry-After: 3`; a failed gateway call releases its claim. Orders settle through the unchanged Epay callbacks;
  the cashback context is `partner_oauth` (no reward, no IP/UA/device
  evidence). Limits: per account 20/hour and 5 pending/30 min; per partner
  2000/hour (not serialized across accounts, so it may overshoot slightly).
- Order lookups are partner-scoped (`404 order_not_found` otherwise) and
  never return the QR code or pay URL.

### Usage

- Consume logs only, newest first, `[start_time, end_time]` at most 31 days
  and no earlier than 90 days ago, page size 1–100, offset under 10 000,
  `has_more` instead of a count. Fields: `created_at, model_name,
  prompt_tokens, completion_tokens, quota, use_time, is_stream, request_id`.
  Never content, IP, channel, group, token name or `other`.

### Audit

`partner_oauth_authorization_logs` actions: `partner_server.token_issue`,
`.token_issue_failed` (known clients only), `.auth_denied` and
`partner_account.credential_rate_limited` (both at most once a minute per
partner and reason), `.secret_issue`, `.secret_revoke`, `.suspend`,
`.resume`, `.keys_revoke_all`, `partner_account.create`,
`.credential_issue`, `.credential_rotate` (reason = mode; not on replay),
`.disable`, `.enable`, `.payment_order_create`. Target user = the
sub-account's user ID. Never secrets, tokens, keys, Idempotency-Keys, QR
codes, pay URLs, request bodies or external user IDs.

## 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Bad `{eid}` | `400 invalid_external_user_id` |
| Lookup of unknown account (GET, rotate, disable, enable, usage) | `404 account_not_found`, no write |
| Account cap / creation rate | `429 account_limit_reached` / `429 rate_limited` + `Retry-After: 60`, no user row |
| Account disabled / disabled by admin | `403 account_disabled` / `403 account_disabled_by_admin` |
| Key disabled or expired | `403 credential_disabled` (rotate to recover) |
| Idempotency-Key reused with another body | `409 idempotency_conflict` |
| Gateway failure, non-HTTPS gateway, compliance off | `503 payment_unavailable`; retry with the same key |
| Replay while another request is calling the gateway | `503 payment_unavailable`, `Retry-After: 3`, no gateway call |
| Admin console refusals (config, secrets, delete, sub-account delete) | `ApiErrorT` (HTTP 200, `success:false`, translated `message_key`) |
| Unknown body field, query on non-usage routes, `access_token` in query | `400 invalid_request` |
| Usage range > 31 days, older than 90 days, reversed, bad paging | `400 invalid_request` |

## 5. Tests Required

- model (PostgreSQL via `TEST_POSTGRES_DSN`, schema per test): first-use
  creation and its guards, concurrent first use (8 goroutines, one account),
  case-sensitive IDs, rotation modes and replay, partner/admin status
  precedence, suspension restoring only what it disabled, revoke-all, payment
  orders and limits, secrets and tokens, client deletion refusal, 2FA stats,
  usage scoping and paging, user list owners and filter.
- service: snapshot and token caches with Redis (miniredis) and memory.
- controller: grant success/refusals with audit, secret/token lane isolation,
  allowlist and revocation, rate-limit audit, admin config and secrets,
  account lifecycle, rotation, disable/admin precedence, admin password guard,
  suspension through client status, ZPay QR order flow incl. signature,
  replay, settlement, no cashback, gateway failures recovering on retry, HTTPS
  only, order validation, usage bounds and field allowlist.
- router: partner routes ignore engine CORS and reject preflight.
- web: settings form (allowlist warning, IP validation, read-only), secrets
  panel (two-secret cap, revoke only active, revoke-all gating), dialog
  (issue shows secret once after verification; cancel issues nothing),
  partner column, permission gating.

## 6. Wrong vs Correct

```go
// Wrong: a token cache hit alone authorizes; revoking the secret takes 5 min.
if cached, ok := tokenCache.Get(hash); ok { return allow(cached) }

// Correct: the token cache only resolves the token; the (evicted-on-write)
// partner snapshot decides whether its secret is still active.
if !slices.Contains(snapshot.ActiveSecretIds, token.SecretId) { return deny() }
```

```go
// Wrong: re-enable every disabled sub-account on resume.
db.Model(&User{}).Where("id IN ?", partnerUserIDs).Update("status", enabled)

// Correct: restore only what the suspension disabled.
// ReconcilePartnerAccountSuspensionBatch: !suspend && account.SuspendedByPartner && account.Status == active
```
