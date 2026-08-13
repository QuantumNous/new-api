# Anthropic Messages: exclude cached tokens from client-facing input_tokens

Date: 2026-08-13

## Problem

Some OpenAI-compatible upstreams report `usage.prompt_tokens` **including** cache read (and sometimes cache creation). Anthropic Messages reports `usage.input_tokens` **excluding** both `cache_read_input_tokens` and `cache_creation_input_tokens`.

When Claude Code talks Anthropic Messages to this gateway, two things inflate the client-visible read tokens:

1. The OpenAI→Claude converter copies `prompt_tokens` into `input_tokens` unless `prompt_tokens_details.cache_write_tokens > 0`.
2. The first streamed event is `message_start`, whose `usage.input_tokens` is `GetEstimatePromptTokens()` (full prompt estimate, no cache fields). Claude Code writes that line, then writes the final `message_delta` usage. Tokscale max-merges both, so the estimate wins over the exclusive final input.

Example after only fixing (1): API final usage is `442` input + `48128` cache, but `message_start` still reports `~29829`, and tokscale shows `29829 / 48128`.

Billing already subtracts cache on the OpenRouter Claude path (`service/text_quota.go`). That is internal settlement and stays unchanged.

## Goal

Per-channel opt-in switch. When on, Anthropic Messages **client-facing** usage uses exclusive input:

- Final `message` / `message_delta`: `input_tokens = prompt_tokens - cache_read - cache_creation`, clamped at 0.
- Stream `message_start`: `input_tokens = 0`, `output_tokens = 0`, no cache fields. Do not send the pre-usage estimate.

Leave billing, Chat Completions client usage, and OpenRouter settlement alone.

Success:

- Switch off (default): current conversion, including the existing `cache_write_tokens > 0` subtract, and `message_start` still uses `GetEstimatePromptTokens()`.
- Switch on: exclusive final input; `message_start` is a zero placeholder so Claude Code / tokscale max-merge keeps the final uncached input.
- `BillingUsage` still carries the original OpenAI numbers.
- A channel whose upstream already reports Anthropic-style `prompt_tokens` (cache excluded) must not enable the switch.

## Non-goals

- No global default and no auto-detection of “prompt includes cache”.
- No change to `text_quota.go` OpenRouter Claude subtract, pre-consume, or settle.
- No change to usage returned to OpenAI Chat Completions / Responses clients.
- No change to Gemini→Claude usage mapping.
- No automatic enable for OpenRouter or channel type 1.
- No JSON alias for the in-testing name `openai_prompt_includes_cache`. Hard rename only.
- Do not zero `message_start` when the switch is off.

## Naming

The previous working name `openai_prompt_includes_cache` reads as a statement of fact (OpenAI prompts include cache) while the switch defaults to off. The name describes the **client-facing action**:

| Layer | Name |
| --- | --- |
| JSON / form | `anthropic_messages_exclude_cache` |
| Go `ChannelSettings` | `AnthropicMessagesExcludeCache` |
| `convmeta.ClaudeOptions` | `AnthropicMessagesExcludeCache` |

Default `false` / omitted. Off = do not rewrite. On = exclude cache from Anthropic Messages `input_tokens` and zero `message_start` input.

## Architecture

Only Anthropic Messages client-facing usage is rewritten.

1. Channel `setting` JSON stores the boolean.
2. Host copies it into `convmeta.Options` via `RelayInfo.ConvOptions`. relaykit does not import host setting packages.
3. OpenAI Chat → Claude Messages (stream and non-stream) builds Claude usage in `buildClaudeUsageFromOpenAIUsage`. That function subtracts when the switch is on, using the same formula as the existing `cache_write_tokens > 0` branch. OpenAI Responses → Claude is Responses → Chat → Claude, so it hits the same function. Gemini → Claude does not.
4. First streamed Claude event (`GetSendResponseCount() == 1`) builds `message_start`. When the switch is on, set `usage.input_tokens = 0` instead of `GetEstimatePromptTokens()`. When off, keep the estimate.
5. Cache fields on final usage stay filled from OpenAI details. `message_start` does not invent cache numbers (unknown until upstream usage arrives).
6. Nested `BillingUsage` remains the original OpenAI usage.

```
Claude Code  --Anthropic Messages-->  gateway
                                      |  request: Claude → OpenAI (unchanged)
                                      |  upstream: OpenAI-compat
                                      |  response: OpenAI → Claude
                                      |    message_start:
                                      |      if switch: input_tokens = 0
                                      |      else: input_tokens = estimate
                                      |    message / message_delta:
                                      |      buildClaudeUsageFromOpenAIUsage
                                      |        if switch OR cache_write_tokens > 0:
                                      |          input_tokens -= cache_read + cache_creation
                                      v
                                 Claude usage to client
                                 BillingUsage = original OpenAI
                                      |
                                      v
                                 text_quota (unchanged)
```

Chat Completions clients never enter this function.

## Setting

### Storage

`relaykit/dto.ChannelSettings` (same JSON object as `force_format` / `thinking_to_content`):

| Go field | JSON | Default |
| --- | --- | --- |
| `AnthropicMessagesExcludeCache` | `anthropic_messages_exclude_cache` | `false` (`omitempty`) |

Do not keep or read `openai_prompt_includes_cache`. This branch is still in testing; operators will re-check the box after rename.

### Converter option

```
AnthropicMessagesExcludeCache bool
```

`RelayInfo.ConvOptions` copies `info.ChannelSetting.AnthropicMessagesExcludeCache` (nil `RelayInfo` → false). Converters read only `convmeta.OptionsOf(info).Claude.AnthropicMessagesExcludeCache`. Tests set it on `convmeta.Values.Options`.

### UI

Channel drawer → Advanced extra settings, next to `thinking_to_content`. Shown for all channel types.

Keep the existing action-oriented copy (already in locales):

- Label: `Subtract cache from input_tokens in Anthropic requests`
- Description: `Recommended when using Claude Code, to avoid incorrect client-side usage stats. This only changes usage sent to the client; it does not change usage shown in New API logs.`

Rename the form field / `setting` JSON key only. Default unchecked. Wire schema, parse/serialize, advanced-settings “configured” indicator, and `ADVANCED_SETTINGS_FIELDS`.

Update `docs/channel/other_setting.md` to the new JSON field.

## Conversion rules

`buildClaudeUsageFromOpenAIUsage` already takes `convmeta.Meta`. Nil meta ⇒ switch off.

Early return unchanged: if `BillingUsage` is already Claude Messages / Anthropic semantic, return that `ClaudeUsage` as-is.

Subtract rule (single condition, no double subtract):

```
cacheRead     = PromptTokensDetails.CachedTokens
cacheCreate   = PromptTokensDetails.CacheCreationTokensTotal()
inputTokens   = PromptTokens

excludeCache  = PromptTokensDetails.CacheWriteTokens > 0
             || OptionsOf(info).Claude.AnthropicMessagesExcludeCache

if excludeCache:
    inputTokens = PromptTokens - cacheRead - cacheCreate
    if inputTokens < 0:
        inputTokens = 0
```

Always still set on final usage:

- `CacheReadInputTokens` = `CachedTokens`
- `CacheCreationInputTokens` = `CacheCreationTokensTotal()` (plus 5m/1h split as today)
- `BillingUsage` = original OpenAI usage

`message_start` (first stream chunk only):

```
if OptionsOf(info).Claude.AnthropicMessagesExcludeCache:
    input_tokens = 0
    output_tokens = 0
    omit cache fields
else:
    input_tokens = GetEstimatePromptTokens()
    output_tokens = 0
```

Cannot compute exclusive uncached input at `message_start`; upstream usage has not arrived. Zero is a placeholder so later max-merge does not keep the estimate.

### Worked example

Upstream OpenAI usage: `prompt_tokens=30032`, `cached_tokens=28416`, no cache write. Estimate prompt tokens: `29829`.

| Switch | `message_start.input_tokens` | final `input_tokens` | `cache_read_input_tokens` |
| --- | --- | --- | --- |
| off | 29829 | 30032 | 28416 |
| on | 0 | 1616 | 28416 |

Tokscale / Claude Code max-merge after switch on: `max(0, 1616)` input + `28416` cache.

### Boundaries

- Switch on, caches all zero: final `input_tokens` unchanged; `message_start` still 0.
- Switch on, `prompt_tokens < cache_read + cache_create`: clamp final input to 0.
- Switch on **and** `cache_write_tokens > 0`: subtract once.
- Switch on while `BillingUsage` is already Anthropic: no rewrite of that Claude usage object.
- Switch on, upstream `prompt_tokens` already exclusive: final input undercounts. Accepted; default off exists to avoid this.
- Switch off: `message_start` estimate unchanged.

## Testing

Keep the existing `buildClaudeUsageFromOpenAIUsage` table (rename the option field in fixtures). Add:

1. Switch on, first stream chunk, `EstimatePromptTokens=29829` → `message_start.usage.input_tokens == 0` and `output_tokens == 0`; no cache fields populated.
2. Switch off, first stream chunk, same estimate → `message_start.usage.input_tokens == 29829`.
3. Existing stream-finish test still: switch on, `message_delta` is `1616 / 28416 / 912`.

Do not change the OpenAI→Claude golden fixture (`prompt_tokens=10`, `cached_tokens=3`, `input_tokens=10`); it documents the default-off contract.

After relaykit edits: `cd relaykit && GOWORK=off go build ./...`.

Frontend: field rename only; existing i18n keys stay.

## Files

| Area | Files |
| --- | --- |
| Channel setting | `relaykit/dto/channel_settings.go`, `channel_settings_test.go` |
| Converter option | `relaykit/relayconvert/convmeta/options.go` |
| Host snapshot | `relay/common/relay_info.go`, `relay_info_test.go` |
| Conversion | `relaykit/relayconvert/internal/oai_chat/to_claude_messages_resp.go` |
| Tests | `relaykit/relayconvert/internal/oai_chat/to_claude_messages_resp_test.go` |
| Channel UI | `web/src/features/channels/types.ts`, `channel-form.ts`, `channel-form-errors.ts`, `channel-mutate-drawer.tsx` |
| Channel docs | `docs/channel/other_setting.md` |

i18n locale strings do not need new keys unless a leftover `openai_prompt_includes_cache` label remains; the current Subtract-cache copy stays.

## Out of scope recap

`service/text_quota.go` OpenRouter Claude billing subtract stays as-is. This switch does not replace it and must not be wired into quota math.
