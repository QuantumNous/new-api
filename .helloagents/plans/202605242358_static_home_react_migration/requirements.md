# aiapi114 首页按静态 HTML 改造 — 需求

确认后冻结，执行阶段不可修改。如需变更必须回到设计阶段重新确认。

## 核心目标
将当前 React 首页 `/` 按本地静态 HTML 首页 `/prototypes/home-html/` 的内容、视觉和交互体验进行改造，让正式首页具备静态页已有的完整展示内容，同时接入现有业务能力：系统公告、黑夜 / 白天模式、多语言、模型状态。静态 HTML 首页继续作为 SEO 落地页额外保留，不被删除、不被覆盖。

## 功能边界
必须支持：
- 保留静态 HTML 页面及访问路径：`web/default/public/prototypes/home-html/index.html`、`/prototypes/home-html/`。
- React 首页复刻静态页现有主要内容：导航、系统公告条、Hero、Hero 动态插图、优势卡片、API 接入地址、模型运行状态、开发者友好、价格/服务说明、FAQ、页脚、主题切换全屏动画、滚动入场动效。
- 系统公告接入现有公告数据；无公告或接口失败时首页可用并有明确兜底。
- 黑夜 / 白天模式沿用项目现有主题系统，视觉接近静态页当前主题效果，避免主题闪烁，支持 `prefers-reduced-motion`。
- 多语言接入项目现有 i18n：新增首页文案 key，不在组件内堆硬编码长文案。
- 模型状态接入现有 `/api/uptime/status` 与 `features/model-status` 领域逻辑，首页展示摘要，提供跳转到 `/status` 的入口。
- 已登录 / 未登录 CTA 与现有鉴权状态联动，保留登录、注册、控制台入口的正确跳转。

不需要支持：
- 不把静态 HTML 的 228KB CSS 原样整体搬进 React 作为长期方案。
- 不删除现有 SEO 静态页。
- 不重写后台公告管理、模型状态后端、登录注册流程。
- 不引入新的强样式 UI 框架或重型动效库；优先使用项目已有依赖和 CSS。
- 不为首页编造新的统计、价格或模型数据；缺数据时使用现有静态内容兜底并明确映射。

## 非目标
- 本次不做全站视觉重构，不改控制台和后台管理页面的整体设计。
- 本次不改变后端 API 契约，除非实现中发现前端无法消费现有数据并另行确认。
- 本次不做生产 SEO 策略改版；只保证静态 SEO 落地页保留，后续可单独处理 sitemap、canonical、hreflang。
- 本次不做多套首页 A/B 测试。

## 技术约束
- 前端项目路径：`C:\work\aiapi114\web\default`。
- 正式首页入口：`src/routes/index.tsx`，现有组件位于 `src/features/home`。
- 静态参考页：`public/prototypes/home-html/index.html` 与 `public/prototypes/home-html/styles.css`。
- 模型状态模块：`src/features/model-status`，现有 API：`/api/uptime/status`。
- i18n 目录：`src/i18n`，当前语言包括 `zh`、`en`、`fr`、`ja`、`ru`、`vi`。
- 技术栈：React 19、TanStack Router、TanStack Query、i18next、Tailwind CSS、motion、next-themes。
- 单文件超过 300 行需评估拆分，超过 400 行必须按职责拆分；函数超过 40 行需评估，超过 60 行必须拆分。

## 质量要求
- 桌面与移动端首屏构图完整，主要内容层级清晰，不能出现默认卡片堆砌或布局断裂。
- 黑夜 / 白天主题下文字对比度、控件颜色、卡片阴影、Hero 插图和公告区域均需单独验收。
- 主题切换动画、滚动入场动效不能阻塞输入，必须支持减弱动效偏好。
- 公告和模型状态接口失败不影响首页主体渲染。
- 多语言切换后首页主要文案、按钮、状态文案、aria label 不残留中文硬编码。
- 完成前必须运行类型检查、相关测试、构建或项目约定验证，并做浏览器截图验收。
