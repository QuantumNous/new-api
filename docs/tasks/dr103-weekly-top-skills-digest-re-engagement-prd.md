# DR-103 Weekly Top-Skills Digest + Re-Engagement PRD

Status: eval
Ticket: DR-103
Date: 2026-06-29
Module: M13 growth outbound
Refs: NEW-15 gap review 2026-06-28; NEW-10; NEW-13; NEW-14; DR-78; DR-97; DR-100

## Problem

DeepRouter has in-app Marketplace growth surfaces and personalized Skill
recommendations, but returning users do not yet receive an outbound weekly
summary or targeted nudges when a saved/downloaded Skill becomes relevant again.
The growth loop needs privacy-safe notification generation, consent suppression,
and analytics attribution so sends, opens, and clicks can be measured.

## Scope

- Generate a weekly per-user "Top Skills this week" digest from published Skills
  ranked by top downloaded, new, and trending signals.
- Personalize digest ordering with the same lightweight category affinity used
  by DR-97: a user's enabled/used Skill categories receive a ranking boost.
- Suppress all outbound digest and re-engagement notifications unless the user
  has explicit marketing/growth consent.
- Add re-engagement notification candidates for:
  - saved/downloaded `one_time` Skills when a discount/promo snapshot is passed
    by the caller;
  - enabled Skills the user has not used recently.
- Track notification sends, opens, and clicks in `skill_usage_events` with
  `entry_point=digest` or `entry_point=reengage`.
- Keep notification event metadata privacy-safe: no prompt text, instruction
  template, raw messages, or provider payload.

## Non-Goals

- No external ESP integration, cron scheduler, or admin UI in this ticket.
- No ML ranking model.
- No new Skill pricing engine or persistent promo table.
- No new saved/bookmark data model beyond existing downloaded/enabled Skills.
- No frontend notification preference UI changes; existing profile
  `marketing_emails` consent is the opt-in source for this backend layer.

## Product Contract

The backend exposes a service layer that schedulers, jobs, or admin tooling can
call. It returns structured results even when the actual notification transport
is not configured, and it writes privacy-safe analytics only when a notification
is accepted for send.

An opted-in user is one whose `model.User.Setting` has
`marketing_emails=true`. Users without this value, users with malformed settings,
and users who later opt out are suppressed for all digest and re-engagement
flows.

Digest candidate groups:

- `top_downloaded`: Skills with the most `skill_enabled` events in the weekly
  window.
- `new`: recently published Skills in the weekly window.
- `trending`: Skills with week-over-week enablement growth.

Re-engagement entry points:

- `digest`: weekly digest send/open/click attribution.
- `reengage`: saved-discount and lapsed-usage send/open/click attribution.

## Acceptance

- Opted-in users receive generated weekly personalized digest payloads and send
  analytics; opted-out users are suppressed with no send analytics.
- Saved/downloaded Skill promo inputs generate re-engagement notifications for
  opted-in users only.
- Lapsed enabled Skills generate a "continue using" re-engagement notification
  when `last_used_at` is older than the configured threshold.
- Open/click tracking accepts only `digest` and `reengage` entry points and
  writes privacy-safe analytics events.
- Focused tests cover digest ranking, opt-out suppression, saved-discount,
  lapsed-usage, and open/click event recording.
