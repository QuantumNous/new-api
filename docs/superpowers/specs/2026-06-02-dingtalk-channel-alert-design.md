# DingTalk Channel Alert Design

## Goal

Send DingTalk group robot alerts when the existing scheduled channel test detects a failed channel.

## Scope

This feature reuses the current scheduled channel test flow. It does not add another scanner, and it does not send DingTalk alerts for manual single-channel tests.

Alerts apply to all channel types. Codex channels are included through the existing Codex-aware scheduled test path.

## Settings

Add system-level fields to `monitor_setting`:

- `dingtalk_alert_enabled`: enables or disables DingTalk alerts.
- `dingtalk_alert_webhook_url`: DingTalk robot webhook URL.
- `dingtalk_alert_secret`: optional robot signing secret.
- `dingtalk_alert_cooldown_minutes`: per-channel alert cooldown. The default is 60 minutes.

These settings appear under the existing Monitoring & Alerts section in both frontend themes.

## Triggering Rules

During `testAllChannels(false)`, each channel is tested by the existing `testChannel` function. If the result contains a `NewAPIError`, or the response-time threshold creates one, the scheduled test should send an alert after the disable decision is known.

The alert should include whether the channel was auto-disabled. Channels that fail but are not auto-disabled still generate alerts, because the user wants visibility into failed scheduled tests, not only status changes.

Manual `TestChannel` requests do not send DingTalk alerts.

## Message Content

DingTalk text messages include:

- Alert title: `New API channel test failed`
- Channel ID
- Channel name
- Channel type display name
- Error message
- HTTP status code, when available
- NewAPI error code, when available
- Auto-disabled result: yes or no
- Time, using the server local timezone

Secrets, channel keys, access tokens, and OAuth JSON credentials must not appear in the alert.

## DingTalk Sender

Create a small service-level DingTalk sender. It builds DingTalk robot text payloads and posts them to the configured webhook.

If `dingtalk_alert_secret` is set, the sender applies DingTalk signing:

- timestamp in milliseconds
- HMAC-SHA256 over `timestamp + "\n" + secret`
- Base64 signature
- URL query parameters `timestamp` and `sign`

HTTP requests use the existing HTTP client and existing SSRF validation pattern used by webhook notifications.

## Deduplication

Use an in-memory per-process cooldown keyed by channel ID. A channel failure can send at most one DingTalk alert during the configured cooldown window.

The cooldown is intentionally process-local and simple. It prevents group spam during frequent scheduled tests without adding database state.

## Error Handling

DingTalk send failures should be logged with `common.SysLog` or `common.SysError` and must not break the scheduled channel test loop.

Missing webhook URL with alerts enabled should be logged and skipped.

## Testing

Add unit tests for:

- DingTalk payload formatting without secrets.
- DingTalk signing query parameters when a secret is configured.
- Cooldown suppressing repeated alerts for the same channel.
- Cooldown allowing alerts for different channels.
- Scheduled-alert decision reports auto-disabled state correctly.

Frontend changes are form wiring only and should be covered by type checking or existing frontend validation where practical.
