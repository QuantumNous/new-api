---
name: design-system
description: >-
  DeepRouter visual design system — MANDATORY for any UI / frontend / visual
  change in web/default. Use whenever you create or edit React components, pages,
  CSS, Tailwind classes, colors, typography, spacing, buttons, inputs, badges,
  cards, modals, layout, hero/marketing sections, or any user-visible surface.
  Loads the canonical color tokens, type scale, component specs, and the hard
  "do not" rules from docs/DESIGN.md so the change matches the brand instead of
  drifting into a generic enterprise look.
---

# DeepRouter Design System (enforced)

**Canonical source:** [`docs/DESIGN.md`](../../../docs/DESIGN.md). Visual board:
`docs/brand/index.html`. CSS reference: `docs/brand/deeprouter-brand.css`.
Brand PRD: `docs/DeepRouter-PRD-brand.md`.

> ⚠️ DESIGN.md is layered. **§0–5 is canonical** (Plus Jakarta Sans, 7px radius,
> the `:root` token map). **§6–9 is "Historical Inspiration"** — it references an
> older "Camera Plain" font, 6px radius, and negative letter-spacing that
> **contradict** the canonical part. On any conflict, **§0–5 wins.** Don't copy
> the Camera Plain / negative-tracking specifics from §7/§9 into production.

This skill is the gate for **any change a user can see** in `web/default/`. Read
it before writing the component; match these tokens exactly; prefer existing
Tailwind/theme tokens and the `.dr-*` classes over one-off hex.

## Non-negotiables (the rules people break)

1. **Cream is the canvas, never pure white.** Page background `#F7F4ED`. Raised
   surfaces (cards, inputs, popovers, modals) use Soft White `#FCFBF8`. A
   `#FFFFFF` full-page background is wrong.
2. **Charcoal, not black.** Text & dark buttons use `#1C1C1C`, secondary text `#5F5F5D`.
3. **Borders, not shadows, contain cards.** Use a `#ECEAE4` border. Avoid heavy box-shadows.
4. **AI Blue `#2563FF` is an accent, not décor.** Use it for primary AI action,
   focus ring, selected state, routing lines, charts — never as a large
   background, gradient, glassy orb, or blue-purple wash.
5. **Two weights only: 400 (body/UI) and 600 (headings).** No 700/bold. Hierarchy
   comes from size + spacing, not weight.
6. **Normal letter-spacing in product UI.** (The negative-tracking advice is from
   the historical §7/§9 — ignore it for canonical surfaces.)
7. **Tabular numbers** for metrics, quotas, prices, latency.
8. **Use theme tokens / `.dr-*` classes, not raw hex** in components where possible.
9. **Logo is PNG, never redrawn as SVG.** Don't recolor/gradient/shadow the mark.
   Avatars: DiceBear `notionists` only (line-art), saved locally — never
   `avataaars`/`bottts`/monogram circles.

## Color tokens (canonical)

| Token | Hex | Use |
|---|---|---|
| Cream | `#F7F4ED` | page background |
| Soft White | `#FCFBF8` | cards, inputs, modals |
| Charcoal | `#1C1C1C` | primary text, dark buttons, logo black |
| Muted | `#5F5F5D` | secondary text, captions |
| Border | `#ECEAE4` | dividers, card borders |
| AI Blue | `#2563FF` | primary AI action, focus, selected, routing |
| Stable Green | `#148F5F` | healthy / success |
| Warning Orange | `#C76812` | warning / quota pressure |
| Error Red | `#C9362B` | failure / destructive |

Frontend `:root` mapping (DESIGN.md §5):

```css
--background:#f7f4ed; --foreground:#1c1c1c; --card:#fcfbf8; --card-foreground:#1c1c1c;
--primary:#1c1c1c; --primary-foreground:#fcfbf8; --accent:#2563ff;
--muted-foreground:#5f5f5d; --border:#eceae4; --input:#eceae4; --ring:#2563ff;
```

## Typography

Font: **Plus Jakarta Sans** (stack falls back to `Public Sans`, which is already
bundled). Type scale: H1 56/64 · H2 40/48 · H3 28/36 · H4 20/24 · Body 16/24 ·
Small 14/20 · Caption 12/16. Headings weight 600; everything else 400. Dashboard
labels 12–13px. No oversized hero type inside cards/modals/tables.

## Component specs

- **Buttons** — Primary `#1C1C1C` bg / `#FCFBF8` text · AI Action `#2563FF` bg /
  white · Secondary `#FCFBF8` / `#1C1C1C` with `rgba(28,28,28,.18)` border · Ghost
  transparent. Height 40–42px, **radius 7px**, padding 14–18px, font 14/20 weight
  500–600, focus ring `0 0 0 3px rgba(37,99,255,.14)`.
- **Inputs** — height 42px, radius 7px, bg `#FCFBF8`, border `rgba(28,28,28,.14)`,
  focus border `#2563FF` + ring `rgba(37,99,255,.14)`.
- **Badges** — radius 999px (pill), height 28–30px, font 14 weight 600; tinted
  bg+text per state (active=blue, beta=charcoal, stable=green, warning=orange, error=red).
- Pills (999px radius) are for badges / icon-action toggles only — **not** for
  rectangular buttons (those are 7px).

## `.dr-*` CSS reference classes (in `docs/brand/deeprouter-brand.css`)

`.dr-surface .dr-card .dr-panel` · `.dr-heading-{1,2,3} .dr-body .dr-small
.dr-caption` · `.dr-button{,-primary,-ai,-secondary,-ghost}` · `.dr-input
.dr-select` · `.dr-badge{,-active,-beta,-stable,-warning,-error}` · `.dr-metric-card
.dr-table .dr-sidebar .dr-nav-item .dr-modal`. Use these for prototypes/docs and as
the spec when building the React equivalents.

## Before you finish a UI change — checklist

- [ ] Background cream `#F7F4ed`, not white; raised surfaces soft-white.
- [ ] Cards use `#ECEAE4` borders, not box-shadows.
- [ ] AI Blue only as accent (action/focus/selected/routing), no large gradients/orbs.
- [ ] Only weights 400 / 600; no bold-700.
- [ ] Rectangular buttons/inputs at 7px radius; pills only for badges/icon toggles.
- [ ] Colors come from theme tokens / `.dr-*`, not stray hex.
- [ ] If it's a customer-facing surface, you ALSO followed CLAUDE.md §0 + the business PRDs (design ≠ exemption from the casual-user rules).
