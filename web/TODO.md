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

3 files still importing `@/components/common/ui/HeroCompat`. Once they're
migrated, `HeroCompat.jsx`, `semi.js`, `HeroIconsCompat.jsx`,
`HeroIllustrationsCompat.jsx`, `semi-icons.js`, `semi-illustrations.js`
can all be deleted.

- [ ] `web/src/pages/Setting/Ratio/ToolPriceSettings.jsx` (~290 lines)
- [ ] `web/src/pages/Setting/Ratio/components/TieredPricingEditor.jsx` (~1700 lines)
- [ ] `web/src/components/table/model-pricing/modal/components/DynamicPricingBreakdown.jsx`

Deferred to a follow-up PR — the size of `TieredPricingEditor` makes it
risky to bundle here; the compat layer keeps these working in the
meantime.

### Phase 2 — Quick fixes ✅

- [x] `SubscriptionPurchaseModal` — 3 × `isLoading={paying}` → `isPending={paying}`.
- [x] 9 × `radius=` prop → Tailwind `rounded-*` class on:
  - MobileMenuButton, ErrorBoundary refresh, Home copy/CTA buttons,
    HeaderLogo Chip, NoticeModal Tabs, console PageLayout sidebar trigger.

### Phase 3 — v2 → v3 variant system ✅

Codemod: `web/scripts/heroui-v3-variant-codemod.mjs`. Idempotent — safe
to re-run on any branch that picks up new v2-style variants.

Mapping applied:

| v2                                     | v3                  |
| -------------------------------------- | ------------------- |
| `variant='solid'`                      | `variant='primary'` |
| `variant='bordered'`                   | `variant='secondary'` |
| `variant='flat'`                       | `variant='tertiary'` |
| `variant='light'`                      | `variant='tertiary'` |
| `variant='faded'`                      | `variant='secondary'` |
| `variant='shadow'`                     | `variant='primary'` |
| `color='danger' variant='flat'`        | `variant='danger-soft'` (drops color) |
| `color='danger' variant='solid'`       | `variant='danger'` (drops color) |
| `color='primary'\|'secondary'\|'default'` next to a variant | drops color |

- [x] Run codemod (102 component files, ~325 prop edits + Chip in semi.js).
- [x] Verify zero `variant='solid|bordered|flat|light|faded|shadow'` and zero `radius=` left in `web/src/`.

### Phase 4 — Manual review of `color='success' / 'warning'`

v3 Button has no built-in success/warning variant. The codemod left
these in place; each needs a Tailwind override (`bg-success`, etc.) or
a swap to the closest semantic intent.

- [ ] `web/src/components/settings/personal/cards/CheckinCalendar.jsx` —
      "补签 / Gift" success Button.
- [ ] `web/src/components/table/channels/modals/ModelTestModal.jsx` —
      "测试中" warning indicator.
- [ ] `web/src/components/table/channels/modals/MultiKeyManageModal.jsx` —
      warning badge.
- [ ] `web/src/components/table/tokens/index.jsx` — warning label.
- [ ] `web/src/components/table/users/UsersColumnDefs.jsx` — risk warning.
- [ ] `web/src/components/table/users/modals/UserSubscriptionsModal.jsx` —
      warning.
- [ ] `web/src/pages/Setting/Operation/SettingsChannelAffinity.jsx` —
      warning.
- [ ] `web/src/pages/Setting/Performance/SettingsPerformance.jsx` —
      "清理缓存" warning Button.

### Phase 5 — `startContent` / `endContent` → children

v3 removed these props on Button & Chip; icons go in `children` with
the parent's `gap-*` Tailwind class controlling spacing. ~50 files.
Mostly mechanical but needs human review for ordering and gap classes.

- [ ] Write codemod, run, manual sanity pass.

### Phase 6 — `classNames={...}` cleanup

Single occurrence remaining (`web/src/components/auth/AuthLayout.jsx`),
v3 uses plain `className`.

- [ ] Migrate.

### Phase 7 — Final verification

- [ ] Manual smoke test of `/console` pages (variants, radius, payments).
- [ ] Open PR.

## Out of scope

- HeroUI Pro components (Sheet, Sidebar, Stepper, Segment, …). Already
  on the latest beta after Phase 0; no API drift identified.
- `@heroui-native(-pro)`. Native targets are not in this repo's runtime.
- Pre-existing eslint/prettier offenses (94 missing-license-header errors
  in files unrelated to this PR).
