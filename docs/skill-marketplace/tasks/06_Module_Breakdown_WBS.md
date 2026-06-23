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

V1 是官方 curated 的 Skill Marketplace，作为 DeepRouter **订阅的内容附加价值层**交付（见 `00_Overview.md` §0 与决策 `D-09`）。zip 包采用 **Claude Code 原生格式**（SKILL.md + manifest.json + 可选 scripts/references/sub-agents），解压到 `.claude/skills/` 即可用 `/skillname` 调用。DeepRouter 不参与执行、不计执行 token。每个 Skill 发布前须通过 **Evaluation Pipeline**（格式/任务完成度/违规/完整性），evaluation failed 不能发布。

V1 P0 闭环：

```text
Super Admin 创建 Skill（SKILL.md + 可选 scripts/references/sub-agents）
→ 触发 Evaluation Pipeline（格式 / 任务完成度 / 违规 / 完整性）
→ Evaluation passed → 发布，打包为 SKILL.md 兼容 zip
→ 用户浏览 / 搜索 / 收藏 / 查看详情（Tier 1 tracking）
→ 下载时校验订阅级别（一次性）→ 下载 zip
→ 用户本地解压，用任意 LLM 运行（DeepRouter 不参与）
→ 授权用户回传 installed / used（Tier 2 tracking，opt-in）
→ Operations 监控下载量、转化率、评分、Evaluation 结果，优化内容质量
```

### 1.2 Locked V1 Decisions

| Area | Decision |
|---|---|
| Skill supply | Official curated Skills only |
| Distribution | SKILL.md 兼容 zip（manifest + SKILL.md + 可选 scripts/references/sub-agents）；解压即用 |
| Public Skill routing/execution API | **Not in scope**；DeepRouter 不执行 Skill；本地运行，任意 LLM |
| Evaluation Pipeline | **In scope P0**；格式/任务完成度/违规/完整性；passed 才能发布 |
| Multi-Skill stacking | Out of scope |
| User-created Skills | Out of scope |
| Creator marketplace/revenue share | Out of scope |
| Per-execution billing | **Not in scope**；Entitlement 在下载时一次性校验；无 execution token 计费 |
| Prompt confidentiality | **Not a control**；published SKILL.md 随包分发可读 |
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
| D-06 | `instruction_template` encryption mechanism | **Re-scoped under D-09**: published templates ship in the package and need no confidentiality encryption; encryption-at-rest still applies to drafts and to genuinely sensitive server-side config (provider creds, routing logic) | Security + Backend | M01, M11 |
| D-07 | Revenue counting statuses | Gross uses positive `charged`; net/reconciliation includes negative refund/void compensation rows | Finance + Data | M07, M09 |
| D-08 | Initial official Skill catalog | 3-5 launch Skills with examples | Product + Ops | M02, M14, M15 |
| D-09 | Skill distribution model | Content marketplace, no runtime binding：SKILL.md 兼容 zip；护城河 = Marketplace 平台粘性（发现/策展/Evaluation/评分）；DeepRouter 不执行 Skill；Entitlement 在下载时校验；Tier 2 遥测须用户显式授权 | Product + Architecture | M02, M03, M04, M08, M15 |

---

## 2. Module Map

### 2.1 Module Overview

| Module | Name | Priority | Primary Agent | Suggested Sprint |
|---|---|---|---|---|
| M00 | Scope, Decision, and Architecture Freeze | P0 | Product/Architecture Agent | Sprint 0 |
| M01 | Data Model, Migration, and API Foundation | P0 | Data/API Agent | Sprint 1a |
| M02 | Admin Skill Management, Lifecycle, and Packaging | P0 | Admin Supply Agent | Sprint 1a-2 |
| M03 | Marketplace, My Skills, and Download Experience | P0 | Marketplace UX/API Agent | Sprint 2 |
| M04 | Skill Package & Download Client | P0 | Packaging/Client Agent | Sprint 2 |
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

- Freeze V1 as downloadable-package execution via the public routing API (R2/D-09); Admin Preview retained for testing.
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
- Public APIs may expose the **published** `instruction_template` (it ships in the package); ensure no query ever returns provider credentials, server routing/model-selection config, or draft templates to non-Super-Admin surfaces.
- Implement migration order and rollback plan.
- Reuse existing feature flag/config system; create new `platform_configs` only if the platform lacks one and Data/API is updated.

**Interfaces**

- Tables: `skills`, `skill_versions`, `skills_i18n`, `user_enabled_skills`, `skill_usage_events`, `skill_billing_events`, `skill_reviews`, `skill_audit_log`.
- `skills.max_input_tokens` cost guardrail plus `skill_versions.max_input_tokens_snapshot`, mandatory for Free Skills and free-quota execution paths.
- Error codes: `AUTH_REQUIRED`, `SKILL_NOT_FOUND`, `SKILL_NOT_PUBLISHED`, `SKILL_NOT_ENABLED`, `SKILL_PLAN_REQUIRED`, `SKILL_SUBSCRIPTION_INACTIVE`, `SKILL_QUOTA_EXCEEDED`, `SKILL_KIDS_MODE_BLOCKED`, `SKILL_CONTEXT_TOO_LONG`, `SKILL_RATE_LIMITED`, `SKILL_TIMEOUT`, `SKILL_SAFETY_VIOLATION`, `SKILL_INTERNAL_ERROR`.

**Acceptance**

- Migration runs cleanly in staging from empty state.
- Rollback is documented and tested before GA traffic.
- Provider credentials and server routing/model-selection config appear only in restricted server-side stores, never in any public/user/ops query or the package.
- Public/user/ops response examples may include the published template but exclude provider secrets and routing internals.
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
| Owns | Admin APIs/UI for official Skill creation, versioning, preview, publish, deprecate, archive, and downloadable package build |
| Does Not Own | End-user Marketplace, Relay runtime, Ops dashboard, the runtime client logic inside the package (M04) |
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
- **Package build on publish (FR-A19/FR-A20)**: produce a versioned zip (manifest + `instruction_template` + thin client calling the DeepRouter routing API), pinned to `skill_version_id`; build-time check that no provider credentials / server routing logic are embedded and that the work step calls DeepRouter (runtime-dependency guard).
- Featured flag and featured rank management.
- Required plan, monetization, free quota, timeout, model whitelist settings.
- Audit log writes for all sensitive actions and prompt access.

**Interfaces**

- `/api/v1/admin/skills`
- `/api/v1/admin/skills/{skill_id}/versions`
- `/api/v1/admin/skills/{skill_id}/preview`
- `/api/v1/admin/skills/{skill_id}/publish-checklist`
- `/api/v1/admin/skills/{skill_id}/publish`
- `/api/v1/admin/skills/{skill_id}/package` (build/rebuild downloadable zip for the active version)
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

- Package build must never embed provider credentials, server routing/model-selection logic, or any secret that would let the package bypass DeepRouter.
- Kids approval APIs are required only if Kids feature can be enabled.

---

### M03. Marketplace and My Skills Experience

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Marketplace UX/API Agent |
| Inputs | `01_Functional_Requirements.md`, `02_UX_Design.md`, `03_Data_Model_and_API_Spec.md` |
| Owns | Marketplace list/detail, package download, My Skills, availability/lock states |
| Does Not Own | Playground execution, recommendation algorithms, Ops dashboards |
| Dependencies | M01, M06, M08 instrumentation baseline |

**Work Items**

- Marketplace list with public fields only.
- Search by public name/description only.
- Category and plan filters.
- Skill Detail with plan, availability, runtime-dependency note (needs a DeepRouter key to run), Download CTA, AI disclosure. *(V1: examples/input hints deferred — not exposed by `PublicSkillDetail`; DR-53 follow-up.)*
- Download / remove-from-My-Skills flows (download record = `user_enabled_skills`).
- My Skills with downloaded, executable, locked, deprecated, archived states.
- Error-code-to-UX-state mapping.
- Anonymous browsing with login CTA. *(V1: deferred — Marketplace/Detail are authenticated-only; separate route-opening ticket.)*
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
- Pro Skill download before upgrade is not allowed in V1 baseline.
- UI never exposes provider credentials or server routing internals (the published template itself is allowed, since it ships in the package).
- Download/remove emits required events through M08 contract.

**Risks**

- If M06 availability API is not ready, frontend lock states may drift from Relay truth. Relay remains source of truth.

---

### M04. Skill Package & Download Client

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Packaging/Client Agent |
| Inputs | `01_Functional_Requirements.md`, `02_UX_Design.md`, `03_Data_Model_and_API_Spec.md`, `05_Security_and_NFR.md` |
| Owns | Package format/manifest schema, the thin runtime client bundled in the package, the public routing API client contract |
| Does Not Own | Relay authorization, routing/model selection, billing (all server-side in M05/M06/M07) |
| Dependencies | M02 (package build), M05 (public routing API), M06 |

**Work Items**

- Define the package format: zip containing manifest, `instruction_template`, and the thin runtime client.
- Implement the runtime client whose core work step calls the DeepRouter public routing/execution API with `skill_id`, user input, and the runner's own credential.
- Read the runner's DeepRouter credential from the runner's environment; on missing/invalid credential surface `AUTH_REQUIRED` with a signup/onboarding prompt; no offline fallback execution.
- Send exactly one `skill_id`; never send trusted Kids state, `user_id`, or `tenant_id` (Relay derives identity from the credential).
- Map standard error codes to friendly client-side messages.
- Ensure the package carries no provider credentials, server routing logic, or billing policy.

**Public Routing API Call Contract**

```json
{
  "model": "model_id",
  "messages": [{"role": "user", "content": "..."}],
  "deeprouter": {
    "skill_id": "6e3f...",
    "skill_version_id": "..."
  }
}
```

Headers: `Authorization: Bearer <runner DeepRouter key>` (identity/billing bound to this credential, server-side).

**Acceptance**

- A downloaded package runs only when the runner provides a valid DeepRouter credential; otherwise it fails with `AUTH_REQUIRED` and prompts signup.
- The package's real work goes through the DeepRouter routing API; removing that call removes the Skill's routing capability (runtime-dependency moat holds).
- Each call is attributed/billed to the runner's credential, not to the original downloader.
- Locked, disabled, unauthorized, archived, quota, and Kids states return a Relay block response surfaced by the client.
- Client-provided `is_kids_session`/identity is never trusted and is ignored by Relay.

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

- Expose the public routing/execution API and accept `deeprouter.skill_id` from the downloaded package (and Admin Preview) in V1.
- Resolve authenticated runner (user, tenant, session, subscription, plan) from the validated credential, plus server-derived Kids state.
- Apply feature flag and kill switch checks.
- Validate lifecycle, enabled state, entitlement, quota, rate limit, Kids policy, model whitelist, provider capability, context size, and timeout before provider call.
- Compute `effective_allowed_models = intersection(user_plan_allowed_models, skill model whitelist snapshot)` and route only within that set.
- Enforce the immutable `max_input_tokens_snapshot` selected at request entry for Free Skills and free-quota paths before provider call, in addition to provider context limits.
- **Stateless single-turn enforcement (FR-G19)**: Strip any client-supplied conversation history fields at Relay entry. Provider call must include only `instruction_template` + current user input. No prior-turn messages may be forwarded to the provider.
- **Identity immutability (T-21)**: Extract `user_id` and `tenant_id` exclusively from validated auth token claims. Discard and overwrite any client-supplied `tenant_id`, `user_id`, or equivalent fields in request body, query params, or non-auth headers before constructing any analytics event, billing record, quota key, or cache key.
- Load immutable execution snapshot and `skill_version_id` (server-authoritative; package-supplied template/routing hints are not trusted over the server snapshot).
- Perform routing/model selection server-side and construct the provider call (the proprietary capability the package depends on).
- Execute provider/model HTTP calls outside database transactions and without holding pooled DB connections.
- Use conservative token/context estimation across all allowed fallback models, with at least 20% safety buffer for cross-provider fallback.
- Preserve policy precedence: Kids hard constraints > platform policy > tenant policy > Skill instruction > user message.
- Keep smart-router blind to billing policy, provider credentials, and tenant-sensitive details (the published `instruction_template` is no longer secret).
- For Kids Session, keep real `user_id` in runtime context for auth/quota/rate-limit/billing while emitting analytics with `user_id=NULL` and `session_id=kids_session_pseudo_id`.
- Emit usage, blocked, timeout, safety, and billing attribution events through the appropriate modules.

**Acceptance**

- Relay never performs provider execution if a pre-execution check fails.
- User APIs, UI, logs, errors, billing, analytics, audit, and provider logs do not leak provider credentials, provider raw payloads, raw user input, PII, or Kids sensitive input.
- Model routing never falls back outside the Skill whitelist.
- Model routing never falls back outside the user's plan-allowed model set.
- Model routing never falls back to a provider/model whose conservative context budget would overflow.
- Provider execution does not run inside an open DB transaction.
- Existing non-Skill API calls remain unchanged.
- In-flight requests use the execution snapshot selected at request entry.

**Risks**

- Provider adapters without reliable system boundary cannot run Kids, Pro-gated, or high-sensitivity Skills unless Security approves.
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

### M11. Security, Package Boundary, and Audit

> **R2 reframe (D-09)**: prompt confidentiality is no longer the security boundary — the published `instruction_template` ships inside the downloadable package and is expected to be readable/copyable. The moat is now **(a)** keeping provider credentials and the server-side routing/model-selection logic off the package and off all non-Super-Admin surfaces, and **(b)** per-call authentication + billing integrity so every run is attributed to a real, billable runner credential.

| Field | Definition |
|---|---|
| Priority | P0 |
| Primary Agent | Security Agent |
| Inputs | `05_Security_and_NFR.md`, `03_Data_Model_and_API_Spec.md`, all modules touching secrets/logs/events/package build |
| Owns | Package-content boundary, provider-secret protection, telemetry redaction (non-template), credential/identity integrity, RBAC hardening, audit policy, security tests |
| Does Not Own | Product copy, dashboard metric formulas, billing reconciliation |
| Dependencies | M01, M02, M04, M05, M08, M09 |

**Work Items**

- Enforce that the package and all non-Super-Admin surfaces never contain provider credentials, server routing/model-selection logic, or draft templates.
- Enforce identity/billing integrity: runner identity comes only from the validated credential; package-supplied `user_id`/`tenant_id`/Kids fields are discarded (T-21 immutability).
- Enforce telemetry redaction for provider raw payloads, raw user input, PII, and Kids sensitive input (no longer for `instruction_template`).
- Enforce structured user input separation; no user input interpolation into the system prompt.
- Implement admin audit for template edits, version creation, and package builds.
- Enforce tenant isolation tests across API, Relay, cache, analytics, and audit.
- Define provider SDK logging restrictions.
- Define telemetry restricted-key rejection rules.
- Define abuse controls for the public routing API (key abuse, credential sharing, runaway packages).

**Acceptance**

- No surface and no package ever expose provider credentials or server routing internals.
- Identity/billing cannot be spoofed by package-supplied fields; runner credential is authoritative.
- Audit records use hashes and changed field names for sensitive server-side config; template edits and package builds are audited.
- Public routing API abuse and credential-sharing controls pass launch threshold.
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
- Provider credentials and server routing internals are never included in public content, examples, exports, or the package; the published template may appear in the package by design.

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
- Security regression: provider-secret/routing-logic leakage, package-content boundary, identity/billing spoofing, RBAC, tenant isolation, public routing API abuse, Kids spoof.
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
- Provider-secret/routing-logic leakage, identity/billing spoofing, Kids safety, rate limit, timeout, billing idempotency, and alert tests pass.
- Support can diagnose common lock/error states by request id without exposing provider payloads or raw user input.

---

## 4. Cross-Module Dependencies

### 4.1 Dependency Matrix

| Module | Depends On | Provides To |
|---|---|---|
| M00 | None | All modules |
| M01 | M00 | M02-M12 |
| M02 | M01, M11 | M03, M04, M05, M10, M14 |
| M03 | M01, M06, M08 | M04, M13 |
| M04 | M02, M05, M06 | M05, M08 |
| M05 | M01, M06, M11, M12 | M07, M08, M10 |
| M06 | M00, M01, M05 | M03, M04, M05, M08 |
| M07 | M01, M05, M06 | M09, M15 |
| M08 | M01, M03, M05, M06, M07, M11 | M09, M13, M15 |
| M09 | M07, M08, M11 | M15 |
| M10 | M00, M02, M05, M06, M11, M12 | M03, M04, M08, M15 |
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
 +-> M02 -----> M03 -----> M04       |        |
 |     |          |         |         |        |
 |     |          +-------> M13 ------+        |
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
| Epic C. User Marketplace | M03, M04 | Browse, download, My Skills, package & runtime client |
| Epic D. Gateway Execution | M05, M06 | Relay, entitlement, quota, provider boundary |
| Epic E. Billing and Business Loop | M07, M08, M09 | Billing attribution, events, dashboards |
| Epic F. Safety and Trust | M10, M11 | Kids safety, package boundary & provider-secret protection, identity/billing integrity, RBAC, audit |
| Epic G. Reliability and Release | M12, M15 | NFR, rollout, runbook, launch gates |
| Epic H. Growth P1 | M13 | Rails and growth entry points after P0 closure |

---

## 6. Suggested Sprint Plan

| Sprint | Goal | Modules |
|---|---|---|
| Sprint 0 | Scope and architecture freeze | M00 |
| Sprint 1a | Data/API and admin foundation | M01, M02 skeleton incl. package build, M11 package-boundary/audit baseline |
| Sprint 1b | Execution and authorization core | M05, M06, M07 baseline, M12 timeout/rate/context |
| Sprint 2 | User flow closure | M03, M04, M02 publish/preview completion, M08 event instrumentation |
| Sprint 3 | Ops, safety, and data quality | M08 data quality, M09 P0 dashboards, M10 if enabled, M14 launch content |
| Sprint 4 | Hardening and launch | M12 load/alerts/cache, M15, M13 only if P0 is stable |

---

## 7. P0 Minimum Launch Loop

If scope must be compressed, retain only this P0 loop:

1. Super Admin creates, previews, and publishes official Skill.
2. Publish produces a versioned downloadable package (manifest + template + thin client) with no provider secrets.
3. User browses Marketplace, views Detail, downloads allowed Skill package.
4. My Skills shows downloaded, executable, locked, deprecated, and unavailable states.
5. The downloaded package calls the DeepRouter public routing API with the runner's own credential; one `skill_id` per call.
6. Relay validates credential, tenant, lifecycle, download/entitlement state, quota, Kids state if enabled, model whitelist, rate limit, timeout, and context before provider execution.
7. Relay performs routing/model selection and executes server-side; provider credentials never leave the server.
8. Billing attribution is recorded for successful billable executions only.
9. Analytics records impression, detail, enable, disable, first use, use, repeat use, blocked, timeout, admin action, and safety events where applicable.
10. Ops Dashboard shows Top Skills, funnel, blocked attempts, and revenue attribution.
11. Provider credentials, server routing logic, provider raw payloads, raw user input, and PII are absent from all non-Super-Admin surfaces and telemetry (the published template may appear in the package by design).
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
