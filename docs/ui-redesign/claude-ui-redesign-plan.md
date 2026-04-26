# Claude Design 前端 UI 全站重构计划

## 背景与目标

本项目 `new-api` 前端当前使用 React 18、Vite、Semi Design UI 与 Tailwind。目标是基于 `D:\daima\awesome-design-md\design-md\claude\README.md` 指向的 Claude Design System，对 `web/` 前端进行全站视觉重构。

本轮重构采用最高严格度：

- 全站一次性覆盖 `web/src` 前端 UI 视觉面。
- 严格遵循 Claude 暖色编辑式设计语言。
- 清理全前端色值、字号、间距、圆角裸值。
- 保留原页面功能、路由、DOM 语义和业务条件渲染。
- 每个交互元素补齐 hover、focus-visible、active、disabled 状态。
- 满足 WCAG AA 对比度、键盘可达和响应式断点要求。

## 冲突与假设

### 已确认冲突

- 当前首页和登录页使用紫青光晕、渐变文字、玻璃拟态，与 Claude Design 的暖纸张、低饱和、无传统渐变方向冲突。
- 当前大量 JSX 和 CSS 使用 `px`、`rem`、hex、rgb、Tailwind 默认色阶、任意值 class，与“全部使用 CSS 变量 token”冲突。
- 当前 Header、Sidebar、Card、表格页更接近 Semi UI 默认后台风格，需要调整为更温润、克制、编辑式的产品界面。
- 当前交互状态分散，缺少统一 focus-visible、active、disabled 状态系统。
- 当前响应式多使用 Tailwind 默认断点或局部任意值，需要对齐 320、768、1024、1440 的明确检查点。

### 执行假设

- `tokens.css` 是唯一允许集中声明原始设计值的文件。
- 其他前端文件只能引用 `var(--token-name)`、tokenized Tailwind class 或语义 class。
- OAuth、支付、模型供应商等品牌识别色保留，但必须转成 `--brand-*` token。
- CSS 变量不能可靠作为 media query 条件，因此断点在 `tailwind.config.js` 中以命名 token 形式配置。
- 不删除、不重命名、不替换任何与 `new-api`、`QuantumNous`、版权、README、包名、镜像名相关的项目身份信息。
- 不改变路由、接口请求、i18n key、登录流程、权限判断、表格数据流、业务状态语义。

## 全站重构范围

### 必改范围

- `web/src/tokens.css`：新增设计 token 文件。
- `web/src/index.jsx`：引入 token 文件。
- `web/src/index.css`：全局基础样式、Semi UI 覆盖、交互状态、reduced-motion、滚动条、布局壳层。
- `web/tailwind.config.js`：把颜色、字号、间距、圆角、阴影、断点映射到 CSS 变量 token。
- `web/src/pages/**`：页面壳层、公开页、控制台页、设置页、模型/价格/日志页视觉清理。
- `web/src/components/**`：布局、表单、卡片、表格、弹窗、dashboard、topup、playground、markdown 等组件视觉清理。
- `web/src/constants/**` 与 `web/src/helpers/**` 中用于 UI 的样式配置和状态色。

### 禁止改动

- 不修改后端 Go 业务逻辑。
- 不改变数据库、API、认证、计费、渠道转发逻辑。
- 不替换 Semi UI、不新增大型 UI 框架。
- 不移除项目受保护身份信息。
- 不回滚用户或已有工作区改动。

## Token 系统方案

### 文件位置

- `web/src/tokens.css`

### Token 分组

- 颜色基础 token：canvas、surface、elevated、overlay、border、text、muted、accent、danger、success、warning、info。
- Claude 风格 token：paper、parchment、terracotta、clay、ink、warm-gray、line、note。
- 字体 token：display、body、mono、中文 fallback。
- 字号 token：display、h1、h2、h3、body、small、caption、label。
- 行高 token：tight、normal、relaxed。
- 间距 token：space-0 到 space-12、page-gutter、section-gap、card-padding、control-padding。
- 圆角 token：control、card、panel、pill、full。
- 阴影 token：ring、card、overlay、focus。
- 动效 token：duration、ease、hover-transform、active-transform、disabled-opacity。
- 布局 token：header-height、sidebar-width、sidebar-collapsed-width、content-max-width。
- 状态 token：hover-bg、focus-ring、active-bg、disabled-bg、disabled-text。
- 品牌 token：OAuth、支付、供应商和图表使用的语义化品牌变量。

## 多代理写集拆分

实施阶段建议拆为 4 个互不冲突的写集：

1. Token 与全局壳层
   - 写集：`web/src/tokens.css`、`web/src/index.css`、`web/tailwind.config.js`、`web/src/index.jsx`。
   - 输出：完整 token 系统、Semi 基础覆盖、全局状态类、reduced-motion。

2. 公开页与认证页
   - 写集：`web/src/pages/Home`、`web/src/components/auth`、`web/src/pages/UserAgreement`、`web/src/pages/PrivacyPolicy`。
   - 输出：首页、登录、注册、重置密码、协议页的 Claude 风格改造。

3. 控制台布局与共享组件
   - 写集：`web/src/components/layout`、`web/src/components/common/ui`、`web/src/components/common/modals`。
   - 输出：Header、Sidebar、PageLayout、Footer、CardPro、Loading、Modal 状态统一。

4. 业务页面清零
   - 写集：`web/src/components/table`、`web/src/components/dashboard`、`web/src/components/topup`、`web/src/components/playground`、`web/src/pages/Setting`、`web/src/helpers`、`web/src/constants` 中的 UI 样式配置。
   - 输出：表格、设置、钱包、Dashboard、Playground、状态色、图表色 token 化。

主代理负责最终合并、冲突处理、全站扫描、构建和浏览器验证。

## 验证标准

### 命令验证

在 `D:\daima\new-api\web` 执行：

```powershell
bun run eslint
bun run lint
bun run i18n:lint
bun run build
```

### 裸值扫描

除 `web/src/tokens.css` 和必要第三方兼容注释外，扫描结果应无新增裸值：

```powershell
rg -n "(#[0-9a-fA-F]{3,8}|rgba?\(|\b[0-9]+px\b|\b[0-9]+rem\b|min-\[|max-w-|mt-\[|h-\[|w-\[|rounded-|bg-gray|text-gray|border-gray|text-blue|hover:text-blue|indigo|teal|purple|gradient|blur-ball|shine-text)" web/src --glob "*.{js,jsx,css}"
```

### 浏览器验证

重点页面：

- `/`
- `/login`
- `/register`
- `/reset`
- `/pricing`
- `/console`
- `/console/channel`
- `/console/playground`
- `/console/setting`
- `/console/topup`

断点：

- 320
- 768
- 1024
- 1440

检查项：

- 无横向溢出。
- 键盘 Tab 顺序可达。
- focus-visible 清晰可见。
- hover、active、disabled 状态完整。
- 明暗主题均可读。
- 对比度满足 WCAG AA。
- `prefers-reduced-motion` 下无非必要动效。

## 最终交付格式

最终交付按用户要求输出：

### A. `<冲突与假设清单>`

列出实际执行中保留的例外、技术假设、与设计规范冲突但需要业务保留的点。

### B. `<设计 token 文件>`

说明 `web/src/tokens.css` 的 token 分组、主题覆盖、Tailwind 映射关系。

### C. `<重构后的组件代码>`

以仓库文件为准，列出完整改动文件路径和核心入口，不在聊天中粘贴所有文件全文。

### D. `<改动说明>`

按以下四类说明：

- 视觉
- 结构
- 交互
- 可访问性

### E. `<自检清单>`

逐项列出：

- token 清零
- 状态补齐
- WCAG AA
- motion 限制
- 响应式断点
- 无横向溢出
- lint/build
- 浏览器验证

