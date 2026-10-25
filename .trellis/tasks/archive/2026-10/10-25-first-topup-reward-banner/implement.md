# Implement plan

Order matters: backend contract first, then the frontend that consumes it.

## Step 1 — backend model and migration
- [ ] Add `PayerScope` to `CashbackCampaign`, plus constants for `''` and
      `first_top_up`.
- [ ] Validate `payer_scope` in `CreateCashbackCampaign` (model and controller
      DTO) and require `max_rewards_per_user == 1` for `first_top_up`.
- [ ] Return the field in the campaign list.

## Step 2 — eligibility
- [ ] In `CompleteTopUpCashbackTx`, add the prior-success check under the
      existing locks. When it fails, write a canceled zero payer reward with
      reason `not_first_top_up`.
- [ ] Preview status `not_first_top_up`.
- [ ] Add `payer_scope` to the public offers DTO.
- [ ] Add `quota_for_new_user` to `/api/status`.

## Step 3 — backend tests (extend existing files)
- [ ] `model/cashback_test.go`: first top-up gets a reward; the second order
      does not; a user with an earlier success (online, manual, partner) does
      not; a first order below every tier makes later orders non-first;
      every-order campaigns are unchanged; preview statuses.
- [ ] `controller/cashback_config_test.go`: create validation (bad scope, max ≠
      1), list includes scope, public offers include scope and no sensitive
      fields.
- [ ] `model/cashback_integration_test.go`: concurrent two-order completion on
      PostgreSQL gives at most one first reward.
- [ ] Commands: `make test`; real PostgreSQL only, in a disposable Docker
      container (fresh DB, upgrade from latest release schema, migrate twice).
      Record the version and results. SQLite and MySQL are not verified (user
      decision); state that in the delivery note.

## Step 4 — Root campaign UI
- [ ] `web/src/features/system-settings/billing/cashback-campaigns.tsx`: add a
      "first top-up only" toggle. When on, lock max rewards to 1. Show the scope
      in the list.
- [ ] Types in `web/src/features/cashback/types.ts`.
- [ ] Wallet preview message for `not_first_top_up`.

## Step 5 — banner
- [ ] Add `web/src/features/reward-banner/` (component, api hook, rule→text
      builder in `lib/`).
- [ ] Mount it in `__root.tsx` with route exclusions.
- [ ] Audit full-height layouts (authenticated shell, landing, pricing) for
      overflow.
- [ ] Add dismissal keyed by a rules hash.
- [ ] Add i18n keys in all seven locales (`bun run i18n:sync`).
- [ ] Tests under `__tests__/`: text builder (tiered, per_hundred, rate, scope
      wording, no offer → null, grant only), visibility (error hides,
      excluded routes, dismiss and reappear on rule change), CTA target by auth
      state.

## Step 6 — checks
- [ ] `bun run typecheck`, oxlint on touched files, oxfmt, `bun run test`
      (affected suites), `bun run build`.
- [ ] Browser check of the banner on home, pricing and console at desktop and
      360px widths, in light and dark themes.

## Step 7 — spec and commit
- [ ] Update `.trellis/spec/backend/referral-recharge-cashback.md` (design §8).
- [ ] Separate commits: backend, frontend, spec/trellis.

## Rollback points
- After Step 3: the backend can ship alone (the new field is unused by the old
  UI).
- The banner is isolated in one mount point; remove the mount to disable it.
