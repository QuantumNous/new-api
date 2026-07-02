# DingTalk Channel Alert AI Summary Design

## Goal

Add an optional AI-generated Chinese summary to scheduled channel-test DingTalk failure alerts.

The alert must remain reliable: if AI analysis is disabled, unconfigured, slow, or fails, the system still sends the current raw DingTalk alert content unchanged.

## Scope

In scope:
- Scheduled channel-test failure alerts sent through `NotifyDingTalkChannelTestFailures`.
- Batch alerts containing up to the existing batch size of channel failures.
- Reuse of the existing monitoring AI analysis configuration:
  - `monitor_setting.ai_analysis_api_key`
  - `monitor_setting.ai_analysis_base_url`
  - `monitor_setting.ai_analysis_model`
- Chinese summary text placed before the existing raw alert fields.

Out of scope:
- Codex model governance DingTalk alerts.
- User notification webhooks, email quota reminders, and manual channel test notifications.
- New database tables or new secrets.
- Frontend UI changes beyond existing monitoring AI analysis settings.

## User Experience

When a scheduled channel test fails and DingTalk alerting is enabled, the message starts with:

```text
AI 中文总结：
- 本批次 3 个渠道测试失败，主要集中在 Codex/Gemini。
- 2 个为 401 鉴权错误，建议优先检查密钥或账号状态。
- 1 个因响应超时被自动禁用。
```

The existing detailed alert body follows immediately after the summary. Operators can read the summary first and still use the raw fields for exact channel IDs, error codes, status codes, and timestamps.

If AI summary generation is unavailable, the message remains exactly the current alert format.

## Architecture

The feature lives in the service layer next to existing DingTalk alert code.

Proposed flow:

1. `NotifyDingTalkChannelTestFailures` collects sendable alerts after cooldown filtering.
2. `sendReservedDingTalkChannelAlertBatch` builds the existing raw content with `BuildDingTalkChannelAlertBatchContent`.
3. Before `SendDingTalkText`, the service attempts to summarize the current batch using the existing monitoring AI endpoint.
4. On success, the final DingTalk body is:
   - `AI 中文总结：`
   - AI-generated bullet lines
   - blank line
   - existing raw alert content
5. On failure, timeout, missing API key, invalid AI response, or malformed output, the final DingTalk body is the existing raw alert content.

The summary call should be best-effort and should not roll back or consume DingTalk cooldown by itself. Cooldown behavior remains tied to DingTalk send success.

## AI Request

Reuse the Responses API style already used by Codex official notice analysis:

- Endpoint: resolved from `monitor_setting.ai_analysis_base_url`; if a `/v1` base URL is configured, append `/responses`; if a full `/responses` endpoint is configured, use it directly.
- Model: `monitor_setting.ai_analysis_model`, falling back to the existing default.
- API key: `monitor_setting.ai_analysis_api_key`.
- Timeout: short and bounded, matching the monitoring AI path unless implementation extracts a shared helper.
- Response size limit: bounded.
- URL validation: use the existing SSRF-aware `ValidateURLWithFetchSetting`.

The prompt must instruct the model to:
- write simplified Chinese only;
- summarize only the provided alert batch;
- keep 3-5 short bullet points;
- mention high-priority actions when clear, such as authentication failure, quota/rate-limit, upstream unavailable, timeout, or automatic disabling;
- not invent facts or remediation steps;
- avoid exposing secrets.

The input to the model should be sanitized with the existing DingTalk alert sanitizer before it leaves the process.

## Error Handling

AI summary generation is non-critical.

Return no error to the DingTalk send path when:
- the AI key is empty;
- the AI request fails;
- the AI endpoint returns non-2xx;
- the AI output is empty;
- the AI output cannot be parsed;
- the summary is too long or otherwise invalid.

Log failures with sanitized messages for operational visibility, but never include credentials or raw webhook URLs.

## Security

- Sanitize alert content before sending it to the AI endpoint.
- Sanitize AI output before placing it in DingTalk.
- Keep the existing DingTalk webhook URL signing behavior unchanged.
- Keep SSRF protection on the AI endpoint.
- Do not add new secret storage.

## Multi-Node Behavior

No new cross-node coordination is required.

DingTalk cooldown reservation and commit semantics remain unchanged. The AI call happens only for alerts already selected for a DingTalk send attempt. If two application nodes send different eligible batches, each may generate its own summary for its own batch, matching current alert delivery behavior.

## Testing

Backend tests should cover:
- raw alert content is unchanged when the monitoring AI API key is empty;
- successful AI response prepends `AI 中文总结：` and preserves existing raw alert details;
- AI request receives sanitized alert input and does not receive obvious secrets;
- AI endpoint failure falls back to raw DingTalk content and still sends DingTalk;
- summary output is sanitized before DingTalk send;
- batching still sends one DingTalk request per existing batch split.

Targeted commands:

```bash
go test ./service/...
go test ./controller/...
go test ./setting/operation_setting/...
```

## Acceptance Criteria

- Scheduled channel-test failure DingTalk alerts include a Chinese AI summary when monitoring AI analysis is configured and succeeds.
- Existing DingTalk alert behavior remains available with no AI configuration.
- AI failures do not block DingTalk alert delivery.
- Existing DingTalk cooldown and batch behavior remain unchanged.
- Tests prove the success and fallback paths.
