# Skill Marketplace Compliance Control Board

## 1. Purpose

This document is the compliance control board for Skill Marketplace V1. It summarizes release gates, owner sign-offs, and cross-document consistency requirements. Detailed controls live in the numbered compliance files.

## 2. Current Compliance Verdict

| Area | Status | Notes |
|---|---|---|
| Sprint Planning | GO with defaults | Use canonical `D-01` to `D-08` defaults from `tasks/07_CTO_PRD_Review_Action_Items.md`. |
| Module Implementation | CONDITIONAL GO | Each affected module must satisfy its dependency gate before implementation or launch. |
| Kids GA | NO-GO by default | Kids is disabled or closed beta unless Product, Safety, Legal, Engineering, and QA approve GA. |
| Production Provider Integration | GATED | Requires explicit provider/model system-boundary allowlist plus Legal/Privacy and Security approval for DPA, retention, logging/ZDR, region, subprocessors, and provider terms. |
| Production Prompt Storage | GATED | Requires DB/storage encryption plus restricted access; field encryption if available. |
| Revenue Launch | GATED | Revenue dashboard and charging require Finance sign-off; gross attribution counts positive `charged` rows, while net/reconciliation must include append-only refund/void compensation rows as negative adjustments. |
| GA Launch | NO-GO | Requires all P0 release checklist items and sign-offs. |

## 3. Source-of-Truth Traceability

Compliance must not create a second product spec. Each compliance control must trace back to one or more implementation PRDs.

| Compliance Area | Primary PRD Source | Compliance File | Sprint Ready Use |
|---|---|---|---|
| Scope, roles, journeys, lifecycle, block reasons | `tasks/01_Functional_Requirements.md` | This file, `03_Release_Readiness_Checklist.md` | Validate no compliance rule expands V1 scope. |
| UX states, error presentation, accessibility | `tasks/02_UX_Design.md` | `03_Release_Readiness_Checklist.md` | Validate launch checks include user-visible states. |
| Schema, enums, API routes, error envelope | `tasks/03_Data_Model_and_API_Spec.md` | `02_Audit_RBAC_Privacy.md`, `03_Release_Readiness_Checklist.md` | Validate compliance uses the same tables, routes, and enums. |
| Events, metrics, dashboards, freshness, alerting | `tasks/04_Analytics_and_Operations.md` | `02_Audit_RBAC_Privacy.md`, `03_Release_Readiness_Checklist.md` | Validate event names, metadata allowlist, and export rules. |
| Prompt protection, Kids, RBAC, privacy, NFR | `tasks/05_Security_and_NFR.md` | `01_Safety_And_Kids_Mode.md`, `02_Audit_RBAC_Privacy.md` | Validate launch blockers and security tests. |
| Module ownership and sequencing | `tasks/06_Module_Breakdown_WBS.md` | This file, `03_Release_Readiness_Checklist.md` | Validate each Agent has compliance gates. |
| CTO status and Go/No-Go | `tasks/07_CTO_PRD_Review_Action_Items.md` | This file | Validate Sprint Planning vs Implementation vs GA status. |

If a compliance statement conflicts with `tasks/01-07`, the owning PRD must be fixed or the compliance statement must be changed before implementation kickoff.

## 4. Canonical Gates

| Gate | Compliance Interpretation | Required Before |
|---|---|---|
| `D-01` | Plan/quota matrix is defaulted for planning, but must be signed before affected entitlement, billing, quota, lock-state, or copy implementation. | M03, M06, M07, M09 |
| `D-02` | Event schemas can proceed; analytics sink/dashboard source must be chosen before dashboard build. | M08, M09 |
| `D-03` | Kids remains off or closed beta unless full Kids GA controls pass. | Any Kids launch path |
| `D-04` | Streaming is P1 by default; if promoted to P0, streaming safety and billing semantics require sign-off. | Streaming implementation |
| `D-05` | Only approved providers/models with reliable system-boundary behavior may execute Skills. | Relay provider integration |
| `D-06` | `instruction_template` must be protected by storage encryption and restricted access before production data. | Production data |
| `D-07` | Revenue attribution counts only Finance-approved charge statuses; V1 gross attribution uses positive `charged`, and net/reconciliation uses negative refund/void compensation rows. | Revenue dashboard / charging launch |
| `D-08` | Initial official catalog must be approved before content QA and launch. | Launch content QA |

## 5. Module Compliance Readiness

| Module | Compliance Status | Compliance Gate |
|---|---|---|
| M00 Scope/Decision | Sprint Ready with defaults | `D-01` to `D-08` must remain accepted defaults or owner-signed decisions. |
| M01 Data/API | Sprint Ready | D-06 before production data; schema must keep restricted data out of public/user/ops paths. |
| M02 Admin | Sprint Ready with audit dependency | M11 audit/redaction baseline before prompt access; D-03 only if Kids paths are enabled. |
| M03 Marketplace | Sprint Ready with D-01 dependency | Lock states and plan copy must match final plan/quota decision before affected UI implementation. |
| M04 Playground | Sprint Ready | Sends only `deeprouter.skill_id`; Relay remains source of truth for auth, entitlement, and Kids. |
| M05 Relay | Sprint Ready with gated implementation | D-05 plus provider DPA/security terms before production provider integration; D-03 if Kids enabled; D-04 if streaming promoted. |
| M06 Entitlement | Sprint Ready with D-01 dependency | Use-time checks required; enablement is not permanent authorization. |
| M07 Billing | Sprint Ready with D-07 dependency | No charge for blocked/failed/no-output-timeout/safety/preview paths; usable partial streaming timeout settles by actual tokens if streaming is enabled. |
| M08 Analytics | Sprint Ready with D-02 dependency | Event schema ready; sink/dashboard tool decision required before dashboard build. |
| M09 Ops Dashboard | Sprint Ready with D-02/D-07 dependency | Aggregate views only; revenue card requires Finance/revenue gate. |
| M10 Kids Safety | Conditional Sprint Ready | Off/closed beta by default; full Safety/Legal/Product sign-off before Kids GA. |
| M11 Security/NFR | Sprint Ready | Prompt leakage, RBAC, tenant isolation, provider allowlist/DPA/security terms, encryption gates owned here. |
| M12 Reliability | Sprint Ready | Timeout, rate limit, cache, circuit breaker, emergency invalidation, observability tests required before launch. |
| M13 Growth | P1 Hold | Must not block P0 launch; rails require analytics and privacy controls if enabled. |
| M14 Content Ops | Sprint Ready with D-08 dependency | Launch catalog/content QA and output/IP/copyright terms review required before release. |
| M15 Release | Not GA Ready | Requires all enabled P0 module gates and sign-offs. |
| M16 Tool Spec Generation | Sprint Ready with M01/M02 dependency | tool spec fields in `skills` table required; spec must never contain instruction_template; security review gate before launch. |
| M17 API Key Management | Sprint Ready with M05/M06 dependency | API Key binding and revocation required before external AI client launch; per-Key rate limits and scope restriction P1. |

## 6. Non-Negotiable Controls

- `instruction_template` is never returned by public, user, ops, support, analytics, billing, audit export, or error APIs — including the tool spec download endpoint.
- Tool spec download (OpenAPI / MCP) contains only `tool_function_name`, `tool_input_schema`, `tool_output_schema`, and the DeepRouter API endpoint URL. It must pass a security review confirming no execution logic leakage before launch.
- Public/user/ops/support logs must not contain raw prompt text, raw full user input, provider raw payload, raw Kids input/output, or full model output.
- `skill_audit_log` is the system-of-record for sensitive admin changes, including Kids approval, rejection, revocation, and emergency override.
- Emergency Kids override must use `kids_approval_status='emergency_approved'`, never normal `approved`, and must include reason, incident reference, expiry/time-bound scope, and audit record.
- Analytics event payload field `timestamp` maps to persisted `occurred_at` in UTC.
- Analytics `metadata` is allowlisted only; restricted keys are rejected or quarantined.
- `/api/v1/admin/*` is Super Admin by default; `/api/v1/ops/*` is for aggregate Operation/Product views.
- CSV/export is not P0. P1 exports are aggregate-only unless Super Admin explicitly performs an audited export.
- Kids safety blocks occur before prompt injection and before provider calls.
- Kids Session analytics persists `user_id=NULL` and HMAC `kids_session_pseudo_id`; runtime authorization/quota/rate-limit and restricted billing may use real `user_id`.
- Kids pseudo id salt version must be sticky to authenticated session creation time or gateway session salt version so cross-midnight active funnels do not split.
- Kids provider/model execution requires approved DPA, no-training commitment, and ZDR/no-retention path; providers without that path are excluded from Kids Safe model pool.
- Refund/support reconciliation between billing and anonymous usage events must use `request_id` or `idempotency_key`, not Kids real `user_id`.
- Severe Kids abuse enforcement is handled by restricted Auth/Risk systems using runtime identity; business analytics must remain pseudonymous.
- Kids, provider, single-Skill, and global execution kill switches must use emergency invalidation/broadcast and not rely solely on normal cache TTL.
- Provider/model HTTP calls must never run inside an open database transaction.
- Cross-provider fallback must use conservative token/context estimation with a safety buffer before provider calls.
- Free Skills and free-quota execution paths must enforce the Skill/version `max_input_tokens` cap before provider calls.
- Relay model routing must use `effective_allowed_models = intersection(user_plan_allowed_models, skill model whitelist snapshot)` and fail closed when the intersection is empty.
- Quota uses request reservation and idempotent compensation for eligible internal-error/provider-timeout failures before usable output.
- Quota compensation restores only business/monthly quota. Rate-limit buckets, concurrency tokens, abuse counters, and Admin Preview limits are never refunded.
- Failed, blocked, timeout-without-usable-output, safety-violating, preview, and client-disconnect-before-usable-output responses do not create revenue by default.
- Client disconnect after usable streamed output is not a free path and must follow Finance-approved actual-token partial billing.
- For billable partial streaming, input tokens are charged at 100% once usable output starts; only output tokens may be prorated to delivered/generated output.
- Streaming timeout after usable partial output is not a free path and must follow Finance-approved actual-token settlement.
- `skill_billing_events` is append-only; refunds, voids, and adjustments use compensating rows and never UPDATE the original charged event.
- Admin Preview is excluded from business analytics/revenue, but it must have hard limits, audit/security telemetry, and the same safety/leakage/provider guardrails as production execution.

## 7. P0/P1 Compliance Boundary

| Item | V1 Compliance Decision |
|---|---|
| Public Skill API | Out of scope; no compliance approval for launch implementation. |
| User-created Skills | Out of scope; not permitted in V1. |
| Prompt download/export | Not permitted. |
| CSV/export | P1 aggregate-only unless audited Super Admin export is explicitly approved. |
| Recommendation rails | P1; optional Featured only if configured and tracked through existing events. |
| Review workflow | P1; P0 can ship with minimum dashboard and manual review path. |
| Streaming | P1 unless D-04 promotes it and safety/billing/NFR gates pass. |
| Kids GA | NO-GO by default; closed beta/off unless D-03 GA sign-offs pass. |

## 8. Document Map

| Control Domain | Detailed File |
|---|---|
| Kids release mode, Kids runtime safety, prompt injection, output safety | `01_Safety_And_Kids_Mode.md` |
| Audit actions, RBAC matrix, privacy, metadata allowlist, data retention, export policy | `02_Audit_RBAC_Privacy.md` |
| Sprint Ready, Implementation Ready, GA Launch, sign-off checklist | `03_Release_Readiness_Checklist.md` |

## 9. Required Sign-Offs

| Sign-Off | Required When |
|---|---|
| Product | Scope, plan/quota, launch catalog, Marketplace UX, recommendation rails |
| Engineering | Relay, API, analytics pipeline, NFR, release runbook |
| Security | Prompt protection, provider allowlist, encryption, RBAC, audit, abuse controls |
| Safety | Kids flags, Kids approval workflow, safety test corpus, Kids incident response |
| Legal / Privacy | Kids GA, privacy policy, retention, export, user data handling, provider DPA/security terms, output/IP/copyright terms |
| Finance | Charging, markup, refund/void behavior, revenue attribution |
| QA | P0 regression, security tests, release checklist execution |

## 10. Maintenance Rule

Any compliance change that alters product behavior, schema, events, RBAC, billing, Kids mode, or security posture must be reflected in the relevant `tasks/*` PRD in the same change set.
