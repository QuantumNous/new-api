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
GET    /api/partner-oauth/clients
POST   /api/partner-oauth/clients
PUT    /api/partner-oauth/clients/{id}
POST   /api/partner-oauth/clients/{id}/secret
POST   /api/partner-oauth/clients/{id}/status
DELETE /api/partner-oauth/clients/{id}
```

## 3. Contracts

- Clients: `client_secret_basic` or `none`; PKCE S256 required; secrets shown once.
- Redirects: exact match; loopback port exception only for `none` clients.
- Scopes: `account:read credential:read offline_access`. No `id_token`.
- Issuer: `CustomDomainMainOrigin` when custom domains are enabled, else `ServerAddress`.
- Host gate: callback/main origin only. `iss` and `base_url` come from config.
- Consent cookie `partner_oauth_rq`: HttpOnly, Secure (omit only for plain HTTP issuer), SameSite=Lax, Path=/api/partner-oauth, Max-Age=600.
- Consent path is `/partner-authorize` (not `/oauth/...`). Frame-deny + no-referrer.
- One dedicated unlimited API key per binding; bypass `MaxUserTokens`.
- Cap 10 active bindings per (user, client).
- Refresh tokens rotate with zero grace; replay revokes the binding and key.
- Auth-version change invalidates OAuth tokens but does not disable the key.
- Client scope/redirect edits affect future grants only. Disable blocks tokens. Delete revokes bindings and keys.
- Authz: `read` + `operate` default admin; `sensitive_write` has no default and requires step-up `partner_oauth.client.sensitive_write` (2FA/Passkey if enrolled, otherwise password/OAuth).
- An admin can list and revoke a lower-role user's active partner bindings. Root can manage any user. Revoke uses the same binding path as the user, stores reason `admin_revoked`, and disables the dedicated key. The audit records the admin actor and binding id, not the key.
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
