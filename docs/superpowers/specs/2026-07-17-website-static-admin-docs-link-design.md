# Static Website Admin Documentation Link Design

## Goal

Make every documentation entry in the current `website-static/` navigation and mega footer use the existing backend setting `general_setting.docs_link`, so the console and production website share one administrator-controlled destination.

## Production seam

`flatkey.ai` is currently served by the static Nginx image in `website-static/`. The retired Next.js workflow for `website/` is manual-only and is not the production implementation seam for this feature.

This change is limited to the static website image and its production deployment workflow. It does not change the Go API, database, console SPA, router, legacy Next.js service, Terraform, or Cloudflare.

## Considered approaches

### 1. Same-origin Nginx proxy plus shared browser script — selected

Nginx exposes the backend public status response at the website's own `/api/status` path. A shared browser script reads `data.docs_link`, validates it, and updates only documentation anchors in the static navigation and mega footer.

This avoids browser CORS restrictions, keeps one runtime source of truth, and avoids duplicating the same script tag across every static HTML file.

### 2. Browser fetch directly from `console.flatkey.ai` — rejected

The production `/api/status` response does not currently include an `Access-Control-Allow-Origin` response header for `flatkey.ai`, so a browser cross-origin fetch would be blocked.

### 3. Bake the documentation URL into static HTML — rejected

A build-time value would require rebuilding the website after every admin configuration change and would no longer make the existing backend setting the single source of truth.

## Data flow

1. The static page is served with its existing visible local `/docs.html` header and footer links as the no-JavaScript and request-failure fallback.
2. Nginx injects `/assets/site-config.js` before the closing `</body>` of static HTML responses.
3. The script requests the same-origin `/api/status` endpoint with a three-second abort bound.
4. Nginx proxies that exact endpoint to `${APP_CONSOLE_ORIGIN}/api/status`, with three-second connect/read/send timeouts and a 60-second public browser cache header.
5. The script accepts only a successful payload whose `data.docs_link` is an absolute `http:` or `https:` URL.
6. On success, every navigation and mega-footer documentation anchor receives the normalized URL, `target="_blank"`, and `rel="noopener noreferrer"`.
7. Empty, malformed, unsafe, failed, or timed-out values leave the visible local `/docs.html` fallback unchanged.

## Components

### `website-static/html/assets/site-config.js`

Owns URL normalization, bounded status retrieval, navigation/footer link selection, and safe attribute application. It exports a small global test surface without adding a production dependency.

### `website-static/nginx.conf`

Owns the same-origin status proxy and injects the shared script into static HTML. The existing `@legacy` location keeps its own response filters, so legacy Next.js pages are intentionally outside this change.

### Static deployment workflow and image

The Docker image uses the official Nginx template mechanism with `APP_CONSOLE_ORIGIN`, filtered so Nginx runtime variables such as `$uri` are not substituted. The production workflow passes the existing website console-origin variable into the Cloud Run service and smoke-tests the proxied status endpoint.

## Error and security behavior

- Only absolute HTTP and HTTPS destinations are allowed.
- Invalid JSON, unsuccessful response envelopes, non-2xx responses, network failures, and timeouts return no destination.
- Local documentation links remain visible when JavaScript is disabled or the status request fails.
- An unvalidated value is never applied to a link.
- External links open in a new tab with `noopener noreferrer`.
- The public proxy exposes only the already-public `/api/status` payload and does not forward browser cookies.

## Testing

- Node's built-in test runner verifies URL validation, payload handling, timeout/error fallback, selector scope, and safe link attributes.
- Source-contract tests verify the Nginx proxy path, runtime origin template, three-second bounds, 60-second cache header, static HTML script injection, visible local fallback, Docker template installation, and production smoke check.
- Final verification includes the Node tests, `git diff --check`, static asset reference checks, and a branch scope comparison against `origin/main`.

## Deployment recommendation

- Router deploy: not required.
- Other deploy targets: `newapi-web` only through `GCP Deploy Website Static (v2)` after merge and production approval.
- `newapi-console`, `newapi-router`, legacy `newapi`, the legacy Next.js service, Terraform, and Cloudflare do not require deployment.
