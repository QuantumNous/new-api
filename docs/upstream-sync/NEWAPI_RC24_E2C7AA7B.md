# NewAPI rc.24 至 e2c7aa7b 同步台账

## 同步边界

- Ren2Hub 基线：`main@0919f100`
- NewAPI 目标：`upstream/main@e2c7aa7b`
- 共同祖先：`v1.0.0-rc.23`
- 本地集成分支：`codex/upstream-sync-integration`
- 同步方式：8 个批次分支依次堆叠，每批验证后使用 `--no-ff` 合并。
- 行为边界：保留双前端、自动定价、`-openai-compact`、认证管理扩展、`passive_recovery` 和 Ren2Hub 项目标识。
- 发布边界：不更新 `main`、任何远端、外层子模块指针或生产环境。

状态说明：`applied` 表示上游补丁等价应用；`adapted` 表示为 Ren2Hub 冲突或额外契约做了改写；`skipped` 表示有意不引入。

## 逐提交记录

| # | 上游 SHA | 状态 | 本地提交 | 冲突决定 | 验证 |
|---:|---|---|---|---|---|
| 1 | `d6b5ce99` | applied | `3ae9a96c` | 原样引入请求重放和禁止 3xx 自动跟随；与下一提交作为不可拆批次。 | B1 Go 定向测试通过。 |
| 2 | `ea4f0210` | applied | `e2b50c2b` | 采用最终正文自描述结构，保留 Header Override、transport 日志和 SSE 生命周期。 | B1 Go 定向测试通过。 |
| 3 | `0cd9dc85` | applied | `a2a21cf4` | 原子更新敏感用户字段，保留 AuthVersion 和会话撤销。 | B2 Go 定向测试通过。 |
| 4 | `c9bc0386` | applied | `5d13f57b` | 扩展模型分类，保留 Ren2Hub 重定向分类规则。 | B2 React build 通过。 |
| 5 | `b941253a` | applied | `586aa38e` | Claude/Gemini 渠道测试改用原生 DTO。 | B2 controller 测试通过。 |
| 6 | `1da23d6b` | adapted | `b158d1cd`、`71a7662b` | 在上游限流基础上，让 React/Vue 邀请转移共用 `aff-transfer` 用户限流。 | B2 Go 测试通过。 |
| 7 | `e926e5ca` | applied | `26994726` | 保留服务端原始 quota，避免 React 表单精度损失。 | B2 兑换码 6 项测试通过。 |
| 8 | `5c3abffe` | skipped | - | 仅影响 GitCode 发布同步，不属于 Ren2Hub 应用同步范围。 | 已确认无应用代码依赖。 |
| 9 | `2399de97` | applied | `4b2ae018` | 未提供 `top_p` 时不向阿里请求注入默认值。 | B3 Ali 测试通过。 |
| 10 | `823e2630` | applied | `668c9ae0` | 将 Qwen TTS 归入 Qwen，同时保留 OpenAI `tts-*` 边界。 | B3 分类测试通过。 |
| 11 | `5d3423be` | applied | `daeda264` | 新增 `auto_ban_only`，保留 `scheduled_all` 和 `passive_recovery` 语义。 | B3 controller/settings 测试通过。 |
| 12 | `7dd1000a` | applied | `0efc6dc4` | 复用既有防抖基础设施，不增加第二套状态源。 | B3 React build 通过。 |
| 13 | `eab18a83` | applied | `6e63309d` | 统一记录最终 reasoning effort，保留重试上下文。 | B3 relay 测试通过。 |
| 14 | `85feb7a3` | applied | `6ab5d456` | 参数覆盖上下文加入用户和分组字段。 | B3 relay 测试通过。 |
| 15 | `8ad159a3` | applied | `218aa842` | 保留 Ollama reasoning、tool call ID 和 schema。 | B4 Ollama 测试通过。 |
| 16 | `d49160f0` | applied | `5de1930a` | 后端长度改为 UTF-16 code unit，与前端一致。 | B4 controller 测试通过。 |
| 17 | `4cf9107f` | applied | `9d00c434` | 仅记录 BillingExpr 命中规则，不改变结算数值。 | B4 BillingExpr 测试通过。 |
| 18 | `9c97e78a` | applied | `cba7a01e` | token 轮换增加确认，仅显示一次并在关闭后清除。 | B4 React build 通过。 |
| 19 | `253a74dd` | applied | `3c4121fd` | Responses 双向转换保留显式零和 penalties；Codex 仍显式过滤。 | B4 relaykit test/build 通过。 |
| 20 | `bb234ff4` | skipped | - | 保留 `-openai-compact`、通配价格和自动定价，不采用删除补丁。 | 编译引用和配置路径已复核。 |
| 21 | `4eaeefbd` | applied | `d7fa4900` | 移植 React 移动侧栏点击修复。 | B5 React 鉴权测试/build 通过。 |
| 22 | `ffeb1b24` | applied | `6ad8fd28` | 每次登录尝试后刷新 Turnstile token。 | B5 React 鉴权测试通过。 |
| 23 | `3d5dc36f` | applied | `adf1059a` | Gemini `/v1/models` 支持 query/header API key。 | B5 router 测试通过。 |
| 24 | `d7992672` | adapted | `d489d961` | OAuth/微信只更新白名单绑定列；补测 AuthVersion 不被陈旧快照覆盖。 | B5 model/controller/oauth 测试通过。 |
| 25 | `50e5377e` | adapted | `db1ace08` | Epay 改为事务内结算；保留共享订单入口、webhook 开关和审计日志，失败返回 `fail`。 | B6 SQLite/miniredis 及 Go 全包测试通过。 |
| 26 | `ccd535ef` | applied | `5ff13971` | 引入原子预扣、Redis 守卫、mutation fence、渠道字段级更新和订阅行锁。 | B6 model 并发测试通过。 |
| 27 | `58d4e9bd` | applied | `56c3f250` | 退款回减用户/渠道用量；Legacy Midjourney 持久化 token/计费渠道并拒绝订阅计费。 | B6 service 退款测试通过。 |
| 28 | `15cfdedd` | applied | `420863ad` | 拉取模型对话框始终使用当前表单选择。 | B6 React build 通过。 |
| 29 | `93d2df85` | applied | `4e513117` | 阿里图片协议判断改用映射后的上游模型名。 | B7 Ali 测试通过。 |
| 30 | `62605807` | adapted | `565e9990` | 与 32、35、36 合并为一个 npm 锁单元。 | B7 `npm ci`、依赖树和 Electron 构建通过。 |
| 31 | `f250f3b5` | adapted | `ce3c260d` | DOMPurify manifest 与 Bun 锁同时更新，锁由 Bun 1.3.14 生成。 | B7 frozen install/build 通过。 |
| 32 | `53a8739e` | adapted | `565e9990` | `fast-uri 3.1.5` 折叠进 Electron npm 锁单元。 | B7 npm 依赖树通过。 |
| 33 | `e5efc73c` | skipped | `565e9990`（覆盖） | 上游为空提交；`tar 7.5.22` 已由 Electron 锁升级带入。 | B7 npm 依赖树确认版本。 |
| 34 | `2a0ce347` | adapted | `a56bb250` | 可入账额度校验移入 React/Vue 共用 Epay 创建函数，位于第三方 Purchase 前。 | B7 controller/model 测试通过。 |
| 35 | `cf38105a` | adapted | `565e9990` | `js-yaml 4.3.1` 折叠进 Electron npm 锁单元。 | B7 npm 依赖树通过。 |
| 36 | `bbf67df0` | adapted | `565e9990` | Electron 39.8.10 折叠进同一 npm 锁单元。 | B7 Windows NSIS/portable 构建通过。 |
| 37 | `47ba9d2c` | adapted | `3c88009c` | 创建前检查钱包容量，结算时使用条件 UPDATE 防 TOCTOU。 | B7 边界和并发结算测试通过。 |
| 38 | `7d09c695` | applied | `bea8aadc` | Chat 到 Responses 转换保留 `prompt_cache_key`。 | B8 relaykit 测试通过。 |
| 39 | `e90a7c48` | applied | `a6d6b8b7` | React 为指定网关渠道开放字段透传控制。 | B8 typecheck/build 通过。 |
| 40 | `4442bb30` | applied | `031aa38c` | Claude 工具列表为空时不发送 `tools`。 | B8 Claude/relaykit 测试通过。 |
| 41 | `116255f0` | applied | `a519775f` | React OAuth 绑定字段与后端契约对齐，并恢复 access policy 模板。 | B8 typecheck/build 通过。 |
| 42 | `e2c7aa7b` | adapted | `0e45eb0f`、`815a8304` | 迁移现有 React 测试到 Vitest；保留 Ren2Hub Auto 双环断言并迁移本地自动定价测试。 | B8 32 文件、161 项 Vitest 通过。 |

## 批次合并提交

| 批次 | 合并提交 | 结果 |
|---|---|---|
| B1 请求重放 | `caebbcf1` | 已合入 |
| B2 rc.24 应用层 | `6a8810a2` | 已合入 |
| B3 rc.24 后续 | `16c202bc` | 已合入 |
| B4 协议与可观测性 | `11565de0` | 已合入 |
| B5 认证兼容 | `ca327dfe` | 已合入 |
| B6 金融核心 | `354cdb02` | 已合入 |
| B7 守卫与依赖 | `38d4cc0b` | 已合入 |
| B8 最终 Web/Relay | `77eafb34` | 已合入 |

## 已知验收边界

- MySQL/PostgreSQL 专项测试仅在提供 `TEST_MYSQL_DSN`、`TEST_POSTGRES_DSN` 时运行。
- 全仓 React lint/format 在同步前已有非本批错误；本轮要求变更文件 lint 通过，并单独记录全仓基线结果。
- 本台账不代表发布；集成分支不会推送或部署。
