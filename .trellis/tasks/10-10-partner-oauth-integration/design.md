# Design: Partner OAuth (relay_partner_api v0.2)

## 1. Boundaries

New, self-contained "partner OAuth" feature. It does not touch dashboard sessions, PAT, desktop auth, relay `TokenAuth`, or billing. The only cross-module writes are:

- create one `model.Token` per binding (credential endpoint);
- disable that `model.Token` when the binding is revoked (with token cache invalidation).

| Layer | New files |
|---|---|
| model | `model/partner_oauth.go` (3 tables + transactional operations), `model/partner_oauth_test.go` |
| service | `service/partner_oauth.go` (validation, PKCE, issuance, refresh, revoke, credential), `service/partner_oauth_test.go` |
| controller | `controller/partner_oauth.go` (protocol endpoints + browser consent API), `controller/partner_oauth_client.go` (admin CRUD), `controller/partner_oauth_test.go` |
| middleware | `middleware/partner_oauth.go` (Bearer auth for integration API, protocol-shaped rate limiter) |
| router | `router/partner-oauth-router.go`, call from `router/main.go` before `SetWebRouter` |
| i18n | backend error-page strings (en, zh) |
| authz | `service/authz/resources_partner_oauth.go` (resource `partner_oauth_client`); update matrices in `service/authz/authz_test.go` |
| web | `web/src/features/partner-authorization/` + route `_authenticated/partner-authorize/index.tsx`; admin page `web/src/features/partner-oauth-clients/` + route `_authenticated/partner-oauth-clients/index.tsx` (Admin sidebar group, permission-gated); locale keys for all 7 languages |
| spec | `.trellis/spec/backend/partner-oauth.md` (new contract), link from `.trellis/spec/backend/index.md` and `AGENTS.md` module table |

## 2. Data model (main DB, GORM AutoMigrate, three-dialect safe)

No JSON column types, no boolean defaults, all timestamps `bigint` unix seconds, string enums as `varchar`.

### `partner_oauth_clients`
| Field | Type | Notes |
|---|---|---|
| `id` | int64 PK | |
| `client_id` | varchar(64) unique | `pc_` + 32 lowercase hex; immutable |
| `name` | varchar(64) not null | shown on consent page |
| `token_auth_method` | varchar(32) not null | `client_secret_basic` \| `none`; immutable after create |
| `secret_hash` | char(64) | SHA-256 hex of secret; empty for `none` |
| `redirect_uris` | text not null | JSON array via `common.Marshal` |
| `scopes` | varchar(255) not null | canonical space-joined allowed scopes |
| `status` | int not null | 1 enabled, 2 disabled (int, not bool) |
| `created_at` / `updated_at` | bigint | |

Client secret: `pcs_` + base64url(32 random bytes) (URL-safe, no `:`). Stored as unkeyed SHA-256 (256-bit random secret → fast hash acceptable; independent of `SessionSecret` rotation). Compared in constant time.

### `partner_oauth_bindings`
| Field | Type | Notes |
|---|---|---|
| `id` | int64 PK | |
| `binding_id` | varchar(64) unique | `bnd_` + 32 hex |
| `client_id` | varchar(64) index | |
| `user_id` | int index | |
| `user_auth_version` | bigint | snapshot at consent |
| `scope` | varchar(255) | granted scope (canonical) |
| `status` | varchar(16) | `active` \| `revoked` |
| `token_id` | int default 0 | associated `tokens.id`; 0 = not yet issued |
| `authorization_flow_id` | int64 index | `auth_flows.id` of the code, for replay revocation |
| `expires_at` | bigint | grant absolute deadline = issued + 30d |
| `created_at`, `revoked_at` (default 0), `revoked_reason` varchar(64) | | |

### `partner_oauth_tokens`
| Field | Type | Notes |
|---|---|---|
| `id` | int64 PK | |
| `token_hash` | char(64) unique | SHA-256 hex of raw token |
| `kind` | varchar(16) | `access` \| `refresh` |
| `binding_id` | varchar(64) index | |
| `status` | varchar(16) | `active` \| `rotated` \| `revoked` |
| `expires_at` | bigint index | |
| `created_at` | bigint | |

Raw formats: AT `oa_` + base64url(32B), RT `or_` + base64url(32B). Opaque; never accepted by dashboard/relay auth (lookups there fail naturally: no JWT shape, not in `tokens`).

Why opaque DB tokens instead of JWT: instant revocation and per-request live checks are required anyway (binding/user/client state); traffic on these endpoints is low.

### Short-lived flows (reuse `auth_flows`)
- `partner_oauth_request` (≤32 chars): pending consent, 10 min, `Provider=client_id`, payload `{client_id, redirect_uri, scope, state, code_challenge}`.
- `partner_oauth_code`: authorization code, **120 s**, `Provider=client_id`, `UserId`, payload `{redirect_uri, code_challenge, scope, user_auth_version}`.
- Raw values are AuthFlow tokens (base64url 32B, HMAC-stored by existing model).

## 3. Issuer / host
- `service.PartnerOAuthIssuer()` = `common.CustomDomainMainOrigin` when custom domains are enabled, else `system_setting.ServerAddress`; trailing `/` trimmed. Invalid/empty → endpoints return 503 `temporarily_unavailable`.
- Host gate: request `Host` must equal the issuer host (custom-domain mode: `isCustomDomainCallbackRequest`). Otherwise 404. Absolute URLs (iss, base_url) are always built from config, never from request headers.
- `base_url` = issuer + `/v1`.

## 4. Flows

### 4.1 Authorize (`GET /oauth/authorize`)
1. Strict query parse: every known param at most once.
2. Resolve `client_id` → enabled client; resolve `redirect_uri` against registered list (exact string match; for `none` clients, registered loopback `http://127.0.0.1/...` / `http://[::1]/...` matches any port with identical scheme/host/path/query). Failure → HTML 400 page (no redirect), `Referrer-Policy: no-referrer`, no-store.
3. Other validation errors redirect to callback with `error`, `state` (only if syntactically valid), `iss`: `unsupported_response_type`, `invalid_request` (state/challenge/method), `invalid_scope` (unknown/duplicate/not allowed for client/empty).
4. Create `partner_oauth_request` flow (payload also holds the browser-binding nonce hash, §5.1), set the binding cookie → `303 /partner-authorize?request=<token>` with `Referrer-Policy: no-referrer`.

### 4.2 Consent (browser API, `UserAuth()` + `GetBrowserSessionAuthIdentity`)
- Both endpoints require the browser-binding cookie (§5.1) and `CriticalRateLimit`.
- `GET /api/partner-oauth/authorization?request=` → `{client_name, client_id, scopes[], redirect_host, grant_expires_at, active_binding_limit_reached}` (flow not consumed).
- `POST /api/partner-oauth/authorization/decision {request, decision: approve|deny}` → consume request flow; re-check client enabled, redirect still registered, binding cap (§5.6); approve: create `partner_oauth_code` with the browser user; return `{redirect_to}` built by appending `code|error`, `state`, `iss` to existing query; clear the cookie; audit.
- Frontend: frame guard, navigates with `referrerPolicy=no-referrer`; shows the information listed in §5.2.

### 4.3 Token (`POST /oauth/token`)
- Form-only (`application/x-www-form-urlencoded`, optional `charset=utf-8`), 16 KiB limit, no URL query, UTF-8, each param at most once; unknown params ignored (RFC 6749 §3.2).
- Client auth:
  - Basic header present → parse (`url.QueryUnescape` both parts), client must be `client_secret_basic`, constant-time secret check; failure → 401 `invalid_client` + `WWW-Authenticate: Basic realm="oauth"`. `client_secret` in form → `invalid_request`. Form `client_id`, if present, must equal Basic id.
  - No Basic → form `client_id` required; client must be `none`; `client_secret` in form → `invalid_client`. Unknown/disabled → 400 `invalid_client`. A `client_secret_basic` client without Basic → 401 `invalid_client`.
- `authorization_code`: consume code flow (purpose + Provider=client_id) in one transaction; validation failures (redirect mismatch, PKCE) still **commit the consumption** and return `invalid_grant`. On success, inside the same tx: lock user row (`lockForUpdate`), require enabled + same auth version, create binding + AT (+RT if `offline_access`). Replay (`ErrAuthFlowConsumed`) → revoke binding whose `authorization_flow_id` matches, return `invalid_grant`.
- `refresh_token`: tx: find RT by hash; lock binding; checks in order → wrong client / unknown / expired / revoked / binding inactive or expired / user disabled or auth version changed → `invalid_grant`. Status `rotated` (or CAS `active→rotated` affects 0 rows) → **replay**: revoke binding + disable key in a separate committed tx, return `invalid_grant`. Success: CAS rotate, insert new AT/RT. Optional `scope` param must be a subset of the granted scope; response scope stays the granted scope (no narrowing persisted).
- AT TTL = `min(3600, binding.expires_at-now)`; RT expires at binding deadline.
- Response headers: `Cache-Control: no-store`, `Pragma: no-cache`, `X-Request-Id`.

### 4.4 Revoke (`POST /oauth/revoke`)
- Same form parsing and client auth. Lookup token hash (hint ignored for lookup order). If token belongs to a binding of the authenticated client and binding active → revoke binding (all tokens `revoked`, binding `revoked`, key disabled). Every other case → empty 200.

### 4.5 Integration API (`middleware.PartnerOAuthBearer(requiredScope)`)
- No `Authorization` → 401 empty body + `WWW-Authenticate: Bearer realm="integration"`.
- Validate AT: active, `kind=access`, not expired; binding active and not expired; client enabled; user exists with same auth version → else 401 `invalid_token` + `Bearer realm="integration", error="invalid_token"`.
- Scope missing → 403 `insufficient_scope` + `error="insufficient_scope", scope="<required>"`.
- User disabled → 403 `account_disabled`.
- Body: `{"error":{"code","message"},"request_id"}`; no-store + `X-Request-Id`.
- `GET /account`: any query → 400. Response per protocol; `account_id = "acct_" + user.Id`; `display_name` = DisplayName or Username.
- `POST /credential`: query present → 400; media type not `application/json` → 415; body (≤1 KiB) must decode to a JSON object with zero members → else 400. Tx: lock binding; if `token_id == 0` create key (name `"<client name>"` truncated to 50 runes, unlimited quota, no model limits, `ExpiredTime = binding.expires_at`, group `auto` iff `setting.DefaultUseAutoGroup`, bypasses `MaxUserTokens`), save `token_id`. Else load token `Unscoped` by id+user: deleted → 404 `credential_not_found`; status disabled → 403 `credential_disabled`; status expired or `ExpiredTime` passed → 403 `credential_expired`. Response `expires_at = min(token expiry, binding expiry)`, `key_id = "key_" + token.Id`, `api_key = "sk-" + key`.

### 4.6 Binding revocation (single model function)
`RevokePartnerOAuthBindingWithTx(tx, bindingID, reason)`: lock binding; if active → status revoked + revoked_at/reason; tokens of binding → `revoked`; if `token_id>0` → `invalidateTokenCacheForMutation(key)` then set token status disabled. Idempotent. Used by revoke endpoint, RT replay, code replay, admin client delete, and user "取消授权".

### 4.7 Admin API (`AdminAuth()` + `RequirePermission`, standard `{success,data}` envelope)

Authz resource `partner_oauth_client` (registered like `resources_channel.go`; reuses the `ActionRead` / `ActionOperate` / `ActionSensitiveWrite` constants). Built-in role policies are reseeded from the registry at master startup, so no migration is needed. Root is a superuser and passes every check.

| Action | Default roles | Endpoints | Step-up |
|---|---|---|---|
| `read` | admin | `GET /api/partner-oauth/clients` | no |
| `operate` | admin | `POST /api/partner-oauth/clients/:id/status` (`{"status": 1\|2}`) | no |
| `sensitive_write` | none (Root grants per user) | `POST /api/partner-oauth/clients`, `PUT /:id`, `POST /:id/secret`, `DELETE /:id` | yes |

- `GET` → list without any secret material.
- `POST` → returns client + `client_secret` (basic only) once.
- `PUT /:id` (name, redirect_uris, scopes; status is not editable here).
- `POST /:id/secret` (rotate; basic only; old secret invalid immediately).
- `DELETE /:id` → revoke all its active bindings (disables their keys), then delete the client row.
- Step-up: new verification scope `partner_oauth.client.sensitive_write` in `service/security_verification.go` with strict context `{"action":"create"}` or `{"action":"update"|"rotate_secret"|"delete","client_id":"pc_…"}` (normalized in `BindVerificationOperation`, exactly the listed fields). Controllers call `middleware.RequireSecurityProof` with the context derived from the route and handler, never from client-supplied context. A proof is single-use and bound to the action + client. Enrolled 2FA/Passkey are preferred; if neither is enrolled, password (or OAuth) is the fallback so admins without 2FA are not locked out (PRD D5a). The frontend reuses the existing secure-verification dialog and sends `X-Security-Proof`.
- Order inside sensitive handlers: permission (middleware) → body validation → security proof (consumed only for a valid request) → DB write.
- Validation: name 1–64 runes; 1–10 redirect URIs, each ≤ 512 chars, absolute, no fragment/userinfo, `https` (any client) or loopback `http://127.0.0.1` / `http://[::1]` (only `none`); scopes non-empty subset of the three.
- Scope/redirect edits do not alter existing bindings (documented).

### 4.7a User-facing authorized apps (ASVS 10.4.9 / 10.7.3)
- Routes under the existing `selfRoute` (`/api/user/` group with `DisableCache()` + `UserAuth()`, `router/api-router.go:99`):
  - `GET /api/user/partner-oauth/bindings` → `{success, data: [{binding_id, client_id, client_name, scopes[], created_at, expires_at, key: {id, name, status} | null}]}` — active and unexpired bindings of the caller only, newest first, max 100 (the per-client cap keeps this small). Client name resolved at read time; a deleted client cannot have active bindings.
  - `DELETE /api/user/partner-oauth/bindings/:binding_id` → `requireBrowserSession(c)` (PAT/desktop rejected, same as `DeleteLoginSession`); revoke only when `binding.user_id == caller` and active → `RevokePartnerOAuthBindingWithTx(reason "user_revoked")`; otherwise 404 `PARTNER_OAUTH_BINDING_NOT_FOUND`. `CriticalRateLimit`. Audit `partner_oauth.binding.revoke`.
- Frontend: `web/src/features/security/components/authorized-apps-card.tsx` placed after `LoginSessionsCard` in `features/security/index.tsx`, following `login-sessions-card.tsx` / `login-session-item.tsx` structure; API functions in `features/security/api.ts`; revoke uses the existing `ConfirmDialog`; empty state when no bindings; query invalidated after revoke.

### 4.8 Rate limiting
`middleware.PartnerOAuthRateLimit(mark, max, windowSeconds, style)` per client IP; Redis fixed-window when enabled, otherwise in-memory limiter. 429 + `Retry-After`; style `oauth` → `{"error":"rate_limited","error_description":...}`, style `integration` → `{"error":{"code":"rate_limited",...},"request_id"}`. Defaults: authorize 30/60s, token+revoke 60/60s, integration 120/60s, browser consent API reuses `CriticalRateLimit`.

### 4.9 Cleanup
Extend `service/auth_cleanup.go`: delete `partner_oauth_tokens` with `expires_at < now-24h`. Bindings are kept (audit, small volume).

## 5. Security controls (target ASVS 5.0 L2; full table in `research/security-threat-model.md`)

### 5.1 Browser-bound consent request (T14)
- `/oauth/authorize` generates a 32-byte nonce, stores its SHA-256 in the `partner_oauth_request` flow payload, and sets cookie `partner_oauth_rq=<nonce>`; `HttpOnly; Secure` (omitted only when the issuer is plain `http` for local dev); `SameSite=Lax`; `Path=/api/partner-oauth`; `Max-Age=600`.
- `GET /api/partner-oauth/authorization` and `POST …/decision` require that cookie and compare its hash in constant time. Missing/mismatch → `access_denied`-style browser error "请从第三方应用重新发起授权". Decision clears the cookie.
- SameSite=Lax still sends the cookie on the top-level 303 navigation and on same-origin XHR from the SPA.

### 5.2 Consent page hardening (T15–T17)
- `router/web-router.go`: explicit `GET /partner-authorize` serving the SPA index with `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`. JS frame guard as defense in depth.
- Consent shows: client name, redirect host, each scope in plain language, grant lifetime (expiry date = now + 30 days), and a prominent notice that an API key able to spend the account balance (unlimited quota) will be issued and can be disabled in the token list. Every request needs explicit approval (no remembered consent).
- Logger: strip the query for `/partner-authorize`, `/api/partner-oauth/`, and `/sign-in` (its `redirect` can embed the consent URL).

### 5.3 Client authentication hardening (T7)
- Unknown `client_id` with Basic → still run a constant-time compare against a fixed dummy hash, then the same 401 `invalid_client` as a wrong secret.
- Limiters: per IP (all OAuth endpoints) and per `client_id` failed-authentication counter (10 failures / 5 min → 429 `rate_limited` for that client_id on token/revoke).

### 5.4 Bearer handling (T13)
- Integration API accepts the AT only in `Authorization: Bearer`. A request carrying `access_token` in query or body → 400 `invalid_request`.

### 5.5 Audit trail (T20–T21)
- `model.RecordAuditLog` category `security`, actions: `partner_oauth.consent.approve|deny`, `partner_oauth.token.issue`, `partner_oauth.refresh.reuse_detected`, `partner_oauth.binding.revoke` (with reason), `partner_oauth.credential.issue`, `partner_oauth.client.create|update|enable|disable|secret_rotate|delete`. Metadata limited to client_id, binding_id, user id, key id, reason; client admin events also carry the actor user id and role (root/admin) plus the changed field names (not values for secrets; redirect URIs may be recorded). Never codes, tokens, secrets, verifiers, keys.

### 5.6 Grant limits (T22)
- Max 10 active, unexpired bindings per (user, client). Checked under the user row lock at code exchange and pre-checked at consent (clear error before approving).

### 5.7 Step-up verification (T19) — not required
- Approving consent requires a live browser web session but no extra 2FA/passkey step: the same session can already create an unlimited API key in the dashboard without step-up (`AddToken`), so step-up here would not raise the bar. PAT generation (`access_token.generate`) does use step-up, but PATs grant full dashboard control, which partner tokens do not.

### 5.8 Other
- HTML error page: allowlisted translated strings only, escaped, `Content-Security-Policy: default-src 'none'`, `X-Content-Type-Options: nosniff`, no-store, `Referrer-Policy: no-referrer`.
- Admin secret responses: `Cache-Control: no-store`; the UI holds the secret only in component state for the one-time dialog.
- Admin-compromise containment (T20): a stolen admin session by default cannot register a client or change redirect URIs (no `sensitive_write`), and even with that grant it needs a fresh step-up proof per operation. Residual: an admin with `operate` can re-enable a client that Root disabled; this is audited.

### 5.9 Frontend admin entry
- System Settings is Root-only (`routes/_authenticated/system-settings/route.tsx`), so the admin UI is a standalone page under the sidebar "Admin" group.
- Extend the sidebar item type (`components/layout/types.ts`, `hooks/use-sidebar-view.ts`) with an optional `requiredPermission: {resource, action}` checked via `hasPermission()`. Existing `requiredRole` behavior is unchanged.
- Route `beforeLoad`: `role >= ROLE.ADMIN && hasPermission(user, 'partner_oauth_client', 'read')`, else `/403`. Buttons are gated per action. Add `PARTNER_OAUTH_CLIENT` to `ADMIN_PERMISSION_RESOURCES`. The users permission editor renders the catalog generically, so it only needs the label/description i18n keys.
- L3 gaps (documented, not implemented): DPoP/mTLS, PAR/JAR, asymmetric client auth.

## 5a. Security test additions
- Consent: missing/mismatched binding cookie → rejected; cookie flags; framed response headers on `/partner-authorize`; log lines for `/partner-authorize?request=…` and `/sign-in?redirect=…` contain no query.
- Client auth: unknown id and wrong secret give identical status/body/header; per-client_id failure limiter trips.
- Bearer in query/body rejected; binding cap (11th consent rejected); audit rows written without secrets.
- User revoke: own binding revoked (AT 401, RT `invalid_grant`, key disabled); foreign/unknown → 404; PAT caller rejected; list excludes revoked/expired and other users' bindings.
- Admin authz matrix: common user → 403 on all; default admin → list + status OK, create/update/rotate/delete 403; admin with `sensitive_write` override → OK with proof; admin with `read` denied → 403 on list; Root → all OK with proof. Proof cases: missing, expired, reused, issued for another client_id or action → rejected and nothing written; invalid body does not consume the proof.
- Frontend: sidebar hides the entry without `read`; route redirects to 403; buttons hidden without the matching action.

## 6. Compatibility / rollout / rollback
- Additive only: three new tables, new routes, new admin page, one new authz resource and one verification scope. No existing table altered. Feature is inert until Root (or an admin granted `sensitive_write`) registers a client.
- Rollback: revert the commits; leftover tables are harmless. Issued keys remain normal user tokens.
- Production single instance; no in-process state beyond the in-memory rate limiter fallback.

## 7. Trade-offs
- Not reusing `codex/client_auth`: its contract forbids key issuance and it is 344 commits behind main.
- Auth-version change (password reset) makes bindings unusable lazily (invalid_token / invalid_grant) without disabling the key; key lifecycle stays under user control in the token list.
- `account_id = acct_<user id>`: stable and never reassigned (users are soft-deleted); exposes the numeric ID to the partner, acceptable for an authorized partner.
