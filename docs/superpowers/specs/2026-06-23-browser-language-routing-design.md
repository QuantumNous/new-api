# Browser Language Routing for Website

## Problem

The public website already has localized routes, but users who land on non-locale URLs always see the default English route first. That increases comprehension friction for ad and EDM traffic. The fix should route ordinary users to content matching their language preference while keeping SEO URLs stable for crawlers.

## Scope

This change only applies to the standalone Next.js website in `website/`.

It does not change the authenticated console, the Go API proxy, pricing data, blog data fetches, or locale content.

## Requirements

- Ordinary users visiting a public, non-locale GET page should be redirected to the best supported locale from a saved preference or `Accept-Language`.
- A saved manual language preference should take priority over browser language.
- English remains canonical at root paths, so English users stay on `/`, `/pricing`, and other non-locale URLs.
- Explicit locale paths such as `/ja`, `/zh/pricing`, and `/de/blog` must never be auto-rewritten.
- Bots, crawlers, and link preview agents must not receive language redirects.
- Internal framework paths, static assets, website APIs, and console redirect routes must not be redirected.
- Redirect logic must be deterministic across multiple application instances and must not rely on in-memory state.

## Design

Add `website/middleware.ts` to run before page rendering. The middleware will:

1. Ignore non-GET requests.
2. Ignore internal or non-page paths such as `/_next`, `/api`, `/favicon.ico`, static file extensions, `/sign-in`, `/sign-up`, `/dashboard`, `/install.sh`, and `/install.ps1`.
3. Ignore requests where the first path segment is already a supported locale.
4. Ignore bot user agents.
5. Resolve target locale from a cookie first, then `Accept-Language`.
6. Redirect only when the resolved locale is a non-English supported locale.

Use a cookie such as `fk_locale` for the user's manual language choice. Update `LanguageSwitcher` so clicking a language writes that cookie before navigation. The cookie is cross-node safe because all instances can read it from the request.

## Locale Matching

Language resolution should support exact and base-language matches:

- `ja-JP,ja;q=0.9,en;q=0.8` resolves to `ja`.
- `pt-BR,pt;q=0.9,en;q=0.8` resolves to `pt`.
- Unsupported values resolve to `en`.
- Malformed values resolve to `en`.
- Cookie values are accepted only when they are in `LOCALES`.

## Bot Policy

Bot requests must skip automatic language redirects so search engines and AI crawlers can crawl the stable URL graph and read canonical/hreflang correctly.

The allowlist should include mainstream search, social preview, and AI crawler user agents:

- Google: `Googlebot`
- Bing: `bingbot`
- Yahoo: `Slurp`
- DuckDuckGo: `DuckDuckBot`
- Baidu: `Baiduspider`
- Yandex: `YandexBot`
- Social previews: `facebookexternalhit`, `Twitterbot`, `LinkedInBot`
- OpenAI: `OAI-SearchBot`, `GPTBot`, `ChatGPT-User`
- Anthropic: `ClaudeBot`, `Claude-User`, `Claude-SearchBot`, plus `claude-code`
- Perplexity: `PerplexityBot`, `Perplexity-User`

Unknown crawlers that present as normal browsers cannot be reliably detected by middleware. That is acceptable because declared crawlers are protected, and explicit locale URLs remain stable for all clients.

## SEO Behavior

The existing localized pages remain the SEO source of truth:

- English canonical URL stays on the root path.
- Non-English canonical URL stays under `/<locale>`.
- `hreflang` alternates continue to point to each locale URL.
- `x-default` continues to point to the English root path.
- `sitemap.xml` continues to include every locale URL.
- Server-rendered HTML language follows the URL locale.

Automatic language routing is only an entry convenience for ordinary users. It must not change the crawlable URL graph.

## Testing

Add middleware tests covering:

- Ordinary browser with `Accept-Language: ja` visiting `/pricing` redirects to `/ja/pricing`.
- Ordinary browser with `Accept-Language: zh-CN` visiting `/` redirects to `/zh`.
- Ordinary browser with unsupported language stays on English root path.
- `fk_locale=fr` takes priority over `Accept-Language: ja`.
- `fk_locale=en` does not redirect.
- Explicit locale paths never redirect.
- Googlebot, `OAI-SearchBot`, `GPTBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, and `Perplexity-User` do not redirect.
- Internal/static/API paths do not redirect.

Run website verification:

```bash
cd website
bun run lint
bun run typecheck
bun run build
```

## Risks

- Bot detection can only work on declared user agents. It cannot detect crawlers that intentionally impersonate browsers.
- Overbroad path matching could redirect internal routes. Tests should cover ignored path groups.
- If a future locale is added to `LOCALES`, middleware matching should inherit it automatically.

## Acceptance Criteria

- Ordinary users on non-locale public page URLs get the best supported non-English locale when appropriate.
- Manual language selection persists via cookie and wins over browser language.
- Bots and AI crawlers are never auto-redirected by language logic.
- Canonical, hreflang, sitemap, and explicit locale URLs remain stable.
- Behavior is stateless except for request cookie/header input and works across multiple app instances.
