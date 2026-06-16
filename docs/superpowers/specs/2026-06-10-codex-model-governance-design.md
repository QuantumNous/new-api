# Codex Model Governance Design

## Goal

Create an independent governance flow for Codex subscription models used through OAuth-authenticated ChatGPT accounts.

The system should detect clearly unsupported Codex models, alert operators through DingTalk, and require manual review before removing models from channel model configuration. Returned-message/probe-confirmed unsupported models are disabled before routing only for the directly matched channel/model pair. Official notice, AI findings, and linked same-Codex model channels enter manual review without disabling runtime access automatically.

## Non-Goals

- Do not use OpenAI API model deprecation pages as an automatic disable trigger. API-key model lifecycle is not the same as Codex subscription model availability.
- Do not treat generic upstream errors as model lifecycle evidence.
- Do not remove a model from `channels.models` automatically before a human confirms it is unavailable.
- Do not replace the existing general `model_availability` feature. This feature is a separate Codex-specific governance subsystem.

## Scope

The feature applies to Codex OAuth channels that use ChatGPT account subscription authentication.

It has five responsibilities:

- Probe configured Codex models with lightweight checks.
- Monitor configured official Codex information sources for model lifecycle notices.
- Move unsupported returned-message/probe findings into a pending-review state and disable only the directly matched runtime abilities.
- Link same-Codex-type channels that configure the same model into the same review queue while keeping their abilities callable.
- Move official notice or AI findings into the same review queue without disabling abilities automatically.
- Provide admin review actions to remove, restore, or ignore the model.

## Domain Model

Add an independent Codex model governance record. The exact storage type can be one table, but the domain should remain separate from general model availability.

Recommended fields:

- `model_name`: model slug.
- `status`: `active`, `unsupported_pending_review`, `removed`, or `ignored`.
- `source`: `probe`, `official_codex_notice`, or `manual`.
- `matched_rule`: the rule name or pattern that triggered the state change.
- `last_error`: sanitized probe error or official notice excerpt.
- `affected_channel_ids`: Codex channels that require manual review for this model. For returned-message/probe findings this includes the directly matched channel plus linked same-Codex-type channels that configure the same model.
- `disabled_channel_ids`: Codex channels whose `abilities` rows are actually disabled for this model. This is the direct returned-message/probe scope, not the broader linked review scope.
- `detected_at`: first time the unsupported state was detected.
- `last_checked_at`: most recent probe or source-monitor check.
- `reviewed_at`: human review time.
- `reviewed_by`: reviewer user ID.
- `review_note`: human-entered decision note.

Status meanings:

- `active`: no current governance block.
- `unsupported_pending_review`: model is waiting for human review; returned-message/probe findings disable routing immediately only for `disabled_channel_ids`, while official notice, AI findings, and linked channels remain callable until an admin chooses a review action.
- `removed`: human confirmed the model is unavailable and the model has been removed from affected Codex channel configuration.
- `ignored`: human decided not to act on the finding for now.

## Unsupported Probe Rules

The default rule should be strict and Codex-specific. It matches errors like:

```text
The '<model>' model is not supported when using Codex with a ChatGPT account.
```

The implementation should not hardcode this as the only possible future wording. It should provide:

- A built-in default regex rule for the known message.
- System-setting editable additional regex rules.
- Regex validation before saving settings.
- A test input in the settings UI that shows whether a sample message matches and which model name is extracted.

Only a matching unsupported rule can move a model into `unsupported_pending_review`.

Errors that do not match these rules are treated as temporary probe noise, including:

- Timeout.
- HTTP 429.
- HTTP 5xx.
- OAuth or proxy transient failures.
- Generic `model_not_found`.
- Generic `unsupported model`.
- Response format mismatch.

These failures can be logged for diagnostics, but they must not disable a model.

## Lightweight Probe Flow

The scanner should enumerate models from enabled channels with `ChannelTypeCodex`. For each model it should send a minimal request with a tiny prompt and small token budget.

Probe result handling:

- Success: keep or restore `active` unless the model is already `removed`.
- Error matching a Codex unsupported rule: move to `unsupported_pending_review`.
- Any other error: record as transient if needed, but do not change model status to unsupported.

On transition to `unsupported_pending_review` from a returned-message/probe match:

- Set `affected_channel_ids` to all same-Codex-type channels that currently configure this model.
- Set `disabled_channel_ids` to the directly matched channel/model rows from the returned message or probe response.
- Set `abilities.enabled=false` only for `disabled_channel_ids` so routing, `/v1/models`, and pricing/model listing do not advertise the model as usable on the directly failed channel.
- Keep `channels.models` unchanged.
- Send a DingTalk alert.
- Avoid duplicate alerts by using model-level cooldown or transition-only delivery.

Linked Codex channels in `affected_channel_ids` but not `disabled_channel_ids` stay callable and must be reviewed manually.

## Official Codex Notice Monitor

The official monitor should watch Codex-specific official sources only. OpenAI API deprecation pages are excluded from automatic disable decisions.

Sources should be configurable in system settings. The default implementation should support official Codex pages such as Codex changelog, Codex manual/docs, or Help Center pages when they are explicitly configured. The fetcher should be a small service wrapper around the existing HTTP client so SSRF validation, timeouts, and test doubles are consistent.

The monitor should only create an unsupported finding when both conditions are met:

- The source text explicitly mentions a configured Codex model name.
- Nearby text contains a lifecycle phrase such as `deprecated`, `retired`, `sunset`, `unavailable`, `not supported`, or equivalent configured terms.

The official monitor does not remove or disable models automatically. It moves matching models to `unsupported_pending_review`, sets `affected_channel_ids` for review, keeps `disabled_channel_ids` empty, keeps runtime abilities callable, and sends DingTalk so an admin can decide whether to disable, restore, ignore, or remove the model.

## Manual Review Flow

Admins need a Codex model governance page with pending records and actions.

Pending record display:

- Model name.
- Status.
- Source.
- Matched rule.
- Last error or official notice summary.
- Affected Codex channels requiring review.
- Actually disabled Codex channels.
- Detection time and last check time.

Actions:

- Confirm unavailable: remove the model from affected Codex channels' `channels.models`, refresh those channels' abilities, and mark the record `removed`.
- Disable: after human confirmation, disable the model on all affected Codex channels and record them in `disabled_channel_ids`.
- Restore: clear the governance block, re-enable only `disabled_channel_ids` rows when the channel still configures the model, and mark the record `active`.
- Ignore: leave the current channel model configuration unchanged and mark the record `ignored`.

Removal must be human-triggered. Automatic processes may disable runtime abilities, but they may not delete model configuration.

## DingTalk Alerts

Reuse the existing DingTalk webhook, secret, and cooldown infrastructure where practical, but the message type should be model-governance specific.

Alert content:

- Title: `Codex model moved to unsupported pending review`.
- Model name.
- Trigger source: probe or official Codex notice.
- Matched rule.
- Sanitized error or notice summary.
- Affected channel count and channel IDs.
- Actually disabled channel count and channel IDs.
- Explicit warning when linked channels are still serving user requests.
- Required next action: review in the Codex model governance page.
- Time.

Secrets, OAuth tokens, API keys, cookies, and raw credentials must be sanitized before alert delivery.

## Settings UI

Add Codex model governance controls to the system settings area.

Settings:

- Enable Codex model governance.
- Lightweight probe schedule or interval.
- Unsupported-message regex rules.
- Regex test input and match result.
- Official Codex notice source URLs.
- Official lifecycle phrase list.
- Model alert cooldown.

The existing DingTalk webhook and secret settings remain shared. The new feature should not require a second DingTalk robot unless operators choose to add one later.

## Routing And Listing Behavior

When a returned-message/probe-confirmed model is `unsupported_pending_review`, the system should not route requests to `disabled_channel_ids` Codex channel abilities for that model. Linked same-Codex-type channels in `affected_channel_ids` remain callable until an admin explicitly disables or removes the model. Official notice or AI findings may also be `unsupported_pending_review`, but they keep abilities enabled until an admin explicitly disables or removes the model.

Because probe pending records set only direct `disabled_channel_ids` `abilities.enabled=false`, normal ability-backed user-facing model lists should stop showing those models as available on the directly failed channel while linked review-only channels can still serve traffic. Admin review pages should still show every pending governance record, including alert-only official notice or AI findings.

After `Confirm unavailable`, the model is removed from the relevant channels' configured model list and abilities are refreshed so the disabled state is durable.

After `Restore`, abilities for the affected model/channel combinations are re-enabled if the channel still configures the model.

## Error Handling

Probe and official-monitor failures must not break normal request serving.

If DingTalk delivery fails, log the error and keep the governance state transition. A failed alert should not re-enable the model.

If ability disabling fails after an unsupported finding, keep the record pending and log a high-severity operational error because routing safety may be incomplete.

If manual removal partially fails for some channels, report per-channel success and failure in the admin action response and keep the record pending until all affected channels are resolved or explicitly ignored.

## Testing

Backend tests should cover:

- Default Codex unsupported regex matches the known ChatGPT account error and extracts the model.
- Generic unsupported or model-not-found errors do not trigger disable.
- Custom regex rules validate and classify messages.
- Returned-message/probe transition to `unsupported_pending_review` disables only direct `disabled_channel_ids`, links same-Codex-type channels into `affected_channel_ids`, and sends a DingTalk alert.
- Official notice and AI transitions to `unsupported_pending_review` send DingTalk and remain callable until manual review.
- New actual-disable findings and new review-only findings both send DingTalk alerts.
- Confirm unavailable removes the model from affected Codex channel `channels.models` and refreshes abilities.
- Restore re-enables abilities only when the channel still configures the model.
- Official monitor has no API deprecation default source and only matches exact configured Codex model names plus lifecycle terms from configured Codex official sources.

Frontend tests or type checks should cover:

- Settings form validates regex syntax.
- Regex test input shows match and extracted model.
- Governance page exposes pending records and review actions.

## Rollout

Ship with the governance switch disabled by default unless the deployment explicitly enables it.

Recommended rollout:

1. Enable settings UI and storage.
2. Enable manual governance page.
3. Enable probes in dry-run logging mode.
4. Enable automatic transition to `unsupported_pending_review`.
5. Enable official Codex notice monitor after source URLs are configured.

## Implementation Constraints

- Codex OAuth channels are identified by `constant.ChannelTypeCodex`.
- Returned-message/probe-confirmed pending unsupported models disable direct `disabled_channel_ids` `abilities` rows only.
- Same-Codex-type linked channels and official notice/AI pending records are alert-only until an admin review action disables or removes the model.
- Manual removal edits `channels.models` only after a reviewer confirms the model is unavailable.
- Official source fetching uses an internal service wrapper that applies the existing HTTP client, SSRF validation, request timeout, and sanitized logging.
