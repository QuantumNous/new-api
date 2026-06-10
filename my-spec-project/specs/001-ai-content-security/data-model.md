# Data Model: AI Content Security Management Module

**Date**: 2026-06-10
**Feature**: AI Content Security Management Module

---

## Entity Overview

```text
users (existing)
│
├── 1:N ──► security_groups
│               │
│               ├── 1:N ──► security_rules
│               │
│               └── N:M ──► security_user_policies ──► users
│
├── 1:N ──► security_hit_logs
│               │
│               └── N:1 ──► security_rules (optional, via rule_id)
│               └── N:1 ──► security_groups (optional, via group_id)
│
└── 1:N ──► security_audit_logs
```

---

## Entity: security_groups (Sensitive Word Groups)

A collection of detection rules organized by theme. Supports nested hierarchies.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BIGINT | PK, auto-increment | Unique identifier |
| name | VARCHAR(128) | NOT NULL, unique | Group display name |
| description | VARCHAR(255) | DEFAULT '' | Group description |
| status | TINYINT | DEFAULT 1, INDEX | 0=disabled, 1=enabled |
| parent_id | BIGINT | DEFAULT 0, INDEX | Parent group ID (0 = root) |
| depth | INT | DEFAULT 0 | Nesting depth level |
| path | VARCHAR(500) | DEFAULT '', INDEX | Materialized path (e.g., `/1/2/3`) |
| sort_order | INT | DEFAULT 0 | Display sort order |
| created_at | BIGINT | DEFAULT 0 | Creation timestamp (Unix) |
| updated_at | BIGINT | DEFAULT 0 | Last update timestamp (Unix) |

**Validation Rules**:
- `depth` MUST NOT exceed 5.
- `parent_id` MUST reference an existing group or be 0.
- `path` MUST be consistent with `parent_id` and `depth`.

**State Transitions**:
- Enabled → Disabled: Rules in this group are no longer evaluated.
- Disabled → Enabled: Rules become active immediately (cached rules are refreshed).

---

## Entity: security_rules (Detection Rules)

A single detection pattern within a group.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BIGINT | PK, auto-increment | Unique identifier |
| group_id | BIGINT | NOT NULL, FK → security_groups.id | Owning group |
| name | VARCHAR(128) | NOT NULL | Rule display name |
| type | TINYINT | NOT NULL, INDEX | 1=keyword, 2=regex, 3=NER, 4=AI |
| content | TEXT | NOT NULL | Rule content (keyword list, regex pattern, or AI prompt) |
| extra_config | TEXT | NULL | JSON-encoded additional configuration (e.g., masking strategy, NER types) |
| action | TINYINT | DEFAULT 1 | 1=pass, 2=alert, 3=mask, 4=block, 5=review |
| priority | INT | DEFAULT 0 | Evaluation priority (higher = evaluated first) |
| risk_score | INT | DEFAULT 50 | Risk score (0-100) contributed when matched |
| status | TINYINT | DEFAULT 1, INDEX | 0=disabled, 1=enabled |
| created_at | BIGINT | DEFAULT 0 | Creation timestamp (Unix) |
| updated_at | BIGINT | DEFAULT 0 | Last update timestamp (Unix) |

**Validation Rules**:
- `type` MUST be one of {1, 2, 3, 4}.
- `action` MUST be one of {1, 2, 3, 4, 5}.
- `risk_score` MUST be between 0 and 100.
- `content` MUST be non-empty and syntactically valid for the selected `type`.

**State Transitions**:
- Enabled → Disabled: Rule is skipped during detection.
- Disabled → Enabled: Rule is loaded into the detection engine cache.

---

## Entity: security_user_policies (User Security Policies)

Binds sensitive word groups to users with specific configuration.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BIGINT | PK, auto-increment | Unique identifier |
| user_id | INT | NOT NULL, FK → users.id | Target user |
| group_id | BIGINT | NOT NULL, FK → security_groups.id | Bound group |
| scope | TINYINT | DEFAULT 3 | 1=request only, 2=response only, 3=both |
| default_action | TINYINT | DEFAULT 3 | Default action when group matches |
| custom_response | TEXT | NULL | Custom message shown to user on block/intercept |
| whitelist_ips | TEXT | NULL | JSON array of whitelisted IP addresses |
| status | TINYINT | DEFAULT 1, INDEX | 0=disabled, 1=enabled |
| created_at | BIGINT | DEFAULT 0 | Creation timestamp (Unix) |
| updated_at | BIGINT | DEFAULT 0 | Last update timestamp (Unix) |

**Validation Rules**:
- A user MAY have multiple policies binding different groups.
- Duplicate `(user_id, group_id)` pairs are NOT allowed.
- `scope` MUST be one of {1, 2, 3}.

---

## Entity: security_hit_logs (Detection Event Logs)

Records every content detection event.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BIGINT | PK, auto-increment | Unique identifier |
| request_id | VARCHAR(64) | NOT NULL, INDEX | Correlation ID linking to the original API request |
| user_id | INT | NOT NULL, FK → users.id | User who initiated the request |
| channel_id | INT | NOT NULL, FK → channels.id (existing) | AI channel used |
| model_name | VARCHAR(128) | DEFAULT '', INDEX | AI model name |
| token_id | INT | DEFAULT 0 | API token ID used |
| rule_id | BIGINT | NULL, FK → security_rules.id | Matched rule (NULL if no rule matched) |
| group_id | BIGINT | NULL, FK → security_groups.id | Matched group (NULL if no group matched) |
| content_type | TINYINT | DEFAULT 1 | 1=request, 2=response |
| action | TINYINT | NOT NULL, INDEX | Action taken (1-5) |
| risk_level | TINYINT | NOT NULL, INDEX | 1=low, 2=medium, 3=high, 4=critical |
| risk_score | INT | DEFAULT 0 | Calculated risk score (0-100) |
| original_content_hash | VARCHAR(64) | DEFAULT '' | SHA-256 hash of original content |
| processed_content | TEXT | NULL | Masked/redacted content (if action was mask) |
| match_detail | TEXT | NULL | JSON describing what matched (rule type, matched text positions) |
| ip | VARCHAR(64) | DEFAULT '' | Client IP address |
| created_at | BIGINT | DEFAULT 0, INDEX | Event timestamp (Unix) |

**Validation Rules**:
- `risk_score` MUST be between 0 and 100.
- `content_type` MUST be one of {1, 2}.
- `original_content_hash` MUST be a valid SHA-256 hex string when populated.

---

## Entity: security_audit_logs (Administrative Audit Logs)

Records administrative actions (CRUD on groups, rules, policies).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BIGINT | PK, auto-increment | Unique identifier |
| user_id | INT | NOT NULL, FK → users.id | Administrator who performed the action |
| action_type | VARCHAR(32) | NOT NULL, INDEX | Action type: create, update, delete, enable, disable |
| target_type | VARCHAR(32) | NOT NULL | Target entity: group, rule, policy |
| target_id | BIGINT | NOT NULL | ID of the affected entity |
| old_value | TEXT | NULL | JSON snapshot of entity before change |
| new_value | TEXT | NULL | JSON snapshot of entity after change |
| operator_id | INT | NOT NULL | Same as user_id (denormalized for query convenience) |
| created_at | BIGINT | DEFAULT 0, INDEX | Action timestamp (Unix) |

---

## Cross-Database Compatibility Notes

Per project Rule 2 (Database Compatibility):

- **Primary keys**: Use GORM's default auto-increment; do not specify `AUTO_INCREMENT` or `SERIAL`.
- **Booleans**: Store as `TINYINT` (0/1), not native boolean types.
- **Timestamps**: Store as `BIGINT` Unix timestamps, not `DATETIME` or `TIMESTAMP`.
- **JSON fields**: Store as `TEXT` with JSON string content; use application-layer parsing.
- **Indexes**: Use GORM `index` tags; avoid database-specific index types.
- **Materialized path**: `path` is a simple string; tree traversal is done via `LIKE` queries (e.g., `path LIKE '/1/%'`), which work across all three databases.
