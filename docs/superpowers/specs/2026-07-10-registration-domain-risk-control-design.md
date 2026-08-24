# Registration Domain Risk Control Design

## Summary

Add configurable registration abuse protection for email domains. The system detects high-volume registrations from the same non-trusted domain within a rolling time window, blocks the triggering registration, blocks future registrations from that domain, and disables existing enabled users on that domain. Administrators can review incidents and precisely restore only users disabled by the automated rule.

The same auth settings area also gains an independent switch that rejects email addresses hosted on subdomains, such as `user@mail.example.com`, while correctly allowing registrable domains such as `example.com.cn`.

## Goals

- Cover password registration and every OAuth first-registration path that supplies an email address.
- Default the risk rule to disabled, with a 24-hour rolling window and a threshold of 10 registrations when enabled.
- Treat the current request as part of the threshold. If nine qualifying accounts already exist, the tenth request triggers the rule and is not created.
- Block future registration and email-verification requests for an actively blocked domain.
- Disable every currently enabled account on the triggering domain, not only accounts inside the triggering window.
- Restore only accounts disabled by a specific automated incident.
- Let administrators preconfigure trusted email domains and add a domain to the trusted list during recovery.
- Preserve correctness across multiple application nodes and SQLite, MySQL, and PostgreSQL.
- Add an independent setting that rejects subdomain-hosted email addresses.

## Non-Goals

- Detect abuse by IP address, device fingerprint, payment method, email local part, or invitation relationship.
- Evaluate registration paths that do not provide a usable email address.
- Automatically delete users or erase their balance, tokens, logs, or billing records.
- Expose the configured threshold or window in public registration errors.

## Configuration

Create a `registration_security` module under `setting/system_setting` and register it through `config.GlobalConfig`.

| Key | Type | Default | Validation |
| --- | --- | --- | --- |
| `registration_security.domain_risk_enabled` | boolean | `false` | none |
| `registration_security.domain_risk_window_hours` | integer | `24` | at least `1` |
| `registration_security.domain_risk_threshold` | integer | `10` | at least `2` |
| `registration_security.trusted_email_domains` | string list | empty | normalized valid domains only |
| `registration_security.reject_subdomain_email_domains` | boolean | `false` | none |

Trusted domains are exact email-domain exemptions. `example.com` does not implicitly trust `mail.example.com`. Values are trimmed, converted to lower case, deduplicated, and stored in stable sorted order.

The new subdomain switch is displayed beside the existing email-domain whitelist controls because it affects the same registration input. It remains independent: when enabled, it rejects subdomain email domains even if the existing whitelist restriction is disabled.

## Domain Parsing And Subdomain Policy

Use one shared parser for all registration and verification paths:

1. Trim the email and split it using the final `@` separator.
2. Normalize the domain to lower case and reject malformed values.
3. Use `golang.org/x/net/publicsuffix.EffectiveTLDPlusOne` to determine the registrable domain.
4. When subdomain rejection is enabled, require the normalized email domain to equal the registrable domain.

This permits `user@example.com` and `user@example.com.cn`, while rejecting `user@mail.example.com`. It avoids label-counting mistakes for public suffixes such as `co.uk` and `com.cn`. The existing `golang.org/x/net` dependency is reused; no dependency is added.

## Persistence Model

### User Domain Index

Add a normalized, indexed `email_domain` column to `User`. New registrations populate it whenever an email is present.

Existing rows are handled without a blocking startup migration. Queries use `email_domain = ?` and a compatibility fallback for rows where `email_domain` is empty. Matching legacy rows are updated opportunistically in bounded batches. All updates are idempotent and safe when multiple nodes perform them.

### Domain State

Add `registration_domain_states`, one row per normalized domain:

- unique domain
- active block ID, nullable/zero when unblocked
- `counting_since`, used to reset counting after a manual release
- created and updated timestamps

This row is also the cross-node serialization point for registration checks.

### Block Incidents

Add `registration_domain_blocks`, one immutable incident row per trigger:

- domain
- configured window and threshold snapshots
- observed count including the rejected triggering request
- rolling-window start and block timestamp
- release timestamp, release mode, and releasing administrator
- active/released status

Configuration snapshots preserve why an incident fired even if settings later change.

### Affected Users

Add `registration_domain_block_users`:

- block ID and user ID, unique as a pair
- status before automated disable
- disable timestamp
- restore timestamp and restoring administrator

Only users that were enabled and actually changed to disabled are recorded. Previously manually disabled users are not recorded and cannot be re-enabled by incident recovery.

## Registration Transaction

All email-bearing account creation paths call one registration risk service before creating the user. The service receives the normalized email domain and the same database transaction used to create the account.

For a qualifying domain:

1. Skip domain-risk counting when the rule is disabled or the domain is trusted.
2. Ensure the domain-state row exists using an idempotent insert.
3. Start a transaction and acquire a write lock on the domain-state row. On SQLite, perform an early state-row write so concurrent checks serialize through SQLite's write lock; on MySQL and PostgreSQL, use the normal row update lock.
4. Reject immediately if the state points to an active block.
5. Count successful users from the rolling lower bound `max(now - window, counting_since)` through the current time.
6. Add the current request conceptually to the count.
7. If the result is below the threshold, create the user in the same transaction.
8. If the result reaches the threshold, do not create the user. Create the incident, mark the domain blocked, select all enabled users on the domain, record the affected-user rows, and disable those users in the same transaction.
9. Commit the incident and return a typed registration-blocked error to the controller.

Password registration must move user creation into this transaction. OAuth already creates users transactionally and will use the same service. Legacy provider-specific registration controllers must be routed through the shared guard as well.

The domain lock makes the threshold decision deterministic across nodes. At most `threshold - 1` successful registrations can occur within the active rolling interval.

## Public Request Behavior

- Password and OAuth first-registration return the existing API response shape with a new internationalized registration-blocked message.
- Public errors state that registration with the email domain is unavailable. They do not disclose the threshold, window, user count, or whether other users were disabled.
- Existing-user OAuth login is not a registration and is unaffected.
- `SendEmailVerification` applies domain parsing, the subdomain policy, the existing allowlist policy, and active-block rejection before sending mail.
- A verification request does not increment the registration count.
- Registration paths without an email remain unchanged because no domain can be evaluated.

## Administration And Recovery

Add a registration-domain-risk panel under system settings authentication. It contains:

- enable switch, window hours, threshold, and trusted-domain editor
- active and historical incident table
- domain, trigger time, observed count, affected-user count, status, and release details
- incident detail with affected users

Actions:

### Unblock And Restore

- Release the active domain block.
- Restore only users recorded for that incident whose restoration is still pending and whose current status is disabled.
- Add the domain to the trusted-domain configuration by default.
- Set `counting_since` to the release time.
- Persist the option update, incident release, user restoration, and audit fields atomically where possible, then publish the normal configuration invalidation after commit.

This is the primary one-click recovery path for a false positive.

### Unblock Only

- Release the active block without restoring users.
- Do not add the domain to the trusted list.
- Set `counting_since` to the release time so registrations before release do not immediately retrigger the rule.

### Trusted Domain Management

Administrators can add trusted domains before an incident. An actively blocked domain must be recovered through an unblock action rather than silently becoming trusted through the generic editor; this keeps incident status and user recovery explicit.

All recovery endpoints are admin-only, idempotent, and return the current incident state when an action was already applied.

## API Shape

Use admin-authenticated routes under `/api/registration-domain-risk`:

- `GET /blocks` for paginated active/history results
- `GET /blocks/:id` for incident and affected-user details
- `POST /blocks/:id/release` with `restore_users` and `add_trusted_domain` booleans

Configuration continues through the existing system-option APIs using the registered `registration_security.*` keys. Request validation is enforced in the backend, not only in the form schema.

## Cache And Multi-Node Behavior

- Database rows are the source of truth for active blocks and recovery state.
- Process memory and Redis must not be required for a correct threshold decision.
- Existing option propagation updates the in-memory `registration_security` configuration on every node after an administrator saves settings or recovery adds a trusted domain.
- User cache entries are invalidated after automated disable and restoration using existing cross-node cache invalidation mechanisms.
- Retrying a trigger or recovery operation is safe because state transitions and affected-user records are idempotent.

## Error Handling

- Invalid configuration is rejected without partially saving other risk settings.
- A database failure during trigger processing rolls back the block and all user-status changes; the registration fails closed with a generic registration error.
- A database failure during recovery rolls back release and restoration together.
- If post-commit cache publication fails, the database remains authoritative and the error is logged for retry; request-time active-block checks still read database state.
- Invalid or public-suffix-only email domains are rejected as invalid email domains.

## Testing Strategy

Follow test-driven development. Each behavior test must fail for the expected missing behavior before production code is added.

### Backend Unit And Integration Tests

- domain normalization and exact trusted-domain matching
- public-suffix-aware subdomain decisions for `example.com`, `mail.example.com`, `example.com.cn`, and `mail.example.com.cn`
- configuration defaults, normalization, and invalid threshold/window/domain rejection
- ninth successful registration followed by a rejected tenth request
- the triggering account is absent after the transaction commits
- all enabled users on the domain are disabled, including users older than the rolling window
- previously disabled users are not added to the affected-user set
- active block rejects password, OAuth first-registration, and email verification
- existing OAuth login remains allowed
- trusted domains bypass domain-risk counting but still obey the independent subdomain switch
- unblock-and-restore restores only pending automated disables and adds the trusted domain
- unblock-only resets `counting_since` and does not restore or trust
- repeated release requests are idempotent
- concurrent requests cannot create more than `threshold - 1` users in the window
- SQLite integration coverage plus query-shape compatibility for MySQL and PostgreSQL

### Frontend Tests

- settings form validation and serialization
- subdomain switch placement beside existing domain whitelist controls
- incident table states and counts
- recovery confirmation defaults to restore users and add the trusted domain
- unblock-only action sends the intended flags
- successful recovery refreshes settings and incident queries

### Verification Commands

- targeted Go tests for the model, service, controller, router, setting, and i18n changes
- `go test ./controller/... ./model/... ./service/... ./setting/... ./router/...`
- `go build ./...` after the required embedded frontend assets are built
- from `web/default`: `bun run typecheck`, targeted Vitest tests, `bun run i18n:sync`, and `bun run build:check`

The clean `origin/main` baseline on 2026-07-10 has unrelated full-suite failures: the root Go package cannot embed a missing `web/classic/dist`, and existing Claude file-content conversion tests fail. These are baseline gaps, not acceptance exceptions for changed packages; all targeted tests and frontend checks for this feature must pass.

## Deployment And Operations

- Auto-migration adds the new tables and `users.email_domain` column on console startup.
- This feature changes registration and admin-console behavior, so deploy `newapi-console`, which owns the registration endpoints. The legacy `newapi` service is decommissioned and is not a deployment target.
- Router deployment is not required unless the production topology imports the modified shared initialization/model migration path into router nodes. Confirm the final dependency diff before release.
- Deploy first with domain risk disabled, verify migrations and the admin panel, configure trusted domains, then enable the rule.
- Monitor block incidents and registration errors after activation. The primary rollback is disabling `domain_risk_enabled`; active incidents remain available for explicit recovery.

## Acceptance Criteria

- An administrator can configure and enable the rolling domain threshold without a restart.
- With defaults enabled, the tenth same-domain registration within 24 hours is rejected and does not create a user.
- The domain becomes blocked and all previously enabled users on it become disabled.
- Password registration, every email-bearing OAuth first-registration, and verification-email requests respect an active block.
- One recovery action restores only users disabled by that incident and can add the domain to trusted domains.
- Unblock-only permits observation without immediate retrigger from pre-release registrations.
- The independent subdomain switch correctly rejects subdomain email domains using public suffix rules.
- Concurrent multi-node requests cannot bypass the threshold.
- Targeted backend tests, frontend tests, type checking, i18n checks, and builds pass, with any unrelated baseline gaps reported separately.
