# DR-57 Marketplace List UI PRD

Status: eval
Ticket: DR-57
Date: 2026-06-22

## Problem

Users need a first Marketplace surface that lets them discover official Skills and understand whether each Skill is usable now, locked by entitlement, or unavailable. DR-52 provides the list API foundation, while DR-73 defines the analytics entry-point contract for impression and detail events.

## Scope

- Build the Marketplace header, search, category filter, plan filter, status filter, and conditional Kids Safe filter.
- Render a stable results grid of Skill Cards with no layout shift between loading and loaded states.
- Apply the Marketplace state matrix from `docs/skill-marketplace/tasks/02_UX_Design.md` §4.1.4 for card CTA selection: Enable, Use, Upgrade, Renew, Contact sales, and Log in.
- Show search, category, Kids, feature-disabled, load-error, and empty-catalog empty states from §4.1.5.
- Fire `skill_impression` when cards become visible and `skill_detail_view` when a card is opened, using `entry_point=marketplace_card`.
- Preserve DR-52 compatibility by sending supported list filters and gracefully deriving UI state when personalized availability is absent.

## Non-Scope

- Building the full Skill Detail page.
- Implementing standalone enable/disable APIs beyond the existing download-as-enable route.
- Building recommendation rails, ratings, save/favorite, or P1 analytics dashboards.
- Changing subscription entitlement backends.

## Acceptance

- Cards show plan, availability status, Kids badges when enabled, and correct CTA for anonymous, Free, Pro, Enterprise, expired, quota, and Kids lock states when those states are present in the API response.
- Search and filters update the results without resizing cards or causing skeleton/content layout shift.
- Empty states match search/filter/Kids/feature-disabled/load-error/no-catalog scenarios.
- `skill_impression` fires once per visible card per filter result set, and `skill_detail_view` fires when the card is opened.
- Focused frontend tests cover filter behavior, CTA derivation, empty state selection, and analytics firing.

## Dependencies

- DR-52 Marketplace list API.
- DR-61 plan/subscription entitlement surface.
- DR-73 analytics entry-point contract.
