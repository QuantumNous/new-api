# Registration Domain Risk Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable, cross-node-safe registration-domain abuse blocking with precise administrator recovery and an independent public-suffix-aware subdomain email restriction.

**Architecture:** Pure helpers normalize email domains and apply public-suffix policy. A registered runtime config supplies thresholds and trusted domains. Database state rows serialize same-domain registration, incident rows preserve audit history, and affected-user rows make recovery precise; controllers remain HTTP adapters while model functions own GORM transactions.

**Tech Stack:** Go 1.22, Gin, GORM v2, SQLite/MySQL/PostgreSQL, `golang.org/x/net/publicsuffix`, React 19, TypeScript, React Query, React Hook Form, Zod, Vitest, Bun.

---

## File Structure

- `common/email_domain.go`: parsing and registrable-domain equality.
- `setting/system_setting/registration_security.go`: validated registered settings.
- `model/registration_domain_risk.go`: state, incident, affected-user entities and transactions.
- `service/registration_security.go`: shared registration policy composition.
- Registration controllers: apply policy only to first registration.
- `controller/registration_domain_risk.go`: administrator incident APIs.
- `web/default/src/features/system-settings/auth/registration-risk-*`: settings and recovery UI.

### Task 1: Domain Parsing And Runtime Settings

**Files:**
- Create: `common/email_domain.go`
- Test: `common/email_domain_test.go`
- Create: `setting/system_setting/registration_security.go`
- Test: `setting/system_setting/registration_security_test.go`

- [ ] **Step 1: Write the failing parser tests**

Add table tests for normalization, malformed addresses, public suffixes, and subdomains:

```go
domain, err := NormalizeEmailDomain(" User@Mail.Example.COM ")
require.NoError(t, err)
require.Equal(t, "mail.example.com", domain)
require.True(t, IsSubdomainEmailDomain("mail.example.com"))
require.False(t, IsSubdomainEmailDomain("example.com.cn"))
```

- [ ] **Step 2: Verify RED**

Run: `go test ./common -run 'TestNormalizeEmailDomain|TestIsSubdomainEmailDomain' -count=1`

Expected: compile failure because the helpers do not exist.

- [ ] **Step 3: Implement the parser**

Implement `NormalizeEmailDomain(email string) (string, error)` and `IsSubdomainEmailDomain(domain string) bool` using `publicsuffix.EffectiveTLDPlusOne`. Matching remains exact; do not trust child domains implicitly.

- [ ] **Step 4: Verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write failing settings tests**

Assert defaults `false/24/10/[]/false`, normalization of duplicate mixed-case domains, and rejection of threshold below 2, window below 1, and malformed trusted domains.

- [ ] **Step 6: Verify RED**

Run: `go test ./setting/system_setting -run TestRegistrationSecurity -count=1`

Expected: compile failure because the config module does not exist.

- [ ] **Step 7: Implement and register settings**

Define `RegistrationSecuritySettings` with JSON keys `domain_risk_enabled`, `domain_risk_window_hours`, `domain_risk_threshold`, `trusted_email_domains`, and `reject_subdomain_email_domains`. Register as `registration_security`; expose a snapshot getter, exact trusted lookup, and validation/normalization.

- [ ] **Step 8: Verify packages and commit**

Run: `go test ./common ./setting/system_setting -count=1`

Expected: PASS. Commit with Lore intent: `Make registration email policy configurable`.

### Task 2: Persistence, Threshold Enforcement, And Recovery

**Files:**
- Create: `model/registration_domain_risk.go`
- Test: `model/registration_domain_risk_test.go`
- Modify: `model/user.go`
- Modify: `model/main.go`
- Modify: `model/errors.go`

- [ ] **Step 1: Write the failing threshold test**

Migrate `User` and the wished-for risk entities in SQLite, insert nine enabled same-domain users, then call:

```go
result, err := RegisterUserWithDomainRisk(&candidate, 0, RegistrationDomainRiskPolicy{
    Enabled: true, Window: 24 * time.Hour, Threshold: 10,
}, nil)
require.ErrorIs(t, err, ErrRegistrationDomainBlocked)
require.True(t, result.Triggered)
require.Zero(t, candidate.Id)
```

Assert the nine existing users are disabled and linked to one incident.

- [ ] **Step 2: Verify RED**

Run: `go test ./model -run TestRegisterUserWithDomainRisk_Threshold -count=1`

Expected: compile failure.

- [ ] **Step 3: Implement entities and migrations**

Add indexed `User.EmailDomain`, `RegistrationDomainState`, `RegistrationDomainBlock`, and `RegistrationDomainBlockUser` with portable GORM tags. Add all migrations to `model/main.go`.

- [ ] **Step 4: Implement transactional enforcement**

Ensure state creation with `clause.OnConflict{DoNothing:true}`. Acquire an early write on the state row, count from `max(now-window, counting_since)`, and either create the user or persist an incident, affected-user rows, and bulk-disable enabled same-domain users. Use GORM, not database-specific SQL.

- [ ] **Step 5: Verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 6: Add failing recovery tests**

Cover unblock-only, unblock-and-restore, manual-disabled preservation, idempotent repeated release, and `counting_since` reset.

- [ ] **Step 7: Verify RED**

Run: `go test ./model -run TestReleaseRegistrationDomainBlock -count=1`

Expected: compile failure for missing recovery APIs.

- [ ] **Step 8: Implement recovery and query APIs**

Add paginated listing, detail, active-domain lookup, and:

```go
func ReleaseRegistrationDomainBlock(
    blockID int, adminID int, restoreUsers bool, releasedAt int64,
) (*RegistrationDomainBlock, error)
```

Restore only pending affected rows whose user is still disabled, then invalidate changed user caches.

- [ ] **Step 9: Add concurrency verification**

Run concurrent registrations with a low threshold against SQLite. Retry only transient busy errors in the model transaction. Assert no more than `threshold - 1` users and exactly one active incident.

Run: `go test ./model -run RegistrationDomain -race -count=1`

Expected: PASS. Commit with Lore intent: `Enforce domain registration limits transactionally`.

### Task 3: Shared Policy And Every Registration Entry Point

**Files:**
- Create: `service/registration_security.go`
- Test: `service/registration_security_test.go`
- Modify: `controller/user.go`, `controller/oauth.go`, `controller/github.go`, `controller/discord.go`, `controller/linuxdo.go`, `controller/oidc.go`, `controller/wechat.go`, `controller/misc.go`
- Modify tests for password, verification, unified OAuth, and legacy OAuth controllers
- Modify: `i18n/keys.go`, `i18n/locales/{en,zh-CN,zh-TW,pt}.yaml`

- [ ] **Step 1: Write failing pure policy tests**

Test disabled risk, exact trusted domain, non-matching trusted parent, subdomain rejection, active block, and email-less registration.

- [ ] **Step 2: Verify RED**

Run: `go test ./service -run TestRegistrationSecurity -count=1`

Expected: compile failure.

- [ ] **Step 3: Implement shared policy and verify GREEN**

Return normalized domain, whether counting applies, and typed public-safe errors. Run the Step 2 command; expected PASS.

- [ ] **Step 4: Write failing password and verification endpoint tests**

Prove subdomain rejection, active-block rejection before mail send, threshold account absence, and public errors that do not expose threshold/window.

- [ ] **Step 5: Verify RED**

Run: `go test ./controller -run 'TestRegister.*Domain|TestSendEmailVerification.*Domain' -count=1`

Expected: request assertions fail.

- [ ] **Step 6: Integrate password and verification**

Apply parsing and policy before verification-code consumption. Create password users through the model transaction. Preserve auto-login and default-token behavior after success.

- [ ] **Step 7: Write failing OAuth tests**

Cover unified OAuth and legacy GitHub/Discord/LinuxDO/OIDC/WeChat first registration. Existing-user OAuth login must remain allowed.

- [ ] **Step 8: Verify RED**

Run: `go test ./controller -run 'Test.*OAuth.*RegistrationDomain|Test.*Auth.*RegistrationDomain' -count=1`

Expected: new-user cases fail.

- [ ] **Step 9: Integrate every email-bearing OAuth path**

Call the shared transaction only for first registration. Leave email-less providers unchanged.

- [ ] **Step 10: Add translations and verify GREEN**

Add invalid-domain, subdomain-rejected, and registration-domain-unavailable keys in all complete backend locales.

Run: `go test ./i18n ./service ./controller -run 'Registration|EmailDomain|OAuth|Auth' -count=1`

Expected: PASS. Commit with Lore intent: `Apply domain risk policy to every registration path`.

### Task 4: Administrator APIs And Trusted-Domain Recovery

**Files:**
- Create: `controller/registration_domain_risk.go`
- Test: `controller/registration_domain_risk_test.go`
- Modify: `controller/option.go`
- Modify: `router/api-router.go`
- Test: `router/registration_domain_risk_test.go`

- [ ] **Step 1: Write failing API tests**

Test admin authorization, pagination, detail, unblock-only, and unblock-and-restore. The primary action persists a normalized trusted domain and returns restored count.

- [ ] **Step 2: Verify RED**

Run: `go test ./controller ./router -run TestRegistrationDomainRiskAdmin -count=1`

Expected: handler or route missing.

- [ ] **Step 3: Implement handlers and option validation**

Validate `registration_security.*` updates before persistence. The release handler accepts `restore_users` and `add_trusted_domain`; it persists trusted configuration with the release, then publishes normal option invalidation.

- [ ] **Step 4: Register routes**

Add an `AdminAuth()` group:

```go
domainRiskRoute.GET("/blocks", controller.GetRegistrationDomainBlocks)
domainRiskRoute.GET("/blocks/:id", controller.GetRegistrationDomainBlock)
domainRiskRoute.POST("/blocks/:id/release", controller.ReleaseRegistrationDomainBlock)
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `go test ./controller ./router ./model ./setting/system_setting -run RegistrationDomain -count=1`

Expected: PASS. Commit with Lore intent: `Make domain incidents recoverable from admin APIs`.

### Task 5: Admin Console Settings And Incident Management

**Files:**
- Create: `web/default/src/features/system-settings/auth/registration-risk-api.ts`
- Create: `web/default/src/features/system-settings/auth/registration-risk-section.tsx`
- Test: `web/default/src/features/system-settings/auth/registration-risk-section.test.tsx`
- Modify: `web/default/src/features/system-settings/auth/basic-auth-section.tsx`
- Modify: `web/default/src/features/system-settings/auth/section-registry.tsx`
- Modify: `web/default/src/features/system-settings/auth/index.tsx`
- Modify: `web/default/src/features/system-settings/types.ts`
- Modify: `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi,es,pt}.json`

- [ ] **Step 1: Write failing component tests**

Mock APIs and assert settings serialization, subdomain-switch placement, incident rendering, primary flags `true/true`, and unblock-only flags `false/false`.

- [ ] **Step 2: Verify RED**

From `web/default`: `bun run test -- registration-risk-section.test.tsx`

Expected: module missing.

- [ ] **Step 3: Implement API and React Query hooks**

Use the shared API client. Invalidate system-options and incident queries after release.

- [ ] **Step 4: Implement settings and incident UI**

Place the subdomain switch below the existing whitelist controls. Add a `Registration Risk` auth section with switches, numeric inputs, trusted-domain editor, incident table, and confirmation dialogs. Primary action is `Unblock and restore`; secondary action is `Unblock only`.

- [ ] **Step 5: Add eight real translations**

Run `bun run i18n:sync`; confirm no new untranslated keys.

- [ ] **Step 6: Verify frontend and commit**

Run:

```text
bun run test -- registration-risk-section.test.tsx
bun run typecheck
```

Expected: PASS. Commit with Lore intent: `Let administrators configure and recover domain blocks`.

### Task 6: Verification And Review

**Files:** Modify only files required by verified failures or review findings.

- [ ] **Step 1: Focused backend verification**

Run:

```text
go test ./common ./setting/system_setting ./model ./service ./controller ./router ./i18n -count=1
go test ./model -run RegistrationDomain -race -count=1
```

Expected: PASS.

- [ ] **Step 2: Frontend verification**

From `web/default` run:

```text
bun run test -- registration-risk-section.test.tsx
bun run typecheck
bun run i18n:sync
bun run build:check
```

Expected: PASS with no new untranslated keys.

- [ ] **Step 3: Build and static checks**

Build required embedded frontend assets, run `go build ./...`, format changed Go files, and run `git diff --check`.

- [ ] **Step 4: Requirement audit**

Re-read every design acceptance criterion and map it to fresh test or UI evidence. Confirm final router deployment guidance from the actual import/diff graph.

- [ ] **Step 5: Code review**

Invoke the repository code-review workflow on the final diff. Fix only verified findings and rerun affected checks.

- [ ] **Step 6: Commit verification fixes if needed**

Use a Lore commit explaining the verified risk. Do not create an empty commit.
