# DR-70 - PRD + Design: Relay Block Path Emits `skill_blocked`

**Status**: build
**Date**: 2026-06-23
**Ticket**: DR-70
**Depends on**:
- `DR-65` - immutable request-entry snapshot binding
- `DR-67` - use-time entitlement/quota gates that DR-70 observes but does not invent
- `DR-73` - standard skill error envelope and stable uppercase `error_code` contract
- `DR-90` - no `skill_billing_events` row on blocked paths and billing-attribution boundary

This document is the single maintained DR-70 source in the repository. It combines the product/acceptance role of a task PRD with the implementation/decision role of a design doc so DR-70 does not drift across multiple files.

If `DR-73` or `DR-90` is not yet merged, DR-70 can only implement the subset already supported by the current stable errcode and billing model. Any gap must be disclosed in the PR description as a blocker or staged dependency, not silently assumed complete.

## Scope

DR-70 standardizes only the pre-injection blocked path for Skill relay requests:

- keep the existing stable API error envelope and `error_code`
- emit `skill_blocked` with canonical lowercase `block_reason` and stable uppercase `error_code`
- create no `skill_billing_events` row on blocked paths
- guarantee blocked paths do not reach provider-facing prompt assembly or request rewrite

Out of scope:

- inventing or expanding entitlement business rules owned by DR-67
- changing successful-path billing behavior
- changing post-provider timeout billing behavior
- changing package format or runtime client behavior
- undoing DR-65 request-entry immutable snapshot loading

## Problem Statement

The DR-70 ticket direction matches the current R2 relay model. Earlier DR-70 review rounds identified stale pre-R2 wording in the modular PRD corpus; this implementation PR synchronizes the directly conflicting authority docs so review does not have to rely on exception text for entitlement, runtime authority, analytics scope, or `block_reason` coverage.

## Authority Hierarchy

For DR-70, the source-of-truth order is:

1. `docs/skill-marketplace/tasks/01_Functional_Requirements.md`
2. `docs/skill-marketplace/tasks/03_Data_Model_and_API_Spec.md`
3. `docs/skill-marketplace/tasks/04_Analytics_and_Operations.md`
4. `docs/skill-marketplace/tasks/05_Security_and_NFR.md`
5. `docs/skill-marketplace/tasks/06_Module_Breakdown_WBS.md`
6. `docs/skill-marketplace/tasks/07_CTO_PRD_Review_Action_Items.md`
7. current code contracts in `internal/skill/enums`, `internal/skill/errcodes`, `internal/skill/model`, `internal/skill/relay`, and `relay/compatible_handler.go`

`07_CTO_PRD_Review_Action_Items.md` is a consistency/governance document and may resolve drift, but it does not override first-order schema/runtime authorities unless it explicitly records a later approved correction.

Schema columns, event fields, enums, and error-envelope contracts are taken from `tasks/03`, with this PRD documenting the narrower DR-70 runtime/emission rules that sit on top of those shared schema contracts.

`CLAUDE.md` is useful engineering context for code-path and billing-hook reality, but it is not a product, schema, analytics, or runtime-behavior authority for DR-70.

## Authority Sync

This PR synchronizes the previously conflicting runtime wording in:

- `01_Functional_Requirements.md` for download-vs-execution entitlement
- `03_Data_Model_and_API_Spec.md` for the canonical `skill_blocked.block_reason` enum
- `04_Analytics_and_Operations.md` for execution analytics and billing-attribution scope
- `05_Security_and_NFR.md` for public routing/runtime authority and per-execution entitlement boundaries
- `06_Module_Breakdown_WBS.md` remains supporting product baseline context, not the first-order runtime/schema authority

Authority for DR-70 runtime behavior comes from:

- `01_Functional_Requirements.md` Section 3.4, the synced Section 4.6, and Sections 8-10
- `04_Analytics_and_Operations.md` Section 3 onward
- `05_Security_and_NFR.md` Section 5 and later runtime/NFR sections
- `06_Module_Breakdown_WBS.md` relay, blocked-event, and no-charge acceptance points

For DR-70, `tasks/01` runtime authority includes the relay execution journey plus the now-synced entitlement wording in Section 4.6, along with section 8 error/code mapping, section 9 event requirements, and section 10 acceptance.

## Locked Decisions

### D1. Timeout taxonomy split

- pre-injection timeout or gate-time timeout -> emit `skill_blocked` with `block_reason=timeout` and `error_code=SKILL_TIMEOUT`
- post-provider timeout -> emit or preserve `skill_timeout_error`; it is not reclassified as `skill_blocked`
- `block_reason=timeout` is reserved in DR-70 for request-entry, pre-provider, pre-injection timeout paths only

DR-70 does not collapse all timeout paths into one event family. This preserves the existing analytics taxonomy while honoring the ticket intent for pre-injection failures.

### D2. Meaning of "no prompt loaded/injected"

DR-65 already loads immutable version snapshot data at request entry. DR-70 therefore interprets the ticket wording operationally:

- allowed before block: request-entry snapshot binding, including loading `instruction_template` into in-memory relay context
- forbidden before block: provider-facing prompt assembly, request rewrite, or provider payload construction
- this does not mean the DR-65 entry-path snapshot bind never read `instruction_template` from storage

Required wording for DR-70 implementation and review:

`no provider-facing prompt assembly or request rewrite`

### D3. Pre-injection failure taxonomy

DR-70 interprets "any pre-injection failure" to include at least:

- `AUTH_REQUIRED`
- `SKILL_NOT_FOUND`
- `SKILL_NOT_PUBLISHED`
- `SKILL_NOT_ENABLED`
- `SKILL_PLAN_REQUIRED`
- `SKILL_SUBSCRIPTION_INACTIVE`
- `SKILL_QUOTA_EXCEEDED`
- `SKILL_KIDS_MODE_BLOCKED`
- `SKILL_CONTEXT_TOO_LONG`
- `SKILL_RATE_LIMITED`
- `SKILL_TIMEOUT` for request-entry timeout only

This is a unified pre-injection event contract, not a narrower list of only business-lock states.

### D3c. Skill-blocked activation predicate

`skill_blocked` is emitted only when the request is already classified as a Skill execution attempt.

That means at least one of the following is true:

- the request contains `deeprouter.skill_id`
- the package or runtime route supplies a skill identifier
- a skill-specific route has already selected or is attempting to select a skill execution context

Plain non-skill auth failures, malformed non-skill relay requests, and normal provider-routing auth failures do not emit `skill_blocked`.

### D3a. Canonical blocked-path mapping table

For DR-70, the following mapping is the documented canonical contract for blocked-event emission and must stay aligned with shared `internal/skill/errcodes` behavior:

| Stable error code | Canonical `block_reason` | DR-70 blocked-path status |
|---|---|---|
| `AUTH_REQUIRED` | `auth_required` | in scope |
| `SKILL_NOT_FOUND` | `skill_not_found` | in scope |
| `SKILL_NOT_PUBLISHED` | `skill_not_published` | in scope |
| `SKILL_NOT_ENABLED` | `skill_not_enabled` | in scope |
| `SKILL_PLAN_REQUIRED` | `plan_required` | in scope |
| `SKILL_SUBSCRIPTION_INACTIVE` | `subscription_inactive` | in scope |
| `SKILL_QUOTA_EXCEEDED` | `quota_exceeded` | in scope |
| `SKILL_KIDS_MODE_BLOCKED` | `kids_mode_blocked` | in scope |
| `SKILL_CONTEXT_TOO_LONG` | `context_too_long` | in scope |
| `SKILL_RATE_LIMITED` | `rate_limited` | in scope |
| `SKILL_TIMEOUT` | `timeout` | in scope only for pre-injection timeout |

This table remains the implementation-time canonical DR-70 mapping, and it must stay aligned with both the synced `tasks/03` enum text and the shared `errcodes` mapping.

### D3b. Explicit non-blocked or separate taxonomy

The following codes are not automatically part of the DR-70 `skill_blocked` taxonomy:

| Stable error code | Default taxonomy treatment | DR-70 rule |
|---|---|---|
| `SKILL_INTERNAL_ERROR` | operational failure | not `skill_blocked` unless a reviewed pre-injection `block_reason` mapping is added explicitly |
| `SKILL_SAFETY_VIOLATION` | safety-event taxonomy | post-generation or streaming-time safety remains outside `skill_blocked`; any pre-injection safety gate must either map explicitly to `safety_violation` or be marked out of scope with reviewer sign-off |
| `INVALID_REQUEST` and malformed skill-extension failures | request-validation taxonomy | not part of DR-70 `skill_blocked` unless the request has already been classified as a Skill execution attempt and an explicit stable mapping is added |

### D4. Billing invariant

Blocked requests must return before any provider execution or billing attribution path runs. DR-70 does not add billing compensation logic; it enforces an earlier return boundary so blocked requests create no `skill_billing_events` row.

DR-70 does not change quota reservation or compensation semantics; "no billing row" and "quota may still need compensation" are separate invariants.

### D4a. Analytics emission failure policy

If the `skill_blocked` analytics write fails:

- the API response preserves the original stable block `error_code`
- the analytics write failure is logged as an operational failure in this PR; metrics are follow-up work and not required for DR-70 acceptance
- it must not create a `skill_billing_events` row
- the normal successful-emission path remains the primary acceptance path; emission-write failure should be covered by a focused unit test when the writer has an injectable error seam

### D5. FR reference mismatch

The ticket cites `FR-G15`, but no current match exists in the modular `01_Functional_Requirements.md`. DR-70 must not claim that `FR-G15` was verified. The implementation should instead ground itself on:

- `01_Functional_Requirements.md` Section 3.4
- `01_Functional_Requirements.md` Sections 8-10
- relevant acceptance language in Analytics, Security/NFR, and WBS

PRD, PR description, and implementation notes must disclose honestly that the original ticket citation could not be verified in the current modular FRD.

### D6. Canonical enum alignment requirement

`tasks/03` now documents the canonical `block_reason` enum. DR-70 therefore requires:

- the shared executable mapping in `internal/skill/errcodes` must match the canonical table in this PRD
- the shared executable mapping in `internal/skill/errcodes` must stay aligned with the synced `tasks/03` enum
- any future taxonomy expansion must update `tasks/03`, this PRD, and the shared mapping together

If any of those three sources drift again, DR-70-style blocked analytics changes are not merge-ready until the authority docs are resynchronized or an explicit reviewer exception is granted.

### D7. Blocked-event schema and nullable contract

Blocked-event target contract:

- target table or stream: `skill_usage_events` with `event_type='skill_blocked'`
- `request_id`: required; generated before any auth-dependent gate if the inbound request did not already provide one
- `error_code`: required uppercase
- `block_reason`: required lowercase
- server timestamp: required; represented as event `timestamp` and persisted `occurred_at`
- `metadata.schema_version`: required and stamped centrally by the DR-74 persistence / `BeforeCreate` hook
- `skill_id`: use the request-supplied or route-supplied skill identifier when present; nullable only if the request was already classified as a Skill execution attempt but the identifier could not be extracted or resolved
- `skill_version_id`: nullable before version binding; required once request-entry binding resolves it
- `user_id` and `tenant_id`: nullable for `AUTH_REQUIRED` before identity resolution
- `entry_point`: required and must always be a real route-derived or request-derived value; DR-70 does not add `unknown` and does not use `null`
- for blocked emission, use `playground_picker` only when the direct TextHelper path was actually the source, `skill_package` only when the package/runtime path was actually the source, and the public-routing/distribute route value only when that route actually supplied it
- if no real `entry_point` can be determined for a blocked Skill execution attempt, do not emit `skill_blocked`; log the omission as an implementation limitation and disclose it in PR notes
- `metadata`: diagnostic-only allowlisted fields; never prompt text or provider payload

If current storage schema cannot represent these nullability rules, DR-70 must either document the required schema migration or narrow the blocked-event target for the affected path before merge.

## Proposed Implementation Shape

### D8. Emission owner and exactly-once boundary

Implementation lock:

- `Resolve()` and lower-level gates return stable errcodes; they do not directly emit analytics
- a single boundary helper, for example `abortSkillRelayBlocked(...)`, owns:
  1. `errCode -> block_reason` mapping
  2. `skill_blocked` emission
  3. request-scoped idempotency marker such as `ContextKeySkillBlockedEmitted`
  4. request-scoped `request_id` ownership and writer-failure recording
- direct `TextHelper` and distribute paths must both use this helper when aborting before provider-facing prompt rewrite
- if the helper sees the idempotency marker already set, it must not emit a second blocked event

Add one centralized pre-injection block helper that:

- accepts stable `error_code`
- derives canonical lowercase `block_reason` only through `internal/skill/errcodes`
- emits one `skill_blocked` event
- guarantees at most one `skill_blocked` emission per request, regardless of how many blocking checks observe the failure
- records omission or writer failure without changing the existing caller-owned API envelope

It must be wired only into paths that fail before provider-facing prompt assembly. DR-70 must preserve the code-path lock:

1. credential and public-routing validation
2. resolve-phase failures, including identity/auth, skill-not-found, and lifecycle or enabled gates already merged before prompt rewrite
3. resolve may bind immutable `SkillVersion` snapshot per DR-65; this is allowed and may populate `skill_version_id`
4. post-resolve, pre-`LoadAndApply()` failures such as DR-67 entitlement or quota, kids, context, rate, and request-entry timeout if present
5. only after these pass may provider-facing prompt rewrite, `LoadAndApply()`, and provider payload construction occur
6. provider routing and execution

## Acceptance Criteria

1. Every pre-injection blocked path returns the existing stable API `error_code`.
2. Every in-scope pre-injection blocked path with a resolvable real route-derived or request-derived `entry_point` emits exactly one `skill_blocked` event.
3. `skill_blocked.block_reason` is canonical lowercase enum text derived from shared mapping, not free-form text.
4. `skill_blocked.error_code` is the stable uppercase API code.
5. Blocked paths create zero `skill_billing_events` rows.
6. Resolve-phase blocked paths do not reach `LoadAndApply()`. `LoadAndApply()` failure paths must not produce a provider-facing rewritten request, provider payload, or provider call; if the failure maps into DR-70 taxonomy and has a real `entry_point`, it may emit `skill_blocked` before returning the stable error.
7. Pre-injection timeout emits `skill_blocked`; post-provider timeout remains `skill_timeout_error`.
8. Successful requests do not emit `skill_blocked`.
9. Blocked-event metadata excludes restricted prompt/provider payload content.
10. `skill_version_id` is included in the event when request-entry binding already resolved it.
11. `skill_version_id` may be null for blocked events that fail before version binding, for example auth failure or unknown skill ID.
12. Any unmapped pre-injection block code is a merge blocker for DR-70 until shared `errcodes` mapping is extended or the path is explicitly kept out of scope.
13. Post-provider timeout remains outside the `skill_blocked` family even if the stable API code is `SKILL_TIMEOUT`.
14. `DR-73` and `DR-90` dependency gaps, if any, are disclosed explicitly in the PR as blockers or staged dependencies.
15. All blocked-event nullable fields follow the documented schema contract for auth-failure and unknown-skill paths.
16. `skill_blocked` is emitted only for requests already classified as Skill execution attempts; plain non-skill auth or validation failures remain outside DR-70 analytics.
17. Analytics-emission failure preserves the original stable block `error_code` and is treated as an operational side failure, not a user-visible block-code rewrite.
18. If a Skill execution attempt is blocked before any real route-derived or request-derived `entry_point` can be determined, DR-70 does not emit `skill_blocked`; it logs the omission and the PR must disclose that the path is excluded by the no-schema-change `entry_point` decision.

## Test Plan

### Test group: blocked-path contract

Dataset or fixture scope:
relay request-entry failures before `LoadAndApply()`

Verification points / behavior scenarios covered:

- stable API error response
- `skill_blocked` event emitted
- canonical `block_reason` and uppercase `error_code`
- zero billing rows, proven in this PR structurally by early return before provider execution and billing-attribution hooks; direct DB-level row-count assertion remains dependency-gated by DR-90 boundary availability
- no provider-facing prompt assembly
- at most one blocked-event emission per request

Always required in DR-70 regardless of DR-67 gate availability:

- auth required
- skill not found
- unpublished/inactive lifecycle
- not enabled
- kids blocked, if current code has this pre-injection path
- context too long, if current pre-injection path exists
- rate limited, if current pre-injection path exists
- pre-injection timeout, if current pre-injection path exists

Required only after DR-67 gates exist:

- plan required
- subscription inactive
- quota exceeded

For every required blocked case that has a real route-derived or request-derived `entry_point`, the same assertion matrix must run:

- API `error_code` equals expected code
- exactly one `skill_blocked` row or event
- `block_reason` equals expected lowercase enum
- `error_code` equals expected uppercase code
- `skill_billing_events` count unchanged
- request body and provider payload not rewritten
- no provider call

For blocked cases without a real `entry_point`, assert:

- API `error_code` equals expected code
- no `skill_blocked` row or event
- `skill_billing_events` count unchanged
- request body and provider payload not rewritten
- no provider call
- omission log or metric is recorded

### Test group: event taxonomy non-regression

Dataset or fixture scope:
blocked paths versus post-provider timeout paths

Verification points / behavior scenarios covered:

- pre-injection blocked path emits `skill_blocked` and does not emit `skill_timeout_error`
- post-provider timeout path keeps `skill_timeout_error` and does not emit `skill_blocked`
- `block_reason=timeout` is used only on pre-injection timeout paths, never on post-provider timeout analytics rows
- `SKILL_INTERNAL_ERROR` does not silently backdoor into `skill_blocked` without an explicit reviewed mapping
- `SKILL_SAFETY_VIOLATION` follows the explicit in-scope or out-of-scope rule declared in this PRD
- malformed skill extension or `INVALID_REQUEST` stays outside `skill_blocked` unless a Skill execution attempt is already classified and an explicit mapping is added

### Test group: prompt-ordering invariant

Dataset or fixture scope:
requests that bind immutable version snapshot but fail before prompt rewrite

Verification points / behavior scenarios covered:

- request-entry snapshot loading may occur
- blocked path still never reaches provider-facing prompt assembly or request rewrite
- request body is not rewritten to provider-facing system-plus-last-user form
- no provider-facing sentinel template appears

### Test group: dependency-gated coverage

Dataset or fixture scope:
block paths that depend on tickets not fully merged yet

Verification points / behavior scenarios covered:

- if DR-67 gates do not exist yet, DR-70 test output and PR note do not claim plan, subscription, or quota blocked coverage
- if DR-73 or DR-90 contracts are incomplete, the PR note marks the exact blocker or staged dependency rather than pretending full compliance

### Test group: analytics-write failure policy

Dataset or fixture scope:
focused unit seam where blocked-event writer can be forced to fail

Verification points / behavior scenarios covered:

- original stable block `error_code` is still returned
- analytics write failure is recorded as an operational failure
- no `skill_billing_events` row is created
- no second or fallback `skill_blocked` write is emitted

## Phase 0 Discovery Findings

This section records the current code reality as of 2026-06-23 and is the implementation-entry baseline for DR-70.

### F1. `skill_usage_events.entry_point` cannot currently store `null` or `unknown`

Observed code:

- `internal/skill/model/skill_usage_event.go` makes `entry_point` `not null`
- the executable enum/check allows only:
  - `marketplace_card`
  - `skill_detail`
  - `my_skills`
  - `saved_list`
  - `playground_picker`
  - `featured`
  - `popular`
  - `new`
  - `recommended`
  - `admin_preview`
  - `search_results`
  - `skill_package`

Implication:

- the D7 wording `unknown or null` is not executable against the current schema
- DR-70 cannot emit a pre-classification auth-failure `skill_blocked` row with `entry_point=null`
- DR-70 also cannot emit `entry_point=unknown` unless the enum/schema is extended first

Locked decision:

- DR-70 does not add `entry_point=unknown`
- DR-70 uses no schema change for `entry_point`
- blocked events are written only when a real route-derived or request-derived entry point is available

### F2. Current nullable contract is partially supported already

Observed code:

- `skill_id`, `skill_version_id`, `user_id`, `tenant_id`, and `request_id` are nullable pointer fields in `SkillUsageEvent`
- the executable `block_reason` enum already includes:
  - `auth_required`
  - `skill_not_found`
  - `skill_not_published`
  - `skill_not_enabled`
  - `plan_required`
  - `subscription_inactive`
  - `quota_exceeded`
  - `kids_mode_blocked`
  - `context_too_long`
  - `rate_limited`
  - `timeout`
  - `safety_violation`
  - `internal_error`
  - `evaluation_not_passed`

Implication:

- D7 nullability for `skill_id`, `skill_version_id`, `user_id`, and `tenant_id` is structurally supportable today
- the synced doc enum in `tasks/03` now matches executable DR-70 runtime/schema reality for the in-scope blocked taxonomy

### F3. `metadata.schema_version` should be fixed to string `1.0`

Observed docs:

- `docs/skill-marketplace/tasks/04_Analytics_and_Operations.md` examples use `schema_version: "1.0"`
- `docs/skill-marketplace/tasks/06_Module_Breakdown_WBS.md` also references `schema_version='1.0'`

Implication:

- DR-70 should not leave `metadata.schema_version` open as `1` vs `"1"` vs `"1.0"`
- the initial locked value should be string `"1.0"` unless a wider analytics schema migration changes the global convention

### F4. Current code has two pre-provider owners but no shared blocked-event helper yet

Observed code:

- direct path: `relay/compatible_handler.go` `TextHelper(...)`
- distribute path: `middleware/skill_distributor.go` `prepareSkillRelayForDistribution(...)`
- both paths call `skillrelay.Resolve(...)`
- both paths can reach `skillrelay.LoadAndApply(...)`
- there is already a request-scoped context seam via `skillrelay.Get/Set(...)` for pinned skill context reuse

Implication:

- D8 is directionally correct, but the shared `abortSkillRelayBlocked(...)` helper does not exist yet
- exact-once blocked emission must be introduced at the relay boundary, not inside `Resolve()` itself

### F5. `AUTH_REQUIRED` currently happens before `Resolve()` creates request-scoped skill context

Observed code:

- `internal/skill/relay/resolver.go` returns `ErrAuthRequired` before producing a populated `SkillRelayContext`
- the current `RequestID` is generated inside `Resolve()` only on successful context creation

Implication:

- if DR-70 requires `request_id` for auth-failure blocked events, request ID generation must move earlier or be handled by the new blocked-event helper
- DR-70 cannot rely on successful `Resolve()` output for auth-failure analytics

Locked decision:

- `request_id` ownership belongs to the shared blocked helper
- if `SkillRelayContext` already exists, reuse `ctx.RequestID`
- if no `SkillRelayContext` exists yet, the helper generates a new `request_id`
- helper-generated `request_id` is for blocked-event and logging correlation only; it does not imply that `Resolve()` succeeded

### F6. No explicit pre-injection timeout seam was found in current relay path

Observed code review:

- no dedicated request-entry timeout path was found in `Resolve(...)`
- no dedicated timeout branch was found in `prepareSkillRelayForDistribution(...)`
- no dedicated pre-provider timeout branch was found in `TextHelper(...)` before provider execution
- existing timeout handling evidence is primarily post-provider / execution-side

Current DR-70 statement therefore becomes:

`No current pre-injection timeout path exists; timeout mapping is reserved and covered by mapping tests only until such a path is introduced.`

### F7. Current direct-path default entry point is `playground_picker`

Observed code:

- `TextHelper(...)` currently defaults skill relay entry point to `playground_picker`
- public routing path may override it through `ContextKeySkillRelayEntryPoint`
- explicit `deeprouter.entry_point` is validated when present

Implication:

- DR-70 must not silently reuse `playground_picker` for auth-failure blocked events unless that request path was actually the source
- route-derived entry point must be captured before any blocked-event emission if DR-70 narrows to real entry points only

## Phase 0 Executable Checklist

Phase 0 for DR-70 is complete only when the following decisions are recorded in the implementation PR or an immediately-following doc update.

1. Lock the pre-auth `entry_point` strategy.
   Decision:
   - no schema change
   - do not add `unknown`
   - emit `skill_blocked` only after a real route-derived or request-derived `entry_point` is available
   - if no real `entry_point` can be determined, skip emission, log the omission, and disclose it in PR notes

2. Lock `metadata.schema_version`.
   Decision:
   - DR-70 must not manually stamp `metadata.schema_version`
   - `metadata.schema_version = "1.0"` is stamped centrally by the DR-74 persistence / `BeforeCreate` hook
   - DR-70 tests verify blocked-event persistence behavior, but do not duplicate schema-version ownership

3. Add a single blocked-emission owner.
   Introduce one request-scoped helper at the relay boundary that:
   - accepts stable uppercase `error_code`
   - derives canonical lowercase `block_reason`
   - generates request ID when missing
   - writes `skill_blocked`
   - sets an idempotency marker so direct and distribute paths cannot double-emit

4. Decide request-ID ownership for `AUTH_REQUIRED`.
   Decision:
   - if `SkillRelayContext` already exists, use `ctx.RequestID`
   - if no `SkillRelayContext` exists, generate `request_id` inside the shared blocked helper
   - generated request ID is correlation-only and does not imply successful `Resolve()`

5. Confirm the current in-scope blocked taxonomy against executable code.
   Mapped in DR-70:
   - `AUTH_REQUIRED`
   - `SKILL_NOT_FOUND`
   - `SKILL_NOT_PUBLISHED`
   - `SKILL_NOT_ENABLED`
   - `SKILL_PLAN_REQUIRED`
   - `SKILL_SUBSCRIPTION_INACTIVE`
   - `SKILL_QUOTA_EXCEEDED`
   - `SKILL_KIDS_MODE_BLOCKED`
   - `SKILL_CONTEXT_TOO_LONG`
   - `SKILL_RATE_LIMITED`
   - `SKILL_TIMEOUT`
   Coverage note:
   - some mapped codes are dependency-gated or mapping-only until their live pre-provider blocked paths exist
   - mapping presence does not claim every code currently has a live production path

6. Add an analytics writer seam before claiming failure-path coverage.
   `skillmodel.EmitSkillUsageEvent(db, event)` currently calls `db.Create(...)` directly, so a focused write-failure test needs an injectable wrapper or equivalent seam.

7. Preserve the activation predicate.
   Only requests already classified as Skill execution attempts may emit `skill_blocked`; plain non-skill auth and validation failures stay out of DR-70 analytics.

8. Keep timeout wording honest in the PR.
   Decision:
   - keep `SKILL_TIMEOUT` as mapping-only until a real pre-injection timeout path exists
   - the PR must state that timeout coverage is mapping-only and not a live blocked-path branch test

9. Carry the checklist into the PR testing note.
   The PR test section must say which blocked branches were executed for real, which were dependency-gated, and which remained mapping-only because no current path exists.

## Execution Checklist

This section is the implementation-entry checklist for DR-70. Work should proceed in roughly this order so shared contracts land before path wiring and tests.

### Workstream 1. Shared `errcode -> block_reason` contract

Goal:
make one executable canonical mapping the only source used by DR-70 blocked emission.

Status:
done for helper-level mapping and focused tests; revisit only if the PRD canonical blocked table changes.

Tasks:

1. Audit current `internal/skill/errcodes` mapping against the DR-70 canonical table.
2. Keep `AUTH_REQUIRED`, `SKILL_NOT_FOUND`, `SKILL_NOT_PUBLISHED`, and `SKILL_NOT_ENABLED` in the always-required set.
3. Keep `SKILL_PLAN_REQUIRED`, `SKILL_SUBSCRIPTION_INACTIVE`, and `SKILL_QUOTA_EXCEEDED` behind current dependency-gated reality.
4. Keep `SKILL_TIMEOUT` mapping present but treat it as mapping-only until a real pre-injection timeout path exists.
5. Add or tighten focused mapping tests so any unmapped in-scope blocked code fails loudly.

### Workstream 2. `abortSkillRelayBlocked(...)` helper and idempotency marker

Goal:
create one relay-boundary helper that owns blocked-event analytics handling only.

Status:
done for helper-only implementation and focused tests; direct/distribute path wiring remains out of scope for this workstream.

Tasks:

1. Introduce a shared helper, for example `abortSkillRelayBlocked(...)`, at the relay boundary rather than inside `Resolve()`.
2. Make the helper own:
   - stable `error_code` intake
   - canonical `block_reason` derivation
   - blocked-event write attempt
   - request-scoped idempotency marker
   - request-scoped `request_id` ownership
   - omission and writer-failure recording
3. Add a request context marker such as `ContextKeySkillBlockedEmitted` so direct and distribute paths cannot double-emit.
4. Ensure lower-level gates and `Resolve()` continue returning stable errcodes only and do not emit analytics directly.
5. Keep API envelope ownership in the direct/distribute callers so existing stable error behavior remains unchanged.

### Workstream 3. `request_id` ownership inside the helper

Goal:
guarantee blocked-event and logging correlation even when `AUTH_REQUIRED` happens before successful `Resolve()`.

Status:
done for helper-level ownership and focused tests.

Completion notes:

1. Existing `SkillRelayContext` reuses `ctx.RequestID`.
2. No `SkillRelayContext` path generates `request_id` inside the blocked helper.
3. Duplicate helper calls do not regenerate `request_id`.
4. Helper-generated `request_id` is correlation-only.
5. Helper-generated `request_id` does not create or imply successful `SkillRelayContext` / `Resolve()`.

Tasks:

1. If `SkillRelayContext` already exists, reuse `ctx.RequestID`.
2. If no `SkillRelayContext` exists, generate `request_id` inside the shared blocked helper.
3. Keep helper-generated `request_id` correlation-only; do not let it imply successful `Resolve()`.
4. Add focused tests for both branches:
   - existing context request ID is reused
   - auth-failure path without context still gets a generated request ID for omission/event logging paths

### Workstream 4. Direct `TextHelper` path wiring

Goal:
wire the direct relay path into the shared blocked helper without inventing fake `entry_point` values.

Status:
done for current direct-path wiring and focused blocked/no-emit coverage.

Current progress:

1. direct `TextHelper` resolve-phase failures now call the shared blocked helper before returning the stable API error
2. direct `TextHelper` `LoadAndApply()` failures now call the shared blocked helper before returning the stable API error
3. focused integration tests cover:
   - `AUTH_REQUIRED` direct-path blocked emission
   - `SKILL_NOT_FOUND` direct-path blocked emission
   - `SKILL_NOT_PUBLISHED` direct-path blocked emission with preserved request-derived `entry_point`
   - invalid direct-path `entry_point` remains `INVALID_REQUEST` and does not emit
   - `LoadAndApply()` `INVALID_REQUEST` remains outside `skill_blocked`

Tasks:

1. Replace direct pre-provider blocked returns in `relay/compatible_handler.go` with the shared blocked helper where the request is already classified as a Skill execution attempt.
2. Preserve existing stable API `error_code` behavior.
3. Pass only real direct-path `entry_point` values:
   - `playground_picker` only when that path is actually the source
   - explicit request `deeprouter.entry_point` only when valid
4. If no real `entry_point` can be determined, skip `skill_blocked`, record omission, and keep the blocked API response unchanged.
5. Add focused tests for:
   - exactly-one blocked emission on direct path with resolvable `entry_point`
   - omission path when classification exists but no real `entry_point` is available

### Workstream 5. Distribute/public-routing path wiring

Goal:
wire the distribute path into the same helper and preserve exact-once behavior across preloaded context flows.

Status:
done for current distribute-path wiring and focused blocked/no-emit/omission coverage.

Current progress:

1. distribute `prepareSkillRelayForDistribution(...)` resolve-phase failures now call the shared blocked helper before returning the stable errcode
2. distribute `prepareSkillRelayForDistribution(...)` `LoadAndApply()` failures now call the shared blocked helper before returning the stable errcode
3. distribute path reuses only real route-derived `ContextKeySkillRelayEntryPoint` values and omits emission when no real route-derived value is available
4. focused tests cover:
   - route-derived `skill_package` blocked emission on unknown skill
   - `LoadAndApply()` `SKILL_INTERNAL_ERROR` remains outside `skill_blocked`
   - `LoadAndApply()` `INVALID_REQUEST` remains outside `skill_blocked`
   - omission when route classification exists but no real route-derived `entry_point` is available

Tasks:

1. Replace distribute-path pre-provider blocked returns in `middleware/skill_distributor.go` with the shared blocked helper where applicable.
2. Reuse route-derived `entry_point` from `ContextKeySkillRelayEntryPoint` or other route-owned source; do not backfill with fake defaults.
3. Ensure preloaded `SkillRelayContext` plus later `TextHelper` processing cannot double-emit.
4. Add focused tests for:
   - exactly-one blocked emission across distribute plus TextHelper flow
   - route-derived `entry_point` preservation
   - omission behavior when route classification exists but real `entry_point` still cannot be resolved

### Workstream 6. Event writer seam and analytics-write-failure tests

Goal:
make analytics write failure testable without changing blocked API behavior.

Status:
done for the current shared helper writer seam and focused direct/distribute failure-path coverage.

Current progress:

1. the shared blocked helper now has a test-only default writer override seam while production still uses the DB-backed writer path unchanged
2. focused direct-path coverage proves analytics-write failure keeps the original stable API error, emits no persisted blocked row, and does not retry
3. focused distribute-path coverage proves analytics-write failure keeps the original stable errcode, emits no persisted blocked row, and does not retry

Tasks:

1. Introduce an injectable writer seam around `skillmodel.EmitSkillUsageEvent(...)` or equivalent boundary wrapper.
2. Keep the default production path behavior unchanged.
3. Add focused failure-path tests proving:
   - original stable block `error_code` is still returned
   - no billing row is created
   - operational failure is logged; metrics remain follow-up work outside this PR
   - no duplicate blocked-event retry is emitted

### PR test-note requirements

When the implementation PR is opened, the test section must enumerate:

1. mapping tests that prove executable `errcode -> block_reason` coverage
2. direct-path blocked cases with real `entry_point`
3. distribute-path blocked cases with real `entry_point`
4. omission-path cases with no real `entry_point`
5. analytics-write-failure seam coverage
6. dependency-gated or mapping-only gaps, including current `SKILL_TIMEOUT`

## Follow-up Doc Guardrail

Keep these docs in lockstep for future blocked-runtime changes:

1. `tasks/01`, `tasks/04`, `tasks/05`, and `tasks/03` must stay aligned with the relay execution model
2. the documented `block_reason` enum must match the executable shared mapping
3. future entitlement/runtime-scope changes must update the authority docs in the same PR or carry an explicit reviewer exception
