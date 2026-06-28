# DR-87 Paywall Upsell UI PRD

**Status:** eval
**Ticket:** DR-87
**Date:** 2026-06-29

## Context

DR-100 added the backend $2 one-time Skill purchase path and durable entitlement.
Locked Marketplace Skills still show a generic upgrade/download flow instead of a
conversion surface that explains the one-time unlock and PLUS upsell.

Owner copy direction: "$2 USD 单买永久解锁 / 或 PLUS $19.9/月 全 6 skill / $2
几乎免费试，一辈子 ROI / 升级 PLUS".

## Goals

1. Locked Skill cards and detail pages show the concrete $2 unlock price and a
   PLUS alternative.
2. The unlock modal compares "$2 解锁本个 (永久)" with "PLUS $19.9/mo unlocks all
   6" and includes ROI/almost-free framing.
3. The pricing page renders Free, PLUS, and per-Skill $2 tiers.
4. Paywall funnel events are attributable with `entry_point=paywall` across
   impression, click/detail, and purchase conversion.
5. Successful purchase state gives the user a clear continue/download path.

## Non-Goals

- No new payment provider integration.
- No subscription checkout backend for PLUS in this ticket; PLUS CTA routes to
  the pricing/subscription surface.
- No changes to DR-100 wallet debit semantics or one-time entitlement storage.
- No new finance reconciliation dashboard.

## Product Contract

- One-time unlock uses the existing DR-100 endpoint:
  `POST /api/v1/marketplace/skills/{id}/purchase`.
- The frontend sends a generated idempotency key and `entry_point=paywall`.
- Backend purchase analytics must persist `skill_purchased` with
  `entry_point=paywall` when provided.
- Paywall modal opening records `skill_impression` with `entry_point=paywall`.
- Paywall detail/click intent records `skill_detail_view` with
  `entry_point=paywall`.

## Acceptance

- Locked Skill cards show "$2" plus "Unlock $2" and "Get PLUS" choices.
- Detail page plan locks open the same modal instead of only showing a generic
  error.
- Modal presents the side-by-side $2 vs PLUS value compare, ROI copy, and PLUS
  CTA.
- Pricing page visibly includes Free, PLUS $19.9/mo, and per-Skill $2 tiers.
- Successful purchase invalidates Marketplace Skill queries and shows a continue
  state so the user can download/use the unlocked Skill.
- Focused backend and frontend tests cover paywall attribution and core UI copy.

## Evaluation Notes

- Backend accepts `entry_point=paywall` for Marketplace impression/detail events
  and purchase conversions.
- Frontend Marketplace cards show dual paywall CTAs only for buyable plan locks
  (`upgrade`/`renew`), preserving unavailable/login/sales-only locked states.
- Pricing page renders Free, PLUS, and per-Skill unlock tiers above the model
  catalog.
- Focused and related regression tests passed; details recorded in
  `docs/test-results/dr87-paywall-upsell-ui.txt`.
