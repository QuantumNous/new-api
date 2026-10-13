# Security review: Partner OAuth (planning stage)

References read 2026-10-10:
- OWASP ASVS 5.0 V10 "OAuth and OIDC" (raw: OWASP/ASVS master `5.0/en/0x19-V10-OAuth-and-OIDC.md`)
- OWASP OAuth 2.0 Protocol Cheat Sheet
- RFC 6749, 6750, 7009, 7636, 8252, 9207, 9700 (as cited by the protocol)

Target level: **ASVS L2** (the feature delivers spendable credentials to third parties). L3 gaps are listed explicitly.

## 1. Assets
1. User wallet balance (the issued API key has unlimited quota → direct financial impact).
2. Partner OAuth access/refresh tokens (access the issued key via `/credential`).
3. Client secrets (impersonate a confidential partner).
4. Authorization codes and pending consent requests.
5. Admin control over client registrations.

## 2. Threats and controls

| # | Threat | Control | Ref |
|---|---|---|---|
| T1 | Open redirect / code exfiltration via unregistered redirect | Exact string match against per-client allowlist; loopback port exception only for `none` clients; invalid client/redirect never redirects | ASVS 10.4.1; CS #1, #19 |
| T2 | Code interception / injection | PKCE S256 mandatory for all clients, `plain` rejected, verifier validated; code bound to client+redirect+challenge+user | ASVS 10.4.6; CS #6–9 |
| T3 | Code replay | Single use; replay revokes binding (and its key) created from that code; failed PKCE/redirect still consumes the code | ASVS 10.4.2 |
| T4 | Long-lived code | 120 s TTL | ASVS 10.4.3 |
| T5 | Mix-up attack | `iss` on every authorization response | RFC 9207; ASVS 10.2.2 (client side) |
| T6 | Refresh token theft (public clients) | Strict rotation, zero grace; reuse revokes whole binding + key; RT only with `offline_access`; absolute 30-day expiry | ASVS 10.4.5, 10.4.8; RFC 9700 §4.14 |
| T7 | Confidential client impersonation / secret brute force | `client_secret_basic` mandatory for confidential clients on token **and** revoke; 256-bit secrets; constant-time compare incl. dummy compare for unknown client; uniform `invalid_client` for unknown id vs wrong secret; IP limiter **plus per-client_id failure limiter** | ASVS 10.4.10; CS #17 |
| T8 | Grant-type abuse | Only `authorization_code` and `refresh_token`; implicit/password never supported | ASVS 10.4.4 |
| T9 | Over-broad scopes | Client-specific scope allowlist set by holders of `sensitive_write`; request must be subset | ASVS 10.4.11 |
| T10 | Access token used elsewhere (audience) | Opaque tokens in a dedicated table, accepted only by `/api/integrations/v1/*`; dashboard/relay lookups cannot match them | ASVS 10.3.1; CS #14 |
| T11 | Scope bypass at resource server | Per-endpoint required scope checked every request from the stored binding | ASVS 10.3.2 |
| T12 | User identity reassignment | `account_id = acct_<user id>` (users are soft-deleted, ids never reused); `{issuer, account_id}` | ASVS 10.3.3 |
| T13 | Bearer token in URL/logs | Bearer accepted only in `Authorization` header; `access_token` query/form parameter rejected (`invalid_request`); logs strip OAuth queries; bodies/headers never logged | RFC 6750 §2.3, §5.3 |
| T14 | **Consent request forwarding** (attacker sends victim a `/partner-authorize?request=` link created by the attacker; or a leaked request token is approved by another browser) | **Bind the pending request to the initiating browser**: `/oauth/authorize` sets a random nonce in an `HttpOnly; Secure; SameSite=Lax; Path=/api/partner-oauth` cookie and stores its hash in the flow; inspect/decision require the matching cookie. The client's `state` + PKCE remain the second layer | ASVS 10.1.2 (AS-side analogue); CS #2 |
| T15 | Clickjacking of the consent page | Dedicated web route `/partner-authorize` served with `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`; JS frame guard as defense in depth | ASVS V3 (frame protection) |
| T16 | Request token leakage via Referer / logs / sign-in redirect | `Referrer-Policy: no-referrer` on authorize responses and consent route; logger strips query for `/partner-authorize`, `/api/partner-oauth/`, and `/sign-in` when its `redirect` targets `/partner-authorize`; 10-min TTL; T14 cookie makes a leaked token useless | oauth-client-pkce spec precedent |
| T17 | Uninformed consent | Consent page shows client name, redirect host, each scope in plain language, **the 30-day lifetime**, and that an **API key able to spend the user's balance (unlimited quota)** will be issued; every request requires explicit consent (no auto-approve) | ASVS 10.7.1, 10.7.2 |
| T18 | User cannot see or revoke grants | In scope (decided 2026-10-13): “已授权应用” card on `/security` lists active bindings and revokes them (browser session required; ownership enforced; same revocation function as `/oauth/revoke`). Scope modification is not offered (ASVS 10.7.3 “modify” partially met: user can revoke and re-authorize) | ASVS 10.4.9, 10.7.3 (L2) |
| T19 | Session hijack used to approve a grant | Approve requires a live browser web session (not PAT/desktop). Step-up is **not** required: an attacker with the same session can already create an unlimited API key in the dashboard without step-up, so step-up on consent adds friction without raising the bar. Revisit if dashboard key creation gains step-up | AGENTS.md §6.2 (no weaker alternate path) |
| T20 | Admin compromise / misconfiguration (rogue client with attacker redirect URI harvests users' unlimited keys; mass revoke via delete) | Casbin resource `partner_oauth_client`: admin default only `read` + `operate`; `sensitive_write` (create/update/rotate/delete) granted per user by Root; every sensitive operation needs a single-use step-up proof bound to action + client_id; `client_secret` returned once with `no-store`; audit log with actor id/role for create/update/enable/disable/rotate/delete. Residual: `operate` can re-enable a client Root disabled (audited) | ASVS V8 (8.2.x), 6.x step-up, V16 |
| T21 | Missing security event trail | Audit (`model.RecordAuditLog`, category `security`) for: consent approve/deny, code exchange, refresh reuse detected, revoke, credential first issuance, binding revoked by client delete, client admin changes. Never record codes, tokens, secrets, keys, verifiers | ASVS V16; AGENTS.md §6.2 |
| T22 | Key sprawl / DoS via many grants | Cap **10 active bindings per (user, client)**; the 11th consent is rejected with a clear message. Rate limits on all endpoints | ASVS V2 business logic limits |
| T23 | Host header poisoning | Issuer, `iss`, `base_url` from configuration only; endpoints only on main host | oauth-client-pkce spec precedent |
| T24 | Error page injection | HTML page renders only allowlisted translated strings, escaped; `Content-Security-Policy: default-src 'none'`, `X-Content-Type-Options: nosniff`, no-store | ASVS V3 |
| T25 | Stale grant after account changes | Password reset / auth-version change invalidates OAuth tokens; disabled or deleted user → 401/403 at resource server and `invalid_grant` at refresh | ASVS V7 session invalidation |
| T26 | Compromised partner abuses the key | Protocol-mandated unlimited key; mitigations: user can disable/delete key, revoke grant (needs T18), admin can disable/delete client (revokes all grants + keys) | Residual risk |

## 3. Explicitly out of scope / L3 gaps
- Sender-constrained tokens (DPoP/mTLS) — ASVS 10.3.5, 10.4.14 (L3).
- PAR / JAR, `response_mode` restriction — ASVS 10.4.12, 10.4.13, 10.4.15 (L3).
- Asymmetric client authentication (`private_key_jwt`/mTLS) — ASVS 10.4.16 (L3); protocol fixes `client_secret_basic`.
- Client secret stored as unkeyed SHA-256: acceptable for 256-bit random secrets (not passwords).

## 4. Decisions
- T18 resolved: minimal "已授权应用" list + revoke is in scope.
- T19 resolved: no step-up on consent (parity with dashboard API key creation).
