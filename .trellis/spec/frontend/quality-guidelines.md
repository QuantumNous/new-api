# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)

## Public pricing previews and savings estimates

### Scope / Trigger
Home-page pricing is an optional preview on a public page. Savings calculations
consume billing expressions, while sidebar sizing composes with Base UI state.

### Signatures
- `usePricingData(enabled, { publicPreview: true })` opts into home access handling.
- `getPricing(config?: ApiRequestConfig)` accepts request-scoped error policy.
- `buildSavingsCatalog(models, priceRate)` returns only supported estimates.

### Contracts
- Check fresh `HeaderNavModules.pricing` before a preview request; do not grant
  access from localStorage placeholder status. Keep preview queries separate
  from the authenticated catalog and partition by viewer identity.
- Preview 401 responses must not refresh the session or redirect the home page.
  Do not deduplicate a preview with a catalog request carrying another policy.
- Savings supports a complete optional `v1:` single `tier` with a sum of finite
  nonnegative `p`, `c`, `cr`, `cc` coefficients. Preserve explicit zero cache
  prices; absence alone means regular-input fallback.

### Validation & Error Matrix
| Condition | Behavior |
| --- | --- |
| Pricing disabled, anonymous private pricing, status unavailable | No pricing request |
| Permitted public or signed-in preview | Fetch and display models |
| Pricing access changes to 401 during request | Empty/error preview, no session rotation |
| Conditional, outer arithmetic, unsupported token dimensions | Exclude from estimator |
| Explicit `cr * 0` / `cc * 0` | Free cache, never regular-input fallback |

### Good / Base / Bad Cases
- Good: `tier("base", p * 10 + c * 20 + cr * 0)` preserves a free cache.
- Base: `tier("base", p * 10 + c * 20)` treats cache as regular input.
- Bad: `tier("base", p * 10 + c * 20) * 2` cannot use unscaled tier coefficients.

### Tests Required
- Real pricing hook + HTTP boundary: restricted access, stale cached status,
  sign-out, and policy changes after the status check.
- Savings: complete expression matching, zero vs omitted cache, finite prices.
- Real sidebar + stylesheet: expand/collapse/reopen in icon and offcanvas modes
  for sidebar, floating and inset variants. Expanded `inline-size` overrides
  must not match a collapsed gap and override the primitive's width utilities.

### Wrong vs Correct
- Wrong: infer estimator eligibility from `summary.tierCount === 1`; display
  summaries can omit zero entries and parse only part of the formula.
- Correct: validate the entire supported formula and retain term presence.
- Wrong: apply expanded `sidebar-gap` sizing regardless of `data-state`.
- Correct: scope expanded geometry to `data-state="expanded"`.

## Authenticated developer and beginner documentation

### 1. Scope / Trigger

Use this contract when adding or changing internal setup documentation that
combines deployment URLs, account models, billing groups, and client protocol
examples. It prevents public exposure, leaked credentials, and examples that
look valid but use an incompatible model/endpoint pair.

### 2. Signatures

- Routes: `/guide` and `/guide/$slug` live under `routes/_authenticated/guide/`.
- `isOperatorRoute('/guide' | '/guide/...')` returns `true` so the developer
  shell wins over a saved easy-mode preference.
- Route `/beginner-guide` lives directly under `routes/_authenticated/` and is
  not an operator route, so it keeps the user's saved console shell.
- `useGuideEnvironment(audience, requested, onSelectionChange)` composes
  `getUserModels()`, `getUserGroups()`, `getUserGroupModels(group)`,
  `getPricing()`, and `useGuideAddress()`.
- `fillGuideTemplate(template, runtime)` resolves only approved deployment,
  model, group, and masked-key placeholders.

### 3. Contracts

- Public navigation does not link to the internal guide. Authenticated
  easy-mode navigation exposes a translated `Beginner guide` entry to
  `/beginner-guide`; contextual help inside the easy setup flow uses the same
  route. Developer navigation exposes `Docs` at `/guide`. Never point both
  labels at one route: the beginner guide is the historical tool-card workflow,
  while `/guide` is the account-aware developer documentation center.
- Protocol-specific articles intersect account model IDs with pricing
  `supported_endpoint_types`: `openai-response` for Codex, `anthropic` for
  Claude Code, and `openai` for Chat Completions clients.
- A selected group is shown only after `/api/user/models?group=<group>` confirms
  it contains the selected model.
- The billing/routing group belongs to the API key. Select the model/group
  before key creation and create or edit the key in that group; do not describe
  the group as a client request field or custom header without a separate API
  contract that explicitly supports one.
- Guide code never calls key-list or key-reveal APIs. Every API-key slot resolves
  to the literal masked placeholder `sk-••••••`.
- Beginner-guide examples use masked keys such as `sk-****************` and
  runtime deployment addresses; they never reveal a stored key or hardcode the
  deployed host.
- `useCaseRows[].toolIds` must reference existing `guideTools` ids. Picking a
  use-case card narrows the tool wall to exactly those tools, ANDed with the
  category filter, and scrolls to the wall; the visible clear chip restores the
  unfiltered wall and the unsettled card state.
- Steps shared by a switcher/aggregator tool (for example CC Switch) describe
  "the target app you want to configure" and never name one client as the
  required target. App-specific instructions belong to that app's own card.
- Dynamic guide prose uses English i18n keys and must be enumerated by the guide
  localization test because a static `t('...')` extractor cannot see catalog
  data.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Anonymous request to `/guide...` | Existing authenticated-route redirect to sign-in |
| Anonymous request to `/beginner-guide` | Existing authenticated-route redirect to sign-in |
| Unknown beginner-guide `tool` query | Keep the catalog visible without opening a dialog |
| Invalid route slug | Not-found experience; never a silent article fallback |
| Requested model/group is unavailable | Replace with a verified deterministic default |
| No model supports the article protocol | Honest empty state with a Models action |
| Pricing or group verification fails | Retryable error state; do not emit an unverified config |
| Pricing success response omits `data` | Retryable error state; no render exception |
| Selected model declares context below 1M | Do not claim or generate a 1M configuration |

### 5. Good / Base / Bad Cases

- Good: an account has a Responses model in `default`; the Codex article shows
  that pair and regenerates its visible/copyable TOML together.
- Good: easy navigation opens `/beginner-guide`; developer navigation opens
  `/guide`, and changing routes does not rewrite the saved console mode.
- Base: a protocol-neutral troubleshooting article may list all account models,
  but it does not claim that one model supports every client.
- Bad: reuse `/guide` for the easy-mode `Beginner guide` entry; this silently
  replaces the historical beginner workflow with the developer shell.
- Bad: choose the first account model for a Chat Completions curl example
  without checking `supported_endpoint_types`.
- Bad: retrieve a full key so a documentation snippet can be copied in one click.

### 6. Tests Required

- Catalog/runtime unit tests: seven stable articles, neighboring articles,
  placeholder resolution, protocol filtering, and immutable inputs.
- Hook tests: verified model/group combinations, invalid requested values,
  model changes that invalidate a group, empty protocols, rejected queries, and
  unsuccessful responses without payloads.
- Component tests: platform tabs, visible resolved config, safe copy text,
  translated search, mobile titled Sheet, and desktop table-of-contents
  breakpoint.
- Navigation tests: no public guide destination; desktop and compact easy-mode
  navigation expose `Beginner guide` at `/beginner-guide`; developer sidebar
  entry and developer-header fallback remain `/guide`; operator-route tests
  assert `/guide` is developer-only and `/beginner-guide` is not.
- Beginner-guide tests: 31 historical tools, category/search behavior, direct
  tool dialog, runtime address substitution, masked keys, unknown-tool
  fallback, and use-case cards that map to existing tools and narrow/restore the
  wall.
- Localization tests: every catalog/component key exists in all seven locales
  and preserves the English placeholder multiset.

### 7. Wrong vs Correct

#### Wrong

```ts
const model = userModels[0]
const apiKey = await getFullApiKey(keyId)
return template.replace('{{MODEL}}', model).replace('{{KEY}}', apiKey)
```

#### Correct

```ts
const models = filterModelsForAudience(userModels, pricing, audience)
const groups = verifiedGroupsFor(models[0])
return fillGuideTemplate(template, {
  ...runtimeAddress,
  model: models[0],
  group: groups[0],
  platform,
})
```

The correct path derives only display-safe values, and the template resolver
owns the constant masked API-key placeholder.


## Easy-console pricing, keys and reports

### Scope / Trigger
Landing/auth/catalog pricing, key quote/revoke flows, and easy-console reporting.

### Signatures and Contracts
- `buildModelCatalog(models, priceRate)` retains every PricingModel and exposes an optional supported estimator quote. Do not filter discoverable models by calculator eligibility.
- SavingsModel quote numbers already incorporate the recharge price. `formatPerMillionTokens` formats that local amount without applying another USD exchange conversion.
- `getFullApiKey(id)` reveals only through the dedicated endpoint, rejects masked results and normalizes the sk- prefix. Successful creation must refresh keys even when reveal fails.
- `revokeAllApiKeys()` collects all IDs before deleting bounded batches and verifies the final list is empty. Partial/error outcomes refresh the list and never show an all-revoked success.
- Easy key quote cards and key rows show the group name on the first line with a
  `GroupRatioPill` multiplier beside it and the group description underneath.
  `auto` (whose API ratio is the literal `自动`) stays out of the quote cards,
  and key rows omit the pill when no finite ratio is known, so the UI never
  prints an invented `1x` for an unknown multiplier.
- `useUsageSummary(7|10)` uses the authenticated complete summary. Requests keeps pagination; page-only filters are labeled. Home/wallet savings explicitly say 10 days. All three views share the same user/date/offset query cache; use a fixed current UTC offset so ten daily buckets stay within the API limit across DST changes.
- Request rows compare recorded charged quota against the same price with group multiplier 1 via `getLogQuotaComparison`. Use the logged positive user override before group ratio; preserve zero fees, exclude subscription cash comparisons, and show an unavailable mark for missing/invalid rates. Show above-base charges as a surcharge, not savings.
- `buildUsageReportCsv(rows)` exports numeric display amounts with a currency unit, or explicitly labeled raw quota in tokens mode.

- Shared console chrome resolves the active mode with `useConsoleMode`: operator-only paths render developer controls even when the saved preference is easy. Choosing easy on those paths navigates to the easy overview; choosing developer from the easy report opens model analytics. Keep the mode control in the terminal header and use authenticated chrome for signed-in catalog/detail/guide pages.
- Every request row opens the same accessible details sheet. Read billing and usage facts from the selected log; never query current model prices to fill historical gaps. Preserve trigger focus and hide operator diagnostics from the easy sheet.
- Recorded fee quota remains the charged amount even without a valid comparison multiplier. Subscription and violation-fee logs must not invent cash savings. Unit prices are explicitly labeled as pre-discount rates per million tokens; variable dynamic prices remain labeled as dynamic.
- Developer price comparisons use the "Official price" label with a tooltip explaining that values are recorded-base estimates, not independently verified provider prices. Recognized overseas model families display the native official USD amount; domestic and unknown families display CNY. Keep the actual site charge in CNY and compute discounts after converting the overseas reference at `OFFICIAL_PRICE_USD_TO_CNY = 6.75`. Use the unrounded amount for this conversion and do not apply the recharge price to the native USD number. Currency recognition follows the same model-family resolver as the model badge; no official-price feed is implied.
- Per-request billing (`isPerCallBilling(other.model_price)`) does not show original-price or savings comparisons in developer cost cells, easy request rows, or request details. Preserve the actual charge and any subscription/tool-surcharge indicators.
- Configured cache-write ratios, including zero, are displayed even when no cache was written. Claude's recorded 5-minute and 1-hour rates remain separate. Missing historical rates are not filled from current catalog settings.
- Catalog vendor names and icons come from `/api/pricing` metadata. Preserve an explicit vendor icon identifier or image URL. When the icon is absent, resolve known normalized vendor names to their matching icon; an unknown vendor uses its neutral name/initial fallback and must never inherit another provider's branded icon.
- Public visual surfaces and the easy-mode authenticated shell mount at most one shared `GlassCursor`, scoped to their root. `TerminalLayout` owns the `.ci-app` cursor in easy mode, so an authenticated `CatalogPageLayout` defers to that instance in easy mode and keeps its page-owned instance only in developer mode; the anonymous catalog keeps its public-root instance. Home, authentication, catalog and desktop-client pages use the same implementation so fine-pointer tracking, interactive-control scaling, input avoidance, reduced-motion handling and listener cleanup remain consistent.
- Do not display an unconnected reserved-balance metric as a hardcoded zero.

### Validation & Error Matrix
| Input/state | Behavior |
| --- | --- |
| Group ratio/cache rate zero | Preserve free pricing |
| Selected model has no usable group | Disable creation and show an honest empty state |
| Model uses per-request/task/complex tier pricing | Keep it discoverable with a details link |
| Summary unavailable | Error/pending display; no fabricated zero totals |
| Empty/undiscounted auth catalog | Real data or empty state, no fallback marketing prices |
| Retired supplier section | No supplier form or sell-capacity navigation remains on the landing page |

### Good / Base / Bad Cases
- Good: priceRate=7 and displayed quote=7 yields ¥7, not ¥49.
- Base: an existing masked key gets an explicit copy action after reload.
- Bad: reuse the on/off translation for a percentage discount, or apply flex display to td elements.

### Tests Required
Cover 101-key revoke and incomplete deletion, reveal retry without duplicate creation, group changes/free pricing, all pricing modes, complete reports vs a paginated list, stream failures and currency export. Browser/DOM tests cover mobile anchor-close behavior, table-cell layout, visible rate comparisons, absence of retired supplier entry points, a generic easy-mode shell cursor, and exactly one cursor on authenticated catalog pages in either console mode.

### Wrong vs Correct
- Wrong: use catalog discount percentages to estimate savings for historical logs.
- Correct: use recorded-rate summary data from the backend.
- Wrong: use an icon identifier as img.src.
- Correct: use the existing icon renderer for identifiers; image URLs remain image sources.

## Preload-safe authentication navigation

### Scope / Trigger
Authentication guards, legacy URL redirects, and asynchronous profile writes.

### Signatures
- `createInternalRedirect(href: string)` accepts an already validated internal path.
- `auth.setUser(user, expectedSessionId?)` updates the current authenticated profile;
  only `setBundle` establishes authentication.

### Contracts
- Internal guard redirects must provide `to`, parsed `search`, and `hash`. In the
  installed router, `preloadRoute` does not resolve href-only redirects like
  `navigate` does: sign-in can repeatedly preload itself and starve the UI thread.
- Keep intent preloading enabled. Preserve validated return queries, typed search
  values, and fragments through the shared redirect helper.
- Sign-in/sign-up and protected routes must agree that both user and access token
  are required before redirecting an already-authenticated visitor.
- Non-null profile updates require a current token, session, and matching user ID.
  Async callers pass the session ID captured before their request so a late
  response cannot affect a later session, including the same account signing in again.

### Validation & Error Matrix
| Condition | Expected behavior |
| --- | --- |
| Authenticated sign-in preload | Finishes at the validated return target or dashboard |
| User remains without a token | Auth pages remain accessible, no redirect bounce |
| Legacy URL preload | Reaches its mapped target, not the home-page fallback |
| Profile response after sign-out/account or session switch | Does not restore or replace the current user |
| Profile response for the current session | Updates profile while preserving credentials |

### Good / Base / Bad Cases
- Good: `/keys?page=2&tags=["text"]#recent` keeps its typed search and fragment.
- Base: signed-in `/sign-in` preloads the dashboard once; anonymous sign-in remains a form.
- Bad: `redirect({ href: '/dashboard' })` from sign-in with intent preloading enabled.

### Tests Required
- Exercise the actual route guards through a real router's `preloadRoute`, with a
  bounded failure guard so regressions cannot hang the test runner.
- Cover anonymous, complete, and residual-user authentication states, legacy
  targets, query/fragment preservation, and stale profile response transitions.
- Verify desktop/mobile login clicks and continued navigation/scrolling in-browser.

### Wrong vs Correct
```ts
// Wrong for a route guard: the preload path does not interpret href.
throw redirect({ href: validatedTarget, replace: true })
// Correct: normalize the trusted path into router navigation fields.
throw createInternalRedirect(validatedTarget)
```
