# DR-74 — Event `schema_version` + `timestamp`→`occurred_at` mapping

Status: **eval** (backend, `internal/skill/model/`). Phase 1 / Module M08 (Analytics Pipeline).

## 1. Problem

The analytics persistence contract (tasks/03 §4.4, tasks/04 §4.1/§14, tasks/06 WBS M08,
compliance/02 §8) requires every `skill_usage_events` row to (a) persist its event time as
`occurred_at` in **UTC** and (b) carry a `schema_version`. `occurred_at` already existed as a
first-class UTC column, but **no event was stamping `schema_version`** — all three emit sites
(`download.go` ×2, `skills.go` `RecordMarketplaceSkillEvent`) wrote `metadata = {}`. The
acceptance criterion "schema_version stored on every event" was therefore failing.

## 2. Scope

Backend, model layer only (`internal/skill/model/skill_usage_event.go`):
- Stamp `metadata.schema_version="1.0"` on every event.
- Normalize `occurred_at` to UTC at persistence.

Out of scope: new columns/migrations/frontend; accepting a client-supplied timestamp;
late-event handling; dashboard/cohort query code (DR-75/76 consume this contract).

## 3. Design decisions (signed off 2026-06-23)

- **D1 — `schema_version` → `metadata.schema_version`, value `"1.0"`, V1 STRICT.** No
  first-class column (canonical DDL has none). Validation: absent → set `"1.0"`; `== "1.0"` →
  keep; empty / non-string / any other value → **reject**. V1 is single-schema (no reader-side
  multi-version migration), so mixed schemas must not persist.
- **D2 / D4 — `occurred_at` is server-authoritative UTC.** Zero → `time.Now().UTC()`; non-zero
  (trusted server-side producer) → normalized to UTC and preserved. Public/client-facing
  handlers must **not** map a client `timestamp` into `OccurredAt`; client time, if kept,
  belongs only in optional `metadata.client_event_time`. No current emit site accepts client
  time, so DR-74 adds no extra guard — but this is the boundary future handlers must honor.
- **D3 — Enforced in `BeforeCreate`** (the single choke point every `db.Create` hits), so the
  guarantee holds for all write paths including direct creates.

## 4. Implementation

`skill_usage_event.go`:
- `const SkillEventSchemaVersion = "1.0"`.
- `ensureMetadataSchemaVersion(SkillJSONB) (SkillJSONB, error)` — D1 strict rule.
- `BeforeCreate`: normalize metadata → validate metadata → **stamp schema_version** →
  validate Kids privacy → **`occurred_at` UTC** (zero→now, else `.UTC()`).

## 5. Verification

`skill_usage_event_dr74_test.go` (9 tests): schema_version stamped via direct create /
`EmitSkillUsageEvent` / `EmitSkillEnabled`; explicit `"1.0"` kept; non-1.0 / empty / non-string
rejected; restricted-key guard still wins with a valid schema_version; `occurred_at` UTC
normalization (cross-DB-stable `Equal` assertions, not `Location()`); zero→now-UTC; non-zero
UTC preserved. Coverage data captured in `docs/test-results/dr74-*.txt`.

Doc clarifications (DR-74-surfaced ambiguities, applied in tasks/04): schema_version is
metadata-only with no first-class column; `occurred_at` is server-authoritative UTC (current
public/client-facing producers use server receipt time, trusted server-side producers may
preserve an explicit event timestamp after UTC normalization) and late-marking is a P1 for
trusted producer timestamps; top-level `schema_version` in sample envelopes is wire-only.
