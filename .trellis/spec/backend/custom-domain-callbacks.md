# Custom-domain callback contract

## Scenario: shared application on peer main and customer promotion domains

### 1. Scope / Trigger

- Trigger: a request enters through any configured peer main Origin or an enabled first-level subdomain of `CUSTOM_DOMAIN_SUFFIX`, while accounts, sessions, wallets, orders, keys, and permissions remain shared.
- Apply this contract when changing Host routing, registration attribution, OAuth login/bind, password reset, wallet top-up returns, or the domain administration CLI.
- Customer domains are presentation/attribution entry points, not tenants. Do not add data isolation or parent-domain cookies through this feature.

### 2. Signatures

- CLI: `new-api domain assign <label> --owner-user-id <id>`, `enable <label>`, `disable <label>`, `show <label>`, `list [--enabled|--disabled]`.
- DB: `custom_domains(label unique, owner_user_id immutable, active_owner_id nullable unique, enabled, disabled_at)`; `top_ups.origin_host` is internal and defaults to `''`.
- OAuth APIs: `POST /api/oauth/state`, `GET /api/oauth/:provider`, `POST /api/oauth/domain-handoff`, `POST /api/oauth/domain-handoff-fallback`, `POST /api/oauth/domain-bind-handoff`.
- Browser bridge: `GET /oauth/handoff`; login/bind tickets are read from `#ticket=...`; bind failures use `#result=cancelled|failed|target_unavailable`. Fragments are cleared before any request/message and are never accepted from query/path.
- Return APIs: `GET /api/reset_password/return`, `GET /api/user/epay/return`, `GET /api/stripe/return`.
- Environment: `CUSTOM_DOMAIN_MAIN_ORIGIN` is the single callback/fallback Origin; `CUSTOM_DOMAIN_MAIN_ORIGINS` is the comma-separated set of peer application Origins.

### 3. Contracts

- Environment: `CUSTOM_DOMAIN_ENABLED` defaults false; `CUSTOM_DOMAIN_SUFFIX`, `CUSTOM_DOMAIN_MAIN_ORIGIN`, `CUSTOM_DOMAIN_MAIN_ORIGINS`, `CUSTOM_DOMAIN_CACHE_TTL_SECONDS` (1-60), and `CUSTOM_DOMAIN_RESERVED_LABELS` define the trusted policy. The plural list supports up to 32 exact HTTPS Origins, is normalized/deduplicated by Host, must contain the singular callback Origin, must not contain the promotion apex/subdomains, and requires non-callback peers to use the standard HTTPS port because runtime Host identity is hostname-based. When omitted it falls back to the singular Origin for compatibility. Starting HTTP with the feature enabled additionally requires `SESSION_COOKIE_SECURE=true` and every main Origin in `SESSION_COOKIE_TRUSTED_URL`; startup fails closed otherwise.
- Docker Compose must explicitly map every `CUSTOM_DOMAIN_*` and `SESSION_COOKIE_*` variable into `services.new-api.environment`. A host-side Compose `.env` supplies interpolation values only; documenting a variable in `.env.example` does not inject it into the container. The Compose default for `CUSTOM_DOMAIN_MAIN_ORIGINS` must remain empty so the application can preserve the singular-origin fallback. Its healthcheck probes every effective configured main Origin and falls back to `CUSTOM_DOMAIN_MAIN_ORIGIN` when the plural value is empty. Without the environment mapping the CLI can still see/migrate the database while HTTP silently runs with `CUSTOM_DOMAIN_ENABLED=false` and OAuth state omits domain fields.
- Request identity comes only from normalized `Request.Host`; never use `X-Forwarded-Host` as the domain owner source.
- Every configured main Host and enabled assigned promotion domain reaches normal routes simultaneously. Apex, unknown, nested, invalid, and disabled promotion domains return 404. Disabled promotion domains expose only the minimal OAuth handoff paths required to exchange an in-flight ticket for a callback-site fallback.
- Middleware promotion status may be stale for at most the configured cache TTL. Handoff consumption must match the signed Host/domain ID, then use a fresh resolver result as the authority for enabled/disabled behavior; never reject solely because cached and fresh `DomainKind` values differ.
- `CUSTOM_DOMAIN_MAIN_ORIGIN` is a technical role, not a canonical product domain. All other main Hosts are peers, keep independent Host-only Sessions, and use the same handoff/reset/payment-return path without Host-specific branches. Adding a main Host requires only DNS/TLS, reverse-proxy, main-list, and Session trusted-Origin configuration.
- OAuth provider callbacks, password-reset dispatch, ePay return/notify, Stripe return/webhook, and login fallback consumption require `DomainContext.IsCallbackHost=true`; belonging to the peer-main allowlist is not sufficient.
- OAuth callback responses use typed actions: `domain_login_handoff`, `domain_login_fallback`, `domain_bind_handoff`, `domain_bind_return`, or `domain_oauth_return`. `domain_bind_return` carries a server-selected `result` of `cancelled`, `failed`, or `target_unavailable`; target origins come from signed AuthFlow/domain state, never from a client `return_url`.
- After an OAuth state has been validated, provider-disabled, token-exchange, user-info, registration-policy, banned-user, duplicate-binding, and handoff-issuance failures for a non-callback origin must also use the typed return actions. The error response must preserve the existing state-consumption point for that failure stage while returning the browser or bind opener to the trusted signed origin.
- Login handoff tickets bind user, auth version, target Host, provider/login method, and the HMAC of `__Host-yeschoy_oauth_binding`. Bind tickets additionally bind the original Session and session version.
- Each non-callback main or promotion-domain OAuth state response reissues the same valid `__Host-yeschoy_oauth_binding` value with a fresh 900-second `Max-Age`; `domain_id=0` plus an allowlisted `origin_host` represents a peer main Host, while a positive ID represents a promotion domain.
- A bind callback on the callback Host always defers a non-callback origin mutation through `domain_bind_handoff`, even if the request unexpectedly carries the original Bearer token. Provider cancellation/error and a disabled promotion target consume state and return through the minimal bridge without mutating a binding.
- A successful origin login handoff or callback-site fallback writes the same `LogTypeLogin` audit record as an ordinary login, using the server-issued `login_method`; creating a Session alone is not sufficient.
- Refresh cookies remain Host-only, `HttpOnly`, `SameSite=Strict`, and never set `Domain=.yeschoy.io`.
- Password reset context binds purpose, optional promotion-domain ID, trusted Host, normalized email/token digest, and expiry. Peer main Hosts resolve through the main allowlist; promotion Hosts resolve through the database and enabled state. ePay browser return must verify provider signature; Stripe browser return is navigation-only.
- While the feature is enabled, callback-main password reset links use `CUSTOM_DOMAIN_MAIN_ORIGIN` even when `ServerAddress` differs. `ServerAddress` remains the legacy source only when the feature is disabled.
- While custom domains are enabled, the wallet ePay notify URL, fixed ePay/Stripe browser callbacks, and invalid/disabled-domain payment fallbacks use `CUSTOM_DOMAIN_MAIN_ORIGIN`. `ServerAddress`/`CustomCallbackAddress` remain legacy sources only when the feature is disabled.
- Public browser-return routes use `CriticalRateLimit`. Access logging redacts `trade_no`, `out_trade_no`, `sign`, reset email/token/context values on both the dispatcher and `/user/reset` landing request without mutating the request query used for ePay signature verification.
- Cross-database unique-index errors are translated at the custom-domain model boundary: SQLite/PostgreSQL use the active GORM dialector translator and MySQL error 1062 maps to the corresponding domain conflict error.
- Reserved labels are allocation policy: `assign` and `enable` reject them. `show` and `disable` use syntax-only normalization so an already-assigned label remains operable if the reserved list changes later.

### 4. Validation & Error Matrix

| Condition | Result |
|---|---|
| Any configured main Host or enabled assigned first-level promotion domain | Continue with attached typed DomainContext |
| Main-origin list omits callback Origin, exceeds 32, contains HTTP/promotion Host, or duplicates one Host with conflicting Origins | Startup configuration error |
| Any main Host is missing from `SESSION_COOKIE_TRUSTED_URL` in Secure mode | HTTP startup error |
| Provider/reset/payment callback arrives on a peer non-callback main Host | 404 before provider or order processing |
| Apex, unknown, nested, reserved, malformed, or ordinary disabled request | 404 |
| Domain owner disabled/deleted during default attribution | Create user with `inviter_id=0`; domain remains routable when enabled |
| Non-empty explicit aff is missing | Preserve existing behavior: `inviter_id=0`, no fallback to domain owner |
| OAuth ticket expired, replayed, wrong Host/Session/version/binding | 403 before Session/binding mutation |
| Non-callback-origin bind callback arrives on the callback Host with the original Bearer token | Ignore callback authentication as a completion shortcut; issue the Session-bound bind handoff |
| OAuth provider/application failure after validating a non-callback-origin state | Return `domain_oauth_return` for login or `domain_bind_return(result=failed)` for bind; preserve the existing state-consumption point |
| Custom-domain bind is cancelled/errors or target is disabled | Consume OAuth state; return `domain_bind_return` through the original/disabled Host bridge; no binding mutation |
| Original custom-domain bind Session is revoked/expired before main callback | Consume OAuth state; return `domain_bind_return(result=failed)`; do not exchange provider code or mutate a binding |
| Domain disabled after login ticket issuance, while middleware cache still says enabled | Trust the fresh domain state, consume the bound ticket, issue one-time callback fallback ticket, create no domain Session |
| Domain login handoff/fallback succeeds | Create the Session and exactly one login audit record with the issued login method |
| Assigned label is later added to the reserved list | Reject `enable`; continue to allow `show` and `disable` |
| Signed reset context invalid/expired | 400; do not trust embedded Host |
| Stored payment promotion domain missing/disabled | Redirect to the fixed callback site; settlement logic is unchanged |
| Stored payment Host is a configured peer main | Redirect to that peer Host; settlement logic is unchanged |
| `ServerAddress` differs from `CUSTOM_DOMAIN_MAIN_ORIGIN` while enabled | Build fixed payment callback/fallback URLs from `CUSTOM_DOMAIN_MAIN_ORIGIN` |
| `CustomCallbackAddress` differs from `CUSTOM_DOMAIN_MAIN_ORIGIN` while enabled | Wallet ePay notify still uses `CUSTOM_DOMAIN_MAIN_ORIGIN` so Host guard accepts the authoritative callback |
| ePay return signature/order/provider mismatch | 400/404 and no credit |
| Stripe return trade number missing/provider mismatch | 400/404 and no credit |

### 5. Good/Base/Bad Cases

- Good: `yeschoy.com`, `yeschoy.pro`, and `alpha.yeschoy.io` are active simultaneously; `.pro` gets no default inviter, returns from the fixed `.com` callback through a one-time handoff, and receives only its own Host-only cookie.
- Good: adding `future.example` to the main and Session trusted-Origin lists automatically gives it the same non-callback main behavior without code or database changes.
- Good: `alpha.yeschoy.io` is enabled, no explicit aff is submitted, so a new user receives alpha's current enabled owner; OAuth returns through fragment handoff and writes only alpha's cookie.
- Good: a GitHub bind is cancelled on the fixed main callback, which consumes state and returns a fragment-only failure to the still-open alpha opener.
- Base: a callback-site request or historical `top_ups.origin_host=''` follows the pre-feature callback-site path.
- Good: an operator can still inspect and disable `alpha` after adding it to `CUSTOM_DOMAIN_RESERVED_LABELS`, but cannot enable it again while reserved.
- Base: with custom domains disabled, payment paths continue to use the existing `ServerAddress` behavior.
- Bad: hard-coding `.pro` branches, treating the peer-main list as mutually exclusive with promotion domains, accepting callbacks on every Main kind, accepting `https://evil.example` from a client field, trusting `X-Forwarded-Host`, putting tickets/results in query strings, or sharing cookies across Hosts.
- Bad: adding custom-domain variables only to the host `.env` while `docker-compose.yml` does not reference them; `domain show` still works, but HTTP requests have no DomainContext and OAuth payloads omit `domain_id`/`origin_host`.

### 6. Tests Required

- Model: label normalization, permanent tombstone ownership, one active domain per owner, migration registration, and duplicate-key translation with global GORM translation disabled.
- Middleware/service: 1/2/3-main-origin parse matrices, callback membership, 32-origin bound, every-main Session trust, simultaneous main/promotion Host classification, positive/negative promotion cache, forwarded-host rejection, exact custom HTTPS Origin for refresh/logout, and callback-host identity.
- Controller/router: main Hosts never receive default inviter; `.pro` and a synthetic third main Host use the same OAuth login/bind handoff, signed reset return, and stored wallet return path; provider, token-exchange, user-info, registration-policy, and duplicate-binding failures return through typed actions to the trusted peer/promotion origin; callback endpoints reject peer non-callback main Hosts; cached-enabled/fresh-disabled promotion handoff falls back safely; callback-main reset links ignore a conflicting legacy `ServerAddress`; promotion-domain inviter, replay/wrong-binding, ePay signature/idempotency, Stripe navigation-only, login-audit, and critical-limiter tests remain green.
- Frontend: type guards and URL builders assert target is a pure HTTPS Origin and ticket/result exists only in the fragment; popup messages check exact origin/source/provider/result; typecheck, targeted lint/format, and production build must pass.
- Deployment: render `docker compose config` with custom domains enabled and assert the service receives singular callback Origin, plural peer-main Origins, promotion suffix, and all Session trusted Origins before recreating the container. Verify an omitted plural value falls back to the singular callback Origin and an explicit 2/3-origin list makes the healthcheck probe every configured Host.

### 7. Wrong vs Correct

#### Wrong

```go
if host == "yeschoy.pro" {
    // peer-specific callback logic
}
```

```go
target := c.Query("return_url")
c.Redirect(http.StatusFound, target)
```

```go
// Wrong for enabled custom-domain payment callbacks: this can point at a
// different Host than the custom-domain guard trusts.
return paymentReturnPath("/api/stripe/return")
```

```go
// Wrong: a valid Cookie may have only seconds left when a new state is issued.
if existingBindingIsValid {
    return hash(existingBinding)
}
```

```yaml
# Wrong: values in the host .env are not automatically injected.
services:
  new-api:
    environment:
      SESSION_SECRET: "${SESSION_SECRET}"
```

```ts
window.location.replace(`${target}?ticket=${ticket}`)
```

#### Correct

```go
context, err := resolver.ResolveStoredOrigin(domainID, originHost)
// domainID == 0 resolves any configured peer main; positive IDs resolve
// promotion domains. No peer Host gets its own branch.
```

```go
domainContext, ok := middleware.GetCustomDomainContext(c)
// Persist/use only domainContext.Host or server-signed AuthFlow/order context.
```

```go
// Uses CUSTOM_DOMAIN_MAIN_ORIGIN while the feature is enabled and preserves
// the legacy ServerAddress behavior while it is disabled.
return fixedPaymentReturnPath("/api/stripe/return")
```

```go
// Reuse the value for parallel flows, but refresh its lifetime on every state.
http.SetCookie(c.Writer, oauthBindingCookie(existingOrNewBinding, 900))
```

```yaml
# Correct: explicitly forward every runtime setting.
services:
  new-api:
    environment:
      CUSTOM_DOMAIN_ENABLED: "${CUSTOM_DOMAIN_ENABLED:-false}"
      CUSTOM_DOMAIN_SUFFIX: "${CUSTOM_DOMAIN_SUFFIX:-yeschoy.io}"
      CUSTOM_DOMAIN_MAIN_ORIGIN: "${CUSTOM_DOMAIN_MAIN_ORIGIN:-https://yeschoy.com}"
      CUSTOM_DOMAIN_MAIN_ORIGINS: "${CUSTOM_DOMAIN_MAIN_ORIGINS:-}"
      SESSION_COOKIE_SECURE: "${SESSION_COOKIE_SECURE:-false}"
      SESSION_COOKIE_TRUSTED_URL: "${SESSION_COOKIE_TRUSTED_URL:-}"
```

```ts
const url = new URL('/oauth/handoff', validatedTargetOrigin)
url.hash = new URLSearchParams({ ticket }).toString()
window.location.replace(url.toString())
```
