# Skill Marketplace CTO PRD Consistency Control Board

本文档是 DeepRouter Skill Marketplace V1 的 CTO 级 PRD 一致性控制台。它不再重复旧版 monolithic PRD 的问题清单，而是用于治理当前模块化 PRD 集合，确保 Functional、UX、Data/API、Analytics、Security/NFR、WBS 在范围、术语、错误码、事件、权限、NFR 和上线门槛上保持一致。

审查对象：

- `tasks/00_Overview.md`
- `tasks/01_Functional_Requirements.md`
- `tasks/02_UX_Design.md`
- `tasks/03_Data_Model_and_API_Spec.md`
- `tasks/04_Analytics_and_Operations.md`
- `tasks/05_Security_and_NFR.md`
- `tasks/06_Module_Breakdown_WBS.md`

---

## 1. CTO Executive Verdict

### 1.1 Current Status

| Area | CTO Verdict | Notes |
|---|---|---|
| Product Direction | GO (R2 re-scoped) | Downloadable Skill-package marketplace; moat = runtime DeepRouter dependency + own-key auth/billing (D-09). Prompt confidentiality dropped |
| Module PRD Quality | GO | `01-07` are now enterprise-level modular specs |
| Sprint Planning | GO with defaults | Sprint 0 decisions are defaulted for planning; owner sign-off still required before affected implementation starts |
| Implementation | CONDITIONAL GO | Per-module implementation can start when that module's defaulted decisions, dependencies, and security gates are accepted |
| Launch / GA | NO-GO | Requires M15 release gates, Security, QA, Legal/Privacy, Finance if charging, and Safety if Kids enabled |

### 1.2 CTO Summary

The PRD set is directionally consistent and suitable for technical review. The remaining risk is not missing documentation volume; it is decision closure and cross-module enforcement. The main CTO concern is preventing parallel Agents from implementing different interpretations of Kids mode, streaming, billing, analytics fields, RBAC, feature flags, and prompt-protection requirements.

### 1.3 Sprint Readiness Rule

No module may be marked Sprint Ready unless:

1. Its upstream source-of-truth document is identified.
2. Its conditional P0 scope is explicitly enabled or disabled.
3. Its API, data, event, and error-code dependencies are stable.
4. Its security and NFR requirements are assigned to module owners.
5. Its acceptance criteria are testable.

---

## 2. Source of Truth Matrix

| Domain | Source of Truth | Enforced By | Notes |
|---|---|---|---|
| Product scope and P0/P1/P2 | `01_Functional_Requirements.md` | CTO + Product | If WBS conflicts with FRD, FRD wins |
| User journeys and role behavior | `01_Functional_Requirements.md` | Product + QA | Includes lifecycle, entitlement, Kids paths |
| UX states and frontend behavior | `02_UX_Design.md` | Design + Frontend | Error-code-to-state mapping lives here |
| Data model, enums, API, error envelope | `03_Data_Model_and_API_Spec.md` | Backend + Data/API Agent | Schema and route contracts win over WBS summaries |
| Analytics events, metrics, dashboards | `04_Analytics_and_Operations.md` | Data + Product + Ops | Must align to Data/API table names and event fields |
| Security, RBAC, privacy, NFR | `05_Security_and_NFR.md` | Security + SRE + QA | Launch gate for prompt/Kids/tenant isolation |
| Module ownership, dependencies, Sprint plan | `06_Module_Breakdown_WBS.md` | EM + TPM + CTO | Planning artifact, not a schema/API authority |
| CTO gate and consistency status | `07_CTO_PRD_Review_Action_Items.md` | CTO | Tracks decision gates, defaults, and cross-PRD drift |

---

## 3. Cross-PRD Consistency Matrix

| Topic | Required Unified Decision | Current Status | Owner | Source |
|---|---|---|---|---|
| V1 execution surface | Downloaded package → public routing API (R2/D-09); Admin Preview retained; in-platform Playground execution replaced | Aligned | Product + Backend | FRD, UX, Data/API, WBS |
| Skill supply | Official curated Skills only | Aligned | Product | FRD, WBS |
| Platform IP protection (R2) | Published `instruction_template` ships in package (not protected); provider credentials + server routing/model-selection logic + identity/billing integrity are the protected boundary | Aligned | Security + Backend | FRD, Data/API, Security |
| Lifecycle status | `draft`, `published`, `deprecated`, `archived`; `featured` is a flag | Aligned | Backend + Product | FRD, Data/API |
| Featured/rails | P1 except optional configured Featured | Aligned | Product + Growth | UX, Analytics, WBS |
| Kids mode | Conditional P0 if enabled; otherwise closed beta/off by default | Defaulted for Sprint Planning | Product + Safety + Legal | FRD, UX, Security, WBS |
| Streaming | P1 unless declared launch P0 | Defaulted as P1 for Sprint Planning | Product + Engineering + Finance | FRD, Analytics, Security, WBS |
| Entitlement | Use-time check on every execution | Aligned | Backend | FRD, Data/API, Security |
| Pro enable | Free users cannot enable Pro Skill before upgrade in V1 baseline | Aligned | Product + Frontend | UX, Data/API |
| Billing source | `skill_billing_events` for attribution, not invoice source of truth | Aligned | Billing + Finance | Data/API, Analytics |
| Revenue status | Gross attribution counts positive `charged` rows only by default; net/reconciliation includes append-only refund/void compensation rows as negative adjustments | Defaulted for Sprint Planning; Finance sign-off before revenue launch | Finance + Data | Data/API, Analytics, Security, WBS |
| Streaming partial billing | Streaming timeout or client disconnect after usable partial output settles by actual delivered/consumed tokens; no-output/safety-abort stays no-charge by default | Aligned | Product + Finance + Engineering | FRD, Data/API, Analytics, Security, WBS |
| Partial streaming input tokens | Once usable output starts, input tokens are charged 100%; only output tokens may be prorated | Aligned | Finance + Backend | Data/API, Security, WBS, Compliance |
| Quota compensation | Quota uses request reservation and idempotent compensation for internal error/provider timeout before usable output | Aligned | Backend + SRE + Product | FRD, Security, WBS |
| Rate limit vs quota | Business quota may be compensated; rate-limit buckets, concurrency tokens, and abuse counters are never refunded | Aligned | SRE + Security + Backend | Security, WBS, Compliance |
| Error codes | Stable `SKILL_*` codes plus `AUTH_REQUIRED` | Aligned | Backend + Frontend | FRD, Data/API, UX |
| Block reasons | Lowercase enum in data model; API exposes stable error code | Aligned with implementation note | Backend + Data | FRD, Data/API |
| Entry points | `marketplace_card`, `skill_detail`, `my_skills`, `saved_list`, `featured`, `popular`, `new`, `recommended`, `admin_preview`, `search_results`, `skill_package`, `playground_picker` legacy-only | Aligned | Data + Frontend | Data/API, Analytics, UX |
| Analytics timestamp | Event `timestamp` maps to DB `occurred_at` | Aligned | Data | Data/API, Analytics, WBS |
| Metadata privacy | `metadata` allowlist; reject restricted keys | Aligned | Data + Security | Analytics, Security |
| RBAC | `/admin/*` Super Admin; `/ops/*` aggregate Ops/Product views | Aligned | Security + Backend | FRD, Data/API, Security |
| CSV export | P1 aggregate-only; hidden in P0 unless approved | Aligned | Product + Security | UX, Analytics, WBS |
| Review workflow | P1; P0 dashboard can launch without full workflow | Aligned | Ops + Product | FRD, UX, WBS |
| NFR targets | p95, timeout, rate limit, alert freshness defined | Aligned | SRE + Backend | Security, WBS |
| Feature flags | Marketplace, execution, Skill, Kids, provider, billing, recommendations | Aligned | SRE + Product | Security, WBS |
| Provider legal/security gate | Production provider traffic requires allowlist plus DPA, retention, ZDR/logging, region, subprocessors, output/IP terms approval | Aligned | Legal/Privacy + Security + Engineering | Security, WBS, Compliance |
| Kids runtime vs analytics identity | Relay uses real user in runtime/billing; Kids analytics persists `user_id=NULL` and sticky-salt HMAC pseudonymous `session_id` | Aligned | Security + Data + Legal/Privacy | FRD, Data/API, Analytics, Security, Compliance |
| Kids risk enforcement | Severe Kids abuse is actioned by restricted Auth/Risk systems using runtime identity, not by de-anonymizing analytics | Aligned | Security + Safety + Legal/Privacy | Security, Compliance, WBS |
| Review creation triggers | `skill_reviews` created by automated safety threshold or manual Ops "Mark for Review" | Aligned | Ops + Product + Data | Data/API, Analytics, WBS |
| Provider transaction boundary | Provider/model HTTP calls must never run inside DB transactions | Aligned | Architecture + Backend + SRE | Security, WBS, Compliance |
| Cross-provider context budget | Smart Router fallback uses conservative token/context budget with safety buffer | Aligned | Backend + Security | FRD, Security, WBS |
| Free-path token cap | Free Skills/free-quota paths enforce immutable `max_input_tokens_snapshot` before provider call | Aligned | Product + Backend + Finance | FRD, Data/API, Security, WBS |
| Model entitlement intersection | Relay routes only to intersection of user-plan allowed models and Skill whitelist | Aligned | Backend + Security | Security, WBS |
| Kids provider ZDR | Kids traffic uses only provider/model paths with approved DPA, no-training, and ZDR/no-retention | Aligned | Security + Legal/Privacy + Safety | Security, WBS |
| Admin Preview control | Preview excluded from business metrics/revenue but hard-limited, audited, and safety-scanned like production | Aligned | Security + Admin + Safety | Security, WBS, Compliance |
| Analytics extended fields | `source_entry_point` and `repeat_index` stored in allowlisted metadata | Aligned | Data | Data/API, Analytics |
| Kids approval event | `skill_audit_log` is system-of-record; analytics event is derived | Aligned | Data + Safety | Data/API, Analytics, Security |
| Upgrade intent | `upgrade_clicked` and Upgrade Intent Rate are P1 | Aligned | Product + Data | Analytics |
| Stateless single-turn execution | V1 Relay strips prior-turn conversation history before every provider call; each request is independent; token billing reflects single-turn cost only (FR-G19) | Aligned | Backend + Security | FRD FR-G19, Security T-22 + §4.3, WBS M05, Release Checklist §6 |
| Model alias requirement | `skills.model_whitelist` and `skill_versions.model_whitelist_snapshot` must contain only platform-registered alias names (e.g., `"smart-tier"`); hardcoded versioned IDs (e.g., `"gpt-4-0613"`) are prohibited; Admin API rejects unregistered values | Aligned | Security + Product | Data/API DDL Note, Security NFR §5.4, WBS M05, Release Checklist §5 |
| Tenant identity immutability | `user_id` and `tenant_id` extracted exclusively from validated JWT/Auth token claims; client-supplied values in request body, headers, or query extensions are discarded before analytics, billing, quota, and audit processing | Aligned | Backend + Security | Security NFR §4.3 + T-21, WBS M05, Release Checklist §6 |
| Quota reservation TTL safety net | Redis quota reservation carries physical TTL of `max(skill.timeout_seconds + 10, 60)` seconds; TTL auto-releases on pod crash; TTL release is already compensated — no separate compensation call required | Aligned | Backend + SRE | Security NFR §8.1.1, WBS M06, Release Checklist §6 |
| Kill switch broadcast mechanism | Skill kill switch must use Redis pub/sub or equivalent push mechanism for ≤5-second propagation; short-TTL polling alone is explicitly prohibited | Aligned | SRE + Backend | WBS M12, Security NFR |
| Emergency Kids approval expiry | `kids_emergency_approval_expires_at TIMESTAMPTZ NULL`; maximum 72-hour window; Relay treats expired `emergency_approved` as rejected; daily background job scans and enforces expiry | Aligned | Product + Safety | Data/API DDL + Notes, Compliance §4, FRD AC |
| Deprecated patch activation API | `activate_as_deprecated_patch: true` body flag on POST version activation; atomically activates version while keeping status `deprecated`; emits `version_activated_deprecated_patch` audit event; 409 if version is not currently deprecated | Aligned | Backend + Product | Data/API §10.4, FRD §5.4, Compliance audit log |
| `ai_disclosure_required` DB field | `skills.ai_disclosure_required BOOLEAN NOT NULL DEFAULT true`; V1 platform default always true per regulatory policy; DB column, API response field, and policy rule must be consistent | Aligned | Backend + Product | Data/API DDL, FRD |
| Billing immutability DB trigger | PostgreSQL trigger `skill_billing_events_prevent_charged_mutation` raises EXCEPTION on any UPDATE to a `charge_status='charged'` row; refunds/voids are insert-only compensating rows | Aligned | Finance + Backend + Data | Data/API §4.5, Security |
| `version_activated_deprecated_patch` audit action | Listed as a Versioning category action in `skill_audit_log`; required for complete audit trail when deprecated Skills receive security patches | Aligned | Data + Security | Compliance/02_Audit_RBAC_Privacy.md §3 |

---

## 4. Sprint 0 Decision Gate

Sprint 0 is complete only when the following decisions are signed off or explicitly defaulted.

| ID | Decision | Default | Owner | Blocked Modules | CTO Gate |
|---|---|---|---|---|---|
| D-01 | Free / Pro / Enterprise plan matrix and free quota | Defaulted for planning; freeze before affected implementation | Product + CEO | M03, M06, M07, M09 | Required before affected Sprint 1b implementation |
| D-02 | Analytics build vs buy | Event schema may proceed; freeze sink/dashboard source before M08/M09 build | EM + Product | M08, M09 | Required before M08/M09 dashboard build |
| D-03 | Kids release mode | Closed beta/off unless GA controls pass | Product + Safety + Legal | M02, M05, M10, M15 | Required before any Kids launch path |
| D-04 | Streaming launch scope | P1 by default | Product + Engineering + Finance | M05, M07, M10, M12 | Required before streaming implementation |
| D-05 | Provider system-boundary allowlist and legal/security terms | Explicit allowlist plus provider DPA/security terms before production traffic | Security + Engineering + Legal/Privacy | M05, M10, M11, M15 | Required before production Relay provider integration |
| D-06 | `instruction_template` encryption mechanism | Re-scoped under D-09: encryption only for drafts + sensitive server-side config (provider creds, routing logic); published templates ship in package | Security + Backend | M01, M11 | Required before production data |
| D-07 | Revenue counting statuses | Gross attribution uses positive `charged`; net/reconciliation includes negative refund/void compensation rows | Finance + Data | M07, M09 | Required before revenue dashboard |
| D-08 | Initial official Skill catalog | 3-5 launch Skills | Product + Ops | M02, M14, M15 | Required before launch content QA |
| D-09 | Skill distribution & runtime dependency model (R2) | Enabled: downloadable zip packages; template public in package; runtime-dependency + own-key auth/billing moat; public routing API is the execution entry; Playground execution replaced (Admin Preview retained) | Product + Architecture | M02, M03, M04, M05, M11, M15 | Foundational; gates packaging, routing API, and security reframe |

### 4.1 Decision Status

| ID | Status | Notes |
|---|---|---|
| D-01 | Defaulted for planning | Plan/quota matrix must be signed before M03/M06/M07 implementation requiring lock, quota, or billing copy |
| D-02 | Defaulted for planning | Event schema can proceed; sink/dashboard tooling must be chosen before M08/M09 build |
| D-03 | Defaulted for planning | Kids mode closed beta/off by default unless Safety/Legal/Product approve GA |
| D-04 | Defaulted for planning | Streaming is P1; non-streaming execution is P0 |
| D-05 | Defaulted for planning | Explicit approved provider/model allowlist plus DPA, retention, ZDR/logging, region, subprocessors, and output/IP terms required before production Relay provider traffic |
| D-06 | Defaulted for planning | DB/storage encryption plus restricted access; field encryption if available before production |
| D-07 | Defaulted for planning | Gross revenue attribution counts positive `charge_status='charged'`; net/reconciliation includes append-only refund/void compensation rows as negative adjustments; Finance sign-off before revenue launch |
| D-08 | Defaulted for planning | 3-5 launch Skills required before content QA and launch |

---

## 5. Resolved Issues From Earlier CTO Review

The following earlier review findings have been resolved or absorbed into the modular PRDs.

| Earlier Issue | Resolution | Source |
|---|---|---|
| P0/P1 scope overload | WBS now separates P0, P1, Conditional P0 | `06_Module_Breakdown_WBS.md` |
| Execution surface (R2/D-09) | Public routing API is the V1 execution entry, called by the downloaded package; Playground execution replaced; Admin Preview retained | FRD, UX, Data/API, WBS, Security |
| `featured` as lifecycle status | Resolved as `featured_flag`/`featured_rank` | FRD, Data/API |
| Leakage scope (R2 reframe) | Protected set is now provider credentials + server routing logic + raw input/PII/provider payloads (published template excluded); package-content boundary added | Security/NFR §0, §3.2 |
| Kids absolute safety promise risk | Reframed as conditional P0 / closed beta unless controls pass | FRD, UX, Security, WBS |
| Streaming billing ambiguity | Default P1; safety/no-output partials not charged by default; timeout or client disconnect after usable partial output settles by actual tokens | FRD, Data/API, Analytics, Security, WBS |
| RBAC ambiguity | Admin/Ops/Support/Safety/Super Admin split defined | FRD, UX, Data/API, Security |
| Error JSON invalidity | Standard envelope defined | Data/API |
| Anonymous response ambiguity | Anonymous list/detail semantics defined | Data/API, UX |
| `user_enabled_skills` state model | Composite PK current-state model defined | Data/API |
| Secret leakage / spoofing test gaps | Security tests matrix redefined for provider-secret/routing leakage, identity/billing spoofing (T-23), runtime-dependency integrity (T-24), credential abuse (T-25) | Security/NFR |
| Module/Agent ambiguity | Agent-based WBS defined | WBS |
| Multi-turn System Prompt Tax | FR-G19 added; V1 Relay enforces stateless single-turn; prior-turn history stripped; T-22 added to threat model | FRD §1.2 + FR-G19 + §3.3, Security NFR §4.3 + T-22, WBS M05, Release Checklist §6 |
| Dangling Quota Reservation | Redis TTL `max(timeout_seconds + 10, 60)` added as safety net; compensation rule changed from enumeration-based to principle-based (no usable provider output → restore quota) | Security NFR §8.1.1, WBS M06, Release Checklist §6 + §9 |
| Hardcoded Model Deprecation | Model alias requirement enforced; `model_whitelist` PROHIBITED comment added to DDL; Admin API validation added; Release Checklist item added | Data/API DDL Note, Security NFR §5.4, WBS M05, Release Checklist §5 |
| Tenant Spoofing Data Poisoning | Identity immutability assertion added; T-21 (Tenant Spoofing) added to threat model; `user_id`/`tenant_id` JWT-only rule enforced; Release Checklist test added | Security NFR §4.3 + T-21, WBS M05, Release Checklist §6 |
| Kill switch "TTL-only" loophole | Explicit Redis pub/sub or equivalent push mechanism required for ≤5-second kill switch propagation; TTL-only approach prohibited | WBS M12 |
| Free-path truncation still permitted | Explicit prohibition of truncation on free-quota path added in three places; only valid response is `SKILL_CONTEXT_TOO_LONG` | Security NFR §5.4 + test table §14.1, Release Checklist §5 |
| `ai_disclosure_required` missing from DB | `ai_disclosure_required BOOLEAN NOT NULL DEFAULT true` column added to `skills` DDL to match API response field | Data/API §4.1 DDL |
| `kids_emergency_approval_expires_at` missing from schema | Field added to `skills` DDL; enforcement rules added (72h max, Relay rejects expired, daily background job) | Data/API §4.1 DDL + Notes, Compliance §4 |
| Deprecated patch activation had no API semantics | `activate_as_deprecated_patch: true` flag defined with full request/response/audit semantics | Data/API §10.4 |
| Billing append-only not enforced at DB level | PostgreSQL trigger DDL added to physically prevent UPDATE on `charged` rows | Data/API §4.5 |
| `version_activated_deprecated_patch` missing from audit log | Action added to Versioning category in audit log spec | Compliance/02_Audit_RBAC_Privacy.md §3 |
| `max_input_tokens_snapshot` rule missing from version table | Rule added requiring `max_input_tokens_snapshot` to be copied from skill at version creation | Data/API §4.2 |
| Enumeration-based quota compensation in WBS and Checklist | Both changed to principle-based rule after NFR fix; WBS M06 and Release Checklist §9 now consistent with NFR §8.1.1 | WBS M06, Release Checklist §9 |
| `max_input_tokens` missing from UX editor | Field added to Skill Editor execution fields (required for Free Skills) and Publish Checklist validation | UX §4.7.3 + §4.7.4 |

---

## 6. CTO Action Item Status

### 6.1 P0 Before Sprint Ready

| ID | Action | Owner | Target Doc | Exit Criteria |
|---|---|---|---|---|
| CTO-P0-01 | Default all Sprint 0 decisions D-01 to D-08 for planning | CTO + Owners | `00`, `06`, `07` | Done: defaulted in `00` and `07`; owner sign-off remains per module |
| CTO-P0-02 | Add Analytics sample payloads for `skill_impression`, `skill_used`, `skill_blocked` | Data Agent | `04` | Done |
| CTO-P0-03 | Clarify Analytics `timestamp` to `occurred_at` mapping in Analytics spec | Data Agent | `03`, `04` | Done |
| CTO-P0-04 | Classify `skill_kids_approved` as admin/audit workflow event and define storage target | Data + Safety | `03`, `04` | Done |
| CTO-P0-05 | Confirm event extended fields `source_entry_point` and `repeat_index` storage | Data Agent | `03`, `04` | Done: allowlisted metadata |
| CTO-P0-06 | Confirm revenue metric counts only approved charge statuses | Finance + Data | `04`, `07` | Done for planning: gross uses positive `charged`; net/reconciliation uses negative refund/void compensation rows; Finance sign-off before revenue launch |
| CTO-P0-07 | Decide whether `upgrade_clicked` is P0 or keep Upgrade Intent Rate P1 | Product + Data | `04` | Done: P1 |
| CTO-P0-08 | Align FRD Sprint 0 decision IDs with WBS D-01 to D-08 or cross-reference them | Product Agent | `01`, `06`, `07` | Done |
| CTO-P0-09 | Resolve Kids runtime `user_id` vs analytics zero-user persistence conflict | Security + Data | `01`, `03`, `04`, `05` | Done: Relay runtime context, billing persistence, and analytics pseudonymous session rules are separated |
| CTO-P0-10 | Define `skill_reviews` creation triggers | Ops + Product + Data | `03`, `04` | Done: automated safety threshold and manual Ops "Mark for Review" trigger are specified |
| CTO-P0-11 | Prohibit provider calls inside database transactions | Architecture + Backend + SRE | `05` | Done: provider HTTP execution must happen outside DB transactions; NFR test added |
| CTO-P0-12 | Define cross-provider token/context fallback budget | Backend + Security | `05` | Done: conservative fallback budget and minimum 20% buffer required before provider call |
| CTO-P0-13 | Close streaming timeout free-riding loophole | Product + Finance + Backend | `01`, `03`, `04`, `05`, `06` | Done: usable partial streaming timeout is not a free path and settles by actual delivered/consumed tokens |
| CTO-P0-14 | Define quota reservation and compensation semantics | Backend + SRE + Product | `05`, `06` | Done: principle-based rule (no usable provider output → restore quota exactly once); Redis TTL `max(timeout_seconds + 10, 60)` seconds as pod-crash safety net |
| CTO-P0-15 | Separate Kids analytics anonymity from security enforcement | Security + Safety + Legal/Privacy | `05`, `06`, Compliance | Done: restricted Auth/Risk systems can act on runtime identity without de-anonymizing analytics |
| CTO-P0-16 | Prevent partial-streaming input-token cost inversion | Finance + Backend | `03`, `05`, `06`, Compliance | Done: input tokens charge 100% once usable output starts; only output tokens prorate |
| CTO-P0-17 | Separate quota compensation from rate-limit accounting | SRE + Security + Backend | `05`, `06`, Compliance | Done: rate-limit/concurrency/abuse buckets are never refunded |
| CTO-P0-18 | Harden Admin Preview against abuse | Security + Admin + Safety | `05`, `06`, Compliance | Done: preview has hard limits, audit/security telemetry, and production-equivalent safety scans |
| CTO-P0-19 | Prevent Free Skill token-cost bankruptcy | Product + Backend + Finance | `01`, `03`, `05`, `06` | Done: `max_input_tokens` is required/enforced for Free/free-quota paths |
| CTO-P0-20 | Prevent model whitelist privilege escalation | Backend + Security | `05`, `06` | Done: Relay uses user-plan/model-whitelist intersection and blocks empty set |
| CTO-P0-21 | Make billing ledger append-only | Finance + Backend + Data | `03`, `05`, `06` | Done: refund/void/adjustment requires compensating event, not UPDATE |
| CTO-P0-22 | Enforce Kids provider ZDR/no-training path | Security + Legal/Privacy + Safety | `05`, `06` | Done: non-ZDR providers cannot enter Kids Safe model pool |
| CTO-P0-23 | Define deprecated Skill patch rollout | Product + Security + Backend | `01`, `06` | Done: safety/quality patch versions activate for existing entitled users only |
| CTO-P0-24 | Enforce stateless single-turn execution (FR-G19, Multi-turn System Prompt Tax) | Backend + Security | `01`, `05`, `06`, Compliance | Done: FR-G19 added; Relay strips prior-turn history; T-22 in threat model; Release Checklist §6 test added |
| CTO-P0-25 | Add Redis TTL safety net for dangling quota reservations (pod crash scenario) | Backend + SRE | `05`, `06`, Compliance | Done: TTL = `max(timeout_seconds + 10, 60)` s in NFR §8.1.1; WBS M06 updated; Release Checklist §6 pod crash test added |
| CTO-P0-26 | Prohibit hardcoded model versioned IDs in `model_whitelist` | Security + Product | `03`, `05`, `06`, Compliance | Done: PROHIBITED DDL comment in Data/API; alias requirement in NFR §5.4; WBS M05 updated; Release Checklist §5 admin validation item added |
| CTO-P0-27 | Enforce tenant identity immutability (JWT claims only, T-21 Tenant Spoofing) | Backend + Security | `05`, `06`, Compliance | Done: Identity Immutability Assertion in NFR §4.3; T-21 in threat model; WBS M05 updated; Release Checklist §6 test added |
| CTO-P0-28 | Specify kill switch broadcast mechanism (push, not TTL-only) | SRE + Backend | `06` | Done: WBS M12 updated to require Redis pub/sub or equivalent push; TTL-only approach prohibited |
| CTO-P0-29 | Add expiry field for emergency Kids approval status | Product + Safety | `03`, Compliance | Done: `kids_emergency_approval_expires_at TIMESTAMPTZ NULL` in DDL; enforcement rules in Data/API Notes; Compliance §4 updated |
| CTO-P0-30 | Define API semantics for deprecated Skill patch activation | Backend + Product | `03`, `01` | Done: `activate_as_deprecated_patch: true` body flag with full semantics in Data/API §10.4; FRD §5.4 aligned |
| CTO-P0-31 | Enforce billing immutability at DB level | Finance + Backend | `03` | Done: PostgreSQL trigger DDL `skill_billing_events_prevent_charged_mutation` added in Data/API §4.5 |

### 6.2 P1 Before Implementation Ready

| ID | Action | Owner | Target Doc | Exit Criteria |
|---|---|---|---|---|
| CTO-P1-01 | Add dashboard permission matrix to Analytics spec | Data + Security | `04` | Done |
| CTO-P1-02 | Add data freshness suppression rule for alerts | Data + SRE | `04` | Done |
| CTO-P1-03 | Clarify V1 identity stitching policy | Product + Data + Legal | `04` | Done: disabled by default unless approved |
| CTO-P1-04 | Add UTC timezone rule for retention cohorts | Data Agent | `04` | Done |
| CTO-P1-05 | Update README description for `06` and `07` to reflect new roles | Docs Agent | `tasks/README.md` | Done |

---

## 7. Module Readiness Gate

| Module | CTO Status | Blocking Items |
|---|---|---|
| M00 Scope/Decision | Sprint Ready with defaults | D-01 to D-08 defaulted for planning; owner sign-off still required before affected implementation |
| M01 Data/API | Sprint Planning Ready | D-06 encryption sign-off before production data |
| M02 Admin | Sprint Planning Ready | D-03 only if Kids paths enabled; M11 audit baseline before sensitive prompt access |
| M03 Marketplace | Sprint Planning Ready with D-01 dependency | Plan/quota copy and lock states finalize before affected UI implementation |
| M04 Playground | Sprint Planning Ready | M05/M06 contracts must land before full execution QA |
| M05 Relay | Sprint Planning Ready with gated implementation | D-05 provider allowlist before provider integration; provider DPA/security terms before production provider traffic; D-03 if Kids; D-04 if streaming |
| M06 Entitlement | Sprint Planning Ready with D-01 dependency | Plan/quota finalization before quota/lock implementation |
| M07 Billing | Sprint Planning Ready with D-01/D-07 dependency | Finance sign-off before charging/revenue launch; D-04 if streaming |
| M08 Analytics | Sprint Ready with D-02 dependency | Event/schema spec ready; tooling decision before dashboard build |
| M09 Ops Dashboard | Sprint Ready with D-02/D-07 dependencies | Revenue card requires charging/revenue sign-off |
| M10 Kids Safety | Conditional Sprint Planning Ready | Off/closed beta by default; Safety sign-off before Kids launch path |
| M11 Security/NFR | Sprint Planning Ready | D-05 provider allowlist/legal/security terms and D-06 encryption before production |
| M12 Reliability | Sprint Planning Ready | D-04 if streaming |
| M13 Growth | P1 Hold | Starts only after P0 loop stable |
| M14 Content Ops | Sprint Planning Ready with D-08 dependency | Launch catalog required before content QA |
| M15 Release | Not Ready | All enabled P0 modules and sign-offs |

---

## 8. Consistency Rules for Future PRD Edits

1. Any new user-facing locked or blocked state must add an API error code or reuse an existing code.
2. Any new event must define producer, trigger, required fields, privacy rule, dashboard use, and storage target.
3. Any new table or field must update Data/API and downstream Analytics/WBS if consumed.
4. Any new Admin or Ops capability must update RBAC in FRD, UX, Data/API, and Security.
5. Any Kids-related change must update FRD, UX, Data/API, Analytics, Security, and WBS.
6. Any billing or revenue change must update Data/API, Analytics, Security, and WBS.
7. Any streaming change must be explicitly marked P1 or launch P0 and must update billing, safety, and NFR.
8. Any prompt-adjacent field must be reviewed by Security before implementation.
9. WBS can summarize module ownership but must not redefine schema, error codes, or event contracts.
10. This file tracks consistency and gates; it must not become the implementation spec.

---

## 9. CTO Go / No-Go

| Gate | Verdict | Required Before Upgrade |
|---|---|---|
| Product Direction | GO | None |
| Module PRD Review | GO | Continue peer review and QA review |
| Technical Review | GO for Sprint Planning | Owner sign-off required before affected implementation |
| Sprint Planning | GO with defaults | Use D-01 to D-08 defaults unless owners override in writing |
| Module Implementation | CONDITIONAL GO | Per-module dependencies and acceptance criteria approved |
| GA Launch | NO-GO | M15 launch gates and all required Security, QA, Legal/Privacy, Finance, and Safety sign-offs complete |

### 9.1 Shortest Path to Sprint Ready

1. Use D-01 to D-08 defaults for Sprint Planning unless an owner overrides in writing.
2. Keep Kids GA, streaming launch P0, revenue launch, production provider DPA/legal/security terms, and encryption choices behind their explicit module gates.
3. Run final cross-PRD review for error codes, events, RBAC, Kids, streaming, and billing before implementation kickoff.

### 9.2 Implementation Guardrail

Engineering may begin isolated foundation work only where decisions are not blocking:

- Data/API schema scaffolding excluding unresolved plan/quota defaults.
- Admin draft lifecycle without Kids GA assumptions.
- Prompt redaction and audit baseline.
- Relay non-streaming execution skeleton behind feature flag.
- Analytics schema validation skeleton without dashboard source lock-in.

Do not implement user-created Skills, recommendation ML, full streaming billing, or Kids GA behavior until explicitly approved. (The public routing/execution API is now in V1 scope under D-09 as the package execution entry point.)
