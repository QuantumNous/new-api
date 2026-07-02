<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# website/src/lib

## Purpose

官网的纯 TypeScript 库层，无 React、无 `next/*` 运行时依赖（除 `seo.ts` 引用 `next` 的 `Metadata` 类型）。涵盖：跨应用 origin 解析、SEO metadata 构造、locale 工具、blog/pricing 数据 fetch（服务端）、JSON-LD schema、Mixpanel/GTM 脚本常量、各 landing page 文案、文案 copy、链接改写、锚点 slugify、工具函数。被 `app/` 的 Server Component 与 `components/` 的 Server/Client Component 共同复用。

## Key Files

| File | Description |
|------|-------------|
| `origins.ts` | **跨应用 origin 解析**。`APP_CONSOLE_ORIGIN`（默认 `https://console.flatkey.ai`）、`ROUTER_ORIGIN`（默认 `https://router.flatkey.ai`）、`SITE_ORIGIN`（默认 `https://flatkey.ai`），分别从 `APP_CONSOLE_ORIGIN`/`ROUTER_ORIGIN`/`NEXT_PUBLIC_SITE_ORIGIN` env 读取；`normalizeOrigin` 去尾斜杠；`buildConsoleUrl`/`consoleUrl` 拼接路径+query。**禁止在本仓库任何地方硬编码这三个域名** |
| `seo.ts` | `buildMetadata(input: SeoInput): Metadata`。统一产出 title/description/canonical（基于 `SITE_ORIGIN`）/hreflang（`localeAlternates` + `x-default`）/robots/OG/Twitter card。`SITE_ORIGIN`/`SITE_NAME` 常量也在此 |
| `locales.ts` | 9 语言定义。`LOCALES = ["en","zh","es","fr","pt","ru","ja","vi","de"]`、`DEFAULT_LOCALE = "en"`、`LOCALE_LABELS`、`isLocale`/`resolveLocaleFromPathname`/`localizePath`/`stripLocale`/`localeAlternates`。**注：实际是 9 种，不是 CLAUDE.md 旧描述的 8 种** |
| `language-routing.ts` | 语言中间件逻辑（被 `proxy.ts` 用）。`LANGUAGE_PREFERENCE_COOKIE = "fk_locale"`、`BOT_USER_AGENT_PATTERN`（googlebot/GPTBot/ClaudeBot/PerplexityBot 等）；`getLanguageRedirectPath` 决定是否 307 重定向到本地化路径，`resolvePreferredLocale`（cookie → Accept-Language q 排序 → en）；`IGNORED_PATH_PREFIXES`/`IGNORED_EXACT_PATHS` 列出豁免路径 |
| `blog.ts` | 博客数据层。优先调 Blogger API（`BLOGGER_API_URL` + `BLOGGER_ACCESS_KEY`，site slug = `flatkey`），失败兜底回 Go `/api/blog/list`/`/api/blog/detail/<slug>`/`/api/blog/categories`；`sanitizeBlogHtml` 经 `sanitize-html` 白名单过滤 + 注入 heading id；`rewriteBlogHref` 把站内链接本地化到 `localizePath`；`getBlogToc`/`formatBlogDate`/`applyBlogFilters`/`BLOG_PAGE_SIZE=18`。ISR `revalidate=300` |
| `pricing.ts` | 定价数据层。`getPricingData()` 调 `${APP_CONSOLE_ORIGIN}/api/website/pricing`，返回 `{models, vendors, groupRatio, usableGroup, supportedEndpoint, autoGroups}`，失败返回空结构；`filterPricingModels`/`sortPricingModelsBySeries`（按 vendor → family → version 排序，含 20+ 模型家族正则）；`formatModelPrice`/`formatGroupTokenPrice`/`formatGroupRequestPrice` 价格计算（token 倍率×2×groupRatio）；`getTopVendors`/`getTopEndpoints` 用于 sitemap |
| `schema.ts` | JSON-LD 构造。`buildHomepageSchema`/`buildBlogIndexSchema`/`buildBlogPostSchema` 等，输出 `JsonLdGraph`；`stringifyJsonLd` 安全序列化 |
| `copy.ts` | 全站文案 hub。`getCopy(locale): Copy` 返回 nav/home/hero/CTA/footer/notifications 等 i18n 字符串（9 种 locale 全覆盖），并组合 `BLOG_COPY` |
| `blog-copy.ts` | 博客专用文案（title/description/searchPlaceholder/分页/CTA 等），9 种 locale |
| `mixpanel.ts` | `MIXPANEL_TOKEN`（从 `NEXT_PUBLIC_MIXPANEL_TOKEN`，带兜底）+ `MIXPANEL_BROWSER_SCRIPT`（IIFE 字符串，idle 时初始化，被 `root-document.tsx` 注入） |
| `anchors.ts` | `slugifyHeading`：用于锚点 id 生成（保留中文/日文/韩文 Unicode 范围） |
| `utils.ts` | `cn(...classes)` className 合并工具（与 shadcn/ui 约定一致） |
| `edm-landing.ts` | EDM 落地页（`/lp/<campaign>`）配置。`EDM_CAMPAIGN_IDS = ["personal-ai","cto-ai-savings","image-buddy"]`、`EDM_LANDING_PATHS`、各 campaign 9 种 locale 文案、`getEdmCtaUrl` |
| `glm-landing.ts` | `/glm-5-2` 落地页配置。`GLM_LANDING_PATH`/`GLM_MODEL_ID`/节省百分比常量、9 种 locale 文案、特性列表 |
| `model-landing.ts` | `/models/[slug]` 落地页数据。`getModelLandingPathnames()`（用于 sitemap）、`MODEL_LANDING_CONFIGS`（slug → modelIds/displayName/对比价）、`modelLandingCopy` 9 种 locale、`normalizeModelId` |
| `claude-code-use-case.ts` | Claude Code / Codex use-case 文案 + 安装脚本文本（`CLAUDE_CODE_POSIX_INSTALL_SCRIPT`/PowerShell 变体，被 `app/install.sh/route.ts`/`install.ps1/route.ts` 用）；`CLAUDE_CODE_BASE_URL = "https://router.flatkey.ai"`、`CLAUDE_CODE_KEY_URL = "https://console.flatkey.ai/keys"` |
| `pricing-links.ts` | 钱包/checkout 链接。`SIGN_UP_URL = consoleUrl("/sign-in", "redirect=/wallet")`、`pricingCheckoutUrl(params)` 拼接 Stripe checkout query |

### Test Files
| File | Description |
|------|-------------|
| `origins.test.ts` / `pricing-links.test.ts` | origin 解析与 checkout URL 构造 |
| `language-routing.test.ts` | 中间件重定向决策与 Accept-Language 解析 |
| `blog.test.ts` / `copy.test.ts` | 博客筛选/HTML 改写、copy 结构完整性 |
| `pricing.test.ts` / `schema.test.ts` | 价格计算/排序、JSON-LD 形状 |
| `claude-code-use-case.test.ts` / `edm-landing.test.ts` / `glm-landing.test.ts` / `model-landing.test.ts` | 各 landing 文案/路径/常量 |

## For AI Agents

### Working In This Directory
- **origin 一律走 `origins.ts`**：`APP_CONSOLE_ORIGIN`/`ROUTER_ORIGIN`/`SITE_ORIGIN`；新增任何跨应用链接都必须用 `consoleUrl()` 或读 `APP_CONSOLE_ORIGIN`/`ROUTER_ORIGIN`，禁止硬编码 `flatkey.ai`/`console`/`router`。
- **i18n 全 9 种**（`locales.ts` 的 `LOCALES`）：新增 key 必须真翻译全 9 种，不能只写英文；维护 `copy.ts`/`blog-copy.ts`/各 landing 文案时，9 种 locale 全覆盖是硬约束。
- **数据 fetch 兜底**：`blog.ts`/`pricing.ts` 的 fetch 失败要返回空结构（不抛），并设 `next: { revalidate: 300 }`；不要把异常冒泡到页面渲染。
- **博客 HTML 安全**：上游 HTML 必须经 `sanitizeBlogHtml` 白名单过滤才能 `dangerouslySetInnerHTML`；slug 用 `encodeURIComponent`。
- `seo.ts` 的 `SITE_ORIGIN = "https://flatkey.ai"` 是**硬编码常量**（与 `locales.ts` 的 `localeAlternates` 一致），与 `origins.ts` 的 `SITE_ORIGIN`（env-driven）目前**不共享**——canonical/hreflang 走 seo.ts，跳转目标走 origins.ts，修改时注意区分。
- `pricing.ts` 的价格公式：`base = model_ratio * 2 * groupRatio`，输出 = `base * completion_ratio`，缓存 = `base * cache_ratio`；改公式要同步 sitemap 与定价页显示。

### Testing Requirements
- `cd website && bun run lint && bun run typecheck && bun run build` 必须通过。
- `bun test` 覆盖上述 test 文件；新增 fetch 函数建议 mock 上游响应后补单测。

### Common Patterns
- 数据 fetch：`async function getX(): Promise<T> { try { const r = await fetch(url, { next: { revalidate }, headers: { accept: "application/json" } }); if (!r.ok) return empty(); return (await r.json()) as T; } catch { return empty(); } }`。
- 文案 hub：`const copy: Record<Locale, CopyShape> = { en: {...}, zh: {...}, ... }; export function getCopy(locale: Locale) { return copy[locale] ?? copy.en; }`。
- Origin：`const url = new URL(path, APP_CONSOLE_ORIGIN).toString()` 或 `consoleUrl("/dashboard", search)`。

## Dependencies

### Internal
- 互相引用：`copy.ts` ← `blog-copy.ts`；`blog.ts` ← `locales.ts` + `origins.ts`；`pricing.ts` ← `origins.ts`；`schema.ts` ← `seo.ts` + `locales.ts`；`pricing-links.ts`/`edm-landing.ts` ← `origins.ts`。
- 被 `app/` 的 page.tsx 调用：`seo`/`locales`/`copy`/`blog`/`pricing`/`model-landing`/`schema`。
- 被 `components/` 调用：几乎所有（除 `seo.ts`/`schema.ts` 主要在 page 级用）。

### External
- `next` — 仅 `seo.ts` 引 `Metadata` 类型；不引 `next/server`/`next/router`
- `sanitize-html` — `blog.ts` HTML 白名单
- `react` — 无（本目录不写 React 组件）

<!-- MANUAL: -->
