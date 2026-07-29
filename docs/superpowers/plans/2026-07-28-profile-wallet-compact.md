# Profile Wallet-Compact Plan Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Profile active-plan summary with Wallet's compact neutral meter language and add media generation credits without changing billing or subscription behavior.

**Architecture:** Keep `ProfileSubscriptionSummary` as the presentation boundary around `/api/subscription/self`. Extend that adapter with reset metadata and Wallet-compatible media-credit semantics, then render three lightweight meters (5h, 7d, media) above the existing monthly quota row inside the full-width Profile header. Reuse existing primitives and translations, but do not import Wallet feature components into Profile.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, i18next, Bun test, React server rendering, React Query, existing `Progress` and `StatusBadge` primitives.

---

## File structure

- Modify `web/default/src/features/profile/lib/subscription-summary.ts`: own the narrow Profile subscription adapter, reset metadata, and media-credit state semantics.
- Modify `web/default/src/features/profile/lib/subscription-summary.test.ts`: lock finite, unlimited, not-included, invalid, and reset-time normalization.
- Modify `web/default/src/features/profile/hooks/use-profile-subscription.test.ts`: keep the API-to-summary integration expectation synchronized with the public summary shape.
- Modify `web/default/src/features/profile/components/profile-header.tsx`: render the Wallet-derived neutral plan section and three compact meters.
- Modify `web/default/src/features/profile/components/profile-header.test.tsx`: lock ordering, copy, responsive classes, state rendering, and removal of primary-tinted/nested-card styling.
- Do not modify Wallet components, subscription APIs, locale JSON, billing code, router code, schema, or `main`.

### Task 0: Refresh the feature branch base

**Files:**
- Verify only; do not stage `.omx/`.

- [ ] **Step 1: Fetch the latest remote refs**

Run from `E:/workspace/new-api-worktrees/profile-plan-priority`:

```bash
git fetch origin
```

Expected: `origin/main`, `origin/staging`, and the PR head refs are current.

- [ ] **Step 2: Rebase the feature branch onto the latest main**

Run:

```bash
git rebase origin/main
```

Expected: the rebase completes without losing the compact-design commit; `.omx/` remains untracked and `main` is never checked out or pushed.

- [ ] **Step 3: Verify the refreshed branch scope**

Run:

```bash
git status --short --branch
git merge-base --is-ancestor origin/main HEAD
```

Expected: the ancestry check exits 0 and the only working-tree entry is `?? .omx/`.

### Task 1: Extend the Profile subscription summary with Wallet-compatible media data

**Files:**
- Modify: `web/default/src/features/profile/lib/subscription-summary.test.ts`
- Modify: `web/default/src/features/profile/hooks/use-profile-subscription.test.ts`
- Modify: `web/default/src/features/profile/lib/subscription-summary.ts`
- Modify: `web/default/src/features/profile/components/profile-header.test.tsx` (typed fixture compatibility only; UI assertions remain Task 2)

- [ ] **Step 1: Write the failing adapter tests**

Add `reset_at` to finite 5h/7d fixtures, add a finite `media_credits` fixture, and require the complete normalized shape:

```ts
window_5h: {
  total: 20_000,
  used: 5_000,
  remaining: 15_000,
  reset_at: 1_722_225_600,
  unlimited: false,
},
window_7d: {
  total: 80_000,
  used: 20_000,
  remaining: 60_000,
  reset_at: 1_722_312_000,
  unlimited: false,
},
media_credits: {
  total: 10_000,
  used: 25,
  remaining: 9_975,
  reset_at: 1_724_899_200,
  unlimited: false,
},
```

Require every window summary to include `notIncluded` and `resetAt`, and require the plan summary to include:

```ts
notIncluded: false,
resetAt: 0,
mediaCredits: {
  totalQuota: 10_000,
  usedQuota: 25,
  remainingQuota: 9_975,
  unlimited: false,
  notIncluded: false,
  resetAt: 1_724_899_200,
  usagePercent: 0.25,
},
```

Add focused cases for media semantics:

```ts
test('treats zero media credits as not included unless explicitly unlimited', () => {
  const build = expectAdapterExport()

  expect(
    build({
      current_subscription: buildCurrentSubscription(),
      media_credits: { total: 0, used: 0, remaining: 0, unlimited: false },
    })
  ).toMatchObject({
    mediaCredits: {
      totalQuota: 0,
      usedQuota: 0,
      remainingQuota: 0,
      unlimited: false,
      notIncluded: true,
      resetAt: 0,
      usagePercent: 0,
    },
  })

  expect(
    build({
      current_subscription: buildCurrentSubscription(),
      media_credits: { total: 0, used: 0, remaining: 0, unlimited: true },
    })
  ).toMatchObject({
    mediaCredits: { unlimited: true, notIncluded: false },
  })
})
```

Update the hook integration expectation with the same `mediaCredits`, `notIncluded`, and `resetAt` fields.

- [ ] **Step 2: Run the adapter and hook tests to verify RED**

Run:

```bash
bun test src/features/profile/lib/subscription-summary.test.ts src/features/profile/hooks/use-profile-subscription.test.ts
```

Expected: FAIL because `ProfileUsageWindowSummary` has no `notIncluded`/`resetAt` fields and the adapter does not return `mediaCredits`.

- [ ] **Step 3: Implement the minimal summary contract**

Extend the public summary types:

```ts
export type ProfileUsageWindowSummary = {
  totalQuota: number
  usedQuota: number
  remainingQuota: number
  unlimited: boolean
  notIncluded: boolean
  resetAt: number
  usagePercent: number
}

export type ProfileSubscriptionSummary = ProfileUsageWindowSummary & {
  planTitle: string
  remainingDays: number | null
  window5h: ProfileUsageWindowSummary
  window7d: ProfileUsageWindowSummary
  mediaCredits: ProfileUsageWindowSummary
}
```

Make usage-window normalization distinguish rolling quota from media credits:

```ts
function normalizeUsageWindow(
  window: SubscriptionUsageWindow | undefined,
  kind: 'quota' | 'media' = 'quota'
): ProfileUsageWindowSummary {
  const totalQuota = finiteNonNegative(window?.total)
  const usedQuota = finiteNonNegative(window?.used)
  const remainingQuota =
    window?.remaining === undefined
      ? Math.max(0, totalQuota - usedQuota)
      : finiteNonNegative(window.remaining)
  const unlimited =
    window?.unlimited === true || (kind === 'quota' && totalQuota === 0)
  const notIncluded = kind === 'media' && !unlimited && totalQuota === 0

  return {
    totalQuota,
    usedQuota,
    remainingQuota,
    unlimited,
    notIncluded,
    resetAt: finiteNonNegative(window?.reset_at),
    usagePercent: normalizeUsagePercent(usedQuota, totalQuota, unlimited),
  }
}
```

Add `notIncluded: false` and normalized reset metadata to monthly/fallback summaries, then return:

```ts
window5h: normalizeUsageWindow(data?.window_5h),
window7d: normalizeUsageWindow(data?.window_7d),
mediaCredits: normalizeUsageWindow(data?.media_credits, 'media'),
```

- [ ] **Step 4: Keep existing typed header fixtures compatible**

Add `notIncluded: false` and `resetAt: 0` to the existing monthly, 5h, and 7d fixture summaries. Add a default finite `mediaCredits` fixture to `activeSubscription`, and add an explicitly unlimited `mediaCredits` fixture to the unlimited-plan test. Do not add media-rendering assertions yet; those belong to Task 2's RED step.

- [ ] **Step 5: Run the adapter and hook tests to verify GREEN**

Run:

```bash
bun test src/features/profile/lib/subscription-summary.test.ts src/features/profile/hooks/use-profile-subscription.test.ts
```

Expected: all adapter and hook tests pass with no warnings.

- [ ] **Step 6: Run typecheck for the expanded public summary type**

Run:

```bash
bun run typecheck
```

Expected: exit code 0; every `ProfileSubscriptionSummary` fixture supplies the new required fields.

- [ ] **Step 7: Commit the adapter slice using the Lore protocol**

Stage only the four Task 1 files. Commit intent: make Profile interpret media credits exactly like Wallet while preserving rolling-window unlimited behavior. Include the targeted test and typecheck commands in `Tested:`.

### Task 2: Render the compact Wallet-style plan section

**Files:**
- Modify: `web/default/src/features/profile/components/profile-header.test.tsx`
- Modify: `web/default/src/features/profile/components/profile-header.tsx`

- [ ] **Step 1: Write the failing header tests**

Use the Task 1-compatible `activeSubscription` fixture, whose finite media credits are:

```ts
mediaCredits: {
  totalQuota: 10_000,
  usedQuota: 25,
  remainingQuota: 9_975,
  unlimited: false,
  notIncluded: false,
  resetAt: 1_724_899_200,
  usagePercent: 0.25,
},
```

Add or update assertions so the test contract requires:

```ts
expect(planClass).toContain('border-t')
expect(planClass).not.toContain('bg-primary/5')
expect(planClass).not.toContain('rounded-lg')
expect(shortRowClass).toContain('lg:grid-cols-3')
expect(shortRowClass).not.toContain('sm:grid-cols-2')
expect(window5hClass).not.toContain('border')
expect(window7dClass).not.toContain('border')
expect(mediaClass).not.toContain('border')
expect(quotaRowClass).toContain('border-t')
```

Require the DOM order:

```ts
expect(window5hStart).toBeGreaterThan(shortRowStart)
expect(window7dStart).toBeGreaterThan(window5hStart)
expect(mediaStart).toBeGreaterThan(window7dStart)
expect(quotaRowStart).toBeGreaterThan(mediaStart)
```

Require finite media rendering to use integer credits, Wallet copy, and the existing reset-date formatter:

```ts
expect(mediaHtml).toContain('Media generation credits')
expect(mediaHtml).toContain('25 / 10000 used')
expect(mediaHtml).toContain('9975 remaining')
expect(mediaHtml).not.toContain('$25')
expect(mediaHtml).toContain('aria-valuenow="0.25"')
```

Add one render case with `mediaCredits.notIncluded === true` and assert `Not included`, `0 remaining`, and no `Unlimited` inside the media slot. Extend the loading-state test to require the media skeleton slot and `lg:grid-cols-3`.

- [ ] **Step 2: Run the header test to verify RED**

Run:

```bash
bun test src/features/profile/components/profile-header.test.tsx
```

Expected: FAIL because the media slot and Wallet-style class contract do not exist.

- [ ] **Step 3: Implement one Wallet-derived meter renderer**

Import the existing date formatter without importing Wallet components:

```ts
import {
  formatCompactNumber,
  formatQuota,
  formatTimestampToDate,
} from '@/lib/format'
```

Extend the meter props and formatting:

```ts
interface ProfileUsageWindowMeterProps {
  label: string
  summary: ProfileUsageWindowSummary
  media?: boolean
  slot:
    | 'profile-plan-window-5h'
    | 'profile-plan-window-7d'
    | 'profile-plan-window-media'
}

function formatUsageValue(value: number, media: boolean): string {
  return media ? String(Math.max(0, Math.round(value))) : formatQuota(value)
}
```

Replace the bordered meter cards with one neutral Wallet-style structure:

```tsx
const { summary } = props

<div data-slot={props.slot} className='min-w-0 space-y-1.5'>
  <div className='flex min-h-5 items-center justify-between gap-3 text-xs'>
    <span className='font-medium'>{props.label}</span>
    <span className='text-muted-foreground tabular-nums'>
      {summary.unlimited
        ? t('Unlimited')
        : summary.notIncluded
          ? t('Not included')
          : t('{{used}} / {{total}} used', {
              used: formatUsageValue(summary.usedQuota, props.media === true),
              total: formatUsageValue(summary.totalQuota, props.media === true),
            })}
    </span>
  </div>
  <Progress
    value={summary.usagePercent}
    aria-label={props.label}
    getAriaValueText={summary.unlimited ? () => t('Unlimited') : undefined}
    className='h-1.5'
  />
  <div className='text-muted-foreground min-h-4 text-xs'>
    {summary.unlimited
      ? t('No usage limit')
      : summary.notIncluded
        ? t('0 remaining')
        : summary.resetAt > 0
          ? t('{{remaining}} remaining, resets {{date}}', {
              remaining: formatUsageValue(
                summary.remainingQuota,
                props.media === true
              ),
              date: formatTimestampToDate(summary.resetAt),
            })
          : t('{{remaining}} remaining', {
              remaining: formatUsageValue(
                summary.remainingQuota,
                props.media === true
              ),
            })}
  </div>
</div>
```

- [ ] **Step 4: Implement the compact plan composition**

Use an unfilled divider section instead of the primary-tinted nested card:

```tsx
<section
  data-slot='profile-plan-summary'
  aria-label={t('Current Plan')}
  className='mt-5 border-t pt-4 sm:pt-5'
>
```

Use Wallet typography (`text-muted-foreground text-xs font-medium`, `text-xl font-semibold`) for the plan label/title. Render the three meters with:

```tsx
<div
  data-slot='profile-plan-short-window-row'
  className='mt-4 grid gap-4 lg:grid-cols-3'
>
  <ProfileUsageWindowMeter
    slot='profile-plan-window-5h'
    label={t('5-hour limit')}
    summary={subscription.window5h}
  />
  <ProfileUsageWindowMeter
    slot='profile-plan-window-7d'
    label={t('7-day limit')}
    summary={subscription.window7d}
  />
  <ProfileUsageWindowMeter
    slot='profile-plan-window-media'
    label={t('Media generation credits')}
    summary={subscription.mediaCredits}
    media
  />
</div>
```

Move the monthly row into `className='mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:items-end'`, use `text-foreground` for both finite values, and use `Progress className='mt-3 h-1.5'`. Mirror the same divider, three slots, and `lg:grid-cols-3` structure in the loading skeleton.

- [ ] **Step 5: Run the header test to verify GREEN**

Run:

```bash
bun test src/features/profile/components/profile-header.test.tsx
```

Expected: all ProfileHeader tests pass, including media, style, order, loading, unlimited, and no-plan states.

- [ ] **Step 6: Run the complete Profile slice**

Run:

```bash
bun test src/features/profile
```

Expected: all Profile tests pass with no failed assertions.

- [ ] **Step 7: Commit the presentation slice using the Lore protocol**

Stage only `profile-header.tsx` and `profile-header.test.tsx`. Commit intent: remove the abrupt nested purple panel and make Profile quota presentation consistent with Wallet. Include the two targeted test commands in `Tested:`.

### Task 3: Verify scope, quality, and repository compatibility

**Files:**
- Verify only; modify changed Profile files only if a formatter requires a mechanical correction.

- [ ] **Step 1: Run targeted tests that cover Profile, Wallet semantics, and subscription types**

Run:

```bash
bun test src/features/profile src/features/wallet/components/subscription-plans-card.test.tsx src/features/wallet/lib/subscription-plan-lifecycle.test.ts src/features/subscriptions/api.test.ts
```

Expected: all targeted tests pass, including Wallet's media `Not included` behavior.

- [ ] **Step 2: Run static checks on changed files**

Run:

```bash
bun x eslint src/features/profile/lib/subscription-summary.ts src/features/profile/lib/subscription-summary.test.ts src/features/profile/hooks/use-profile-subscription.test.ts src/features/profile/components/profile-header.tsx src/features/profile/components/profile-header.test.tsx
bun x prettier --check src/features/profile/lib/subscription-summary.ts src/features/profile/lib/subscription-summary.test.ts src/features/profile/hooks/use-profile-subscription.test.ts src/features/profile/components/profile-header.tsx src/features/profile/components/profile-header.test.tsx
git diff --check
```

Expected: zero ESLint errors, every changed file matches Prettier, and `git diff --check` produces no output.

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
bun run typecheck
```

Expected: TypeScript project references compile with exit code 0.

- [ ] **Step 4: Run the production build check**

Run:

```bash
bun run build:check
```

Expected: the console production bundle builds with exit code 0.

- [ ] **Step 5: Run the full frontend test suite**

Run:

```bash
bun test
```

Expected: the full test suite reports 0 failures.

- [ ] **Step 6: Review the final feature diff**

Run from the repository root:

```bash
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
git status --short --branch
```

Expected: only the approved Profile files plus the design/plan docs are on the feature branch; `.omx/` remains untracked and is never staged.

### Task 4: Promote the verified commits to staging and run visual QA

**Files:**
- Runtime artifacts only: `.omx/artifacts/profile-wallet-compact-desktop.png`
- Runtime artifacts only: `.omx/artifacts/profile-wallet-compact-mobile.png`
- Runtime state only: `.omx/state/profile-plan-priority/ralph-progress.json`
- Update PR #583 description; do not merge it.

- [ ] **Step 1: Confirm the remote base has not moved since Task 0**

Run from the feature worktree:

```bash
git fetch origin
git merge-base --is-ancestor origin/main HEAD
```

Expected: exit code 0. If `origin/main` moved, rebase onto it and repeat every Task 3 verification step before pushing.

- [ ] **Step 2: Push the rebased feature branch**

Run:

```bash
git push --force-with-lease origin feature/profile-plan-priority
```

Expected: PR #583 head matches the verified local feature HEAD. Never push or merge `main`.

- [ ] **Step 3: Promote only the new implementation commits to staging**

In `E:/workspace/new-api-worktrees/profile-plan-priority-staging`, first align the deployment branch to `origin/staging`, then cherry-pick only the Task 1 and Task 2 implementation commits. Do not merge the full feature branch and do not cherry-pick `.omx` artifacts or plan-only commits.

- [ ] **Step 4: Run the targeted staging suite**

Run the Task 3 targeted test command in the staging worktree.

Expected: all Profile, Wallet media-semantics, and subscription tests pass.

- [ ] **Step 5: Run staging typecheck**

Run `bun run typecheck` in the staging frontend.

Expected: exit code 0.

- [ ] **Step 6: Run the staging production build check**

Run `bun run build:check` in the staging frontend.

Expected: exit code 0.

- [ ] **Step 7: Run the full staging frontend suite**

Run `bun test` in the staging frontend.

Expected: 0 failures.

- [ ] **Step 8: Push staging and verify deployment**

Push the resulting deployment branch head to `origin/staging`, then confirm the `newapi-console` workflow, direct Cloud Run deployment, and health check succeed. Router deploy remains unnecessary.

- [ ] **Step 9: Capture desktop and mobile staging evidence**

At `https://staging-console.flatkey.ai/profile`, capture:

- `1440x1000`: header aligned with Settings/Passkey edges; neutral divider plan section; 5h/7d/media in three columns; monthly row below; balance tips complete.
- `390x844`: 5h, 7d, media, monthly stacked in order; no horizontal overflow; no clipped tips.

Save the screenshots to the two `.omx/artifacts` paths listed above.

- [ ] **Step 10: Run the final visual verdict**

Compare the screenshots against `docs/superpowers/specs/2026-07-28-profile-plan-priority-design.md` and `.omx/artifacts/wallet-style-reference.png`. Persist JSON with `score`, `verdict`, `category_match`, `differences`, `suggestions`, and `reasoning`; require `score >= 90` before completion.

- [ ] **Step 11: Update PR #583 and stop before main merge**

Update the PR description with media-credit scope, final test counts, staging workflow URL/head, screenshot paths, and visual score. Confirm the PR still targets `main`, remains open, and is not merged. The user owns the final `main` merge.
