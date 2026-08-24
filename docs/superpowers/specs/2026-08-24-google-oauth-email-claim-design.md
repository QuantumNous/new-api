# Google OAuth Email Claim Design

## Goal

Prevent two concurrent Google OAuth registrations for the same verified identity from creating two user rows, while replacing the per-login `LOWER(TRIM(email))` scan with an indexed lookup and preserving legacy duplicate-email records.

## Constraints

- Production is multi-node; process-local locks are not a correctness boundary.
- SQLite, MySQL 5.7.8+, and PostgreSQL 9.6+ must all remain supported.
- Existing duplicate user emails must not be merged, deleted, or placed behind a new global unique-email constraint.
- Soft-deleted accounts and their Google identities remain reserved.
- Google email normalization remains lowercase plus surrounding-whitespace trimming; Gmail dot and plus aliases are outside this change.

## Considered approaches

### 1. Indexed normalized email plus a Google claim table — selected

Add a non-unique `users.normalized_email` index for fast lookup and a `google_oauth_claims` table with unique keys for normalized email, Google subject, and user ID. User creation and claim insertion occur in the same database transaction. A losing concurrent transaction rolls its new user row back and resolves the winning claim.

This preserves historical duplicate emails, works across application nodes, and follows the repository's existing unique-claim pattern used for Stripe bonus and top-up bonus concurrency.

### 2. Make normalized user email globally unique — rejected

This gives a simple conflict boundary but cannot be deployed while historical duplicate emails exist. It also changes password-registration semantics beyond PR #808.

### 3. Serialize with database-specific or distributed locks — rejected

MySQL named locks, PostgreSQL advisory locks, SQLite write locking, and Redis leases have different failure and release semantics. A portable unique claim is smaller and makes the invariant durable without relying on lock expiry or process lifetime.

## Data model

`User.NormalizedEmail` stores `strings.ToLower(strings.TrimSpace(User.Email))` and has a non-unique index. A GORM `BeforeSave` hook keeps new and updated rows synchronized. Startup migration backfills legacy rows after the column and index exist.

`GoogleOAuthClaim` contains:

- `NormalizedEmail`: unique, normalized verified Google email.
- `GoogleID`: unique Google subject (`sub`).
- `UserID`: unique owning user.
- `CreatedAt`: audit timestamp.

The table has no soft-delete column. Claims remain reserved when a user is soft-deleted.

## Login flow

1. Existing Google-subject lookup remains the fastest first path.
2. If the subject is not bound, query active users by indexed `normalized_email`.
3. Zero matches continues to registration; more than one match returns the existing OAuth email conflict; one match attempts to insert a claim and bind `google_id` in one transaction.
4. New registration inserts the user, lifecycle rows, Google claim, and Google subject inside the existing `RegisterUserWithDomainRisk` transaction.
5. If claim insertion loses a unique-key race, the new-user transaction rolls back. The caller loads the winning claim's active user and returns it as an existing login only when email and subject both match; mismatched claims return an OAuth email conflict.

## Migration and compatibility

The normal and fast migration paths register `GoogleOAuthClaim`, add `normalized_email`, and synchronously backfill only rows whose stored normalized value differs from the current email. The backfill is idempotent and uses SQL functions shared by all three supported databases.

Historical duplicate normalized emails remain queryable because the user index is non-unique. They continue to fail closed until an operator resolves them.

## Error handling

- Ambiguous legacy email matches: `OAuthEmailConflictError`.
- Claim owned by another subject, email, or user: `OAuthEmailConflictError`.
- Claim points to a deleted/missing user: fail closed; never create a replacement account.
- Database errors: return the original error and do not fall through to account creation.

## Tests

- A query-builder test proves normalized lookup targets `normalized_email`, not `LOWER(TRIM(email))`.
- Migration tests prove legacy mixed-case/whitespace emails are backfilled and indexed.
- Claim tests prove unique email, Google subject, and user ownership and prove a losing transaction rolls its newly inserted user back.
- Controller tests cover existing-account reuse, ambiguous legacy matches, conflicting bindings, unknown-email creation, and losing-claim recovery.
- Targeted model/controller tests, `go vet` for touched packages, and a build are required before updating PR #808.

## Deployment

This is authentication and schema behavior used by console login. Deploy `newapi-console` and the legacy `newapi` service after migration validation; router nodes do not need deployment because relay/API-key authentication paths do not consume the new table or field.
