# New-API 项目功能规格说明书

> 本文档用于 AI Coding 复刻 new-api 项目。覆盖后端全部功能与 web/default 前端全部功能。web/classic 前端被忽略。

---

## 1. 项目概述

**New-API** 是一个 AI API 网关/代理系统，用 Go 语言构建。它将 40+ 上游 AI 提供商（OpenAI、Claude、Gemini、Azure、AWS Bedrock 等）聚合到统一的 OpenAI 兼容 API 后面，同时提供用户管理、计费、速率限制、缓存和多数据库支持，以及基于 React 的管理后台。

- **定位**: LLM Gateway + AI 资产管理 + 多租户计费平台
- **部署形态**: 单二进制可执行文件 + 嵌入式前端静态资源
- **用户画像**: 需要自建 AI API 代理的个人/团队/企业

---

## 2. 技术栈

### 2.1 后端
| 层面 | 技术 |
|------|------|
| 语言 | Go 1.22+ |
| Web 框架 | Gin |
| ORM | GORM v2 |
| 数据库 | SQLite（默认）、MySQL >= 5.7.8、PostgreSQL >= 9.6 |
| 缓存 | Redis (go-redis) + 内存缓存 |
| 会话 | gin-contrib/sessions（Cookie 存储） |
| 密码哈希 | bcrypt |
| JSON | 必须统一使用 `common/json.go` 中的 wrapper，禁止直接 import `encoding/json` 进行 marshal/unmarshal |
| 监控 | Pyroscope 持续分析、pprof、自建性能指标采集 |
| 日志 | 结构化日志 + 文件轮转 + 可选独立 LogDB |
| 国际化 | go-i18n/v2（YAML 嵌入式翻译文件） |

### 2.2 前端 (web/default/)
| 层面 | 技术 |
|------|------|
| 语言 | TypeScript |
| 框架 | React 19 |
| 构建工具 | Rsbuild |
| 包管理器 | Bun |
| 路由 | TanStack Router（文件式路由） |
| 数据获取 | TanStack React Query |
| 状态管理 | Zustand（持久化到 localStorage） |
| UI 框架 | Base UI（Radix 风格 headless） |
| 样式 | Tailwind CSS v4 |
| 图表 | @visactor/react-vchart |
| 表格 | @tanstack/react-table |
| 表单 | React Hook Form + Zod |
| 国际化 | i18next + react-i18next（支持 en/zh/fr/ru/ja/vi） |
| 动画 | motion (framer-motion) |
| 日期 | Day.js / date-fns |
| 富文本 | react-markdown + shiki 代码高亮 |

---

## 3. 后端目录结构

```
new-api/
├── main.go                          # 入口：初始化资源、启动后台任务、启动 HTTP 服务
├── router/                          # 路由注册
│   ├── main.go                      # SetRouter() 总入口
│   ├── api-router.go                # /api/* 管理端 API
│   ├── relay-router.go              # /v1/* /mj/* /suno/* 代理路由
│   ├── dashboard-router.go          # /dashboard/* 管理后台页面
│   └── web-router.go                # 静态资源 + SPA fallback
├── controller/                      # HTTP handler（74+ 文件）
├── service/                         # 业务逻辑（57+ 文件）
├── model/                           # GORM 模型 + DB 操作（40+ 文件）
├── relay/                           # AI 提供商适配层
│   └── channel/                     # 各提供商适配器
│       ├── openai/                  # OpenAI、Azure、OpenRouter 等
│       ├── claude/                  # Anthropic Claude
│       ├── gemini/                  # Google Gemini
│       ├── aws/                     # AWS Bedrock
│       └── ... (共 57 个 channel)   # 详见 §5
├── middleware/                      # Gin 中间件（25+ 文件）
├── dto/                             # 请求/响应结构体
├── common/                          # 公共工具（48+ 文件）
├── setting/                         # 配置管理
│   ├── config/                      # 通用配置框架
│   ├── operation_setting/           # 运营配置（通用/配额/令牌/签到/支付等）
│   ├── ratio_setting/               # 定价比例配置
│   ├── billing_setting/             # 表达式计费配置
│   └── system_setting/              # 系统级配置（主题/Discord/OIDC/Passkey等）
├── oauth/                           # OAuth 提供商实现
├── i18n/                            # 后端国际化（go-i18n）
├── pkg/                             # 内部包
│   ├── billingexpr/                 # 表达式计费引擎（含 expr.md 文档）
│   ├── cachex/                      # 混合缓存（Redis + LRU 内存）
│   ├── perfmetrics/                 # 性能指标采集
│   └── ionet/                       # IO.NET 部署集成
├── constant/                        # 常量（渠道类型、API 类型、上下文键等）
├── types/                           # 类型定义（文件来源等）
├── logger/                          # 日志系统
├── web/
│   └── default/                     # 前端（详见 §17）
├── Dockerfile                       # 多阶段构建
├── docker-compose.yml               # 含 PG + Redis 的编排
└── .env.example                     # 环境变量示例
```

---

## 4. 数据模型 (model/)

### 4.1 核心实体

| 模型 | 表 | 关键字段 | 说明 |
|------|----|---------|------|
| **User** | users | id, username, password(hashed), display_name, role(0=guest,1=common,5=operator,10=admin,100=root), status, email, github_id, discord_id, oidc_id, wechat_id, telegram_id, linux_do_id, access_token, quota, used_quota, request_count, `group`, aff_code, aff_count, aff_quota, aff_history_quota, inviter_id, setting(JSON), remark, stripe_customer, created_at, last_login_at, deleted_at(软删) | 用户账户，角色分级，OAuth 绑定，配额追踪，推荐系统 |
| **Token** | tokens | id, user_id, key(API key), status, name, created_time, accessed_time, expired_time(-1=永不), remain_quota, unlimited_quota, model_limits_enabled, model_limits, allow_ips, used_quota, `group`, cross_group_retry, deleted_at(软删) | API 访问令牌，可限制模型、IP、额度、到期、分组 |
| **Channel** | channels | id, type(57种), key, openai_organization, test_model, status, name, weight, created_time, test_time, response_time, base_url, other, balance, models, `group`, used_quota, model_mapping, status_code_mapping, priority, auto_ban, tag, setting, param_override, header_override, remark, channel_info(JSON: multi-key, polling), other_settings | 上游渠道配置：多密钥、权重、优先级、自动封禁、模型映射、参数/头注入 |
| **Ability** | abilities | `group`, model, channel_id(联合主键), enabled, priority, weight, tag | 渠道+模型+分组 的可用性索引，用于路由 |
| **Log** | logs | id, user_id, created_at, type(0=unknown,1=topup,2=consume,3=manage,4=system,5=error,6=refund), content, username, token_name, model_name, quota, prompt_tokens, completion_tokens, use_time, is_stream, channel_id, channel_name, token_id, `group`, ip, request_id, upstream_request_id, other | 完整审计日志。支持写入独立 LOG_DB |
| **Option** | options | key(PK), value | KV 配置存储，所有系统设置的基础 |
| **Redemption** | redemptions | id, user_id, `key`, status, name, quota, created_time, redeemed_time, count, used_user_id, expired_time, deleted_at(软删) | 兑换码，用于额度充值 |
| **TopUp** | top_ups | id, user_id, amount, money, trade_no(唯一), payment_method, payment_provider, create_time, complete_time, status | 支付交易记录 |
| **Midjourney** | midjourneys | id, code, user_id, action, mj_id, prompt, prompt_en, description, state, submit_time, start_time, finish_time, image_url, video_url, status, progress, fail_reason, channel_id, quota, buttons, properties | Midjourney 任务追踪（CAS 状态更新） |
| **Task** | tasks | id, task_id, platform, user_id, `group`, channel_id, quota, action, status, fail_reason, submit_time, start_time, finish_time, progress, properties, private_data(key, upstream task id, billing context), data | 异步任务（Suno、视频生成等），CAS 状态更新 |

### 4.2 订阅/计费模型

| 模型 | 表 | 关键字段 | 说明 |
|------|----|---------|------|
| **SubscriptionPlan** | subscription_plans | id, title, subtitle, price_amount(decimal 10,6), currency, duration_unit(year/month/day/hour/custom), duration_value, custom_seconds, enabled, sort_order, allow_balance_pay, stripe_price_id, creem_product_id, waffo_pancake_product_id, max_purchase_per_user, upgrade_group, total_amount, quota_reset_period, quota_reset_custom_seconds | 订阅套餐定义，混合缓存 |
| **SubscriptionOrder** | subscription_orders | id, user_id, plan_id, money, trade_no, payment_method, payment_provider, status, create_time, complete_time, provider_payload | 订阅购买订单 |
| **UserSubscription** | user_subscriptions | id, user_id, plan_id, amount_total, amount_used, start_time, end_time, status(active/expired/cancelled), source, last_reset_time, next_reset_time, upgrade_group, prev_user_group | 用户订阅实例，含额度重置调度 |
| **SubscriptionPreConsumeRecord** | subscription_pre_consume_records | id, request_id(唯一), user_id, user_subscription_id, pre_consumed, status, created_at, updated_at | 预消费记录，防重复扣费 |
| **QuotaData** | quota_data | id, user_id, username, model_name, created_at, token_used, count, quota | 仪表盘用量分析（按小时聚合） |

### 4.3 安全模型

| 模型 | 关键字段 | 说明 |
|------|---------|------|
| **TwoFA** | id, user_id(唯一), secret(TOTP), is_enabled, failed_attempts, locked_until, last_used_at | 二次验证，含账户锁定 |
| **TwoFABackupCode** | id, user_id, code_hash, is_used, used_at | 2FA 备份码 |
| **PasskeyCredential** | id, user_id, credential_id(base64), public_key(base64), attestation_type, aaguid, sign_count, clone_warning, user_present, user_verified, backup_eligible, backup_state, transports, attachment, last_used_at | WebAuthn/Passkey 凭证 |
| **UserOAuthBinding** | id, user_id, provider_id, provider_user_id | 用户与自定义 OAuth 提供商的绑定 |
| **CustomOAuthProvider** | id, name, slug(唯一), icon, enabled, client_id, client_secret, authorization_endpoint, token_endpoint, user_info_endpoint, scopes, user_id_field, username_field, display_name_field, email_field, well_known, auth_style, access_policy(JSON), access_denied_message | 可配置 OAuth 提供商，含字段映射和访问策略引擎 |

### 4.4 元数据模型

| 模型 | 关键字段 | 说明 |
|------|---------|------|
| **Model** | id, model_name, description, icon, tags, vendor_id, endpoints(JSON), status, sync_official, name_rule(exact/prefix/contains/suffix) | 模型元数据注册表，支持多种名称匹配规则 |
| **Vendor** | id, name, description, icon, status | AI 提供商定义 |
| **PrefillGroup** | group 配置 | 预定义分组，用于自动渠道分配 |
| **Setup** | version, initialized_at | 系统初始化追踪 |
| **Checkin** | id, user_id, checkin_date(用户唯一), quota_awarded, created_at | 每日签到领额度 |
| **PerfMetric** | 性能指标存储 | 系统性能监控数据 |

### 4.5 缓存架构
- **Redis 缓存**: User、Token、Channel 数据缓存，带异步自动更新
- **混合缓存(cachex)**: SubscriptionPlan 使用 Redis + 内存 LRU 双缓存，可配置 TTL
- **内存缓存**: Channel + Ability 全量索引在内存，`group→model→channelIDs` 映射，O(1) 渠道选择
- **Token 缓存**: HMAC-SHA256 哈希 key 作为 Redis hash key，快速验证
- **批量更新**: 可选异步批量更新配额变更，减少 DB 写入压力

### 4.6 Redis Key 前缀
- `user:{id}` — 用户 hash
- `token:{hmac}` — 令牌 hash
- `new-api:subscription_plan:v1:{id}` — 订阅计划
- `new-api:subscription_plan_info:v1:{sub_id}` — 订阅实例信息
- `GA{ip}` `GW{ip}` `CT{ip}` `UP{ip}` `DW{ip}` `SR:user:{user_id}` — 各层速率限制

---

## 5. AI 提供商支持 (relay/channel/)

### 5.1 已支持的渠道类型（57 种）

| 编号 | 提供商 | 适配器 | 编号 | 提供商 | 适配器 |
|------|--------|--------|------|--------|--------|
| 1 | OpenAI | openai | 2 | Midjourney | MJ Proxy |
| 3 | Azure OpenAI | openai | 4 | Ollama | ollama |
| 14 | Anthropic Claude | claude | 15 | Baidu ERNIE | baidu |
| 16 | Zhipu GLM | zhipu | 17 | Alibaba (DashScope) | ali |
| 18 | Xunfei Spark | xunfei | 24 | Google Gemini | gemini |
| 25 | Moonshot Kimi | moonshot | 33 | AWS Bedrock | aws |
| 34 | Cohere | cohere | 35 | - | - |
| 36 | MiniMax | minimax | 37 | - | - |
| 38 | Groq | groq | 39 | Perplexity | perplexity |
| 40 | Mistral | mistral | 41 | Google Vertex AI | vertex |
| 42 | SiliconFlow | siliconflow | 43 | DeepSeek | deepseek |
| 44 | Moonshot V2 | moonshot | 45 | Zhipu V4 | zhipu_4v |
| 46 | Baidu V2 (Qianfan) | baidu_v2 | 47 | Tencent Hunyuan | tencent |
| 48 | Cohere V2 | cohere | 49 | Cloudflare | cloudflare |
| 50 | Replicate | replicate | 51 | xAI Grok | xai |
| 52 | Jina | jina | 53 | Submodel | submodel |
| 54 | Volume | volume | 55 | Dify | dify |
| 56 | Coze | coze | 57 | Xinference | openai |

以及多个第三方代理渠道：OhMyGPT、OpenAIMax、AILS、AIProxy、API2GPT、AIGC2D、360、FastGPT、OpenAI-Community 等。

### 5.2 请求格式支持

| 格式 | 说明 |
|------|------|
| OpenAI Chat/Completions | 标准 OpenAI 对话补全 |
| Claude Messages | Anthropic Messages API |
| Gemini API | Google Gemini 原生 API（含 embedding） |
| OpenAI Responses | OpenAI Responses API |
| OpenAI Responses Compaction | Responses 精简模式 |
| OpenAI Audio | Whisper 语音转录/翻译、TTS 语音合成 |
| OpenAI Image | DALL-E 图像生成/编辑 |
| OpenAI Realtime | WebSocket 实时对话 |
| Rerank | Cohere/Jina 重排序 |
| Embedding | 文本向量嵌入 |
| Task | 异步任务（Suno、视频生成） |
| MJ Proxy | Midjourney 代理 |

### 5.3 格式转换
- OpenAI ↔ Claude Messages: ✅
- OpenAI ↔ Gemini: ✅（文本，双向）
- Thinking content ↔ 普通 content: ✅
- Provider model name mapping: ✅ 通过 `ModelMapping` JSON 字段

### 5.4 异步任务平台支持

| 平台 | 说明 |
|------|------|
| Suno | 音乐生成 |
| Ali (Tongyi) | 视频生成 |
| Kling | 视频生成 |
| Jimeng | 图像/视频生成 |
| Vertex AI | 视频生成 |
| Vidu | 视频生成 |
| Doubao/VolcEngine | 视频生成 |
| Sora/OpenAI | 视频生成 |
| Gemini | 视频生成 |
| MiniMax/Hailuo | 视频生成 |

### 5.5 适配器接口

所有渠道适配器实现以下接口：
```go
type Adaptor interface {
    Init(meta *Meta)
    GetRequestURL(meta *Meta, request *GeneralOpenAIRequest) (string, error)
    SetupRequestHeader(c *gin.Context, req *http.Request, meta *Meta) error
    ConvertRequest(c *gin.Context, relayMode int, request *GeneralOpenAIRequest) (any, error)
    ConvertImageRequest(c *gin.Context, request *ImageRequest) (any, error)
    ConvertAudioRequest(c *gin.Context, request *GeneralOpenAIRequest) (io.ReadCloser, error)
    DoRequest(c *gin.Context, meta *Meta, requestBody io.Reader) (any, error)
    DoResponse(c *gin.Context, resp *http.Response, meta *Meta) (usage *Usage, err *NewAPIError)
}
```

---

## 6. API 端点汇总 (controller/)

### 6.1 Relay 代理端点（AI API）

| 端点 | 格式 | 说明 |
|------|------|------|
| `POST /v1/chat/completions` | OpenAI Chat | 对话补全 |
| `POST /v1/completions` | OpenAI Completions | 文本补全 |
| `POST /v1/messages` | Claude Messages | Claude 对话 |
| `POST /v1/responses` | OpenAI Responses | Responses API |
| `POST /v1/responses/compact` | Compact Responses | 精简模式 |
| `POST /v1/images/generations` | Image Generation | 图像生成 |
| `POST /v1/images/edits` | Image Edits | 图像编辑 |
| `POST /v1/embeddings` | Embeddings | 文本向量 |
| `POST /v1/audio/transcriptions` | Audio Transcription | 语音转录 |
| `POST /v1/audio/translations` | Audio Translation | 语音翻译 |
| `POST /v1/audio/speech` | Text-to-Speech | 语音合成 |
| `POST /v1/rerank` | Rerank | 重排序 |
| `POST /v1/moderations` | Moderation | 内容审核 |
| `GET /v1/realtime` | Realtime WebSocket | 实时对话 |
| `POST /v1beta/models/*path` | Gemini API | Gemini 原生 |
| `POST /v1/engines/:model/embeddings` | Gemini Embeddings | Gemini Embedding |
| `GET /v1/models` | List Models | 模型列表 |
| `GET /v1/models/:model` | Retrieve Model | 单个模型信息 |

### 6.2 Midjourney 端点

| 端点 | 说明 |
|------|------|
| `POST /mj/submit/imagine` | 文生图 |
| `POST /mj/submit/change` | 图变换/放大 |
| `POST /mj/submit/describe` | 图生描述 |
| `POST /mj/submit/blend` | 图融合 |
| `POST /mj/submit/shorten` | 提示词缩短 |
| `POST /mj/submit/action` | 自定义动作 |
| `POST /mj/submit/modal` | 模态提交 |
| `POST /mj/submit/edits` | 图像编辑 |
| `POST /mj/submit/video` | 视频生成 |
| `POST /mj/submit/simple-change` | 简单变换 |
| `GET /mj/task/:id/fetch` | 获取任务结果 |
| `GET /mj/task/:id/image-seed` | 获取图片种子 |
| `POST /mj/task/list-by-condition` | 任务列表 |
| `POST /mj/insight-face/swap` | 换脸 |
| `GET /mj/image/:id` | 图片代理 |

### 6.3 Suno 音乐端点

| 端点 | 说明 |
|------|------|
| `POST /suno/submit/:action` | 提交音乐生成 |
| `POST /suno/fetch` | 批量获取 |
| `GET /suno/fetch/:id` | 单个获取 |

### 6.4 用户管理端点

| 端点 | 最低角色 | 说明 |
|------|---------|------|
| `POST /api/user/register` | Guest | 注册（可选 Turnstile + 邮箱验证） |
| `POST /api/user/login` | Guest | 密码登录（可选 Turnstile） |
| `POST /api/user/login/2fa` | Guest | 二次验证登录 |
| `POST /api/user/passkey/login/begin` | Guest | WebAuthn 登录开始 |
| `POST /api/user/passkey/login/finish` | Guest | WebAuthn 登录完成 |
| `GET /api/user/logout` | Guest | 登出 |
| `GET /api/user/self` | User(1) | 获取个人信息 |
| `PUT /api/user/self` | User(1) | 更新个人信息 |
| `DELETE /api/user/self` | User(1) | 注销账户 |
| `GET /api/user/self/groups` | User(1) | 可访问分组 |
| `GET /api/user/models` | User(1) | 可访问模型 |
| `GET /api/user/token` | User(1) | 生成 access token |
| `GET /api/user/aff` | User(1) | 获取推荐码 |
| `PUT /api/user/setting` | User(1) | 更新用户设置 |
| `GET /api/user/checkin` | User(1) | 签到状态 |
| `POST /api/user/checkin` | User(1) | 每日签到 |
| `GET /api/user/topup/info` | User(1) | 充值信息 |
| `GET /api/user/topup/self` | User(1) | 充值历史 |
| `POST /api/user/topup` | User(1) | EPay 充值 |
| `POST /api/user/pay` | User(1) | EPay 支付 |
| `POST /api/user/amount` | User(1) | EPay 金额计算 |
| `POST /api/user/stripe/pay` | User(1) | Stripe 支付 |
| `POST /api/user/stripe/amount` | User(1) | Stripe 金额 |
| `POST /api/user/creem/pay` | User(1) | Creem 支付 |
| `POST /api/user/waffo/amount` | User(1) | Waffo 金额 |
| `POST /api/user/waffo/pay` | User(1) | Waffo 支付 |
| `POST /api/user/waffo-pancake/amount` | User(1) | Waffo Pancake 金额 |
| `POST /api/user/waffo-pancake/pay` | User(1) | Waffo Pancake 支付 |
| `POST /api/user/aff_transfer` | User(1) | 转移推荐奖励 |
| `GET /api/user/2fa/status` | User(1) | 2FA 状态 |
| `POST /api/user/2fa/setup` | User(1) | 设置 2FA |
| `POST /api/user/2fa/enable` | User(1) | 启用 2FA |
| `POST /api/user/2fa/disable` | User(1) | 禁用 2FA |
| `POST /api/user/2fa/backup_codes` | User(1) | 重新生成备份码 |
| `GET /api/user/passkey` | User(1) | Passkey 状态 |
| `POST /api/user/passkey/register/begin` | User(1) | 注册 Passkey 开始 |
| `POST /api/user/passkey/register/finish` | User(1) | 注册 Passkey 完成 |
| `POST /api/user/passkey/verify/begin` | User(1) | 验证 Passkey 开始 |
| `POST /api/user/passkey/verify/finish` | User(1) | 验证 Passkey 完成 |
| `DELETE /api/user/passkey` | User(1) | 删除 Passkey |
| `GET /api/user/oauth/bindings` | User(1) | OAuth 绑定列表 |
| `DELETE /api/user/oauth/bindings/:provider_id` | User(1) | 解绑自定义 OAuth |

### 6.5 管理员端点

| 端点 | 最低角色 | 说明 |
|------|---------|------|
| `GET /api/user/` | Staff(5) | 用户列表 |
| `GET /api/user/search` | Staff(5) | 搜索用户 |
| `GET /api/user/:id` | Staff(5) | 按 ID 获取 |
| `POST /api/user/` | Staff(5) | 创建用户 |
| `PUT /api/user/` | Staff(5) | 更新用户 |
| `POST /api/user/manage` | Staff(5) | 批量操作 |
| `DELETE /api/user/:id` | Staff(5) | 删除用户 |
| `DELETE /api/user/:id/reset_passkey` | Staff(5) | 重置 Passkey |
| `DELETE /api/user/:id/bindings/:type` | Staff(5) | 清除绑定(github/discord/等) |
| `DELETE /api/user/:id/2fa` | Staff(5) | 关闭用户 2FA |
| `GET /api/user/2fa/stats` | Staff(5) | 2FA 统计 |
| `GET /api/user/topup` | Staff(5) | 所有充值记录 |
| `POST /api/user/topup/complete` | Staff(5) | 管理员手动完成充值 |

### 6.6 渠道管理端点

| 端点 | 最低角色 | 说明 |
|------|---------|------|
| `GET /api/channel/` | Admin(10) | 渠道列表 |
| `GET /api/channel/search` | Admin(10) | 搜索渠道 |
| `GET /api/channel/models` | Admin(10) | 渠道模型 |
| `GET /api/channel/models_enabled` | Admin(10) | 已启用模型 |
| `GET /api/channel/:id` | Admin(10) | 按 ID 获取 |
| `POST /api/channel/:id/key` | Root(100) | 查看渠道密钥（禁用缓存） |
| `GET /api/channel/test` | Admin(10) | 测试所有渠道 |
| `GET /api/channel/test/:id` | Admin(10) | 测试单个渠道 |
| `GET /api/channel/update_balance` | Admin(10) | 更新所有余额 |
| `GET /api/channel/update_balance/:id` | Admin(10) | 更新单个余额 |
| `POST /api/channel/` | Admin(10) | 新增渠道 |
| `PUT /api/channel/` | Admin(10) | 更新渠道 |
| `DELETE /api/channel/:id` | Admin(10) | 删除渠道 |
| `DELETE /api/channel/disabled` | Admin(10) | 删除所有禁用渠道 |
| `POST /api/channel/disabled` | Admin(10) | 按标签禁用 |
| `POST /api/channel/enabled` | Admin(10) | 按标签启用 |
| `PUT /api/channel/tag` | Admin(10) | 按标签批量编辑 |
| `POST /api/channel/batch` | Admin(10) | 批量删除 |
| `POST /api/channel/fix` | Admin(10) | 修复渠道能力表 |
| `GET /api/channel/fetch_models/:id` | Admin(10) | 获取上游模型 |
| `POST /api/channel/fetch_models` | Root(100) | 自定义获取上游模型 |
| `POST /api/channel/copy/:id` | Admin(10) | 复制渠道 |
| `POST /api/channel/batch/tag` | Admin(10) | 批量设置标签 |
| `GET /api/channel/tag/models` | Admin(10) | 标签模型列表 |
| `POST /api/channel/multi_key/manage` | Admin(10) | 管理多密钥 |
| `POST /api/channel/codex/oauth/start` | Admin(10) | Codex OAuth 开始 |
| `POST /api/channel/codex/oauth/complete` | Admin(10) | Codex OAuth 完成 |
| `POST /api/channel/:id/codex/oauth/start` | Admin(10) | 单个渠道 Codex OAuth 开始 |
| `POST /api/channel/:id/codex/oauth/complete` | Admin(10) | 单个渠道 Codex OAuth 完成 |
| `POST /api/channel/:id/codex/refresh` | Admin(10) | 刷新 Codex 凭证 |
| `GET /api/channel/:id/codex/usage` | Admin(10) | Codex 用量 |
| `POST /api/channel/ollama/pull` | Admin(10) | Ollama 拉取模型 |
| `POST /api/channel/ollama/pull/stream` | Admin(10) | Ollama 拉取（流式） |
| `DELETE /api/channel/ollama/delete` | Admin(10) | Ollama 删除模型 |
| `GET /api/channel/ollama/version/:id` | Admin(10) | Ollama 版本 |
| `POST /api/channel/upstream_updates/detect` | Admin(10) | 检测上游更新 |
| `POST /api/channel/upstream_updates/detect_all` | Admin(10) | 检测所有上游更新 |
| `POST /api/channel/upstream_updates/apply` | Admin(10) | 应用上游更新 |
| `POST /api/channel/upstream_updates/apply_all` | Admin(10) | 应用所有上游更新 |

### 6.7 令牌管理端点

| 端点 | 最低角色 | 说明 |
|------|---------|------|
| `GET /api/token/` | User(1) | 令牌列表 |
| `GET /api/token/search` | User(1) | 搜索令牌 |
| `GET /api/token/:id` | User(1) | 按 ID 获取 |
| `POST /api/token/` | User(1) | 创建令牌 |
| `PUT /api/token/` | User(1) | 更新令牌 |
| `DELETE /api/token/:id` | User(1) | 删除令牌 |
| `POST /api/token/batch` | User(1) | 批量删除 |
| `POST /api/token/:id/key` | User(1) | 查看完整 key（禁用缓存） |
| `POST /api/token/batch/keys` | User(1) | 批量查看 key |

### 6.8 订阅与计费端点

| 端点 | 最低角色 | 说明 |
|------|---------|------|
| `GET /api/subscription/plans` | User(1) | 订阅计划列表 |
| `GET /api/subscription/self` | User(1) | 个人订阅 |
| `PUT /api/subscription/self/preference` | User(1) | 更新订阅偏好 |
| `POST /api/subscription/balance/pay` | User(1) | 余额购买订阅 |
| `POST /api/subscription/epay/pay` | User(1) | EPay 购买订阅 |
| `POST /api/subscription/stripe/pay` | User(1) | Stripe 购买订阅 |
| `POST /api/subscription/creem/pay` | User(1) | Creem 购买订阅 |
| `POST /api/subscription/waffo-pancake/pay` | User(1) | Waffo Pancake 购买 |
| `GET /api/subscription/admin/plans` | Staff(5) | 管理员计划列表 |
| `POST /api/subscription/admin/plans` | Staff(5) | 创建计划 |
| `PUT /api/subscription/admin/plans/:id` | Staff(5) | 更新计划 |
| `PATCH /api/subscription/admin/plans/:id` | Staff(5) | 切换启用状态 |
| `POST /api/subscription/admin/bind` | Staff(5) | 管理员绑定订阅给用户 |
| `GET /api/subscription/admin/users/:id/subscriptions` | Staff(5) | 用户订阅列表 |
| `POST /api/subscription/admin/users/:id/subscriptions` | Staff(5) | 为用户创建订阅 |
| `POST /api/subscription/admin/user_subscriptions/:id/invalidate` | Staff(5) | 使订阅失效 |
| `DELETE /api/subscription/admin/user_subscriptions/:id` | Staff(5) | 删除订阅 |

### 6.9 日志与数据端点

| 端点 | 最低角色 | 说明 |
|------|---------|------|
| `GET /api/log/` | Staff(5) | 所有日志 |
| `GET /api/log/search` | Staff(5) | 搜索日志 |
| `GET /api/log/stat` | Staff(5) | 日志统计 |
| `GET /api/log/self` | User(1) | 个人日志 |
| `GET /api/log/self/stat` | User(1) | 个人统计 |
| `GET /api/log/self/search` | User(1) | 搜索个人日志 |
| `DELETE /api/log/` | Staff(5) | 删除旧日志 |
| `GET /api/log/token` | Token(只读) | 按 token key 查日志 |
| `GET /api/data/` | Staff(5) | 仪表盘数据 |
| `GET /api/data/users` | Staff(5) | 按用户数据 |
| `GET /api/data/self` | User(1) | 个人数据 |

### 6.10 模型与厂商管理

| 端点 | 最低角色 | 说明 |
|------|---------|------|
| `GET /api/models/` | Admin(10) | 模型元数据列表 |
| `GET /api/models/search` | Admin(10) | 搜索模型 |
| `GET /api/models/:id` | Admin(10) | 按 ID 获取 |
| `POST /api/models/` | Admin(10) | 创建模型 |
| `PUT /api/models/` | Admin(10) | 更新模型 |
| `DELETE /api/models/:id` | Admin(10) | 删除模型 |
| `GET /api/models/missing` | Admin(10) | 缺失模型 |
| `GET /api/models/sync_upstream/preview` | Admin(10) | 预览上游同步 |
| `POST /api/models/sync_upstream` | Admin(10) | 执行上游同步 |
| `GET /api/vendors/` | Admin(10) | 厂商列表 |
| `GET /api/vendors/search` | Admin(10) | 搜索厂商 |
| `GET /api/vendors/:id` | Admin(10) | 按 ID 获取 |
| `POST /api/vendors/` | Admin(10) | 创建厂商 |
| `PUT /api/vendors/` | Admin(10) | 更新厂商 |
| `DELETE /api/vendors/:id` | Admin(10) | 删除厂商 |

### 6.11 系统配置端点

| 端点 | 最低角色 | 说明 |
|------|---------|------|
| `GET /api/setup` | Guest | 检查初始化状态 |
| `POST /api/setup` | Guest | 初始化系统 |
| `GET /api/status` | Guest | 系统状态（名称、Logo、OAuth 配置等） |
| `GET /api/models` | User(1) | 模型定价列表 |
| `GET /api/pricing` | Guest(限流) | 定价数据 |
| `GET /api/rankings` | Guest(限流) | 排行榜 |
| `GET /api/notice` | Guest | 系统公告 |
| `GET /api/about` | Guest | 关于页面 |
| `GET /api/home_page_content` | Guest | 首页内容 |
| `GET /api/option/` | Root(100) | 所有选项 |
| `PUT /api/option/` | Root(100) | 更新选项 |
| `POST /api/option/payment_compliance` | Root(100) | 确认支付合规 |
| `POST /api/option/rest_model_ratio` | Root(100) | 重置模型比例 |
| `POST /api/option/migrate_console_setting` | Root(100) | 迁移控制台设置 |

### 6.12 OAuth 端点

| 端点 | 说明 |
|------|------|
| `GET /api/oauth/state` | 生成 OAuth state |
| `GET /api/oauth/:provider` | 统一 OAuth 处理器（GitHub/Discord/OIDC/LinuxDO） |
| `POST /api/oauth/email/bind` | 绑定邮箱 |
| `GET /api/oauth/wechat` | 微信授权 |
| `POST /api/oauth/wechat/bind` | 微信绑定 |
| `GET /api/oauth/telegram/login` | Telegram 登录 |
| `GET /api/oauth/telegram/bind` | Telegram 绑定 |

### 6.13 支付回调端点

| 端点 | 说明 |
|------|------|
| `POST /api/stripe/webhook` | Stripe 回调 |
| `POST /api/creem/webhook` | Creem 回调 |
| `POST /api/waffo/webhook` | Waffo 回调 |
| `POST /api/waffo-pancake/webhook/:env` | Waffo Pancake 回调 |
| `POST /api/user/epay/notify` | EPay 回调 |

### 6.14 性能与调试

| 端点 | 说明 |
|------|------|
| `GET /api/performance/stats` | 性能统计 |
| `DELETE /api/performance/disk_cache` | 清除磁盘缓存 |
| `POST /api/performance/reset_stats` | 重置统计 |
| `POST /api/performance/gc` | 强制 GC |
| `GET /api/performance/logs` | 日志文件列表 |
| `DELETE /api/performance/logs` | 清理日志 |

### 6.15 IO.NET 部署端点

| 端点 | 说明 |
|------|------|
| `GET /api/deployments/settings` | 部署设置 |
| `GET /api/deployments/` | 部署列表 |
| `GET /api/deployments/search` | 搜索部署 |
| `POST /api/deployments/test-connection` | 测试连接 |
| `GET /api/deployments/hardware-types` | 硬件类型 |
| `GET /api/deployments/locations` | 位置 |
| `GET /api/deployments/available-replicas` | 可用副本 |
| `POST /api/deployments/price-estimation` | 价格估算 |
| `GET /api/deployments/check-name` | 检查名称 |
| `POST /api/deployments/` | 创建部署 |
| `GET /api/deployments/:id` | 详情 |
| `GET /api/deployments/:id/logs` | 日志 |
| `GET /api/deployments/:id/containers` | 容器列表 |
| `GET /api/deployments/:id/containers/:cid` | 容器详情 |
| `PUT /api/deployments/:id` | 更新 |
| `PUT /api/deployments/:id/name` | 重命名 |
| `POST /api/deployments/:id/extend` | 延长 |
| `DELETE /api/deployments/:id` | 删除 |

---

## 7. 中间件系统 (middleware/)

### 7.1 认证中间件

| 中间件 | 最低角色 | 说明 |
|--------|---------|------|
| `UserAuth()` | CommonUser(1) | 会话或 access token + 需要 `New-Api-User` header |
| `AdminAuth()` | AdminUser(10) | 管理员 |
| `StaffAuth()` | OperatorAdmin(5) | 运营人员 |
| `RootAuth()` | RootUser(100) | 根用户（全权限） |
| `TokenAuth()` | - | API token 验证（relay 端点） |
| `TokenAuthReadOnly()` | - | 宽松验证（允许过期/禁用 token） |
| `TokenOrUserAuth()` | - | 先会话，失败再 token |
| `TryUserAuth()` | - | 可选用户上下文（无 auth 不报错） |

### 7.2 速率限制（6 层 + 模型级）

| 中间件 | 作用域 | 配置环境变量 | Key 格式 |
|--------|--------|------------|----------|
| `GlobalAPIRateLimit()` | 全局 API | `GLOBAL_API_RATE_LIMIT_*` | `GA{IP}` |
| `GlobalWebRateLimit()` | 全局 Web | `GLOBAL_WEB_RATE_LIMIT_*` | `GW{IP}` |
| `CriticalRateLimit()` | 关键操作 | `CRITICAL_RATE_LIMIT_*` | `CT{IP}` |
| `DownloadRateLimit()` | 下载 | 硬编码 10/60s | `DW{IP}` |
| `UploadRateLimit()` | 上传 | 硬编码 10/60s | `UP{IP}` |
| `SearchRateLimit()` | 搜索 | `SEARCH_RATE_LIMIT_*` | `SR:user:{userId}` |
| `ModelRequestRateLimit()` | 模型请求 | DB 设置 | `MRRL{userId}` |

特点：令牌桶算法限制总量，滑动窗口限制成功率；支持按组配置；Redis/in-memory 双后端。

### 7.3 渠道分发中间件

| 中间件 | 说明 |
|--------|------|
| `Distribute()` | 完整渠道选择流水线：token 模型检查 → 亲和路由 → auto-group → 加权随机 → 渠道上下文 |
| `StatsMiddleware()` | 请求统计追踪 |

特点：
- 管理员调试：token 可附带 `:channelId` 强制走指定渠道
- 渠道亲和性：用户固定到最近使用的渠道（缓存）
- Auto-group：`group=auto` 从用户可用组动态选择
- 加权随机 + 优先级分层
- 多密钥：polling/random 模式选择

### 7.4 安全中间件

| 中间件 | 说明 |
|--------|------|
| `CORS()` | 跨域 |
| `TurnstileCheck()` | Cloudflare Turnstile 验证 |
| `SecureVerificationRequired()` | 敏感操作额外安全验证 |
| `I18n()` | 国际化（从 Accept-Language 检测） |
| `RequestId()` | 注入 `X-Oneapi-Request-Id` |
| `PoweredBy()` | `X-Powered-By` 响应头 |
| `Recover()` | panic 恢复与错误上报 |
| `BodyStorageCleanup()` | 清理临时请求体存储 |

### 7.5 系统中间件

| 中间件 | 说明 |
|--------|------|
| `DisableCache()` | 敏感端点禁用缓存 |
| `Gzip()` | 压缩 |
| `Logger()` | 访问日志 |
| `Performance()` | 系统性能检查 |
| `HeaderNavAuth()` | 模级别访问控制（pricing/rankings 可见性） |
| `DecompressRequestMiddleware()` | 解压请求体 |
| `RequestBodyLimitMiddleware()` | 限制请求体大小（`MAX_REQUEST_BODY_MB`，默认 32MB） |
| `SystemPerformanceCheck()` | 前置系统负载检查 |
| `EmailVerificationRateLimit()` | 邮箱验证限速 |
| `RouteTag()` | 路由标签（api/relay/web），用于分析 |

---

## 8. 业务逻辑服务 (service/)

### 8.1 核心服务

| 领域 | 文件 | 职责 |
|------|------|------|
| 渠道选择 | `channel_select.go`, `channel.go` | 加权随机 + 优先级 + 多密钥管理 |
| 渠道亲和性 | `channel_affinity.go` | 用户粘滞到历史渠道 |
| 计费/配额 | `billing.go`, `pre_consume_quota.go`, `quota.go` | 预消费 + 后消费计费引擎 |
| 阶梯结算 | `tiered_settle.go` | 表达式阶梯计费 |
| 订阅计费 | `billing_session.go` | 基于订阅的计费（预消费、退款、重置） |
| Token 计数 | `token_counter.go`, `token_estimator.go`, `tokenizer.go` | 多提供商 token 计算与估算 |
| 文本配额 | `text_quota.go` | 文本配额计算 |
| 工具计费 | `tool_billing.go` | 工具调用计费 |
| 违规扣费 | `violation_fee.go` | 政策违规罚金 |
| 图像/音频 | `image.go`, `audio.go` | 图像/音频计费 |
| Midjourney | `midjourney.go` | MJ 专用计费 |
| 排名 | `rankings.go` | 用量排名计算 |
| 分组 | `group.go` | 用户组验证与 auto-group 映射 |
| 文件服务 | `file_service.go`, `file_decoder.go` | 文件上传/下载/解码 |
| 通知 | `user_notify.go`, `notify-limit.go` | 用户通知 + 限速 |
| Webhook | `webhook.go` | Webhook 通知 |
| HTTP 客户端 | `http_client.go`, `http.go` | 带保活/超时/重试的 HTTP 客户端 |

### 8.2 后台任务

| 任务 | 职责 |
|------|------|
| `task_billing.go` | 异步任务计费结算（Suno/视频） |
| `task_polling.go` | 任务轮询编排 |
| `subscription_reset_task.go` | 定时订阅额度重置 |
| `codex_credential_refresh_task.go` | 自动刷新 Codex OAuth token |
| `codex_oauth.go` | Codex OAuth 流程 |
| `codex_wham_usage.go` | Codex WHAM 用量追踪 |
| `epay.go` | EPay 支付服务 |
| `waffo_pancake.go` | Waffo Pancake 支付 |
| `return_path.go` | 支付回调路径处理 |

### 8.3 计费引擎架构

**两阶段计费：**
1. **预消费** (`pre_consume_quota.go`): 请求开始时估算并预留配额
2. **后消费** (`quota.go`, `tiered_settle.go`): 响应后计算实际费用并结算差额

**计费模式：**
- **固定比例**: `model_ratio * group_ratio * token_count`
- **固定价格**: `model_price * group_ratio`（按请求）
- **阶梯表达式** (`billing_setting`): 使用 `pkg/billingexpr/` 的表达式引擎

**扣费顺序：**
1. 订阅额度池（如有有效订阅）
2. 钱包余额（user.quota）

---

## 9. 配置系统 (setting/)

### 9.1 配置框架 (setting/config/)
- 通用 KV 配置存储，带验证和序列化
- 自定义配置模式，支持类型化字段
- 用于主题、性能、计费、工具价格等
- Option key 遵循 `{config_name}.{field}` 模式

### 9.2 运营配置 (setting/operation_setting/)

| 模块 | 关键设置 |
|------|---------|
| General | 配额显示类型(USD/Tokens)、价格、货币 |
| Quota | 每单位配额、预消费配额 |
| Token | 每用户最大 token 数、默认令牌配置 |
| Check-in | 每日签到开关、最小/最大奖励额度 |
| Payment | EPay/Stripe/Creem/Waffo 支付配置 |
| Tool Price | 工具价格索引 |
| Status Code Ranges | 自动禁用/重试的状态码范围 |
| Channel Affinity | 亲和缓存 TTL、行为 |
| Monitor | 监控轮询间隔 |

### 9.3 比例配置 (setting/ratio_setting/)

| 模块 | 职责 |
|------|------|
| `model_ratio.go` | 按模型计费比例 |
| `group_ratio.go` | 按组计费倍率 |
| `cache_ratio.go` | 缓存命中折扣 |
| `compact_suffix.go` | 精简模型后缀 |
| `expose_ratio.go` | 是否向 API 暴露比例 |

### 9.4 计费配置 (setting/billing_setting/)

| 模块 | 职责 |
|------|------|
| `tiered_billing.go` | 表达式阶梯计费配置和索引 |

### 9.5 系统配置 (setting/system_setting/)

| 模块 | 职责 |
|------|------|
| `theme.go` | 前端主题（default/classic） |
| `discord.go` | Discord OAuth 配置 |
| `oidc.go` | OIDC 配置 |
| `passkey.go` | WebAuthn 配置（RP 名称/ID/源/验证要求/附件类型） |
| `legal.go` | 法律页面（用户协议、隐私政策） |
| `fetch_setting.go` | 上游获取设置 |
| `system_setting_old.go` | 旧版系统设置 |

### 9.6 其他配置

| 模块 | 职责 |
|------|------|
| `chat.go` | 聊天/侧边栏配置 |
| `midjourney.go` | MJ 设置（通知、账号过滤、模式清除、转发 URL） |
| `rate_limit.go` | 模型请求限速配置 |
| `sensitive.go` | 敏感词过滤 |
| `auto_group.go` | 自动分组配置 |
| `user_usable_group.go` | 用户可用组映射 |

---

## 10. DTO (dto/)

### 10.1 请求 DTO

| 文件 | 说明 |
|------|------|
| `openai_request.go` | `GeneralOpenAIRequest`，包含所有 OpenAI/Claude/Gemini 参数 |
| `openai_response.go` | OpenAI 兼容响应结构 |
| `openai_responses_compaction_request.go` | Response compaction 请求 |
| `openai_image.go` | 图像生成/编辑请求 |
| `openai_video.go` | 视频生成请求 |
| `claude.go` | Claude 专用请求结构 |
| `gemini.go` | Gemini 专用请求结构 |
| `audio.go` | 语音转录/翻译/合成请求 |
| `embedding.go` | Embedding 请求 |
| `rerank.go` | Rerank 请求 |
| `realtime.go` | OpenAI Realtime 请求结构 |
| `midjourney.go` | Midjourney 请求结构 |
| `suno.go` | Suno 请求结构 |
| `video.go` | 视频生成请求结构 |
| `playground.go` | Playground 聊天请求 |

### 10.2 配置 DTO

| 文件 | 说明 |
|------|------|
| `channel_settings.go` | 渠道级别设置（代理 URL、API 版本等） |
| `user_settings.go` | 用户设置（语言、侧边栏、主题、IP 日志） |
| `pricing.go` | 定价展示结构 |
| `values.go` | 值常量和类型 |

### 10.3 其他 DTO

| 文件 | 说明 |
|------|------|
| `error.go` | 标准化错误响应 |
| `notify.go` | 通知结构 |
| `task.go` | 任务结构（视频状态、进度） |
| `ratio_sync.go` | 比例同步结构 |
| `sensitive.go` | 敏感词结构 |

---

## 11. 公共工具 (common/)

### 11.1 核心工具

| 模块 | 职责 |
|------|------|
| `json.go` | JSON marshal/unmarshal wrapper（必须用，禁止直接使用 encoding/json） |
| `crypto.go` | bcrypt 密码哈希、TOTP、HMAC、备份码哈希 |
| `str.go` | 字符串处理、PII 脱敏 (`MaskSensitiveInfo`) |
| `validate.go` | 验证辅助 |
| `env.go` | 环境变量初始化 |
| `init.go` | 全局状态初始化 |
| `constants.go` | 全局常量（用户角色、状态、限速等） |

### 11.2 数据库与缓存

| 模块 | 职责 |
|------|------|
| `database.go` | 数据库类型检测（MySQL/PostgreSQL/SQLite） |
| `redis.go` | Redis 客户端初始化和包装操作 |
| `hash.go` | 缓存哈希生成 |

### 11.3 网络与 HTTP

| 模块 | 职责 |
|------|------|
| `ip.go` | IP 解析、CIDR 匹配 |
| `gin.go` | Gin 上下文辅助（body 存储、JSON 响应） |
| `url_validator.go` | URL 验证 |
| `ssrf_protection.go` | SSRF 防护 |
| `request_body_limit.go` | 请求体大小限制 |

### 11.4 存储

| 模块 | 职责 |
|------|------|
| `body_storage.go` | 请求体存储，内存优先、磁盘溢出 |
| `disk_cache.go` | 磁盘缓存（图像/文件） |
| `disk_cache_config.go` | 磁盘缓存配置 |

### 11.5 限速

| 模块 | 职责 |
|------|------|
| `rate-limit.go` | 内存滑动窗口限速器 |
| `limiter/` | Redis 令牌桶限速器（Lua 脚本） |

### 11.6 监控与性能

| 模块 | 职责 |
|------|------|
| `pyro.go` | Pyroscope 持续分析集成 |
| `pprof.go` | Go pprof HTTP 服务 |
| `system_monitor.go` | 系统资源监控（CPU、内存、goroutine） |
| `performance_config.go` | 性能监控配置 |
| `perf_metrics.go` | 性能指标采集 |
| `sys_log.go` | 系统日志 |
| `custom-event.go` | 自定义事件追踪 |

### 11.7 其他

| 模块 | 职责 |
|------|------|
| `model.go` | 模型辅助函数 |
| `page_info.go` | 分页辅助 |
| `quota.go` | 配额格式化 |
| `topup-ratio.go` | 充值分组比例 |
| `copy.go` | 拷贝工具 |
| `totp.go` | TOTP 实现 |
| `verification.go` | 验证码工具 |
| `endpoint_defaults.go` | API 端点默认 URL 映射 |
| `endpoint_type.go` | 端点类型定义 |
| `audio.go` | 音频 MIME 检测 |
| `gopool.go` | Goroutine 池（bytedance/gopkg） |
| `email.go` | SMTP 邮件发送 |
| `email-outlook-auth.go` | Outlook OAuth2 邮件认证 |
| `api_type.go` | 渠道类型 → API 类型映射 |

---

## 12. OAuth 系统 (oauth/)

### 12.1 提供商接口

```go
type Provider interface {
    GetName() string
    IsEnabled() bool
    ExchangeToken(ctx, code, ginCtx) (*OAuthToken, error)
    GetUserInfo(ctx, token) (*OAuthUser, error)
    IsUserIDTaken(id string) bool
    FillUserByProviderID(user *model.User, id string) bool
    SetProviderUserID(user *model.User, id string)
    GetProviderPrefix() string
}
```

### 12.2 内置 OAuth 提供商

| 提供商 | 文件 | 用户 ID 字段 |
|--------|------|-------------|
| GitHub | `github.go` | `github_id` |
| Discord | `discord.go` | `discord_id` |
| LinuxDO | `linuxdo.go` | `linux_do_id` |
| OIDC | `oidc.go` | `oidc_id` |
| 通用(自定义) | `generic.go` | 可配置 |

### 12.3 自定义 OAuth 提供商
- 存储在 `custom_oauth_providers` 表
- 启动时 `oauth.LoadCustomProviders()` 加载
- 支持任意 OAuth2/OIDC 提供商
- 字段映射：user_id、username、display_name、email
- 访问策略引擎（access_policy JSON）

### 12.4 OAuth 流程
1. `/api/oauth/{provider}?redirect={url}` — 生成 state，构建授权 URL，重定向
2. 用户授权后回调 → 交换 code → 获取用户信息 → 查找或创建用户 → 创建会话 → 重定向回前端

---

## 13. 国际化 (i18n/)

### 13.1 后端
- **库**: `nicksnyder/go-i18n/v2`
- **语言**: zh-CN, zh-TW, en
- **文件格式**: YAML，通过 `//go:embed locales/*.yaml` 嵌入
- **检测顺序**: 用户设置 → DB 懒加载 → Context 语言 → Accept-Language → 默认英文
- **使用**: `i18n.T(c, key, args...)` 或 `common.TranslateMessage(c, key, args...)`

### 13.2 前端 (web/default/src/i18n/)
- **库**: i18next + react-i18next + i18next-browser-languagedetector
- **语言**: en（回退）、zh、fr、ru、ja、vi
- **文件**: `locales/{lang}.json`，扁平 JSON，key 为英文源字符串
- **检测**: localStorage → navigator
- **使用**: `const { t } = useTranslation()`，非 React 场景 `import { t } from 'i18next'`
- **CLI**: `bun run i18n:sync`

---

## 14. 部署与运维

### 14.1 Dockerfile（多阶段）

1. **Stage 1**: `oven/bun:1` 构建 `web/default`
2. **Stage 2**: `oven/bun:1` 构建 `web/classic`（本文档忽略）
3. **Stage 3**: `golang:1.26.1-alpine` 编译 Go 二进制，`GOEXPERIMENT=greenteagc`，嵌入两个前端 dist
4. **Stage 4**: `debian:bookworm-slim` 运行时，含 ca-certificates、tzdata、libasan8、wget

暴露端口 3000，工作目录 `/data`。

### 14.2 docker-compose.yml
- `new-api` 服务：`calciumion/new-api:latest`
- `redis` 服务：带密码认证
- `postgres` 服务：PostgreSQL 15（默认注释掉的 MySQL 8.2 备选）
- 健康检查：`wget -q -O - http://localhost:3000/api/status | grep '"success": true'`
- 网络：`new-api-network`（bridge）

### 14.3 启动序列 (main.go)

```
1. 加载 .env
2. 解析 CLI flags (--port, --log-dir, --version)
3. 初始化环境变量 common.InitEnv()
4. 初始化 logger
5. 初始化比例配置 ratio_setting.InitRatioSettings()
6. 初始化 HTTP 客户端 service.InitHttpClient()
7. 初始化 tokenizer service.InitTokenEncoders()
8. 初始化主数据库 model.InitDB() + 迁移
9. 检查系统初始化 model.CheckSetup()
10. 加载所有设置 model.InitOptionMap()
11. 清理旧缓存文件
12. 初始化定价 model.GetPricing()
13. 初始化日志数据库 model.InitLogDB()
14. 初始化 Redis common.InitRedisClient()
15. 初始化性能指标 perfmetrics.Init()
16. 启动系统监控 common.StartSystemMonitor()
17. 初始化后端 i18n i18n.Init()
18. 加载自定义 OAuth 提供商 oauth.LoadCustomProviders()
19. 启用内存缓存 + 初始化渠道缓存 + 启动同步协程
20. 启动热重载设置同步 + 仪表盘数据更新
21. 自动测试渠道 + 自动更新渠道（如配置）
22. 启动 Codex 凭证刷新 + 订阅额度重置 + 上游模型同步
23. 注册任务适配器工厂
24. 启动 Midjourney 和通用任务轮询（主节点）
25. 初始化批量更新器（如配置）
26. 可选启动 pprof + Pyroscope
27. 配置 Gin：recovery, RequestId, PoweredBy, I18n, Logger, cookie session
28. 可选注入 Umami Analytics / Google Analytics 脚本到 HTML
29. 注册路由 router.SetRouter()
30. 启动 HTTP 服务
```

### 14.4 后台定时任务

| 任务 | 间隔 | 仅主节点 | 说明 |
|------|------|---------|------|
| 渠道缓存同步 | `SYNC_FREQUENCY` 秒 | No | 重建内存渠道索引 |
| 设置热重载 | `SYNC_FREQUENCY` 秒 | No | 从 DB 重新加载设置 |
| 仪表盘数据更新 | 5 分钟 | No | 更新用量分析 |
| 渠道自动测试 | 5 分钟 | No | 测试所有渠道 |
| 渠道自动更新 | `CHANNEL_UPDATE_FREQUENCY` | No | 更新渠道配置 |
| Codex 凭证刷新 | 10 分钟 | No | 刷新 OAuth token |
| 订阅额度重置 | 1 分钟 | Yes | 重置订阅额度，处理过期 |
| 上游模型同步 | 30 分钟 | No | 从上游同步模型 |
| Midjourney 任务更新 | 轮询间隔 | Yes | 轮询 MJ 任务状态 |
| 通用任务更新 | 轮询间隔 | Yes | 轮询异步任务状态 |

---

## 15. 环境变量 (.env.example)

### 15.1 数据库

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SQL_DSN` | 数据库连接串，自动检测类型 | SQLite |
| `LOG_SQL_DSN` | 独立日志数据库 | 同 SQL_DSN |
| `SQLITE_PATH` | SQLite 路径 | `/data/new-api.db` |
| `SQL_MAX_IDLE_CONNS` | 最大空闲连接 | 100 |
| `SQL_MAX_OPEN_CONNS` | 最大打开连接 | 1000 |
| `SQL_MAX_LIFETIME` | 连接生命周期（秒） | 60 |

### 15.2 缓存

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `REDIS_CONN_STRING` | Redis 连接串 | 禁用 |
| `REDIS_POOL_SIZE` | Redis 连接池 | 10 |
| `SYNC_FREQUENCY` | 缓存同步频率（秒） | 60 |
| `MEMORY_CACHE_ENABLED` | 启用内存缓存 | false |
| `BATCH_UPDATE_ENABLED` | 批量更新 | false |
| `BATCH_UPDATE_INTERVAL` | 批量间隔（秒） | 5 |

### 15.3 认证与安全

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SESSION_SECRET` | 会话 Cookie 密钥 | 随机 UUID |
| `CRYPTO_SECRET` | Redis 数据加密密钥 | 同 SESSION_SECRET |
| `GENERATE_DEFAULT_TOKEN` | 自动生成初始 token | false |
| `TLS_INSECURE_SKIP_VERIFY` | 跳过 TLS 验证 | false |
| `TRUSTED_REDIRECT_DOMAINS` | 可信重定向域名 | 空 |

### 15.4 限速

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `GLOBAL_API_RATE_LIMIT_ENABLE` | 启用全局 API 限速 | true |
| `GLOBAL_API_RATE_LIMIT` | API 每窗口最大请求 | 180 |
| `GLOBAL_API_RATE_LIMIT_DURATION` | API 限速窗口（秒） | 180 |
| `GLOBAL_WEB_RATE_LIMIT_ENABLE` | 启用 Web 限速 | true |
| `GLOBAL_WEB_RATE_LIMIT` | Web 每窗口最大请求 | 60 |
| `GLOBAL_WEB_RATE_LIMIT_DURATION` | Web 限速窗口（秒） | 180 |
| `CRITICAL_RATE_LIMIT_ENABLE` | 启用关键操作限速 | true |
| `CRITICAL_RATE_LIMIT` | 关键操作每窗口最大请求 | 20 |
| `CRITICAL_RATE_LIMIT_DURATION` | 关键操作窗口（秒） | 1200 |
| `SEARCH_RATE_LIMIT_ENABLE` | 启用搜索限速 | true |
| `SEARCH_RATE_LIMIT` | 搜索每窗口最大请求 | 10 |
| `SEARCH_RATE_LIMIT_DURATION` | 搜索窗口（秒） | 60 |

### 15.5 Relay 与超时

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `RELAY_TIMEOUT` | 所有请求超时（秒），0=无限制 | 0 |
| `RELAY_IDLE_CONN_TIMEOUT` | HTTP 空闲连接超时（秒） | 90 |
| `RELAY_MAX_IDLE_CONNS` | 最大空闲连接 | 500 |
| `STREAMING_TIMEOUT` | 流式空闲超时（秒） | 300 |
| `STREAM_SCANNER_MAX_BUFFER_MB` | 单行流缓冲区上限（MB） | 128 |
| `MAX_REQUEST_BODY_MB` | 解压后请求体上限（MB） | 128 |
| `ANONYMOUS_REQUEST_BODY_LIMIT_KB` | 匿名请求体上限（KB） | 512 |
| `FORCE_STREAM_OPTION` | 强制 stream_options=usage | true |
| `GEMINI_SAFETY_SETTING` | Gemini 安全过滤 | `BLOCK_NONE` |
| `COHERE_SAFETY_SETTING` | Cohere 安全模式 | `NONE` |
| `AZURE_DEFAULT_API_VERSION` | Azure API 版本 | `2025-04-01-preview` |
| `GEMINI_VISION_MAX_IMAGE_NUM` | Gemini 视觉最大图片数 | 16 |
| `GET_MEDIA_TOKEN` | 统计图片 token | true |
| `GET_MEDIA_TOKEN_NOT_STREAM` | 非流式统计图片 token | false |
| `DIFY_DEBUG` | Dify 调试模式 | true |
| `MAX_FILE_DOWNLOAD_MB` | 最大文件下载（MB） | 64 |

### 15.6 监控

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PYROSCOPE_URL` | Pyroscope 服务器 | 禁用 |
| `PYROSCOPE_APP_NAME` | Pyroscope 应用名 | `new-api` |
| `PYROSCOPE_BASIC_AUTH_USER` | Pyroscope 认证用户 | 空 |
| `PYROSCOPE_BASIC_AUTH_PASSWORD` | Pyroscope 认证密码 | 空 |
| `PYROSCOPE_MUTEX_RATE` | Mutex 采样率 | 5 |
| `PYROSCOPE_BLOCK_RATE` | Block 采样率 | 5 |
| `HOSTNAME` | 主机名标签 | `new-api` |
| `ENABLE_PPROF` | 启用 pprof（端口 8005） | false |
| `ERROR_LOG_ENABLED` | 启用错误日志 | false |

### 15.7 节点与任务

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NODE_TYPE` | `master` 或 `slave` | master |
| `NODE_NAME` | 节点标识（审计日志） | 空 |
| `UPDATE_TASK` | 启用异步任务轮询 | true |
| `TASK_QUERY_LIMIT` | 任务查询上限 | 1000 |
| `TASK_TIMEOUT_MINUTES` | 异步任务超时（分钟） | 1440 |
| `POLLING_INTERVAL` | 任务轮询间隔（秒） | 0 |
| `CHANNEL_UPDATE_FREQUENCY` | 渠道自动更新频率（秒） | 禁用 |
| `NOTIFY_LIMIT_COUNT` | 通知限制次数 | 2 |
| `NOTIFICATION_LIMIT_DURATION_MINUTE` | 通知限制时长（分钟） | 10 |

### 15.8 分析

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `UMAMI_WEBSITE_ID` | Umami 分析站点 ID | 禁用 |
| `UMAMI_SCRIPT_URL` | Umami 脚本 URL | `https://analytics.umami.is/script.js` |
| `GOOGLE_ANALYTICS_ID` | Google Analytics ID | 禁用 |

---

## 16. 角色与权限

| 角色 | 值 | 权限 |
|------|----|------|
| Guest | 0 | 首页、定价、排行榜、关于、登录注册 |
| Common User | 1 | 个人仪表盘、令牌管理、钱包、Playground、个人资料、日志 |
| Operator | 5 | 用户管理、兑换码、充值记录、个人日志管理 |
| Admin | 10 | 渠道管理、模型管理、用户管理（全）、令牌全量管理、系统部分设置 |
| Root | 100 | 所有系统设置、root 专属端点、查看密钥 |

---

## 17. 前端 (web/default/)

### 17.1 目录结构

```
web/default/
├── package.json                  # 依赖与脚本
├── rsbuild.config.ts             # 构建配置
├── src/
│   ├── main.tsx                  # 入口：Router + QueryClient + i18n + Theme + Font + Direction
│   ├── App.tsx                   # 根应用组件
│   ├── routeTree.gen.ts          # TanStack Router 自动生成路由树
│   ├── routes/                   # 文件式路由（路由 = 文件路径）
│   │   ├── __root.tsx            # 根路由：初始化检查、affiliate code、错误页面
│   │   ├── index.tsx             # 首页 /
│   │   ├── (auth)/               # 认证路由组
│   │   │   ├── route.tsx         # 认证布局（居中卡片）
│   │   │   ├── sign-in.tsx       # 登录
│   │   │   ├── sign-up.tsx       # 注册
│   │   │   ├── forgot-password.tsx
│   │   │   ├── otp.tsx           # 2FA 验证
│   │   │   ├── oauth.tsx         # OAuth 回调处理
│   │   │   └── ...
│   │   ├── _authenticated/       # 受保护路由组
│   │   │   ├── route.tsx         # 认证守卫：检查会话，失败重定向 /sign-in
│   │   │   ├── dashboard/        # 仪表盘（概览/模型/用户分析）
│   │   │   ├── channels/         # 渠道管理（admin）
│   │   │   ├── keys/             # API 密钥管理
│   │   │   ├── users/            # 用户管理（admin）
│   │   │   ├── profile/          # 个人资料
│   │   │   ├── wallet/           # 钱包（充值/计费/推荐/订阅）
│   │   │   ├── usage-logs/       # 用量日志（admin）
│   │   │   ├── models/           # 模型元数据（admin）
│   │   │   ├── redemption-codes/ # 兑换码（admin）
│   │   │   ├── subscriptions/    # 订阅计划（admin）
│   │   │   ├── system-settings/  # 系统设置（super_admin），含嵌套子路由
│   │   │   ├── playground/       # AI Playground
│   │   │   ├── chat/             # 第三方聊天预设
│   │   │   └── ...
│   │   ├── pricing/              # 公开定价页
│   │   ├── rankings/             # 公开排行榜
│   │   ├── about/                # 关于
│   │   ├── setup/                # 初始化向导
│   │   └── (errors)/             # 错误页面（401/403/404/500/503）
│   ├── features/                 # 功能模块（按特性组织）
│   │   ├── auth/                 # 认证（登录/注册/2FA/Passkey/OAuth）
│   │   ├── home/                 # 首页
│   │   ├── dashboard/            # 仪表盘（含图表）
│   │   ├── channels/             # 渠道管理
│   │   ├── keys/                 # API 密钥
│   │   ├── users/                # 用户管理
│   │   ├── profile/              # 个人资料
│   │   ├── wallet/               # 钱包
│   │   ├── playground/           # Playground
│   │   ├── usage-logs/           # 用量日志
│   │   ├── models/               # 模型管理
│   │   ├── redemption-codes/     # 兑换码
│   │   ├── subscriptions/        # 订阅
│   │   ├── system-settings/      # 系统设置（8 大子模块）
│   │   ├── rankings/             # 排行榜
│   │   ├── pricing/              # 定价页
│   │   ├── chat/                 # 聊天预设
│   │   ├── setup/                # 初始化向导
│   │   ├── legal/                # 法律文档
│   │   └── errors/               # 错误页面组件
│   ├── components/               # 共享组件
│   │   ├── ui/                   # UI 基元（Button/Dialog/Form/Table 等）
│   │   ├── layout/               # 布局组件（AppHeader/AppSidebar/PublicLayout/AuthLayout/AuthenticatedLayout）
│   │   ├── data-table/           # 可复用表格组件套件
│   │   └── ...                   # CommandMenu/ThemeSwitch/LanguageSwitcher/NotificationPopover 等
│   ├── hooks/                    # 自定义 Hooks
│   ├── stores/                   # Zustand 状态管理
│   │   ├── auth-store.ts         # 用户认证（持久化 localStorage）
│   │   ├── system-config-store.ts # 系统配置（持久化）
│   │   └── notification-store.ts # 通知状态（持久化）
│   ├── lib/                      # 工具库
│   │   ├── api.ts                # Axios 实例（withCredentials, 拦截器, 去重）
│   │   ├── roles.ts              # 角色常量
│   │   ├── utils.ts              # cn()（clsx + tailwind-merge）
│   │   ├── format.ts             # 数字/配额格式化
│   │   ├── currency.ts           # 货币格式化
│   │   ├── time.ts               # 时间格式化
│   │   ├── dayjs.ts              # Day.js 配置
│   │   ├── motion.ts             # Framer Motion 动画变体
│   │   ├── passkey.ts            # WebAuthn 工具
│   │   ├── oauth.ts              # OAuth URL 构建
│   │   └── ...
│   ├── i18n/                     # 国际化
│   │   ├── config.ts             # i18next 配置
│   │   ├── languages.ts          # 语言列表
│   │   ├── static-keys.ts        # 静态 key 注册表
│   │   └── locales/              # 翻译文件
│   │       ├── en.json
│   │       ├── zh.json
│   │       └── ...
│   ├── types/                    # 全局类型
│   └── styles/                   # 全局样式
```

### 17.2 路由结构（TanStack Router 文件式）

**路由约定：**
- `_` 前缀 = 布局路由（不生成 URL segment）
- `(group)` 括号 = 路由组（不生成 URL segment）
- `$param` = 动态参数
- `index.tsx` = 索引路由

**公开路由：**
- `/` — 首页
- `/sign-in` — 登录
- `/sign-up` — 注册
- `/forgot-password` — 忘记密码
- `/otp` — 2FA 验证
- `/oauth` — OAuth 回调
- `/pricing` — 公开定价
- `/pricing/:modelId` — 单个模型定价详情
- `/rankings` — 公开排行榜
- `/about` — 关于
- `/setup` — 系统初始化向导
- `/privacy-policy` — 隐私政策
- `/user-agreement` — 用户协议
- `/401`, `/403`, `/404`, `/500`, `/503` — 错误页

**认证路由（`_authenticated/`）：**
- `/dashboard` — 仪表盘
- `/dashboard/$section` — 仪表盘子视图（models/users）
- `/channels` — 渠道管理（admin）
- `/keys` — API 密钥管理
- `/users` — 用户管理（admin）
- `/profile` — 个人资料
- `/wallet` — 钱包
- `/usage-logs` — 用量日志（admin）
- `/models` — 模型管理（admin）
- `/redemption-codes` — 兑换码（admin）
- `/subscriptions` — 订阅计划（admin）
- `/system-settings` — 系统设置（super_admin），含嵌套子路由
- `/playground` — AI Playground
- `/chat/:chatId` — 第三方聊天预设

**认证守卫 (`_authenticated/route.tsx`):**
- 检查 `useAuthStore` 中的缓存用户，缺失则重定向 `/sign-in`
- 调用 `getSelf()` 验证会话有效性
- 会话失败则清除 store 并重定向

### 17.3 状态管理（Zustand）

**`auth-store.ts`**
- State: `auth.user: AuthUser | null`
- Persistence: localStorage('user')
- Actions: `setUser()`, `reset()`
- User 模型: id, username, display_name, email, role, status, group, quota, used_quota, OAuth IDs, permissions, sidebar_modules

**`system-config-store.ts`**
- State: `config` (SystemConfig: systemName, logo, footerHtml, demoSiteEnabled, displayTokenStatEnabled, currency config), loading, loadedLogoUrl
- Persistence: localStorage('system-config-storage')

**`notification-store.ts`**
- State: lastReadNotice, readAnnouncementKeys[], closedUntilDate
- Persistence: localStorage('notification-storage')
- Actions: markNoticeRead, markAnnouncementsRead, isAnnouncementRead, isNoticeClosed

### 17.4 API 集成模式

**Axios 实例 (`lib/api.ts`)**
- Base URL: 空（同源）
- `withCredentials: true`（Cookie 认证）
- `Cache-Control: no-store`
- **请求去重**: 相同 URL 的并发 GET 自动去重（可通过配置关闭）
- **请求拦截器**: 附加 `New-Api-User` header（来自 localStorage `uid`）
- **响应拦截器**:
  - 业务错误 → toast
  - 401 → 清除 auth，提示"会话已过期"，重定向登录
  - 其他 → toast 服务器消息
- **配置标志**: `skipBusinessError`, `skipErrorHandler`

**React Query (`main.tsx`)**
- Global QueryClient: staleTime 10s, retry 3次（dev 不重试）, 401/403 不重试
- `refetchOnWindowFocus`: prod 启用
- 全局错误: 401 → 清除 auth + 重定向; 500 → 重定向 /500
- Mutation 错误: `handleServerError()`, 304 → "内容未修改"

**Feature API 模式**
每个 feature 有自己的 `api.ts`：
```ts
import { api } from '@/lib/api'
export async function getChannels(params: GetChannelsParams) {
  const res = await api.get<GetChannelsResponse>('/api/channel/', { params })
  return res.data
}
```

### 17.5 核心页面与功能详解

#### 17.5.1 认证 (features/auth/)
**登录方式：**
1. 用户名+密码（可选 Turnstile）
2. 2FA TOTP（登录检测到 `require_2fa` 时重定向 `/otp`）
3. OAuth（GitHub/Discord/OIDC/LinuxDO/Telegram/微信/自定义 OAuth）
4. Passkey/WebAuthn（无密码登录）

**注册：**
- 用户名、密码、可选邮箱
- 如启用邮箱验证 → 发送验证码 → 验证后提交
- 支持推荐码（来自 URL `?aff=` 或 localStorage）
- 可选 Turnstile

**2FA 流程：** 登录 → 检测到 require_2fa → `/otp` → 提交 TOTP → 获得会话
**OAuth 流程:** 点击提供商 → `getOAuthState()` → 构建授权 URL → 重定向 → 回调 → 设置会话

#### 17.5.2 仪表盘 (features/dashboard/)
三个 Tab：
1. **概览**: 欢迎消息（普通用户）
2. **模型调用分析 (`models`)**: LogStatCards 摘要（请求数、token、配额）、PerformanceOverview（admin）、ConsumptionDistributionChart（VChart 饼图）、ModelCharts（VChart 时间序列）、ModelsFilter（日期范围/粒度/模型）、ModelsChartPreferences（图表类型持久化）
3. **用户分析 (`users`)**: 用户用量图表（admin only）

状态: React Query + localStorage 持久化偏好

#### 17.5.3 渠道管理 (features/channels/) — ADMIN
- Provider 模式：`ChannelsProvider` → `ChannelsTable` (TanStack Table) → `ChannelsDialogs` (create/update/test/delete/copy/multi-key)
- 渠道字段: type, key, base_url, models, group, weight, priority, status, balance, response_time, model_mapping, status_code_mapping, tag, param_override, header_override, auto_ban
- **多密钥支持**: random/polling 模式，每 key 独立状态，批量增删启用禁用
- **测试渠道**: 指定测试模型，记录响应时间
- **标签操作**: 按标签批量启用/禁用/编辑

#### 17.5.4 API 密钥 (features/keys/)
- Key model: name, key(脱敏), status, remain_quota, used_quota, unlimited_quota, expired_time, group, model_limits_enabled, model_limits, allow_ips, cross_group_retry
- 流程: 创建 → 设置额度/到期 → 复制 key → 应用中使用
- 批量操作、CC-switch（cross_group_retry）

#### 17.5.5 用户管理 (features/users/) — ADMIN
- 操作: 创建/更新/删除/升降级/启用禁用/额度调整（加/减/覆盖）/搜索
- 批量删除、批量调整额度
- TanStack Table + 列可见性 + 排序 + 面片过滤

#### 17.5.6 个人资料 (features/profile/)
- ProfileHeader: 头像、显示名、邮箱、组、统计
- ProfileSettingsCard: 修改显示名、改密码（需原密码验证）
- LanguagePreferencesCard: 语言偏好
- ProfileSecurityCard: 查看/修改邮箱、OAuth 绑定
- PasskeyCard: 注册/管理 WebAuthn
- TwoFACard: 启用/禁用 TOTP、查看备份码、重新生成
- CheckinCalendarCard: 每日签到日历
- SidebarModulesCard: 自定义侧边栏模块可见性

#### 17.5.7 钱包 (features/wallet/)
- WalletStatsCard: 当前余额、已用额度、请求数
- RechargeFormCard: 充值表单（预设金额 + 自定义金额 + 支付方式选择）
- PaymentConfirmDialog: 支付前确认
- BillingHistoryDialog: 历史充值记录
- TransferDialog: 推荐奖励转入主余额
- AffiliateRewardsCard: 推荐链接、邀请统计、待领取奖励
- SubscriptionPlansCard: 查看/购买订阅计划
- 支付方式: Stripe, EPay, Creem, Waffo, Waffo Pancake, 自定义充值链接, 兑换码

#### 17.5.8 Playground (features/playground/)
- 聊天界面+消息历史
- 模型选择器（从用户可用模型）
- 分组选择器
- 参数控制: temperature, top_p, max_tokens, frequency_penalty, presence_penalty, seed
- 流式支持（SSE）
- 消息编辑/重新生成/删除/复制
- Reasoning content 显示
- Source attribution 显示

#### 17.5.9 用量日志 (features/usage-logs/) — ADMIN
三个分类: common(普通), drawing(绘图), task(任务)
- TanStack Table + 排序/过滤/分页
- UserInfoDialog: 查看日志条目关联的用户详情
- CacheStatsDialog: 渠道亲和缓存统计
- 移动端: Card 列表

#### 17.5.10 模型管理 (features/models/) — ADMIN
- 模型目录: 厂商、描述、图标、标签、端点
- 子视图: metadata（浏览/编辑模型+厂商）、deployments（io.net GPU 部署）
- 厂商管理: 创建/更新，可上传图标
- 预填充组: 批量操作的模型/标签/端点组
- 上游同步: 从官方源同步模型（差异预览+冲突处理）
- 名称规则: exact/prefix/contains/suffix

#### 17.5.11 兑换码 (features/redemption-codes/) — ADMIN
- 创建（名称、额度、到期）、批量创建（count 参数）
- 状态: 启用/禁用/已使用
- 追踪哪个用户使用了哪个码

#### 17.5.12 订阅计划 (features/subscriptions/) — ADMIN
- 套餐: 标题、价格、货币、时长（年/月/日/时/自定义）、额度重置周期、最大购买次数、用户组升级
- 支付集成: Stripe price ID, Creem product ID, Waffo Pancake product ID
- 启用/禁用切换
- 用户订阅记录查看

#### 17.5.13 系统设置 (features/system-settings/) — SUPER_ADMIN ONLY
8 大子模块，每个含嵌套路由：

**A. 认证设置 (`auth/`)**
- 密码登录开关、注册控制（启用/仅密码/域名白名单/邮箱别名限制）、邮箱验证开关
- OAuth 提供商开关: GitHub, Discord, OIDC, Telegram, LinuxDO, 微信
- 自定义 OAuth 提供商 CRUD
- Turnstile 配置
- Passkey 配置（RP 名称/ID/源/验证要求/附件类型）

**B. 站点设置 (`site/`)**
- 主题、Logo、系统名称、footer HTML、关于页内容、首页内容（Markdown 或 URL）、服务器地址
- 法律文档（用户协议、隐私政策）
- 导航模块可见性、侧边栏模块可见性

**C. 计费设置 (`billing/`)**
- 新用户额度、预消费额度、推荐奖励
- 充值链接、文档链接、免费模型预消费开关
- 每单位配额、美元汇率、货币显示类型、token 统计显示开关
- 模型定价（比例/阶梯表达式）
- 支付集成：EPay、Stripe、Creem、Waffo、Waffo Pancake
- 充值金额选项、折扣规则、签到设置

**D. 内容设置 (`content/`)**
- 控制台：API 信息、公告、FAQ、Uptime Kuma 状态（每个可开关）
- 聊天预设配置
- MJ 代理设置
- 数据导出

**E. 模型设置 (`models/`)**
- 全局透传请求开关、thinking 模型黑名单
- Chat Completions → Responses 转换策略
- Ping 间隔
- Gemini/Claude/Grok 专用配置
- 模型定价编辑器（每模型比例）、分组倍率编辑器
- 用户可用组配置、自动组配置
- 渠道亲和设置（规则/TTL/最大条目）
- 上游比例同步

**F. 运营设置 (`operations/`)**
- 重试次数、默认侧边栏折叠、演示站点模式、自用模式
- 渠道禁用阈值、配额提醒阈值、自动禁用/启用
- 禁用关键字和状态码、自动重试状态码
- 监控轮询间隔、SMTP 设置、Worker URL/Key
- 计费日志开关、性能: 磁盘缓存/监控阈值

**G. 安全设置 (`security/`)**
- 模型请求限速（次数/时长/成功数/目标组）
- 敏感内容检查（提示词级、关键字列表）
- SSRF 防护（启用、私网 IP 白名单、域名/IP 过滤、端口白名单）

**H. 请求限制 (`request-limits/`)**
- 限速配置可视化编辑器
- 敏感词管理
- SSRF 防护设置

**UI 模式**: Accordion/手风琴分组 → SettingsCard → FormDirtyIndicator + FormNavigationGuard（未保存离开警告）+ 复杂设置的 JSON 编辑器

#### 17.5.14 排行榜 (features/rankings/) — PUBLIC
- 周期选择: 今日/本周/本月/本年/全部
- ModelsSection: 模型排名（token 份额、增长率、排名变化）
- MarketShareSection: 厂商市场份额（VChart 面积图）
- PulseSection: 涨跌榜（排名变化）

#### 17.5.15 定价页 (features/pricing/) — PUBLIC
- 按厂商过滤模型列表
- 每模型定价: input/output/cache/image/audio 费率
- Token 单位（M=百万, K=千）
- 能力展示: function calling, streaming, vision, JSON mode, reasoning 等
- 模态: text, image, audio, video, file
- 分组定价覆盖
- 上下文长度、最大输出、知识截止

#### 17.5.16 聊天预设 (features/chat/)
- 管理员配置第三方聊天客户端预设（Cherry Studio, AionUI, DeepChat 等）
- 自动生成 API key 用于聊天链接
- URL 模板占位符: `{key}`, `{address}`, `{cherryConfig}`, `{aionuiConfig}`, `{deepchatConfig}`
- Base64 编码配置
- 侧边栏 ChatPresetsItem 快速访问

#### 17.5.17 初始化向导 (features/setup/)
4 步向导:
1. 数据库检查（SQLite/MySQL/PostgreSQL）
2. 管理员账户创建
3. 使用模式选择: external（多用户）/ self-use（个人）/ demo（演示站）
4. 确认并提交

### 17.6 布局系统

**AuthenticatedLayout**
- SidebarProvider → AppHeader（顶栏）→ AppSidebar（左侧边栏）→ SidebarInset（内容区 + AnimatedOutlet）
- 可折叠侧边栏，响应式
- Drill-in 模式: 点击 System Settings 后侧边栏切换为上下文工作区，含 "← Back to Dashboard"

**PublicLayout**
- PublicHeader: Logo、导航链接、认证按钮、主题切换、语言切换、通知
- 主容器含 padding

**AuthLayout**
- 居中卡片 + 系统 Logo/名称（左上）
- 响应式（移动优先 `sm:` 断点）

**SectionPageLayout（复合组件）**
```tsx
<SectionPageLayout>
  <SectionPageLayout.Title>标题</SectionPageLayout.Title>
  <SectionPageLayout.Actions>
    <PrimaryButtons />
  </SectionPageLayout.Actions>
  <SectionPageLayout.Content>
    <DataTable />
  </SectionPageLayout.Content>
</SectionPageLayout>
```

### 17.7 组件体系

**UI 基元 (`components/ui/`)**
基于 Base UI + Tailwind:
Alert, AlertDialog, Badge, Button, ButtonGroup, Card, Checkbox, Command, ContextMenu, Dialog, DropdownMenu, Form, HoverCard, Input, InputOTP, Kbd, Label, Menubar, NativeSelect, Progress, Resizable, ScrollArea, Select, Sheet, Sidebar, Skeleton, Sonner, Switch, Table, Tabs, Textarea, TitledCard, Toggle

**数据表格 (`components/data-table/`)**
DataTablePage, DataTablePagination, DataTableColumnHeader, DataTableFacetedFilter, DataTableViewOptions, DataTableToolbar, DataTableBulkActions, TableSkeleton, TableEmpty, MobileCardList

**布局 (`components/layout/`)**
AppHeader, AppSidebar, SidebarViewHeader, NavGroup, TopNav, PublicHeader, PublicNavigation, AuthenticatedLayout, SectionPageLayout, PageFooter, MobileDrawer, HeaderLogo, SystemBrand

**应用组件**
CommandMenu（⌘K 搜索/导航）、LanguageSwitcher、ThemeSwitch、NotificationPopover、ProfileDropdown、PasswordInput、CopyButton、ConfirmDialog、JsonEditor、TagInput、MultiSelect、ModelGroupSelector、DatePicker、StatusBadge、NavigationProgress、RiskAcknowledgementDialog、SignOutDialog、SkipToMain、AutoSkeleton、AnimateInView、TruncatedText

### 17.8 自定义 Hooks

| Hook | 职责 |
|------|------|
| `useSystemConfig` | 获取/缓存系统配置，自动加载，预加载 Logo |
| `useStatus` | 获取/缓存系统状态，5min stale, 30min GC |
| `useAdmin` | 检查当前用户是否 admin（role >= ADMIN） |
| `useNotifications` | 管理通知和公告，未读计数 |
| `useSidebarData` | 根据角色/权限构建侧边栏导航组 |
| `useSidebarConfig` | 根据系统设置过滤可见导航项 |
| `useSidebarView` | 根据当前 URL 决定侧边栏视图（drill-in） |
| `useMediaQuery` / `useMobile` | 响应式检测 |
| `useCopyToClipboard` | 复制到剪贴板 |
| `useDebounce` | 值防抖 |
| `useCountdown` | 倒计时（邮箱验证重发） |
| `useDialog` | 受控弹窗状态 |
| `useTableUrlState` | 表格状态同步到 URL search params |
| `useTableCompactMode` | 紧凑表格模式切换 |
| `useHiddenClickUnlock` | 隐藏点击解锁（显示 API key） |
| `useMinimumLoadingTime` | 最小加载时间保证 |
| `useTopNavLinks` | 构建顶部导航链接 |
| `useUserDisplay` | 格式化用户显示名/回退 |
| `useChartTheme` | 将当前主题应用到 VChart |

### 17.9 关键用户流程

**认证流程：**
1. 访问 `/sign-in` → 登录表单 + OAuth 按钮
2. 可选 Turnstile
3. 提交 → `POST /api/user/login`
4. 如需要 2FA → 重定向 `/otp` → 提交 TOTP → `POST /api/user/login/2fa`
5. 成功 → auth store 持久化用户到 localStorage → 重定向 `/` 或原 URL
6. 后续访问: localStorage 恢复用户 → `_authenticated` guard 调用 `getSelf()` 验证

**充值流程：**
1. `/wallet` → WalletStatsCard 显示余额
2. 选择预设金额或输入自定义金额
3. 选择支付方式（Stripe/EPay/Creem/Waffo/Pancake）
4. 点击支付 → PaymentConfirmDialog → 重定向支付网关
5. 成功返回 → 余额更新，账单历史显示新记录
6. 替代方案: 输入兑换码 → 立即兑换

**管理员渠道管理流程：**
1. `/channels` → 表格展示所有上游渠道
2. 创建渠道 → drawer 打开: 类型、名称、base_url、key、models
3. 测试渠道 → 选择测试模型 → 查看响应时间
4. 故障自动禁用 → 状态显示（绿/红）
5. 多密钥管理 → 增删子 key
6. 标签管理 → 批量操作

**管理员系统设置流程：**
1. SUPER_ADMIN 访问 `/system-settings` → accordion 分组
2. 点击分组（如 Auth）→ 显示子设置项
3. 编辑 → 字段激活 → 保存触发 `PUT /api/option/`
4. FormDirtyIndicator 显示未保存变更
5. 复杂设置（模型定价）有专用可视化编辑器

---

## 18. 计费表达式系统

**文档**: `pkg/billingexpr/expr.md`

**设计哲学**: 用人类可读的表达式替代复杂的阶梯定价逻辑

**变量**: `p`(prompt), `c`(completion), `len`(输入长度), `cr`(cache read), `cc`(cache creation), `img`(image), `img_o`(image origin), `ai`(audio input), `ao`(audio output)

**函数**:
- `min(x,y)`, `max(x,y)`, `floor(x)`, `ceil(x)`
- `tier(N1:rate1, N2:rate2, ...)`: 阶梯比例（如 `tier(100:0, 3900:1.5, 22000:2)`）
- `tierc(N1:cost1, ...)`: 阶梯固定费用

**Token 规范化**: 当表达式引用 cache/image/audio 子分类时，这些 token 自动从 p/c 中排除，避免重复计费

**版本控制**: 表达式变更通过 hash 追踪版本

**使用位置**: `setting/billing_setting/tiered_billing.go` 存储表达式，`service/tiered_settle.go` 执行结算

---

## 19. 关键实现细节与约束

### 19.1 JSON 使用约束（强制）
- **禁止**在业务代码中直接 import `encoding/json` 进行 marshal/unmarshal
- **必须**使用 `common/json.go` 中的 wrapper:
  - `common.Marshal(v)`
  - `common.Unmarshal(data, v)`
  - `common.UnmarshalJsonStr(data, v)`
  - `common.DecodeJson(reader, v)`
  - `common.GetJsonType(data)`
- 例外: `json.RawMessage`, `json.Number` 等类型定义仍可从 `encoding/json` import

### 19.2 数据库兼容性（强制）
- 必须同时兼容 SQLite、MySQL >= 5.7.8、PostgreSQL >= 9.6
- 优先使用 GORM 方法（Create/Find/Where/Updates），避免原生 SQL
- 原生 SQL 必须分支处理:
  - 列引用: PG `"col"`, MySQL/SQLite `` `col` ``，使用 `commonGroupCol`/`commonKeyCol`
  - 布尔值: PG `true/false`, MySQL/SQLite `1/0`，使用 `commonTrueVal`/`commonFalseVal`
  - 分支标志: `common.UsingPostgreSQL`, `common.UsingSQLite`, `common.UsingMySQL`
- **禁止**: MySQL-only GROUP_CONCAT（无 PG 等效）、PG-only JSONB 操作符、SQLite ALTER COLUMN（用 ADD COLUMN 替代）
- 迁移: 所有迁移必须跨 DB 工作；SQLite 用 `PRAGMA` 检查列存在性后用 `ALTER TABLE ... ADD COLUMN`

### 19.3 Relay 请求 DTO 显式零值（强制）
- 请求结构体的可选标量字段 **必须** 使用指针类型 + `omitempty`（如 `*int`, `*float64`, `*bool`）
- 语义: JSON 中缺失 → `nil` → marshal 省略；显式设为 0/false → 非 nil 指针 → 必须发送到上游
- 禁止：非指针标量 + `omitempty`（会导致 0/false 被静默丢弃）

### 19.4 Channel StreamOptions 支持
- 实现新渠道时，确认提供商是否支持 `StreamOptions`
- 如支持，将渠道加入 `streamSupportedChannels`

### 19.5 前端 i18n 约束
- 所有面向用户的文案必须使用 `useTranslation()` 的 `t()` 进行翻译
- React 组件内使用 `const { t } = useTranslation()`
- 非 React 环境使用 `import { t } from 'i18next'`（不响应语言切换）
- 常量中的成功/错误/提示消息仅存储 i18n key，展示时必须通过 `t()` 翻译
- 同一 feature 内只采用一种 label 翻译方式，避免混用

### 19.6 前端代码风格约束
- 禁止 2 层及以上嵌套三元表达式
- 组件 props 非必要不解构，使用 `props.xxx`
- 避免 `any`，优先具体类型或 `unknown`
- 改动 TS/TSX 后必须执行 `bun run typecheck` 并修复至无错误
- 单文件超过约 200 行时考虑拆分

### 19.7 保护性规则
- 严禁修改或删除与项目身份相关的任何信息（项目名称、组织名称、版权、模块路径等）
- 所有此类信息在任何情况下都不可变更

---

## 20. 数据库迁移策略

**文件**: `model/main.go`

- 使用 GORM `AutoMigrate`，并发执行（goroutine 并行）
- 仅在主节点运行（`IsMasterNode`）

**迁移的表（26+）:**
Channel, Token, User, PasskeyCredential, Option, Redemption, Ability, Log, Midjourney, TopUp, QuotaData, Task, Model, Vendor, PrefillGroup, Setup, TwoFA, TwoFABackupCode, Checkin, SubscriptionOrder, UserSubscription, SubscriptionPreConsumeRecord, CustomOAuthProvider, UserOAuthBinding, PerfMetric, SubscriptionPlan

**数据迁移:**
- `migrateSubscriptionPlanPriceAmount()`: float → decimal(10,6)（仅 MySQL/PostgreSQL）
- `migrateTokenModelLimitsToText()`: varchar(1024) → text
- SQLite: `ensureSubscriptionPlanTableSQLite()` 使用 `PRAGMA` 检查列后用 `ALTER TABLE ADD COLUMN`

---

## 21. 文件上传/处理

**Body Storage (`common/body_storage.go`)**
- 内存优先、磁盘溢出的请求体存储
- `BodyStorage` 接口: ReadSeeker, Closer, Bytes(), Size(), IsDisk()
- 内存阈值以上溢出到磁盘
- `GetBodyStorage(c)` 供中间件使用

**File Service (`service/file_service.go`)**
- 图像/音频/视频文件上传/下载
- 多文件源支持（本地、URL 代理）
- SSRF 防护 (`common/ssrf_protection.go`)

**文件权限**
- `FileUploadPermission`, `FileDownloadPermission`, `ImageUploadPermission`, `ImageDownloadPermission`
- 默认 `RoleGuestUser(0)` — 认证用户可访问

**图像代理**
- `controller/video_proxy.go`, `video_proxy_gemini.go`
- `controller/image.go` — Gemini 视觉图像处理

---

## 22. 监控与告警

**渠道状态变更 Webhook**
- 配置 webhook URL + HMAC-SHA256 签名
- 渠道启用/禁用/自动封禁时通知 root 用户
- 限速通知

**系统监控**
- CPU、内存、goroutine 数量监控
- 磁盘缓存监控
- 性能指标百分位数、请求计数器
- 可选 Pyroscope 持续分析 + pprof

---

## 23. 附录：关键常量速查

### 23.1 用户角色
```
RoleGuestUser    = 0
RoleCommonUser   = 1
RoleOperatorAdmin = 5
RoleAdminUser    = 10
RoleRootUser     = 100
```

### 23.2 令牌状态
```
TokenStatusEnabled   = 1
TokenStatusDisabled  = 2
TokenStatusExpired   = 3
TokenStatusExhausted = 4
```

### 23.3 渠道状态
```
ChannelStatusEnabled        = 1
ChannelStatusAutoDisabled   = 2
ChannelStatusManualDisabled = 3
```

### 23.4 日志类型
```
LogTypeUnknown = 0
LogTypeTopup   = 1
LogTypeConsume = 2
LogTypeManage  = 3
LogTypeSystem  = 4
LogTypeError   = 5
LogTypeRefund  = 6
```

### 23.5 限额换算
```
QuotaPerUnit = 500000  # 点数
# $0.002 / 1K tokens 对应 QuotaPerUnit
```

---

## 24. 总结

本系统是一个**生产级的 AI API 网关**，核心能力包括：

1. **统一代理**: 将 57 种上游 AI 提供商聚合为 OpenAI 兼容 API
2. **智能路由**: 加权随机、优先级、亲和性、多密钥、模型映射、跨组重试
3. **多租户计费**: 比例定价、固定价格、阶梯表达式，支持订阅和钱包双模式
4. **完善管理**: Web UI 管理渠道、用户、模型、令牌、兑换码、订阅、系统配置
5. **多渠道认证**: 密码、2FA TOTP、WebAuthn/Passkey、6 种 OAuth、自定义 OAuth
6. **高可用缓存**: Redis + 内存双缓存，批量更新降低 DB 压力
7. **灵活限速**: 6 层全局限速 + 模型级限速 + 分组限速
8. **任务系统**: Midjourney、Suno、视频生成等异步任务轮询
9. **全平台数据库**: SQLite（零配置默认）、MySQL、PostgreSQL
10. **容器化部署**: 单二进制 + Docker Compose，支持主从节点
