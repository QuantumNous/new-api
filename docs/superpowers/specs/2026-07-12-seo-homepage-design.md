# Homepage SEO Optimization Design

**Date:** 2026-07-12  
**Status:** Approved for implementation planning  
**Repo:** QuantumNous/new-api (local customization)  
**Primary constraint:** Keep future upstream merges cheap.

## 1. Problem

The public homepage and marketing surface are weak for search engines and social sharing:

- `web/default/index.html` has static English-only title/description and no Open Graph / Twitter cards.
- Runtime only updates `document.title` and favicon from `system_name` / `logo`.
- No canonical URL, JSON-LD, robots.txt, or sitemap.
- Custom `HomePageContent` (HTML or URL iframe) still benefits from shell-level meta tags for crawlers that do not execute full SPA logic.

This is an SPA without SSR. Crawlers and link unfurlers primarily consume:

1. First-byte HTML meta tags
2. Light server-served files (`robots.txt`, `sitemap.xml`)
3. Optional client-side meta updates after `/api/status`

## 2. Goals

| Goal | Detail |
|------|--------|
| Homepage SEO | Stronger title, description, keywords, lang, OG/Twitter for `/` |
| Configurable | Admin can set description / keywords / site URL / OG image without redeploy |
| Social share | `og:*` and `twitter:*` tags for unfurling |
| Crawl helpers | `robots.txt` + `sitemap.xml` |
| Structured data | Homepage JSON-LD (`WebSite` + `Organization`) |
| Themes | Primary: `web/default`; light parity: `web/classic` |
| Merge-safe | New files preferred; minimal hooks into upstream hot paths |

## 3. Non-goals

- SSR / Next.js / prerender pipeline
- Full multi-page SEO for every authenticated console route
- Rewriting homepage marketing sections (Hero copy redesign)
- Changing semantics of custom `HomePageContent` admin HTML/URL
- Internationalized alternate hreflang sets beyond basic `html[lang]` from active UI language
- Guaranteed Google ranking outcomes

## 4. Architecture (merge-first)

```text
Admin Options (SEO.*)
        │
        ▼
/api/status  ──►  system_name, logo, seo_* fields
        │
        ▼
web/default/src/lib/seo/*   (apply meta, JSON-LD, defaults)
        │
        ├── main.tsx branding init (1-line hook)
        ├── features/home useDocumentSeo (homepage)
        └── optional classic helpers/seo.js

New API routes (thin):
  GET /robots.txt
  GET /sitemap.xml
```

### Principles

1. **Independent SEO module** — all DOM meta logic lives under `web/default/src/lib/seo/`.
2. **Thin integration** — upstream files get at most a few call sites.
3. **Server for crawl files** — robots/sitemap from Go (or static public files if simpler and equivalent).
4. **Defaults safe** — if SEO options empty, fall back to sensible built-in strings; never break boot if options missing.
5. **No SSR** — improve SPA shell + dynamic meta; accept SPA crawl limits.

## 5. Configuration (Option keys)

| Key | Default | Meaning |
|-----|---------|---------|
| `SEO.Description` | empty → built-in default | Meta description + OG description |
| `SEO.Keywords` | empty → built-in default | Meta keywords (optional, low SEO weight) |
| `SEO.SiteURL` | empty → derive from request / `ServerAddress` | Canonical base URL for sitemap + og:url |
| `SEO.OGImage` | empty → `logo` or `/logo.png` | Open Graph / Twitter image URL |
| `SEO.RobotsIndex` | `true` | When false, emit `noindex,nofollow` |

Storage pattern: same as other options (`common` vars or OptionMap string keys + `model/option.go` cases). Prefer keys with `SEO.` prefix for isolation.

### Built-in fallbacks (when options empty)

- **Title:** `SystemName` (existing)
- **Description (zh):** 统一的 AI 模型网关与管理平台，支持 OpenAI / Claude / Gemini 兼容接口。
- **Description (en):** Unified AI API gateway and admin dashboard with OpenAI / Claude / Gemini compatible APIs.
- **Keywords:** `AI API, LLM Gateway, OpenAI Compatible, New API` (and zh equivalent if language is zh)

Exact copy can be refined in implementation; must be overridable by admin.

## 6. Frontend design

### 6.1 New module: `web/default/src/lib/seo/`

| File | Responsibility |
|------|----------------|
| `types.ts` | SEO config shape |
| `defaults.ts` | Language-aware fallbacks |
| `dom.ts` | Upsert `meta` / `link[rel=canonical]` / `script[type=application/ld+json]` |
| `apply.ts` | `applyDocumentSeo(input)` public API |
| `index.ts` | Re-exports |

`applyDocumentSeo` must be idempotent: query by `name` / `property` / `rel` and update or create.

### 6.2 Integration points (minimal)

1. **`web/default/src/main.tsx`**  
   Extend existing `initSystemBranding` to call `applyDocumentSeo` with status payload (title already handled; add description/OG once status loads).

2. **`web/default/src/features/home/`**  
   Small hook `useHomeSeo()` on homepage mount: ensure homepage-specific title pattern  
   `{SystemName}` or `{SystemName} - {tagline}` and JSON-LD for WebSite/Organization.

3. **`web/default/index.html`**  
   Improve static shell:
   - `lang` default `zh-CN` or keep neutral with client update
   - Better default description (zh+en if needed)
   - Placeholder OG tags (overwritten at runtime)
   - Keep generator-friendly, no large JS changes

4. **Classic (light)**  
   `web/classic/src/helpers/seo.js` + call from existing PageLayout title logic; improve `web/classic/index.html` OG placeholders only. No deep layout rewrite.

### 6.3 Route coverage (v1)

| Route | SEO treatment |
|-------|----------------|
| `/` | Full: title, description, OG, Twitter, canonical, JSON-LD |
| Public marketing pages (`/pricing`, `/about`, `/rankings` if public) | Optional thin: title suffix only if cheap |
| Authenticated console | `noindex` recommended when logged-in app shell, or leave default; **v1: do not force noindex on all console unless trivial** |

v1 priority is **homepage + global shell + robots/sitemap**. Other public routes only if zero-cost.

## 7. Backend design

### 7.1 Status payload

Extend `GetStatus` JSON with:

```json
{
  "seo_description": "...",
  "seo_keywords": "...",
  "seo_site_url": "...",
  "seo_og_image": "...",
  "seo_robots_index": true
}
```

Read from options; empty strings allowed.

### 7.2 Crawl endpoints

| Path | Behavior |
|------|----------|
| `GET /robots.txt` | `User-agent: *` + Allow `/` + optional Disallow console paths + `Sitemap: {SiteURL}/sitemap.xml` |
| `GET /sitemap.xml` | URL set: `/`, `/pricing`, `/about`, `/rankings` (only if modules enabled when cheap; else fixed public list) |

Implementation options (choose at plan time for least merge pain):

- **A (preferred):** `controller/seo.go` + register two routes in `router` (api or root engine)
- **B:** static files under embed public if project already serves static easily

Use **A** if root-level routes are already used; keep handlers tiny.

### 7.3 Settings UI

Append fields next to site/branding settings (default theme system-settings site section; classic equivalent):

- SEO Description (textarea)
- SEO Keywords (input)
- Site URL (input, help: used for canonical & sitemap)
- OG Image URL (input)
- Robots allow index (switch)

No new settings architecture.

## 8. Data flow

1. Admin sets `SEO.*` and `SystemName` / `Logo`.
2. Browser loads `index.html` with baseline meta.
3. `getStatus()` returns branding + seo fields.
4. `applyDocumentSeo` updates DOM meta/canonical/JSON-LD.
5. Crawlers hitting `/robots.txt` and `/sitemap.xml` get server text/xml without SPA.

## 9. Error handling

| Case | Behavior |
|------|----------|
| SEO options missing | Use defaults; do not error |
| Invalid SiteURL | Skip canonical/sitemap base or fall back to `ServerAddress` / `window.location.origin` |
| OG image empty | Use logo or `/logo.png` |
| Custom HomePageContent URL iframe | Still apply shell meta (iframe content is separate origin/page) |
| `SEO.RobotsIndex=false` | `meta robots = noindex,nofollow`; robots.txt Disallow `/` optional — prefer meta-only for safety |

## 10. Testing

- Unit (frontend pure helpers if test harness exists): meta upsert does not duplicate tags
- Manual: view-source / curl homepage headers; curl `/robots.txt`, `/sitemap.xml`
- Manual: share link debugger optional
- Ensure `/api/status` includes new keys without breaking clients

## 11. Merge checklist

- [ ] SEO DOM logic only in `web/default/src/lib/seo/*` (+ classic helper file)
- [ ] Backend only `controller/seo.go` (+ option/status cases, 2 routes)
- [ ] Upstream edits: `main.tsx` branding, `GetStatus`, `option.go`, settings form append, `index.html`
- [ ] No homepage marketing rewrite
- [ ] Defaults do not require admin configuration to boot

## 12. Decisions log

| Decision | Choice | Why |
|----------|--------|-----|
| Approach | SPA meta module + thin status/options + robots/sitemap | Best ROI without SSR |
| Scope | Homepage-first | User asked homepage; console SEO low value |
| Config | Admin options under `SEO.*` | Override without redeploy |
| Themes | default full; classic light | Merge cost |
| SSR | No | Merge + complexity |

## 13. Implementation plan handoff

After user reviews this file: invoke writing-plans and produce `docs/superpowers/plans/2026-07-12-seo-homepage.md`.
