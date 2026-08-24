# Profile Plan Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an active subscription plan the primary profile summary, demote wallet balance to a compact identity-area pill, and show two complete balance guidance rows.

**Architecture:** Keep `/api/user/self` as the identity/balance source. Fetch `/api/subscription/self` independently with React Query, map its optional payload into a narrow profile-only summary, and pass that summary into a presentational `ProfileHeader`. Subscription absence or failure maps to `null`, so it never blocks the profile.

**Tech Stack:** React 19, TypeScript 6, TanStack Query 5, Base UI/Tailwind, Bun test, i18next.

---

## File map

- Create `web/default/src/features/profile/lib/subscription-summary.ts`: pure adapter from the shared subscription response to the profile view model.
- Create `web/default/src/features/profile/lib/subscription-summary.test.ts`: adapter regression tests.
- Create `web/default/src/features/profile/components/profile-header.test.tsx`: server-rendered behavior tests for package, balance guidance, and no-package fallback.
- Create `web/default/src/features/profile/profile-i18n.test.ts`: verifies both new guidance keys exist and are translated in all eight locales.
- Modify `web/default/src/features/profile/lib/index.ts`: export the adapter.
- Modify `web/default/src/features/profile/index.tsx`: fetch subscription data with React Query and pass the derived summary to the header.
- Modify `web/default/src/features/profile/components/profile-header.tsx`: render the new responsive hierarchy.
- Modify `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi,es,pt}.json`: add genuine translations for the two guidance sentences.

### Task 1: Lock the subscription summary contract

**Files:**
- Create: `web/default/src/features/profile/lib/subscription-summary.test.ts`
- Create: `web/default/src/features/profile/lib/subscription-summary.ts`
- Modify: `web/default/src/features/profile/lib/index.ts`

- [ ] **Step 1: Write the failing adapter tests**

Import the existing `profile/lib` namespace so the first run fails as an assertion rather than a missing-module error. Cover an active Pro plan, inactive/missing subscriptions, quota fallback, and undefined data. Use a fixture shaped like:

```ts
const activeSubscription = {
  current_subscription: {
    subscription: {
      id: 7,
      user_id: 11,
      plan_id: 2,
      status: 'active',
      start_time: 1,
      end_time: 2,
      amount_total: 100_000,
      amount_used: 25_000,
    },
    plan: {
      id: 2,
      title: 'Pro',
      price_amount: 20,
      currency: 'USD',
      duration_unit: 'month',
      duration_value: 1,
      quota_reset_period: 'monthly',
      enabled: true,
      sort_order: 2,
      allow_balance_pay: true,
      max_purchase_per_user: 0,
      total_amount: 100_000,
    },
    usage_limits: {
      window_5h_used: 0,
      window_5h_reset_at: 0,
      window_week_used: 0,
      window_week_reset_at: 0,
    },
  },
  quota: {
    amount_total: 100_000,
    amount_used: 25_000,
    amount_remaining: 75_000,
    unlimited: false,
  },
  remaining_days: 19,
} satisfies SelfSubscriptionDataResponse
```

Assert the adapter returns:

```ts
{
  planTitle: 'Pro',
  totalQuota: 100_000,
  usedQuota: 25_000,
  remainingQuota: 75_000,
  unlimited: false,
  remainingDays: 19,
  usagePercent: 25,
}
```

- [ ] **Step 2: Run the adapter test and verify RED**

Run: `bun test src/features/profile/lib/subscription-summary.test.ts`

Expected: FAIL because `buildProfileSubscriptionSummary` is not exported yet.

- [ ] **Step 3: Implement the minimal adapter**

Define `ProfileSubscriptionSummary` and `buildProfileSubscriptionSummary(data)` in `subscription-summary.ts`. Return `null` unless `data?.current_subscription?.subscription.status === 'active'`. Prefer top-level `quota` values, fall back to the current subscription amounts, clamp numeric values to non-negative finite numbers, and clamp `usagePercent` to `0..100`. Export it through `lib/index.ts`.

- [ ] **Step 4: Run the adapter test and verify GREEN**

Run: `bun test src/features/profile/lib/subscription-summary.test.ts`

Expected: all adapter tests pass with no warnings.

- [ ] **Step 5: Commit the adapter slice**

Commit with Lore trailers, recording that the profile receives only a narrow summary and that inactive/incomplete data fails closed.

### Task 2: Lock and implement the new profile-header hierarchy

**Files:**
- Create: `web/default/src/features/profile/components/profile-header.test.tsx`
- Modify: `web/default/src/features/profile/components/profile-header.tsx`

- [ ] **Step 1: Write failing render tests**

Initialize an English i18next instance and render `ProfileHeader` with `renderToStaticMarkup`. Use a complete `UserProfile` fixture and the active Pro summary from Task 1. Assert:

```ts
expect(html).toContain('Pro')
expect(html).toContain('Active')
expect(html).toContain('Remaining days')
expect(html).toContain('19')
expect(html).toContain('Available balance')
expect(html).toContain('Balance can be used to purchase plans directly.')
expect(html).toContain(
  'After plan quota is exhausted, balance is used automatically for API usage billing.'
)
expect(html).toContain('aria-label="Current Plan"')
```

Render again with `subscription={null}` and assert that `Current Plan`, `Pro`, and any no-plan placeholder are absent while the display name, available balance, total usage, and API requests remain.

Extract the balance-guidance markup and assert it contains two `<p>` elements and does not contain `truncate` or `line-clamp`.

- [ ] **Step 2: Run the header test and verify RED**

Run: `bun test src/features/profile/components/profile-header.test.tsx`

Expected: FAIL because the existing header ignores the subscription prop and still renders balance as the first statistic.

- [ ] **Step 3: Implement the minimal responsive header**

Add `subscription: ProfileSubscriptionSummary | null` to `ProfileHeaderProps`. In the identity area, render an inline available-balance pill with the formatted `profile.quota`; directly below it render the two guidance strings in separate `<p>` elements with normal wrapping and no truncation utilities.

When `subscription` is non-null, render a prominent bordered/tinted plan section with:

- plan title and `Active` badge;
- `Remaining days` value when available;
- `Monthly model quota` total and `Remaining` quota;
- the existing accessible `Progress` primitive using `usagePercent`.

For unlimited plans, show `Unlimited` and do not imply a finite percentage. Replace the three-column bottom statistics area with two compact columns for `Total Usage` and `API Requests`.

- [ ] **Step 4: Run the header and adapter tests and verify GREEN**

Run: `bun test src/features/profile/components/profile-header.test.tsx src/features/profile/lib/subscription-summary.test.ts`

Expected: all tests pass and the output contains no React warnings.

- [ ] **Step 5: Commit the presentation slice**

Commit with Lore trailers, including the two-row no-truncation constraint and the hidden no-plan state.

### Task 3: Wire the subscription query without blocking profile data

**Files:**
- Modify: `web/default/src/features/profile/index.tsx`

- [ ] **Step 1: Add the React Query integration**

Use `useQuery` with query key `['profile', 'subscription-summary']` and `getSelfSubscriptionFull()`:

```ts
const subscriptionQuery = useQuery({
  queryKey: ['profile', 'subscription-summary'],
  queryFn: async () => {
    const response = await getSelfSubscriptionFull()
    return response.success ? response.data : undefined
  },
  retry: false,
})

const subscription = buildProfileSubscriptionSummary(subscriptionQuery.data)
```

Pass `subscription` to `ProfileHeader`. Do not combine the query loading state with `useProfile().loading`, do not throw subscription errors, and do not render a subscription-error toast or empty-plan placeholder.

- [ ] **Step 2: Run focused tests and typecheck**

Run:

```bash
bun test src/features/profile
bun run typecheck
```

Expected: profile tests pass and TypeScript reports no errors.

- [ ] **Step 3: Commit the query slice**

Commit with Lore trailers explaining the independent fail-closed query and the rejection of extending `UserProfile` with billing data.

### Task 4: Add complete eight-locale guidance copy

**Files:**
- Create: `web/default/src/features/profile/profile-i18n.test.ts`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/pt.json`

- [ ] **Step 1: Write the failing locale test**

Load all eight locale JSON files and verify these two keys exist in every locale and differ from the English source in non-English locales:

```ts
const profileBalanceKeys = [
  'Balance can be used to purchase plans directly.',
  'After plan quota is exhausted, balance is used automatically for API usage billing.',
] as const
```

- [ ] **Step 2: Run the locale test and verify RED**

Run: `bun test src/features/profile/profile-i18n.test.ts`

Expected: FAIL with both keys missing.

- [ ] **Step 3: Add genuine translations**

Use these translations:

| Locale | Purchase sentence | API billing sentence |
| --- | --- | --- |
| en | Balance can be used to purchase plans directly. | After plan quota is exhausted, balance is used automatically for API usage billing. |
| zh | 余额可直接购买套餐。 | 套餐配额用尽后，将自动使用余额按 API 用量计费。 |
| fr | Le solde peut être utilisé pour acheter directement des forfaits. | Une fois le quota du forfait épuisé, le solde est automatiquement utilisé pour la facturation selon l’utilisation de l’API. |
| ru | Баланс можно использовать для прямой покупки тарифов. | После исчерпания квоты тарифа баланс автоматически используется для оплаты по объёму использования API. |
| ja | 残高はプランの直接購入に使用できます。 | プランのクォータを使い切ると、API の使用量に応じた課金に残高が自動的に使用されます。 |
| vi | Số dư có thể được dùng để mua gói trực tiếp. | Sau khi dùng hết hạn mức của gói, số dư sẽ tự động được dùng để tính phí theo mức sử dụng API. |
| es | El saldo se puede usar para comprar planes directamente. | Cuando se agota la cuota del plan, el saldo se usa automáticamente para facturar según el uso de la API. |
| pt | O saldo pode ser usado para comprar planos diretamente. | Depois que a cota do plano se esgota, o saldo é usado automaticamente na cobrança conforme o uso da API. |

- [ ] **Step 4: Verify locale coverage and synchronization**

Run:

```bash
bun test src/features/profile/profile-i18n.test.ts
bun run i18n:sync
git diff -- src/i18n/locales
```

Expected: the locale test passes; synchronization introduces no untranslated copy for the two keys and no unrelated locale churn remains.

- [ ] **Step 5: Commit the locale slice**

Commit with Lore trailers recording the exact two-row product guidance and eight-locale requirement.

### Task 5: Verify behavior, visuals, and change impact

**Files:**
- Verify all modified files; do not add production scope.

- [ ] **Step 1: Run focused and full automated validation**

From `web/default`, run:

```bash
bun test src/features/profile
bun test
bun run typecheck
bun run lint
bun run format:check
bun run copyright:check
bun run build:check
```

Expected: every command exits 0 with zero failing tests or build errors.

- [ ] **Step 2: Run change-scope checks**

Run `git diff --check`, inspect `git status --short`, and run `gitnexus detect-changes` if the local GitNexus index is available. If the GitNexus CLI remains unable to build an index, preserve its failure evidence and repeat the static import/call-site check for `ProfileHeader` before review.

- [ ] **Step 3: Verify desktop and mobile layouts**

Run the local console, open the authenticated profile route, and inspect at desktop width and a mobile width near 390px. Verify the active-plan panel, hidden no-plan state, complete two-row balance guidance, no horizontal overflow, and readable quota progress.

- [ ] **Step 4: Request independent reviews**

Dispatch a spec-compliance reviewer first, then a code-quality reviewer. Fix every Critical or Important issue and re-run affected validation before finalizing.

- [ ] **Step 5: Final implementation commit if review fixes exist**

Use a Lore commit that records review-driven decisions and the fresh validation commands. Do not push or merge `main`.
