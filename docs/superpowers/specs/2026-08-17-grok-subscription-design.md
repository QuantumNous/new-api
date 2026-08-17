# Grok Subscription 渠道适配设计

- 日期：2026-08-17
- 状态：待书面审阅
- 目标分支：`feature/grok-subscription`
- NewAPI 基线：`origin/main@e336df31bebd05168a2984f55942a13bea90ab3e`
- 协议观察源：`sub2api origin/main@e330c243a8f142f8963d784916da0093ab7084ee`

## 1. 背景

NewAPI 当前的 xAI 渠道是官方 API Key 模式：凭证作为 Bearer API Key 发往 `api.x.ai`。Grok 订阅账号则是另一套产品边界：OAuth/PKCE 凭证、刷新令牌轮换、订阅与额度状态、CLI 身份头，以及分别位于 CLI 网关和官方 API 主机上的文本、媒体、语音和实时能力。

本功能在 NewAPI 中新增独立的 **Grok Subscription** 渠道类型。现有 xAI API Key 渠道保持原样，不复用其凭证语义，也不把 OAuth 分支塞进现有 xAI adaptor。

本设计是对已观察协议行为的 clean-room 重实现。实现可以复用 NewAPI 已有的 OAuth、OpenAI/Responses/Claude 转换、任务、计费和渠道调度基础设施，但不得逐段复制 Sub2API 的 LGPL 实现。

## 2. 已确认的产品决策

| 项目 | 决策 |
| --- | --- |
| 渠道模型 | 新增独立 `Grok Subscription` 渠道；一个 Grok 账号对应一个 NewAPI 渠道 |
| 现有 xAI 渠道 | 不改认证、请求地址和既有行为 |
| 认证入口 | PKCE 浏览器 OAuth、refresh token 导入、Web SSO Cookie 转 OAuth、邮箱/密码登录全部支持 |
| 密码登录 | 功能存在但默认关闭；仅管理员显式开启且服务端 CAPTCHA solver secret 已配置时可用 |
| 文本协议 | Responses、Responses compact、Chat Completions、Claude Messages、Claude count-tokens |
| 工具 | function tools、Web Search、X Search |
| 媒体 | 图片生成/编辑；视频生成/编辑/扩展/状态/内容 |
| 语音 | TTS、STT、自定义声音 CRUD/试听、Realtime WebSocket |
| 凭证存储 | `Channel.Key` 存版本化 OAuth JSON；不在其他字段复制 token |
| 临时敏感输入 | 原始密码和 SSO Cookie 永不落库、永不写日志、永不进入任务或缓存持久化 |
| PKCE 状态 | 新增 Grok 专用、可跨节点的 `AuthFlow` 一次性状态表（不复用、也不迁移 Copilot 的 Redis+内存 fallback 或 Codex 的 gin session），不新增仅适用于单节点的 Grok session map |
| 并发 | 完全复用 `Channel.MaxConcurrency` 与 `service/channel_concurrency.go`；默认仍为 `0`（不限并发） |
| 刷新协调 | 只为凭证刷新增加独立的跨节点 lease；它不占用请求并发槽 |
| 调度 | 复用现有 group、model、priority、weight、affinity、retry、cooldown 和 failover |
| 非目标 | 不移植 Sub2API 的账号池调度，也不移植图片批处理或工作台产品功能 |

## 3. 方案比较

### 方案 A：独立 Grok Subscription 渠道（采用）

认证、状态和上游路由由 Grok 专用模块负责，通用调度、转换、计费和任务生命周期继续复用 NewAPI。这样能保留一个渠道一个账号的运维模型，也不会污染现有 xAI API Key 行为。

### 方案 B：把订阅凭证作为现有 xAI 渠道的 Key 变体（拒绝）

改动表面较少，但 API Key 与 OAuth 的刷新、订阅状态、CLI headers、媒体主机和错误策略不同。两种凭证长期共用一个 adaptor 会产生大量条件分支，并提高 API Key 回归和凭证误发到错误主机的风险。

### 方案 C：移植 Sub2API 的账号池与平台账号模型（拒绝）

能力最接近源项目，但会绕过 NewAPI 已有的 Channel、Ability、优先级、权重、并发 lease、计费和任务系统。重复建设调度器既扩大范围，也会造成两套运行时规则。

## 4. 总体架构

```text
Admin channel UI
  -> save pending-auth Grok channel (no Ability)
  -> Grok auth endpoints bound to channel ID
  -> AuthFlow / auth converters
  -> versioned OAuth credential in Channel.Key
  -> non-secret Grok channel state

Client request
  -> existing NewAPI auth / billing pre-consume / channel selection
  -> existing Channel.MaxConcurrency lease
  -> Grok credential provider
       -> valid token: fast path
       -> expiring/401: cross-node refresh lease -> refresh -> atomic save
  -> Grok adaptor / protocol bridge
       -> CLI proxy: text, tools, quota
       -> api.x.ai: image, video, voice, realtime
  -> existing response, task, billing, logging and failover lifecycle
```

实现分四个工作流，并按两个可独立上线的里程碑组织：

1. 渠道类型、凭证、AuthFlow、非秘密状态和刷新 lease。
2. Responses、Chat、Claude、工具和搜索。
3. 图片、视频、TTS、STT、自定义声音和 Realtime。
4. 管理 UI、配额/能力状态、脱敏、回归和端到端验证。

**里程碑 A（文本先行，可独立合并上线）= 工作流 1 + 工作流 2 + 工作流 4 中与文本相关的 UI/状态/脱敏/回归部分。** 一个只提供认证与文本能力（Responses/Chat/Claude/count-tokens/工具搜索）的 Grok Subscription 渠道本身即具备完整、可交付的产品价值，其验收对应第 19 节第 1、2、3、5、6（文本与流式部分）、7、8、9、10 条，不依赖任何媒体/语音能力。

**里程碑 B（增量交付）= 工作流 3 + 工作流 4 中媒体相关部分**，即图片、视频（生成/编辑/扩展/状态/内容）、TTS/STT、自定义声音和 Realtime，对应第 19 节第 4 条及第 6 条媒体部分。

每个工作流独立测试和提交。里程碑 A 达成其对应验收项即可合并上线，不被里程碑 B 阻塞；里程碑 B 的任一能力（如 Realtime、自定义声音）若延期或受阻，不影响已上线的文本能力。全部验收项通过时视为整体功能完成。

## 5. 渠道、模型与并发

### 5.1 独立渠道类型

新渠道类型接管 `ChannelTypeDummy` 当前占用的 `113`，并把 `ChannelTypeDummy` 后移到 `114`（`constant/channel.go`；`ChannelTypeDummy` 一贯是「仅用于计数、其后不得新增渠道」的哨兵，下游自定义渠道从 100 起，这正是仓库 `constant/AGENTS.md` 要求的新增方式，因此 `113` 不是「空闲值」而是从 Dummy 手中接管）。API type 枚举同理：`APITypeGrokSubscription` 取当前 `APITypeDummy` 的值 `38`，`APITypeDummy` 后移到 `39`（`constant/api_type.go` 用 iota 连续赋值——经编译器实测确认 `APITypeBlockRun=35`、`APITypeElevenLabs=36`、`APITypeCopilot=37`、`APITypeDummy=38`，因此接管值就是 `38`；实现时以 iota 位置为准，不要硬编码字面量）。改动这两个哨兵位必须同步更新断言其相对位置的守卫测试 `constant/copilot_channel_test.go` 与 `constant/modelapi_seedance_channel_test.go`，否则编译测试即红。若实施前 main 又占用了这些值，只允许重新取当时 Dummy 前的下一个值，不能复用或改写已发布类型。新类型在渠道名称、图标、默认模型、adaptor 注册、渠道测试和前端类型元数据中登记。现有 `ChannelTypeXai` 不改。

Grok Subscription 不接受任意自定义上游 Base URL。允许的目标由代码常量和严格 host/path 校验决定；渠道的 `Proxy` 仍可作为出站网络代理，并应用于 OAuth、刷新、SSO 转换和推理，以保持账号网络出口一致。

### 5.2 调度和并发

一个 OAuth 账号对应一个 Channel。多个账号通过多个 Channel 表达，继续使用现有：

- group/model Ability 过滤；
- priority 和 weight；
- 渠道亲和性；
- 失败重试与 cooldown；
- `Channel.MaxConcurrency`。

不增加 Grok 专用请求槽、账号池或默认并发值。`MaxConcurrency=0` 表示不限并发，UI 新建 Grok 渠道时也保持 `0`。设置为正数后，HTTP、SSE 和 WebSocket 都使用现有 lease 生命周期；WebSocket 在连接关闭时释放，流式请求在流结束或断开时释放。

凭证刷新 lease 与请求 lease 分离。等待另一个节点完成 token refresh 不应额外占用或伪造 Grok 并发槽。

### 5.3 模型和无模型原生端点

文本、图片、视频、TTS、STT 和 Realtime 请求按客户端模型走既有 Ability 路由。自定义声音的列表/CRUD 等没有 model 的原生端点使用内部 capability selector，仍由现有 group/priority/weight/MaxConcurrency 选择 Grok Subscription 渠道；该 selector 不发送给上游，也不参与模型计费。

这里有一个必须显式处理的泄漏面：NewAPI 的渠道选路由 `abilities` 表的 (group, model) 索引驱动，若为无 model 端点在 abilities 里塞入伪 model 行来复用调度，该伪 model 会被 `model/ability.go` 的 `GetEnabledModels()`（`SELECT DISTINCT model FROM abilities WHERE enabled`）取到并直接出现在**每个用户的 `/v1/models` 列表**里。因此内部 capability selector 的标识必须与对外可见模型隔离：要么不进 abilities 表、由独立的 capability 查询选渠道，要么用带保留前缀的标识并在 `GetEnabledModels`/模型列表出口显式过滤。无论哪种实现，验收必须断言这些内部标识不出现在任何面向用户的模型列表、计费和日志中。

模型列表支持通过固定 `/models` 上游读取并由现有”获取上游模型”流程同步。代码提供一组已知 Grok 默认模型以便首次创建，但数据库中的渠道模型列表仍是最终路由依据。

## 6. 凭证和非秘密状态

### 6.1 `Channel.Key` 格式

除 `needs_auth` 待授权渠道允许空 Key 外，持久化凭证只接受版本化 JSON，不接受裸 refresh token 或把 API Key 当 OAuth token：

```json
{
  "version": 1,
  "type": "grok_subscription",
  "access_token": "<redacted>",
  "refresh_token": "<redacted>",
  "token_type": "Bearer",
  "expires_at": 1786900000
}
```

约束：

- `version` 和 `type` 必须精确匹配；未知版本 fail closed。
- `expires_at` 使用 Unix 秒，避免本地化时间解析差异。
- `access_token` 与 `refresh_token` 是唯一持久化的账号秘密。
- `access_token`、`token_type` 和 `expires_at` 必填；仅当 xAI 确实未签发 refresh token 时允许缺少 `refresh_token`，此时状态必须为 `non_refreshable`，到期后进入 `needs_reauth`。
- `id_token` 只在认证响应内用于解析必要 claims，解析后丢弃。
- email、密码、SSO Cookie、授权码、PKCE verifier、原始 JWT claims 和原始上游响应不得写入 `Channel.Key`。
- refresh 响应未返回新 refresh token 时保留旧值；返回新值时原子替换。

渠道列表、批量导出、更新回显和错误响应不得返回完整 Key。管理 UI 在已保存渠道上只显示“凭证已配置”、过期时间和非秘密状态；空 Key 更新表示保留原凭证，而不是清空。

### 6.2 非秘密状态

新增按 `channel_id` 唯一关联的 Grok channel state。该状态与 `Channel.Key` 分离，并通过 GORM/AutoMigrate 兼容 SQLite、MySQL 和 PostgreSQL。字段包含：

- credential revision；
- 上游 account ID（不存 email）；
- subscription tier；
- auth status：`needs_auth`、`ready`、`non_refreshable`、`needs_reauth`；
- entitlement status 和 capability flags；
- 归一化 quota snapshot、reset time；
- last refresh/quota probe/error code/error time；
- refresh lease owner 和 lease expiry。

状态表不保存 token、Cookie、密码、请求正文、用户 prompt 或未经筛选的上游错误正文。渠道删除时对应状态级联清理。

新 Grok 渠道只能以 single-key 模式先保存为空 Key，state 为 `needs_auth`；此时不生成 Ability，不参与任何请求调度。通用 channel CRUD 不接受客户端写入非空 Grok Key，真正的凭证只能由第 7 节服务端认证/导入接口写入。凭证事务提交后按 channel type 重建 Ability，刷新当前节点 channel cache，并向其他节点发布既有 channel-change 通知；失败时 Key、state、revision 和 Ability 全部回滚，不能出现“有凭证但仍不可调度”或相反的半状态。

### 6.3 跨节点刷新 lease

刷新必须通过一个 channel-scoped、owner-token 校验的租约：

1. 读取 Channel.Key 和 state revision。
2. 使用数据库时间获取或争抢未过期 lease；同一 channel 同时只有一个 owner。
3. 取得 lease 后重新读取凭证，避免重复刷新。
4. 调用固定 token endpoint。
5. 在一个数据库事务内以 revision 条件更新 Key、state 和 revision。
6. 仅 lease owner 可以释放；进程崩溃后 lease 按 expiry 自动恢复。

请求快路径在 token 距过期超过五分钟时不写数据库。进入五分钟刷新窗口、后台刷新、手动刷新和 401 强制刷新使用同一 lease。未取得 lease 的节点短暂等待并重新读取；不会并行拿旧 refresh token 请求上游。

刷新调用的网络 timeout 必须小于 lease TTL。瞬时网络失败不标记 `needs_reauth`；`invalid_grant`、明确的失效 refresh token 或一次强制刷新后仍为 401 才进入 `needs_reauth`，并以明确原因自动停用该渠道。重新授权成功后只恢复由 Grok auth 状态自动停用的渠道，不覆盖管理员手工禁用。

## 7. 认证流程

固定 OAuth 参数：

- issuer：`https://auth.x.ai`
- authorize：`https://auth.x.ai/oauth2/authorize`
- token：`https://auth.x.ai/oauth2/token`
- client ID：`b1a00492-073a-47ea-816f-4c329264a828`
- scope：`openid profile email offline_access grok-cli:access api:access`

### 7.1 PKCE 浏览器 OAuth

Grok `AuthFlow` 表保存 provider、管理员 ID、非空目标 channel ID、state hash、加密后的 PKCE verifier、redirect URI、创建时间和过期时间。它是本功能新增的独立数据库模型（字段设计留出 provider 列以便日后其它 provider 复用，但本次不迁移 Copilot/Codex 的现有 OAuth 状态机制，也不承担那两者的重构）；表结构走事务式状态迁移，10 分钟过期；verifier 采用项目已有 authenticated-encryption/服务端 secret 模式加密。flow 必须可跨节点读取、一次性 owner-token claim，claim 后重新读取并校验 channel/admin/expiry，再在成功、失败终态或过期时删除。state 不匹配、flow 已消费和 callback 超时均拒绝交换。

管理 UI 先保存一个 `needs_auth` 渠道，再打开 authorize URL；管理员完成登录后把 callback URL、`code#state` 或等价授权结果粘回弹窗。服务端解析、交换并直接原子保存凭证，浏览器只收到授权状态和非秘密 metadata，任何新建或重授权路径都不把 Key/token 回显给浏览器。

### 7.2 Refresh token 导入

管理员对已保存的 `needs_auth`/重授权 channel 提交 refresh token 后，服务端立即向 token endpoint 刷新并验证账号 claims/订阅状态。只有验证成功后才原子写入标准 Key、state 和 Ability。原始输入不写请求日志；前端提交结束后立即清空输入。

### 7.3 SSO Cookie 转 OAuth

对已保存 channel 接受 `sso`/`sso-rw` Cookie 值或包含它们的 Cookie header，归一化后仅保存在当前请求内存。服务端依次验证 `accounts.x.ai` 会话、启动 xAI device flow、完成 consent 并轮询 token，最终只原子保存 Build OAuth access/refresh token。

SSO device flow 使用扩展 scope `openid profile email offline_access grok-cli:access api:access conversations:read conversations:write`。所有 redirect 每一跳都重新校验为 `x.ai` 官方 host；90 秒总 timeout，拒绝不受信任的 verification URL。

### 7.4 邮箱/密码

密码登录通过管理员设置 `grok_password_auth_enabled` 控制，默认 `false`。只有该设置为 true 且服务端 YesCaptcha secret 可用时，capabilities API 才报告可用并在 UI 展示入口。

流程针对已保存 channel 在固定 `accounts.x.ai/api/rpc` 上完成登录，得到短生命周期 SSO Cookie 后立即复用 7.3 转成 OAuth。Turnstile solver 只允许 `https://api.yescaptcha.com/createTask` 和 `https://api.yescaptcha.com/getTaskResult`。密码和中间 SSO 变量在请求结束前清零引用，不出现在 response、state、task、metric 或日志。solver host 不能由请求或渠道自定义；solver API key 只从服务端 secret 读取。

**已知风险（产品决策，非工程可消除）**：密码登录本质是用第三方 CAPTCHA solver（YesCaptcha）自动化通过 x.ai 登录页的 Cloudflare Turnstile，属于对 xAI 官方登录流程的自动化访问，可能违反其服务条款，并可能触发账号侧风控（x.ai 对自动化行为的风控已知较严，历史上出现过自动化取得的会话被上游直接作废的情况）。本设计的工程防护（默认关闭、服务端 secret、固定两个 solver endpoint、凭证不落库不入日志）只降低泄漏面，不改变上述 ToS/账号存活风险。是否启用该入口由管理员在知悉此风险后自行决定；建议默认保持关闭，仅在确有必要且可接受账号被风控的场景下临时开启。

### 7.5 管理 API

在现有 admin channel route 下提供：

- 对已保存 pending/existing channel 的 start/complete PKCE；
- refresh-token、SSO、password 验证/转换；
- 指定 channel 手动 refresh；
- state、capabilities 和 quota refresh。

所有接口要求管理员权限、使用 `Cache-Control: no-store`，并禁用请求正文日志。认证错误返回稳定的内部错误码和脱敏文案，不回显上游 body。

## 8. 上游主机、身份头和路由矩阵

### 8.1 固定 allowlist

允许 HTTPS/WSS 目标：

- `auth.x.ai`：OAuth 和 device flow；
- `accounts.x.ai`：SSO/密码会话；
- `cli-chat-proxy.grok.com`：文本、模型和 billing；
- `api.x.ai`、`us-east-1.api.x.ai`、`us-west-2.api.x.ai`、`eu-west-1.api.x.ai`：媒体、语音和 Realtime；
- `api.yescaptcha.com`：仅密码功能开启时，且仅允许两个固定 task path。

禁止用户控制 scheme、host、port、userinfo 或任意 path prefix。禁止把 OAuth Bearer token 发送到自定义域名；redirect 后也重新执行 allowlist 校验。

### 8.2 CLI identity

只有发往 `cli-chat-proxy.grok.com` 的请求增加：

- `X-XAI-Token-Auth: xai-grok-cli`
- `x-grok-client-version: 0.2.114`
- `x-grok-client-identifier: grok-shell`
- `User-Agent: xai-grok-workspace/0.2.114`

允许通过服务端环境变量覆盖版本，但必须是合法 semver 且不低于 `0.2.93`；非法值回退到固定版本。发往 `api.x.ai` 的媒体、语音和 Realtime 请求绝不携带 CLI identity headers。

### 8.3 路由矩阵

| 客户端能力 | 上游目标 | 实现方式 |
| --- | --- | --- |
| `/v1/responses` | CLI `/v1/responses` | 校验、敏感字段归一化后透传；流/非流均支持 |
| `/v1/responses/compact` | CLI `/v1/responses` | 本地构造禁用工具、非流式 summary turn，并把 reasoning encrypted content/summary 转回 OpenAI compaction item |
| `/v1/chat/completions` | CLI `/v1/responses` | 复用 NewAPI Chat -> Responses bridge；响应转回 Chat |
| `/v1/messages` | CLI `/v1/responses` | 复用 NewAPI Claude -> Responses bridge；响应转回 Claude |
| `/v1/messages/count_tokens` | 本地 | 复用现有 Claude token counter，不消耗上游订阅 |
| function/web/X search tools | CLI `/v1/responses` | typed normalization；不支持字段明确 400，不静默丢弃 |
| `/v1/images/generations` | API `/v1/images/generations` | OpenAI image handler |
| `/v1/images/edits` | API `/v1/images/edits` | multipart/JSON edit handler |
| `/v1/videos`、`/v1/videos/generations` | API `/v1/videos/generations` | 现有 Task 生命周期 |
| `/v1/videos/edits` | API `/v1/videos/edits` | 新 task action，绑定原 channel |
| `/v1/videos/extensions` | API `/v1/videos/extensions` | 新 task action，绑定原 channel |
| 视频状态/内容 | API `/v1/videos/{id}`、`.../content` | 通过本地 task ID 解析并固定原 channel |
| `/v1/audio/speech`、`/v1/tts` | API `/v1/tts` | 标准别名 + xAI 原生入口 |
| `/v1/audio/transcriptions`、`/v1/stt` | API `/v1/stt` | 标准别名 + xAI 原生入口 |
| `/v1/custom-voices...` | API `/v1/custom-voices...` | CRUD/试听，资源 owner 与 channel 绑定 |
| `/v1/realtime` | WSS API `/v1/realtime` | 双向 WebSocket proxy |

### 8.4 CLI Access denied 单账号回退

CLI proxy 的特定兼容性 `403 Access denied` 允许一次严格受限的同账号回退到 `https://api.x.ai`。该行为不是普通 403 failover，只有同时满足以下条件才执行：

- 原请求目标精确为 `cli-chat-proxy.grok.com`，携带预期 CLI identity 和 Bearer OAuth；
- 最多缓冲并恢复 64 KiB 的 403 body；更大或不可读 body 不回退；
- body 在第 12 节更高优先级分类均未命中后，按以下两条并列规则之一命中（与上游实际观察一致）：规范化（限长、去首尾空白、小写化）后命中连续子串 `access denied`；或结构化字段 `code=permission_denied` 且 `error` 字段以前缀 `Access to the chat endpoint is denied. Please ensure you're using the correct credentials. If you believe this is a mistake, please`（大小写不敏感）开头。子串规则本身较宽，但因第 12 节的 content-policy 与 account/entitlement 分类优先级更高、会先行拦截，策略类和账号类 403 不会落到这里被误判为兼容性回退；单独出现 `access` 或单独 `denied` 不构成连续子串，不算命中；
- 请求 body 可重建，且尚未向客户端写出语义内容；
- 整条请求生命周期尚未执行过该回退。

回退保持同一个 channel、账号和 access token，只把目标切到 `api.x.ai`，并移除所有 CLI identity headers。只有 official API 返回 2xx 时才采用回退响应；否则保留并按原 CLI 403 分类处理，不能继续在两个 host 之间循环，也不能借此切换账号绕过内容策略。

## 9. 文本、工具和流式行为

Responses 是内部 canonical 文本协议。Chat 和 Claude 转换复用 NewAPI 已有包；Grok 在 Claude handler 中显式强制 Responses bridge，不依赖可变的全局转换策略。Grok 模块补 Grok 特有的字段白名单、工具类型、上游错误映射和 CLI headers，并显式加入 Responses capability allowlist。

Responses 的渠道门禁在实现上有三处硬编码判断，新渠道要走通 Responses/compact 必须逐一登记，缺一处就会在选路或 handler 阶段被拒：

- `service/channel_select.go` 的 `channelSupportsOpenAIResponses`（按 APIType 的 allowlist）——加入 `APITypeGrokSubscription`，否则 `/v1/responses` 请求在渠道选路阶段就被过滤掉；
- `service/channel_select.go` 的 `channelSupportsRequestedEndpoint` 对 `EndpointTypeOpenAIResponseCompact` 的分支，以及 `relay/responses_handler.go` 里 `RelayModeResponsesCompact` 的 api-type 白名单——这两处目前**硬编码只放行 `APITypeOpenAI` 与 `APITypeCodex`**，都要加入 `APITypeGrokSubscription`。特别注意：不改这两处时 compact 请求同样会返回 400，但那是「渠道不支持该端点」的 400，不是下面要求的「compact 不支持流式」的 400——第 16 节测 `stream=true 稳定 400` 时必须断言错误来源，避免用错误 400 制造假阳性通过；
- `common/endpoint_type.go` 的 `GetEndpointTypesByChannelType`——为 Grok 渠道类型返回含 `EndpointTypeOpenAIResponse` 的端点列表。

`/v1/responses/compact` 不调用不存在的上游 compact path，而是 clean-room 构造一个服务端 summary 指令的普通、非流式 Responses turn。客户端显式传 `stream=true` 时稳定返回 400；省略或 false 时，服务端规范化输入、追加 summary item、要求 `reasoning.encrypted_content`、强制 `stream=false`/`store=false`，并在最终 sanitizer 删除顶层 `tools`、`tool_choice`、`parallel_tool_calls`、`max_tool_calls`、`tool_resources` 及其他工具配置，保证它们不发往上游；历史 input 中的 tool call/result 仍作为待总结内容保留。响应只在同时得到 encrypted reasoning 与合法 summary 时转换为 OpenAI compaction item，否则返回稳定错误且不伪造结果。summary 指令按本项目需求独立撰写，不复制 Sub2API 文本。

function tools、`web_search`/兼容别名和 `x_search` 使用 typed DTO；客户端显式传入的 `0`、`false` 等可选标量必须通过指针字段保留。未知 tool type 或不被 Grok 支持的字段返回可定位的 400，不能静默删除并产生不同语义。

参数 override 执行后必须再次运行 Grok 最终 sanitizer，随后才构造上游请求；全局 passthrough、header override 或 URL placeholder 不能绕过字段白名单和转换。Gemini、embeddings、rerank、assistants、batches 以及本设计未列出的入口在选择 Grok 前由统一 capability gate 明确拒绝，不能把未知 payload 当 OpenAI 兼容请求透传。

为防止共享订阅账号产生跨租户缓存身份，发送给上游的 cache identity 使用服务端 HMAC 对 channel、NewAPI user/token identity 和客户端 cache key 做命名空间化。原始用户 ID、token ID 和客户端 cache key 不发送给上游，也不进入日志。

SSE 在写出任何语义内容前可以按既有 retry/failover 规则换渠道。这里与现有框架有一处必须显式处理的冲突：NewAPI 现有的重试门禁 `shouldRetry` 和错误写出 `writeRelayError`（均在 `controller/relay.go`）都用 `c.Writer.Written()` 判断「是否已开始响应」，而 SSE heartbeat/keepalive 会写出字节但不应阻止换渠道，即新判据比 `Written()` 更宽松。**本设计不修改共享的 `shouldRetry`/`writeRelayError`**，以保证第 19.8 条「现有 xAI 及其他渠道零回归」的承诺；取而代之，Grok 走独立重试判断：在 Grok 的 adaptor/handler 内维护请求级 `semantic_output_started` tracker，只用于 Grok 自身的换渠道决策。代价是「复用现有 retry/failover」在文本流式这一段对 Grok 是「Grok 专用判据 + 复用现有候选选择/cooldown/计费生命周期」，而非逐行复用 `shouldRetry`——实现与测试都按此理解。

tracker 规则：不能以 `gin.ResponseWriter.Written()` 或是否 flush 过 header 代替；SSE comment、空 event、heartbeat/keepalive 和单纯 header flush 不置位；Responses 的 text/reasoning/tool/usage/error，Chat delta/tool/usage/error，以及 Claude content/tool/usage/error 事件在写出前原子置位。一旦置位，不得切换到另一个 Grok 账号继续同一响应。上游中断按对应客户端协议发终止错误并结束计费生命周期。WebSocket 完成 upgrade 后同样固定 channel 到连接关闭。

## 10. 图片、视频、语音和资源隔离

### 10.1 图片

复用现有 `/v1/images/generations` 和 `/v1/images/edits` 输入、响应及计费框架。Grok adaptor 只负责固定 URL、OAuth header、字段映射和 usage 归一化。图片批处理、图库和工作台不在范围内。

图片生成和编辑属于媒体写操作，只有 state 中存在仍在有效期内的正向 paid entitlement/billing 证据时才允许提交。未知、stale、Free 或明确无权状态均 fail closed，并先要求管理员刷新 quota；不能用一次真实生成请求探测付费资格。

### 10.2 视频

视频创建、编辑和扩展都落到现有 Task 表和 task billing。对外 task ID 与上游 request ID 分离，Task private data 保存 origin channel 和上游 ID；状态及内容只能回到原 channel。内容 URL 使用 NewAPI proxy URL，不能暴露 `api.x.ai` 地址或 Bearer token。

需要注意 Task 系统当前只提供 generate/fetch/remix 三类视频动作（`router/video-router.go`，`constant/task.go` 的 action 常量也只有 5 个，均无 edit/extend）：**视频 edits 与 extensions 是本设计新增的 task action，不是「复用现有动作」**，需新增路由、action 常量、上游请求构造与结算路径，并把它们绑定回 origin channel。Task 模型本身已具备 `PrivateData`（含 `SpecificChannelId`、`UpstreamTaskID` 等）和 `ChannelId` 索引，可承载绑定语义，无需改表结构；新增的是动作而非存储模型。此项属里程碑 B。

视频创建、编辑和扩展与图片一样要求有效的正向 paid entitlement/billing 证据；没有证据时不向上游提交。已存在任务的状态和内容读取不受该写操作闸门影响，始终使用绑定的 origin channel，因此 entitlement 后续过期或变为 stale 时仍可查询和下载已创建结果。

提交 POST 出现 timeout、connection reset、空 2xx 或其他无法判断上游是否已创建资源的结果时，不自动在另一个账号重放。只有明确未接收的认证失败或 429 才按第 12 节处理。状态/内容 GET 可以重试，但不能跨账号。

### 10.3 自定义声音

Grok 订阅账号由多个 NewAPI 用户共享，而上游 custom voices 是账号级资源。为避免用户互相看到或修改声音，新增资源绑定记录：公开 voice ID、上游 voice ID、owner user、origin channel 和状态。

- create 成功后创建绑定并把响应 ID 替换为公开 ID；
- list 只返回当前用户拥有的绑定资源；
- get/patch/delete/audio 先校验 owner，再固定 origin channel；
- 上游未绑定的账号级声音不通过公共 API 暴露；
- 管理员渠道测试走独立 admin 路径，不绕过普通用户 owner 校验。

### 10.4 Realtime

在现有 `/v1/realtime` 路由、鉴权、计费和 channel concurrency lease 上增加 Grok API type。服务端覆盖上游 Authorization，只转发允许的 query、origin 和 subprotocol；文本/二进制帧双向代理，close/error 文案脱敏。连接一旦建立不 failover，断开时只结算已确认的 duration/usage 并幂等释放 lease。

## 11. 配额、订阅和能力状态

认证成功、手动 refresh、后台周期任务和明确的上游状态变化可以刷新 quota。归一化 snapshot 分开保存 CLI billing、响应 quota headers、经允许解析的 JWT `tier` claim 和 NewAPI 本地观测 usage；原始 billing body、JWT 和上游响应不落库。

quota header 只读取以下 allowlist，并映射到固定字段：

| 归一化字段 | 接受的 header |
| --- | --- |
| request limit/remaining/reset | `x-ratelimit-{limit,remaining,reset}-requests`，以及 `x-rate-limit-*` 别名 |
| token limit/remaining/reset | `x-ratelimit-{limit,remaining,reset}-tokens`，以及 `x-rate-limit-*` 别名 |
| retry after | `Retry-After` |
| tier | `xai-subscription-tier`、`x-subscription-tier`、`x-xai-subscription-tier`、`x-xai-user-tier`、`xai-user-tier`、`xai-tier`、`x-user-tier`、`x-plan-tier`、`x-subscription-plan` |
| entitlement | `xai-entitlement-status`、`x-entitlement-status`、`x-xai-entitlement-status`、`x-xai-user-entitlement-status`、`x-user-entitlement-status` |

limit/remaining 只接受非负十进制整数。reset 的整数值 `>=10^12` 按毫秒 epoch、`>=10^9` 按秒 epoch、更小值按相对秒；同时接受正 Go duration 和 RFC3339。`Retry-After` 接受非负整数秒或 HTTP date。解析失败的单个 header 被忽略且记录一次脱敏诊断，不污染上一份有效值。

信号不互相覆盖原始来源，派生状态遵循固定优先级：更新更晚的明确 denied/suspended/free 信号可以立即收紧能力；媒体 paid 只能由下述 fresh billing 正向证明；cooldown/reset 使用与当前模型匹配的最新 response headers；展示 tier 依次取 fresh billing canonical plan、JWT `tier`、header tier；本地 usage 只用于展示和保守保护，不能授予 entitlement。JWT `tier` 接受数值/数字字符串 `0..7` 和规范化字符串，其中 `0=free`、`1=supergrok`、`2=x_basic`、`3=x_premium`、`4=x_premium_plus`、`5=supergrok_heavy`、`6=supergrok_lite`、`7=supergrok_plus`；其他值保留为 unknown，不授予 paid。

媒体正向证据是机器可判定的 `billing_probe` snapshot：`now-observed_at` 必须位于 `[-5m, 24h]`，不得含顶层/weekly/monthly 401 或 403，不得被更新更晚的 denied/free 信号否决，并至少包含一个 2xx billing window 及以下任一 authoritative paid 字段。注意 billing 探测有两个 path（月度 `/billing`、周度/credits `/billing?format=credits`，均在 CLI proxy base 上，官方/区域 api.x.ai host 不提供 billing），且**上游 wire 字段名与归一化后的字段名是两套，不能混用**：

- 归一化 `usage_percent` 非空（上游 wire 名是 `creditUsagePercent`/`usagePercent`）；
- 归一化 `used_percent` 非空（此值不是上游返回字段，而是 `includedUsed / monthlyLimit` 本地算出的派生值）；
- 归一化 `monthly_limit_cents` 为正数（上游 wire 名是 `monthlyLimit`）；
- 或 canonical paid plan——注意这里的 plan 名是 billing 命名空间的**空格大写**值 `SuperGrok`（monthlyLimit≈15000 分）或 `SuperGrok Heavy`（≈150000 分），由月度额度推出，只有这两个值；它与第 6 段 JWT tier 命名空间的 snake_case 名（`supergrok`/`supergrok_heavy`/`supergrok_lite`/`supergrok_plus`）是两回事，实现时不得把 tier 名当 plan 名去匹配。

`free`、`x_basic`、单独的 header `entitlement=active`、JWT 非 Free tier、本地 usage 和模型 quota 大小都不能单独形成媒体正向证据。

手动 quota refresh 只有在 billing probe 成功并通过上述校验时才更新 `observed_at`；失败时保留上一份 snapshot 和原时间并标记 probe error/stale，不能延长 24 小时授权。后台刷新规则相同。带有可用 quota/reset headers 的 429 可以更新 header snapshot，但不能延长媒体 billing 证据。

状态用于管理可见性和明确的调度保护，不替代 NewAPI 自身用户计费：

- subscription tier/entitlement 供 UI 展示；
- 明确额度耗尽且有 reset time 时使用现有 cooldown 跳过渠道；
- probe 暂时失败保留上一份成功 snapshot 并标记 stale，不永久禁用；
- capability-specific 403 只标记对应能力，不误伤仍可用的文本能力；
- 全局 entitlement denied 才把整个渠道标记不可用。
- 图片/视频写操作必须有有效的正向 paid billing/entitlement 证据；状态和内容读取不受该闸门影响。

上游 subscription credits 不能直接解释为美元成本。客户端请求仍按 NewAPI 现有模型 ratio、固定价格、音频/视频 task settlement 和 usage 规则扣费，不从 Grok billing snapshot 推导售价。

## 12. 错误、刷新、重试和 failover

403 先解析限长 JSON 的任意嵌套 `code`、`error_code`、`type`、`category`、`reason` 和 message，再按下表分类；结构化 marker 优先于宽泛 message，若同一响应出现冲突 marker，按表中更高优先级处理：

| 优先级 | 分类 | 可测试匹配条件 |
| --- | --- | --- |
| 1 | content policy | marker 规范化后为 `content_filter`、`content_policy`、`content_policy_violation`、`content_moderation`、`cyber_policy`、`new_sensitive`；或 message 命中明确短语 `content policy violation/rejection/rejected`、`content moderation blocked/rejected`、`request/prompt/input blocked by/violates policy`、`image/text is sensitive`、`prohibited/forbidden content` |
| 2 | account/entitlement/billing | marker 为 `account_suspended`、`account_disabled`、`user_suspended`、`user_disabled`、`subscription_required`、`entitlement_required`、`not_entitled`、`plan_required`、`insufficient_quota`；或 message 明确包含 account/user suspended/disabled、subscription/entitlement required、not entitled、payment required、spending limit、out of credits |
| 3 | CLI compatibility | 仅匹配第 8.4 节两条匹配规则（`access denied` 连续子串，或 `code=permission_denied` 且 `error` 命中固定长前缀）；裸 `permission_denied` 不足以命中 |
| 4 | unknown 403 | 以上均未命中；不 refresh、不 official fallback、不 cooldown、不修改 channel 状态、不自动跨账号 failover；记录脱敏错误供管理员处理 |

| 情况 | 行为 |
| --- | --- |
| 401 | 获取刷新 lease，强制 refresh 一次；在尚未输出且请求可安全重放时重试一次 |
| 刷新后仍 401 / invalid_grant | `needs_reauth`，自动停用当前 channel，转下一个候选 |
| CLI compatibility `403 Access denied` | 仅按 8.4 在同账号 official API 回退一次；不直接跨账号 |
| content-policy 403 | 不 refresh、不修改 channel/account 状态、不 cooldown、不 failover；直接返回脱敏策略错误 |
| 403 entitlement/capability/billing | 不进入 refresh 循环；记录全局或 capability 状态；只有明确属于账号能力且请求尚可安全重放时才按既有候选规则 failover |
| unknown 403 | 不 refresh、不 official fallback、不跨账号；返回稳定脱敏错误 |
| 429 | 使用 quota reset/`Retry-After` 或现有 channel cooldown；尚未输出时最多切换到一个不同候选 channel，第二个 Grok 账号仍 429 就停止 |
| 文本 5xx/连接失败且未输出 | 使用现有 retry/failover |
| SSE 已输出语义内容 / WS 已 upgrade | 不换账号；结束当前流/连接；仅 SSE keepalive 不算语义输出 |
| 媒体/声音写请求结果不确定 | 不自动重放，返回稳定错误和 request ID 供排查 |
| 视频/声音资源后续操作 | 只用绑定的 origin channel；429 延后重试，不换账号 |

错误分类先检查上述响应 code/body 信号，再使用 HTTP status 兜底。content policy 的优先级高于 account/entitlement/billing 和 CLI compatibility；各类分别映射到不同稳定内部错误码，未经识别的上游 body 不直接返回客户端。

401 的“重试一次”、CLI official fallback 的“一次”和 429 的“一次不同账号 follow-up”都是整条请求生命周期上限，不因多个内部层重复。所有 retry 决策携带显式 attempt 状态，避免 adaptor、credential provider 和 controller 各自重试。

## 13. 安全与隐私

1. 中央脱敏器覆盖 `Authorization`、access/refresh/id token、password、Cookie、SSO、authorization code、code verifier、CAPTCHA token 和 URL query 中的凭证。
2. auth/import 路由关闭 body logging；上游错误先限长、分类和脱敏，再进入日志或响应。
3. OAuth token 只能发往固定 allowlist；每次 redirect 和 WebSocket target 都重新验证。
4. Grok 禁止在 header override 或 `{api_key}`/同类 URL 模板中引用凭证；`Authorization`、`Cookie`、`Host`、`X-XAI-Token-Auth`、`x-grok-client-*` 和身份类 headers 由 provider 代码在安全 override 之后设置，HTTP、multipart、任务轮询和 WebSocket 路径规则一致。
5. 不把 email 放进持久化 state；UI 只展示 account ID 后缀、tier、expiry、quota 和状态。
6. 不把用户 prompt、工具参数、媒体 body 或声音内容写进 Grok state。
7. 文本请求强制 stateless；不开放共享订阅账号的 conversation/history 管理 API。
8. 自定义声音和视频使用本地 owner/channel 绑定，禁止跨用户和跨账号资源访问。
9. 所有新用户可见文案进入八种前端语言；后端用户可见错误进入中英文 i18n。

## 14. 管理 UI

Grok Subscription 渠道表单复用现有 channel drawer 和通用字段，并新增 Grok auth 区域：

- 先保存 single-key、空 Key 的待授权渠道，保存前不显示或要求 API Key；
- Browser OAuth；
- Refresh token；
- SSO Cookie；
- Email/password（capabilities 允许时才显示）；
- 已保存渠道的 Refresh/Reauthorize；
- subscription tier、auth/entitlement 状态、token expiry、quota、last probe；
- 明确提示 `MaxConcurrency=0` 为不限并发，不自动填 `1`。

OAuth/SSO/password 输入只保存在 React 组件 state，不进入 localStorage、URL、analytics 或错误上报。弹窗关闭、成功和失败后均清空敏感 state。保存后的渠道编辑页不加载或显示 token。

授权/导入成功后前端只刷新 channel detail/state 查询；token 不进入 React form state。`needs_auth` 渠道明确显示“待授权且不参与调度”，不能误显示为可用。

## 15. 计费、日志和观测

- 文本、Chat、Claude 和工具请求使用归一化 upstream usage 进入现有 text billing。
- 图片使用现有 image price/usage 路径。
- 视频在 task 成功终态结算，失败/取消按现有 task refund 规则。
- TTS/STT 使用现有 audio usage/ratio；Realtime 使用现有 duration/usage 结算。
- custom voice CRUD 本身不推断生成成本；如上游返回可计费 usage，才通过明确的 price rule 结算。

日志允许记录 channel ID、能力、状态码、attempt、refresh outcome、quota snapshot age 和脱敏 request ID；禁止记录任何凭证、原始账号 email、prompt 或媒体正文。增加 refresh success/failure、needs_reauth、entitlement denial、429 cooldown、ambiguous media submission 和 WebSocket close 的可聚合指标。

## 16. 测试策略

实现遵循测试先行。至少覆盖：

### 16.1 凭证与认证

- version 1 Key 正常解析，未知版本、裸 token、缺字段拒绝；
- 序列化、错误、channel list/export 全链路不泄露秘密；
- PKCE state mismatch、过期、重复 consume、跨节点 complete；
- refresh-token、SSO 和 password 成功/失败；password 默认关闭；
- Cookie/password 不进入 DB、日志、response 和前端持久存储。

### 16.2 刷新与多节点

- 同一 channel 并发刷新只有一个上游 refresh；
- lease owner、expiry、崩溃恢复和 revision CAS；
- 等待者读取新 token；旋转/未旋转 refresh token 均正确；
- 401 只强刷/重试一次；invalid_grant 进入 needs_reauth；
- CLI compatibility 403 只在同账号向 official API 回退一次并剥离 CLI headers；其他 fallback 响应不形成循环；
- content-policy 403 不 refresh、不 cooldown、不 failover，也不改变账号状态；
- 403 fixture 至少覆盖 `{"error":{"code":"content_policy_violation"}}`、`{"code":"subscription_required","error":"subscription required"}`、`{"error":"Access denied"}`、固定 chat-endpoint `permission_denied` 文案、`{"error":"Access denied because subscription is required"}` 和 `{"code":"forbidden","error":"unclassified"}`，断言冲突优先级和 unknown 的 fail-closed 行为；
- 429 首次可切换一个不同账号，第二个账号仍 429 时停止，attempt 状态不会被内部层重置；
- SQLite、MySQL、PostgreSQL 迁移和条件更新兼容。

### 16.3 协议与工具

- Responses/Chat/Claude 的流式、非流式、usage、reasoning、tool calls；
- Responses compact 仅支持非流式：`stream=true` 稳定 400，其他请求通过普通 Responses summary turn 实现，强制 stream=false/store=false，移除所有顶层工具配置并正确保留 encrypted reasoning；
- Claude count-tokens 本地路径；
- function/web/X search 工具和显式零值；
- cache identity 跨用户、跨 token、跨 channel 隔离；
- `semantic_output_started` 不因 header flush/comment/keepalive 置位；各协议首个 text/reasoning/tool/usage/error 事件置位后不 failover。

### 16.4 媒体、语音和实时

- 图片生成/编辑 JSON 与 multipart；
- 图片/视频写操作在 paid entitlement 为 positive/fresh 时允许，在 unknown/stale/Free/denied 时 fail closed；状态/content 仍允许；
- 视频 create/edit/extend、task 绑定、status/content 和内容代理；
- 不确定媒体提交不重放；明确 429 可以 failover；
- TTS/STT 的二进制/JSON 错误与 usage；
- custom voice owner 隔离、CRUD、audio、origin channel 固定；
- Realtime 握手、帧代理、401/429、连接后不 failover、lease 释放和计费。

### 16.5 调度、UI 和回归

- Grok channel 使用 group/priority/weight/failover；
- `MaxConcurrency=0` 不限流，正数复用现有 lease，流/WS 无泄漏；
- billing、quota header 别名与 reset 单位、JWT tier 和本地 usage 的归一化优先级、新鲜度及 snapshot 保留规则；
- 现有 xAI API Key URL/header/model 行为完全不变；
- pending-auth 空 Key 渠道无 Ability；授权事务重建 Ability、刷新本地 cache、通知其他节点，失败无半状态；
- 参数/header override 与 passthrough 无法绕过 Grok sanitizer，凭证不能进入 placeholder；未支持 endpoint 早期拒绝；
- 渠道表单四种 auth 入口、状态、校验和八语言 i18n；
- 固定 host/path/redirect allowlist 和 CLI headers 仅作用于 CLI host。

真实账号 smoke 不进入 CI，但 staging 验收必须覆盖四种认证入口（密码入口在临时启用后再关闭）、三种文本协议、工具搜索、图片、视频三种动作、TTS/STT/custom voice、Realtime、token 过期刷新、401/403/429 和多渠道 failover。

## 17. 已知基线与验证边界

在初始基线 `1a9a14fde7d6c2eb4e9aba828d0782bbf6ae2e78` 上，仓库全量 `go test ./...` 已存在以下失败：缺少 `web/classic/dist` 的 root embed、既有 asset/model controller 测试失败、三项 Claude 转换失败、Codex image 测试 panic、stream helper panic，以及 service suite 超时。分支快进到本文基线 `e336df31bebd05168a2984f55942a13bea90ab3e` 后，实施前必须重新采集一次当前 baseline，不能假定旧失败仍存在或已修复。这些既有失败不属于 Grok 功能，不在本次顺手修复。

每个提交必须运行受影响包的 targeted tests、Go 编译/静态检查和 `web/default` typecheck/lint/test；最终再跑一次全量测试并把结果与上述基线逐项对比。新增失败或基线失败形态扩大均视为本功能未完成。

当前本机 `gitnexus 1.6.3` 在 LadybugDB 初始化阶段 native `exit 1`，无法为本 worktree 生成有效索引；指向 sibling worktree 的旧 `new-api` 索引不得作为替代证据。实施计划首先尝试升级/重建独立索引并重新运行 impact/detect-changes；若环境故障持续，必须保留命令、版本和失败阶段记录，并用 `rg` 符号检索、Git diff、编译器和 targeted tests 做逐变更替代核验，不能声称 GitNexus 已通过。

## 18. 上线与回滚

该改动会影响 `/v1` relay、OAuth、任务、计费、WebSocket、数据库 schema 和控制台渠道 UI：

- Router deploy：required；
- Other deploy targets：`newapi-console` required，`newapi-web`/Terraform/Cloudflare not required；
- 数据迁移：AutoMigrate 新增 Grok `AuthFlow`、Grok state 和 Grok resource binding 表，旧渠道无数据变更；Copilot/Codex 现有 OAuth 状态机制不动；
- 密码认证默认关闭，无配置时不产生外部 CAPTCHA 调用；
- 未创建/启用 Grok Subscription 渠道时，请求路径无行为变化。

回滚先停用 Grok Subscription 渠道，再回滚应用代码。新增表可保留，避免破坏性 down migration；其中不含 token。真正的 OAuth secret 仍只在 Channel.Key，删除渠道会清理关联状态和资源绑定。

## 19. 验收标准

1. 管理员能先创建不参与调度的 pending-auth Grok Subscription 渠道，再用四种认证方式授权或重授权；浏览器从不接收完整 Key/token，密码入口默认不可用。
2. access token 到期可在多节点下安全刷新；失效 refresh token 会稳定进入 `needs_reauth`，没有 refresh 风暴。
3. Responses、Chat Completions、Claude Messages/count-tokens、function/web/X search 的流/非流和 usage 正确；Responses compact 的非流式转换正确且明确拒绝 `stream=true`。
4. 图片生成/编辑、视频生成/编辑/扩展/状态/内容、TTS、STT、自定义声音和 Realtime 全部通过 targeted tests 与 staging smoke。
5. 一个账号一个渠道，现有 priority/weight/group/failover/MaxConcurrency 生效；默认并发是 `0`（不限），没有 Grok 专用请求槽。
6. 401/403/429、半截 SSE、WebSocket 中断和不确定媒体提交遵循第 12 节；CLI compatibility 403 只允许同账号单次 official fallback，content-policy 403 不 failover，且不会跨账号续写已开始的语义输出或重复创建资源。
7. token、密码、SSO Cookie、授权码和 PKCE verifier 不出现在数据库非秘密字段、日志、错误、导出、浏览器持久存储或 analytics。
8. 现有 xAI API Key 渠道和其他渠道的 targeted regression tests 无回归。
9. 所有新增 UI 文案完成八语言翻译，后端错误完成中英文 i18n。
10. GitNexus impact/detect-changes、targeted tests、类型检查和基线对比均有可复核记录。
