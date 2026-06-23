# DR-78 Growth Surfaces PRD

Status: ship
Ticket: DR-78
Date: 2026-06-23
Module: M13 light demo
Refs: tasks/06 M13; tasks/01 FR-P8; DR-62; DR-73

## Problem

The Skill Marketplace has runtime, download, and analytics foundations, but the
demo build still lacks lightweight product guidance surfaces that bring users
from an empty or first-run state into skill discovery. Product needs at least a
new-Skill notification and Playground recommendation live, with entry-point
attribution so guidance -> enable -> use conversion can be measured.

## Scope

- Add a Playground empty-state recommendation for a published Skill.
- Add a first-run/onboarding-style pointer from the app shell into the Skill
  Marketplace.
- Add an in-app new-Skill banner on the Marketplace surface.
- Instrument recommendation/new guidance as Skill usage analytics events using
  `entry_point=recommended` and `entry_point=new`.
- Keep instrumentation privacy-safe: no prompt text, no instruction templates,
  no raw messages, and only white-listed event/entry-point values.

## Non-Goals

- No full recommendation-ranking service.
- No creator or user-generated Skill flows.
- No new pricing, entitlement, or runtime execution behavior.
- No change to package runtime `entry_point=skill_package`.

## UX Requirements

- Playground empty state shows a compact Marketplace recommendation when at
  least one published Skill is available.
- Marketplace shows a restrained new-Skill banner based on the newest published
  Skill returned by the list API.
- First-run pointer is dismissible and stored locally so it does not keep
  reappearing.
- Guidance uses existing Marketplace cards/buttons where possible and follows
  `docs/DESIGN.md` canonical tokens.

## Data Requirements

- The frontend records:
  - `skill_impression` with `entry_point=recommended` for the Playground
    recommendation.
  - `skill_detail_view` or `skill_enabled` follow-on events must preserve the
    same `entry_point` when the action starts from recommended/new guidance.
  - `skill_impression` with `entry_point=new` for the in-app new-Skill banner.
- Backend event ingest accepts only a narrow impression/detail event set for
  public Marketplace surfaces and only `recommended`, `new`,
  `marketplace_card`, `skill_detail`, and `search_results` entry points.
- Download keeps emitting the single `skill_enabled` event and accepts the
  originating `entry_point` for guidance surfaces.
- Event metadata remains `{}` for MVP.

## Acceptance

- New-Skill notification is visible on Marketplace and emits `entry_point=new`.
- Playground empty-state recommendation is visible and emits
  `entry_point=recommended`.
- CTA/download actions from these surfaces can pass the originating
  `entry_point` to analytics.
- Focused backend and frontend tests cover the event whitelist and visible
  guidance behavior.
