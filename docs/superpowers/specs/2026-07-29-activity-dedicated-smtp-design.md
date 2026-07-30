# Activity Dedicated SMTP Design

## Goal

Give every Activity Configuration campaign one shared SMTP configuration that is isolated from Flatkey's transactional email configuration. Registration verification, email binding, quota notifications, and other non-activity messages continue to use the existing global SMTP settings.

Activity delivery fails closed. If the dedicated configuration is missing or unusable, activation or delivery reports an administrator-visible error and never falls back to the global SMTP account.

## Scope

This design covers:

- one administrator-managed SMTP configuration shared by promotion and content-only activities;
- SMTP host, port, account, envelope/from address, token, implicit TLS, and forced `AUTH LOGIN` behavior;
- activity-specific Message-ID domains;
- activation-time configuration validation;
- delivery-time errors, bounded retries, and administrator-visible diagnostics;
- reuse of the existing SMTP transport without changing non-activity email behavior.

It does not add per-campaign credentials, provider-specific APIs, inbound email, SMTP test messages, a new email-provider abstraction, or a new dependency.

## Current Behavior on `main`

The Activity worker receives `common.SendEmailFromWithMessageID`. It resolves `recall_campaign_setting.email_from` against aliases configured on the global SMTP account, then sends through the global SMTP host, account, token, and TLS settings.

The Activity index therefore offers a sender-alias selector, not an isolated SMTP connection. Missing or invalid alias configuration stops a batch before it leases messages or reserves hourly quota. SMTP failures store an error code, but the stored administrator-visible message is empty.

## Chosen Architecture

### Value-based SMTP transport

Add a value-based SMTP configuration type in `common`. It contains:

- server;
- port;
- account;
- from address;
- token;
- implicit TLS flag;
- forced `AUTH LOGIN` flag.

Refactor SMTP validation, authentication selection, message construction, TLS connection, and sending to operate on this explicit value. Preserve `SendEmail`, `SendEmailWithMessageID`, and `SendEmailFromWithMessageID` as compatibility wrappers over a snapshot of the existing global SMTP variables.

Activity code calls only the value-based transport. Transactional callers continue using the compatibility wrappers, so Activity cannot mutate or inherit their connection settings.

### Activity SMTP settings

Extend `RecallCampaignSetting` with activity SMTP fields. Reuse the existing `email_from` field as the dedicated Activity envelope/from address so an already selected Activity address remains visible during configuration. It is no longer validated against global `SMTPFromAliases`.

Add flattened option keys under `recall_campaign_setting` for server, port, account, token, implicit TLS, and forced `AUTH LOGIN`. The existing options table and GlobalConfig reload mechanism persist and propagate them; no database schema migration is required.

`GetRecallCampaignSetting` continues returning a locked value copy. Each delivery attempt obtains a fresh copy, so updates take effect without process restart. Redis pub/sub provides prompt cross-node propagation and the existing periodic option reload remains the fallback.

The generic options response must treat `_token` keys as sensitive. The dedicated Activity SMTP response returns `token_configured`, never the token value.

### Atomic update boundary

Expose a dedicated administrator-only settings API:

- `GET /api/recall-campaigns/smtp`
- `PUT /api/recall-campaigns/smtp`

The GET response contains non-secret values and configuration status:

```json
{
  "server": "smtp.example.com",
  "port": 587,
  "account": "campaigns@example.com",
  "email_from": "campaigns@example.com",
  "ssl_enabled": false,
  "force_auth_login": false,
  "token_configured": true,
  "configured": true
}
```

The PUT request accepts the same editable fields plus `token`. An empty token preserves the stored credential. A first-time save requires a non-empty token.

All fields are validated together and persisted in one database transaction. Individual generic-option updates for these Activity SMTP keys are rejected so a normal API call cannot publish a partial configuration. After commit, the local GlobalConfig snapshot is updated and the existing option-change notification is published for peer nodes.

### Existing sender-alias surface

The Activity sender-alias selector and its Activity endpoint are replaced by the dedicated SMTP card. The `email_from` value remains the Activity from address, but Activity delivery no longer resolves it through global SMTP aliases.

Global SMTP aliases may remain stored for backward compatibility with existing option data, but they do not authorize or configure Activity delivery. No Activity request reads the global SMTP server, account, token, TLS flags, or alias list.

### Activity runtime wiring

Change `RecallEmailSender` to receive an explicit SMTP configuration snapshot. The production worker calls the value-based common transport; tests continue injecting a fake sender and never contact an external SMTP server.

Before leasing messages or reserving hourly quota, `RunBatch` validates a fresh dedicated configuration snapshot. Missing or partial configuration leaves queued messages untouched and returns the stable `activity_smtp_not_configured` failure to runtime logs and the settings status API.

`ProcessLeased` validates another fresh snapshot before creating a new provider Message-ID. This closes the gap where configuration changes after a batch-level check. New Message-IDs use the dedicated from-address domain. A Message-ID already persisted for an earlier attempt remains stable across retries, including after an SMTP configuration change.

## Administrator Interface

Replace the compact Activity sender selector with one Activity SMTP card on the Activity Configuration index page. The card is shared by all campaigns and contains:

- SMTP host;
- port;
- account;
- from address;
- password/access token;
- implicit TLS toggle;
- forced `AUTH LOGIN` toggle;
- configured/not-configured status;
- save action and inline failure text.

The token input is a password field and always loads empty. Help text states that leaving it empty preserves the stored credential. Saving non-secret fields without entering a token does not clear it.

The existing Activity hourly limit remains independent. SMTP save failures do not change the confirmed form values or the hourly limit. All new user-visible strings are translated in the eight existing console locales.

## Validation and Failure Behavior

### Configuration save

Validate the complete effective configuration before committing:

- host, account, from address, and effective token are required;
- port is within `1..65535`;
- from address is one plain mailbox with a syntactically valid domain;
- header-breaking characters and display-name syntax are rejected;
- partial configurations are rejected rather than stored as usable settings.

This iteration intentionally has no credential-clear operation. An ordinary empty token submission means preserve, not delete.

### Campaign activation and resume

Before moving a draft or paused campaign into a delivery-capable state, validate the dedicated SMTP snapshot. Failure leaves campaign state unchanged and returns a clear administrator-facing message directing the operator to Activity SMTP settings.

Email template preview remains render-only and does not require SMTP configuration.

### Delivery time

If configuration becomes missing or invalid after activation:

- do not lease a new batch or consume hourly quota;
- do not call any global SMTP wrapper;
- return `activity_smtp_not_configured` with a safe settings-oriented message;
- leave queued messages available after configuration repair.

If SMTP sending begins and returns a definite connection, authentication, sender, or recipient failure:

- record `activity_smtp_send_failed`;
- store a safe administrator-visible message that names the likely settings to check;
- log the detailed transport error without credentials or rendered message content;
- count the attempt against the Activity hourly allowance;
- retain the existing bounded retry and manual-retry behavior.

If the result becomes uncertain after SMTP `DATA` begins, preserve the existing `smtp_uncertain` state and acknowledgement requirement so automatic retry cannot create duplicate deliveries.

The campaign detail page translates and displays known stored error messages. It never displays SMTP tokens, authentication payloads, or rendered email bodies.

## Compatibility and Rollout

Transactional email callers keep their current global SMTP behavior. Activity campaigns already stored on deployment remain viewable, but activation, resume, and delivery are blocked until the dedicated SMTP is complete.

There is no automatic copy from global SMTP. Copying would weaken isolation and could silently send campaign mail from the transactional account.

Production is multi-node. Configuration correctness relies on the options table transaction, GlobalConfig's locked snapshots, pub/sub invalidation, and periodic reload rather than process-local mutation or ordering.

The code affects the console/backend runtime that manages and sends Activity mail. It does not affect router request handling, although the repository may deploy console and router from the same backend artifact.

## Test Strategy

### Go tests

- explicit SMTP configuration validation, auth selection, from header, envelope sender, TLS host, and Message-ID domain;
- existing global wrappers still read only global SMTP variables;
- Activity sender uses only the dedicated configuration and never falls back;
- dedicated option writes are atomic, preserve an empty submitted token, redact the token, and reload across existing config hooks;
- activation and resume fail without complete Activity SMTP and leave state unchanged;
- batch and leased-message checks observe the latest configuration;
- definite failures record `activity_smtp_send_failed` with a safe visible message and bounded retry;
- uncertain failures preserve `smtp_uncertain` behavior;
- no test sends external email; transport tests use the existing local fake SMTP server or an injected sender.

### Frontend tests

- settings status loads without a token value;
- complete settings save through the dedicated endpoint;
- empty token preserves the credential;
- invalid host/port/from and incomplete first-time configuration show inline errors;
- failed saves retain confirmed state and show the backend message;
- campaign activation errors surface through the existing action flow;
- campaign detail translates stored Activity SMTP errors;
- every new translation key exists in all eight locales.

### Regression checks

- focused Go tests for `common`, `setting/operation_setting`, `model`, `service`, `controller`, and router registration;
- focused Bun tests for the Activity settings card, API, action flow, and campaign detail;
- frontend typecheck, changed-file lint, i18n synchronization, production build, Go formatting, and Go build;
- the four documented `main` baseline failures are reported separately and are not fixed by this feature.

## Success Criteria

1. Administrators can configure one SMTP account shared by all Activity campaigns.
2. Promotion and content-only activities send only through that account.
3. Transactional email continues using the original global SMTP account.
4. Missing or broken Activity SMTP never falls back to global SMTP.
5. Activation, resume, configuration, and delivery failures are visible without exposing secrets.
6. Corrected settings recover through the existing queue and retry behavior.
7. New focused tests pass, and unrelated known `main` failures remain clearly separated.
