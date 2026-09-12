---
name: migrate-ai-sdk-v6-to-v7
description: Migrate applications from AI SDK 6.x to AI SDK 7.0. Use when upgrading Vercel AI SDK packages, fixing v7 migration errors, or when the user mentions AI SDK v6, v7, upgrade, migration, breaking changes, system to instructions, fullStream, telemetry, tool context, or finalStep.
---

## AI SDK 6 to 7 Migration

Use `content/docs/08-migration-guides/23-migration-guide-7-0.mdx` from the AI SDK repo as the source of truth. This skill is the working checklist; read the guide for exact examples or when behavior is unclear.

## Migration Workflow

1. Ensure the user has a clean backup or committed baseline before editing.
2. Inspect `package.json` and lockfiles to identify installed `ai`, `@ai-sdk/*`, provider, UI, MCP, and telemetry packages.
3. Upgrade AI SDK packages to latest versions, and add `@ai-sdk/otel` only if the project uses OpenTelemetry spans.
4. Update runtime and module assumptions: Node.js must be `>=22`, and AI SDK packages are ESM-only. Replace `require()` imports with ESM imports and add `"type": "module"` or use `.mjs` where needed.
5. Search for the v6 patterns below, migrate only the code that exists, then run typecheck and targeted tests.

Prefer behavior-preserving changes. When v7 changes semantics, decide whether the app wants the new all-steps behavior or the previous final-step-only behavior.

## Core API Changes

- `experimental_customProvider` -> `customProvider`.
- `experimental_generateImage` -> `generateImage`; `Experimental_GenerateImageResult` -> `GenerateImageResult`.
- `experimental_transcribe` -> `transcribe`; `Experimental_TranscriptionResult` -> `TranscriptionResult`.
- `experimental_generateSpeech` -> `generateSpeech`; `Experimental_SpeechResult` -> `SpeechResult`.
- `experimental_output` option/result -> `output` option/result.
- `CallSettings` -> `LanguageModelCallOptions & Omit<RequestOptions, 'timeout'>`; `prepareCallSettings` -> `prepareLanguageModelCallOptions`.
- `stepCountIs` -> `isStepCount`.

## Prompts and Steps

- Rename top-level `system` to `instructions` for `generateText`, `streamText`, `generateObject`, `streamObject`, and `streamUI`.
- Move `{ role: 'system' }` messages from `prompt` or `messages` into top-level `instructions`. Only use `allowSystemInMessages: true` for trusted persisted messages.
- Rename `experimental_prepareStep` to `prepareStep`.
- In `prepareStep`, rename returned `system` to `instructions`.
- In `experimental_repairToolCall`, use `{ instructions }` instead of `{ system }`.
- Audit `prepareStep` behavior: returned `instructions` and `messages` now carry forward into later steps. If code depended on one-step-only overrides, rebuild from `initialInstructions`, `initialMessages`, and `responseMessages` explicitly.

## Lifecycle Callbacks

- `experimental_onStart` -> `onStart`.
- `experimental_onStepStart` -> `onStepStart`.
- `onFinish` -> `onEnd`.
- `onStepFinish` -> `onStepEnd`.
- For `embed`, `embedMany`, and `rerank`, `experimental_onFinish` -> `onEnd`.
- Callback event fields use `instructions` instead of `system`.

## Usage, Telemetry, and Include Options

- `usage.cachedInputTokens` -> `usage.inputTokenDetails.cacheReadTokens`.
- `usage.reasoningTokens` -> `usage.outputTokenDetails.reasoningTokens`.
- OpenTelemetry moved out of `ai`; install `@ai-sdk/otel` and call `registerTelemetry(new OpenTelemetry(...))` at app startup.
- Telemetry is enabled by default once an integration is registered. Remove redundant `isEnabled: true`; use `isEnabled: false` to opt out per call.
- Move `experimental_telemetry.tracer` into the `OpenTelemetry` constructor.
- `experimental_telemetry` -> `telemetry`.
- Telemetry integration callbacks: `onRerankFinish` -> `onRerankEnd`, `onEmbedFinish` -> `onEmbedEnd`. Update tracing-channel subscribers for the same event type names.
- `experimental_include` -> `include`.
- `includeRawChunks` -> `include.rawChunks`.
- Request and response bodies are excluded by default. If code reads `request.body` or `response.body`, opt in with `include.requestBody` and, for `generateText`, `include.responseBody`.

## Streaming, Messages, and Tools

- `StreamTextResult.fullStream` -> `stream`.
- `streamText` `onChunk` now receives all stream parts, including lifecycle, boundary, finish, abort, and error parts. Guard by `chunk.type` before assuming text/tool/raw content.
- `step.response.messages` is no longer accumulated across previous steps. Use `result.responseMessages` for the full response message history, or flatten `result.steps`.
- Tool execution callbacks: `experimental_onToolCallStart` -> `onToolExecutionStart`, `experimental_onToolCallFinish` -> `onToolExecutionEnd`.
- Tool callback `experimental_context` -> `context`.
- Split shared runtime data from tool-specific data: use top-level `runtimeContext` for orchestration state, declare per-tool `contextSchema`, and pass per-tool values through `toolsContext`.
- Move `needsApproval` from `tool()` / `dynamicTool()` into per-call or agent `toolApproval`.
- `experimental_activeTools` -> `activeTools`.
- `ToolCallOptions` -> `ToolExecutionOptions`.
- `isToolOrDynamicToolUIPart` -> `isToolUIPart`.

## Content Parts and Reasoning

- Tool result `{ type: 'media' }` is removed; use `{ type: 'file-data' }`.
- Migrate `toModelOutput` `image-*`, `file-*`, `file-id`, and `image-file-id` variants to canonical `{ type: 'file', mediaType, data: { type: 'data' | 'url' | 'reference', ... } }`.
- User message `{ type: 'image', image, mediaType? }` is deprecated; use `{ type: 'file', mediaType: 'image' | 'image/*', data }`.
- Add support for the new `reasoning-file` content type in exhaustive switches, renderers, serializers, and validators.
- When adopting top-level `reasoning`, remove overlapping provider-specific reasoning settings from `providerOptions` unless provider-specific settings intentionally take precedence.

## Multi-Step Result Shape

- `result.usage` now includes all steps; `result.totalUsage` is deprecated. Use `result.finalStep.usage` for final-step-only usage.
- Top-level `content`, `toolCalls`, `staticToolCalls`, `dynamicToolCalls`, `toolResults`, `staticToolResults`, `dynamicToolResults`, `files`, `sources`, and `warnings` now include all steps. Use `finalStep` for previous final-step-only behavior.
- Top-level `reasoning`, `reasoningText`, `request`, `response`, and `providerMetadata` are deprecated for final-step data. Use `result.finalStep.*`; for `streamText`, await `result.finalStep`.
- Apply the same result-shape rules to `onEnd` events.

## Stream Response Helpers

The `streamText` result helper methods are deprecated. Replace result methods with top-level stateless helpers:

- `result.toUIMessageStream(...)` -> `toUIMessageStream({ stream: result.stream, ... })`.
- `result.toUIMessageStreamResponse(...)` -> `toUIMessageStream(...)` plus `createUIMessageStreamResponse({ stream })`.
- `result.pipeUIMessageStreamToResponse(response, ...)` -> `toUIMessageStream(...)` plus `pipeUIMessageStreamToResponse({ response, stream })`.
- `result.toTextStreamResponse()` -> `toTextStream({ stream: result.stream })` plus `createTextStreamResponse({ stream })`.
- `result.pipeTextStreamToResponse(response)` -> `toTextStream({ stream: result.stream })` plus `pipeTextStreamToResponse({ response, stream })`.

## Package-Specific Checks

- MCP: `MCPTransportConfig.redirect` now defaults to `'error'`. Only set `redirect: 'follow'` for trusted MCP servers that rely on redirects.
- Vue: `@ai-sdk/vue` `Chat` class is deprecated. Prefer `useChat`, including getter/ref init for reactive chat inputs.
- Anthropic and `@ai-sdk/google-vertex/anthropic`: `providerMetadata.anthropic.cacheCreationInputTokens` was removed. Use `usage.inputTokenDetails.cacheWriteTokens`; raw Anthropic usage remains at `finalStep.providerMetadata?.anthropic?.usage`.
- Google: rename `GoogleGenerativeAI*` types, classes, and functions to `Google*`, e.g. `createGoogleGenerativeAI` -> `createGoogle`. The `google` entry point is unchanged.

## Validation

Run the project typecheck after edits, then the smallest relevant test suite. Also smoke-test streaming, chat UI, tool execution, telemetry, and multi-step flows if the migration touched them. If type errors remain, search the migration guide for the exact removed or renamed symbol before inventing a workaround.
