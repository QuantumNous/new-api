# 知豆 AI Agent 改造方案 · 总览

> 输入：`AI_Agent_Research_Report.docx`（公司高管/战略投资人调研报告）
> 目标：在不动高压线的前提下，给现有 new-api 基座加上"对话式 AI 管家"，让小白用户能用自然语言完成查余额、建 Key、选模型、充值引导等操作。
> 现状：已有 `feat/agent-scaffold` 分支，包含 `controller/agent.go` + `service/agent/*.go` 五个空 stub，待填充。

---

## 1. 战略对齐（来自调研报告）

| 报告结论 | 落到本项目 |
|---|---|
| Agent 必须是"执行型"而非"客服式" | 工具调用闭环：自然语言 → tool_call → 调内部 API → 返回结果 |
| 拥抱 MCP 协议作为统一工具协议 | Phase 1 用内部 Function Calling，Phase 2 抽象出 MCP 适配层 |
| 敏感操作必须人工确认（KiKi 模式） | `ToolDefinition.NeedsConfirmation` 字段已预留，前端用确认卡片 |
| 中立性 + 跨模型调度是护城河 | Agent 自身的 LLM 也要可切换通道，不锁死单一模型 |
| 90 天 MVP，先做"问答 + 基础配置代理" | Phase 1 范围严格收敛到 §3 列的 5 类工具 |
| 小白核心痛点 TOP3：选型 / 配置 / 报错 | MVP 必须覆盖：模型推荐、API Key 自助、错误归因解释 |

---

## 2. 改造范围一句话

**在 `service/agent/`、`controller/agent.go`、前端 `web/src/components/agent/` 三处增量开发，零改动 `middleware/auth.go`、`controller/relay.go` 计费段、所有支付 webhook。**

---

## 3. 阶段划分（与报告 §4.2 对齐）

| 阶段 | 周期 | 核心目标 | 风险 |
|---|---|---|---|
| **Phase 1 MVP** | 0–2 月 | 对话问答 + 只读工具 + 低风险写工具（建/删 Token） | 可控，本方案重点 |
| **Phase 2 增长期** | 2–6 月 | 故障自助排查 + 余额引导充值 + MCP 适配层 + RAG 知识库 | 中，涉及计费引导，强人工确认 |
| **Phase 3 平台期** | 6–12 月 | 多 Agent 协同 + 跨模型工作流 + Agent 商店 | 高，本方案只做架构占位，不实现 |

---

## 4. 文件分工总览

| 文档 | 内容 |
|---|---|
| `00_overview.md` | 本文，统领 |
| `01_existing_capabilities.md` | 现有可复用能力盘点（API、表、中间件） |
| `02_phase1_backend.md` | Phase 1 后端改造点 |
| `03_phase1_frontend.md` | Phase 1 前端改造点 |
| `04_phase1_tools.md` | Phase 1 工具清单 + JSON Schema |
| `05_safety_billing_audit.md` | 安全/计费/审计 三件事 |
| `06_phase2_phase3_outline.md` | Phase 2/3 蓝图（仅占位） |
| `07_open_questions.md` | 全部 20 个问题的提问 + 已确认决策记录 |
| `08_final_scope.md` | **最终范围锁定（5 轮决策合并版，权威源）** |

---

## 5. 高压线再次重申（来自 `CLAUDE.md` Rule 7）

Agent 改造期间**绝对不动**：
1. `middleware/auth.go` 的 `New-Api-User` 校验段（line 95–122）
2. `controller/relay.go` 的 `PreConsumeBilling()` / `Refund()` 配对（line 225–236）
3. `controller/topup.go` / `stripe.go` / `creem.go` / `waffo.go` 的 webhook 处理函数

Agent 调任何"涉及上述文件的功能"必须走"包一层新接口"的路子，禁止直接 import 这些函数后改签名。

---

## 6. 受保护品牌信息（来自 `CLAUDE.md` Rule 5）

`new-api` 与 `QuantumNous` 标识在所有 README/Footer/Logo/包名中保持原样，Agent 自我介绍时可以自报"知豆"，但不能修改任何 `new-api` / `QuantumNous` 字符串。

---

## 7. 阅读顺序建议

1. 先读本文了解全局
2. 跳到 `07_open_questions.md` 把待确认项答完
3. 再回头看 `02`/`03`/`04` 的具体改造点
4. `05` 安全清单作为开发期 checklist
