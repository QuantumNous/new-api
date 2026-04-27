# HeroUI v3 Cleanup

Branch: `feature/heroui-v3-cleanup`

Goal: bring `web/` into full compliance with HeroUI v3 component rules
(ref: https://heroui.com/react/llms.txt and per-component migration guides).

## Status legend

- [x] done
- [ ] todo
- [-] skipped / not needed

## Tasks

### Phase 0 — Dependency upgrade ✅

- [x] Bump `@heroui-pro/react` 1.0.0-beta.1 → 1.0.0-beta.2.
- [x] Tighten ranges (`>=3.0.0` → `^3.0.3`) for `@heroui/react` and `@heroui/styles`.

### Phase 1 — Drop the last HeroCompat (Semi-style) usages

Only 3 files left. Once they're migrated, `HeroCompat.jsx` and `semi.js`
can be deleted.

- [ ] `web/src/pages/Setting/Ratio/ToolPriceSettings.jsx`
- [ ] `web/src/pages/Setting/Ratio/components/TieredPricingEditor.jsx`
- [ ] `web/src/components/table/model-pricing/modal/components/DynamicPricingBreakdown.jsx`
- [ ] After all three are migrated: delete `HeroCompat.jsx`, `semi.js`,
      `HeroIconsCompat.jsx`, `HeroIllustrationsCompat.jsx`, `semi-icons.js`,
      `semi-illustrations.js` if unused.

### Phase 2 — Quick fixes

- [ ] `web/src/components/topup/modals/SubscriptionPurchaseModal.jsx` — 3 ×
      `isLoading={paying}` → `isPending={paying}` + render-prop spinner.
- [ ] `radius=` prop usages (HeroUI v3 dropped this prop) →
      Tailwind `rounded-*` class:
  - `web/src/components/auth/AuthLayout.jsx`
  - `web/src/components/layout/PageLayout.jsx`
  - `web/src/components/common/ErrorBoundary.jsx`
  - `web/src/components/layout/headerbar/HeaderLogo.jsx`
  - `web/src/components/layout/NoticeModal.jsx`
  - `web/src/components/layout/headerbar/MobileMenuButton.jsx`
  - `web/src/pages/Home/index.jsx` (3 occurrences)

### Phase 3 — v2 → v3 variant system (largest)

HeroUI v3 Button/Chip variants are semantic
(`primary | secondary | tertiary | danger | danger-soft | ghost | outline`),
not visual (`solid | bordered | flat | light | faded | shadow`).

Mapping:

| v2                                      | v3 (Button)        | v3 (Chip) |
| --------------------------------------- | ------------------ | --------- |
| `variant='solid'`                       | `variant='primary'`     | `variant='primary'` |
| `variant='bordered'`                    | `variant='secondary'`   | `variant='secondary'` |
| `variant='flat'`                        | `variant='tertiary'`    | `variant='tertiary'` |
| `variant='light'`                       | `variant='tertiary'`    | `variant='soft'` |
| `variant='faded'`                       | `variant='secondary'`   | `variant='secondary'` |
| `color='danger' variant='flat'`         | `variant='danger-soft'` | n/a |
| `color='danger' variant='solid'`        | `variant='danger'`      | `color='danger'` |
| `color='primary'` (any)                 | drop `color`, keep variant | `color='accent'` |
| `color='success'` / `color='warning'`   | drop `color`, keep variant + custom Tailwind | unchanged |

- [ ] Auto-rewrite `<Button>` props across the ~100 files (`scripts/heroui-v3-codemod.mjs`).
- [ ] Manual review pass for ambiguous cases (`color='success'`, custom one-offs).
- [ ] Drop the now-redundant `color` prop on Button.

### Phase 4 — `startContent` / `endContent` → children

v3 removed `startContent` / `endContent` on Button & Chip; icons go in
`children`. ~50 files. Mostly mechanical but needs a pass to keep
ordering and `gap` Tailwind classes correct.

- [ ] Codemod with manual review.

### Phase 5 — `classNames={...}` cleanup

Single occurrence remaining (`web/src/components/auth/AuthLayout.jsx`),
v3 uses plain `className`.

- [ ] Migrate.

### Phase 6 — Final verification

- [ ] `bun run eslint`
- [ ] `bun run lint`
- [ ] manual smoke test of `/console` pages.
- [ ] Open PR.

## Out of scope

- HeroUI Pro components (Sheet, Sidebar, Stepper, Segment, …). Already
  on the latest beta after Phase 0; no API drift identified.
- `@heroui-native(-pro)`. Native targets are not in this repo's runtime.
