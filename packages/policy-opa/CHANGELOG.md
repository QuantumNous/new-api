# @ai-sdk/policy

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

- a94c258: Introduce `@ai-sdk/policy-opa`, an Open Policy Agent adapter for the
  `toolApproval` callback on `generateText` / `streamText` / `ToolLoopAgent`.

  Everything is exported from the package root. The engine-neutral core is a
  `PolicyClient` interface, `shadow()` for safe policy rollout with
  fire-and-forget telemetry, and `wrapMcpTools()` for making approval
  configuration total over a discovered tool surface. The OPA layer ships
  `opaPolicy` / `optionalOpaPolicy` (Rego-as-code authorization),
  `wasmPolicyClient` and `httpPolicyClient` backends (lazy-loaded optional peer
  deps), `opaCapabilityMiddleware` for fail-closed model-level tool filtering,
  and `normalizeOpaDecision` for users who call OPA themselves.

  Sits entirely on top of the public SDK surface, with no changes to `ai`,
  `@ai-sdk/provider`, or `@ai-sdk/provider-utils`. Transitive enforcement
  (coarse dispatchers like `bash` / `http.request` / MCP proxies) is handled
  inside the user's `toolApproval` by parsing the dispatcher input and routing
  to the same Rego rule that gates the direct tool.

### Patch Changes

- 9a1b0ea: Initial release
- b8396f0: trigger initial beta release

## 1.0.0-beta.24

### Patch Changes

- ai@7.0.0-beta.187

## 1.0.0-beta.23

### Patch Changes

- ai@7.0.0-beta.186

## 1.0.0-beta.22

### Patch Changes

- Updated dependencies [75763b0]
  - ai@7.0.0-beta.185

## 1.0.0-beta.21

### Patch Changes

- Updated dependencies [0416e3e]
  - @ai-sdk/provider@4.0.0-beta.20
  - ai@7.0.0-beta.184
  - @ai-sdk/provider-utils@5.0.0-beta.50

## 1.0.0-beta.20

### Patch Changes

- ai@7.0.0-beta.183

## 1.0.0-beta.19

### Patch Changes

- Updated dependencies [cc6ab90]
  - ai@7.0.0-beta.182

## 1.0.0-beta.18

### Patch Changes

- Updated dependencies [6a2caf9]
  - ai@7.0.0-beta.181

## 1.0.0-beta.17

### Patch Changes

- Updated dependencies [81a284b]
  - ai@7.0.0-beta.180

## 1.0.0-beta.16

### Patch Changes

- ai@7.0.0-beta.179

## 1.0.0-beta.15

### Patch Changes

- Updated dependencies [b097c52]
  - ai@7.0.0-beta.178

## 1.0.0-beta.14

### Patch Changes

- b8396f0: trigger initial beta release
- Updated dependencies [b8396f0]
  - @ai-sdk/provider-utils@5.0.0-beta.49
  - @ai-sdk/provider@4.0.0-beta.19
  - ai@7.0.0-beta.177

## 1.0.0-canary.13

### Patch Changes

- ai@7.0.0-canary.176

## 1.0.0-canary.12

### Patch Changes

- Updated dependencies [6ec57f5]
  - ai@7.0.0-canary.175

## 1.0.0-canary.11

### Patch Changes

- ai@7.0.0-canary.174

## 1.0.0-canary.10

### Patch Changes

- ai@7.0.0-canary.173

## 1.0.0-canary.9

### Patch Changes

- Updated dependencies [aeda373]
- Updated dependencies [25a64f8]
- Updated dependencies [375fdd7]
- Updated dependencies [f18b08f]
- Updated dependencies [b4507d5]
  - @ai-sdk/provider-utils@5.0.0-canary.48
  - ai@7.0.0-canary.172

## 1.0.0-canary.8

### Patch Changes

- Updated dependencies [89ad56f]
- Updated dependencies [f9a496f]
- Updated dependencies [3295831]
  - ai@7.0.0-canary.171

## 1.0.0-canary.7

### Patch Changes

- Updated dependencies [bae5e2b]
- Updated dependencies [69d7128]
  - ai@7.0.0-canary.170
  - @ai-sdk/provider-utils@5.0.0-canary.47

## 1.0.0-canary.6

### Patch Changes

- Updated dependencies [a5018ab]
- Updated dependencies [21d3d60]
- Updated dependencies [426dbbb]
- Updated dependencies [7fd3360]
  - ai@7.0.0-canary.169

## 1.0.0-canary.5

### Patch Changes

- Updated dependencies [1e4b350]
  - ai@7.0.0-canary.168

## 1.0.0-canary.4

### Patch Changes

- Updated dependencies [4757690]
- Updated dependencies [eeefc3f]
- Updated dependencies [b79b6a8]
  - ai@7.0.0-canary.167

## 1.0.0-canary.3

### Patch Changes

- Updated dependencies [19736ee]
- Updated dependencies [d66ae02]
- Updated dependencies [e4182bd]
  - ai@7.0.0-canary.166

## 1.0.0-canary.2

### Patch Changes

- Updated dependencies [ce769dd]
  - @ai-sdk/provider@4.0.0-canary.18
  - ai@7.0.0-canary.165
  - @ai-sdk/provider-utils@5.0.0-canary.46

## 1.0.0-canary.1

### Patch Changes

- 9a1b0ea: Initial release
  - ai@7.0.0-canary.164

## 1.0.0-canary.0

### Major Changes

- a94c258: Introduce `@ai-sdk/policy-opa`, an Open Policy Agent adapter for the
  `toolApproval` callback on `generateText` / `streamText` / `ToolLoopAgent`.

  Everything is exported from the package root. The engine-neutral core is a
  `PolicyClient` interface, `shadow()` for safe policy rollout with
  fire-and-forget telemetry, and `wrapMcpTools()` for making approval
  configuration total over a discovered tool surface. The OPA layer ships
  `opaPolicy` / `optionalOpaPolicy` (Rego-as-code authorization),
  `wasmPolicyClient` and `httpPolicyClient` backends (lazy-loaded optional peer
  deps), `opaCapabilityMiddleware` for fail-closed model-level tool filtering,
  and `normalizeOpaDecision` for users who call OPA themselves.

  Sits entirely on top of the public SDK surface, with no changes to `ai`,
  `@ai-sdk/provider`, or `@ai-sdk/provider-utils`. Transitive enforcement
  (coarse dispatchers like `bash` / `http.request` / MCP proxies) is handled
  inside the user's `toolApproval` by parsing the dispatcher input and routing
  to the same Rego rule that gates the direct tool.

### Patch Changes

- Updated dependencies [ee798eb]
- Updated dependencies [daf6637]
- Updated dependencies [c907622]
  - @ai-sdk/provider-utils@5.0.0-canary.45
  - ai@7.0.0-canary.163
