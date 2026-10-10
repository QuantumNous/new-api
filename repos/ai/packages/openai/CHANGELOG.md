# @ai-sdk/openai

## 4.0.16

### Patch Changes

- 75f86f4: fix(provider/openai, provider/open-responses): throw a descriptive error when the Responses API returns a 200 with no `output`

  A successful (200) Responses body missing the `output` array previously threw an opaque `output is not iterable` TypeError from `doGenerate`. Both providers now surface a clear `APICallError` ("Responses API returned no output …"), including the incomplete-details reason (and status, for open-responses) when present. When the body includes a `response.error`, its message is surfaced first so upstream error details aren't masked by the generic fallback. This makes malformed/incomplete upstream responses actionable instead of a cryptic crash.

- Updated dependencies [cd06458]
  - @ai-sdk/provider-utils@5.0.11

## 4.0.15

### Patch Changes

- 0063c2d: Add the client-executed OpenAI Responses API computer tool with batched actions and screenshot outputs.

## 4.0.14

### Patch Changes

- Updated dependencies [31c7be8]
  - @ai-sdk/provider-utils@5.0.10

## 4.0.13

### Patch Changes

- 7805e4a: Fix realtime transcription auth header handling: per-call `authorization` headers now override configuration headers regardless of header-key casing (last case-variant wins), and the `Bearer` scheme is matched case-insensitively.
- cd12954: Reject empty OpenAI, Anthropic, and Replicate base URLs with a helpful AI SDK
  invalid argument error.
- Updated dependencies [4be62c1]
- Updated dependencies [7805e4a]
- Updated dependencies [cd12954]
  - @ai-sdk/provider-utils@5.0.9

## 4.0.12

### Patch Changes

- e193290: Add `connectToWebSocket` to `@ai-sdk/provider-utils`: a shared WebSocket connect layer (constructor resolution, header hygiene, abort wiring, message decoding) analogous to `postToApi` for HTTP. The openai and xai streaming transcription models now use it instead of hand-rolled connects. For openai and xai this also means WebSocket constructor failures now surface as stream errors instead of throwing synchronously from `doStream`, an already-aborted signal no longer constructs a socket, and the caller's audio stream is cancelled on pre-open failures. Messages are processed in order with close handling deferred behind pending frames, audio send loops apply backpressure via the socket's bufferedAmount, and failed sends cancel the caller's audio stream.
- e193290: Fix streaming transcription over header-capable WebSocket implementations: the realtime WebSocket handshake sent the api key in both the `openai-insecure-api-key` subprotocol and the `Authorization` header, which OpenAI rejects ("You must only send one of protocol api key and Authorization header"). The Authorization header is now stripped when the subprotocol carries the key.
- e193290: Strip undefined header values before the streaming transcription WebSocket constructor (header-capable implementations like `ws` throw on undefined values).
- Updated dependencies [e193290]
  - @ai-sdk/provider-utils@5.0.8

## 4.0.11

### Patch Changes

- b2b1bb9: feat(provider/openai): add GPT-5.6 reasoning and prompt cache controls

## 4.0.10

### Patch Changes

- fdb6d5d: feat(provider/openai,provider/gateway): add gpt-5.6 model ids
- Updated dependencies [0f93c57]
  - @ai-sdk/provider@4.0.3
  - @ai-sdk/provider-utils@5.0.7

## 4.0.9

### Patch Changes

- ac306ed: Fix `StreamingToolCallTracker` finalizing streaming tool calls on parsable partial JSON. Tool calls now only finalize during stream flush, restoring the behavior of #13137: a parsable argument buffer can still be the prefix of a longer argument string, so finalizing early could act on truncated tool inputs.
- Updated dependencies [ac306ed]
  - @ai-sdk/provider-utils@5.0.6

## 4.0.8

### Patch Changes

- b51ed36: Send inline image file parts in OpenAI chat requests as data URLs instead of bare base64 strings.

## 4.0.7

### Patch Changes

- 5c5c0f5: Add experimental streaming transcription support for transcription models, including OpenAI `gpt-realtime-whisper` and xAI WebSocket STT.
- Updated dependencies [5c5c0f5]
  - @ai-sdk/provider@4.0.2
  - @ai-sdk/provider-utils@5.0.5

## 4.0.6

### Patch Changes

- Updated dependencies [c6f5e62]
  - @ai-sdk/provider-utils@5.0.4

## 4.0.5

### Patch Changes

- Updated dependencies [8c616f0]
  - @ai-sdk/provider-utils@5.0.3

## 4.0.4

### Patch Changes

- Updated dependencies [0274f34]
  - @ai-sdk/provider@4.0.1
  - @ai-sdk/provider-utils@5.0.2

## 4.0.3

### Patch Changes

- 1ead90c: Return a helpful error when the Responses stream parser receives Chat Completions chunks.

## 4.0.2

### Patch Changes

- Updated dependencies [6a436e3]
  - @ai-sdk/provider-utils@5.0.1

## 4.0.1

### Patch Changes

- 9507724: feat(openai): add support for web_search_call.results include option

## 4.0.0

### Major Changes

- 34bd95d: feat(ai): add support for uploading provider skills using the provider references abstraction
- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.
- c29a26f: feat(provider): add support for provider references and uploading files as supported per provider
- 3887c70: feat(provider): add new top-level reasoning parameter to spec and support it in `generateText` and `streamText`
- 61753c3: ### `@ai-sdk/openai`: remove redundant `name` argument from `openai.tools.customTool()`

  `openai.tools.customTool()` no longer accepts a `name` field. the tool name is now derived from the sdk tool key (the object key in the `tools` object).

  migration: remove the `name` property from `customTool()` calls. the object key is now used as the tool name sent to the openai api.

  before:

  ```ts
  tools: {
    write_sql: openai.tools.customTool({
      name: 'write_sql',
      description: '...',
    }),
  }
  ```

  after:

  ```ts
  tools: {
    write_sql: openai.tools.customTool({
      description: '...',
    }),
  }
  ```

  ### `@ai-sdk/provider-utils`: `createToolNameMapping()` no longer accepts the `resolveProviderToolName` parameter

  before: tool name can be set dynamically

  ```ts
  const toolNameMapping = createToolNameMapping({
    tools,
    providerToolNames: {
      "openai.code_interpreter": "code_interpreter",
      "openai.file_search": "file_search",
      "openai.image_generation": "image_generation",
      "openai.local_shell": "local_shell",
      "openai.shell": "shell",
      "openai.web_search": "web_search",
      "openai.web_search_preview": "web_search_preview",
      "openai.mcp": "mcp",
      "openai.apply_patch": "apply_patch",
    },
    resolveProviderToolName: (tool) =>
      tool.id === "openai.custom"
        ? (tool.args as { name?: string }).name
        : undefined,
  });
  ```

  after: tool name is static based on `tools` keys

  ```
  const toolNameMapping = createToolNameMapping({
    tools,
    providerToolNames: {
      'openai.code_interpreter': 'code_interpreter',
      'openai.file_search': 'file_search',
      'openai.image_generation': 'image_generation',
      'openai.local_shell': 'local_shell',
      'openai.shell': 'shell',
      'openai.web_search': 'web_search',
      'openai.web_search_preview': 'web_search_preview',
      'openai.mcp': 'mcp',
      'openai.apply_patch': 'apply_patch',
    }
  });
  ```

- 8359612: Start v7 pre-release
- 04e9009: chore: make provider implementations code patterns more consistent, including renaming certain exported symbols

  For all externally exported symbols that were renamed, the old names continue to work via deprecated aliases.

### Patch Changes

- 29e6ac6: feat: add allowedTools provider option for OpenAI Responses
- 38fc777: Add AI Gateway hint to provider READMEs
- a71d345: fix(provider/openai): drop reasoning parts without encrypted content when store: false
- 7afaece: feat(provider/openai): add GPT-5.4 model support
- 365da1a: Add `gpt-5.4-mini`, `gpt-5.4-mini-2026-03-17`, `gpt-5.4-nano`, and `gpt-5.4-nano-2026-03-17` models.
- 1772a63: Default OpenAI Responses reasoning summaries to detailed when reasoning effort is enabled.
- 83f9d04: feat(openai): upgrade v3 specs to v4
- 45b3d76: fix(security): prevent streaming tool calls from finalizing on parsable partial JSON

  Streaming tool call arguments were finalized using `isParsableJson()` as a heuristic for completion. If partial accumulated JSON happened to be valid JSON before all chunks arrived, the tool call would be executed with incomplete arguments. Tool call finalization now only occurs in `flush()` after the stream is fully consumed.

- bf837fe: feat(provider/gateway): add speech and transcription model support
- d6c79e3: feat(openai): add GPT-5.5 chat model IDs
- e776fc7: feat(provider/azure):web search tool in the Azure OpenAI Responses API.
- 817a1a6: fix(openai): support file-url parts in tool output content
- 1f509d4: fix(ai): force template check on 'kind' param
- 0c4ac8a: fix(openai): default undefined tool-call input to empty object before serializing tool arguments
- 9f0e36c: trigger release for all packages after provenance setup
- 58a2ad7: fix: more precise default message for tool execution denial
- 6a5800e: feat(openai): add namespaces for tool definitions
- ae7f932: fix(openai): throw retryable errors for OpenAI stream failures before output starts
- 2c4767d: feat(openai): add orchestration token usage details to Responses API usage
- bada0f3: feat(openai): preserve `namespace` on function_call output items
- cd3de8b: feat(openai): forward `web_search_call.action.queries` from Responses API
- 94eba1b: fix(openai): round-trip `namespace` on function_call input items

  When `tool_search` dispatches a deferred tool, the resulting `function_call` carries a `namespace` field identifying which deferred-tool group the model picked. `#14789` preserved this on the read side (`providerMetadata.openai.namespace`), but the write side still serialized `function_call` input items without `namespace`. Multi-step / multi-turn conversations then failed with `Missing namespace for function_call '<name>'. ... Round-trip the model's function_call item with its namespace field included.`

  `convert-to-openai-responses-input.ts` now reads `namespace` from `providerOptions.openai.namespace` (or `providerMetadata.openai.namespace`) on `tool-call` parts and includes it on the serialized `function_call` item, mirroring how `itemId` is round-tripped.

- 7bbc194: feat(provider/openai): forward imageDetail providerOptions on tool-result image content
- 156cdf0: feat(openai): add new tool search tool
- f7295cb: revert incorrect fix https://github.com/vercel/ai/pull/13172
- 9ea40e0: chore(provider/openai): add type for image model options for type-safe processing
- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- f807e45: Extract shared `StreamingToolCallTracker` class into `@ai-sdk/provider-utils` to deduplicate streaming tool call handling across OpenAI-compatible providers. Also adds missing `generateId()` fallback for `toolCallId` in Alibaba's `doGenerate` path and ensures all providers finalize unfinished tool calls during stream flush.
- d9a1e9a: feat(openai): add server side compaction for openai
- 0c4c275: trigger initial canary release
- ac18f89: feat(provider/openai): add `gpt-5.3-chat-latest`
- 6fd51c0: fix(provider): preserve error type prefix in getErrorMessage
- cd9c311: fix(openai, openai-compatible): only send null content for assistant messages with tool calls
- e6376c2: fix(openai): preserve raw finish reason for failed responses stream events

  Handle `response.failed` chunks in Responses API streaming so `finishReason.raw` is preserved from `incomplete_details.reason` (e.g. `max_output_tokens`), and map failed-without-reason cases to unified `error` instead of `other`.

- ce769dd: feat(provider): add experimental Realtime API support for voice conversations

  Adds first-class support for realtime (speech-to-speech) APIs:

  - `Experimental_RealtimeModelV4` spec in `@ai-sdk/provider` with normalized event types and factory
  - OpenAI, Google, and xAI realtime provider implementations
  - `openai.experimental_realtime()` / `google.experimental_realtime()` / `xai.experimental_realtime()` work in both server and browser
  - `.getToken()` static method on each provider for server-side ephemeral token creation
  - `experimental_getRealtimeToolDefinitions` helper for provider session tool definitions
  - `experimental_useRealtime` hook in `@ai-sdk/react` returning `UIMessage[]` (aligned with `useChat`), with `onToolCall` and `addToolOutput` for client-driven tool execution
  - `inputAudioTranscription` session config for showing transcribed user audio messages when supported by the provider

- e311194: feat(ai): allow passing provider instance to `uploadFile` and `uploadSkill` as shorthand
- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- 685cec7: feat(openai): add opt-in pass-through for unsupported file media types
- 61bcdb5: fix(provider/openai): send client-executed tool calls as full function_call items in the Responses API so they pair with their function_call_output by call_id
- 5463d0d: feat(provider): align tool result output content file part types with top-level message file part types
- b8396f0: trigger initial beta release
- bfb756d: patch - send content: null instead of empty string for tool-only assistant messages
- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling
- 17b5597: fix(openai): skip passing reasoning items when using previous response id
- b3976a2: Add workflow serialization support to all provider models.

  **`@ai-sdk/provider-utils`:** New `serializeModel()` helper that extracts only serializable properties from a model instance, filtering out functions and objects containing functions. Third-party provider authors can use this to add workflow support to their own models.

  **All providers:** `headers` is now optional in provider config types. This is non-breaking — existing code that passes `headers` continues to work. Custom provider implementations that construct model configs manually can now omit `headers`, which is useful when models are deserialized from a workflow step boundary where auth is provided separately.

  All provider model classes now include `WORKFLOW_SERIALIZE` and `WORKFLOW_DESERIALIZE` static methods, enabling them to cross workflow step boundaries without serialization errors.

- ff5eba1: feat: roll `image-*` tool output types into their equivalent `file-*` types
- f9acbc0: feat(provider/openai): add gpt-image-2 model support

## 4.0.0-beta.77

### Patch Changes

- Updated dependencies [0416e3e]
  - @ai-sdk/provider@4.0.0-beta.20
  - @ai-sdk/provider-utils@5.0.0-beta.50

## 4.0.0-beta.76

### Patch Changes

- 2c4767d: feat(openai): add orchestration token usage details to Responses API usage

## 4.0.0-beta.75

### Patch Changes

- 1772a63: Default OpenAI Responses reasoning summaries to detailed when reasoning effort is enabled.

## 4.0.0-beta.74

### Patch Changes

- b8396f0: trigger initial beta release
- Updated dependencies [b8396f0]
  - @ai-sdk/provider-utils@5.0.0-beta.49
  - @ai-sdk/provider@4.0.0-beta.19

## 4.0.0-canary.73

### Patch Changes

- Updated dependencies [aeda373]
- Updated dependencies [375fdd7]
- Updated dependencies [b4507d5]
  - @ai-sdk/provider-utils@5.0.0-canary.48

## 4.0.0-canary.72

### Patch Changes

- Updated dependencies [bae5e2b]
  - @ai-sdk/provider-utils@5.0.0-canary.47

## 4.0.0-canary.71

### Patch Changes

- ae7f932: fix(openai): throw retryable errors for OpenAI stream failures before output starts

## 4.0.0-canary.70

### Patch Changes

- 6a5800e: feat(openai): add namespaces for tool definitions

## 4.0.0-canary.69

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

## 4.0.0-canary.68

### Patch Changes

- 94eba1b: fix(openai): round-trip `namespace` on function_call input items

  When `tool_search` dispatches a deferred tool, the resulting `function_call` carries a `namespace` field identifying which deferred-tool group the model picked. `#14789` preserved this on the read side (`providerMetadata.openai.namespace`), but the write side still serialized `function_call` input items without `namespace`. Multi-step / multi-turn conversations then failed with `Missing namespace for function_call '<name>'. ... Round-trip the model's function_call item with its namespace field included.`

  `convert-to-openai-responses-input.ts` now reads `namespace` from `providerOptions.openai.namespace` (or `providerMetadata.openai.namespace`) on `tool-call` parts and includes it on the serialized `function_call` item, mirroring how `itemId` is round-tripped.

## 4.0.0-canary.67

### Patch Changes

- 61bcdb5: fix(provider/openai): send client-executed tool calls as full function_call items in the Responses API so they pair with their function_call_output by call_id
- Updated dependencies [ee798eb]
- Updated dependencies [daf6637]
  - @ai-sdk/provider-utils@5.0.0-canary.45

## 4.0.0-canary.66

### Patch Changes

- e776fc7: feat(provider/azure):web search tool in the Azure OpenAI Responses API.

## 4.0.0-canary.65

### Patch Changes

- cd3de8b: feat(openai): forward `web_search_call.action.queries` from Responses API

## 4.0.0-canary.64

### Patch Changes

- Updated dependencies [6c93e36]
- Updated dependencies [f617ac2]
  - @ai-sdk/provider-utils@5.0.0-canary.44

## 4.0.0-canary.63

### Patch Changes

- 17b5597: fix(openai): skip passing reasoning items when using previous response id

## 4.0.0-canary.62

### Patch Changes

- bf837fe: feat(provider/gateway): add speech and transcription model support

## 4.0.0-canary.61

### Patch Changes

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- Updated dependencies [7fc6bd6]
  - @ai-sdk/provider-utils@5.0.0-canary.43
  - @ai-sdk/provider@4.0.0-canary.17

## 4.0.0-canary.60

### Patch Changes

- Updated dependencies [a6617c5]
  - @ai-sdk/provider-utils@5.0.0-canary.42

## 4.0.0-canary.59

### Patch Changes

- 685cec7: feat(openai): add opt-in pass-through for unsupported file media types

## 4.0.0-canary.58

### Patch Changes

- Updated dependencies [28dfa06]
- Updated dependencies [e93fa91]
  - @ai-sdk/provider-utils@5.0.0-canary.41

## 4.0.0-canary.57

### Patch Changes

- Updated dependencies [a7de9c9]
  - @ai-sdk/provider-utils@5.0.0-canary.40

## 4.0.0-canary.56

### Patch Changes

- Updated dependencies [105f95b]
  - @ai-sdk/provider-utils@5.0.0-canary.39

## 4.0.0-canary.55

### Patch Changes

- Updated dependencies [ca446f8]
  - @ai-sdk/provider-utils@5.0.0-canary.38

## 4.0.0-canary.54

### Patch Changes

- Updated dependencies [d848405]
  - @ai-sdk/provider-utils@5.0.0-canary.37

## 4.0.0-canary.53

### Patch Changes

- Updated dependencies [ca39020]
  - @ai-sdk/provider-utils@5.0.0-canary.36

## 4.0.0-canary.52

### Patch Changes

- Updated dependencies [f634bac]
  - @ai-sdk/provider-utils@5.0.0-canary.35

## 4.0.0-canary.51

### Patch Changes

- Updated dependencies [69254e0]
- Updated dependencies [3015fc3]
  - @ai-sdk/provider-utils@5.0.0-canary.34

## 4.0.0-canary.50

### Patch Changes

- 29e6ac6: feat: add allowedTools provider option for OpenAI Responses

## 4.0.0-canary.49

### Patch Changes

- 7bbc194: feat(provider/openai): forward imageDetail providerOptions on tool-result image content
- Updated dependencies [2427d88]
  - @ai-sdk/provider-utils@5.0.0-canary.33

## 4.0.0-canary.48

### Patch Changes

- d6c79e3: feat(openai): add GPT-5.5 chat model IDs

## 4.0.0-canary.47

### Patch Changes

- 5463d0d: feat(provider): align tool result output content file part types with top-level message file part types
- Updated dependencies [5463d0d]
  - @ai-sdk/provider-utils@5.0.0-canary.32
  - @ai-sdk/provider@4.0.0-canary.16

## 4.0.0-canary.46

### Patch Changes

- cd9c311: fix(openai, openai-compatible): only send null content for assistant messages with tool calls

## 4.0.0-canary.45

### Patch Changes

- 0c4c275: trigger initial canary release
- Updated dependencies [0c4c275]
  - @ai-sdk/provider-utils@5.0.0-canary.31
  - @ai-sdk/provider@4.0.0-canary.15

## 4.0.0-beta.44

### Patch Changes

- bada0f3: feat(openai): preserve `namespace` on function_call output items

## 4.0.0-beta.43

### Patch Changes

- 9ea40e0: chore(provider/openai): add type for image model options for type-safe processing

## 4.0.0-beta.42

### Major Changes

- 04e9009: chore: make provider implementations code patterns more consistent, including renaming certain exported symbols

  For all externally exported symbols that were renamed, the old names continue to work via deprecated aliases.

### Patch Changes

- Updated dependencies [08d2129]
  - @ai-sdk/provider-utils@5.0.0-beta.30

## 4.0.0-beta.41

### Patch Changes

- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- Updated dependencies [9bd6512]
- Updated dependencies [258c093]
- Updated dependencies [b6783da]
  - @ai-sdk/provider-utils@5.0.0-beta.29
  - @ai-sdk/provider@4.0.0-beta.14

## 4.0.0-beta.40

### Patch Changes

- 9f0e36c: trigger release for all packages after provenance setup
- Updated dependencies [9f0e36c]
  - @ai-sdk/provider@4.0.0-beta.13
  - @ai-sdk/provider-utils@5.0.0-beta.28

## 4.0.0-beta.39

### Patch Changes

- 58a2ad7: fix: more precise default message for tool execution denial
- f9acbc0: feat(provider/openai): add gpt-image-2 model support
- Updated dependencies [785fe16]
- Updated dependencies [67df0a0]
- Updated dependencies [befb78c]
- Updated dependencies [0458559]
- Updated dependencies [5852c0a]
- Updated dependencies [fc92055]
  - @ai-sdk/provider-utils@5.0.0-beta.27

## 4.0.0-beta.38

### Patch Changes

- bfb756d: patch - send content: null instead of empty string for tool-only assistant messages
- Updated dependencies [2e98477]
  - @ai-sdk/provider-utils@5.0.0-beta.26

## 4.0.0-beta.37

### Patch Changes

- Updated dependencies [eea8d98]
  - @ai-sdk/provider-utils@5.0.0-beta.25

## 4.0.0-beta.36

### Patch Changes

- f807e45: Extract shared `StreamingToolCallTracker` class into `@ai-sdk/provider-utils` to deduplicate streaming tool call handling across OpenAI-compatible providers. Also adds missing `generateId()` fallback for `toolCallId` in Alibaba's `doGenerate` path and ensures all providers finalize unfinished tool calls during stream flush.
- Updated dependencies [f807e45]
  - @ai-sdk/provider-utils@5.0.0-beta.24

## 4.0.0-beta.35

### Patch Changes

- Updated dependencies [350ea38]
  - @ai-sdk/provider-utils@5.0.0-beta.23

## 4.0.0-beta.34

### Patch Changes

- Updated dependencies [083947b]
  - @ai-sdk/provider-utils@5.0.0-beta.22

## 4.0.0-beta.33

### Patch Changes

- Updated dependencies [add1126]
  - @ai-sdk/provider-utils@5.0.0-beta.21

## 4.0.0-beta.32

### Patch Changes

- 0c4ac8a: fix(openai): default undefined tool-call input to empty object before serializing tool arguments

## 4.0.0-beta.31

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

## 4.0.0-beta.30

### Major Changes

- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.

### Patch Changes

- Updated dependencies [ef992f8]
  - @ai-sdk/provider@4.0.0-beta.11
  - @ai-sdk/provider-utils@5.0.0-beta.19

## 4.0.0-beta.29

### Patch Changes

- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling
- Updated dependencies [90e2d8a]
  - @ai-sdk/provider-utils@5.0.0-beta.18

## 4.0.0-beta.28

### Patch Changes

- Updated dependencies [3ae1786]
  - @ai-sdk/provider-utils@5.0.0-beta.17

## 4.0.0-beta.27

### Patch Changes

- Updated dependencies [176466a]
  - @ai-sdk/provider@4.0.0-beta.10
  - @ai-sdk/provider-utils@5.0.0-beta.16

## 4.0.0-beta.26

### Patch Changes

- e311194: feat(ai): allow passing provider instance to `uploadFile` and `uploadSkill` as shorthand
- Updated dependencies [e311194]
  - @ai-sdk/provider@4.0.0-beta.9
  - @ai-sdk/provider-utils@5.0.0-beta.15

## 4.0.0-beta.25

### Patch Changes

- 34bd95d: feat(ai): add support for uploading provider skills using the provider references abstraction
- Updated dependencies [34bd95d]
- Updated dependencies [008271d]
  - @ai-sdk/provider@4.0.0-beta.8
  - @ai-sdk/provider-utils@5.0.0-beta.14

## 4.0.0-beta.24

### Patch Changes

- Updated dependencies [b0c2869]
- Updated dependencies [7e26e81]
  - @ai-sdk/provider-utils@5.0.0-beta.13

## 4.0.0-beta.23

### Patch Changes

- Updated dependencies [46d1149]
  - @ai-sdk/provider-utils@5.0.0-beta.12

## 4.0.0-beta.22

### Patch Changes

- 6fd51c0: fix(provider): preserve error type prefix in getErrorMessage
- Updated dependencies [6fd51c0]
  - @ai-sdk/provider-utils@5.0.0-beta.11
  - @ai-sdk/provider@4.0.0-beta.7

## 4.0.0-beta.21

### Patch Changes

- c29a26f: feat(provider): add support for provider references and uploading files as supported per provider
- Updated dependencies [c29a26f]
  - @ai-sdk/provider-utils@5.0.0-beta.10
  - @ai-sdk/provider@4.0.0-beta.6

## 4.0.0-beta.20

### Patch Changes

- 38fc777: Add AI Gateway hint to provider READMEs

## 4.0.0-beta.19

### Patch Changes

- Updated dependencies [2e17091]
  - @ai-sdk/provider-utils@5.0.0-beta.9

## 4.0.0-beta.18

### Patch Changes

- Updated dependencies [986c6fd]
- Updated dependencies [493295c]
  - @ai-sdk/provider-utils@5.0.0-beta.8

## 4.0.0-beta.17

### Patch Changes

- 817a1a6: fix(openai): support file-url parts in tool output content

## 4.0.0-beta.16

### Patch Changes

- 1f509d4: fix(ai): force template check on 'kind' param
- Updated dependencies [1f509d4]
  - @ai-sdk/provider-utils@5.0.0-beta.7
  - @ai-sdk/provider@4.0.0-beta.5

## 4.0.0-beta.15

### Patch Changes

- 365da1a: Add `gpt-5.4-mini`, `gpt-5.4-mini-2026-03-17`, `gpt-5.4-nano`, and `gpt-5.4-nano-2026-03-17` models.

## 4.0.0-beta.14

### Patch Changes

- e6376c2: fix(openai): preserve raw finish reason for failed responses stream events

  Handle `response.failed` chunks in Responses API streaming so `finishReason.raw` is preserved from `incomplete_details.reason` (e.g. `max_output_tokens`), and map failed-without-reason cases to unified `error` instead of `other`.

## 4.0.0-beta.13

### Patch Changes

- 3887c70: feat(provider): add new top-level reasoning parameter to spec and support it in `generateText` and `streamText`
- Updated dependencies [3887c70]
  - @ai-sdk/provider-utils@5.0.0-beta.6
  - @ai-sdk/provider@4.0.0-beta.4

## 4.0.0-beta.12

### Patch Changes

- d9a1e9a: feat(openai): add server side compaction for openai

## 4.0.0-beta.11

### Patch Changes

- Updated dependencies [776b617]
  - @ai-sdk/provider-utils@5.0.0-beta.5
  - @ai-sdk/provider@4.0.0-beta.3

## 4.0.0-beta.10

### Major Changes

- 61753c3: ### `@ai-sdk/openai`: remove redundant `name` argument from `openai.tools.customTool()`

  `openai.tools.customTool()` no longer accepts a `name` field. the tool name is now derived from the sdk tool key (the object key in the `tools` object).

  migration: remove the `name` property from `customTool()` calls. the object key is now used as the tool name sent to the openai api.

  before:

  ```ts
  tools: {
    write_sql: openai.tools.customTool({
      name: 'write_sql',
      description: '...',
    }),
  }
  ```

  after:

  ```ts
  tools: {
    write_sql: openai.tools.customTool({
      description: '...',
    }),
  }
  ```

  ### `@ai-sdk/provider-utils`: `createToolNameMapping()` no longer accepts the `resolveProviderToolName` parameter

  before: tool name can be set dynamically

  ```ts
  const toolNameMapping = createToolNameMapping({
    tools,
    providerToolNames: {
      "openai.code_interpreter": "code_interpreter",
      "openai.file_search": "file_search",
      "openai.image_generation": "image_generation",
      "openai.local_shell": "local_shell",
      "openai.shell": "shell",
      "openai.web_search": "web_search",
      "openai.web_search_preview": "web_search_preview",
      "openai.mcp": "mcp",
      "openai.apply_patch": "apply_patch",
    },
    resolveProviderToolName: (tool) =>
      tool.id === "openai.custom"
        ? (tool.args as { name?: string }).name
        : undefined,
  });
  ```

  after: tool name is static based on `tools` keys

  ```
  const toolNameMapping = createToolNameMapping({
    tools,
    providerToolNames: {
      'openai.code_interpreter': 'code_interpreter',
      'openai.file_search': 'file_search',
      'openai.image_generation': 'image_generation',
      'openai.local_shell': 'local_shell',
      'openai.shell': 'shell',
      'openai.web_search': 'web_search',
      'openai.web_search_preview': 'web_search_preview',
      'openai.mcp': 'mcp',
      'openai.apply_patch': 'apply_patch',
    }
  });
  ```

### Patch Changes

- Updated dependencies [61753c3]
  - @ai-sdk/provider-utils@5.0.0-beta.4

## 4.0.0-beta.9

### Patch Changes

- 156cdf0: feat(openai): add new tool search tool

## 4.0.0-beta.8

### Patch Changes

- Updated dependencies [f7d4f01]
  - @ai-sdk/provider-utils@5.0.0-beta.3
  - @ai-sdk/provider@4.0.0-beta.2

## 4.0.0-beta.7

### Patch Changes

- Updated dependencies [5c2a5a2]
  - @ai-sdk/provider@4.0.0-beta.1
  - @ai-sdk/provider-utils@5.0.0-beta.2

## 4.0.0-beta.6

### Patch Changes

- 83f9d04: feat(openai): upgrade v3 specs to v4

## 4.0.0-beta.5

### Patch Changes

- ac18f89: feat(provider/openai): add `gpt-5.3-chat-latest`

## 4.0.0-beta.4

### Patch Changes

- a71d345: fix(provider/openai): drop reasoning parts without encrypted content when store: false

## 4.0.0-beta.3

### Patch Changes

- 45b3d76: fix(security): prevent streaming tool calls from finalizing on parsable partial JSON

  Streaming tool call arguments were finalized using `isParsableJson()` as a heuristic for completion. If partial accumulated JSON happened to be valid JSON before all chunks arrived, the tool call would be executed with incomplete arguments. Tool call finalization now only occurs in `flush()` after the stream is fully consumed.

- f7295cb: revert incorrect fix https://github.com/vercel/ai/pull/13172

## 4.0.0-beta.2

### Patch Changes

- Updated dependencies [531251e]
  - @ai-sdk/provider-utils@5.0.0-beta.1

## 4.0.0-beta.1

### Patch Changes

- 7afaece: feat(provider/openai): add GPT-5.4 model support

## 4.0.0-beta.0

### Major Changes

- 8359612: Start v7 pre-release

### Patch Changes

- Updated dependencies [8359612]
  - @ai-sdk/provider@4.0.0-beta.0
  - @ai-sdk/provider-utils@5.0.0-beta.0

## 3.0.41

### Patch Changes

- Updated dependencies [ad4cfc2]
  - @ai-sdk/provider-utils@4.0.19

## 3.0.40

### Patch Changes

- Updated dependencies [824b295]
  - @ai-sdk/provider-utils@4.0.18

## 3.0.39

### Patch Changes

- Updated dependencies [08336f1]
  - @ai-sdk/provider-utils@4.0.17

## 3.0.38

### Patch Changes

- 64a8fae: chore: remove obsolete model IDs for Anthropic, Google, OpenAI, xAI

## 3.0.37

### Patch Changes

- 58bc42d: feat(provider/openai): support custom tools with alias mapping
- Updated dependencies [58bc42d]
  - @ai-sdk/provider-utils@4.0.16

## 3.0.36

### Patch Changes

- 53bdfa5: fix(openai): allow null/undefined type in streaming tool call deltas

  Azure AI Foundry and Mistral deployed on Azure omit the `type` field in
  streaming tool_calls deltas. The chat stream parser now accepts a missing
  `type` field (treating it as `"function"`) instead of throwing
  `InvalidResponseDataError: Expected 'function' type.`

  Fixes #12770

## 3.0.35

### Patch Changes

- 5e18272: fix(openai): include reasoning parts without itemId when encrypted_content is present

  When `providerOptions.openai.itemId` is absent on a reasoning content part,
  the converter now uses `encrypted_content` as a fallback instead of silently
  skipping the part with a warning. The OpenAI Responses API accepts reasoning
  items without an `id` when `encrypted_content` is supplied, enabling
  multi-turn reasoning even when item IDs are stripped from provider options.

  Also makes the `id` field optional on the `OpenAIResponsesReasoning` type to
  reflect that the API does not require it.

  Fixes #12853

## 3.0.34

### Patch Changes

- 66a374c: Support `phase` parameter on Responses API message items. The `phase` field (`'commentary'` or `'final_answer'`) is returned by models like `gpt-5.3-codex` on assistant message output items and must be preserved when sending follow-up requests. The phase value is available in `providerMetadata.openai.phase` on text parts and is automatically included on assistant messages sent back to the API.

## 3.0.33

### Patch Changes

- 624e651: Added missing model IDs to OpenAIChatModelId, OpenAIResponsesModelId, OpenAIImageModelId, OpenAISpeechModelId, OpenAITranscriptionModelId, and OpenAICompletionModelId types for better autocomplete support.

## 3.0.32

### Patch Changes

- 0c9395b: feat(provider/openai): add `gpt-5.3-codex`

## 3.0.31

### Patch Changes

- d5f7312: fix(openai): change web search tool action to be optional

## 3.0.30

### Patch Changes

- ff12133: feat(provider/openai): support native skills and hosted shell

## 3.0.29

### Patch Changes

- e2ee705: feat: differentiate text vs image input tokens

## 3.0.28

### Patch Changes

- Updated dependencies [4024a3a]
  - @ai-sdk/provider-utils@4.0.15

## 3.0.27

### Patch Changes

- 99fbed8: feat: normalize provider specific model options type names and ensure they are exported

## 3.0.26

### Patch Changes

- Updated dependencies [7168375]
  - @ai-sdk/provider@3.0.8
  - @ai-sdk/provider-utils@4.0.14

## 3.0.25

### Patch Changes

- Updated dependencies [53f6731]
  - @ai-sdk/provider@3.0.7
  - @ai-sdk/provider-utils@4.0.13

## 3.0.24

### Patch Changes

- Updated dependencies [96936e5]
  - @ai-sdk/provider-utils@4.0.12

## 3.0.23

### Patch Changes

- Updated dependencies [2810850]
  - @ai-sdk/provider-utils@4.0.11
  - @ai-sdk/provider@3.0.6

## 3.0.22

### Patch Changes

- 1524271: chore: add skill information to README files

## 3.0.21

### Patch Changes

- 2c70b90: chore: update provider docs

## 3.0.20

### Patch Changes

- Updated dependencies [462ad00]
  - @ai-sdk/provider-utils@4.0.10

## 3.0.19

### Patch Changes

- 04c89b1: Provide Responses API providerMetadata types at the message / reasoning level.
  - Export the following types for use in client code:
    - `OpenaiResponsesProviderMetadata`
    - `OpenaiResponsesReasoningProviderMetadata`
    - `AzureResponsesProviderMetadata`
    - `AzureResponsesReasoningProviderMetadata`

## 3.0.18

### Patch Changes

- 4de5a1d: chore: excluded tests from src folder in npm package
- Updated dependencies [4de5a1d]
  - @ai-sdk/provider@3.0.5
  - @ai-sdk/provider-utils@4.0.9

## 3.0.17

### Patch Changes

- 4218f86: fix(openai): preserve tool id for apply patch tool

## 3.0.16

### Patch Changes

- 2b8369d: chore: add docs to package dist

## 3.0.15

### Patch Changes

- 8dc54db: chore: add src folders to package bundle

## 3.0.14

### Patch Changes

- d21d016: feat(openai): add o4-mini model to OpenAIChatModelId type

## 3.0.13

### Patch Changes

- 000fa96: fix(openai): filter duplicate items when passing conversationID

## 3.0.12

### Patch Changes

- Updated dependencies [5c090e7]
  - @ai-sdk/provider@3.0.4
  - @ai-sdk/provider-utils@4.0.8

## 3.0.11

### Patch Changes

- Updated dependencies [46f46e4]
  - @ai-sdk/provider-utils@4.0.7

## 3.0.10

### Patch Changes

- Updated dependencies [1b11dcb]
  - @ai-sdk/provider-utils@4.0.6
  - @ai-sdk/provider@3.0.3

## 3.0.9

### Patch Changes

- Updated dependencies [34d1c8a]
  - @ai-sdk/provider-utils@4.0.5

## 3.0.8

### Patch Changes

- 330bd92: Fix Responses `code_interpreter` annotations and add typed providerMetadata
  - Align Responses API `code_interpreter` annotation types with the official spec.
  - Add tests to ensure the overlapping parts of the Zod schemas used by `doGenerate` and `doStream` stay in sync.
  - Export the following types for use in client code:
    - `OpenaiResponsesTextProviderMetadata`
    - `OpenaiResponsesSourceDocumentProviderMetadata`
    - `AzureResponsesTextProviderMetadata`
    - `AzureResponsesSourceDocumentProviderMetadata`

## 3.0.7

### Patch Changes

- 89202fb: fix(openai/azure): passing response_format correctly

## 3.0.6

### Patch Changes

- dc87517: Fix handling of `image-url` tool result content type in OpenAI Responses API conversion

## 3.0.5

### Patch Changes

- Updated dependencies [d937c8f]
  - @ai-sdk/provider@3.0.2
  - @ai-sdk/provider-utils@4.0.4

## 3.0.4

### Patch Changes

- Updated dependencies [0b429d4]
  - @ai-sdk/provider-utils@4.0.3

## 3.0.3

### Patch Changes

- 55cd1a4: fix(azure): allow 'azure' as a key for providerOptions

## 3.0.2

### Patch Changes

- 863d34f: fix: trigger release to update `@latest`
- Updated dependencies [863d34f]
  - @ai-sdk/provider@3.0.1
  - @ai-sdk/provider-utils@4.0.2

## 3.0.1

### Patch Changes

- 29264a3: feat: add MCP tool approval
- Updated dependencies [29264a3]
  - @ai-sdk/provider-utils@4.0.1

## 3.0.0

### Major Changes

- dee8b05: ai SDK 6 beta

### Minor Changes

- 78928cb: release: start 5.1 beta

### Patch Changes

- 0c3b58b: fix(provider): add specificationVersion to ProviderV3
- 4920119: fix the "incomplete_details" key from nullable to nullish for openai compatibility
- 0adc679: feat(provider): shared spec v3
- 92c6241: feat(openai): additional settings for file search tool
- 88fc415: feat(openai): add the new provider 'apply_patch' tool
- 817e601: fix(openai); fix url_citation schema in chat api
- dae2185: fix(openai): extract meta data from first chunk that contains any
- 046aa3b: feat(provider): speech model v3 spec
- f1277fe: feat(provider/openai): send assistant text and tool call parts as reference ids when store: true
- 8d9e8ad: chore(provider): remove generics from EmbeddingModelV3

  Before

  ```ts
  model.textEmbeddingModel("my-model-id");
  ```

  After

  ```ts
  model.embeddingModel("my-model-id");
  ```

- 60f4775: fix: remove code for unsuported o1-mini and o1-preview models
- 9a51b92: support OPENAI_BASE_URL env
- d64ece9: enables image_generation capabilities in the Azure provider through the Responses API.
- 2625a04: feat(openai); update spec for mcp approval
- 2e86082: feat(provider/openai): `OpenAIChatLanguageModelOptions` type

  ```ts
  import { openai, type OpenAIChatLanguageModelOptions } from "@ai-sdk/openai";
  import { generateText } from "ai";

  await generateText({
    model: openai.chat("gpt-4o"),
    prompt: "Invent a new holiday and describe its traditions.",
    providerOptions: {
      openai: {
        user: "user-123",
      } satisfies OpenAIChatLanguageModelOptions,
    },
  });
  ```

- 0877683: feat(provider/openai): support conversations api
- d0f1baf: feat(openai): Add support for 'promptCacheRetention: 24h' for gpt5.1 series
- 831b6cc: feat(openai): adding provider mcp tool for openai
- 95f65c2: chore: use import \* from zod/v4
- edc5548: feat(provider/openai): automatically add reasoning.encrypted_content include when store = false
- 954c356: feat(openai): allow custom names for provider-defined tools
- 544d4e8: chore(specification): rename v3 provider defined tool to provider tool
- 77f2b20: enables code_interpreter and file_search capabilities in the Azure provider through the Responses API
- 0c4822d: feat: `EmbeddingModelV3`
- 73d9883: chore(openai): enable strict json by default
- d2039d7: feat(provider/openai): add GPT 5.1 Codex Max to OpenAI Responses model IDs list
- 88edc28: feat (provider/openai): include more image generation response metadata
- e8109d3: feat: tool execution approval
- ed329cb: feat: `Provider-V3`
- 3bd2689: feat: extended token usage
- 1cad0ab: feat: add provider version to user-agent header
- e85fa2f: feat(openai): add sources in web-search actions
- 423ba08: Set the annotations from the Responses API to doStream
- 401f561: fix(provider/openai): fix web search tool input types
- 4122d2a: feat(provider/openai): add gpt-5-codex model id
- 0153bfa: fix(openai): fix parameter exclusion logic
- 8dac895: feat: `LanguageModelV3`
- 304222e: Add streaming support for apply_patch partial diffs.
- 23f132b: fix: error schema for Responses API
- 1d0de66: refactoring(provider/openai): simplify code
- 000e87b: fix(provider/openai): add providerExecuted flag to tool start chunks
- 2c0a758: chore(openai): add JSDoc to responses options
- 1b982e6: feat(openai): preserve file_id when converting file citations
- b82987c: feat(openai): support openai code-interpreter annotations
- 457318b: chore(provider,ai): switch to SharedV3Warning and unified warnings
- b681d7d: feat: expose usage tokens for 'generateImage' function
- 79b4e46: feat(openai): add 'gpt-5.1' modelID
- 3997a42: feat(provider/openai): local shell tool
- 348fd10: fix(openai): treat unknown models as reasoning
- 9061dc0: feat: image editing
- fe49278: feat(provider/openai): only send item references for reasoning when store: true
- cb4d238: The built in Code Interpreter tool input code is streamed in `tool-input-<start/delta/end>` chunks.
- 357cfd7: feat(provider/openai): add new model IDs `gpt-image-1-mini`, `gpt-5-pro`, `gpt-5-pro-2025-10-06`
- 38a4035: added support for external_web_access parameter on web_search tool
- 40d5419: feat(openai): add `o3-deep-research` and `o4-mini-deep-research` models
- 366f50b: chore(provider): add deprecated textEmbeddingModel and textEmbedding aliases
- 2b0caef: feat(provider/openai): preview image generation results
- b60d2e2: fix(openai): allow open_page action type url to be nullish
- fd47df5: fix(openai): revised_prompt sometimes returns null, causing errors
- 4616b86: chore: update zod peer depenedency version
- 7756857: fix(provider/openai): add truncation parameter support for Responses API
- cad6445: feat(openai); adding OpenAI's new shell tool
- 64aa48f: Azure OpenAI enabled web-search-preview
- 0b9fdd5: fix(provider/openai): end reasoning parts earlier
- 61c52dc: feat (provider/openai): add gpt-image-1.5 model support
- ef739fa: fix(openai): refactor apply-patch tool
- 3220329: fix openai responses input: process all provider tool outputs (shell/apply_patch) so parallel tool results aren’t dropped and apply_patch outputs are forwarded.
- d270a5d: chore(openai): update tests for apply-patch tool to use snapshots
- f18ef7f: feat(openai): add gpt-5.2 models
- 21e20c0: feat(provider): transcription model v3 spec
- 522f6b8: feat: `ImageModelV3`
- 484aa93: Add 'default' as service tier
- 88574c1: Change `isReasoningModel` detection from blocklist to allowlist and add override option
- 68c6187: feat(provider/openai): support file and image tool results
- 3794514: feat: flexible tool output content support
- cbf52cd: feat: expose raw finish reason
- 10c1322: fix: moved dependency `@ai-sdk/test-server` to devDependencies
- 5648ec0: Add GPT-5.2 support for non-reasoning parameters (temperature, topP, logProbs) when reasoningEffort is none.
- 78f813e: fix(openai): allow temperature etc setting when reasoning effort is none for gpt-5.1
- 40dc7fa: fix(openai): change find action type to find_in_page action type
- 0273b74: fix(openai): add support for sources type 'api'
- 5bf101a: feat(provider/openai): add support for OpenAI xhigh reasoning effort
- 1bd7d32: feat: tool-specific strict mode
- d86b52f: distinguish between OpenAI and Azure in Responses API providerMetadata
- 95f65c2: chore: load zod schemas lazily
- 59561f8: fix(openai); fix url_citation schema in chat api
- Updated dependencies
  - @ai-sdk/provider@3.0.0
  - @ai-sdk/provider-utils@4.0.0

## 3.0.0-beta.112

### Patch Changes

- Updated dependencies [475189e]
  - @ai-sdk/provider@3.0.0-beta.32
  - @ai-sdk/provider-utils@4.0.0-beta.59

## 3.0.0-beta.111

### Patch Changes

- 304222e: Add streaming support for apply_patch partial diffs.

## 3.0.0-beta.110

### Patch Changes

- 2625a04: feat(openai); update spec for mcp approval
- Updated dependencies [2625a04]
  - @ai-sdk/provider@3.0.0-beta.31
  - @ai-sdk/provider-utils@4.0.0-beta.58

## 3.0.0-beta.109

### Patch Changes

- cbf52cd: feat: expose raw finish reason
- Updated dependencies [cbf52cd]
  - @ai-sdk/provider@3.0.0-beta.30
  - @ai-sdk/provider-utils@4.0.0-beta.57

## 3.0.0-beta.108

### Patch Changes

- Updated dependencies [9549c9e]
  - @ai-sdk/provider@3.0.0-beta.29
  - @ai-sdk/provider-utils@4.0.0-beta.56

## 3.0.0-beta.107

### Patch Changes

- Updated dependencies [50b70d6]
  - @ai-sdk/provider-utils@4.0.0-beta.55

## 3.0.0-beta.106

### Patch Changes

- 9061dc0: feat: image editing
- Updated dependencies [9061dc0]
  - @ai-sdk/provider-utils@4.0.0-beta.54
  - @ai-sdk/provider@3.0.0-beta.28

## 3.0.0-beta.105

### Patch Changes

- 88574c1: Change `isReasoningModel` detection from blocklist to allowlist and add override option

## 3.0.0-beta.104

### Patch Changes

- 61c52dc: feat (provider/openai): add gpt-image-1.5 model support

## 3.0.0-beta.103

### Patch Changes

- 366f50b: chore(provider): add deprecated textEmbeddingModel and textEmbedding aliases
- Updated dependencies [366f50b]
  - @ai-sdk/provider@3.0.0-beta.27
  - @ai-sdk/provider-utils@4.0.0-beta.53

## 3.0.0-beta.102

### Patch Changes

- Updated dependencies [763d04a]
  - @ai-sdk/provider-utils@4.0.0-beta.52

## 3.0.0-beta.101

### Patch Changes

- 3220329: fix openai responses input: process all provider tool outputs (shell/apply_patch) so parallel tool results aren’t dropped and apply_patch outputs are forwarded.
- 5648ec0: Add GPT-5.2 support for non-reasoning parameters (temperature, topP, logProbs) when reasoningEffort is none.

## 3.0.0-beta.100

### Patch Changes

- Updated dependencies [c1efac4]
  - @ai-sdk/provider-utils@4.0.0-beta.51

## 3.0.0-beta.99

### Patch Changes

- Updated dependencies [32223c8]
  - @ai-sdk/provider-utils@4.0.0-beta.50

## 3.0.0-beta.98

### Patch Changes

- Updated dependencies [83e5744]
  - @ai-sdk/provider-utils@4.0.0-beta.49

## 3.0.0-beta.97

### Patch Changes

- Updated dependencies [960ec8f]
  - @ai-sdk/provider-utils@4.0.0-beta.48

## 3.0.0-beta.96

### Patch Changes

- 817e601: fix(openai); fix url_citation schema in chat api
- 59561f8: fix(openai); fix url_citation schema in chat api

## 3.0.0-beta.95

### Patch Changes

- 40dc7fa: fix(openai): change find action type to find_in_page action type

## 3.0.0-beta.94

### Patch Changes

- f18ef7f: feat(openai): add gpt-5.2 models

## 3.0.0-beta.93

### Patch Changes

- d2039d7: feat(provider/openai): add GPT 5.1 Codex Max to OpenAI Responses model IDs list

## 3.0.0-beta.92

### Patch Changes

- 5bf101a: feat(provider/openai): add support for OpenAI xhigh reasoning effort

## 3.0.0-beta.91

### Patch Changes

- Updated dependencies [e9e157f]
  - @ai-sdk/provider-utils@4.0.0-beta.47

## 3.0.0-beta.90

### Patch Changes

- Updated dependencies [81e29ab]
  - @ai-sdk/provider-utils@4.0.0-beta.46

## 3.0.0-beta.89

### Patch Changes

- 3bd2689: feat: extended token usage
- Updated dependencies [3bd2689]
  - @ai-sdk/provider@3.0.0-beta.26
  - @ai-sdk/provider-utils@4.0.0-beta.45

## 3.0.0-beta.88

### Patch Changes

- 92c6241: feat(openai): additional settings for file search tool

## 3.0.0-beta.87

### Patch Changes

- Updated dependencies [53f3368]
  - @ai-sdk/provider@3.0.0-beta.25
  - @ai-sdk/provider-utils@4.0.0-beta.44

## 3.0.0-beta.86

### Patch Changes

- 0153bfa: fix(openai): fix parameter exclusion logic

## 3.0.0-beta.85

### Patch Changes

- 78f813e: fix(openai): allow temperature etc setting when reasoning effort is none for gpt-5.1

## 3.0.0-beta.84

### Patch Changes

- Updated dependencies [dce03c4]
  - @ai-sdk/provider-utils@4.0.0-beta.43
  - @ai-sdk/provider@3.0.0-beta.24

## 3.0.0-beta.83

### Patch Changes

- ef739fa: fix(openai): refactor apply-patch tool

## 3.0.0-beta.82

### Patch Changes

- Updated dependencies [3ed5519]
  - @ai-sdk/provider-utils@4.0.0-beta.42

## 3.0.0-beta.81

### Patch Changes

- cad6445: feat(openai); adding OpenAI's new shell tool

## 3.0.0-beta.80

### Patch Changes

- b60d2e2: fix(openai): allow open_page action type url to be nullish

## 3.0.0-beta.79

### Patch Changes

- 1bd7d32: feat: tool-specific strict mode
- Updated dependencies [1bd7d32]
  - @ai-sdk/provider-utils@4.0.0-beta.41
  - @ai-sdk/provider@3.0.0-beta.23

## 3.0.0-beta.78

### Patch Changes

- 2c0a758: chore(openai): add JSDoc to responses options

## 3.0.0-beta.77

### Patch Changes

- d270a5d: chore(openai): update tests for apply-patch tool to use snapshots

## 3.0.0-beta.76

### Patch Changes

- 88edc28: feat (provider/openai): include more image generation response metadata

## 3.0.0-beta.75

### Patch Changes

- 73d9883: chore(openai): enable strict json by default

## 3.0.0-beta.74

### Patch Changes

- 88fc415: feat(openai): add the new provider 'apply_patch' tool

## 3.0.0-beta.73

### Patch Changes

- 544d4e8: chore(specification): rename v3 provider defined tool to provider tool
- Updated dependencies [544d4e8]
  - @ai-sdk/provider-utils@4.0.0-beta.40
  - @ai-sdk/provider@3.0.0-beta.22

## 3.0.0-beta.72

### Patch Changes

- 954c356: feat(openai): allow custom names for provider-defined tools
- Updated dependencies [954c356]
  - @ai-sdk/provider-utils@4.0.0-beta.39
  - @ai-sdk/provider@3.0.0-beta.21

## 3.0.0-beta.71

### Patch Changes

- Updated dependencies [03849b0]
  - @ai-sdk/provider-utils@4.0.0-beta.38

## 3.0.0-beta.70

### Patch Changes

- 457318b: chore(provider,ai): switch to SharedV3Warning and unified warnings
- Updated dependencies [457318b]
  - @ai-sdk/provider@3.0.0-beta.20
  - @ai-sdk/provider-utils@4.0.0-beta.37

## 3.0.0-beta.69

### Patch Changes

- 1d0de66: refactoring(provider/openai): simplify code

## 3.0.0-beta.68

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

## 3.0.0-beta.67

### Patch Changes

- Updated dependencies [10d819b]
  - @ai-sdk/provider@3.0.0-beta.18
  - @ai-sdk/provider-utils@4.0.0-beta.35

## 3.0.0-beta.66

### Patch Changes

- d86b52f: distinguish between OpenAI and Azure in Responses API providerMetadata

## 3.0.0-beta.65

### Patch Changes

- 38a4035: added support for external_web_access parameter on web_search tool

## 3.0.0-beta.64

### Patch Changes

- Updated dependencies [db913bd]
  - @ai-sdk/provider@3.0.0-beta.17
  - @ai-sdk/provider-utils@4.0.0-beta.34

## 3.0.0-beta.63

### Patch Changes

- 423ba08: Set the annotations from the Responses API to doStream

## 3.0.0-beta.62

### Patch Changes

- 64aa48f: Azure OpenAI enabled web-search-preview

## 3.0.0-beta.61

### Patch Changes

- 23f132b: fix: error schema for Responses API

## 3.0.0-beta.60

### Patch Changes

- 0877683: feat(provider/openai): support conversations api

## 3.0.0-beta.59

### Patch Changes

- d0f1baf: feat(openai): Add support for 'promptCacheRetention: 24h' for gpt5.1 series

## 3.0.0-beta.58

### Patch Changes

- 79b4e46: feat(openai): add 'gpt-5.1' modelID

## 3.0.0-beta.57

### Patch Changes

- b681d7d: feat: expose usage tokens for 'generateImage' function
- Updated dependencies [b681d7d]
  - @ai-sdk/provider@3.0.0-beta.16
  - @ai-sdk/provider-utils@4.0.0-beta.33

## 3.0.0-beta.56

### Patch Changes

- Updated dependencies [32d8dbb]
  - @ai-sdk/provider-utils@4.0.0-beta.32

## 3.0.0-beta.55

### Patch Changes

- 831b6cc: feat(openai): adding provider mcp tool for openai

## 3.0.0-beta.54

### Patch Changes

- 40d5419: feat(openai): add `o3-deep-research` and `o4-mini-deep-research` models

## 3.0.0-beta.53

### Patch Changes

- dae2185: fix(openai): extract meta data from first chunk that contains any

## 3.0.0-beta.52

### Patch Changes

- 348fd10: fix(openai): treat unknown models as reasoning

## 3.0.0-beta.51

### Patch Changes

- b82987c: feat(openai): support openai code-interpreter annotations

## 3.0.0-beta.50

### Patch Changes

- Updated dependencies [bb36798]
  - @ai-sdk/provider@3.0.0-beta.15
  - @ai-sdk/provider-utils@4.0.0-beta.31

## 3.0.0-beta.49

### Patch Changes

- 0273b74: fix(openai): add support for sources type 'api'

## 3.0.0-beta.48

### Patch Changes

- 60f4775: fix: remove code for unsuported o1-mini and o1-preview models

## 3.0.0-beta.47

### Patch Changes

- Updated dependencies [4f16c37]
  - @ai-sdk/provider-utils@4.0.0-beta.30

## 3.0.0-beta.46

### Patch Changes

- Updated dependencies [af3780b]
  - @ai-sdk/provider@3.0.0-beta.14
  - @ai-sdk/provider-utils@4.0.0-beta.29

## 3.0.0-beta.45

### Patch Changes

- fd47df5: fix(openai): revised_prompt sometimes returns null, causing errors

## 3.0.0-beta.44

### Patch Changes

- Updated dependencies [016b111]
  - @ai-sdk/provider-utils@4.0.0-beta.28

## 3.0.0-beta.43

### Patch Changes

- Updated dependencies [37c58a0]
  - @ai-sdk/provider@3.0.0-beta.13
  - @ai-sdk/provider-utils@4.0.0-beta.27

## 3.0.0-beta.42

### Patch Changes

- Updated dependencies [d1bdadb]
  - @ai-sdk/provider@3.0.0-beta.12
  - @ai-sdk/provider-utils@4.0.0-beta.26

## 3.0.0-beta.41

### Patch Changes

- Updated dependencies [4c44a5b]
  - @ai-sdk/provider@3.0.0-beta.11
  - @ai-sdk/provider-utils@4.0.0-beta.25

## 3.0.0-beta.40

### Patch Changes

- 1b982e6: feat(openai): preserve file_id when converting file citations

## 3.0.0-beta.39

### Patch Changes

- 0c3b58b: fix(provider): add specificationVersion to ProviderV3
- Updated dependencies [0c3b58b]
  - @ai-sdk/provider@3.0.0-beta.10
  - @ai-sdk/provider-utils@4.0.0-beta.24

## 3.0.0-beta.38

### Patch Changes

- Updated dependencies [a755db5]
  - @ai-sdk/provider@3.0.0-beta.9
  - @ai-sdk/provider-utils@4.0.0-beta.23

## 3.0.0-beta.37

### Patch Changes

- e85fa2f: feat(openai): add sources in web-search actions

## 3.0.0-beta.36

### Patch Changes

- Updated dependencies [58920e0]
  - @ai-sdk/provider-utils@4.0.0-beta.22

## 3.0.0-beta.35

### Patch Changes

- Updated dependencies [293a6b7]
  - @ai-sdk/provider-utils@4.0.0-beta.21

## 3.0.0-beta.34

### Patch Changes

- Updated dependencies [fca786b]
  - @ai-sdk/provider-utils@4.0.0-beta.20

## 3.0.0-beta.33

### Patch Changes

- 7756857: fix(provider/openai): add truncation parameter support for Responses API

## 3.0.0-beta.32

### Patch Changes

- 3794514: feat: flexible tool output content support
- Updated dependencies [3794514]
  - @ai-sdk/provider-utils@4.0.0-beta.19
  - @ai-sdk/provider@3.0.0-beta.8

## 3.0.0-beta.31

### Patch Changes

- Updated dependencies [81d4308]
  - @ai-sdk/provider@3.0.0-beta.7
  - @ai-sdk/provider-utils@4.0.0-beta.18

## 3.0.0-beta.30

### Patch Changes

- Updated dependencies [703459a]
  - @ai-sdk/provider-utils@4.0.0-beta.17

## 3.0.0-beta.29

### Patch Changes

- 0b9fdd5: fix(provider/openai): end reasoning parts earlier

## 3.0.0-beta.28

### Patch Changes

- 401f561: fix(provider/openai): fix web search tool input types

## 3.0.0-beta.27

### Patch Changes

- f1277fe: feat(provider/openai): send assistant text and tool call parts as reference ids when store: true

## 3.0.0-beta.26

### Patch Changes

- edc5548: feat(provider/openai): automatically add reasoning.encrypted_content include when store = false

## 3.0.0-beta.25

### Patch Changes

- Updated dependencies [6306603]
  - @ai-sdk/provider-utils@4.0.0-beta.16

## 3.0.0-beta.24

### Patch Changes

- Updated dependencies [f0b2157]
  - @ai-sdk/provider-utils@4.0.0-beta.15

## 3.0.0-beta.23

### Patch Changes

- Updated dependencies [3b1d015]
  - @ai-sdk/provider-utils@4.0.0-beta.14

## 3.0.0-beta.22

### Patch Changes

- Updated dependencies [d116b4b]
  - @ai-sdk/provider-utils@4.0.0-beta.13

## 3.0.0-beta.21

### Patch Changes

- Updated dependencies [7e32fea]
  - @ai-sdk/provider-utils@4.0.0-beta.12

## 3.0.0-beta.20

### Patch Changes

- 68c6187: feat(provider/openai): support file and image tool results

## 3.0.0-beta.19

### Patch Changes

- 484aa93: Add 'default' as service tier

## 3.0.0-beta.18

### Patch Changes

- 95f65c2: chore: use import \* from zod/v4
- 95f65c2: chore: load zod schemas lazily
- Updated dependencies
  - @ai-sdk/provider-utils@4.0.0-beta.11

## 3.0.0-beta.17

### Major Changes

- dee8b05: ai SDK 6 beta

### Patch Changes

- Updated dependencies [dee8b05]
  - @ai-sdk/provider@3.0.0-beta.6
  - @ai-sdk/provider-utils@4.0.0-beta.10

## 2.1.0-beta.16

### Patch Changes

- Updated dependencies [521c537]
  - @ai-sdk/provider-utils@3.1.0-beta.9

## 2.1.0-beta.15

### Patch Changes

- Updated dependencies [e06565c]
  - @ai-sdk/provider-utils@3.1.0-beta.8

## 2.1.0-beta.14

### Patch Changes

- 000e87b: fix(provider/openai): add providerExecuted flag to tool start chunks

## 2.1.0-beta.13

### Patch Changes

- 357cfd7: feat(provider/openai): add new model IDs `gpt-image-1-mini`, `gpt-5-pro`, `gpt-5-pro-2025-10-06`

## 2.1.0-beta.12

### Patch Changes

- 046aa3b: feat(provider): speech model v3 spec
- e8109d3: feat: tool execution approval
- 21e20c0: feat(provider): transcription model v3 spec
- Updated dependencies
  - @ai-sdk/provider@2.1.0-beta.5
  - @ai-sdk/provider-utils@3.1.0-beta.7

## 2.1.0-beta.11

### Patch Changes

- 0adc679: feat(provider): shared spec v3
- 2b0caef: feat(provider/openai): preview image generation results
- Updated dependencies
  - @ai-sdk/provider-utils@3.1.0-beta.6
  - @ai-sdk/provider@2.1.0-beta.4

## 2.1.0-beta.10

### Patch Changes

- d64ece9: enables image_generation capabilities in the Azure provider through the Responses API.

## 2.1.0-beta.9

### Patch Changes

- 9a51b92: support OPENAI_BASE_URL env

## 2.1.0-beta.8

### Patch Changes

- 4122d2a: feat(provider/openai): add gpt-5-codex model id
- 3997a42: feat(provider/openai): local shell tool
- cb4d238: The built in Code Interpreter tool input code is streamed in `tool-input-<start/delta/end>` chunks.

## 2.1.0-beta.7

### Patch Changes

- 77f2b20: enables code_interpreter and file_search capabilities in the Azure provider through the Responses API
- 8dac895: feat: `LanguageModelV3`
- 10c1322: fix: moved dependency `@ai-sdk/test-server` to devDependencies
- Updated dependencies [8dac895]
  - @ai-sdk/provider-utils@3.1.0-beta.5
  - @ai-sdk/provider@2.1.0-beta.3

## 2.1.0-beta.6

### Patch Changes

- fe49278: feat(provider/openai): only send item references for reasoning when store: true

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

- 2e86082: feat(provider/openai): `OpenAIChatLanguageModelOptions` type

  ```ts
  import { openai, type OpenAIChatLanguageModelOptions } from "@ai-sdk/openai";
  import { generateText } from "ai";

  await generateText({
    model: openai.chat("gpt-4o"),
    prompt: "Invent a new holiday and describe its traditions.",
    providerOptions: {
      openai: {
        user: "user-123",
      } satisfies OpenAIChatLanguageModelOptions,
    },
  });
  ```

## 2.1.0-beta.2

### Patch Changes

- 4920119: fix the "incomplete_details" key from nullable to nullish for openai compatibility
- 0c4822d: feat: `EmbeddingModelV3`
- 1cad0ab: feat: add provider version to user-agent header
- Updated dependencies [0c4822d]
  - @ai-sdk/provider@2.1.0-beta.1
  - @ai-sdk/provider-utils@3.1.0-beta.2

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

## 2.0.32

### Patch Changes

- 1cf857d: fix(provider/openai): remove provider-executed tools from chat completions model
- 01de47f: feat(provider/openai): rework file search tool

## 2.0.31

### Patch Changes

- bb94467: feat(provider/openai): add maxToolCalls provider option
- 4a2b70e: feat(provider/openai): send item references for provider-executed tool results
- 643711d: feat (provider/openai): provider defined image generation tool support

## 2.0.30

### Patch Changes

- Updated dependencies [0294b58]
  - @ai-sdk/provider-utils@3.0.9

## 2.0.29

### Patch Changes

- 4235eb3: feat(provider/openai): code interpreter tool calls and results

## 2.0.28

### Patch Changes

- 4c2bb77: fix (provider/openai): send sources action as include
- 561e8b0: fix (provider/openai): fix code interpreter tool in doGenerate

## 2.0.27

### Patch Changes

- 2338c79: feat (provider/openai): add jsdoc for openai tools

## 2.0.26

### Patch Changes

- 5819aec: fix (provider/openai): only send tool calls finish reason for tools that are not provider-executed
- af8c6bb: feat (provider/openai): add web_search tool

## 2.0.25

### Patch Changes

- fb45ade: fix timestamp granularities support for openai transcription

## 2.0.24

### Patch Changes

- ad57512: fix(provider/openai): safe practice to include filename and fileExtension to avoid `experimental_transcribe` fails with valid Buffer
- Updated dependencies [99964ed]
  - @ai-sdk/provider-utils@3.0.8

## 2.0.23

### Patch Changes

- a9a61b7: Add serviceTier to provider metadata for OpenAI responses

## 2.0.22

### Patch Changes

- 0e272ae: fix(provider/openai): make file_citation annotation fields optional for responses api compatibility
- Updated dependencies [886e7cd]
  - @ai-sdk/provider-utils@3.0.7

## 2.0.21

### Patch Changes

- d18856a: fix(provider/openai): support websearch tool results without query property
- 15271d6: fix(provider/openai): do not set `response_format` to `verbose_json` if model is `gpt-4o-transcribe` or `gpt-4o-mini-transcribe`

  These two models do not support it:
  https://platform.openai.com/docs/api-reference/audio/createTranscription#audio_createtranscription-response_format

- Updated dependencies [1b5a3d3]
  - @ai-sdk/provider-utils@3.0.6

## 2.0.20

### Patch Changes

- 974de40: fix(provider/ai): do not set `.providerMetadata.openai.logprobs` to an array of empty arrays when using `streamText()`

## 2.0.19

### Patch Changes

- Updated dependencies [0857788]
  - @ai-sdk/provider-utils@3.0.5

## 2.0.18

### Patch Changes

- 5e47d00: Support Responses API input_file file_url passthrough for PDFs.

  This adds:

  - file_url variant to OpenAIResponses user content
  - PDF URL mapping to input_file with file_url in Responses converter
  - PDF URL support in supportedUrls to avoid auto-download

## 2.0.17

### Patch Changes

- 70bb696: fix(provider/openai): correct web search tool input

## 2.0.16

### Patch Changes

- Updated dependencies [68751f9]
  - @ai-sdk/provider-utils@3.0.4

## 2.0.15

### Patch Changes

- a4bef93: feat(provider/openai): expose web search queries in responses api
- 6ed34cb: refactor(openai): consolidate model config into `getResponsesModelConfig()`

  https://github.com/vercel/ai/pull/8038

## 2.0.14

### Patch Changes

- 7f47105: fix(provider/openai): support file_citation annotations in responses api

## 2.0.13

### Patch Changes

- ddc9d99: Implements `logprobs` for OpenAI `providerOptions` and `providerMetaData` in `OpenAIResponsesLanguageModel`

  You can now set `providerOptions.openai.logprobs` when using `generateText()` and retrieve logprobs from the response via `result.providerMetadata?.openai`

## 2.0.12

### Patch Changes

- ec336a1: feat(provider/openai): add response_format to be supported by default
- 2935ec7: fix(provider/openai): exclude gpt-5-chat from reasoning model
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.3

## 2.0.11

### Patch Changes

- 097b452: feat(openai, azure): add configurable file ID prefixes for Responses API

  - Added `fileIdPrefixes` option to OpenAI Responses API configuration
  - Azure OpenAI now supports `assistant-` prefixed file IDs (replacing previous `file-` prefix support)
  - OpenAI maintains backward compatibility with default `file-` prefix
  - File ID detection is disabled when `fileIdPrefixes` is undefined, gracefully falling back to base64 processing

- 87cf954: feat(provider/openai): add support for prompt_cache_key
- a3d98a9: feat(provider/openai): add support for safety_identifier
- 110d167: fix(openai): add missing file_search_call handlers in responses streaming
- 8d3c747: chore(openai): remove deprecated GPT-4.5-preview models and improve autocomplete control
- Updated dependencies [38ac190]
  - @ai-sdk/provider-utils@3.0.2

## 2.0.10

### Patch Changes

- a274b01: refactor(provider/openai): restructure files
- b48e0ff: feat(provider/openai): add code interpreter tool (responses api)

## 2.0.9

### Patch Changes

- 8f8a521: fix(providers): use convertToBase64 for Uint8Array image parts to produce valid data URLs; keep mediaType normalization and URL passthrough

## 2.0.8

### Patch Changes

- 57fb959: feat(openai): add verbosity parameter support for chat api
- 2a3fbe6: allow `minimal` in `reasoningEffort` for openai chat

## 2.0.7

### Patch Changes

- 4738f18: feat(openai): add flex processing support for gpt-5 models
- 013d747: feat(openai): add verbosity parameter support for responses api
- 35feee8: feat(openai): add priority processing support for gpt-5 models

## 2.0.6

### Patch Changes

- ad2255f: chore(docs): added gpt 5 models + removed deprecated models
- 64bcb66: feat(provider/openai): models ids on chat
- 1d42ff2: feat(provider/openai): models ids

## 2.0.5

### Patch Changes

- 6753a2e: feat(examples): add gpt-5 model examples and e2e tests
- 6cba06a: feat (provider/openai): add reasoning model config

## 2.0.4

### Patch Changes

- c9e0f52: Files from the OpenAI Files API are now supported, mirroring functionality of OpenAI Chat and Responses API, respectively. Also, the AI SDK supports URLs for PDFs in the responses API the same way it did for completions.

## 2.0.3

### Patch Changes

- Updated dependencies [90d212f]
  - @ai-sdk/provider-utils@3.0.1

## 2.0.2

### Patch Changes

- 63e2016: fix(openai): missing url citations from web search tools

## 2.0.1

### Patch Changes

- bc45e29: feat(openai): add file_search_call support to responses api

## 2.0.0

### Major Changes

- d5f588f: AI SDK 5
- cc62234: chore (provider/openai): switch default to openai responses api
- 516be5b: ### Move Image Model Settings into generate options

  Image Models no longer have settings. Instead, `maxImagesPerCall` can be passed directly to `generateImage()`. All other image settings can be passed to `providerOptions[provider]`.

  Before

  ```js
  await generateImage({
    model: luma.image("photon-flash-1", {
      maxImagesPerCall: 5,
      pollIntervalMillis: 500,
    }),
    prompt,
    n: 10,
  });
  ```

  After

  ```js
  await generateImage({
    model: luma.image("photon-flash-1"),
    prompt,
    n: 10,
    maxImagesPerCall: 5,
    providerOptions: {
      luma: { pollIntervalMillis: 5 },
    },
  });
  ```

  Pull Request: https://github.com/vercel/ai/pull/6180

- efc3a62: fix (provider/openai): default strict mode to false

### Patch Changes

- 948b755: chore(providers/openai): convert to providerOptions
- d63bcbc: feat (provider/openai): o4 updates for responses api
- 3bd3c0b: chore(providers/openai): update embedding model to use providerOptions
- 5d959e7: refactor: updated openai + anthropic tool use server side
- 0eee6a8: Fix streaming and reconstruction of reasoning summary parts
- 177526b: chore(providers/openai-transcription): switch to providerOptions
- 2f542fa: Add reasoning-part-finish parts for reasoning models in the responses API
- c15dfbf: feat (providers/openai): add gpt-image-1 model id to image settings
- 3b1ea10: adding support for gpt-4o-search-preview and handling unsupported parameters
- e2aceaf: feat: add raw chunk support
- d2af019: feat (providers/openai): add gpt-4.1 models
- eb173f1: chore (providers): remove model shorthand deprecation warnings
- 209256d: Add missing file_search tool support to OpenAI Responses API
- faea29f: fix (provider/openai): multi-step reasoning with text
- 7032dc5: feat(openai): add priority processing service tier support
- 870c5c0: feat (providers/openai): add o3 and o4-mini models
- db72adc: chore(providers/openai): update completion model to use providerOptions
- a166433: feat: add transcription with experimental_transcribe
- 26735b5: chore(embedding-model): add v2 interface
- 443d8ec: feat(embedding-model-v2): add response body field
- 8d12da5: feat(provider/openai): add serviceTier option for flex processing
- 9bf7291: chore(providers/openai): enable structuredOutputs by default & switch to provider option
- d521cda: feat(openai): add file_search filters and update field names
- 66962ed: fix(packages): export node10 compatible types
- 442be08: fix: propagate openai transcription fixes
- 0059ee2: fix(openai): update file_search fields to match API changes
- 8493141: feat (providers/openai): add support for reasoning summaries
- 9301f86: refactor (image-model): rename `ImageModelV1` to `ImageModelV2`
- 0a87932: core (ai): change transcription model mimeType to mediaType
- 8aa9e20: feat: add speech with experimental_generateSpeech
- 4617fab: chore(embedding-models): remove remaining settings
- b5a0e32: fix (provider/openai): correct default for chat model strict mode
- 136819b: chore(providers/openai): re-introduce logprobs as providerMetadata
- 52ce942: chore(providers/openai): remove & enable strict compatibility by default
- db64cbe: fix (provider/openai): multi-step reasoning with tool calls
- b3c3450: feat (provider/openai): add support for encrypted_reasoning to responses api
- 48249c4: Do not warn if empty text is the first part of a reasoning sequence
- c7d3b2e: fix (provider/openai): push first reasoning chunk in output item added event
- ad2a3d5: feat(provider/openai): add missing reasoning models to responses API
- 9943464: feat(openai): add file_search_call.results support to include parameter
- 0fa7414: chore (provider/openai): standardize on itemId in provider metadata
- 9bd5ab5: feat (provider): add providerMetadata to ImageModelV2 interface (#5977)

  The `experimental_generateImage` method from the `ai` package now returnes revised prompts for OpenAI's image models.

  ```js
  const prompt = "Santa Claus driving a Cadillac";

  const { providerMetadata } = await experimental_generateImage({
    model: openai.image("dall-e-3"),
    prompt,
  });

  const revisedPrompt = providerMetadata.openai.images[0]?.revisedPrompt;

  console.log({
    prompt,
    revisedPrompt,
  });
  ```

- fa758ea: feat(provider/openai): add o3 & o4-mini with developer systemMessageMode
- d1a034f: feature: using Zod 4 for internal stuff
- fd65bc6: chore(embedding-model-v2): rename rawResponse to response
- e497698: fix (provider/openai): handle responses api errors
- 928fadf: fix(providers/openai): logprobs for stream alongside completion model
- 0a87932: fix (provider/openai): increase transcription model resilience
- 5147e6e: chore(openai): remove simulateStreaming
- 06bac05: fix (openai): structure output for responses model
- 205077b: fix: improve Zod compatibility
- c2b92cc: chore(openai): remove legacy function calling
- 284353f: fix(providers/openai): zod parse error with function
- 6f231db: fix(providers): always use optional instead of mix of nullish for providerOptions
- f10304b: feat(tool-calling): don't require the user to have to pass parameters
- 4af5233: Fix PDF file parts when passed as a string url or Uint8Array
- 7df7a25: feat (providers/openai): support gpt-image-1 image generation
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0
  - @ai-sdk/provider@2.0.0

## 2.0.0-beta.16

### Patch Changes

- Updated dependencies [88a8ee5]
  - @ai-sdk/provider-utils@3.0.0-beta.10

## 2.0.0-beta.15

### Patch Changes

- 9943464: feat(openai): add file_search_call.results support to include parameter
- Updated dependencies [27deb4d]
  - @ai-sdk/provider@2.0.0-beta.2
  - @ai-sdk/provider-utils@3.0.0-beta.9

## 2.0.0-beta.14

### Patch Changes

- eb173f1: chore (providers): remove model shorthand deprecation warnings
- 7032dc5: feat(openai): add priority processing service tier support
- Updated dependencies [dd5fd43]
  - @ai-sdk/provider-utils@3.0.0-beta.8

## 2.0.0-beta.13

### Patch Changes

- Updated dependencies [e7fcc86]
  - @ai-sdk/provider-utils@3.0.0-beta.7

## 2.0.0-beta.12

### Patch Changes

- d521cda: feat(openai): add file_search filters and update field names
- 0059ee2: fix(openai): update file_search fields to match API changes
- Updated dependencies [ac34802]
  - @ai-sdk/provider-utils@3.0.0-beta.6

## 2.0.0-beta.11

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-beta.5

## 2.0.0-beta.10

### Patch Changes

- 0fa7414: chore (provider/openai): standardize on itemId in provider metadata
- 205077b: fix: improve Zod compatibility
- Updated dependencies [205077b]
  - @ai-sdk/provider-utils@3.0.0-beta.4

## 2.0.0-beta.9

### Patch Changes

- faea29f: fix (provider/openai): multi-step reasoning with text

## 2.0.0-beta.8

### Patch Changes

- db64cbe: fix (provider/openai): multi-step reasoning with tool calls
- Updated dependencies [05d2819]
  - @ai-sdk/provider-utils@3.0.0-beta.3

## 2.0.0-beta.7

### Patch Changes

- 209256d: Add missing file_search tool support to OpenAI Responses API

## 2.0.0-beta.6

### Patch Changes

- 0eee6a8: Fix streaming and reconstruction of reasoning summary parts
- b5a0e32: fix (provider/openai): correct default for chat model strict mode
- c7d3b2e: fix (provider/openai): push first reasoning chunk in output item added event

## 2.0.0-beta.5

### Patch Changes

- 48249c4: Do not warn if empty text is the first part of a reasoning sequence
- e497698: fix (provider/openai): handle responses api errors

## 2.0.0-beta.4

### Patch Changes

- b3c3450: feat (provider/openai): add support for encrypted_reasoning to responses api
- ad2a3d5: feat(provider/openai): add missing reasoning models to responses API

## 2.0.0-beta.3

### Major Changes

- efc3a62: fix (provider/openai): default strict mode to false

## 2.0.0-beta.2

### Patch Changes

- d1a034f: feature: using Zod 4 for internal stuff
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-beta.2

## 2.0.0-beta.1

### Major Changes

- cc62234: chore (provider/openai): switch default to openai responses api

### Patch Changes

- 5d959e7: refactor: updated openai + anthropic tool use server side
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

- 2f542fa: Add reasoning-part-finish parts for reasoning models in the responses API
- e2aceaf: feat: add raw chunk support
- Updated dependencies [e2aceaf]
  - @ai-sdk/provider@2.0.0-alpha.12
  - @ai-sdk/provider-utils@3.0.0-alpha.12

## 2.0.0-alpha.11

### Patch Changes

- 8d12da5: feat(provider/openai): add serviceTier option for flex processing
- Updated dependencies [c1e6647]
  - @ai-sdk/provider@2.0.0-alpha.11
  - @ai-sdk/provider-utils@3.0.0-alpha.11

## 2.0.0-alpha.10

### Patch Changes

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

- 4af5233: Fix PDF file parts when passed as a string url or Uint8Array
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

### Major Changes

- 516be5b: ### Move Image Model Settings into generate options

  Image Models no longer have settings. Instead, `maxImagesPerCall` can be passed directly to `generateImage()`. All other image settings can be passed to `providerOptions[provider]`.

  Before

  ```js
  await generateImage({
    model: luma.image("photon-flash-1", {
      maxImagesPerCall: 5,
      pollIntervalMillis: 500,
    }),
    prompt,
    n: 10,
  });
  ```

  After

  ```js
  await generateImage({
    model: luma.image("photon-flash-1"),
    prompt,
    n: 10,
    maxImagesPerCall: 5,
    providerOptions: {
      luma: { pollIntervalMillis: 5 },
    },
  });
  ```

  Pull Request: https://github.com/vercel/ai/pull/6180

### Patch Changes

- Updated dependencies [ea7a7c9]
  - @ai-sdk/provider-utils@3.0.0-canary.17

## 2.0.0-canary.17

### Patch Changes

- 52ce942: chore(providers/openai): remove & enable strict compatibility by default
- Updated dependencies [87b828f]
  - @ai-sdk/provider-utils@3.0.0-canary.16

## 2.0.0-canary.16

### Patch Changes

- 928fadf: fix(providers/openai): logprobs for stream alongside completion model
- 6f231db: fix(providers): always use optional instead of mix of nullish for providerOptions
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.15
  - @ai-sdk/provider@2.0.0-canary.14

## 2.0.0-canary.15

### Patch Changes

- 136819b: chore(providers/openai): re-introduce logprobs as providerMetadata
- 9bd5ab5: feat (provider): add providerMetadata to ImageModelV2 interface (#5977)

  The `experimental_generateImage` method from the `ai` package now returnes revised prompts for OpenAI's image models.

  ```js
  const prompt = "Santa Claus driving a Cadillac";

  const { providerMetadata } = await experimental_generateImage({
    model: openai.image("dall-e-3"),
    prompt,
  });

  const revisedPrompt = providerMetadata.openai.images[0]?.revisedPrompt;

  console.log({
    prompt,
    revisedPrompt,
  });
  ```

- 284353f: fix(providers/openai): zod parse error with function
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.14
  - @ai-sdk/provider@2.0.0-canary.13

## 2.0.0-canary.14

### Patch Changes

- fa758ea: feat(provider/openai): add o3 & o4-mini with developer systemMessageMode
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.12
  - @ai-sdk/provider-utils@3.0.0-canary.13

## 2.0.0-canary.13

### Patch Changes

- 177526b: chore(providers/openai-transcription): switch to providerOptions
- c15dfbf: feat (providers/openai): add gpt-image-1 model id to image settings
- 9bf7291: chore(providers/openai): enable structuredOutputs by default & switch to provider option
- 4617fab: chore(embedding-models): remove remaining settings
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.11
  - @ai-sdk/provider-utils@3.0.0-canary.12

## 2.0.0-canary.12

### Patch Changes

- db72adc: chore(providers/openai): update completion model to use providerOptions
- 66962ed: fix(packages): export node10 compatible types
- 9301f86: refactor (image-model): rename `ImageModelV1` to `ImageModelV2`
- 7df7a25: feat (providers/openai): support gpt-image-1 image generation
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.11
  - @ai-sdk/provider@2.0.0-canary.10

## 2.0.0-canary.11

### Patch Changes

- 8493141: feat (providers/openai): add support for reasoning summaries
- Updated dependencies [e86be6f]
  - @ai-sdk/provider@2.0.0-canary.9
  - @ai-sdk/provider-utils@3.0.0-canary.10

## 2.0.0-canary.10

### Patch Changes

- 3bd3c0b: chore(providers/openai): update embedding model to use providerOptions
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.8
  - @ai-sdk/provider-utils@3.0.0-canary.9

## 2.0.0-canary.9

### Patch Changes

- d63bcbc: feat (provider/openai): o4 updates for responses api
- d2af019: feat (providers/openai): add gpt-4.1 models
- 870c5c0: feat (providers/openai): add o3 and o4-mini models
- 06bac05: fix (openai): structure output for responses model

## 2.0.0-canary.8

### Patch Changes

- 8aa9e20: feat: add speech with experimental_generateSpeech
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.8
  - @ai-sdk/provider@2.0.0-canary.7

## 2.0.0-canary.7

### Patch Changes

- 26735b5: chore(embedding-model): add v2 interface
- 443d8ec: feat(embedding-model-v2): add response body field
- fd65bc6: chore(embedding-model-v2): rename rawResponse to response
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.6
  - @ai-sdk/provider-utils@3.0.0-canary.7

## 2.0.0-canary.6

### Patch Changes

- 948b755: chore(providers/openai): convert to providerOptions
- 3b1ea10: adding support for gpt-4o-search-preview and handling unsupported parameters
- 442be08: fix: propagate openai transcription fixes
- 5147e6e: chore(openai): remove simulateStreaming
- c2b92cc: chore(openai): remove legacy function calling
- f10304b: feat(tool-calling): don't require the user to have to pass parameters
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.5
  - @ai-sdk/provider-utils@3.0.0-canary.6

## 2.0.0-canary.5

### Patch Changes

- Updated dependencies [6f6bb89]
  - @ai-sdk/provider@2.0.0-canary.4
  - @ai-sdk/provider-utils@3.0.0-canary.5

## 2.0.0-canary.4

### Patch Changes

- Updated dependencies [d1a1aa1]
  - @ai-sdk/provider@2.0.0-canary.3
  - @ai-sdk/provider-utils@3.0.0-canary.4

## 2.0.0-canary.3

### Patch Changes

- a166433: feat: add transcription with experimental_transcribe
- 0a87932: core (ai): change transcription model mimeType to mediaType
- 0a87932: fix (provider/openai): increase transcription model resilience
- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.3
  - @ai-sdk/provider@2.0.0-canary.2

## 2.0.0-canary.2

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.1
  - @ai-sdk/provider-utils@3.0.0-canary.2

## 2.0.0-canary.1

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@3.0.0-canary.1

## 2.0.0-canary.0

### Major Changes

- d5f588f: AI SDK 5

### Patch Changes

- Updated dependencies [d5f588f]
  - @ai-sdk/provider-utils@3.0.0-canary.0
  - @ai-sdk/provider@2.0.0-canary.0

## 1.3.6

### Patch Changes

- Updated dependencies [28be004]
  - @ai-sdk/provider-utils@2.2.3

## 1.3.5

### Patch Changes

- 52ed95f: fix (provider/openai): force web search tool
- Updated dependencies [b01120e]
  - @ai-sdk/provider-utils@2.2.2

## 1.3.4

### Patch Changes

- b520dba: feat (provider/openai): add chatgpt-4o-latest model

## 1.3.3

### Patch Changes

- 24befd8: feat (provider/openai): add instructions to providerOptions

## 1.3.2

### Patch Changes

- db15028: feat (provider/openai): expose type for validating OpenAI responses provider options

## 1.3.1

### Patch Changes

- Updated dependencies [f10f0fa]
  - @ai-sdk/provider-utils@2.2.1

## 1.3.0

### Minor Changes

- 5bc638d: AI SDK 4.2

### Patch Changes

- Updated dependencies [5bc638d]
  - @ai-sdk/provider@1.1.0
  - @ai-sdk/provider-utils@2.2.0

## 1.2.8

### Patch Changes

- 9f4f1bc: feat (provider/openai): pdf support for chat language models

## 1.2.7

### Patch Changes

- Updated dependencies [d0c4659]
  - @ai-sdk/provider-utils@2.1.15

## 1.2.6

### Patch Changes

- Updated dependencies [0bd5bc6]
  - @ai-sdk/provider@1.0.12
  - @ai-sdk/provider-utils@2.1.14

## 1.2.5

### Patch Changes

- 2e1101a: feat (provider/openai): pdf input support
- Updated dependencies [2e1101a]
  - @ai-sdk/provider@1.0.11
  - @ai-sdk/provider-utils@2.1.13

## 1.2.4

### Patch Changes

- 523f128: feat (provider/openai): add strictSchemas option to responses model

## 1.2.3

### Patch Changes

- Updated dependencies [1531959]
  - @ai-sdk/provider-utils@2.1.12

## 1.2.2

### Patch Changes

- e3a389e: feat (provider/openai): support responses api

## 1.2.1

### Patch Changes

- e1d3d42: feat (ai): expose raw response body in generateText and generateObject
- Updated dependencies [e1d3d42]
  - @ai-sdk/provider@1.0.10
  - @ai-sdk/provider-utils@2.1.11

## 1.2.0

### Minor Changes

- ede6d1b: feat (provider/azure): Add Azure image model support

## 1.1.15

### Patch Changes

- d8216f8: feat (provider/openai): add gpt-4.5-preview to model id set

## 1.1.14

### Patch Changes

- Updated dependencies [ddf9740]
  - @ai-sdk/provider@1.0.9
  - @ai-sdk/provider-utils@2.1.10

## 1.1.13

### Patch Changes

- Updated dependencies [2761f06]
  - @ai-sdk/provider@1.0.8
  - @ai-sdk/provider-utils@2.1.9

## 1.1.12

### Patch Changes

- ea159cb: chore (provider/openai): remove default streaming simulation for o1

## 1.1.11

### Patch Changes

- Updated dependencies [2e898b4]
  - @ai-sdk/provider-utils@2.1.8

## 1.1.10

### Patch Changes

- Updated dependencies [3ff4ef8]
  - @ai-sdk/provider-utils@2.1.7

## 1.1.9

### Patch Changes

- c55b81a: fix (provider/openai): fix o3-mini streaming

## 1.1.8

### Patch Changes

- 161be90: fix (provider/openai): fix model id typo

## 1.1.7

### Patch Changes

- 0a2f026: feat (provider/openai): add o3-mini

## 1.1.6

### Patch Changes

- d89c3b9: feat (provider): add image model support to provider specification
- Updated dependencies [d89c3b9]
  - @ai-sdk/provider@1.0.7
  - @ai-sdk/provider-utils@2.1.6

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

- 3a58a2e: feat (ai/core): throw NoImageGeneratedError from generateImage when no predictions are returned.
- Updated dependencies
  - @ai-sdk/provider-utils@2.1.2
  - @ai-sdk/provider@1.0.6

## 1.1.1

### Patch Changes

- e7a9ec9: feat (provider-utils): include raw value in json parse results
- Updated dependencies
  - @ai-sdk/provider-utils@2.1.1
  - @ai-sdk/provider@1.0.5

## 1.1.0

### Minor Changes

- 62ba5ad: release: AI SDK 4.1

### Patch Changes

- Updated dependencies [62ba5ad]
  - @ai-sdk/provider-utils@2.1.0

## 1.0.20

### Patch Changes

- Updated dependencies [00114c5]
  - @ai-sdk/provider-utils@2.0.8

## 1.0.19

### Patch Changes

- 218d001: feat (provider): Add maxImagesPerCall setting to all image providers.

## 1.0.18

### Patch Changes

- fe816e4: fix (provider/openai): streamObject with o1

## 1.0.17

### Patch Changes

- ba62cf2: feat (provider/openai): automatically map maxTokens to max_completion_tokens for reasoning models
- 3c3fae8: fix (provider/openai): add o1-mini-2024-09-12 and o1-preview-2024-09-12 configurations

## 1.0.16

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@2.0.7

## 1.0.15

### Patch Changes

- f8c6acb: feat (provider/openai): automatically simulate streaming for reasoning models
- d0041f7: feat (provider/openai): improved system message support for reasoning models
- 4d2f97b: feat (provider/openai): improve automatic setting removal for reasoning models

## 1.0.14

### Patch Changes

- 19a2ce7: feat (ai/core): add aspectRatio and seed options to generateImage
- 6337688: feat: change image generation errors to warnings
- Updated dependencies
  - @ai-sdk/provider@1.0.4
  - @ai-sdk/provider-utils@2.0.6

## 1.0.13

### Patch Changes

- b19aa82: feat (provider/openai): add predicted outputs token usage

## 1.0.12

### Patch Changes

- a4241ff: feat (provider/openai): add o3 reasoning model support

## 1.0.11

### Patch Changes

- 5ed5e45: chore (config): Use ts-library.json tsconfig for no-UI libs.
- Updated dependencies [5ed5e45]
  - @ai-sdk/provider-utils@2.0.5
  - @ai-sdk/provider@1.0.3

## 1.0.10

### Patch Changes

- d4fad4e: fix (provider/openai): fix reasoning model detection

## 1.0.9

### Patch Changes

- 3fab0fb: feat (provider/openai): support reasoning_effort setting
- e956eed: feat (provider/openai): update model list and add o1
- 6faab13: feat (provider/openai): simulated streaming setting

## 1.0.8

### Patch Changes

- 09a9cab: feat (ai/core): add experimental generateImage function
- Updated dependencies [09a9cab]
  - @ai-sdk/provider@1.0.2
  - @ai-sdk/provider-utils@2.0.4

## 1.0.7

### Patch Changes

- Updated dependencies [0984f0b]
  - @ai-sdk/provider-utils@2.0.3

## 1.0.6

### Patch Changes

- a9a19cb: fix (provider/openai,groq): prevent sending duplicate tool calls

## 1.0.5

### Patch Changes

- fc18132: feat (ai/core): experimental output for generateText

## 1.0.4

### Patch Changes

- Updated dependencies [b446ae5]
  - @ai-sdk/provider@1.0.1
  - @ai-sdk/provider-utils@2.0.2

## 1.0.3

### Patch Changes

- b748dfb: feat (providers): update model lists

## 1.0.2

### Patch Changes

- Updated dependencies [c3ab5de]
  - @ai-sdk/provider-utils@2.0.1

## 1.0.1

### Patch Changes

- 5e6419a: feat (provider/openai): support streaming for reasoning models

## 1.0.0

### Major Changes

- 66060f7: chore (release): bump major version to 4.0
- 79644e9: chore (provider/openai): remove OpenAI facade
- 0d3d3f5: chore (providers): remove baseUrl option

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@2.0.0
  - @ai-sdk/provider@1.0.0

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

- 79644e9: chore (provider/openai): remove OpenAI facade
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

## 0.0.72

### Patch Changes

- 0bc4115: feat (provider/openai): support predicted outputs

## 0.0.71

### Patch Changes

- 54a3a59: fix (provider/openai): support object-json mode without schema

## 0.0.70

### Patch Changes

- 3b1b69a: feat: provider-defined tools
- Updated dependencies
  - @ai-sdk/provider-utils@1.0.22
  - @ai-sdk/provider@0.0.26

## 0.0.69

### Patch Changes

- b9b0d7b: feat (ai): access raw request body
- Updated dependencies [b9b0d7b]
  - @ai-sdk/provider@0.0.25
  - @ai-sdk/provider-utils@1.0.21

## 0.0.68

### Patch Changes

- 741ca51: feat (provider/openai): support mp3 and wav audio inputs

## 0.0.67

### Patch Changes

- 39fccee: feat (provider/openai): provider name can be changed for 3rd party openai compatible providers

## 0.0.66

### Patch Changes

- 3f29c10: feat (provider/openai): support metadata field for distillation

## 0.0.65

### Patch Changes

- e8aed44: Add OpenAI cached prompt tokens to experimental_providerMetadata for generateText and streamText

## 0.0.64

### Patch Changes

- 5aa576d: feat (provider/openai): support store parameter for distillation

## 0.0.63

### Patch Changes

- Updated dependencies [d595d0d]
  - @ai-sdk/provider@0.0.24
  - @ai-sdk/provider-utils@1.0.20

## 0.0.62

### Patch Changes

- 7efa867: feat (provider/openai): simulated streaming for reasoning models

## 0.0.61

### Patch Changes

- 8132a60: feat (provider/openai): support reasoning token usage and max_completion_tokens

## 0.0.60

### Patch Changes

- Updated dependencies [273f696]
  - @ai-sdk/provider-utils@1.0.19

## 0.0.59

### Patch Changes

- a0991ec: feat (provider/openai): add o1-preview and o1-mini models

## 0.0.58

### Patch Changes

- e0c36bd: feat (provider/openai): support image detail

## 0.0.57

### Patch Changes

- d1aaeae: feat (provider/openai): support ai sdk image download

## 0.0.56

### Patch Changes

- 03313cd: feat (ai): expose response id, response model, response timestamp in telemetry and api
- Updated dependencies
  - @ai-sdk/provider-utils@1.0.18
  - @ai-sdk/provider@0.0.23

## 0.0.55

### Patch Changes

- 28cbf2e: fix (provider/openai): support tool call deltas when arguments are sent in the first chunk

## 0.0.54

### Patch Changes

- 26515cb: feat (ai/provider): introduce ProviderV1 specification
- Updated dependencies [26515cb]
  - @ai-sdk/provider@0.0.22
  - @ai-sdk/provider-utils@1.0.17

## 0.0.53

### Patch Changes

- Updated dependencies [09f895f]
  - @ai-sdk/provider-utils@1.0.16

## 0.0.52

### Patch Changes

- d5b6a15: feat (provider/openai): support partial usage information

## 0.0.51

### Patch Changes

- Updated dependencies [d67fa9c]
  - @ai-sdk/provider-utils@1.0.15

## 0.0.50

### Patch Changes

- Updated dependencies [f2c025e]
  - @ai-sdk/provider@0.0.21
  - @ai-sdk/provider-utils@1.0.14

## 0.0.49

### Patch Changes

- f42d9bd: fix (provider/openai): support OpenRouter streaming errors

## 0.0.48

### Patch Changes

- Updated dependencies [6ac355e]
  - @ai-sdk/provider@0.0.20
  - @ai-sdk/provider-utils@1.0.13

## 0.0.47

### Patch Changes

- 4ffbaee: fix (provider/openai): fix strict flag for structured outputs with tools
- dd712ac: fix: use FetchFunction type to prevent self-reference
- Updated dependencies [dd712ac]
  - @ai-sdk/provider-utils@1.0.12

## 0.0.46

### Patch Changes

- 89b18ca: fix (ai/provider): send finish reason 'unknown' by default
- Updated dependencies [dd4a0f5]
  - @ai-sdk/provider@0.0.19
  - @ai-sdk/provider-utils@1.0.11

## 0.0.45

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@1.0.10
  - @ai-sdk/provider@0.0.18

## 0.0.44

### Patch Changes

- 029af4c: feat (ai/core): support schema name & description in generateObject & streamObject
- Updated dependencies [029af4c]
  - @ai-sdk/provider@0.0.17
  - @ai-sdk/provider-utils@1.0.9

## 0.0.43

### Patch Changes

- d58517b: feat (ai/openai): structured outputs
- c0a73ee: feat (provider/openai): add gpt-4o-2024-08-06 to list of supported models
- Updated dependencies [d58517b]
  - @ai-sdk/provider@0.0.16
  - @ai-sdk/provider-utils@1.0.8

## 0.0.42

### Patch Changes

- Updated dependencies [96aed25]
  - @ai-sdk/provider@0.0.15
  - @ai-sdk/provider-utils@1.0.7

## 0.0.41

### Patch Changes

- 7a2eb27: feat (provider/openai): make role nullish to enhance provider support
- Updated dependencies
  - @ai-sdk/provider-utils@1.0.6

## 0.0.40

### Patch Changes

- Updated dependencies [a8d1c9e9]
  - @ai-sdk/provider-utils@1.0.5
  - @ai-sdk/provider@0.0.14

## 0.0.39

### Patch Changes

- Updated dependencies [4f88248f]
  - @ai-sdk/provider-utils@1.0.4

## 0.0.38

### Patch Changes

- 2b9da0f0: feat (core): support stopSequences setting.
- 909b9d27: feat (ai/openai): Support legacy function calls
- a5b58845: feat (core): support topK setting
- 4aa8deb3: feat (provider): support responseFormat setting in provider api
- 13b27ec6: chore (ai/core): remove grammar mode
- Updated dependencies
  - @ai-sdk/provider@0.0.13
  - @ai-sdk/provider-utils@1.0.3

## 0.0.37

### Patch Changes

- 89947fc5: chore (provider/openai): update model list for type-ahead support

## 0.0.36

### Patch Changes

- b7290943: feat (ai/core): add token usage to embed and embedMany
- Updated dependencies [b7290943]
  - @ai-sdk/provider@0.0.12
  - @ai-sdk/provider-utils@1.0.2

## 0.0.35

### Patch Changes

- Updated dependencies [d481729f]
  - @ai-sdk/provider-utils@1.0.1

## 0.0.34

### Patch Changes

- 5edc6110: feat (ai/core): add custom request header support
- Updated dependencies
  - @ai-sdk/provider@0.0.11
  - @ai-sdk/provider-utils@1.0.0

## 0.0.33

### Patch Changes

- Updated dependencies [02f6a088]
  - @ai-sdk/provider-utils@0.0.16

## 0.0.32

### Patch Changes

- 1b37b8b9: fix (@ai-sdk/openai): only send logprobs settings when logprobs are requested

## 0.0.31

### Patch Changes

- eba071dd: feat (@ai-sdk/azure): add azure openai completion support
- 1ea890fe: feat (@ai-sdk/azure): add azure openai completion support

## 0.0.30

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider-utils@0.0.15

## 0.0.29

### Patch Changes

- 4728c37f: feat (core): add text embedding model support to provider registry
- 7910ae84: feat (providers): support custom fetch implementations
- Updated dependencies [7910ae84]
  - @ai-sdk/provider-utils@0.0.14

## 0.0.28

### Patch Changes

- f9db8fd6: feat (@ai-sdk/openai): add parallelToolCalls setting

## 0.0.27

### Patch Changes

- fc9552ec: fix (@ai-sdk/azure): allow for nullish delta

## 0.0.26

### Patch Changes

- 7530f861: fix (@ai-sdk/openai): add internal dist to bundle

## 0.0.25

### Patch Changes

- 8b1362a7: chore (@ai-sdk/openai): expose models under /internal for reuse in other providers

## 0.0.24

### Patch Changes

- 0e78960c: fix (@ai-sdk/openai): make function name and arguments nullish

## 0.0.23

### Patch Changes

- a68fe74a: fix (@ai-sdk/openai): allow null tool_calls value.

## 0.0.22

### Patch Changes

- Updated dependencies [102ca22f]
  - @ai-sdk/provider@0.0.10
  - @ai-sdk/provider-utils@0.0.13

## 0.0.21

### Patch Changes

- fca7d026: feat (provider/openai): support streaming tool calls that are sent in one chunk
- Updated dependencies
  - @ai-sdk/provider@0.0.9
  - @ai-sdk/provider-utils@0.0.12

## 0.0.20

### Patch Changes

- a1d08f3e: fix (provider/openai): handle error chunks when streaming

## 0.0.19

### Patch Changes

- beb8b739: fix (provider/openai): return unknown finish reasons as unknown

## 0.0.18

### Patch Changes

- fb42e760: feat (provider/openai): send user message content as text when possible

## 0.0.17

### Patch Changes

- f39c0dd2: feat (provider): implement toolChoice support
- Updated dependencies [f39c0dd2]
  - @ai-sdk/provider@0.0.8
  - @ai-sdk/provider-utils@0.0.11

## 0.0.16

### Patch Changes

- 2b18fa11: fix (provider/openai): remove object type validation

## 0.0.15

### Patch Changes

- 24683b72: fix (providers): Zod is required dependency
- Updated dependencies [8e780288]
  - @ai-sdk/provider@0.0.7
  - @ai-sdk/provider-utils@0.0.10

## 0.0.14

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@0.0.6
  - @ai-sdk/provider-utils@0.0.9

## 0.0.13

### Patch Changes

- 4e3c922: fix (provider/openai): introduce compatibility mode in which "stream_options" are not sent

## 0.0.12

### Patch Changes

- 6f48839: feat (provider/openai): add gpt-4o to the list of supported models
- 1009594: feat (provider/openai): set stream_options/include_usage to true when streaming
- 0f6bc4e: feat (ai/core): add embed function
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

- 0833e19: Allow optional content to support Fireworks function calling.

## 0.0.6

### Patch Changes

- d6431ae: ai/core: add logprobs support (thanks @SamStenner for the contribution)
- 25f3350: ai/core: add support for getting raw response headers.
- Updated dependencies
  - @ai-sdk/provider@0.0.2
  - @ai-sdk/provider-utils@0.0.3

## 0.0.5

### Patch Changes

- eb150a6: ai/core: remove scaling of setting values (breaking change). If you were using the temperature, frequency penalty, or presence penalty settings, you need to update the providers and adjust the setting values.
- Updated dependencies [eb150a6]
  - @ai-sdk/provider-utils@0.0.2
  - @ai-sdk/provider@0.0.1

## 0.0.4

### Patch Changes

- c6fc35b: Add custom header and OpenAI project support.

## 0.0.3

### Patch Changes

- ab60b18: Simplified model construction by directly calling provider functions. Add create... functions to create provider instances.

## 0.0.2

### Patch Changes

- 2bff460: Fix build for release.

## 0.0.1

### Patch Changes

- 7b8791d: Support streams with 'chat.completion' objects.
- 7b8791d: Rename baseUrl to baseURL. Automatically remove trailing slashes.
- Updated dependencies [7b8791d]
  - @ai-sdk/provider-utils@0.0.1
