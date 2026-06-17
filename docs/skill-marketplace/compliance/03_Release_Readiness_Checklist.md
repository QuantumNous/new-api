# Skill Marketplace Release Readiness Checklist

## 1. Readiness Definitions

| Stage | Meaning | Current Compliance Position |
|---|---|---|
| Sprint Planning Ready | PRDs are coherent enough for sprint planning using defaults. | GO with `D-01` to `D-08` defaults. |
| Implementation Ready | A module can start build after its affected dependency gates are signed. | CONDITIONAL GO per module. |
| GA Launch Ready | All enabled P0 controls, tests, monitoring, runbooks, and sign-offs are complete. | NO-GO until this checklist passes. |

## 2. Sprint Planning Checklist

- [ ] `tasks/01-07` are treated as implementation Source of Truth.
- [ ] Root PRDs are treated as strategic background only.
- [ ] `D-01` to `D-08` defaults are acknowledged by Product, Engineering, Security, Safety, Data, Finance, and Ops as applicable.
- [ ] Module owners understand which gates affect their implementation.
- [ ] Compliance package has no known conflicts with `tasks/01-07`.
- [ ] Each implementation Agent has a named PRD input list, owned interfaces, explicit exclusions, and compliance gates.
- [ ] P1 items are documented as non-blocking unless explicitly promoted.

## 3. Decision Gate Checklist

| Gate | Required Completion |
|---|---|
| `D-01` | Plan/quota matrix signed before entitlement, billing, quota, lock-state, or UI copy implementation. |
| `D-02` | Analytics sink/dashboard source chosen before M08/M09 dashboard build. |
| `D-03` | Kids remains off/closed beta unless full GA controls and sign-offs pass. |
| `D-04` | Streaming remains P1 unless safety, billing, partial-output, and reliability tests pass. |
| `D-05` | Provider/model allowlist approved before production Relay provider integration. |
| `D-06` | `instruction_template` storage encryption and restricted access approved before production data. |
| `D-07` | Finance confirms gross/net revenue attribution semantics before revenue dashboard or charging launch. |
| `D-08` | 3-5 launch Skills approved before content QA and launch. |

## 4. Product and Functional Readiness

- [ ] Marketplace list, search, filter, detail, enable, disable, and lock states match Functional and UX PRDs.
- [ ] My Skills state reflects lifecycle, entitlement, and user enablement.
- [ ] Playground Skill Picker is NOT exposed to normal users; Playground UI remains general chat only with no Skill selection UI.
- [ ] Relay accepts Skill execution only from authenticated supported entry points: external AI clients with valid API Key via `POST /v1/skills/execute/{skill_id}`, and `admin_preview` endpoint for Super Admin only; normal user Playground Skill execution is not a supported entry point.
- [ ] Deprecated and archived Skill behavior matches lifecycle rules.
- [ ] P1 recommendation rails and CSV export are not required for P0 launch unless explicitly promoted.
- [ ] Unauthenticated Public Skill API, user-created Skills, creator marketplace, multi-Skill stacking, execution logic download, and full sharing/referral are excluded from V1 P0.
- [ ] Tool spec download (OpenAPI / MCP) is available from Skill Detail for enabled users; spec does not contain instruction_template or execution logic (verified by security review).
- [ ] One-click install guides for ChatGPT, Gemini, and Claude are present on Skill Detail page.
- [ ] External AI client can call `/v1/skills/execute/{skill_id}` with valid API Key and receive tool result; same entitlement and Kids safety checks apply as Playground path.
- [ ] External AI client call with invalid/missing API Key receives 401 `AUTH_REQUIRED`.
- [ ] Billing event for external AI client call includes `entry_point=external_ai_client`.

## 5. Data and API Readiness

- [ ] Database migrations include constraints, indexes, rollback plan, and no public selection of `instruction_template`.
- [ ] `skills.max_input_tokens` and `skill_versions.max_input_tokens_snapshot` are implemented and mandatory for Free Skills/free-quota execution paths.
- [ ] `skill_billing_events` is append-only; refund/void/adjustment compensation rows are supported without updating original charged events.
- [ ] `kids_approval_status` includes `emergency_approved` and Kids flags match Data/API PRD.
- [ ] Error envelope and canonical Skill errors are implemented.
- [ ] `/admin/*` and `/ops/*` boundaries are enforced.
- [ ] `timestamp` in events maps to `occurred_at` in UTC at persistence.
- [ ] Analytics `metadata` allowlist is implemented.
- [ ] Restricted metadata keys are rejected or quarantined.
- [ ] `skill_audit_log` records Kids approval/rejection/revocation/override as system-of-record.
- [ ] Emergency override stores `kids_approval_status='emergency_approved'`, not normal `approved`, and includes reason, incident reference, expiry/time-bound scope, and audit record.
- [ ] `skills.model_whitelist` and `skill_versions.model_whitelist_snapshot` contain only platform-registered model alias names; no hardcoded provider-specific versioned identifiers (e.g., `"gpt-4-0613"`). Admin API rejects unregistered alias values.

## 6. Security and Privacy Readiness

- [ ] `instruction_template` never appears in public, user, ops, support, analytics, billing, audit export, error APIs, or tool spec download responses.
- [ ] Tool spec download response is manually reviewed by Security before launch to confirm it contains only schema + endpoint and no execution logic.
- [ ] Playground frontend never receives raw template text.
- [ ] External AI client `skill_id` is read from URL path only; any `skill_id` in request body is discarded (T-24 test required).
- [ ] API Key revocation takes effect within one request cycle; revoked Key returns 401 on all subsequent calls (T-25 test required).
- [ ] Logs, errors, analytics, billing, audit diffs, support diagnostics, and exports contain no raw prompt, full user input, provider raw payload, raw Kids data, or full model output.
- [ ] D-05 provider/model allowlist is approved.
- [ ] Provider DPA, data retention, logging/ZDR, region, subprocessors, and security terms are approved before production provider traffic.
- [ ] Kids provider/model pool includes only providers with approved DPA, no-training commitment, and ZDR/no-retention endpoint or request mode.
- [ ] D-06 encryption and restricted access are approved.
- [ ] Prompt leakage API, log, analytics, billing, audit, export, and error tests pass.
- [ ] Prompt extraction/jailbreak corpus tests pass by detecting/blocking unsafe outputs.
- [ ] Rate limit, timeout, circuit breaker, and kill switch tests pass.
- [ ] Tenant isolation tests pass for API, Relay, cache, analytics, and audit paths.
- [ ] Relay extracts `user_id` and `tenant_id` exclusively from validated auth token claims; tests prove that client-supplied tenant/user fields in request body, headers, or extensions are stripped and cannot influence analytics events, billing records, quota keys, or audit entries.
- [ ] V1 Relay enforces stateless single-turn execution: client-supplied conversation history fields are stripped at Relay entry; provider receives only instruction_template + current user input; token billing reflects single-turn cost only.
- [ ] Redis quota reservation carries a physical TTL of `max(skill.timeout_seconds + 10, 60)` seconds; a simulated pod crash test confirms the reservation is released by TTL and the user's quota is restored without explicit compensation.

## 7. Kids Readiness

- [ ] Kids mode is disabled by default or closed beta unless full GA sign-off is complete.
- [ ] Server derives `is_kids_session`; client-provided Kids fields are ignored.
- [ ] Non-Kids-Safe Skills are blocked before prompt injection in Kids Sessions.
- [ ] Kids Safe execution requires `is_kids_safe=true` and `kids_approval_status='approved'` or time-bounded `emergency_approved` during an audited incident override.
- [ ] `is_kids_exclusive=true` Skills are hidden/blocked from normal sessions unless approved family-mode exception exists.
- [ ] Kids uses only approved safe model pool.
- [ ] Kids safe model pool excludes any provider/model path that cannot guarantee approved ZDR/no-retention and no-training handling.
- [ ] No raw Kids input/output appears in logs, analytics, support diagnostics, exports, billing, or audit diffs.
- [ ] Kids Session analytics uses `user_id=NULL`, `is_kids_session=true`, and `session_id=kids_session_pseudo_id` generated with sticky-salt HMAC unless Legal/Privacy approves a different pseudonymous schema.
- [ ] Kids pseudo id generation uses authenticated session creation time or sticky salt version for that session, not event trigger time, so cross-midnight funnels do not split within one active session.
- [ ] Runtime auth/quota/rate limit and restricted billing use real `user_id` without copying that identifier into Kids business analytics.
- [ ] Kids approval actions are recorded in `skill_audit_log`.
- [ ] Kids incident response, monitoring, and kill switch have been tested, including emergency invalidation/broadcast.

## 8. Analytics and Operations Readiness

- [ ] P0 events `skill_impression`, `skill_detail_view`, `skill_enabled`, `skill_disabled`, `skill_first_use`, `skill_used`, `skill_repeat_use`, `skill_blocked`, `skill_timeout_error`, `skill_admin_action`, and conditional safety events are implemented.
- [ ] `skill_blocked` includes canonical `block_reason`.
- [ ] `skill_safety_violation`, `skill_timeout_error`, and derived `skill_kids_approved` are wired as specified.
- [ ] `skill_reviews` automated safety threshold and manual Ops "Mark for Review" paths are tested.
- [ ] Dashboard source and freshness rules are implemented.
- [ ] Stale or incomplete revenue/safety data is suppressed or labeled.
- [ ] Operation/Product dashboards expose aggregate views only.
- [ ] Support diagnostics are limited and audited.
- [ ] Refund/support traceability joins `skill_billing_events` to `skill_usage_events` only by `request_id` or `idempotency_key`; Kids support tooling must not join by real `user_id`.
- [ ] Event ingestion rejection/quarantine monitoring is configured.
- [ ] `entry_point` values match Data/API enum and V1 does not use `api` as an entry point.
- [ ] `source_entry_point` and `repeat_index` appear only in allowlisted metadata.
- [ ] Retention dashboards label D1/D7/D30 as snapshot retention, not continuous retention.

## 9. Billing and Finance Readiness

- [ ] Entitlement and quota rules match signed D-01 plan matrix.
- [ ] Free Skills and free-quota execution paths enforce `max_input_tokens_snapshot` before provider call and return `SKILL_CONTEXT_TOO_LONG` when exceeded. Truncation is prohibited on free-quota paths; truncation as graceful degradation is only permitted on paid (Pro/Enterprise) paths where the Skill policy explicitly opts in.
- [ ] Relay computes `effective_allowed_models = intersection(user_plan_allowed_models, skill model whitelist snapshot)` and fails closed with `SKILL_PLAN_REQUIRED` when empty.
- [ ] Quota reservation and idempotent compensation restore quota exactly once for all requests that fail before usable provider output — including `SKILL_INTERNAL_ERROR`, `SKILL_TIMEOUT` without usable output, `SKILL_CONTEXT_TOO_LONG`, `SKILL_PLAN_REQUIRED`, `kids_mode_blocked`, safety pre-flight blocks, and any other mid-Relay rejection before provider response. The invariant is principle-based: no usable provider output → restore quota.
- [ ] Quota compensation does not refund gateway rate-limit buckets, concurrency tokens, abuse counters, IP/user/provider token buckets, or Admin Preview limits.
- [ ] Billing attribution stores Skill/version/user/tenant/plan/charge metadata only.
- [ ] Failed, blocked, safety-violating, preview, client-disconnect-before-usable-output, and timeout-without-usable-output paths do not create revenue by default.
- [ ] Client disconnect after usable streamed output is billed partially by actual delivered/consumed tokens under Finance-approved policy.
- [ ] Billable partial streaming charges 100% of actual/provider-reported input tokens once usable output starts; only output tokens are prorated to delivered/generated output.
- [ ] Streaming timeout after usable partial output settles by actual delivered/consumed tokens under Finance-approved policy.
- [ ] Gross revenue dashboard counts only positive `charge_status='charged'`.
- [ ] Net revenue/reconciliation views include append-only `refunded`/`voided` compensation rows only as negative adjustments.
- [ ] Refund, void, and adjustment flows insert compensating `skill_billing_events` rows and never UPDATE the original charged event.
- [ ] Finance signs off before charging or revenue dashboard launch.
- [ ] Billing attribution failure behavior is approved; paid paths fail closed unless Finance approves fallback.

## 10. Operational Release Readiness

- [ ] Release runbook covers feature flags, rollback, provider disablement, Skill kill switch, Kids kill switch, and incident contacts.
- [ ] Emergency disablement for Kids, provider path, single Skill, and global execution propagates within the security/NFR target.
- [ ] Provider/model HTTP calls are verified to run outside database transactions and do not hold pooled DB connections during external execution.
- [ ] Cross-provider fallback uses conservative token/context budget with safety buffer and returns `SKILL_CONTEXT_TOO_LONG` before provider 400 when needed.
- [ ] Kids severe-abuse path can trigger restricted Auth/Risk account-level action without exposing real user identity in business analytics.
- [ ] Monitoring covers latency, success, timeout, blocked, safety violation, provider error, billing reconciliation, event quarantine, and stale cache.
- [ ] Alert ownership is assigned to Engineering, Security/Safety, Data, Finance, and Ops as applicable.
- [ ] Content QA completed for D-08 launch catalog.
- [ ] Admin preview is excluded from business analytics and revenue but still emits audit/security telemetry.
- [ ] Admin preview has a dedicated hard limit, default maximum 50 previews per Admin per UTC day unless Security approves a different cap.
- [ ] Admin preview output passes the same content safety, prompt leakage, output leakage, provider allowlist, and Kids/content-safety guardrails as production execution.
- [ ] Access reviews completed for Super Admin, Operation, Safety Reviewer, Product/Growth, Support.
- [ ] Feature flags exist for Marketplace, Skill execution, single Skill disablement, Kids mode, provider path, billing path, and recommendation rails where enabled.
- [ ] Rollback preserves usage, billing, and audit history after GA traffic.

## 11. Module Handoff Checklist

Each Agent/module handoff must include:

- [ ] Upstream PRD sections read and cited in implementation ticket.
- [ ] Owned APIs, tables, events, feature flags, and UI surfaces listed.
- [ ] Explicit "Does Not Own" scope listed to prevent duplicate implementation.
- [ ] Conditional gates listed: D-01 to D-08, Kids, streaming, revenue, provider, encryption.
- [ ] Security/privacy acceptance criteria listed.
- [ ] Analytics and audit events listed where applicable.
- [ ] Test plan includes success, blocked, error, permission, privacy, and rollback cases.

## 12. Final Sign-Offs

| Owner | Required Sign-Off |
|---|---|
| Product | Scope, launch catalog, plan/quota copy, UX states |
| Engineering | API, Relay, integration, NFR, runbook |
| Security | Prompt protection, RBAC, audit, provider allowlist, encryption |
| Safety | Kids workflow, safety tests, incident response |
| Legal / Privacy | Kids GA if enabled, privacy, retention, export policy, provider DPA/security terms, output/IP/copyright terms |
| Data | Event schema, sink, dashboard source, data quality, freshness |
| Finance | Charging, revenue attribution, billing failure policy |
| QA | Regression, security, Kids if enabled, release checklist execution |
| CTO / Release Manager | Final launch decision |

## 13. Launch Decision

- [ ] Sprint Planning GO with defaults is recorded.
- [ ] All enabled module implementation gates are signed.
- [ ] All P0 checklist items pass.
- [ ] All required sign-offs are recorded.
- [ ] Known P1 items are documented and do not block P0 launch.
- [ ] GA Launch decision is explicitly changed from NO-GO to GO by CTO / Release Manager.
