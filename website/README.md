# flatkey.ai Website

`website/` 是 flatkey.ai 的公开官网项目，使用 Next.js App Router、React 和 Tailwind CSS 构建。这里维护首页、定价、排行、博客、法务页面、SEO 入口和多语言公开页面。

已登录控制台和 API 网关不在本项目维护。控制台在 `web/default/`，Go API 服务在仓库根应用中。

## Development

优先使用 Bun：

```bash
bun install
bun run dev
bun run lint
bun run typecheck
bun run build
```

本地开发服务默认监听 `http://localhost:4000`。

## SEO Checklist

新增或修改公开页面时，按下面的检查项处理。

### SSR First

- 面向 Google 抓取的页面内容尽可能走服务端渲染，让首屏 HTML 直接包含主要标题、正文、链接和结构化内容。
- 不要把核心 SEO 内容放到只在客户端请求后才出现的组件里。
- 需要从后端读取数据时，优先使用服务端 `fetch`、ISR、静态生成或服务端组件，并保留失败兜底，避免页面因为数据源异常直接不可渲染。

### Discoverability

如果新增页面不需要登录态，它必须能被搜索引擎发现：

- `robots.txt` 不能屏蔽该路径。
- `sitemap.xml` 必须包含该页面链接。当前入口在 `src/app/sitemap.ts`。
- 至少从一个已收录或可访问页面内链到新页面，例如导航、页脚、首页区块、相关内容列表、博客列表或专题页。
- 不要创建孤岛页面。只有 URL 能打开但没有站内入口的页面，通常不利于抓取和权重传递。

### Metadata

- 每个可索引页面都应提供独立的 `title` 和 `description`。
- 多语言页面要检查每个 locale 的 `title` 和 `description` 是否真实本地化，不能只复用英文。
- canonical、hreflang 和 Open Graph metadata 应通过现有 SEO 工具函数维护，避免在页面里硬编码一套新逻辑。

### Internationalization

当前 locale 定义在 `src/lib/locales.ts`：

- `en` 使用根路径，例如 `/pricing`。
- 其他语言使用路径前缀，例如 `/es/pricing`、`/fr/pricing`。
- 修改某个国家或语言的页面时，按 path scope 定位，例如 Spanish 页面按 `/es/**/*` 对应的路由和内容修改。
- 新增公开页面时，同步确认 8 种语言的路径、页面内容、`title`、`description`、canonical 和 hreflang。
- 博客目前主要是英文入口，新增本地化博客前先确认 sitemap、路由和内容源都支持对应 locale。

## Important Files

- `src/app/sitemap.ts`: sitemap 生成入口。
- `src/app/robots.ts`: robots.txt 生成入口。
- `src/lib/seo.ts`: metadata、canonical、hreflang、OG 生成逻辑。
- `src/lib/locales.ts`: locale 列表、路径本地化和 alternates。
- `src/content/pages.ts`: 静态公开页文案和多语言 TDK。
- `src/content/legal/`: 法务文档内容。
- `src/lib/origins.ts`: 官网和控制台 origin 解析。

## Deployment Notes

生产环境通过 host 分流：

- `flatkey.ai` 和 `www.flatkey.ai` 指向本 Next.js 官网。
- `console.flatkey.ai` 和 `router.flatkey.ai` 指向 Go 应用。

跨应用链接必须通过环境变量解析，不要在新代码中硬编码控制台或 API origin。
