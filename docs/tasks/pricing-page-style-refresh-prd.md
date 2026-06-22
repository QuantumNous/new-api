# Pricing Page Style Refresh PRD

Status: build
Date: 2026-06-22

## Context

The public `/pricing` page is a high-intent evaluation surface. It currently works functionally, but the visual style leans toward a generic gradient hero and does not fully match `docs/DESIGN.md` canonical guidance: warm cream canvas, soft-white operational panels, charcoal typography, and AI-blue used as an accent.

## Goal

Refresh `/pricing` into a calmer pricing workbench that feels precise, trustworthy, and easier to scan while preserving the existing search, filters, table/card views, and model detail drawer.

## Scope

- Rework the page hero into an operational summary area.
- Replace decorative gradient treatment with restrained cream/soft-white panels.
- Improve quick model-use hints with icon-led rows rather than emoji text.
- Align the pricing toolbar and filter sidebar with the canonical panel treatment.
- Keep all pricing data, filtering logic, routing, and model detail behavior unchanged.

## Non-goals

- No backend pricing changes.
- No new pricing plans or commercial logic.
- No changes to model catalog data, billing expressions, or admin model pricing UI.

## Acceptance

- `/pricing` keeps loading the same pricing data and supports search/filter/sort/view mode interactions.
- The first viewport communicates model count, pricing transparency, and common use-case choices.
- The design avoids large blue/purple gradients and follows `docs/DESIGN.md` §0-5.
- Frontend typecheck/build passes or any verification blocker is documented.
