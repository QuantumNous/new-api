# Website Portuguese and Japanese Local Payment Prices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render configured BRL and JPY subscription payment prices on the Portuguese and Japanese public Pricing pages without changing USD-denominated usage-value copy.

**Architecture:** Keep the page server-rendered and static. Store USD, BRL, and JPY amounts beside each plan, format only the payment amount from the locale, and pass the formatted Pro price into localized CTA copy so the card and CTA cannot drift.

**Tech Stack:** Next.js 16 Server Components, React 19, TypeScript 6, Bun test runner.

---

### Task 1: Lock the localized payment-price behavior with a failing SSR test

**Files:**
- Modify: `website/src/components/online-pricing-page.test.tsx`
- Test: `website/src/components/online-pricing-page.test.tsx`

- [ ] **Step 1: Add the failing regression test**

Add this test inside the existing `describe("OnlinePricingPage", ...)` block:

```tsx
  test("localizes only payable prices for Portuguese and Japanese", async () => {
    const { OnlinePricingPage } = await import("./online-pricing-page");
    const cases = [
      {
        locale: "pt",
        prices: ["R$ 49,90", "R$ 149,90", "R$ 499,90"],
        cta: "Assine Pro por R$ 149,90/mês e entre",
        retainedUsdCopy: "Até $45 de uso de modelos / mês",
      },
      {
        locale: "ja",
        prices: ["¥1,500", "¥4,500", "¥15,000"],
        cta: "Pro を ¥4,500/月で登録してログイン",
        retainedUsdCopy: "月あたり最大 $45 のモデル利用",
      },
    ] as const;

    for (const item of cases) {
      const html = renderToStaticMarkup(<OnlinePricingPage locale={item.locale} />);
      for (const price of item.prices) {
        expect(html).toContain(`<b>${price}</b>`);
      }
      expect(html).toContain(item.cta);
      expect(html).toContain(item.retainedUsdCopy);
      expect(html).not.toContain("<b>$10</b>");
      expect(html).not.toContain("<b>$30</b>");
      expect(html).not.toContain("<b>$100</b>");
    }
  });
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run from `website/`:

```bash
bun test src/components/online-pricing-page.test.tsx
```

Expected: FAIL because the rendered Portuguese and Japanese plan cards still contain `<b>$10</b>`, `<b>$30</b>`, and `<b>$100</b>` and do not contain the localized payment prices.

### Task 2: Render locale-aware plan payment prices and keep CTA copy synchronized

**Files:**
- Modify: `website/src/components/online-pricing-page.tsx:17-38,60-118`
- Modify: `website/src/lib/online-static-copy.tsx:130-151,302,504,565,613,661,709,757,805,853,901`
- Test: `website/src/components/online-pricing-page.test.tsx`

- [ ] **Step 1: Replace each single price string with configured currency amounts**

In `online-pricing-page.tsx`, add the currency type and store the three configured amounts per plan:

```tsx
type PaymentCurrency = "USD" | "BRL" | "JPY";

const plans = [
  {
    href: subscriptionSignupHref("go"),
    hot: false,
    name: "Go",
    prices: { BRL: 49.9, JPY: 1_500, USD: 10 },
  },
  {
    href: subscriptionSignupHref("pro"),
    hot: true,
    name: "Pro",
    prices: { BRL: 149.9, JPY: 4_500, USD: 30 },
  },
  {
    href: subscriptionSignupHref("max"),
    hot: false,
    name: "Max",
    prices: { BRL: 499.9, JPY: 15_000, USD: 100 },
  },
] as const;
```

- [ ] **Step 2: Add deterministic locale formatting**

Add these helpers below `plans`:

```tsx
function paymentCurrency(locale: Locale): PaymentCurrency {
  if (locale === "pt") return "BRL";
  if (locale === "ja") return "JPY";
  return "USD";
}

function formatPaymentPrice(locale: Locale, prices: Readonly<Record<PaymentCurrency, number>>): string {
  const currency = paymentCurrency(locale);
  const amount = prices[currency];
  if (currency === "BRL") {
    return `R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currency === "JPY") return `¥${amount.toLocaleString("ja-JP")}`;
  return `$${amount.toLocaleString("en-US")}`;
}
```

- [ ] **Step 3: Render the formatted card prices**

At the start of `OnlinePricingPlansSection`, derive the displayed plan records and Pro price:

```tsx
  const copy = getOnlineStaticCopy(props.locale);
  const displayedPlans = plans.map((plan) => ({
    ...plan,
    price: formatPaymentPrice(props.locale, plan.prices),
  }));
  const proPrice = displayedPlans.find((plan) => plan.name === "Pro")!.price;
```

Change the card loop from `plans.map` to `displayedPlans.map`. Keep `<b>{plan.price}</b>` unchanged so it now renders the derived display value.

- [ ] **Step 4: Make localized CTA copy accept the displayed Pro price**

In `online-static-copy.tsx`, change the type:

```tsx
payCta: (price: string) => string;
```

Replace each locale's fixed-price CTA with a formatter while preserving existing wording:

```tsx
payCta: (price) => `Subscribe Pro ${price}/mo sign in`,
payCta: (price) => `订阅 Pro ${price}/月并登录`,
payCta: (price) => `Suscríbete a Pro por ${price}/mes e inicia sesión`,
payCta: (price) => `S'abonner à Pro pour ${price}/mois et se connecter`,
payCta: (price) => `Assine Pro por ${price}/mês e entre`,
payCta: (price) => `Оформить Pro за ${price}/мес. и войти`,
payCta: (price) => `Pro を ${price}/月で登録してログイン`,
payCta: (price) => `Đăng ký Pro ${price}/tháng và đăng nhập`,
payCta: (price) => `Pro für ${price}/Monat abonnieren und anmelden`,
payCta: (price) => `Berlangganan Pro ${price}/bulan dan masuk`,
```

In `online-pricing-page.tsx`, pass the derived price:

```tsx
ctaLabel={copy.pricing.payCta(proPrice)}
```

- [ ] **Step 5: Run the targeted test and verify GREEN**

Run from `website/`:

```bash
bun test src/components/online-pricing-page.test.tsx
```

Expected: PASS with the Portuguese and Japanese localized payment-price assertions and all existing online Pricing tests green.

- [ ] **Step 6: Commit the implementation**

Stage the three implementation/test files and commit with the repository's Lore trailers. Do not include unrelated files.

### Task 3: Verify the website and the rendered pages

**Files:**
- Verify: `website/src/components/online-pricing-page.tsx`
- Verify: `website/src/lib/online-static-copy.tsx`
- Verify: `website/src/components/online-pricing-page.test.tsx`

- [ ] **Step 1: Run all website unit tests**

Run from `website/`:

```bash
bun test
```

Expected: exit code `0`, with no failed tests.

- [ ] **Step 2: Run static verification**

Run from `website/`:

```bash
bun run lint
bun run typecheck
bun run build
```

Expected: all commands exit `0` with no lint errors, TypeScript errors, or Next.js build failures.

- [ ] **Step 3: Start the production preview**

Run from `website/`:

```bash
bunx next start -p 4000
```

Expected: Next.js reports a local server at `http://localhost:4000`.

- [ ] **Step 4: Verify rendered output in the browser**

Open `http://localhost:4000/pt/pricing` and `http://localhost:4000/ja/pricing` and confirm:

- Portuguese cards show `R$ 49,90`, `R$ 149,90`, and `R$ 499,90`.
- Japanese cards show `¥1,500`, `¥4,500`, and `¥15,000`.
- The Pro payment CTA matches the Pro card price in each locale.
- The usage-value and free-credit explanations continue to use USD.

- [ ] **Step 5: Review the final diff and deployment scope**

Run:

```bash
git status --short
git diff origin/main...HEAD -- website docs/superpowers
```

Expected: only the approved design/plan documentation, Pricing component, localized static copy, and Pricing regression test changed. Router deployment is not required; only the website deployment target is affected.
