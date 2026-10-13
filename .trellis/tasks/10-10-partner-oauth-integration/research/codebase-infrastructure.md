# Codebase infrastructure facts for Partner OAuth (main @ be09fdb01)

## Origin / issuer / host
- `system_setting.ServerAddress` (default `http://localhost:3000`, set via option `ServerAddress`, `model/option.go:489`).
- Custom domain mode: `common.CustomDomainEnabled`, `common.CustomDomainMainOrigin` (default `https://yeschoy.com`), `common/custom_domain.go:15-50`.
- `middleware.CustomDomainContext()` is global (`main.go:201`); on enabled mode non main/custom hosts get 404; it never rewrites paths.
- `controller/custom_domain.go:10` `isCustomDomainCallbackRequest(c)` = true when custom domains disabled; otherwise only `Kind==main && IsCallbackHost`.
- Precedent for a host gate: `codex/client_auth:controller/oauth_client.go` `isOAuthClientHost` (custom-domain → callback host; otherwise compare `c.Request.Host` with parsed `ServerAddress` host).

## Request ID
- `middleware/request-id.go`; header/context key `common.RequestIdKey = "X-Oneapi-Request-Id"` (`common/constants.go:190`). Protocol needs `X-Request-Id`: set it from `c.GetString(common.RequestIdKey)`.

## Rate limiting
- `middleware/rate-limit.go`: `rateLimitFactory` (Redis `redisFixedWindowTake` or `inMemoryRateLimiter`), `writeRateLimited` writes empty 429 + `Retry-After`.
- `/api` group applies `GlobalAPIRateLimit` (empty-body 429). Partner routes must be registered on the engine, not inside `apiRouter`, so the protocol-shaped 429 body is used.
- No exported helper for custom 429 body; add a partner limiter in package `middleware` reusing `redisFixedWindowTake` / `inMemoryRateLimiter`.

## Auth
- `UserAuth()` reads `Authorization` Bearer only: dashboard access JWT (browser/desktop session) or PAT. No cookie auth → JSON POSTs are not CSRF-prone.
- `middleware.GetBrowserSessionAuthIdentity(c)` rejects PAT and desktop sessions (`middleware/auth.go:153`).
- Relay `TokenAuth` strips `sk-`, splits on `-`, looks up `model.ValidateUserToken` (Redis cached). Mutations must call `invalidateTokenCacheForMutation(key)` before DB write (`model/token.go:310-331`).

## Logging
- `middleware/logger.go:35` strips the whole query for `/api/oauth/` and `/oauth/` paths. New `/api/partner-oauth/` and SPA `/partner-authorize` paths carry the request token in the query and must be added.
- Access log never prints bodies or Authorization.

## API keys (model.Token)
- `common.GenerateKey()` → 48 random chars; DB stores the key without `sk-`; UI and clients use `sk-` + key.
- Statuses `common.TokenStatusEnabled=1 / Disabled=2 / Expired=3 / Exhausted=4`. Delete is GORM soft delete (`DeletedAt`).
- Registration default token (`controller/user.go:325-350`): `UnlimitedQuota: true`, `ExpiredTime: -1`, `Group = "auto"` iff `setting.DefaultUseAutoGroup`.
- `AddToken` enforces `operation_setting.GetMaxUserTokens()` (default 1000) and name ≤ 50.

## Routing
- `router/main.go`: API → dashboard → relay (adds CORS etc. for later groups) → … → `SetWebRouter` (NoRoute SPA). Root routes like `GET /oauth/handoff` are registered on the engine before NoRoute. Root param group `/:mode/mj` coexists with static routes.
- CORS is per-route; partner endpoints need none (protocol: no SPA cross-origin).

## Admin UI pattern
- Custom OAuth providers: `model/custom_oauth_provider.go`, `controller/custom_oauth.go` (DTO hides secret), routes `/api/custom-oauth-provider/*` with `RootAuth()`.
- Frontend `web/src/features/system-settings/auth/custom-oauth/` (api.ts, section, table, RHF/Zod form dialog), registered in `web/src/features/system-settings/auth/section-registry.tsx` (`id: 'custom-oauth'`).

## Frontend routing
- `/oauth/$provider` public callback route exists; `_authenticated/route.tsx` redirects to `/sign-in?redirect=<href>`.
- Consent precedent: `web/src/routes/_authenticated/desktop-authorize/index.tsx` + `web/src/features/desktop-authorization/`. Use `/partner-authorize` to avoid the `/oauth/$provider` namespace.
- No global `X-Frame-Options` for SPA pages (only `controller/domain_oauth_bridge.go`); the consent page needs its own frame guard.

## Users
- `model/user.go`: `Username`, `DisplayName`, `Status` (`common.UserStatusEnabled=1`, `Disabled=2`), `AuthVersion`, soft `DeletedAt`.

## Migration / cleanup
- `model/main.go:320-401` `migrateDB()` AutoMigrate list.
- `service/auth_cleanup.go` `cleanupAuthArtifacts()` hourly (master only) — hook partner token cleanup here.

## Reusable from codex/client_auth (reference only, not merged)
- PKCE verify, strict form parsing (`parseOAuthForm`, `singleOAuthFormValue`, media type + MaxBytesReader + UTF-8), no-store headers, HTML error page shape, OAuth JSON error writer.
