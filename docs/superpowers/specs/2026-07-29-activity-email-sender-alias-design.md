# Activity Email Sender Alias Design

## Goal

Let operators choose the `From` address used by every Activity Configuration campaign while keeping the existing SMTP server, authentication account, token, TLS, and hourly quota unchanged.

The selection is global to Activity Configuration, just like the existing hourly email limit. Other system emails continue to use the existing global `SMTPFrom` behavior.

## Decisions

- System Settings > SMTP Email owns the list of permitted sender aliases.
- Activity Configuration exposes one sender-address selector beside the hourly limit.
- The configured alias applies to all Activity campaigns and to queued Activity messages when they actually send.
- SMTP credentials are never copied into campaign drafts or returned by the Activity API.
- The current `SMTPFrom` remains the default and backward-compatible sender.
- An explicit Activity alias must be present in the permitted alias list.
- Removing an alias that Activity Configuration currently uses is rejected until the Activity selection is changed.
- Invalid sender configuration fails closed before an SMTP attempt or hourly-quota reservation; queued messages remain available after configuration is repaired.

## Non-goals

- Multiple SMTP servers or authentication accounts.
- Per-campaign sender selection.
- Sender display-name customization.
- Automatic alias discovery from the SMTP provider.
- Changes to unrelated verification, password-reset, billing, or system emails.

## Settings Model

### SMTP aliases

Add the option `SMTPFromAliases`, stored using the repository's existing comma-separated option convention. The System Settings form presents it as one plain email address per line.

Server normalization:

- trim surrounding whitespace;
- require a plain mailbox address with no display name, CR, or LF;
- compare and deduplicate case-insensitively;
- exclude an entry that duplicates the current `SMTPFrom`;
- persist a deterministic comma-separated value.

The effective choices are the current `SMTPFrom` followed by the normalized aliases. `SMTPAccount` remains only the SMTP authentication account and fallback sender when `SMTPFrom` is empty.

### Activity sender

Add `EmailFrom string` with JSON key `email_from` to `RecallCampaignSetting`.

- Empty means "use the current default SMTP sender" and preserves existing installations without migration.
- A non-empty value is an explicit alias and must match an effective configured choice case-insensitively.
- The stored value is normalized to the canonical configured spelling.

No database schema migration is required because both values use the existing option/configuration storage.

## API

Keep the existing email-quota endpoints unchanged and add a focused Activity sender API:

- `GET /api/recall-campaigns/email-sender`
- `PUT /api/recall-campaigns/email-sender`

The GET response contains only non-secret data:

```json
{
  "configured_email_from": "campaigns@example.com",
  "effective_email_from": "campaigns@example.com",
  "uses_default": false,
  "options": [
    { "email": "system@example.com", "is_default": true },
    { "email": "campaigns@example.com", "is_default": false }
  ]
}
```

The PUT request accepts either an empty string for the current default or one listed alias:

```json
{ "email_from": "campaigns@example.com" }
```

The server rejects malformed or unlisted values. It returns the normalized sender state after saving.

Updating `SMTPFromAliases` is also validated server-side. An update that removes the explicitly selected Activity alias returns a conflict-style validation error and leaves both settings unchanged.

## Sending Flow

Add an explicit-sender email function in `common` while preserving the existing functions for all other callers:

```text
SendEmailWithMessageID
  -> current global SMTPFrom behavior

SendEmailFromWithMessageID(from, ...)
  -> same SMTP server/account/token/TLS
  -> explicit envelope sender and From header
```

The Activity worker resolves one sender snapshot before leasing messages or reserving hourly quota for a batch. It then:

1. validates the explicit alias against the current SMTP settings;
2. derives Message-ID domains from the resolved sender;
3. passes the same sender to the envelope and `From` header;
4. sends through the existing authenticated SMTP connection path.

Changing the Activity sender affects messages that have not started an SMTP attempt. Already sent or uncertain messages retain their recorded outcome and are not replayed solely because the sender changed.

If the provider rejects an otherwise configured alias, the attempt follows the existing definite/uncertain SMTP error behavior and counts against the hourly attempt limit because SMTP sending already started.

## User Interface

### System Settings > SMTP Email

Add `Allowed From aliases` below the existing `From address` field:

- textarea, one address per line;
- explanatory text that aliases must already be authorized by the SMTP provider;
- inline syntax and duplicate validation;
- never display or duplicate the SMTP token.

### Activity Configuration

Place an `Activity sender address` dropdown in the same settings area as `Activity email hourly limit`.

- The first option is `Default SMTP sender (address)`.
- Remaining options are the configured aliases.
- The selector has its own save action so sender updates do not partially update the quota.
- Loading, saving, load-error, and stale-edit behavior follow the existing quota control patterns.
- Help text states that all Activity campaigns share the selection and other system emails are unaffected.

All new strings are added to the eight existing Console locales.

## Failure and Compatibility Behavior

- Existing deployments have `email_from = ""` and continue using the current SMTP sender.
- Existing Activity drafts and messages require no rewrite.
- If the default SMTP sender is malformed or absent, Activity sending remains blocked by the existing SMTP validation.
- If an explicit alias becomes invalid through out-of-band configuration changes, the worker stops before leasing or consuming quota, the Activity page reports the invalid selection, and queued messages wait for repair.
- A normal API cannot orphan the Activity selection because alias removal is rejected while selected.
- Other email services continue calling the original global-sender functions and cannot observe the Activity selection.

## Security

- Accept only plain mailbox addresses and reject header breaks or display-name syntax.
- Enforce allow-list membership on both save and send, not only in the browser.
- Do not expose `SMTPToken` or other credentials through the Activity endpoints.
- Do not mutate process-global `SMTPFrom` per message; the selected sender is passed explicitly to avoid cross-request races.

## Testing

Backend coverage:

- alias parsing, normalization, deduplication, and header-injection rejection;
- default and explicit Activity sender resolution;
- GET/PUT authorization and redacted response shape;
- rejection of unlisted aliases and removal of an active alias;
- explicit sender used for SMTP envelope, `From` header, and Message-ID domain;
- Activity worker uses the selected sender while unrelated email calls retain global `SMTPFrom`;
- invalid configuration does not lease a message or reserve quota;
- queued messages use the new sender after a configuration change.

Frontend coverage:

- SMTP alias textarea normalization and validation;
- Activity sender dropdown loading, default option, save success, save rollback, and error states;
- Activity sender control remains independent from quota edits;
- locale completeness and UTF-8 integrity.

Final verification includes focused Go and Bun tests, typecheck, changed-file lint, production build, i18n synchronization, `go build ./...`, and independent review.

## Acceptance Criteria

- An administrator can maintain multiple permitted From aliases under one SMTP account.
- An operator can select one global Activity sender without entering SMTP credentials.
- All Activity emails use the selected address for both envelope and visible `From` header.
- Other system emails keep using the existing global sender.
- Invalid or removed selections cannot silently fall back to another sender or consume Activity quota.
- Existing installations continue sending through the current default without migration.
