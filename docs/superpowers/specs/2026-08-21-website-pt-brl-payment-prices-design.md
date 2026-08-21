# Website Portuguese BRL and Japanese JPY Payment Prices Design

## Goal

Show Brazilian real and Japanese yen prices for the amounts Portuguese- and Japanese-language visitors can pay on the public Pricing page, while leaving USD-denominated usage value, short-term limits, and free-credit explanations unchanged.

## Scope

The `/pt/pricing` page changes these payment-price surfaces:

- Go: `R$ 49,90/mês`
- Pro: `R$ 149,90/mês`
- Max: `R$ 499,90/mês`
- The Pro payment call to action uses `R$ 149,90/mês`.

The `/ja/pricing` page changes the equivalent surfaces:

- Go: `¥1,500/月`
- Pro: `¥4,500/月`
- Max: `¥15,000/月`
- The Pro payment call to action uses `¥4,500/月`.

All other locales keep their current displayed plan prices. Portuguese and Japanese usage descriptions, short-term dollar limits, and the `$1` free-credit explanation remain unchanged because they describe account value or limits rather than the checkout amount.

## Chosen Design

Keep the public Pricing page server-rendered and static. Add the configured BRL and JPY payment amounts to each existing plan definition and choose the rendered payment price from the page locale. Portuguese formats BRL with Brazilian decimal punctuation, Japanese formats yen without fractional digits, and every other locale retains the current USD display.

Make the payment-call-to-action copy accept the rendered Pro price instead of embedding `$30`. This keeps the card and CTA on the same price source without changing the visible wording for locales other than Portuguese and Japanese.

The localized amounts match the existing subscription price contract used by the authenticated wallet: Go `49.9`, Pro `149.9`, and Max `499.9` BRL; Go `1,500`, Pro `4,500`, and Max `15,000` JPY.

## Alternatives Rejected

- Add a new anonymous subscription-pricing API: rejected because the current plans endpoint requires authentication, and exposing a new billing endpoint is unnecessary for three stable marketing-page prices.
- Convert USD in the browser using an exchange rate: rejected because converted values could differ from the configured payable Stripe/Pix prices.
- Rely on Stripe Adaptive Pricing alone: rejected because Stripe only localizes Checkout and cannot rewrite the server-rendered public Pricing page.

## Error Handling

No network dependency is introduced, so the page cannot fail because Stripe or the console API is unavailable. Locale selection has explicit Portuguese and Japanese branches and preserves the current USD string for every other locale.

## Testing and Acceptance Criteria

- A server-rendering regression test proves `/pt/pricing` renders `R$ 49,90`, `R$ 149,90`, and `R$ 499,90` in the three plan cards.
- The same test proves the Portuguese Pro payment CTA uses `R$ 149,90/mês`.
- A server-rendering regression test proves `/ja/pricing` renders `¥1,500`, `¥4,500`, and `¥15,000` in the three plan cards.
- The same test proves the Japanese Pro payment CTA uses `¥4,500/月`.
- Tests prove English plan prices remain `$10`, `$30`, and `$100`.
- Tests preserve dollar-denominated Portuguese and Japanese usage and free-credit copy.
- Website unit tests, lint, typecheck, and build pass.
- A local production preview at `/pt/pricing` shows the BRL payment prices before a deployment is considered ready.

## Deployment Impact

This is a website-only change. It requires deploying `newapi-web` (and staging `newapi-web-staging` for acceptance) but does not require deploying console or router services, changing Stripe configuration, or changing database state.
