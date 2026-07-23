# Activity Configuration Audience Design

## Goal

Rename the administrator-facing recall campaign area to **Activity Configuration** and add two explicit audience templates for operational use:

1. **Registered only** selects users who have registered, have never paid, and have never made an API request within an operator-configured registration time range.
2. **Specified users** selects an exact union of user IDs and email addresses so operators can run controlled tests, including addresses that do not yet belong to a Flatkey account.

Existing user-backed recipients retain their current delivery, coupon, email, activation, claim, unsubscribe, and audit behavior. Email-only recipients use the same pipeline with an explicit recipient identity and account-free delivery rules described below.

## Product terminology

- Replace the user-facing recall campaign navigation label, list heading, empty state, create/edit titles, detail return label, and related action copy with Activity Configuration terminology in every supported Console locale.
- Chinese uses `活动配置` as the primary area name.
- Internal route paths, API paths, Go type names, database table names, and existing stored campaign records keep their current recall campaign names for compatibility.

## Audience templates

### Existing templates

`first_purchase`, `lapsed_payer`, and `expired_subscription` keep their current contracts and selection results. In particular, `first_purchase` is not redefined as registered-only.

### Registered only

Add the stored audience template value `registered_only`.

A user is eligible only when all of the following are true:

- the account is enabled;
- the stored email is valid;
- the user has not opted out of recall marketing;
- the email is verified when the campaign's existing `require_verified_email` option is enabled;
- the user passes the existing optional user-group allow/block filter;
- the user has no successful payment history;
- `request_count` is exactly `0`;
- `created_at` is greater than or equal to `registration_start_at` and less than or equal to `registration_end_at`.

The template exposes two required `datetime-local` controls. The browser converts the selected local timestamps to Unix seconds before submission. Both boundaries are inclusive. Validation rejects missing values, non-positive timestamps, or an end earlier than the start.

This template does not expose minimum request count, maximum quota, last API call age, payment provider, or payment-age fields because they do not define the requested audience.

### Specified users

Add the stored audience template value `specified_users`.

The editor exposes two separate controls:

- a searchable, multi-select user picker backed by the existing admin user-search capability; and
- a multiline email input accepting comma- or newline-separated email addresses.

Operators do not need to discover or type numeric user IDs. The user picker searches by the identifiers supported by the existing admin user search, displays enough account context to distinguish results, and stores the selected user IDs in `specified_user_ids`. The email input is normalized into `specified_emails`.

The backend trims values, lowercases email addresses for matching, removes duplicates, and treats the two lists as a union. A user selected in the picker and also matched by a manually entered email appears once. At least one selected user or valid email is required, and the combined normalized list is limited to 500 identifiers per campaign.

Specified users bypass the behavioral audience thresholds and registration-time filters. For an email that resolves to an existing account, the account must still be enabled, the stored email must be valid, recall marketing opt-out must be false, and verified-email enforcement follows the existing campaign switch. Optional user-group allow/block filtering is hidden for this template so an exact test list cannot be silently narrowed by unrelated audience configuration.

Unknown user IDs are ignored. A valid normalized email that does not resolve to an account becomes an email-only recipient: it is included in preview, snapshot, activation, Promotion Code provisioning, and delivery. Because there is no account record to verify or consult for status, payment, API activity, or global marketing preferences, the explicit administrator selection is authoritative until that recipient unsubscribes or becomes bound to an account. Preview exposes `user_id = 0` and only a masked address; eligibility snapshots never contain the full address.

If an entered email resolves to an existing account, the recipient uses the account identity even when the same account was also selected in the picker. A disabled, opted-out, invalid, or unverified matching account is excluded and must not be reintroduced as an email-only fallback.

## Data contract

Extend the existing JSON-backed audience configuration:

```json
{
  "registration_start_at": 0,
  "registration_end_at": 0,
  "specified_user_ids": [],
  "specified_emails": []
}
```

The fields are inactive for all other templates. Existing campaign JSON continues to decode with zero values and retains its current behavior.

Add `recipient_identity` to `recall_recipients` and make it the stable per-campaign identity:

- existing-account recipients use `user:<id>`;
- email-only recipients use `email:<sha256(lowercase(trim(email)))>`;
- the unique constraint moves from `(campaign_id, user_id)` to `(campaign_id, recipient_identity)`;
- `user_id = 0` means the recipient is not yet associated with an account; binding an account later does not change `recipient_identity`;
- existing rows are backfilled to `user:<id>` before the new unique index is enabled and the old unique index is removed.

The migration must be idempotent and compatible with SQLite, MySQL, and PostgreSQL. No synthetic `users` rows are created.

This release uses a blocking Recall maintenance window for the identity schema swap. It is not safe for mixed-version Recall writers: old binaries do not write `recipient_identity`, so ordinary rolling deployment can collide on the new `(campaign_id, recipient_identity)` unique index. Startup migration must refuse to mutate this schema while the persisted `recall_campaign_setting.enabled` option is `true`. Missing option rows are treated as disabled; malformed values fail closed.

Release sequence for this one-release swap:

1. Set `recall_campaign_setting.enabled=false` before deploying the new image.
2. Stop new Recall writes, wait at least 60 seconds for leases to expire, and confirm there are no active recipient or message leases.
3. Start the master `newapi-console` revision first and let startup migration complete the backfill and index swap.
4. Verify `recall_recipients.recipient_identity` has no empty values, `idx_recall_campaign_identity` exists, and the legacy `idx_recall_campaign_user` index has been removed.
5. Deploy the same image to `newapi-router`.
6. Confirm no old revision is still serving Recall traffic, then re-enable Recall.

True rolling compatibility requires a two-release expand/contract plan: expand with the new nullable column plus dual writes, backfill under mixed versions, then contract by adding the new unique index and removing the old one after every writer is upgraded.

Eligibility snapshots continue to store the selected template and non-sensitive eligibility facts. `email_snapshot` stores the delivery address, while `eligibility_snapshot` and events must not store the full email or the operator's complete identifier input.

## Backend flow

1. Validate the template-specific audience configuration before preview, create, update, or activation.
2. Build a bounded candidate query:
   - `registered_only` applies the inclusive `created_at` range, no-payment condition, and `request_count = 0` at the database boundary where possible.
   - `specified_users` resolves the normalized ID/email union in bounded batches, deduplicates resolved accounts by user ID, and emits one email-only fact for every unmatched valid email.
3. Apply shared account safety checks only to account-backed facts. Email-only facts retain a valid normalized delivery address, default language `en`, zero-valued account activity facts, and a hashed recipient identity.
4. Preview, snapshot, activation, and recurring execution align recipients and messages by `recipient_identity`, not `user_id`. Recurring runs deduplicate by both stable identity and normalized email so an email-only recipient that later becomes an account cannot be enrolled twice in the same campaign.
5. The recipient worker skips Stripe Customer lookup/creation for email-only recipients and creates a Customer-unbound Promotion Code with `max_redemptions = 1`. Existing-account recipients keep Customer-bound codes.
6. The email worker sends an unbound recipient to `email_snapshot`, uses the language snapshot, and skips account-only payment/API/status/opt-out checks. Campaign state, recipient state, code expiry, and per-recipient unsubscribe suppression still apply.
7. Claim validation for an unbound recipient requires the authenticated account's normalized email to equal `email_snapshot`. A successful match atomically binds `user_id`; a mismatched account is rejected. Checkout and paid conversion attribution then use the bound account while the recipient identity remains stable.
8. New unsubscribe tokens identify the recipient. If it is still unbound, unsubscribe suppresses only that recipient and cancels its pending messages. If it is account-backed or has since been bound, unsubscribe preserves the existing global recall-marketing opt-out behavior for that user. Previously issued user-based unsubscribe tokens remain valid.

## Frontend flow

- Add both templates to the audience-template selector with localized descriptions.
- `registered_only` shows registration start and end datetime controls plus the existing verified-email switch.
- `specified_users` shows a debounced searchable multi-select user picker, a separate multiline email input, their combined normalized count, and the existing verified-email switch.
- Selected users remain visible as removable chips even when the current search query changes. Loading an existing draft resolves saved user IDs to display labels; unresolved historical IDs remain visible as unavailable selections instead of being silently removed.
- Validation errors are attached to the active controls and prevent preview or save.
- Loading an existing draft reconstructs the datetime-local values, selected-user chips, and multiline email value without mutating stored identifiers.
- Changing templates preserves inactive configuration values in the draft but submits them only as inert JSON fields; the backend chooses behavior solely from `audience_template`.

## Error handling and safety

- Reject malformed email tokens, invalid selected user IDs received by the API, more than 500 combined identifiers, reversed registration ranges, and missing template-required fields.
- Do not fall back from an empty or invalid specified-user list to a broad audience.
- Do not expose whether an entered address matched an account; preview represents both cases with the same masked-email shape.
- Never log full email-only identities, raw claim tokens, full Promotion Codes, or email bodies. `recipient_identity` contains only a one-way email hash for unbound recipients.
- A Customer-unbound Promotion Code remains single-use but can be manually copied; the claim button is protected by authenticated matching-email binding. This is the explicit trade-off required to support recipients who do not yet have a Stripe Customer or Flatkey account.
- Claim binding must use a conditional database update so competing nodes cannot bind the same recipient to different accounts.
- Preserve admin-only access for viewing, editing, previewing, saving, and activating Activity Configuration.

## Verification

Backend tests must cover:

- exact registered-only boundaries;
- exclusion of users with any payment;
- exclusion of users with `request_count > 0`;
- specified IDs, account-backed emails, email-only recipients, union deduplication, unknown IDs, case-insensitive email matching, and the 500-identifier limit;
- shared disabled, invalid-email, opt-out, and verified-email exclusions;
- recipient identity generation, legacy backfill, unique-index replacement, and multiple `user_id = 0` recipients;
- preview/activation/message alignment by identity and recurring email/user double deduplication;
- Customer-unbound single-use Promotion Codes and email delivery without a `users` row;
- matching-email claim binding, mismatched-email rejection, concurrent binding, recipient-only unsubscribe before binding, global unsubscribe after binding, and legacy unsubscribe tokens;
- compatibility of every existing audience template and stored draft.

Frontend tests must cover:

- template options and conditional fields;
- datetime conversion and range validation;
- debounced user search, multi-selection, preserved selections across searches, manual email parsing, union deduplication, invalid-email errors, and the maximum count;
- submit payloads and legacy draft loading;
- Activity Configuration terminology in all supported locales.

Browser smoke verification must confirm an administrator can preview both new audiences, save and reopen each configuration, and that a normal user cannot open the page or call its preview endpoints.
