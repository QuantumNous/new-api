# Wallet Subscription Localized Prices Design

## Goal

Show subscription plan prices on the wallet page in the currency implied by the interface language, using only prices actually configured by the system. Japanese uses JPY, Portuguese uses BRL, and every other language uses USD. If the requested currency is incomplete across the visible plan set, the whole plan grid falls back to USD.

## Observed Defect

The deployed wallet localizes Stripe top-up presets but the subscription plan cards still render `plan.price_amount` and `plan.currency`. On staging, a Japanese wallet therefore shows the Go, Pro, and Max plans as `$10`, `$30`, and `$100` even though the plans have configured local prices and Stripe Price IDs.

## Chosen Design

The public subscription-plan response gains a `currency_prices` map whose values are major-unit money amounts. It is assembled from the plan's canonical price, configured BRL/INR local prices, and the configured Stripe Price's `currency_options` for USD, JPY, BRL, and INR. Explicit database local prices win for BRL and INR because those values are the authoritative Pix/UPI plan configuration.

Stripe lookups are best-effort and cached briefly by Price ID. A Stripe outage or a malformed option never breaks the plans endpoint; the response retains database prices and the UI falls back to USD.

The wallet plan grid derives one display currency from the active i18n language. It uses that currency only when every visible plan has a valid positive price for it. Otherwise it uses USD for every card. A server-issued preview quote continues to override the language-derived display price because it represents the actual payable amount.

## Alternatives Rejected

- Client-side currency conversion: rejected because it can drift from configured and charged prices.
- BRL/INR database fields only: rejected because it cannot represent the configured JPY Stripe price required by the Japanese experience.
- A Stripe call on every render without caching: rejected because it adds avoidable latency and rate pressure to a frequently loaded wallet endpoint.

## Data Contract

`SubscriptionPlanPublicDTO` exposes:

```json
{
  "price_amount": 10,
  "currency": "USD",
  "currency_prices": {
    "USD": 10,
    "JPY": 1500,
    "BRL": 49.9,
    "INR": 899
  }
}
```

Only supported, configured, positive prices are included. The map omits unavailable currencies.

## Error Handling

- Missing Stripe Price ID: use database prices only.
- Stripe request failure: log a warning, return database prices, and keep the endpoint successful.
- Missing target language currency on any visible plan: display all cards in USD.
- Missing USD on an anomalous plan: fall back to that plan's canonical currency instead of inventing a conversion.

## Verification

- Go controller tests prove configured Stripe options are converted from minor units, database BRL/INR prices override Stripe options, and Stripe failures degrade to database prices.
- React tests prove Japanese renders JPY when every plan supports it, Portuguese renders BRL, unsupported/incomplete languages render USD, and quote previews still override language pricing.
- Typecheck, targeted frontend tests, targeted Go tests, and a production frontend build must pass before deployment.
- After staging deployment, live browser verification must show JPY plan cards under Japanese and BRL plan cards under Portuguese, with USD fallback for an unsupported language.
