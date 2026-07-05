# 项目说明文档 — new-api (APIMaster fork)

> 生成日期：2026-07-02。基于对整个代码库的静态分析（后端约 12.6 万行 Go 代码、671 个 Go 文件）。
> 本文档同时收录了分析过程中发现的潜在问题清单（见文末「潜在问题」章节）。

---

## 1. 项目定位

本项目是 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 的 fork（Go module 路径仍为 `github.com/QuantumNous/new-api`），是一个 **AI API 网关 / LLM 资产管理系统**：

- 聚合 40+ 上游 AI 提供商（OpenAI、Claude、Gemini、Azure、AWS Bedrock、智谱、百度、阿里、腾讯、讯飞、Midjourney、Suno 等），对外暴露统一的 OpenAI / Claude / Gemini 兼容 API；
- 内置用户体系、Token 管理、计费/配额、限流、渠道管理、数据看板与管理后台；
- 本 fork（APIMaster）在上游基础上叠加了：多渠道 fallback 策略、渠道实际采购价体系（channel_model_pricings）、auto-cheapest 最低价路由、指纹检测集成（对接 apimaster Flask 检测后端）、充值返佣模块、表达式阶梯计费（billingexpr）、订阅计费等。

部署形态：Go 单二进制（前端 embed 进二进制），通过 nginx 反代嵌在 `apimaster.ai` 域名的 `/_panel/` 子路径下（详见 CLAUDE.md 的 nginx 部署章节）。

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Go 1.25、Gin、GORM v2 |
| 数据库 | SQLite / MySQL (>=5.7.8) / PostgreSQL (>=9.6)（三者必须同时兼容）；日志表可用独立 DSN；可选连接 apimaster 的 PostgreSQL（`APIMASTER_PG_DSN`） |
| 缓存 | Redis（go-redis v8）+ 进程内存缓存双层 |
| 认证 | Cookie Session、Access Token、API Token（sk-）、WebAuthn/Passkey、OAuth（GitHub/Discord/OIDC/LinuxDo/微信/Telegram）、2FA/OTP |
| 前端（default 主题） | React 19、TypeScript、Rsbuild 2 (RSPack)、TanStack Router/Query/Table、Zustand、Base UI + shadcn、Tailwind CSS v4，包管理用 Bun |
| 前端（classic 主题） | React 18、Vite、Semi Design（遗留主题） |
| i18n | 后端 go-i18n（en/zh）；前端 i18next（15 种语言） |
| 可观测 | pprof（可选 :8005）、Pyroscope、自研 perf_metrics |

## 3. 目录结构

```
main.go          — 入口：资源初始化、后台任务、gin 装配、前端 embed
router/          — 路由注册（api / relay / dashboard / video / web 五组）
controller/      — HTTP handler（~2.6 万行）
service/         — 业务逻辑（计费、渠道选择、检测、任务轮询等，~2.4 万行）
model/           — GORM 数据模型 + DB/缓存访问（~1.4 万行）
relay/           — AI 转发核心（~3.8 万行），relay/channel/ 下 38 个 provider 适配器
middleware/      — 认证、限流、分发（Distribute）、CORS、日志、统计
setting/         — 配置系统（ratio/operation/system/billing/performance 等域）
common/          — 共享工具（JSON 包装、crypto、Redis、env、gopool 等）
dto/ types/ constant/ — 请求/响应结构、类型、常量
pkg/             — billingexpr（表达式计费）、cachex、ionet、perf_metrics
oauth/ i18n/ logger/
web/default/     — 主前端；web/classic/ — 遗留前端
docs/            — 文档
```

## 4. 启动流程（main.go）

1. **`InitResources()`**：加载 `.env` → `common.InitEnv()` → 日志 → `ratio_setting.InitRatioSettings()` → HTTP 客户端与 tokenizer → `model.InitDB()`（AutoMigrate，仅主节点执行迁移）→ `model.InitOptionMap()`（option 表 → 内存）→ `model.InitLogDB()` → 可选 apimaster PG → Redis → perf_metrics / 系统监控 / i18n / 自定义 OAuth。
2. **缓存**：Redis 启用时强制开启内存缓存；`model.InitChannelCache()` 全量加载渠道与 Ability 索引（带 panic 恢复 + FixAbility 重试），随后 `SyncChannelCache` 周期重建。
3. **后台任务**（goroutine）：`SyncOptions` 配置热更新、`UpdateQuotaData` 看板、渠道自动测试/更新、Codex 凭证刷新、订阅额度重置、**auto-detect 指纹检测**、**uptime 检查**、汇率抓取、**BillingHold 对账**、渠道上游模型更新检查、主节点的 MJ/Task 批量轮询、可选批量配额落库（`BATCH_UPDATE_ENABLED`）。
4. **gin 装配**：`SetTrustedProxies(127.0.0.1/::1/172.16.0.0/12)` → CustomRecovery → RequestId / PoweredBy / I18n / 访问日志 → cookie session（30 天）→ 注入 Umami/GA 脚本 → `router.SetRouter`（传入两套 embed 前端）→ 监听 `PORT`。

注意：**没有显式的优雅退出**（无 signal 捕获 / graceful shutdown），退出清理仅靠 `defer model.CloseDB()`。

## 5. 路由与中间件

### 5.1 五组路由（router/main.go）

| 组 | 前缀 | 说明 |
|---|---|---|
| API | `/api` | 管理后台/控制台：用户、渠道、Token、日志、option（RootAuth）、OAuth、支付 webhook、model-data 等；`GlobalAPIRateLimit` |
| Relay | `/v1` `/v1beta` `/mj` `/suno` `/pg` | AI 转发主入口；`TokenAuth` + `ModelRequestRateLimit` + `Distribute` |
| Dashboard | `/dashboard/billing/*` | OpenAI 兼容的旧版计费查询 |
| Video | 视频生成任务路由 | |
| Web | `/` 与 `/_panel` | embed 前端静态资源 + SPA fallback（`/v1` `/api` `/assets` 前缀除外） |

### 5.2 认证中间件（middleware/auth.go）

- `authHelper(minRole)`：session 优先，回退 `Authorization` Access Token；派生 `UserAuth` / `AdminAuth` / `RootAuth` 三级。
- `TokenAuth()`：API key 主认证。多来源提取（Bearer、`x-api-key`、`Sec-WebSocket-Protocol`、Gemini `?key=`、`mj-api-secret`）→ 去前缀、按 `-` 切分（`parts[1]` 为管理员指定渠道）→ `ValidateUserToken`（走 Redis token 缓存）→ IP 白名单 → 用户状态 → 分组权限 → `SetupContextForToken`。
- 最敏感操作（查看渠道明文密钥 `POST /channel/:id/key`）叠加 RootAuth + CriticalRateLimit + DisableCache + 二次安全验证 + 审计日志。

### 5.3 分发中间件（middleware/distributor.go）

`Distribute()` 是渠道选择的入口：从路径/请求体解析出模型名与 relay_mode → token 指定渠道则直连；否则 token 模型白名单校验 → 分组归一化 → 渠道亲和（sticky，非 auto-cheapest 组）→ `CacheGetRandomSatisfiedChannel`：
- `auto-cheapest` 组 → `SelectCheapestEnabledChannel` 每次选采购价最低的渠道（依赖 channel_model_pricings，`input_price > 0` 才入选）；
- `auto` 组 → 跨多组按优先级+权重随机；
- 普通组 → 组内随机。

命中后 `SetupContextForSelectedChannel` 写入渠道上下文（多 key 轮换、baseURL、modelMapping、paramOverride 等）。

### 5.4 限流

Redis / 内存双实现工厂：`GlobalWebRateLimit`、`GlobalAPIRateLimit`、`CriticalRateLimit`、`ModelRequestRateLimit`（按模型请求数，含成功计数）、邮件验证限流等。

## 6. Relay 转发核心（relay/）

请求路径：路由 handler → `controller.Relay(c, relayFormat)`：

1. 解析校验请求 → `GenRelayInfo`（贯穿全程的上下文对象，携带用户/token/组/流式标志/计费会话/格式转换链）；
2. 敏感词检测 + token 计数 → `ModelPriceHelper` 计价 → `PreConsumeBilling` 预扣费（defer 中失败退款）；
3. **重试循环**：取渠道 → 按 relayFormat 分派 `WssHelper` / `ClaudeHelper` / `geminiRelayHandler` / `relayHandler`（内部再按 relay_mode 分派 Image/Audio/Rerank/Embedding/Responses/Text Helper）→ 失败经 `shouldRetry` 判断后换渠道重试（本 fork 策略：5xx 全段可重试、`bad_response_body` 可重试，仅 context 超长 / 请求体本身问题 / 指定渠道不重试，见 CLAUDE.md「多渠道 Fallback 策略」）。

**Adaptor 模式**：`relay/channel/adapter.go` 定义统一接口（`ConvertOpenAIRequest / ConvertClaudeRequest / ConvertGeminiRequest / DoRequest / DoResponse` 等），`relay.GetAdaptor(apiType)` 工厂按渠道类型返回实现。38 个适配器大致分为：OpenAI 兼容系（openai/openrouter/deepseek/moonshot/xai 等复用 openai.Adaptor）、Claude 系、Gemini/Vertex 系、国产大模型（baidu/zhipu/ali/tencent/xunfei/volcengine 等）、云平台（aws/cloudflare/ollama/replicate）、异步任务型 TaskAdaptor（suno/kling/jimeng/vidu/sora/hailuo/apimartvideo 等，带独立计费钩子与轮询）。

## 7. 数据模型与缓存

### 7.1 核心表

- **User**：额度（`Quota/UsedQuota`）、分组、邀请（`AffCode/AffQuota/InviterId`）、Access Token、各 OAuth 绑定；
- **Token**：sk- key（uniqueIndex）、剩余额度、过期时间、模型白名单、IP 白名单、分组；
- **Channel**：上游 key（可多 key）、baseURL、模型列表、优先级/权重、modelMapping、检测字段、**`RechargeRate` / `ApimasterPriceRatio`（fork 新增）**；
- **Ability**：`(Group, Model, ChannelId)` 联合主键——「组×模型→渠道」可用性索引，渠道选择的核心检索表；
- **Log**：消费/充值/管理/错误/退款日志，`other` 字段存 JSON 扩展信息；
- fork 新增：**ChannelModelPricing**（渠道×模型采购价，含 cache 价、group_ratio）、**PublicModelPrice**、**ChannelDetectLog**（指纹检测）、**AffLog**（返佣）、**BillingHold**（挂账对账）、**Subscription** 系列。

### 7.2 缓存策略

- **渠道选择走内存缓存**：`InitChannelCache` 把渠道与 Ability 全量加载为 `group→model→channels` 结构，周期重建；
- **用户/Token 走 Redis Hash**：`user:{id}` / `token:{hmac}`，TTL = SyncFrequency；写路径「同步写 DB + 异步 gopool 更新缓存」；
- **批量落库**：`BATCH_UPDATE_ENABLED` 时配额增减先入内存批量器，周期刷 DB。

## 8. 计费系统

### 8.1 价格来源优先级（relay/helper/price.go）

```
① 固定价格 ModelPrice（按次）          → 命中则直接用价格
② channel_model_pricings 渠道实际采购价 → model_ratio = input_price × recharge_rate × apimaster_price_ratio / 2
③ 全局 model_ratio                     → 仅当渠道无定价行时兜底
④ 都没有且用户未开 AcceptUnsetRatioModel → 报「价格未配置」
```

### 8.2 预扣费 → 结算 → 退款

- **预扣**：新路径 `PreConsumeBilling` → `BillingSession`（支持钱包/订阅双资金来源与回退，`subscription_first/wallet_first/*_only`）；旧路径 `PreConsumeQuota`（按次计费仍在用）。余额充足时有「信任额度旁路」（不预扣，订阅除外）。
- **结算**：`PostTextConsumeQuota` 按实际 usage 计算 → `SettleBilling` 按 `delta = actual - preConsumed` 补扣/返还。
- **失败退款**：`RefundPreConsumeIfSafe` 先分类「上游是否已扣费」——确认未扣则同步退款；不确定则 `HoldRefund` 挂账写 BillingHold 表，由后台对账任务超时释放（防止图像等异步场景重复退款）。

### 8.3 表达式阶梯计费（pkg/billingexpr）

「一条表达式即全部计费真相」：基于 expr-lang，变量含 `p/c/len/cr/cc/img` 等，自动排除已单列子类 token 防重复计费；阶梯条件用 `len`（完整上下文长度）而非 `p` 防缓存命中误判档位；预扣冻结 BillingSnapshot，结算用同一表达式重跑实际 token。详见 `pkg/billingexpr/expr.md`。

### 8.4 充值与返佣

- 支付渠道：Epay、Stripe、PayPal、Creem、Waffo、Platega、Clink、Crypto。成功统一入口 `OnTopupSucceeded()` → 返佣 `ProcessAffCommission`（`commission = quota × AffRatio / 100`，只有邀请者得返佣，入待划转池 `aff_quota`）→ 飞书通知 → GA4 转化上报。
- 幂等：Epay 靠订单锁 + Pending 状态判断；Stripe/PayPal 靠事务 + `FOR UPDATE` 行锁。

### 8.5 消费日志 other 字段

`GenerateTextOtherInfo` 写入：各倍率、首字延迟、模型映射、admin_info（普通用户查询时剥离）、fallback 信息、计费来源（钱包/订阅明细）、**渠道实际采购价 `ch_input_price` 等 4 项（fork 新增，供运营对比成本 vs 收费）**、阶梯计费表达式与命中档位、缓存命中率等。

## 9. 配置系统（setting/ + option 表）

两套机制并存：

- **扁平 Option 键值**：`InitOptionMap()` 先写内存默认值再用 DB 覆盖；`updateOptionMap` 巨型 switch 把字符串反序列化到各 setting 包内存变量；多节点靠 `SyncOptions` 周期拉 DB 同步（热更新）。
- **分层结构化 Config**（`setting/config`）：`ConfigManager.Register(name, struct)`，以 `name.key` 前缀路由，反射填充，支持更新后处理钩子（如计费缓存失效、主题同步）。

## 10. 前端

- **web/default**（主）：React 19 + TanStack Router（文件式路由）+ TanStack Query + Zustand + Base UI/shadcn + Tailwind v4，Rsbuild 构建，`assetPrefix: '/_panel/'`（配合 nginx 子路径部署）。26 个 feature 模块（channels、keys、usage-logs、wallet、model-data、affiliate、subscriptions、system-settings、playground 等），模块内统一 `api.ts / types.ts / components/ / hooks/` 约定。
- **web/classic**（遗留）：React 18 + Vite + Semi Design。
- 两套 dist 都 `//go:embed` 进二进制，运行时按主题设置切换；SPA fallback 由 Go 侧 NoRoute 返回 index.html。
- i18n：i18next，15 种语言 JSON（key 为英文原文），`bun run i18n:sync` 同步。

## 11. 本 fork 相对上游的主要差异

1. **多渠道 fallback**：清空 `alwaysSkipRetryStatusCodes`（504/524 参与重试）、5xx 全段可重试、`bad_response_body` 可重试；
2. **渠道采购价体系**：`channel_model_pricings` 表 + 定时/手动抓取上游 `/api/pricing`（带 Bearer auth 回退）+ 计费优先用采购价推导倍率 + 日志记录实际成本；
3. **auto-cheapest 路由**：按采购价选最低价渠道；
4. **指纹检测集成**：对接 apimaster Flask 检测后端（v0.7 / CC CLI / Kiro 三路分类器），`channel_detect_logs` + model-data 管理页；
5. **返佣模块**：`aff_logs` + `ProcessAffCommission` + 推广页面，与 apimaster-ai（Next.js）的邀请码体系打通；
6. **其它**：`GetBaseURL()` trailing slash 修复、BillingHold 挂账对账、订阅计费、汇率抓取、media task webhook 等。

---

## 12. 潜在问题清单

以下问题均已核对源码位置，按严重程度排序。

### 🔴 严重

**P1. `abilities.group` 保留字未加引号，PostgreSQL 上核心功能直接报错**
- 位置：`controller/model_data.go:126`、`controller/model_data.go:617`、`service/channel_select_cheapest.go:230`
- 三处 raw SQL 裸写 `a.group = 'default'`。`group` 是保留字：MySQL 允许限定名（`a.group`，点号后的保留字无需引号）所以**当前 MySQL 生产环境不受影响**；SQLite 宽容也可用；但 PostgreSQL 上即使加了表别名也必须写成 `a."group"`，否则语法错误。项目本身在 `model/main.go` 定义了 `commonGroupCol` 正是为此，这三处 fork 新增代码绕过了约定。
- 后果：一旦迁移到 PostgreSQL，Model Data 页面报错、**auto-cheapest 选路查询失败返回 0 → 「无可用渠道」**。违反 Rule 2（要求三库同时兼容）。
- 修复方向：导出 `model.GroupColumn()` helper，三处统一替换。

**P2. 计费用户额度的 Redis 缓存一致性缺口**
- (a) **Stripe/PayPal 充值不更新缓存**：`model/topup.go:241`（Stripe `Recharge`）、`:295`（PayPal）在事务内直接 `tx.Update("quota", gorm.Expr(...))`，无任何 `InvalidateUserCache`/缓存回写；对比 Epay 走 `IncreaseUserQuota`（会异步更新缓存）。启用 Redis 时用户充值后 TTL 窗口内余额显示旧值，预扣判断也可能用旧值。
- (b) **缓存增减静默丢弃**：`common/redis.go:285` `RedisHIncrBy` 仅当 key 有 TTL 才执行，否则 no-op；缓存过期瞬间的扣减被丢弃，靠 TTL 过期后从 DB 重建自愈。
- (c) **异步缓存写与读回填无顺序保证**：`model/user.go:912-946` 的 gopool 异步缓存更新与 `GetUserQuota` 的回填之间存在 lost-update 窗口（缓存短时偏高）。
- 综合后果：余额在 TTL（=SyncFrequency）窗口内可能偏旧/偏高，极端情况下允许超扣或误拒请求。DB 始终是准的，属最终一致，但支付路径 (a) 是明确的处理不一致，建议统一走 `IncreaseUserQuota` 或补 `InvalidateUserCache`。

### 🟠 中高

**P3. Fire-and-forget goroutine 无 panic recover**
- 位置：`controller/model_data.go:966`、`controller/channel.go:680`、`controller/channel.go:1008`、`controller/model_data.go:925`、`service/image_task_race.go:127,159`
- 项目已有带 panic 处理的 `common.RelayCtxGo`（`common/gopool.go`），但这些 fork 后台任务用裸 `go`。`FetchChannelPricing` 等内部解析上游 HTTP/JSON，一旦 panic 直接 crash 整个网关进程，影响所有在途请求。

**P4. `RefreshModelPricing` 无界并发扇出**
- 位置：`controller/model_data.go:964-967`。`model=""` 时对所有启用渠道各起一个 goroutine（每个带 15s HTTP 请求），无并发上限、无 WaitGroup。渠道多时管理员连点刷新会打满出站连接并造成 upsert 风暴。且 `:942` 处 `_ = common.DecodeJson(...)` 吞掉解析错误，坏 body 退化为「刷新全部」，放大该问题。
- 建议：worker 池/信号量限并发 + 冷却。

**P5. CORS 配置矛盾：`AllowAllOrigins=true` + `AllowCredentials=true`**
- 位置：`middleware/cors.go:11-14`，并应用于携带 session 的路由（`dashboard.go:15`、`relay-router.go:14`、api-router 的 usage/log 组）。
- 带 Cookie 凭证时允许任意 Origin 是不安全（或被浏览器拒绝而无效）的组合。建议改为显式 origin 白名单。

**P6. Admin 可达 SSRF：上游 pricing/models 代理无内网过滤**
- 位置：`controller/channel_upstream_pricing.go:17-67`（`ProxyUpstreamPricing` 直接用用户传入的 `?base_url` 发请求），同类 `FetchUpstreamModels` 等。
- 无对 `127.0.0.1`、`169.254.169.254`（云元数据）、内网段、非 http(s) scheme 的校验。虽有 AdminAuth 缓解，但仍可被用于探测内网。建议加目标地址校验（禁 loopback/link-local/RFC1918，除非显式配置允许）。

### 🟡 中

**P7. 敏感凭证明文落库**
- 渠道上游 key（`model/channel.go:25`）、用户 Access Token（`model/user.go:38`，32 位明文直接比对）、API Token key 均明文存储。存在 `CryptoSecret` 但未用于加密。数据库泄露即等于全部上游凭证泄露。（上游 new-api 亦如此，属继承问题；用户密码已正确 bcrypt。）

**P8. Session 配置**
- `main.go:201` cookie `Secure: false` —— HTTPS 生产环境 session 仍可经明文信道发送；
- `SESSION_SECRET` 未设置时每次重启随机生成（`common/constants.go:54`）→ 重启全员掉线、多实例会话不互通，且 `CryptoSecret` 绑定于它。

**P9. `ProcessAffCommission` 返佣非事务**
- `model/aff_log.go:40-59`：先加 `aff_quota/aff_history`，再单独 `DB.Create(aff_logs)`。第二步失败则钱已入账但无审计记录，对账缺口。建议包进 `DB.Transaction`。
- 另：`aff_log.go:34` `quotaToAdd * AffRatio / 100` 整数除法，小额充值返佣截断为 0（与 topup/settle 普遍用 decimal 的做法不一致）。

**P10. 违反项目 JSON 约定（Rule 1）**
- `service/channel_pricing.go:5,515,531,604`：`ExtractKeyGroup` / `ExtractManualGroupRatio` / `ExtractModelPriceRatio` 直接用 `encoding/json.Unmarshal`，同文件其它地方却用 `common.Unmarshal`。应改为 `common.UnmarshalJsonStr` 并移除 import。

**P11. 结算的用户额度与令牌额度非原子**
- `service/quota.go:408-452` 两步独立更新；`billing_session.go:82-93` 注释已承认：资金提交后令牌调整失败只能记日志。属已知取舍，但值得在监控上覆盖。

**P12. 无优雅退出**
- `main.go` 无 signal 捕获，`server.Run` 直接阻塞。重启/部署时在途请求被硬切断，预扣费未结算的请求依赖 BillingHold/对账兜底。建议加 `http.Server` + `Shutdown(ctx)`。

### ⚪ 低

- **忽略的 error**：`service/channel_pricing.go:113,121`（清理陈旧定价行失败静默残留旧价）、`model/aff_log.go:65,76`（Count 失败 total 悄悄为 0）。
- **浮点拼 SQL**：`service/channel_select_cheapest.go:243-246` 用 `fmt.Sprintf("%f")` 嵌入价格（6 位小数截断可能影响排序；非注入风险但应参数化）。
- **预扣与结算取整方式不一致**：预扣 `int()` 截断 vs 结算 `decimal.Round(0)`；因结算按 delta 对账，最终无累积偏差，仅列备忘。

### 已排查、确认无问题的点（避免误报）

- SQL 注入：日志/查询均参数化，raw SQL 无用户输入拼接；
- OAuth 有 state CSRF 校验；用户密码 bcrypt；查看渠道 key 有 Root + 二次验证 + 审计；
- 日志不打印密钥明文（只记长度）；
- `channel_pricing.go` 的 hub 缓存与 cheapest 路由缓存加锁正确；HTTP body 均有 defer close；
- `image_task_race.go` 的 race goroutine 用足容量 buffered channel，无泄漏。

### 建议修复顺序

1. **P1**（一旦迁移 MySQL/PG 即爆，且改动极小）
2. **P2(a)** Stripe/PayPal 缓存回写（资金正确性感知）
3. **P3 + P4**（进程稳定性，改动小）
4. **P5 / P6 / P8**（安全面加固）
5. **P9 / P10**（一致性与规范，顺手修）
