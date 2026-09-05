# Local implementation baseline

Inspection date: 2026-09-02

## Authority and boundary

- Repository: `/Users/lyh_god/GolandProjects/newapi-saas`
- Branch at inspection: `feat/custom-domain-callback-flow`
- Commit: `d68bc3adb5e6766ebd1bd3bf610d8e8b2452a8db`
- `main...HEAD`: `0/0` at inspection; no feature implementation existed yet.
- Production image/commit, database, node/Redis topology, reverse proxy, DNS/TLS and third-party dashboard settings were not read and remain deployment gates.

This file is the planning authority for the local implementation. `upstream-new-api.md` remains useful for external/provider background only.

## HTTP and Host routing

- `main.go:178-206` creates one Gin engine, installs global middleware, then calls `router.SetRouter`; there is no Host allowlist.
- `router/main.go:15-38` mounts API, relay, task and web routes into the same engine.
- `router/web-router.go:22-39` serves embedded assets and falls back to the SPA for ordinary unknown paths. Without a new global Host guard, an arbitrary Host reaching the backend can receive the application.
- `middleware/trusted_proxies.go:11-19` and `common/trusted_proxies.go:20-53` configure client-IP proxy trust, but Gin proxy trust does not make `X-Forwarded-Host` a safe customer identity source.

Planning consequence: install one global DomainContext/Host guard before business routes, derive identity only from normalized `Request.Host`, and keep the backend port private.

## OAuth and browser sessions

- `controller/oauth.go:22-29,37-92` stores only affiliate code in the current OAuth payload and creates a 10-minute HMAC-backed `auth_flows` state.
- `model/auth_flow.go:37-50,75-94,96-125,196-225` stores only token HMAC, matches purpose/provider/intent/user/session, and atomically consumes flows.
- `web/src/routes/oauth/$provider.tsx:60-87,189-228` is the real provider callback page. It calls the same-origin `/api/oauth/:provider` API and expects an AuthBundle.
- `controller/oauth.go:190-223` finds/creates the OAuth user and immediately calls `setupLogin` on the callback API Host.
- `controller/user.go:182-233` creates the Session, writes the refresh Cookie and returns the AuthBundle.
- `service/auth_session.go:292-325` writes `new_api_refresh` as Host-only, `HttpOnly`, `SameSite=Strict`, with Path `/api/user/auth`; it never sets a parent Domain.
- `web/src/routes/__root.tsx:113-149` and `web/src/lib/auth-session.ts:363-378` bootstrap a same-origin refresh before normal route rendering, so a custom-origin handoff only needs to establish the Host-only refresh Cookie before reloading `/`.
- `web/src/lib/oauth.ts:40-42,80-82` omits dynamic `redirect_uri` for GitHub and Linux Do authorization.
- `oauth/linuxdo.go:57-70` reconstructs token-exchange `redirect_uri` from the callback request Host, so the fixed callback Host must remain the registered main Host.

Planning consequence: the main callback API must return a distinct handoff action for custom-origin login, not an AuthBundle; the existing callback route then navigates to a fragment-based custom-origin bridge.

## OAuth binding constraint

- `controller/oauth.go:120-137,225-289` currently requires the live user/Session at callback time and writes the provider binding in the same callback request.
- `web/src/routes/oauth/$provider.tsx:119-174` assumes popup and opener have the same origin and exchanges callback/result messages with `window.location.origin`.

With a fixed `yeschoy.com` callback and an `a.yeschoy.io` opener, neither assumption holds. The main callback may assert provider identity, but final binding must return through an A-origin ticket and be authorized by the original A opener's Bearer/Session.

## Session Origin guard

- `middleware/auth_origin.go:18-75` allows exact same-origin when `Request.TLS` proves the scheme, or an exact static `SESSION_COOKIE_TRUSTED_URL`.
- `common/session_cookie.go:44-83` requires a static comma-separated HTTPS allowlist when secure cookies are enabled.
- The guard intentionally ignores client `X-Forwarded-Proto`; behind TLS termination with an HTTP upstream, dynamic custom domains cannot be enumerated statically and the computed request origin is `http://...`.

Planning consequence: only after DomainContext proves an active custom Host, accept exact browser Origin `https://<that-host>` for refresh/logout. Do not add wildcard trusted URLs or trust forwarded scheme headers.

## Registration and attribution

- `controller/user.go:236-305` decodes password registration, reads `User.AffCode`, resolves it with `GetUserIdByAffCode`, and inserts the inviter ID.
- `controller/oauth.go:291-428` separately resolves affiliate code when it creates a new OAuth user; existing users return before attribution logic.
- `model/user.go:507-513` selects only ID by affiliate code. Normal GORM soft-delete filtering applies; there is no status predicate. Callers ignore the lookup error, so a missing explicit code yields inviter `0`.

Planning consequence: share one resolver across password and OAuth creation, preserve explicit-code semantics exactly, and use the active domain owner only when explicit aff is empty.

## Password reset

- `controller/misc.go:304-330` builds every email link from global `system_setting.ServerAddress`.
- `controller/misc.go:332-369` verifies the existing token, resets the password and deletes the token.
- `common/verification.go:21-61` keeps the current 10-minute verification token in process memory. Multi-node durability is an existing limitation outside this task.
- `model/user.go:1125-1149` increments auth version and revokes all Sessions after reset.

Planning consequence: add only a signed, expiring return context and main-host dispatcher; preserve token/reset/revocation semantics and legacy main-host links.

## Wallet top-up returns

- `controller/topup.go:270-349` creates ePay with a server callback from `service.GetCallbackAddress`, a global `ServerAddress` browser return, and then inserts the TopUp.
- `controller/topup.go:394-484` verifies ePay callback parameters and uses `model.RechargeEpay`.
- `model/topup.go:173-233` uses a DB transaction/row lock and treats repeated successful ePay callbacks idempotently.
- `controller/topup_stripe.go:72-142` validates optional client success/cancel URLs, creates a Checkout Session and inserts the TopUp; `controller/topup_stripe.go:358-402` defaults them to global return paths.
- `controller/topup_stripe.go:164-306` verifies Stripe webhook signatures and credits through the stored reference.
- `model/topup.go:14-25` has no origin field; `controller/return_path.go:9-12` always uses global `ServerAddress`.

Planning consequence: persist canonical DomainContext Host in wallet TopUp only; keep notify/webhook on the main Host, make custom-origin browser returns server-generated, and never use browser return as the sole credit signal.

## 2026-09-03 multi-main-domain bug audit

The implemented feature still has a single-main-origin assumption:

- `common/custom_domain.go:30-43,56-88,91-129` stores and validates only one `MainOrigin`; startup only requires that one origin in `SESSION_COOKIE_TRUSTED_URL`.
- `service/custom_domain.go:35-38,59-104` reduces that origin to one `mainHost`; every other host outside `CUSTOM_DOMAIN_SUFFIX` is classified invalid. With the requested production values, enabling the feature therefore makes `yeschoy.pro` return `404`.
- `controller/oauth.go:79-99` records `origin_host` and browser binding only when `domain_id > 0`, while `controller/domain_oauth_handoff.go:22-113` requires a positive custom-domain ID. A peer main host cannot currently return from the fixed `.com` OAuth callback to its own Host-only Session.
- `controller/password_reset_return.go:54-63` and `service/password_reset_return.go:22-97` create/resolve signed return context only for a positive custom-domain ID, so `.pro` cannot be preserved through reset mail.
- `controller/return_path.go:27-56` persists and resolves only active custom hosts for wallet returns; a `.pro` order falls back to `.com`.
- `controller/topup_return.go:103-105` treats every configured main host as callback-capable once host resolution becomes plural. The fix must distinguish the single technical callback/fallback origin from the peer main-origin allowlist so browser/provider callbacks remain pinned to `.com`.

Planning consequence: retain `CUSTOM_DOMAIN_MAIN_ORIGIN` as the single technical callback/fallback origin for backward compatibility, add a complete peer-main-origin allowlist, and generalize trusted-origin handoff/reset/payment validation to support either a configured main host (`domain_id=0`) or a live promotion host (`domain_id>0`). Main hosts remain equal application entries and keep independent Host-only Sessions.

## Migration, CLI and verification

- `model/main.go:302-349` uses GORM `AutoMigrate` for primary models on the master node.
- `main.go:49-52` currently has only a pre-server `new-api plugin` subcommand. A domain CLI needs a minimal DB initialization path and must not start the full server/background lifecycle.
- `.github/workflows/ci.yml:14-88` requires root/relaykit vet and build, `make test`, frontend typecheck and tests.
- `web/package.json` also provides `lint`, `format:check`, and production `build` scripts.

Implementation must re-check these anchors if HEAD changes before Phase 2.
