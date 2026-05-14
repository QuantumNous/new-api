# Phase 1 后端改造点

> 本期只动 `controller/agent.go` + `service/agent/*` + `model/agent_*.go` + 极少的 `router/api-router.go` 路由注册。**不碰高压线**。

---

## 1. 新增/补全的代码文件清单

| 路径 | 状态 | 作用 |
|---|---|---|
| `controller/agent.go` | 已存在 stub，需填充 | HTTP 入口（POST /api/agent/chat 流式 + POST /api/agent/confirm） |
| `service/agent/orchestrator.go` | 已存在 stub，需填充 | ReAct 循环 |
| `service/agent/registry.go` | 已存在 stub，需填充 | 工具注册表（启动时一次性 Register） |
| `service/agent/guard_in.go` | 已存在 stub，需填充 | 入口护栏：用户身份/速率/破冰额度 |
| `service/agent/guard_out.go` | 已存在 stub，需填充 | 出口护栏：脱敏（Token key/邮箱/手机号） |
| `service/agent/loopback.go` | **新增** | 内部 LLM 调用器（不走 HTTP，直接调 relay 包） |
| `service/agent/tools_readonly.go` | **新增** | 只读工具实现 |
| `service/agent/tools_mutation.go` | **新增** | 写工具实现（带二次确认 token） |
| `service/agent/llm_client.go` | **新增** | Agent 自己用的 LLM 通道选择策略 |
| `service/agent/session.go` | **新增** | 会话管理（短期记忆，载入/保存 messages） |
| `service/agent/audit.go` | **新增** | 审计日志写入 |
| `service/agent/icebreaker.go` | **新增** | 破冰额度计费（Agent 自己消耗的 LLM 算力） |
| `model/agent_session.go` | **新增** | `agent_sessions` 表 |
| `model/agent_message.go` | **新增** | `agent_messages` 表 |
| `model/agent_audit.go` | **新增** | `agent_audit_logs` 表 |
| `dto/agent.go` | **新增** | `AgentChatRequest`/`AgentChatChunk`/`AgentToolCall` 等 DTO |
| `constant/agent.go` | **新增** | 常量：消息角色/工具类别/事件类型 |
| `setting/agent_setting/setting.go` | **新增** | Agent 全局开关、模型选择、破冰额度配额 |

---

## 2. 路由注册（在 `router/api-router.go` 增量添加，不动其他）

```go
// 在已有 selfRoute 之后追加：
agentRoute := apiRouter.Group("/agent")
agentRoute.Use(middleware.UserAuth())
{
    agentRoute.GET("/config", controller.GetAgentConfig)         // 拿前端展示用配置（是否开启/欢迎语/快捷指令）
    agentRoute.POST("/chat", middleware.CriticalRateLimit(), controller.AgentChat)         // SSE 流式
    agentRoute.POST("/confirm", middleware.CriticalRateLimit(), controller.AgentConfirm)   // 二次确认
    agentRoute.GET("/sessions", controller.ListAgentSessions)
    agentRoute.GET("/sessions/:id", controller.GetAgentSession)
    agentRoute.DELETE("/sessions/:id", controller.DeleteAgentSession)
}
```

> **不新增** `/internal/agent/*` 路由 — Agent 内部调 LLM 走同进程函数（见 §6）。

---

## 3. 核心数据流（一图明了）

```
┌──────────────────────────────────────────────────────────────────┐
│ POST /api/agent/chat  body: {session_id?, message, options?}     │
└────────┬─────────────────────────────────────────────────────────┘
         │  middleware.UserAuth (拿 userId, 已校验)
         │  middleware.CriticalRateLimit
         ▼
┌─────────────────────────────────────────────────┐
│ controller.AgentChat                            │
│   1. 解析 body → AgentChatRequest               │
│   2. service.agent.GuardIn(userId)              │
│      - 是否启用 Agent (setting 开关)            │
│      - 速率：Redis 计数 N 次/分钟               │
│      - 破冰额度：是否还有免费额度 OR 余额>0     │
│   3. session.LoadOrCreate(userId, session_id)   │
│   4. orchestrator.RunStream(ctx, session, msg)  │
└────────┬────────────────────────────────────────┘
         ▼
┌─────────────────────────────────────────────────┐
│ orchestrator.RunStream（ReAct 循环）            │
│ for step in 1..MAX_STEPS (默认 6)               │
│   ① 调 llm_client.Call(messages, tools)         │
│   ② 收到 tool_calls?                            │
│      - 否 → SSE 输出文本，break                 │
│      - 是 →                                     │
│          for each tool_call:                    │
│            tool := registry.Get(name)           │
│            if tool.NeedsConfirmation:           │
│              生成 confirm_token                 │
│              SSE 推送"等待确认"事件             │
│              return（等用户调 /confirm）        │
│            else:                                │
│              result := tool.Executor(userId, args)│
│              guard_out.Sanitize(result)         │
│              audit.Write(...)                   │
│              messages 追加 tool result          │
│   ③ 步数耗尽 → 提示用户                         │
└────────┬────────────────────────────────────────┘
         ▼
┌─────────────────────────────────────────────────┐
│ guard_out.Sanitize 输出脱敏                     │
│ session.Append 落库                             │
│ SSE: data: {type:"done"}                        │
└─────────────────────────────────────────────────┘
```

---

## 4. 数据库迁移（Rule 2：三库兼容）

**全部走 GORM AutoMigrate，不写原生 ALTER COLUMN**。

### 4.1 `agent_sessions`

```go
type AgentSession struct {
    Id          int       `gorm:"primaryKey;autoIncrement" json:"id"`
    UserId      int       `gorm:"index;not null" json:"user_id"`
    Title       string    `gorm:"type:varchar(128)" json:"title"`
    LastMessage string    `gorm:"type:text" json:"last_message"`
    Status      string    `gorm:"type:varchar(16);default:'active'" json:"status"` // active/archived
    TokenCost   int64     `gorm:"default:0" json:"token_cost"` // Agent 自己消耗的额度（聚合显示）
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}
```

### 4.2 `agent_messages`

```go
type AgentMessage struct {
    Id        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
    SessionId int       `gorm:"index;not null" json:"session_id"`
    UserId    int       `gorm:"index;not null" json:"user_id"` // 冗余存，方便审计
    Role      string    `gorm:"type:varchar(16);not null" json:"role"` // user/assistant/tool
    Content   string    `gorm:"type:text" json:"content"`
    ToolCalls string    `gorm:"type:text" json:"tool_calls"` // JSON 序列化的 tool_calls 数组
    ToolName  string    `gorm:"type:varchar(64)" json:"tool_name"` // role=tool 时填
    CreatedAt time.Time `json:"created_at"`
}
```

> 注意：`tool_calls` 用 `text` 而非 PG 的 `jsonb`（Rule 2）。

### 4.3 `agent_audit_logs`

```go
type AgentAuditLog struct {
    Id           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
    UserId       int       `gorm:"index;not null" json:"user_id"`
    SessionId    int       `gorm:"index" json:"session_id"`
    ToolName     string    `gorm:"type:varchar(64);index;not null" json:"tool_name"`
    Args         string    `gorm:"type:text" json:"args"`     // 入参 JSON（已脱敏）
    Result       string    `gorm:"type:text" json:"result"`   // 出参 JSON（已脱敏）
    Status       string    `gorm:"type:varchar(16)" json:"status"` // success/failed/refused
    ErrorMsg     string    `gorm:"type:varchar(255)" json:"error_msg"`
    NeedsConfirm bool      `gorm:"default:false" json:"needs_confirm"`
    Confirmed    bool      `gorm:"default:false" json:"confirmed"`
    DurationMs   int       `json:"duration_ms"`
    CreatedAt    time.Time `gorm:"index" json:"created_at"`
}
```

迁移注册位置：在 `model/main.go` 的 `db.AutoMigrate(...)` 列表里追加这三个 model。

---

## 5. 核心结构定义（`service/agent/orchestrator.go`）

```go
type Orchestrator struct {
    registry  *Registry
    llm       *LLMClient
    sessions  *SessionStore
    audit     *AuditWriter
    maxSteps  int
}

type RunOptions struct {
    Stream      bool
    SystemPrompt string // 可由 setting 覆写
}

// 流式接口：把 chunk 通过 channel 推回 controller
func (o *Orchestrator) RunStream(
    ctx context.Context,
    userId int,
    session *AgentSession,
    userMessage string,
    opt RunOptions,
) (<-chan AgentEvent, error)
```

`AgentEvent` 类型枚举（推到前端的 SSE 事件）：

| type | 含义 |
|---|---|
| `text_delta` | LLM 生成的文本增量 |
| `tool_call_start` | 即将调用工具（前端展示进度气泡：「正在为您挑选模型...」） |
| `tool_call_result` | 工具执行结果（部分工具结果直接展示卡片） |
| `confirm_required` | 写工具触发，前端弹确认卡 |
| `error` | 错误（已用大白话翻译，见 §7） |
| `done` | 全部结束 |

---

## 6. Agent 内部调 LLM 的实现（`service/agent/loopback.go` + `llm_client.go`）

**决策**：走"同进程函数调用"，不走 HTTP loopback。

理由：
- HTTP loopback 需要构造伪造 Token、伪造 ip、过 rate limit，引入鉴权风险
- 走 relay 包内部函数（`relay.RelayChatCompletion(ctx, ...)`）拿到的是同一个 user 的 quota，计费准确
- 也避免改 `middleware/auth.go`（高压线）

实现概要：

```go
// service/agent/llm_client.go
type LLMClient struct {
    channelId int    // 由 setting 配置：Agent 专用通道
    modelName string // 默认 gpt-4o-mini 或者管理员配置
}

func (l *LLMClient) Call(ctx context.Context, userId int, messages []dto.Message, tools []dto.Tool) (*dto.ChatCompletionResponse, error) {
    // 1. 构造 OpenAI 兼容请求
    // 2. 构造一个伪 gin.Context（或者抽出 relay 内部不需要 gin 的纯函数版本）
    // 3. 用 service/agent/icebreaker 包一层计费：先扣破冰额度，破冰用完才扣用户余额
    // 4. 调 relay 内部 chat completion 函数
    // 5. 返回结构化响应
}
```

> **如果 relay 内部函数耦合 gin.Context 太重**，回退方案：开放一个 `internal/agent/chat/completions` 路由 + `InternalAgentAuth` 中间件（仿造 `internal/pg`），在 controller 调用前用 internal middleware 设置好 user 上下文。

---

## 7. 错误归因翻译（小白用户体验关键）

后端工具失败时，**不能**直接把 `errors.New("rate limit 429")` 抛给前端。在 `service/agent/error_translate.go`（小文件）维护错误码 → 大白话的映射：

| 上游错误 | 翻译给小白 |
|---|---|
| 429 Too Many Requests | 「这个模型现在请求太多排队了，我帮您切到备用通道试试？」 |
| 401 Unauthorized | 「您的 API Key 好像失效了，要不要新建一个？」 |
| insufficient_quota | 「您的额度不够了，现在余额 ¥X.XX，需要充值吗？」 |
| context length exceeded | 「您发的内容太长了，超过了模型的容量。要不要换个上下文更长的模型？」 |
| 网络超时 | 「上游模型响应慢，您要不要先换个模型试一下？」 |

---

## 8. Phase 1 不做的（防止范围蔓延）

- ❌ MCP 协议（Phase 2）
- ❌ 多 Agent 协作（Phase 3）
- ❌ 长期记忆 / 向量库（Phase 2）
- ❌ RAG 知识库（Phase 2，调研报告 §4.3.1）
- ❌ Agent 商店（Phase 3）
- ❌ 自动充值（敏感度太高，Phase 1 只做"生成跳转链接"）
- ❌ 跨模型工作流编排（Phase 3）
- ❌ 修改 `middleware/auth.go` 任何一行（永远不动）
# 2026-05-15 Implementation Sync

`08_final_scope.md` is the authoritative Phase 1 scope. Any older line in this file that says Phase 1 does not include RAG, only generates recharge links, or excludes guarded payment intent has been superseded. Phase 1 now includes 9 Agent tables, T8 `search_knowledge`, W3 `trigger_topup` with server-side amount guard and confirmation, and admin KB/tool/audit routes. Payment webhook files and relay/auth high-pressure sections remain forbidden.
