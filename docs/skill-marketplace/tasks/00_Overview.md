# Skill Marketplace Tasks Overview

本文档是 `tasks/` 目录的模块化 PRD 总入口。它定义 DeepRouter Skill Marketplace V1 的文档边界、Source of Truth、跨模块依赖和 Sprint Ready 使用规则，避免不同 Agent 在范围、事件、权限、数据模型和上线门槛上产生不同解释。

---

## 1. Product Positioning

DeepRouter Skill Marketplace V1 是一个官方托管的跨平台 AI Tool 平台。DeepRouter 后端维护每个 Skill 的**唯一权威定义（Canonical Skill Manifest）**，并通过 Adapter 层自动生成各 AI 平台所需的安装格式，覆盖 ChatGPT、Gemini、Claude、Claude Code 等主流 AI 客户端和开发者工具。

**核心设计原则：**

- **Canonical Manifest 是 Source of Truth**：DeepRouter 只维护一份 Skill 内部标准定义，OpenAI / Gemini / Claude 所需格式均由 Adapter 层从 Manifest 自动生成，后端不存多份
- **Adapter 层解决平台差异**：每个平台有独立 Adapter，生成该平台原生格式（ChatGPT Custom GPT Action JSON、Gemini Function Declaration、Claude API tool schema、Claude Code SKILL.md 等）
- **执行逻辑永不离开服务端**：`instruction_template` / `execution_handler` 始终在 DeepRouter 服务器运行，不含于任何 Adapter 输出文件
- **API Key 绑定帐号**：每次 tool 调用需有效 DeepRouter API Key，配额从帐号扣减，无法蹭用或转让
- **Live MCP Server**：DeepRouter 同时暴露标准 MCP Server 端点（`/mcp`），支持 Claude / Claude Code / Gemini CLI 等 agent 工具直接 connect，无需手动下载文件

V1 产品闭环：

```text
Admin 创建 Skill（Canonical Manifest：tool schema + 服务端执行逻辑）
→ Admin 通过 admin_preview 端点测试 Skill
→ 发布到 Marketplace
→ 用户浏览、查看、启用 Skill
→ 用户从 Skill Detail 选择平台，下载对应 Adapter 格式
    ChatGPT 用户       → openai-action.json（Custom GPT Action）
    OpenAI 开发者      → openai-tool.json（API function schema）
    Gemini API 开发者  → gemini-function.json（Function Declaration）
    Claude API 开发者  → anthropic-tool.json（Claude tool schema）
    Claude Code 用户   → claude-code.zip（SKILL.md package）
    MCP-compatible 工具 → connect https://deeprouter.ai/mcp
→ 用户在自己的 AI 客户端对话，AI 自动决定调用 Skill tool
→ AI 客户端携带用户 API Key 调用 POST /v1/skills/execute/{skill_id}
→ DeepRouter 验证 API Key → Entitlement / Safety 检查 → 执行 Skill 逻辑
→ 返回统一格式 tool result（含 run_id / status / usage）
→ AI 客户端整合进回答
→ Billing / Analytics 归因
→ Operations 根据 Dashboard 优化
```

---

## 2. Source of Truth

`tasks/01-07` 是当前实现级 PRD 的 Source of Truth。根目录旧版 PRD 只可作为战略背景，不可覆盖模块 PRD 中已经确定的数据模型、API、事件、错误码、权限和 Sprint Gate。

| Domain | Source of Truth | Notes |
|---|---|---|
| 产品范围、P0/P1/P2、角色、旅程 | `01_Functional_Requirements.md` | 如果 WBS 摘要与 FRD 冲突，以 FRD 为准 |
| UX、页面、状态、交互、可访问性 | `02_UX_Design.md` | 前端体验和错误状态以 UX 为准 |
| 数据表、枚举、API、错误 envelope | `03_Data_Model_and_API_Spec.md` | Schema/API 合约以 Data/API 为准 |
| 事件、指标、Dashboard、告警 | `04_Analytics_and_Operations.md` | 必须映射到 Data/API 的表与字段 |
| 安全、RBAC、隐私、NFR、发布门槛 | `05_Security_and_NFR.md` | 安全和非功能要求可阻塞上线 |
| Agent 模块拆分、依赖、Sprint 计划 | `06_Module_Breakdown_WBS.md` | 规划文档，不重新定义 Schema/API |
| CTO 一致性治理、Gate、Go/No-Go | `07_CTO_PRD_Review_Action_Items.md` | 用于最后一致性审查和 Sprint Readiness |

---

## 3. Target Readers

- Product / Growth
- Engineering / Architecture
- Frontend / Design
- Data / Analytics
- Operations / Support
- Security / SRE / QA
- Independent implementation Agents

---

## 4. Module Responsibilities

| File | Responsibility | Primary Agent |
|---|---|---|
| `01_Functional_Requirements.md` | 功能范围、角色权限、用户旅程、生命周期、错误语义、验收标准 | Product / Functional Agent |
| `02_UX_Design.md` | IA、页面职责、组件、状态、空态、错误态、可访问性 | UX / Frontend Agent |
| `03_Data_Model_and_API_Spec.md` | 表结构、枚举、索引、API contract、响应 envelope、迁移策略 | Data/API Agent |
| `04_Analytics_and_Operations.md` | 事件字典、指标公式、Dashboard、告警、数据质量、运营权限 | Data / Analytics / Ops Agent |
| `05_Security_and_NFR.md` | Prompt 保护、Kids Gate、RBAC、隐私、NFR、Kill Switch、发布安全门槛 | Security / SRE Agent |
| `06_Module_Breakdown_WBS.md` | 模块拆分、Agent ownership、依赖、Epic、Sprint sequencing、P0 最小上线闭环 | EM / TPM Agent |
| `07_CTO_PRD_Review_Action_Items.md` | 跨 PRD 一致性、Sprint 0 决策、Readiness Gate、Go/No-Go | CTO Review Agent |

---

## 5. Sprint 0 Decision Baseline

所有模块统一使用 `D-01` 到 `D-08` 作为 Sprint 0 决策编号。旧的局部编号只能作为历史别名，不得作为新的 blocking decision 编号。

| ID | Decision | Default Until Explicitly Changed |
|---|---|---|
| D-01 | Free / Pro / Enterprise plan matrix and free quota | Freeze before entitlement/billing implementation |
| D-02 | Analytics build vs buy | Event schema can proceed; sink/dashboard tool must be chosen before M08/M09 implementation |
| D-03 | Kids release mode | Closed beta/off by default unless Safety/Legal/Product approve GA |
| D-04 | Streaming launch scope | P1 by default; non-streaming path is P0 |
| D-05 | Provider system-boundary allowlist | Explicit approved provider/model list required before production Relay integration |
| D-06 | `instruction_template` encryption mechanism | DB/storage encryption + restricted access; field encryption if available |
| D-07 | Revenue counting statuses | Gross attribution counts positive `charge_status='charged'` by default; net/reconciliation includes append-only refund/void compensation rows as negative adjustments |
| D-08 | Initial official Skill catalog | 3-5 launch Skills with examples and QA checklist |

---

## 6. Cross-Module Consistency Rules

- Any new user-facing blocked state must update FRD, UX, Data/API error code mapping, Analytics block reason, and Security/NFR if safety or billing related.
- Any new event must define producer, trigger, required fields, storage target, privacy rules, dashboard use, and sample payload.
- Any new table or field must update Data/API first, then Analytics and WBS if consumed.
- Any Kids-related change must update FRD, UX, Data/API, Analytics, Security/NFR, and WBS.
- Any billing or revenue change must update Data/API, Analytics, Security/NFR, and WBS.
- Any streaming change must be explicitly marked P1 or launch P0 and must update Relay, Safety, Billing, Analytics, and NFR.
- WBS can sequence work but must not override product scope, schema, API, error codes, or event contracts.

---

## 7. Sprint Ready Rule

The PRD set can be treated as Sprint Ready when:

1. `01-07` have no unresolved contradiction on V1 scope, role permissions, data model, API, events, billing, Kids, streaming, and security gates.
2. Sprint 0 decisions `D-01` to `D-08` are either closed or accepted with defaults in `07_CTO_PRD_Review_Action_Items.md`.
3. Conditional P0 scope is explicitly enabled or disabled for launch.
4. Analytics event fields map to `03_Data_Model_and_API_Spec.md`.
5. Security/NFR launch gates are reflected in WBS and module acceptance criteria.

---

## 8. Relationship to Other Folders

| Location | Role |
|---|---|
| `tasks/` | Current implementation-ready modular PRD source of truth |
| `compliance/` | Compliance-specific release checks and independent risk controls |
| Root PRD files | Strategy/history only unless explicitly updated to mirror `tasks/01-07` |
