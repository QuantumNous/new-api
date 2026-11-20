# @ai-sdk/google

## 4.0.18

### Patch Changes

- Updated dependencies [cd06458]
  - @ai-sdk/provider-utils@5.0.11

## 4.0.17

### Patch Changes

- 5b4a299: fix(provider/google): forward Vertex-only imageConfig options (personGeneration, prominentPeople, imageOutputOptions)

## 4.0.16

### Patch Changes

- 662ddfc: Allow google.interactions agent requests to include supported tools, including file_search.

## 4.0.15

### Patch Changes

- Updated dependencies [31c7be8]
  - @ai-sdk/provider-utils@5.0.10

## 4.0.14

### Patch Changes

- 4be62c1: fix(provider-utils): validate provider-response URLs in `getFromApi`

  `getFromApi` now has a `validateUrl` flag. It is optional so existing callers keep compiling (omitting it behaves like `false`, i.e. no validation), but all AI SDK provider packages set it explicitly at every call site so each one makes a visible trust decision. When `true`, the URL is routed through `fetchWithValidatedRedirects` — the same guard used by `downloadBlob` — which rejects private/loopback/link-local targets, re-validates every redirect hop, strips proxy/metadata/cookie request headers, and drops all caller headers except the user-agent on cross-origin redirects (custom API-key headers must not follow a redirect off-origin any more than `Authorization` may); blocked URLs throw `DownloadError`. It is enabled at the image/video/audio download and polling call sites where the URL comes from a provider response body; URLs built from developer-configured endpoints pass `validateUrl: false` and are unaffected.

  A new optional `credentialedOrigin` withholds caller headers unless the URL is same-origin with it, so the API key is not sent to a response-supplied host on a different origin.

  A new optional `trustedOrigin` exempts URLs (and redirect hops) that are same-origin with the developer-configured provider endpoint from target validation, so self-hosted and localhost deployments whose response URLs point back at the configured host keep working; all other hops are still validated.

  Also closes range gaps in `validateDownloadUrl` (IPv4 `224.0.0.0/4` multicast and the TEST-NET documentation ranges `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`; IPv6 documentation ranges `2001:db8::/32` and `3fff::/20`), and follows only the fetch-spec redirect status codes (301/302/303/307/308) — a `Location` header on any other status is not followed. This guard performs string/literal checks only and does not resolve DNS; hostnames that resolve to private addresses and DNS rebinding remain out of scope and must be constrained at the network layer (or by injecting a Node `fetch` that pins the resolved IP at connect time) for server deployments handling untrusted URLs. See `contributing/secure-url-handling.md`.

- Updated dependencies [4be62c1]
- Updated dependencies [7805e4a]
- Updated dependencies [cd12954]
  - @ai-sdk/provider-utils@5.0.9

## 4.0.13

### Patch Changes

- Updated dependencies [e193290]
  - @ai-sdk/provider-utils@5.0.8

## 4.0.12

### Patch Changes

- e40118c: Forward text file references as documents when using the Google Interactions API.

## 4.0.11

### Patch Changes

- 17d66c5: Fix Google tool result conversion to send file data as inline data instead of JSON text on the legacy tool-result path.
- 96d40bc: Expand standalone Google `threshold` provider options into safety settings.
- 0f93c57: feat (video): support video (not just image) reference inputs in `inputReferences` for reference-to-video generation
- Updated dependencies [0f93c57]
  - @ai-sdk/provider@4.0.3
  - @ai-sdk/provider-utils@5.0.7

## 4.0.10

### Patch Changes

- Updated dependencies [ac306ed]
  - @ai-sdk/provider-utils@5.0.6

## 4.0.9

### Patch Changes

- 7401c2c: Pass documented Gemini external HTTPS file URLs through without downloading them.

## 4.0.8

### Patch Changes

- 5c5c0f5: Add experimental streaming transcription support for transcription models, including OpenAI `gpt-realtime-whisper` and xAI WebSocket STT.
- Updated dependencies [5c5c0f5]
  - @ai-sdk/provider@4.0.2
  - @ai-sdk/provider-utils@5.0.5

## 4.0.7

### Patch Changes

- c6f5e62: Prevent prototype pollution when synchronously parsing provider JSON inputs and expose `secureJsonParse` from provider-utils.
- bd8d172: Fix Google embedding batch size to respect the Gemini API limit of 100 requests per batch.
- Updated dependencies [c6f5e62]
  - @ai-sdk/provider-utils@5.0.4

## 4.0.6

### Patch Changes

- d20f0dc: Add `vertex.interactions()` for the Gemini Interactions API on Vertex AI. Targets the location-scoped `.../locations/{region}/interactions` resource using the existing Vertex OAuth credentials, enabling multimodal-output models such as `gemini-omni-flash-preview` (video output) through Vertex. The `GoogleInteractionsLanguageModel` is now exported from `@ai-sdk/google/internal` for provider reuse.

## 4.0.5

### Patch Changes

- Updated dependencies [8c616f0]
  - @ai-sdk/provider-utils@5.0.3

## 4.0.4

### Patch Changes

- dc1eb8d: Support Gemini Interactions video output. Parse video output blocks from the Google Interactions API into file parts (buffered and streaming), and surface the per-modality output token breakdown via `providerMetadata.google.outputTokensByModality`.

## 4.0.3

### Patch Changes

- 0274f34: feat (video): add first-class `frameImages` and `inputReferences` call options for video generation
- Updated dependencies [0274f34]
  - @ai-sdk/provider@4.0.1
  - @ai-sdk/provider-utils@5.0.2

## 4.0.2

### Patch Changes

- Updated dependencies [6a436e3]
  - @ai-sdk/provider-utils@5.0.1

## 4.0.1

### Patch Changes

- ba6d510: chore: fix deprecated use of zod `.passthrough()`

## 4.0.0

### Major Changes

- a3757d7: chore(provider/google): remove useless GenerativeAI affix from types and classes for consistency
- f7d4f01: feat(provider): add support for `reasoning-file` type for files that are part of reasoning
- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.
- c29a26f: feat(provider): add support for provider references and uploading files as supported per provider
- 3887c70: feat(provider): add new top-level reasoning parameter to spec and support it in `generateText` and `streamText`
- 8359612: Start v7 pre-release
- 04e9009: chore: make provider implementations code patterns more consistent, including renaming certain exported symbols

  For all externally exported symbols that were renamed, the old names continue to work via deprecated aliases.

### Patch Changes

- 7f04802: feat(provider/google): add support for managed agents in the Interactions API
- 38fc777: Add AI Gateway hint to provider READMEs
- b71c0d7: feat(provider/google): support Google search grounding when using `generateImage` with Gemini
- 6190649: chore(provider/google): remove obsolete Google image model
- 55db546: fix(provider/google): fix Gemini service tier enum after upstream update
- 9a0a618: fix(google): fix `serviceTier` to be correctly formatted for Vertex API
- 00a0f36: feat(google, google-vertex): added `gemini-embedding-2`, `deep-research-max-preview-04-2026` and `deep-research-preview-04-2026`
- 9715ec7: feat(provider/google): add support for service tier parameter
- 41da50c: fix(provider/google): support `functionCall.id` when returned by Gemini API and provide matching `functionResponse.id`
- add4326: fix(provider/google): correct JSDoc for multimodal embedding content option
- a8d70b6: fix(google): auto-inject `skip_thought_signature_validator` for Gemini 3 tool-call replays without a signature
- 947cdab: Add Google realtime Live Translation provider options for `gemini-3.5-live-translate-preview`.
- 4e825f3: feat(google): update Interactions API implementation to cater for upstream breaking changes coming May 26
- b563707: feat(provider/google): add Gemini text-to-speech (speech) model support
- a05109d: feat(provider/google): preserve per-modality token details in usage data
- cfca634: fix(google): emit Vertex no-args streaming tool calls and preserve thoughtSignature

  Vertex emits a no-args function call as a single chunk shaped `{ functionCall: { name: 'X' } }` with no `args`, no `partialArgs`, and no `willContinue`. The streaming parser had no branch for this shape, so the call was dropped along with any `thoughtSignature` it carried. For Gemini 3 thinking models this caused the next multi-turn step to 400 with `missing thought_signature`. The unary (`doGenerate`) path had the same drop.

  Both paths now emit the call as a complete tool call with `'{}'` input and propagate `thoughtSignature` provider metadata.

  Fixes #14847.

- c9c4661: fix(provider/google): preserve groundingMetadata and urlContextMetadata when they arrive in a stream chunk before the finishReason chunk
- 045d2e8: fix(google): read `serviceTier` from `usageMetadata.serviceTier` in both generate and stream paths

  The previous implementation read `serviceTier` from the `x-gemini-service-tier`
  response header, which is only populated on non-streaming responses. Gemini
  streaming includes the value in `usageMetadata.serviceTier` on every chunk, so
  `providerMetadata.google.serviceTier` was always `null` for streams. Read from
  `usageMetadata` for both paths instead.

- 19b95f9: fix(google): use VALIDATED function calling mode when any tool has strict:true
- 2ce3c65: feat(provider/google-vertex): add Gemini text-to-speech (speech) model support
- 5878b40: fix(google): prevent prototype pollution when streaming tool args
- 46d1149: chore(provider-utils,google): fix grammar errors in error and warning messages
- 6a26901: feat(google): add `fileData` support to embedding model
- 01fa606: feat(provider/google): support combining built-in tools with function calling on Gemini 3
- 5036db8: feat(google-vertex): add support for streaming tool arguments input
- 9f0e36c: trigger release for all packages after provenance setup
- a2609df: fix(google): fix streaming tool call args
- ab43029: feat(provider/google): support multimodal content parts in embedding provider options
- 82288b0: feat(provider/google): add `gemini-embedding-2-preview` and fix multimodal embedding support with `embedMany`
- b04e23e: feat(provider/google): add support for the Gemini Interactions API
- 58a2ad7: fix: more precise default message for tool execution denial
- e59176c: chore(google): update v3 specs to v4
- ebbb0f2: fix(provider/google): fix lack of image consistency when using Interactions API in stateless mode
- aeda373: fix: only send provider credentials to same-origin response-supplied URLs

  Several provider clients followed a URL taken from the provider's API response (a polling/status URL or a final media URL such as `polling_url`, `urls.get`, `result_url`, `result.sample`, or `video.uri`) and reused the authenticated headers — or appended `?key=<API_KEY>` — on that request. Because the host of the response-supplied URL was never validated, the long-lived API key was sent to whatever host the response named (a CDN in the benign case, or an attacker-chosen host if the provider response was tampered with), allowing credential exfiltration.

  A new `isSameOrigin` helper is added to `@ai-sdk/provider-utils`, and the affected fetches in `@ai-sdk/black-forest-labs`, `@ai-sdk/fireworks`, `@ai-sdk/replicate`, `@ai-sdk/gladia`, `@ai-sdk/fal`, and `@ai-sdk/google` now attach credentials only when the followed URL is same-origin with the provider's configured API origin. Requests to a foreign origin are made without the credential.

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- 0c4c275: trigger initial canary release
- bdb9ea1: chore(google): remove now obsolete Interactions API `Api-Revision` header
- db394ab: feat(provider/google): support cancelling long-running Interactions API agents via AbortSignal, and process their intermittent stream
- ce769dd: feat(provider): add experimental Realtime API support for voice conversations

  Adds first-class support for realtime (speech-to-speech) APIs:

  - `Experimental_RealtimeModelV4` spec in `@ai-sdk/provider` with normalized event types and factory
  - OpenAI, Google, and xAI realtime provider implementations
  - `openai.experimental_realtime()` / `google.experimental_realtime()` / `xai.experimental_realtime()` work in both server and browser
  - `.getToken()` static method on each provider for server-side ephemeral token creation
  - `experimental_getRealtimeToolDefinitions` helper for provider session tool definitions
  - `experimental_useRealtime` hook in `@ai-sdk/react` returning `UIMessage[]` (aligned with `useChat`), with `onToolCall` and `addToolOutput` for client-driven tool execution
  - `inputAudioTranscription` session config for showing transcribed user audio messages when supported by the provider

- 5b7e7c2: fix(google-vertex): don't send streamFunctionCallArguments for unary API calls and change default to false
- 2edd14e: fix(provider/google): correctly mark reasoning files as such and fix related multi-turn errors
- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- 546cefe: feat(provider/google): add `gemini-3.5-flash`
- 5463d0d: feat(provider): align tool result output content file part types with top-level message file part types
- 55f0938: chore(provider/google): update available models
- b8396f0: trigger initial beta release
- 84f36e0: fix(google): omit passing includeServerSideToolInvocations for Vertex tool_config
- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling
- 4dac142: feat(google): add new finishMessage field in providerMetadata
- aeea161: feat(google): read `serviceTier` from `x-gemini-service-tier` response header in Gemini API and use PayGo for Vertex
- 18c1970: feat(provider/google): Add multimodal tool-result support for Google function responses.

  Tool results with `output.type = 'content'` now map media parts into
  `functionResponse.parts` for Google models, including `image-data`,
  `file-data`, and base64 `data:` URLs in URL-style content parts.
  Remote HTTP(S) URLs in URL-style tool-result parts are not supported.

- b3976a2: Add workflow serialization support to all provider models.

  **`@ai-sdk/provider-utils`:** New `serializeModel()` helper that extracts only serializable properties from a model instance, filtering out functions and objects containing functions. Third-party provider authors can use this to add workflow support to their own models.

  **All providers:** `headers` is now optional in provider config types. This is non-breaking — existing code that passes `headers` continues to work. Custom provider implementations that construct model configs manually can now omit `headers`, which is useful when models are deserialized from a workflow step boundary where auth is provided separately.

  All provider model classes now include `WORKFLOW_SERIALIZE` and `WORKFLOW_DESERIALIZE` static methods, enabling them to cross workflow step boundaries without serialization errors.

- ff5eba1: feat: roll `image-*` tool output types into their equivalent `file-*` types

## 4.0.0-beta.85

### Patch Changes

- Updated dependencies [0416e3e]
  - @ai-sdk/provider@4.0.0-beta.20
  - @ai-sdk/provider-utils@5.0.0-beta.50

## 4.0.0-beta.84

### Patch Changes

- 947cdab: Add Google realtime Live Translation provider options for `gemini-3.5-live-translate-preview`.

## 4.0.0-beta.83

### Patch Changes

- bdb9ea1: chore(google): remove now obsolete Interactions API `Api-Revision` header

## 4.0.0-beta.82

### Patch Changes

- b8396f0: trigger initial beta release
- Updated dependencies [b8396f0]
  - @ai-sdk/provider-utils@5.0.0-beta.49
  - @ai-sdk/provider@4.0.0-beta.19

## 4.0.0-canary.81

### Patch Changes

- 5878b40: fix(google): prevent prototype pollution when streaming tool args
- aeda373: fix: only send provider credentials to same-origin response-supplied URLs

  Several provider clients followed a URL taken from the provider's API response (a polling/status URL or a final media URL such as `polling_url`, `urls.get`, `result_url`, `result.sample`, or `video.uri`) and reused the authenticated headers — or appended `?key=<API_KEY>` — on that request. Because the host of the response-supplied URL was never validated, the long-lived API key was sent to whatever host the response named (a CDN in the benign case, or an attacker-chosen host if the provider response was tampered with), allowing credential exfiltration.

  A new `isSameOrigin` helper is added to `@ai-sdk/provider-utils`, and the affected fetches in `@ai-sdk/black-forest-labs`, `@ai-sdk/fireworks`, `@ai-sdk/replicate`, `@ai-sdk/gladia`, `@ai-sdk/fal`, and `@ai-sdk/google` now attach credentials only when the followed URL is same-origin with the provider's configured API origin. Requests to a foreign origin are made without the credential.

- Updated dependencies [aeda373]
- Updated dependencies [375fdd7]
- Updated dependencies [b4507d5]
  - @ai-sdk/provider-utils@5.0.0-canary.48

## 4.0.0-canary.80

### Patch Changes

- Updated dependencies [bae5e2b]
  - @ai-sdk/provider-utils@5.0.0-canary.47

## 4.0.0-canary.79

### Patch Changes

- ce769dd: feat(provider): add experimental Realtime API support for voice conversations

  Adds first-class support for realtime (speech-to-speech) APIs:

  - `Experimental_RealtimeModelV4` spec in `@ai-sdk/provider` with normalized event types and factory
  - OpenAI, Google, and xAI realtime provider implementations
  - `openai.experimental_realtime()` / `google.experimental_realtime()` / `xai.experimental_realtime()` work in both server and browser
  - `.getToken()` static method on each provider for server-side ephemeral token creation
  - `experimental_getRealtimeToolDefinitions` helper for provider session tool definitions
  - `experimental_useRealtime` hook in `@ai-sdk/react` returning `UIMessage[]` (aligned with `useChat`), with `onToolCall` and `addToolOutput` for client-driven tool execution
  - `inputAudioTranscription` session config for showing transcribed user audio messages when supported by the provider

- Updated dependencies [ce769dd]
  - @ai-sdk/provider@4.0.0-canary.18
  - @ai-sdk/provider-utils@5.0.0-canary.46

## 4.0.0-canary.78

### Patch Changes

- 2ce3c65: feat(provider/google-vertex): add Gemini text-to-speech (speech) model support

## 4.0.0-canary.77

### Patch Changes

- Updated dependencies [ee798eb]
- Updated dependencies [daf6637]
  - @ai-sdk/provider-utils@5.0.0-canary.45

## 4.0.0-canary.76

### Patch Changes

- b563707: feat(provider/google): add Gemini text-to-speech (speech) model support

## 4.0.0-canary.75

### Patch Changes

- 00a0f36: feat(google, google-vertex): added `gemini-embedding-2`, `deep-research-max-preview-04-2026` and `deep-research-preview-04-2026`

## 4.0.0-canary.74

### Patch Changes

- a8d70b6: fix(google): auto-inject `skip_thought_signature_validator` for Gemini 3 tool-call replays without a signature

## 4.0.0-canary.73

### Patch Changes

- Updated dependencies [6c93e36]
- Updated dependencies [f617ac2]
  - @ai-sdk/provider-utils@5.0.0-canary.44

## 4.0.0-canary.72

### Patch Changes

- b71c0d7: feat(provider/google): support Google search grounding when using `generateImage` with Gemini

## 4.0.0-canary.71

### Patch Changes

- 045d2e8: fix(google): read `serviceTier` from `usageMetadata.serviceTier` in both generate and stream paths

  The previous implementation read `serviceTier` from the `x-gemini-service-tier`
  response header, which is only populated on non-streaming responses. Gemini
  streaming includes the value in `usageMetadata.serviceTier` on every chunk, so
  `providerMetadata.google.serviceTier` was always `null` for streams. Read from
  `usageMetadata` for both paths instead.

## 4.0.0-canary.70

### Patch Changes

- aeea161: feat(google): read `serviceTier` from `x-gemini-service-tier` response header in Gemini API and use PayGo for Vertex

## 4.0.0-canary.69

### Patch Changes

- 7f04802: feat(provider/google): add support for managed agents in the Interactions API

## 4.0.0-canary.68

### Patch Changes

- a2609df: fix(google): fix streaming tool call args
- 546cefe: feat(provider/google): add `gemini-3.5-flash`

## 4.0.0-canary.67

### Patch Changes

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- Updated dependencies [7fc6bd6]
  - @ai-sdk/provider-utils@5.0.0-canary.43
  - @ai-sdk/provider@4.0.0-canary.17

## 4.0.0-canary.66

### Patch Changes

- Updated dependencies [a6617c5]
  - @ai-sdk/provider-utils@5.0.0-canary.42

## 4.0.0-canary.65

### Patch Changes

- 4e825f3: feat(google): update Interactions API implementation to cater for upstream breaking changes coming May 26

## 4.0.0-canary.64

### Patch Changes

- 41da50c: fix(provider/google): support `functionCall.id` when returned by Gemini API and provide matching `functionResponse.id`

## 4.0.0-canary.63

### Patch Changes

- Updated dependencies [28dfa06]
- Updated dependencies [e93fa91]
  - @ai-sdk/provider-utils@5.0.0-canary.41

## 4.0.0-canary.62

### Patch Changes

- Updated dependencies [a7de9c9]
  - @ai-sdk/provider-utils@5.0.0-canary.40

## 4.0.0-canary.61

### Patch Changes

- Updated dependencies [105f95b]
  - @ai-sdk/provider-utils@5.0.0-canary.39

## 4.0.0-canary.60

### Patch Changes

- 6a26901: feat(google): add `fileData` support to embedding model

## 4.0.0-canary.59

### Patch Changes

- db394ab: feat(provider/google): support cancelling long-running Interactions API agents via AbortSignal, and process their intermittent stream
- Updated dependencies [ca446f8]
  - @ai-sdk/provider-utils@5.0.0-canary.38

## 4.0.0-canary.58

### Patch Changes

- Updated dependencies [d848405]
  - @ai-sdk/provider-utils@5.0.0-canary.37

## 4.0.0-canary.57

### Patch Changes

- Updated dependencies [ca39020]
  - @ai-sdk/provider-utils@5.0.0-canary.36

## 4.0.0-canary.56

### Patch Changes

- Updated dependencies [f634bac]
  - @ai-sdk/provider-utils@5.0.0-canary.35

## 4.0.0-canary.55

### Patch Changes

- ebbb0f2: fix(provider/google): fix lack of image consistency when using Interactions API in stateless mode
- Updated dependencies [69254e0]
- Updated dependencies [3015fc3]
  - @ai-sdk/provider-utils@5.0.0-canary.34

## 4.0.0-canary.54

### Patch Changes

- b04e23e: feat(provider/google): add support for the Gemini Interactions API

## 4.0.0-canary.53

### Patch Changes

- Updated dependencies [2427d88]
  - @ai-sdk/provider-utils@5.0.0-canary.33

## 4.0.0-canary.52

### Patch Changes

- cfca634: fix(google): emit Vertex no-args streaming tool calls and preserve thoughtSignature

  Vertex emits a no-args function call as a single chunk shaped `{ functionCall: { name: 'X' } }` with no `args`, no `partialArgs`, and no `willContinue`. The streaming parser had no branch for this shape, so the call was dropped along with any `thoughtSignature` it carried. For Gemini 3 thinking models this caused the next multi-turn step to 400 with `missing thought_signature`. The unary (`doGenerate`) path had the same drop.

  Both paths now emit the call as a complete tool call with `'{}'` input and propagate `thoughtSignature` provider metadata.

  Fixes #14847.

## 4.0.0-canary.51

### Patch Changes

- 5463d0d: feat(provider): align tool result output content file part types with top-level message file part types
- Updated dependencies [5463d0d]
  - @ai-sdk/provider-utils@5.0.0-canary.32
  - @ai-sdk/provider@4.0.0-canary.16

## 4.0.0-canary.50

### Patch Changes

- 0c4c275: trigger initial canary release
- Updated dependencies [0c4c275]
  - @ai-sdk/provider-utils@5.0.0-canary.31
  - @ai-sdk/provider@4.0.0-canary.15

## 4.0.0-beta.49

### Major Changes

- 04e9009: chore: make provider implementations code patterns more consistent, including renaming certain exported symbols

  For all externally exported symbols that were renamed, the old names continue to work via deprecated aliases.

### Patch Changes

- Updated dependencies [08d2129]
  - @ai-sdk/provider-utils@5.0.0-beta.30

## 4.0.0-beta.48

### Patch Changes

- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- Updated dependencies [9bd6512]
- Updated dependencies [258c093]
- Updated dependencies [b6783da]
  - @ai-sdk/provider-utils@5.0.0-beta.29
  - @ai-sdk/provider@4.0.0-beta.14

## 4.0.0-beta.47

### Patch Changes

- 9f0e36c: trigger release for all packages after provenance setup
- Updated dependencies [9f0e36c]
  - @ai-sdk/provider@4.0.0-beta.13
  - @ai-sdk/provider-utils@5.0.0-beta.28

## 4.0.0-beta.46

### Patch Changes

- 58a2ad7: fix: more precise default message for tool execution denial
- 84f36e0: fix(google): omit passing includeServerSideToolInvocations for Vertex tool_config
- Updated dependencies [785fe16]
- Updated dependencies [67df0a0]
- Updated dependencies [befb78c]
- Updated dependencies [0458559]
- Updated dependencies [5852c0a]
- Updated dependencies [fc92055]
  - @ai-sdk/provider-utils@5.0.0-beta.27

## 4.0.0-beta.45

### Major Changes

- a3757d7: chore(provider/google): remove useless GenerativeAI affix from types and classes for consistency

### Patch Changes

- Updated dependencies [2e98477]
  - @ai-sdk/provider-utils@5.0.0-beta.26

## 4.0.0-beta.44

### Patch Changes

- Updated dependencies [eea8d98]
  - @ai-sdk/provider-utils@5.0.0-beta.25

## 4.0.0-beta.43

### Patch Changes

- Updated dependencies [f807e45]
  - @ai-sdk/provider-utils@5.0.0-beta.24

## 4.0.0-beta.42

### Patch Changes

- Updated dependencies [350ea38]
  - @ai-sdk/provider-utils@5.0.0-beta.23

## 4.0.0-beta.41

### Patch Changes

- Updated dependencies [083947b]
  - @ai-sdk/provider-utils@5.0.0-beta.22

## 4.0.0-beta.40

### Patch Changes

- 55f0938: chore(provider/google): update available models

## 4.0.0-beta.39

### Patch Changes

- Updated dependencies [add1126]
  - @ai-sdk/provider-utils@5.0.0-beta.21

## 4.0.0-beta.38

### Patch Changes

- b3976a2: Add workflow serialization support to all provider models.

  **`@ai-sdk/provider-utils`:** New `serializeModel()` helper that extracts only serializable properties from a model instance, filtering out functions and objects containing functions. Third-party provider authors can use this to add workflow support to their own models.

  **All providers:** `headers` is now optional in provider config types. This is non-breaking — existing code that passes `headers` continues to work. Custom provider implementations that construct model configs manually can now omit `headers`, which is useful when models are deserialized from a workflow step boundary where auth is provided separately.

  All provider model classes now include `WORKFLOW_SERIALIZE` and `WORKFLOW_DESERIALIZE` static methods, enabling them to cross workflow step boundaries without serialization errors.

- ff5eba1: feat: roll `image-*` tool output types into their equivalent `file-*` types
- Updated dependencies [b3976a2]
- Updated dependencies [ff5eba1]
  - @ai-sdk/provider-utils@5.0.0-beta.20
  - @ai-sdk/provider@4.0.0-beta.12

## 4.0.0-beta.37

### Major Changes

- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.

### Patch Changes

- Updated dependencies [ef992f8]
  - @ai-sdk/provider@4.0.0-beta.11
  - @ai-sdk/provider-utils@5.0.0-beta.19

## 4.0.0-beta.36

### Patch Changes

- 9a0a618: fix(google): fix `serviceTier` to be correctly formatted for Vertex API

## 4.0.0-beta.35

### Patch Changes

- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling
- Updated dependencies [90e2d8a]
  - @ai-sdk/provider-utils@5.0.0-beta.18

## 4.0.0-beta.34

### Patch Changes

- 5b7e7c2: fix(google-vertex): don't send streamFunctionCallArguments for unary API calls and change default to false

## 4.0.0-beta.33

### Patch Changes

- Updated dependencies [3ae1786]
  - @ai-sdk/provider-utils@5.0.0-beta.17

## 4.0.0-beta.32

### Patch Changes

- 5036db8: feat(google-vertex): add support for streaming tool arguments input

## 4.0.0-beta.31

### Patch Changes

- Updated dependencies [176466a]
  - @ai-sdk/provider@4.0.0-beta.10
  - @ai-sdk/provider-utils@5.0.0-beta.16

## 4.0.0-beta.30

### Patch Changes

- Updated dependencies [e311194]
  - @ai-sdk/provider@4.0.0-beta.9
  - @ai-sdk/provider-utils@5.0.0-beta.15

## 4.0.0-beta.29

### Patch Changes

- Updated dependencies [34bd95d]
- Updated dependencies [008271d]
  - @ai-sdk/provider@4.0.0-beta.8
  - @ai-sdk/provider-utils@5.0.0-beta.14

## 4.0.0-beta.28

### Patch Changes

- Updated dependencies [b0c2869]
- Updated dependencies [7e26e81]
  - @ai-sdk/provider-utils@5.0.0-beta.13

## 4.0.0-beta.27

### Patch Changes

- 46d1149: chore(provider-utils,google): fix grammar errors in error and warning messages
- Updated dependencies [46d1149]
  - @ai-sdk/provider-utils@5.0.0-beta.12

## 4.0.0-beta.26

### Patch Changes

- a05109d: feat(provider/google): preserve per-modality token details in usage data

## 4.0.0-beta.25

### Patch Changes

- Updated dependencies [6fd51c0]
  - @ai-sdk/provider-utils@5.0.0-beta.11
  - @ai-sdk/provider@4.0.0-beta.7

## 4.0.0-beta.24

### Patch Changes

- 55db546: fix(provider/google): fix Gemini service tier enum after upstream update

## 4.0.0-beta.23

### Patch Changes

- c29a26f: feat(provider): add support for provider references and uploading files as supported per provider
- Updated dependencies [c29a26f]
  - @ai-sdk/provider-utils@5.0.0-beta.10
  - @ai-sdk/provider@4.0.0-beta.6

## 4.0.0-beta.22

### Patch Changes

- 38fc777: Add AI Gateway hint to provider READMEs

## 4.0.0-beta.21

### Patch Changes

- Updated dependencies [2e17091]
  - @ai-sdk/provider-utils@5.0.0-beta.9

## 4.0.0-beta.20

### Patch Changes

- Updated dependencies [986c6fd]
- Updated dependencies [493295c]
  - @ai-sdk/provider-utils@5.0.0-beta.8

## 4.0.0-beta.19

### Patch Changes

- 01fa606: feat(provider/google): support combining built-in tools with function calling on Gemini 3

## 4.0.0-beta.18

### Patch Changes

- 9715ec7: feat(provider/google): add support for service tier parameter

## 4.0.0-beta.17

### Patch Changes

- Updated dependencies [1f509d4]
  - @ai-sdk/provider-utils@5.0.0-beta.7
  - @ai-sdk/provider@4.0.0-beta.5

## 4.0.0-beta.16

### Patch Changes

- 6190649: chore(provider/google): remove obsolete Google image model

## 4.0.0-beta.15

### Patch Changes

- 18c1970: feat(provider/google): Add multimodal tool-result support for Google function responses.

  Tool results with `output.type = 'content'` now map media parts into
  `functionResponse.parts` for Google models, including `image-data`,
  `file-data`, and base64 `data:` URLs in URL-style content parts.
  Remote HTTP(S) URLs in URL-style tool-result parts are not supported.

## 4.0.0-beta.14

### Patch Changes

- 3887c70: feat(provider): add new top-level reasoning parameter to spec and support it in `generateText` and `streamText`
- Updated dependencies [3887c70]
  - @ai-sdk/provider-utils@5.0.0-beta.6
  - @ai-sdk/provider@4.0.0-beta.4

## 4.0.0-beta.13

### Patch Changes

- Updated dependencies [776b617]
  - @ai-sdk/provider-utils@5.0.0-beta.5
  - @ai-sdk/provider@4.0.0-beta.3

## 4.0.0-beta.12

### Patch Changes

- Updated dependencies [61753c3]
  - @ai-sdk/provider-utils@5.0.0-beta.4

## 4.0.0-beta.11

### Patch Changes

- f7d4f01: feat(provider): add support for `reasoning-file` type for files that are part of reasoning
- Updated dependencies [f7d4f01]
  - @ai-sdk/provider-utils@5.0.0-beta.3
  - @ai-sdk/provider@4.0.0-beta.2

## 4.0.0-beta.10

### Patch Changes

- Updated dependencies [5c2a5a2]
  - @ai-sdk/provider@4.0.0-beta.1
  - @ai-sdk/provider-utils@5.0.0-beta.2

## 4.0.0-beta.9

### Patch Changes

- e59176c: chore(google): update v3 specs to v4

## 4.0.0-beta.8

### Patch Changes

- 4dac142: feat(google): add new finishMessage field in providerMetadata

## 4.0.0-beta.7

### Patch Changes

- 82288b0: feat(provider/google): add `gemini-embedding-2-preview` and fix multimodal embedding support with `embedMany`

## 4.0.0-beta.6

### Patch Changes

- add4326: fix(provider/google): correct JSDoc for multimodal embedding content option

## 4.0.0-beta.5

### Patch Changes

- ab43029: feat(provider/google): support multimodal content parts in embedding provider options

## 4.0.0-beta.4

### Patch Changes

- 2edd14e: fix(provider/google): correctly mark reasoning files as such and fix related multi-turn errors

## 4.0.0-beta.3

### Patch Changes

- Updated dependencies [531251e]
  - @ai-sdk/provider-utils@5.0.0-beta.1

## 4.0.0-beta.2

### Patch Changes

- c9c4661: fix(provider/google): preserve groundingMetadata and urlContextMetadata when they arrive in a stream chunk before the finishReason chunk

## 4.0.0-beta.1

### Patch Changes

- 19b95f9: fix(google): use VALIDATED function calling mode when any tool has strict:true

## 4.0.0-beta.0

### Major Changes

- 8359612: Start v7 pre-release

### Patch Changes

- Updated dependencies [8359612]
  - @ai-sdk/provider@4.0.0-beta.0
  - @ai-sdk/provider-utils@5.0.0-beta.0

## 3.0.43

### Patch Changes

- 7ba09a4: Fix gateway failover losing thoughtSignature when failing over from Vertex to Google AI Studio. The Google provider now falls back to checking the vertex namespace for thoughtSignature, matching the existing Vertex-to-Google fallback behavior.

## 3.0.42

### Patch Changes

- Updated dependencies [ad4cfc2]
  - @ai-sdk/provider-utils@4.0.19

## 3.0.41

### Patch Changes

- Updated dependencies [824b295]
  - @ai-sdk/provider-utils@4.0.18

## 3.0.40

### Patch Changes

- 89d8b45: fix(google): make urlMetadata optional in urlContextMetadata schema

## 3.0.39

### Patch Changes

- 2565e70: feat(google): add support for image search, replace obsolete google_search_retrieval implementation

## 3.0.38

### Patch Changes

- 2291047: fix(ai): fix missing support for image thought signatures (e.g. for Gemini image models)

## 3.0.37

### Patch Changes

- 10bec50: feat(provider/google): add `gemini-3.1-flash-lite-preview`

## 3.0.36

### Patch Changes

- Updated dependencies [08336f1]
  - @ai-sdk/provider-utils@4.0.17

## 3.0.35

### Patch Changes

- 64a8fae: chore: remove obsolete model IDs for Anthropic, Google, OpenAI, xAI

## 3.0.34

### Patch Changes

- Updated dependencies [58bc42d]
  - @ai-sdk/provider-utils@4.0.16

## 3.0.33

### Patch Changes

- 1ece97a: feat(provider/google): add support for new Google image model aspect ratios and sizes

## 3.0.32

### Patch Changes

- 45f0a7f: feat(provider/google): add support for gemini-3.1-flash-image-preview

## 3.0.31

### Patch Changes

- 2fa3ca8: Added missing model IDs to GoogleGenerativeAIModelId and GoogleGenerativeAIVideoModelId types for better autocomplete support.

## 3.0.30

### Patch Changes

- 765b013: feat(provider/google): add support for `gemini-3.1-pro-preview`

## 3.0.29

### Patch Changes

- Updated dependencies [4024a3a]
  - @ai-sdk/provider-utils@4.0.15

## 3.0.28

### Patch Changes

- 5a307f5: feat(provider/google-vertex): allow using Gemini image models with `generateImage`

## 3.0.27

### Patch Changes

- 051361b: fix(vertex): add fallback for providerOptions keyname

## 3.0.26

### Patch Changes

- 4c27179: feat(google): allow using Gemini image models with `generateImage`

## 3.0.25

### Patch Changes

- 99fbed8: feat: normalize provider specific model options type names and ensure they are exported

## 3.0.24

### Patch Changes

- 3b3e32f: fix(google): handle thoughtSignature on empty-text parts in doGenerate and doStream

## 3.0.23

### Patch Changes

- ba98c56: fix(google): make `codeExecutionResult.output` optional in response schema

  Gemini 3 Flash omits the `output` field in `codeExecutionResult` when code execution produces no text output (e.g., only saves files). The Zod response schema now accepts a missing `output` field and defaults it to an empty string.

## 3.0.22

### Patch Changes

- 7168375: feat (ai, provider): default global provider video model resolution
- Updated dependencies [7168375]
  - @ai-sdk/provider@3.0.8
  - @ai-sdk/provider-utils@4.0.14

## 3.0.21

### Patch Changes

- ae30443: fix(google): remove shut down `gemini-2.5-flash-image-preview`

## 3.0.20

### Patch Changes

- 53f6731: feat (ai, provider): experimental generate video support
- Updated dependencies [53f6731]
  - @ai-sdk/provider@3.0.7
  - @ai-sdk/provider-utils@4.0.13

## 3.0.19

### Patch Changes

- Updated dependencies [96936e5]
  - @ai-sdk/provider-utils@4.0.12

## 3.0.18

### Patch Changes

- Updated dependencies [2810850]
  - @ai-sdk/provider-utils@4.0.11
  - @ai-sdk/provider@3.0.6

## 3.0.17

### Patch Changes

- 1524271: chore: add skill information to README files

## 3.0.16

### Patch Changes

- 97b3ebb: fix (provider/google): make `segment` optional in `groundingSupports` schema

  The Google Generative AI API sometimes returns grounding supports without a `segment` field. This change makes the `segment` field optional to handle these responses correctly.

## 3.0.15

### Patch Changes

- 2c70b90: chore: update provider docs

## 3.0.14

### Patch Changes

- Updated dependencies [462ad00]
  - @ai-sdk/provider-utils@4.0.10

## 3.0.13

### Patch Changes

- 4de5a1d: chore: excluded tests from src folder in npm package
- Updated dependencies [4de5a1d]
  - @ai-sdk/provider@3.0.5
  - @ai-sdk/provider-utils@4.0.9

## 3.0.12

### Patch Changes

- 2b8369d: chore: add docs to package dist

## 3.0.11

### Patch Changes

- 8dc54db: chore: add src folders to package bundle

## 3.0.10

### Patch Changes

- Updated dependencies [5c090e7]
  - @ai-sdk/provider@3.0.4
  - @ai-sdk/provider-utils@4.0.8

## 3.0.9

### Patch Changes

- Updated dependencies [46f46e4]
  - @ai-sdk/provider-utils@4.0.7

## 3.0.8

### Patch Changes

- Updated dependencies [1b11dcb]
  - @ai-sdk/provider-utils@4.0.6
  - @ai-sdk/provider@3.0.3

## 3.0.7

### Patch Changes

- Updated dependencies [34d1c8a]
  - @ai-sdk/provider-utils@4.0.5

## 3.0.6

### Patch Changes

- 2043612: fix(google): parse structured output when using google provider tools

## 3.0.5

### Patch Changes

- 3be4d81: Add file support for Gemini 3 models

## 3.0.4

### Patch Changes

- Updated dependencies [d937c8f]
  - @ai-sdk/provider@3.0.2
  - @ai-sdk/provider-utils@4.0.4

## 3.0.3

### Patch Changes

- Updated dependencies [0b429d4]
  - @ai-sdk/provider-utils@4.0.3

## 3.0.2

### Patch Changes

- 863d34f: fix: trigger release to update `@latest`
- Updated dependencies [863d34f]
  - @ai-sdk/provider@3.0.1
  - @ai-sdk/provider-utils@4.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [29264a3]
  - @ai-sdk/provider-utils@4.0.1

## 3.0.0

### Major Changes

- dee8b05: ai SDK 6 beta

### Minor Changes

- 78928cb: release: start 5.1 beta

### Patch Changes

- 0c3b58b: fix(provider): add specificationVersion to ProviderV3
- 0adc679: feat(provider): shared spec v3
- 9be07c8: feat(google): `thinking_level` option for Gemini 3
- fd788ce: fix(provider/google): preserve nested empty object schemas and descriptions in tool parameters
- 8d9e8ad: chore(provider): remove generics from EmbeddingModelV3

  Before

  ```ts
  model.textEmbeddingModel("my-model-id");
  ```

  After

  ```ts
  model.embeddingModel("my-model-id");
  ```

- 2625a04: feat(openai); update spec for mcp approval
- 7728ac5: The mediaResolution option has been added and is now passed to the Google API.
- 9a728c8: support latest gemini model id
- 32a6c13: Add Google Maps grounding tool support for location-aware Gemini responses
- 95f65c2: chore: use import \* from zod/v4
- e300a3b: Fixed Zod validation error when using `google.tools.fileSearch()`. The Google File Search API returns `fileSearchStore` instead of `uri` in `retrievedContext`. Updated `extractSources()` function to handle both the old format (Google Search with `uri`) and new format (File Search with `fileSearchStore`), maintaining backward compatibility while preventing validation errors. Also fixed title handling to use `undefined` for URL sources and `'Unknown Document'` for document sources.
- 218bba1: fix(google): use dynamic providerOptionsName when retrieving thoughtSignature in convertToGoogleGenerativeAIMessages

  When using @ai-sdk/google-vertex provider with Gemini thinking models, multi-step tool calls would fail with "function call is missing a thought_signature" error. This was because thoughtSignature was stored under providerOptions.vertex but retrieved using hardcoded providerOptions.google. This fix passes providerOptionsName to convertToGoogleGenerativeAIMessages and uses it dynamically.

- 954c356: feat(openai): allow custom names for provider-defined tools
- 0b92881: Add Google Vertex RAG Engine grounding provider tool
- 544d4e8: chore(specification): rename v3 provider defined tool to provider tool
- 0c4822d: feat: `EmbeddingModelV3`
- f8c981f: Fix adding google search along with url context in vertex ai
- 6078060: fix(provider/google): remove includethoughts warning
- bb28cac: Change streamText loop to merge file part processing into main parts loop
- fff8d59: feat(provider/google): Add support for the imageSize provider option
- 1742445: Support for custom provider name in google and anthropic providers
- e8109d3: feat: tool execution approval
- ed329cb: feat: `Provider-V3`
- 3bd2689: feat: extended token usage
- 1cad0ab: feat: add provider version to user-agent header
- 9b17031: Improve error message when mixing function tools with provider-defined tools to clarify fallback behavior and list ignored function tools
- 8dac895: feat: `LanguageModelV3`
- ee50cc5: fix(provider/google): lazy schema loading

  import time improved by 12.5% (22.3ms ➡️ 19.5ms)

- 457318b: chore(provider,ai): switch to SharedV3Warning and unified warnings
- 0ad470b: feat(provider/google): add enterpriseWebSearch tool
- db913bd: fix(google): add thought signature to gemini 3 pro image parts
- 9061dc0: feat: image editing
- 8370068: fix(provider/google): preserve thoughtSignature through tool execution
- ee8cd23: fix(vertex): allow 'vertex' as a key for providerOptions
- 7dea60e: add promptFeedback outputs
- 366f50b: chore(provider): add deprecated textEmbeddingModel and textEmbedding aliases
- 8ee8edc: Prepare search tool for gemini-3-pro-preview
- 2825757: Add Google File search tool
- 4616b86: chore: update zod peer depenedency version
- 33d9327: add `gemini-3-pro-preview` and `gemini-3-pro-image-preview` model IDs
- 0cfae4c: feat(vertex): support 'trafficType' in provider usageMetadata
- 09ba2dd: Support `imageConfig.aspectRatio` configuration for Gemini models
- 32a8c82: feat: add gemini 3 pro
- 166b6d7: fix(provider/google): preserve nested empty object schemas in tool parameters to fix "property is not defined" validation errors when using required properties with empty object types
- 522f6b8: feat: `ImageModelV3`
- 599a97f: fix: update gemini 3 model id
- 49e2b6a: fix(google): return request as object
- 3794514: feat: flexible tool output content support
- cbf52cd: feat: expose raw finish reason
- 870297d: feat(google): gemini-3-flash
- 10c1322: fix: moved dependency `@ai-sdk/test-server` to devDependencies
- c8003fb: fix(@ai-sdk/google): Make title field optional in grounding metadata schema
- 4d2e88e: fix(google,google-vertex): update known model IDs
- e833473: chore (provider/google): Add preview modelIds for gemini 2.5 flash and lite
- Updated dependencies
  - @ai-sdk/provider@3.0.0
  - @ai-sdk/provider-utils@4.0.0

## 3.0.0-beta.90

### Patch Changes

- 218bba1: fix(google): use dynamic providerOptionsName when retrieving thoughtSignature in convertToGoogleGenerativeAIMessages

  When using @ai-sdk/google-vertex provider with Gemini thinking models, multi-step tool calls would fail with "function call is missing a thought_signature" error. This was because thoughtSignature was stored under providerOptions.vertex but retrieved using hardcoded providerOptions.google. This fix passes providerOptionsName to convertToGoogleGenerativeAIMessages and uses it dynamically.

## 3.0.0-beta.89

### Patch Changes

- Updated dependencies [475189e]
  - @ai-sdk/provider@3.0.0-beta.32
  - @ai-sdk/provider-utils@4.0.0-beta.59

## 3.0.0-beta.88

### Patch Changes

- 2625a04: feat(openai); update spec for mcp approval
- Updated dependencies [2625a04]
  - @ai-sdk/provider@3.0.0-beta.31
  - @ai-sdk/provider-utils@4.0.0-beta.58

## 3.0.0-beta.87

### Patch Changes

- cbf52cd: feat: expose raw finish reason
- Updated dependencies [cbf52cd]
  - @ai-sdk/provider@3.0.0-beta.30
  - @ai-sdk/provider-utils@4.0.0-beta.57

## 3.0.0-beta.86

### Patch Changes

- Updated dependencies [9549c9e]
  - @ai-sdk/provider@3.0.0-beta.29
  - @ai-sdk/provider-utils@4.0.0-beta.56

## 3.0.0-beta.85

### Patch Changes

- Updated dependencies [50b70d6]
  - @ai-sdk/provider-utils@4.0.0-beta.55

## 3.0.0-beta.84

### Patch Changes

- fd788ce: fix(provider/google): preserve nested empty object schemas and descriptions in tool parameters

## 3.0.0-beta.83

### Patch Changes

- 166b6d7: fix(provider/google): preserve nested empty object schemas in tool parameters to fix "property is not defined" validation errors when using required properties with empty object types

## 3.0.0-beta.82

### Patch Changes

- 9061dc0: feat: image editing
- Updated dependencies [9061dc0]
  - @ai-sdk/provider-utils@4.0.0-beta.54
  - @ai-sdk/provider@3.0.0-beta.28

## 3.0.0-beta.81

### Patch Changes

- 0ad470b: feat(provider/google): add enterpriseWebSearch tool

## 3.0.0-beta.80

### Patch Changes

- 870297d: feat(google): gemini-3-flash

## 3.0.0-beta.79

### Patch Changes

- 366f50b: chore(provider): add deprecated textEmbeddingModel and textEmbedding aliases
- Updated dependencies [366f50b]
  - @ai-sdk/provider@3.0.0-beta.27
  - @ai-sdk/provider-utils@4.0.0-beta.53

## 3.0.0-beta.78

### Patch Changes

- Updated dependencies [763d04a]
  - @ai-sdk/provider-utils@4.0.0-beta.52

## 3.0.0-beta.77

### Patch Changes

- 32a6c13: Add Google Maps grounding tool support for location-aware Gemini responses

## 3.0.0-beta.76

### Patch Changes

- Updated dependencies [c1efac4]
  - @ai-sdk/provider-utils@4.0.0-beta.51

## 3.0.0-beta.75

### Patch Changes

- Updated dependencies [32223c8]
  - @ai-sdk/provider-utils@4.0.0-beta.50

## 3.0.0-beta.74

### Patch Changes

- Updated dependencies [83e5744]
  - @ai-sdk/provider-utils@4.0.0-beta.49

## 3.0.0-beta.73

### Patch Changes

- Updated dependencies [960ec8f]
  - @ai-sdk/provider-utils@4.0.0-beta.48

## 3.0.0-beta.72

### Patch Changes

- ee8cd23: fix(vertex): allow 'vertex' as a key for providerOptions

## 3.0.0-beta.71

### Patch Changes

- 49e2b6a: fix(google): return request as object

## 3.0.0-beta.70

### Patch Changes

- Updated dependencies [e9e157f]
  - @ai-sdk/provider-utils@4.0.0-beta.47

## 3.0.0-beta.69

### Patch Changes

- Updated dependencies [81e29ab]
  - @ai-sdk/provider-utils@4.0.0-beta.46

## 3.0.0-beta.68

### Patch Changes

- 3bd2689: feat: extended token usage
- Updated dependencies [3bd2689]
  - @ai-sdk/provider@3.0.0-beta.26
  - @ai-sdk/provider-utils@4.0.0-beta.45

## 3.0.0-beta.67

### Patch Changes

- 4d2e88e: fix(google,google-vertex): update known model IDs

## 3.0.0-beta.66

### Patch Changes

- Updated dependencies [53f3368]
  - @ai-sdk/provider@3.0.0-beta.25
  - @ai-sdk/provider-utils@4.0.0-beta.44

## 3.0.0-beta.65

### Patch Changes

- Updated dependencies [dce03c4]
  - @ai-sdk/provider-utils@4.0.0-beta.43
  - @ai-sdk/provider@3.0.0-beta.24

## 3.0.0-beta.64

### Patch Changes

- Updated dependencies [3ed5519]
  - @ai-sdk/provider-utils@4.0.0-beta.42

## 3.0.0-beta.63

### Patch Changes

- Updated dependencies [1bd7d32]
  - @ai-sdk/provider-utils@4.0.0-beta.41
  - @ai-sdk/provider@3.0.0-beta.23

## 3.0.0-beta.62

### Patch Changes

- 544d4e8: chore(specification): rename v3 provider defined tool to provider tool
- Updated dependencies [544d4e8]
  - @ai-sdk/provider-utils@4.0.0-beta.40
  - @ai-sdk/provider@3.0.0-beta.22

## 3.0.0-beta.61

### Patch Changes

- 954c356: feat(openai): allow custom names for provider-defined tools
- Updated dependencies [954c356]
  - @ai-sdk/provider-utils@4.0.0-beta.39
  - @ai-sdk/provider@3.0.0-beta.21

## 3.0.0-beta.60

### Patch Changes

- Updated dependencies [03849b0]
  - @ai-sdk/provider-utils@4.0.0-beta.38

## 3.0.0-beta.59

### Patch Changes

- 457318b: chore(provider,ai): switch to SharedV3Warning and unified warnings
- Updated dependencies [457318b]
  - @ai-sdk/provider@3.0.0-beta.20
  - @ai-sdk/provider-utils@4.0.0-beta.37

## 3.0.0-beta.58

### Patch Changes

- 8d9e8ad: chore(provider): remove generics from EmbeddingModelV3

  Before

  ```ts
  model.textEmbeddingModel("my-model-id");
  ```

  After

  ```ts
  model.embeddingModel("my-model-id");
  ```

- Updated dependencies [8d9e8ad]
  - @ai-sdk/provider@3.0.0-beta.19
  - @ai-sdk/provider-utils@4.0.0-beta.36

## 3.0.0-beta.57

### Patch Changes

- Updated dependencies [10d819b]
  - @ai-sdk/provider@3.0.0-beta.18
  - @ai-sdk/provider-utils@4.0.0-beta.35

## 3.0.0-beta.56

### Patch Changes

- e300a3b: Fixed Zod validation error when using `google.tools.fileSearch()`. The Google File Search API returns `fileSearchStore` instead of `uri` in `retrievedContext`. Updated `extractSources()` function to handle both the old format (Google Search with `uri`) and new format (File Search with `fileSearchStore`), maintaining backward compatibility while preventing validation errors. Also fixed title handling to use `undefined` for URL sources and `'Unknown Document'` for document sources.

## 3.0.0-beta.55

### Patch Changes

- db913bd: fix(google): add thought signature to gemini 3 pro image parts
- Updated dependencies [db913bd]
  - @ai-sdk/provider@3.0.0-beta.17
  - @ai-sdk/provider-utils@4.0.0-beta.34

## 3.0.0-beta.54

### Patch Changes

- bb28cac: Change streamText loop to merge file part processing into main parts loop

## 3.0.0-beta.53

### Patch Changes

- 33d9327: add `gemini-3-pro-preview` and `gemini-3-pro-image-preview` model IDs

## 3.0.0-beta.52

### Patch Changes

- fff8d59: feat(provider/google): Add support for the imageSize provider option

## 3.0.0-beta.51

### Patch Changes

- 8370068: fix(provider/google): preserve thoughtSignature through tool execution

## 3.0.0-beta.50

### Patch Changes

- 9be07c8: feat(google): `thinking_level` option for Gemini 3

## 3.0.0-beta.49

### Patch Changes

- 8ee8edc: Prepare search tool for gemini-3-pro-preview

## 3.0.0-beta.48

### Patch Changes

- 6078060: fix(provider/google): remove includethoughts warning

## 3.0.0-beta.47

### Patch Changes

- 32a8c82: feat: add gemini 3 pro
- 599a97f: fix: update gemini 3 model id

## 3.0.0-beta.46

### Patch Changes

- 0b92881: Add Google Vertex RAG Engine grounding provider tool

## 3.0.0-beta.45

### Patch Changes

- 9b17031: Improve error message when mixing function tools with provider-defined tools to clarify fallback behavior and list ignored function tools

## 3.0.0-beta.44

### Patch Changes

- 0cfae4c: feat(vertex): support 'trafficType' in provider usageMetadata

## 3.0.0-beta.43

### Patch Changes

- Updated dependencies [b681d7d]
  - @ai-sdk/provider@3.0.0-beta.16
  - @ai-sdk/provider-utils@4.0.0-beta.33

## 3.0.0-beta.42

### Patch Changes

- Updated dependencies [32d8dbb]
  - @ai-sdk/provider-utils@4.0.0-beta.32

## 3.0.0-beta.41

### Patch Changes

- 1742445: Support for custom provider name in google and anthropic providers

## 3.0.0-beta.40

### Patch Changes

- 2825757: Add Google File search tool

## 3.0.0-beta.39

### Patch Changes

- Updated dependencies [bb36798]
  - @ai-sdk/provider@3.0.0-beta.15
  - @ai-sdk/provider-utils@4.0.0-beta.31

## 3.0.0-beta.38

### Patch Changes

- Updated dependencies [4f16c37]
  - @ai-sdk/provider-utils@4.0.0-beta.30

## 3.0.0-beta.37

### Patch Changes

- Updated dependencies [af3780b]
  - @ai-sdk/provider@3.0.0-beta.14
  - @ai-sdk/provider-utils@4.0.0-beta.29

## 3.0.0-beta.36

### Patch Changes

- c8003fb: fix(@ai-sdk/google): Make title field optional in grounding metadata schema

## 3.0.0-beta.35

### Patch Changes

- Updated dependencies [016b111]
  - @ai-sdk/provider-utils@4.0.0-beta.28

## 3.0.0-beta.34

### Patch Changes

- Updated dependencies [37c58a0]
  - @ai-sdk/provider@3.0.0-beta.13
  - @ai-sdk/provider-utils@4.0.0-beta.27

## 3.0.0-beta.33

### Patch Changes

- Updated dependencies [d1bdadb]
  - @ai-sdk/provider@3.0.0-beta.12
  - @ai-sdk/provider-utils@4.0.0-beta.26

## 3.0.0-beta.32

### Patch Changes

- Updated dependencies [4c44a5b]
  - @ai-sdk/provider@3.0.0-beta.11
  - @ai-sdk/provider-utils@4.0.0-beta.25

## 3.0.0-beta.31

### Patch Changes

- 0c3b58b: fix(provider): add specificationVersion to ProviderV3
- Updated dependencies [0c3b58b]
  - @ai-sdk/provider@3.0.0-beta.10
  - @ai-sdk/provider-utils@4.0.0-beta.24

## 3.0.0-beta.30

### Patch Changes

- Updated dependencies [a755db5]
  - @ai-sdk/provider@3.0.0-beta.9
  - @ai-sdk/provider-utils@4.0.0-beta.23

## 3.0.0-beta.29

### Patch Changes

- Updated dependencies [58920e0]
  - @ai-sdk/provider-utils@4.0.0-beta.22

## 3.0.0-beta.28

### Patch Changes

- Updated dependencies [293a6b7]
  - @ai-sdk/provider-utils@4.0.0-beta.21

## 3.0.0-beta.27

### Patch Changes

- Updated dependencies [fca786b]
  - @ai-sdk/provider-utils@4.0.0-beta.20

## 3.0.0-beta.26

### Patch Changes

- 3794514: feat: flexible tool output content support
- Updated dependencies [3794514]
  - @ai-sdk/provider-utils@4.0.0-beta.19
  - @ai-sdk/provider@3.0.0-beta.8

## 3.0.0-beta.25

### Patch Changes

- Updated dependencies [81d4308]
  - @ai-sdk/provider@3.0.0-beta.7
  - @ai-sdk/provider-utils@4.0.0-beta.18

## 3.0.0-beta.24

### Patch Changes

- Updated dependencies [703459a]
  - @ai-sdk/provider-utils@4.0.0-beta.17

## 3.0.0-beta.23

### Patch Changes

- f8c981f: Fix adding google search along with url context in vertex ai

## 3.0.0-beta.22

### Patch Changes

- 09ba2dd: Support `imageConfig.aspectRatio` configuration for Gemini models

## 3.0.0-beta.21

### Patch Changes

- Updated dependencies [6306603]
  - @ai-sdk/provider-utils@4.0.0-beta.16

## 3.0.0-beta.20

### Patch Changes

- Updated dependencies [f0b2157]
  - @ai-sdk/provider-utils@4.0.0-beta.15

## 3.0.0-beta.19

### Patch Changes

- Updated dependencies [3b1d015]
  - @ai-sdk/provider-utils@4.0.0-beta.14

## 3.0.0-beta.18

### Patch Changes

- Updated dependencies [d116b4b]
  - @ai-sdk/provider-utils@4.0.0-beta.13

## 3.0.0-beta.17

### Patch Changes

- Updated dependencies [7e32fea]
  - @ai-sdk/provider-utils@4.0.0-beta.12

## 3.0.0-beta.16

### Patch Changes

- ee50cc5: fix(provider/google): lazy schema loading

  import time improved by 12.5% (22.3ms ➡️ 19.5ms)

## 3.0.0-beta.15

### Patch Changes

- 95f65c2: chore: use import \* from zod/v4
- Updated dependencies
  - @ai-sdk/provider-utils@4.0.0-beta.11

## 3.0.0-beta.14

### Major Changes

- dee8b05: ai SDK 6 beta

### Patch Changes

- Updated dependencies [dee8b05]
  - @ai-sdk/provider@3.0.0-beta.6
  - @ai-sdk/provider-utils@4.0.0-beta.10

## 2.1.0-beta.13

### Patch Changes

- Updated dependencies [521c537]
  - @ai-sdk/provider-utils@3.1.0-beta.9

## 2.1.0-beta.12

### Patch Changes

- Updated dependencies [e06565c]
  - @ai-sdk/provider-utils@3.1.0-beta.8

## 2.1.0-beta.11

### Patch Changes

- 9a728c8: support latest gemini model id

## 2.1.0-beta.10

### Patch Changes

- e8109d3: feat: tool execution approval
- Updated dependencies
  - @ai-sdk/provider@2.1.0-beta.5
  - @ai-sdk/provider-utils@3.1.0-beta.7

## 2.1.0-beta.9

### Patch Changes

- 0adc679: feat(provider): shared spec v3
- Updated dependencies
  - @ai-sdk/provider-utils@3.1.0-beta.6
  - @ai-sdk/provider@2.1.0-beta.4

## 2.1.0-beta.8

### Patch Changes

- 7728ac5: The mediaResolution option has been added and is now passed to the Google API.

## 2.1.0-beta.7

### Patch Changes

- 8dac895: feat: `LanguageModelV3`
- 10c1322: fix: moved dependency `@ai-sdk/test-server` to devDependencies
- Updated dependencies [8dac895]
  - @ai-sdk/provider-utils@3.1.0-beta.5
  - @ai-sdk/provider@2.1.0-beta.3

## 2.1.0-beta.6

### Patch Changes

- e833473: chore (provider/google): Add preview modelIds for gemini 2.5 flash and lite

## 2.1.0-beta.5

### Patch Changes

- 4616b86: chore: update zod peer depenedency version
- Updated dependencies [4616b86]
  - @ai-sdk/provider-utils@3.1.0-beta.4

## 2.1.0-beta.4

### Patch Changes

- ed329cb: feat: `Provider-V3`
- 522f6b8: feat: `ImageModelV3`
- Updated dependencies
  - @ai-sdk/provider@2.1.0-beta.2
  - @ai-sdk/provider-utils@3.1.0-beta.3

## 2.1.0-beta.3

### Patch Changes

- 0c4822d: feat: `EmbeddingModelV3`
- 1cad0ab: feat: add provider version to user-agent header
- Updated dependencies [0c4822d]
  - @ai-sdk/provider@2.1.0-beta.1
  - @ai-sdk/provider-utils@3.1.0-beta.2

## 2.1.0-beta.2

### Patch Changes

- 7dea60e: add promptFeedback outputs

## 2.1.0-beta.1

### Patch Changes

- Updated dependencies
  - @ai-sdk/test-server@1.0.0-beta.0
  - @ai-sdk/provider-utils@3.1.0-beta.1

## 2.1.0-beta.0

### Minor Changes

- 78928cb: release: start 5.1 beta

### Patch Changes

- Updated dependencies [78928cb]
  - @ai-sdk/provider@2.1.0-beta.0
  - @ai-sdk/provider-utils@3.1.0-beta.0

## 2.0.14

### Patch Changes

- Updated dependencies [0294b58]
  - @ai-sdk/provider-utils@3.0.9

## 2.0.13

### Patch Changes

- 5a3ef3a: Fixed handling of image response in the tool call result.

## 2.0.12

### Patch Changes

- Updated dependencies [99964ed]
  - @ai-sdk/provider-utils@3.0.8

## 2.0.11

### Patch Changes

- a14fc2b: feat(provider/google): add gemini 2.5 flash image preview model support

## 2.0.10

### Patch Changes

- Updated dependencies [886e7cd]
  - @ai-sdk/provider-utils@3.0.7

## 2.0.9

### Patch Changes

- Updated dependencies [1b5a3d3]
  - @ai-sdk/provider-utils@3.0.6

## 2.0.8

### Patch Changes

- Updated dependencies [0857788]
  - @ai-sdk/provider-utils@3.0.5

## 2.0.7

### Patch Changes

- Updated dependencies [68751f9]
  - @ai-sdk/provider-utils@3.0.4

## 2.0.6

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@3.0.3

## 2.0.5

### Patch Changes

- Updated dependencies [38ac190]
  - @ai-sdk/provider-utils@3.0.2

## 2.0.4

### Patch Changes

- 961dda1: add labels field to providerOptions

## 2.0.3

### Patch Changes

- 9fb0252: fix(google): add thought signature support for reasoning

## 2.0.2

### Patch Changes

- Updated dependencies [90d212f]
  - @ai-sdk/provider-utils@3.0.1

## 2.0.1

### Patch Changes

- f5464aa: feat(google): update docs + add YouTube URL support to Google Generative AI provider

## 2.0.0

### Major Changes

- d5f588f: AI SDK 5

### Patch Changes

- 78e7fa9: Add code execution provider defined tool
- f916255: feat (provider/google): add new gemini models
- 19a4336: Expose raw usageMetadata returned from Google Generative AI in providerMetadata
- 8af9e03: Added Image Models to the Google Provider for Imagen 3 Support
- 1a635b5: update supportedUrls to only support native URL
- 888b750: feat(providers/google): Add taskType support for Text Embedding Models
- 3259565: feat (providers/google): add thinking config to provider options
- e2aceaf: feat: add raw chunk support
- eb173f1: chore (providers): remove model shorthand deprecation warnings
- 6a16dcf: embed() now uses the single embeddings endpoint
  No code updates are needed.

  This is to make sure that users are not ratelimited when using the batch endpoint, since many models have different limits for batch and single embeddings.

  Eg: Google has a limit of 150 RPM for batch requests, and 1500 RPM for single requests.

  Before, AI SDK would always use the batch endpoint, even for embed() calls, which led to ratelimits.

  This does not have any breaking functionality and is fully tested :)
  if (values.length > 1) {
  const batchResult = await this.doEmbedBatch({
  values,
  options,
  });
  return batchResult;
  }

- 26735b5: chore(embedding-model): add v2 interface
- 5cf30ea: fix (provider/google): allow "OFF" for Google HarmBlockThreshold
- 443d8ec: feat(embedding-model-v2): add response body field
- c68931f: Support tool schemas that allow additional properties (e.g `z.record(z.string())`)
- 66962ed: fix(packages): export node10 compatible types
- a313780: fix: omit system message for gemma models
- fd98925: chore(providers/google): update embedding model to use providerOptions
- cb787ac: fix: remove non-functional models
- 7378473: chore(providers/google): switch to providerOptions
- f07a6d4: fix(providers/google): accept nullish in safetyRatings
- 75f03b1: Add Gemini 2.5 Flash Lite GA
- 779d916: feat: add provider option schemas for vertex imagegen and google genai
- 581a9be: fix (provider/google): prevent error when thinking signature is used
- 2e06f14: feat (provider/google): Change to provider defined tools

  - Change the google search tool to be a provider defined tool
  - Added new URL context tool as a provider defined tool

- 8e6b69d: feat(providers/google): Add support for Gemini 2.5 Pro and Gemini 2.5 Flash (now stable)
- 42fcd32: feat(google): automatically handle system instructions for Gemma models
- d1a034f: feature: using Zod 4 for internal stuff
- fd65bc6: chore(embedding-model-v2): rename rawResponse to response
- 878bf45: removes (unsupported) `additionalProperties` from the Schema sent in the request payloads to Google APIs
- 0f05690: Add gemini-embedding-001 model, add embedding provider options type export
- 7badba2: fix(google): grounding streaming sources
- 205077b: fix: improve Zod compatibility
- f10304b: feat(tool-calling): don't require the user to have to pass parameters
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0
  - @ai-sdk/provider@2.0.0

## 2.0.0-beta.19

### Patch Changes

- Updated dependencies [88a8ee5]
  - @ai-sdk/provider-utils@3.0.0-beta.10

## 2.0.0-beta.18

### Patch Changes

- 78e7fa9: Add code execution provider defined tool
- 0f05690: Add gemini-embedding-001 model, add embedding provider options type export
- Updated dependencies [27deb4d]
  - @ai-sdk/provider@2.0.0-beta.2
  - @ai-sdk/provider-utils@3.0.0-beta.9

## 2.0.0-beta.17

### Patch Changes

- eb173f1: chore (providers): remove model shorthand deprecation warnings
- Updated dependencies [dd5fd43]
  - @ai-sdk/provider-utils@3.0.0-beta.8

## 2.0.0-beta.16

### Patch Changes

- Updated dependencies [e7fcc86]
  - @ai-sdk/provider-utils@3.0.0-beta.7

## 2.0.0-beta.15

### Patch Changes

- Updated dependencies [ac34802]
  - @ai-sdk/provider-utils@3.0.0-beta.6

## 2.0.0-beta.14

### Patch Changes

- 75f03b1: Add Gemini 2.5 Flash Lite GA

## 2.0.0-beta.13

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-beta.5

## 2.0.0-beta.12

### Patch Changes

- 205077b: fix: improve Zod compatibility
- Updated dependencies [205077b]
  - @ai-sdk/provider-utils@3.0.0-beta.4

## 2.0.0-beta.11

### Patch Changes

- 6a16dcf: embed() now uses the single embeddings endpoint
  No code updates are needed.

  This is to make sure that users are not ratelimited when using the batch endpoint, since many models have different limits for batch and single embeddings.

  Eg: Google has a limit of 150 RPM for batch requests, and 1500 RPM for single requests.

  Before, AI SDK would always use the batch endpoint, even for embed() calls, which led to ratelimits.

  This does not have any breaking functionality and is fully tested :)
  if (values.length > 1) {
  const batchResult = await this.doEmbedBatch({
  values,
  options,
  });
  return batchResult;
  }

## 2.0.0-beta.10

### Patch Changes

- 7badba2: fix(google): grounding streaming sources
- Updated dependencies [05d2819]
  - @ai-sdk/provider-utils@3.0.0-beta.3

## 2.0.0-beta.9

### Patch Changes

- 8af9e03: Added Image Models to the Google Provider for Imagen 3 Support

## 2.0.0-beta.8

### Patch Changes

- 2e06f14: feat (provider/google): Change to provider defined tools
  - Change the google search tool to be a provider defined tool
  - Added new URL context tool as a provider defined tool

## 2.0.0-beta.7

### Patch Changes

- 19a4336: Expose raw usageMetadata returned from Google Generative AI in providerMetadata

## 2.0.0-beta.6

### Patch Changes

- 878bf45: removes (unsupported) `additionalProperties` from the Schema sent in the request payloads to Google APIs

## 2.0.0-beta.5

### Patch Changes

- 42fcd32: feat(google): automatically handle system instructions for Gemma models

## 2.0.0-beta.4

### Patch Changes

- c68931f: Support tool schemas that allow additional properties (e.g `z.record(z.string())`)
- 8e6b69d: feat(providers/google): Add support for Gemini 2.5 Pro and Gemini 2.5 Flash (now stable)

## 2.0.0-beta.3

### Patch Changes

- cb787ac: fix: remove non-functional models
- d1a034f: feature: using Zod 4 for internal stuff
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-beta.2

## 2.0.0-beta.2

### Patch Changes

- a313780: fix: omit system message for gemma models

## 2.0.0-beta.1

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-beta.1
  - @ai-sdk/provider-utils@3.0.0-beta.1

## 2.0.0-alpha.15

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-alpha.15
  - @ai-sdk/provider-utils@3.0.0-alpha.15

## 2.0.0-alpha.14

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-alpha.14
  - @ai-sdk/provider-utils@3.0.0-alpha.14

## 2.0.0-alpha.13

### Patch Changes

- Updated dependencies [68ecf2f]
  - @ai-sdk/provider@2.0.0-alpha.13
  - @ai-sdk/provider-utils@3.0.0-alpha.13

## 2.0.0-alpha.12

### Patch Changes

- e2aceaf: feat: add raw chunk support
- Updated dependencies [e2aceaf]
  - @ai-sdk/provider@2.0.0-alpha.12
  - @ai-sdk/provider-utils@3.0.0-alpha.12

## 2.0.0-alpha.11

### Patch Changes

- Updated dependencies [c1e6647]
  - @ai-sdk/provider@2.0.0-alpha.11
  - @ai-sdk/provider-utils@3.0.0-alpha.11

## 2.0.0-alpha.10

### Patch Changes

- 581a9be: fix (provider/google): prevent error when thinking signature is used
- Updated dependencies [c4df419]
  - @ai-sdk/provider@2.0.0-alpha.10
  - @ai-sdk/provider-utils@3.0.0-alpha.10

## 2.0.0-alpha.9

### Patch Changes

- Updated dependencies [811dff3]
  - @ai-sdk/provider@2.0.0-alpha.9
  - @ai-sdk/provider-utils@3.0.0-alpha.9

## 2.0.0-alpha.8

### Patch Changes

- 1a635b5: update supportedUrls to only support native URL
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-alpha.8
  - @ai-sdk/provider@2.0.0-alpha.8

## 2.0.0-alpha.7

### Patch Changes

- Updated dependencies [5c56081]
  - @ai-sdk/provider@2.0.0-alpha.7
  - @ai-sdk/provider-utils@3.0.0-alpha.7

## 2.0.0-alpha.6

### Patch Changes

- Updated dependencies [0d2c085]
  - @ai-sdk/provider@2.0.0-alpha.6
  - @ai-sdk/provider-utils@3.0.0-alpha.6

## 2.0.0-alpha.4

### Patch Changes

- Updated dependencies [dc714f3]
  - @ai-sdk/provider@2.0.0-alpha.4
  - @ai-sdk/provider-utils@3.0.0-alpha.4

## 2.0.0-alpha.3

### Patch Changes

- Updated dependencies [6b98118]
  - @ai-sdk/provider@2.0.0-alpha.3
  - @ai-sdk/provider-utils@3.0.0-alpha.3

## 2.0.0-alpha.2

### Patch Changes

- Updated dependencies [26535e0]
  - @ai-sdk/provider@2.0.0-alpha.2
  - @ai-sdk/provider-utils@3.0.0-alpha.2

## 2.0.0-alpha.1

### Patch Changes

- Updated dependencies [3f2f00c]
  - @ai-sdk/provider@2.0.0-alpha.1
  - @ai-sdk/provider-utils@3.0.0-alpha.1

## 2.0.0-canary.20

### Patch Changes

- Updated dependencies [faf8446]
  - @ai-sdk/provider-utils@3.0.0-canary.19

## 2.0.0-canary.19

### Patch Changes

- Updated dependencies [40acf9b]
  - @ai-sdk/provider-utils@3.0.0-canary.18

## 2.0.0-canary.18

### Patch Changes

- f07a6d4: fix(providers/google): accept nullish in safetyRatings
- Updated dependencies [ea7a7c9]
  - @ai-sdk/provider-utils@3.0.0-canary.17

## 2.0.0-canary.17

### Patch Changes

- Updated dependencies [87b828f]
  - @ai-sdk/provider-utils@3.0.0-canary.16

## 2.0.0-canary.16

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.15
  - @ai-sdk/provider@2.0.0-canary.14

## 2.0.0-canary.15

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.14
  - @ai-sdk/provider@2.0.0-canary.13

## 2.0.0-canary.14

### Patch Changes

- f916255: feat (provider/google): add new gemini models
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.12
  - @ai-sdk/provider-utils@3.0.0-canary.13

## 2.0.0-canary.13

### Patch Changes

- 7378473: chore(providers/google): switch to providerOptions
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.11
  - @ai-sdk/provider-utils@3.0.0-canary.12

## 2.0.0-canary.12

### Patch Changes

- 888b750: feat(providers/google): Add taskType support for Text Embedding Models
- 66962ed: fix(packages): export node10 compatible types
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.11
  - @ai-sdk/provider@2.0.0-canary.10

## 2.0.0-canary.11

### Patch Changes

- Updated dependencies [e86be6f]
  - @ai-sdk/provider@2.0.0-canary.9
  - @ai-sdk/provider-utils@3.0.0-canary.10

## 2.0.0-canary.10

### Patch Changes

- 3259565: feat (providers/google): add thinking config to provider options
- fd98925: chore(providers/google): update embedding model to use providerOptions
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.8
  - @ai-sdk/provider-utils@3.0.0-canary.9

## 2.0.0-canary.9

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.8
  - @ai-sdk/provider@2.0.0-canary.7

## 2.0.0-canary.8

### Patch Changes

- 26735b5: chore(embedding-model): add v2 interface
- 443d8ec: feat(embedding-model-v2): add response body field
- fd65bc6: chore(embedding-model-v2): rename rawResponse to response
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.6
  - @ai-sdk/provider-utils@3.0.0-canary.7

## 2.0.0-canary.7

### Patch Changes

- f10304b: feat(tool-calling): don't require the user to have to pass parameters
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.5
  - @ai-sdk/provider-utils@3.0.0-canary.6

## 2.0.0-canary.6

### Patch Changes

- Updated dependencies [6f6bb89]
  - @ai-sdk/provider@2.0.0-canary.4
  - @ai-sdk/provider-utils@3.0.0-canary.5

## 2.0.0-canary.5

### Patch Changes

- Updated dependencies [d1a1aa1]
  - @ai-sdk/provider@2.0.0-canary.3
  - @ai-sdk/provider-utils@3.0.0-canary.4

## 2.0.0-canary.4

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.3
  - @ai-sdk/provider@2.0.0-canary.2

## 2.0.0-canary.3

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.1
  - @ai-sdk/provider-utils@3.0.0-canary.2

## 2.0.0-canary.2

### Patch Changes

- 5cf30ea: fix (provider/google): allow "OFF" for Google HarmBlockThreshold

## 2.0.0-canary.1

### Patch Changes

- 779d916: feat: add provider option schemas for vertex imagegen and google genai
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.1

## 2.0.0-canary.0

### Major Changes

- d5f588f: AI SDK 5

### Patch Changes

- Updated dependencies [d5f588f]
  - @ai-sdk/provider-utils@3.0.0-canary.0
  - @ai-sdk/provider@2.0.0-canary.0

## 1.2.5

### Patch Changes

- Updated dependencies [28be004]
  - @ai-sdk/provider-utils@2.2.3

## 1.2.4

### Patch Changes

- Updated dependencies [b01120e]
  - @ai-sdk/provider-utils@2.2.2

## 1.2.3

### Patch Changes

- 871df87: feat (provider/google): add gemini-2.5-pro-exp-03-25 to model list

## 1.2.2

### Patch Changes

- Updated dependencies [f10f0fa]
  - @ai-sdk/provider-utils@2.2.1

## 1.2.1

### Patch Changes

- 994a13b: feat (provider/google): support IMAGE_SAFETY finish reason

## 1.2.0

### Minor Changes

- 5bc638d: AI SDK 4.2

### Patch Changes

- Updated dependencies [5bc638d]
  - @ai-sdk/provider@1.1.0
  - @ai-sdk/provider-utils@2.2.0

## 1.1.27

### Patch Changes

- d0c4659: feat (provider-utils): parseProviderOptions function
- Updated dependencies [d0c4659]
  - @ai-sdk/provider-utils@2.1.15

## 1.1.26

### Patch Changes

- 0bd5bc6: feat (ai): support model-generated files
- Updated dependencies [0bd5bc6]
  - @ai-sdk/provider@1.0.12
  - @ai-sdk/provider-utils@2.1.14

## 1.1.25

### Patch Changes

- Updated dependencies [2e1101a]
  - @ai-sdk/provider@1.0.11
  - @ai-sdk/provider-utils@2.1.13

## 1.1.24

### Patch Changes

- 5261762: fix (provider/google): ensure correct finishReason for tool calls in streaming response

## 1.1.23

### Patch Changes

- 413f5a7: feat (providers/google): add gemma 3 model id

## 1.1.22

### Patch Changes

- 62f46fd: feat (provider/google): add support for dynamic retrieval

## 1.1.21

### Patch Changes

- Updated dependencies [1531959]
  - @ai-sdk/provider-utils@2.1.12

## 1.1.20

### Patch Changes

- e1d3d42: feat (ai): expose raw response body in generateText and generateObject
- Updated dependencies [e1d3d42]
  - @ai-sdk/provider@1.0.10
  - @ai-sdk/provider-utils@2.1.11

## 1.1.19

### Patch Changes

- 2c27583: fix (provider/google): support empty content in malformed function call responses

## 1.1.18

### Patch Changes

- 5c8f512: feat (provider/google): add seed support

## 1.1.17

### Patch Changes

- Updated dependencies [ddf9740]
  - @ai-sdk/provider@1.0.9
  - @ai-sdk/provider-utils@2.1.10

## 1.1.16

### Patch Changes

- 1b2e2a0: fix (provider/google): add resilience against undefined parts

## 1.1.15

### Patch Changes

- Updated dependencies [2761f06]
  - @ai-sdk/provider@1.0.8
  - @ai-sdk/provider-utils@2.1.9

## 1.1.14

### Patch Changes

- 08a3641: fix (provider/google): support nullable enums in schema

## 1.1.13

### Patch Changes

- Updated dependencies [2e898b4]
  - @ai-sdk/provider-utils@2.1.8

## 1.1.12

### Patch Changes

- Updated dependencies [3ff4ef8]
  - @ai-sdk/provider-utils@2.1.7

## 1.1.11

### Patch Changes

- 6eb7fc4: feat (ai/core): url source support

## 1.1.10

### Patch Changes

- e5567f7: feat (provider/google): update model ids

## 1.1.9

### Patch Changes

- b2573de: fix (provider/google): remove reasoning text following removal from Gemini API

## 1.1.8

### Patch Changes

- Updated dependencies [d89c3b9]
  - @ai-sdk/provider@1.0.7
  - @ai-sdk/provider-utils@2.1.6

## 1.1.7

### Patch Changes

- d399f25: feat (provider/google-vertex): support public file urls in messages

## 1.1.6

### Patch Changes

- e012cd8: feat (provider/google): add reasoning support

## 1.1.5

### Patch Changes

- Updated dependencies [3a602ca]
  - @ai-sdk/provider-utils@2.1.5

## 1.1.4

### Patch Changes

- Updated dependencies [066206e]
  - @ai-sdk/provider-utils@2.1.4

## 1.1.3

### Patch Changes

- Updated dependencies [39e5c1f]
  - @ai-sdk/provider-utils@2.1.3

## 1.1.2

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@2.1.2
  - @ai-sdk/provider@1.0.6

## 1.1.1

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@2.1.1
  - @ai-sdk/provider@1.0.5

## 1.1.0

### Minor Changes

- 62ba5ad: release: AI SDK 4.1

### Patch Changes

- Updated dependencies [62ba5ad]
  - @ai-sdk/provider-utils@2.1.0

## 1.0.17

### Patch Changes

- Updated dependencies [00114c5]
  - @ai-sdk/provider-utils@2.0.8

## 1.0.16

### Patch Changes

- 4eb9b41: fix (provider/google): support conversion of string enums to openapi spec

## 1.0.15

### Patch Changes

- 7611964: feat (provider/xai): Support structured output for latest models.

## 1.0.14

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@2.0.7

## 1.0.13

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@1.0.4
  - @ai-sdk/provider-utils@2.0.6

## 1.0.12

### Patch Changes

- 5ed5e45: chore (config): Use ts-library.json tsconfig for no-UI libs.
- Updated dependencies [5ed5e45]
  - @ai-sdk/provider-utils@2.0.5
  - @ai-sdk/provider@1.0.3

## 1.0.11

### Patch Changes

- db31e74: feat: adding audioTimestamp support to GoogleGenerativeAISettings

## 1.0.10

### Patch Changes

- e07439a: feat (provider/google): Include safety ratings response detail.
- 4017b0f: feat (provider/google-vertex): Enhance grounding metadata response detail.
- a9df182: feat (provider/google): Add support for search grounding.

## 1.0.9

### Patch Changes

- c0b1c7e: feat (provider/google): Add Gemini 2.0 model.

## 1.0.8

### Patch Changes

- b7372dc: feat (provider/google): Include optional response grounding metadata.

## 1.0.7

### Patch Changes

- Updated dependencies [09a9cab]
  - @ai-sdk/provider@1.0.2
  - @ai-sdk/provider-utils@2.0.4

## 1.0.6

### Patch Changes

- 9e54403: fix (provider/google-vertex): support empty object as usage metadata

## 1.0.5

### Patch Changes

- 0984f0b: feat (provider/google-vertex): Rewrite for Edge runtime support.
- Updated dependencies [0984f0b]
  - @ai-sdk/provider-utils@2.0.3

## 1.0.4

### Patch Changes

- 6373c60: fix (provider/google): send json schema into provider

## 1.0.3

### Patch Changes

- Updated dependencies [b446ae5]
  - @ai-sdk/provider@1.0.1
  - @ai-sdk/provider-utils@2.0.2

## 1.0.2

### Patch Changes

- b748dfb: feat (providers): update model lists

## 1.0.1

### Patch Changes

- Updated dependencies [c3ab5de]
  - @ai-sdk/provider-utils@2.0.1

## 1.0.0

### Major Changes

- 66060f7: chore (release): bump major version to 4.0
- 0d3d3f5: chore (providers): remove baseUrl option
- 36b03b0: chore (provider/google): remove topK model setting
- 277fc6b: chore (provider/google): remove facade

### Patch Changes

- c38a0db: fix (provider/google): allow empty candidates array when streaming
- 0509c34: fix (provider/google): add name/content details to tool responses
- Updated dependencies
  - @ai-sdk/provider-utils@2.0.0
  - @ai-sdk/provider@1.0.0

## 1.0.0-canary.6

### Patch Changes

- c38a0db: fix (provider/google): allow empty candidates array when streaming

## 1.0.0-canary.5

### Patch Changes

- 0509c34: fix (provider/google): add name/content details to tool responses

## 1.0.0-canary.4

### Major Changes

- 36b03b0: chore (provider/google): remove topK model setting
- 277fc6b: chore (provider/google): remove facade

## 1.0.0-canary.3

### Patch Changes

- Updated dependencies [8426f55]
  - @ai-sdk/provider-utils@2.0.0-canary.3

## 1.0.0-canary.2

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@2.0.0-canary.2

## 1.0.0-canary.1

### Major Changes

- 0d3d3f5: chore (providers): remove baseUrl option

### Patch Changes

- Updated dependencies [b1da952]
  - @ai-sdk/provider-utils@2.0.0-canary.1

## 1.0.0-canary.0

### Major Changes

- 66060f7: chore (release): bump major version to 4.0

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@2.0.0-canary.0
  - @ai-sdk/provider@1.0.0-canary.0

## 0.0.55

### Patch Changes

- 11beb9d: fix (provider/google): support tool calls without parameters

## 0.0.54

### Patch Changes

- 1486128: feat: add supportsUrl to language model specification
- 1486128: feat (provider/google): support native file URLs without download
- 3b1b69a: feat: provider-defined tools
- Updated dependencies
  - @ai-sdk/provider-utils@1.0.22
  - @ai-sdk/provider@0.0.26

## 0.0.53

### Patch Changes

- b9b0d7b: feat (ai): access raw request body
- Updated dependencies [b9b0d7b]
  - @ai-sdk/provider@0.0.25
  - @ai-sdk/provider-utils@1.0.21

## 0.0.52

### Patch Changes

- 7944e61: feat (provider/google): enable frequencyPenalty and presencePenalty settings

## 0.0.51

### Patch Changes

- d595d0d: feat (ai/core): file content parts
- Updated dependencies [d595d0d]
  - @ai-sdk/provider@0.0.24
  - @ai-sdk/provider-utils@1.0.20

## 0.0.50

### Patch Changes

- 5d113fb: feat (provider/google): support fine-tuned models

## 0.0.49

### Patch Changes

- 2e32bd0: fix (provider/google): deal with empty candidatesTokenCount
- 2e32bd0: feat (provider/google): add new models

## 0.0.48

### Patch Changes

- Updated dependencies [273f696]
  - @ai-sdk/provider-utils@1.0.19

## 0.0.47

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@1.0.18
  - @ai-sdk/provider@0.0.23

## 0.0.46

### Patch Changes

- 26515cb: feat (ai/provider): introduce ProviderV1 specification
- Updated dependencies [26515cb]
  - @ai-sdk/provider@0.0.22
  - @ai-sdk/provider-utils@1.0.17

## 0.0.45

### Patch Changes

- Updated dependencies [09f895f]
  - @ai-sdk/provider-utils@1.0.16

## 0.0.44

### Patch Changes

- cb94042: fix (provider/google): allow disabling structured generation

## 0.0.43

### Patch Changes

- Updated dependencies [d67fa9c]
  - @ai-sdk/provider-utils@1.0.15

## 0.0.42

### Patch Changes

- 9c1f4f2: chore (provider/google): remove "models/" from model name

## 0.0.41

### Patch Changes

- 5da9c7f: feat (provider/google): embedding support

## 0.0.40

### Patch Changes

- Updated dependencies [f2c025e]
  - @ai-sdk/provider@0.0.21
  - @ai-sdk/provider-utils@1.0.14

## 0.0.39

### Patch Changes

- Updated dependencies [6ac355e]
  - @ai-sdk/provider@0.0.20
  - @ai-sdk/provider-utils@1.0.13

## 0.0.38

### Patch Changes

- 123134b: fix (provider/google): change default object generation mode to json
- dd712ac: fix: use FetchFunction type to prevent self-reference
- Updated dependencies [dd712ac]
  - @ai-sdk/provider-utils@1.0.12

## 0.0.37

### Patch Changes

- 89b18ca: fix (ai/provider): send finish reason 'unknown' by default
- Updated dependencies [dd4a0f5]
  - @ai-sdk/provider@0.0.19
  - @ai-sdk/provider-utils@1.0.11

## 0.0.36

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@1.0.10
  - @ai-sdk/provider@0.0.18

## 0.0.35

### Patch Changes

- 1e94ed8: feat (provider/google): send json schema in object-json mode

## 0.0.34

### Patch Changes

- Updated dependencies [029af4c]
  - @ai-sdk/provider@0.0.17
  - @ai-sdk/provider-utils@1.0.9

## 0.0.33

### Patch Changes

- Updated dependencies [d58517b]
  - @ai-sdk/provider@0.0.16
  - @ai-sdk/provider-utils@1.0.8

## 0.0.32

### Patch Changes

- Updated dependencies [96aed25]
  - @ai-sdk/provider@0.0.15
  - @ai-sdk/provider-utils@1.0.7

## 0.0.31

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@1.0.6

## 0.0.30

### Patch Changes

- a8d1c9e9: feat (ai/core): parallel image download
- Updated dependencies [a8d1c9e9]
  - @ai-sdk/provider-utils@1.0.5
  - @ai-sdk/provider@0.0.14

## 0.0.29

### Patch Changes

- Updated dependencies [4f88248f]
  - @ai-sdk/provider-utils@1.0.4

## 0.0.28

### Patch Changes

- 2b9da0f0: feat (core): support stopSequences setting.
- a5b58845: feat (core): support topK setting
- 4aa8deb3: feat (provider): support responseFormat setting in provider api
- 13b27ec6: chore (ai/core): remove grammar mode
- Updated dependencies
  - @ai-sdk/provider@0.0.13
  - @ai-sdk/provider-utils@1.0.3

## 0.0.27

### Patch Changes

- 2e59d266: feat (provider/google): add cachedContent optional setting
- d2b9723d: feat (provider/google): support system instructions
- 4dfe0b00: feat (provider/google): add tool support for object generation (new default mode)

## 0.0.26

### Patch Changes

- Updated dependencies [b7290943]
  - @ai-sdk/provider@0.0.12
  - @ai-sdk/provider-utils@1.0.2

## 0.0.25

### Patch Changes

- Updated dependencies [d481729f]
  - @ai-sdk/provider-utils@1.0.1

## 0.0.24

### Patch Changes

- 5edc6110: feat (ai/core): add custom request header support
- Updated dependencies
  - @ai-sdk/provider@0.0.11
  - @ai-sdk/provider-utils@1.0.0

## 0.0.23

### Patch Changes

- Updated dependencies [02f6a088]
  - @ai-sdk/provider-utils@0.0.16

## 0.0.22

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@0.0.15

## 0.0.21

### Patch Changes

- 4728c37f: feat (core): add text embedding model support to provider registry
- 7910ae84: feat (providers): support custom fetch implementations
- Updated dependencies [7910ae84]
  - @ai-sdk/provider-utils@0.0.14

## 0.0.20

### Patch Changes

- Updated dependencies [102ca22f]
  - @ai-sdk/provider@0.0.10
  - @ai-sdk/provider-utils@0.0.13

## 0.0.19

### Patch Changes

- 09295e2e: feat (@ai-sdk/google): automatically download image URLs
- Updated dependencies
  - @ai-sdk/provider@0.0.9
  - @ai-sdk/provider-utils@0.0.12

## 0.0.18

### Patch Changes

- 8022d73e: feat (provider/google): add safety setting option on models

## 0.0.17

### Patch Changes

- f39c0dd2: feat (provider): implement toolChoice support
- Updated dependencies [f39c0dd2]
  - @ai-sdk/provider@0.0.8
  - @ai-sdk/provider-utils@0.0.11

## 0.0.16

### Patch Changes

- 24683b72: fix (providers): Zod is required dependency
- Updated dependencies [8e780288]
  - @ai-sdk/provider@0.0.7
  - @ai-sdk/provider-utils@0.0.10

## 0.0.15

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@0.0.6
  - @ai-sdk/provider-utils@0.0.9

## 0.0.14

### Patch Changes

- df47a34: feat (provider/google): add models/gemini-1.5-flash-latest to list of supported models

## 0.0.13

### Patch Changes

- 9a7ec8b: feat (provider/google): add token usage information

## 0.0.12

### Patch Changes

- Updated dependencies [0f6bc4e]
  - @ai-sdk/provider@0.0.5
  - @ai-sdk/provider-utils@0.0.8

## 0.0.11

### Patch Changes

- Updated dependencies [325ca55]
  - @ai-sdk/provider@0.0.4
  - @ai-sdk/provider-utils@0.0.7

## 0.0.10

### Patch Changes

- 20aa9dd: feat (provider/gemini): Add JSON mode for generateObject
- Updated dependencies [276f22b]
  - @ai-sdk/provider-utils@0.0.6

## 0.0.9

### Patch Changes

- Updated dependencies [41d5736]
  - @ai-sdk/provider@0.0.3
  - @ai-sdk/provider-utils@0.0.5

## 0.0.8

### Patch Changes

- Updated dependencies [56ef84a]
  - @ai-sdk/provider-utils@0.0.4

## 0.0.7

### Patch Changes

- 25f3350: ai/core: add support for getting raw response headers.
- Updated dependencies
  - @ai-sdk/provider@0.0.2
  - @ai-sdk/provider-utils@0.0.3

## 0.0.6

### Patch Changes

- Updated dependencies [eb150a6]
  - @ai-sdk/provider-utils@0.0.2
  - @ai-sdk/provider@0.0.1

## 0.0.5

### Patch Changes

- c6fc35b: Add custom header support.

## 0.0.4

### Patch Changes

- ab60b18: Simplified model construction by directly calling provider functions. Add create... functions to create provider instances.

## 0.0.3

### Patch Changes

- 587240b: Standardize providers to offer .chat() method

## 0.0.2

### Patch Changes

- 2bff460: Fix build for release.

## 0.0.1

### Patch Changes

- 7b8791d: Rename baseUrl to baseURL. Automatically remove trailing slashes.
- Updated dependencies [7b8791d]
  - @ai-sdk/provider-utils@0.0.1
