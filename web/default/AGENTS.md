<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-01-28 | Updated: 2026-06-10 -->

# 前端开发规范（web/default）

本文档定义默认主题前端项目的开发规范与最佳实践，供开发与 AI 助手共同遵循。具体依赖与脚本以 `package.json` 为准。

## Purpose
默认主题前端：React 19 + TypeScript + Rsbuild 2.x + Base UI + Tailwind CSS 4.x 的新版管理界面。长期演进方向，功能持续迭代。包管理器为 Bun（CLAUDE.md Rule 3）。

## Key Files
| File | Description |
|------|-------------|
| `package.json` | 依赖清单与脚本（React 19、Base UI、TanStack Router/Query/Table、i18next 等） |
| `rsbuild.config.ts` | Rsbuild 2.x 构建配置，环境变量前缀 `VITE_` |
| `tsconfig.app.json` | TypeScript 应用编译配置（target ES2020，moduleResolution Bundler） |
| `tsconfig.json` | TypeScript 根配置（引用 app + node） |
| `eslint.config.js` | ESLint 10.x flat config |
| `postcss.config.mjs` | PostCSS 配置（Tailwind CSS 4.x） |
| `knip.config.ts` | Knip 未使用导出/依赖检查配置 |
| `components.json` | shadcn/ui 组件配置 |
| `index.html` | SPA 入口 HTML |
| `src/main.tsx` | React 渲染入口 |
| `src/routeTree.gen.ts` | TanStack Router 自动生成路由树（勿手动编辑） |
| `src/i18n/config.ts` | i18next 初始化配置 |
| `src/i18n/static-keys.ts` | 非 `t()` 字面量扫描用的静态 i18n key 登记 |
| `scripts/sync-i18n.mjs` | i18n 翻译同步脚本（`bun run i18n:sync`） |
| `scripts/add-copyright.mjs` | 版权头检查/添加脚本（`bun run copyright`） |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/features/` | 功能模块（about / auth / blog / channels / chat / dashboard / errors / home / keys / legal / models / performance-metrics / playground / pricing / profile / rankings / redemption-codes / setup / subscriptions / system-settings / usage-logs / users / wallet 等） |
| `src/routes/` | TanStack Router 文件路由（`__root.tsx`、`_authenticated/`、`(auth)/`、`(errors)/`、`blog/`、`oauth/` 等） |
| `src/components/` | 通用 UI 组件（data-table / layout / brand / ui / ai-elements 等） |
| `src/stores/` | Zustand stores（auth-store / notification-store / system-config-store） |
| `src/i18n/locales/` | i18next 翻译文件（en / zh / fr / ru / ja / vi / es / pt） |
| `src/hooks/` | 通用自定义 Hooks |
| `src/lib/` | 通用工具函数与类型（含 `analytics/` 广告归因与 Google Ads 转化追踪、`model-availability.ts` 模型可用性工具等） |
| `src/styles/` | 全局样式（Tailwind CSS 4.x 入口） |
| `src/config/` | 应用级配置（如 fonts.ts） |
| `src/assets/` | 静态资源 |
| `public/` | 不经构建处理的静态资源 |

---

## 一、项目概览

### 技术栈

| 类别     | 技术 |
|----------|------|
| 包管理   | Bun（Rule 3） |
| 构建     | Rsbuild 2.x（`@rsbuild/core`）、`@rsbuild/plugin-react` |
| 框架     | React 19、TypeScript 6.x |
| 数据获取 | @tanstack/react-query 5.x |
| 路由     | @tanstack/react-router 1.x（文件路由，`createFileRoute`） |
| 表格与列表 | @tanstack/react-table 8.x、@tanstack/react-virtual 3.x |
| 状态管理 | Zustand 5.x |
| 国际化   | i18next 26.x、react-i18next 17.x、i18next-browser-languagedetector |
| HTTP 请求 | axios（项目统一实例） |
| AI SDK   | `ai` 6.x（Vercel AI SDK） |
| 日期     | Day.js、date-fns 4.x |
| UI 与样式 | Base UI（`@base-ui/react`）、Hugeicons（`@hugeicons/react`）、Lucide React、Tailwind CSS 4.x、clsx / class-variance-authority / tailwind-merge |
| 动画     | motion 12.x |
| 表单     | React Hook Form 7.x、Zod 4.x、`@hookform/resolvers` |
| 图表     | @visactor/vchart 2.x / @visactor/react-vchart 2.x、Recharts 3.x |
| Markdown | react-markdown、remark-gfm、rehype-raw、shiki（代码高亮）、streamdown（流式渲染） |
| 通知     | sonner 2.x |
| 其他工具 | qrcode.react、react-day-picker、react-resizable-panels、vaul、cmdk、nanoid、next-themes、tokenlens |
| 开发工具 | prettier、eslint 10.x、knip、shadcn 4.x |

优先选用成熟、维护良好的开源库；仅在现有库无法满足或需特殊适配时自行实现，并评估可维护性与通用性。

---

## 二、目录

- [一、项目概览](#一项目概览)
- [二、目录](#二目录)
- [三、开发规范](#三开发规范)
  - [3.1 国际化](#31-国际化)
  - [3.2 代码风格与类型](#32-代码风格与类型)
  - [3.3 组件](#33-组件)
  - [3.4 性能](#34-性能)
  - [3.5 状态管理](#35-状态管理)
  - [3.6 API 请求](#36-api-请求)
  - [3.7 表单](#37-表单)
  - [3.8 路由](#38-路由)
  - [3.9 错误处理](#39-错误处理)
  - [3.10 样式](#310-样式)
  - [3.11 文件组织](#311-文件组织)
  - [3.12 可访问性](#312-可访问性)
  - [3.13 安全](#313-安全)
  - [3.14 测试](#314-测试)
  - [3.15 依赖管理](#315-依赖管理)
  - [3.16 构建与部署](#316-构建与部署)
- [四、协作与提交](#四协作与提交)
- [更新日志](#更新日志)

---

## 三、开发规范

### 3.1 国际化

- **页面文本**：所有面向用户的文案均需支持 i18n，使用 `useTranslation()` 的 `t()` 进行翻译。
- **使用场景**  
  - **React 组件**：必须使用 `const { t } = useTranslation()`，以保证语言切换时组件会重新渲染。  
  - **非 React 环境**（工具函数、常量、类方法）：可使用 `import { t } from 'i18next'`；此类用法不会随语言切换自动更新，仅在不依赖响应式更新的场景使用。  
  - 即使父组件已使用 `useTranslation()`，子组件仍应自行使用，以保证独立性。
- **专有名词**：品牌、产品、技术术语等可保留英文（如 API、React、TypeScript）；若有约定俗成的译法则使用翻译。
- **翻译键**：使用有层级、语义清晰的键名，如 `dashboard.overview.title`，并保持命名一致。
- **支持语言**：en（基准）、zh、fr、ru、ja、vi、es、pt（共 8 种），文件位于 `src/i18n/locales/{lang}.json`；新增文案时需同步所有语言文件（可用 `bun run i18n:sync` 辅助）。es（西班牙语）与 pt（葡萄牙语）为近期新增语言。

- **枚举与文案（常量中的 i18n）**  
  各 feature 的 `constants.ts` 中常出现「枚举/状态 + 展示文案」或「成功/错误消息」，须统一约定以免遗漏 i18n、用法混乱：  
  - **成功/错误/提示类消息**（如 `SUCCESS_MESSAGES`、`ERROR_MESSAGES`）：常量值仅表示 **i18n 键**（与英文 fallback 同字面量）。展示时**必须**通过 `t()` 使用，例如 `toast.success(t(SUCCESS_MESSAGES.API_KEY_CREATED))`、`toast.error(t(ERROR_MESSAGES.UNEXPECTED))`，**禁止**直接 `toast.success(SUCCESS_MESSAGES.xxx)` 当作最终文案。  
  - **状态/选项的 label**：在常量中统一用 **labelKey**（字符串，即 i18n 键），组件中通过 `t(config.labelKey)` 渲染；或约定用 `label` 存与 en 一致的 key 字符串，组件用 `t(config.label)`。同一 feature 内只采用一种方式，避免混用。  
  - **新增此类常量时**：同步在 `src/i18n/static-keys.ts` 中登记对应 key（若项目用其做提取），或确保文案以 `t('...')` 字面量形式出现以便扫描，避免遗漏翻译。

### 3.2 代码风格与类型

- **表达式**：禁止 2 层及以上嵌套三元表达式；改用 `if-else`、提前返回或抽取函数。单层三元可保留，但需简洁。
- **可读性**：控制函数圈复杂度，复杂逻辑拆成小函数；变量与函数命名需有意义，遵循驼峰等常规约定。
- **TypeScript**：避免 `any`，优先具体类型或 `unknown`；为参数与返回值显式标注类型；仅类型用途的导入使用 `import type { X } from '...'`。
- **类型检查**：每次改动 TypeScript 或 TSX 代码后都要执行类型检查（如 `bun run typecheck`）；若出现类型错误，须修复至无错误为止，不得遗留。
- **解构**：对象非必要不要进行解构，特别是组件的 props；直接使用 `props.xxx` 更清晰，避免不必要的解构增加代码复杂度。

### 3.3 组件

- 使用函数式组件与 Hooks，单一职责；组件 props 须有明确类型（接口或类型别名）。
- **Props 使用**：组件 props 非必要不要解构，直接使用 `props.xxx` 访问属性，保持代码清晰（详见 [3.2 代码风格与类型](#32-代码风格与类型)）。
- 单文件超过约 200 行时考虑拆分子组件或将逻辑抽到自定义 Hooks；类型定义可与组件同文件或放在同模块的 `types` 中。

### 3.4 性能

- **React**：合理使用 `useMemo`、`useCallback` 减少无效重渲染；避免在渲染路径中创建新对象/数组；必要时使用 `React.memo`。
- **代码分割**：使用 `React.lazy` 与动态 `import` 做按需加载，控制首屏与路由体积。
- **资源**：图片选用合适格式与尺寸，大列表考虑虚拟滚动（如 @tanstack/react-virtual），大量图片考虑懒加载。

### 3.5 状态管理

- 使用 Zustand 的 `create` 定义 store，并为 state 与 actions 定义清晰类型。
- 组件内优先用选择器订阅，避免整 store 订阅导致多余渲染，例如：`const user = useAuthStore((s) => s.auth.user)`。
- 需持久化的状态在 store 内读写 localStorage，并在初始化时恢复。
- Store 按功能放在 `src/stores/`，单文件职责清晰，命名表意明确。

### 3.6 API 请求

- **React Query**：数据获取用 `useQuery`，变更用 `useMutation`；为每个查询配置唯一 `queryKey`（建议数组形式、层级一致）；在 `onSuccess` 中对相关 query 做 `invalidateQueries`，可配合乐观更新。服务端错误统一通过 `handleServerError` 处理（详见 [3.9 错误处理](#39-错误处理)）。
- **Axios**：使用项目统一的 `api` 实例（含 `baseURL`、`headers`、`withCredentials: true`）；GET 默认请求去重，特殊请求可通过配置关闭；认证与通用错误在拦截器中处理。

### 3.7 表单

- 使用 React Hook Form + Zod：在功能模块的 `lib/` 下定义 schema，并用 `z.infer` 导出表单类型；`useForm` 配合 `@hookform/resolvers/zod` 做校验。
- 提交逻辑放在 `onSubmit`，展示加载与错误状态；成功后视场景重置表单或关闭弹窗。服务端校验错误映射到对应字段并展示（字段级错误展示方式见 [3.9 错误处理](#39-错误处理)）。

### 3.8 路由

- 使用 TanStack Router，路由文件位于 `src/routes/`，通过 `createFileRoute` 定义；搜索参数用 Zod schema + `validateSearch` 校验。
- 在 `beforeLoad` 中做认证与重定向，避免不必要的请求；嵌套结构用布局路由与 `_authenticated` 等前缀，子路由通过 `<Outlet />` 渲染。
- 导航使用 `useNavigate` 或 `Link`，保持类型安全，避免直接操作 `window.location`。

### 3.9 错误处理

- **服务端错误**：统一使用 `handleServerError`，在 React Query 全局配置与拦截器中接入；按 HTTP 状态码给出合适提示，文案使用 i18n。
- **展示**：使用 `toast.error` 等统一方式；路由级错误由 `errorComponent` 承接，提供友好错误页并记录便于排查的信息。
- **表单**：校验与服务端错误映射到字段后，在字段下方展示；使用 `form.setError` 等与表单库一致的方式。

### 3.10 样式

- 以 Tailwind 工具类为主，动态类名用 `cn()` 合并；非动态场景避免内联样式。
- 响应式采用移动优先与 Tailwind 断点（`sm:`、`md:`、`lg:` 等）；主题与暗色用 CSS 变量与 `dark:`，自定义样式集中在 `src/styles/`，组件内尽量少写自定义 CSS。

### 3.11 文件组织

- **功能模块**：置于 `src/features/<feature>/`，内含 `components/`、`lib/`、`hooks/`，以及按需的 `api.ts`、`types.ts`、`constants.ts`、入口组件等。
- **通用**：通用组件放 `src/components/`，通用工具与类型放 `src/lib/`；组件文件 PascalCase，工具/类型文件 kebab-case 或 `types.ts`，类型使用 PascalCase 命名并 `export type`。

### 3.12 可访问性

- 使用语义化 HTML（如 `header`、`nav`、`main`、`footer`），表单用 `label` 关联输入。
- 保证键盘可操作与焦点顺序合理；必要时使用 ARIA（如 `aria-label`、`aria-expanded`、`aria-hidden`）；装饰性图标加 `aria-hidden="true"`，重要信息提供文本等价。
- 对比度满足 WCAG 2.1 AA（正文至少 4.5:1）。

### 3.13 安全

- 认证与权限在路由与接口层校验；敏感操作增加二次确认等。
- 前后端均做数据校验（如 Zod），不信任仅前端校验；敏感信息不落前端存储，配置用环境变量，禁止硬编码密钥。
- 依赖 React 默认转义，慎用 `dangerouslySetInnerHTML`；跨域与 Cookie 使用 `withCredentials` 并按后端要求处理 CSRF。

### 3.14 测试

- 工具函数与纯逻辑优先单元测试（Vitest），测试文件 `*.test.ts`；组件用 React Testing Library 测交互与行为，避免测实现细节。
- 关键流程补充集成与 E2E（如 MSW 模拟 API、Playwright/Cypress）；核心功能目标覆盖率 80% 以上，关注业务路径与关键分支。

### 3.15 依赖管理

- 使用 **Bun**：`bun install`、`bun add <pkg>`、`bun add -d <pkg>`、`bun remove <pkg>`、`bun pm ls`、`bun update` 等。
- 新增依赖前评估维护情况、体积与许可；生产与开发依赖区分清楚，版本用 `^`/`~` 控制，定期更新以获取安全修复。

### 3.16 构建与部署

- 使用 Rsbuild 2.x，配置见 `rsbuild.config.ts`；脚本以 `package.json` 为准（`bun run dev`、`bun run build`、`bun run build:check`、`bun run typecheck`、`bun run lint`、`bun run format`、`bun run knip`），包管理见 [3.15 依赖管理](#315-依赖管理)。
- 代码分割与懒加载策略见 [3.4 性能](#34-性能)；资源使用合适格式与压缩，环境变量用 `.env` 且以 `VITE_` 前缀（Rsbuild `loadEnv` 配置的前缀），不在代码中硬编码。
- **发布前**：执行 typecheck（`bun run typecheck`）、lint、format 检查，完成生产构建（`bun run build:check` = tsc + rsbuild）并检查产物体积与环境变量配置。
- 版权头检查：`bun run copyright:check`，修复：`bun run copyright`。未使用导出检查：`bun run knip`。

---

## 四、协作与提交

- 提交信息清晰、符合项目约定，描述变更内容与原因，中英文统一即可。
- 变更需经过代码审查，符合本文档规范，并关注质量、性能与安全。
- 重大功能或规范变更时更新相关文档与 `AGENTS.md`。

---

---

## 五、主要功能模块说明

### 5.1 Blog 功能（`src/features/blog/`）

远程 CMS 博客系统，对接后端 `/api/blog/list` 与 `/api/blog/detail/:slug` 接口。

| 文件/目录 | 说明 |
|-----------|------|
| `api.ts` | 封装博客列表（分页、搜索、分类筛选）与文章详情请求 |
| `types.ts` | `BlogPost`、`BlogListResult`、`BlogListQuery` 等核心类型 |
| `constants.ts` | `BLOG_PAGE_SIZE` 等分页常量 |
| `lib/` | 内部工具（格式化等） |
| `components/blog-article.tsx` | 文章内容渲染（含 Markdown/TOC） |
| `components/blog-card.tsx` | 文章卡片（列表项） |
| `components/blog-pagination.tsx` | 分页控件 |
| `components/blog-search.tsx` | 关键词搜索组件 |
| `components/blog-seo.tsx` | SEO meta 注入（标题、描述、OG 标签等） |
| `components/blog-toc.tsx` | 文章目录（Table of Contents） |

路由文件：
- `src/routes/blog/index.tsx` — 博客列表页（分页 + 搜索 + 分类过滤）
- `src/routes/blog/$slug.tsx` — 文章详情页（含 TOC、SEO）
- `src/routes/blog/category/$slug.tsx` — 分类文章列表页

### 5.2 钱包 / 账单（`src/features/wallet/`）

充值、订阅、账单历史与 Stripe 发票 Profile 支持。

| 文件/目录 | 说明 |
|-----------|------|
| `lib/invoice.ts` | Stripe 发票 Profile 校验与归一化（含 `billing_email` 格式校验） |
| `lib/billing.ts` | 账单相关工具函数 |
| `lib/payment.ts` | 支付通用工具 |
| `lib/paddle-checkout.ts` | Paddle Checkout 集成工具 |
| `hooks/use-billing-history.ts` | 账单历史数据加载 Hook |
| `hooks/use-payment.ts` | 支付流程管理 Hook |
| `components/recharge-form-card.tsx` | 充值表单卡片（含发票 Profile 字段） |
| `components/dialogs/billing-history-dialog.tsx` | 账单历史弹窗 |

支付完成后，用户可在充值表单中填写发票 Profile（`billing_email`），由 `lib/invoice.ts` 校验后随支付请求一起提交。

### 5.3 OAuth 登录（`src/features/auth/`）

| 文件/目录 | 说明 |
|-----------|------|
| `hooks/use-oauth-login.ts` | 统一 OAuth 登录 Hook，支持 GitHub、Discord、Google、OIDC、LinuxDO 等 provider |
| `components/oauth-providers.tsx` | OAuth provider 按钮渲染组件 |
| `components/oauth-callback-screen.tsx` | OAuth 回调过渡页面（处理 state 验证与跳转） |

路由文件：
- `src/routes/oauth/$provider.tsx` — 通用 OAuth 回调路由，动态匹配 provider 名称

新增 Google OAuth 支持（`buildGoogleOAuthUrl`）；登录开始时通过 `trackOAuthStart` 触发归因埋点（见 5.4）。

### 5.4 广告归因与转化追踪（`src/lib/analytics/`）

| 文件 | 说明 |
|------|------|
| `attribution.ts` | 落地页归因采集：从 URL 提取 `utm_*`、`gclid`、`gad_*`、`hsa_*`、`aff`、`lng` 等参数并持久化到 localStorage（key：`ads:attribution`），后续注册时随请求上报 |
| `gtag.ts` | 轻量 Google Ads / GA4 转化追踪工具；通过 `VITE_GADS_CONVERSION_ID` 与 `VITE_GADS_SIGNUP_SEND_TO` 环境变量启用，未配置时所有函数降级为 no-op；提供 `trackSignupConversion()` 等事件上报函数 |
| `pixels.ts` | 多渠道广告 pixel（TikTok / Meta / X）；按渠道通过 `VITE_TIKTOK_PIXEL_ID` / `VITE_META_PIXEL_ID` / `VITE_X_PIXEL_ID`(+`VITE_X_SIGNUP_EVENT_ID`) 启用，未配置即 no-op；`ensurePixelsLoaded()` 落地页埋 PageView，`trackPixelsSignup()` 注册成功触发 CompleteRegistration。与 `gtag.ts` 同样 4 个调用点（home / sign-up 页 + password / oauth 注册成功）|

注册漏斗中，注册成功后会调用 `trackSignupConversion()` 上报 Google Ads 转化。不需要 Google Ads 的部署忽略上述两个环境变量即可，不影响构建。

### 5.5 定价与分组比率 UI（`src/features/pricing/`、`src/features/system-settings/models/`）

- `src/features/pricing/`：面向终端用户的模型定价展示页，含价格卡片与分组筛选。
- `src/features/system-settings/models/group-ratio-visual-editor.tsx`：管理后台分组比率可视化编辑器，以表格形式呈现模型 × 用户组的价格倍率，支持直接编辑与批量操作。
- `src/features/system-settings/models/group-ratio-form.tsx`：分组比率表单（数据绑定层）。

### 5.6 模型可用性（`src/features/models/`、`src/lib/model-availability.ts`）

- `src/lib/model-availability.ts`：定义 `ModelAvailabilityStatus`（`available` / `temporary_failure` / `official_unsupported` / `unknown_failure`）及对应的展示配置（label、badge variant），供模型列表页渲染状态标签使用。
- `src/features/models/`：模型浏览页，展示可用模型列表与各模型的可用性状态。

### 5.7 本地化葡萄牙语法律文档（`src/features/legal/`）

新增 `localized-default-documents-pt.ts`，提供葡萄牙语（`pt`）版本的用户协议、隐私政策、退款政策等法律文档默认内容，与现有各语言本地化法律文档保持结构一致。

---

## 更新日志

- **2026-01-28**：初始版本（国际化、代码、组件、类型等基础规范）。
- **2026-01-28**：补充状态管理、API、表单、路由、错误处理、样式、文件组织、可访问性、安全、测试、依赖与构建部署规范。
- **2026-01-29**：重组文档结构，合并重复内容，明确主次与交叉引用。
- **2026-01-31**：在 3.2 中补充「类型检查」要求：改动 TS/TSX 后须执行 typecheck 并修复至无错。
- **2026-06-08**：添加 Generated/Updated 头、Purpose/Key Files/Subdirectories 结构化块；更新技术栈表（Rsbuild 2.x、Tailwind CSS 4.x、TypeScript 6.x、新增 ai/recharts/date-fns/motion/streamdown/sonner/lucide-react 等依赖）；在 3.1 中补充支持语言（es/pt）；修正 3.16 构建脚本（build:check、copyright、knip）与 VITE_ 前缀说明。
- **2026-06-10**：新增第五章「主要功能模块说明」，记录 Blog 远程 CMS、钱包/Stripe 发票、Google OAuth 登录、广告归因（attribution/gtag）、定价与分组比率可视化编辑器、模型可用性标签、PT 法律文档本地化等新功能；更新 Subdirectories 表（新增 blog/oauth 路由、lib/analytics 描述）；3.1 补充 es/pt 语言说明。
