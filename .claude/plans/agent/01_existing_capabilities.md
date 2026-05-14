# 现有可复用能力盘点

> 在写新代码前，先确认哪些"轮子"已经有了。Agent 工具的实现 80% 是"包一层"现有 API。

---

## 1. 现有 REST API（Agent 工具直接套）

### 用户/账户类（`router/api-router.go` user 组）

| 路径 | 方法 | 现有控制器 | Agent 用途 |
|---|---|---|---|
| `/api/user/self` | GET | `controller.GetSelf` | 查余额 / 用户名 / 邮箱 / 分组 |
| `/api/user/self/groups` | GET | `controller.GetUserGroups` | 查用户所属 group（决定可用模型/价格） |
| `/api/user/models` | GET | `controller.GetUserModels` | 查"我能用哪些模型" |
| `/api/user/topup/info` | GET | `controller.GetTopUpInfo` | 充值入口/方案信息 |
| `/api/user/topup/self` | GET | `controller.GetUserTopUps` | 查充值历史 |
| `/api/user/aff` | GET | `controller.GetAffCode` | 邀请码（场景：拉新返利） |
| `/api/user/checkin` | GET/POST | `controller.GetCheckinStatus`/`DoCheckin` | 签到（场景：余额不足时引导） |

### Token（API Key）类

| 路径 | 方法 | 控制器 | Agent 用途 |
|---|---|---|---|
| `/api/token/` | GET | `GetAllTokens` | 列出我的 Token |
| `/api/token/` | POST | `AddToken` | **新建 Key（写工具，需二次确认）** |
| `/api/token/:id` | DELETE | `DeleteToken` | **吊销 Key（写工具，强制二次确认）** |
| `/api/token/:id/key` | POST | `GetTokenKey` | 取 Key 值（已带 `CriticalRateLimit + DisableCache`） |

### 模型/计费类

| 路径 | 方法 | 控制器 | Agent 用途 |
|---|---|---|---|
| `/api/pricing` | GET | `GetPricing` | 模型单价表（用于"比价"工具） |
| `/api/models` | GET | `DashboardListModels` | 模型清单 |
| `/api/ratio_config` | GET | `GetRatioConfig` | 倍率配置 |

### 日志/统计类

| 路径 | 方法 | 控制器 | Agent 用途 |
|---|---|---|---|
| `/api/log/self` | GET | `GetUserLogs` | 我的调用日志（**故障排查工具核心**） |
| `/api/log/self/search` | GET | `SearchUserLogs` | 搜日志 |
| `/api/log/self/stat` | GET | `GetLogsSelfStat` | 我的统计（按日/按模型聚合） |
| `/api/data/self` | GET | `GetUserQuotaDates` | 我的额度时间序列 |

### Playground 内部调用（最重要！）

| 路径 | 方法 | 控制器 | 关键点 |
|---|---|---|---|
| `/pg/chat/completions` | POST | `Playground` | 用户身份调上游 LLM，走平台计费 |
| `/internal/pg/images/*` | POST | `PlaygroundImageGeneration`/`PlaygroundImageEdit` | **走 `InternalPlaygroundAuth`，不需要 Token，直接拿 user_id** |

> **关键发现**：`internal/pg` 路由组用的 `middleware.InternalPlaygroundAuth()` 就是 Agent 调 LLM 的现成范式 — Agent 编排器不需要为自己生成 Token，可以直接走 internal 路径。

---

## 2. 现有数据模型（Agent 不需新建表的部分）

| 表 | 文件 | Agent 复用方式 |
|---|---|---|
| `users` | `model/user.go` | 用 `GetUserCache(userId)` 拿余额/分组 |
| `tokens` | `model/token.go` | CRUD 已齐全 |
| `logs` | `model/log.go` | 错误日志查询 |
| `channels` | `model/channel.go` | 模型可用性查询（管理员看，普通用户看不到） |
| `quota_data` | `model/data.go` | 历史用量 |

**Agent 需要新增的表**（详见 `02_phase1_backend.md` §4）：
- `agent_sessions` — 会话头
- `agent_messages` — 单条消息（含 tool_calls/tool_results 序列化）
- `agent_audit_logs` — 工具调用审计（敏感操作必落） *待确认是否独立表，见 `07_open_questions.md` Q5*

---

## 3. 现有中间件（直接用）

| 中间件 | 文件 | Agent 用法 |
|---|---|---|
| `middleware.UserAuth()` | `middleware/auth.go` | Agent 接口入口必加 |
| `middleware.CriticalRateLimit()` | `middleware/rate-limit.go` | 写工具入口必加 |
| `middleware.SecureVerificationRequired()` | `middleware/auth.go`（同文件） | 高敏写工具用（如批量删 Token） |
| `middleware.Distribute()` | `middleware/distributor.go` | Agent 内部调 LLM 时复用 |
| `middleware.SystemPerformanceCheck()` | `middleware/performance.go` | Agent 高负载时熔断 |

---

## 4. 现有公共工具（直接 import）

| 工具 | 位置 | Agent 用法 |
|---|---|---|
| `common.Marshal` / `common.Unmarshal` | `common/json.go` | **Rule 1**：所有 JSON 必须走这套 |
| `common.GetEnvOrDefault` | `common/env.go` | 读 `AGENT_*` 环境变量 |
| `common.SysLog` / `common.SysError` | `common/logger.go` | 系统日志 |
| `service/billing.go` | — | **不要直接调，必须包一层 agent 自己的计费包装** |
| `relay/common/relay_info.go::GenRelayInfo` | — | Agent 调 LLM 时复用 |

---

## 5. 现有前端基础设施（Agent UI 直接套）

| 资源 | 路径 | 用法 |
|---|---|---|
| Semi UI | `@douyinfe/semi-ui` 2.69.1 | 主 UI 库 |
| Markdown 渲染 | `web/src/components/common/markdown/MarkdownRenderer.jsx` | Agent 回复渲染 |
| SSE 客户端 | `sse.js` 2.6.0 | Agent 流式输出 |
| 现有 Playground 聊天组件 | `web/src/components/playground/ChatArea.jsx` 等 | UI 风格参考 |
| `useApiRequest` hook | `web/src/hooks/playground/useApiRequest.js` | SSE 消费样板 |
| i18n | `web/src/i18n/locales/{zh,en,...}.json` | Agent 文案双语 |
| 二次确认弹窗 | `web/src/components/common/modals/SecureVerificationModal.jsx` | 敏感工具确认弹窗复用 |

---

## 6. 现有后端 LLM 调用通路（Agent 编排器复用）

```
现有：用户浏览器 → /pg/chat/completions → middleware.UserAuth → Distribute → Relay → 上游 LLM
                                          ↑
                                          这里"假装是用户"调一次

Agent 改造后：
用户消息 → /api/agent/chat (UserAuth)
            ↓ orchestrator 在 ctx 里继承 user_id
            → 内部调一次 /internal/pg/chat/completions（待新增，仿造 internal/pg/images）
            ↓ 拿到 tool_calls
            → 在 service/agent/registry.go 找到对应 ToolDefinition
            → 调对应的内部函数（同进程，无 HTTP）
            ↓ 把 tool_result 塞回上下文
            → 再调一次内部 LLM
            ↓ 直到没有 tool_calls 为止
            → SSE 流式回前端
```

> **关键决策**：Agent 调 LLM 走"同进程函数调用"还是"HTTP loopback"？详见 `07_open_questions.md` Q3。

---

## 7. 高压线再次标注（Agent 永远不动）

| 文件 | 不能动的段落 | 为什么 |
|---|---|---|
| `middleware/auth.go` | line 95–122 `New-Api-User` 校验 | Agent 越权风险 |
| `controller/relay.go` | line 225–236 `PreConsumeBilling/Refund` | 计费配对 |
| `controller/topup.go` | `EpayNotify` | 支付伪造风险 |
| `controller/stripe.go` | `StripeWebhook` | 同上 |
| `controller/creem.go` | `CreemWebhook` | 同上 |
| `controller/waffo.go` | `WaffoWebhook` | 同上 |

Agent 工具如果要调充值流程，必须**只读**或**只生成跳转链接**，不能在 webhook 路径上插入任何代码。
