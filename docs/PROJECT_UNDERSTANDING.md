# Project Understanding

最后更新：2026-05-12

这份文档是给维护者和 AI 助手快速恢复项目上下文用的“项目地图”。它不替代 README、官方文档或 `AGENTS.md`，而是记录我读完当前仓库后对结构、主链路、扩展点和容易踩坑规则的理解。

## 一句话定位

`new-api` 是一个 Go 实现的 AI API 网关/代理系统：对下游暴露 OpenAI、Claude、Gemini、Midjourney、Suno、视频任务等兼容接口，对上游聚合多家模型供应商，同时负责用户、令牌、渠道、分组、计费、日志、订阅、支付、限流和管理后台。

## 技术栈快照

- 后端：Go、Gin、GORM、Redis、JWT/session、WebAuthn、OAuth。
- 数据库：SQLite、MySQL、PostgreSQL 都要保持可用。
- 前端默认主题：`web/default`，React 19 + TypeScript + Rsbuild + TanStack Router/Query + Base UI + Tailwind CSS。
- 前端经典主题：`web/classic`，React 18 + Vite + Semi UI。
- 构建：两个前端都构建到 `dist` 后由 `main.go` 用 `embed.FS` 嵌入 Go 二进制。
- 当前源码事实：`go.mod` 声明 `go 1.25.1`，Docker 构建镜像使用 Go 1.26.1。

## 启动链路

入口是 `main.go`。

启动大致顺序：

1. `InitResources()` 加载 `.env`，初始化环境变量、日志、模型倍率设置、HTTP client、token encoder。
2. `model.InitDB()` 选择并连接主数据库，主节点执行迁移。
3. `model.CheckSetup()` 判断系统初始化状态。
4. `model.InitOptionMap()` 构造运行时配置表，再从 `options` 数据库表覆盖。
5. 清理磁盘缓存，加载模型价格，初始化日志数据库、Redis、性能指标、系统监控、后端 i18n、自定义 OAuth provider。
6. 启动后台任务：渠道缓存同步、配置热更新、配额数据看板、渠道自动检测/更新、Codex credential 刷新、订阅配额重置、异步任务轮询等。
7. 创建 Gin server，挂载 recovery、request id、i18n、logger、session，再调用 `router.SetRouter()`。
8. 监听 `PORT` 或 `--port`，默认 3000。

重要文件：

- `main.go`：进程生命周期、嵌入前端、后台任务、Gin 初始化。
- `common/init.go`：命令行参数和环境变量初始化。
- `model/main.go`：数据库选择、迁移、关闭。
- `model/option.go`：运行时配置 OptionMap 的默认值、DB 覆盖和热同步。
- `router/main.go`：总路由装配。

## 路由地图

路由按职责分成几块：

- `/api/*`：管理后台和用户侧 REST API，定义在 `router/api-router.go`。
- `/v1/*`：OpenAI/Claude/OpenAI Responses/Audio/Image/Embedding/Rerank/Realtime 等 relay 入口，定义在 `router/relay-router.go`。
- `/v1beta/*`：Gemini 原生或兼容接口。
- `/mj/*` 与 `/:mode/mj/*`：Midjourney proxy。
- `/suno/*`：Suno 任务提交和查询。
- `/pg/chat/completions`：Playground relay。
- `/dashboard/billing/*` 与 `/v1/dashboard/billing/*`：旧 OpenAI dashboard billing 兼容接口。
- 前端页面：`router/web-router.go` 从嵌入的 `web/default/dist` 或 `web/classic/dist` 服务静态资源；若设置 `FRONTEND_BASE_URL` 且不是 master node，则 `NoRoute` 重定向到外部前端。

路由到业务层的基本关系：

```
router -> middleware -> controller -> service/model/relay
```

relay 请求的关系更像：

```
router/relay-router.go
  -> middleware.TokenAuth()
  -> middleware.ModelRequestRateLimit()
  -> middleware.Distribute()
  -> controller.Relay()
  -> relay helper
  -> relay/channel adaptor
  -> upstream provider
```

## Relay 主链路

Relay 是这个项目最核心、也最容易改出连锁反应的部分。

### 1. 选渠道前

`middleware.Distribute()` 做这些事：

- 从请求体、路径或 query 中解析模型名。
- 判断是否需要选渠道。任务查询、MJ 查询等只查任务时可能不选。
- 校验 token 的模型权限。
- 支持 playground 指定 group。
- 优先尝试 channel affinity，否则调用 `service.CacheGetRandomSatisfiedChannel()` 按分组、模型、权重、优先级等选一个满足条件的渠道。
- 通过 `SetupContextForSelectedChannel()` 把渠道 id、类型、key、base_url、model_mapping、status_code_mapping、param/header override、多 key 状态等写入 Gin context。

### 2. Relay controller

`controller.Relay()` 是统一生命周期：

1. WebSocket realtime 先升级连接。
2. `relay/helper.GetAndValidateRequest()` 根据 relay format 解析并校验 DTO。
3. `relay/common.GenRelayInfo()` 生成 `RelayInfo`。
4. 可选敏感词检查。
5. `service.EstimateRequestToken()` 估算 prompt token。
6. `relay/helper.ModelPriceHelper()` 计算预扣费额度和价格快照。
7. `service.PreConsumeBilling()` 创建计费会话并预扣钱包/订阅/令牌额度。
8. 按 `common.RetryTimes` 重试：取渠道、恢复请求体、调用具体 helper。
9. 失败时根据错误决定是否重试、是否自动禁用渠道、是否记录错误日志。
10. 成功后由 helper 内部进行实际结算和消费日志；失败 defer 里退款或收违规费用。

### 3. Relay helper

常见 helper：

- `relay/compatible_handler.go`：OpenAI chat/completions/moderations 等文本兼容链路。
- `relay/responses_handler.go`：OpenAI Responses 和 compact。
- `relay/claude_handler.go`：Claude Messages。
- `relay/gemini_handler.go`：Gemini 原生。
- `relay/audio_handler.go`、`image_handler.go`、`embedding_handler.go`、`rerank_handler.go`。
- `relay/relay_task.go`：异步任务类提交、轮询、结算。

文本链路的关键步骤：

- `info.InitChannelMeta(c)` 从 context 生成 `ChannelMeta`。
- `helper.ModelMappedHelper()` 应用模型映射。
- 根据渠道是否支持 `StreamOptions` 和请求是否 stream 处理 `stream_options`。
- 获取 adaptor：`relay.GetAdaptor(info.ApiType)`。
- 走 pass-through 或调用 adaptor 转换请求。
- 应用 disabled fields、param override、header override。
- `adaptor.DoRequest()` 发上游。
- `adaptor.DoResponse()` 解析响应、透传流、生成 usage。
- `service.PostTextConsumeQuota()` 或 `PostAudioConsumeQuota()` 结算、记录日志、写性能样本。

### 4. Provider adaptor

接口定义在 `relay/channel/adapter.go`。

普通 relay adaptor 要实现：

- `Init`
- `GetRequestURL`
- `SetupRequestHeader`
- `ConvertOpenAIRequest`
- `ConvertClaudeRequest`
- `ConvertGeminiRequest`
- `ConvertOpenAIResponsesRequest`
- `ConvertEmbeddingRequest`
- `ConvertAudioRequest`
- `ConvertImageRequest`
- `ConvertRerankRequest`
- `DoRequest`
- `DoResponse`
- `GetModelList`
- `GetChannelName`

任务 adaptor 还要负责：

- 校验任务请求和 action。
- 预估/调整任务计费。
- 构造任务请求 URL/header/body。
- 解析提交响应中的 upstream task id。
- 轮询任务结果并在完成时做实际结算。

新增渠道时通常要改：

- `constant/channel.go` 或相关 API/channel type 常量。
- `common/api_type.go` 中 channel type 到 API type 的映射。
- `relay/relay_adaptor.go` 注册普通 adaptor 或 task adaptor。
- `relay/channel/<provider>/` 新增实现。
- 若支持流式 usage，确认并加入 `streamSupportedChannels`。
- 前端渠道类型、模型列表、配置表单和 i18n。

## 计费系统

计费发生在请求前、响应后和失败回滚三个阶段。

### 预扣费

`relay/helper/price.go` 的 `ModelPriceHelper()` 计算 `types.PriceData`：

- 传统倍率计费：模型倍率、completion ratio、cache ratio、image/audio ratio、group ratio。
- 固定价格计费：`ModelPrice` 与 `QuotaPerUnit`。
- 表达式计费：`billing_setting.BillingModeTieredExpr` 走 `modelPriceHelperTiered()`。

`service.PreConsumeBilling()` 创建 `BillingSession`，再预扣：

- token quota
- user wallet quota 或 subscription quota

### 后结算

`service.PostTextConsumeQuota()` 根据上游 usage 重新计算真实 quota，然后调用 `service.SettleBilling()`。

`BillingSession.Settle(actualQuota)` 会计算 `actualQuota - preConsumedQuota`，补扣或退回差额。失败请求则 `BillingSession.Refund()` 异步退还预扣。

### 表达式计费

表达式计费的设计文档是 `pkg/billingexpr/expr.md`，改这块必须先读。

核心原则：

- 表达式里的系数是真实的 `$ / 1M tokens`，不是旧倍率。
- `p`/`c` 会根据表达式是否使用 `cr`、`cc`、`img`、`ai`、`ao` 等变量自动排除子类别，避免重复计费。
- 阶梯条件应该用 `len`，不是 `p`，因为 `len` 表示完整输入上下文。
- 预扣时冻结 `BillingSnapshot`，结算时用实际 usage 重新跑同一表达式。

相关文件：

- `pkg/billingexpr/*`：表达式编译、运行、结算、round、类型。
- `setting/billing_setting/tiered_billing.go`：模型计费模式和表达式配置。
- `relay/helper/price.go`：表达式预扣。
- `service/tiered_settle.go`、`service/text_quota.go`：表达式结算和日志。

## 数据库和模型层

主数据库连接在 `model.InitDB()`：

- `SQL_DSN` 以 `postgres://` 或 `postgresql://` 开头时使用 PostgreSQL。
- `SQL_DSN` 非空且不是 PostgreSQL/local 时按 MySQL。
- 空或 `local` 走 SQLite，路径来自 `SQLITE_PATH` 或默认值。
- `LOG_SQL_DSN` 可单独配置日志数据库；不配则日志表用主库。

迁移集中在 `model/main.go`：

- 主节点才迁移。
- 大部分走 `GORM AutoMigrate`。
- SQLite 特殊处理 `subscription_plans`，因为 SQLite 不支持一些 ALTER COLUMN 能力。
- 保留 `commonGroupCol`、`commonKeyCol`、`commonTrueVal`、`commonFalseVal` 处理跨数据库 SQL 差异。

数据库改动规则：

- 优先用 GORM API。
- 必须兼容 SQLite、MySQL、PostgreSQL。
- 原始 SQL 要处理列引用、布尔值、SQLite ALTER 限制。
- JSON 类字段优先用 TEXT 或已有跨库序列化方式，不引入单库专属类型。

常见模型：

- `model.User`：用户、额度、角色、分组。
- `model.Token`：下游 API key、模型限制、额度、过期等。
- `model.Channel`：上游渠道、key、多 key、模型、分组、映射、配置、override。
- `model.Log`：消费和错误日志。
- `model.Option`：运行时配置。
- `model.Subscription*`：订阅套餐、订单、用户订阅、预扣记录。
- `model.Task`：异步任务状态、上游任务 id、任务计费上下文。
- `model.Model`、`model.Vendor`：模型元数据和供应商元数据。

## 配置系统

配置有两层：

1. 环境变量：`common.InitEnv()` 在启动时读取，适合节点级、部署级配置。
2. 数据库 options：`model.InitOptionMap()` 提供默认值，再从 `options` 表覆盖，运行中 `model.SyncOptions()` 定期热更新。

`setting/config` 提供了新的结构化配置注册机制。很多子包会在 `init()` 中注册配置，例如：

- `setting/ratio_setting`
- `setting/billing_setting`
- `setting/model_setting`
- `setting/operation_setting`
- `setting/system_setting`
- `setting/performance_setting`

改配置项时要同时考虑：

- 默认值放在哪里。
- `OptionMap` 是否要暴露给前端。
- `updateOptionMap()` 是否需要在运行时同步到全局变量或结构化 config。
- 前端系统设置页面是否需要表单项、校验、i18n。

## 缓存和后台任务

缓存层包括 Redis、内存缓存和磁盘缓存。

- `common.InitRedisClient()` 初始化 Redis。
- 如果 Redis enabled，会强制启用内存缓存以兼容旧逻辑。
- `model.InitChannelCache()`、`model.SyncChannelCache()` 维护渠道能力缓存。
- token/user/channel 相关缓存分别散落在 `model/*_cache.go` 和 `service` 中。
- channel affinity 会记录用户/模型/分组偏好的成功渠道，用于后续优先命中。
- 磁盘缓存清理由 `common.CleanupOldCacheFiles()` 处理。

后台任务从 `main.go` 启动：

- 配置热同步：`model.SyncOptions()`。
- 配额看板：`model.UpdateQuotaData()`。
- 渠道自动更新/检测：`controller.AutomaticallyUpdateChannels()`、`AutomaticallyTestChannels()`。
- Codex credential 自动刷新：`service.StartCodexCredentialAutoRefreshTask()`。
- 订阅配额重置：`service.StartSubscriptionQuotaResetTask()`。
- 任务轮询：`controller.UpdateMidjourneyTaskBulk()`、`controller.UpdateTaskBulk()`。
- 批量更新：`model.InitBatchUpdater()`。

## 前端：默认主题

路径：`web/default`。

定位：当前主力前端。

关键入口：

- `web/default/src/main.tsx`：React root、QueryClient、Router、主题、字体、方向、全局错误处理、系统标题/图标初始化。
- `web/default/src/routes`：TanStack Router 文件路由。
- `web/default/src/routeTree.gen.ts`：路由插件生成文件。
- `web/default/src/lib/api.ts`：统一 axios 实例、GET 去重、业务错误和认证错误处理、常用 API。
- `web/default/src/stores/auth-store.ts`：Zustand auth store，localStorage 恢复用户。
- `web/default/src/i18n/config.ts`：i18next 配置，支持 `en`、`zh`、`fr`、`ru`、`ja`、`vi`。
- `web/default/rsbuild.config.ts`：Rsbuild、dev proxy、chunk split、TanStack Router 插件。

目录风格：

- `src/features/<feature>`：业务功能模块，内部常有 `components`、`hooks`、`lib`、`api.ts`、`types.ts`。
- `src/components`：跨功能通用组件、layout、ui、data-table。
- `src/lib`：通用 API、错误处理、工具函数。
- `src/routes`：页面路由入口，通常只组合 feature 组件。
- `src/stores`：Zustand 全局状态。
- `src/i18n/locales/*.json`：平铺翻译 JSON。

认证路由：

- 根路由 `__root.tsx` 做 setup 状态检查。
- `_authenticated/route.tsx` 做登录状态校验和 `/sign-in` 重定向。
- 401/500 等在 QueryCache 和路由错误组件中处理。

开发/构建：

- 包管理器优先 Bun。
- `cd web/default && bun run dev`
- `cd web/default && bun run typecheck`
- `cd web/default && bun run build`
- `cd web/default && bun run i18n:sync`

## 前端：经典主题

路径：`web/classic`。

定位：旧版/经典前端，仍会被构建并嵌入。

关键入口：

- `web/classic/src/index.jsx`：React root、BrowserRouter、User/Status/Theme provider、Semi Locale。
- `web/classic/src/App.jsx`：React Router 路由表。
- `web/classic/src/helpers`：老前端的 API、鉴权、格式化工具集合。
- `web/classic/src/i18n/i18n.js`：i18next，fallback 是 `zh-CN`。
- `web/classic/vite.config.js`：Vite、Semi 插件、dev proxy、manual chunks。

开发/构建：

- `cd web/classic && bun run dev`
- `cd web/classic && bun run build`

## 构建和部署

常用目标：

- `make build-frontend`：构建默认主题。
- `make build-frontend-classic`：构建经典主题。
- `make build-all-frontends`：构建两套前端。
- `make dev-api`：用 `docker-compose.dev.yml` 启后端依赖。
- `make dev-web`：启动默认主题 dev server。
- `make dev`：启动开发依赖和默认主题前端。

Dockerfile 是多阶段构建：

1. Bun 构建 `web/default/dist`。
2. Bun 构建 `web/classic/dist`。
3. Go 构建后端，并把两个 dist copy 到对应路径供 `embed` 使用。
4. Debian slim 运行 `/new-api`，工作目录 `/data`。

`docker-compose.yml` 默认使用 PostgreSQL + Redis，也保留 MySQL 注释示例。

## 常见改动入口

新增后端管理 API：

- 在 `controller` 增加 handler。
- 在 `service` 或 `model` 放业务/数据逻辑。
- 在 `router/api-router.go` 挂路由和鉴权中间件。
- 如前端调用，补 `web/default/src/features/<feature>/lib/api.ts` 或已有 API 文件。

新增 relay endpoint：

- 在 `router/relay-router.go` 加路径。
- 在 `relay/constant/relay_mode.go` 加 path 到 relay mode 映射。
- 在 `relay/helper/valid_request.go` 加 DTO 解析和校验。
- 在 `controller.Relay()` 或对应 task controller 分发。
- 在 helper/adaptor 中实现转换和响应处理。

新增 provider/channel：

- 加 channel/api 常量和映射。
- 新建 `relay/channel/<provider>` adaptor。
- 注册到 `relay/relay_adaptor.go`。
- 前端渠道创建/编辑表单支持新类型。
- 如果支持流式 usage，加入 `streamSupportedChannels`。
- 测试模型映射、header、base URL、错误响应、usage、stream、重试、自动禁用。

改模型定价：

- 传统默认倍率/价格在 `setting/ratio_setting/model_ratio.go`。
- 运行时配置从 options 进来。
- 动态/阶梯表达式走 `setting/billing_setting` 和 `pkg/billingexpr`。
- 前端模型/计费 UI 分布在 `web/default/src/features/system-settings`、`pricing`、`usage-logs` 等模块。

改前端页面：

- 默认优先改 `web/default`。
- 页面路由在 `src/routes`，功能主体在 `src/features`。
- 新增用户可见文案必须用 `useTranslation()` 和 locale JSON。
- TypeScript 改动后跑 `bun run typecheck`。

改 i18n：

- 后端：`i18n/locales/*.yaml` 和 `i18n/keys.go`。
- 默认前端：`web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi}.json`，脚本 `bun run i18n:sync`。
- 经典前端：`web/classic/src/i18n/locales/*`。

改 OAuth：

- 固定 provider 在 `oauth/*`，统一注册在 `oauth/registry.go`。
- 路由在 `router/api-router.go` 的 `/api/oauth/:provider`。
- controller 分布在 `controller/oauth.go`、`controller/custom_oauth.go`、provider 相关文件。
- 自定义 provider 从 DB 加载：`oauth.LoadCustomProviders()`。

改订阅/支付：

- 订阅 controller：`controller/subscription*.go`。
- 支付 topup：`controller/topup*.go`。
- 模型：`model/subscription.go`、`model/topup.go`。
- 计费资金来源：`service/*funding*`、`service/billing_session.go`。

## 硬约束

这些是维护时必须优先满足的规则：

- JSON marshal/unmarshal 不直接用 `encoding/json` 函数，业务代码使用 `common.Marshal`、`common.Unmarshal`、`common.DecodeJson` 等 wrapper。`json.RawMessage` 作为类型可以用。
- 数据库代码必须同时兼容 SQLite、MySQL、PostgreSQL。
- 上游 relay DTO 中，客户端可选的 scalar 字段如果要原样转发，必须用指针 + `omitempty`，避免显式 `0`、`false` 被丢掉。
- 新 channel 要确认 `StreamOptions` 支持情况，支持则加入 `streamSupportedChannels`。
- 表达式计费相关改动必须先读 `pkg/billingexpr/expr.md`。
- 不要删除、替换、改名项目和组织相关标识、版权、许可证、包路径、镜像名、README attribution 等受保护信息。
- 前端默认使用 Bun，不要无故引入 npm/yarn/pnpm lockfile。
- 不要在无关改动里重排大文件、格式化整仓库或改动生成物。

## 推荐验证

后端：

- `go test ./...`
- 若只改 relay：至少跑相关 `relay/...`、`service/...`、`dto/...` 测试。
- 若改数据库迁移：需要在 SQLite、MySQL、PostgreSQL 都验证。

默认前端：

- `cd web/default && bun run typecheck`
- `cd web/default && bun run build`
- i18n 改动后：`cd web/default && bun run i18n:sync`

经典前端：

- `cd web/classic && bun run build`

整包构建：

- `make build-all-frontends`
- `go build ./...` 或 Docker build。

## 当前测试分布

当前仓库有后端 Go 测试，重点覆盖：

- JSON wrapper、URL 校验。
- controller 的渠道、模型列表、支付 webhook、token。
- DTO 的 Gemini/OpenAI request 细节。
- billing expression、tiered settle、text quota、task billing。
- relay stream scanner、override、Gemini/Claude/AWS/Minimax adaptor。
- setting config 和状态码规则。

前端测试目前不是主线，默认更依赖 typecheck、lint/build 和人工/浏览器验证。

## 目录总览

```text
.
├── common/          # 全局工具、env、JSON wrapper、Redis、缓存、限流、quota、文件/音频/URL 工具
├── constant/        # API/channel/context/task 等常量
├── controller/      # Gin handler，管理 API、relay controller、支付、订阅、任务、OAuth
├── dto/             # 请求/响应 DTO，尤其 relay 格式转换相关结构
├── i18n/            # 后端 i18n
├── logger/          # 日志初始化和格式化
├── middleware/      # 鉴权、分发、限流、CORS、日志、性能、request body 复用
├── model/           # GORM 模型、迁移、缓存、DB 操作
├── oauth/           # OAuth provider 和注册表
├── pkg/             # 内部包：billingexpr、cachex、ionet、perf_metrics
├── relay/           # 下游兼容接口到上游 provider 的核心转换和转发
│   ├── channel/     # provider adaptor
│   ├── common/      # RelayInfo、billing 接口、override、stream 状态
│   ├── helper/      # request 校验、模型映射、价格、stream 工具
│   └── constant/    # relay mode
├── router/          # Gin 路由装配
├── service/         # 业务服务：计费、quota、token 统计、任务、敏感词、渠道选择等
├── setting/         # 运行时设置、模型/倍率/支付/系统/性能配置
├── types/           # 跨层类型和错误类型
└── web/
    ├── default/     # 当前默认前端
    └── classic/     # 经典前端
```

## 阅读优先级

以后接手一个需求时，我会按这个顺序找上下文：

1. 先读 `AGENTS.md` 和相关子目录 `AGENTS.md`。
2. 判断是管理 API、relay、计费、数据库、前端还是部署问题。
3. relay 问题先看 `router/relay-router.go`、`controller/relay.go`、`middleware/distributor.go`、对应 `relay/*_handler.go` 和 provider adaptor。
4. 计费问题先看 `relay/helper/price.go`、`service/billing_session.go`、`service/text_quota.go`，表达式计费先读 `pkg/billingexpr/expr.md`。
5. 前端默认先看 `web/default/src/routes` 再到 `web/default/src/features`。
6. 配置问题先看 `model/option.go` 和 `setting/*`。
7. 数据库问题先看 `model/main.go` 和相关 `model/*.go`。

