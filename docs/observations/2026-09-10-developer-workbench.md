# Developer workbench — approved first phase

## Current implementation after the September 10 follow-up reviews

- Developer header and sidebar use matching Overview and Model Square destinations. The header search field is removed, and rankings retain the authenticated layout and active console mode.
- Signed-in home navigation shows the account avatar/menu and Overview entry. Navigation logos return to the public home; the mascot eyes and highlights are enlarged.
- Request details separate request cost from recorded base unit prices. Configured cache-write rates, including unused and zero rates, are recorded for new requests; historical missing rates are not replaced with today's catalog settings.
- Log comparisons use the requested Official price label with an explicit source explanation. Recognized overseas models show native USD amounts, Chinese models show CNY, and savings use the fixed 6.75 USD-to-CNY comparison rate. Actual site charges remain CNY. Per-request billing has no original-price or savings comparison.
- The home navigation's duplicate Model Price entry is removed. Earlier plans and verification counts below are retained as development history and are superseded by these decisions.

## Latest review: model-card interaction and billing clarity

- [x] Model catalog: clicking a card's body, description or price opens its existing detail sheet. Copy and other nested controls keep their own actions; the Details button remains keyboard accessible.
- [x] Easy reports: all four summary descriptions explicitly identify the last 10 days, with the exact date range above them. Aggregation, period boundaries and export behavior are unchanged.
- [x] Easy request details: remove the Above base row, rename Discount on this request to Discount rate (Chinese: 折扣), and show recorded input/output/cache unit prices with `/M`. Cache writes distinguish 5-minute and 1-hour rates when recorded. Unknown rates stay unavailable; explicit zero prices are preserved. Actual charge and historical billing calculations are unchanged.
- [ ] Await clarification: the homepage Models and Model price entries were mentioned without a requested action. Their existing anchor and catalog destinations remain unchanged.
- Verification: 702 frontend tests passed, 2 skipped; TypeScript, changed-file lint, production build and whitespace checks passed. Browser checks confirmed card-body detail opening, all four report period descriptions, the simplified request detail fields and `/M` prices. At 390px the document and detail panel both measure 390px, without horizontal overflow. The original developer-mode preference was restored and only test-created browser tabs were closed. No production account, billing state, dependency, commit or remote repository changed.

## Latest review: reduce duplicate information and expand glass cursor

- Easy request statistics now contain only total requests, failed requests and usage. On narrow screens the first two share a row and usage spans the next row.
- The existing glass cursor now supports an explicit page selector. The homepage keeps its existing scope; catalog/list/detail layouts and shared authentication pages opt in. Model-detail sheet portals opt in with `data-glass-cursor-surface`. Text inputs, touch/coarse pointers, reduced-motion preferences and unmount cleanup keep the existing behavior.
- Developer log savings show only the discount percentage, including the accessible label. An actual zero recorded charge displays `Cost 0`; subscription billing remains identified as a subscription, not assumed to be zero cash cost.
- Verification: 694 frontend tests passed, 2 skipped; TypeScript, changed-file lint, build and whitespace checks passed. Browser checks verified cursor display on pricing, login and model-detail portals, input avoidance and usable navigation, 26 zero-cost rows and percentage-only savings, and a 390px layout without horizontal overflow. No production account or billing state changed.

## Follow-up polish and rankings fix

- Developer header: search precedes the right-aligned site navigation; navigation stays directly visible. Existing mobile second-row behavior remains.
- Rankings: the local demo API had returned its generic `data: []` fallback, while chart components require nested history objects. The frontend now validates the complete snapshot, normalizes legitimate Go nil slices, and presents a retryable error for malformed responses. The temporary demo API now supplies aggregate model/vendor/history data from its synthetic logs. No production backend code changed.
- Developer price labels are shortened at the user's request to Official price, Yecai price and Cheaper by. The Official price tooltip explicitly identifies the recorded model-base estimate and the lack of independent verification; no new official-pricing feed or historical repricing was introduced.
- Easy requests: the list uses Charge, removes the before-discount estimate field and its obsolete explanatory sentence, and retains Tokens, Charge, Saved and Time taken. Model/time/key identity, status and the details affordance share the top row. Four desktop metric columns become two mobile columns; recorded billing and the complete details sheet remain unchanged.
- Validation: the full frontend suite passed 686 tests (2 skipped). Subsequent copy-only adjustments passed their targeted tests. Browser checks covered populated rankings and period changes, desktop header geometry, short price labels, 390px card layout without horizontal overflow, and opening/closing request details.

## Superseding review: summary overview and log-price comparison

The user's September 10 reference screenshots supersede the request-centric overview below. The developer overview now reuses the original status deck, usage/balance cards and directly visible configured service panels. Individual requests and the setup disclosure are no longer rendered there. Administrator health data remains role-gated, and personal overview queries include the user ID in their cache keys.

Detailed records remain in the existing usage-log table. Its price cell emphasizes the recorded site-base estimate (struck-through amount), Yecai price, saved amount and percentage. The current records do not independently identify a provider-official price; the explicit site-base label remains until that source/meaning is confirmed. Missing reference rates and subscription billing do not invent a discount.

Verification for this revision: 681 frontend tests passed, 2 skipped; TypeScript, changed-file lint, production build and whitespace checks passed. Desktop overview and log-price rows were inspected. At 390px, the price comparison ends at x=354 and document width remains 390px. The earlier plan and outcomes below are retained as decision history.

> Execute inline with `executing-plans` and TDD. The user approved the first-phase design; no new Trellis task, dependency, backend API, commit, or remote operation is included.

**Goal:** Make developer overview an API workbench without changing easy mode or existing business workflows.

**Architecture:** Reuse the complete self-usage summary and paginated self logs. Keep recorded request details in the existing accessible sheet. Group existing navigation by task while retaining role checks, menu configuration and contextual system-settings navigation.

**Stack:** React 19, TanStack Query/Router, Base UI, Tailwind, Vitest, seven-language i18next.

## Scope and contracts

- Overview: personal requests, success rate, tokens and recorded quota for today / last seven days. Zero requests means unavailable success rate, not 100%. Failed APIs show an error, not fabricated zero metrics.
- Recent requests: server-side request-ID search; explicitly label page-local status filtering. Reuse `getUserLogs`, `usageLogSchema`, `isFailedRequest`, `getLogChargedQuota`, `TerminalRequestDetails`. Closing details preserves filters, position and trigger focus.
- Setup: compact, expandable steps and masked request example. Never reveal a key until the user copies. Existing completion logic uses active key, credits and lifetime request count; do not infer historical success from a short reporting window. Copyable Base URL remains visible when collapsed.
- Header (updated after user review): developer global links are directly visible in the header, without a Site dropdown. Wide screens use one row; narrower screens use a second navigation row with a shared header-height token for sidebar/content alignment. Public TopNav retains its responsive layout. Easy header is unchanged.
- Sidebar: Overview, Development, Analytics, Account, Admin. Reuse existing URLs and add no pretend destination for unsupported performance analytics. Preserve task logs and chat presets. New analytics paths share the existing dashboard menu gate. Admin roles retain all existing admin entries.
- Secondary announcements/help/health remain below the requests and behind an expandable section.

## Execution checklist

### 1. Navigation

Files: `web/src/components/layout/components/{top-nav,app-header}.tsx`, `web/src/hooks/{use-sidebar-data,use-sidebar-config}.ts`, dedicated navigation tests.

- [x] RED: keyboard-open Site menu, no duplicate navigation row, existing module disable switches and external docs behavior.
- [x] RED: Development / Analytics / Account grouping, ordinary vs administrator role, dashboard/log menu gates.
- [x] GREEN: add `variant?: 'responsive' | 'menu'` to TopNav; AppHeader uses `variant='menu'`. Rearrange existing nav items; preserve `admin` group ID and `requiredRole` values.
- [x] Run navigation tests and typecheck.

### 2. Workbench and setup

Files: `web/src/features/dashboard/components/overview/{developer-request-workbench,overview-dashboard}.tsx`, `web/src/features/dashboard/index.tsx`, overview tests.

- [x] RED: actual summary (8 requests / 6 successful / 1,200 tokens), period change, search submit, error/empty handling, keyboard details close with filters/focus preserved.
- [x] GREEN: `DeveloperRequestWorkbench` owns period/search/page/filter and selects logs; queries the existing summary hook plus self-log endpoint. Use native form submission and existing Input/Button/Table/Sheet primitives.
- [x] RED: condensed setup, persisted expansion preference, completed setup collapsed, Base URL copy, explicit key reveal only on request copy.
- [x] GREEN: remove large decorative setup panels and duplicate quick actions; retain three steps and request-copy behavior in an accessible disclosure below the metrics and above the request table, keeping Base URL within reach.
- [x] Keep easy overview and other dashboard sections untouched.

### 3. Translation and verification

- [x] Add new source-key translations with `add-missing-keys.mjs` for en, zh, zh-TW, fr, ja, ru, vi; run `bun run i18n:sync`.
- [x] Run focused tests, full frontend tests, `bun run typecheck`, changed-file oxlint, production build and `git diff --check`.
- [x] Browser: desktop/mobile layout, Site menu, sidebar permissions, range/search/filter, details focus/close, Base URL copy, setup and secondary panels, easy-mode regression.
- [x] Self-review focused changes and report results. No account mutations or payment submissions.

## Verification outcome

- First RED run: 7 expected failures, 2 existing permission checks passed. Later tests reproduced compact-guide, loading-state and menu-gate gaps before fixes.
- Final frontend run: 114 test files passed, 1 skipped; 681 tests passed, 2 skipped.
- Changed-file oxlint, TypeScript check, production build and whitespace check passed. All referenced translation keys exist in all seven locales.
- Browser: 390px viewport and document width both 390px; the 574px request table scrolls inside a 366px container. Site menu and mobile sidebar work; selecting an analytics destination closes the sidebar. Request details preserve focus and filters.
- Local demo API now honors request-ID equality like the existing Go endpoint. Restarted only that temporary, synthetic-data service; restored the demo session. Browser search returned the single matching request without changing the period totals.
- Easy-mode overview remains unchanged. No production accounts, payment operations, backend source, dependency files, commits or remote repositories were changed.
