# Playground First Login Design

## Context

Issue #196 tracks the activation fix for new users: land them in Playground
first-run so they can complete an immediate first API call before any billing or
card-binding prompt competes for attention.

PR #192 implemented the auto-login path for password sign-up when email
verification is disabled. Production has email verification enabled, so the
registration path must also auto-login after a valid verification code:

1. User signs up.
2. Backend verifies the email code.
3. Backend creates the user, establishes the session, and returns
   `is_new_user=true`.
4. Frontend routes the new user to `/playground?first=1`.

The previous manual-login path did not satisfy #196 because the new user could
land on Dashboard before seeing Playground first-run.

## Goal

All newly registered users must land on `/playground?first=1` on the successful
registration/login response that creates their session.

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

Use the registration success response as the activation boundary. After account
creation, the backend must call the normal login/session setup path and mark the
response with `is_new_user=true`. The frontend should then use an explicit
`/playground?first=1` target for the new-user activation redirect.

Do not use a delayed browser-storage pending state for Playground first-run.
The first-run behavior must not depend on a future manual login or a local TTL.

## Flow

### Password Sign-Up With Email Verification

When registration succeeds and email verification is required:

1. The backend has already validated the email verification code.
2. The backend creates the user and calls the normal session setup path with
   `is_new_user=true`.
3. The frontend shows the existing "Account created!" success message.
4. The frontend calls `handleLoginSuccess` with `/playground?first=1`.
5. Do not preserve the registration page's `redirect` as the post-login target
   for this newly registered user.
6. The card-bind/top-up onboarding dialog is not opened.

### Password Sign-Up With Auto-Login

Keep the existing behavior from #192:

1. Registration succeeds.
2. The user is logged in automatically.
3. The user lands on `/playground?first=1`.
4. The card-bind/top-up onboarding dialog is not opened.

This path uses the same frontend success handling as the email-verification
path because the user is already being routed immediately.

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

- If session setup fails during password registration, return the existing
  session-save error response rather than pretending registration completed.
- Password registration must not depend on browser storage for Playground
  first-run state.
- Open-redirect protection must remain in place for all existing redirect
  handling.

## Acceptance Criteria

- With email verification enabled, password registration with a valid
  verification code logs the user in and lands on `/playground?first=1`.
- If the password registration URL contains `?redirect=/keys`, the new user's
  registration success still lands on `/playground?first=1`.
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
  sign-up -> `/playground?first=1`.
- Manually smoke test an existing user login to confirm the normal dashboard or
  explicit redirect path still works.
