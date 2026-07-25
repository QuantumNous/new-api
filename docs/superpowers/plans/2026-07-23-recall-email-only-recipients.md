# Email-only Recall Recipients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every valid manually entered address a real recall recipient even when no Flatkey user exists, while preserving account safety, claim attribution, unsubscribe behavior, and multi-node idempotency.

**Architecture:** Introduce a stable `recipient_identity` (`user:<id>` or `email:<sha256(normalized email)>`) and move campaign uniqueness and recipient/message alignment to it. Email-only recipients retain `user_id = 0`, receive a Customer-unbound single-use Stripe Promotion Code, and bind atomically to a matching authenticated account when claimed. New unsubscribe links identify recipients, so unbound addresses are suppressed locally and bound users retain the existing global opt-out behavior.

**Tech Stack:** Go 1.22+, GORM v2, SQLite/MySQL/PostgreSQL, Stripe Go SDK, Gin, Go tests, React/Bun regression checks.

---

## File structure

- `model/recall_recipient.go` — recipient identity primitives, candidate facts, insert idempotency, account binding, and recipient suppression.
- `model/recall_event.go` — campaign-run inserts and message alignment by recipient identity.
- `model/main.go` — three-database legacy identity backfill and index replacement.
- `service/recall_audience.go` — email-only eligibility and privacy-safe snapshots.
- `service/recall_campaign.go` — activation and recurring user/identity/email deduplication.
- `service/recall_stripe.go`, `service/recall_worker.go` — Customer-free Promotion Code provisioning.
- `model/recall_message.go`, `service/recall_email.go` — work items and send/stop checks without a user row.
- `service/recall_claim.go` — matching-email claim binding and versioned recipient unsubscribe.
- Existing recall tests in `model/`, `service/`, and `controller/` — red/green coverage for each boundary.

### Task 1: Emit email-only specified-audience facts

**Files:**
- Modify: `model/recall_recipient.go`
- Modify: `service/recall_audience.go`
- Test: `model/recall_repository_test.go`
- Test: `service/recall_audience_test.go`

- [ ] **Step 1: Keep the existing selector regression RED and add a repository RED**

The existing `TestRecallAudienceSpecifiedUsersUsesExactUnionAndSafetyExclusions` must expect the unresolved `missing@example.com` entry as a fourth recipient with `UserId == 0`, `EmailSnapshot == "missing@example.com"`, language `en`, and no full email in `EligibilitySnapshot`.

Add `TestListRecallCandidateFactsSpecifiedUnionIncludesUnmatchedEmails` with an ID-selected user, an email-matched user, their overlap, a disabled matching account, and `missing@example.com`. Assert the unmatched fact has the exact normalized email, `User.Id == 0`, and a deterministic hashed identity, while the disabled address remains represented only by its real user fact.

- [ ] **Step 2: Run RED tests**

```powershell
go test ./model ./service -run 'TestListRecallCandidateFactsSpecifiedUnionIncludesUnmatchedEmails|TestRecallAudienceSpecifiedUsersUsesExactUnionAndSafetyExclusions' -count=1
```

Expected: FAIL because unmatched emails are currently dropped by the `users` query.

- [ ] **Step 3: Add identity primitives and an explicit email-only fact**

Add these model contracts:

```go
func RecallRecipientIdentityForUser(userID int) string
func RecallRecipientIdentityForEmail(email string) string

type RecallCandidateFact struct {
    RecipientIdentity string
    Email              string
    EmailOnly          bool
    User               User
    HasPayment         bool
    PaidAmount         float64
    LastPaymentAt      int64
    SubscriptionAmount float64
    SubscriptionCount int64
    LastSubscriptionEndAt int64
    HasActiveSubscription bool
}
```

`RecallRecipientIdentityForEmail` must trim and lowercase the address, hash it with SHA-256, and return `email:` plus lowercase hexadecimal. User facts receive `user:<id>`. In `specified_users`, query at most the normalized identifier count (already capped at 500), record every email matched by any returned user before safety filtering, and append one `EmailOnly` fact for each unmatched normalized email. Return the specified list in one bounded call so email-only facts are not repeated by the user-ID cursor.

- [ ] **Step 4: Branch account safety from email-only selection**

Extend `recallAudienceSelection` with `RecipientIdentity string`. For `EmailOnly` facts, validate `fact.Email`, create the normal eligibility snapshot with `user_id = 0` and zero account facts, mask the email, use language `en`, and skip account status, setting, verified-email, payment, group, and API-activity checks. For real users, preserve all existing checks and use the user identity.

Carry the identity in `recallAudienceSelection`; Task 2 adds the persisted field and Task 3 writes it explicitly during snapshot construction.

- [ ] **Step 5: Run GREEN tests and focused compatibility**

```powershell
go test ./model ./service -run 'RecallCandidate|RecallAudience' -count=1
```

Expected: PASS with existing audience templates unchanged.

- [ ] **Step 6: Commit with Lore trailers**

```text
Include manually entered addresses in exact activity audiences

Constraint: Existing-account safety exclusions must not fall back to anonymous email delivery.
Rejected: Creating synthetic users | Campaign delivery must not create accounts.
Confidence: high
Scope-risk: moderate
Tested: Focused candidate and audience tests.
```

### Task 2: Migrate persistence and idempotency to recipient identity

**Files:**
- Modify: `model/recall_recipient.go`
- Modify: `model/recall_event.go`
- Modify: `model/main.go`
- Modify: `service/recall_audience.go`
- Test: `model/recall_repository_test.go`

- [ ] **Step 1: Add RED repository and migration tests**

Cover all of these claims:

```go
first := RecallRecipient{CampaignId: campaignID, UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: "one@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued}
second := RecallRecipient{CampaignId: campaignID, UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: "two@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued}
duplicate := RecallRecipient{CampaignId: campaignID, UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: " ONE@example.com ", LanguageSnapshot: "en", State: RecallRecipientQueued}
require.NoError(t, DB.Create(&first).Error)
require.NoError(t, DB.Create(&second).Error)
require.Error(t, DB.Create(&duplicate).Error)
```

Add a legacy SQLite fixture with `idx_recall_campaign_user`, no identity column, and two user-backed rows. Run the identity migration and assert `user:<id>` backfill, `idx_recall_campaign_identity` uniqueness, and removal of the old index. Extend run-insert tests so recipient/message alignment works for two `UserId == 0` recipients.

- [ ] **Step 2: Run RED tests**

```powershell
go test ./model -run 'RecallRecipientIdentity|RecallRecipientMigration|RecallRun.*Identity' -count=1
```

Expected: FAIL because the field, index, migration, and identity-based joins do not exist.

- [ ] **Step 3: Add the persisted identity and create hook**

Use this schema contract:

```go
CampaignId        int64  `json:"campaign_id" gorm:"uniqueIndex:idx_recall_campaign_identity,priority:1;index"`
RecipientIdentity string `json:"-" gorm:"type:varchar(80);not null;default:'';uniqueIndex:idx_recall_campaign_identity,priority:2"`
UserId            int    `json:"user_id" gorm:"default:0;index"`
```

Add `BeforeCreate(*gorm.DB) error` to derive a missing identity from positive `UserId`, otherwise from a valid `EmailSnapshot`. It must preserve an explicitly supplied identity and reject a recipient that has neither a user nor a valid delivery address.

- [ ] **Step 4: Add the ordered cross-database migration**

Before normal `AutoMigrate` processes an existing recall table, use `Migrator().AddColumn` to add the defaulted identity column, backfill empty rows through Go helpers (`user:<id>` or hashed `email_snapshot`), create `idx_recall_campaign_identity`, then drop `idx_recall_campaign_user`. The helper must no-op for a missing table and repeat safely when the new index already exists. Invoke it from both `migrateDB` and `migrateDBFast`; fresh databases let `AutoMigrate` create the tagged index.

The migration runs only on the configured master node, matching existing startup behavior. Keep the new index live before removing the old one so a failure never leaves recipients without a uniqueness gate.

- [ ] **Step 5: Switch both run-commit funnels to identity**

In `InsertRecallRecipientsAndRunEvent` and `CommitRecallCampaignRun`:

```go
Columns: []clause.Column{{Name: "campaign_id"}, {Name: "recipient_identity"}}
```

Normalize every recipient before insertion, fetch persisted rows by `campaign_id` plus `recipient_identity IN ?`, build `map[string]int64`, and assign every message by the matching identity. Error text must reference recipient identity rather than a possibly-zero user ID.

Write `selection.RecipientIdentity` into `RecallRecipient.RecipientIdentity` in the non-recurring audience snapshot. The create hook remains a compatibility fallback for older call sites and direct test fixtures.

- [ ] **Step 6: Run GREEN and idempotency stress tests**

```powershell
go test ./model -run 'RecallRecipient|RecallRun|RecallCampaignRun|RecallRepository' -count=20
```

Expected: PASS with one recipient/message per identity under replay and concurrent workers.

- [ ] **Step 7: Commit with Lore trailers**

```text
Give every activity recipient a durable campaign identity

Constraint: SQLite, MySQL, and PostgreSQL must migrate existing user recipients safely.
Rejected: Keeping campaign-user uniqueness | Multiple external addresses share user_id zero.
Confidence: high
Scope-risk: broad
Directive: Never change recipient_identity when an email-only recipient later binds a user.
Tested: Repository migration, uniqueness, alignment, and replay stress tests.
```

### Task 3: Keep activation and recurring enrollment exact

**Files:**
- Modify: `model/recall_recipient.go`
- Modify: `service/recall_campaign.go`
- Test: `service/recall_campaign_test.go`
- Test: `model/recall_repository_test.go`

- [ ] **Step 1: Add RED activation and recurrence tests**

Change the specified-user preview/activation fixture from two resolved accounts to two accounts plus `missing@example.com`. Assert preview and persisted recipient totals are three, the external row has `user_id = 0`, and all three stage-one messages reference the correct persisted recipient.

Add a recurring test where an email-only recipient already exists, then a real user registers with the same normalized email. The next run must not create `user:<id>` as a second recipient. Also retain a user-ID dedup case where the account changes email.

- [ ] **Step 2: Run RED tests**

```powershell
go test ./service ./model -run 'RecallCampaign.*Specified|RecallCampaign.*Recurring.*Identity|RecallRun.*Identity' -count=1
```

- [ ] **Step 3: Load all three recurring dedup keys**

Replace the user-only lookup with a repository result containing:

```go
type RecallCampaignRecipientKeys struct {
    Identities map[string]struct{}
    UserIDs     map[int]struct{}
    Emails      map[string]struct{}
}
```

Normalize `email_snapshot` with the same strict lowercase/trim rule. `snapshotRecurringAudience` skips a selection when its identity already exists, its positive user ID is enrolled, or its normalized email is enrolled. Add each accepted selection to all applicable in-memory sets immediately so duplicates within one snapshot are also suppressed.

- [ ] **Step 4: Run GREEN tests**

```powershell
go test ./service ./model -run 'RecallCampaign|RecallRun' -count=1
```

- [ ] **Step 5: Commit with Lore trailers**

```text
Keep recurring activity enrollment stable across account creation

Constraint: An email identity may later resolve to a user identity without becoming a second recipient.
Confidence: high
Scope-risk: moderate
Tested: Specified activation and recurring identity/user/email dedup tests.
```

### Task 4: Bind claims and unsubscribe by recipient

**Files:**
- Modify: `model/recall_recipient.go`
- Modify: `service/recall_claim.go`
- Test: `model/recall_repository_test.go`
- Test: `service/recall_claim_test.go`

- [ ] **Step 1: Add RED claim and unsubscribe tests**

Create an active email-only recipient with a valid claim hash. Assert:

- a logged-in user whose normalized email matches validates the claim and the row is atomically updated from `user_id = 0` to that user;
- another account with a different email receives `ErrRecallClaimWrongUser` and the row remains unbound;
- a second bind cannot replace the first user;
- a recipient-token unsubscribe before binding suppresses only that recipient and cancels only its pending messages;
- the same recipient token after binding sets the existing global `RecallMarketingOptOut` and cancels all pending recall messages for that user;
- existing version-1 user unsubscribe tokens still work.

- [ ] **Step 2: Run RED tests**

```powershell
go test ./model ./service -run 'RecallRecipientBind|RecallClaim.*EmailOnly|RecallClaim.*Unsubscribe' -count=1
```

- [ ] **Step 3: Add conditional account binding**

Implement:

```go
func BindRecallRecipientUserWithContext(ctx context.Context, recipientID int64, userID int, normalizedEmail string) (*RecallRecipient, bool, error)
```

The update predicate is `id = ? AND user_id = 0 AND LOWER(email_snapshot) = ?`. On zero affected rows, reload: the operation is idempotent only when the stored user equals `userID`; any other stored user is a binding conflict. Do not update `recipient_identity`.

In claim validation, after hash comparison, load the authenticated user only when the recipient is unbound, require an enabled account and strict normalized email equality, call the conditional bind, and continue with the refreshed recipient. Preserve the existing direct user-ID comparison for already-bound recipients.

- [ ] **Step 4: Add version-2 recipient unsubscribe tokens**

Keep version 1 `{v,u,e}` parsing. Add version 2 `{v,r,e}` plus:

```go
func (s *RecallClaimService) CreateRecipientUnsubscribeToken(recipientID int64, expiresAt time.Time) (string, error)
func SuppressRecallRecipientWithContext(ctx context.Context, recipientID int64, now int64) (bool, error)
```

Version 2 reloads the recipient at unsubscribe time. Positive `UserId` delegates to the existing global opt-out transaction. Zero `UserId` atomically marks only that recipient `suppressed` and cancels its scheduled/retry/leased/sending messages with cleared leases. Repeated valid unsubscribes succeed idempotently.

- [ ] **Step 5: Run GREEN and repeat binding tests**

```powershell
go test ./model ./service -run 'RecallRecipientBind|RecallClaim' -count=20
```

- [ ] **Step 6: Commit with Lore trailers**

```text
Bind emailed offers only to matching Flatkey accounts

Constraint: Forwarded links and competing nodes must not reassign a recipient.
Rejected: Binding by claim possession alone | The authenticated account email must match the delivery snapshot.
Confidence: high
Scope-risk: broad
Directive: Version-one user unsubscribe tokens remain valid until their natural expiry.
Tested: Claim binding, mismatch, CAS repetition, local unsubscribe, global opt-out, and legacy tokens.
```

### Task 5: Provision a single-use Promotion Code without a Customer

**Files:**
- Modify: `service/recall_stripe.go`
- Modify: `service/recall_worker.go`
- Test: `service/recall_stripe_test.go`
- Test: `service/recall_worker_test.go`

- [ ] **Step 1: Add RED Stripe and worker tests**

For `UserId == 0`, assert the worker never calls `GetCustomer` or `CreateCustomer`, advances queued to customer-ready, creates one Promotion Code, schedules stage one, and leaves `StripeCustomerId` empty. Captured Stripe params must have `Customer == nil`, `MaxRedemptions == 1`, the existing coupon/code/expiry restrictions, recipient/campaign metadata, and no fake `flatkey_user_id`.

- [ ] **Step 2: Run RED tests**

```powershell
go test ./service -run 'RecallStripe.*EmailOnly|RecallWorker.*EmailOnly' -count=1
```

- [ ] **Step 3: Make Customer optional only for email-only recipients**

In `ensureRecipientCustomer`, when `recipient.UserId == 0`, advance the leased row directly from queued to customer-ready without any user or Stripe Customer call. Existing users keep the full Customer validation/write-back/email-sync path.

Allow `CreateRecipientPromotion` to receive a zero-value user only when the recipient is email-only. `buildRecallPromotionParams` sets `params.Customer` and `flatkey_user_id` metadata only when a non-empty Customer and positive user ID exist. All recipients retain `MaxRedemptions = 1` and the same deterministic `recall_promotion:<campaign>:<recipient>:<attempt>` idempotency key.

- [ ] **Step 4: Run GREEN and existing Stripe regressions**

```powershell
go test ./service -run 'RecallStripe|RecallWorker' -count=1
```

- [ ] **Step 5: Commit with Lore trailers**

```text
Issue single-use offers before an account or Customer exists

Constraint: Stripe Customer binding is impossible for an address with no Flatkey user.
Rejected: Creating a synthetic Stripe Customer | It would not have a stable Flatkey account owner.
Confidence: high
Scope-risk: broad
Directive: Customer-unbound codes remain max_redemptions one and claim links still require matching-email login.
Tested: Stripe param and recipient worker email-only regressions.
```

### Task 6: Deliver email without requiring a user row

**Files:**
- Modify: `model/recall_message.go`
- Modify: `service/recall_email.go`
- Test: `model/recall_worker_test.go`
- Test: `service/recall_email_test.go`

- [ ] **Step 1: Add RED work-item and send tests**

Create a leased message for a `UserId == 0` recipient with no matching `users` row. Assert the work item loads, the email worker sends to `EmailSnapshot`, uses snapshot language/default `en`, includes a valid recipient unsubscribe URL, and reaches accepted. Assert payment/API activity model lookups are skipped. Add one invalid snapshot-email case that cancels with `email_unavailable`.

- [ ] **Step 2: Run RED tests**

```powershell
go test ./model ./service -run 'RecallEmailWorkItem.*EmailOnly|RecallEmail.*EmailOnly' -count=1
```

- [ ] **Step 3: Make the user relation conditional**

In `getRecallEmailWorkItemForLeaseWithContext`, load `item.User` only when `Recipient.UserId > 0`; missing bound users remain an error. In `RunBatch`, add API-activity checks only for positive user IDs.

In `recallEmailStopReason`, always validate `EmailSnapshot`, campaign/recipient state, feature flag, promotion availability, and expiry. When `UserId == 0`, return after those shared checks and skip user status/current-email/opt-out/payment/API conditions. When bound, preserve all existing checks.

Use `CreateRecipientUnsubscribeToken(item.Recipient.Id, time.Unix(item.Recipient.PromotionExpiresAt, 0))` instead of the legacy user-token creator. Continue sending to `item.Recipient.EmailSnapshot` and retain stable Message-ID and uncertain-send behavior.

- [ ] **Step 4: Run GREEN and sequencing regressions**

```powershell
go test ./model ./service -run 'RecallEmail|EmailMessage' -count=1
```

- [ ] **Step 5: Commit with Lore trailers**

```text
Deliver configured activity email before account creation

Constraint: No user row exists for a manually entered external address.
Confidence: high
Scope-risk: moderate
Directive: Account-only return checks start immediately after a recipient is bound.
Tested: Work-item loading, email-only send, unsubscribe link, stop checks, and sequencing tests.
```

### Task 7: Expose safe preview evidence and verify the release

**Files:**
- Modify: `controller/recall_campaign_test.go`
- Modify only on discovered defect: recall production files owned by Tasks 1-6
- Modify: `docs/superpowers/specs/2026-07-22-activity-configuration-audiences-design.md`

- [ ] **Step 1: Add the controller preview regression**

Preview a specified audience containing an unmatched address. Assert the response increments `eligible_total`, includes a sample with `user_id = 0` and masked email, and contains neither the raw email nor `recipient_identity`.

- [ ] **Step 2: Run backend verification**

```powershell
go test ./model ./service ./controller ./router -run 'Recall|recall' -count=1
go test ./model ./service ./controller ./router -count=1
go test ./... -count=1
go build ./...
```

- [ ] **Step 3: Run frontend regression verification**

```powershell
Set-Location web/default
bun test src/features/recall-campaigns src/hooks/use-sidebar-data.test.ts src/components/multi-select.test.tsx
bun run typecheck
bun run build:check
```

- [ ] **Step 4: Browser smoke the admin flow**

Create a specified-users draft with one searched account and one address absent from the system. Confirm preview shows two masked recipients, save/reload preserves both inputs, activation creates both recipient rows, the admin list masks both addresses, and a normal user cannot access the page or admin APIs. Use local fakes only; do not send a production email or create production Stripe objects.

- [ ] **Step 5: Request independent review and fix findings**

Review the full diff from `c1e2b7175` for schema migration safety, multi-node idempotency, claim security, sensitive-data exposure, Stripe restrictions, and unchanged existing-user behavior. Fix every Critical/Important issue, then rerun the smallest test that proves each fix before the full verification set.

- [ ] **Step 6: Clean branch-local smoke artifacts and commit**

Remove only verified `.codex-smoke-*` and `.codex-translation-stub*` files after stopping their branch-local processes. Run:

```powershell
git diff --check
git status --short
git log --oneline -20
```

Final Lore commit intent:

```text
Complete operational testing for external activity recipients

Constraint: Verification must not touch production Stripe or SMTP.
Confidence: high
Scope-risk: moderate
Tested: Full Go tests/build, recall frontend tests/typecheck/build, browser admin and permission smoke.
Not-tested: Live production Stripe and SMTP delivery.
```
