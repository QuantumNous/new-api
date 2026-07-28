# Ren2Hub 新前端

该目录是 Ren2Hub 正在重构的 Vue 3 前端，与仓库中的 `web/` 旧前端并行存在。

- `web/` 仍是当前生产前端，本轮不修改其构建和交付方式。
- `frontend/` 独立开发、测试和构建，产物输出到 `frontend/dist/`。
- 首页访问现有公开接口；Console 与 Lab 目前明确使用本地 Mock，不代表已经接入真实认证或后台业务接口。

## 本地开发

```powershell
bun install
bun run dev
```

开发服务器默认监听 `5175`，可通过 `VITE_DEV_PORT` 修改。`VITE_API_TARGET` 用于代理首页访问的现有公开 API。外部文档、发票和图片默认只允许同源地址；确需使用可信外部资源时，通过逗号分隔的 `VITE_TRUSTED_EXTERNAL_ORIGINS` 显式声明来源。

## 验证

```powershell
bun run test:run
bun run typecheck
bun run lint
bun run format:check
bun run build
```

## 路由

- `/`：公开首页
- `/auth/*`：Demo 认证页面
- `/console/*`：Mock 控制台
- `/lab/*`：Mock Lab

`/home`、`/sign-in`、`/sign-up`、`/dashboard` 和 `/pricing` 仅作为兼容重定向。受保护页面会将匿名访问者送到 `/auth/sign-in`，并只接受 `/console/*` 或 `/lab/*` 作为登录后跳转目标。

## 源码结构

```text
src/
  api/          transport、公开 API、Console/Lab Mock
  assets/       由构建器处理的资源
  canvas/       首页世界地图引擎
  charts/       ECharts 适配
  components/   common/home/auth/console/lab/layout
  composables/  复用状态与交互
  constants/    首页数据与导航定义
  i18n/         en/zh-CN 分域消息
  router/       路由、守卫和兼容重定向
  stores/       公开状态与 Demo 身份
  styles/       tokens/base/home/console
  types/        领域 contracts
  utils/        格式化与 URL 安全
  views/        路由页面
  __tests__/    全局测试设置
```

Demo 身份只写入 `ren2hub_demo_*` 命名空间。本地角色仅用于演示路由和界面，不具备真实权限语义。

主题和样式约束见 [docs/THEMES.md](docs/THEMES.md)。
