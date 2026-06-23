# DR-71 Non-Skill API Compatibility Regression Guard PRD

Status: eval
Owner: DeepRouter
Ticket: DR-71
Phase: 1
Module: M05
Updated: 2026-06-23

## Scope

Add a regression guard ensuring the Skill relay path is entered only when
`deeprouter.skill_id` is present. Existing relay requests that do not carry
`skill_id` must keep using the legacy path without request-body or smart-router
behavior changes.

## Requirements

- A request with no `deeprouter` field must not resolve, load, or store a Skill
  relay context.
- A request with no `deeprouter.skill_id` must not use Skill relay model
  selection or instruction-template rewrite.
- The normal OpenAI-compatible upstream request body for non-Skill chat
  completions must match the legacy converted body exactly.
- Smart-router context and headers remain untouched for direct non-Skill
  requests.

## Non-Goals

- Change smart-router routing behavior.
- Change public Skill routing API behavior.
- Change provider conversion, model mapping, billing, or quota semantics.

## Acceptance

- Requests without `skill_id` behave exactly as before.
- Skill relay context is not set for normal requests.
- Captured upstream provider payload for a normal request equals the expected
  legacy payload.
- Focused regression test passes.
