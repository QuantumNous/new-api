<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# website/src

## Purpose

flatkey.ai 官网的 Next.js 16 App Router 源码根目录。所有页面、API 路由、组件、库函数、静态文案都在此处；构建产物由 `next build` 生成 standalone Node bundle，经 Docker 监听 **端口 4000** 部署到 Cloud Run `newapi-web`（见父文档 `website/AGENTS.md` 的 CI/CD 段落）。这一层只承载**对外公开官网**（Rule 9），不承载任何已登录控制台、`/v1`、`/dashboard`（除 301 重定向到 Go 控制台外）。

## Key Files

| File | Description |
|------|-------------|
| `proxy.ts` | Next.js `middleware` 别名（`next.config.ts` 中以 `middleware: { manual: true }` + 自定义文件名接入）。基于 `@/lib/language-routing` 的 `getLanguageRedirectPath`，对未带 locale 前缀的 GET 请求做 **307 重定向**到 `fk_locale` cookie 或 `Accept-Language` 推断出的非英文 locale；爬虫/`/api`/`/sign-in`/静态文件等会跳过 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router 路由根。`(en)/` 路由组承载英文根路径、`[locale]/` 承载 zh/es/fr/pt/ru/ja/vi/de 8 种本地化路径；`sitemap.ts`/`robots.ts`/`llms.txt/route.ts`/`api/` 也在这一层。详见 `app/AGENTS.md` |
| `components/` | 页面与区块组件（home/pricing/blog/site-header/site-footer/use-case/lp/model-landing/edm-landing 等）。详见 `components/AGENTS.md` |
| `lib/` | 纯 TS 库：origin 解析、SEO metadata、locale 工具、blog/pricing 数据 fetch、各 landing page 文案、JSON-LD schema、Mixpanel 脚本、文案 copy。详见 `lib/AGENTS.md` |
| `content/` | 静态页面文案（`pages.ts`）+ 法务文档（`legal/`：terms/privacy/sla/refund-policy，en + es/pt 本地化）。详见 `content/AGENTS.md` |

## For AI Agents

### Working In This Directory
- 公开页只在本目录改；不要回到 Go 或 `web/default` 加公开页（父文档 Rule 9）。
- 跨应用 origin 一律走 `lib/origins.ts`（`APP_CONSOLE_ORIGIN` / `ROUTER_ORIGIN` / `SITE_ORIGIN`），禁止硬编码 `flatkey.ai` / `console.flatkey.ai` / `router.flatkey.ai`。
- **i18n 全 9 种语言**（en 根路径 + zh/es/fr/pt/ru/ja/vi/de 在 `[locale]/`）；新增/改用户可见文案必须真翻译全 9 种，正文不能只写英文。本站 i18n 与 `web/default` 的 i18next 体系**互相独立**。
- `proxy.ts`（语言中间件）会跳过 `/api`、`/sign-in`、`/sign-up`、`/dashboard`、`/_next`、`/cdn-cgi`、`/favicon.ico`、`/robots.txt`、`/sitemap.xml`、`/llms.txt`、`/install.sh`、`/install.ps1`，以及带文件扩展名的路径和爬虫 UA。新增需要被中间件处理的路由前，先确认 `lib/language-routing.ts` 的 `IGNORED_*` 列表是否需要调整。
- `proxy.ts` 使用 `request.nextUrl` clone + 307（临时）重定向，不会缓存到 ISR；测试见 `app/layout.test.ts`、`lib/language-routing.test.ts`。

### Testing Requirements
- `cd website && bun run lint && bun run typecheck && bun run build` 必须通过。
- 单测（`bun test`）覆盖 `lib/*.test.ts` 与 `app/*.test.ts`/`components/*.test.tsx`。

### Common Patterns
- 路由分流：英文页写在 `app/(en)/...`（route group 不进 URL）、本地化页写在 `app/[locale]/...`，两套目录结构完全对称；每页都通过 `buildMetadata(...)` 输出 canonical/hreflang/OG。
- 服务端 fetch（blog/pricing/perf-metrics）都走 `fetch(url, { next: { revalidate } })` + try/catch 兜底，失败返回空结构而非抛错。
- 客户端交互组件统一 `"use client"`、用 lucide-react 图标 + Tailwind className（通过 `cn()` 合并）。

## Dependencies

### Internal
- `@/lib/*` — origin/locale/seo/copy/blog/pricing 等纯函数库
- `@/components/*` — UI 组件
- `@/content/*` — 静态文案与法务文档

### External
- `next`（App Router、`next/server`、`next/navigation`、`next/script`、`next/image`、`next/link`）、`react`/`react-dom` 19
- `bun:test` — 单测运行器
- 见各子目录 AGENTS.md 的具体外部依赖

<!-- MANUAL: -->
