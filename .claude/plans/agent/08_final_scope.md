# Phase 1 范围锁定（最终版）

> 本文是基于 5 轮 20+ 个问题确认后的最终范围合同。**任何偏离本文的范围扩展都需要重新确认。**
> 决策日期：2026-05-15
> 分支：`feat/agent-phase1`（待从 `feat/agent-scaffold` 切出）

---

## 1. 核心架构决策一览（不可逆）

| 维度 | 决策 | 影响 |
|---|---|---|
| Agent 自身 LLM 计费 | 破冰额度池（默认 10 次/人） + 用完扣余额 | 新增 `agent_user_quota` 表 + `service/agent/icebreaker.go` |
| Agent 用什么模型 | 管理员配置固定通道 + 固定模型 | Setting 加 `agent.llm_channel_id`、`agent.llm_model_name` |
| 内部调 LLM 路径 | 同进程函数调用（重构 relay 包解耦 gin.Context） | **风险：重构成本未评估**，遇阻回退 HTTP loopback |
| 工具管理 | 代码 RegisterAll + DB 开关表 | 新增 `agent_tool_settings`、管理员后台加工具开关页 |
| 支付调起 | 允许小额（默认 ¥10/次、¥50/天） + 强 Modal 二次确认 | 新增 `agent_payment_intents`、`payment_guard.go` |
| RAG 知识库 | 全量上：表存向量 + 应用层余弦 | 新增 `agent_kb_docs` `agent_kb_chunks`，含管理员上传/切片/向量化管线 |
| System prompt | 用户可加技能指令，不可覆盖核心 | 新增 `agent_user_settings`，`prompt_builder.go` 拼接 |
| 入口 | 悬浮按钮 + 侧边栏 + 独立页面三入口 | 三处 UI 共享会话状态 |
| 二次确认 UI | 卡片为主，删除/付费用 Modal | `risk_level` 字段决定渲染方式 |
| Agent 名字 | "豆哥"（可在 setting 改） | 默认 `agent.display_name = "豆哥"` |
| 语言 | 中英 + 预留 fr/ru/ja/vi key | i18n 双语，system prompt 双语版 |
| 审计 | 独立表 `agent_audit_logs`，永久保留 | created_at 索引 + 预留归档脚本接口位 |
| 会话 | 后端持久化，永久保留 | `agent_sessions` + `agent_messages` |
| 用户可见性 | 上线即全员可见，受 `agent.enabled` 全局开关控制 | 必须有错误率熔断 |
| 重试 | 5xx 重试 3 次，指数退避 + 抖动 | 配合错误率熔断防雪崩 |
| 发布 | 一次性 Phase 1 全部完成才上线 | 不分批 |
| 资源 | 一个人全栈顺序推进 | 不 spawn 并行子 agent |

---

## 2. Phase 1 最终工具清单（共 14 个）

| ID | 名称 | 类别 | 二次确认 | 风险等级 |
|---|---|---|---|---|
| T1 | `get_balance` | 只读 | 否 | low |
| T2 | `list_my_models` | 只读 | 否 | low |
| T3 | `query_pricing` | 只读 | 否 | low |
| T4 | `recommend_model` | 只读（含 LLM 推断） | 否 | low |
| T5 | `list_my_tokens` | 只读（带脱敏） | 否 | low |
| T6 | `query_my_logs` | 只读 | 否 | low |
| T7 | `explain_error` | 只读 | 否 | low |
| **T8** | `search_knowledge` | 只读（RAG） | 否 | low |
| W1 | `create_token` | 写 | 是（卡片） | medium |
| W2 | `delete_token` | 写 | 是（**Modal**） | high |
| **W3** | `trigger_topup` | 调起支付 | 是（**Modal**，金额白名单） | high |
| G1 | `get_topup_link` | 引导跳转 | 否 | low |
| G2 | `get_doc_link` | 引导跳转 | 否 | low |
| M1 | `clarify` | 元工具 | 否 | low |

> T8 (RAG 搜索) 和 W3 (调起支付) 是相对 `04_phase1_tools.md` 初稿新增的两个工具。
> `04_phase1_tools.md` 应同步更新（待开工时一并修订，本文为权威源）。

---

## 3. 数据库迁移完整清单（GORM AutoMigrate，三库兼容）

| 表名 | 用途 | 关键字段 |
|---|---|---|
| `agent_sessions` | 会话头 | user_id, title, status, token_cost |
| `agent_messages` | 消息流 | session_id, user_id, role, content, tool_calls, tool_name |
| `agent_audit_logs` | 审计 | user_id, session_id, tool_name, args, result, status, needs_confirm, confirmed |
| `agent_user_quota` | **新增** 破冰额度 | user_id PK, free_remaining, total_used, last_reset_at |
| `agent_tool_settings` | **新增** 工具开关 | tool_name PK, enabled, updated_at |
| `agent_payment_intents` | **新增** 支付意图追踪 | user_id, session_id, amount_cny, intent_id, status |
| `agent_user_settings` | **新增** 用户偏好 | user_id PK, extra_prompt, language |
| `agent_kb_docs` | **新增** 知识库文档 | id, title, source, status, chunks_count |
| `agent_kb_chunks` | **新增** 知识库切片 | doc_id, content, embedding (TEXT JSON 数组), token_count |

**总计 9 张新表**，全部走 `model.AutoMigrate` 注册到 `model/main.go`。

---

## 4. Setting 配置项最终清单（`setting/agent_setting/setting.go`）

```go
type AgentSetting struct {
    // 全局开关
    Enabled                  bool   // 默认 false
    DisplayName              string // 默认 "豆哥"

    // LLM 配置
    LLMChannelID             int    // 必填，管理员后台填
    LLMModelName             string // 默认 "gpt-4o-mini"
    LLMTemperature           float64 // 默认 0.2

    // System prompt
    SystemPromptZh           string
    SystemPromptEn           string

    // 破冰额度
    IcebreakerQuotaPerUser   int    // 默认 10

    // 支付护栏
    PaymentPerCallMaxCNY     float64 // 默认 10
    PaymentPerDayMaxCNY      float64 // 默认 50

    // 速率限制
    ChatRPM                  int    // 默认 30
    ConfirmRPM               int    // 默认 10
    DailyMaxSteps            int    // 默认 300
    SessionMaxMessages       int    // 默认 100
    SessionMaxContextTokens  int    // 默认 32000
    ReactMaxStepsPerTurn     int    // 默认 6
    ToolExecuteTimeoutSec    int    // 默认 10

    // 重试
    Retry5xxTimes            int    // 默认 3
    RetryBackoffBaseMs       int    // 默认 500
    RetryJitterPct           int    // 默认 30

    // 错误率熔断
    CircuitBreakerErrorRate  float64 // 默认 0.5
    CircuitBreakerWindowSec  int     // 默认 180

    // RAG
    KBMaxChunks              int    // 默认 50000，超过给管理员提醒
    KBEmbeddingDim           int    // 默认 1536（与所选 embedding 模型对齐）
    KBTopK                   int    // 默认 5

    // 工具开关（运行时从 agent_tool_settings 加载，非 setting）
}
```

---

## 5. 改造文件清单（开工时按此 checklist 推进）

### 后端

| 路径 | 状态 | 备注 |
|---|---|---|
| `controller/agent.go` | 填充已有 stub | AgentChat / AgentConfirm / GetAgentConfig / 会话 CRUD |
| `service/agent/orchestrator.go` | 填充已有 stub | ReAct 循环 |
| `service/agent/registry.go` | 填充已有 stub | 工具注册（按接口实现） |
| `service/agent/guard_in.go` | 填充已有 stub | 速率/破冰额度/熔断 |
| `service/agent/guard_out.go` | 填充已有 stub | 输出脱敏（key/邮箱/手机号） |
| `service/agent/llm_client.go` | 新增 | 同进程调 relay 包内部纯函数 |
| `service/agent/icebreaker.go` | 新增 | 破冰额度两段式扣费 |
| `service/agent/session.go` | 新增 | 会话 CRUD + 历史加载 |
| `service/agent/audit.go` | 新增 | 审计写入 |
| `service/agent/tools_readonly.go` | 新增 | T1~T7 + T8 实现 |
| `service/agent/tools_mutation.go` | 新增 | W1~W3 实现 |
| `service/agent/tools_misc.go` | 新增 | G1/G2/M1 |
| `service/agent/payment_guard.go` | 新增 | 支付金额上限校验 + 防注入 |
| `service/agent/retry.go` | 新增 | 5xx 重试 + 指数退避 |
| `service/agent/error_translate.go` | 新增 | 错误码 → 大白话 |
| `service/agent/prompt_builder.go` | 新增 | system prompt 拼接（含用户额外指令） |
| `service/agent/recommender.go` | 新增 | 模型推荐规则 |
| `service/agent/doc_links.go` | 新增 | 文档链接映射 |
| `service/agent/faq.go` | 新增 | RAG 兜底用的硬编码 FAQ |
| `service/agent/kb/searcher.go` | 新增 | 应用层余弦相似度 |
| `service/agent/kb/embedder.go` | 新增 | 调 embedding 模型生成向量 |
| `service/agent/kb/ingester.go` | 新增 | 文档切片 + 入库 |
| `service/agent/circuit_breaker.go` | 新增 | 错误率熔断 |
| `service/relay_internal/chat.go` | **新增** | 把 relay chat 内部函数抽出来去 gin 依赖（**最大风险点**） |
| `model/agent_session.go` | 新增 | |
| `model/agent_message.go` | 新增 | |
| `model/agent_audit.go` | 新增 | |
| `model/agent_user_quota.go` | 新增 | |
| `model/agent_tool_settings.go` | 新增 | |
| `model/agent_payment_intent.go` | 新增 | |
| `model/agent_user_settings.go` | 新增 | |
| `model/agent_kb_doc.go` | 新增 | |
| `model/agent_kb_chunk.go` | 新增 | |
| `model/main.go` | 修改（仅追加 AutoMigrate） | 9 张新表全注册 |
| `dto/agent.go` | 新增 | 请求/响应 DTO |
| `constant/agent.go` | 新增 | 角色/事件类型常量 |
| `setting/agent_setting/setting.go` | 新增 | Agent 全局配置 |
| `controller/agent_admin.go` | 新增 | 管理员侧：工具开关/KB 管理/审计查询 |
| `controller/agent_kb.go` | 新增 | KB 文档 CRUD |
| `cron/agent_archive.go` | 新增（仅占位） | 永久保留预留归档接口 |
| `router/api-router.go` | 修改（仅追加路由组） | `/api/agent/*` + `/api/agent/admin/*` + `/api/agent/kb/*` |

### 前端

| 路径 | 状态 |
|---|---|
| `web/src/pages/Agent/index.jsx` | 新增（独立页面） |
| `web/src/pages/AgentAdmin/{ToolSwitches,KnowledgeBase,Settings,Audit}.jsx` | 新增（管理员后台子页面） |
| `web/src/components/agent/{AgentLauncher,AgentDrawer,AgentChatArea,AgentMessageBubble,AgentToolCard,AgentConfirmCard,AgentConfirmModal,AgentInput,QuickActions,SessionList}.jsx` | 新增 |
| `web/src/components/agent/cards/{BalanceCard,TokenListCard,TokenCreatedCard,RecommendModelCard,LogChartCard,TopupLinkCard,KbResultCard,PaymentTriggerCard}.jsx` | 新增 |
| `web/src/hooks/agent/{useAgentChat,useAgentSession,useAgentSSE}.js` | 新增 |
| `web/src/services/agent.js` | 新增 |
| `web/src/contexts/AgentContext.jsx` | 新增（三入口共享状态） |
| `web/src/i18n/locales/{zh,en}.json` | 增量加 key |
| `web/src/i18n/locales/{fr,ru,ja,vi}.json` | 仅占位 key（fallback 到 zh） |
| `web/src/components/layout/SiderBar.jsx` | 修改（加菜单项） |
| `web/src/App.jsx` | 修改（注册路由 + 注入悬浮按钮） |

---

## 6. 必须保留的"不动清单"（重申高压线）

任何 PR 触碰这些**直接驳回**：

| 文件 | 段落 | 理由 |
|---|---|---|
| `middleware/auth.go` | line 95–122 | 用户身份校验（CLAUDE.md Rule 7 高压线 1） |
| `controller/relay.go` | line 225–236 | Pre/Refund 配对（高压线 2） |
| `controller/topup.go` | `EpayNotify` | 支付回调（高压线 3） |
| `controller/stripe.go` | `StripeWebhook` | 高压线 3 |
| `controller/creem.go` | `CreemWebhook` | 高压线 3 |
| `controller/waffo.go` | `WaffoWebhook` | 高压线 3 |
| 任何 README / Footer / 包名 / 注释里的 `new-api` `QuantumNous` | — | CLAUDE.md Rule 5 |

---

## 7. Phase 1 里程碑（待开工后填实际工时）

| 里程碑 | 出口标准 | 估算（待 Q8 评估后给硬数字） |
|---|---|---|
| **M1 后端骨架** | 路由通、9 张表 migrate 通、控制器返回 stub 数据 | ~3 天 |
| **M2 LLM 调用通路（Q8）** | relay 内部纯函数版能跑通，Agent 能调 LLM 拿到回复 | **未评估**，关键风险点 |
| **M3 工具实现（只读 + 元）** | T1~T8 + M1 + G1/G2 全部跑通，单测覆盖核心 | ~5 天 |
| **M4 写工具 + 二次确认** | W1/W2 跑通，confirm_token 防重放 | ~3 天 |
| **M5 支付调起 + 护栏** | W3 全套护栏，金额白名单，防注入 | ~4 天 |
| **M6 RAG 知识库** | 上传/切片/向量化/检索/管理后台 | ~7 天 |
| **M7 GuardIn/Out + 速率/熔断** | 全部限制生效，跑 prompt injection 测试 | ~3 天 |
| **M8 审计 + 永久保留** | 审计落库，归档接口位预留 | ~1 天 |
| **M9 前端三入口** | 悬浮按钮 + 侧边栏 + 独立页面，会话状态共享 | ~5 天 |
| **M10 卡片渲染** | 8 类工具卡片 + Modal 确认 | ~5 天 |
| **M11 i18n 双语** | 中英文文案对齐，系统提示双语 | ~2 天 |
| **M12 联调 + 回归** | 跑 `zhidou-regression-gate` `zhidou-prompt-injection-test` `zhidou-eval-run` 全绿 | ~5 天 |

> **保守总估**：~43 天 + M2 评估值。如果 M2 解耦超过 5 天，Phase 1 总周期会到 50+ 天，仍在 90 天 MVP 红线内但缓冲收窄。

---

## 8. 开工前最后一道关卡

在切 `feat/agent-phase1` 分支之前，我会做以下事情，做完跟你确认：

1. **跑一次 M2 可行性评估**：spike 探明 relay 内部能否抽出不依赖 gin.Context 的纯函数，给出工时估算
2. **跑 `zhidou-ironline-guard`** 确认现有 stub 没有触碰高压线
3. **跑 `zhidou-regression-gate`** 拉一份 baseline（agent.enabled=false 时的回归基准）
4. **回看 `04_phase1_tools.md` 和本文**，把 T8/W3 加进工具清单
5. **草拟一版"Agent LLM 调用流程"流程图**给你确认

**确认完才开始写业务代码。**

---

## 9. 你接下来要做的事

1. **现在**：通读本文 + [07_open_questions.md](.claude/plans/agent/07_open_questions.md)，看决策是否都符合预期
2. **稍后**：如对某条决策反悔，回来跟我说，我更新本文
3. **再之后**：让我做 §8 的可行性评估（M2 是最大不确定项）
4. **最后**：评估 OK 我才切分支动手

---

## 10. 决策溯源

每条决策对应 `07_open_questions.md` 的问题编号，方便事后回查"当时为什么这么定"。如对历史决策有疑问，先看 `07_open_questions.md`，再来找我。
