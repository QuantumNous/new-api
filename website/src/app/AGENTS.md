<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# website/src/app

## Purpose

Next.js 16 App Router 路由根。通过**双路由组**实现 i18n 分流：英文走根路径（`(en)/` route group，不进 URL），zh/es/fr/pt/ru/ja/vi/de 走 `[locale]/` 动态段。两组目录结构完全对称（20 个 `page.tsx`），由 `lib/locales.ts`/`lib/seo.ts` 共享逻辑保证 canonical/hreflang 一致。同时承载 SEO 资源（`sitemap.ts`/`robots.ts`/`llms.txt/route.ts`）、`/api/*` 代理、以及对 `/dashboard`/`/sign-in`/`/sign-up`/`/setup` 的 301 重定向到 Go 控制台。

## Key Files

| File | Description |
|------|-------------|
| `(en)/layout.tsx` | 英文根 layout。引入 `globals.css`、注入 `RootDocument`（GTM/Mixpanel/attribution cookie），`metadata = rootMetadata` |
| `[locale]/layout.tsx` | 本地化根 layout。`generateStaticParams` 返回除 `en` 外 8 种 locale；`isLocale(locale) && locale !== "en"` 否则 `notFound()`；同样套 `RootDocument` |
| `(en)/page.tsx` | 英文首页。`buildMetadata` + 注入 JSON-LD（`buildHomepageSchema`），渲染 `<HomePage locale="en" />` |
| `[locale]/page.tsx` | 本地化首页。`generateStaticParams` 排除 `en`，`generateMetadata` 按 locale 取 copy |
| `sitemap.ts` | `MetadataRoute.Sitemap`。聚合静态页 + 模型 landing（`getModelLandingPathnames`）+ blog 分类/slug + pricing top vendors，每个条目输出 9 种语言 alternate；`base = "https://flatkey.ai"` |
| `robots.ts` | `MetadataRoute.Robots`。`User-agent: *` 允许 `/`，禁止 `/cdn-cgi/` / `/_next/` / `/dashboard/` / `/lp/`；指向 `https://flatkey.ai/sitemap.xml` |
| `llms.txt/route.ts` | 输出面向 LLM 的 `llms.txt`（Core Pages + Blog Categories + Blog Articles）；`max-age=300` |
| `globals.css` | 全局 Tailwind CSS 4 入口，被两个 layout 共同 `import` |
| `setup-redirect.ts` | `/setup` 共享重定向构造器：`buildSetupRedirectLocation` 把 query 透传到 `consoleUrl("/sign-up", ...)`（默认 `redirect=/keys`）；`redirectToConsoleSetup` 返回 301 |
| `layout.test.ts` | `bun:test`。覆盖 `resolveLocaleFromPathname` + `RootDocument` 注入脚本常量 |
| `console-redirects.test.ts` | `bun:test`。覆盖 `/dashboard`、`/sign-in`、`/sign-up`、`/setup`（根 + `[locale]`）301 重定向的 query 透传 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `(en)/` | 英文路由组（route group，URL 不含 `en`）。20 个 `page.tsx`：首页、about、blog（list+`[slug]`+category/`[slug]`）、glm-5-2、lp（personal-ai/cto-ai-savings/image-buddy）、models（+`[slug]`）、pricing、privacy、rankings、refund-policy、sla、terms、use-case（codex/claude-code/image-buddy） |
| `[locale]/` | 本地化路由组（zh/es/fr/pt/ru/ja/vi/de）。与 `(en)/` **目录结构完全对称**，外加 `sign-in/`、`sign-up/`、`setup/` 三个 301 重定向路由 |
| `api/` | Next.js Route Handler。`perf-metrics/route.ts` + `perf-metrics/summary/route.ts` 代理到 `APP_CONSOLE_ORIGIN`；`mixpanel/current-user/route.ts` 转发 cookie 到 Go `/api/user/analytics-self` |
| `dashboard/` | 单文件 `route.ts`：301 重定向到 `consoleUrl("/dashboard", search)` |
| `sign-in/`、`sign-up/` | 单文件 `route.ts`：301 重定向到 `consoleUrl("/sign-in" \| "/sign-up", search)` |
| `setup/` | 单文件 `route.ts`：调用 `setup-redirect.ts` 的 `redirectToConsoleSetup` |
| `install.sh/`、`install.ps1/` | 单文件 `route.ts`：分别返回 `CLAUDE_CODE_POSIX_INSTALL_SCRIPT` / PowerShell 安装脚本（`Content-Disposition: inline`）|
| `llms.txt/` | 单文件 `route.ts`：见上 Key Files |

## For AI Agents

### Working In This Directory
- **目录对称约束**：新增一个公开页必须**同时**在 `(en)/<path>/page.tsx` 与 `[locale]/<path>/page.tsx` 创建。本地化页统一模式：`generateStaticParams` 排除 `en`、`generateMetadata` 调 `buildMetadata({ ..., locale })`、`Page` 内 `if (!isLocale(locale) \|\| locale === "en") notFound()`。参考 `[locale]/about/page.tsx`。
- `[locale]/sign-in`、`[locale]/sign-up`、`[locale]/setup` 是 301 重定向到 `APP_CONSOLE_ORIGIN`（不渲染页面），所以中间件 (`proxy.ts`) 把 `/sign-in`、`/sign-up` 排除在语言重定向之外是故意的。
- **SEO 表面集中在本目录**：`sitemap.ts`/`robots.ts`/`llms.txt/route.ts`；canonical/hreflang 由各 page 的 `buildMetadata` 生成。新增页面若希望进 sitemap，要在 `sitemap.ts` 的 `staticEntries` 里加条目。
- **API 路由只做代理**：`api/perf-metrics/*` 与 `api/mixpanel/current-user` 都把请求转发到 `APP_CONSOLE_ORIGIN`，不在本站实现业务逻辑；失败返回 502。
- 不要在本目录引入应由 Go 承载的路径（`/v1`、真实 `/dashboard` 渲染等）。

### Testing Requirements
- `cd website && bun run lint && bun run typecheck && bun run build` 必须通过。
- `bun test` 覆盖 `app/layout.test.ts`、`app/console-redirects.test.ts`，以及各 `lib/*.test.ts` 间接覆盖到 `buildMetadata`/`localizePath`。
- 新增路由后用 `curl -s http://localhost:4000/<path> | grep -i '<title>'` 验证 SSR 出 TDK。

### Common Patterns
- 每个本地化 page.tsx 顶部固定：`generateStaticParams`（排除 en）→ `generateMetadata`（按 locale 取 copy + `buildMetadata`）→ `Page`（`notFound()` 守卫 + 渲染 `<SiteShell>` 包裹的页面组件）。
- 英文 page.tsx 更简洁：顶层取 copy / 调 `buildMetadata({ pathname, locale: "en" })` → 渲染组件。
- 法务页（terms/privacy/sla/refund-policy）用 `<PublicPage pageKey=...>`；about/rankings 也用 PublicPage；其余页各自有专用组件（`<HomePage>`、`<PricingPage>`、`<GlmLandingPage>` 等）。

## Dependencies

### Internal
- `@/components/*` — HomePage/PricingPage/PublicPage/GlmLandingPage/BlogPages/ModelLandingPage/CodingAgentUseCasePage/EdmLandingPage 等页面组件
- `@/lib/seo` — `buildMetadata`
- `@/lib/locales` — `LOCALES`/`isLocale`/`localizePath`/`DEFAULT_LOCALE`
- `@/lib/origins` — `consoleUrl`（重定向到 Go 控制台）
- `@/lib/blog`、`@/lib/pricing`、`@/lib/model-landing` — sitemap/llms.txt 数据源
- `@/lib/copy`、`@/content/pages` — 页面文案
- `@/lib/schema` — JSON-LD
- `@/lib/claude-code-use-case` — install.sh/install.ps1 文本
- `@/components/root-document` — `RootDocument`/`rootMetadata`/`ATTRIBUTION_COOKIE_SCRIPT`

### External
- `next`（`Metadata`、`MetadataRoute`、`NextResponse`/`NextRequest`、`notFound`、`Script`、`next/script`）
- `react` 19

<!-- MANUAL: -->
