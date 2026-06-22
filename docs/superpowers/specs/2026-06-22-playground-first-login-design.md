# Playground First Login Design

## Context

Issue #196 tracks the activation fix for new users: land them in Playground
first-run so they can complete an immediate first API call before any billing or
card-binding prompt competes for attention.

PR #192 implemented the auto-login path for password sign-up when email
verification is disabled. Production has email verification enabled, so the
active path is different:

1. User signs up.
2. Frontend asks the user to sign in manually.
3. Sign-in succeeds.
4. The current default redirect lands on Dashboard and may open the top-up /
   card-bind onboarding dialog.

That path does not satisfy #196 because the new user does not reach Playground
first-run.

## Goal

All newly registered users must land on `/playground?first=1` on their first
successful login after account creation.

This applies to:

- password registration with email verification enabled;
- password registration with auto-login enabled;
- OAuth or third-party login that creates a new account.

This does not apply to:

- existing users signing in normally;
- existing OAuth users signing in again;
- later logins after the new-user first-run redirect has been consumed.

## Product Rules

- Playground activation has priority over any registration-time `redirect`
  parameter.
- New-user first-run is one-time only.
- While the first-run redirect is active, do not automatically open the
  top-up/card-bind onboarding dialog.
- Existing redirect behavior remains unchanged for non-new-user logins.
- The existing Playground first-run behavior remains the activation destination:
  welcome state, cheap/default model selection, example prompts, and the get-key
  prompt after the first successful response.

## Recommended Approach

Use an explicit frontend pending state for Playground first-run, separate from
the existing card-bind/top-up onboarding flag.

Add a storage helper pair with a name like:

- `setPendingPlaygroundFirstRun()`
- `consumePendingPlaygroundFirstRun()`

The storage key must be specific to this behavior and must not reuse the current
pending onboarding key, because that key currently represents the top-up /
card-bind onboarding dialog.

## Flow

### Password Sign-Up With Email Verification

When registration succeeds and email verification is required:

1. Set `pendingPlaygroundFirstRun`.
2. Show the existing "Account created! Please sign in" success message.
3. Navigate to sign-in.
4. Do not preserve the registration page's `redirect` as the post-login target
   for this newly registered user.

On the next successful sign-in:

1. `handleLoginSuccess` consumes `pendingPlaygroundFirstRun`.
2. The target becomes `/playground?first=1`.
3. The card-bind/top-up onboarding dialog is not opened.
4. The pending state is removed so later sign-ins are not forced back to
   Playground.

### Password Sign-Up With Auto-Login

Keep the existing behavior from #192:

1. Registration succeeds.
2. The user is logged in automatically.
3. The user lands on `/playground?first=1`.
4. The card-bind/top-up onboarding dialog is not opened.

This path does not need to set the new pending state because the user is already
being routed immediately.

### OAuth Or Third-Party Account Creation

If the OAuth completion path has an explicit "new user" signal, route that login
to `/playground?first=1` and suppress the top-up/card-bind dialog for that first
login.

Existing OAuth users must keep the current behavior.

If a specific OAuth path cannot reliably identify new account creation, leave
that path unchanged rather than forcing all OAuth logins into first-run.

## Redirect Precedence

For newly registered users only:

1. Playground first-run wins.
2. Registration-time `redirect` is ignored.
3. Card-bind/top-up onboarding is suppressed.

For existing users:

1. Existing safe internal `redirect` behavior remains unchanged.
2. Dashboard remains the default target when there is no redirect.
3. Existing card-bind/top-up onboarding behavior remains unchanged.

## Error Handling

- If storage write fails during password registration, do not fail account
  creation. The user should still be sent to sign-in.
- If storage consume fails during login, fall back to existing login behavior.
- The implementation should log storage failures consistently with existing
  auth storage helpers.
- Open-redirect protection must remain in place for all existing redirect
  handling.

## Acceptance Criteria

- With email verification enabled, password registration followed by manual
  sign-in lands on `/playground?first=1`.
- If the password registration URL contains `?redirect=/keys`, the new user's
  first successful sign-in still lands on `/playground?first=1`.
- The first-run redirect is consumed once; a later sign-in by the same user does
  not force Playground again.
- Existing users signing in still honor safe internal redirects and otherwise
  land on the current default destination.
- A newly created OAuth user lands on `/playground?first=1` when the OAuth flow
  exposes a reliable new-user signal.
- Existing OAuth users are not forced into Playground first-run.
- The top-up/card-bind onboarding dialog does not automatically open during
  Playground first-run.
- Existing i18n text remains valid; no new user-visible copy is required unless
  the implementation changes messages.

## Verification Plan

- Add or update focused tests for the auth redirect helper behavior if the
  current frontend test setup supports it.
- Run `bun run typecheck` in `web/default`.
- Run `bun run build` or the repository's existing frontend build check if the
  change touches route wiring or lazy-loaded auth code.
- Manually smoke test the email-verification registration path:
  sign-up -> sign-in -> `/playground?first=1`.
- Manually smoke test an existing user login to confirm the normal dashboard or
  explicit redirect path still works.

