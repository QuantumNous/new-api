# Invite Reward On API Key Create Design

## Background

The current invitation reward flow grants new-user and invitation-related quota too early: user creation can assign `QuotaForNewUser`, and invitation rewards are handled during user finalization in `model.User.Insert` / `FinalizeOAuthUserCreation`. This creates an easy abuse path where batches of referred accounts can collect value immediately after registration.

The desired V1 change is to delay both inviter and invitee invitation rewards until the invited user creates their first user-side API key. This keeps onboarding lightweight and does not require card binding or top-up.

## Goals

- Do not grant inviter or invitee invitation rewards at registration time.
- Grant both inviter and invitee rewards immediately after the invited user successfully creates their first API key.
- Count both manual key creation and the new-user onboarding key creation path:
  - `POST /api/token/`
  - `POST /api/token/ensure_initial` only when `created == true`
- Exclude registration-time default tokens created by `GENERATE_DEFAULT_TOKEN`.
- Make reward granting idempotent and safe under multi-node production.
- Keep model invocation paths unaffected; no extra checks on `/v1` relay traffic.

## Non-Goals

- No IP, IP prefix, ASN, User-Agent, language, timezone, or prompt-similarity limits in V1.
- No delayed settlement window in V1; successful trigger grants immediately.
- No payment, card-binding, or recharge requirement.
- No backfill for historical referral relationships; this V1 applies to users registered after the new pending state is written.
- Update the wallet Referral Program description as deterrent/fraud-friction copy: users should see that rewards are issued after the invited user creates an API key and successfully calls the API. This copy is intentionally stricter than the backend V1 trigger and does not change backend grant semantics.

## Inviter Reward Cap

An inviter account can receive at most `QuotaForInviterMaxCount` inviter rewards. Default is `5`; `0` disables this limit. The setting is editable in the quota settings section. This cap only limits the inviter-side reward; the invited user still receives the invitee-side reward when the trigger is otherwise valid.

## Current Relevant Paths

- Password register: `controller.Register` calls `model.User.Insert`.
- OAuth register: `controller.findOrCreateOAuthUser` calls `model.User.InsertWithTx`, then `FinalizeOAuthUserCreation`.
- Manual API key creation: `controller.AddToken` calls `model.CreateUserToken`.
- Onboarding auto-create key: `controller.EnsureInitialToken` calls `model.EnsureInitialUserToken`; it returns `created == true` only when the user had no existing token.
- Registration-time default token: `controller.Register` conditionally creates a token when `constant.GenerateDefaultToken` is enabled. This path must not trigger invitation rewards.

## Reward State

Add invite reward state to the user record:

```text
invite_reward_status:
- none: no invitation reward pending
- pending: invited user has registered, waiting for first user-side API key creation
- granted: inviter and invitee rewards have been granted or intentionally no-op because configured reward amounts are zero
- blocked: reward permanently skipped due to an invariant failure or future policy rule
```

Registration behavior:

```text
inviter_id > 0 -> invite_reward_status = pending
inviter_id = 0 -> invite_reward_status = none
```

## Event Table

Create an `invite_reward_events` table to make granting auditable and idempotent:

```text
id
invitee_id              unique
inviter_id              indexed
trigger_type            manual_token_create | initial_token_create
trigger_token_id
inviter_reward_quota
invitee_reward_quota
status                  granted | blocked
reason
created_at
```

The unique constraint on `invitee_id` is the hard DB guard against duplicate rewards.

## Trigger Rules

After a user-side API key is created:

1. User-facing token creation wrappers call `tryGrantInviteRewardInTx(tx, userID, tokenID, triggerType)` in the same DB transaction that inserts the token. The public `TryGrantInviteRewardAfterTokenCreated(userID, tokenID, triggerType)` wrapper exists only for direct retry/tests and opens its own transaction.
2. If the user has no inviter or is not `pending`, return without changing quota or creating an event.
3. Optionally acquire a short Redis lock when Redis is available and `common.RDB != nil`: `invite_reward:{invitee_id}`. This is only a duplicate-work reducer, not correctness-critical.
4. In a DB transaction, lock the invitee row where supported.
5. Re-check `invite_reward_status == pending` and `inviter_id > 0`.
6. Lock the inviter row. If `QuotaForInviterMaxCount > 0` and the inviter's `aff_count >= QuotaForInviterMaxCount`, set this event's `inviter_reward_quota = 0` and `reason = inviter_limit_reached`; continue granting the invitee reward.
7. Insert `invite_reward_events(invitee_id unique, ...)` with an insert-ignore / do-nothing-on-conflict strategy. If no row is inserted, treat the reward as already handled.
8. Increase invitee quota by `QuotaForInvitee` when positive using an atomic DB update.
9. Increase inviter invitation quota counters by `QuotaForInviter` when positive using atomic DB updates, not read-modify-save.
10. Set invitee `invite_reward_status = granted` with a `WHERE invite_reward_status = pending` guard.
11. Record system logs for both users after the transaction commits, only when a new grant actually happened and the corresponding reward amount is positive.
12. Invalidate affected user caches after the transaction commits.

The function must treat zero configured rewards as successful completion and set `granted`, so pending users do not keep retrying forever.

## Included Token Creation Paths

Manual key creation:

```text
POST /api/token/
CreateUserToken success -> trigger manual_token_create
```

Onboarding key creation:

```text
POST /api/token/ensure_initial
EnsureInitialUserToken returns created == true -> trigger initial_token_create
EnsureInitialUserToken returns created == false -> do not trigger
```

Excluded token creation:

```text
GENERATE_DEFAULT_TOKEN registration default token -> do not trigger
Admin-created or admin-updated tokens -> do not trigger
Token update/delete/key reveal -> do not trigger
```

## Idempotency And Multi-Node Safety

- Redis lock reduces duplicate work across app instances when available, but must be skipped safely when Redis is disabled or `common.RDB` is nil.
- The transaction and unique `invitee_id` event constraint are the source of truth.
- If Redis is unavailable, DB uniqueness still prevents double granting.
- If quota updates fail, the transaction rolls back and the reward can be retried by a later valid token creation only if the event/status was not committed.
- `EnsureInitialUserToken` already locks the user row and only creates a token when no token exists; reward logic still must be independently idempotent.
- `SELECT ... FOR UPDATE` is not equally strong on every supported database, especially SQLite, so correctness must not depend on row locking alone. The unique event constraint plus atomic updates are mandatory.

## Frontend Copy

Update `web/default/src/features/wallet/components/affiliate-rewards-card.tsx` in the Referral Program card. Replace the current top-up-based description with:

```text
Rewards are issued after your referral creates their first API key and successfully calls the API.
```

Chinese translation:

```text
被邀请用户首次创建 API 令牌并成功调用接口后，奖励才会发放。
```

Add this key to all eight frontend locale files (`en`, `zh`, `fr`, `ja`, `ru`, `vi`, `es`, `pt`) and run `bun run i18n:sync`.

Important: this is user-facing deterrent copy and is intentionally stricter than the V1 backend trigger. Do not add `/v1` model-call reward checks solely to match this copy.

## Admin And Observability

V1 should expose reward state in admin user detail if the existing response already returns user model fields. At minimum, the backend should persist:

```text
invite_reward_status
invite_reward_granted_at
invite_reward_block_reason
```

Events provide auditability for support and future fraud rules.

## Tests

Backend tests should cover:

- Registration with inviter sets status `pending` and does not grant rewards.
- Registration without inviter sets status `none`.
- Manual token creation grants both rewards for pending invitee exactly once.
- `ensure_initial` with `created == true` grants both rewards.
- `ensure_initial` with an existing token does not grant rewards.
- `GENERATE_DEFAULT_TOKEN` registration token does not grant rewards.
- Concurrent reward attempts for the same invitee create one event and grant quota once.
- Inviter reward cap skips only the inviter-side reward once an inviter has already received the configured number of inviter rewards; the invitee-side reward is still granted.
- Zero reward config still changes status to `granted`.
- Wallet Referral Program copy uses the stricter "first API key and successful API call" deterrent message in all locales, while backend V1 still grants on first eligible key creation.

## Deployment Notes

Router deploy: required.

Reason: the change affects user registration, API key creation, user quota, invitation reward accounting, and authenticated API behavior under `/api/token`.

Other deploy targets: `newapi-console` should be deployed because the console calls the affected token endpoints and displays the updated Referral Program copy. `newapi-web` is not involved. No Terraform or Cloudflare change is required.

Risk / validation: validate with focused controller/model tests, then run a broader Go test slice for `model`, `controller`, and token/user registration tests. Verify staging registration, `/keys?create=1` onboarding, manual key creation reward grant, and wallet copy before production.
Production database is MySQL, so include a MySQL-backed validation pass for the invite reward event unique index, duplicate grant prevention, and token-create transaction rollback before production release. SQLite/PostgreSQL compatibility should remain supported by GORM-compatible schema and focused tests.
