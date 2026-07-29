# Restore Staging Invitation Page Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the current staging invitation-page description while preserving PR #591's dynamic external share messages and all eight existing translations.

**Architecture:** Keep the page description and outbound share message as separate values inside `ReferralLinkCard`. The page always reads the existing staging i18n key, while `rewardMode` continues to select only the message passed to `buildInvitationShareLinks`.

**Tech Stack:** React 19, TypeScript, react-i18next, Bun test, React DOM server rendering, ESLint, Rsbuild

---

### Task 1: Establish the frontend baseline

**Files:**

- Read: `web/package.json`
- Read: `web/bun.lock`
- Read: `web/default/package.json`

- [ ] **Step 1: Install the locked workspace dependencies on `E:`**

Run from `web/`:

```powershell
$env:BUN_INSTALL_CACHE_DIR='E:\workspace\.bun-cache'
bun install --frozen-lockfile
```

Expected: Bun exits with code 0, does not change `bun.lock`, and creates the workspace dependencies under the `E:` worktree.

- [ ] **Step 2: Run the existing focused tests**

Run from `web/default/`:

```powershell
bun test src/features/invitations/components/invitation-view.test.tsx src/features/invitations/invitations-i18n.test.ts
```

Expected: Both existing test files pass before the regression assertion is added.

### Task 2: Add a failing regression test for page/share separation

**Files:**

- Modify: `web/default/src/features/invitations/components/invitation-view.test.tsx`
- Test: `web/default/src/features/invitations/components/invitation-view.test.tsx`

- [ ] **Step 1: Add the subscription-mode regression test**

Add this test inside `describe('InvitationView', ...)` near the existing share-message test:

```tsx
test('keeps the staging page description while sharing subscription reward rules', () => {
  const html = renderView({
    data: {
      ...fixture,
      summary: {
        ...fixture.summary,
        reward_mode: 'subscription',
      },
    },
  })
  const pageDescription =
    'Share your referral link with friends. Referral rewards are processed after their first successful top-up.'
  const shareMessage =
    'Your friend gets the package discount immediately after registering. You receive your package discount immediately after their first successful paid package purchase.'

  expect(html).toContain(pageDescription)
  expect(html).not.toContain(shareMessage)
  expect(html).toContain(encodeURIComponent(shareMessage))
})
```

- [ ] **Step 2: Run the new test and verify the expected failure**

Run from `web/default/`:

```powershell
bun test src/features/invitations/components/invitation-view.test.tsx --test-name-pattern "keeps the staging page description"
```

Expected: FAIL because the current component renders the raw subscription reward message as the card description instead of `pageDescription`. The encoded external share message assertion must already pass.

- [ ] **Step 3: Commit the failing regression test**

Stage only the test file and commit with the repository Lore trailers. The commit must record the expected red-state test command under `Tested:`.

### Task 3: Separate the page description from outbound sharing

**Files:**

- Modify: `web/default/src/features/invitations/components/referral-link-card.tsx`
- Test: `web/default/src/features/invitations/components/invitation-view.test.tsx`

- [ ] **Step 1: Rename the dynamic value to describe its real responsibility**

Change the dynamic message block to:

```tsx
let shareMessage = t('Share your referral link to get started.')
if (rewardMode === 'subscription') {
  shareMessage = t(
    'Your friend gets the package discount immediately after registering. You receive your package discount immediately after their first successful paid package purchase.'
  )
} else if (rewardMode === 'topup') {
  shareMessage = t(
    'Share your referral link with friends. Referral rewards are processed after their first successful top-up.'
  )
}
const links = buildInvitationShareLinks(affiliateLink, shareMessage)
```

- [ ] **Step 2: Set the page description independently**

Change the `TitledCard` description prop to:

```tsx
description={t(
  'Share your referral link with friends. Referral rewards are processed after their first successful top-up.'
)}
```

Do not alter `buildInvitationShareLinks`, clipboard content, email links, X links, LinkedIn links, locale JSON values, or reward-mode selection.

- [ ] **Step 3: Run the regression test and verify green**

Run from `web/default/`:

```powershell
bun test src/features/invitations/components/invitation-view.test.tsx --test-name-pattern "keeps the staging page description"
```

Expected: PASS. The raw page description is present, the raw subscription message is absent, and the encoded subscription message remains in external share URLs.

- [ ] **Step 4: Run all invitation component tests**

Run from `web/default/`:

```powershell
bun test src/features/invitations/components/invitation-view.test.tsx src/features/invitations/components/invitation-layout.test.tsx
```

Expected: Both files pass with zero failures.

### Task 4: Verify all eight locales and frontend quality gates

**Files:**

- Verify: `web/default/src/i18n/locales/en.json`
- Verify: `web/default/src/i18n/locales/zh.json`
- Verify: `web/default/src/i18n/locales/fr.json`
- Verify: `web/default/src/i18n/locales/ru.json`
- Verify: `web/default/src/i18n/locales/ja.json`
- Verify: `web/default/src/i18n/locales/vi.json`
- Verify: `web/default/src/i18n/locales/es.json`
- Verify: `web/default/src/i18n/locales/pt.json`
- Test: `web/default/src/features/invitations/invitations-i18n.test.ts`

- [ ] **Step 1: Run the eight-locale invitation test**

Run from `web/default/`:

```powershell
bun test src/features/invitations/invitations-i18n.test.ts
```

Expected: All locale cases pass. The existing page-description key is present, non-empty, and translated in every non-English locale.

- [ ] **Step 2: Run the i18n synchronization check**

Run from `web/default/`:

```powershell
bun run i18n:sync
```

Expected: Exit code 0. Inspect `src/i18n/locales/_reports/*.untranslated.json`; the target page-description key must not appear as newly missing or untranslated. Revert generated report churn if the command produces unrelated report-only changes.

- [ ] **Step 3: Run type checking**

Run from `web/default/`:

```powershell
bun run typecheck
```

Expected: Exit code 0 with no TypeScript errors.

- [ ] **Step 4: Run lint on the changed source and test files**

Run from `web/default/`:

```powershell
bunx eslint src/features/invitations/components/referral-link-card.tsx src/features/invitations/components/invitation-view.test.tsx
```

Expected: Exit code 0 with no lint errors.

- [ ] **Step 5: Run the production build check**

Run from `web/default/`:

```powershell
bun run build:check
```

Expected: TypeScript and Rsbuild both exit with code 0.

### Task 5: Review scope and commit the implementation

**Files:**

- Review: `web/default/src/features/invitations/components/referral-link-card.tsx`
- Review: `web/default/src/features/invitations/components/invitation-view.test.tsx`

- [ ] **Step 1: Confirm the diff is narrow and clean**

Run from the repository root:

```powershell
git diff --check
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- web/default/src/features/invitations/components/referral-link-card.tsx web/default/src/features/invitations/components/invitation-view.test.tsx
```

Expected: No whitespace errors; production behavior changes only in `ReferralLinkCard`; no locale JSON, backend, website, lockfile, or generated report changes are included.

- [ ] **Step 2: Commit the green implementation**

Stage the component and test file, then commit with the Lore protocol. The commit must state that external share messages were preserved and list the fresh focused tests, eight-locale test, typecheck, lint, and build evidence under `Tested:`.

- [ ] **Step 3: Verify final branch state**

Run:

```powershell
git status --short --branch
git log -3 --oneline --decorate
```

Expected: The worktree is clean, the branch contains the design, plan, red regression-test, and green implementation commits, and nothing has been pushed or merged.
