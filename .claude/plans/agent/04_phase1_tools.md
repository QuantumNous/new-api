# Phase 1 工具清单（Tool Catalog）

> 工具数原则：**Phase 1 严格控制在 12 个以内**。每个工具一个 JSON Schema + 一个 Go 实现函数。
> 写工具一律 `NeedsConfirmation: true`，调研报告 §4.3.4 是底线。

---

## 1. 工具分类与确认要求

| 类别 | 数量 | 默认确认 |
|---|---|---|
| 只读 | 7 | 否 |
| 写（低风险） | 2 | 是 |
| 写（高风险） | 0 | — |
| 引导跳转 | 2 | 否（只生成链接） |
| 元工具 | 1 | 否 |

**Phase 1 不引入"自动充值/自动扣费/自动改密码"等高风险工具。**

---

## 2. 工具列表

### 只读工具（7 个）

#### T1. `get_balance` — 查我的余额

```json
{
  "name": "get_balance",
  "description": "查询当前登录用户的余额、已用额度和分组信息",
  "parameters": { "type": "object", "properties": {} }
}
```

实现：调 `model.GetUserCache(userId)`，返回 `{balance, used_quota, group, group_ratio}`。

---

#### T2. `list_my_models` — 我能用哪些模型

```json
{
  "name": "list_my_models",
  "description": "列出当前用户可调用的模型",
  "parameters": {
    "type": "object",
    "properties": {
      "filter": { "type": "string", "description": "可选关键字过滤", "default": "" }
    }
  }
}
```

实现：调 `controller.GetUserModels` 的内部函数版本（**不用 HTTP**，把核心逻辑抽成 service 函数 `service.GetUserAvailableModels(userId, filter)`）。

---

#### T3. `query_pricing` — 模型价格

```json
{
  "name": "query_pricing",
  "description": "查询指定模型的输入/输出每千 token 价格，或对比多个模型的价格",
  "parameters": {
    "type": "object",
    "properties": {
      "models": {
        "type": "array",
        "items": {"type": "string"},
        "description": "模型名称列表，1~5 个"
      }
    },
    "required": ["models"]
  }
}
```

实现：读 `setting/ratio_setting/model_ratio.go` 的内存价表 + 用户分组倍率。

---

#### T4. `recommend_model` — 智能选型（调研报告 §3.2 TOP1）

```json
{
  "name": "recommend_model",
  "description": "根据用户场景需求，推荐最合适的 1~3 个模型，给出理由和预估成本",
  "parameters": {
    "type": "object",
    "properties": {
      "task_type": {
        "type": "string",
        "enum": ["chat", "long_context", "code", "translation", "creative", "image", "embedding"],
        "description": "任务类型"
      },
      "expected_input_tokens": {"type": "integer", "description": "预期输入 token 数（粗估）"},
      "expected_output_tokens": {"type": "integer", "description": "预期输出 token 数"},
      "budget_priority": {
        "type": "string",
        "enum": ["cost_first", "quality_first", "speed_first"],
        "default": "cost_first"
      }
    },
    "required": ["task_type"]
  }
}
```

实现：在 `service/agent/recommender.go` 写规则匹配（Phase 1 不上 ML），返回 `[{model, reason, est_cost_cny, latency_tier}]`。

---

#### T5. `list_my_tokens` — 我的 API Key 列表

```json
{
  "name": "list_my_tokens",
  "description": "列出当前用户的所有 API Key（不返回 key 明文）",
  "parameters": { "type": "object", "properties": {} }
}
```

实现：调 `model.GetTokensByUserId(userId)`，**返回时把 `key` 字段截断为 `sk-xxx****yyyy`**（GuardOut 兜底再脱敏一次）。

---

#### T6. `query_my_logs` — 查我最近的调用

```json
{
  "name": "query_my_logs",
  "description": "查询当前用户最近的调用日志，支持时间和状态过滤",
  "parameters": {
    "type": "object",
    "properties": {
      "hours": {"type": "integer", "default": 24, "description": "最近多少小时（最大 168）"},
      "only_failed": {"type": "boolean", "default": false},
      "limit": {"type": "integer", "default": 20, "minimum": 1, "maximum": 100}
    }
  }
}
```

实现：调 `model.GetUserLogs` 内部函数版本，强制 `userId == ctx.userId`。

---

#### T7. `explain_error` — 错误归因（调研报告 §3.3）

```json
{
  "name": "explain_error",
  "description": "解释 API 调用失败的原因（接收 HTTP 状态码或错误文本），给出大白话和修复建议",
  "parameters": {
    "type": "object",
    "properties": {
      "status_code": {"type": "integer"},
      "error_text": {"type": "string"},
      "model_name": {"type": "string"}
    }
  }
}
```

实现：先查错误码映射表（见 `02_phase1_backend.md` §7），再调 LLM 总结。

---

### 写工具（2 个，全部需二次确认）

#### W1. `create_token` — 新建 API Key 🔒

```json
{
  "name": "create_token",
  "description": "为当前用户创建一个新的 API Key（需用户二次确认）",
  "parameters": {
    "type": "object",
    "properties": {
      "name": {"type": "string", "minLength": 1, "maxLength": 32},
      "expired_days": {"type": "integer", "default": 0, "description": "0 表示永久"},
      "remain_quota": {"type": "integer", "default": 0, "description": "0 表示无限制"},
      "group": {"type": "string", "description": "可选，指定分组"}
    },
    "required": ["name"]
  }
}
```

实现：调 `controller.AddToken` 的核心逻辑（抽成 service 函数，复用现有校验）。**返回 key 明文仅一次**，后续会话历史里 `tool_calls` 记录的明文要在落库前 redact 成 `sk-xxx****yyyy`。

---

#### W2. `delete_token` — 吊销 API Key 🔒

```json
{
  "name": "delete_token",
  "description": "删除指定 ID 的 API Key（需用户二次确认）",
  "parameters": {
    "type": "object",
    "properties": {
      "token_id": {"type": "integer", "description": "要删除的 Token ID"}
    },
    "required": ["token_id"]
  }
}
```

实现：复用 `model.DeleteTokenById(id, userId)`，**强制 user_id 校验**（防止 LLM 编造别人的 token_id 实施越权）。

> 调研报告强调"删除资产是高危操作"。Phase 1 暂不做"批量删除"工具。

---

### 引导跳转工具（2 个，不直接执行）

#### G1. `get_topup_link` — 充值引导（不直接扣费）

```json
{
  "name": "get_topup_link",
  "description": "生成跳转到充值页的链接（不执行实际充值），可指定预选金额",
  "parameters": {
    "type": "object",
    "properties": {
      "amount_cny": {"type": "number", "minimum": 1}
    }
  }
}
```

实现：返回 `{url: "/console/topup?amount=100"}`，**不调用任何支付 API**。前端拿到后渲染成跳转按钮。

> **高压线**：本工具严禁调用 `controller.RequestEpay/RequestStripePay/RequestCreemPay/RequestWaffoPay` 等任何创建订单的接口。Phase 1 只做"链接"，不做"自动下单"。

---

#### G2. `get_doc_link` — 文档/帮助跳转

```json
{
  "name": "get_doc_link",
  "description": "根据用户问题，给出最相关的文档/FAQ/教程链接",
  "parameters": {
    "type": "object",
    "properties": {
      "topic": {
        "type": "string",
        "enum": ["how_to_topup", "how_to_use_token", "third_party_client_setup", "billing_rules", "rate_limit", "model_list"]
      }
    },
    "required": ["topic"]
  }
}
```

实现：在 `service/agent/doc_links.go` 维护一份固定 URL 映射表。

---

### 元工具（1 个）

#### M1. `clarify` — 反问澄清

```json
{
  "name": "clarify",
  "description": "当用户意图不明时，反问用户澄清需求（用于禁止 Agent 在不明确时做有风险的操作）",
  "parameters": {
    "type": "object",
    "properties": {
      "question": {"type": "string"}
    },
    "required": ["question"]
  }
}
```

实现：直接把 `question` 包成 assistant 文本输出，不调外部 API。

---

## 3. 工具白名单注册（启动时一次）

`service/agent/registry.go::RegisterAll()` 在 `main.go` 的初始化段调用：

```go
func RegisterAll(r *Registry) {
    r.RegisterTool(toolGetBalance)
    r.RegisterTool(toolListMyModels)
    r.RegisterTool(toolQueryPricing)
    r.RegisterTool(toolRecommendModel)
    r.RegisterTool(toolListMyTokens)
    r.RegisterTool(toolQueryMyLogs)
    r.RegisterTool(toolExplainError)
    r.RegisterTool(toolCreateToken)   // NeedsConfirmation: true
    r.RegisterTool(toolDeleteToken)   // NeedsConfirmation: true
    r.RegisterTool(toolGetTopupLink)
    r.RegisterTool(toolGetDocLink)
    r.RegisterTool(toolClarify)
}
```

**Orchestrator 在每一轮 LLM 调用时**只把已注册的工具列表传给 LLM，LLM 编造未注册工具直接拒绝（这是 zhidou-sandbox-audit 的"工具白名单"铁律）。

---

## 4. 每个工具实现函数的统一签名

```go
type ToolExecutor func(ctx context.Context, userId int, args json.RawMessage) (ToolResult, error)

type ToolResult struct {
    OK          bool        `json:"ok"`
    Data        interface{} `json:"data,omitempty"`         // 给 LLM 看的纯结构化数据
    Display     interface{} `json:"display,omitempty"`      // 给前端 ToolCard 渲染的（可不同格式）
    UserMessage string      `json:"user_message,omitempty"` // 失败时给用户看的大白话
}
```

**关键约束**：
- 工具内部 **必须**用 `userId` 参数，**不能**从 args 里读 user_id（防注入）
- 工具内部 **必须**只读/操作当前 userId 的资源，对 token_id/log_id 等任何 ID 入参都要校验所属
- 工具内部 **必须**用 `common.Marshal/common.Unmarshal`（CLAUDE.md Rule 1）

---

## 5. 关于 LLM 调用 Agent 自身的"工具协议"

Phase 1 用 OpenAI Function Calling 格式（已被绝大多数模型支持），不引入 MCP（Phase 2 再说）。

LLM 请求格式：

```json
{
  "model": "gpt-4o-mini",
  "messages": [...],
  "tools": [
    {"type": "function", "function": {"name": "get_balance", ...}}
  ],
  "tool_choice": "auto"
}
```

注意：Agent 自己用的 LLM 通道由管理员在 Setting 里指定，**不能**让用户在前端选模型（防止 prompt injection 让 Agent 用便宜的模型乱搞）。
# 2026-05-15 Implementation Sync

`08_final_scope.md` is the authoritative source. Phase 1 tool count is 14, not 12. The final catalog includes T8 `search_knowledge` for RAG and W3 `trigger_topup` for guarded payment intent creation. W3 is not a webhook or automatic charge: it requires confirmation, amount whitelist checks, per-call/per-day limits, and audit logging.
