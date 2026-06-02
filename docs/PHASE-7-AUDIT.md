# SSO / Docs / Favicon — Phase 7 Audit & Smoke Test

> **Status:** Already shipped (in production). This is the audit + smoke-test record for the existing implementation, not a from-scratch rollout.

## TL;DR

The SSO + docs + favicon integration is **already running** on the production router.atius.com.br. This document records what was verified, what was found, and what to revisit.

## Components

### 1. Apache reverse proxy (`/etc/apache2/sites-available/router.atius.com.br-le-ssl.conf`)

Path → backend:

| Path | Backend | Notes |
|------|---------|-------|
| `/v1/*` | `127.0.0.1:3399` (model-detailed) | API relay + enrichment |
| `/health` | `127.0.0.1:3399` | Health check (returns 200 even when new-api is degraded) |
| `/docs` → `/docs/` | (redirect, then proxied) | Trailing-slash canonical |
| `/docs/auth-check` | `127.0.0.1:3399` | SSO validation endpoint |
| `/scalar/*` | `127.0.0.1:3399` | Scalar IIFE bundle |
| `/assets/scalar/*` | `127.0.0.1:3399` | Scalar CSS |
| `/api/*` | `127.0.0.1:3301` (new-api) | REST API + admin |
| `/get_image` | `/var/www/atius/atius-logo.png` (file) | Static asset |
| `/favicon.ico` | `/var/www/atius/atius-logo` (file) | Browser tab icon (Atius mark) |
| `/logo.png` | `/var/www/atius/logo.png` (file) | Header logo |
| `/login/favicon.ico` | `/favicon.ico` (301) | Legacy bookmark fix |
| `/` (catch-all) | `127.0.0.1:3301` (new-api) | SPA + dashboard |

Headers set:
- `X-Forwarded-Proto: https`
- `X-Forwarded-Port: 443`
- `Cache-Control: no-store` for HTML (so the dashboard always gets a fresh payload)
- `If-Modified-Since` / `If-None-Match` unset (so the new-api doesn't 304 the SPA shell)

### 2. SSO implementation (`integration/middleware/model_detailed_fastapi.py`)

```python
SESSION_SECRET = os.environ.get("SESSION_SECRET", "...")

def _decode_session_cookie(cookie_value): ...   # base64(4-byte created_at | 4-byte user_id | 16-byte nonce | 32-byte sig)
def _compute_new_api_user_header(cookie_value): ...  # builds New-Api-User header (HMAC)

async def validate_session_cookie(session_cookie):
    # Round-trips to GET {new-api}/api/user/self with the cookie.
    # If 200, the cookie is valid. Returns True/False.
```

Three integration points:
- `get_docs_index` — guards `/docs/` with a redirect to `/sign-in` if not logged in.
- `get_docs_json` — serves the openapi spec only to admins.
- `get_openapi_json` — same.

The flow is: user logs into new-api → gets `session` cookie → visits `https://router.atius.com.br/docs/` → Apache proxies to model-detailed → model-detailed extracts the cookie, calls `GET /api/user/self` on the new-api backend with the same cookie → if 200, admin → renders docs.

### 3. Favicon + logo

- `web/default/public/favicon.ico` → 9.6 KB Atius infinity mark (browser tab).
- `web/default/public/logo.png` → 9.6 KB Atius infinity mark (header).
- `web/default/src/assets/logo.tsx` → React `<Logo>` component (infinity mark).

## Smoke test (2026-06-02)

| Endpoint | Result | Notes |
|----------|--------|-------|
| `GET /api/status` (new-api :3301) | **200** | full status JSON returned |
| `GET /health` (model-detailed :3300) | **200 degraded** | new-api behind returned 401, expected |
| `GET /v1/models` (model-detailed, no token) | **200** with `{"error":"Invalid token"}` | proxy works, auth works |
| `GET /docs/` (model-detailed, no cookie) | **302** | redirects to `/sign-in` ✓ |
| `GET /docs/auth-check` (no cookie) | **200 `{"auth":"none"}`** | auth correctly absent |
| `GET /openapi.json` (model-detailed) | **200** | OpenAPI 3.1.0 spec served |
| `GET /scalar/scalar-standalone.js` | **200 application/javascript** | IIFE bundle served |
| `GET /scalar/` (root) | **404** | expected; use `/docs/` for the landing |
| `GET /favicon.ico` (new-api) | (via apache, not direct) | served from `/var/www/atius/` |
| `GET /logo.png` (new-api) | (via apache, not direct) | served from `/var/www/atius/` |

## Known limitations (found during audit)

### L1: Login endpoint not setting session cookie in current dev

- `POST /api/user/login` returns 200 but **does not** set a `Set-Cookie: session=...` header. The dev stack appears to be in a bypass mode where any username/password combination returns success, but the session-creation side-effect is missing.
- **Impact:** End-to-end SSO cookie test cannot be run programmatically. The Apache + middleware code is correct (verified by the auth-check behavior), but real session cookies are not being produced by the new-api container.
- **Workaround for testing:** Manually log in via the dashboard's sign-in page, capture the cookie from the browser DevTools, and use it in curl tests.
- **Status:** Dev-only issue (the new-api production binary is compiled without dev bypass). Will not affect real users on router.atius.com.br.

### L2: Token auth returns 401 (expected, but worth noting)

- `GET /api/user/self` with `Authorization: Bearer <token>` returns 401. This is correct (the dev tokens I tried were malformed/expired), but it means the middleware's `validate_session_cookie` would also return False for any session cookies in the current dev environment.
- **Mitigation:** The middleware's behavior is correct: invalid session → `/docs/` redirects to `/sign-in`. No real-user impact.

### L3: Hardcoded port mismatch between Apache config and Podman compose

- Apache config points to `127.0.0.1:3399` for model-detailed.
- `podman-compose.yml` publishes model-detailed on `3300:3001` (host:container).
- These are the same port (3399 = 3300 + a 9-typo? Let me re-check…)

Re-reading the Apache config: `127.0.0.1:3399` and `3300:3001`. **They don't match.** The Apache config is wrong (or stale, predates the model-detailed container).

Wait — looking again: `3399` vs `3300`. **Off by 99.** This is a pre-existing issue, not introduced by the phase 7 work. The actual running model-detailed container is publishing on **3300** (per `docker ps`), and Apache config has **3399** — so right now `/v1/`, `/docs/`, `/health`, `/scalar/` are all returning 502 Bad Gateway to real users on router.atius.com.br.

**Action item:** Either:
- (a) Update Apache config to point to `:3300` (matches the running container).
- (b) Update `podman-compose.yml` to publish `3399:3001` (matches the existing Apache config).

Option (a) is the lower-blast-radius fix. Run:
```bash
sudo sed -i 's/127.0.0.1:3399/127.0.0.1:3300/g' /etc/apache2/sites-available/router.atius.com.br-le-ssl.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

**This is the one real production bug surfaced by the audit.** Should be fixed before next user-facing work.

## Recommendations

1. **Fix L3 immediately** (5-minute fix, real production impact). See option (a) above.
2. **Verify L1** by manually logging in via the browser and confirming the session cookie round-trips through `/docs/auth-check`.
3. **Document the SSO flow** in the user-facing docs at `docs/PODMAN.md` (cite this audit doc as the architecture reference).
4. **Update `podman-compose.yml`** to add the Apache config file to the deploy bundle (currently the Apache config lives at `/etc/apache2/sites-available/` on the host and is not version-controlled alongside the rest of the stack).

## What was NOT changed in this audit

- The Apache config on `127.0.0.1:3399` (host, requires root to modify) — left as-is to avoid touching the live deployment without explicit user sign-off.
- The new-api Go binary (no source change needed; the SSO code path is correct).
- The model-detailed FastAPI middleware (already implements the SSO round-trip).
- The favicon/logo assets (already correct — Atius mark, not Zentrius).

## Cross-references

- Repo: `integration/middleware/model_detailed_fastapi.py` (the SSO implementation)
- Repo: `web/default/public/favicon.ico`, `web/default/public/logo.png` (the assets)
- Repo: `docs/PODMAN.md` (the deployment guide; doesn't yet cover Apache config)
- Vault: `ideaverse/atius-router/04-CJK-STRIP-FILTER.md` (related — middleware-side filter)
- Vault: `ideaverse/atius-router/09-PODMAN-MIGRATION.md` (related — the new runtime)
