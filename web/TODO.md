# HeroUI v3 Cleanup

Tracker across PRs:
- PR #9 (merged) — Phase 0, 2, 3.
- PR <pending> (this branch) — Phase 4, 6.

Active branch: `feature/heroui-v3-success-warning-buttons`

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

### Phase 4 — Manual review of `color='success' / 'warning'` ✅

v3 Button has no built-in success/warning variant. Centralised the four
tone classes in `web/src/components/common/ui/buttonTones.js`
(`successButtonClass`, `warningButtonClass`, `warningSoftButtonClass`,
`warningGhostButtonClass`) — each overrides `--button-bg / -hover /
-pressed / -fg` using the warning / success tokens `@heroui/styles`
already exposes via Tailwind v4. Pair with v3 `variant='primary'` for
solid tones, `variant='tertiary'` for ghost / icon-only.

- [x] `CheckinCalendar` "立即签到" → `variant='primary' + successButtonClass`.
- [x] `SettingsPerformance` "清理不活跃缓存" → `variant='primary' + warningButtonClass`.
- [x] `MultiKeyManageModal` "删除自动禁用密钥" → `variant='primary' + warningButtonClass`.
- [x] `SettingsChannelAffinity` "清空规则缓存" (icon-only X) → `variant='tertiary' + warningGhostButtonClass`.
- [x] `ModelTestModal` "前往设置" → `variant='tertiary' + warningGhostButtonClass`.
- [x] `UserSubscriptionsModal` "作废" → `variant='tertiary' + warningGhostButtonClass`.
- [x] `UsersColumnDefs` "提升" → `variant='tertiary' + warningGhostButtonClass`.
- [x] `tokens/index` "不再提醒" → `variant='tertiary' + warningGhostButtonClass`.

### Phase 5 — `startContent` / `endContent` → children

v3 removed these props on Button & Chip; icons go in `children` with
the parent's `gap-*` Tailwind class controlling spacing. ~50 files.
Mostly mechanical but needs human review for ordering and gap classes.

- [ ] Write codemod, run, manual sanity pass.

### Phase 6 — `classNames={...}` cleanup ✅

- [x] `web/src/components/auth/AuthLayout.jsx` — replaced
      `classNames={{ base, label }}` with root `className='items-start'`
      + `<span>` wrapper for the label tone.

### Phase 7 — Final verification

- [ ] Manual smoke test of `/console` pages (variants, radius, payments).
- [ ] Open PR.

## Out of scope

- HeroUI Pro components (Sheet, Sidebar, Stepper, Segment, …). Already
  on the latest beta after Phase 0; no API drift identified.
- `@heroui-native(-pro)`. Native targets are not in this repo's runtime.
- Pre-existing eslint/prettier offenses (94 missing-license-header errors
  in files unrelated to this PR).
