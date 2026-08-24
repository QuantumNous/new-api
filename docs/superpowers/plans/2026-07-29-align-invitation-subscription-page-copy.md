# Align Invitation Subscription Page Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the invitation page summary and three-step guidance always show the staging subscription-package copy while keeping API-provided reward amounts, limits, statistics, and external sharing behavior intact.

**Architecture:** `InvitationView` owns a fixed page-guidance mode of `subscription` and passes it only to `InvitationRewardSummary` and `RewardStepsCard`. Those components use the explicit guidance mode to choose copy but continue reading amounts and limits from `InvitationSummary`; `ReferralLinkCard` continues receiving the real API `reward_mode`, so copied and external share messages remain truthful to the active reward configuration.

**Tech Stack:** React 19, TypeScript 6, react-i18next, Bun test, React DOM server rendering

---

### Task 1: Lock the page/share separation with a failing regression test

**Files:**
- Modify: `web/default/src/features/invitations/components/invitation-view.test.tsx`

- [ ] **Step 1: Add a top-up-mode fixture assertion for subscription page guidance**

Add this test inside `describe('InvitationView', ...)`:

```tsx
test('uses subscription guidance for the page while preserving top-up share copy', () => {
  const html = renderView({
    data: {
      ...fixture,
      summary: {
        ...fixture.summary,
        inviter_reward_usd: 5,
        invitee_reward_usd: 5,
        inviter_reward_max_count: 0,
      },
    },
  })
  const topupShareMessage =
    'Share your referral link with friends. Referral rewards are processed after their first successful top-up.'
  const subscriptionShareMessage =
    'Your friend gets the package discount immediately after registering. You receive your package discount immediately after their first successful paid package purchase.'

  expect(html).toContain(
    'Invite friends to subscribe: they get $5 package discount immediately, and you receive $5 package discount after their first successful paid package purchase.'
  )
  expect(html).toContain(
    'Unlimited rewards, package discounts never expire, and any email address is accepted.'
  )
  expect(html).toContain('Share your referral link')
  expect(html).toContain('Send your unique referral link to a friend.')
  expect(html).toContain('Your friend registers')
  expect(html).toContain(
    'Your friend gets a package discount immediately after registering.'
  )
  expect(html).toContain('You receive $5 package discount')
  expect(html).toContain(
    'You receive $5 package discount immediately after their first successful paid package purchase. Package discounts never expire and can only be used for package purchases or renewals.'
  )
  expect(html).toContain(encodeURIComponent(topupShareMessage))
  expect(html).not.toContain(encodeURIComponent(subscriptionShareMessage))
})
```

- [ ] **Step 2: Run the new test and verify RED**

Run from `web/default`:

```bash
bun test src/features/invitations/components/invitation-view.test.tsx --test-name-pattern "uses subscription guidance for the page while preserving top-up share copy"
```

Expected: FAIL because the top-up API fixture still makes the page render API-credit summary and top-up steps instead of subscription-package guidance.

- [ ] **Step 3: Commit the failing regression test**

Stage only the test file and commit with a Lore message recording the missing separation and the RED command.

### Task 2: Separate page guidance mode from the active reward mode

**Files:**
- Modify: `web/default/src/features/invitations/index.tsx`
- Modify: `web/default/src/features/invitations/components/invitation-reward-summary.tsx`
- Modify: `web/default/src/features/invitations/components/reward-steps-card.tsx`

- [ ] **Step 1: Declare the fixed invitation-page guidance mode**

In `index.tsx`, import `InvitationRewardMode`, declare a module-level constant, and pass it only to the summary and steps components:

```tsx
import type {
  InvitationPageData,
  InvitationRewardMode,
} from './types'

const INVITATION_PAGE_GUIDANCE_MODE: InvitationRewardMode = 'subscription'
```

```tsx
<InvitationRewardSummary
  summary={summary}
  guidanceMode={INVITATION_PAGE_GUIDANCE_MODE}
/>
```

```tsx
<RewardStepsCard
  summary={summary}
  guidanceMode={INVITATION_PAGE_GUIDANCE_MODE}
/>
```

Do not change the `rewardMode={summary?.reward_mode}` prop passed to `ReferralLinkCard`.

- [ ] **Step 2: Make the summary copy depend on guidance mode**

In `invitation-reward-summary.tsx`, import `InvitationRewardMode`, add the required prop, and replace only the two copy-selection checks:

```tsx
import type { InvitationRewardMode, InvitationSummary } from '../types'

interface InvitationRewardSummaryProps {
  summary: InvitationSummary | null
  guidanceMode: InvitationRewardMode
}
```

```tsx
if (props.guidanceMode === 'subscription') {
```

```tsx
const packageCopy = props.guidanceMode === 'subscription'
```

All reward amounts and `inviter_reward_max_count` continue to come from `props.summary`.

- [ ] **Step 3: Make the three-step copy depend on guidance mode**

In `reward-steps-card.tsx`, import `InvitationRewardMode`, add the required prop, and derive `subscriptionMode` from the prop:

```tsx
import type { InvitationRewardMode, InvitationSummary } from '../types'

interface RewardStepsCardProps {
  summary: InvitationSummary | null
  guidanceMode: InvitationRewardMode
}
```

```tsx
const subscriptionMode = props.guidanceMode === 'subscription'
```

Keep reward-title and step-three amount interpolation based on `props.summary.inviter_reward_usd`.

- [ ] **Step 4: Run the regression test and verify GREEN**

Run from `web/default`:

```bash
bun test src/features/invitations/components/invitation-view.test.tsx --test-name-pattern "uses subscription guidance for the page while preserving top-up share copy"
```

Expected: PASS.

### Task 3: Update obsolete page-copy expectations without weakening non-page assertions

**Files:**
- Modify: `web/default/src/features/invitations/components/invitation-view.test.tsx`

- [ ] **Step 1: Replace top-up summary/steps expectations with subscription guidance**

For tests using the default top-up fixture, retain assertions for top-up statistics, referral records, and encoded external share messages. Replace assertions that the visible summary or steps use API-credit/top-up copy with the corresponding subscription-package assertions, including dynamic inviter/invitee amounts and finite/unlimited limits.

Use these exact expectations where applicable:

```tsx
expect(html).toContain(
  'Invite friends to subscribe: they get $0.5 package discount immediately, and you receive $1 package discount after their first successful paid package purchase.'
)
expect(html).toContain('Your friend registers')
expect(html).toContain('You receive $1 package discount')
```

For equal `$20` rewards with unlimited referrals:

```tsx
expect(html).toContain('they get $20 package discount immediately')
expect(html).toContain('you receive $20 package discount')
expect(html).toContain('You receive $20 package discount')
expect(html).toContain('Unlimited rewards, package discounts never expire')
```

For inviter `$20`, invitee `$10`, and limit `7`:

```tsx
expect(html).toContain('they get $10 package discount immediately')
expect(html).toContain('you receive $20 package discount')
expect(html).toContain('You receive $20 package discount')
expect(html).toContain('up to 7 successful referrals')
expect(html).toContain('Package discounts never expire')
```

- [ ] **Step 2: Run the full invitation view test file**

Run from `web/default`:

```bash
bun test src/features/invitations/components/invitation-view.test.tsx
```

Expected: all tests PASS with no failures.

- [ ] **Step 3: Commit the implementation and expectation updates**

Stage `index.tsx`, the two guidance components, and `invitation-view.test.tsx`. Commit with a Lore message that records the page/share boundary and targeted test evidence.

### Task 4: Verify all locales and frontend quality gates

**Files:**
- Verify only: `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi,es,pt}.json`
- Verify only: `web/default/src/features/invitations/invitations-i18n.test.ts`

- [ ] **Step 1: Run all invitation feature tests**

Run from `web/default`:

```bash
bun test src/features/invitations
```

Expected: all invitation tests PASS.

- [ ] **Step 2: Verify i18n synchronization and all eight translations**

Run from `web/default`:

```bash
bun run i18n:sync
bun test src/features/invitations/invitations-i18n.test.ts
```

Expected: sync exits successfully without changing locale files; tests confirm the target keys, translations, and interpolation placeholders exist in en, zh, fr, ru, ja, vi, es, and pt.

- [ ] **Step 3: Verify formatting, lint, and TypeScript**

Run from `web/default`:

```bash
bunx prettier --check src/features/invitations/index.tsx src/features/invitations/components/invitation-reward-summary.tsx src/features/invitations/components/reward-steps-card.tsx src/features/invitations/components/invitation-view.test.tsx
bunx eslint src/features/invitations/index.tsx src/features/invitations/components/invitation-reward-summary.tsx src/features/invitations/components/reward-steps-card.tsx src/features/invitations/components/invitation-view.test.tsx
bun run typecheck
```

Expected: all commands exit 0 with no formatting, lint, or type errors.

- [ ] **Step 4: Run the production build check**

Run from `web/default`:

```bash
bun run build:check
```

Expected: TypeScript project build and Rsbuild production bundle both exit 0.

- [ ] **Step 5: Confirm the scope is clean**

Run from the repository root:

```bash
git status --short
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- web/default/src/i18n/locales
```

Expected: only the design, plan, invitation components, and invitation view test are changed; locale JSON diff is empty.

### Task 5: Publish a follow-up PR without touching main

**Files:**
- No additional repository files

- [ ] **Step 1: Push the feature branch**

Run from the repository root:

```bash
git push -u origin fix/align-invitation-subscription-page-copy
```

Expected: the remote feature branch is created or updated successfully.

- [ ] **Step 2: Create a main-targeted follow-up PR**

Create the PR with background, reproduction/evidence, root cause, scope/design, impact/risks, and validation evidence. The PR must target `main` and must not be merged by the agent.

- [ ] **Step 3: Report release scope**

Report `Router deploy: not required` because the change is limited to authenticated console UI guidance and tests. Report `Other deploy targets: newapi-console`; staging requires a later explicit promotion to the remote `staging` branch if the user wants test-environment deployment.
