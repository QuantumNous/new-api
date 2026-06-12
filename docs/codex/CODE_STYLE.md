# Code Style

## 命名与目录

- Go 代码按职责分目录：`router` 注册路由，`middleware` 处理横切逻辑，`controller` 处理请求与响应，`service` 承载业务逻辑，`model` 负责持久化。
- Go 文件与函数命名多使用业务名词，例如 `channel_upstream_update.go`、`payment_webhook_availability.go`、`StartSubscriptionQuotaResetTask`。
- 前端默认版按 `routes/` 和 `features/<feature>/` 拆分，通用能力放在 `lib/`、`hooks/`、`stores/`、`components/`。
- 前端经典版按 `pages/`、`components/`、`helpers/`、`hooks/`、`services/` 拆分。
- 默认前端使用 `@` 指向 `web/default/src`；经典前端也配置了 `@` 指向 `web/classic/src`。

## Go 风格

- 使用 `gofmt` 保持格式，导入通常先标准库，再项目包，再第三方包。
- 路由分组后按权限拆分匿名、自助、管理员和 Root 接口，鉴权中间件直接挂在路由组。
- Controller 中参数解析失败、权限失败、业务失败优先通过 `common.ApiError*`、`common.ApiErrorI18n` 等统一响应。
- 多语言用户提示优先使用 `i18n` 消息键，不直接散落硬编码提示。
- 数据库访问通过 `model.DB`、`model.LOG_DB` 和模型方法组织，修改模型时要考虑 SQLite、MySQL、PostgreSQL 兼容。
- 业务复杂度应下沉到 `service/` 或 `pkg/`，避免在 Router 或 Controller 中堆叠大段逻辑。
- 涉及可选 JSON 标量时要注意显式零值语义，避免把合法的 `0`、`false` 当作缺省值丢失。

## 默认前端风格

- 使用 React 19、TypeScript、TanStack Router、React Query、Zustand、Tailwind CSS。
- 新文件通常保留 AGPL/商业授权版权头。
- Prettier 约定：2 空格、单引号、无分号、`printWidth: 80`、LF、ES5 trailing comma。
- ESLint 要求无重复 import、偏好 type import、未使用变量报错；故意忽略的变量使用 `_` 前缀。
- API 请求统一走 `web/default/src/lib/api.ts` 或 feature 内的 `api.ts`，避免分散创建 axios 实例。
- 认证状态走 `useAuthStore`，服务端状态优先使用 React Query。
- UI 工具类合并使用 `cn()`，不要手写重复的 `clsx`/`tailwind-merge` 组合。
- shadcn 配置位于 `components.json`，样式为 `base-nova`，图标库为 `hugeicons`。

## 经典前端风格

- 使用 JS/JSX、React、Semi UI、react-router-dom。
- Prettier 配置来自 `@so1ve/prettier-config`，本地 package 也声明单引号。
- API 请求主要通过 `web/classic/src/helpers/api.js` 中的 `API` axios 实例。
- 全局状态倾向使用 Context，例如 `UserProvider`、`StatusProvider`、`ThemeProvider`。
- 页面代码集中在 `pages/`，复用逻辑放在 `helpers/`、`hooks/`、`components/`。

## 状态管理与数据流

- 后端典型链路：Router -> Middleware -> Controller -> Service -> Model -> 数据库/缓存。
- Relay 典型链路：Token 鉴权与限流 -> 渠道分发 -> Controller 校验 -> 计费预扣 -> Provider adaptor -> 响应转换与结算。
- 默认前端典型链路：Route -> Feature component/hook -> `lib/api.ts` 或 feature API -> 后端 `/api` 或 Relay 路径。
- 经典前端典型链路：Page -> helper/hook/component -> `helpers/api.js` -> 后端接口。

## 错误处理

- Go 中数据库和外部服务错误应记录必要上下文，但不能输出密钥、Token、cookie、证书内容。
- 用户可见错误应尽量使用 i18n 文案和统一 JSON 响应结构。
- 前端默认版在 React Query 与 axios interceptor 中处理全局错误，局部请求可通过配置跳过默认处理。
- 经典前端在 axios interceptor 中统一调用 `showError`，个别请求可通过 `skipErrorHandler` 绕过全局提示。

## 测试风格

- Go 测试与被测包同目录，文件名为 `*_test.go`。
- 测试命名使用 `TestXxx`，常见覆盖重点包括计费、Relay 转换、权限边界、支付 webhook、DTO 零值语义和缓存逻辑。
- 共享逻辑修改优先跑受影响包测试，再根据风险扩大到 `go test ./...`。
- 前端当前以 typecheck、lint、build 作为主要验证入口；未观察到前端测试是日常主路径。

## 禁止做法

- 不要为了文档或小改动新增依赖、修改 lockfile 或改动业务代码。
- 不要读取或输出真实 `.env`、证书、私钥、生产密钥。
- 不要绕开现有 Router/Controller/Service/Model 分层直接跨层堆逻辑。
- 不要在支付、认证、权限、Webhook、数据库迁移、Relay 计费等高风险区域未确认就修改行为。
- 不要删除版权头、许可证文件或构建配置中的第三方许可证保留逻辑。
- 不要用前端硬编码文案替代已有 i18n 体系。
