# Model Directory Metadata Audit

Generated at: 2026-08-21T05:11:04.542Z
Source: https://console.flatkey.ai/api/website/pricing
Live models audited: 103
Metadata entries audited: 96
Issue count: 40
Wrote production: false

**No production writes were performed.**

Review these findings before any database update. This report is read-only audit evidence, not an automatic backfill plan.

## Issue totals by severity

| Severity | Total |
| --- | ---: |
| invalid | 1 |
| missing | 32 |
| unknown-model | 7 |

## Issue totals by affected filter

| Filter | Total |
| --- | ---: |
| age | 9 |
| categories | 11 |
| context | 7 |
| distillable | 7 |
| metadata | 7 |
| modalities | 7 |
| outputPrice | 1 |
| providers | 33 |
| series | 7 |
| vendor | 7 |

## Issue details

| Status | Model | Field | Affected filters | Current value | Suggested value | Suggested source | Confidence | Review status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| invalid | gemini-embedding-001 | outputFilterUsd | outputPrice | 0 |  |  |  | pending |
| missing | claude-haiku-4-5-20251001 | providers | providers | [] |  |  |  | pending |
| missing | deepseek-v3.1 | providers | providers | [] |  |  |  | pending |
| missing | gemini-3.1-flash-tts-preview | providers | providers | [] |  |  |  | pending |
| missing | gemini-embedding-001 | categories | categories | [] |  |  |  | pending |
| missing | gemini-embedding-001 | providers | providers | [] |  |  |  | pending |
| missing | gemini-flash-latest | providers | providers | [] |  |  |  | pending |
| missing | gemini-flash-lite-latest | providers | providers | [] |  |  |  | pending |
| missing | gemini-flash-lite-latest | releasedAt | age | null |  |  |  | pending |
| missing | gemini-pro-latest | providers | providers | [] |  |  |  | pending |
| missing | gemini-robotics-er-1.6-preview | categories | categories | [] |  |  |  | pending |
| missing | gemini-robotics-er-1.6-preview | providers | providers | [] |  |  |  | pending |
| missing | gemma-4-31b-it | providers | providers | [] |  |  |  | pending |
| missing | gpt-image-2 | providers | providers | [] |  |  |  | pending |
| missing | grok-imagine-image | providers | providers | [] |  |  |  | pending |
| missing | grok-imagine-image-pro | providers | providers | [] |  |  |  | pending |
| missing | grok-imagine-image-pro | releasedAt | age | null |  |  |  | pending |
| missing | grok-imagine-image-quality | providers | providers | [] |  |  |  | pending |
| missing | grok-imagine-video | providers | providers | [] |  |  |  | pending |
| missing | grok-imagine-video-1.5 | providers | providers | [] |  |  |  | pending |
| missing | macaron-v1-coding-venti | providers | providers | [] |  |  |  | pending |
| missing | macaron-v1-tall | categories | categories | [] |  |  |  | pending |
| missing | macaron-v1-tall | providers | providers | [] |  |  |  | pending |
| missing | macaron-v1-venti | categories | categories | [] |  |  |  | pending |
| missing | macaron-v1-venti | providers | providers | [] |  |  |  | pending |
| missing | MiniMax-H3 | providers | providers | [] |  |  |  | pending |
| missing | nano-banana-pro-preview | providers | providers | [] |  |  |  | pending |
| missing | qwen3.5-plus-2026-02-15 | providers | providers | [] |  |  |  | pending |
| missing | seedance-2.0-pro | providers | providers | [] |  |  |  | pending |
| missing | seedance-2.5 | providers | providers | [] |  |  |  | pending |
| missing | sonilo-video-to-music | providers | providers | [] |  |  |  | pending |
| missing | veo-3.1-fast-generate-preview | providers | providers | [] |  |  |  | pending |
| missing | veo-3.1-generate-preview | providers | providers | [] |  |  |  | pending |
| unknown-model | eleven_multilingual_v2 | metadata | metadata, vendor, providers, modalities, context, series, categories, age, distillable | undefined |  |  |  | pending |
| unknown-model | eleven_sound_v1 | metadata | metadata, vendor, providers, modalities, context, series, categories, age, distillable | undefined |  |  |  | pending |
| unknown-model | mirothinker-1-7-deepresearch | metadata | metadata, vendor, providers, modalities, context, series, categories, age, distillable | undefined |  |  |  | pending |
| unknown-model | mirothinker-1-7-deepresearch-mini | metadata | metadata, vendor, providers, modalities, context, series, categories, age, distillable | undefined |  |  |  | pending |
| unknown-model | seedance-2.0 | metadata | metadata, vendor, providers, modalities, context, series, categories, age, distillable | undefined |  |  |  | pending |
| unknown-model | seedance-2.0-fast | metadata | metadata, vendor, providers, modalities, context, series, categories, age, distillable | undefined |  |  |  | pending |
| unknown-model | seedance-2.0-mini | metadata | metadata, vendor, providers, modalities, context, series, categories, age, distillable | undefined |  |  |  | pending |
