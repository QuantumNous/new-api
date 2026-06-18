# Skill Marketplace Data Model and API Specification

本文档定义 DeepRouter Skill Marketplace V1 的企业级数据模型和 API 合约。目标是让 Backend、Frontend、Data、Security、QA 和独立 Agent 可以基于同一套 schema、约束、权限、错误码和响应格式实现。

本文件以 `tasks/01_Functional_Requirements.md` 和 `tasks/02_UX_Design.md` 为上游基准。若冲突，以 Functional Requirements 的产品边界和权限规则为准。

---

## 1. Design Principles

| Principle | Requirement |
|---|---|
| Server-side DRM | `instruction_template` 只存储在服务端，只允许 Super Admin 和 Relay 执行链路访问 |
| Use-time Entitlement | `user_enabled_skills` 只代表用户启用关系，不代表永久执行授权 |
| Immutable Execution | 每次执行必须绑定进入请求时选定的 `skill_version_id` 和执行快照 |
| Analytics by Default | 所有关键行为必须有事件记录，且带 `entry_point` |
| Privacy by Design | 不在 analytics、audit、logs 中存储 prompt 原文、Kids 敏感输入或 provider raw payload |
| Explicit RBAC | `/admin/*` 用于 Super Admin 敏感写操作；`/ops/*` 用于聚合运营视图 |
| Migration Ready | 表结构必须包含类型、默认值、约束、索引和回滚策略 |

---

## 2. ERD

```text
skills
  1 ── * skill_versions
  1 ── * skills_i18n
  1 ── * user_enabled_skills
  1 ── * skill_usage_events
  1 ── * skill_billing_events
  1 ── * skill_reviews
  1 ── * skill_audit_log

users / tenants / sessions / subscriptions
  referenced by user_enabled_skills, usage events, billing events, reviews, audit logs
```

V1 assumes existing platform tables exist for users, tenants, sessions, subscriptions, billing, and feature flags. Foreign keys can be enforced only where the existing database ownership model allows them; otherwise store ids with application-level validation.

---

## 3. Enum Definitions

| Enum | Values |
|---|---|
| `skill_status` | `draft`, `published`, `deprecated`, `archived` |
| `required_plan` | `free`, `pro`, `enterprise` |
| `monetization_type` | `free`, `plan_included`, `token_markup` |
| `skill_version_status` | `draft`, `active`, `inactive`, `archived` |
| `review_status` | `open`, `assigned`, `escalated`, `resolved`, `reopened` |
| `kids_approval_status` | `not_required`, `pending`, `approved`, `emergency_approved`, `rejected`, `revoked` |
| `block_reason` | `auth_required`, `skill_not_found`, `skill_not_published`, `skill_not_enabled`, `plan_required`, `subscription_inactive`, `quota_exceeded`, `kids_mode_blocked`, `context_too_long`, `rate_limited`, `timeout`, `safety_violation`, `internal_error` |
| `execution_entry_point` | `native_deeprouter`, `external_ai_client`, `api_direct`, `admin_preview` |
| `discovery_source` | `marketplace_card`, `skill_detail`, `my_skills`, `featured`, `popular`, `new`, `recommended` |

---

## 4. Table Definitions

DDL below is PostgreSQL-oriented. Adjust syntax only if the production database differs.

### 4.1 `skills`

Stores public metadata, entitlement configuration, visibility, safety flags, and operational settings. Does not store `instruction_template`.

```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(128) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL CHECK (status IN ('draft', 'published', 'deprecated', 'archived')),

  category VARCHAR(64) NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  icon_url TEXT NULL,

  default_locale VARCHAR(16) NOT NULL DEFAULT 'en',
  name VARCHAR(160) NOT NULL,
  short_description VARCHAR(280) NOT NULL,
  description TEXT NOT NULL,
  input_hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  example_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  example_outputs JSONB NOT NULL DEFAULT '[]'::jsonb,

  required_plan VARCHAR(32) NOT NULL CHECK (required_plan IN ('free', 'pro', 'enterprise')),
  monetization_type VARCHAR(32) NOT NULL CHECK (monetization_type IN ('free', 'plan_included', 'token_markup')),
  price_markup NUMERIC(10, 4) NOT NULL DEFAULT 0,
  free_quota_per_month INTEGER NULL CHECK (free_quota_per_month IS NULL OR free_quota_per_month >= 0),
  max_input_tokens INTEGER NULL CHECK (max_input_tokens IS NULL OR max_input_tokens > 0),

  model_whitelist JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- IMPORTANT: model_whitelist must contain platform-defined model aliases or routing group names (e.g., "smart-tier", "fast-tier", "kids-safe-tier").
  -- Hardcoded provider-specific versioned identifiers (e.g., "gpt-4-0613", "claude-3-opus-20240229") are PROHIBITED.
  -- The Smart Router maps aliases to current provider/model at routing time; when a provider deprecates a model version, only the global alias mapping needs updating without touching individual Skill records.
  timeout_seconds INTEGER NOT NULL DEFAULT 45 CHECK (timeout_seconds BETWEEN 1 AND 120),
  timeout_risk BOOLEAN NOT NULL DEFAULT false,

  is_kids_safe BOOLEAN NOT NULL DEFAULT false,
  is_kids_exclusive BOOLEAN NOT NULL DEFAULT false,
  kids_approval_status VARCHAR(32) NOT NULL DEFAULT 'not_required'
    CHECK (kids_approval_status IN ('not_required', 'pending', 'approved', 'emergency_approved', 'rejected', 'revoked')),
  kids_approval_actor_id UUID NULL,
  kids_approval_at TIMESTAMPTZ NULL,
  kids_emergency_approval_expires_at TIMESTAMPTZ NULL,

  ai_disclosure_required BOOLEAN NOT NULL DEFAULT true,

  featured_flag BOOLEAN NOT NULL DEFAULT false,
  featured_rank INTEGER NULL CHECK (featured_rank IS NULL OR featured_rank >= 0),

  -- Tool spec distribution fields (V1: external AI client invocation)
  tool_function_name VARCHAR(64) NULL,
  -- Function name used in OpenAPI/MCP spec (e.g. "contract_review_analyze").
  -- Must be a valid JSON identifier: [a-zA-Z_][a-zA-Z0-9_]*; max 64 chars.
  -- Required before publish if Skill supports external AI client invocation.
  tool_input_schema JSONB NULL,
  -- JSON Schema object for the tool's input parameters.
  -- Must not contain any reference to instruction_template or execution details.
  tool_output_schema JSONB NULL,
  -- JSON Schema object for the tool's output / tool_result format.
  tool_spec_openapi_version VARCHAR(16) NOT NULL DEFAULT '3.1.0',
  tool_spec_mcp_version VARCHAR(16) NOT NULL DEFAULT '2024-11-05',
  tool_spec_invalidated_at TIMESTAMPTZ NULL,
  -- Set when tool_function_name, tool_input_schema, or tool_output_schema changes to trigger spec regeneration.

  active_version_id UUID NULL,
  created_by UUID NOT NULL,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NULL,
  deprecated_at TIMESTAMPTZ NULL,
  archived_at TIMESTAMPTZ NULL,

  CONSTRAINT kids_exclusive_requires_safe CHECK (
    is_kids_exclusive = false OR is_kids_safe = true
  )
);
```

Notes:
- `featured` is not a status. Use `featured_flag` and `featured_rank`.
- `active_version_id` is nullable during draft creation and set on publish.
- **`model_whitelist` must use platform-defined model aliases or routing group names (e.g., `"smart-tier"`, `"fast-tier"`, `"kids-safe-tier"`). Hardcoded provider-specific versioned model identifiers (e.g., `"gpt-4-0613"`, `"claude-3-opus-20240229"`) are prohibited.** The Smart Router maintains the single global mapping from alias to current provider/version. When a provider deprecates a model, only the global alias mapping needs updating — no individual Skill records or versions require changes. Admin API must reject `model_whitelist` values that do not match the platform's registered alias registry.
- `max_input_tokens` is a Skill-level cost guardrail. It is mandatory for Free Skills or any Skill executable through free quota; Product/Security default for V1 should be conservative, e.g. 2000 input tokens, unless Finance explicitly approves a higher cap.
- For Kids GA, `is_kids_safe=true` requires `kids_approval_status='approved'` before normal publish/execution. `emergency_approved` is allowed only for time-bounded Super Admin incident override and must be backed by `skill_audit_log`.
- `kids_emergency_approval_expires_at` is required when setting `kids_approval_status='emergency_approved'`; the field must be non-null and must be a future timestamp no more than the platform-defined emergency window (default: 72 hours). At execution time, if `kids_approval_status='emergency_approved'` and `kids_emergency_approval_expires_at < now()`, Relay must treat the Skill as having `kids_approval_status='rejected'` and fail closed for Kids sessions. A background job must scan for expired emergency approvals daily and emit `kids_emergency_approval_expired` alerts.
- `kids_approval_actor_id` and `kids_approval_at` are denormalized latest-state convenience fields only. `skill_audit_log` is the system-of-record for approval, rejection, revocation, and override history.
- `ai_disclosure_required` defaults to `true` for all V1 Skills; V1 platform policy mandates AI-generated content disclosure on all Skill executions. This field is exposed in the public Skill Detail API response for frontend rendering. It may only be set to `false` by Super Admin for platform-approved exceptions with a documented legal basis.

### 4.2 `skill_versions`

Stores immutable execution configuration. Contains sensitive prompt material.

```sql
CREATE TABLE skill_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id),
  version_number INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive', 'archived')),

  instruction_template TEXT NOT NULL,
  instruction_template_sha256 CHAR(64) NOT NULL,
  prompt_guard_template TEXT NULL,
  output_schema JSONB NULL,
  model_whitelist_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_plan_snapshot VARCHAR(32) NOT NULL,
  monetization_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  max_input_tokens_snapshot INTEGER NULL CHECK (max_input_tokens_snapshot IS NULL OR max_input_tokens_snapshot > 0),

  rollout_percentage INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
  experiment_name VARCHAR(128) NULL,

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ NULL,
  archived_at TIMESTAMPTZ NULL,

  UNIQUE (skill_id, version_number)
);
```

Security requirements:
- Application queries that power public/user/ops APIs must never select `instruction_template`.
- Admin detail may retrieve `instruction_template` only for Super Admin and must audit access.
- Logs, analytics, audit diff, billing, and error responses must use `instruction_template_sha256`, not prompt text.
- If database encryption tooling is available, `instruction_template` must be encrypted at rest or protected by equivalent managed storage encryption.

Rules:
- V1 allows only one `active` version per Skill through `idx_skill_versions_one_active`.
- For V1, an `active` version must have `rollout_percentage=100`; `rollout_percentage` is reserved for future controlled rollout.
- If V2 enables multiple active versions, activation must validate that active `rollout_percentage` values for the same `skill_id` sum to exactly 100 before removing or changing the one-active index.
- Relay must never route execution to an `inactive` or `archived` version.
- Relay must use the immutable version snapshot selected at request entry for execution-critical and cost-critical fields, including `model_whitelist_snapshot`, `required_plan_snapshot`, `monetization_snapshot`, and `max_input_tokens_snapshot`.
- `max_input_tokens_snapshot` must be populated from `skills.max_input_tokens` when the Skill is Free or free-quota eligible. If absent on a Free/free-quota execution path, publish/activation must fail and Relay must block with `SKILL_CONTEXT_TOO_LONG` or a configuration error before provider call.
- Deprecated Skills may receive safety or quality patch versions. When a patch version is created for a deprecated Skill, Super Admin activation must update `skills.active_version_id` to the new version and make it the sole active version for all existing enabled, still-entitled users.
- Deprecated patch activation must not change `skills.status` back to `published` and must not allow new enablement.

### 4.3 `user_enabled_skills`

V1 stores current enablement state plus timestamps. Re-enable updates the same row.

```sql
CREATE TABLE user_enabled_skills (
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  skill_id UUID NOT NULL REFERENCES skills(id),

  enabled BOOLEAN NOT NULL DEFAULT true,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'marketplace',
  last_used_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, tenant_id, skill_id)
);
```

Rules:
- Enable sets `enabled=true`, updates `enabled_at`, clears `disabled_at`.
- Enable/re-enable must be atomic. Use `INSERT ... ON CONFLICT (user_id, tenant_id, skill_id) DO UPDATE` or equivalent transactional retry; do not implement read-then-insert logic that can race under concurrent Enable clicks.
- Deprecated Skills cannot be enabled or re-enabled when `enabled=false` or `disabled_at IS NOT NULL`; only rows already active at use time may continue execution until archive or entitlement failure.
- Disable sets `enabled=false`, sets `disabled_at`.
- Usage history is stored in events, not in this table.

### 4.4 `skill_usage_events`

Analytics and execution telemetry. Not an accounting ledger.

```sql
CREATE TABLE skill_usage_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(64) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  user_id UUID NULL,
  tenant_id UUID NULL,
  session_id VARCHAR(128) NULL,
  request_id VARCHAR(128) NULL,

  skill_id UUID NULL,
  skill_version_id UUID NULL,
  -- For execution events (skill_used, skill_blocked, skill_first_use, etc.): one of native_deeprouter / external_ai_client / api_direct / admin_preview
  -- For discovery/impression events (skill_impression, skill_detail_view): use NULL here; store discovery_source in metadata JSONB
  execution_entry_point VARCHAR(64) NULL
    CHECK (execution_entry_point IS NULL OR execution_entry_point IN ('native_deeprouter', 'external_ai_client', 'api_direct', 'admin_preview')),

  plan VARCHAR(32) NULL,
  subscription_status VARCHAR(32) NULL,
  persona VARCHAR(64) NULL,
  persona_source VARCHAR(64) NULL,

  model VARCHAR(128) NULL,
  is_kids_session BOOLEAN NOT NULL DEFAULT false,
  is_kids_safe_skill BOOLEAN NULL,
  is_kids_exclusive_skill BOOLEAN NULL,

  input_tokens INTEGER NULL CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER NULL CHECK (output_tokens IS NULL OR output_tokens >= 0),
  total_tokens INTEGER NULL CHECK (total_tokens IS NULL OR total_tokens >= 0),
  latency_ms INTEGER NULL CHECK (latency_ms IS NULL OR latency_ms >= 0),

  success BOOLEAN NULL,
  failure_reason VARCHAR(128) NULL,
  block_reason VARCHAR(64) NULL,
  error_code VARCHAR(64) NULL,

  timeout_occurred BOOLEAN NOT NULL DEFAULT false,
  prompt_injection_detected BOOLEAN NOT NULL DEFAULT false,
  safety_violation_detected BOOLEAN NOT NULL DEFAULT false,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CHECK (NOT (metadata ? 'instruction_template'))
);
```

Rules:
- This table may contain aggregate counts and technical metadata, not raw prompt, full user input, provider raw payload, or Kids sensitive content.
- Billing values are intentionally excluded from this table except token counts. Use `skill_billing_events`.
- Event payload property `timestamp` maps to `occurred_at` at persistence time. Dashboard queries and retention cohorts must use `occurred_at` in UTC.
- Runtime identity and persisted analytics identity are separate. Relay execution context must hold the real authenticated `user_id` and `tenant_id` in memory for entitlement, quota, rate limit, billing attribution, audit routing, and abuse controls.
- Kids Session analytics must not store a real child user identifier in `skill_usage_events.user_id`. For Kids events, persist `user_id=NULL`, set `is_kids_session=true`, and set `session_id=kids_session_pseudo_id`, where `kids_session_pseudo_id = HMAC_SHA256(user_id + tenant_id + salt_version, daily_salt)`.
- `daily_salt` must be secret-managed, rotated at least daily, and unavailable to analytics/dashboard users. To avoid midnight funnel breaks, pseudo id generation must use the authenticated session creation time or a gateway-maintained sticky salt version for the session, not the event trigger time. The pseudonymous `session_id` is for same-session/same-salt funnel and abuse-pattern analysis only; cross-session identity stitching is disabled unless Legal/Privacy explicitly approves a different schema.
- Any required user-level safety/audit trace must live in restricted audit/support systems, not business analytics.
- `metadata` is allowlisted, not free-form. V1 allowed analytics metadata keys are `discovery_source`, `repeat_index`, `surface_id`, `card_position`, `query_hash`, `filter_hash`, `schema_version`, `producer`, and `client_event_time`.
- `metadata.discovery_source` must use the `discovery_source` enum values (`marketplace_card`, `skill_detail`, `my_skills`, `featured`, `popular`, `new`, `recommended`) when present. It records where in the UI the user came from before the event, not the execution path.
- `execution_entry_point` must not be null for any execution event (`skill_used`, `skill_first_use`, `skill_repeat_use`, `skill_blocked`). It may be null for discovery/impression events.
- `metadata.repeat_index` must be a positive integer when present and is required for `skill_repeat_use` until promoted to a first-class column.
- Restricted keys such as `instruction_template`, `prompt`, `system_prompt`, `raw_messages`, `provider_payload`, `kids_raw_input`, `full_user_input`, `raw_output`, and `model_output` must be rejected or quarantined.

### 4.5 `skill_billing_events`

Billing attribution event. It may feed the existing billing/charge system but is not itself an invoice.

```sql
CREATE TABLE skill_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL UNIQUE,
  related_billing_event_id UUID NULL REFERENCES skill_billing_events(id),

  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  skill_id UUID NOT NULL REFERENCES skills(id),
  skill_version_id UUID NOT NULL REFERENCES skill_versions(id),

  monetization_type VARCHAR(32) NOT NULL,
  required_plan VARCHAR(32) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  base_cost NUMERIC(14, 6) NOT NULL DEFAULT 0,
  skill_markup NUMERIC(14, 6) NOT NULL DEFAULT 0,
  billable_amount NUMERIC(14, 6) NOT NULL DEFAULT 0,

  charge_status VARCHAR(32) NOT NULL DEFAULT 'not_charged'
    CHECK (charge_status IN ('not_charged', 'pending', 'charged', 'refunded', 'voided')),
  partial_output BOOLEAN NOT NULL DEFAULT false,
  success BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Rules:
- Blocked calls do not create `skill_billing_events`.
- Failed calls do not charge by default.
- `skill_billing_events` is append-only. Do not mutate prior billing rows to change financial meaning after insert, especially charged rows.
- Refund, void, adjustment, or charge reversal must create a new compensating row with a new `idempotency_key`, `related_billing_event_id` pointing to the original event where available, related `request_id`, negative `billable_amount` where applicable, and `charge_status='refunded'` or `voided`. The original `charged` event remains immutable for audit and reconciliation.
- Partial streaming output defaults to `charge_status='not_charged'` only for safety-aborted, provider-error-without-usable-output, preview, or client-disconnect-before-usable-output paths unless Finance explicitly approves otherwise.
- Streaming timeout after partial output is a separate cost-control case: if Relay has delivered usable streamed output or provider usage indicates consumed/output tokens before timeout, create a `skill_billing_events` row with `partial_output=true`, `success=false`, actual token counts where available, and `charge_status='pending'` or `charged` according to the approved Finance settlement flow.
- Timeout billing must be idempotent by `idempotency_key`; retries or delayed provider usage callbacks must update/reconcile the same billing event rather than creating a second event.
- Client disconnect after usable streamed output is treated as a billable partial, not as provider failure. If Relay has delivered usable streamed tokens before disconnect, record actual token counts with `partial_output=true` and settle according to Finance-approved partial billing policy.
- Partial billing must avoid input-token cost asymmetry. Once the provider has started usable output, billable `input_tokens` are charged at 100% of actual/provider-reported input usage; only `output_tokens` are prorated to the delivered/generated amount at disconnect or timeout.
- Client disconnect before any usable output is delivered creates no charge by default.
- Kids Session billing still stores the real `user_id` and `tenant_id` because this is the restricted financial/accounting attribution table. This table must not contain raw prompt, raw input/output, provider payloads, Kids-sensitive content, or hidden Skill instructions.
- Refund and support traceability must use `request_id` or `idempotency_key` to correlate `skill_billing_events` with `skill_usage_events`; support tools must not join Kids events by real `user_id`.
- Access to `skill_billing_events` is restricted to Finance-approved billing systems, Security, and tightly scoped Engineering support; it must not be used as a general analytics source.

**Billing ledger immutability enforcement (DDL)**:

The append-only rule must be enforced at the database layer, not only in application code. Add the following trigger to the migration:

```sql
CREATE OR REPLACE FUNCTION skill_billing_events_prevent_charged_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.charge_status = 'charged' THEN
    RAISE EXCEPTION
      'skill_billing_events: row % is charged and immutable. '
      'Insert a compensating row with related_billing_event_id instead of updating the original.',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_billing_immutability
BEFORE UPDATE ON skill_billing_events
FOR EACH ROW EXECUTE FUNCTION skill_billing_events_prevent_charged_mutation();
```

This trigger allows status transitions on `pending` rows (e.g., `not_charged` → `pending` → `charged`) but blocks any UPDATE once a row reaches `charged`. The `refunded` and `voided` values in `charge_status` are intentionally reserved for compensating rows; they must never be set by UPDATE on a prior `charged` row.

### 4.6 `skill_reviews`

Internal operations review workflow.

```sql
CREATE TABLE skill_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id),
  status VARCHAR(32) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'escalated', 'resolved', 'reopened')),
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  trigger_source VARCHAR(64) NOT NULL DEFAULT 'manual_ops'
    CHECK (trigger_source IN ('manual_ops', 'automated_safety_threshold', 'automated_quality_threshold', 'system')),
  trigger_reason VARCHAR(128) NOT NULL DEFAULT 'manual_review',
  trigger_window_start TIMESTAMPTZ NULL,
  trigger_window_end TIMESTAMPTZ NULL,
  triggering_event_count INTEGER NULL CHECK (triggering_event_count IS NULL OR triggering_event_count >= 0),
  owner_id UUID NULL,
  notes TEXT NULL,
  escalated_to UUID NULL,
  resolution TEXT NULL,
  created_by UUID NULL,
  resolved_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL
);
```

Rules:
- `manual_ops` reviews are created by an authorized Ops user from the Ops Dashboard; `created_by` is required for this trigger source.
- Automated reviews are created by backend jobs from analytics/safety signals; `created_by` may be null, while `trigger_source`, `trigger_reason`, window, and count fields must explain the trigger.
- V1 automatic P0 trigger: if `skill_safety_violation` events for a Skill exceed 5 in a rolling 1-hour window, create or reopen one `skill_reviews` row with `trigger_source='automated_safety_threshold'`.
- Duplicate automated reviews for the same Skill and trigger reason should be coalesced while an `open`, `assigned`, or `escalated` review exists.

### 4.7 `skill_audit_log`

Security-sensitive audit trail.

```sql
CREATE TABLE skill_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NULL REFERENCES skills(id),
  skill_version_id UUID NULL REFERENCES skill_versions(id),
  actor_id UUID NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  action VARCHAR(96) NOT NULL,
  action_reason TEXT NULL,
  changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  before_value JSONB NULL,
  after_value JSONB NULL,
  request_id VARCHAR(128) NULL,
  ip_address INET NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (before_value IS NULL OR NOT (before_value ? 'instruction_template')),
  CHECK (after_value IS NULL OR NOT (after_value ? 'instruction_template'))
);
```

Rules:
- Kids approval, rejection, revocation, and emergency override are stored in `skill_audit_log` as the system-of-record with actions such as `kids_approval_granted`, `kids_approval_rejected`, `kids_approval_revoked`, and `kids_approval_overridden`.
- Analytics may receive a derived `skill_kids_approved` workflow event, but it must reference the audit `request_id` and must not store raw review notes, Kids input, or sensitive child data.

Rules:
- Prompt text must never be stored in audit `before_value` or `after_value`.
- Use `instruction_template_sha256` for template-change audit.

### 4.8 `skills_i18n`

Localized public content.

```sql
CREATE TABLE skills_i18n (
  skill_id UUID NOT NULL REFERENCES skills(id),
  locale VARCHAR(16) NOT NULL,
  name VARCHAR(160) NOT NULL,
  short_description VARCHAR(280) NOT NULL,
  description TEXT NOT NULL,
  input_hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  example_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  example_outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (skill_id, locale)
);
```

Fallback:
1. Try requested locale from `Accept-Language` or `locale` query.
2. Fallback to `skills.default_locale`.
3. Fallback to base `skills` public fields.

---

## 5. Indexes, Retention, and Performance

### 5.1 Required Indexes

```sql
CREATE INDEX idx_skills_status_category ON skills(status, category);
CREATE INDEX idx_skills_featured ON skills(featured_flag, featured_rank) WHERE featured_flag = true;
CREATE INDEX idx_skills_kids_status ON skills(is_kids_safe, is_kids_exclusive, status);
CREATE INDEX idx_skills_required_plan ON skills(required_plan, status);

CREATE INDEX idx_skill_versions_skill_status ON skill_versions(skill_id, status);
CREATE UNIQUE INDEX idx_skill_versions_one_active
  ON skill_versions(skill_id)
  WHERE status = 'active';

-- Search indexes support public name/description lookup without prompt access.
-- Locale-specific text search config may replace 'simple' after i18n search tuning.
CREATE INDEX idx_skills_public_search
  ON skills USING GIN (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' ||
      coalesce(short_description, '') || ' ' ||
      coalesce(description, '')
    )
  );
CREATE INDEX idx_skills_i18n_public_search
  ON skills_i18n USING GIN (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' ||
      coalesce(short_description, '') || ' ' ||
      coalesce(description, '')
    )
  );

CREATE INDEX idx_user_enabled_by_user ON user_enabled_skills(user_id, tenant_id, enabled);
CREATE INDEX idx_user_enabled_by_skill ON user_enabled_skills(skill_id, enabled);

CREATE INDEX idx_usage_skill_time ON skill_usage_events(skill_id, occurred_at DESC);
CREATE INDEX idx_usage_user_time ON skill_usage_events(user_id, occurred_at DESC);
CREATE INDEX idx_usage_event_time ON skill_usage_events(event_type, occurred_at DESC);
CREATE INDEX idx_usage_plan_persona_time ON skill_usage_events(plan, persona, occurred_at DESC);
CREATE INDEX idx_usage_entry_time ON skill_usage_events(entry_point, occurred_at DESC);
CREATE INDEX idx_usage_request_id ON skill_usage_events(request_id);

CREATE INDEX idx_billing_skill_time ON skill_billing_events(skill_id, created_at DESC);
CREATE INDEX idx_billing_user_time ON skill_billing_events(user_id, created_at DESC);

CREATE INDEX idx_reviews_skill_status ON skill_reviews(skill_id, status);
CREATE INDEX idx_reviews_owner_status ON skill_reviews(owner_id, status);
CREATE INDEX idx_reviews_trigger_status ON skill_reviews(skill_id, trigger_source, trigger_reason, status);

CREATE INDEX idx_audit_skill_time ON skill_audit_log(skill_id, created_at DESC);
CREATE INDEX idx_audit_actor_time ON skill_audit_log(actor_id, created_at DESC);
```

### 5.2 Retention

| Data | V1 Retention |
|---|---|
| `skills`, `skill_versions` | Permanent while product exists |
| `user_enabled_skills` | Permanent current state |
| `skill_usage_events` | Hot 90 days; archive or aggregate after 90 days before deletion |
| Kids-related event metadata | No raw sensitive data; anonymize personal fields according to legal policy |
| `skill_billing_events` | Follow finance retention policy |
| `skill_audit_log` | Minimum 2 years |
| `skill_reviews` | Minimum 2 years |

### 5.3 Caching

- Public skill list/detail can be cached by status/locale/category for short TTL.
- Entitlement and enabled state are user-specific and must not use shared public cache.
- Relay metadata cache must exclude raw prompt from shared logs and diagnostics.

---

## 6. Data Security Classification

| Field / Data | Classification | Handling |
|---|---|---|
| `instruction_template` | Highly sensitive platform IP | Super Admin + Relay only; never in public APIs/logs/events |
| `prompt_guard_template` | Sensitive platform IP | Same as instruction template |
| User input / model output | User content | Do not store raw in Skill analytics by default |
| Kids session raw input | Restricted sensitive | Do not persist in V1 analytics/logs |
| Billing amounts | Financial | Access controlled; no client trust |
| Audit logs | Security sensitive | Super Admin only |
| Public metadata | Public | Safe for Marketplace APIs |

---

## 7. API Standards

### 7.1 Common Response Envelope

Success:

```json
{
  "data": {},
  "meta": {
    "request_id": "req_123"
  }
}
```

List success:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 125,
    "has_next": true
  },
  "meta": {
    "request_id": "req_123"
  }
}
```

Error:

```json
{
  "error": {
    "code": "SKILL_PLAN_REQUIRED",
    "message": "This Skill requires Pro membership.",
    "detail": "Upgrade to Pro to use this Skill.",
    "request_id": "req_123",
    "retry_after": null
  }
}
```

### 7.2 Error Codes

| Code | HTTP | Notes |
|---|---:|---|
| `INVALID_REQUEST` | 400 | Invalid pagination, sorting, filtering, or malformed request parameters |
| `AUTH_REQUIRED` | 401 | Login required |
| `SKILL_NOT_FOUND` | 404 | Unknown Skill |
| `SKILL_NOT_PUBLISHED` | 403 | Draft, archived, or unavailable deprecated Skill |
| `SKILL_NOT_ENABLED` | 403 | Execution attempted before enable |
| `SKILL_PLAN_REQUIRED` | 403 | Plan insufficient |
| `SKILL_SUBSCRIPTION_INACTIVE` | 403 | Expired subscription |
| `SKILL_QUOTA_EXCEEDED` | 429 | Free quota exceeded |
| `SKILL_KIDS_MODE_BLOCKED` | 403 | Kids safety block |
| `SKILL_CONTEXT_TOO_LONG` | 400 | Input exceeds context rules |
| `SKILL_RATE_LIMITED` | 429 | Include `Retry-After` header |
| `SKILL_TIMEOUT` | 504 | Execution timeout |
| `SKILL_SAFETY_VIOLATION` | 403 | Safety block |
| `SKILL_INTERNAL_ERROR` | 500 | Internal failure |

### 7.3 Pagination, Filtering, Sorting

- `page`: integer, default 1, min 1.
- `limit`: integer, default 20, max 100.
- `sort`: server-defined enum; reject unknown sort keys.
- `locale`: optional; defaults to `Accept-Language`.
- Filters with unsupported values return 400.
- Unsupported or invalid pagination, sort, and filter inputs return the standard error envelope with code `INVALID_REQUEST`.

### 7.4 Auth and RBAC

| Route Group | Access |
|---|---|
| `/api/v1/marketplace/skills` GET | Anonymous allowed with public fields |
| `/api/v1/marketplace/my-skills` | Logged-in user |
| `/api/v1/marketplace/skills/{id}/enable` | Logged-in user |
| `/api/v1/admin/*` | Super Admin unless route explicitly read-only |
| `/api/v1/ops/*` | Operation/Product aggregate views |
| `/v1/skills/execute/{skill_id}` — **P0-A Skill Run Page** | User session token (`Authorization: Bearer <session_token>`); `execution_entry_point=native_deeprouter`; user must be logged in; user must have enabled the Skill; quota must be available; `skill_id` from URL path only — any `skill_id` in request body is discarded |
| `/v1/skills/execute/{skill_id}` — **P0-B External AI clients** | DeepRouter Connection Key (`Authorization: Bearer <connection_key>`); `execution_entry_point=external_ai_client`; Connection Key must map to a valid DeepRouter account; user must have enabled the Skill; quota must be available; `skill_id` from URL path only — any `skill_id` in request body is discarded |
| `/api/v1/admin/skills/{skill_id}/preview` | Super Admin session only; `execution_entry_point=admin_preview`; must not appear in user-facing billing history; Admin Preview quota applies |

---

## 8. User APIs

### 8.1 List Skills

`GET /api/v1/marketplace/skills`

Query:

| Param | Type | Notes |
|---|---|---|
| `category` | string | Optional |
| `query` | string | Searches public name/description only |
| `plan` | enum | free/pro/enterprise |
| `featured` | boolean | Optional |
| `kids_safe` | boolean | Ignored/hidden when Kids flag off for normal users |
| `page` / `limit` | integer | Standard pagination |
| `locale` | string | Optional |

Response item:

```json
{
  "id": "6e3f...",
  "slug": "xhs-review",
  "name": "小红书 Review",
  "category": "marketing",
  "short_description": "Generate structured Xiaohongshu review copy.",
  "required_plan": "pro",
  "availability": {
    "enabled": false,
    "locked": true,
    "lock_code": "SKILL_PLAN_REQUIRED",
    "cta": "upgrade"
  },
  "badges": ["pro", "featured"],
  "featured": true,
  "is_kids_safe": false,
  "is_kids_exclusive": false
}
```

Anonymous semantics:
- `enabled` is `null`.
- `locked` can be public plan lock only.
- CTA should be `login`.

### 8.2 Get Skill Detail

`GET /api/v1/marketplace/skills/{skill_id_or_slug}`

Response includes public fields only:

```json
{
  "id": "6e3f...",
  "slug": "xhs-review",
  "name": "小红书 Review",
  "category": "marketing",
  "description": "Generate structured Xiaohongshu review copy.",
  "short_description": "XHS review assistant.",
  "tags": ["marketing", "social"],
  "input_hints": [{"label": "Product", "required": true}],
  "example_inputs": [{"product": "Portable bottle"}],
  "example_outputs": [{"title": "3 title options"}],
  "required_plan": "pro",
  "availability": {
    "enabled": false,
    "locked": true,
    "lock_code": "SKILL_PLAN_REQUIRED",
    "cta": "upgrade"
  },
  "is_kids_safe": false,
  "is_kids_exclusive": false,
  "ai_disclosure_required": true
}
```

Must not include `instruction_template`, `prompt_guard_template`, provider raw config, or internal review notes.

### 8.3 My Skills

`GET /api/v1/marketplace/my-skills`

Requires authenticated user.

Response item:

```json
{
  "skill_id": "6e3f...",
  "slug": "xhs-review",
  "name": "小红书 Review",
  "skill_status": "published",
  "required_plan": "pro",
  "enabled": true,
  "enabled_at": "2026-06-15T00:00:00Z",
  "last_used_at": null,
  "availability": {
    "executable": true,
    "locked": false,
    "lock_code": null,
    "cta": "use"
  }
}
```

### 8.4 Enable Skill

`POST /api/v1/marketplace/skills/{skill_id}/enable`

Rules:
- Auth required.
- Draft/archived cannot be enabled.
- Deprecated cannot be enabled by new users and cannot be re-enabled after a user has disabled it.
- Pro Skill cannot be enabled by Free users in V1 baseline.
- Creates/updates `user_enabled_skills` through an atomic UPSERT/retry-safe write.
- Emits `skill_enabled`.

Response:

```json
{
  "data": {
    "skill_id": "6e3f...",
    "enabled": true,
    "enabled_at": "2026-06-15T00:00:00Z"
  },
  "meta": {"request_id": "req_123"}
}
```

### 8.5 Disable Skill

`POST /api/v1/marketplace/skills/{skill_id}/disable`

Rules:
- Auth required.
- Idempotent: disabling an already disabled Skill returns success.
- Updates `enabled=false`, sets `disabled_at`.
- Emits `skill_disabled`.

### 8.X Adapter Download Endpoints

每个 Skill 有独立的 Adapter 下载端点，每种平台格式一个 URL。

`GET /v1/skills/{skill_id}/adapters/{format}`

**format 枚举（有效值）：**

| format | 输出文件 | 适用平台 | 优先级 | 备注 |
|---|---|---|---|---|
| `openai-action` | `openai-action.json` | ChatGPT Custom GPT Action | P0 | 经验证的外部客户端演示路径；OpenAPI 3.1 + Bearer auth |
| `openai-tool` | `openai-tool.json` | OpenAI API function calling | P1 | 面向开发者；含 `additionalProperties: false`；复用 ChatGPT Action schema |
| `gemini-spark` | `gemini-spark-skill.zip` | Gemini Spark Skills | **Future / Later** | ⚠️ Instruction-only；不等同于 ChatGPT Actions；不触发 DeepRouter 保护 Runtime；不阻塞 MVP |
| `claude-code` | `claude-code.zip` | Claude Code MCP | **Future / Later** | 含 SKILL.md + allowed-tools + examples；不阻塞 MVP |
| `mcp-config` | `mcp-config.json` | 通用 MCP remote server（Claude Code / Gemini CLI） | **Future / Later** | 不阻塞 MVP |
| `gemini-function` | `gemini-function.json` | Gemini API Function Declaration | **Future / Later** | 面向开发者；触发 DeepRouter 保护 Runtime 执行；不阻塞 MVP |
| `anthropic-tool` | `anthropic-tool.json` | Claude API tool use | **Future / Later** | 面向开发者；含 `strict: true`；不阻塞 MVP |

**Rules（适用所有 format）：**
- `Authorization: Bearer <api_key>` 必须；缺失或无效返回 401 `AUTH_REQUIRED`。
- 用户必须对该 Skill 有 `enabled=true`；否则返回 403 `SKILL_NOT_ENABLED`。
- Published Skill only；其他状态返回 404。
- 所有格式输出只包含 Canonical Manifest 的 public 字段（`tool_function_name`、`tool_input_schema`、`tool_output_schema`、`description`）和 DeepRouter execute endpoint URL；绝不包含 `instruction_template`、Connection Key 或任何私有执行逻辑。
- **Connection Key 不写入任何 Adapter 输出文件**。Key 须由用户在各 AI 客户端（ChatGPT Action Authentication / Claude Code `--header` / 开发者后端）单独配置，作为 HTTP `Authorization: Bearer` header 发送给 DeepRouter；Key 不出现在下载文件内，不暴露给 LLM prompt。
- 响应 `Content-Disposition: attachment; filename="<format>.json"` 或 `.zip`（`claude-code` / `gemini-spark` 格式）。
- 触发 `skill_spec_downloaded` 事件，含 `adapter_format`、`skill_id`、`user_id`。

**额外规则 — `gemini-spark` format：**
- `gemini-spark-skill.zip` 包含：`SKILL.md`（公开的使用说明和 workflow 引导）、可选 examples、可选 templates、setup guide。
- 包内只允许公开的 Skill 使用说明；严禁包含 DeepRouter `instruction_template`、私有 prompt 逻辑、风险评分规则、内部评估规则、模型路由逻辑、配额逻辑、计费逻辑或用户密钥。
- 此 artifact 面向 Gemini Spark Skills（instruction/context 型）；不依赖 Gemini 对外部 API 的调用能力；不触发 DeepRouter 保护 Runtime 执行。
- `gemini-spark` format 下的 `skill_spec_downloaded` 事件须含 `"moat_mode": "instruction_only"` 字段，供 Analytics 区分此路径与保护执行路径。

**Response examples:**

`openai-action` format:
```json
{
  "openapi": "3.1.0",
  "info": { "title": "Contract Review", "version": "1.0.0" },
  "servers": [{ "url": "https://deeprouter.ai" }],
  "paths": {
    "/v1/skills/execute/contract_review": {
      "post": {
        "operationId": "contract_review_analyze",
        "summary": "Analyze contract risks",
        "description": "Reviews a contract and returns structured legal and commercial risk analysis.",
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Input" } } }
        },
        "responses": { "200": { "description": "Structured contract review result" } },
        "security": [{ "bearerAuth": [] }]
      }
    }
  },
  "components": {
    "schemas": { "Input": "<tool_input_schema>" },
    "securitySchemes": { "bearerAuth": { "type": "http", "scheme": "bearer" } }
  }
}
```

`openai-tool` format:
```json
{
  "type": "function",
  "function": {
    "name": "contract_review_analyze",
    "description": "Analyze a contract for legal and commercial risks.",
    "parameters": {
      "type": "object",
      "properties": {
        "contract_text": {
          "type": "string",
          "description": "Full contract text to analyze"
        },
        "review_focus": {
          "type": "string",
          "enum": ["general", "tenant_risks", "ip_ownership"]
        }
      },
      "required": ["contract_text"],
      "additionalProperties": false
    }
  }
}
```

> 注：`additionalProperties: false` 防止模型传入未声明字段，减少执行侧异常。

`anthropic-tool` format:
```json
{
  "name": "contract_review_analyze",
  "description": "Analyze a contract for legal and commercial risks.",
  "input_schema": "<tool_input_schema>",
  "strict": true
}
```

`gemini-function` format:
```json
{
  "functionDeclarations": [{
    "name": "contract_review_analyze",
    "description": "Analyze a contract for legal and commercial risks.",
    "parameters": "<tool_input_schema>"
  }]
}
```

`mcp-config` format:
```json
{
  "mcpServers": {
    "deeprouter": {
      "type": "url",
      "url": "https://deeprouter.ai/mcp",
      "headers": { "Authorization": "Bearer ${DEEPROUTER_API_KEY}" }
    }
  }
}
```

### 8.Y Live MCP Server

DeepRouter 暴露标准 MCP Server 端点，支持 Claude / Claude Code / Gemini CLI 等 agent 工具直接 connect，无需下载文件。

`GET /mcp` — Capability discovery（列出用户已 enabled 的所有 Skill tools）

`POST /mcp` — Tool call 处理（JSON-RPC 2.0）

**Rules:**
- `Authorization: Bearer <api_key>` 必须；缺失或无效返回 MCP 兼容格式错误（`{"jsonrpc":"2.0","id":null,"error":{"code":-32001,"message":"Unauthorized"}}`）。
- `GET /mcp` 返回该 API Key 对应用户所有 `enabled=true` Skill 的 tool 列表（MCP 2024-11-05 协议格式）。
- `POST /mcp` 内部路由到 `/v1/skills/execute/{skill_id}`；相同 Auth → Entitlement → Safety → Billing / Kids 检查链。
- 不暴露 `instruction_template` 或任何执行逻辑。
- MCP transport：HTTP（Streamable HTTP，MCP 2024-11-05）；未来可扩展 SSE。

**Wire Format — Request（JSON-RPC 2.0）：**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "contract_review_analyze",
    "arguments": {
      "contract_text": "...",
      "review_focus": "tenant_risks"
    }
  }
}
```

**Wire Format — Response（JSON-RPC 2.0）：**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"summary\":\"合约整体风险中等，存在 2 处高风险条款。\",\"risks\":[...]}"
      }
    ],
    "structuredContent": {
      "summary": "合约整体风险中等，存在 2 处高风险条款。",
      "risks": [
        {
          "severity": "high",
          "clause": "提前终止条款",
          "issue": "房东可在 7 天通知后无故终止合约",
          "suggestion": "建议将通知期延长至 30 天，并要求说明终止理由。"
        }
      ],
      "key_clauses": ["付款条件", "终止", "责任上限"]
    },
    "isError": false
  }
}
```

> 说明：`content[0].text` 是序列化 JSON 字符串（兼容旧版 MCP client）；`structuredContent` 是结构化对象（新版 MCP client 优先使用）。两者同时提供以保证向前兼容性。

**tools/list 响应示例（`GET /mcp`）：**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "contract_review_analyze",
        "description": "Analyze a contract for legal and commercial risks.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "contract_text": { "type": "string" },
            "review_focus": { "type": "string", "enum": ["general", "tenant_risks", "ip_ownership"] }
          },
          "required": ["contract_text"]
        }
      }
    ]
  }
}
```

---

## 9. Relay / Execution Contract

V1 用户使用 Skill 只有一条路：通过外部 AI 客户端（ChatGPT / Gemini / Claude）调用 DeepRouter Skill API。Playground 不提供用户级 Skill 执行；Admin Preview 使用独立的 `/api/v1/admin/skills/{skill_id}/preview` 端点。

### 9.1 External AI Client (Tool Call) Request

External AI clients (ChatGPT, Gemini, Claude) call the Skill execute endpoint directly.

`POST /v1/skills/execute/{skill_id}`

Headers:
- `Authorization: Bearer <user_api_key>` (required)
- `Content-Type: application/json`

Request body matches the tool's `tool_input_schema` as defined in the downloaded tool spec.

Rules:
- `Authorization: Bearer <api_key>` 必须；缺失或无效返回 401 `AUTH_REQUIRED`。
- API Key 解析到用户帐号；Entitlement 检查针对该帐号。
- `skill_id` 从 URL path 获取；request body 中的任何 `skill_id` 字段忽略（T-24）。
- 执行链：Auth → Entitlement → Quota → Kids Safety → Execution → Billing。
- `instruction_template` 永不返回给调用方；响应只含 `tool_result` JSON。
- 执行/拦截事件包含 `request_id`、`skill_id`、`skill_version_id`、`entry_point=external_ai_client`。

**统一响应格式：**
```json
{
  "skill_id": "contract_review",
  "run_id": "run_abc123",
  "status": "success",
  "result": {
    "summary": "合约整体风险中等，存在两处高风险条款需要谈判。",
    "risks": [
      {
        "severity": "high",
        "clause": "终止条款",
        "issue": "单方面终止权过宽，无需说明理由",
        "suggestion": "将终止权限制为重大违约，并增加 30 天书面通知和补救期。"
      }
    ],
    "key_clauses": ["付款条件", "终止", "责任上限", "知识产权归属"]
  },
  "usage": {
    "input_tokens": 12000,
    "output_tokens": 1800,
    "cost_usd": 0.18
  }
}
```

**错误响应：**
```json
{
  "skill_id": "contract_review",
  "run_id": "run_xyz789",
  "status": "error",
  "error": {
    "code": "SKILL_QUOTA_EXCEEDED",
    "message": "Monthly execution quota exceeded.",
    "details": { "quota_reset_at": "2025-02-01T00:00:00Z" }
  }
}
```

---

## 10. Admin APIs

All `/admin/*` routes require Super Admin unless explicitly stated.

### 10.1 Admin List Skills

`GET /api/v1/admin/skills`

Query: `status`, `category`, `required_plan`, `kids_approval_status`, `page`, `limit`.

Response must redact `instruction_template`.

### 10.2 Create Skill

`POST /api/v1/admin/skills`

Creates draft Skill. Required fields: `slug`, `name`, `short_description`, `description`, `category`, `required_plan`, `monetization_type`. `max_input_tokens` is required when `required_plan='free'`, `monetization_type='free'`, or `free_quota_per_month` is set.

Tool spec fields (`tool_function_name`, `tool_input_schema`, `tool_output_schema`) are optional at draft creation but required before publish. They can be set at creation or via PATCH.

### 10.3 Patch Skill

`PATCH /api/v1/admin/skills/{skill_id}`

Can update public metadata, entitlement, promotion, safety flags, execution settings excluding template, and tool spec schema fields. Template changes use version endpoint.

Patchable tool spec fields: `tool_function_name`, `tool_input_schema`, `tool_output_schema`.

Rules:
- `tool_function_name` must match `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/`; API returns 400 on invalid value.
- `tool_input_schema` and `tool_output_schema` must be valid JSON Schema objects; API returns 400 if parse fails.
- Any change to these three fields sets `tool_spec_invalidated_at = now()` to mark previously-downloaded specs as stale.
- Patch must reject Free/free-quota configurations that omit `max_input_tokens`.

### 10.4 Version APIs

- `GET /api/v1/admin/skills/{skill_id}/versions`
- `POST /api/v1/admin/skills/{skill_id}/versions`

Creating a version requires `instruction_template`, computes `instruction_template_sha256`, and writes audit log.
Version creation or activation must snapshot execution-critical fields from `skills`, including `model_whitelist`, `required_plan`, `monetization_type`/quota/markup settings, and `max_input_tokens`.

**Deprecated Skill security patch activation**: When a Skill has `status='deprecated'`, `POST /api/v1/admin/skills/{skill_id}/versions` accepts an optional `activate_as_deprecated_patch: true` body flag with required `reason` field. When set:

1. The new version is atomically activated: `skills.active_version_id` is updated to the new version id, and the previous active version is set to `status='inactive'`.
2. `skills.status` remains `deprecated`; the operation must not change discoverability or allow new enablement by any user who did not previously have `enabled=true`.
3. The activation is written to `skill_audit_log` with `action='version_activated_deprecated_patch'`, including `skill_version_id`, `actor_id`, `reason`, and `occurred_at`.
4. Without `activate_as_deprecated_patch: true`, creating a version for a deprecated Skill creates only a `draft` version; a separate explicit activation step is required.
5. If `activate_as_deprecated_patch: true` is sent for a Skill that is not `deprecated`, the API returns `409 Conflict` with `error_code: SKILL_NOT_DEPRECATED`.

This explicit flag prevents accidental activation of normal versions on deprecated Skills, while still providing a clear one-step path for emergency security patches.

### 10.5 Preview Skill

`POST /api/v1/admin/skills/{skill_id}/preview`

Runs draft or selected version. Response must include output and diagnostics but must not echo prompt text.

### 10.6 Publish Checklist

`GET /api/v1/admin/skills/{skill_id}/publish-checklist`

Returns checklist items and blocking reasons.

### 10.7 Lifecycle Actions

- `POST /api/v1/admin/skills/{skill_id}/publish`
- `POST /api/v1/admin/skills/{skill_id}/deprecate`
- `POST /api/v1/admin/skills/{skill_id}/archive`

All require `reason`. Archive/deprecate must write audit log.

### 10.8 Kids Approval

- `POST /api/v1/admin/skills/{skill_id}/kids-approval/request`
- `POST /api/v1/admin/skills/{skill_id}/kids-approval/approve`
- `POST /api/v1/admin/skills/{skill_id}/kids-approval/reject`

Approval/rejection requires Safety Reviewer or Super Admin with reviewer role/emergency override.

### 10.9 Audit Log

`GET /api/v1/admin/skills/{skill_id}/audit-log`

Super Admin only. Response must not include prompt text.

---

## 11. Ops APIs

Ops APIs expose aggregate data and must not expose prompt text or raw sensitive user content.

- `GET /api/v1/ops/skill-analytics/overview`
- `GET /api/v1/ops/skill-analytics/skills`
- `GET /api/v1/ops/skill-analytics/funnel`
- `GET /api/v1/ops/skill-analytics/retention`
- `GET /api/v1/ops/skill-analytics/persona`
- `GET /api/v1/ops/skill-reviews`
- `POST /api/v1/ops/skill-reviews/{review_id}/assign`
- `POST /api/v1/ops/skill-reviews/{review_id}/resolve`
- `POST /api/v1/ops/skill-reviews/{review_id}/escalate`

CSV export is P1 aggregate-only and must be separately permissioned.

---

## 12. Migration Plan

### 12.1 Order

1. Create enums/check-compatible tables without foreign-key cycles.
2. Create `skills` — including tool spec columns: `tool_function_name`, `tool_input_schema`, `tool_output_schema`, `tool_spec_openapi_version`, `tool_spec_mcp_version`, `tool_spec_invalidated_at`. All nullable at creation; required before publish for external-client-capable Skills.
3. Create `skill_versions`.
4. Add `skills.active_version_id` FK if DB ownership allows.
5. Create `skills_i18n`.
6. Create `user_enabled_skills`.
7. Create `skill_usage_events` — `entry_point` enum must include `external_ai_client` and `api_direct`.
8. Create `skill_billing_events`.
9. Create `skill_reviews`.
10. Create `skill_audit_log`.
11. Add indexes.
12. Seed initial official Skills as drafts only — populate `tool_function_name` and `tool_input_schema` for each seed Skill before publish.

### 12.2 Rollback

- Drop indexes first.
- Drop dependent tables before `skills`.
- Do not drop existing platform user/tenant/billing tables.
- Production rollback must preserve audit and billing events once GA traffic exists; after GA, use forward migration instead of destructive rollback.

---

## 13. Acceptance Criteria

### 13.1 Data Model AC

1. DDL can run in staging from empty database state.
2. Public/user/ops queries cannot select or return `instruction_template`.
3. `featured` is not a lifecycle status.
4. Re-enable behavior for `user_enabled_skills` is deterministic, idempotent, and safe under concurrent Enable requests.
5. `skill_usage_events` does not store raw prompt, full user input, provider raw payload, or Kids sensitive content.
6. Billing attribution is stored separately from analytics events.
7. All admin writes create `skill_audit_log`.
8. `skills_i18n` enforces unique `(skill_id, locale)` and fallback behavior is specified.
9. Public Skill search has index support for `skills` and `skills_i18n` public text fields.

### 13.2 API AC

1. Every endpoint defines auth/RBAC behavior.
2. List endpoints return pagination envelope.
3. Error responses follow the standard error envelope.
4. Anonymous list/detail responses do not expose user-specific enabled state.
5. Enable/disable endpoints are idempotent where specified.
6. Admin and Ops routes are separated by permission model.
7. Tool spec download endpoint returns spec containing only `tool_function_name`, `tool_input_schema`, `tool_output_schema`, and API endpoint URL; `instruction_template` is never present in the response.
8. Admin PATCH rejects `tool_function_name` values that do not match `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/`.
9. Publish checklist API returns a blocking error if `tool_function_name` is null or empty.
10. External client execution endpoint (`POST /v1/skills/execute/{skill_id}`) returns 401 for missing/invalid API Key before any Skill state is loaded.
11. Kids approval APIs exist if Kids flag can be enabled.
12. Relay contract explicitly ignores client-provided Kids Session fields.
13. All response examples exclude `instruction_template`.
