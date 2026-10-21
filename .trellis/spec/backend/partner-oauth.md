# Partner OAuth

## 1. Scope / Trigger

Read this spec before changing Partner OAuth clients, bindings, tokens,
`/oauth/authorize|token|revoke`, `/api/integrations/v1/*`,
`/api/partner-oauth/*`, `/api/partner-oauth/clients/*`,
`/api/user/partner-oauth/bindings`, `/api/user/{id}/partner-oauth/bindings`,
or the `/partner-authorize` consent page.

YesChoy is the OAuth 2.0 authorization server and resource server for
third-party AI assistants (relay_partner_api v0.2). The issued model API key
is a dedicated unlimited-quota token used only for `/v1/models` and
`/v1/chat/completions`.

## 2. Signatures

Protocol (register on the engine, not the `/api` GlobalAPIRateLimit group):

```text
GET  /oauth/authorize
POST /oauth/token
POST /oauth/revoke
GET  /api/integrations/v1/account
POST /api/integrations/v1/credential
```

Browser consent:

```text
GET  /partner-authorize?request=
GET  /api/partner-oauth/authorization?request=
POST /api/partner-oauth/authorization/decision
     {"request":"...","decision":"approve|deny"}
```

User bindings:

```text
GET    /api/user/partner-oauth/bindings
DELETE /api/user/partner-oauth/bindings/{binding_id}
```

Admin user bindings (`AdminAuth`, same role gate as other user admin actions):

```text
GET    /api/user/{id}/partner-oauth/bindings
DELETE /api/user/{id}/partner-oauth/bindings/{binding_id}
```

Admin (`AdminAuth` + Casbin `partner_oauth_client`):

```text
GET    /api/partner-oauth/authorization-logs  (read)
GET    /api/partner-oauth/clients
POST   /api/partner-oauth/clients
PUT    /api/partner-oauth/clients/{id}
POST   /api/partner-oauth/clients/{id}/secret
POST   /api/partner-oauth/clients/{id}/status
DELETE /api/partner-oauth/clients/{id}
```

## 3. Contracts

- Clients: `client_secret_basic` or `none`; PKCE S256 required; secrets shown once.
- Redirects: exact match; loopback port exception only for `none` clients. `/oauth/authorize` never redirects an error to a `redirect_uri` that was not first matched against the enabled client (repeated parameters and unsupported `response_type` included); those cases render the HTML error page.
- Scopes: `account:read credential:read offline_access`. No `id_token`.
- Issuer: `CustomDomainMainOrigin` when custom domains are enabled, else `ServerAddress`.
- Host gate: callback/main origin only. `iss` and `base_url` come from config.
- Consent cookie `partner_oauth_rq`: HttpOnly, Secure (omit only for plain HTTP issuer), SameSite=Lax, Path=/api/partner-oauth, Max-Age=600.
- Consent path is `/partner-authorize` (not `/oauth/...`). Frame-deny + no-referrer.
- One dedicated unlimited API key per binding; bypass `MaxUserTokens`.
- Credential issuance re-checks, under the binding row lock, that the binding is still active and unexpired; a binding revoked after the caller authenticated never gets a new key (`invalid_token`).
- Cap 10 active bindings per (user, client).
- Consent decision: a rejected approval (binding limit, disabled account) keeps the request and `partner_oauth_rq` cookie so the user can retry; the cookie is cleared only after a successful decision. Non-OAuth errors return a generic 500 and a request-ID server log, never the raw error text.
- Refresh tokens rotate with zero grace; replay revokes the binding and key.
- Auth-version change invalidates OAuth tokens but does not disable the key.
- Client scope/redirect edits affect future grants only. Disable blocks tokens. Delete revokes bindings and keys.
- Authz: `read` + `operate` default admin; `sensitive_write` has no default and requires step-up `partner_oauth.client.sensitive_write` (2FA/Passkey if enrolled, otherwise password/OAuth).
- An admin can list and revoke a lower-role user's active partner bindings. Root can manage any user. Revoke uses the same binding path as the user, stores reason `admin_revoked`, and disables the dedicated key. The audit records the admin actor and binding id, not the key.
- OAuth consent approve/deny, code exchange and replay revocation, refresh replay revocation, token/user/admin/client-delete binding revocations, and first credential issuance write **only** to `partner_oauth_authorization_logs` in `LOG_DB`. Ordinary account/model API calls, successful refresh, and repeat credential reads do not write there. Client configuration actions continue in generic `audit_logs`; historical generic rows are neither deleted nor backfilled.
- Authorization logs contain only event/request IDs, timestamp, action/result, allowlisted reason, actor and target user IDs, generated client/binding IDs, IP, route template and status. Never store passwords, codes, state, tokens, secrets, verifiers, keys, raw URLs/query, bodies, or cookies. Failed log writes emit a non-sensitive server error with request ID without changing an already committed OAuth response. Successful token/revoke audit metadata comes from the committed operation (not a post-commit binding query); replay revocation lookup/write failures return a generic server error and emit a safe server log rather than pretending the grant was safely revoked; a token or binding already deleted at replay time still returns `invalid_grant` (nothing left to revoke). Admin binding revocation records every outcome, including rejected attempts (no permission, unknown user, missing binding, DB error), with `success=false` and the response status.
- `GET /api/partner-oauth/authorization-logs` requires AdminAuth and `partner_oauth_client.read`; it validates bounded page/page_size, action, result, client ID, target user and time range, returns descending `{items,total}`, and never exposes all-user logs to normal users.
- The dedicated table migrates on both shared and independent `LOG_DB` paths; relational names respect configured table prefixes. ClickHouse uses an explicit MergeTree without database-enforced event ID uniqueness. Audit records do not share usage-log TTL. Rollback preserves the table and historical records.
- Audit events never contain passwords, codes, tokens, secrets, verifiers, or keys.
- Request ID: send `X-Request-Id` (plus existing `X-Oneapi-Request-Id`).
- Logger strips query for `/api/partner-oauth/`, `/partner-authorize`, and `/sign-in`.

## 4. Intended index rows (do not edit those files in this task)

Leave these rows for a later Trellis/spec-index update. Do **not** edit
`AGENTS.md` or `.trellis/spec/backend/index.md` from this implementation:

- `AGENTS.md` module table: Partner OAuth → `.trellis/spec/backend/partner-oauth.md`
- `.trellis/spec/backend/index.md`: add `partner-oauth.md`

## 5. Tests Required

- model: migrate, binding+tokens, CAS refresh winner, revoke idempotent, concurrent credential, expired cleanup.
- service: RFC 7636, redirect/scope matrix, code replay/PKCE/expiry, RT rotation/replay, auth-version, revoke.
- controller: both client types, Basic failure, form/media/duplicate params, revoke 200, integration 401/400/415, HTML 400, headers.
- frontend: consent states, admin form validation, sidebar/route/button permission gating, authorized-apps card.
