# Skill Marketplace Functional Requirements

本文档定义 DeepRouter Skill Marketplace V1 的企业级功能需求。目标是让 Product、Engineering、Design、QA、Operations 和独立 Agent 能按同一口径理解范围、权限、状态、异常路径和验收标准。

---

## 1. Scope

### 1.1 V1 Product Scope

V1 仅支持 **官方 curated Skills**。终端用户不能创建、上传、下载或复制 Skill 内部配置。Skill 的核心 `instruction_template` 必须由服务端托管，并且只在 Relay / Gateway 执行链路中注入。

V1 必须交付以下闭环：

```text
Admin 创建 Skill
→ 发布到 Marketplace
→ 用户浏览 / 查看详情 / 启用
→ Playground 选择 Skill
→ Relay 服务端注入并执行
→ Entitlement 使用时校验
→ Billing / Analytics 归因
→ Operations 根据数据优化
```

### 1.2 In Scope

| Area | V1 Requirement | Priority |
|---|---|---|
| Skill Supply | Super Admin 创建、编辑、预览、发布、归档官方 Skill | P0 |
| Marketplace | 用户浏览、搜索、查看详情、启用、停用 Skill | P0 |
| My Skills | 用户查看已启用 Skill 及可用/锁定状态 | P0 |
| Playground | 用户选择一个已启用 Skill 并执行 | P0 |
| Skill Execution Mode | V1 Skills 强制为**无状态单轮 (Stateless / Single-Turn)**：每次 Playground 提交都是独立请求，Relay 不维护跨请求的对话历史。`instruction_template` 每次注入成本固定、可预测。V2 如需多轮，须重新定义计费模型和上下文消耗警告。 | P0 |
| Relay Execution | 服务端注入 `instruction_template`，客户端不可见 | P0 |
| Entitlement | 每次使用前检查订阅、计划、quota、Skill 状态 | P0 |
| Billing Attribution | Skill 执行事件可归因到 Skill、版本、用户、计划、入口 | P0 |
| Analytics | 关键生命周期事件和 Data Entry Point | P0 |
| Operations | 最小运营 Dashboard：Top、Blocked、Funnel、Revenue | P0 |
| Kids Safety | 服务端 Kids Session 判断、Kids Safe 拦截、审批要求 | P0 if Kids enabled |
| Audit | Admin 关键写操作进入 audit log | P0 |
| Feature Flag | Marketplace 可灰度开启和快速关闭 | P0 |

### 1.3 Out of Scope

| Item | V1 Decision | Target |
|---|---|---|
| 用户自建 Skill | 不支持 | V2 |
| Creator Marketplace / 分成 | 不支持 | V2 |
| Prompt 下载 | 永不作为 V1 形态 | N/A |
| Public Skill API Trigger | V1 不做；仅 Playground 使用 | V1.1 |
| 多 Skill 叠加 | 不支持；一次仅一个 active Skill | V2+ |
| Tool Calling / Workflow / Agent Runtime | 不支持 | V3/V4 |
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

### 3.3 User Executes Skill in Playground

1. User opens Playground.
2. User selects one enabled Skill from Skill Picker.
3. User submits input.
4. Client sends `skill_id` in internal metadata. **Client must not send conversation history from previous Skill turns; V1 execution is stateless.**
5. Relay resolves authenticated user, tenant, session, and Kids Session server-side.
6. Relay loads immutable Skill execution context.
7. Relay performs status, enabled, entitlement, quota, Kids, model whitelist, token, and rate checks.
8. Relay injects `instruction_template` server-side. **Relay does not concatenate prior-turn messages into the provider request; each request is a self-contained single-turn call.**
9. Relay calls model provider.
10. Result is returned with AI-generated disclosure.
11. System emits usage, analytics, and billing attribution events.

> **Stateless enforcement**: V1 Relay must not receive, store, or forward conversation history to the provider as part of Skill execution. `input_tokens` billed per request equals `instruction_template tokens + single user input tokens + output schema tokens` only. If the Playground client accumulates a visible conversation UI, each submission to Relay must be treated as a fresh, independent request with the same fixed Skill context cost.

### 3.4 User Membership Expires

1. Skill remains visible in My Skills.
2. Skill may show locked/renewal state.
3. User attempts execution.
4. Relay performs use-time entitlement check.
5. Request is blocked with `SKILL_SUBSCRIPTION_INACTIVE` or `SKILL_PLAN_REQUIRED`.
6. UI displays renew / upgrade CTA.
7. System emits `skill_blocked`.
8. No charge is created.

### 3.5 Kids Session Attempts Unsafe Skill

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
| FR-A16 | Manage publish checklist | P0 | Blocks publish if required checklist items fail |
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
| FR-U7 | Launch Playground from Detail | P0 | Skill preselected if enabled and executable |
| FR-U8 | Search Skill name/description | P1 | Does not search hidden prompt |
| FR-U9 | Filter by category | P1 | Category list excludes empty unpublished categories |
| FR-U10 | Anonymous public browsing | P1 | Anonymous cannot see enabled state; CTA routes to login |
| FR-U11 | Submit output feedback | P2 | Creates review signal, not public rating |
| FR-U12 | View Kids-compatible Skills | P0 if Kids enabled | Kids Session only sees safe or exclusive allowed Skills |
| FR-U13 | Handle unavailable Skill | P0 | Shows friendly unavailable message for archived/deprecated cases |

### 4.3 Playground Skill Picker

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-P1 | Display Skill Picker | P0 | Visible in Playground when feature flag enabled |
| FR-P2 | Select exactly zero or one active Skill | P0 | Multi-Skill stacking is blocked |
| FR-P3 | Pass `skill_id` to Relay | P0 | Internal metadata only; no template client exposure |
| FR-P4 | Block disabled / unauthorized Skill | P0 | UI prevents where possible; Relay remains source of truth |
| FR-P5 | Clear selected Skill | P0 | Returns Playground to normal non-Skill mode |
| FR-P6 | Preselect from Skill Detail | P0 | Only if Skill is enabled or enable flow completes |
| FR-P7 | Show lock and block reasons | P0 | Maps standard error codes to friendly messages |
| FR-P8 | Empty state recommends Skills | P1 | Must include data entry point |
| FR-P9 | Ignore client-provided Kids flags | P0 | Client cannot set or override `is_kids_session` |

### 4.4 Relay / Gateway Execution

| ID | Requirement | Priority | Acceptance Notes |
|---|---|---|---|
| FR-G1 | Accept active `skill_id` | P0 | Only supported from Playground in V1 |
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
| FR-E6 | UI receives lock state | P0 | Marketplace, Detail, My Skills, Playground; quota locks include reset guidance and upgrade CTA where Product approved |
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
| FR-D10 | Every entry point has `entry_point` | P0 | No null / unknown for launch paths |
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
4. Playground can select exactly one enabled Skill.
5. Relay injects `instruction_template` server-side only.
6. `instruction_template` is absent from client API, UI, logs, errors, billing, and analytics.
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
