# Homepage SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve homepage and public shell SEO (title/description/OG/Twitter/canonical/JSON-LD/robots/sitemap) with admin-configurable options, while keeping upstream merges cheap.

**Architecture:** Independent SEO helpers under `web/default/src/lib/seo/*`; expose `SEO.*` options via `GetStatus` + settings UI; serve `robots.txt`/`sitemap.xml` from a tiny Go controller; thin hooks in `main.tsx` and homepage.

**Tech Stack:** Go/Gin, existing Option system, React (default + light classic), DOM meta upsert (no SSR).

**Spec:** `docs/superpowers/specs/2026-07-12-seo-homepage-design.md`

## Global Constraints

- Merge-first: new files preferred; minimal edits to upstream hot files.
- No SSR / no homepage marketing rewrite.
- Empty SEO options → safe built-in defaults; boot must not break.
- Default theme is primary; classic gets light parity only.
- Do not force noindex on all console routes in v1.

## File map

| Path | Role |
|------|------|
| Create `common/seo.go` | SEO option vars + defaults helpers |
| Modify `model/option.go` | Init + update cases for SEO.* |
| Modify `controller/misc.go` | GetStatus fields |
| Create `controller/seo.go` | robots.txt + sitemap.xml |
| Modify `router/main.go` or `router/api-router.go` | Register 2 routes (prefer root engine before NoRoute) |
| Create `web/default/src/lib/seo/*` | DOM apply + defaults |
| Modify `web/default/src/main.tsx` | Call apply on status load |
| Create/modify home SEO hook | Homepage JSON-LD + meta |
| Modify `web/default/index.html` | Stronger static shell |
| Modify site settings types + SystemInfoSection | Admin SEO fields |
| Create `web/classic/src/helpers/seo.js` + small call | Classic light parity |
| Modify `web/classic/index.html` | OG placeholders |

---

### Task 1: Backend SEO options + status + crawl routes

**Files:**
- Create: `common/seo.go`
- Modify: `model/option.go`
- Modify: `controller/misc.go` (`GetStatus`)
- Create: `controller/seo.go`
- Modify: `router/main.go` (register before web NoRoute)

**Interfaces:**
- Produces options:
  - `SEO.Description` string
  - `SEO.Keywords` string
  - `SEO.SiteURL` string
  - `SEO.OGImage` string
  - `SEO.RobotsIndex` bool (default true)
- Status keys: `seo_description`, `seo_keywords`, `seo_site_url`, `seo_og_image`, `seo_robots_index`
- Routes: `GET /robots.txt`, `GET /sitemap.xml`

- [ ] **Step 1: Add common vars**

```go
// common/seo.go
package common

var (
	SEODescription  = ""
	SEOKeywords     = ""
	SEOSiteURL      = ""
	SEOOGImage      = ""
	SEORobotsIndex  = true
)

func DefaultSEODescription(lang string) string {
	if strings.HasPrefix(strings.ToLower(lang), "zh") {
		return "统一的 AI 模型网关与管理平台，支持 OpenAI / Claude / Gemini 兼容接口。"
	}
	return "Unified AI API gateway and admin dashboard with OpenAI / Claude / Gemini compatible APIs."
}

func DefaultSEOKeywords(lang string) string {
	if strings.HasPrefix(strings.ToLower(lang), "zh") {
		return "AI API,大模型网关,OpenAI兼容,Claude,Gemini,New API"
	}
	return "AI API, LLM Gateway, OpenAI Compatible, Claude, Gemini, New API"
}
```

(Add `strings` import.)

- [ ] **Step 2: Wire OptionMap**

In `InitOptionMap`:

```go
common.OptionMap["SEO.Description"] = common.SEODescription
common.OptionMap["SEO.Keywords"] = common.SEOKeywords
common.OptionMap["SEO.SiteURL"] = common.SEOSiteURL
common.OptionMap["SEO.OGImage"] = common.SEOOGImage
common.OptionMap["SEO.RobotsIndex"] = strconv.FormatBool(common.SEORobotsIndex)
```

In `updateOptionMap`:

```go
case "SEO.Description":
	common.SEODescription = value
case "SEO.Keywords":
	common.SEOKeywords = value
case "SEO.SiteURL":
	common.SEOSiteURL = value
case "SEO.OGImage":
	common.SEOOGImage = value
```

And in Enabled suffix switch (or dedicated):

```go
case "SEO.RobotsIndex":
	common.SEORobotsIndex = boolValue
```

(If `SEO.RobotsIndex` does not end with `Enabled`, handle in string cases with `value == "true"`.)

- [ ] **Step 3: Extend GetStatus**

In `controller/misc.go` data map:

```go
"seo_description":  common.SEODescription,
"seo_keywords":     common.SEOKeywords,
"seo_site_url":     common.SEOSiteURL,
"seo_og_image":     common.SEOOGImage,
"seo_robots_index": common.SEORobotsIndex,
```

- [ ] **Step 4: Implement crawl handlers**

`controller/seo.go`:

```go
func RobotsTxt(c *gin.Context) {
	site := strings.TrimRight(common.SEOSiteURL, "/")
	if site == "" {
		site = strings.TrimRight(system_setting.ServerAddress, "/")
	}
	var b strings.Builder
	b.WriteString("User-agent: *\n")
	if common.SEORobotsIndex {
		b.WriteString("Allow: /\n")
		b.WriteString("Disallow: /console\n")
		b.WriteString("Disallow: /dashboard\n")
		b.WriteString("Disallow: /api/\n")
		if site != "" {
			b.WriteString("Sitemap: " + site + "/sitemap.xml\n")
		}
	} else {
		b.WriteString("Disallow: /\n")
	}
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(b.String()))
}

func SitemapXML(c *gin.Context) {
	site := strings.TrimRight(common.SEOSiteURL, "/")
	if site == "" {
		site = strings.TrimRight(system_setting.ServerAddress, "/")
	}
	if site == "" {
		// fall back to request host
		scheme := "https"
		if c.Request.TLS == nil {
			scheme = "http"
		}
		site = scheme + "://" + c.Request.Host
	}
	paths := []string{"/", "/pricing", "/about", "/rankings"}
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	for _, p := range paths {
		b.WriteString("<url><loc>" + site + p + "</loc></url>")
	}
	b.WriteString(`</urlset>`)
	c.Data(http.StatusOK, "application/xml; charset=utf-8", []byte(b.String()))
}
```

- [ ] **Step 5: Register routes on engine root**

In `router/main.go` `SetRouter`, **before** `SetWebRouter` / NoRoute:

```go
router.GET("/robots.txt", controller.RobotsTxt)
router.GET("/sitemap.xml", controller.SitemapXML)
```

Must be registered early enough that web NoRoute does not swallow them.

- [ ] **Step 6: Verify**

```bash
go build -o /tmp/new-api-local .
# run and curl:
curl -sS http://127.0.0.1:3001/robots.txt
curl -sS http://127.0.0.1:3001/sitemap.xml | head
curl -sS http://127.0.0.1:3001/api/status | jq '.data.seo_description,.data.seo_robots_index'
```

- [ ] **Step 7: Commit**

```bash
git add common/seo.go model/option.go controller/misc.go controller/seo.go router/main.go
git commit -m "feat: SEO options, status fields, robots and sitemap"
```

---

### Task 2: Frontend SEO library + shell HTML

**Files:**
- Create: `web/default/src/lib/seo/types.ts`
- Create: `web/default/src/lib/seo/defaults.ts`
- Create: `web/default/src/lib/seo/dom.ts`
- Create: `web/default/src/lib/seo/apply.ts`
- Create: `web/default/src/lib/seo/index.ts`
- Modify: `web/default/index.html`

**Interfaces:**

```ts
export type SeoInput = {
  title?: string
  description?: string
  keywords?: string
  siteUrl?: string
  path?: string // default '/'
  ogImage?: string
  robotsIndex?: boolean
  lang?: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[] | null
}
export function applyDocumentSeo(input: SeoInput): void
```

- [ ] **Step 1: Implement `dom.ts` upsert helpers**

```ts
export function upsertMetaByName(name: string, content: string) {
  if (!content) return
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function upsertMetaByProperty(property: string, content: string) {
  if (!content) return
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function upsertLinkRel(rel: string, href: string) {
  if (!href) return
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function upsertJsonLd(id: string, data: unknown) {
  let el = document.getElementById(id) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}
```

- [ ] **Step 2: Implement `apply.ts`**

Set `document.title`, `html[lang]`, description/keywords/robots, og:title/description/url/image/type/site_name, twitter:card/title/description/image, canonical, optional JSON-LD id `seo-jsonld`.

Resolve description/keywords from input or `defaults.ts` by lang.

- [ ] **Step 3: Improve `index.html`**

- `lang="zh-CN"`
- Richer default description (zh)
- Add baseline:

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="New API" />
<meta property="og:description" content="..." />
<meta name="twitter:card" content="summary" />
<link rel="canonical" href="/" />
```

- [ ] **Step 4: Commit**

```bash
git add web/default/src/lib/seo web/default/index.html
git commit -m "feat(web-default): add SEO DOM helpers and index.html shell"
```

---

### Task 3: Wire status branding + homepage SEO

**Files:**
- Modify: `web/default/src/main.tsx` (`initSystemBranding`)
- Create: `web/default/src/features/home/hooks/use-home-seo.ts`
- Modify: `web/default/src/features/home/index.tsx` (call hook)
- Modify: `web/default/src/hooks/use-system-config.ts` if needed to map seo fields

- [ ] **Step 1: On status load in main.tsx**

After applying system_name/logo:

```ts
import { applyDocumentSeo } from '@/lib/seo'

applyDocumentSeo({
  title: s.system_name,
  description: s.seo_description,
  keywords: s.seo_keywords,
  siteUrl: s.seo_site_url || s.server_address,
  ogImage: s.seo_og_image || s.logo,
  robotsIndex: s.seo_robots_index !== false,
  path: window.location.pathname || '/',
  lang: document.documentElement.lang || 'zh-CN',
})
```

Also apply from localStorage cache if status cached.

- [ ] **Step 2: Homepage hook**

```ts
export function useHomeSeo() {
  const { systemName, logo, /* seo fields from store if available */ } = useSystemConfig()
  const { i18n } = useTranslation()
  useEffect(() => {
    applyDocumentSeo({
      title: systemName,
      path: '/',
      lang: i18n.language,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: systemName,
          url: window.location.origin + '/',
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: systemName,
          logo: logo || undefined,
        },
      ],
    })
  }, [systemName, logo, i18n.language])
}
```

Call inside `Home`.

- [ ] **Step 3: Manual check**

Open `/`, inspect head for description/og tags; change SystemName and SEO description in admin and confirm update after refresh.

- [ ] **Step 4: Commit**

```bash
git add web/default/src/main.tsx web/default/src/features/home web/default/src/hooks/use-system-config.ts
git commit -m "feat(web-default): apply SEO meta from status on boot and home"
```

---

### Task 4: Admin settings UI (default + classic light)

**Files:**
- Modify: `web/default/src/features/system-settings/types.ts` (`SiteSettings`)
- Modify: `web/default/src/features/system-settings/site/index.tsx` defaults
- Modify: `web/default/src/features/system-settings/site/section-registry.tsx`
- Modify: `web/default/src/features/system-settings/general/system-info-section.tsx` (append SEO fields)
- Modify: classic site/operation settings form that already has SystemName (append fields)
- i18n keys zh/zh-TW/en

**Fields UI:**

- SEO.Description — textarea  
- SEO.Keywords — input  
- SEO.SiteURL — input + help text  
- SEO.OGImage — input  
- SEO.RobotsIndex — switch  

Wire through existing option save pipeline (same as SystemName).

- [ ] **Step 1: Types + defaults + registry pass-through**
- [ ] **Step 2: Form fields in SystemInfoSection**
- [ ] **Step 3: Classic append fields where SystemName is edited**
- [ ] **Step 4: i18n**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: admin SEO settings fields for default and classic"
```

---

### Task 5: Classic light SEO + verification

**Files:**
- Create: `web/classic/src/helpers/seo.js`
- Modify: `web/classic/src/components/layout/PageLayout.jsx` (where `document.title = systemName`)
- Modify: `web/classic/index.html` OG placeholders

- [ ] **Step 1: classic seo helper** — set title, description, basic og tags from status
- [ ] **Step 2: call after status fetch / title set**
- [ ] **Step 3: Verification checklist**

```bash
curl -sS http://127.0.0.1:3001/robots.txt
curl -sS http://127.0.0.1:3001/sitemap.xml
# browser: homepage view document head
# set SEO.Description in admin, refresh, confirm meta[name=description]
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web-classic): light SEO meta apply and index shell"
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| SEO options | 1, 4 |
| GetStatus fields | 1 |
| robots/sitemap | 1 |
| lib/seo module | 2 |
| index.html shell | 2 |
| main.tsx + home JSON-LD | 3 |
| settings UI | 4 |
| classic light | 5 |
| merge isolation | all tasks |

## Placeholder / consistency

- Option keys use `SEO.*` consistently in backend and forms.
- Status JSON uses `seo_*` snake_case like existing fields.
- No SSR; no homepage marketing rewrite.
