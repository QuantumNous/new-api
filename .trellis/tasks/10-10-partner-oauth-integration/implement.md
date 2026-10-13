# Implementation plan: Partner OAuth

Branch: `feat/partner-oauth` (from `main` @ `be09fdb01`). Do not push or merge to `main` without review (merge = production deploy).

## Ordered checklist

1. **Model** — `model/partner_oauth.go`
   - [ ] `PartnerOAuthClient`, `PartnerOAuthBinding`, `PartnerOAuthToken` structs + `TableName()` only if GORM default differs.
   - [ ] Add to `migrateDB()` AutoMigrate list in `model/main.go`.
   - [ ] AuthFlow purposes `partner_oauth_request`, `partner_oauth_code` in `model/auth_flow.go`; export `CreateAuthFlowWithTx` if needed (keep `createAuthFlowWithTx` callers working).
   - [ ] Client CRUD (`CreatePartnerOAuthClient`, `GetPartnerOAuthClientByClientID`, list/update/rotate/delete-with-revocation).
   - [ ] `CreatePartnerOAuthBindingWithTx` (binding + tokens), `FindPartnerOAuthToken(hash)`, `RotatePartnerOAuthRefreshToken` (CAS), `RevokePartnerOAuthBindingWithTx`, `RevokePartnerOAuthBindingByAuthorizationFlow`, `IssuePartnerOAuthCredential` (lockForUpdate binding, create/load token), `DeleteExpiredPartnerOAuthTokens`.
   - [ ] All `SELECT … FOR UPDATE` via `lockForUpdate(tx)`; no raw SQL.
2. **Service** — `service/partner_oauth.go`
   - [ ] Issuer/host helpers, scope canonicalization, redirect matching (exact + loopback port exception), state/challenge/verifier validation, PKCE S256.
   - [ ] Begin authorization, inspect, decide; exchange code; refresh; revoke; authenticate AT; credential; client secret generation/verification; admin validation.
   - [ ] Typed error `PartnerOAuthError{Status, Code, Description}`.
   - [ ] Cleanup hook in `service/auth_cleanup.go`.
   - [ ] Authz resource `service/authz/resources_partner_oauth.go` (`read`+`operate` default admin, `sensitive_write` no default); update matrix expectations in `service/authz/authz_test.go`.
   - [ ] Verification scope `partner_oauth.client.sensitive_write` + strict context normalization in `service/security_verification.go` (`BindVerificationOperation`, method policy like `channel.key.read`).
3. **Middleware** — `middleware/partner_oauth.go`: Bearer auth for integration API; protocol-shaped rate limiter; logger strip for `/api/partner-oauth/` and `/partner-authorize` in `middleware/logger.go`.
4. **Controller** — `controller/partner_oauth.go` (authorize, token, revoke, account, credential, consent API, HTML error page, user bindings list/revoke), `controller/partner_oauth_client.go` (admin CRUD + status; `RequireSecurityProof` with server-derived context on create/update/rotate/delete, after body validation).
5. **Router** — `router/partner-oauth-router.go`; call `SetPartnerOAuthRouter` in `router/main.go` before web router. Admin routes `AdminAuth()` + `RequirePermission(authz.PartnerOAuthClient{Read,Operate,SensitiveWrite})` (not `RootAuth`).
6. **i18n backend** — error page title/description keys (en, zh).
7. **Frontend**
   - [ ] Read `web/AGENTS.md`, `.agents/skills/shadcn-ui/SKILL.md`, `.trellis/spec/frontend/*`; inspect `features/desktop-authorization` and `system-settings/auth/custom-oauth` for reusable components.
   - [ ] Consent page `features/partner-authorization/` + route `_authenticated/partner-authorize/index.tsx` (search schema `request`), frame guard, no-referrer navigation.
   - [ ] Admin page `features/partner-oauth-clients/` + route `_authenticated/partner-oauth-clients/index.tsx` (`beforeLoad`: admin role + `partner_oauth_client.read`, else `/403`): table, create/edit dialog, one-time secret dialog with existing copy component, enable/disable, rotate/delete confirm with existing `ConfirmDialog`; sensitive actions go through the existing secure-verification dialog (`X-Security-Proof`); buttons gated by `hasPermission`.
   - [ ] Sidebar: optional `requiredPermission` on nav items (`components/layout/types.ts`, `hooks/use-sidebar-view.ts`); add entry to the Admin group in `hooks/use-sidebar-data.ts`; `PARTNER_OAUTH_CLIENT` in `lib/admin-permissions.ts`; catalog label/description keys in `i18n/static-keys.ts`.
   - [ ] “已授权应用” card `features/security/components/authorized-apps-card.tsx` after `LoginSessionsCard`, API in `features/security/api.ts`, revoke via existing `ConfirmDialog`, empty/loading/error states.
   - [ ] i18n keys in all 7 locale files (`bun run i18n:sync`), oxfmt formatting.
8. **Tests** (keep to one new test file per layer at most; table-driven; testify)
   - [ ] `model/partner_oauth_test.go`: migrate, binding+tokens creation, CAS rotation single winner, revoke disables key + idempotent, credential single key under concurrency, expired token cleanup.
   - [ ] `service/partner_oauth_test.go`: RFC 7636 vector, redirect matrix (exact, loopback port, https only, query preserved), scope matrix, code expiry/replay/PKCE/redirect mismatch, refresh rotation + replay revocation, auth-version change, revoke semantics.
   - [ ] `controller/partner_oauth_test.go` (httptest through router): full flow both client types, Basic failure header, form/media/duplicate params, revoke empty 200, integration 401 empty/invalid/403 scope/415/400 body, iss/state on callbacks, invalid client → HTML 400 no redirect, `X-Request-Id`/no-store headers, admin secret shown once, admin authz matrix (user/default admin/granted admin/denied-read admin/Root) and proof cases (missing/expired/reused/other client/other action; invalid body keeps proof unconsumed).
   - [ ] Frontend: consent page states (loading, approve, deny, error, framed), admin form validation, sidebar/route/button permission gating.
9. **Spec/docs** — `.trellis/spec/backend/partner-oauth.md`; index + `AGENTS.md` module table row. (No new files under `docs/` unless the user asks.)

## Validation commands

```bash
gofmt -l model service controller middleware router
go vet ./model/... ./service/... ./controller/... ./middleware/... ./router/...
make test                                  # inside a task Docker Go runner (DB tests rule)
cd web && bun run test && bun run typecheck && bun run lint && bun run build
```

Database matrix (Docker, task-owned containers, names prefixed `partner-oauth-`):
- SQLite (in Go runner container), MySQL 5.7.8+ (`mysql:5.7`) and 8.0, PostgreSQL 9.6 (`postgres:9.6`) and 16.
- Fresh AutoMigrate ×2 (idempotent), plus upgrade from a schema created by current `main` ×2; run model/service partner tests against each engine; record `SELECT VERSION()` / `SHOW server_version`.

## Review gates / rollback points
- Gate A after steps 1–2: model + service tests green on SQLite.
- Gate B after steps 3–6: controller flow tests green.
- Gate C after step 7: frontend tests/typecheck/build.
- Gate D: three-DB matrix + `trellis-check`.
- Each gate is a natural commit boundary; rollback = revert that commit. Commits are drafted at Phase 3.4 and need user confirmation.

## Risky files
- `model/main.go` (migration list), `model/auth_flow.go` (shared flows), `middleware/logger.go` (shared logging), `router/main.go` (route order), `service/authz/*` (shared permission catalog; built-in policies reseeded on startup), `service/security_verification.go` (shared step-up scopes), `hooks/use-sidebar-view.ts` (shared nav filter).
