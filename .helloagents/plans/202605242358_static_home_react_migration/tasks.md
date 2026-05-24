# aiapi114 首页按静态 HTML 改造 — 任务分解

## 拆分原则
- 默认按端到端垂直切片拆分：每个任务交付一个可验证行为，而不是单独交付某一层。
- `AFK` 表示代理可独立完成；`HITL` 表示需要用户决策、外部凭据、人工视觉确认或手动验收。
- 厚任务必须继续拆小；横向前置任务只在确有技术依赖时保留。

## 任务列表
- [?] 任务1（AFK）：建立新版首页骨架并保留静态 SEO 页（依赖：无；涉及文件：`src/features/home/index.tsx`、`src/features/home/components`、`public/prototypes/home-html/*`；预期变更：保留自定义首页逻辑和静态页路径，新增新版默认首页容器与区块骨架；完成标准：`/` 可渲染新版骨架，`/prototypes/home-html/` 仍可访问；验证方式：浏览器访问两个路径、`npm run typecheck`）。
- [?] 任务2（AFK）：迁移静态页内容为结构化 React 区块（依赖：任务1；涉及文件：`src/features/home/content`、`src/features/home/components/sections`、`src/i18n/locales/*.json`；预期变更：导航、公告条、Hero、优势、API 地址、开发者、价格、FAQ、页脚等内容完整迁移；完成标准：首页信息完整度不低于静态 HTML；验证方式：与静态页区块清单逐项对照、桌面截图）。
- [?] 任务3（AFK）：接入主题系统与首页动效（依赖：任务1、任务2；涉及文件：`src/features/home/components`、`src/features/home/hooks`、首页 scoped CSS；预期变更：黑夜/白天主题、全屏切换动画、滚动入场、Hero 插图主题适配；完成标准：主题切换连续顺滑，滚动入场按展示顺序执行，减弱动效可降级；验证方式：Playwright 截图和动画状态检查）。
- [?] 任务4（AFK）：接入系统公告（依赖：任务1；涉及文件：`src/features/home/api.ts`、`src/features/home/hooks`、公告组件；预期变更：首页展示最新有效公告，支持空数据和失败兜底；完成标准：成功/空/失败三类状态均不阻塞首页；验证方式：mock 或测试归一化逻辑、浏览器手动切换状态）。
- [?] 任务5（AFK）：接入模型状态摘要（依赖：任务1；涉及文件：`src/features/model-status`、`src/features/home/hooks`、首页模型状态组件；预期变更：首页消费现有状态 API 或领域映射，展示摘要和跳转 `/status`；完成标准：成功/空/失败三类状态可读，完整状态页职责不被复制；验证方式：`npm run test:model-status`、新增摘要映射测试）。
- [?] 任务6（AFK）：完善多语言与可访问性（依赖：任务2、任务3、任务4、任务5；涉及文件：`src/i18n/locales/*.json`、首页组件；预期变更：首页主要文案、按钮、aria label、状态文案支持 i18n；完成标准：中文/英文切换无主要中文硬编码残留，交互控件可键盘访问；验证方式：i18n JSON 校验、浏览器语言切换检查）。
- [?] 任务7（HITL）：视觉对照与人工验收（依赖：任务1-6；涉及文件：按问题回改；预期变更：根据静态页与 React 首页截图对比修正差异；完成标准：用户认可正式首页已达到静态页视觉与内容要求；验证方式：桌面/移动、黑夜/白天、静态页/React 页截图对比）。
- [?] 任务8（AFK）：最终验证、知识同步与提交（依赖：任务7；涉及文件：测试、方案包、`.helloagents` 知识文件；预期变更：更新任务状态、运行完整验证、按配置提交；完成标准：验证通过、无非预期文件进入提交、静态页保留；验证方式：`npm run typecheck`、`npm run test:model-status`、`npm run build`、`git diff --check`）。

## Codex /goal 执行入口
按 `C:\work\aiapi114\.helloagents\plans\202605242358_static_home_react_migration\tasks.md` 执行本方案；遵守 `requirements.md`、`plan.md`、`contract.json`。按顺序完成所有 AFK 任务；任务7 为 HITL，只有在需要人工视觉确认或用户验收时暂停。不要把完整需求原文直接当作 `/goal` 目标。完成前更新 `tasks.md`、运行契约验证并完成 HelloAGENTS 收尾。

## 进度
- [?] 待开始实现。
