# DR-66 — Skill lifecycle & enabled-state gate (relay entry)

Status: **eval** (backend, `internal/skill/relay/`; awaiting merge). Phase 1 / M05.
Depends on: DR-65 (immutable execution snapshot, merged) + DR-42 (`user_enabled_skills`).
Successor: DR-67 (use-time entitlement) — see D3 handoff seam below.

## 1. Problem

The relay entry point (`skillrelay.resolve()`) loaded the immutable SkillVersion
snapshot for any **published** skill with an active version, without checking
whether the **calling user has the skill enabled** or whether the skill's
lifecycle status actually permits execution. Per the marketplace spec the relay
must run a *lifecycle + enabled-state* check **before** any prompt/snapshot is
loaded (tasks/05 §5.1 step 8, ahead of the snapshot bind at step 11; threat T-05
"User executes disabled or archived Skill … checks before injection").

## 2. Scope

Backend only, inside the single relay choke point `internal/skill/relay/`:

- New `lifecycle.go`: pure decision function + narrow `user_enabled_skills` read.
- `resolver.go`: replace the published-only / active-version check (which sat
  immediately before the `skill_versions` snapshot SELECT) with the gate.

**Out of scope** (explicitly not done here): plan/quota/entitlement (DR-67),
feature-flag/kill-switch (step 7), `last_used_at` update, new error codes /
tables / migrations / frontend.

## 3. Decision table (live behavior, `deprecatedRuntimeEnabled = false`)

`enabled` = `user_enabled_skills.enabled` for `(user_id, tenant_id=user_id, skill_id)`.

| Skill status | active version? | enabled row | Result |
|---|---|---|---|
| any | none | — | `SKILL_NOT_PUBLISHED` |
| published | yes | enabled=true | **allow** |
| published | yes | enabled=false / no row | `SKILL_NOT_ENABLED` |
| deprecated | yes | any | `SKILL_NOT_PUBLISHED` (fail-closed, D3=b) |
| draft / archived | yes | any | `SKILL_NOT_PUBLISHED` |

The enabled lookup is gated on **`active_version != nil`**: a missing active
version is rejected with `SKILL_NOT_PUBLISHED` on lifecycle alone, with zero
`user_enabled_skills` queries. This also fixes error priority — the lifecycle
failure must never be masked by a `SKILL_INTERNAL_ERROR` from the (now skipped)
enabled lookup.

On a real DB error during the enabled lookup (published **with** active version)
→ `SKILL_INTERNAL_ERROR`.
Gate failure returns **before** the `skill_versions` SELECT, so no snapshot and
no prompt is loaded ("No prompt load", tasks/05 error table).

## 4. Locked decisions

- **D1** — published+not-enabled → `SKILL_NOT_ENABLED`; deprecated (unavailable)
  → `SKILL_NOT_PUBLISHED`. Both codes already exist.
- **D2** — gate lives in `resolve()` (the single per-request entry both the
  direct/TextHelper and Distribute paths traverse), after the `skills` row load,
  before the snapshot bind / `LoadAndApply`.
- **D3 = b (staged, fail-closed)** — DR-66 does **not** open deprecated execution
  live. `const deprecatedRuntimeEnabled = false`; deprecated always
  `SKILL_NOT_PUBLISHED` until **DR-67** adds the use-time entitlement check
  ("already-enabled AND still-entitled", tasks/05 §5.1; tasks/01 §6 status table)
  and flips the flag **in the same PR**. The open branch is implemented and
  unit-tested (`…_FutureDR67_…`) but not live — a staged cross-ticket seam, not
  dead code. **Requires reviewer sign-off** (see PR checkbox).
- **D4** — `tenant_id = user_id` is a V1 code-reality constraint (no separate
  tenant entity), not a long-term product model.
- **D5** — the ticket cites FR-G5/FR-G6. **No current authoritative product
  requirement under `docs/skill-marketplace` or `docs/tasks` defines FR-G5/FR-G6**;
  the only `rg "FR-G5|FR-G6"` matches are this DR-66 explanatory note and the PR
  materials themselves, which are not implementation authority. Grounded instead on
  tasks/01 §6 (lifecycle/error table) and tasks/05 §5.1 (step ordering) + threat T-05.

Additional invariant: `enabled` is the sole use-time authority in V1;
`disabled_at` is audit metadata and is not independently checked (DR-42's
`Enable/DisableSkillForUser` keep `enabled` consistent).

## 5. Verification

- `lifecycle_test.go` — exhaustive truth table in both flag states (incl.
  `FutureDR67` open branch + a guard pinning `deprecatedRuntimeEnabled=false`).
- `resolver_lifecycle_test.go` — enabled/not-enabled/disabled rows; deprecated
  fail-closed; DB-error→`SKILL_INTERNAL_ERROR`; tenant isolation; **short-circuit**
  (draft/archived/deprecated-flag-off do zero `user_enabled_skills` SELECTs, via a
  GORM query counter — no production test hook); **no-snapshot** (gate fail → zero
  `skill_versions` SELECT).
- Two-path no-snapshot regression: `relay/compatible_handler_skill_test.go`
  (direct/TextHelper) and `middleware/distributor_skill_test.go` (Distribute) —
  gate fail → `SKILL_NOT_ENABLED`, zero snapshot SELECT, no instruction-template
  injection, no `SkillRelayContext` stored.

Note: `-race` deferred to CI (no local cgo compiler on the dev box); CI-equivalent
`go test ./internal/... -count=1` is green.
