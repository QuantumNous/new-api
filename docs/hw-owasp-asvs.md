# HisarWeb AI: OWASP ASVS accountability for authentication

Status date: 2026-11-07. Scope: the authentication surface of this repository (module `new-api`, HisarWeb additions in `hw_*` files). This document is documentation only; no code was changed to write it.

AGENTS.md ("Authentication Security (OWASP Mandatory)") asks every auth change to record the OWASP references, the validation performed and the open gaps. This file is the standing record per component, so a PR can point here and only note what it changes.

## Method and version

- Standard used: OWASP ASVS **4.0.3**. The requirement IDs and wording below were checked against the official 4.0.3 CSV (tag `v4.0.3` of github.com/OWASP/ASVS). AGENTS.md says "latest stable", which is ASVS 5.0.0; that mapping has not been done (gap G12).
- Also used: OWASP Cheat Sheets for Authentication, Session Management, Password Storage, Forgot Password, MFA, OAuth 2.0 and CSRF Prevention.
- Every "what the code does" line was read in the source at the commit this file was written against (`file:line`; lines drift, the function name is the stable anchor).
- "Validated by" lists existing Go tests only where the test name matches the behaviour; it does not claim the tests were re-run for this document. CI runs them (see "CI gate").
- Status per requirement: OK (met in code), PARTIAL, GAP (see the gap list at the end). ASVS 4.0.3 has no webhook chapter; the webhook section maps to the nearest requirements and says so.

## Merged PRs that shaped the surface (hisarweb-be/hisarweb-ai)

| PR | Subject |
| --- | --- |
| #3 | Revolut orders, webhook and credit |
| #11 | Browser security headers, production guards (default admin password, cookies, unused payment routes) |
| #29 | One-time Telegram deep link, clear password error |
| #30 | Session refresh gets its own rate-limit bucket |
| #43 | Stripe Checkout next to Revolut |
| #82 | Telegram webhook keeps update claim and link token until the work is done |
| #104 | Provider webhooks kept out of the global rate limit |
| #105 | Telegram bot token over https only |
| #226 | Merge of upstream new-api v1.0.0-rc.48 |

The access token, refresh-session, step-up and AuthFlow machinery is upstream code (see `docs/authentication.md`, which describes it in Chinese); HisarWeb owns the hardening around it (#11, #30) and the payment and Telegram webhooks.

## 1. Login (password, 2FA, passkey)

Code
- Route: `router/api-router.go:107` `POST /api/user/login` behind `CriticalRateLimit`, `DisableCache`, body limit and `TurnstileCheck`; `:108` 2FA, `:109` login verification, `:110-113` passkey login.
- `controller/user.go:53` `Login`: one generic error for wrong user, wrong password and banned user (`"Username or password is incorrect, or user has been banned"`), including the password-decryption failure path.
- `model/user.go:1059` `ValidateAndFill`: looks up by username or e-mail; `ErrInvalidCredentials` for unknown user, empty hash, wrong password and disabled user alike.
- `controller/user.go` (in `Login`, after `ValidateAndFill`): in production the default administrator password pair is refused and answers like any failed login (PR #11).
- Rate limit: `middleware/rate-limit.go:190` `CriticalRateLimit`, default 20 requests per 20 minutes per IP (`common/init.go:140-141`), Redis or in-memory.
- 2FA (TOTP): `common/totp.go:38` `ValidateTOTPCode`, 6 digits, period 30 s, SHA1 (`:31-33`); lockout after 5 failures for 300 s (`common/totp.go:22-23`, `model/twofa.go:84` `IncrementFailedAttempts`; the window restarts after the lockout expires).
- Backup codes: `model/twofa.go:197` `ValidateBackupCode` marks a code used atomically; stored hashed (`model/twofa.go:149`, `common/totp.go:110` `HashBackupCode`).
- Passkeys: `controller/passkey.go:79,292,519` request `VerificationRequired` (user verification) and `:169,352,596` refuse finish when the stored session data is not user-verified.
- Step-up after password: `service/login_verification.go` and `service/security_verification.go`; a passkey login does not demand a second factor (it already is one).

ASVS 4.0.3

| ID | Status | Note |
| --- | --- | --- |
| V2.1.1 (12+ chars) | GAP | minimum is 8 (`common/account_password.go:17`), G3 |
| V2.1.2 (64 allowed, >128 denied) | OK | max 128 (`common/account_password.go:18,35`) |
| V2.1.7 (breached passwords) | GAP | no breached-password check anywhere, G3 |
| V2.1.9 (no composition rules) | OK | length only (`:34-41`) |
| V2.2.1 (anti-automation) | PARTIAL | per-IP limit and Turnstile only; no per-account throttle on password login, G4 |
| V2.2.2 (weak authenticators secondary only) | OK for login | e-mail alone is not a login factor; reset is covered in G1 |
| V2.8.1 (TOTP lifetime) | OK | 30 s step |
| V2.8.4 (TOTP single use) | GAP | `totp.Validate` accepts the same code again inside the window, G6 |
| V2.6.1-V2.6.3 (backup codes) | OK | single use, hashed |
| V2.9.1, V2.9.3 (WebAuthn verifier) | OK | library verification, user verification required, no custom crypto |
| V4.3.1 (admin MFA) | PARTIAL | admins can enable 2FA or a passkey; it is not forced, G10 |
| V3.2.1 (new token on login) | OK | each login creates a new session row and refresh token (`service/auth_session.go:80`) |

Validated by (Go tests): `TestHwProductionRefusesDefaultAdminLogin`, `TestSecurityLoginCodeCompletesOnce`, `TestSecurityLoginRegisteredPasskeyRequiresUserVerification`, `TestSecurityLoginAllPrimaryTransportsRequireAdditionalVerification` (`controller/auth_flow_test.go`), `TestIncrementFailedAttemptsRestartsWindowAfterLockoutExpires`, `TestValidateBackupCodeCanOnlySucceedOnce` (`model/user_authentication_test.go`), `TestValidateAndFillRejectsPasswordlessUser` (`model/user_update_test.go`), `TestSessionLimitDoesNotRecordRejectedLoginAsSuccessful` (`controller/auth_session_test.go`).

Open: G3, G4, G5, G6, G10.

## 2. Registration

Code
- `router/api-router.go:105`: `POST /api/user/register` behind `CriticalRateLimit`, body limit, `TurnstileCheck`.
- `controller/user.go:232` `Register`: registration and password-registration switches; with e-mail verification enabled the code must verify (`common.VerifyCodeWithKey`, purpose `EmailVerificationPurpose`), e-mail uniqueness via `model.EnsureEmailAvailable`; `service.HwRejectDisposableEmail` blocks disposable domains (HisarWeb).
- Password hashing and policy: see section 3.
- Verification mail: `router/api-router.go:60` `GET /api/verification` behind `EmailVerificationRateLimit` and Turnstile.

ASVS 4.0.3: V2.1.2 OK, V2.1.1 GAP (G3), V2.1.7 GAP (G3), V2.2.1 PARTIAL (G4), V3.2.1 OK.

Known behaviour: `Register` answers "Email address is already in use" for a taken e-mail, which allows e-mail enumeration at registration (recorded under G5).

Validated by: `TestInsertKeepsBlankPasswordForPasswordlessUser` (`model/user_update_test.go`); no focused test for Turnstile or disposable e-mail refusal was found in this pass (G11).

## 3. Passwords (storage, change, policy)

Code
- `common/account_password.go:44-63` `HashAccountPassword`: Argon2id, `m=19456,t=2,p=1` (the OWASP Password Storage Cheat Sheet minimum), random salt, format `$argon2id$v=19$...`; verify at `:66-84` with length bounds before hashing (DoS guard).
- `common/crypto.go:26,31-34`: legacy bcrypt (`DefaultCost`, 10) still verifies; the argon2id prefix is detected and routed.
- Change: `controller/user.go:853-985` `UpdateSelf`: a password change needs a security proof for the scope `password_change` or `password_set` (`middleware.RequireSecurityProof`), then `model.ChangeUserPassword`, then an account-security mail (`service.NotifyAccountSecurityChange`), then the current session is advanced to the new auth version and all other sessions die (`model/user.go:804,865` revoke with reason `user_security_changed`).
- Audit: `recordUserSecurityAudit` action `user.password_change` (`controller/user.go:861`, `controller/audit.go:164`); parameters carry success and notification failure, never the password.

ASVS 4.0.3

| ID | Status | Note |
| --- | --- | --- |
| V2.1.5, V2.1.6 | OK | change needs proof of the current credential and a new password |
| V2.4.1, V2.4.2 | OK | Argon2id, per-password random salt |
| V2.4.4 (bcrypt work factor 10+) | OK | legacy hashes only |
| V2.2.3 (notification after change) | OK | mail on password change; reset is G9 |
| V3.3.3 (end other sessions after change) | OK | all sessions revoked, current one re-issued |
| V7.1.1 (no credentials in logs) | OK | audit params carry no secrets; `TestPasskeyDomainFailuresDoNotLogCredentials` covers the passkey path |

Validated by: `TestSecurityAccountPasswordRequiresCurrentPassword`, `TestSecurityAccountLongUnicodePasswordAndSessionRotation` (`controller/security_account_test.go`), `TestPasswordResetBumpsAuthVersionAndRevokesSessions` (`model/user_session_test.go`).

Open: G3.

## 4. Sessions and tokens

Code
- Access token: HS256 JWT, 15 minutes (`service/auth_token.go:20,81`); validation pins the algorithm, issuer, audience, expiry and issued-at with 5 s leeway (`:190-194`); separate derived keys per purpose (access, security proof, refresh digest, AuthFlow digest) from `SESSION_SECRET` (`docs/authentication.md`).
- Refresh: opaque random value, 30 days, only an HMAC digest stored, rotated on every refresh; a reused previous digest outside the grace window revokes the whole session (`model/user_session.go:471,538-561`, `service/auth_session.go:276`).
- Cookies: `SameSite=Strict`, `Secure` (configurable `SessionCookieSecure`); the refresh cookie is `HttpOnly` with `Path=/api/user/auth`; the presence hint cookie is deliberately script-readable and carries no credential (`service/auth_session.go:339-355,384-399`).
- CSRF: `middleware.SessionCookieOriginGuard` on refresh and logout (`router/api-router.go:103-104`, `middleware/auth_origin.go`); the API itself uses `Authorization: Bearer`, not cookies.
- Limits: 50 active sessions and 100 issuances per window per account (`common/constants.go:46-55`), fail closed when the count query fails.
- Server-side revocation: the `user_sessions` table is the authority; Redis is a cache with tombstones; logout and "revoke other sessions" exist; `auth_version` is bumped on password, role, status and factor changes.
- Step-up: HS256 "security proof" tokens bound to identity, operation and access-token session (`service/auth_token.go:158`).

ASVS 4.0.3

| ID | Status | Note |
| --- | --- | --- |
| V3.1.1 (no token in URL) | OK | tokens in header or HttpOnly cookie |
| V3.2.1 | OK | new session and refresh token per login |
| V3.2.3 | OK | access token in memory, refresh in HttpOnly cookie |
| V3.3.1 (logout invalidates) | OK | server-side revoke |
| V3.3.2 (periodic re-authentication, idle) | PARTIAL | absolute 30 days, no idle timeout (`last_active_at` is recorded, not enforced), G7 |
| V3.3.3, V3.3.4 | OK | session list and revoke exist |
| V3.4.1, V3.4.2, V3.4.3 | OK | Secure, HttpOnly, SameSite=Strict |
| V3.4.4 (`__Host-` prefix) | GAP | the refresh cookie needs `Path=/api/user/auth`, which excludes the prefix, G7 |
| V3.5.3 (signed stateless tokens) | OK | HS256, pinned algorithm |
| V4.2.2, V13.2.3 (CSRF with cookies) | OK | SameSite=Strict plus origin guard |
| V11.1.4 (anti-automation) | OK | refresh bucket (#30) and critical bucket |

Validated by: `TestRotateUserSessionRefreshRaceAndReuse`, `TestUserSessionCacheExcludesRefreshDigests`, `TestPasswordResetBumpsAuthVersionAndRevokesSessions` (`model/user_session_test.go`), `TestAccessTokenRejectsTampering`, `TestSecurityProofBindsIdentityAndOperation` (`service/auth_token_test.go`), `TestCreateLoginSessionEnforcesActiveLimitAcrossAuthVersions`, `TestHwRefreshCookieAttributes` (`service/auth_session_test.go`), `TestAuthLogoutRejectsRefreshCookieSessionMismatch` (`controller/auth_session_test.go`), `TestSessionCookieOriginGuard` (`middleware/auth_origin_test.go`).

Open: G7.

## 5. API keys and access tokens

Two different credentials exist.
- Relay API keys (`model/token.go`, the keys customers put in their tools): the column `key` (`model/token.go:17`) is stored and compared in clear; the full key is returned by `POST /api/token/:id/key` (`router/api-router.go:330`, `controller/token.go:190-208`) behind login and `CriticalRateLimit`, without a step-up proof. List and search responses mask the key (`controller/token.go:57-79`, `TestGetAllTokensMasksKeyInResponse` in `controller/token_test.go`). Keys carry status, expiry, quota, model limits and optional IP limits (`model/token.go:88,224-262`).
- Dashboard access tokens (`model/user_access_token.go`): only a hash is stored (`token_hash`, `:45`), with scopes and expiry; create, update and delete sit behind `UserCriticalRateLimit("access-token")` (`router/api-router.go:138-141`) and are audited (`controller/access_token_audit_test.go`).

ASVS 4.0.3: V2.10.4 PARTIAL (access tokens hashed, relay keys in clear, G2), V3.5.2 OK for the dashboard (session tokens, not static secrets), V11.1.4 OK, V7.1.1 PARTIAL (the redemption-code error path in `controller/user.go` logs the code, G11).

Open: G2.

## 6. Password reset and recovery

Code
- Request: `router/api-router.go:61` `GET /api/reset_password` behind `CriticalRateLimit` and Turnstile; `controller/misc.go:262` `SendPasswordResetEmail` always answers success (no account enumeration); the token is a random UUID without dashes (`common/verification.go:26-33`, 122 bits), kept in an in-memory map with a 10 minute lifetime (`common/verification.go:24,47-52`); the link carries e-mail and token in the query string (`controller/misc.go:271`).
- Redeem: `router/api-router.go:62` `POST /api/user/reset`; `controller/misc.go:296` `ResetPassword` verifies the token, sets a **system-generated 12 character password** (`:312`, `GenerateVerificationCode(12)`, 12 hex characters, 48 bits) and returns it in the JSON response (`:326`); `model/user.go:1195-1213` `ResetUserPasswordByEmail` bumps `auth_version` and revokes every session (reason `password_reset`); the token is deleted after use (`controller/misc.go:322`).

ASVS 4.0.3

| ID | Status | Note |
| --- | --- | --- |
| V2.5.3 (current password not revealed) | OK | |
| V2.7.2 (10 minute expiry) | OK | |
| V2.7.3 (single use) | OK | deleted after redeem |
| V2.5.6 (secure recovery mechanism) | PARTIAL | an e-mail link is acceptable, but the user does not choose the new password, G1 |
| V2.5.7 (MFA not bypassed by recovery) | GAP | reset does not ask for TOTP or a passkey; a mailbox takeover bypasses 2FA, G1 |
| V2.2.3 (notification after reset) | GAP | no mail after a reset, G9 |
| V8.3.1 (no sensitive data in query string) | GAP | reset token and e-mail in the URL query, G8 |
| V3.3.3 | OK | all sessions revoked |

Validated by: `TestResetUserPasswordByEmailRequiresSingleActiveMatch` (`model/user_update_test.go`), `TestPasswordResetBumpsAuthVersionAndRevokesSessions`, `TestPasswordResetDoesNotClearSessionIssuanceHistory` (`service/auth_session_test.go`).

Open: G1, G8, G9, G13.

## 7. OAuth, WeChat and Telegram login

Code
- `controller/oauth.go:45` `GenerateOAuthCode` creates an AuthFlow (`model/auth_flow.go`; only a digest of the flow token is stored, `:143`) bound to its purpose and, for binding flows, to the authenticated session; the callback `HandleOAuth` reads `state` (`:154-156`), loads the flow with a match on purpose and session, and consumes it exactly once (`:238,278`, `model.ConsumeAuthFlow`); the provider assertion can be claimed only once (`model/auth_flow.go:179`, `ClaimExternalAuthAssertion`).
- Account linking is gated: a legacy GitHub binding needs account evidence (tests below); e-mail bind has its own flow and rate limits (`router/api-router.go:65-67`).
- ASVS 4.0.3 has no OAuth chapter; the nearest requirements are V4.2.2 and V13.2.3 (anti-CSRF through the `state` binding) and V3.2.1; the OAuth 2.0 Cheat Sheet is the reference for PKCE and redirect URI handling.

Status: state binding and one-time consumption OK; PKCE use and redirect-URI allow-listing per provider were not verified in this pass (G12).

Validated by: `TestAuthFlowIsBoundAndConsumedOnce`, `TestAuthFlowExpiryIsEnforced`, `TestExternalAuthAssertionCanOnlyBeClaimedOnce` (`model/auth_flow_test.go`), `TestGenerateOAuthCodeBindsFlowToAuthenticatedSession`, `TestOAuthLoginConsumesFlowOnlyAfterProviderIdentity`, `TestOAuthLoginLegacyGitHubBindingRequiresAccountEvidence` (`controller/auth_flow_test.go`).

## 8. Webhooks (payments and Telegram)

ASVS 4.0.3 has no webhook chapter; nearest: V6.2 (approved cryptography), V11.1.4 (anti-automation), and V2.7.3 (single use) in spirit.

Code
- Revolut: `service/hw_revolut.go:212` `HwVerifyRevolutWebhook`: HMAC-SHA256 over `v1.<timestamp>.<raw body>`, constant-time `hmac.Equal`, several signatures accepted during secret rotation, timestamp window 5 minutes (`:34`); a missing secret answers "unavailable" instead of accepting.
- Stripe: `service/hw_stripe.go:422` `HwVerifyStripeWebhook`: same scheme, tolerance 5 minutes (`:39`); `:469` `HwHandleStripeWebhook` only credits when the session reference, id, amount and currency match our own order, ignores foreign sessions that merely carry our reference, and never logs body or header.
- Telegram: `service/hw_telegram_bot.go:160` `HwHandleTelegramWebhook`: secret-token header compared with `subtle.ConstantTimeCompare`; claim per `update_id` (a repeat of a finished update is acknowledged without redoing the work, a running one asks for a retry); the claim is released on failure (PR #82).
- Replay inside the window: crediting is idempotent per order (duplicate deliveries credit once). The routes sit outside the global rate limit on purpose (#104) so provider retries are not throttled.

Validated by: `TestHwRevolutWebhookSignature` and `TestHwTopUpDuplicateWebhooksCreditOnce` (`service/hw_order_test.go`), `TestHwStripeWebhookSignature` including stale and future timestamp cases (`service/hw_stripe_test.go`), `TestHwStripeDuplicateWebhookCreditsOnce`, `TestHwRevolutWebhookAnswersUnavailableWhileIncomplete`, `TestHwTelegramWebhookLinksAnAccount`, `TestHwPaymentWebhooksRefuseBeforeAnyCreditIsWritten`.

Open: G14.

## CI gate

`.github/workflows/ci.yml`: Go vet and build for the root module and the relaykit and tokenkit modules, `make test`; frontend typecheck (`bun check -b`) and `bun run test`. `.github/workflows/security.yml`: `govulncheck` per module, `bun audit --audit-level=high` (two advisories ignored by id), production image build, gitleaks. There is no static analysis for auth logic (no CodeQL or gosec step); the controls above are held by the focused Go tests named per section.

## Open gaps

| ID | Prio | Gap | ASVS 4.0.3 |
| --- | --- | --- | --- |
| G1 | P1 | Password reset returns a system-generated password (48 bits) in the response, the user cannot choose, and reset skips 2FA and passkey | V2.5.6, V2.5.7 |
| G2 | P1 | Relay API key readable via `POST /api/token/:id/key` without step-up proof; keys stored in clear | V2.10.4, V3.5.2 |
| G3 | P2 | Minimum password length 8 (ASVS 12) and no breached-password check | V2.1.1, V2.1.7 |
| G4 | P2 | No per-account throttle on password login (IP limit only) | V2.2.1 |
| G6 | P2 | TOTP code reusable inside its validity window | V2.8.4 |
| G9 | P2 | No notification mail after a password reset | V2.2.3 |
| G12 | P2 | ASVS 5.0.0 (latest stable per AGENTS.md) not mapped; PKCE and redirect URI checks per OAuth provider not verified | n/a |
| G5 | P3 | Unknown-user login returns before any hash is computed (timing difference); registration reveals a taken e-mail | Authentication Cheat Sheet |
| G7 | P3 | No idle timeout (absolute 30 days only); refresh cookie cannot use the `__Host-` prefix | V3.3.2, V3.4.4 |
| G8 | P3 | Reset token and e-mail in the link query string | V8.3.1 |
| G10 | P3 | Administrators are not required to enroll 2FA or a passkey | V4.3.1 |
| G11 | P3 | Registration (Turnstile, disposable e-mail) has no focused test; the redemption-code error path logs the code | V7.1.1 |
| G13 | P3 | Verification and reset codes live in a per-process memory map (lost on restart, not shared between nodes) | V2.7.2 in multi-node use |
| G14 | P3 | Unused upstream payment webhook routes not re-verified (disabled by the production guards of PR #11) | V11.1.4 |

Recipe per gap

- G1: after a valid token show a "choose new password" form that calls `ValidateNewAccountPassword`, require the TOTP or passkey proof when enrolled, then revoke sessions and send the G9 mail; remove the password from the response.
- G2: first require a security proof scope on `POST /api/token/:id/key` (the access-token routes already do this); then store a keyed digest plus a visible prefix, show the full key once at creation, and migrate existing rows in a reversible step.
- G3: raise the minimum to 12 for new passwords only; add a k-anonymity range lookup against the free Pwned Passwords API (no key), failing open with a log line.
- G4: count failures per account in the existing rate-limit store with a growing delay (not a hard lockout) and a reset on success.
- G6: store the last accepted TOTP step per user and refuse a step less than or equal to it.
- G9: call `service.NotifyAccountSecurityChange` from the reset path.
- G12: map the same controls to ASVS 5.0.0 chapters, and read the provider config for PKCE and redirect URIs.
- G5: verify a fixed dummy Argon2id hash for unknown users; keep the registration message when e-mail verification is off.
- G7: enforce idle expiry on `last_active_at` (for example shorter for admins); document why `__Host-` is not possible with the scoped path, or move the refresh cookie to `Path=/`.
- G8: move the token to a URL fragment or a POST form so proxies do not log it.
- G10: require enrollment for administrators at login.
- G11: add tests for Turnstile failure and disposable e-mail refusal; log only a hash of the redemption code.
- G13: persist codes in the database or Redis with an expiry.
- G14: confirm the guards of PR #11 still disable the unused routes and add a test that lists them.
