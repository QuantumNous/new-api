# DR-73 Skill Package Entry Point PRD

Status: eval
Ticket: DR-73
Date: 2026-06-21

## Problem

R2 Skill execution moved from an in-platform Playground picker concept to downloaded Skill packages that call the public routing API. P0 lifecycle analytics must keep emitting the launch events, but new execution flows need a primary entry value that dashboards can slice without conflating current package runs with historical Playground runs.

## Scope

- Keep `skill_package` as a valid `skill_usage_events.entry_point` value.
- Treat `skill_package` as the primary entry point for new Skill package execution and package-download enablement flows.
- Keep `playground_picker` valid only so historical rows and legacy payloads still parse.
- Align the canonical Data/API `entry_point` enum, analytics docs, and Go enum constants.
- Update docs and samples so new P0 lifecycle examples use `entry_point=skill_package`.

## Non-Scope

- Building the full server-side Skill runner or billing execution path.
- Removing historical `playground_picker` support from storage, parsing, or dashboards.
- Adding user-visible UI.

## Acceptance

- New run samples and implementation guidance tag execution events with `entry_point=skill_package`.
- Analytics docs and enum docs expose `skill_package` so dashboards can slice the value.
- Legacy `playground_picker` remains a valid enum value and is covered by tests.
