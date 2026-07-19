# 功能地图

本文按业务领域列出当前实现的主要能力及代码入口。它用于定位功能，不替代接口字段文档。

## 对外入口

| 入口 | 作用 | 路由定义 |
| --- | --- | --- |
| `/api/*` | 控制台与管理 API | `router/api-router.go` |
| `/v1/*` | OpenAI 兼容接口、Responses、Realtime、音频、图像、视频等 | `router/relay-router.go`、`router/video-router.go` |
| `/v1/messages` | Claude Messages 兼容接口 | `router/relay-router.go` |
| `/v1beta/*` | Gemini 原生及兼容接口 | `router/relay-router.go` |
| `/mj/*`、`/suno/*`、`/kling/v1/*`、`/jimeng/*` | 异步生成任务和供应商兼容入口 | `router/relay-router.go`、`router/video-router.go` |
| `/dashboard/billing/*` | OpenAI Dashboard 兼容的用量查询 | `router/dashboard.go` |
| 其他 Web 路径 | 内嵌默认/经典前端或跳转到独立前端 | `router/web-router.go`、`router/main.go` |

## 业务能力

| 领域 | 已实现能力 | 主要后端入口 | 默认前端入口 |
| --- | --- | --- | --- |
| 初始化 | 首次安装状态检查、初始化向导、根用户创建 | `controller/setup.go`、`model/setup.go` | `features/setup/` |
| 登录与身份 | Session 登录、管理访问令牌、Passkey、2FA、邮箱验证、OAuth 与自定义 OIDC/OAuth | `controller/user.go`、`controller/passkey.go`、`controller/twofa.go`、`controller/oauth.go`、`oauth/` | `features/auth/`、`features/profile/` |
| 用户与权限 | 普通用户、管理员、根用户三级权限；用户状态、分组、额度、邀请关系和侧边栏权限 | `middleware/auth.go`、`controller/user.go`、`model/user.go` | `features/users/`、`features/profile/` |
| API 令牌 | 创建、编辑、删除、批量读取；有效期、额度、模型、分组、IP 与指定渠道限制 | `controller/token.go`、`model/token.go`、`middleware/auth.go` | `features/keys/` |
| 渠道 | 多供应商渠道、模型映射、分组、优先级、权重、多 Key、状态码映射、参数/请求头覆盖、可配置默认测试端点、自动禁用与余额测试 | `controller/channel.go`、`model/channel.go`、`model/ability.go` | `features/channels/` |
| 模型与供应商元数据 | 模型目录、供应商元数据、缺失模型检测、上游模型同步、定价展示 | `controller/model_meta.go`、`controller/vendor_meta.go`、`controller/model_sync.go`、`model/model_meta.go` | `features/models/`、`features/pricing/` |
| 模型部署 | io.net 连接配置、硬件/地域查询、价格预估、创建、查看、更新、延期和删除部署 | `controller/deployment.go`、`pkg/ionet/` | `features/models/` |
| 同步转发 | Chat Completions、Completions、Responses、Responses Compact、Embeddings、Rerank、Moderations、图像、音频、Realtime | `controller/relay.go`、`relay/` | `features/playground/`、`features/chat/` |
| 异步任务 | Midjourney、Suno、视频及其他任务型供应商的提交、查询、轮询和完成态结算 | `controller/task.go`、`controller/midjourney.go`、`service/task_polling.go`、`relay/channel/task/` | `features/usage-logs/` |
| 智能路由 | 按分组/模型筛选渠道，结合优先级与权重选择；渠道亲和、自动分组、跨组重试和失败重试 | `middleware/distributor.go`、`service/channel_select.go`、`service/channel_affinity.go` | 渠道和系统设置页面 |
| 计费 | 模型倍率、固定价格、动态表达式计费、预扣、实际用量结算、失败退款和违规费用 | `relay/helper/price.go`、`service/billing_session.go`、`service/quota.go`、`pkg/billingexpr/` | 定价、钱包、日志和系统计费设置 |
| 钱包与充值 | 余额、兑换码、充值订单、邀请额度转移及多支付渠道 | `controller/topup*.go`、`controller/redemption.go`、`model/topup.go` | `features/wallet/`、`features/redemption-codes/` |
| 订阅 | 订阅计划、用户订阅、周期额度重置、余额/支付渠道购买及资金来源偏好 | `controller/subscription*.go`、`service/subscription_reset_task.go`、`model/subscription.go` | `features/subscriptions/`、`features/wallet/` |
| 日志与统计 | 请求日志、任务日志、用户/管理员统计、排行榜、渠道亲和统计和用量聚合 | `controller/log.go`、`controller/usedata.go`、`controller/rankings.go`、`model/log.go` | `features/usage-logs/`、`features/dashboard/`、`features/rankings/` |
| 系统配置 | 站点、鉴权、运营、模型、计费、内容、支付和主题配置；数据库 Option 热更新 | `controller/option.go`、`setting/`、`model/option.go` | `features/system-settings/` |
| 运维 | 健康状态、性能指标、日志文件、GC、磁盘缓存、渠道自动测试、凭证刷新和上游模型更新 | `controller/performance.go`、`controller/perf_metrics.go`、`main.go` | 性能与系统设置页面 |
| 国际化与主题 | 后端中英文消息；默认前端多语言、明暗主题和布局配置；经典前端兼容 | `i18n/`、`setting/system_setting/` | `web/default/src/i18n/`、`web/default/src/context/` |

## 供应商适配范围

渠道类型定义在 `constant/channel.go`，同步请求适配器注册在 `relay/relay_adaptor.go`，任务适配器位于 `relay/channel/task/`。部分 OpenAI 兼容渠道复用 OpenAI 适配器，不一定拥有独立目录。

不要仅根据目录数量判断支持范围。确认某个供应商能力时，应同时检查：

1. `constant/channel.go` 中是否存在渠道类型。
2. 渠道类型如何映射到 `constant/api_type.go`。
3. `relay/relay_adaptor.go` 是否注册同步或任务适配器。
4. 对应路由是否暴露该请求格式。
