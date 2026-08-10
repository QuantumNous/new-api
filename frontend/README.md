# Ren2Hub 新前端

该目录是 Ren2Hub 当前默认的 Vue 3 前端，与仓库中的 React `web/` 兼容前端并行交付。

- Vue 应用挂载在 `/next/`；启用时，根路径和其他普通 Web 路由会以 `307` 重定向到对应的 `/next/*` 路径。
- `web/` 继续嵌入 Go 二进制，作为 `NEXT_FRONTEND_ENABLED=false` 时的兼容回退。
- 本地构建产物输出到 `frontend/dist/`；Docker 构建会把它复制到 `frontend/embed-dist/`，再由 Go `embed` 打入最终二进制。
- 首页、认证与已启用的 Console 模块统一调用同源真实后端 API。
- 后端通过 `/api/status.frontend_capabilities` 声明模块状态；未启用模块必须保持禁用并由路由守卫 fail-closed。

## 本地开发

```powershell
bun install
bun run dev
```

开发服务器默认监听 `5175`，可通过 `VITE_DEV_PORT` 修改。运行时不提供传输模式切换，所有 API 都使用同源 HTTP；本地开发由 `VITE_API_TARGET` 配置 Vite 代理目标，默认是 `http://localhost:3000`。外部文档和图片默认只允许同源地址；确需使用可信外部资源时，通过逗号分隔的 `VITE_TRUSTED_EXTERNAL_ORIGINS` 显式声明来源。

## 验证

```powershell
bun run test:run
bun run typecheck
bun run lint
bun run format:check
bun run build
```

## 路由

生产访问前缀为 `/next/`，下列路径是 Vue Router 内部路径：

- `/`：公开首页
- `/auth/*`：真实注册、登录、OAuth 回调与会话恢复页面
- `/console/*`：真实后端控制台；页面访问由 capability 与角色共同约束
- `/lab/*`：炼金室预留路由；后端 capability 未启用时拒绝访问

`/home`、`/sign-in`、`/sign-up`、`/dashboard` 和 `/pricing` 仅作为兼容重定向。受保护页面会将匿名访问者送到 `/auth/sign-in`，并只接受 `/console/*` 或 `/lab/*` 作为登录后跳转目标。

## 源码结构

```text
src/
  api/          HTTP transport、公开 API 与 Console API contracts
  assets/       由构建器处理的资源
  canvas/       首页世界地图引擎
  charts/       ECharts 适配
  components/   common/home/auth/console/lab/layout
  composables/  复用状态与交互
  constants/    首页数据与导航定义
  i18n/         en/zh-CN 分域消息
  router/       路由、守卫和兼容重定向
  stores/       公开状态、真实会话与用户身份
  styles/       tokens/base/home/console
  types/        领域 contracts
  utils/        格式化与 URL 安全
  views/        路由页面
  __tests__/    全局测试设置
```

当前暂缓接入炼金室、Token 农场、小游戏、开票、市场和订阅/套餐管理。这些模块不得调用未完成接口，也不得通过直接输入路由绕过 capability 守卫。

主题和样式约束见 [docs/THEMES.md](docs/THEMES.md)。
