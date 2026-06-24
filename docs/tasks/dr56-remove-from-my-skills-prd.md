# DR-56 — Remove from My Skills

Status: eval
Date: 2026-06-24
Ticket: DR-56

## Context

DR-55 made package download create a `user_enabled_skills` row, while DR-66 uses
that row's `enabled=true` state as one runtime eligibility input. A user-facing
"Disable Skill" action would therefore remove the Skill from My Skills and also
block already-downloaded packages at relay time, which is not the intended R2
D-09 behavior.

## Goal

Replace the account library action with "Remove from My Skills". Removing a Skill
only updates the My Skills library membership. It must not revoke or disable
already-downloaded package copies; runtime auth, lifecycle, plan entitlement,
quota, Kids policy, and runner credential checks remain responsible for blocking
execution.

## Scope

- Add backend state that separates My Skills visibility from runtime `enabled`
  eligibility.
- Add an authenticated remove endpoint for the current user's My Skills row.
- Update My Skills list and Marketplace availability to treat removed rows as
  absent from the user library.
- Update the My Skills UI copy/action from enable/disable language to remove
  language.
- Add focused model and handler regression tests proving removal does not flip
  `enabled=false`.

## Non-Goals

- No permanent execution grant is introduced.
- No package file deletion is attempted.
- No change to relay runtime authorization beyond preserving the existing
  `enabled=true` gate for previously downloaded copies.
- No admin-side skill lifecycle changes.

## Acceptance Criteria

- `DELETE /api/v1/marketplace/my-skills/:id` removes the Skill from My Skills for
  the authenticated user.
- Removed Skills no longer appear in `GET /api/v1/marketplace/my-skills`.
- The same row remains `enabled=true`, so already-downloaded packages continue to
  pass the existing enabled-state gate until another runtime auth/entitlement
  check blocks them.
- Re-downloading the package restores the Skill to My Skills.
- Tests cover remove idempotency, My Skills filtering, and the runtime-gate
  preservation invariant.

## Verification

Recorded in `docs/test-results/dr56-remove-from-my-skills.txt`.
