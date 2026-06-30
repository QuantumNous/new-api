<!-- Parent: ../AGENTS.md -->

# website — 独立官网（Next.js）

## Purpose
flatkey.ai 的**对外公开官网**：首页/营销、定价（pricing）、排行（rankings）、博客（blog）、法务（terms/privacy/sla/refund-policy）、关于（about），以及 SEO 资源（`sitemap.xml` / `robots.txt` / `llms.txt`、canonical/hreflang）。独立的 Next.js 16（App Router）+ React 19 + Tailwind CSS 4 工程，作为 standalone Node 应用部署，**与 `web/default`（已登录控制台 SPA）和 Go 应用完全分离**。

存在的根因是 SEO：公开页必须服务端渲染出正确 TDK / 可被爬虫抓取，旧的 `web/default` 内 CSR 营销页满足不了。**所有公开页只在此维护**（CLAUDE.md / 根 AGENTS.md 的 **Rule 9**）。

## Key Files
| Path | Description |
|------|-------------|
| `package.json` | 依赖与脚本（`dev`/`build`/`start`/`lint`/`typecheck`）；包管理器 **Bun** |
| `next.config.ts` | `output: "standalone"`、`images.remotePatterns` 等 |
| `Dockerfile` | 多阶段构建，runner 监听 **端口 4000**（`node server.js`）|
| `docker-compose.yml` | 本地起容器用（`flatkey-website:local`）|
| `src/app/` | App Router 路由：根路径（en）+ `[locale]/`（zh/es/fr/pt/ru/ja/vi）；`sitemap.ts`/`robots.ts`/`llms.txt/route.ts`/`api/perf-metrics/*` |
| `src/components/` | 页面与区块组件（home/pricing/blog/site-header/footer/…）|
| `src/lib/origins.ts` | **origin 解析**：`APP_CONSOLE_ORIGIN`（→ Go 控制台/API）、`ROUTER_ORIGIN`（→ 模型调用示例）、`SITE_ORIGIN`/`NEXT_PUBLIC_SITE_ORIGIN`（本站 canonical）|
| `src/lib/seo.ts` | `buildMetadata`（title/description/canonical/hreflang/OG）|
| `src/lib/locales.ts` | 8 语言定义、`localizePath`/`localeAlternates` |
| `src/lib/blog.ts` / `src/lib/pricing.ts` | 从 Go 后端拉博客/定价数据（服务端 fetch + ISR）|
| `src/content/pages.ts` / `src/content/legal/` | 静态页文案与本地化法务文档 |

## Conventions（务必遵守）
- **路由分流**：生产用 host 分流——`flatkey.ai` + `www.flatkey.ai` → 本站（Cloud Run `newapi-web`）；`console.flatkey.ai` → Go 控制台服务 `newapi-console`（`NODE_TYPE=master`）；`router.flatkey.ai` → Go 模型调用服务 `newapi-router`（`NODE_TYPE=slave`）。本站不承载任何 `/dashboard`、`/api/*`（除自身 `/api/perf-metrics` 代理）、`/v1`。
- **origin 一律走 env**（`src/lib/origins.ts`），禁止硬编码 `flatkey.ai`/`console`/`router`；canonical/sitemap/hreflang 也应取 `SITE_ORIGIN`。
- **i18n**：en 在根路径、其余 7 种在 `/[locale]`；`[locale]` 路由对 `en` 与未知 locale `notFound()` 防重复内容。新增/改文案要**真翻译全 8 种**，正文别只写英文（与 `web/default` 的 i18n 体系**互相独立**）。
- **博客 HTML** 经 `sanitize-html` 白名单后才 `dangerouslySetInnerHTML`；slug 用 `encodeURIComponent`。
- 数据 fetch 失败要兜底（返回空结构、不抛），并设合理 `revalidate`/超时。

## Cross-app wiring（env）
| 变量 | 含义 |
|------|------|
| `APP_CONSOLE_ORIGIN` / `NEXT_PUBLIC_APP_CONSOLE_ORIGIN` | Go 控制台/API origin（如 `https://console.flatkey.ai`）；「控制台/登录」按钮、公开数据拉取（pricing/blog）、`/api/perf-metrics` 代理目标 |
| `ROUTER_ORIGIN` / `NEXT_PUBLIC_ROUTER_ORIGIN` | Go router/API origin（如 `https://router.flatkey.ai`）；只用于模型调用示例 endpoint，不用于公开数据拉取、登录、注册或 dashboard 跳转 |
| `SITE_ORIGIN` / `NEXT_PUBLIC_SITE_ORIGIN` | 本站对外 canonical origin（`https://flatkey.ai`）|

构建时 `NEXT_PUBLIC_*` 会烤进 bundle（CI 用 build-arg 注入），服务端用的同名 env 在 Cloud Run 运行时注入。

## CI/CD & 部署
- 构建+部署：`.github/workflows/gcp-deploy-website.yml`（仅 `website/**` 变更触发；推 `…/website:sha-*`；`gcloud run deploy newapi-web --port=4000`；production 审批门）。
- 基础设施：第二个 Cloud Run（`deploy/gcp/modules/cloud-run-web/`）+ LB host 分流（`deploy/gcp/modules/cloud-lb/` 的 `website_domains`/host_rule）。上线/回滚步骤见 `deploy/gcp/docs/WEBSITE_ROLLOUT.md`。
- Go 应用走 `gcp-deploy.yml`（已 `paths-ignore: website/**`，避免与本站互相触发）。

## Testing
```bash
cd website
bun install
bun run lint && bun run typecheck && bun run build   # 提交前必过
# 本地容器冒烟：
docker build -t flatkey-website:local --build-arg APP_CONSOLE_ORIGIN=https://console.flatkey.ai --build-arg SITE_ORIGIN=https://flatkey.ai .
docker run --rm -p 4000:4000 -e APP_CONSOLE_ORIGIN=https://console.flatkey.ai flatkey-website:local
curl -s http://localhost:4000/pricing | grep -i '<title>'   # 确认 SSR 出 TDK
```

## For AI Agents
- 公开页只在此目录改；**不要**回到 Go 或 `web/default` 加公开页（Rule 9）。
- 改任何用户可见文案前确认 i18n 全 8 种语言已补、且为真实翻译。
- 不要在本站引入 `/dashboard`、`/v1` 等应由 Go 承载的路径。

<!-- MANUAL: 下方为人工补充内容，重新生成时保留 -->

## Legal Localization Notes
- 日本站法务静态页（`/ja/terms`、`/ja/privacy`、`/ja/refund-policy`）的运营主体地址与默认英文/美国地址不同，不能自动套用 `VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States`。
- 日本站上述三页当前应使用：`運営主体: VOC AI株式会社, 東京都港区六本木三丁目３−２７スハラ六本木３階。`
