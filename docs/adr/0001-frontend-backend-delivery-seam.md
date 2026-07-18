# ADR 0001: Frontend/backend delivery seam

- Status: Accepted
- Date: 2026-07-18
- Context: monorepo `new-api` historically embeds dual React themes into a single Go binary

## Decision summary

Keep a **single Git repository**. Keep the **embedded dual-theme binary as the default compatibility path**. Add an explicit **delivery seam** so operators can also ship:

1. a pure Go backend (`-tags frontend_external` + `FRONTEND_MODE=disabled|redirect`)
2. a standalone default-theme SPA served by Nginx that reverse-proxies API/Relay traffic on the **same public origin**

## Why not two repositories

- Product, release tags, `VERSION`, CI quality gates, and operational docs already share one revision.
- Dual-repo split would force synchronized versioning for SPA ↔ API contracts (`/api/status`, OAuth callbacks, cookie names) without removing the need for integration tests.
- Contributors already navigate `router/`, `controller/`, and `web/default/` in one tree; the cost of monorepo coupling is lower than the cost of split release coordination for this product stage.

## Why keep embedded by default

- Existing Windows single-exe, Docker Compose, and Electron-style distributions depend on one artifact.
- Rollback and incident response stay simple: replace one binary/image.
- The new seam is opt-in; operators who do not set `FRONTEND_MODE` or the build tag keep prior behavior (`auto` + embed).

## Build tag: `frontend_external`

| File | Build constraint | Role |
|---|---|---|
| `frontend_assets_embedded.go` | `//go:build !frontend_external` | `//go:embed` both themes; inject analytics into index HTML |
| `frontend_assets_external.go` | `//go:build frontend_external` | Returns empty `ThemeAssets` |

`main` always calls `prepareFrontendAssets()` then `router.SetRouterForPlane(...)`. Embedded mode refuses empty assets via `ThemeAssets.Available()` so a pure-backend binary cannot panic inside `EmbedFolder`.

## Runtime: `FRONTEND_MODE`

| Value | Semantics |
|---|---|
| `auto` | Legacy: non-master + `FRONTEND_BASE_URL` → redirect; otherwise embed |
| `embedded` | Force embed; error if assets missing |
| `redirect` | Force redirect to origin `FRONTEND_BASE_URL` even on master |
| `disabled` | No web `NoRoute`; pure API 404 for unknown paths |

`FRONTEND_BASE_URL` in redirect mode must be an absolute HTTP(S) origin: no userinfo, path (except empty/`/`), query, or fragment. Redirects preserve `RequestURI` (path + query).

## Why same-origin frontend→backend proxy is recommended

Preferred production layout:

```text
Public origin (HTTPS)
  └── Nginx frontend container
        ├── static SPA (/ and /assets)
        └── reverse proxy → backend:3000 for
              /api /v1 /v1beta /mj /:mode/mj /pg /suno /kling /jimeng
              /healthz /livez /readyz
```

Consequences:

| Concern | Same-origin proxy | Cross-origin SPA + API |
|---|---|---|
| Session cookies | First-party; existing `SESSION_COOKIE_*` keys stay sufficient | Needs careful `SameSite`, domain, and often broader CORS allowlist with credentials |
| CSRF | Same site model preserved | Cross-site form/fetch surface expands |
| OAuth callbacks | Single public host | Must register extra redirect URIs and trusted URLs |
| SSE | `proxy_buffering off` + long timeouts on one host | Browser CORS + buffering at each edge hop |
| WebSocket `/v1/realtime` | `Upgrade` / `Connection` on same host | Extra origin checks and sticky proxy rules |

`/metrics` is **not** proxied on the public frontend edge; scrape on the backend network with `METRICS_TOKEN`.

## Images and CI

- `Dockerfile` — integrated (unchanged default)
- `Dockerfile.backend` — Go 1.26.5 builder, Debian runtime, `-tags frontend_external`, default `FRONTEND_MODE=disabled`, no Bun
- `deploy/separated/Dockerfile.frontend` — Bun 1.3.14 (pinned digest) builds `web/default`; `nginxinc/nginx-unprivileged` on 8080
- Quality workflow builds all three images and runs `nginx -t` on the rendered frontend config

## Rollback

1. **Config only:** point the edge back to an integrated binary/image; unset `FRONTEND_MODE` or set `auto`.
2. **Artifact only:** redeploy the previous integrated image digest/tag from the release inventory.
3. **DB:** migrations remain additive; no schema down-migration is required for this delivery change.

## Alternatives considered

1. **Two repositories** — rejected for release coupling (see above).
2. **Backend serves SPA from volume mount without embed** — possible later; current seam prefers an immutable frontend image for cache headers and independent scaling.
3. **Default to separated images** — rejected; would break existing single-artifact operators without notice.
4. **Expand CORS as the primary multi-host strategy** — allowed via existing middleware for deliberate multi-origin setups, not recommended as the default path for cookie sessions.

## Consequences

- Positive: independent frontend deploys, smaller pure-backend images, clearer APP_PLANE/RUN_MODE + UI delivery matrix.
- Negative: two more Dockerfiles and CI image builds; operators must set `TRUSTED_PROXY_CIDRS` correctly when Nginx sits in front.
- Neutral: classic theme is still embedded in the integrated path; separated image currently ships default theme only (classic remains available via integrated build or a future sibling image).

## References

- `frontend_assets_embedded.go` / `frontend_assets_external.go`
- `router/main.go` (`parseFrontendMode`, `setFrontendRouter`, …)
- `deploy/separated/README.md`
- `docs/operations/runtime-separation.md`
- `docs/operations/build-and-release.md`
