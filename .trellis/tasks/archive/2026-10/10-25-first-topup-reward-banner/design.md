# Design: first-top-up campaigns and the site-wide reward banner

Contract: `.trellis/spec/backend/referral-recharge-cashback.md` (read in full). This
task extends the payer (wire value `invitee`) campaign path; inviter cashback is
unchanged.

## 1. Data model

`CashbackCampaign` gains one immutable column:

```go
PayerScope string `json:"payer_scope" gorm:"type:varchar(32);not null;default:''"`
```

- `''` = every eligible order (all existing rows; no backfill).
- `first_top_up` = only the payer's first successful top-up.
- A string instead of a bool avoids the MySQL/PostgreSQL boolean-default
  normalization that makes `AutoMigrate` re-run `ALTER TABLE` (AGENTS.md 7.4),
  and leaves room for later scopes.
- Added through `AutoMigrate` (`ADD COLUMN`), no `ALTER COLUMN`; code stays
  dialect-neutral (GORM only). Verification runs on **real PostgreSQL only**
  (user decision 2026-10-25): fresh DB, upgrade from the latest released schema,
  and migrating twice. SQLite and MySQL are not verified, and the delivery note
  must say so.

## 2. Campaign creation

- `POST /api/cashback/campaigns` accepts optional `payer_scope` (`''` or
  `first_top_up`; anything else → 400 with `field=payer_scope`).
- `first_top_up` requires `max_rewards_per_user == 1`. Any other value returns
  400, so a campaign never claims more than one first top-up.
- The list response returns `payer_scope`. Campaigns stay immutable: stopping a
  campaign does not touch the scope.

## 3. Eligibility at payment completion

In `CompleteTopUpCashbackTx` (`model/cashback_rewards.go`), after the
campaign is resolved and the payer and inviter rows are locked in ascending ID
order:

```text
if campaign.PayerScope == first_top_up:
    prior = count(TopUp where user_id = payer AND status = success AND id <> topUp.Id)
    if prior > 0: the payer direction becomes a canceled zero reward with
                  reason "not_first_top_up" (explainable record, uses no campaign slot)
```

- Counts any successful `TopUp`: online, Partner OAuth balance payment, and
  admin manual completion. Redemption codes and registration grants are not
  `TopUp` rows, so they do not count. The implementer must confirm that
  subscription purchases do not write `TopUp` rows with `status=success`; if
  they do, exclude them and record the evidence in research/.
- Concurrency: the payer row lock already serializes completions for that
  user, and the READ COMMITTED provider transaction sees the earlier committed
  success. So of two concurrent orders, at most one is first. Prove it with the
  PostgreSQL integration test.
- The first top-up is final even when it earns nothing: if the first order is
  below every tier, it gets a zero reward and later orders are not first. The
  banner wording ("首充满 ¥100 送 …") makes this explicit.
- Inviter rewards on the same order are unaffected.

## 4. Preview

`GET /api/user/topup/cashback-preview`: under a `first_top_up` campaign, if
the user has a prior successful top-up, return the new status
`not_first_top_up` with zero reward. The status is checked before the slot and
cap math and is distinct from `limit_reached`. The wallet UI shows a localized
message for it.

## 5. Public data for the banner

- `GET /api/cashback/public-offers`: the `invitee` offer adds whitelisted
  `payer_scope`. No other field changes, and errors still return 503.
- `GET /api/status` adds `quota_for_new_user` (`common.QuotaForNewUser`). The
  banner shows the registration grant only when it is > 0 and
  `register_enabled` is true.

## 6. Frontend banner

- New component `web/src/features/reward-banner/` mounted in
  `web/src/routes/__root.tsx` above `<Outlet />`.
- Hidden on routes where marketing would interfere: `/setup`, `/oauth/*`,
  `/desktop/*`, error routes. Shown everywhere else, including
  `_authenticated` console pages.
- Content is generated from live data, never typed by admins:
  - `新用户注册送 {quota}` when the grant is > 0 and registration is open (quota
    formatted with `@/lib/currency`).
  - Payer offer: tiered → `首充 ¥100 送 ¥5 · ¥300 送 ¥8` (`充值` instead of
    `首充` when the scope is empty); per_hundred → `首充每满 ¥100 送 ¥X`;
    rate → `首充返 X%`. Tier cents are CNY.
  - CTA `去充值 →`: anonymous users go to `/sign-up`, signed-in users to the
    wallet top-up route.
  - No registration grant and no payer offer: the banner does not render.
- Freshness: React Query, refetch every 60s and on window focus. A failed read
  hides the banner (never shows a withdrawn rule). During a background refresh
  the last successful result stays visible to avoid a 60s flicker. The spec
  will record this as the banner-specific rule, different from the campaign
  page's hide-during-refresh rule.
- Dismiss: a close button stores a hash of the rendered rules in localStorage
  (wrapped in try/catch). The banner reappears when the rules change.
- Layout: the banner sits in normal flow. Full-height layouts
  (`_authenticated` sidebar shell using `h-svh`/`min-h-svh`, landing page) must
  not overflow or double-scroll. The implementer audits them and uses a CSS
  variable `--reward-banner-height` where a layout needs to subtract it.
- Visual: a full-width strip like the reference (brand accent background,
  centered text, underlined CTA); text truncates or wraps cleanly at 360px; and
  it works in light and dark themes.
- i18n: all strings in seven locales, with interpolation for amounts.

## 7. Compatibility and rollback

- Old campaigns keep `payer_scope=''` and behave exactly as before.
- Rollback: the old binary ignores the extra column, so an old binary treats a
  first-top-up campaign as an every-order campaign. Stop any first-top-up
  campaign before rolling back.
- No change to settlement, review, incident, or Redis fence code paths.

## 8. Spec updates

Update `referral-recharge-cashback.md`: campaign `payer_scope`, the
`not_first_top_up` cancellation and preview status, the public-offers field,
the banner freshness rule, and the tests-required list.
