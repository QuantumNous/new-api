# Skill Marketplace Functional Requirements

本文档定义 DeepRouter Skill Marketplace V1 的企业级功能需求。目标是让 Product、Engineering、Design、QA、Operations 和独立 Agent 能按同一口径理解范围、权限、状态、异常路径和验收标准。

---

## 1. Scope

### 1.1 V1 Product Scope

V1 仅支持 **官方 curated Skills**。终端用户不能创建、上传或复制 Skill 执行逻辑。Skill 的核心执行逻辑（`execution_handler`）必须由服务端托管，永不暴露给客户端。

**V1 核心范式：Skills 是可安装的跨平台 API Tool，不是 Prompt 模板。**

DeepRouter 后端维护每个 Skill 的 **Canonical Skill Manifest**（唯一内部定义：`tool_function_name` + `tool_input_schema` + `tool_output_schema` + `execution_handler`），并通过 **Adapter 层**自动生成各平台所需格式。用户只需从 Marketplace 启用 Skill，选择自己使用的 AI 平台，下载或 connect 对应的 Adapter 输出即可。每次 AI 调用 Skill 时，请求打到 DeepRouter 服务端，需要有效 API Key，执行配额从用户帐号扣减。

**用户使用 Skill 只有一条路：通过 Adapter（下载安装包或 connect MCP Server），在自己的 AI 客户端中调用。** DeepRouter 不提供内置 Skill 执行 Playground 给普通用户。Playground 仅供 Admin 在发布前测试 Skill（`admin_preview` 路径）。

V1 必须交付以下闭环：

```text
Admin 创建 Skill（Canonical Manifest：tool schema + 服务端执行逻辑）
→ Admin 通过 admin_preview 端点测试 Skill（不对用户开放）
→ 发布到 Marketplace
→ 用户浏览 / 查看详情 / 启用
→ 用户选择平台并获取 Adapter：
    - ChatGPT 用户       → 下载 openai-action.json，安装到 Custom GPT Action
    - OpenAI API 开发者  → 下载 openai-tool.json，集成到自己的 app
    - Gemini API 开发者  → 下载 gemini-function.json，集成到 Gemini app
    - Claude API 开发者  → 下载 anthropic-tool.json，集成到 Claude app
    - Claude Code 用户   → 下载 claude-code.zip（含 SKILL.md），安装到本地 Claude Code
    - MCP-compatible 工具 → connect https://deeprouter.ai/mcp（live MCP Server）
→ 用户在自己的 AI 客户端对话，AI 自动决定调用 Skill tool
→ AI 客户端携带用户 API Key 调用 POST /v1/skills/execute/{skill_id}
→ DeepRouter 验证 API Key → Entitlement / Safety 检查 → 执行 Skill 逻辑
→ 返回统一格式 tool result（含 run_id / status / usage）
→ AI 客户端整合进回答
→ Billing / Analytics 归因
→ Operations 根据数据优化
```

### 1.2 In Scope

| Area | V1 Requirement | Priority |
|---|---|---|
| Skill Supply | Super Admin 创建、编辑、预览、发布、归档官方 Skill | P0 |
| Marketplace | 用户浏览、搜索、查看详情、启用、停用 Skill | P0 |
| My Skills | 用户查看已启用 Skill 及可用/锁定状态 | P0 |
| Canonical Skill Manifest | 后端维护每个 Skill 的唯一内部标准（tool schema + execution metadata）；所有 Adapter 从此生成 | P0 |
| Adapter Layer — ChatGPT | 生成 openai-action.json（Custom GPT Action）和 openai-tool.json（API function schema） | P0 |
| Adapter Layer — Gemini | 生成 gemini-function.json（Gemini API Function Declaration） | P0 |
| Adapter Layer — Claude | 生成 anthropic-tool.json（Claude API tool schema）和 MCP connector config | P0 |
| Adapter Layer — Claude Code | 生成 claude-code.zip（含 SKILL.md、allowed-tools、examples） | P0 |
| Live MCP Server | 暴露 GET/POST /mcp 端点；支持 Claude / Claude Code / Gemini CLI 直接 connect，无需下载 | P0 |
| Multi-Platform Install Guides | Skill Detail 页面提供各平台安装步骤（Copy URL / Download / CLI command） | P0 |
| External API Invocation | 接收来自外部 AI 客户端的 tool call 请求；验证 API Key 并执行 Skill；这是用户使用 Skill 的唯一路径 | P0 |
| Admin Preview | Admin 在发布前通过 admin_preview 端点测试 Skill；不对普通用户开放 | P0 |
| Skill Execution | 服务端执行 Skill 逻辑，客户端只见 tool result，不见执行逻辑 | P0 |
| API Key Binding | tool spec 配合用户 API Key 使用；无有效 Key 则 tool 调用失败；API Key 可绑定 Skill 范围 | P0 |
| Entitlement | 每次 tool 调用前检查订阅、计划、quota、Skill 状态 | P0 |
| Billing Attribution | Skill 执行事件可归因到 Skill、版本、用户、计划、入口（external_ai_client / admin_preview） | P0 |
| Analytics | 关键生命周期事件和 Data Entry Point | P0 |
| Operations | 最小运营 Dashboard：Top、Blocked、Funnel、Revenue | P0 |
| Kids Safety | 服务端 Kids Session 判断、Kids Safe 拦截、审批要求 | P0 if Kids enabled |
| Audit | Admin 关键写操作进入 audit log | P0 |
| Feature Flag | Marketplace 可灰度开启和快速关闭 | P0 |

### 1.3 Out of Scope

| Item | V1 Decision | Target |
|---|---|---|
| 用户 Playground 内执行 Skill | 不支持；用户只能通过下载 tool spec 安装到外部 AI 客户端使用；Playground 仅供 Admin 测试 | V2 可评估 |
| 用户自建 Skill | 不支持 | V2 |
| Creator Marketplace / 分成 | 不支持 | V2 |
| 执行逻辑下载 | 永不支持；tool spec 可下载但不含执行逻辑 | N/A |
| 多 Skill 叠加 | 不支持；一次仅一个 active Skill | V2+ |
| 复杂多步骤 Workflow / Agent Chain | 不支持；V1 Skill 为单次 tool call | V2 |
| 本地 MCP Server 代码下载（用户自托管服务端） | 不支持；V1 仅 DeepRouter 云端托管 MCP Server（/mcp endpoint），用户 connect 即用 | V2 |
| 社区评分评论 | 不支持 | V2 |
| 完整推荐算法 | 不支持；V1 仅规则推荐 | V1.1/V2 |
| A/B Experiment UI | 不作为 V1 P0 | V1.1 |
| 完整 Sharing / Referral | 不作为 V1 P0 | V1.1 |

### 1.4 Sprint 0 Decisions Required Before Sprint 1

All Sprint 0 decisions must use the canonical `D-01` to `D-08` IDs defined in `06_Module_Breakdown_WBS.md` and governed in `07_CTO_PRD_Review_Action_Items.md`. Historical local IDs must not be used as independent blocking decision IDs.

| ID | Decision | Owner | Deadline | Blocking |
|---|---|---|---|---|
| D-01 | Free / Pro / Enterprise plan matrix and Free Skill monthly quota | CEO + Product | Sprint 0 | Entitlement, Billing, UI lock states |
| D-02 | Analytics build vs buy, event sink, and dashboard source | EM + Product | Sprint 0 | Event pipeline, Dashboard |
| D-03 | Kids release mode: GA P0, closed beta, or disabled by default | Product + Safety + Legal | Sprint 0 | Kids Safety, Compliance, UX visibility |
| D-04 | Streaming launch scope and partial-output billing behavior | Product + Engineering + Finance | Sprint 0 | Relay, Safety, Billing, NFR |
| D-05 | Provider/model system-boundary allowlist | Security + Engineering | Sprint 0 | Relay provider integration, model whitelist |
| D-06 | `instruction_template` encryption mechanism | Security + Backend | Sprint 0 | Production data protection |
| D-07 | Revenue counting statuses | Finance + Data | Sprint 0 | Revenue attribution dashboard |
| D-08 | Initial official Skill catalog | Product + Ops | Sprint 0 | Content QA, launch readiness |

---

## 2. Roles & Permissions

### 2.1 Role Definitions

| Role | Definition |
|---|---|
| Anonymous Visitor | 未登录访客，可查看公开 Marketplace 信息，但不能启用或执行 Skill |
| Normal User | 登录用户，可浏览、启用、停用、使用符合权限的 Skill |
| Operation | 运营人员，可查看运营数据、创建 review、标记问题、处理质量反馈 |
| Safety Reviewer | 安全审核人员，可审批 Kids Safe / Kids Exclusive 发布条件 |
| Product / Growth | 产品和增长人员，可查看指标、管理推荐策略，不可查看 `instruction_template` |
| Super Admin | 平台最高权限，可管理 Skill 内容、版本、发布、归档、Kids 标记和审计 |
| Support | 客服人员，可查看有限诊断信息和用户反馈，不可查看 prompt 或敏感内容 |

### 2.2 Permission Matrix

| Capability | Anonymous | Normal User | Operation | Safety Reviewer | Product/Growth | Support | Super Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Browse published Skills | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| View Skill Detail | Public fields only | Yes | Yes | Yes | Yes | Yes | Yes |
| Enable / Disable Skill | No | Yes | No | No | No | No | Yes for support action only |
| Execute Skill in Playground | No | Yes | No | No | No | No | Yes for preview/test |
| View My Skills | No | Own only | No | No | No | Assisted user status only | Any user if audited |
| View Analytics aggregate | No | No | Yes | Safety only | Yes | Limited | Yes |
| View user-level analytics | No | Own only if exposed | No by default | No | No | Limited support view | Yes with audit |
| Export CSV | No | No | P1, aggregate only | No | P1, aggregate only | No | Yes |
| Create / edit Skill metadata | No | No | No | No | No | No | Yes |
| View `instruction_template` | No | No | No | No | No | No | Yes only |
| Edit `instruction_template` | No | No | No | No | No | No | Yes only |
| Preview Skill | No | No | No | Safety preview only | No | No | Yes |
| Publish / Archive / Deprecate | No | No | No | No | No | No | Yes |
| Approve Kids Safe | No | No | No | Yes | No | No | Yes only with reviewer role or emergency override |
| View audit log | No | No | No | Own approvals only | No | No | Yes |

### 2.3 Permission Rules

- `instruction_template` must never be visible to Normal User, Operation, Product/Growth, Support, or Anonymous users.
- Operation can create and manage `skill_reviews`, but cannot edit Skill content.
- Safety Reviewer can approve Kids-related safety checks, but cannot publish a Skill unless also Super Admin.
- Super Admin emergency override must create an audit log entry with reason.
- Support diagnostics must not expose prompt, full user input, Kids sensitive data, or provider raw logs.

---

## 3. Primary User Journeys

### 3.1 Admin Creates and Publishes Official Skill

1. Super Admin opens Skill Management.
2. Super Admin creates draft Skill.
3. Super Admin fills required metadata: name, category, short description, description, tags, input hints, examples.
4. Super Admin configures entitlement: `required_plan`, `monetization_type`, quota, markup, and `max_input_tokens` when the Skill is Free or free-quota eligible.
5. Super Admin configures execution: `instruction_template`, output format, model whitelist, timeout.
6. Super Admin runs Preview Test at least once.
7. If Kids flags are enabled, Safety Reviewer approval is required before publish.
8. Super Admin publishes Skill.
9. Published Skill appears in Marketplace according to visibility rules.
10. `skill_admin_action` and `skill_version_created` events are recorded where applicable.

### 3.2 User Discovers and Enables Skill

1. User visits Marketplace.
2. Marketplace emits `skill_impression` for visible cards.
3. User opens Skill Detail.
4. System emits `skill_detail_view`.
5. Detail page displays plan requirement, example input/output, safety labels, and CTA.
6. If user is anonymous, Enable CTA routes to login.
7. If user is logged in, user can enable allowed visible Skill.
8. System creates or updates `user_enabled_skills`.
9. System emits `skill_enabled`.

### 3.3 Admin Previews Skill Before Publish

> 此路径仅供 Super Admin 测试，不对普通用户开放。普通用户没有在 DeepRouter 内执行 Skill 的路径。

1. Super Admin 创建 Skill draft 并填写 `tool_function_name`、`tool_input_schema`、`instruction_template`。
2. Super Admin 调用 Admin Preview 端点（`POST /api/v1/admin/skills/{skill_id}/preview`）测试 Skill。
3. Relay 执行 Skill 逻辑服务端，返回 tool result 供 Admin 验证。
4. 确认输出正确后，Admin 通过 Publish Checklist 发布 Skill。
5. 系统记录 `skill_admin_action`，`entry_point=admin_preview`。

### 3.4 User Downloads Tool Spec and Executes Skill via External AI Client

1. User enables a Skill in Marketplace.
2. User visits Skill Detail page and clicks "Download / Install".
3. System generates the Skill's tool spec in OpenAPI or MCP format.
   - Spec contains: tool name, description, input/output JSON schema, and the DeepRouter Skill API endpoint URL.
   - Spec does **not** contain: execution logic, `instruction_template`, or any server-side implementation.
4. User installs the tool spec into their AI client (ChatGPT Custom Action, Gemini Function Tool, Claude MCP, etc.).
   - DeepRouter provides one-click install guides for each platform.
5. User adds their DeepRouter API Key to the AI client's tool authentication config.
6. User starts a conversation in their AI client.
7. AI client decides to call the Skill tool (based on the tool description and user's message).
8. AI client sends HTTP request to DeepRouter Skill API endpoint, carrying the user's API Key in the `Authorization` header.
9. DeepRouter Relay authenticates the API Key, resolves user identity and entitlement.
10. DeepRouter executes Skill logic server-side.
11. DeepRouter returns `tool_result` JSON to the AI client.
12. AI client integrates the tool result into its response to the user.
13. Billing and analytics events are emitted with `entry_point=external_ai_client`.

> **Copy protection**: The tool spec points to DeepRouter's API endpoint and requires a valid, account-bound API Key. Sharing the tool spec file gives recipients only the schema — they cannot call DeepRouter's API without a valid Key. Sharing the API Key itself violates Terms of Service and Keys can be revoked per-user.

### 3.5 User Membership Expires

1. Skill remains visible in My Skills.
2. Skill may show locked/renewal state.
3. User attempts execution.
4. Relay performs use-time entitlement check.
5. Request is blocked with `SKILL_SUBSCRIPTION_INACTIVE` or `SKILL_PLAN_REQUIRED`.
6. UI displays renew / upgrade CTA.
7. System emits `skill_blocked`.
8. No charge is created.

### 3.6 Kids Session Attempts Unsafe Skill

1. User is in server-resolved Kids Session.
2. User views Marketplace or Playground.
3. Non-`is_kids_safe` Skills must be hidden, disabled, or blocked.
4. If a direct request attempts execution, Relay blocks before injection.
5. System emits `skill_blocked` with `block_reason=kids_mode_blocked`.
6. No prompt, input, or sensitive Kids content is persisted.

---

## 4. Functional Requirements by Module

### 4.1 Super Admin: Skill Management

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-A1 | Create Skill draft | P0 | Draft is not visible to end users |
| FR-A2 | Edit Skill metadata | P0 | Includes name, category, tags, descriptions, input hints, examples |
| FR-A2a | Define tool function schema | P0 | Super Admin sets `tool_function_name`（JSON-safe identifier，e.g. `contract_review_analyze`）、`tool_input_schema`（JSON Schema）、`tool_output_schema`（JSON Schema）；这三个字段是生成 OpenAPI / MCP tool spec 的唯一来源；`tool_function_name` 不得含空格或特殊字符；Admin UI 必须提供字段校验和实时预览 tool spec 片段 |
| FR-A2b | Preview tool spec before publish | P0 | Admin 可在发布前预览该 Skill 将生成的 OpenAPI / MCP spec 内容，确认 schema 正确；preview 不触发下载计数 |
| FR-A3 | Edit `instruction_template` | P0 | Super Admin only; creates new version when changed |
| FR-A4 | Preview Skill | P0 | Preview executes against draft/version without public visibility |
| FR-A5 | Publish Skill | P0 | Requires mandatory fields and safety checks |
| FR-A6 | Archive Skill | P0 | Archived Skill cannot be discovered, enabled, or executed |
| FR-A7 | Deprecate Skill | P1 | Hidden from new users; enabled users may continue execution |
| FR-A8 | Mark Skill as Featured | P1 | Uses `featured_flag`, not lifecycle status |
| FR-A9 | Set `required_plan` | P0 | Values: free, pro, enterprise |
| FR-A10 | Set monetization fields | P0 | Includes type, markup, free quota when applicable |
| FR-A10a | Set Skill input token cap | P0 | `max_input_tokens` required for Free Skills or free-quota execution paths |
| FR-A11 | Set model whitelist | P0 | Relay must enforce whitelist |
| FR-A12 | Mark Kids Safe | P0 if Kids enabled | Requires Safety Reviewer approval |
| FR-A13 | Mark Kids Exclusive | P0 if Kids enabled | Requires Safety Reviewer approval |
| FR-A14 | View version history | P1 | Version metadata visible; template visible only to Super Admin |
| FR-A15 | View audit log | P0 | All writes show actor, timestamp, action, changed fields, reason |
| FR-A16 | Manage publish checklist | P0 | Blocks publish if required checklist items fail；checklist 必须包含：`tool_function_name` 非空、`tool_input_schema` 合法 JSON Schema、`instruction_template` 非空、`active_version_id` 存在 |
| FR-A17 | Run jailbreak / leakage tests | P1; P0 if Kids enabled or Security requires launch gate | Required before Kids publish; Security/NFR owns mandatory launch test suite |
| FR-A18 | Manage beta whitelist | P1 | Used for rollout stages |

### 4.2 End User: Marketplace

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-U1 | Browse published Skills | P0 | Only public fields returned |
| FR-U2 | View Skill Detail | P0 | Shows examples, plan, labels, CTA, AI disclosure |
| FR-U3 | Enable Skill | P0 | Login required; archived/draft cannot be enabled; deprecated cannot be newly enabled or re-enabled after disable |
| FR-U4 | Disable Skill | P0 | Existing usage history remains |
| FR-U5 | View My Skills | P0 | Shows enabled Skills, status, lock reason, last used |
| FR-U6 | See locked Skill state | P0 | Shows upgrade/renew/contact-sales CTA |
| FR-U7 | Download Tool Spec from Detail | P0 | 启用后在 Skill Detail 显示 Download Tool Spec CTA，提供 OpenAPI / MCP 格式及平台安装引导 |
| FR-U8 | Search Skill name/description | P1 | Does not search hidden prompt |
| FR-U9 | Filter by category | P1 | Category list excludes empty unpublished categories |
| FR-U10 | Anonymous public browsing | P1 | Anonymous cannot see enabled state; CTA routes to login |
| FR-U11 | Submit output feedback | P2 | Creates review signal, not public rating |
| FR-U12 | View Kids-compatible Skills | P0 if Kids enabled | Kids Session only sees safe or exclusive allowed Skills |
| FR-U13 | Handle unavailable Skill | P0 | Shows friendly unavailable message for archived/deprecated cases |

### 4.3 ~~Playground Skill Picker~~ — 已从 V1 移除

> 普通用户没有在 DeepRouter Playground 内执行 Skill 的路径。Playground Skill Picker 不在 V1 范围内。Playground 仅用于 Admin 发布前的 Preview 测试（admin_preview 路径），不是用户功能。

### 4.4 Relay / Gateway Execution

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-G1 | Accept active `skill_id` from external AI clients | P0 | `skill_id` 来自 URL path（`/v1/skills/execute/{skill_id}`）；Playground Skill Picker 不在用户路径内；admin_preview 端点独立 |
| FR-G2 | Resolve authenticated user, tenant, session | P0 | Anonymous execution is not allowed |
| FR-G3 | Resolve Kids Session server-side | P0 if Kids enabled | Client field ignored |
| FR-G4 | Load immutable execution context | P0 | Snapshot includes skill, version, plan, model whitelist, `max_input_tokens`, monetization, template |
| FR-G5 | Validate Skill lifecycle status | P0 | Draft/archived blocked; deprecated follows special rules |
| FR-G6 | Validate `user_enabled_skills` | P0 | Required for published/deprecated execution |
| FR-G7 | Perform use-time entitlement check | P0 | No permanent authorization from enable action |
| FR-G8 | Enforce model whitelist | P0 | Disallowed model is rerouted or blocked per policy |
| FR-G9 | Enforce precedence | P0 | `kids_mode > tenant_policy > platform_policy > skill > user message` |
| FR-G10 | Inject `instruction_template` server-side | P0 | Never sent to client |
| FR-G11 | Redact template from logs/errors/events | P0 | Applies to API logs, provider errors, billing, analytics |
| FR-G12 | Estimate context size before provider call | P0 | Friendly error or safe truncation before provider 400 |
| FR-G13 | Enforce rate limits | P0 | User/IP/Skill dimensions; returns 429 + Retry-After |
| FR-G14 | Enforce timeout | P0 | Graceful timeout error; no hanging requests |
| FR-G15 | Emit usage and blocked events | P0 | Includes block reason and entry point |
| FR-G16 | Support non-Skill API compatibility | P0 | Existing non-Skill calls remain unchanged |
| FR-G17 | Support streaming safety and billing semantics | P1 unless streaming is launch P0 | Must define usage vs charge behavior |
| FR-G18 | Use cache and singleflight for metadata/entitlement | P1/P0 for scale launch | Cluster AC: at most N DB queries where N = relay instances |
| FR-G19 | Enforce stateless single-turn execution | P0 | Relay must not forward prior-turn conversation history to provider; each Skill request is an independent, self-contained call; `input_tokens` billed = instruction_template tokens + current user input tokens only; client UI conversation display does not constitute server-side multi-turn context; if client sends history fields they must be stripped at Relay entry |

### 4.5 Entitlement / Membership

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-E1 | Support `required_plan` | P0 | free, pro, enterprise |
| FR-E2 | Check active subscription at execution time | P0 | Expired subscription blocks next call |
| FR-E3 | Check plan hierarchy | P0 | Enterprise satisfies pro unless overridden |
| FR-E4 | Support Free Skill monthly quota | P0 if free quota is adopted | Quota exceeded returns 429 with reset time when available |
| FR-E4a | Enforce free-path input token cap | P0 if free quota is adopted | Free Skill/free-quota requests must respect the active version `max_input_tokens` snapshot before provider call |
| FR-E5 | Return standard block reason | P0 | See Section 8 |
| FR-E6 | UI receives lock state | P0 | Marketplace, Detail, My Skills; quota locks include reset guidance and upgrade CTA where Product approved |
| FR-E7 | Admin can change entitlement config | P0 | Change is audited; existing enabled users are checked at use time |
| FR-E8 | Support Enterprise contact-sales state | P1 | CTA does not imply entitlement |

### 4.6 Billing

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-B1 | Usage event includes Skill attribution | P0 | `skill_id`, `skill_version_id`, entry point |
| FR-B2 | Billing event includes monetization fields | P0 | type, markup, required plan |
| FR-B3 | Blocked calls create no charge | P0 | Still create analytics event |
| FR-B4 | Failed calls create no charge by default | P0 | Non-streaming/no-output failures do not charge; streaming timeout after usable partial output follows Finance-approved actual-token settlement |
| FR-B5 | Revenue can be grouped by Skill | P0 | Required for dashboard |
| FR-B6 | Revenue can be sliced by plan/persona/entry point | P1 | Required for growth analysis |
| FR-B7 | Distinguish usage, billing, and charge events | P1/P0 if streaming launch | Prevent refund ambiguity |
| FR-B8 | Support idempotency key for charge | P1/P0 if streaming launch | Prevent double billing |

### 4.7 Analytics & Data Entry

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-D1 | Emit `skill_impression` | P0 | Marketplace cards and recommendation surfaces |
| FR-D2 | Emit `skill_detail_view` | P0 | Includes entry point |
| FR-D3 | Emit `skill_enabled` / `skill_disabled` | P0 | Includes source |
| FR-D4 | Emit `skill_first_use` | P0 | First successful execution per user/skill |
| FR-D5 | Emit `skill_used` | P0 | Every successful execution |
| FR-D6 | Emit `skill_repeat_use` | P0 | Subsequent use after first |
| FR-D7 | Emit `skill_blocked` | P0 | Includes standard block reason |
| FR-D8 | Emit admin actions | P0 | Skill create/update/publish/archive/kids approval |
| FR-D9 | Emit safety events | P0 if Kids enabled | `skill_safety_violation` with stage |
| FR-D10 | Every entry point has `entry_point` | P0 | No null / unknown for launch paths; valid values: `external_ai_client`（用户唯一执行路径）、`admin_preview`（Admin 测试）、`api_direct`（保留） |
| FR-D11 | Sensitive content not persisted | P0 | No prompt, no Kids sensitive input |
| FR-D12 | Aggregation API supports dashboard | P0 | Overview, funnel, skill table |

### 4.8 Operations Dashboard & Review

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-O1 | Show Top Skills | P0 | By usage and successful executions |
| FR-O2 | Show blocked attempts | P0 | By skill, reason, plan |
| FR-O3 | Show funnel | P0 | Impression to detail to enable to first use |
| FR-O4 | Show basic revenue attribution | P0 | By skill and plan |
| FR-O5 | Show one-time and repeat usage | P1 | Sticky vs one-time |
| FR-O6 | Filter by plan/persona/channel/date | P1 | Persona may be coarse |
| FR-O7 | Create `skill_review` | P1 | Manual Ops trigger plus automated safety threshold trigger defined in Analytics/Ops |
| FR-O8 | Assign / resolve / escalate review | P1 | Operation workflow |
| FR-O9 | CSV export | P2 | Aggregate only unless Super Admin |

### 4.9 Recommendation & Discovery

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-R1 | Featured rail | P1 | Controlled by featured flags |
| FR-R2 | Popular rail | P1 | Based on recent successful usage |
| FR-R3 | New rail | P1 | Recently published Skills |
| FR-R4 | Recommended Lite | P1 | Persona/category rules only |
| FR-R5 | Exclude archived/deprecated from recommendations | P0 | Deprecated may appear only in My Skills |
| FR-R6 | Recommendation surfaces emit events | P1 | Impression/click/conversion |

### 4.10 Support & Incident

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-S1 | Support can diagnose enabled/locked state | P1 | No prompt exposure |
| FR-S2 | Support can see error code and request id | P1 | No raw provider payload |
| FR-S3 | Prompt leakage incident can force archive Skill | P0 | Super Admin action with audit |
| FR-S4 | Feature flag can disable Marketplace | P0 | Data retained |

### 4.11 Canonical Manifest and Adapter Distribution

#### Canonical Skill Manifest

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-T1 | 后端维护 Canonical Skill Manifest 作为唯一 Source of Truth | P0 | Manifest 包含：`tool_function_name`、`tool_input_schema`（JSON Schema）、`tool_output_schema`（JSON Schema）、`description`、`execution.endpoint`、`execution.auth`；不包含 `instruction_template` |
| FR-T2 | Admin 创建 Skill 时必须定义完整 Manifest 字段才能发布 | P0 | `tool_function_name` 非空、`tool_input_schema` 合法 JSON Schema；Publish Checklist 强制检查 |
| FR-T3 | Manifest 字段变更时所有 Adapter 输出自动失效并重新生成 | P0 | 修改 `tool_input_schema` 或 `tool_function_name` 时设置 `tool_spec_invalidated_at = now()`；缓存的 Adapter 文件必须在下次请求时重新生成 |

#### Platform Adapters

| ID | Adapter | 生成格式 | 适用用户 | Priority |
|---|---|---|---|---|
| FR-T4 | ChatGPT Custom GPT Action | `openai-action.json`（OpenAPI 3.1 schema + servers + auth） | ChatGPT 普通用户，安装到 Custom GPT | P0 |
| FR-T5 | OpenAI API Function Schema | `openai-tool.json`（OpenAI function calling JSON） | OpenAI API 开发者，集成到自己 app | P0 |
| FR-T6 | Gemini API Function Declaration | `gemini-function.json`（Gemini functionDeclarations 格式） | Gemini API 开发者 | P0 |
| FR-T7 | Claude API Tool Schema | `anthropic-tool.json`（Anthropic tool use format，含 `strict:true`） | Claude API 开发者 | P0 |
| FR-T8 | Claude Code Skill Package | `claude-code.zip`（含 `.claude/skills/<name>/SKILL.md` + `allowed-tools` + examples） | Claude Code 用户 | P0 |
| FR-T9 | MCP Connector Config | `mcp-config.json`（标准 MCP remote server config，含 `type: url`、auth 配置） | 所有支持 MCP 的工具 | P0 |

#### Adapter Endpoint

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-T10 | 每个 Adapter 有独立下载端点 | P0 | `GET /v1/skills/{skill_id}/adapters/{format}`；format 枚举：`openai-action`、`openai-tool`、`gemini-function`、`anthropic-tool`、`claude-code`、`mcp-config` |
| FR-T11 | 下载端点需认证；仅 enabled 用户可下载 | P0 | 未 enable 或 API Key 无效返回 403 |
| FR-T12 | 所有 Adapter 输出不得包含 `instruction_template`、API Key 或执行逻辑 | P0 | Security gate；launch 前须经安全审查确认；API Key 须由用户在各客户端单独配置 |
| FR-T13 | Skill Detail 页面分平台展示安装引导（5 个 Tab） | P0 | Tab：ChatGPT Custom GPT / OpenAI API / Gemini / Claude / Claude Code；每 Tab 含下载按钮 / Import URL / CLI install command + 步骤说明 |
| FR-T13a | ChatGPT Tab 同时提供 Import URL 和 Download JSON 两种方式 | P0 | Import URL 方式：用户粘贴 URL，ChatGPT 自动拉取 schema；Skill schema 更新后用户无需重新下载 |
| FR-T13b | ChatGPT Tab 说明认证方式：MVP 为 API Key Bearer；P1 支持 OAuth | P1 | OAuth 版：用户点击「Connect DeepRouter Account」完成 OAuth 授权，ChatGPT 自动携带 token；无需手动填 Key |
| FR-T13c | Claude Code Tab 显示带 `--header` 的完整 MCP install command | P0 | `claude mcp add --transport http deeprouter https://deeprouter.ai/mcp --header "Authorization: Bearer <key>"`；不得省略 `--header` 参数 |
| FR-T14 | Adapter 下载或 Import URL 复制触发 analytics 事件 | P1 | `skill_spec_downloaded`，含 `adapter_format`、`install_method`（download/import_url）、`skill_id`、`user_id` |

#### Live MCP Server

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-T15 | DeepRouter 暴露 live MCP Server 端点（HTTP，JSON-RPC 2.0） | P0 | `GET /mcp`（capability discovery，tools/list）+ `POST /mcp`（tool call，tools/call）；遵循 MCP 2024-11-05 Streamable HTTP 协议 |
| FR-T16 | MCP Server 列出用户已 enabled 的所有 Skill | P0 | `GET /mcp` 返回该 API Key 对应用户所有 `enabled=true` Skill 的 tool 列表；未 enabled 的 Skill 不出现 |
| FR-T17 | MCP tool call 走统一执行链 | P0 | `POST /mcp` 内部路由到 `/v1/skills/execute/{skill_id}`；相同 Entitlement / Safety / Billing / Kids 检查 |
| FR-T18 | MCP 认证 MVP 为 API Key Bearer；P1 支持 MCP OAuth flow | P0/P1 | MVP：`Authorization: Bearer <api_key>`；P1：`/mcp` 返回 401 + `WWW-Authenticate`，Claude Code 内触发 `/mcp` OAuth 登录 flow |
| FR-T19 | MCP 响应使用 JSON-RPC 2.0 envelope；同时提供 `content` 和 `structuredContent` | P0 | `content[0].text` 为序列化 JSON（兼容旧客户端）；`structuredContent` 为结构化对象（新客户端优先）；`isError` 字段必须 |

### 4.12 API Key Binding and Copy Protection

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-K1 | Tool spec API endpoint requires `Authorization: Bearer <api_key>` | P0 | Anonymous calls return 401 `AUTH_REQUIRED` |
| FR-K2 | API Key is bound to user account | P0 | Key cannot be transferred; quota and entitlement always checked against the Key owner |
| FR-K3 | API Key can be scoped to specific Skills | P1 | Admin or user can restrict a Key to a Skill ID allowlist |
| FR-K4 | API Key can be revoked immediately | P0 | Revoked Key returns 401 on all subsequent calls |
| FR-K5 | Tool spec sharing does not grant access | P0 | Spec file alone is useless without a valid Key; recipients get 401 if they call the endpoint |
| FR-K6 | API Key rate limiting is per-Key | P0 | Prevent one shared Key from exceeding quota for the account |
| FR-K7 | API Key audit log records creation, scope change, and revocation | P0 | Super Admin can view Key events for a user |

---

## 5. Lifecycle & State Machine

### 5.1 Skill Status

`featured` is not a lifecycle status. It is a promotion flag.

| Status | Discoverable | Enableable | Executable by already-enabled user | Editable | Notes |
|---|---:|---:|---:|---:|---|
| `draft` | No | No | No | Yes | Admin only |
| `published` | Yes | Yes | Yes | Metadata editable; template creates new version | Normal live state |
| `deprecated` | No for new users | No for new users or disabled prior users | Yes only when `user_enabled_skills.enabled=true` at use time | Limited | Used for phase-out; disabled users cannot re-enable unless Super Admin republishes |
| `archived` | No | No | No | No except restore metadata by Super Admin | Hard unavailable |

### 5.2 Promotion Flags

| Field | Purpose |
|---|---|
| `featured_flag` | Whether Skill appears in Featured rail |
| `featured_rank` | Manual ordering among featured Skills |
| `popular_rank` | Derived or cached ranking, not manually required |

### 5.3 State Transitions

| From | To | Allowed By | Conditions |
|---|---|---|---|
| none | draft | Super Admin | Required minimal metadata |
| draft | published | Super Admin | Publish checklist passed |
| published | deprecated | Super Admin | Reason required |
| deprecated | published | Super Admin | Re-review required if template changed |
| published | archived | Super Admin | Reason required |
| deprecated | archived | Super Admin | Reason required |
| archived | draft | Super Admin | Rework path; must republish |

### 5.4 Versioning Rules

- Editing display metadata does not require a new `skill_version`.
- Editing `instruction_template`, output schema, model whitelist, or safety-critical execution fields creates a new `skill_version`.
- Execution must use an immutable snapshot selected at request entry.
- Usage, billing, and analytics events must include `skill_version_id`.
- Deprecated Skills can receive safety or quality patch versions.
- If a Super Admin edits `instruction_template`, model whitelist, output schema, or safety-critical execution fields on a `deprecated` Skill, the new version must be activated immediately for all already-enabled, still-entitled users who retain execution rights.
- Deprecated Skill patch activation must not make the Skill discoverable or enableable by new or previously disabled users.
- If the patch cannot be safely activated for existing users, the Skill must be archived or disabled through kill switch rather than leaving vulnerable deprecated versions executable.

---

## 6. Entitlement Decision Table

| User / Session | Skill | Subscription | Enabled? | Expected Result | Block Reason |
|---|---|---|---:|---|---|
| Anonymous | Any | None | No | Login required before enable/use | `AUTH_REQUIRED` |
| Free user | Free Skill | Active/free | Yes | Allow if quota available | None |
| Free user | Free Skill | Active/free | Yes | Block if quota exceeded | `quota_exceeded` |
| Free user | Pro Skill | Active/free | Any | Block + upgrade CTA | `plan_required` |
| Pro user | Pro Skill | Active/pro | Yes | Allow | None |
| Pro expired | Pro Skill | Inactive | Yes | Block + renew CTA | `subscription_inactive` |
| Enterprise user | Pro Skill | Active/enterprise | Yes | Allow | None |
| Non-enterprise | Enterprise Skill | Active/free or pro | Any | Block + contact sales CTA | `plan_required` |
| Any logged-in user | Published Skill | Active | No | Block execution; allow enable if entitled | `skill_not_enabled` |
| Any logged-in user | Draft Skill | Any | Any | Block | `skill_not_published` |
| Any logged-in user | Archived Skill | Any | Any | Block | `skill_not_published` |
| New user | Deprecated Skill | Active | No | Not discoverable / cannot enable | `skill_not_published` |
| Existing enabled user | Deprecated Skill | Active and entitled | Yes | Allow with warning | None |
| Existing disabled user | Deprecated Skill | Active | No | Cannot re-enable; show unavailable/retired state | `skill_not_published` |
| Kids Session | Non-Kids-Safe Skill | Any | Any | Block before injection | `kids_mode_blocked` |
| Normal Session | Kids Exclusive Skill | Any | Any | Block or hide | `kids_mode_blocked` |

---

## 7. Kids Safety Requirements

Kids functionality must be treated as a safety-critical path. If Kids Mode is not resourced for P0, it must be disabled by default or released as closed beta.

### 7.1 Hard Requirements

- Relay must resolve `is_kids_session` from authenticated user/session state.
- Client-provided `is_kids_session` in headers or body must be ignored.
- Kids Session can execute only `is_kids_safe=true` Skills.
- Normal Session cannot execute `is_kids_exclusive=true` Skills unless explicitly configured for family mode.
- Kids Skill publish requires Safety Reviewer approval.
- Kids model/provider pool must support approved DPA, no-training, and ZDR/no-retention mode before use.
- Kids request logs must not persist sensitive child input.
- Kids safety block must happen before `instruction_template` injection.
- Safety events must not expose sensitive content.

### 7.2 Kids Publish Rules

| Condition | Required Before Publish |
|---|---|
| `is_kids_safe=true` | Safety Reviewer approval, safe model pool, test in Kids mode |
| `is_kids_exclusive=true` | All Kids Safe requirements plus normal-session visibility restriction |
| Template changed after approval | Approval invalidated; re-review required |
| Safety violation after publish | Skill can be force archived or disabled via feature flag |

---

## 8. Error Codes & Block Reasons

Functional requirements must map blocked states to stable codes. UI text can be localized separately.

| Code | HTTP | Trigger | Charge? |
|---|---:|---|---:|
| `AUTH_REQUIRED` | 401 | Anonymous enable/use attempt | No |
| `SKILL_NOT_FOUND` | 404 | Unknown `skill_id` | No |
| `SKILL_NOT_PUBLISHED` | 403 | Draft, archived, or unavailable deprecated Skill | No |
| `SKILL_NOT_ENABLED` | 403 | User attempts execution without enabling | No |
| `SKILL_PLAN_REQUIRED` | 403 | Plan does not satisfy required plan | No |
| `SKILL_SUBSCRIPTION_INACTIVE` | 403 | Subscription expired or inactive | No |
| `SKILL_QUOTA_EXCEEDED` | 429 | Free quota exceeded | No |
| `SKILL_KIDS_MODE_BLOCKED` | 403 | Kids / Kids Exclusive rule blocks execution | No |
| `SKILL_CONTEXT_TOO_LONG` | 400 | Input cannot fit context safely | No |
| `SKILL_RATE_LIMITED` | 429 | Rate limit exceeded | No |
| `SKILL_TIMEOUT` | 504 | Skill execution timeout | No for no-output timeout; usable partial streaming timeout follows approved settlement |
| `SKILL_SAFETY_VIOLATION` | 200 or 403 | Output replaced or stream aborted for safety | No by default |
| `SKILL_INTERNAL_ERROR` | 500 | Internal execution failure | No |

---

## 9. Event Requirements

### 9.1 Required Events

| Event | When | Priority |
|---|---|---|
| `skill_impression` | Skill card or recommendation shown | P0 |
| `skill_detail_view` | Detail page opened | P0 |
| `skill_enabled` | User enables Skill | P0 |
| `skill_disabled` | User disables Skill | P0 |
| `skill_first_use` | First successful use for user/skill | P0 |
| `skill_used` | Every successful Skill execution | P0 |
| `skill_repeat_use` | Successful non-first execution | P0 |
| `skill_blocked` | Execution blocked by entitlement/status/safety | P0 |
| `skill_timeout_error` | Timeout occurs | P0 |
| `skill_admin_action` | Admin write action | P0 |
| `skill_spec_downloaded` | User downloads tool spec (OpenAPI / MCP) | P1 |
| `skill_version_created` | New execution version created | P1 |
| `skill_safety_violation` | Safety issue detected | P0 if Kids enabled |
| `skill_kids_approved` | Kids approval granted | P0 if Kids enabled |

### 9.2 Required Event Properties

| Property | Required | Notes |
|---|---:|---|
| `event_id` | Yes | Unique id |
| `timestamp` | Yes | Server time preferred |
| `user_id` | Yes if logged in | Nullable for anonymous browse and Kids analytics; Relay runtime still uses real user for auth/quota/billing |
| `tenant_id` | Yes if available | Required for execution |
| `session_id` | Yes | Server/session derived |
| `skill_id` | Yes | All Skill events |
| `skill_version_id` | Execution/admin version events | Required for usage/billing |
| `entry_point` | Yes | Must be a valid enum |
| `plan` | Yes if logged in | free/pro/enterprise |
| `persona` | If known | May be coarse in V1 |
| `is_kids_session` | Execution events | Server-derived only |
| `success` | Execution events | Boolean |
| `block_reason` | Blocked events | Uses Section 8 mapping |
| `latency_ms` | Execution events | Gateway latency and total if available |
| `input_tokens` / `output_tokens` | Execution/billing | Estimated or provider actual |

### 9.3 Data Quality Rules

- No event may include `instruction_template`.
- Kids sensitive raw input must not be persisted.
- `entry_point` cannot be null for launch paths.
- Failed or blocked events must include `failure_reason` or `block_reason`.
- Event names must be stable and not free-form.
- Kids Session analytics must persist `user_id=NULL` and a non-reversible daily `kids_session_pseudo_id` in `session_id`; billing and runtime controls remain tied to the real authenticated user in restricted systems.

---

## 10. Acceptance Criteria

### 10.1 P0 Launch Acceptance

1. Super Admin can create draft Skill and publish it after checklist passes.
2. Published Skill appears in Marketplace; draft and archived Skills do not.
3. Normal User can view detail, enable, disable, and see Skill in My Skills.
4. Playground Skill Picker is not exposed to normal users; Playground remains a general chat interface without Skill selection.
5. Relay injects `instruction_template` server-side only.
6. `instruction_template` is absent from client API, UI, logs, errors, billing, analytics, and tool spec download response.
7. Execution performs use-time entitlement check.
8. Expired or insufficient-plan users are blocked with standard error code.
9. Billing attribution includes `skill_id` and `skill_version_id` for successful execution.
10. Blocked and failed calls do not create a charge by default.
11. Core events exist for impression, detail, enable, disable, first use, use, repeat use, and block.
12. Kids Session state is resolved server-side; client override attempts fail.
13. Kids Session cannot execute non-Kids-Safe Skill if Kids Mode is enabled.
14. Admin write actions create audit log entries.
15. Free/free-quota paths enforce the active version `max_input_tokens` snapshot before provider call.
16. User plan allowed models are intersected with Skill model whitelist before routing.
17. Deprecated Skill safety patch versions activate for existing enabled entitled users without reopening enablement.
18. Existing non-Skill API calls remain unchanged.
19. Feature flag can disable Marketplace entry without deleting data.
20. Published Skill has a downloadable tool spec (OpenAPI format) accessible to enabled users; spec does not contain `instruction_template` or any execution logic.
21. MCP-format tool spec is available for Claude integration.
22. Skill Detail page provides one-click install guides for ChatGPT, Gemini, and Claude.
23. External AI client can call the Skill API endpoint with a valid API Key; DeepRouter authenticates, runs entitlement check, executes Skill logic, and returns tool result.
24. External AI client call with invalid or missing API Key receives 401 `AUTH_REQUIRED`.
25. Billing event for external AI client call includes `entry_point=external_ai_client`; quota is deducted from the API Key owner's account.
26. API Key revocation takes effect immediately; previously issued tool specs are rendered non-functional within one request cycle.

### 10.2 P1 Acceptance

1. Deprecated Skills are hidden from new users but executable by already-enabled entitled users.
2. Featured, Popular, and New rails work with event tracking.
3. Ops Dashboard supports plan/persona/channel/date filters.
4. Review workflow supports assign, resolve, and escalate.
5. Version history is available to Super Admin.
6. Rate limit, timeout, and context overflow have load/regression tests.
7. Error codes are localized in UI via frontend mapping.

### 10.3 P2 Acceptance

1. Public Skill API trigger.
2. Full sharing/referral workflow.
3. Community rating/review.
4. Experiment rollout UI.
5. Creator submission and revenue share.

---

## 11. Open Questions and Default Decisions

Open questions are tracked here only as product clarifications. If an item blocks Sprint planning, it must map to a canonical Sprint 0 decision ID from Section 1.4.

| Decision ID | Question | Recommended Default | Owner |
|---|---|---|---|
| D-03 | Is Kids Mode GA in V1? | Closed beta/off by default unless semantic moderation, approval workflow, monitoring, and Safety sign-off are P0 | Product + Safety + Legal |
| D-01 | What is Free Skill monthly quota? | Freeze in Sprint 0 before entitlement and UX lock-state implementation | Product |
| D-04 | Does partial streaming output ever charge? | User-aborted/safety-aborted/no-usable-output partials do not charge by default; streaming timeout after usable partial output must settle by actual delivered/consumed tokens if streaming is enabled | Product + Finance |
| N/A | Can Operation export analytics? | Aggregate-only export is P1 and permissioned; P0 export disabled by default | Product + Security |
| D-05 | Should model whitelist block or reroute disallowed model? | Reroute only if an approved safe fallback exists; otherwise block | Engineering + Security |
