# 默认前端设计

本文描述 `web/default/`。`web/classic/` 是独立的兼容主题，修改默认前端不会自动同步到经典前端。

## 技术结构

默认前端使用 React 19、TypeScript、Rsbuild、TanStack Router、TanStack Query、Zustand、Base UI 和 Tailwind CSS，使用 Bun 管理依赖和运行脚本。详细编码规范见 [前端 AGENTS.md](../../web/default/AGENTS.md)。

```text
src/
  routes/       文件路由、认证守卫和页面装配
  features/     按业务领域组织的页面、API、类型和组件
  components/   跨领域组件、布局和基础 UI
  stores/       认证、系统配置和通知等全局状态
  lib/          API 客户端、格式化、错误处理和通用工具
  context/      主题、字体、方向和布局上下文
  i18n/         语言配置与翻译文件
```

## 应用启动

`src/main.tsx` 负责：

1. 初始化前端缓存与构建元数据。
2. 创建 TanStack Query Client，统一查询重试和 401/403/500 错误行为。
3. 创建类型安全的 TanStack Router。
4. 从本地状态快速应用系统名称和图标，再后台刷新 `/api/status`。
5. 挂载 Query、主题、字体、文字方向和路由 Provider。

根路由 `src/routes/__root.tsx` 加载系统配置、保存邀请参数并检查首次安装状态。`_authenticated` 布局先检查本地用户，再在每个浏览器会话首次进入时调用 `getSelf` 验证服务端 Session。

## 页面与功能模块

主要功能位于 `src/features/`：

- 公共页面：主页、定价、排行榜、关于、法律文档、登录和初始化。
- 用户功能：Playground、聊天、API Keys、使用日志、钱包、订阅和个人资料。
- 管理功能：渠道、模型/供应商/部署、用户、兑换码和统计面板。
- 根用户功能：站点、鉴权、安全、运营、模型、计费、内容和集成设置。

路由只负责 URL、权限检查、搜索参数和页面装配。业务请求、类型和页面组件应留在对应 `features/<feature>/` 中。

## 数据与状态

- 服务端状态通过 TanStack Query 获取，查询键由各 feature 维护。
- 写操作使用 Mutation，并在成功后失效或更新相关查询。
- `src/lib/api.ts` 提供统一 Axios 实例、Cookie 和通用拦截行为。
- Zustand 保存认证、系统配置和通知等跨页面状态；局部表单与弹窗状态留在组件内。
- URL 搜索参数保存表格筛选、分页或可分享状态，需通过路由校验。

不要把服务端实体长期复制到新的全局 Store；已有 Query 缓存能覆盖大多数数据共享场景。

## 权限与导航

后端权限是最终边界，前端隐藏入口只用于交互。导航同时受用户角色和后端返回的模块配置控制：

- 普通用户访问个人功能。
- 管理员访问渠道、模型、用户和兑换码等管理功能。
- 根用户额外访问系统设置和敏感运维能力。
- 任务日志导航入口仅向管理员和根用户显示；该规则只控制导航可见性，不替代后端接口授权。
- Header 与 Sidebar 模块可由系统配置启停。

新增页面时，必须同时检查文件路由、侧边栏/顶部导航、后端路由权限和直接输入 URL 的行为。

## 主题与国际化

主题基于 CSS 变量和 Provider，支持明暗模式、字体、方向、半径与布局配置。新增组件应复用 `components/ui/` 和现有 token。

所有用户可见文案使用 `react-i18next`。英文是源键，翻译文件位于 `src/i18n/locales/`；新增文案后从 `web/default/` 运行 `bun run i18n:sync` 并检查各语言文件。

## 修改前端时的最小验证

1. `bun run typecheck`
2. `bun run lint`
3. 对功能逻辑运行相关 Vitest 测试。
4. 影响构建、路由或共享组件时运行 `bun run build`。
5. 有意义的视觉改动启动开发服务器，检查桌面与移动视口、明暗主题、加载/空/错误状态和键盘操作。
