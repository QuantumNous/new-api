# Custom-domain callback contract

## Scenario: shared application on peer main and customer promotion domains

### 1. Scope / Trigger

- Trigger: a request enters through any configured peer main Origin or an enabled first-level subdomain of `CUSTOM_DOMAIN_SUFFIX`, while accounts, sessions, wallets, orders, keys, and permissions remain shared.
- Apply this contract when changing Host routing, registration attribution, OAuth login/bind, password reset, wallet top-up returns, or the domain administration CLI.
- Customer domains are presentation/attribution entry points, not tenants. Do not add data isolation or parent-domain cookies through this feature.
- Task authority: [09-01-custom-domain-callback-flow PRD](../../tasks/09-01-custom-domain-callback-flow/prd.md) and [design](../../tasks/09-01-custom-domain-callback-flow/design.md).
- Deferred by user decision: the peer-main Passkey review finding belongs to a later task. Do not change Passkey routes, status flags, RP IDs, credentials, or settings as part of this task. The current guards exclude `Custom` domains, not every non-callback `Main`; therefore this delivery neither guarantees that peer-main Passkey is hidden nor establishes multi-RP support.

### 2. Signatures

- CLI: `new-api domain assign <label> --owner-user-id <id>`, `enable <label>`, `disable <label>`, `show <label>`, `list [--enabled|--disabled]`.
- DB: `custom_domains(label unique, owner_user_id immutable, active_owner_id nullable unique, enabled, disabled_at)`; `top_ups.origin_host` is internal and defaults to `''`.
- OAuth APIs: `POST /api/oauth/state`, `GET /api/oauth/:provider`, `POST /api/oauth/domain-handoff`, `POST /api/oauth/domain-handoff-fallback`, `POST /api/oauth/domain-bind-handoff`.
- Browser bridge: `GET /oauth/handoff`; login/bind tickets are read from `#ticket=...`; bind failures use `#result=cancelled|failed|target_unavailable`. Fragments are cleared before any request/message and are never accepted from query/path.
- Return APIs: `GET /api/reset_password/return`, `GET /api/user/epay/return`, `GET /api/stripe/return`.
- Environment: `CUSTOM_DOMAIN_MAIN_ORIGIN` is the single callback/fallback Origin; `CUSTOM_DOMAIN_MAIN_ORIGINS` is the comma-separated set of peer application Origins.
- Configuration entry points: `common.ParseCustomDomainSettingsWithMainOrigins(enabledRaw, suffixRaw, mainOriginRaw, mainOriginsRaw, cacheTTLRaw, reservedRaw string) (CustomDomainSettings, error)` and `common.ValidateCustomDomainHTTPSettings() error`.
- Stored-source validation: `(*service.CustomDomainResolver).ResolveStoredOrigin(domainID int64, rawHost string) (CustomDomainContext, error)`.
- Cookie Origin boundary: `middleware.SessionCookieOriginGuard() gin.HandlerFunc` protects `POST /api/user/auth/refresh` and `POST /api/user/auth/logout`; it is not the application Host allowlist or relay CORS policy.

### 3. Contracts

#### Domain and Session configuration

| Key | Role / default | Required behavior |
|---|---|---|
| `CUSTOM_DOMAIN_ENABLED` | Host routing and callback feature switch; `false` | With `true`, HTTP startup requires secure cookies and trust for every effective exact main Origin. With `false`, Host middleware is a no-op; infrastructure must keep promotion entry points closed. |
| `CUSTOM_DOMAIN_MAIN_ORIGIN` | One technical callback/notify/fallback Origin; `https://yeschoy.com` | Remains effective even when the plural list is set; it selects the callback role, not an overriding application allowlist. |
| `CUSTOM_DOMAIN_MAIN_ORIGINS` | Peer application Origin allowlist; unset/empty falls back to the singular Origin | A non-empty list must include the singular Origin as an explicit exact entry. It controls which main Hosts are routable, not which one receives callbacks. |
| `CUSTOM_DOMAIN_SUFFIX` | Promotion-domain suffix; `yeschoy.io` | Suffix apex and subdomains must not be configured as main Origins. The apex returns 404 when the Host guard is enabled; subdomains require an assigned, enabled DB row. |
| `SESSION_COOKIE_SECURE` | Secure cookie / OriginGuard switch; `false` | Must be `true` to enable custom domains. A non-empty trusted-Origin list with this switch false also fails Session configuration. |
| `SESSION_COOKIE_TRUSTED_URL` | Exact HTTPS browser Origins for refresh/logout; empty by default | With secure cookies, must be non-empty; with custom domains enabled, must also contain every effective exact main Origin. This is neither a Cookie `Domain` value nor a wildcard/subdomain rule. |
| `CUSTOM_DOMAIN_CACHE_TTL_SECONDS` | Promotion status cache; `5` | Integer in 1-60. |
| `CUSTOM_DOMAIN_RESERVED_LABELS` | Additional reserved labels; empty by default | Extends the built-in `admin,api,auth,callback,pay,www` allocation policy. |

- The effective main list is the normalized plural list when supplied, otherwise `[CUSTOM_DOMAIN_MAIN_ORIGIN]`. The two main-Origin settings are complementary, not mutually exclusive. A list containing only `.pro` while the singular value is `.com` fails configuration; it does not silently override or append `.com`.
- The plural input supports at most 32 comma-separated entries, normalizes/deduplicates matching Hosts, and rejects conflicting Origins for one Host. Use exact HTTPS Origins or explicit one-label wildcard rules (see below), with no userinfo, query, fragment, or non-root path. Non-callback peers must use the standard HTTPS port because runtime Host identity is hostname-based.
- For this deployment, keep the static Session trusted list to the intended application main Origins. `https://yeschoy.io` is not an application entry point and needs no entry. An enabled `ai.yeschoy.io` uses the validated `Custom` DomainContext: refresh/logout accepts only exact `https://ai.yeschoy.io` from Origin (or Referer when Origin is absent), even behind an HTTP TLS-termination upstream. It does not require static enumeration and does not fall through to the static trusted list on mismatch.
- Adding an Origin to `SESSION_COOKIE_TRUSTED_URL` alone never authorizes its request Host, assigns a promotion domain, or enables it. Extra exact entries are not rejected merely for being outside the main list, but do not use them to bypass Host routing; wildcard Origins such as `https://*.yeschoy.io` are invalid.
- `direct.yeschoy.pro` is an optional peer only if intentionally operated as a full application entry point with TLS and the same trusted ingress. In that case add it to both lists. Do not list an infrastructure-only direct-backend address simply to bypass the ingress boundary.
- Docker Compose must explicitly map every `CUSTOM_DOMAIN_*` and `SESSION_COOKIE_*` setting into `services.new-api.environment`. The host `.env` supplies interpolation values only. Keep the Compose plural default empty (`${CUSTOM_DOMAIN_MAIN_ORIGINS:-}`) so a custom singular value still works without a new plural setting. Commented `.env` lines are inactive; use raw URLs, not Markdown links.
- The Compose healthcheck sends one local HTTP `/api/status` request per configured primary rule with the exact authority or a concrete `h.<base>` wildcard probe as the `Host` header; unset/empty plural uses the singular value. Every probe must yield a body matching `"success": true`, otherwise the check fails. This verifies local application routing, not public DNS, TLS, ingress availability, promotion DB assignments, or third-party callback reachability. Do not describe it as external multi-domain monitoring.

Example enabled two-main deployment (not a claim that production has been configured):

```dotenv
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_TRUSTED_URL=https://yeschoy.com,https://yeschoy.pro
CUSTOM_DOMAIN_ENABLED=true
CUSTOM_DOMAIN_SUFFIX=yeschoy.io
CUSTOM_DOMAIN_MAIN_ORIGIN=https://yeschoy.com
CUSTOM_DOMAIN_MAIN_ORIGINS=https://yeschoy.com,https://yeschoy.pro
CUSTOM_DOMAIN_CACHE_TTL_SECONDS=5
```

For an `ai.yeschoy.io` promotion entry, use the CLI `assign ai --owner-user-id <existing-user-id>` and `enable ai` under `new-api domain`; do not add it to the main-Origin list. DNS/TLS and proxy Host preservation are separate prerequisites. Render `docker compose config` before recreating the application container; changing the host `.env` alone does not change an existing container's environment. Do not share unredacted rendered configuration, which can contain secrets.

#### Runtime flow contracts

- Request identity comes only from normalized `Request.Host`; never use `X-Forwarded-Host` as the domain owner source.
- Every configured main Host and enabled assigned promotion domain reaches normal routes simultaneously. Apex, unknown, nested, invalid, and disabled promotion domains return 404. Disabled promotion domains expose only the minimal OAuth handoff paths required to exchange an in-flight ticket for a callback-site fallback.
- Middleware promotion status may be stale for at most the configured cache TTL. Handoff consumption must match the signed Host/domain ID, then use a fresh resolver result as the authority for enabled/disabled behavior; never reject solely because cached and fresh `DomainKind` values differ.
- `CUSTOM_DOMAIN_MAIN_ORIGIN` is a technical role, not a canonical product domain. All other main Hosts are peers, keep independent Host-only Sessions, and use the same handoff/reset/payment-return path without Host-specific branches. Adding an exact main Host requires DNS/TLS, reverse-proxy, main-list, and Session trusted-Origin configuration. A concrete Host covered by a wildcard needs only the corresponding infrastructure coverage.
- OAuth provider callbacks, password-reset dispatch, ePay return/notify, Stripe return/webhook, and login fallback consumption require `DomainContext.IsCallbackHost=true`; belonging to the peer-main allowlist is not sufficient.
- OAuth callback responses use typed actions: `domain_login_handoff`, `domain_login_fallback`, `domain_bind_handoff`, `domain_bind_return`, or `domain_oauth_return`. `domain_bind_return` carries a server-selected `result` of `cancelled`, `failed`, or `target_unavailable`; target origins come from signed AuthFlow/domain state, never from a client `return_url`.
- After an OAuth state and return target have been validated, provider-disabled, token-exchange, user-info, registration-policy, banned-user, duplicate-binding, and handoff-issuance failures for an active non-callback origin use the typed return actions. Reuse `handleOAuthFlowError` / `handleOAuthFlowMessage` and `writeOAuthFlowFailure` rather than returning a generic callback-site error. If the target cannot be trusted or resolved, remain fail-closed at the callback site; never echo the unchecked payload Host. Failure routing itself does not consume state; the stage-specific rules are in section 4.
- Login handoff tickets bind user, auth version, target Host, provider/login method, and the HMAC of `__Host-yeschoy_oauth_binding`. Bind tickets additionally bind the original Session and session version.
- Each non-callback main or promotion-domain OAuth state response reissues the same valid `__Host-yeschoy_oauth_binding` value with a fresh 900-second `Max-Age`; `domain_id=0` plus an allowlisted `origin_host` represents a peer main Host, while a positive ID represents a promotion domain.
- A bind callback on the callback Host always defers a non-callback origin mutation through `domain_bind_handoff`, even if the request unexpectedly carries the original Bearer token. An explicit provider callback `error` (including cancellation) or a disabled promotion target consumes state and returns through the minimal bridge without mutating a binding; this rule does not mean that every internal provider-call failure consumes state.
- A successful origin login handoff or callback-site fallback writes the same `LogTypeLogin` audit record as an ordinary login, using the server-issued `login_method`; creating a Session alone is not sufficient.
- Refresh cookies remain Host-only, `HttpOnly`, `SameSite=Strict`, and never set `Domain=.yeschoy.io`.
- Password reset context binds purpose, optional promotion-domain ID, trusted Host, normalized email/token digest, and expiry. Peer main Hosts resolve through the main allowlist; promotion Hosts resolve through the database and enabled state. ePay browser return must verify provider signature; Stripe browser return is navigation-only.
- While the feature is enabled, callback-main password reset links use `CUSTOM_DOMAIN_MAIN_ORIGIN` even when `ServerAddress` differs. `ServerAddress` remains the legacy source only when the feature is disabled.
- While custom domains are enabled, the wallet ePay notify URL, fixed ePay/Stripe browser callbacks, and invalid/disabled-domain payment fallbacks use `CUSTOM_DOMAIN_MAIN_ORIGIN`. `ServerAddress`/`CustomCallbackAddress` remain legacy sources only when the feature is disabled.
- Public browser-return routes use `CriticalRateLimit`. Access logging redacts `trade_no`, `out_trade_no`, `sign`, reset email/token/context values on both the dispatcher and `/user/reset` landing request without mutating the request query used for ePay signature verification.
- Cross-database unique-index errors are translated at the custom-domain model boundary: SQLite/PostgreSQL use the active GORM dialector translator and MySQL error 1062 maps to the corresponding domain conflict error.
- Reserved labels are allocation policy: `assign` and `enable` reject them. `show` and `disable` use syntax-only normalization so an already-assigned label remains operable if the reserved list changes later.

### 4. Validation & Error Matrix

Runtime routing rows assume `CUSTOM_DOMAIN_ENABLED=true`; OriginGuard rows additionally assume `SESSION_COOKIE_SECURE=true`. Configuration-error rows describe startup validation, not HTTP responses.

| Condition | Result |
|---|---|
| Any configured main Host or enabled assigned first-level promotion domain | Continue with attached typed DomainContext |
| Plural list unset/empty; singular Origin is `https://main.example` | Effective main list is only `https://main.example`; Compose must not inject `.com,.pro` defaults |
| Main-origin list omits callback Origin, exceeds 32, contains HTTP/promotion Host, or duplicates one Host with conflicting Origins | Startup configuration error |
| Custom domains enabled but secure cookies disabled/commented out | HTTP startup error |
| Secure cookies enabled with an empty trusted list, or disabled with a non-empty trusted list | Session configuration error |
| Any exact main Origin is missing from `SESSION_COOKIE_TRUSTED_URL` in Secure mode | HTTP startup error |
| Main Host appears only in the Session trusted list, not the effective main allowlist, and is outside the promotion suffix | 404; static Origin trust does not grant Host access |
| Enabled `ai.yeschoy.io` refresh/logout with exact `https://ai.yeschoy.io` browser Origin and no static entry for it | OriginGuard accepts; ordinary Session validation still applies |
| Enabled `ai.yeschoy.io` refresh/logout with another browser Origin, even a statically trusted main Origin | 403 `AUTH_ORIGIN_FORBIDDEN` |
| Request Host is promotion apex `yeschoy.io`, including when it is in the static Session trusted list | 404 while Host guard is enabled |
| Provider/reset/payment callback arrives on a peer non-callback main Host | 404 before provider or order processing |
| Apex, unknown, nested, reserved, malformed, or ordinary disabled request | 404 |
| Domain owner disabled/deleted during default attribution | Create user with `inviter_id=0`; domain remains routable when enabled |
| Non-empty explicit aff is missing | Preserve existing behavior: `inviter_id=0`, no fallback to domain owner |
| OAuth ticket expired, replayed, wrong Host/Session/version/binding | 403 before Session/binding mutation |
| Non-callback-origin bind callback arrives on the callback Host with the original Bearer token | Ignore callback authentication as a completion shortcut; issue the Session-bound bind handoff |
| OAuth provider/application failure with a validated state and an active trusted non-callback target | Return `domain_oauth_return` for login or `domain_bind_return(result=failed)` for bind; preserve the existing state-consumption point |
| Non-callback-origin bind has an explicit callback `error`/cancellation or its promotion target is disabled | Consume OAuth state; return `domain_bind_return` through the original/disabled Host bridge; no binding mutation |
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
| Any configured-main healthcheck probe fails or lacks `success: true` | Healthcheck failure, even if the other main Hosts succeed |

OAuth state consumption is independent from browser error routing:

| Failure stage (after valid state lookup) | OAuth state after response |
|---|---|
| Provider disabled, `ExchangeToken` failure, or `GetUserInfo` failure | Not consumed by that failure branch |
| Bind provider identity already taken (including the legacy-ID check) | Not consumed by that failure branch |
| Explicit provider callback `error` reaches its handler, disabled promotion bind target, or revoked/expired originating bind Session | Consumed before the return response |
| Login registration/user-policy failure after provider identity, or login/bind handoff issuance failure after successful state consumption | Remains consumed; failure routing does not restore it |

Invalid/expired/replayed state and failed atomic consumption retain their existing rejection. Do not bypass consumption or create a Session/binding to improve error UX.

### 5. Good/Base/Bad Cases

- Good: `yeschoy.com`, `yeschoy.pro`, and `alpha.yeschoy.io` are active simultaneously; `.pro` gets no default inviter, returns from the fixed `.com` callback through a one-time handoff, and receives only its own Host-only cookie.
- Good: adding `future.example` to the main and Session trusted-Origin lists automatically gives it the same non-callback main behavior without code or database changes.
- Good: `ai.yeschoy.io` is assigned/enabled and its exact browser Origin passes refresh/logout without adding `.io` or a wildcard to the static trusted list.
- Base: `CUSTOM_DOMAIN_MAIN_ORIGIN=https://main.example` with an empty plural setting keeps the one-main deployment and probes `main.example`; neither environment nor healthcheck hard-codes `yeschoy.com`.
- Good: `alpha.yeschoy.io` is enabled, no explicit aff is submitted, so a new user receives alpha's current enabled owner; OAuth returns through fragment handoff and writes only alpha's cookie.
- Good: a GitHub bind is cancelled on the fixed main callback, which consumes state and returns a fragment-only failure to the still-open alpha opener.
- Base: a callback-site request or historical `top_ups.origin_host=''` follows the pre-feature callback-site path.
- Good: an operator can still inspect and disable `alpha` after adding it to `CUSTOM_DOMAIN_RESERVED_LABELS`, but cannot enable it again while reserved.
- Base: with custom domains disabled, payment paths continue to use the existing `ServerAddress` behavior.
- Bad: hard-coding `.pro` branches, treating the peer-main list as mutually exclusive with promotion domains, accepting callbacks on every Main kind, accepting `https://evil.example` from a client field, trusting `X-Forwarded-Host`, putting tickets/results in query strings, or sharing cookies across Hosts.
- Bad: adding custom-domain variables only to the host `.env` while `docker-compose.yml` does not reference them; `domain show` still works, but HTTP requests have no DomainContext and OAuth payloads omit `domain_id`/`origin_host`.
- Bad: adding `https://ai.yeschoy.io` to the main list, expecting `SESSION_COOKIE_TRUSTED_URL=https://yeschoy.io` to enable its subdomains, or claiming peer-main Passkey support was fixed as part of this task.

### 6. Tests Required

- Model: label normalization, permanent tombstone ownership, one active domain per owner, migration registration, and duplicate-key translation with global GORM translation disabled.
- Middleware/service: 1/2/3-main-origin parse matrices, callback membership, 32-origin bound, every-exact-main Session trust and wildcard same-Origin enforcement, simultaneous main/promotion Host classification, positive/negative promotion cache, forwarded-host rejection, exact custom HTTPS Origin for refresh/logout, and callback-host identity.
- Controller/router: main Hosts never receive default inviter; `.pro` and a synthetic third main Host use the same OAuth login/bind handoff, signed reset return, and stored wallet return path; provider, token-exchange, user-info, registration-policy, and duplicate-binding failures return through typed actions to the trusted peer/promotion origin; callback endpoints reject peer non-callback main Hosts; cached-enabled/fresh-disabled promotion handoff falls back safely; callback-main reset links ignore a conflicting legacy `ServerAddress`; promotion-domain inviter, replay/wrong-binding, ePay signature/idempotency, Stripe navigation-only, login-audit, and critical-limiter tests remain green.
- Frontend: type guards and URL builders assert target is a pure HTTPS Origin and ticket/result exists only in the fragment; popup messages check exact origin/source/provider/result; typecheck, targeted lint/format, and production build must pass.
- Deployment: render `docker compose config` with custom domains enabled and assert the service receives singular callback Origin, plural peer-main Origins, promotion suffix, and all Session trusted Origins before recreating the container. Verify an omitted plural value falls back to the singular callback Origin and an explicit 2/3-origin list makes the healthcheck probe every configured Host.

Focused assertion points (requirements, not a declaration that every row has an automated test):

| Boundary / test owner | Assertions |
|---|---|
| `common/custom_domain_test.go` and `common/url_validator_test.go` | Empty plural resolves a non-default singular Origin; non-empty plural retains the singular callback role and rejects missing membership/promotion Hosts; secure/trusted settings reject invalid combinations and wildcard Origins. |
| `middleware/custom_domain_test.go` | Under HTTP proxy upstream, enabled promotion refresh/logout accepts only its own exact HTTPS Origin without a static entry; a statically trusted foreign Origin still fails; static trust cannot make the apex or unknown Host routable. |
| `controller/custom_domain_oauth_test.go` and `controller/auth_flow_test.go` | Assert `success=false`, the correct action/target/provider/result, and the consumed/unconsumed state for each failure stage above. Existing `TestOAuthLoginConsumesFlowOnlyAfterProviderIdentity` must remain green. |
| Compose healthcheck | With a single custom callback Host or an explicit three-Origin list, capture the actual `Host` headers; assert every configured main is probed, any one failing probe makes the command fail, and no public DNS/TLS coverage is inferred. |

Implementation evidence: [configuration parser](../../../common/custom_domain.go), [Session settings](../../../common/session_cookie.go), [Host guard](../../../middleware/custom_domain.go), [OriginGuard](../../../middleware/auth_origin.go), [OAuth callbacks](../../../controller/oauth.go), [failure return helper](../../../controller/domain_oauth_handoff.go), and [Compose wiring/probe](../../../docker-compose.yml).

### 7. Wrong vs Correct

#### Wrong

```dotenv
# Wrong: static Origin trust neither enables promotion routing nor supports wildcards.
CUSTOM_DOMAIN_MAIN_ORIGIN=https://yeschoy.com
CUSTOM_DOMAIN_MAIN_ORIGINS=https://yeschoy.pro,https://ai.yeschoy.io
SESSION_COOKIE_TRUSTED_URL=https://*.yeschoy.io
```

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

```go
// Wrong after a validated cross-domain flow: the callback page loses its return action.
if err != nil {
    common.ApiError(c, err)
    return
}
```

```ts
window.location.replace(`${target}?ticket=${ticket}`)
```

#### Correct

Use the enabled configuration in section 3: both main settings remain active, the singular Origin is included in the plural list, and promotion entries are assigned/enabled separately.

```go
// Preserve the provider-call stage's consumption semantics while returning to the trusted origin.
if err != nil {
    handleOAuthFlowError(c, err, pendingFlow.Intent, pendingPayload, providerName)
    return
}
```

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

## Scenario: explicit primary-domain wildcards

### 1. Scope / Trigger

Apply when extending primary Host admission, Session Origin checks, stored callback destinations, or the Compose healthcheck. Exact rules keep precedence and existing compatibility. Promotion allocation/cache and Passkey RP behavior are unchanged.

### 2. Signatures

- `common.ParseCustomDomainMainOriginRule(raw, promotionSuffix string) (CustomDomainMainOriginRule, error)` returns `Origin`, exact/base `Host`, and `Wildcard`.
- `service.CustomDomainContext.IsWildcardMain` marks a concrete Main Host admitted through a wildcard; it is recomputed, never persisted or client-supplied.
- `common.NormalizeOrigin` remains exact-only; never pass wildcard rules into browser-Origin comparisons.

### 3. Contracts

- `CUSTOM_DOMAIN_MAIN_ORIGINS` accepts `https://*.example.com` alongside exact Origins. Each wildcard covers one valid ASCII DNS label only. Apex membership is explicit; another wildcard can explicitly cover a deeper base. The singular callback must be an explicit exact list member.
- Normalize wildcard base case, terminal DNS dot, root slash and `:443`; reject IP bases, public/private suffix bases via the existing `publicsuffix` dependency, and any base equal to/above/below the promotion suffix on dot boundaries. Base length is at most 251 so a concrete one-character label fits the 253-character hostname bound; labels are at most 63 characters.
- Startup Session trust requires exact primary entries only. Wildcard-derived and enabled promotion Hosts accept only their own exact HTTPS Origin (or valid Referer fallback), including behind HTTP TLS termination. A mismatch never falls through to static trusted Origins, even for a trusted sibling. Cookies remain Host-only.
- Resolution order: exact primary -> one-label wildcard -> existing promotion lookup. A wildcard-derived Main has concrete Host, zero DomainID/OwnerUserID, and `IsCallbackHost=false`. Never exempt relay paths or use forwarded Host to admit requests.
- OAuth/reset/payment store concrete Hosts and revalidate current policy. Removed rules invalidate login/bind tickets even with stale middleware; valid signed reset links and stored order returns fall back to the fixed callback Origin.
- Compose disables pathname expansion (`set -f`), probes each exact authority and `h.<base>` for each wildcard locally, and fails if any probe lacks a successful status body. It does not check public DNS/TLS.
- Rollout: compatible image with old exact settings, then reviewed wildcard settings and application container recreation. Rollback: restore exact settings before starting an older image. No migration is needed. Deployment requires separate authorization.

### 4. Validation & Error Matrix

| Input / boundary | Result |
|---|---|
| `api.example.com` with `https://*.example.com` | Main context with the actual Host; normal API authentication still applies |
| `a.api.example.com`, lookalike suffix, literal star, invalid label or overlong Host | No wildcard match; ordinary Host rejection |
| Partial/multiple star, HTTP, nonstandard wildcard port, userinfo/path/query/fragment, public/private suffix or promotion overlap | Startup/resolver construction error |
| Callback covered only implicitly by a wildcard | Startup error |
| Wildcard refresh/logout from a sibling, HTTP, nonstandard port, missing/null/multiple Origin | 403 before cookie-authenticated mutation |
| Removed wildcard with pending login/bind ticket | 403 with stale middleware, or Host rejection with refreshed middleware; no Session/binding mutation |
| Removed wildcard with valid signed reset / stored payment return | Fixed callback-site fallback |

### 5. Good/Base/Bad Cases

- Good: exact `yeschoy.com` plus `*.yeschoy.com` admits api/www/new labels; only the exact callback is statically trusted.
- Base: empty plural remains the single exact callback deployment; explicit exact peers retain static-Origin compatibility.
- Bad: trusting a wildcard string as an Origin, sharing parent-domain cookies, or configuring `*.yeschoy.io` to bypass promotion assignments.

### 6. Tests Required

- `common/custom_domain_test.go`: normalized mixed rules, exact Session membership, malformed and suffix-overlap rejection; browser normalization stays exact-only.
- `service/custom_domain_test.go`: single-label matching, explicit deeper rules, exact precedence, DNS bounds and stored-origin revalidation after removal.
- `middleware/custom_domain_test.go`: both refresh and logout behind HTTP TLS termination, own HTTPS/Referer success, static-trusted sibling/foreign rejection, promotion regressions.
- `router/api_router_custom_domain_test.go`: `api.yeschoy.com` status 200 and API-key endpoints 401 without credentials; invalid/unknown Hosts 404, regardless of forwarded Host.
- Controller suites: concrete OAuth state/return, provider failures, login/bind tickets, Host-only cookie, wrong Host/browser/replay/removal, fixed callback guards, signed reset and stored wallet fallbacks.
- `common/custom_domain_compose_test.go`: run the actual YAML command with a controlled wget stub; capture concrete Hosts, protect against filesystem glob expansion, preserve single-Origin fallback and propagate a required failing probe.

### 7. Wrong vs Correct

Wrong: `SESSION_COOKIE_TRUSTED_URL=https://*.yeschoy.com` or `wget --header='Host: *.yeschoy.com'`.

Correct:

```dotenv
CUSTOM_DOMAIN_MAIN_ORIGIN=https://yeschoy.com
CUSTOM_DOMAIN_MAIN_ORIGINS=https://yeschoy.com,https://*.yeschoy.com,https://yeschoy.pro,https://*.yeschoy.pro
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_TRUSTED_URL=https://yeschoy.com,https://yeschoy.pro
```

Concrete wildcard health probes use `Host: h.yeschoy.com` and `Host: h.yeschoy.pro`. DNS, certificates and ingress coverage remain independently required for externally exposed Hosts.
