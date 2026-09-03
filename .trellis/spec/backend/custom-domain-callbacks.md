# Custom-domain callback contract

## Scenario: shared application on customer promotion domains

### 1. Scope / Trigger

- Trigger: a request enters through an enabled first-level subdomain of `CUSTOM_DOMAIN_SUFFIX`, while accounts, sessions, wallets, orders, keys, and permissions remain shared with the main site.
- Apply this contract when changing Host routing, registration attribution, OAuth login/bind, password reset, wallet top-up returns, or the domain administration CLI.
- Customer domains are presentation/attribution entry points, not tenants. Do not add data isolation or parent-domain cookies through this feature.

### 2. Signatures

- CLI: `new-api domain assign <label> --owner-user-id <id>`, `enable <label>`, `disable <label>`, `show <label>`, `list [--enabled|--disabled]`.
- DB: `custom_domains(label unique, owner_user_id immutable, active_owner_id nullable unique, enabled, disabled_at)`; `top_ups.origin_host` is internal and defaults to `''`.
- OAuth APIs: `POST /api/oauth/state`, `GET /api/oauth/:provider`, `POST /api/oauth/domain-handoff`, `POST /api/oauth/domain-handoff-fallback`, `POST /api/oauth/domain-bind-handoff`.
- Browser bridge: `GET /oauth/handoff`; login/bind tickets are read from `#ticket=...`; bind failures use `#result=cancelled|failed|target_unavailable`. Fragments are cleared before any request/message and are never accepted from query/path.
- Return APIs: `GET /api/reset_password/return`, `GET /api/user/epay/return`, `GET /api/stripe/return`.

### 3. Contracts

- Environment: `CUSTOM_DOMAIN_ENABLED` defaults false; `CUSTOM_DOMAIN_SUFFIX`, `CUSTOM_DOMAIN_MAIN_ORIGIN`, `CUSTOM_DOMAIN_CACHE_TTL_SECONDS` (1-60), and `CUSTOM_DOMAIN_RESERVED_LABELS` define the trusted policy. Starting the HTTP server with the feature enabled additionally requires `SESSION_COOKIE_SECURE=true` and an exact `CUSTOM_DOMAIN_MAIN_ORIGIN` entry in `SESSION_COOKIE_TRUSTED_URL`; HTTP startup fails closed otherwise. The domain CLI only parses domain policy and remains available for emergency `show`/`disable` operations when HTTP-only Session settings are incomplete.
- Docker Compose must explicitly map every `CUSTOM_DOMAIN_*` and `SESSION_COOKIE_*` variable into `services.new-api.environment`. A host-side Compose `.env` supplies interpolation values only; documenting a variable in `.env.example` does not inject it into the container. Without this mapping the CLI can still see/migrate the database while HTTP silently runs with `CUSTOM_DOMAIN_ENABLED=false` and OAuth state omits domain fields.
- Request identity comes only from normalized `Request.Host`; never use `X-Forwarded-Host` as the domain owner source.
- Only main Host and enabled assigned domains reach normal routes. Apex, unknown, nested, invalid, and disabled domains return 404. Disabled domains expose only the minimal OAuth handoff paths required to exchange an in-flight ticket for a main-site fallback.
- OAuth callback responses use typed actions: `domain_login_handoff`, `domain_login_fallback`, `domain_bind_handoff`, `domain_bind_return`, or `domain_oauth_return`. `domain_bind_return` carries a server-selected `result` of `cancelled`, `failed`, or `target_unavailable`; target origins come from signed AuthFlow/domain state, never from a client `return_url`.
- Login handoff tickets bind user, auth version, target Host, provider/login method, and the HMAC of `__Host-yeschoy_oauth_binding`. Bind tickets additionally bind the original Session and session version.
- Each custom-domain OAuth state response reissues the same valid `__Host-yeschoy_oauth_binding` value with a fresh 900-second `Max-Age`; this preserves parallel flows without letting a newly started flow inherit an almost-expired Cookie.
- A custom-origin bind callback on the main Host always defers the mutation through `domain_bind_handoff`, even if the request unexpectedly carries the original Bearer token. Provider cancellation/error and a disabled target consume the OAuth state and return through the minimal bridge to the original opener without mutating a binding.
- A successful domain login handoff or main-site fallback writes the same `LogTypeLogin` audit record as an ordinary login, using the server-issued handoff `login_method`; creating a Session alone is not sufficient.
- Refresh cookies remain Host-only, `HttpOnly`, `SameSite=Strict`, and never set `Domain=.yeschoy.io`.
- Password reset context binds purpose, domain, normalized email/token digest, and expiry. ePay browser return must verify provider signature; Stripe browser return is navigation-only. Provider notify/webhook remains the authoritative wallet signal.
- While custom domains are enabled, the wallet ePay notify URL, fixed ePay/Stripe browser callbacks, and invalid/disabled-domain payment fallbacks use `CUSTOM_DOMAIN_MAIN_ORIGIN`. `ServerAddress`/`CustomCallbackAddress` remain legacy sources only when the feature is disabled.
- Public browser-return routes use `CriticalRateLimit`. Access logging redacts `trade_no`, `out_trade_no`, `sign`, reset email/token/context values on both the dispatcher and `/user/reset` landing request without mutating the request query used for ePay signature verification.
- Cross-database unique-index errors are translated at the custom-domain model boundary: SQLite/PostgreSQL use the active GORM dialector translator and MySQL error 1062 maps to the corresponding domain conflict error.
- Reserved labels are allocation policy: `assign` and `enable` reject them. `show` and `disable` use syntax-only normalization so an already-assigned label remains operable if the reserved list changes later.

### 4. Validation & Error Matrix

| Condition | Result |
|---|---|
| Main Host or enabled assigned first-level domain | Continue with attached typed DomainContext |
| Apex, unknown, nested, reserved, malformed, or ordinary disabled request | 404 |
| Domain owner disabled/deleted during default attribution | Create user with `inviter_id=0`; domain remains routable when enabled |
| Non-empty explicit aff is missing | Preserve existing behavior: `inviter_id=0`, no fallback to domain owner |
| OAuth ticket expired, replayed, wrong Host/Session/version/binding | 403 before Session/binding mutation |
| Custom-domain bind callback arrives on main with the original Bearer token | Ignore callback authentication as a completion shortcut; issue the Session-bound bind handoff |
| Custom-domain bind is cancelled/errors or target is disabled | Consume OAuth state; return `domain_bind_return` through the original/disabled Host bridge; no binding mutation |
| Original custom-domain bind Session is revoked/expired before main callback | Consume OAuth state; return `domain_bind_return(result=failed)`; do not exchange provider code or mutate a binding |
| Domain disabled after login ticket issuance | Consume the bound domain ticket, issue one-time main fallback ticket, create no domain Session |
| Domain login handoff/fallback succeeds | Create the Session and exactly one login audit record with the issued login method |
| Assigned label is later added to the reserved list | Reject `enable`; continue to allow `show` and `disable` |
| Signed reset context invalid/expired | 400; do not trust embedded Host |
| Stored payment domain missing/disabled | Redirect to the fixed main site; settlement logic is unchanged |
| `ServerAddress` differs from `CUSTOM_DOMAIN_MAIN_ORIGIN` while enabled | Build fixed payment callback/fallback URLs from `CUSTOM_DOMAIN_MAIN_ORIGIN` |
| `CustomCallbackAddress` differs from `CUSTOM_DOMAIN_MAIN_ORIGIN` while enabled | Wallet ePay notify still uses `CUSTOM_DOMAIN_MAIN_ORIGIN` so Host guard accepts the authoritative callback |
| ePay return signature/order/provider mismatch | 400/404 and no credit |
| Stripe return trade number missing/provider mismatch | 400/404 and no credit |

### 5. Good/Base/Bad Cases

- Good: `alpha.yeschoy.io` is enabled, no explicit aff is submitted, so a new user receives alpha's current enabled owner; OAuth returns through fragment handoff and writes only alpha's cookie.
- Good: a GitHub bind is cancelled on the fixed main callback, which consumes state and returns a fragment-only failure to the still-open alpha opener.
- Base: a main-site request or historical `top_ups.origin_host=''` follows the pre-feature main-site path.
- Good: an operator can still inspect and disable `alpha` after adding it to `CUSTOM_DOMAIN_RESERVED_LABELS`, but cannot enable it again while reserved.
- Base: with custom domains disabled, payment paths continue to use the existing `ServerAddress` behavior.
- Bad: accepting `https://evil.example` from a client field, trusting `X-Forwarded-Host`, putting tickets/results in query strings, completing a custom-domain bind directly on main because a Bearer token was present, sharing `.yeschoy.io` cookies, omitting login audits after handoff, using legacy callback origins while the feature is enabled, logging signed payment/reset query values, or crediting Stripe from the browser return.
- Bad: adding custom-domain variables only to the host `.env` while `docker-compose.yml` does not reference them; `domain show` still works, but HTTP requests have no DomainContext and OAuth payloads omit `domain_id`/`origin_host`.

### 6. Tests Required

- Model: label normalization, permanent tombstone ownership, one active domain per owner, migration registration, and duplicate-key translation with global GORM translation disabled.
- Middleware/service: Host matrix, positive/negative TTL cache, forwarded-host rejection, HTTP startup rejection for insecure/untrusted Session configuration while CLI domain-policy initialization remains available, exact custom HTTPS Origin for refresh/logout, Passkey route rejection, dispatcher/final-reset callback log redaction without request mutation; CLI tests must prove a newly reserved existing label remains showable/disableable and cannot be enabled.
- Controller/router: password/OAuth inviter matrix; OAuth issue/consume/replay/wrong-binding/main fallback/bind Session tests, including binding-Cookie renewal, main callback with a valid original Bearer, bind cancel/error/disabled/revoked-Session state consumption, and one `LogTypeLogin` assertion per successful login handoff path; reset dispatcher signature/fallback tests; ePay signature/idempotency and Stripe navigation-only return tests; browser return routes must hit the critical limiter. Payment callback tests set `ServerAddress`, `CustomCallbackAddress`, and `CUSTOM_DOMAIN_MAIN_ORIGIN` to different origins and assert the configured custom-domain main origin wins while enabled.
- Frontend: type guards and URL builders assert target is a pure HTTPS Origin and ticket/result exists only in the fragment; popup messages check exact origin/source/provider/result; typecheck, targeted lint/format, and production build must pass.
- Deployment: render `docker compose config` with custom domains enabled and assert the `new-api` service environment contains the expected custom-domain and Session variables before recreating the container.

### 7. Wrong vs Correct

#### Wrong

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
      SESSION_COOKIE_SECURE: "${SESSION_COOKIE_SECURE:-false}"
      SESSION_COOKIE_TRUSTED_URL: "${SESSION_COOKIE_TRUSTED_URL:-}"
```

```ts
const url = new URL('/oauth/handoff', validatedTargetOrigin)
url.hash = new URLSearchParams({ ticket }).toString()
window.location.replace(url.toString())
```
