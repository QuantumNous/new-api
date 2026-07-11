# 前端开发规范

本文档定义前端项目的开发规范与最佳实践，供开发与 AI 助手共同遵循。具体依赖与脚本以 `package.json` 为准。

---

## 一、项目概览

### 技术栈

| 类别       | 技术                                                              |
| ---------- | ----------------------------------------------------------------- |
| 包管理     | Bun                                                               |
| 框架       | React 19、TypeScript                                              |
| 数据与请求 | @tanstack/react-query、axios、Zustand                             |
| 路由       | @tanstack/react-router                                            |
| 表格与列表 | @tanstack/react-table、@tanstack/react-virtual                    |
| 国际化     | i18next、react-i18next、i18next-browser-languagedetector          |
| 日期       | Day.js                                                            |
| UI 与样式  | Base UI、Hugeicons、Tailwind CSS、clsx / class-variance-authority |
| 表单       | React Hook Form、Zod                                              |
| 图表       | @visactor/vchart、@visactor/react-vchart                          |
| 工具       | qrcode.react、oxfmt、oxlint、vitest（可选）                       |

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
- **Lint 检查**：每次完成代码改动前，必须对所涉及文件执行 lint 检查，并修复这些文件中的所有 lint error；不得遗留 error。warning 可按变更范围与风险评估处理。
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

#### 3.10.1 设计系统纪律（强约束）

以下规则为硬约束，代码评审与 AI 改动一律遵循；违反即为缺陷。

**颜色**

- 后台界面（除 `features/home/` 营销页外）**禁止硬编码 Tailwind 调色板类**（如 `text-emerald-600`、`bg-amber-50`、`border-rose-200`），一律使用语义令牌：`success` / `warning` / `destructive` / `info` / `neutral`、`primary` / `muted` / `accent` / `border` / `ring`。暗色适配由令牌完成，禁止 `dark:text-emerald-400` 之类逐处覆写。
- 状态色仅表达状态（成功/警告/错误/信息），不得用于装饰或分类；分类信息（模型名、分组名、渠道名等）一律中性呈现，身份靠文本与图标传达。`StatusBadge` 的 `autoColor` 已废弃为 neutral，禁止恢复字符串哈希取色。
- 需要浅底状态胶囊时使用 `status-badge.tsx` 的 `tintedBadgeClassMap`，不要再手写 `bg-xxx-50 text-xxx-700 dark:...` 组合。
- 图表用 `--chart-1..5`；用户头像身份色走 `getAvatarColorClass`。这两处是仅有的多色场景。
- 禁止用 `!important`（`!text-*` 等）压制文字颜色/字号；若需要覆盖，说明层级设计有误，先修组件。

**排版**

- 字体族只有两轨：正文 `--font-sans`（含 CJK 回退，勿删栈中中文字体）与 `--font-serif`（serif 主题轴）。`font-mono` 仅用于密钥、ID、代码、原始 JSON；**数字对齐一律 `tabular-nums`，不得再加 `font-mono`**。
- 字号只用 `text-xs/sm/base/lg/xl/2xl`，**禁止任意值字号**（`text-[10px]`、`text-[11px]` 等；营销页除外）。
- 字重只用 `font-medium`（强调/表头）与 `font-semibold`（标题/关键数值）；后台正文与标题**禁用 `font-bold`**。
- 标题三档契约：页题 `text-lg font-semibold tracking-tight`；卡片/区块题 `text-base font-semibold`；面板/小节题 `text-sm font-medium`。禁止响应式跳字号的标题（如 `text-base sm:text-lg`）。
- 表头不使用 `uppercase + tracking-wider`。

**控件尺寸（移动优先响应式）**

- `src/components/ui/` 是 shadcn CLI 管理的原始源码层：允许通过 `bunx --bun shadcn@latest add <component> --dry-run/--diff` 审查并合并上游更新，但**禁止**在这里加入产品级响应式策略、业务语义或一次性样式。不得用 `--overwrite` 覆盖本地代码，除非用户明确批准。
- `src/components/design-system/` 是产品设计系统适配层，只包装确实承载稳定跨站策略的控件（尺寸、产品级 variant、复合控件内部的策略传递）；不要为了“统一入口”代理所有 shadcn 组件。业务代码对受管控件必须从该目录导入，`.oxlintrc.json` 的 `no-restricted-imports` 会阻止绕过边界。
- 控件标准高度是响应式的：**手机（<640px）28px，桌面（`sm:` 起）32px**。断点由 `design-system` 适配层统一注入（`Button`/`Toggle` default 与 icon 档、`Input`、`InputGroup`、`SelectTrigger` default 档、`TabsList`、`Combobox`、`CommandInput`、分页、表头 `h-9 sm:h-10`），业务代码**不写**断点类即可获得正确尺寸。
- 独立场景（工具栏、表单、对话框、卡片/列表行操作、页脚）一律用默认档，**禁止** `size='sm'`，也**禁止**用 `className` 写 `h-7`/`h-8`/`h-9`/`size-8` 等钉死尺寸——钉死的类会在某一断点上与内置的 `sm:h-8`/`sm:size-8` 打架（twMerge 不会跨断点去重）。
- 密集场景（表格单元格内、行内编辑器一行多控件、紧凑抽屉行）统一 `size='sm'`（28px 恒定）；微型场景用 `xs`（24px 恒定）。`sm`/`xs`/`icon-sm`/`icon-xs` 是**固定档**，不随断点缩放；需要"固定自定义尺寸"的特例（如覆盖层小按钮）应以固定档为基底再覆写，绝不以 default/icon 为基底。
- 图标按钮用 `icon`（28→32px 响应式）/`icon-sm`（28px 恒定）/`icon-xs`（24px 恒定）并带 `aria-label`；禁止 `size-*`、`h-* w-*`、`p-0` 组合模拟。头部全局操作（侧栏开关/主题/语言/通知/头像）统一 `icon`。
- CTA 档 `xl`（40→44px 响应式）：auth 页主按钮（登录/注册/OTP/重置/OAuth/Passkey）与营销页 hero 按钮统一 `size='xl'`，禁止再写 `h-11`。
- 确需自定义高度时必须**成对覆盖两个断点**：内容自适应写 `h-auto sm:h-auto`，特大输入写 `h-9 sm:h-10` 这类成对值；`min-h-*` 不与内置高度冲突可单独使用。flex-wrap 的 `TabsList` 用 `group-data-horizontal/tabs:h-auto sm:group-data-horizontal/tabs:h-auto`。
- 手机端的“视觉紧凑”不得牺牲可操作性：所有指针目标至少满足 WCAG 2.2 AA 的 24×24 CSS px；相邻 28px 控件必须保留足够间距，主要提交/认证/高频操作优先使用 40px 的 `xl` 档。不要在手机端新增小于 `xs` 的交互目标。
- 仅有例外：日历格（`--cell-size`）、OTP 输入格、营销页装饰元素。新增例外须在评审说明。

**圆角与阴影**

- 圆角单源 `--radius`（默认 0.625rem），组件用派生档 `rounded-md/lg/xl`；禁止在业务代码里写死圆角像素或混用 `rounded-2xl`/`rounded-4xl` 表达同类容器。
- 卡片边界「描边或投影二选一」：默认 `border`（或 Card 自带 ring），禁止再叠 `shadow-*`；`shadow` 只保留给浮层（popover/dropdown/dialog）。

**动效**

- 后台界面禁止入场动画：无 stagger、无 translate/scale/blur 入场、无按钮按压缩放。页面切换只允许纯透明度 fade（见 `lib/motion.ts` 的 `pageEnter`）。`page-transition.tsx` 的 Stagger 系列组件已固化为纯容器，禁止恢复动画。
- 允许的动效上限：颜色/透明度过渡 ≤150ms、骨架屏 shimmer、`Collapsible/Accordion` 展开、加载 spinner。装饰性动效只允许出现在 `features/home/`（landing）。

**徽章与图标**

- 文本徽章统一 `StatusBadge`（五种语义 voice）；模型/分组/渠道等实体徽章统一中性底（`border-border/60 bg-muted/30`）。不要新造第三种徽章样式。
- 业务代码图标一律 `lucide-react`；`components/ui/` 由 shadcn 生成器维护（Hugeicons），不要手改基础组件图标库；AI 品牌图标用 `@lobehub/icons`（经 `getLobeIcon`）。

### 3.11 文件组织

- **功能模块**：置于 `src/features/<feature>/`，内含 `components/`、`lib/`、`hooks/`，以及按需的 `api.ts`、`types.ts`、`constants.ts`、入口组件等。
- **通用**：通用组件放 `src/components/`，其中 `components/ui/` 仅存 shadcn 原始源码、`components/design-system/` 存产品策略适配器；通用工具与类型放 `src/lib/`。组件文件 PascalCase，工具/类型文件 kebab-case 或 `types.ts`，类型使用 PascalCase 命名并 `export type`。

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
- 测试必须保护真实用户行为、稳定 API 契约或明确回归路径；禁止为了覆盖率添加 smoke、sleep/timing、随机输入、日志输出或只证明代码运行的测试。
- 新增或大幅重写测试时优先使用 Vitest 与 React Testing Library 的标准断言和查询方式，避免手写通用断言辅助函数；只有表达项目特定业务不变量时才抽取测试 helper。
- 清理测试时先合并重复场景、删除不明不白的实现细节断言；若旧测试间接覆盖了真实契约，需替换为更小、更直接的行为测试。

### 3.15 依赖管理

- 使用 **Bun**：`bun install`、`bun add <pkg>`、`bun add -d <pkg>`、`bun remove <pkg>`、`bun pm ls`、`bun update` 等。
- 新增依赖前评估维护情况、体积与许可；生产与开发依赖区分清楚，版本用 `^`/`~` 控制，定期更新以获取安全修复。

### 3.16 构建与部署

- 使用 Rsbuild，配置见 `rsbuild.config.ts`；脚本以 `package.json` 为准（如 `bun run dev`、`bun run build`、`bun run typecheck`、`bun run lint`、`bun run format`），包管理见 [3.15 依赖管理](#315-依赖管理)。
- 代码分割与懒加载策略见 [3.4 性能](#34-性能)；资源使用合适格式与压缩，环境变量用 `.env` 且以 `VITE_` 前缀，不在代码中硬编码。
- **发布前**：执行 typecheck、lint、format 检查，完成生产构建并检查产物体积与环境变量配置。

---

## 四、协作与提交

- 提交信息清晰、符合项目约定，描述变更内容与原因，中英文统一即可。
- 变更需经过代码审查，符合本文档规范，并关注质量、性能与安全。
- 重大功能或规范变更时更新相关文档与 `AGENTS.md`。

---

## 更新日志

- **2026-01-28**：初始版本（国际化、代码、组件、类型等基础规范）。
- **2026-01-28**：补充状态管理、API、表单、路由、错误处理、样式、文件组织、可访问性、安全、测试、依赖与构建部署规范。
- **2026-01-29**：重组文档结构，合并重复内容，明确主次与交叉引用。
- **2026-01-31**：在 3.2 中补充「类型检查」要求：改动 TS/TSX 后须执行 typecheck 并修复至无错。
- **2026-06-21**：在 3.2 中补充「Lint 检查」要求：完成代码改动前须修复所涉及文件的所有 lint error。
- **2026-07-11**：新增 3.10.1「设计系统纪律」：语义色硬约束（去彩虹徽章/硬编码调色板）、排版契约（字号/字重/标题三档/mono 边界）、圆角单源、后台零入场动效、徽章与图标单轨。
- **2026-07-11**：3.10.1 新增「控件尺寸」：控件默认 32px（`h-8`）单一标准；独立场景禁用 `size='sm'` 与 `className` 高度硬改；密集行内统一 `sm`、微型 `xs`；图标按钮走 `icon/icon-sm/icon-xs` 档位。
- **2026-07-11**：控件尺寸升级为移动优先响应式：设计系统统一手机 28px / 桌面 32px（default、icon 档随断点缩放，`sm`/`xs`/`icon-sm`/`icon-xs` 恒定）；新增 CTA 档 `xl`（40→44px），auth 与 hero 主按钮统一迁入；调用点禁止钉死 `h-*`/`size-*`，自定义高度必须成对覆盖两个断点（如 `h-auto sm:h-auto`）。
- **2026-07-11**：将响应式尺寸策略从 shadcn 原始源码迁至 `components/design-system/` 适配层；业务受管控件统一改从适配层导入，并由 lint 禁止绕过；`components/ui/` 恢复为可用 CLI `--diff` 维护的上游源码边界。
