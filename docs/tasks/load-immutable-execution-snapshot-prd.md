# Load Immutable Execution Snapshot PRD

- Status: build
- Owner: DeepRouter Backend
- Ticket: DR-65
- Phase: 1 / Module M05
- Depends on: DR-41, DR-64

## 1. Problem

Relay request entry already resolves `skill_id` into a server-trusted skill identity, but execution still needs a hard contract for which `skill_version` is bound to the request. Without that contract, downstream code can drift to mutable skill state, or a mid-flight version activation can cause the same request to observe different execution metadata.

## 2. Goal

At relay request entry, bind exactly one active `skill_version` for the requested `skill_id`, load its immutable execution snapshot fields into `SkillRelayContext`, and require all downstream code in the same request to consume that bound snapshot instead of re-querying the active version.

## 3. Non-goals

- Do not broaden lifecycle policy from published-only to deprecated-capable execution in DR-65.
- Do not implement entitlement, enablement, prompt assembly, model whitelist enforcement, or monetization enforcement in this ticket.
- Do not introduce new DR-65-specific error codes.

## 4. Scope Lock

1. DR-65 only binds the immutable active `skill_version` snapshot at relay request entry.
2. DR-65 keeps the existing `skills.status = published` relay guard.
3. Deprecated runtime behavior stays out of scope unless a prior merged same-entry gate already proves enabled-state plus current entitlement and ships with explicit tests.
4. DR-65 must fail closed for:
   - missing `active_version_id`
   - missing pointed `skill_version`
   - pointed `skill_version` not `active`
   - empty or whitespace-only `instruction_template`
5. Downstream code must treat `SkillRelayContext.SkillVersion` as the immutable execution snapshot for the request and must not re-query the active version in the same request.

## 5. Requirements

### 5.1 Request-entry binding

- Resolver reads the trusted `skill_id` selected at relay entry.
- Resolver loads the `skills` row and confirms `skills.status = published`.
- Resolver reads `skills.active_version_id` and blocks if it is `nil`.
- Resolver loads exactly one pointed `skill_versions` row where:
  - `id = skills.active_version_id`
  - `skill_id = skills.id`
  - `status = active`

### 5.2 Snapshot payload

The request-scoped execution context must include:

- `skill_version_id`
- `instruction_template`
- `model_whitelist_snapshot`
- `required_plan_snapshot`
- `monetization_snapshot`
- `max_input_tokens_snapshot`

### 5.3 Immutability contract

- The selected `skill_version` is frozen for the lifetime of that request.
- If another request activates a newer version mid-flight, the already-returned context must still reference the original version and fields.
- Downstream code must not resolve `active_version_id` again once `SkillRelayContext` exists.

### 5.4 Failure mapping

- Reuse the existing resolver error mapping:
  - `SKILL_NOT_FOUND` for unknown skill
  - `SKILL_NOT_PUBLISHED` for blocked lifecycle / missing runnable active version
  - `SKILL_INTERNAL_ERROR` for internal invariant failures such as an empty bound template

## 6. Acceptance

- Execution binds `skill_version_id` selected at request entry.
- Snapshot fields are loaded into `SkillRelayContext`.
- Published-only guard remains unchanged in DR-65.
- Inactive / archived / draft pointed versions are never used.
- Empty or whitespace-only `instruction_template` fails closed.
- A test proves a request keeps the original snapshot even after `active_version_id` is changed mid-flight.

## 7. Verification

Required focused checks:

- `go test ./internal/skill/...`
- `go test ./relay/...`

Required resolver coverage:

- published + active pointed version -> success
- non-published skill -> blocked
- nil `active_version_id` -> blocked
- pointed version missing -> blocked
- pointed version draft -> blocked
- pointed version inactive -> blocked
- pointed version archived -> blocked
- empty `instruction_template` -> blocked
- whitespace-only `instruction_template` -> blocked
- client-supplied different `skill_version_id` ignored
- snapshot fields asserted one by one
- active version changes after `Resolve` -> returned context remains bound to original snapshot
