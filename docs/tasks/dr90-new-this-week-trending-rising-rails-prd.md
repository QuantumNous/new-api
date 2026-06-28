# DR-90 New This Week + Trending Rails PRD

Status: eval
Ticket: DR-90
Date: 2026-06-29
Module: M13 discovery
Refs: NEW-13 gap review 2026-06-28; DR-73; DR-75; DR-78; DR-166

## Problem

The Marketplace has a generic list, featured ordering, and a DR-78 new-Skill
banner, but fresh Skills and fast-rising Skills do not have dedicated discovery
surfaces. Absolute popularity can over-reward already-large Skills, so the
Trending surface must rank by recent growth velocity instead of lifetime volume.

## Scope

- Add a "New this week" rail containing published Skills whose `published_at`
  is within the last 7 days, newest first.
- Add a "Trending" rail ranked by recent download/usage growth rate, not
  absolute event volume.
- Exclude deprecated and archived Skills from both rails.
- Instrument rail impressions/detail clicks with `entry_point=new_week` and
  `entry_point=trending`.
- Show the rails on the existing Marketplace surface without changing runtime
  execution, package download, pricing, or entitlement behavior.

## Non-Goals

- No personalized recommendation model.
- No new analytics table or materialized job.
- No change to `entry_point=skill_package` for package runtime execution.
- No exposure of prompts, instruction templates, raw messages, or provider
  payloads in discovery APIs.

## Functional Requirements

- `New this week` uses server-side time filtering against `published_at` and
  includes only rows with `status=published`.
- `Trending` uses safe Skill analytics events. MVP ranking compares the last 7
  days of successful enable/use events against the preceding 7 days and sorts by
  growth rate, with a small-count cap so a low baseline can surface without
  allowing a single noisy event to dominate forever.
- Skills with zero recent activity are not returned by Trending.
- Public responses reuse the existing Marketplace list shape and availability
  resolver.
- Rails remain compact, responsive, and consistent with `docs/DESIGN.md` tokens.

## Acceptance

- New-this-week returns only Skills published within the last 7 days, newest
  first, and excludes deprecated/archived rows.
- Trending ranks by growth rate so a smaller fast-rising Skill can outrank a
  larger flat Skill, and excludes deprecated/archived rows.
- Marketplace rail impressions and detail clicks are accepted and persisted with
  `entry_point=new_week` and `entry_point=trending`.
- Focused backend and frontend tests cover filtering, ranking, UI rendering, and
  event attribution.
