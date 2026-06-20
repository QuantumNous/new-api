# Skill Marketplace Data Model and API Specification

本文档定义 DeepRouter Skill Marketplace V1 的企业级数据模型和 API 合约。目标是让 Backend、Frontend、Data、Security、QA 和独立 Agent 可以基于同一套 schema、约束、权限、错误码和响应格式实现。

本文件以 `tasks/01_Functional_Requirements.md` 和 `tasks/02_UX_Design.md` 为上游基准。若冲突，以 Functional Requirements 的产品边界和权限规则为准。

---

## 1. Design Principles

| Principle | Requirement |
|---|---|
| Runtime-Dependency Moat (R2/D-09) | 已发布的 `instruction_template` 随下载包分发、可读；护城河是运行时硬依赖 + 按运行者 own-key 鉴权计费。服务端 DRM 只保护 provider 凭证、路由/选模型逻辑与草稿模板 |
| Use-time Entitlement | `user_enabled_skills` 只代表用户下载/启用关系，不代表永久执行授权 |
| Immutable Execution | 每次执行必须绑定进入请求时选定的 `skill_version_id` 和服务端执行快照（不信任包内提供的模板/路由提示） |
| Analytics by Default | 所有关键行为必须有事件记录，且带 `entry_point` |
| Privacy by Design | 不在 analytics、audit、logs 中存储 raw user input、PII、Kids 敏感输入或 provider raw payload（`instruction_template` 不再是脱敏对象） |
| Explicit RBAC | `/admin/*` 用于 Super Admin 敏感写操作；`/ops/*` 用于聚合运营视图 |
| Migration Ready | 表结构必须包含类型、默认值、约束、索引和回滚策略 |

---

## 2. ERD

```text
skills
  1 ── * skill_versions
  1 ── * skills_i18n
  1 ── * user_enabled_skills   (download/entitlement record)
  1 ── * skill_usage_events    (Tier 1 platform events)
  1 ── * skill_evaluations     (per-version evaluation results)
  1 ── * skill_ratings         (user star ratings + comments)
  1 ── * skill_saves           (save / favorite records)
  1 ── * skill_reviews         (ops review workflow)
  1 ── * skill_audit_log

users / tenants / subscriptions
  referenced by user_enabled_skills, usage events, ratings, saves, reviews, audit logs
  users.tier2_telemetry_consent gates Tier 2 telemetry ingestion
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
| `evaluation_status` | `pending`, `running`, `passed`, `failed`, `warning` |
| `evaluation_issue_type` | `format`, `completeness`, `task_completion`, `violation` |
| `save_type` | `saved`, `favorited` |
| `block_reason` | `auth_required`, `skill_not_found`, `skill_not_published`, `plan_required`, `subscription_inactive`, `kids_mode_blocked`, `evaluation_not_passed` |
| `entry_point` | `marketplace_card`, `skill_detail`, `my_skills`, `saved_list`, `featured`, `popular`, `new`, `recommended`, `admin_preview`, `search_results`, `skill_package` |
| `tier2_event_type` | `skill_installed`, `skill_used_local` |

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

Security requirements (R2/D-09):
- The **published** version `instruction_template` is distributed inside the downloadable package and may be returned by the package-build and package-download paths; it is no longer a confidentiality boundary.
- **Draft / unpublished** version templates must not be served to non-Super-Admin surfaces.
- `instruction_template_sha256` is retained as a package/version integrity check (verify the downloaded package matches the active version) rather than a secrecy measure.
- Provider credentials and server-side routing/model-selection config are never stored in `skill_versions` exposed columns and never appear in any package, public/user/ops API, log, or event.
- Encryption-at-rest still applies to draft templates and to genuinely sensitive server-side config; it is not required for published templates that already ship in the package.

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
  entry_point VARCHAR(64) NOT NULL,

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
- `metadata` is allowlisted, not free-form. V1 allowed analytics metadata keys are `source_entry_point`, `repeat_index`, `surface_id`, `card_position`, `query_hash`, `filter_hash`, `schema_version`, `producer`, and `client_event_time`.
- `metadata.source_entry_point` must use the same `entry_point` enum when present.
- `metadata.repeat_index` must be a positive integer when present and is required for `skill_repeat_use` until promoted to a first-class column.
- Restricted keys such as `instruction_template`, `prompt`, `system_prompt`, `raw_messages`, `provider_payload`, `kids_raw_input`, `full_user_input`, `raw_output`, and `model_output` must be rejected or quarantined.

### 4.5 `skill_evaluations`

每个 Skill 版本的自动化评估结果。Evaluation passed 是发布的硬性前提。

```sql
CREATE TABLE skill_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id),
  skill_version_id UUID NOT NULL REFERENCES skill_versions(id),

  status VARCHAR(32) NOT NULL
    CHECK (status IN ('pending', 'running', 'passed', 'failed', 'warning')),
  score INTEGER NULL CHECK (score IS NULL OR score BETWEEN 0 AND 100),

  format_check_passed BOOLEAN NOT NULL DEFAULT false,
  completeness_check_passed BOOLEAN NOT NULL DEFAULT false,
  task_completion_passed BOOLEAN NOT NULL DEFAULT false,
  violation_check_passed BOOLEAN NOT NULL DEFAULT false,

  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- issue shape: [{type: 'format'|'completeness'|'task'|'violation', severity: 'error'|'warning', message: '...'}]

  triggered_by VARCHAR(64) NOT NULL DEFAULT 'publish_action'
    CHECK (triggered_by IN ('publish_action', 'manual_retrigger', 'version_update')),
  triggered_by_actor_id UUID NULL,

  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Rules:
- One evaluation row per trigger; re-trigger creates a new row.
- Publish action must check the latest evaluation for the version: `status='passed'` required; any other status blocks publish.
- `issues` is append-only during a run; do not mutate after `completed_at` is set.
- `score` is derived from sub-check results; formula owned by Evaluation Pipeline team.

### 4.5b `skill_ratings`

用户对 Skill 的评分和可选短评。

```sql
CREATE TABLE skill_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id),
  skill_version_id UUID NOT NULL REFERENCES skill_versions(id),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment VARCHAR(280) NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, tenant_id, skill_id)
);
```

Rules:
- One rating per user per skill; re-rate updates the existing row.
- `comment` is optional, max 280 chars; no raw user input or PII.
- Rating aggregate (avg_stars, rating_count) is computed and cached on `skills` table or a materialized view for dashboard performance.

### 4.5c `skill_saves`

用户收藏（save/favorite）行为记录。

```sql
CREATE TABLE skill_saves (
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  skill_id UUID NOT NULL REFERENCES skills(id),
  save_type VARCHAR(32) NOT NULL DEFAULT 'saved'
    CHECK (save_type IN ('saved', 'favorited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, tenant_id, skill_id, save_type)
);
```

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
| Published `instruction_template` | Public-by-distribution (R2) | Ships in the downloadable package; readable; not a confidentiality boundary |
| Draft / unpublished `instruction_template` | Sensitive (pre-release) | Super Admin only until published |
| Provider credentials & server routing/model-selection logic | Highly sensitive platform IP | Server-side only; never in package, public APIs, logs, or events |
| `prompt_guard_template` (if server-side only) | Sensitive platform IP | Server-side only if not part of the published package |
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

### 7.4 Auth and RBAC

| Route Group | Access |
|---|---|
| `/api/v1/marketplace/skills` GET | Anonymous allowed with public fields |
| `/api/v1/marketplace/my-skills` | Logged-in user |
| `/api/v1/marketplace/skills/{id}/download` | Logged-in user (entitled) |
| `/api/v1/admin/*` | Super Admin unless route explicitly read-only |
| `/api/v1/ops/*` | Operation/Product aggregate views |
| Public routing/execution API (called by package) | Valid runner DeepRouter credential only |

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

The Detail response is public metadata only and must not include provider raw config, server routing internals, or internal review notes. The `instruction_template` itself is not returned here; it is delivered via the package-download endpoint (§8.6). Detail may add a `download` CTA and a `requires_deeprouter_key: true` runtime-dependency flag.

### 8.6 Download Skill Package

`GET /api/v1/marketplace/skills/{skill_id_or_slug}/download`

- Returns the versioned zip package (manifest + published `instruction_template` + thin client) for the active published version, pinned to `skill_version_id`.
- Requires a logged-in, entitled user; archived/draft are 403/404 per the entitlement table.
- The package must not contain provider credentials, server routing/model-selection logic, or draft templates.
- Emits `skill_enabled` (download) with `entry_point` of the originating surface.
- The package's bundled client targets the public routing API (§9) and authenticates with the runner's own DeepRouter credential at runtime.

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

> **V1 note (DR-55):** Enable is superseded by `GET /api/v1/marketplace/skills/{id}/download` (download == enable); a successful package download writes/updates `user_enabled_skills` and emits `skill_enabled`. No standalone `POST .../enable` route is registered in V1. The rules below describe the enablement semantics now carried by the download path. (Disable / Remove from My Skills is owned by DR-56.)

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

---

## 9. Tier 2 Telemetry Contract

V1 Skill 执行发生在用户本地，DeepRouter 不参与执行。用户可在账号设置中授权 Tier 2 遥测，授权后本地工具（Claude Code 插件或 DeepRouter CLI）回传 installed / used 事件。

**授权字段**（存于用户账号表）：
```sql
ALTER TABLE users ADD COLUMN tier2_telemetry_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN tier2_telemetry_consented_at TIMESTAMPTZ NULL;
```

**Tier 2 事件上报接口**：

`POST /api/v1/telemetry/skill-events`

Headers: `Authorization: Bearer <user DeepRouter key>`

Request:
```json
{
  "event_type": "skill_installed | skill_used_local",
  "skill_id": "6e3f...",
  "skill_version_id": "...",
  "occurred_at": "<ISO8601>",
  "client_info": { "tool": "claude-code", "version": "..." }
}
```

Rules:
- 无 `tier2_telemetry_consent=true` 的请求返回 403 并丢弃事件。
- 事件不含 raw user input、对话内容、模型输出或 PII。
- `client_info` 仅用于工具版本分析，不做身份追踪。
- 用户在账号设置中撤销授权后，后续事件立即丢弃；历史数据保留至隐私政策规定的保留期。

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

### 10.3 Patch Skill

`PATCH /api/v1/admin/skills/{skill_id}`

Can update public metadata, entitlement, promotion, safety flags, execution settings excluding template. Template changes use version endpoint. Patch must reject Free/free-quota configurations that omit `max_input_tokens`.

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
2. Create `skills`.
3. Create `skill_versions`.
4. Add `skills.active_version_id` FK if DB ownership allows.
5. Create `skills_i18n`.
6. Create `user_enabled_skills`.
7. Create `skill_usage_events`.
8. Create `skill_billing_events`.
9. Create `skill_reviews`.
10. Create `skill_audit_log`.
11. Add indexes.
12. Seed initial official Skills as drafts only.

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
7. Kids approval APIs exist if Kids flag can be enabled.
8. Relay contract explicitly ignores client-provided Kids Session fields.
9. All response examples exclude `instruction_template`.
