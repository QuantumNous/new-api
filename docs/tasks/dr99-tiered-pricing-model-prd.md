# DR-99 Tiered Skill Pricing Model PRD

Status: eval
Ticket: DR-99
Ref: NEW-17 gap review 2026-06-28
Date: 2026-06-29

## Context

The Skill Marketplace has lifecycle, download, runtime entitlement, one-time
purchase, and analytics foundations, but the product pricing vocabulary is still
split across the older `free/pro/enterprise` plan hierarchy and the newer owner
requirement: Basic by default, USD 2 one-time permanent single-Skill unlocks,
and PLUS at USD 19.90 per month unlocking all six Skills including
PLUS-exclusive versions.

DR-99 defines the shared tier matrix that DR-67 runtime checks, DR-81 download
checks, DR-100 one-time purchases, and DR-89/129 analytics attribution consume.

## Goals

- Define plan tiers:
  - Basic: default/free account tier; may download free Skills and buy paid
    single Skills for USD 2 permanent unlocks.
  - PLUS: USD 19.90/month; while active, grants all Skills including
    PLUS-exclusive Skills.
- Define Skill monetization tiers:
  - `free`: Basic and PLUS may download/use when otherwise enabled.
  - `one_time`: Basic may use only after a durable one-time entitlement; PLUS
    may use while active; one-time ownership remains after PLUS expiry.
  - `plus_exclusive`: PLUS only while active.
- Preserve existing storage fields where possible by mapping Basic to
  `required_plan=free` and PLUS to `required_plan=pro`.
- Add a reusable entitlement matrix function used by download and runtime paths.
- Add configurable USD 2 credit metadata for PLUS upgrades without implementing
  a checkout UI.
- Emit resolved plan and skill monetization tier on analytics/billing events.

## Non-Goals

- No new public checkout UI for PLUS.
- No payment provider integration changes.
- No six-Skill catalog seeding changes beyond preserving current seed behavior.
- No per-use token markup settlement changes.

## Product Contract

Basic is the default plan for users without an active PLUS subscription. PLUS is
represented by an active subscription whose upgrade group resolves to the paid
Skill plan. Existing `required_plan=pro` rows are treated as PLUS-required for
Skills; `enterprise` remains supported as a higher internal/operator-only tier.

The canonical entitlement decision must evaluate both `required_plan` and
`monetization_type`:

| User state | `free` Skill | `one_time` Skill | `plus_exclusive` Skill |
|---|---|---|---|
| Basic, no purchase | allowed | locked: purchase required | locked: PLUS required |
| Basic, one-time owner | allowed | allowed | locked: PLUS required |
| Active PLUS | allowed | allowed | allowed |
| Expired PLUS, no purchase | allowed | locked: purchase required | locked: subscription inactive |
| Expired PLUS, one-time owner | allowed | allowed | locked: subscription inactive |

One-time purchases cost USD 2.00 and grant durable ownership of that Skill. The
ownership grant survives PLUS expiry and does not grant PLUS-exclusive Skills.

When enabled, `one_time_credit_toward_plus` lets billing/checkout code apply the
user's prior USD 2 purchase toward the first PLUS upgrade. DR-99 exposes the
calculation/config primitive and emits attribution metadata; payment application
is owned by the checkout ticket.

## Acceptance

- Download and runtime checks share the same tier matrix.
- Basic can download/use free Skills, and can download/use `one_time` Skills
  only after a durable USD 2 ownership grant.
- Active PLUS can download/use every Skill tier.
- PLUS expiry revokes `plus_exclusive` and non-owned `one_time` access, but keeps
  USD 2-owned `one_time` access.
- The USD 2 credit helper returns a credit only when configured on and the user
  has at least one one-time entitlement.
- `skill_enabled`, `skill_purchased`, `skill_used`, and blocked Skill events
  include resolved user plan and monetization/tier metadata for attribution.
- Meaningful tests cover the matrix, download/runtime enforcement, credit helper,
  and event metadata.
