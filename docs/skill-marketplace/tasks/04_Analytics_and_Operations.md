# Skill Marketplace Analytics and Operations Specification

本文档定义 DeepRouter Skill Marketplace V1 的企业级 Analytics、Dashboard、运营监控、数据质量和运营权限规则。目标是让 Product、Growth、Operations、Data、Engineering、Finance、Safety、Security 和独立 Agent 按同一套事件、字段、指标、权限和告警口径工作。

本文件以上游 PRD 为基准：产品范围以 `01_Functional_Requirements.md` 为准；表结构、枚举、API 错误码以 `03_Data_Model_and_API_Spec.md` 为准；隐私、RBAC、安全和 NFR gate 以 `05_Security_and_NFR.md` 为准。

---

## 1. Analytics Scope

### 1.1 V1 Analytics Questions

V1 analytics must answer:

1. Which Skills are discovered, enabled, and successfully used?
2. Where do users drop off from impression to repeat use?
3. Which users are blocked by plan, quota, subscription, lifecycle, Kids mode, or safety?
4. Which Skills drive repeat use, revenue attribution, or upgrade intent?
5. Which Skills need operational review due to quality, safety, low activation, high block rate, timeout, or revenue anomaly?

### 1.2 Non-Scope for V1 P0

| Item | Decision |
|---|---|
| Execution analytics (server-side) | In scope for DeepRouter-routed Skill execution surfaces, including `skill_used`, `skill_repeat_use`, and `skill_blocked`; purely local/off-platform execution remains out of scope |
| Per-execution billing analytics | In scope at the attribution boundary via `skill_billing_events` when DeepRouter-routed execution reaches billable settlement; blocked paths create no billing row |
| Full referral attribution | V1.1 |
| A/B experiment dashboard | P1/V1.1 |
| Tier 2 aggregated dashboard | P1；须 Tier 2 数据量达统计意义后启用 |
| ML recommendation ranking | V2 |
| User-level analytics export for Ops/Product | Not allowed in P0 |

---

## 2. Data Sources and Storage Targets

| Source | Table / System | Purpose | Owner |
|---|---|---|---|
| Skill metadata | `skills`, `skill_versions`, `skills_i18n` | Status, plan, category, version, Kids flags | Backend |
| User downloads | `user_enabled_skills` | Download state, enabled date, last used | Backend |
| Usage events (Tier 1) | `skill_usage_events` | Marketplace behavior analytics (impression/view/save/download/rate/report) | Backend/Data |
| Usage events (Tier 2) | `skill_usage_events` (Tier 2 subset) | Local installed/used events（opt-in 授权用户） | Backend/Data |
| Evaluation results | `skill_evaluations` | Per-version evaluation status, score, issues | Backend/Data |
| Ratings | `skill_ratings` | Star ratings and comments per user per skill | Backend |
| Saves / Favorites | `skill_saves` | User save and favorite records | Backend |
| Reviews | `skill_reviews` | Operational quality workflow | Operations |
| Audit | `skill_audit_log` | Admin action system-of-record | Security/Backend |
| Subscription state | Existing billing/subscription system | Plan and active/inactive state | Billing |
| User profile/persona | Existing user/tenant profile | Coarse segmentation | Product/Data |

Analytics dashboards must not read or expose `instruction_template`, `prompt_guard_template`, raw full user input, provider raw payload, or Kids sensitive content.

Retention implementation note: `skill_usage_events` is an append-only hot event stream, not the permanent warehouse. Keep raw rows hot for 90 days, then archive or aggregate before deletion; dashboards that need longer lookbacks must read aggregate/archive tables rather than extending raw retention by default.

---

## 3. Event Taxonomy

### 3.1 P0 Events

**Tier 1 事件（平台侧，无需用户授权）**

| Event | Producer | Trigger | Storage Target | Required Core Properties |
|---|---|---|---|---|
| `skill_impression` | Frontend | Skill card or rail item becomes visible | `skill_usage_events` | `event_id`, `timestamp`, `schema_version`, `user_id` nullable, `session_id`, `skill_id`, `entry_point` |
| `skill_detail_view` | Frontend | Skill Detail opened | `skill_usage_events` | Core + `metadata.source_entry_point` |
| `skill_saved` | Backend | User saves/bookmarks Skill | `skill_usage_events` + `user_saved_skills` | Core + `entry_point` |
| `skill_unsaved` | Backend | User removes saved/bookmarked Skill | `skill_usage_events` + `user_saved_skills` | Core + `entry_point` |
| `skill_favorited` | Frontend/Backend | User favorites or unfavorites Skill | `skill_usage_events` + `skill_saves` | Core + `favorite_flag` (true/false) |
| `skill_enabled` | Backend | Download zip succeeds (download == enable, DR-55) | `skill_usage_events` + `user_enabled_skills` | Core + `skill_version_id`, `plan` |
| `skill_rated` | Frontend/Backend | User submits or updates rating | `skill_usage_events` + `skill_ratings` | Core + `stars` (1-5), `has_comment` |
| `skill_reported` | Frontend/Backend | User submits report | `skill_usage_events` | Core + `report_reason` |
| `skill_evaluation_completed` | Backend/Evaluation Pipeline | Evaluation run finishes | `skill_usage_events` + `skill_evaluations` | Core + `evaluation_status`, `score`, `triggered_by` |
| `skill_admin_action` | Backend/Admin | Admin writes Skill state/config | `skill_audit_log` and derived `skill_usage_events` if dashboarded | `event_id`, `timestamp`, `actor_id`, `actor_role`, `skill_id`, `action`, `request_id` |
| `skill_kids_approved` | Backend/Admin | Kids approval granted | `skill_audit_log` as source; derived analytics event optional | `event_id`, `timestamp`, `actor_id`, `actor_role`, `skill_id`, `approval_status`, `request_id` |

> **Canonical download event (DR-55):** `skill_enabled` is the canonical event for download-as-enablement; it records a successful package download that writes/updates `user_enabled_skills` and does not imply permanent runtime authorization. `skill_downloaded` is not a separate V1 P0 event. (`01_Functional_Requirements.md` §4.7 FR-D4 still names it `skill_downloaded`; that FRD line is reconciled to `skill_enabled` under the D-09 alignment follow-up.)
>
> **Event property notes (DR-55):** `plan` is the **runner's resolved plan** (the downloading user's own plan), not the Skill's `required_plan`. `required_plan` is available from the Skill dimension table (`skills.required_plan` / `skill_versions`) and is **not duplicated into the `skill_enabled` event** in DR-55 — joins recover it when needed.

**Tier 2 事件（用户账号设置授权后，本地工具回传）**

| Event | Producer | Trigger | Storage Target | Required Core Properties |
|---|---|---|---|---|
| `skill_installed` | Local tool (opt-in) | 用户解压 zip 到 .claude/skills/ | `skill_usage_events` (Tier 2) | Core + `skill_version_id`, `client_tool`, `client_version` |
| `skill_used_local` | Local tool (opt-in) | /skillname 被调用 | `skill_usage_events` (Tier 2) | Core + `skill_id`（无 raw input）|

### 3.2 P1 Events

| Event | Trigger | Notes |
|---|---|---|
| `skill_version_created` | New version created | Audit source, analytics derived if needed |
| `skill_review_action` | Ops assign/resolve/escalate | Review workflow P1 |
| `upgrade_clicked` | User clicks upgrade from Skill lock state | P1; therefore Upgrade Intent Rate is P1 |
| `contact_sales_clicked` | User clicks Enterprise CTA | P1 |
| `recommendation_clicked` | User clicks P1 recommendation rail | P1 |
| `skill_verified` | Admin grants Verified badge | P1; audit-sourced |

### 3.3 Future Events

These events must not be required for V1 P0 dashboards:

- `skill_share_clicked`
- `skill_share_completed`
- `skill_shared_page_viewed`
- `skill_referral_signup`
- `skill_referral_first_use`
- `skill_streaming_billing`
- `skill_streaming_partial`
- A/B experiment assignment events

---

## 4. Event Schema and Persistence Mapping

### 4.1 Common Properties

| Property | Type | Required | Persistence / Notes |
|---|---|---:|---|
| `event_id` | UUID | Yes | `skill_usage_events.event_id`; dedupe key |
| `timestamp` | timestamp | Yes | Maps to `skill_usage_events.occurred_at`; UTC required |
| `schema_version` | string | Yes | Stored in `metadata.schema_version` (no first-class column in V1; value `"1.0"`, DR-74) |
| `user_id` | UUID/null | Conditional | Null allowed for anonymous browse and Kids Session analytics; Kids must not store real child user identifiers here |
| `tenant_id` | UUID/null | Conditional | Required for logged-in execution |
| `session_id` | UUID/string | Yes | Server/session derived; Kids analytics uses `kids_session_pseudo_id` |
| `request_id` | string/null | Conditional | Required for backend/relay events |
| `skill_id` | UUID | Yes for Skill events | Nullable only for global admin/system events |
| `skill_version_id` | UUID/null | Conditional | Required for execution and billing-related events |
| `entry_point` | enum | Yes | Uses Data/API `entry_point` enum |
| `plan` | enum/null | Conditional | `free`, `pro`, `enterprise` |
| `subscription_status` | string/null | Conditional | `active`, `inactive`, `expired`, `none` |
| `persona` | string/null | Optional | Coarse V1 segmentation |
| `persona_source` | string/null | Optional | `profile`, `channel`, `inferred`, `unknown` |
| `is_kids_session` | boolean | Execution events | Server-derived only |
| `success` | boolean/null | Execution events | True only for successful execution |
| `failure_reason` | string/null | Failure events | Stable enum/string |
| `block_reason` | enum/null | Blocked events | Lowercase Data/API enum |
| `error_code` | string/null | Block/error events | Stable API code, e.g. `SKILL_PLAN_REQUIRED` |

### 4.2 Execution Properties

| Property | Type | Required |
|---|---|---:|
| `model` | string | Execution events |
| `input_tokens` | integer/null | Execution events if available |
| `output_tokens` | integer/null | Execution events if available |
| `total_tokens` | integer/null | Execution events if available |
| `latency_ms` | integer/null | Execution events |
| `timeout_occurred` | boolean | Execution events |
| `prompt_injection_detected` | boolean | Safety/execution events |
| `safety_violation_detected` | boolean | Safety/execution events |

### 4.3 Metadata Allowlist

`skill_usage_events.metadata` is allowlisted. V1 analytics may store only:

| Key | Type | Applies To | Notes |
|---|---|---|---|
| `source_entry_point` | entry_point enum | `skill_detail_view`, enable/disable flows | Previous UI source; must use Data/API enum |
| `repeat_index` | integer | `skill_repeat_use` | Positive integer, starting at 2 |
| `surface_id` | string | impressions/rails | Stable non-sensitive UI surface ID |
| `card_position` | integer | impressions/rails | Zero or one-based convention must be documented by Frontend |
| `query_hash` | string | search | Hash only; never raw query if it may contain personal data |
| `filter_hash` | string | filter state | Hash or normalized non-sensitive values |
| `schema_version` | string | all events | Event contract version |
| `producer` | string | all events | `frontend`, `backend`, `relay`, `admin`, `safety` |
| `client_event_time` | timestamp | frontend events | Optional; server `timestamp` remains source for dashboards |

Restricted keys such as `instruction_template`, `prompt`, `system_prompt`, `raw_messages`, `provider_payload`, `kids_raw_input`, `full_user_input`, `raw_output`, and `model_output` must be rejected or quarantined.

### 4.4 Privacy Rules

- Events must not include `instruction_template` or `prompt_guard_template`.
- Events must not include raw full user input.
- Events must not include provider raw payload.
- Kids session raw input/output must not be persisted.
- For Kids Session events, persist `user_id=NULL`, set `is_kids_session=true`, and set `session_id=kids_session_pseudo_id`, where `kids_session_pseudo_id = HMAC_SHA256(user_id + tenant_id + salt_version, daily_salt)` generated by Relay/backend before analytics enqueue.
- `salt_version` is derived from authenticated session creation time or gateway-maintained sticky salt for that session, not event trigger time. `daily_salt` must be secret-managed and rotated at least daily. Analytics users and dashboards must never receive the salt or a reversible identifier.
- Kids `kids_session_pseudo_id` supports same-day funnel, dedupe, and abuse-pattern analysis only. Cross-day identity stitching remains disabled unless Legal/Privacy approves a separate pseudonymous schema.
- Runtime services may use the real authenticated `user_id` in memory for entitlement, quota, user-level rate limiting, billing, and abuse controls; the analytics persistence contract still requires `skill_usage_events.user_id=NULL` for Kids Session events.
- User-level safety trace, if legally required, belongs in restricted audit/support systems, not business analytics dashboards.
- Support, Ops, Product, and Growth dashboards must use aggregate or permissioned diagnostic views only.

---

## 5. Entry Point Enum

Use the same enum as Data/API Spec.

| Entry Point | Meaning |
|---|---|
| `marketplace_card` | Card impression or action from Marketplace |
| `skill_detail` | Detail page CTA |
| `my_skills` | My Skills page |
| `saved_list` | Saved/Favorited Skills list |
| `skill_package` | Execution from a downloaded Skill package via the public routing API (R2 primary execution entry) |
| `api_token` | Download or execution authenticated directly by a DeepRouter API token |
| `playground_picker` | Legacy: in-platform Playground Skill Picker (historical events only) |
| `featured` | Featured rail |
| `popular` | Popular rail |
| `new` | New rail |
| `recommended` | Recommended Lite rail |
| `admin_preview` | Admin preview/test execution |
| `search_results` | Marketplace search results |

V1 execution events use `entry_point=skill_package` for browser/session package flows and `entry_point=api_token` when the DeepRouter API token itself is the auth+entitlement principal. `playground_picker` is retained only for historical events and is not produced by new V1 execution.

---

## 6. Metric Definitions

Each metric must be reproducible from source data.

| Metric | Priority | Formula | Window | Dedupe Unit | Source |
|---|---|---|---|---|---|
| WASU | P0 | Count distinct users with successful `skill_used` | Rolling 7 days | `user_id` | `skill_usage_events` |
| Skill MAU | P1 | Count distinct users with successful `skill_used` | Rolling 30 days | `user_id` | `skill_usage_events` |
| Total Skill Runs | P0 | Count successful `skill_used` | Selected range | event | `skill_usage_events` |
| Detail CTR | P0 | distinct users with `skill_detail_view` / distinct users with `skill_impression` | Selected range | user+skill | `skill_usage_events` |
| Enable Rate | P0 | distinct users with `skill_enabled` / distinct users with `skill_detail_view` | Selected range | user+skill | `skill_usage_events` |
| First Use Rate | P0 | distinct users with `skill_first_use` / distinct users with `skill_enabled` | Selected range | user+skill | `skill_usage_events` |
| Repeat Use Rate | P0 | distinct users with >=2 successful `skill_used` / distinct users with >=1 successful `skill_used` | Selected range | user+skill | `skill_usage_events` |
| One-time Rate | P1 | users with exactly 1 successful `skill_used` after enable / users with >=1 successful `skill_used` after enable | Selected range | user+skill | `skill_usage_events` |
| Block Rate | P0 | `skill_blocked` count / (`skill_blocked` + successful `skill_used`) count | Selected range | event | `skill_usage_events` |
| Upgrade Intent Rate | P1 | upgrade clicks from Skill lock state / `skill_blocked` with `plan_required` | Selected range | user+skill | `upgrade_clicked` + `skill_usage_events` |
| Skill Gross Revenue Attribution | P0 if charging enabled | Sum positive `billable_amount` where `charge_status='charged'` | Selected range | event | `skill_billing_events` |
| Skill Net Revenue Attribution | P0 if refunds/voids are displayed | Gross revenue plus negative append-only compensation rows where `charge_status IN ('refunded', 'voided')` | Selected range | event | `skill_billing_events` |
| ARPU per Active Skill User | P1 | Skill revenue attribution / distinct active Skill users | Selected range | user | billing + usage |

### 6.1 Exclusions

- Exclude `admin_preview` from user adoption and revenue metrics.
- Exclude failed, blocked, timeout-without-usable-output, `not_charged`, and `pending` records from revenue attribution. `refunded` and `voided` rows never count as positive revenue; if a dashboard displays net revenue or reconciliation, they must be included only as negative append-only compensation rows.
- Exclude failed, blocked, and timeout events from successful usage metrics.
- Anonymous impressions can count for top-of-funnel impressions but cannot be attributed to user-level conversion unless identity stitching is approved.
- Kids beta/internal traffic must be filterable and excluded from GA business metrics by default.

---

## 7. Funnel Definitions

### 7.1 Default Funnel

```text
skill_impression
→ skill_detail_view
→ skill_enabled
→ skill_first_use
→ skill_repeat_use
```

### 7.2 Funnel Rules

| Rule | Requirement |
|---|---|
| Unit | `user_id + skill_id` for logged-in users |
| Anonymous | Count only impression/detail unless identity stitching is approved |
| Identity stitching default | Disabled in V1 unless Product, Data, Security, and Legal approve |
| Event order | Events must occur in sequence |
| Conversion window | 7 days from first event in funnel |
| Repeat use | A successful `skill_used` after `skill_first_use` |
| Deprecated/archived | Excluded from discovery funnel after status change |
| Admin preview | Excluded |

---

## 8. Retention Definitions

### 8.1 Default Cohort

All cohort windows use UTC calendar days based on persisted `occurred_at`.

| Field | Definition |
|---|---|
| Cohort anchor | First successful `skill_first_use` |
| Retention event | Successful `skill_used` |
| Unit | `user_id + skill_id` |
| D1 | User returns and successfully uses same Skill on UTC calendar day 1 after anchor |
| D7 | Same Skill use on UTC day 7 |
| D30 | Same Skill use on UTC day 30 |

### 8.2 Views

- Per Skill retention.
- Per category retention.
- Per persona retention when persona is available.
- Per entry point retention.

---

## 9. Revenue and Billing Attribution

### 9.1 Source of Truth

| Use Case | Source |
|---|---|
| Skill revenue attribution dashboard | `skill_billing_events` |
| Actual invoice / charge reconciliation | Existing billing/finance system |
| Token usage and cost exploration | `skill_billing_events` + provider usage data |
| User behavior funnel | `skill_usage_events` |

### 9.2 Revenue Rules

- Blocked calls do not produce `skill_billing_events`.
- Failed calls do not charge by default.
- Partial streaming output defaults to `charge_status='not_charged'` for safety-aborted, provider-error-without-usable-output, preview, and client-disconnect-before-usable-output paths unless Product/Finance approves otherwise under D-04.
- Client disconnect after usable streamed output is a billable partial path under Finance-approved actual-token settlement.
- Streaming timeout after usable partial output is not a free failure path. If output was delivered or provider usage indicates consumed/output tokens before timeout, Finance attribution may record `partial_output=true`, `success=false`, actual token counts, and `charge_status='pending'` or `charged` according to approved settlement rules.
- `skill_billing_events` is an append-only attribution ledger. Refunds, voids, and adjustments must be modeled as new compensation rows, not UPDATEs to the original charged event.
- V1 gross revenue attribution counts only positive `billable_amount` where `charge_status='charged'`.
- `pending` and `not_charged` do not count as revenue.
- `refunded` and `voided` do not count as positive revenue. If a dashboard, export, or Finance reconciliation presents net revenue, it must include refund/void compensation rows as negative adjustments tied to the original charge through `related_billing_event_id`, `request_id`, or `idempotency_key`.
- `skill_billing_events` is attribution data; Finance reconciliation must use the actual charge/invoice system.
- Revenue dashboard must label values as attribution unless reconciled.

---

## 10. Dashboard Specifications

### 10.1 Common Dashboard Controls

| Control | Requirement |
|---|---|
| Date range | Default 7 days; options 24h, 7d, 30d, custom |
| Filters | Skill, category, plan, persona, entry point, status |
| Kids filter | Hidden when Kids flag off; visible for Safety/Super Admin and approved internal users when on |
| Segment | Free/Pro/Enterprise |
| Export | P1, aggregate only, permissioned |

### 10.2 Overview Dashboard

P0 cards:

- WASU
- Total Skill Runs
- Detail CTR
- Enable Rate
- First Use Rate
- Repeat Use Rate
- Block Rate
- Skill Revenue Attribution if charging enabled
- Top Block Reason

### 10.3 Per-Skill Table

Columns:

- Skill name
- Status
- Required plan
- Enabled users
- Active users
- Successful runs
- Detail CTR
- Enable rate
- First use rate
- Repeat use rate
- Block rate
- Revenue attribution if charging enabled
- Trend

### 10.4 Funnel Dashboard

Displays:

- Overall funnel.
- Per-skill funnel.
- Drop-off by plan and entry point.
- Block reason overlay after enable and execution steps.

### 10.5 Retention Dashboard

P1 unless Product marks retention as P0:

- D1/D7/D30 retention.
- Per-skill and category cohorts.
- Export aggregate cohort table if permissioned.

D1/D7/D30 are point-in-time cohort snapshots, not continuous retention coverage. Analysts must not interpret gaps between snapshot windows as unobserved churn without a separate continuous-return metric.

### 10.6 Revenue Dashboard

Displays:

- Revenue attribution by Skill.
- Revenue attribution by plan.
- Revenue attribution by entry point.
- Revenue attribution by Skill version.
- ARPU per active Skill user.
- Billing reconciliation status if available.

### 10.7 Safety / Kids Dashboard

Visible to Safety Reviewer and Super Admin when Kids feature flag is enabled:

- Kids blocked attempts.
- Safety violation events.
- Skills pending Kids approval.
- Kids-safe Skill usage.
- Top safety block reasons.

### 10.8 Dashboard Access Matrix

| Role | Overview | Per-Skill | Funnel | Revenue | Safety/Kids | Export |
|---|---:|---:|---:|---:|---:|---:|
| Operation | Aggregate | Aggregate | Aggregate | No by default | No | P1 aggregate only |
| Product/Growth | Aggregate | Aggregate | Aggregate | Attribution aggregate | No by default | P1 aggregate only |
| Safety Reviewer | Safety subset | Safety subset | Safety subset | No | Yes | No |
| Support | Limited diagnostic only | Limited assisted-user state | No | No | No raw Kids data | No |
| Super Admin | Yes | Yes | Yes | Yes | Yes | Yes with audit |
| Normal User | No internal dashboard | No | No | No | No | No |

---

## 11. Recommendation and Discovery Analytics

V1 P0 Marketplace can operate without recommendation rails. If rails are enabled:

| Rail | Metric |
|---|---|
| Featured | Impression, detail CTR, enable rate, first use rate |
| Popular | Impression, detail CTR, enable rate |
| New | Impression, detail CTR |
| Recommended | P1; requires persona/category source |

Rules:

- Deprecated and archived Skills are excluded.
- Free users should see at least one Free Skill when available.
- Recommendation interactions use existing Skill events with `entry_point=featured/popular/new/new_week/trending/recommended/reco_personal/reco_codownload/user_home`.
- Paywall interactions use existing Skill events with `entry_point=paywall`.

---

## 12. Operations Alerts

### 12.1 Alert Definitions

| Alert | Condition | Window | Severity | Owner | Channel |
|---|---|---:|---|---|---|
| High block rate | Block Rate > 30% and successful+blocked events >= 100 | 24h | Warning | Product + Ops | Slack #ops-alerts |
| Pro lock friction | `plan_required` blocks > 50 and upgrade intent < 5% | 24h | Warning | Growth | Slack #growth |
| Low first use | Enable to First Use Rate < 20% and enables >= 50 | 7d | Warning | Product | Slack #product |
| Low repeat | Repeat Use Rate < 15% and active users >= 100 | 7d | Warning | Product + Ops | Slack #product |
| Skill timeout spike | `skill_timeout_error` > 5% of executions | 1h | Critical | Engineering | Pager/Slack |
| Safety violation | `skill_safety_violation` >= 1 for Kids sessions | 1h | Critical | Safety + Engineering | Pager/Slack |
| Prompt injection spike | prompt injection detections > 50 | 1h | Critical | Security | Pager/Slack |
| Revenue drop | Revenue attribution down > 20% vs previous 7d | 7d | Info/Warning | Product + Finance | Slack #growth |

### 12.2 Suppression Rules

- Suppress high block rate alerts for Skills published less than 7 days unless Critical.
- Alert only once per Skill per window unless severity increases.
- Safety and prompt leakage alerts are never suppressed.
- Suppress business metric alerts when data freshness is outside target or required P0 event ingestion failure is active.
- Do not suppress pipeline health alerts when freshness or ingestion is broken.

### 12.3 Runbook Requirements

Each alert must link to:

- Dashboard deep link with filters.
- Owner.
- Recent deploy/feature flag state.
- Data freshness status.
- Recommended first diagnostic step.

---

## 13. Review Trigger Workflow

`skill_reviews` is an operations workflow table, not a generic analytics event sink. Reviews can be created by two V1 mechanisms.

### 13.1 Automated Triggers

| Trigger | Condition | Window | Action |
|---|---|---:|---|
| Safety threshold | `skill_safety_violation` count for one Skill > 5 | Rolling 1h | Create or reopen `skill_reviews` with `trigger_source='automated_safety_threshold'` |
| High block quality threshold | Block Rate > 30% and successful+blocked events >= 100 | 24h | P1; may create `automated_quality_threshold` review after Product approval |

Rules:

- Automated jobs must coalesce duplicate reviews while an `open`, `assigned`, or `escalated` review exists for the same Skill and trigger reason.
- Automated reviews must include `trigger_reason`, `trigger_window_start`, `trigger_window_end`, and `triggering_event_count`.
- Safety threshold reviews page Safety + Ops if Kids Session events are involved.

### 13.2 Manual Triggers

Ops may create a review from the Ops Dashboard using "Mark for Review" on a Skill row or drilldown. The write path must set `trigger_source='manual_ops'`, require `created_by`, and capture a structured reason such as `quality`, `safety`, `low_activation`, `high_block_rate`, or `support_escalation`.

---

## 14. Data Quality Rules

| Rule | Requirement |
|---|---|
| Event dedupe | `event_id` must be unique |
| Required fields | P0 events missing required fields are rejected or quarantined |
| Late events | Accept up to 24h late; mark late arrival. Applies only to trusted server-side producer timestamps (P1); V1 client surfaces use server-receipt time, so nothing is "late" (DR-74) |
| Clock source | Backend server time preferred. `occurred_at` is **server-authoritative UTC**: current public/client-facing producers use server receipt time, while trusted server-side producers may preserve an explicit event timestamp after UTC normalization. A client's self-reported time, if kept, lives only in optional `metadata.client_event_time` and is never the dashboard/cohort source (DR-74 D2/D4) |
| Timezone | Persist and query P0 analytics in UTC |
| Schema version | All events include `schema_version` (V1: `metadata.schema_version="1.0"`, stamped at persistence — DR-74) |
| Unknown entry point | Reject or map to `unknown` only in quarantine, not production dashboards |
| Null user | Allowed for anonymous impression/detail and Kids Session analytics only |
| No prompt leakage | Reject events containing restricted prompt-like keys |
| Kids privacy | Reject raw Kids input/output fields |
| Billing mismatch | Billing attribution must reconcile with request id and idempotency key |

### 14.1 Data Freshness

| Data | Freshness Target |
|---|---|
| P0 dashboard events | < 15 minutes |
| Billing attribution | < 1 hour |
| Revenue reconciliation | Daily |
| Retention cohorts | Daily |
| Alerts | < 5 minutes for critical, < 30 minutes for warning |

### 14.2 Freshness Failure Behavior

- If P0 dashboard event freshness exceeds target, dashboard must show a tracking/data-delay state.
- Business alerts must be suppressed while freshness is outside target, except Safety, Security, and pipeline health alerts.
- Data pipeline failures must page the Data/Engineering owner according to severity.

---

## 15. Privacy, Access Control, and Export

Export policy:

- P0: export disabled for Operation by default.
- P1: aggregate-only CSV export can be enabled by permission.
- No export may include prompt, raw full input, Kids sensitive content, provider raw payload, user-level sensitive details, or unreconciled finance data unless explicitly approved.
- Super Admin exports must create audit logs.

---

## 16. Sample Payloads

### 16.1 `skill_impression`

```json
{
  "event_id": "11111111-1111-4111-8111-111111111111",
  "event_type": "skill_impression",
  "timestamp": "2026-06-15T02:15:00Z",
  "schema_version": "1.0",
  "user_id": null,
  "tenant_id": null,
  "session_id": "sess_abc123",
  "request_id": null,
  "skill_id": "22222222-2222-4222-8222-222222222222",
  "skill_version_id": null,
  "entry_point": "marketplace_card",
  "plan": null,
  "subscription_status": "none",
  "persona": null,
  "persona_source": "unknown",
  "success": null,
  "metadata": {
    "schema_version": "1.0",
    "producer": "frontend",
    "surface_id": "marketplace_grid",
    "card_position": 3
  }
}
```

Persistence: `timestamp` maps to `skill_usage_events.occurred_at` (server-authoritative UTC). The top-level `schema_version` shown here is a wire-envelope field; persisted rows have no such column — only `metadata.schema_version` is stored (DR-74).

### 16.2 `skill_used`

```json
{
  "event_id": "33333333-3333-4333-8333-333333333333",
  "event_type": "skill_used",
  "timestamp": "2026-06-15T02:20:00Z",
  "schema_version": "1.0",
  "user_id": "44444444-4444-4444-8444-444444444444",
  "tenant_id": "55555555-5555-4555-8555-555555555555",
  "session_id": "sess_def456",
  "request_id": "req_789",
  "skill_id": "22222222-2222-4222-8222-222222222222",
  "skill_version_id": "66666666-6666-4666-8666-666666666666",
  "entry_point": "skill_package",
  "plan": "pro",
  "subscription_status": "active",
  "persona": "developer",
  "persona_source": "profile",
  "is_kids_session": false,
  "success": true,
  "model": "approved-model-id",
  "input_tokens": 820,
  "output_tokens": 240,
  "total_tokens": 1060,
  "latency_ms": 2350,
  "timeout_occurred": false,
  "prompt_injection_detected": false,
  "safety_violation_detected": false,
  "metadata": {
    "schema_version": "1.0",
    "producer": "relay"
  }
}
```

### 16.3 `skill_blocked`

```json
{
  "event_id": "77777777-7777-4777-8777-777777777777",
  "event_type": "skill_blocked",
  "timestamp": "2026-06-15T02:25:00Z",
  "schema_version": "1.0",
  "user_id": "88888888-8888-4888-8888-888888888888",
  "tenant_id": "55555555-5555-4555-8555-555555555555",
  "session_id": "sess_ghi789",
  "request_id": "req_blocked_123",
  "skill_id": "22222222-2222-4222-8222-222222222222",
  "skill_version_id": null,
  "entry_point": "skill_package",
  "plan": "free",
  "subscription_status": "active",
  "is_kids_session": false,
  "success": false,
  "block_reason": "plan_required",
  "error_code": "SKILL_PLAN_REQUIRED",
  "metadata": {
    "schema_version": "1.0",
    "producer": "relay",
    "source_entry_point": "skill_detail"
  }
}
```

---

## 17. QA and Acceptance Criteria

### 17.1 Event QA

1. Each P0 event has a producer, trigger, storage target, required properties, and sample payload where required.
2. `entry_point` values match Data/API Spec.
3. Event `timestamp` maps to DB `occurred_at` and is queried in UTC.
4. Anonymous impression/detail events allow null `user_id`; normal execution events require `user_id`; Kids Session execution events persist `user_id=NULL`, `is_kids_session=true`, and `session_id=kids_session_pseudo_id` unless Legal/Privacy approves a different pseudonymous schema.
5. Execution events require `skill_id`, `skill_version_id`, `request_id`, and `entry_point`.
6. Blocked events include lowercase `block_reason` and stable uppercase `error_code`.
7. `source_entry_point` and `repeat_index` are stored only in allowlisted `metadata`.
8. Events containing `instruction_template`, prompt-like restricted keys, provider raw payload, or Kids raw content are rejected or quarantined.
9. `skill_kids_approved` is traceable to `skill_audit_log` and does not store raw review notes or Kids content.

### 17.2 Metric QA

1. WASU query returns distinct users with successful `skill_used` in rolling 7 days.
2. Funnel query enforces event order within 7-day window.
3. Retention query uses `skill_first_use` as cohort anchor and UTC calendar days, and labels D1/D7/D30 as snapshot retention.
4. Revenue attribution reads from `skill_billing_events`, not `skill_usage_events`.
5. Gross revenue attribution counts only positive `charge_status='charged'` by default.
6. Net revenue or reconciliation views include append-only `refunded`/`voided` compensation rows as negative adjustments and never mutate original charged rows.
7. Admin preview is excluded from business metrics.
8. Upgrade Intent Rate is P1 because `upgrade_clicked` is P1.

### 17.3 Dashboard QA

1. Dashboard supports date range and core filters.
2. Empty states distinguish no data, no permission, and tracking failure.
3. Block reason breakdown matches Data/API enum and API error-code mapping.
4. Ops users cannot see prompt, raw user input, provider raw payload, or Kids sensitive content.
5. Critical alerts trigger within freshness target.
6. Business alerts suppress during data freshness failure while pipeline health alerts remain active.
