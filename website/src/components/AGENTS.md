<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# website/src/components

## Purpose

flatkey.ai 官网的所有页面与区块级 React 19 组件。组件分两类：**Server Component**（默认，被 `app/(en)` 与 `app/[locale]` 下的 `page.tsx` 直接渲染，负责数据 fetch、SEO、布局骨架）与**Client Component**（带 `"use client"`，处理滚动/搜索/tab 切换/Modal/主题切换等交互）。所有公开页外壳统一走 `<SiteShell>`（header + main + footer），关键交互组件用 lucide-react 图标 + Tailwind className（经 `cn()` 合并）。

## Key Files

| File | Description |
|------|-------------|
| `root-document.tsx` | `<html>`/`<body>` 文档骨架，被两个 layout 共用。注入 GTM (`GTM-5T5LPLSZ`)、`MIXPANEL_BROWSER_SCRIPT`、`ATTRIBUTION_COOKIE_SCRIPT`、LiveChat、`ROOT_DOCUMENT_PERFORMANCE_POLICY`；导出 `rootMetadata`（默认 metadata） |
| `site-shell.tsx` | Server Component。统一外壳：`<SiteHeader/>` + `<main>{children}</main>` + `<SiteFooter/>`。props: `locale`/`pathname`/`children` |
| `site-header.tsx` | Client Component。顶部导航：滚动变色、移动端展开、use-case 下拉、Sign-in/Console 按钮（走 `consoleUrl()`）、语言切换、主题切换、通知铃；i18n 经 `getCopy()` + `useCaseLabelByLocale` |
| `site-footer.tsx` | Server Component。页脚：品牌 logo、导航列、社交链接；`localizePath()` 处理内部链接 |
| `flatkey-brand-logo.tsx` | 品牌 logo（亮/暗两套 PNG，`next/image`），通过 `className` 控制尺寸 |
| `language-switcher.tsx` | Client Component。下拉切换语言；写入 `fk_locale` cookie（`buildLanguagePreferenceCookie`）并 `router.push` 到对应 `localizePath` |
| `theme-switch.tsx` | Client Component。深/浅色主题切换（`class` 策略） |
| `notification-popover.tsx` | Client Component。右上角通知气泡，文案走 `getCopy()` |
| `home-page.tsx` | 首页主体：Hero + `<HeroTerminalDemo>` + `<ClaudeCodeInstallTabs>` + 特性卡片 + CTA；i18n 走 `getCopy(locale)` |
| `hero-terminal-demo.tsx` | Client Component。首页终端动画 Demo，读取 `ROUTER_ORIGIN` 拼示例 endpoint |
| `claude-code-install-tabs.tsx` | Client Component。POSIX/PowerShell 安装命令 tab，复制按钮；命令来自 `lib/claude-code-use-case.ts` |
| `pricing-page.tsx` | Server Component。定价页：调 `getPricingData()` + plans 数据；渲染 `<PricingPlansGrid>` |
| `pricing-plans-grid.tsx` | Client Component。预付费 plans 卡片网格 + `<FlatkeyTallyEmbed>` 联系表单 |
| `pricing-explorer.tsx` | Client Component。模型价格浏览器外壳：搜索/筛选/排序 + `<PricingModelBrowser>` |
| `pricing-model-browser.tsx` | Client Component。单个模型的展开行：输入/输出/缓存价 + 可用性 badge + 分组价格 |
| `blog-pages.tsx` | Blog 列表/详情/分类的页面级组件集合（被 `app/(en)/blog/...` 与 `[locale]/blog/...` 复用）；处理分页、搜索、TOC、`sanitizeBlogHtml` 渲染、`formatBlogDate` |
| `public-page.tsx` | Server Component。about/rankings 及 4 个法务页通用外壳：`<SiteShell>` + `<LegalMarkdown>`（当 `content.document` 存在）或 sections |
| `legal-markdown.tsx` | 把法务文档 markdown 渲染成受控 HTML，提取 heading id 锚点（`getLegalHeadings`） |
| `coding-agent-use-case-page.tsx` | Server Component。`/use-case/codex` 与 `/use-case/claude-code` 的页面主体 |
| `model-landing-page.tsx` | Client Component。`/models/[slug]` 单模型 landing：价格对比表 + CTA；依赖 `lib/model-landing.ts` |
| `glm-landing-page.tsx` | Server Component。`/glm-5-2` 落地页（GLM 5.2 节省 40% 主题）+ `<GlmApiVisual>` |
| `glm-api-visual.tsx` | Client Component。OpenAI/Claude/GLM 三种 API 格式切换 tab |
| `edm-landing-page.tsx` | Server Component。`/lp/<campaign>` EDM 落地页，组合 `<SiteHeader>`/`<SiteFooter>`/`<LpLimitedOfferModal>` |
| `lp-limited-offer-modal.tsx` | Client Component。LP 限时优惠弹窗（5s 延迟） |
| `flatkey-tally-embed.tsx` | Client Component。嵌入 Tally 表单（`tally.so/embed.js`），自动透传 UTM 参数 |

## For AI Agents

### Working In This Directory
- 公开页只在本目录改；不要回到 Go 或 `web/default`（父 Rule 9）。
- **i18n 全 9 种语言**（en + zh/es/fr/pt/ru/ja/vi/de）：新增用户可见文案必须真翻译全 9 种；优先复用 `getCopy(locale)`（`lib/copy.ts`）或在本组件内用 `Record<Locale, string>` 形式（参考 `site-header.tsx` 的 `useCaseLabelByLocale`）。
- 跨应用链接一律走 `lib/origins.ts`：`consoleUrl("/sign-in")` / `consoleUrl("/dashboard")`；模型示例 endpoint 用 `ROUTER_ORIGIN`；站内链接用 `localizePath()`（参考 `site-footer.tsx`）。
- Server/Client 边界：默认写 Server Component；只有需要 `useState`/`useEffect`/`onClick`/浏览器 API 时才加 `"use client"`。`SiteShell` 故意是 Server Component，内部组合的 `SiteHeader` 是 Client。
- 法务页主体（terms/privacy/sla/refund-policy）通过 `<PublicPage>` + `<LegalMarkdown>` 渲染 markdown；**日本站运营主体地址与英文不同**（见父 `website/AGENTS.md` 的 Legal Localization Notes），不能自动套用。
- 安装脚本（`install.sh`/`install.ps1` 路由）的文本来自 `lib/claude-code-use-case.ts`，不要在本目录写死。

### Testing Requirements
- `cd website && bun run lint && bun run typecheck && bun run build` 必须通过。
- 已有单测：`hero-terminal-demo.test.ts`、`home-page.test.ts`、`lp-limited-offer-modal.test.tsx`、`model-landing-page.test.tsx`、`pricing-model-browser.test.ts`、`pricing-page.test.ts`、`pricing-plans-grid.test.tsx`。新增交互组件建议补 `bun:test`。
- SSR 验证：`curl -s http://localhost:4000/<path> | grep -i '<title>'`，确认 TDK 真实输出（避免意外改成纯 CSR）。

### Common Patterns
- 页面级 Server Component：`function PageName({ locale, ...data }) { return <SiteShell locale={locale} pathname={...}>{...}</SiteShell> }`。
- Client Component 顶部固定：`"use client"` + `useEffect`/`useState` + lucide-react 图标 + `cn(...)` className 合并。
- i18n 文案结构：`const copy = getCopy(locale)`（取通用 nav/hero/CTA 等），或局部 `Record<Locale, string>` 表。
- 内部链接统一 `<Link href={localizePath("/pricing", locale)}>`；外部控制台链接用 `consoleUrl("/dashboard")`（不带 locale）。

## Dependencies

### Internal
- `@/lib/locales` — `Locale`/`LOCALES`/`localizePath`/`stripLocale`
- `@/lib/origins` — `consoleUrl`/`APP_CONSOLE_ORIGIN`/`ROUTER_ORIGIN`
- `@/lib/seo` — `buildMetadata`（多在 `page.tsx` 用，组件里少用）
- `@/lib/copy` / `@/lib/blog-copy` — 全站文案
- `@/lib/blog` — `sanitizeBlogHtml`/`formatBlogDate`/`getBlogToc`/`BLOG_PAGE_SIZE`
- `@/lib/pricing` — `getPricingData`/`filterPricingModels`/`formatModelPrice` 等
- `@/lib/pricing-links` — `SIGN_UP_URL`/`pricingCheckoutUrl`
- `@/lib/model-landing` / `@/lib/glm-landing` / `@/lib/edm-landing` / `@/lib/claude-code-use-case` — 各 landing 文案/常量
- `@/lib/utils` — `cn()`
- `@/content/pages` — `<PublicPage>` 静态文案
- `@/components/*` — 互相组合（SiteShell 用 SiteHeader/SiteFooter，HomePage 用 HeroTerminalDemo/ClaudeCodeInstallTabs 等）

### External
- `next` — `next/link`、`next/image`、`next/script`、`notFound`、`useRouter`/`usePathname`（Client）
- `react` 19 — `useState`/`useEffect`/`useRef`/`useId`/`useMemo`/`type ReactNode`
- `lucide-react` — 图标库（`ArrowRight`/`CheckCircle2`/`Search`/`Bell`/`Sun`/`Moon`/`Languages` 等）
- 无第三方 UI 框架——全部 Tailwind className 手写（仅用 lucide-react 图标）

<!-- MANUAL: -->
