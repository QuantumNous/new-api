# Skill Marketplace Agent-Based Module Breakdown / WBS

本文档定义 DeepRouter Skill Marketplace V1 的企业级模块拆分、Agent 分工、依赖关系、交付物和验收标准。目标是让每个模块可以交给一个独立 Agent 或工程小组执行，同时保持 Functional、UX、Data/API、Analytics、Security/NFR 的口径一致。

本文件以上游 PRD 为唯一基准：

- `tasks/00_Overview.md`
- `tasks/01_Functional_Requirements.md`
- `tasks/02_UX_Design.md`
- `tasks/03_Data_Model_and_API_Spec.md`
- `tasks/04_Analytics_and_Operations.md`
- `tasks/05_Security_and_NFR.md`

若冲突，以 `01_Functional_Requirements.md` 的范围和权限规则为产品基准，以 `03_Data_Model_and_API_Spec.md` 的 schema、API、错误码为实现基准，以 `05_Security_and_NFR.md` 的安全/NFR 要求为上线门槛。

---

## 1. V1 Scope Baseline

### 1.1 Product Baseline

V1 是官方托管的跨平台 AI Skill 平台。**V1 核心范式：Skills 是可调用的 AI 能力，执行逻辑永不离开 DeepRouter 服务端。** 用户可以在 DeepRouter 内直接通过 Skill Run Page 运行 Skill，也可以将 Skill 连接到外部 AI 客户端（如 ChatGPT），通过平台专属安装包（install artifact）实现互操作。安装包只含 schema 和 endpoint，不含执行逻辑。Connection Key 绑定用户帐号，不嵌入任何安装文件。

> Playground Skill Picker 已移除。普通用户通过 Skill Run Page（P0-User）或 ChatGPT Custom GPT Action（P0-Demo）使用 Skill。Playground 保持通用聊天界面。

**V1 两条 P0 闭环：**

P0-User — Native DeepRouter Skill Run（非技术用户首选路径）：
```text
Super Admin creates official Skill（定义 tool schema + 服务端执行逻辑）
→ Skill is published to Marketplace
→ User browses detail and enables Skill
→ User enters Skill Run Page（/skills/:id/run）
→ User fills in the form（generated from tool_input_schema）→ clicks Run
→ DeepRouter Relay: Auth → Entitlement → Safety → inject instruction_template（server-side）→ Execute
→ Relay returns structured result（execution_entry_point=native_deeprouter）
→ Skill Run Page renders formatted output
→ Execution emits usage, billing attribution（execution_entry_point=native_deeprouter）, analytics, audit
→ Operations monitors adoption, blocked usage, revenue, and safety
```

P0-Demo — ChatGPT Custom GPT Action Install（互操作性演示路径）：
```text
Super Admin creates official Skill（same Canonical Manifest as above）
→ Skill is published to Marketplace
→ User enables Skill → opens Install Dialog → downloads chatgpt-install.json or copies Import URL
→ User opens ChatGPT Custom GPT Builder → Configure → Actions → Create new action
→ User imports JSON / URL → sets Authentication: API Key / Bearer → pastes Connection Key → saves GPT
→ User uses Custom GPT naturally; ChatGPT automatically calls DeepRouter Skill tool
→ DeepRouter Relay: same Auth / Entitlement / Safety / execution chain（execution_entry_point=external_ai_client）
→ Execution emits billing attribution（execution_entry_point=external_ai_client）
→ Operations monitors adoption, blocked usage, revenue, and safety
```

User can run an enabled Skill directly in DeepRouter through Skill Run Page, or connect the same Skill to external AI clients such as ChatGPT via platform-specific install artifacts. Both paths run the same protected server-side Skill Runtime — only the entry surface differs.

### 1.2 Locked V1 Decisions

| Area | Decision |
|---|---|
| Skill supply | Official curated Skills only |
| P0-User: Native Skill Run Page | P0 — 用户在 DeepRouter 内直接运行 Skill；`/skills/:id/run`；session token 认证；`execution_entry_point=native_deeprouter` |
| P0-Demo: ChatGPT install artifact | P0 — 下载 `chatgpt-install.json` 或复制 Import URL 安装到 Custom GPT；`execution_entry_point=external_ai_client`；install artifact 只含 schema + endpoint，不含执行逻辑或 Connection Key |
| External AI client invocation | P0 — DeepRouter Relay 接受来自 ChatGPT 等外部 AI 客户端的 tool call，携带用户 Connection Key |
| User Playground Skill execution | **移除** — 普通用户没有 Playground Skill 执行路径；Playground 保持通用聊天界面；Skill 执行通过 Skill Run Page（P0-User）或 ChatGPT install（P0-Demo） |
| Execution logic download | Never — `instruction_template` and execution handlers are never exportable |
| Multi-Skill stacking | Out of scope; zero or one active Skill per request |
| User-created Skills | Out of scope |
| Creator marketplace/revenue share | Out of scope |
| Local MCP server code download | V2 — V1 only supports cloud-hosted tool spec |
| Recommendation rails | P1; P0 Marketplace can launch with All Skills list and optional Featured only |
| Review workflow | P1; P0 Ops Dashboard can launch without full assign/resolve workflow |
| CSV export | P1 aggregate-only; hidden in P0 unless approved |
| Streaming safety/billing | P1 unless Product declares streaming launch P0 in Sprint 0 |
| Kids mode | Conditional P0 if enabled; otherwise closed beta/feature-flagged off by default |

### 1.3 Sprint 0 Decision Defaults and Implementation Gates

| ID | Decision | Recommended Default | Owner | Blocks |
|---|---|---|---|---|
| D-01 | Free / Pro / Enterprise plan matrix and free quota | Defaulted for planning; freeze before affected implementation | Product + CEO | M03, M06, M07, M09 |
| D-02 | Analytics build vs buy | Event schema may proceed; freeze sink/dashboard source before M08/M09 build | EM + Product | M08, M09 |
| D-03 | Kids release mode | Feature-flagged closed beta unless GA controls pass | Product + Safety + Legal | M02, M05, M10, M15 |
| D-04 | Streaming launch scope | P1 by default | Product + Engineering + Finance | M05, M07, M10, M12 |
| D-05 | Provider system-boundary allowlist | Maintain explicit approved provider/model list | Security + Engineering | M05, M10, M11 |
| D-06 | `instruction_template` encryption mechanism | DB/storage encryption; field encryption if available | Security + Backend | M01, M11 |
| D-07 | Revenue counting statuses | Gross uses positive `charged`; net/reconciliation includes negative refund/void compensation rows | Finance + Data | M07, M09 |
| D-08 | Initial official Skill catalog | 3-5 launch Skills with examples | Product + Ops | M02, M14, M15 |

---

## 2. Module Map

### 2.1 Module Overview

| Module | Name | Priority | Primary Agent | Suggested Sprint |
|---|---|---|---|---|
| M00 | Scope, Decision, and Architecture Freeze | P0 | Product/Architecture Agent | Sprint 0 |
| M01 | Data Model, Migration, and API Foundation | P0 | Data/API Agent | Sprint 1a |
| M02 | Admin Skill Management and Lifecycle | P0 | Admin Supply Agent | Sprint 1a-2 |
| M03 | Marketplace and My Skills Experience | P0 | Marketplace UX/API Agent | Sprint 2 |
| M04 | ~~Playground Skill Picker~~ — V1 移除 | N/A | N/A | N/A |
| M05 | Relay Execution Core | P0 | Gateway/Relay Agent | Sprint 1b-2 |
| M06 | Entitlement, Membership, and Quota | P0 | Entitlement Agent | Sprint 1b |
| M07 | Billing Attribution and Finance Controls | P0 | Billing Agent | Sprint 1b-2 |
| M08 | Analytics Events and Data Quality | P0 | Analytics Pipeline Agent | Sprint 2 |
| M09 | Ops Dashboard and Business Metrics | P0/P1 split | Ops Analytics Agent | Sprint 3 |
| M10 | Kids Safety and Safety Review | Conditional P0 | Safety Agent | Sprint 1b-3 |
| M11 | Security, Prompt Protection, and Audit | P0 | Security Agent | Sprint 1a-3 |
| M12 | Runtime NFR, Cache, Rate Limit, and Observability | P0 | Reliability Agent | Sprint 1b-4 |
| M13 | Discovery Rails and Growth Surfaces | P1 | Growth Agent | Sprint 4 |
| M14 | i18n, Content Operations, and Launch Skills | P1/P0 content | Content Ops Agent | Sprint 3-4 |
| M15 | Release, QA, Rollout, and Runbook | P0 | Release Agent | Sprint 4 |
| M16 | Tool Spec Generation and Distribution | P0 | Tool Spec Agent | Sprint 2-3 |
| M17 | API Key Management and Copy Protection | P0 | API Key Agent | Sprint 1b-2 |

### 2.2 Agent Contract Template

Each module must be implemented with this contract:

| Field | Meaning |
|---|---|
| Inputs | Upstream PRD sections and dependent modules the Agent must read |
| Owns | Deliverables this Agent is responsible for |
| Does Not Own | Explicit exclusions to prevent duplicate implementation |
| Interfaces | APIs, events, tables, feature flags, or components the module touches |
| Dependencies | Modules that must land before or alongside this module |
| Acceptance | Testable completion criteria |
| Risks | Known scope, security, data, or sequencing risks |

---

## 3. Detailed Module Breakdown

### M00. Scope, Decision, and Architecture Freeze

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Product/Architecture Agent |
| Inputs | All PRD files |
| Owns | Scope freeze, decision register, initial catalog, launch assumptions |
| Does Not Own | Implementation, migrations, UI code |
| Dependencies | None |

**Work Items**

- Freeze V1 execution model: downloadable tool spec + external AI client invocation (`POST /v1/skills/execute/{skill_id}` with API Key) is the only user-facing Skill execution path; Admin preview endpoint is the only server-side Skill test path for Super Admins.
- Freeze plan matrix, free quota, monetization defaults, and Enterprise contact-sales semantics.
- Decide Kids mode GA vs closed beta vs disabled.
- Decide streaming launch scope.
- Decide analytics tool/source of truth.
- Approve provider/model system-boundary allowlist.
- Confirm feature flag and kill switch owners.
- Confirm initial 3-5 official launch Skills.

**Outputs**

- Scope Freeze Record.
- Decision Register with owner, date, and impact.
- Initial Skill Catalog brief.
- Architecture Review Notes.
- Launch Assumption Log.

**Acceptance**

- Every Sprint 0 decision in Section 1.3 has an owner and either a final V1 decision or an accepted planning default.
- Conditional P0 items are explicitly marked enabled or disabled for launch.
- All downstream Agents have a stable scope baseline.

---

### M01. Data Model, Migration, and API Foundation

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Data/API Agent |
| Inputs | `03_Data_Model_and_API_Spec.md`, `05_Security_and_NFR.md` |
| Owns | Tables, migrations, base indexes, API envelopes, shared enums, error code constants |
| Does Not Own | Admin UI, Marketplace UI, Relay provider call |
| Dependencies | M00 |

**Work Items**

- Implement or adapt schema for `skills`, `skill_versions`, `skills_i18n`, `user_enabled_skills`.
- Implement `skill_usage_events`, `skill_billing_events`, `skill_reviews`, `skill_audit_log`.
- Enforce enum values for status, required plan, monetization, review status, Kids approval, block reason, entry point.
- Implement indexes specified in Data/API.
- Implement public search indexes for `skills` and `skills_i18n`; search must never inspect prompt or internal execution fields.
- Implement common API response and error envelope.
- Ensure public/user/ops queries never select `instruction_template`.
- Implement migration order and rollback plan.
- Reuse existing feature flag/config system; create new `platform_configs` only if the platform lacks one and Data/API is updated.

**Interfaces**

- Tables: `skills`, `skill_versions`, `skills_i18n`, `user_enabled_skills`, `skill_usage_events`, `skill_billing_events`, `skill_reviews`, `skill_audit_log`.
- `skills.max_input_tokens` cost guardrail plus `skill_versions.max_input_tokens_snapshot`, mandatory for Free Skills and free-quota execution paths.
- Error codes: `AUTH_REQUIRED`, `SKILL_NOT_FOUND`, `SKILL_NOT_PUBLISHED`, `SKILL_NOT_ENABLED`, `SKILL_PLAN_REQUIRED`, `SKILL_SUBSCRIPTION_INACTIVE`, `SKILL_QUOTA_EXCEEDED`, `SKILL_KIDS_MODE_BLOCKED`, `SKILL_CONTEXT_TOO_LONG`, `SKILL_RATE_LIMITED`, `SKILL_TIMEOUT`, `SKILL_SAFETY_VIOLATION`, `SKILL_INTERNAL_ERROR`.

**Acceptance**

- Migration runs cleanly in staging from empty state.
- Rollback is documented and tested before GA traffic.
- `instruction_template` appears only in `skill_versions` and allowed Super Admin/Relay paths.
- Public/user/ops response examples exclude hidden prompt fields.
- Shared enum/error constants are available for M02-M12.

**Risks**

- Existing platform user/tenant/billing ownership may prevent hard foreign keys; use application-level validation if needed.
- Feature flag storage must not drift from existing platform conventions.

---

### M02. Admin Skill Management and Lifecycle

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Admin Supply Agent |
| Inputs | `01_Functional_Requirements.md`, `02_UX_Design.md`, `03_Data_Model_and_API_Spec.md`, `05_Security_and_NFR.md` |
| Owns | Admin APIs/UI for official Skill creation, versioning, preview, publish, deprecate, archive |
| Does Not Own | End-user Marketplace, Relay runtime, Ops dashboard |
| Dependencies | M01, M11 audit/redaction baseline |

**Work Items**

- Admin list/detail/create/edit for official Skills.
- Version creation endpoint for `instruction_template` changes.
- Preview Skill execution path using `entry_point=admin_preview`.
- Admin Preview hard limit: default max 50 previews per Admin per UTC day unless Security approves a different cap.
- Admin Preview output must pass production-equivalent content safety, prompt leakage, output leakage, provider allowlist, and Kids/content-safety guardrails.
- Admin Preview emits audit/security telemetry outside business analytics and revenue.
- Publish checklist with metadata, examples, entitlement, model whitelist, preview, and Kids approval checks.
- Lifecycle actions: publish, deprecate, archive.
- Featured flag and featured rank management.
- Required plan, monetization, free quota, timeout, model whitelist settings.
- Audit log writes for all sensitive actions and prompt access.

**Interfaces**

- `/api/v1/admin/skills`
- `/api/v1/admin/skills/{skill_id}/versions`
- `/api/v1/admin/skills/{skill_id}/preview`
- `/api/v1/admin/skills/{skill_id}/publish-checklist`
- `/api/v1/admin/skills/{skill_id}/publish`
- `/api/v1/admin/skills/{skill_id}/deprecate`
- `/api/v1/admin/skills/{skill_id}/archive`
- `/api/v1/admin/skills/{skill_id}/audit-log`

**Acceptance**

- Super Admin can create draft Skill and publish after checklist passes.
- Editing `instruction_template`, model whitelist, output schema, or safety-critical execution fields creates a new `skill_version`.
- Deprecated Skills are hidden from new users but may remain executable for already-enabled entitled users.
- Deprecated Skill safety/quality patch versions must activate immediately for existing enabled entitled users without making the Skill discoverable or enableable to new/disabled users.
- Archived Skills cannot be discovered, enabled, or executed.
- Prompt access and all writes create audit records without prompt text in diff.

**Risks**

- Admin preview must not echo hidden prompt in output or diagnostics.
- Kids approval APIs are required only if Kids feature can be enabled.

---

### M03. Marketplace and My Skills Experience

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Marketplace UX/API Agent |
| Inputs | `01_Functional_Requirements.md`, `02_UX_Design.md`, `03_Data_Model_and_API_Spec.md` |
| Owns | Marketplace list/detail, enable/disable, My Skills, availability/lock states |
| Does Not Own | Playground execution, recommendation algorithms, Ops dashboards |
| Dependencies | M01, M06, M08 instrumentation baseline |

**Work Items**

- Marketplace list with public fields only.
- Search by public name/description only.
- Category and plan filters.
- Skill Detail with examples, input hints, plan, availability, hosted prompt copy, AI disclosure.
- Enable/disable flows.
- My Skills with executable, locked, deprecated, archived states.
- Error-code-to-UX-state mapping.
- Anonymous browsing with login CTA.
- Hide Kids UI when Kids flag is off.

**P0 Boundary**

- P0 Marketplace can launch with All Skills list.
- Featured rail is optional if `featured_flag` is configured.
- Popular/New/Recommended rails belong to M13 P1.

**Interfaces**

- `GET /api/v1/marketplace/skills`
- `GET /api/v1/marketplace/skills/{skill_id_or_slug}`
- `GET /api/v1/marketplace/my-skills`
- `POST /api/v1/marketplace/skills/{skill_id}/enable`
- `POST /api/v1/marketplace/skills/{skill_id}/disable`

**Acceptance**

- Draft/archived Skills are not discoverable.
- Deprecated Skills are not shown in Marketplace to new users.
- Pro Skill enable before upgrade is not allowed in V1 baseline.
- UI never exposes `instruction_template` or internal prompt terminology to normal users.
- Enable/disable emits required events through M08 contract.

**Risks**

- If M06 availability API is not ready, frontend lock states may drift from Relay truth. Relay remains source of truth.

---

### M04. ~~Playground Skill Picker~~ — V1 移除

> **本模块已从 V1 移除。**
>
> 原决策：普通用户在 DeepRouter Playground 内选择并执行 Skill（通过 `deeprouter.skill_id` request body 注入）。
>
> **变更原因**：V1 Skills 重新定义为可安装的 API Tool。用户使用 Skill 的唯一路径是：下载 tool spec（OpenAPI / MCP 格式）→ 安装到外部 AI 客户端（ChatGPT / Gemini / Claude）→ 在外部客户端中调用，DeepRouter 作为后端 API 执行。Playground 保持通用聊天界面，不暴露 Skill Picker 或 Skill 执行入口给普通用户。
>
> **替代模块**：M16（Tool Spec Generation and Distribution）、M17（API Key Management and Copy Protection）。Admin 测试 Skill 使用 M02 的 `/api/v1/admin/skills/{skill_id}/preview` 端点（`entry_point=admin_preview`）。

---

### M05. Relay Execution Core

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Gateway/Relay Agent |
| Inputs | `01_Functional_Requirements.md`, `03_Data_Model_and_API_Spec.md`, `05_Security_and_NFR.md` |
| Owns | Server-side Skill execution chain and provider adapter boundaries |
| Does Not Own | Marketplace UI, Admin editor, Dashboard UI |
| Dependencies | M01, M06, M10 if Kids enabled, M11, M12 |

**Work Items**

- Accept Skill execution requests from external AI clients via `POST /v1/skills/execute/{skill_id}` with `Authorization: Bearer <api_key>`; `skill_id` must come from URL path only — request body `skill_id` fields are discarded (T-24).
- Accept Admin preview requests via `/api/v1/admin/skills/{skill_id}/preview`; Super Admin session token required; `entry_point=admin_preview`.
- Do NOT accept `deeprouter.skill_id` from Playground request body as a user execution path — this contract is removed in V1.
- Resolve authenticated user, tenant, session, subscription, plan, and server-derived Kids state.
- Apply feature flag and kill switch checks.
- Validate lifecycle, enabled state, entitlement, quota, rate limit, Kids policy, model whitelist, provider capability, context size, and timeout before provider call.
- Compute `effective_allowed_models = intersection(user_plan_allowed_models, skill model whitelist snapshot)` and route only within that set.
- Enforce the immutable `max_input_tokens_snapshot` selected at request entry for Free Skills and free-quota paths before provider call, in addition to provider context limits.
- **Stateless single-turn enforcement (FR-G19)**: Strip any client-supplied conversation history fields at Relay entry. Provider call must include only `instruction_template` + current user input. No prior-turn messages may be forwarded to the provider.
- **Identity immutability (T-21)**: Extract `user_id` and `tenant_id` exclusively from validated auth token claims. Discard and overwrite any client-supplied `tenant_id`, `user_id`, or equivalent fields in request body, query params, or non-auth headers before constructing any analytics event, billing record, quota key, or cache key.
- Load immutable execution snapshot and `skill_version_id`.
- Inject `instruction_template` server-side only.
- Execute provider/model HTTP calls outside database transactions and without holding pooled DB connections.
- Use conservative token/context estimation across all allowed fallback models, with at least 20% safety buffer for cross-provider fallback.
- Preserve policy precedence: Kids hard constraints > platform policy > tenant policy > Skill instruction > user message.
- Keep smart-router blind to `instruction_template`, billing policy, and sensitive Skill details.
- For Kids Session, keep real `user_id` in runtime context for auth/quota/rate-limit/billing while emitting analytics with `user_id=NULL` and `session_id=kids_session_pseudo_id`.
- Emit usage, blocked, timeout, safety, and billing attribution events through the appropriate modules.

**Acceptance**

- Relay never loads/injects prompt if a pre-injection check fails.
- User APIs, UI, logs, errors, billing, analytics, audit, and provider logs do not leak prompt text.
- Model routing never falls back outside the Skill whitelist.
- Model routing never falls back outside the user's plan-allowed model set.
- Model routing never falls back to a provider/model whose conservative context budget would overflow.
- Provider execution does not run inside an open DB transaction.
- Existing non-Skill API calls remain unchanged.
- In-flight requests use the execution snapshot selected at request entry.

**Risks**

- Provider adapters without reliable system boundary cannot run Kids, Pro-gated, high-sensitivity, or prompt-protected Skills unless Security approves.
- Streaming support is P1 unless declared launch P0.

---

### M06. Entitlement, Membership, and Quota

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Entitlement Agent |
| Inputs | `01_Functional_Requirements.md`, `03_Data_Model_and_API_Spec.md`, `05_Security_and_NFR.md` |
| Owns | Use-time authorization, availability state, quota, plan/subscription checks |
| Does Not Own | Payment processing, UI rendering, prompt injection |
| Dependencies | M00, M01, M05 |

**Work Items**

- Enforce `required_plan`: free, pro, enterprise.
- Check active subscription at execution time.
- Enforce plan hierarchy unless Product overrides.
- Enforce Free Skill quota if adopted by D-01.
- Implement request-scoped quota reservation and idempotent principle-based compensation: any request that fails or is blocked before the provider produces usable output must restore quota exactly once. This includes — but is not limited to — `SKILL_INTERNAL_ERROR`, `SKILL_TIMEOUT` without usable output, `SKILL_CONTEXT_TOO_LONG`, `SKILL_PLAN_REQUIRED`, `kids_mode_blocked`, safety pre-flight blocks, and any mid-Relay rejection before provider response. Do not hard-code a list of error codes; the invariant is: no usable provider output → restore quota.
- **Dangling reservation TTL (T-15 safety net)**: Redis quota reservation key must carry a physical TTL = `max(skill.timeout_seconds + 10, 60)` seconds. Pod crash or OOM-kill must not produce a permanent dangling reservation; Redis TTL expires and auto-releases the slot. The durable compensation ledger must treat TTL-released reservations as already compensated to prevent double-refund.
- Generate availability/lock state for Marketplace, Detail, My Skills, and Playground.
- Return stable error codes and block reasons.
- Invalidate or short-TTL entitlement caches on plan changes, expiry, refund, downgrade, enable/disable, and archive.

**Acceptance**

- Enablement does not grant permanent execution rights.
- Expired subscription blocks the next execution.
- Free user cannot enable/use Pro Skill in V1 baseline.
- Quota exceeded returns `SKILL_QUOTA_EXCEEDED` and creates no charge.
- Eligible internal-error/provider-timeout failures restore reserved quota exactly once.
- Every block emits `skill_blocked` with `block_reason` and `error_code`.

---

### M07. Billing Attribution and Finance Controls

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Billing Agent |
| Inputs | `01_Functional_Requirements.md`, `03_Data_Model_and_API_Spec.md`, `04_Analytics_and_Operations.md`, `05_Security_and_NFR.md` |
| Owns | `skill_billing_events`, idempotency, charge-status attribution, revenue metric source |
| Does Not Own | Invoice system internals, dashboard rendering, entitlement decisions |
| Dependencies | M01, M05, M06, M12 |

**Work Items**

- Create `skill_billing_events` for billable successful executions, billable client-disconnect partials, and approved streaming partial-timeout settlements.
- Include `request_id`, `idempotency_key`, `user_id`, `tenant_id`, `skill_id`, `skill_version_id`.
- Use Data/API fields: `monetization_type`, `required_plan`, `base_cost`, `skill_markup`, `billable_amount`, `charge_status`, `partial_output`, `success`.
- Ensure blocked calls do not create billing events.
- Failed calls do not charge by default.
- Partial streaming defaults to `charge_status='not_charged'` for safety-aborted, provider-error-without-usable-output, preview, and client-disconnect-before-usable-output paths unless Finance approves otherwise.
- Client disconnect after usable streamed output records actual token counts and settles under Finance-approved partial billing policy.
- Streaming timeout after usable partial output records actual token counts and settles as `pending` or `charged` according to Finance-approved policy.
- Billable partial streaming charges 100% of actual/provider-reported input tokens once usable output starts; only output tokens may be prorated.
- Define reconciliation with existing billing/finance source of truth.

**Acceptance**

- Duplicate callbacks cannot double-charge.
- Billing ledger is append-only; refund/void/adjustment creates a compensating event and never updates the original charged row.
- Revenue attribution dashboard reads from `skill_billing_events`.
- V1 gross revenue counts only positive `charge_status='charged'` unless Finance changes the rule.
- Net revenue or reconciliation views must include append-only `refunded`/`voided` compensation rows only as negative adjustments.
- `not_charged` and `pending` do not count as revenue.
- Billing idempotency covers duplicate timeout callbacks and delayed provider usage reconciliation.
- Billing events contain no prompt, raw user input, Kids raw input, or provider raw payload.

---

### M08. Analytics Events and Data Quality

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Analytics Pipeline Agent |
| Inputs | `04_Analytics_and_Operations.md`, `03_Data_Model_and_API_Spec.md`, `05_Security_and_NFR.md` |
| Owns | P0 events, schema validation, data quality, freshness, privacy allowlist |
| Does Not Own | Dashboard UI, billing ledger, recommendation algorithm |
| Dependencies | M00 analytics decision, M01, M03, M05, M06, M07 |

**Work Items**

- Implement P0 event taxonomy: `skill_impression`, `skill_detail_view`, `skill_enabled`, `skill_disabled`, `skill_first_use`, `skill_used`, `skill_repeat_use`, `skill_blocked`, `skill_timeout_error`, `skill_admin_action`, `skill_safety_violation`, `skill_kids_approved` if Kids enabled.
- Map analytics `timestamp` to database `occurred_at`.
- Include `schema_version='1.0'`.
- Validate `entry_point` against Data/API enum.
- Store extended fields such as `source_entry_point` and `repeat_index` only in approved schema fields or allowlisted `metadata`.
- Persist Kids Session analytics with `user_id=NULL`, `is_kids_session=true`, and `session_id=kids_session_pseudo_id`; never copy real Kids user identity into business analytics.
- Implement `skill_reviews` trigger inputs: automated safety threshold and manual Ops "Mark for Review".
- Reject or quarantine events with restricted keys.
- Provide sample payloads for at least `skill_impression`, `skill_used`, and `skill_blocked`.
- Define freshness targets and tracking-failure alerts.

**Privacy Rules**

- No `instruction_template`.
- No raw full user input.
- No provider raw payload.
- No Kids raw input.
- Kids analytics uses sticky-salt HMAC pseudonymous session id only; real authenticated user remains in runtime/billing restricted systems.
- `metadata` must pass allowlist validation.

**Acceptance**

- P0 events with missing required fields are rejected or quarantined.
- Anonymous impression/detail may have null `user_id`; normal execution events require user/tenant/request context; Kids Session analytics persists null `user_id` and pseudonymous `session_id`.
- Automated review is created or reopened when a Skill exceeds 5 `skill_safety_violation` events in a rolling 1-hour window.
- Events use UTC timestamps.
- Dashboard data freshness target is less than 15 minutes for P0 events.
- Blocked events include both `block_reason` and `error_code`.

---

### M09. Ops Dashboard and Business Metrics

| Field | Definition |
|---|---|
| Priority | P0 dashboard, P1 review/export/retention details |
| Primary Agent | Ops Analytics Agent |
| Inputs | `04_Analytics_and_Operations.md`, `02_UX_Design.md`, `03_Data_Model_and_API_Spec.md`, `05_Security_and_NFR.md` |
| Owns | Aggregate dashboards, business metrics, dashboard permissions |
| Does Not Own | Event production, billing event creation, admin Skill editing |
| Dependencies | M08, M07, M11 |

**P0 Work Items**

- Overview dashboard: WASU, total runs, activation, first use, repeat use, block rate, revenue attribution, top block reason.
- Per-Skill table: status, plan, enabled users, active users, successful runs, funnel rates, block rate, revenue attribution.
- Funnel dashboard: impression -> detail -> enable -> first use.
- Revenue attribution by Skill and plan.
- Dashboard filters: date range, Skill, category, plan, entry point, status.
- Role-based access: Operation/Product aggregate only, Safety subset, Super Admin full aggregate.

**P1 Work Items**

- Review workflow: assign, resolve, escalate, reopen.
- Retention: D1/D7/D30.
- Persona/channel filters.
- Aggregate-only CSV export.

**Acceptance**

- Ops users cannot see prompt, raw user content, provider raw payload, or Kids raw input.
- Dashboard excludes `admin_preview` from business metrics.
- Empty states distinguish no data from tracking failure.
- Revenue values are labeled attribution unless reconciled.
- Export is hidden in P0 unless explicitly enabled and permissioned.

---

### M10. Kids Safety and Safety Review

| Field | Definition |
|---|---|
| Priority | Conditional P0 if Kids enabled; otherwise feature-flagged off |
| Primary Agent | Safety Agent |
| Inputs | `01_Functional_Requirements.md`, `02_UX_Design.md`, `03_Data_Model_and_API_Spec.md`, `05_Security_and_NFR.md` |
| Owns | Kids runtime gate, approval workflow, safety events, Kids incident controls |
| Does Not Own | General entitlement, normal Marketplace UI, full legal policy drafting |
| Dependencies | M00 D-03, M02, M05, M06, M11, M12 |

**Work Items**

- Derive `is_kids_session` server-side only.
- Ignore and optionally audit client-provided Kids fields without storing raw content.
- Block non-`is_kids_safe` Skills in Kids Session before prompt injection.
- Block or hide `is_kids_exclusive` Skills from normal sessions unless approved exception exists.
- Enforce Kids safe model pool.
- Kids safe model pool may include only providers/models with approved DPA, no-training commitment, and ZDR/no-retention path.
- Implement Kids approval request/approve/reject/revoke workflow if Kids can be enabled.
- Invalidate Kids approval when template, model whitelist, output schema, or safety-critical setting changes.
- Emit `skill_safety_violation` and `skill_kids_approved` where applicable.
- Ensure Kids analytics emits pseudonymous `kids_session_pseudo_id` while runtime auth/quota/rate-limit and restricted billing use the real authenticated user.
- Severe repeated Kids abuse triggers restricted Auth/Risk account-level action where policy allows; Ops dashboards must not rely on analytics `user_id` to identify a child account.
- Provide Kids kill switch and single-Skill emergency archive path.

**Acceptance**

- Kids mode can remain fully disabled via feature flag for launch.
- If Kids is enabled, unsafe Skill execution is blocked before prompt injection.
- Kids raw sensitive input/output is absent from logs, events, support diagnostics, and exports.
- Any confirmed unsafe Kids output triggers Critical incident path.

---

### M11. Security, Prompt Protection, and Audit

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Security Agent |
| Inputs | `05_Security_and_NFR.md`, `03_Data_Model_and_API_Spec.md`, all modules touching prompt/logs/events |
| Owns | Prompt protection controls, telemetry redaction, RBAC hardening, audit policy, security tests |
| Does Not Own | Product copy, dashboard metric formulas, billing reconciliation |
| Dependencies | M01, M02, M05, M08, M09 |

**Work Items**

- Enforce prompt absence across APIs, logs, errors, analytics, billing, audit, exports, support views, provider logs, and streaming output.
- Implement or specify output leakage guard and prompt extraction tests.
- Enforce structured user input separation; no user input interpolation into system prompt.
- Implement admin prompt access audit.
- Enforce tenant isolation tests across API, Relay, cache, analytics, and audit.
- Define provider SDK logging restrictions.
- Define telemetry restricted-key rejection rules.

**Acceptance**

- No non-Super-Admin surface returns `instruction_template`.
- Audit records use hashes and changed field names, not prompt text.
- Jailbreak/prompt extraction corpus passes launch threshold.
- Cross-tenant access tests pass.
- Security sign-off is required before M15 GA.

---

### M12. Runtime NFR, Cache, Rate Limit, and Observability

| Field | Definition |
|---|---|
| Priority | P0 core; streaming P1 unless declared launch P0 |
| Primary Agent | Reliability Agent |
| Inputs | `05_Security_and_NFR.md`, `03_Data_Model_and_API_Spec.md`, `04_Analytics_and_Operations.md` |
| Owns | Timeout, rate limit, cache consistency, circuit breaker, SLO metrics, alerting |
| Does Not Own | Business metric dashboard UI, billing status policy |
| Dependencies | M05, M06, M07, M08, M11 |

**P0 Work Items**

- Runtime timeout: default 45s, configurable per Skill from 1s to 120s.
- Token/context estimation before provider call, using conservative cross-provider fallback budget with at least 20% safety buffer.
- Rate limiting by user, IP, tenant, Skill, provider/model, and admin routes where applicable.
- Rate-limit buckets, concurrency tokens, and abuse counters are never refunded when business quota is compensated.
- Provider/model HTTP calls must never run inside an open database transaction or hold pooled DB connections during external execution.
- Cache TTL and invalidation for public Skill data, enabled state, entitlement, Kids session state, execution snapshot.
- Singleflight/cache-stampede protection.
- Emergency invalidation/broadcast for single Skill, Kids mode, provider path, and global Skill execution kill switches. **The broadcast mechanism must achieve propagation within the 5-second target defined in Security NFR Section 12.1.** Normal cache TTL expiry (60s–5min) is insufficient. Acceptable implementations: Redis pub/sub broadcast to all Relay/Gateway node subscribers; a dedicated in-process config reload endpoint called by Admin API on kill-switch writes; or equivalent sub-5-second push mechanism. Do NOT implement kill switches as "set a cache key with a short TTL" — that only prevents new queries from using stale values; it does not actively interrupt in-memory state across running instances.
- Circuit breakers for Skill timeout risk, provider failure, safety spike, billing mismatch.
- Health/readiness checks.
- Metrics: latency p50/p95/p99, success, block, timeout, provider error, billing failure, event quarantine, cache hit/miss.
- Alerts aligned with Analytics/Ops freshness targets.

**Conditional Streaming Work**

- Streaming chunk buffer or chunk safety inspection.
- Stream abort semantics.
- No charge by default for safety-aborted partial output.
- Timeout after usable partial streamed output follows actual-token settlement and is not a free path.
- Streaming billing idempotency tests.

**Acceptance**

- Marketplace list/detail p95 < 500ms excluding cold cache.
- My Skills and enable/disable p95 < 700ms.
- Relay pre-provider checks p95 < 300ms.
- Singleflight acceptance is per Relay/Gateway instance: at most one concurrent DB load per cache key per instance; cluster-wide concurrent loads may be up to N where N equals active Relay/Gateway instances.
- Rate-limited requests return `SKILL_RATE_LIMITED` with `Retry-After`.
- Context too long returns `SKILL_CONTEXT_TOO_LONG` before provider 400.
- Cross-provider fallback cannot move to a smaller effective context model unless the conservative budget still passes.
- Load test proves provider calls do not hold DB transactions/connections during the external wait.
- Safety-critical kill switches propagate within the emergency invalidation target and do not wait for normal cache TTL.
- Critical alerts fire within 5 minutes.

---

### M13. Discovery Rails and Growth Surfaces

| Field | Definition |
|---|---|
| Priority | P1 |
| Primary Agent | Growth Agent |
| Inputs | `02_UX_Design.md`, `04_Analytics_and_Operations.md` |
| Owns | Featured/Popular/New/Recommended rails, growth entry points, recommendation analytics |
| Does Not Own | P0 Marketplace list, core enable/use flows, ML ranking |
| Dependencies | M03, M08, M09 |

**Work Items**

- Featured rail using `featured_flag` and `featured_rank`.
- Popular rail based on recent successful usage.
- New rail based on recently published Skills.
- Recommended Lite using persona/category rules only.
- Continue Using / dashboard widget / in-app banner if Product enables.
- Tracking using existing Skill events and `entry_point=featured|popular|new|recommended`.

**Acceptance**

- Deprecated and archived Skills are excluded.
- Free users see at least one available Free Skill when such Skills exist.
- Recommendation interactions have impressions and conversion attribution.
- Recommendation logic does not require ML ranking in V1.

---

### M14. i18n, Content Operations, and Launch Skills

| Field | Definition |
|---|---|
| Priority | P1 generally; launch catalog content is P0 |
| Primary Agent | Content Ops Agent |
| Inputs | `02_UX_Design.md`, `03_Data_Model_and_API_Spec.md`, `05_Security_and_NFR.md` |
| Owns | Launch Skill content, `skills_i18n`, examples, AI disclosure, content checks |
| Does Not Own | Admin lifecycle code, Relay runtime, provider contracts |
| Dependencies | M01, M02, M03, M11 |

**Work Items**

- Prepare initial 3-5 official launch Skills.
- Provide name, short description, description, category, tags, input hints, example inputs, example outputs.
- Implement zh/en fallback via `skills_i18n`.
- Map error code copy for frontend localization.
- Add AI-generated content disclosure.
- Confirm content policy and provider DPA/ZDR status with Security/Legal where required.
- Confirm user-facing output/IP/copyright terms with Legal before GA launch content approval.
- Prepare Admin operating guide.

**Acceptance**

- Every launch Skill has at least one example input and output.
- Skill Detail renders correct locale fallback.
- User-facing copy does not expose internal implementation terms.
- Prompt text is never included in public content, examples, or exports.

---

### M15. Release, QA, Rollout, and Runbook

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Release Agent |
| Inputs | All PRD files and all P0 module acceptance criteria |
| Owns | Launch checklist, E2E tests, load tests, security regression, rollout, rollback, support runbook |
| Does Not Own | Feature implementation |
| Dependencies | All enabled P0 modules |

**Work Items**

- Feature flags and kill switches: marketplace, execution, single Skill, Kids, provider, billing, recommendation rails.
- Verify emergency invalidation/broadcast for Kids, provider, single Skill, and global execution kill switches.
- Stage 0 internal rollout.
- Stage 1 closed beta.
- Stage 2 GA.
- E2E acceptance suite across Admin -> Marketplace -> Playground -> Relay -> Billing/Analytics/Ops.
- Load and NFR test.
- Security regression: prompt leakage, RBAC, tenant isolation, jailbreak, Kids spoof.
- Legal/Privacy release gates: provider DPA/security terms, data retention, output/IP/copyright terms.
- Finance reconciliation test if charging enabled.
- Incident runbook and support training.

**Launch Gates**

- Product sign-off.
- Engineering sign-off.
- Security sign-off.
- Safety sign-off if Kids enabled.
- Finance sign-off if billing/charging enabled.
- QA sign-off.
- Operations/support readiness.

**Acceptance**

- All enabled P0 module acceptance criteria pass.
- Marketplace feature flag can disable public entry without deleting data.
- Emergency archive and kill switches prevent new Skill execution after urgent cache invalidation/broadcast.
- Prompt leakage, Kids safety, rate limit, timeout, billing idempotency, and alert tests pass.
- Support can diagnose common lock/error states by request id without prompt exposure.

---

### M16. Canonical Manifest, Adapter Layer, and MCP Server

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Tool Spec Agent |
| Inputs | `01_Functional_Requirements.md` §4.11, `03_Data_Model_and_API_Spec.md` §8.X/8.Y, `02_UX_Design.md` §4.4a |
| Owns | Canonical Manifest validation, all platform Adapter generation, Adapter download endpoints, live MCP Server |
| Does Not Own | Skill lifecycle management (M02), Relay execution (M05), API Key management (M17) |
| Dependencies | M01 (schema/table), M02 (tool schema fields set by Admin), M05 (execution endpoint), M17 (API Key auth) |

**Work Items**

*Canonical Manifest:*
- 验证 `skills` 表中 `tool_function_name`、`tool_input_schema`、`tool_output_schema` 字段完整性；Admin publish checklist 强制检查（FR-T2）。
- `tool_function_name` 格式校验：`/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/`。
- `tool_input_schema` / `tool_output_schema` 必须是合法 JSON Schema。
- 任意 Manifest 字段变更时设置 `tool_spec_invalidated_at = now()`，触发所有 Adapter 缓存失效。

*Platform Adapters:*
- 实现 `GET /v1/skills/{skill_id}/adapters/{format}` 端点，format 枚举：`openai-action`、`openai-tool`、`gemini-function`、`anthropic-tool`、`claude-code`、`mcp-config`。
- **openai-action**：生成 OpenAPI 3.1 JSON，含 `servers[deeprouter.ai]`、`paths[/v1/skills/execute/{skill_id}]`、`securitySchemes[bearerAuth]`、`operationId=tool_function_name`，input schema 来自 `tool_input_schema`。
- **openai-tool**：生成 OpenAI function calling JSON（`type: function`、`name`、`description`、`parameters`）。
- **gemini-function**：生成 Gemini `functionDeclarations` JSON，参数来自 `tool_input_schema`。
- **anthropic-tool**：生成 Anthropic tool use JSON（`name`、`description`、`input_schema`、`strict: true`）。
- **claude-code**：生成 `.zip` 包，内含 `.claude/skills/<tool_function_name>/SKILL.md`（含 `allowed-tools: mcp__deeprouter__<tool_function_name>`、使用说明、触发场景）和 `examples/` 目录。
- **mcp-config**：生成标准 MCP remote server config JSON（`type: url`、`url: https://deeprouter.ai/mcp`、`headers.Authorization: Bearer ${DEEPROUTER_API_KEY}`）。
- 所有 Adapter 输出不得包含 `instruction_template` 或任何执行逻辑；由单元测试和 launch security review 双重验证。
- Adapter 下载需认证（API Key）且用户必须 `enabled=true`；否则返回 403。
- 触发 `skill_spec_downloaded` 事件，含 `adapter_format`、`skill_id`、`user_id`。

*Live MCP Server:*
- 实现 `GET /mcp`（capability discovery）：返回调用者 API Key 对应用户所有 `enabled=true` Skill 的 tool 列表（MCP 2024-11-05 协议格式）。
- 实现 `POST /mcp`（tool call）：解析 MCP tool call，内部路由到 `/v1/skills/execute/{skill_id}`，执行相同 Auth → Entitlement → Safety → Execution 链，响应转换为 MCP tool result 格式。
- MCP endpoint 认证：`Authorization: Bearer <api_key>`；401 返回 MCP 兼容错误格式。

**Interfaces**

- `GET /v1/skills/{skill_id}/adapters/{format}` — 各平台 Adapter 下载
- `GET /mcp` — MCP capability discovery
- `POST /mcp` — MCP tool call（路由到 M05 执行链）
- `skills.tool_function_name`、`skills.tool_input_schema`、`skills.tool_output_schema`、`skills.tool_spec_invalidated_at`
- Analytics event: `skill_spec_downloaded`（`adapter_format`、`skill_id`、`user_id`）

**Acceptance**

- 所有 6 种 Adapter format 能从同一 Canonical Manifest 正确生成。
- `openai-action.json` 能被 ChatGPT Custom GPT Action 导入并识别工具；ChatGPT 能发出 tool call 到 DeepRouter。
- `anthropic-tool.json` 能被 Claude API tool use 识别；Claude 能发出 tool_use block。
- `claude-code.zip` 解压后的 SKILL.md 能被 Claude Code 识别；Claude Code 能通过 MCP 调用工具。
- `GET /mcp` 返回正确的用户 enabled Skill 列表。
- `POST /mcp` 成功路由到 M05 执行链并返回 MCP 格式响应。
- 未 enable 的 Skill 不出现在 `GET /mcp` 响应中。
- 所有 Adapter 输出经 security review 确认不含 `instruction_template`。
- `tool_spec_invalidated_at` 更新后下次请求重新生成 Adapter 文件。

**Risks**

- 各平台 Adapter 格式随平台更新可能变化（OpenAI / Anthropic / Google schema breaking changes）；需版本化 Adapter 生成逻辑。
- Claude Code SKILL.md 格式依赖 Claude Code 版本；需随 Claude Code 官方文档跟踪。
- MCP 协议 2024-11-05 版本可能有后续更新；需保留协议版本字段。

---

### M17. API Key Management and Copy Protection

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | API Key Agent |
| Inputs | `01_Functional_Requirements.md` §4.12, `03_Data_Model_and_API_Spec.md`, `05_Security_and_NFR.md` |
| Owns | API Key 生成、绑定、撤销、范围限制；copy protection 执行；Key 审计日志 |
| Does Not Own | Relay 执行链（M05）、Adapter 生成（M16）、Entitlement 决策（M06） |
| Dependencies | M01, M05, M06, M11 |

**Work Items**

- 实现用户 API Key 生成（每用户可生成多个 Key）。
- API Key 与用户帐号绑定；配额和 Entitlement 始终针对 Key owner 帐号检查。
- API Key 可绑定 Skill ID 范围（P1：`skill_id` allowlist per Key）。
- 实现 API Key 即时撤销：撤销后下一个请求周期内生效（一次请求内最多延迟，不跨请求）。
- API Key 审计日志：记录创建、范围变更、撤销事件（`actor_id`、`timestamp`、`action`、`key_id`）。
- 防蹭用：tool spec 文件本身不含 Key；分享 spec 给他人不授予任何执行权限（他人调用返回 401）。
- Rate limiting per Key（防止一个 Key 被多人共享滥用）。

**Acceptance**

- 撤销 Key 后该 Key 的所有后续调用返回 401 `AUTH_REQUIRED`，在一次请求周期内生效。
- 两个不同用户帐号的 Key 相互隔离；Key A 无法调用 Key B 的配额或 Entitlement。
- 分享 tool spec 文件但不分享 Key 的用户无法调用 DeepRouter API。
- API Key 审计日志在 Super Admin 界面可查。

---

## 4. Cross-Module Dependencies

### 4.1 Dependency Matrix

| Module | Depends On | Provides To |
|---|---|---|
| M00 | None | All modules |
| M01 | M00 | M02-M12 |
| M02 | M01, M11 | M03, M05, M10, M14 |
| M03 | M01, M06, M08 | M13 |
| M04 | V1 移除 — N/A | N/A |
| M05 | M01, M06, M11, M12 | M07, M08, M10 |
| M06 | M00, M01, M05 | M03, M05, M08 |
| M07 | M01, M05, M06 | M09, M15 |
| M08 | M01, M03, M05, M06, M07, M11 | M09, M13, M15 |
| M09 | M07, M08, M11 | M15 |
| M10 | M00, M02, M05, M06, M11, M12 | M03, M08, M15 |
| M11 | M01, M02, M05, M08, M09 | All modules touching sensitive data |
| M12 | M05, M06, M07, M08, M11 | M15 |
| M13 | M03, M08, M09 | M15 |
| M14 | M01, M02, M03, M11 | M15 |
| M15 | All enabled P0 modules | Launch |

### 4.2 Dependency Graph

```text
M00
  |
  v
M01 ---------------------> M08 -----> M09 ----+
 |                         ^         ^        |
 |                         |         |        |
 +-> M02 -----> M03 -----> M13 ------+        |
 |     |          |                            |
 |     |                                      |
 |     +-------> M10 <----------------+       |
 |                ^                   |       |
 |                |                   |       |
 +-> M05 <----- M06 -----> M07 -------+       |
 |    ^          ^         ^                  |
 |    |          |         |                  |
 +-> M11 --------+---------+------------------+
 |
 +-> M12 -------------------------------------+

All enabled P0 modules -> M15 -> Launch
```

---

## 5. Jira Epic Mapping

| Epic | Modules | Notes |
|---|---|---|
| Epic A. Foundation and Data | M00, M01 | Sprint 0 decisions and schema/API foundation |
| Epic B. Admin Supply | M02, M14 | Official Skill creation and launch content |
| Epic C. User Marketplace | M03, M16 | Browse, enable, My Skills, Tool Spec Download |
| Epic D. Gateway Execution | M05, M06 | Relay, entitlement, quota, provider boundary |
| Epic E. Billing and Business Loop | M07, M08, M09 | Billing attribution, events, dashboards |
| Epic F. Safety and Trust | M10, M11 | Kids safety, prompt protection, RBAC, audit |
| Epic G. Reliability and Release | M12, M15 | NFR, rollout, runbook, launch gates |
| Epic H. Growth P1 | M13 | Rails and growth entry points after P0 closure |

---

## 6. Suggested Sprint Plan

| Sprint | Goal | Modules |
|---|---|---|
| Sprint 0 | Scope and architecture freeze | M00 |
| Sprint 1a | Data/API and admin foundation | M01, M02 skeleton, M11 prompt/audit baseline |
| Sprint 1b | Execution and authorization core | M05, M06, M07 baseline, M12 timeout/rate/context |
| Sprint 2 | User flow closure | M03, M16, M02 publish/preview completion, M08 event instrumentation |
| Sprint 3 | Ops, safety, and data quality | M08 data quality, M09 P0 dashboards, M10 if enabled, M14 launch content |
| Sprint 4 | Hardening and launch | M12 load/alerts/cache, M15, M13 only if P0 is stable |

---

## 7. P0 Minimum Launch Loop

If scope must be compressed, retain only this P0 loop:

1. Super Admin creates, previews, and publishes official Skill.
2. Public/user APIs expose only public Skill metadata.
3. User browses Marketplace, views Detail, enables/disables allowed Skill.
4. My Skills shows executable, locked, deprecated, and unavailable states.
5. User downloads tool spec (OpenAPI / MCP) from Skill Detail and installs into external AI client (ChatGPT / Gemini / Claude); external AI client calls `POST /v1/skills/execute/{skill_id}` with user's API Key.
6. Relay validates auth, tenant, lifecycle, enabled state, entitlement, quota, Kids state if enabled, model whitelist, rate limit, timeout, and context before prompt injection.
7. Relay injects `instruction_template` server-side only.
8. Billing attribution is recorded for successful billable executions only.
9. Analytics records impression, detail, enable, disable, first use, use, repeat use, blocked, timeout, admin action, and safety events where applicable.
10. Ops Dashboard shows Top Skills, funnel, blocked attempts, and revenue attribution.
11. Prompt is absent from all non-Super-Admin surfaces and telemetry.
12. Kids safety hard block is enabled if Kids feature is enabled; otherwise Kids feature flag remains off.
13. Rate limit, timeout, token/context overflow, cache invalidation, circuit breaker, and alerts pass launch tests.
14. Feature flags and kill switches can disable Marketplace, execution, one Skill, Kids mode, provider path, billing path, and recommendation rails.
15. Release checklist records Product, Engineering, Security, QA, Legal/Privacy, Safety if Kids enabled, and Finance if charging enabled sign-off.

---

## 8. Enterprise Readiness Checklist

| Check | Required Before Sprint Ready |
|---|---|
| Scope | Conditional P0 items marked enabled/disabled |
| Ownership | Every module has a primary Agent and owner |
| Inputs | Every Agent knows which PRD files to read |
| Boundaries | Each module defines Does Not Own |
| Interfaces | Tables, APIs, events, flags, and components are named |
| Security | Prompt leakage, RBAC, tenant isolation, audit requirements assigned |
| Data | Event names, fields, freshness, and revenue source aligned |
| UX | Error-code-to-state mapping included in user-facing modules |
| NFR | Timeout, rate limit, p95 targets, alerts, cache invalidation assigned |
| QA | Each module has testable acceptance criteria |
| Release | M15 launch gates include cross-functional sign-off |
