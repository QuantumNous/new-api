# Activity Email Open User Metrics Design

## Decision

Activity details will show a same-level metric named **Users who opened** (`已读用户数` in Chinese). The value is the number of campaign recipients for whom Flatkey detected at least one HTML email open. A recipient counts once for the entire activity even when they open the same message repeatedly or open multiple stages.

This is a detected-open metric, not proof that a human read the content. The Console must keep it separate from the existing observed-click metric.

## Why

The current activity metrics show delivery acceptance and observed claim-link clicks but do not show whether recipients opened the email. Operators need an intermediate funnel signal between accepted delivery and link engagement.

SMTP does not report recipient reads. Activity SMTP can point at arbitrary providers, so Flatkey cannot depend on a provider-specific open webhook. The portable mechanism is a recipient-specific tracking image loaded by the mailbox client.

## Alternatives Considered

1. **First-party tracking image with recipient-level deduplication.** Selected because it works with arbitrary Activity SMTP and uses Flatkey's existing public Console origin and Recall event idempotency.
2. **SMTP-provider delivery webhooks.** Rejected because SMTP providers expose incompatible event formats and self-managed SMTP servers may expose no webhook at all.
3. **Treat claim-link clicks as opens.** Rejected because the existing observed-click metric already represents that behavior and misses recipients who read without clicking.

## Outbound Email Behavior

Flatkey appends a hidden one-pixel image to the final outbound HTML after template validation, localization, preview generation, and recipient rendering. It does not modify the stored template and does not inject a live tracker into admin previews.

The image URL uses `APP_CONSOLE_ORIGIN` and an authenticated-encrypted, recipient-scoped token. It must not expose campaign, recipient, user, or email identifiers in the URL. The same rendered email may be fetched by mailbox security scanners or image proxies, so the metric records only the first valid load for each campaign recipient.

Recall templates authored through `body_text` are already rendered into an HTML wrapper before SMTP delivery, so both current template modes can receive the tracking image. If Flatkey later adds a true text/plain-only delivery path, that path must skip image tracking. Sending must continue normally if the Console origin is unavailable; tracking is observational and must never block campaign delivery.

## Public Tracking Endpoint

Add an unauthenticated GET endpoint under the existing public Recall routes. For every request, including invalid or stale tokens, it returns the same one-pixel transparent image response so the endpoint does not reveal whether a recipient exists.

For a valid recipient token, the endpoint inserts one `email_open` Recall event with:

- the resolved campaign and recipient IDs;
- source `email_open`;
- a source event ID derived from the recipient identity within the activity;
- no IP address, user agent, mailbox address, or other request metadata.

The existing unique source/source-event index makes concurrent requests idempotent across multiple application nodes. Repeated image loads remain successful but do not increase the user count.

The response uses an image content type and cache headers suitable for an email tracking image. Persistence failures are logged server-side but still return the image; recipients must not see broken email content because analytics storage failed.

## Metrics Contract

Extend Recall campaign metrics with `opened_recipient_count`. The attribution query counts idempotent `email_open` events for the campaign and returns zero for historical activities with no such events.

The existing `observed_click_count` remains unchanged. It continues to mean recipients whose claim link was observed, while `opened_recipient_count` means recipients whose tracking image was requested.

No database column or migration is required because Recall events already persist campaign-scoped, recipient-scoped, idempotent observations.

## Console

Add a same-level metric card to Activity details:

- English key: `Users who opened`;
- Chinese: `已读用户数`;
- all other supported locale files receive real translations;
- value: `opened_recipient_count`.

The card appears for both promotion and content-only activities. It sits with Candidates, Enrolled, Excluded, Observed clicks, and Accepted messages rather than in promotion-conversion-only content.

## Accuracy and Privacy

The displayed number is approximate:

- clients that block remote images create false negatives;
- Gmail, Apple Mail, security scanners, and other image proxies may preload the image and create false positives;
- proxy caching may hide later opens, which does not affect the selected unique-user metric;
- a future true text/plain-only delivery path would be unobservable, while the current `body_text` template mode remains trackable because it renders to HTML.

Flatkey intentionally stores only the first recipient-level event. It does not store IP addresses, user agents, open frequency, or per-device information.

## Multi-Node and Deployment Behavior

Correctness relies on the database unique index, not process memory or a local lock. Concurrent requests reaching different Console instances converge on one event.

Deployment requires the backend/admin service, Recall workers, and Console bundle. Router deployment is not required because tracking URLs use `APP_CONSOLE_ORIGIN` and the change does not affect relay traffic. No database migration, Terraform change, Cloudflare change, or new dependency is required.

## Tests

Backend tests must prove:

- final outbound HTML contains one recipient-specific tracking image;
- stored templates and admin previews do not contain live tracking URLs;
- both `body_html` and the current HTML-wrapped `body_text` mode receive tracking;
- a future true text/plain-only delivery path can skip tracking without blocking delivery;
- missing Console origin skips tracking without blocking delivery;
- a valid tracking request records one `email_open` event;
- repeated and concurrent requests for one recipient remain one event;
- invalid tokens return the same image response without an event or recipient disclosure;
- campaign metrics return the unique opened-recipient count and zero for historical activities.

Frontend tests must prove:

- the TypeScript metrics contract includes `opened_recipient_count`;
- Activity details render the same-level `Users who opened` card and its value;
- the card appears for both campaign types;
- locale synchronization has no missing or untranslated new key.

## Scope Boundaries

- Do not add per-message, per-stage, repeated-open, device, location, IP, or user-agent analytics.
- Do not replace or reinterpret observed clicks, conversions, or accepted-message metrics.
- Do not add provider-specific webhook integrations.
- Do not make tracking a prerequisite for sending email.
- Do not add dependencies.
