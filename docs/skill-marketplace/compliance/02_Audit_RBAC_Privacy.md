# Skill Marketplace Audit, RBAC and Privacy Compliance

## 1. Purpose

Define audit, access control, privacy, data retention, and export requirements for Skill Marketplace V1. This file aligns with the functional, data/API, analytics, security, and CTO review PRDs.

## 2. Audit System of Record

`skill_audit_log` is the system-of-record for sensitive admin and compliance actions. Audit records must be immutable to application users and queryable only by authorized roles.

Required fields:

- `audit_id`
- `actor_id`
- `actor_role`
- `tenant_id` when applicable
- `skill_id` / `skill_version_id` when applicable
- `action`
- `changed_fields`
- `before_value_hash` / `after_value_hash` or safe metadata
- `reason`
- `request_id`
- `ip_address`
- `user_agent`
- `created_at` in UTC

Audit diff must not store `instruction_template`, raw prompt, full user input, raw Kids input/output, provider raw payload, or full model output.

## 3. Audited Actions

| Category | Actions |
|---|---|
| Skill lifecycle | create draft, update metadata, publish, archive, deprecate, restore if supported |
| Versioning | create version, activate version, `version_activated_deprecated_patch` (security patch activation on deprecated Skill), edit template, view template, preview template |
| Commercial settings | change plan, quota, markup, monetization type, billing policy |
| Safety settings | change model whitelist, timeout, output schema, Kids flags, safety flags |
| Promotion | change featured flag/rank, recommendation eligibility |
| Kids approval | `kids_approval_granted`, `kids_approval_rejected`, `kids_approval_revoked`, `kids_approval_overridden` |
| Access and data | export operation, audit-log view, Super Admin support action |
| Emergency | kill switch activation/deactivation, provider disablement, incident override |

## 4. RBAC Role Model

| Role | Scope |
|---|---|
| Anonymous | Browse public published Marketplace metadata only. |
| Normal User | Browse, enable/disable own Skills, execute enabled Skills in Playground. |
| Operation | Manage `skill_reviews`, review aggregate operations views, cannot edit Skill content or templates. |
| Safety Reviewer | Review Kids/safety readiness, approve/reject Kids approval, cannot publish unless also Super Admin. |
| Product/Growth | View aggregate metrics and manage recommendation strategy where delegated; cannot view templates. |
| Support | View limited diagnostics and assisted user status; cannot view prompt, full input, Kids sensitive data, or provider raw logs. |
| Super Admin | Full Skill CRUD, versioning, publication, sensitive settings, audit, and emergency controls. |

## 5. API Access Boundary

| Route Group | Access Rule |
|---|---|
| `/api/v1/marketplace/*` | Anonymous read for published public metadata; authenticated user for personalized state. |
| `/api/v1/user/*` | Authenticated user's own state only. |
| `/api/v1/relay/*` | Authenticated execution only; server resolves session, entitlement, Kids state, and policy. |
| `/api/v1/admin/*` | Super Admin by default unless explicitly documented as read-only. |
| `/api/v1/ops/*` | Operation/Product aggregate views only; no templates, raw prompt, raw user input, or user-level exports by default. |
| Support diagnostics | Support-only limited view; audited; no restricted content. |

## 6. Permission Matrix

| Capability | Anonymous | Normal User | Operation | Safety Reviewer | Product/Growth | Support | Super Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Browse published Skills | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Enable / disable Skill | No | Own only | No | No | No | Assisted status only | Yes if audited |
| Execute Skill | No | Own enabled Skills | No | Safety preview only | No | No | Preview/test |
| View aggregate analytics | No | No | Yes | Safety subset | Yes | Limited diagnostic aggregate | Yes |
| View user-level analytics | No | Own only if exposed | No by default | No | No | Limited support view | Yes with audit |
| Export CSV/data | No | No | P1 aggregate only | No | P1 aggregate only | No | Yes with audit |
| Create/edit Skill metadata | No | No | No | No | No | No | Yes |
| View `instruction_template` | No | No | No | No | No | No | Yes only, audited |
| Edit `instruction_template` | No | No | No | No | No | No | Yes only, audited |
| Publish/archive/deprecate | No | No | No | No | No | No | Yes |
| Approve Kids safety | No | No | No | Yes | No | No | Yes if assigned |
| View audit log | No | No | No | Limited own review actions | No | No | Yes |

## 7. Privacy and Restricted Data

Restricted data must not appear in analytics, logs, billing, support diagnostics, exports, error responses, or audit diffs:

- `instruction_template`
- raw prompt
- system prompt
- raw messages
- full user input
- raw output / full model output
- provider raw payload
- raw Kids input/output
- child-sensitive personal data
- payment instrument data

Allowed analytics `metadata` keys are limited to:

- `source_entry_point`
- `repeat_index`
- `surface_id`
- `card_position`
- `query_hash`
- `filter_hash`
- `schema_version`
- `producer`
- `client_event_time`

Restricted keys such as `instruction_template`, `prompt`, `system_prompt`, `raw_messages`, `provider_payload`, `kids_raw_input`, `full_user_input`, `raw_output`, and `model_output` must be rejected or quarantined.

## 8. Analytics and Billing Privacy

- Event payload field `timestamp` maps to persisted `occurred_at` in UTC.
- `skill_usage_events` may contain aggregate counts and technical metadata only.
- Kids Session analytics must not store a real child user identifier in `user_id`; persist `user_id=NULL`, `is_kids_session=true`, and `session_id=kids_session_pseudo_id`, where `kids_session_pseudo_id = HMAC_SHA256(user_id + tenant_id + salt_version, daily_salt)`.
- Runtime Relay context and restricted billing systems may use the real authenticated `user_id` for entitlement, quota, rate limit, billing, abuse control, and audit routing. That identity must not be copied into business analytics tables for Kids Session events.
- `salt_version` must be derived from authenticated session creation time or a gateway-maintained sticky salt version for that session, not from event trigger time. This prevents an active Kids funnel from splitting at midnight during salt rotation.
- `daily_salt` must be secret-managed, rotated daily, and unavailable to analytics/dashboard users.
- Severe Kids abuse enforcement uses restricted Auth/Risk systems and audited security workflows. Ops/Product dashboards must not reveal or reconstruct the real child/user identity from analytics.
- Billing events store Skill/version/user/tenant/plan/charge metadata, not prompt content.
- Billing events are an append-only financial attribution ledger. Refunds, voids, and adjustments must be represented by new compensation rows linked by `related_billing_event_id`, `request_id`, or `idempotency_key`; application flows must not UPDATE an original charged event to change its financial meaning.
- Billing and anonymous business logs must be correlated for refund/support only through non-semantic execution keys: `request_id` first, or `idempotency_key` where the billing path requires it. Support and Finance tooling must not join Kids analytics to billing by real `user_id`.
- `request_id` and `idempotency_key` may be visible in restricted support/finance diagnostics, but they must not encode user, tenant, child, prompt, or Skill instruction semantics.
- Gross revenue dashboards count positive `charge_status='charged'` rows unless Finance updates the approved status list. Net revenue or reconciliation views must include append-only `refunded`/`voided` compensation rows only as negative adjustments.
- Identity stitching is disabled by default unless Privacy and Product explicitly approve it.
- Dashboard data freshness must be shown; stale revenue or safety data must be suppressed or labeled.

## 9. Export Policy

CSV/export is not a P0 launch requirement.

| Export Type | V1 Rule |
|---|---|
| Operation/Product export | P1, aggregate-only, no user-level rows, no restricted fields. |
| Support export | Not allowed in V1. |
| Super Admin export | Allowed only with reason, audit log, access control, retention, and restricted-field redaction. |
| Kids-related export | Requires Privacy/Safety approval; no raw Kids input/output or child-sensitive data. |

## 10. Retention

| Data | Minimum Requirement |
|---|---|
| `skill_audit_log` | Minimum 2 years unless legal policy requires longer. |
| `skill_usage_events` | Product analytics retention per data policy; no raw restricted data. |
| Kids event metadata | No raw sensitive data; anonymize/pseudonymize according to legal policy. |
| Billing events | Finance retention policy. |
| Support diagnostics | Short retention; no restricted data; access audited. |
| Quarantined events | Restricted access; purge or repair under Security/Data approval. |

## 11. Compliance Tests

Required before launch:

1. No public/user/ops/support API returns `instruction_template`.
2. Logs, analytics, billing, audit, exports, and errors contain no restricted data.
3. `/admin/*` sensitive operations require Super Admin.
4. `/ops/*` returns aggregate views only.
5. Support diagnostics cannot expose prompt, Kids raw data, provider raw logs, or full model output.
6. Unauthorized admin access is denied and security-relevant attempts are monitored.
7. Metadata allowlist rejects or quarantines restricted keys.
8. Audit records are created for all sensitive admin, Kids, export, and emergency actions.
