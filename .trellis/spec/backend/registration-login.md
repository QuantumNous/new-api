# Registration login contract

## 1. Scope / Trigger

Apply when changing password registration, successful login responses, registration UI navigation, or registration on promotion domains.

## 2. Signatures

- `POST /api/user/register` → `controller.Register`.
- `service.CreateLoginSession(userID, loginMethod, ip, userAgent)` creates the server-controlled session.
- `controller.completeLogin(user, bundle, c)` publishes a created session: last-login time, Host-only refresh cookie, no-store header, login audit, and the safe user DTO.
- `middleware.SessionCookieOriginAllowed(c)` exposes the existing session-origin policy without writing an error response; both the refresh/logout guard and registration use it.
- `useAuthRedirect().handleLoginSuccess(bundle)` applies the bundle and navigates to `/dashboard` by default.

## 3. Contracts

- Register/password-register switches, username/password validation, optional email verification, inviter resolution and optional default API-token creation run before automatic login. Client-supplied roles are ignored.
- If `common.PasswordLoginEnabled` is true and the request passes `SessionCookieOriginAllowed`, a completed registration attempts session creation with `login_method=password`. No second password-login request or repeated Turnstile challenge is needed.
- In secure-cookie mode, automatic login requires a valid allowed Origin (or Referer fallback). Reuse the existing exact-main trusted-origin and custom/wildcard Host policy; missing, opaque or foreign origins receive registration-only success with no new session or cookie. This preserves registration API compatibility while preventing cross-site registration from replacing a browser session. Insecure development mode retains the existing permissive refresh/logout policy.
- `SameSite=Strict` does not replace this origin check: top-level cross-site navigation can still set a cookie. See [HTTP Cookies, section 4.1.2.7](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-4.1.2.7).
- Successful automatic login returns `{ success: true, message: "", data: { access_token, token_type, access_expires_at, session, user } }`, using the same safe user projection as normal login. Passwords, password hashes, management PATs and raw refresh tokens must not appear in the response body.
- Refresh tokens use the existing `new_api_refresh` cookie, with `/api/user/auth` path, `HttpOnly`, `SameSite=Strict`, configured `Secure`, and no `Domain` attribute. Registration stays on the initiating Host, including promotion domains; inviter rules are unchanged.
- If password login is disabled, return the existing registration-only success response. If session creation fails after account creation, log the failure and also return registration-only success; do not imply that the account must be created again. Do not publish a successful login audit for this fallback.
- The UI applies `isAuthBundle(res.data)` before accepting a login. Valid bundle → apply authentication and enter the dashboard. Registration-only success or malformed bundle → show `Account created! Please sign in` and navigate to sign-in. Registration rejection → remain on the form.

## 4. Validation & Error Matrix

| Condition | Outcome |
| --- | --- |
| Valid registration and enabled password login | Active session, safe auth bundle, refresh cookie, dashboard |
| Email verification required and valid | Same automatic login behavior after verification |
| Registration disabled, invalid verification, duplicate username | Existing registration error; no new login session |
| Password login disabled | Account created; no automatic session; sign-in fallback |
| Secure-cookie mode with missing, opaque or untrusted browser origin | Account created; no session or cookie; sign-in fallback |
| Session creation rejected after account creation | Account retained; registration-only success; failure logged; sign-in fallback |
| Success body without a valid bundle | Client does not accept credentials; sign-in fallback |

## 5. Good / Base / Bad Cases

- Good: registration at an enabled promotion Host keeps the inviter and signs into that same Host with an independently refreshable session.
- Base: disabled password login or an older registration-only backend still sends the user to sign-in with an account-created message.
- Bad: treating every `success=true` as authentication, creating a second login request with a consumed Turnstile token, or returning a registration failure solely because session issuance failed.

## 6. Tests Required

- `controller/user_registration_test.go`: registration with and without email verification yields a usable protected-API token, refreshable session, correct user/role, password login audit, safe DTO and default API token; disabled switches, invalid verification and duplicates issue no sessions; issuance rejection retains the account without recording successful login; cross-site text/plain form payloads and missing/opaque origins do not establish sessions in secure mode.
- `middleware/auth_origin_test.go` and `middleware/custom_domain_test.go`: preserve allowed Origin/Referer handling, trusted main Origins, strict custom/wildcard Host matching and insecure-development compatibility in the shared policy.
- Decode registration and refresh responses into separate zero-value test fixtures. Decoding refresh into the populated registration result retains omitted fields and can falsely pass a `{success:true}` response. Validate the freshly returned access token against the real session service.
- `controller/custom_domain_registration_test.go`: implicit, invalid and explicit inviter selection survives automatic login; the bundle belongs to the registered user and the refresh cookie has no Domain attribute.
- `web/src/features/auth/sign-up/components/__tests__/sign-up-form.test.tsx`: submit the real form through the HTTP boundary and real router/auth store; assert dashboard navigation without an extra login request, sign-in fallback for absent/malformed bundles, and no authentication on rejection.
- Run related authentication regression tests with Go race detection, frontend authentication tests, typecheck, changed-file lint/format, build and i18n synchronization.

## 7. Wrong vs Correct

Wrong: unconditionally call `redirectToLogin()` after registration success, or serialize `model.User` directly into the authentication response.

Correct: accept a validated bundle with the existing frontend authentication helper; publish the shared `buildSelfUserData` projection from `completeLogin`, preserving the registration-only fallback when no session was created.
