# @ai-sdk/workflow

## 1.0.31

### Patch Changes

- Updated dependencies [70f18c3]
- Updated dependencies [cd06458]
  - ai@7.0.31
  - @ai-sdk/provider-utils@5.0.11

## 1.0.30

### Patch Changes

- ai@7.0.30

## 1.0.29

### Patch Changes

- ai@7.0.29

## 1.0.28

### Patch Changes

- Updated dependencies [0bc8d4f]
  - ai@7.0.28

## 1.0.27

### Patch Changes

- Updated dependencies [ac01b79]
- Updated dependencies [31c7be8]
- Updated dependencies [2696562]
  - ai@7.0.27
  - @ai-sdk/provider-utils@5.0.10

## 1.0.26

### Patch Changes

- Updated dependencies [27d294d]
  - ai@7.0.26

## 1.0.25

### Patch Changes

- Updated dependencies [4be62c1]
- Updated dependencies [7805e4a]
- Updated dependencies [7805e4a]
- Updated dependencies [f8e82fd]
- Updated dependencies [cd12954]
  - @ai-sdk/provider-utils@5.0.9
  - ai@7.0.25

## 1.0.24

### Patch Changes

- Updated dependencies [e193290]
- Updated dependencies [e193290]
  - @ai-sdk/provider-utils@5.0.8
  - ai@7.0.24

## 1.0.23

### Patch Changes

- Updated dependencies [930f949]
  - ai@7.0.23

## 1.0.22

### Patch Changes

- Updated dependencies [8f89c25]
  - ai@7.0.22

## 1.0.21

### Patch Changes

- 308a519: chore: enforce consistent imports from `zod/v4` instead of `zod`
- Updated dependencies [308a519]
  - ai@7.0.21

## 1.0.20

### Patch Changes

- a4186d6: Promote the `repairToolCall` option to stable, with a deprecated `experimental_repairToolCall` alias for backwards compatibility.
- c29e0d7: fix (workflow): mark package as ESM so the published files match the `main`, `types`, and `exports` entrypoints in package.json. Previously `require('@ai-sdk/workflow')` failed with `MODULE_NOT_FOUND` because the declared CommonJS entrypoints were never published.
- Updated dependencies [b9ac19f]
- Updated dependencies [a4186d6]
  - ai@7.0.20

## 1.0.19

### Patch Changes

- Updated dependencies [be7f05a]
- Updated dependencies [ee55a07]
- Updated dependencies [aad737d]
- Updated dependencies [0f93c57]
  - ai@7.0.19
  - @ai-sdk/provider@4.0.3
  - @ai-sdk/provider-utils@5.0.7

## 1.0.18

### Patch Changes

- Updated dependencies [ac306ed]
  - @ai-sdk/provider-utils@5.0.6
  - ai@7.0.18

## 1.0.17

### Patch Changes

- 148babc: `WorkflowChatTransport` now drops orphan UI chunks (deltas/ends and tool output/approval chunks whose part was started before the resumed window) when reconnecting with a negative `initialStartIndex`, instead of crashing the AI SDK client. Self-contained `tool-input-available`/`tool-input-error` chunks establish the tool part and are never dropped. A one-time warning links to docs on rewinding to a step boundary server-side.
- e660e45: Reduce the `doStreamStep` step-boundary payload by returning minimal raw aggregates and reconstructing the `StepResult` outside the step, instead of serializing the full `StepResult` plus the per-chunk array into the durable event log.
- cc773bc: Expose `totalUsage` and `finishReason` on the `WorkflowAgent.stream()` result, mirroring `GenerateTextResult`/`StreamTextResult` and the existing `onEnd` event payload.
  - ai@7.0.17

## 1.0.16

### Patch Changes

- Updated dependencies [a8f9b6d]
  - ai@7.0.16

## 1.0.15

### Patch Changes

- ai@7.0.15

## 1.0.14

### Patch Changes

- 5c5c0f5: Add experimental streaming transcription support for transcription models, including OpenAI `gpt-realtime-whisper` and xAI WebSocket STT.
- Updated dependencies [5c5c0f5]
  - ai@7.0.14
  - @ai-sdk/provider@4.0.2
  - @ai-sdk/provider-utils@5.0.5

## 1.0.13

### Patch Changes

- ai@7.0.13

## 1.0.12

### Patch Changes

- Updated dependencies [ecfeb6f]
- Updated dependencies [a193137]
- Updated dependencies [c6f5e62]
  - ai@7.0.12
  - @ai-sdk/provider-utils@5.0.4

## 1.0.11

### Patch Changes

- Updated dependencies [0a87626]
  - ai@7.0.11

## 1.0.10

### Patch Changes

- Updated dependencies [8c616f0]
  - ai@7.0.10
  - @ai-sdk/provider-utils@5.0.3

## 1.0.9

### Patch Changes

- ai@7.0.9

## 1.0.8

### Patch Changes

- Updated dependencies [0274f34]
  - @ai-sdk/provider@4.0.1
  - ai@7.0.8
  - @ai-sdk/provider-utils@5.0.2

## 1.0.7

### Patch Changes

- Updated dependencies [d598481]
  - ai@7.0.7

## 1.0.6

### Patch Changes

- 4a9f4d5: `WorkflowChatTransport` now repairs UI message stream part framing, so duplicated or interleaved durable stream writes no longer crash the AI SDK consumer with `Received text-delta for missing text part`.
- 4016539: Forward `reasoning` generation settings from `WorkflowAgent` to model calls.
- Updated dependencies [989402d]
  - ai@7.0.6

## 1.0.5

### Patch Changes

- Updated dependencies [a2750db]
  - ai@7.0.5

## 1.0.4

### Patch Changes

- Updated dependencies [6a436e3]
  - @ai-sdk/provider-utils@5.0.1
  - ai@7.0.4

## 1.0.3

### Patch Changes

- ai@7.0.3

## 1.0.2

### Patch Changes

- ai@7.0.2

## 1.0.1

### Patch Changes

- ai@7.0.1

## 1.0.0

### Major Changes

- 1949571: feat(ai): make experimental_telemetry stable
- b3976a2: initial version

### Patch Changes

- 19736ee: feat(ai): rename onStepFinish to onStepEnd
- 382d53b: refactoring: rename context to runtimeContext
- b567a6c: dependency updates
- b402b95: `WorkflowAgent` now rejects system messages inside `prompt` or `messages` by default, matching the behavior of `generateText`/`streamText`. Set `allowSystemInMessages: true` to opt in to the previous behavior.
- eea8d98: refactoring: rename tool execution events
- 98627e5: feat(ai): remove onChunk event from telemetry
- ca446f8: feat: flexible tool descriptions
- 75763b0: agents: tag outgoing requests with an ai-sdk-agent user-agent segment for usage attribution (tool-loop, workflow)
- 9f0e36c: trigger release for all packages after provenance setup
- 29d8cf4: feat(ai): rename the core-event types
- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- a0ca584: fix (workflow): preserve invalid tool calls as errors instead of emitting synthetic success results
- eba685c: Remove `maxSteps` option from `WorkflowAgent`. Use `stopWhen` with stop conditions like `isStepCount()` instead.
- 0c4c275: trigger initial canary release
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- 334ae5d: Update step performance metrics with explicit effective, input, output, and total token throughput fields.
- b8396f0: trigger initial beta release
- c3d4019: chore(ai): rename 'TelemetrySettings' to 'TelemetryOptions'
- 083947b: feat(ai): separate toolsContext from context
- bae5e2b: fix(security): re-validate tool approvals from client message history before execution

  The approval-replay path in `generateText`/`streamText` (and `WorkflowAgent.stream`) reconstructed approved tool calls from the client-supplied messages array and executed them without re-validating input against the tool's schema or re-applying the approval policy. A client could forge an assistant message with a pre-approved tool-call part and have the server execute a tool with attacker-chosen arguments.

  The replay path now validates HMAC signature (when `experimental_toolApprovalSecret` is configured), re-validates tool-call input against the tool's input schema, and re-resolves the approval policy before execution.

- d775a57: feat: introduce Instructions type
- f32c750: refactoring(ai): simplify mergeAbortSignals
- bf6c17b: Add `id` property to WorkflowAgent for telemetry identification, matching ToolLoopAgent's API surface.
- 3ca592a: Add `prompt` as an alternative to `messages` in `WorkflowAgent.stream()`, matching the `AgentCallParameters` pattern from ToolLoopAgent.
- eb49d29: Add constructor-level defaults for `stopWhen`, `activeTools`, `output`, `experimental_repairToolCall`, and `experimental_download` to WorkflowAgent, matching ToolLoopAgent's pattern. Stream-level values override constructor defaults.
- 0455f24: Enrich WorkflowAgent callback event shapes to align with ToolLoopAgent:
  - Add `stepNumber` to `onToolCallStart` and `onToolCallFinish`
  - Add `steps` (previous step results) to `onStepStart`
  - Adopt discriminated union pattern (`success: true/false`) for `onToolCallFinish`
  - Add `durationMs` to `onToolCallFinish`
- 43543dc: Add `experimental_sandbox` support to `WorkflowAgent`. The sandbox is passed to tool execution, configurable on the constructor or per stream, and available to `prepareStep` for per-step overrides.
- 0e462a7: Use `LanguageModel` type for model parameter, aligning with `ToolLoopAgent`. Remove async factory model form. Rename callback types to use `WorkflowAgentOn*` prefix.
- 39dad72: feat(workflow): add stable telemetry integration support to `WorkflowAgent` and remove legacy telemetry options.
- 1e4b350: Honor `tool.toModelOutput` in `WorkflowAgent`.

  `WorkflowAgent` now routes successful local, provider-executed, and approved tool results through each tool's optional `toModelOutput` hook, matching `generateText`, `streamText`, and `ToolLoopAgent`. Previously the hook was ignored and results were always serialized as `text` or `json`.

  Internally exports the shared tool-result model-output helpers from `ai/internal`, and uses the shared `getErrorMessage` behavior for workflow tool error results.

- c3a6524: Add a `stepNumber` option to `doStreamStep` so callers can create `StepResult` objects with the correct step number.
- 907e002: fix (workflow): forward provider-executed tool approvals to the provider on resume

  `WorkflowAgent` stripped every `tool-approval-request` and `tool-approval-response` part from the messages when resuming after a tool approval, regardless of whether the tool was locally or provider-executed. For provider-executed tools (e.g. MCP via the OpenAI Responses API) this silently dropped the approval before `convertToLanguageModelPrompt` could forward it, so the provider never learned of the approval and the tool was never executed. Local approvals are still executed and stripped, while provider-executed approvals are now preserved and forwarded to the provider, matching the discriminator core's `streamText` already uses. This is the inverse of the bug fixed in #14289.

- 1d56275: feat(workflow): add `runtimeContext` and `toolsContext` to `WorkflowAgent`.

  `runtimeContext` is shared agent state that flows through `prepareCall`, `prepareStep`, step results, and `onFinish`. `toolsContext` is a per-tool map; each tool receives its own validated entry as `context`, validated against `tool.contextSchema` when defined. The previous `experimental_context` option (and corresponding fields on related callbacks and option types) has been removed — use `runtimeContext` for shared state and `toolsContext` for per-tool values. Context values in `WorkflowAgent` should be serializable because they can cross workflow and step boundaries.

- 81e68da: Fix `stepNumber` on telemetry events emitted by `WorkflowAgent.stream` so per-step telemetry integrations (e.g. `@ai-sdk/devtools`) correctly key state per step.
- 69d7128: fix(workflow): reuse the core tool-approval validation in WorkflowAgent

  `WorkflowAgent.stream` previously reconstructed approved tool calls with a copy of the core collection logic and validated them inline. Because the logic was duplicated, it could drift from the hardened `generateText`/`streamText` implementation. WorkflowAgent now collects approvals via the shared `collectToolApprovals` and re-validates each one through the shared `validateApprovedToolApprovals` (input-schema re-validation, HMAC signature verification when configured, and approval-policy re-resolution) in addition to its existing `needsApproval` guard, so a client-forged approval cannot execute a tool with unvalidated input. The duplicated collector was removed; `collectToolApprovals` and `validateApprovedToolApprovals` are now exported from `ai/internal`.

- fbea042: refactor: replace duplicate `filterTools`/`filterToolSet` with shared `experimental_filterActiveTools` from `ai`

## 1.0.0-beta.107

### Patch Changes

- ai@7.0.0-beta.187

## 1.0.0-beta.106

### Patch Changes

- ai@7.0.0-beta.186

## 1.0.0-beta.105

### Patch Changes

- 75763b0: agents: tag outgoing requests with an ai-sdk-agent user-agent segment for usage attribution (tool-loop, workflow)
- Updated dependencies [75763b0]
  - ai@7.0.0-beta.185

## 1.0.0-beta.104

### Patch Changes

- 43543dc: Add `experimental_sandbox` support to `WorkflowAgent`. The sandbox is passed to tool execution, configurable on the constructor or per stream, and available to `prepareStep` for per-step overrides.

## 1.0.0-beta.103

### Patch Changes

- Updated dependencies [0416e3e]
  - @ai-sdk/provider@4.0.0-beta.20
  - ai@7.0.0-beta.184
  - @ai-sdk/provider-utils@5.0.0-beta.50

## 1.0.0-beta.102

### Patch Changes

- ai@7.0.0-beta.183

## 1.0.0-beta.101

### Patch Changes

- b402b95: `WorkflowAgent` now rejects system messages inside `prompt` or `messages` by default, matching the behavior of `generateText`/`streamText`. Set `allowSystemInMessages: true` to opt in to the previous behavior.

## 1.0.0-beta.100

### Patch Changes

- 907e002: fix (workflow): forward provider-executed tool approvals to the provider on resume

  `WorkflowAgent` stripped every `tool-approval-request` and `tool-approval-response` part from the messages when resuming after a tool approval, regardless of whether the tool was locally or provider-executed. For provider-executed tools (e.g. MCP via the OpenAI Responses API) this silently dropped the approval before `convertToLanguageModelPrompt` could forward it, so the provider never learned of the approval and the tool was never executed. Local approvals are still executed and stripped, while provider-executed approvals are now preserved and forwarded to the provider, matching the discriminator core's `streamText` already uses. This is the inverse of the bug fixed in #14289.

## 1.0.0-beta.99

### Patch Changes

- Updated dependencies [cc6ab90]
  - ai@7.0.0-beta.182

## 1.0.0-beta.98

### Patch Changes

- Updated dependencies [6a2caf9]
  - ai@7.0.0-beta.181

## 1.0.0-beta.97

### Patch Changes

- Updated dependencies [81a284b]
  - ai@7.0.0-beta.180

## 1.0.0-beta.96

### Patch Changes

- ai@7.0.0-beta.179

## 1.0.0-beta.95

### Patch Changes

- Updated dependencies [b097c52]
  - ai@7.0.0-beta.178

## 1.0.0-beta.94

### Patch Changes

- b8396f0: trigger initial beta release
- Updated dependencies [b8396f0]
  - @ai-sdk/provider-utils@5.0.0-beta.49
  - @ai-sdk/provider@4.0.0-beta.19
  - ai@7.0.0-beta.177

## 1.0.0-canary.93

### Patch Changes

- ai@7.0.0-canary.176

## 1.0.0-canary.92

### Patch Changes

- Updated dependencies [6ec57f5]
  - ai@7.0.0-canary.175

## 1.0.0-canary.91

### Patch Changes

- ai@7.0.0-canary.174

## 1.0.0-canary.90

### Patch Changes

- ai@7.0.0-canary.173

## 1.0.0-canary.89

### Patch Changes

- Updated dependencies [aeda373]
- Updated dependencies [25a64f8]
- Updated dependencies [375fdd7]
- Updated dependencies [f18b08f]
- Updated dependencies [b4507d5]
  - @ai-sdk/provider-utils@5.0.0-canary.48
  - ai@7.0.0-canary.172

## 1.0.0-canary.88

### Patch Changes

- Updated dependencies [89ad56f]
- Updated dependencies [f9a496f]
- Updated dependencies [3295831]
  - ai@7.0.0-canary.171

## 1.0.0-canary.87

### Patch Changes

- bae5e2b: fix(security): re-validate tool approvals from client message history before execution

  The approval-replay path in `generateText`/`streamText` (and `WorkflowAgent.stream`) reconstructed approved tool calls from the client-supplied messages array and executed them without re-validating input against the tool's schema or re-applying the approval policy. A client could forge an assistant message with a pre-approved tool-call part and have the server execute a tool with attacker-chosen arguments.

  The replay path now validates HMAC signature (when `experimental_toolApprovalSecret` is configured), re-validates tool-call input against the tool's input schema, and re-resolves the approval policy before execution.

- 69d7128: fix(workflow): reuse the core tool-approval validation in WorkflowAgent

  `WorkflowAgent.stream` previously reconstructed approved tool calls with a copy of the core collection logic and validated them inline. Because the logic was duplicated, it could drift from the hardened `generateText`/`streamText` implementation. WorkflowAgent now collects approvals via the shared `collectToolApprovals` and re-validates each one through the shared `validateApprovedToolApprovals` (input-schema re-validation, HMAC signature verification when configured, and approval-policy re-resolution) in addition to its existing `needsApproval` guard, so a client-forged approval cannot execute a tool with unvalidated input. The duplicated collector was removed; `collectToolApprovals` and `validateApprovedToolApprovals` are now exported from `ai/internal`.

- Updated dependencies [bae5e2b]
- Updated dependencies [69d7128]
  - ai@7.0.0-canary.170
  - @ai-sdk/provider-utils@5.0.0-canary.47

## 1.0.0-canary.86

### Patch Changes

- Updated dependencies [a5018ab]
- Updated dependencies [21d3d60]
- Updated dependencies [426dbbb]
- Updated dependencies [7fd3360]
  - ai@7.0.0-canary.169

## 1.0.0-canary.85

### Patch Changes

- 1e4b350: Honor `tool.toModelOutput` in `WorkflowAgent`.

  `WorkflowAgent` now routes successful local, provider-executed, and approved tool results through each tool's optional `toModelOutput` hook, matching `generateText`, `streamText`, and `ToolLoopAgent`. Previously the hook was ignored and results were always serialized as `text` or `json`.

  Internally exports the shared tool-result model-output helpers from `ai/internal`, and uses the shared `getErrorMessage` behavior for workflow tool error results.

- Updated dependencies [1e4b350]
  - ai@7.0.0-canary.168

## 1.0.0-canary.84

### Patch Changes

- Updated dependencies [4757690]
- Updated dependencies [eeefc3f]
- Updated dependencies [b79b6a8]
  - ai@7.0.0-canary.167

## 1.0.0-canary.83

### Patch Changes

- 19736ee: feat(ai): rename onStepFinish to onStepEnd
- Updated dependencies [19736ee]
- Updated dependencies [d66ae02]
- Updated dependencies [e4182bd]
  - ai@7.0.0-canary.166

## 1.0.0-canary.82

### Patch Changes

- Updated dependencies [ce769dd]
  - @ai-sdk/provider@4.0.0-canary.18
  - ai@7.0.0-canary.165
  - @ai-sdk/provider-utils@5.0.0-canary.46

## 1.0.0-canary.81

### Patch Changes

- ai@7.0.0-canary.164

## 1.0.0-canary.80

### Patch Changes

- Updated dependencies [ee798eb]
- Updated dependencies [daf6637]
- Updated dependencies [c907622]
  - @ai-sdk/provider-utils@5.0.0-canary.45
  - ai@7.0.0-canary.163

## 1.0.0-canary.79

### Patch Changes

- ai@7.0.0-canary.162

## 1.0.0-canary.78

### Patch Changes

- ai@7.0.0-canary.161

## 1.0.0-canary.77

### Patch Changes

- ai@7.0.0-canary.160

## 1.0.0-canary.76

### Patch Changes

- Updated dependencies [b5092f5]
  - ai@7.0.0-canary.159

## 1.0.0-canary.75

### Patch Changes

- Updated dependencies [bcce2dd]
  - ai@7.0.0-canary.158

## 1.0.0-canary.74

### Patch Changes

- ai@7.0.0-canary.157

## 1.0.0-canary.73

### Patch Changes

- Updated dependencies [023550e]
- Updated dependencies [e92fc45]
  - ai@7.0.0-canary.156

## 1.0.0-canary.72

### Patch Changes

- Updated dependencies [e67d80e]
- Updated dependencies [6cca112]
- Updated dependencies [82fc0ab]
- Updated dependencies [76fd58c]
  - ai@7.0.0-canary.155

## 1.0.0-canary.71

### Patch Changes

- Updated dependencies [594029e]
  - ai@7.0.0-canary.154

## 1.0.0-canary.70

### Patch Changes

- Updated dependencies [6c93e36]
- Updated dependencies [f617ac2]
  - @ai-sdk/provider-utils@5.0.0-canary.44
  - ai@7.0.0-canary.153

## 1.0.0-canary.69

### Patch Changes

- ai@7.0.0-canary.152

## 1.0.0-canary.68

### Patch Changes

- ai@7.0.0-canary.151

## 1.0.0-canary.67

### Patch Changes

- ai@7.0.0-canary.150

## 1.0.0-canary.66

### Patch Changes

- Updated dependencies [e3d9c0e]
  - ai@7.0.0-canary.149

## 1.0.0-canary.65

### Patch Changes

- Updated dependencies [2852a84]
  - ai@7.0.0-canary.148

## 1.0.0-canary.64

### Patch Changes

- ai@7.0.0-canary.147

## 1.0.0-canary.63

### Patch Changes

- ai@7.0.0-canary.146

## 1.0.0-canary.62

### Patch Changes

- ai@7.0.0-canary.145

## 1.0.0-canary.61

### Patch Changes

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- Updated dependencies [7fc6bd6]
  - ai@7.0.0-canary.144
  - @ai-sdk/provider-utils@5.0.0-canary.43
  - @ai-sdk/provider@4.0.0-canary.17

## 1.0.0-canary.60

### Patch Changes

- b567a6c: dependency updates
- Updated dependencies [a6617c5]
  - @ai-sdk/provider-utils@5.0.0-canary.42
  - ai@7.0.0-canary.143

## 1.0.0-canary.59

### Patch Changes

- Updated dependencies [62d6481]
  - ai@7.0.0-canary.142

## 1.0.0-canary.58

### Patch Changes

- Updated dependencies [e3a0419]
  - ai@7.0.0-canary.141

## 1.0.0-canary.57

### Patch Changes

- ai@7.0.0-canary.140

## 1.0.0-canary.56

### Patch Changes

- 334ae5d: Update step performance metrics with explicit effective, input, output, and total token throughput fields.
- Updated dependencies [334ae5d]
- Updated dependencies [28dfa06]
- Updated dependencies [e93fa91]
  - ai@7.0.0-canary.139
  - @ai-sdk/provider-utils@5.0.0-canary.41

## 1.0.0-canary.55

### Patch Changes

- ai@7.0.0-canary.138

## 1.0.0-canary.54

### Patch Changes

- 98627e5: feat(ai): remove onChunk event from telemetry
- Updated dependencies [98627e5]
- Updated dependencies [476e1ca]
  - ai@7.0.0-canary.137

## 1.0.0-canary.53

### Patch Changes

- Updated dependencies [a7de9c9]
  - @ai-sdk/provider-utils@5.0.0-canary.40
  - ai@7.0.0-canary.136

## 1.0.0-canary.52

### Patch Changes

- Updated dependencies [105f95b]
  - @ai-sdk/provider-utils@5.0.0-canary.39
  - ai@7.0.0-canary.135

## 1.0.0-canary.51

### Patch Changes

- Updated dependencies [ed74dae]
- Updated dependencies [f4cc8eb]
- Updated dependencies [e80ada0]
- Updated dependencies [1dca341]
- Updated dependencies [2605e5f]
  - ai@7.0.0-canary.134

## 1.0.0-canary.50

### Patch Changes

- Updated dependencies [38ca8dc]
- Updated dependencies [6d76710]
  - ai@7.0.0-canary.133

## 1.0.0-canary.49

### Patch Changes

- 81e68da: Fix `stepNumber` on telemetry events emitted by `WorkflowAgent.stream` so per-step telemetry integrations (e.g. `@ai-sdk/devtools`) correctly key state per step.
- Updated dependencies [eaf849f]
- Updated dependencies [8565dcb]
  - ai@7.0.0-canary.132

## 1.0.0-canary.48

### Patch Changes

- c3a6524: Add a `stepNumber` option to `doStreamStep` so callers can create `StepResult` objects with the correct step number.

## 1.0.0-canary.47

### Patch Changes

- ca446f8: feat: flexible tool descriptions
- Updated dependencies [b67525f]
- Updated dependencies [ca446f8]
- Updated dependencies [bcacd48]
  - ai@7.0.0-canary.131
  - @ai-sdk/provider-utils@5.0.0-canary.38

## 1.0.0-canary.46

### Patch Changes

- ai@7.0.0-canary.130

## 1.0.0-canary.45

### Patch Changes

- Updated dependencies [d1b3786]
  - ai@7.0.0-canary.129

## 1.0.0-canary.44

### Patch Changes

- Updated dependencies [d848405]
  - @ai-sdk/provider-utils@5.0.0-canary.37
  - ai@7.0.0-canary.128

## 1.0.0-canary.43

### Patch Changes

- d775a57: feat: introduce Instructions type
- 39dad72: feat(workflow): add stable telemetry integration support to `WorkflowAgent` and remove legacy telemetry options.
- Updated dependencies [e95e38d]
- Updated dependencies [016e877]
- Updated dependencies [ca99fea]
- Updated dependencies [ca39020]
- Updated dependencies [d775a57]
- Updated dependencies [538c12b]
  - ai@7.0.0-canary.127
  - @ai-sdk/provider-utils@5.0.0-canary.36

## 1.0.0-canary.42

### Patch Changes

- Updated dependencies [f634bac]
  - @ai-sdk/provider-utils@5.0.0-canary.35
  - ai@7.0.0-canary.126

## 1.0.0-canary.41

### Patch Changes

- 1d56275: feat(workflow): add `runtimeContext` and `toolsContext` to `WorkflowAgent`.

  `runtimeContext` is shared agent state that flows through `prepareCall`, `prepareStep`, step results, and `onFinish`. `toolsContext` is a per-tool map; each tool receives its own validated entry as `context`, validated against `tool.contextSchema` when defined. The previous `experimental_context` option (and corresponding fields on related callbacks and option types) has been removed — use `runtimeContext` for shared state and `toolsContext` for per-tool values. Context values in `WorkflowAgent` should be serializable because they can cross workflow and step boundaries.

## 1.0.0-canary.40

### Patch Changes

- Updated dependencies [fd4f578]
- Updated dependencies [31f69de]
- Updated dependencies [7c71ac6]
- Updated dependencies [c0c8ca2]
- Updated dependencies [5faf71c]
- Updated dependencies [69254e0]
- Updated dependencies [3015fc3]
- Updated dependencies [eee1166]
- Updated dependencies [7dbf992]
  - ai@7.0.0-canary.125
  - @ai-sdk/provider-utils@5.0.0-canary.34

## 1.0.0-canary.39

### Patch Changes

- Updated dependencies [69aeb0e]
- Updated dependencies [48e92f3]
  - ai@7.0.0-canary.124

## 1.0.0-canary.38

### Patch Changes

- Updated dependencies [7392266]
- Updated dependencies [4bb4dbc]
  - ai@7.0.0-canary.123

## 1.0.0-canary.37

### Patch Changes

- Updated dependencies [79b2468]
- Updated dependencies [c22750c]
  - ai@7.0.0-canary.122

## 1.0.0-canary.36

### Patch Changes

- Updated dependencies [2427d88]
- Updated dependencies [5588abd]
- Updated dependencies [6dd6b83]
  - @ai-sdk/provider-utils@5.0.0-canary.33
  - ai@7.0.0-canary.121

## 1.0.0-canary.35

### Patch Changes

- Updated dependencies [5463d0d]
  - @ai-sdk/provider-utils@5.0.0-canary.32
  - @ai-sdk/provider@4.0.0-canary.16
  - ai@7.0.0-canary.120

## 1.0.0-canary.34

### Patch Changes

- ai@7.0.0-canary.119

## 1.0.0-canary.33

### Patch Changes

- Updated dependencies [47e65d6]
  - ai@7.0.0-canary.118

## 1.0.0-canary.32

### Patch Changes

- 0c4c275: trigger initial canary release
- Updated dependencies [0c4c275]
  - @ai-sdk/provider-utils@5.0.0-canary.31
  - @ai-sdk/provider@4.0.0-canary.15
  - ai@7.0.0-canary.117

## 1.0.0-beta.31

### Patch Changes

- ai@7.0.0-beta.116

## 1.0.0-beta.30

### Patch Changes

- Updated dependencies [08d2129]
- Updated dependencies [202f107]
  - @ai-sdk/provider-utils@5.0.0-beta.30
  - ai@7.0.0-beta.115

## 1.0.0-beta.29

### Patch Changes

- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- Updated dependencies [43a6750]
- Updated dependencies [81caa5d]
- Updated dependencies [1f7db50]
- Updated dependencies [9bd6512]
- Updated dependencies [258c093]
- Updated dependencies [b6783da]
- Updated dependencies [6147cdf]
  - ai@7.0.0-beta.114
  - @ai-sdk/provider-utils@5.0.0-beta.29
  - @ai-sdk/provider@4.0.0-beta.14

## 1.0.0-beta.28

### Patch Changes

- 9f0e36c: trigger release for all packages after provenance setup
- Updated dependencies [9f0e36c]
  - ai@7.0.0-beta.113
  - @ai-sdk/provider@4.0.0-beta.13
  - @ai-sdk/provider-utils@5.0.0-beta.28

## 1.0.0-beta.27

### Patch Changes

- 29d8cf4: feat(ai): rename the core-event types
- a0ca584: fix (workflow): preserve invalid tool calls as errors instead of emitting synthetic success results
- Updated dependencies [785fe16]
- Updated dependencies [5f3749c]
- Updated dependencies [0a51f7d]
- Updated dependencies [71d3022]
- Updated dependencies [67df0a0]
- Updated dependencies [4181cfe]
- Updated dependencies [51ce232]
- Updated dependencies [cf93359]
- Updated dependencies [befb78c]
- Updated dependencies [29d8cf4]
- Updated dependencies [0458559]
- Updated dependencies [58a2ad7]
- Updated dependencies [5852c0a]
- Updated dependencies [37d69b2]
- Updated dependencies [1043274]
- Updated dependencies [7f59f04]
- Updated dependencies [7677c1e]
- Updated dependencies [116c89f]
- Updated dependencies [f58f9bc]
- Updated dependencies [e1bfb9c]
- Updated dependencies [e87d71b]
- Updated dependencies [9d486aa]
- Updated dependencies [9b0bc8a]
- Updated dependencies [fc92055]
- Updated dependencies [4e095b0]
  - @ai-sdk/provider-utils@5.0.0-beta.27
  - ai@7.0.0-beta.112

## 1.0.0-beta.26

### Major Changes

- 1949571: feat(ai): make experimental_telemetry stable

### Patch Changes

- f32c750: refactoring(ai): simplify mergeAbortSignals
- Updated dependencies [f319fde]
- Updated dependencies [1949571]
- Updated dependencies [511902c]
- Updated dependencies [6542d93]
- Updated dependencies [2e98477]
- Updated dependencies [876fd3e]
- Updated dependencies [f32c750]
  - ai@7.0.0-beta.111
  - @ai-sdk/provider-utils@5.0.0-beta.26

## 1.0.0-beta.25

### Patch Changes

- Updated dependencies [72cb801]
  - ai@7.0.0-beta.110

## 1.0.0-beta.24

### Patch Changes

- eea8d98: refactoring: rename tool execution events
- Updated dependencies [ec98264]
- Updated dependencies [eea8d98]
- Updated dependencies [75ef93e]
  - ai@7.0.0-beta.109
  - @ai-sdk/provider-utils@5.0.0-beta.25

## 1.0.0-beta.23

### Patch Changes

- Updated dependencies [f807e45]
  - @ai-sdk/provider-utils@5.0.0-beta.24
  - ai@7.0.0-beta.108

## 1.0.0-beta.22

### Patch Changes

- Updated dependencies [350ea38]
  - @ai-sdk/provider-utils@5.0.0-beta.23
  - ai@7.0.0-beta.107

## 1.0.0-beta.21

### Patch Changes

- fbea042: refactor: replace duplicate `filterTools`/`filterToolSet` with shared `experimental_filterActiveTools` from `ai`

## 1.0.0-beta.20

### Patch Changes

- ai@7.0.0-beta.106

## 1.0.0-beta.19

### Patch Changes

- Updated dependencies [33d099c]
  - ai@7.0.0-beta.105

## 1.0.0-beta.18

### Patch Changes

- eba685c: Remove `maxSteps` option from `WorkflowAgent`. Use `stopWhen` with stop conditions like `isStepCount()` instead.
- Updated dependencies [2a74d43]
  - ai@7.0.0-beta.104

## 1.0.0-beta.17

### Patch Changes

- 382d53b: refactoring: rename context to runtimeContext
- c3d4019: chore(ai): rename 'TelemetrySettings' to 'TelemetryOptions'
- 083947b: feat(ai): separate toolsContext from context
- Updated dependencies [382d53b]
- Updated dependencies [7bf7d7f]
- Updated dependencies [c3d4019]
- Updated dependencies [083947b]
  - ai@7.0.0-beta.103
  - @ai-sdk/provider-utils@5.0.0-beta.22

## 1.0.0-beta.16

### Patch Changes

- ai@7.0.0-beta.102

## 1.0.0-beta.15

### Patch Changes

- Updated dependencies [4873966]
  - ai@7.0.0-beta.101

## 1.0.0-beta.14

### Patch Changes

- Updated dependencies [add1126]
  - @ai-sdk/provider-utils@5.0.0-beta.21
  - ai@7.0.0-beta.100

## 1.0.0-beta.13

### Patch Changes

- Updated dependencies [2a9c144]
  - ai@7.0.0-beta.99

## 1.0.0-beta.12

### Patch Changes

- ai@7.0.0-beta.98

## 1.0.0-beta.11

### Patch Changes

- Updated dependencies [208d045]
  - ai@7.0.0-beta.97

## 1.0.0-beta.10

### Patch Changes

- ai@7.0.0-beta.96

## 1.0.0-beta.9

### Patch Changes

- Updated dependencies [c4f4b5f]
  - ai@7.0.0-beta.95

## 1.0.0-beta.8

### Patch Changes

- 0455f24: Enrich WorkflowAgent callback event shapes to align with ToolLoopAgent:
  - Add `stepNumber` to `onToolCallStart` and `onToolCallFinish`
  - Add `steps` (previous step results) to `onStepStart`
  - Adopt discriminated union pattern (`success: true/false`) for `onToolCallFinish`
  - Add `durationMs` to `onToolCallFinish`

## 1.0.0-beta.7

### Patch Changes

- Updated dependencies [1582efa]
  - ai@7.0.0-beta.94

## 1.0.0-beta.6

### Patch Changes

- Updated dependencies [bc47739]
  - ai@7.0.0-beta.93

## 1.0.0-beta.5

### Patch Changes

- bf6c17b: Add `id` property to WorkflowAgent for telemetry identification, matching ToolLoopAgent's API surface.
- 3ca592a: Add `prompt` as an alternative to `messages` in `WorkflowAgent.stream()`, matching the `AgentCallParameters` pattern from ToolLoopAgent.
- eb49d29: Add constructor-level defaults for `stopWhen`, `activeTools`, `output`, `experimental_repairToolCall`, and `experimental_download` to WorkflowAgent, matching ToolLoopAgent's pattern. Stream-level values override constructor defaults.

## 1.0.0-beta.4

### Patch Changes

- ai@7.0.0-beta.92

## 1.0.0-beta.3

### Patch Changes

- 0e462a7: Use `LanguageModel` type for model parameter, aligning with `ToolLoopAgent`. Remove async factory model form. Rename callback types to use `WorkflowAgentOn*` prefix.

## 1.0.0-beta.2

### Patch Changes

- ai@7.0.0-beta.91

## 1.0.0-beta.1

### Patch Changes

- Updated dependencies [1db29c8]
  - ai@7.0.0-beta.90

## 1.0.0-beta.0

### Major Changes

- b3976a2: initial version

### Patch Changes

- Updated dependencies [b3976a2]
- Updated dependencies [ff5eba1]
  - @ai-sdk/provider-utils@5.0.0-beta.20
  - @ai-sdk/provider@4.0.0-beta.12
  - ai@7.0.0-beta.89
