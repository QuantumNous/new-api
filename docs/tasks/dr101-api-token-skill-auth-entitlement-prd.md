# DR-101 API Token Skill Auth + Entitlement PRD

Status: ship
Ticket: DR-101
Ref: NEW-8 gap review 2026-06-28

## Context

Skill package distribution and execution now have two acquisition paths:
browser/JWT-style marketplace sessions and normal DeepRouter API tokens. The
download route currently resolves browser session or platform access-token users,
while the public routing endpoint already authenticates DeepRouter API tokens but
records Skill package execution as `skill_package`.

DR-101 makes DeepRouter API tokens a first-class identity and entitlement
principal for both package download and package execution, without weakening the
existing session/JWT path.

## Goals

- Accept a valid DeepRouter API token on:
  - `GET /api/v1/marketplace/skills/{id}/download`
  - `GET /api/v1/marketplace/skill-versions/{skill_version_id}/download`
  - `POST /v1/routing/chat/completions`
- Resolve the token to its owning user/tenant and current group/plan.
- Enforce the same Skill entitlement decisions as existing flows:
  - download plan hierarchy
  - runtime enabled-state and use-time subscription/plan checks
  - token revocation/expiry/quota and DR-82 abuse controls on public routing
- Emit Skill analytics with `entry_point=api_token` for API-token package
  download/run paths.
- Preserve existing JWT/session marketplace behavior and error codes.

## Non-Goals

- No new monetization model, one-time purchase ledger, or quota bank.
- No frontend changes.
- No API-token creation/onboarding UI copy changes; DR-101 only keeps the backend
  compatible with the DR-84 token onboarding path.
- No relaxation of token model limits, token group restrictions, or public routing
  abuse controls.

## Design

1. Add `api_token` to the Skill `EntryPoint` enum, DB CHECK expressions, and docs.
2. Extend Skill download auth with a DeepRouter API-token fallback:
   - validate through the same `model.ValidateUserToken` path used by relay;
   - load the owning user cache;
   - fail closed for disabled users, revoked/expired/exhausted tokens, token group
     outside the user's usable groups, or deprecated token groups;
   - set the same user/group context fields consumed by the download entitlement
     code;
   - mark the request as API-token authenticated.
3. Download handlers force successful API-token downloads to
   `entry_point=api_token`; session/JWT paths keep the existing
   `skill_package`/`new`/`recommended` behavior.
4. Public routing forces Skill execution entry point to `api_token` after
   `TokenAuth`, before DR-82 abuse controls and distribution.
5. Successful and blocked Skill execution events keep using the shared event
   writers; the new entry point is only an enum/schema expansion plus route auth
   context.

## Acceptance

- Valid API token with sufficient entitlement downloads a free/pro/enterprise Skill
  and writes `skill_enabled.entry_point=api_token`.
- Valid API token without entitlement is blocked with the same Skill error code as
  web/session download.
- Public routing Skill execution under an API token emits successful and blocked
  Skill events with `entry_point=api_token`.
- JWT/session download path remains unchanged.
- Token revocation, expiry, quota exhaustion, user disabled state, token group
  restrictions, and DR-82 abuse checks remain fail-closed.

## Verification

- Focused download auth/event tests in `internal/skill/handler` and
  `middleware`.
- Focused relay entry-point tests in `middleware` and `internal/skill/relay`.
- Related Skill package regression with coverage for `internal/skill/...`,
  `middleware`, and `router` as appropriate.

## Review Notes

After rebasing onto current `origin/main`, focused DR-101 tests, related
Skill/middleware/router regression tests, and the full Go suite pass. The earlier
full-suite `relay/helper` panic did not reproduce after the rebase.
