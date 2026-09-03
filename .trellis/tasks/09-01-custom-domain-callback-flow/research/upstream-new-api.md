# Upstream New API callback research

Research date: 2026-09-01

## Evidence boundary

- This file records the original 2026-09-01 upstream/external research and is no longer the implementation authority.
- The repository now available locally has been inspected at commit `d68bc3adb5e6766ebd1bd3bf610d8e8b2452a8db`; use `research/local-baseline.md` for implementation anchors.
- Production image, reverse-proxy, DNS/TLS and runtime configuration remain unverified; neither the local fork nor upstream `main` proves deployed behavior.

## OAuth findings

- Upstream New API creates one-time OAuth `flow_token` records in `auth_flows`, with a 10-minute TTL, provider/intent binding, and atomic consumption. The stored OAuth payload currently includes the affiliate code but not the initiating host. Source: [controller/oauth.go](https://github.com/QuantumNous/new-api/blob/main/controller/oauth.go), especially `GenerateOAuthCode` and `HandleOAuth`.
- Upstream GitHub token exchange sends `client_id`, `client_secret`, and `code`, but does not currently send `redirect_uri` during token exchange. Source: [oauth/github.go](https://github.com/QuantumNous/new-api/blob/main/oauth/github.go).
- Upstream Linux Do token exchange reconstructs `redirect_uri` from the callback request's TLS state and `Request.Host`, using `https://<callback-host>/api/oauth/linuxdo`. This makes the actual callback host part of the OAuth contract. Source: [oauth/linuxdo.go](https://github.com/QuantumNous/new-api/blob/main/oauth/linuxdo.go).
- GitHub documents that OAuth redirect URLs are constrained by the registered callback URL. GitHub introduced configurable wildcard matching in 2026 but warns that wildcard subdomain/path matching increases the risk of authorization-code leakage. A central fixed callback avoids relying on wildcard behavior. Sources: [Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) and [GitHub OAuth app best practices](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app).
- Password and OAuth registration currently call `GetUserIdByAffCode` and ignore its returned error. The resolver selects only the matching user ID, with GORM's normal soft-delete filter but no user-status predicate. Therefore a missing explicit code yields inviter ID `0` without a registration error, while a status-disabled but non-deleted user's code still resolves. Source: [model/user.go](https://github.com/QuantumNous/new-api/blob/main/model/user.go), `GetUserIdByAffCode`, plus the callers in `controller/user.go` and `controller/oauth.go`.

## Payment findings

- Upstream ePay creates a stable server-to-server notification URL from `service.GetCallbackAddress()` while its browser `return_url` comes from `paymentReturnPath(...)`. Source: [controller/topup.go](https://github.com/QuantumNous/new-api/blob/main/controller/topup.go), `RequestEpay`.
- Upstream Stripe accepts optional `success_url` and `cancel_url`, but only after `common.ValidateRedirectURL` accepts them. Actual crediting is performed by a signed Stripe webhook using the order reference, independently of the browser return. Source: [controller/topup_stripe.go](https://github.com/QuantumNous/new-api/blob/main/controller/topup_stripe.go).
- Upstream payment completion already uses order-level state/provider checks and idempotency-oriented status transitions. The custom-domain design should preserve server-to-server callbacks as canonical and treat browser returns only as navigation/UX.

## Planning implications

- Recommended baseline: one fixed callback origin for OAuth and payment webhooks, plus a server-side, one-time, allowlisted return-context record that remembers the initiating tenant domain.
- OAuth state should carry or reference the initiating tenant/domain; after exchanging the code and establishing login, the callback performs a short-lived handoff to that domain. It must not accept arbitrary return URLs.
- Payment orders should persist the initiating tenant/domain. Payment providers call a fixed webhook origin; the browser success/cancel return is generated from the persisted, validated tenant domain and is not authoritative for crediting money.
- Direct provider callbacks to arbitrary `*.yeschoy.io` hosts are possible only if every provider supports the exact required redirect policy. It is operationally fragile and, for GitHub wildcard matching, has a documented security trade-off.

## Zero-New-API-patch feasibility

- Wildcard DNS/TLS plus a reverse proxy is sufficient to keep normal page/API navigation on `a.yeschoy.io`, provided the proxy preserves the external host and scheme and New API does not issue a canonical-host redirect.
- Pure DNS/Nginx configuration is not sufficient to guarantee invitation ownership. New API accepts affiliate data in password registration requests and OAuth state creation; a client can alter those values unless an application-aware boundary replaces them from a trusted `host -> owner/affiliate` mapping.
- A standalone domain gateway in front of stock New API can enforce that boundary without maintaining a New API fork. It can validate the host, replace affiliate fields for registration/OAuth state requests, remember `OAuth state -> origin host`, and remember payment-order/session return context.
- Upstream GitHub and Linux Do authorization URL builders omit `redirect_uri`, so the provider uses its configured callback. A fixed callback origin can therefore be used. The gateway must relay the resulting code/state back through the originating host in a way that preserves New API's same-origin browser session behavior. Linux Do additionally requires the token-exchange `redirect_uri` reconstructed by New API to match the fixed registered callback host.
- Stripe already accepts caller-provided success/cancel URLs subject to New API's trusted-redirect validation. A gateway can replace these fields with the validated current origin, but the deployed version's trusted-domain rules must be verified.
- ePay uses a fixed server callback plus a browser return path. A gateway can keep the notification fixed and route the browser return by recording the order number returned from the create-payment response, without changing the authoritative crediting path.
- Result: zero New API source changes appears feasible with a small stateful gateway/sidecar; zero New API changes with only static reverse-proxy directives is best-effort and cannot meet the anti-tampering acceptance criteria.

## Passkey findings

- Upstream calls `passkeysvc.BuildWebAuthn(c.Request)` for registration, login and step-up verification. If Passkey `Origins`/`RPID` settings are absent, the service derives the exact Origin and RP ID from the current request host. Sources: [controller/passkey.go](https://github.com/QuantumNous/new-api/blob/main/controller/passkey.go) and [service/passkey/service.go](https://github.com/QuantumNous/new-api/blob/main/service/passkey/service.go).
- The upstream controller uses `GetPasskeyByUserID` / `UpsertPasskeyCredentialWithAuthVersion`, indicating one current Passkey credential record per user in this flow. Registering independently under `yeschoy.com` and `a.yeschoy.io` would therefore require a data-model/controller expansion or could replace the existing credential.
- WebAuthn credentials are scoped to an RP ID. A credential for RP ID `yeschoy.com` cannot normally be requested directly by an unrelated `*.yeschoy.io` origin. The W3C WebAuthn Level 3 Related Origin Requests mechanism can authorize explicitly listed cross-site origins through `https://<rp-id>/.well-known/webauthn`, but client support must be feature-detected and the list contains exact origins rather than a wildcard. Sources: [W3C WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/) and [passkeys.dev Related Origin Requests](https://passkeys.dev/docs/advanced/related-origins/).
- The most compatible architecture is a central Passkey ceremony origin under the existing RP ID, e.g. `auth.yeschoy.com` with RP ID `yeschoy.com`, followed by the same kind of one-time, target-host-bound session handoff used for OAuth. This preserves existing main-site credentials and avoids relying on Related Origin Requests support in every browser.
- Passkey registration/deletion from a custom domain is materially harder than login: upstream requires a live authenticated user/session and, in some cases, a scoped security proof. A cross-domain management flow must transfer authority through a narrowly scoped one-time AuthFlow without copying bearer tokens or weakening the existing proof checks.

## TOTP 2FA findings

- TOTP 2FA is not WebAuthn and has no RP ID/Origin binding. Upstream generates a TOTP secret plus backup codes for the account; setup, enable, disable and backup-code regeneration run as authenticated same-origin API calls. Source: [controller/twofa.go](https://github.com/QuantumNous/new-api/blob/main/controller/twofa.go).
- Password login checks whether 2FA is enabled. If so, it creates a five-minute `AuthFlowPurposeTwoFALogin` containing the user's current auth version; successful TOTP or backup-code verification atomically consumes that flow and creates the login session. Sources: [controller/user.go](https://github.com/QuantumNous/new-api/blob/main/controller/user.go) and [controller/twofa.go](https://github.com/QuantumNous/new-api/blob/main/controller/twofa.go).
- The current 2FA login AuthFlow is bound to purpose, user and auth version but not to the initiating host. With several equivalent frontend hosts, custom-domain consistency requires adding the validated initiating host to the flow payload and requiring the finish request to use that same active host (or the documented main-site fallback).
- Upstream OAuth login currently calls `setupLogin` after finding the OAuth user and does not perform the password login controller's `IsTwoFAEnabled` branch. Therefore GitHub/Linux Do login does not appear to request TOTP even when the account has 2FA enabled. This is existing authentication semantics, not a custom-domain regression, but it must be an explicit product decision.
- Enabling/disabling 2FA and regenerating backup codes advances the account auth version. That account-wide security change can intentionally invalidate or rotate sessions across otherwise independent browser domains; this should remain a security invariant rather than be weakened for domain independence.

## Frontend session bootstrap findings

- Upstream `web/src/routes/__root.tsx` calls `bootstrapAuthentication()` in the root route `beforeLoad`, before normal route rendering. Source: [web/src/routes/__root.tsx](https://github.com/QuantumNous/new-api/blob/main/web/src/routes/__root.tsx).
- `bootstrapAuthentication()` calls the same-origin `/api/user/auth/refresh` with `withCredentials: true` when no valid in-memory AuthBundle exists; a successful response is parsed and applied to the Zustand auth store. Source: [web/src/lib/auth-session.ts](https://github.com/QuantumNous/new-api/blob/main/web/src/lib/auth-session.ts).
- Therefore a Host-only Refresh Cookie written by an A-origin handoff response is sufficient for a later full-page reload to restore the Access Token. The selected minimal-coupling design uses that existing root bootstrap as the normal path after a no-store bridge page sets the cookie; returning an AuthBundle directly remains a possible optimization but is not required.
