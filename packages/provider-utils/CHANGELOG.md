# @ai-sdk/provider-utils

## 5.0.5

### Patch Changes

- 5c5c0f5: Add experimental streaming transcription support for transcription models, including OpenAI `gpt-realtime-whisper` and xAI WebSocket STT.
- Updated dependencies [5c5c0f5]
  - @ai-sdk/provider@4.0.2

## 5.0.4

### Patch Changes

- c6f5e62: Prevent prototype pollution when synchronously parsing provider JSON inputs and expose `secureJsonParse` from provider-utils.

## 5.0.3

### Patch Changes

- 8c616f0: feat(mcp): add maxRetries option for failed mcp tool calls

## 5.0.2

### Patch Changes

- Updated dependencies [0274f34]
  - @ai-sdk/provider@4.0.1

## 5.0.1

### Patch Changes

- 6a436e3: Limit JSON response body reads in response handlers to prevent unbounded memory use.

## 5.0.0

### Major Changes

- 986c6fd: feat(ai): change type of experimental_context from unknown to generic
- b0c2869: chore(ai): remove deprecated `media` type part from `ToolResultOutput`
- f7d4f01: feat(provider): add support for `reasoning-file` type for files that are part of reasoning
- 776b617: feat(provider): adding new 'custom' content type
- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.
- 493295c: Remove the deprecated `ToolCallOptions` export.

  Use `ToolExecutionOptions` instead.

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

- 7e26e81: chore: rename experimental_context to context
- 8359612: Start v7 pre-release
- 5463d0d: feat(provider): align tool result output content file part types with top-level message file part types

### Patch Changes

- 2427d88: feat(ai): change Tool.sensitiveContext to telemetry.includeToolsContext and make it opt-in
- 785fe16: feat: distinguish provider-defined and provider-executed tools
- ee798eb: chore(provider-utils): rename `Experimental_Sandbox` to `Experimental_SandboxSession`
- 531251e: fix(security): validate redirect targets in download functions to prevent SSRF bypass

  Both `downloadBlob` and `download` now validate the final URL after following HTTP redirects, preventing attackers from bypassing SSRF protections via open redirects to internal/private addresses.

- 67df0a0: feat: add sensitiveContext property to Tool
- 105f95b: Ensure the default empty tool input schema includes `type: "object"` for OpenAI-compatible providers that require object schemas.
- eea8d98: refactoring: rename tool execution events
- d848405: feat: add optional `abortSignal` parameters to sandbox command execution
- 46d1149: chore(provider-utils,google): fix grammar errors in error and warning messages
- 1f509d4: fix(ai): force template check on 'kind' param
- ca446f8: feat: flexible tool descriptions
- 3ae1786: fix: better context type inference
- a7de9c9: fix: make sandbox experimental
- 9f0e36c: trigger release for all packages after provenance setup
- befb78c: refactoring: remove real-time delays in unit tests
- f634bac: feat(mcp): add new McpProviderMetadata type
- 2e17091: fix(types): move shared tool set utility types into provider-utils

  Moved `ToolSet`, `InferToolSetContext`, and `UnionToIntersection` into `@ai-sdk/provider-utils` and updated `ai` internals to import them directly from there. This keeps the shared tool typing utilities colocated with the core tool type definitions.

- ca39020: Add an optional `workingDirectory` parameter to sandbox command execution.
- 0458559: fix: deprecate needsApproval on Tool
- 5852c0a: refactoring(provider-utils): add controller as property to StreamingToolCallTracker
- 2e98477: fix: retain stack traces on async errors
- add1126: refactoring: executeTool uses tool as parameter
- aeda373: fix: only send provider credentials to same-origin response-supplied URLs

  Several provider clients followed a URL taken from the provider's API response (a polling/status URL or a final media URL such as `polling_url`, `urls.get`, `result_url`, `result.sample`, or `video.uri`) and reused the authenticated headers — or appended `?key=<API_KEY>` — on that request. Because the host of the response-supplied URL was never validated, the long-lived API key was sent to whatever host the response named (a CDN in the benign case, or an attacker-chosen host if the provider response was tampered with), allowing credential exfiltration.

  A new `isSameOrigin` helper is added to `@ai-sdk/provider-utils`, and the affected fetches in `@ai-sdk/black-forest-labs`, `@ai-sdk/fireworks`, `@ai-sdk/replicate`, `@ai-sdk/gladia`, `@ai-sdk/fal`, and `@ai-sdk/google` now attach credentials only when the followed URL is same-origin with the provider's configured API origin. Requests to a foreign origin are made without the credential.

- 350ea38: refactoring: introduce Arrayable type
- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- f807e45: Extract shared `StreamingToolCallTracker` class into `@ai-sdk/provider-utils` to deduplicate streaming tool call handling across OpenAI-compatible providers. Also adds missing `generateId()` fallback for `toolCallId` in Alibaba's `doGenerate` path and ensures all providers finalize unfinished tool calls during stream flush.
- 08d2129: feat(mcp): propagate the server name through dynamic tool parts
- 0c4c275: trigger initial canary release
- 6fd51c0: fix(provider): preserve error type prefix in getErrorMessage
- 69254e0: feat(ai): add toolMetadata for tool specific metdata
- 6c93e36: feat(provider-utils): add `spawnCommand` method to `Experimental_Sandbox` to allow for detached command execution
- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- 375fdd7: fix: harden download URL SSRF guard against hostname and redirect bypasses

  `validateDownloadUrl` and the file download helpers (`downloadBlob`, `download`) could be bypassed in several ways when handling untrusted URLs:

  - A fully-qualified hostname with a trailing dot (e.g. `localhost.`, `myhost.local.`) skipped the localhost/`.local` blocklist.
  - IPv6 addresses that embed an IPv4 address in their last 32 bits — IPv4-compatible (`::127.0.0.1`), IPv4-translated (`::ffff:0:127.0.0.1`), and NAT64 (`64:ff9b::127.0.0.1`, including the `64:ff9b:1::/48` local-use prefix) — were not decoded and checked against the private IPv4 ranges.
  - Redirects were validated only _after_ `fetch` had already followed them, so the request to a redirect target (e.g. an internal/metadata address) had already been issued before the check ran.
  - Several reserved/internal address ranges were not blocked: CGNAT (`100.64.0.0/10`, used by some cloud providers for internal traffic), benchmarking (`198.18.0.0/15`), IETF protocol assignments (`192.0.0.0/24`), the reserved `240.0.0.0/4` block (including the `255.255.255.255` broadcast address), and IPv6 site-local (`fec0::/10`) and multicast (`ff00::/8`).

  The validator now strips trailing dots before the hostname checks and fully expands IPv6 addresses to detect embedded private IPv4 targets. The download helpers now follow redirects manually (`redirect: 'manual'`), re-validating each hop before requesting it, so an unsafe redirect target is never fetched. When a redirect cannot be inspected because the runtime returns an opaque response, the helpers fail closed (reject the redirect) on the server; only in a real browser — where SSRF is not reachable (fetch is constrained by CORS and cannot reach a server's internal network or cloud-metadata endpoints) — is the redirect followed natively so legitimate redirected downloads keep working.

- b6783da: refactoring: restructure Tool types
- 3015fc3: feat: sandbox shell execution abstraction
- b8396f0: trigger initial beta release
- daf6637: feat(provider-utils): add `env` option to `spawn` and `run` methods of `Experimental_SandboxSession`
- a6617c5: feat(provider-utils): add `readFile` and `writeFile` plus convenience wrappers to `Experimental_Sandbox` abstraction
- 28dfa06: fix: support tools with optional context
- 083947b: feat(ai): separate toolsContext from context
- bae5e2b: fix(security): re-validate tool approvals from client message history before execution

  The approval-replay path in `generateText`/`streamText` (and `WorkflowAgent.stream`) reconstructed approved tool calls from the client-supplied messages array and executed them without re-validating input against the tool's schema or re-applying the approval policy. A client could forge an assistant message with a pre-approved tool-call part and have the server execute a tool with attacker-chosen arguments.

  The replay path now validates HMAC signature (when `experimental_toolApprovalSecret` is configured), re-validates tool-call input against the tool's input schema, and re-resolves the approval policy before execution.

- f617ac2: feat(provider-utils): narrow `tool()` return type to `ExecutableTool<...>` when `execute` is provided
- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling
- b4507d5: fix(provider-utils): cancel response body on download rejection to prevent socket leak

  When a download was rejected early — because the `Content-Length` header exceeded the size limit, the response status was not ok, or a redirect resolved to a blocked URL — the fetch response body was left unconsumed and uncancelled. With WHATWG Fetch/undici this leaves the underlying TCP socket open instead of returning it to the connection pool, allowing an attacker-controlled origin to exhaust file descriptors and cause a denial of service. The body is now cancelled on all early-rejection paths in `readResponseWithSizeLimit`, `download`, and `downloadBlob`, and `fetchWithValidatedRedirects` cancels each redirect hop's body before following or rejecting the next hop.

- e93fa91: rename Sandbox.executeCommand to Sandbox.runCommand
- fc92055: feat(ai): automatic tool approval
- b3976a2: Add workflow serialization support to all provider models.

  **`@ai-sdk/provider-utils`:** New `serializeModel()` helper that extracts only serializable properties from a model instance, filtering out functions and objects containing functions. Third-party provider authors can use this to add workflow support to their own models.

  **All providers:** `headers` is now optional in provider config types. This is non-breaking — existing code that passes `headers` continues to work. Custom provider implementations that construct model configs manually can now omit `headers`, which is useful when models are deserialized from a workflow step boundary where auth is provided separately.

  All provider model classes now include `WORKFLOW_SERIALIZE` and `WORKFLOW_DESERIALIZE` static methods, enabling them to cross workflow step boundaries without serialization errors.

- ff5eba1: feat: roll `image-*` tool output types into their equivalent `file-*` types

## 5.0.0-beta.50

### Patch Changes

- Updated dependencies [0416e3e]
  - @ai-sdk/provider@4.0.0-beta.20

## 5.0.0-beta.49

### Patch Changes

- b8396f0: trigger initial beta release
- Updated dependencies [b8396f0]
  - @ai-sdk/provider@4.0.0-beta.19

## 5.0.0-canary.48

### Patch Changes

- aeda373: fix: only send provider credentials to same-origin response-supplied URLs

  Several provider clients followed a URL taken from the provider's API response (a polling/status URL or a final media URL such as `polling_url`, `urls.get`, `result_url`, `result.sample`, or `video.uri`) and reused the authenticated headers — or appended `?key=<API_KEY>` — on that request. Because the host of the response-supplied URL was never validated, the long-lived API key was sent to whatever host the response named (a CDN in the benign case, or an attacker-chosen host if the provider response was tampered with), allowing credential exfiltration.

  A new `isSameOrigin` helper is added to `@ai-sdk/provider-utils`, and the affected fetches in `@ai-sdk/black-forest-labs`, `@ai-sdk/fireworks`, `@ai-sdk/replicate`, `@ai-sdk/gladia`, `@ai-sdk/fal`, and `@ai-sdk/google` now attach credentials only when the followed URL is same-origin with the provider's configured API origin. Requests to a foreign origin are made without the credential.

- 375fdd7: fix: harden download URL SSRF guard against hostname and redirect bypasses

  `validateDownloadUrl` and the file download helpers (`downloadBlob`, `download`) could be bypassed in several ways when handling untrusted URLs:

  - A fully-qualified hostname with a trailing dot (e.g. `localhost.`, `myhost.local.`) skipped the localhost/`.local` blocklist.
  - IPv6 addresses that embed an IPv4 address in their last 32 bits — IPv4-compatible (`::127.0.0.1`), IPv4-translated (`::ffff:0:127.0.0.1`), and NAT64 (`64:ff9b::127.0.0.1`, including the `64:ff9b:1::/48` local-use prefix) — were not decoded and checked against the private IPv4 ranges.
  - Redirects were validated only _after_ `fetch` had already followed them, so the request to a redirect target (e.g. an internal/metadata address) had already been issued before the check ran.
  - Several reserved/internal address ranges were not blocked: CGNAT (`100.64.0.0/10`, used by some cloud providers for internal traffic), benchmarking (`198.18.0.0/15`), IETF protocol assignments (`192.0.0.0/24`), the reserved `240.0.0.0/4` block (including the `255.255.255.255` broadcast address), and IPv6 site-local (`fec0::/10`) and multicast (`ff00::/8`).

  The validator now strips trailing dots before the hostname checks and fully expands IPv6 addresses to detect embedded private IPv4 targets. The download helpers now follow redirects manually (`redirect: 'manual'`), re-validating each hop before requesting it, so an unsafe redirect target is never fetched. When a redirect cannot be inspected because the runtime returns an opaque response, the helpers fail closed (reject the redirect) on the server; only in a real browser — where SSRF is not reachable (fetch is constrained by CORS and cannot reach a server's internal network or cloud-metadata endpoints) — is the redirect followed natively so legitimate redirected downloads keep working.

- b4507d5: fix(provider-utils): cancel response body on download rejection to prevent socket leak

  When a download was rejected early — because the `Content-Length` header exceeded the size limit, the response status was not ok, or a redirect resolved to a blocked URL — the fetch response body was left unconsumed and uncancelled. With WHATWG Fetch/undici this leaves the underlying TCP socket open instead of returning it to the connection pool, allowing an attacker-controlled origin to exhaust file descriptors and cause a denial of service. The body is now cancelled on all early-rejection paths in `readResponseWithSizeLimit`, `download`, and `downloadBlob`, and `fetchWithValidatedRedirects` cancels each redirect hop's body before following or rejecting the next hop.

## 5.0.0-canary.47

### Patch Changes

- bae5e2b: fix(security): re-validate tool approvals from client message history before execution

  The approval-replay path in `generateText`/`streamText` (and `WorkflowAgent.stream`) reconstructed approved tool calls from the client-supplied messages array and executed them without re-validating input against the tool's schema or re-applying the approval policy. A client could forge an assistant message with a pre-approved tool-call part and have the server execute a tool with attacker-chosen arguments.

  The replay path now validates HMAC signature (when `experimental_toolApprovalSecret` is configured), re-validates tool-call input against the tool's input schema, and re-resolves the approval policy before execution.

## 5.0.0-canary.46

### Patch Changes

- Updated dependencies [ce769dd]
  - @ai-sdk/provider@4.0.0-canary.18

## 5.0.0-canary.45

### Patch Changes

- ee798eb: chore(provider-utils): rename `Experimental_Sandbox` to `Experimental_SandboxSession`
- daf6637: feat(provider-utils): add `env` option to `spawn` and `run` methods of `Experimental_SandboxSession`

## 5.0.0-canary.44

### Patch Changes

- 6c93e36: feat(provider-utils): add `spawnCommand` method to `Experimental_Sandbox` to allow for detached command execution
- f617ac2: feat(provider-utils): narrow `tool()` return type to `ExecutableTool<...>` when `execute` is provided

## 5.0.0-canary.43

### Patch Changes

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- Updated dependencies [7fc6bd6]
  - @ai-sdk/provider@4.0.0-canary.17

## 5.0.0-canary.42

### Patch Changes

- a6617c5: feat(provider-utils): add `readFile` and `writeFile` plus convenience wrappers to `Experimental_Sandbox` abstraction

## 5.0.0-canary.41

### Patch Changes

- 28dfa06: fix: support tools with optional context
- e93fa91: rename Sandbox.executeCommand to Sandbox.runCommand

## 5.0.0-canary.40

### Patch Changes

- a7de9c9: fix: make sandbox experimental

## 5.0.0-canary.39

### Patch Changes

- 105f95b: Ensure the default empty tool input schema includes `type: "object"` for OpenAI-compatible providers that require object schemas.

## 5.0.0-canary.38

### Patch Changes

- ca446f8: feat: flexible tool descriptions

## 5.0.0-canary.37

### Patch Changes

- d848405: feat: add optional `abortSignal` parameters to sandbox command execution

## 5.0.0-canary.36

### Patch Changes

- ca39020: Add an optional `workingDirectory` parameter to sandbox command execution.

## 5.0.0-canary.35

### Patch Changes

- f634bac: feat(mcp): add new McpProviderMetadata type

## 5.0.0-canary.34

### Patch Changes

- 69254e0: feat(ai): add toolMetadata for tool specific metdata
- 3015fc3: feat: sandbox shell execution abstraction

## 5.0.0-canary.33

### Patch Changes

- 2427d88: feat(ai): change Tool.sensitiveContext to telemetry.includeToolsContext and make it opt-in

## 5.0.0-canary.32

### Major Changes

- 5463d0d: feat(provider): align tool result output content file part types with top-level message file part types

### Patch Changes

- Updated dependencies [5463d0d]
  - @ai-sdk/provider@4.0.0-canary.16

## 5.0.0-canary.31

### Patch Changes

- 0c4c275: trigger initial canary release
- Updated dependencies [0c4c275]
  - @ai-sdk/provider@4.0.0-canary.15

## 5.0.0-beta.30

### Patch Changes

- 08d2129: feat(mcp): propagate the server name through dynamic tool parts

## 5.0.0-beta.29

### Patch Changes

- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- b6783da: refactoring: restructure Tool types
- Updated dependencies [9bd6512]
- Updated dependencies [258c093]
  - @ai-sdk/provider@4.0.0-beta.14

## 5.0.0-beta.28

### Patch Changes

- 9f0e36c: trigger release for all packages after provenance setup
- Updated dependencies [9f0e36c]
  - @ai-sdk/provider@4.0.0-beta.13

## 5.0.0-beta.27

### Patch Changes

- 785fe16: feat: distinguish provider-defined and provider-executed tools
- 67df0a0: feat: add sensitiveContext property to Tool
- befb78c: refactoring: remove real-time delays in unit tests
- 0458559: fix: deprecate needsApproval on Tool
- 5852c0a: refactoring(provider-utils): add controller as property to StreamingToolCallTracker
- fc92055: feat(ai): automatic tool approval

## 5.0.0-beta.26

### Patch Changes

- 2e98477: fix: retain stack traces on async errors

## 5.0.0-beta.25

### Patch Changes

- eea8d98: refactoring: rename tool execution events

## 5.0.0-beta.24

### Patch Changes

- f807e45: Extract shared `StreamingToolCallTracker` class into `@ai-sdk/provider-utils` to deduplicate streaming tool call handling across OpenAI-compatible providers. Also adds missing `generateId()` fallback for `toolCallId` in Alibaba's `doGenerate` path and ensures all providers finalize unfinished tool calls during stream flush.

## 5.0.0-beta.23

### Patch Changes

- 350ea38: refactoring: introduce Arrayable type

## 5.0.0-beta.22

### Patch Changes

- 083947b: feat(ai): separate toolsContext from context

## 5.0.0-beta.21

### Patch Changes

- add1126: refactoring: executeTool uses tool as parameter

## 5.0.0-beta.20

### Patch Changes

- b3976a2: Add workflow serialization support to all provider models.

  **`@ai-sdk/provider-utils`:** New `serializeModel()` helper that extracts only serializable properties from a model instance, filtering out functions and objects containing functions. Third-party provider authors can use this to add workflow support to their own models.

  **All providers:** `headers` is now optional in provider config types. This is non-breaking — existing code that passes `headers` continues to work. Custom provider implementations that construct model configs manually can now omit `headers`, which is useful when models are deserialized from a workflow step boundary where auth is provided separately.

  All provider model classes now include `WORKFLOW_SERIALIZE` and `WORKFLOW_DESERIALIZE` static methods, enabling them to cross workflow step boundaries without serialization errors.

- ff5eba1: feat: roll `image-*` tool output types into their equivalent `file-*` types
- Updated dependencies [ff5eba1]
  - @ai-sdk/provider@4.0.0-beta.12

## 5.0.0-beta.19

### Major Changes

- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.

### Patch Changes

- Updated dependencies [ef992f8]
  - @ai-sdk/provider@4.0.0-beta.11

## 5.0.0-beta.18

### Patch Changes

- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling

## 5.0.0-beta.17

### Patch Changes

- 3ae1786: fix: better context type inference

## 5.0.0-beta.16

### Patch Changes

- Updated dependencies [176466a]
  - @ai-sdk/provider@4.0.0-beta.10

## 5.0.0-beta.15

### Patch Changes

- Updated dependencies [e311194]
  - @ai-sdk/provider@4.0.0-beta.9

## 5.0.0-beta.14

### Patch Changes

- Updated dependencies [34bd95d]
- Updated dependencies [008271d]
  - @ai-sdk/provider@4.0.0-beta.8

## 5.0.0-beta.13

### Major Changes

- 7e26e81: chore: rename experimental_context to context

### Patch Changes

- b0c2869: chore(ai): remove deprecated `media` type part from `ToolResultOutput`

## 5.0.0-beta.12

### Patch Changes

- 46d1149: chore(provider-utils,google): fix grammar errors in error and warning messages

## 5.0.0-beta.11

### Patch Changes

- 6fd51c0: fix(provider): preserve error type prefix in getErrorMessage
- Updated dependencies [6fd51c0]
  - @ai-sdk/provider@4.0.0-beta.7

## 5.0.0-beta.10

### Patch Changes

- c29a26f: feat(provider): add support for provider references and uploading files as supported per provider
- Updated dependencies [c29a26f]
  - @ai-sdk/provider@4.0.0-beta.6

## 5.0.0-beta.9

### Patch Changes

- 2e17091: fix(types): move shared tool set utility types into provider-utils

  Moved `ToolSet`, `InferToolSetContext`, and `UnionToIntersection` into `@ai-sdk/provider-utils` and updated `ai` internals to import them directly from there. This keeps the shared tool typing utilities colocated with the core tool type definitions.

## 5.0.0-beta.8

### Major Changes

- 986c6fd: feat(ai): change type of experimental_context from unknown to generic
- 493295c: Remove the deprecated `ToolCallOptions` export.

  Use `ToolExecutionOptions` instead.

## 5.0.0-beta.7

### Patch Changes

- 1f509d4: fix(ai): force template check on 'kind' param
- Updated dependencies [1f509d4]
  - @ai-sdk/provider@4.0.0-beta.5

## 5.0.0-beta.6

### Patch Changes

- 3887c70: feat(provider): add new top-level reasoning parameter to spec and support it in `generateText` and `streamText`
- Updated dependencies [3887c70]
  - @ai-sdk/provider@4.0.0-beta.4

## 5.0.0-beta.5

### Major Changes

- 776b617: feat(provider): adding new 'custom' content type

### Patch Changes

- Updated dependencies [776b617]
  - @ai-sdk/provider@4.0.0-beta.3

## 5.0.0-beta.4

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

## 5.0.0-beta.3

### Patch Changes

- f7d4f01: feat(provider): add support for `reasoning-file` type for files that are part of reasoning
- Updated dependencies [f7d4f01]
  - @ai-sdk/provider@4.0.0-beta.2

## 5.0.0-beta.2

### Patch Changes

- Updated dependencies [5c2a5a2]
  - @ai-sdk/provider@4.0.0-beta.1

## 5.0.0-beta.1

### Patch Changes

- 531251e: fix(security): validate redirect targets in download functions to prevent SSRF bypass

  Both `downloadBlob` and `download` now validate the final URL after following HTTP redirects, preventing attackers from bypassing SSRF protections via open redirects to internal/private addresses.

## 5.0.0-beta.0

### Major Changes

- 8359612: Start v7 pre-release

### Patch Changes

- Updated dependencies [8359612]
  - @ai-sdk/provider@4.0.0-beta.0

## 4.0.19

### Patch Changes

- ad4cfc2: Add URL validation to `downloadBlob` and `download` to prevent blind SSRF attacks. Private/internal IP addresses, localhost, and non-HTTP protocols are now rejected before fetching.

## 4.0.18

### Patch Changes

- 824b295: fix(provider-utils): prevent unicode escape bypass in secureJsonParse

## 4.0.17

### Patch Changes

- 08336f1: fix(bedrock): strip file extensions from filename

## 4.0.16

### Patch Changes

- 58bc42d: feat(provider/openai): support custom tools with alias mapping

## 4.0.15

### Patch Changes

- 4024a3a: security: prevent unbounded memory growth in download functions

  The `download()` and `downloadBlob()` functions now enforce a default 2 GiB size limit when downloading from user-provided URLs. Downloads that exceed this limit are aborted with a `DownloadError` instead of consuming unbounded memory and crashing the process. The `abortSignal` parameter is now passed through to `fetch()` in all download call sites.

  Added `download` option to `transcribe()` and `experimental_generateVideo()` for providing a custom download function. Use the new `createDownload({ maxBytes })` factory to configure download size limits.

## 4.0.14

### Patch Changes

- Updated dependencies [7168375]
  - @ai-sdk/provider@3.0.8

## 4.0.13

### Patch Changes

- Updated dependencies [53f6731]
  - @ai-sdk/provider@3.0.7

## 4.0.12

### Patch Changes

- 96936e5: fix(provider-utils): export only types from standard-schema package

## 4.0.11

### Patch Changes

- 2810850: fix(ai): improve type validation error messages with field paths and entity identifiers
- Updated dependencies [2810850]
  - @ai-sdk/provider@3.0.6

## 4.0.10

### Patch Changes

- 462ad00: fix(provider-utils): recognize bun fetch errors as retryable

## 4.0.9

### Patch Changes

- 4de5a1d: chore: excluded tests from src folder in npm package
- Updated dependencies [4de5a1d]
  - @ai-sdk/provider@3.0.5

## 4.0.8

### Patch Changes

- Updated dependencies [5c090e7]
  - @ai-sdk/provider@3.0.4

## 4.0.7

### Patch Changes

- 46f46e4: fix(provider-utils): improve tool type inference when using `inputExamples` with Zod schemas that use `.optional().default()` or `.refine()`.

## 4.0.6

### Patch Changes

- 1b11dcb: chore(ai): include sources in npm package
- Updated dependencies [1b11dcb]
  - @ai-sdk/provider@3.0.3

## 4.0.5

### Patch Changes

- 34d1c8a: fix(provider-utils): add additionalProperties field for standard schema function

## 4.0.4

### Patch Changes

- Updated dependencies [d937c8f]
  - @ai-sdk/provider@3.0.2

## 4.0.3

### Patch Changes

- 0b429d4: fix(provider-utils): handle anyOf/allOf/oneOf and definitions in addAdditionalPropertiesToJsonSchema

## 4.0.2

### Patch Changes

- 863d34f: fix: trigger release to update `@latest`
- Updated dependencies [863d34f]
  - @ai-sdk/provider@3.0.1

## 4.0.1

### Patch Changes

- 29264a3: feat: add MCP tool approval

## 4.0.0

### Major Changes

- dee8b05: ai SDK 6 beta

### Minor Changes

- 78928cb: release: start 5.1 beta

### Patch Changes

- 0adc679: feat(provider): shared spec v3
- 50b70d6: feat(anthropic): add programmatic tool calling
- dce03c4: feat: tool input examples
- 3b1d015: feat(ai): Effect schema support
- 95f65c2: chore: use import \* from zod/v4
- 016b111: fix(provider-utils): make ReadableStream.cancel() properly finalize async iterators
- 58920e0: refactor: consolidate header normalization across packages, remove duplicates, preserve custom headers
- 954c356: feat(openai): allow custom names for provider-defined tools
- 544d4e8: chore(specification): rename v3 provider defined tool to provider tool
- 521c537: feat(ai): Tool.needsApproval can be a function
- e8109d3: feat: tool execution approval
- 03849b0: move DelayedPromise into provider utils
- e06565c: feat(provider-utils): add needsApproval support to provider-defined tools
- 32d8dbb: fix(provider-utils): compatibility with V8 readonly execution environment
- d116b4b: feat(ai): arktype support
- 293a6b7: Added a title to the tools
- 703459a: feat: tool execution approval for dynamic tools
- 83e5744: feat: support async Tool.toModelOutput
- 7e32fea: feat(ai): valibot support
- 3ed5519: chore: rename ToolCallOptions to ToolExecutionOptions
- 8dac895: feat: `LanguageModelV3`
- cbb1d35: Update for provider-util changeset after change in PR #8588
- 9061dc0: feat: image editing
- 32223c8: feat: add toolCallId arg to toModelOutput
- c1efac4: feat: add input arg to toModelOutput
- 4616b86: chore: update zod peer depenedency version
- 4f16c37: chore(provider-utils): upgrade eventsource-parser to 3.0.6
- 81e29ab: chore: update docs
- 6306603: chore: replace Validator with Schema
- fca786b: feat(provider-utils): add MaybePromiseLike type
- 763d04a: feat: Standard JSON Schema support
- 3794514: feat: flexible tool output content support
- e9e157f: fix: generate zod4 json schema from input schema
- 960ec8f: chore: change argument of toModelOutput to parameter object
- 1bd7d32: feat: tool-specific strict mode
- f0b2157: fix: revert zod import change
- 95f65c2: chore: load zod schemas lazily
- Updated dependencies
  - @ai-sdk/provider@3.0.0

## 4.0.0-beta.59

### Patch Changes

- Updated dependencies [475189e]
  - @ai-sdk/provider@3.0.0-beta.32

## 4.0.0-beta.58

### Patch Changes

- Updated dependencies [2625a04]
  - @ai-sdk/provider@3.0.0-beta.31

## 4.0.0-beta.57

### Patch Changes

- Updated dependencies [cbf52cd]
  - @ai-sdk/provider@3.0.0-beta.30

## 4.0.0-beta.56

### Patch Changes

- Updated dependencies [9549c9e]
  - @ai-sdk/provider@3.0.0-beta.29

## 4.0.0-beta.55

### Patch Changes

- 50b70d6: feat(anthropic): add programmatic tool calling

## 4.0.0-beta.54

### Patch Changes

- 9061dc0: feat: image editing
- Updated dependencies [9061dc0]
  - @ai-sdk/provider@3.0.0-beta.28

## 4.0.0-beta.53

### Patch Changes

- Updated dependencies [366f50b]
  - @ai-sdk/provider@3.0.0-beta.27

## 4.0.0-beta.52

### Patch Changes

- 763d04a: feat: Standard JSON Schema support

## 4.0.0-beta.51

### Patch Changes

- c1efac4: feat: add input arg to toModelOutput

## 4.0.0-beta.50

### Patch Changes

- 32223c8: feat: add toolCallId arg to toModelOutput

## 4.0.0-beta.49

### Patch Changes

- 83e5744: feat: support async Tool.toModelOutput

## 4.0.0-beta.48

### Patch Changes

- 960ec8f: chore: change argument of toModelOutput to parameter object

## 4.0.0-beta.47

### Patch Changes

- e9e157f: fix: generate zod4 json schema from input schema

## 4.0.0-beta.46

### Patch Changes

- 81e29ab: chore: update docs

## 4.0.0-beta.45

### Patch Changes

- Updated dependencies [3bd2689]
  - @ai-sdk/provider@3.0.0-beta.26

## 4.0.0-beta.44

### Patch Changes

- Updated dependencies [53f3368]
  - @ai-sdk/provider@3.0.0-beta.25

## 4.0.0-beta.43

### Patch Changes

- dce03c4: feat: tool input examples
- Updated dependencies [dce03c4]
  - @ai-sdk/provider@3.0.0-beta.24

## 4.0.0-beta.42

### Patch Changes

- 3ed5519: chore: rename ToolCallOptions to ToolExecutionOptions

## 4.0.0-beta.41

### Patch Changes

- 1bd7d32: feat: tool-specific strict mode
- Updated dependencies [1bd7d32]
  - @ai-sdk/provider@3.0.0-beta.23

## 4.0.0-beta.40

### Patch Changes

- 544d4e8: chore(specification): rename v3 provider defined tool to provider tool
- Updated dependencies [544d4e8]
  - @ai-sdk/provider@3.0.0-beta.22

## 4.0.0-beta.39

### Patch Changes

- 954c356: feat(openai): allow custom names for provider-defined tools
- Updated dependencies [954c356]
  - @ai-sdk/provider@3.0.0-beta.21

## 4.0.0-beta.38

### Patch Changes

- 03849b0: move DelayedPromise into provider utils

## 4.0.0-beta.37

### Patch Changes

- Updated dependencies [457318b]
  - @ai-sdk/provider@3.0.0-beta.20

## 4.0.0-beta.36

### Patch Changes

- Updated dependencies [8d9e8ad]
  - @ai-sdk/provider@3.0.0-beta.19

## 4.0.0-beta.35

### Patch Changes

- Updated dependencies [10d819b]
  - @ai-sdk/provider@3.0.0-beta.18

## 4.0.0-beta.34

### Patch Changes

- Updated dependencies [db913bd]
  - @ai-sdk/provider@3.0.0-beta.17

## 4.0.0-beta.33

### Patch Changes

- Updated dependencies [b681d7d]
  - @ai-sdk/provider@3.0.0-beta.16

## 4.0.0-beta.32

### Patch Changes

- 32d8dbb: fix(provider-utils): compatibility with V8 readonly execution environment

## 4.0.0-beta.31

### Patch Changes

- Updated dependencies [bb36798]
  - @ai-sdk/provider@3.0.0-beta.15

## 4.0.0-beta.30

### Patch Changes

- 4f16c37: chore(provider-utils): upgrade eventsource-parser to 3.0.6

## 4.0.0-beta.29

### Patch Changes

- Updated dependencies [af3780b]
  - @ai-sdk/provider@3.0.0-beta.14

## 4.0.0-beta.28

### Patch Changes

- 016b111: fix(provider-utils): make ReadableStream.cancel() properly finalize async iterators

## 4.0.0-beta.27

### Patch Changes

- Updated dependencies [37c58a0]
  - @ai-sdk/provider@3.0.0-beta.13

## 4.0.0-beta.26

### Patch Changes

- Updated dependencies [d1bdadb]
  - @ai-sdk/provider@3.0.0-beta.12

## 4.0.0-beta.25

### Patch Changes

- Updated dependencies [4c44a5b]
  - @ai-sdk/provider@3.0.0-beta.11

## 4.0.0-beta.24

### Patch Changes

- Updated dependencies [0c3b58b]
  - @ai-sdk/provider@3.0.0-beta.10

## 4.0.0-beta.23

### Patch Changes

- Updated dependencies [a755db5]
  - @ai-sdk/provider@3.0.0-beta.9

## 4.0.0-beta.22

### Patch Changes

- 58920e0: refactor: consolidate header normalization across packages, remove duplicates, preserve custom headers

## 4.0.0-beta.21

### Patch Changes

- 293a6b7: Added a title to the tools

## 4.0.0-beta.20

### Patch Changes

- fca786b: feat(provider-utils): add MaybePromiseLike type

## 4.0.0-beta.19

### Patch Changes

- 3794514: feat: flexible tool output content support
- Updated dependencies [3794514]
  - @ai-sdk/provider@3.0.0-beta.8

## 4.0.0-beta.18

### Patch Changes

- Updated dependencies [81d4308]
  - @ai-sdk/provider@3.0.0-beta.7

## 4.0.0-beta.17

### Patch Changes

- 703459a: feat: tool execution approval for dynamic tools

## 4.0.0-beta.16

### Patch Changes

- 6306603: chore: replace Validator with Schema

## 4.0.0-beta.15

### Patch Changes

- f0b2157: fix: revert zod import change

## 4.0.0-beta.14

### Patch Changes

- 3b1d015: feat(ai): Effect schema support

## 4.0.0-beta.13

### Patch Changes

- d116b4b: feat(ai): arktype support

## 4.0.0-beta.12

### Patch Changes

- 7e32fea: feat(ai): valibot support

## 4.0.0-beta.11

### Patch Changes

- 95f65c2: chore: use import \* from zod/v4
- 95f65c2: chore: load zod schemas lazily

## 4.0.0-beta.10

### Major Changes

- dee8b05: ai SDK 6 beta

### Patch Changes

- Updated dependencies [dee8b05]
  - @ai-sdk/provider@3.0.0-beta.6

## 3.1.0-beta.9

### Patch Changes

- 521c537: feat(ai): Tool.needsApproval can be a function

## 3.1.0-beta.8

### Patch Changes

- e06565c: feat(provider-utils): add needsApproval support to provider-defined tools

## 3.1.0-beta.7

### Patch Changes

- e8109d3: feat: tool execution approval
- Updated dependencies
  - @ai-sdk/provider@2.1.0-beta.5

## 3.1.0-beta.6

### Patch Changes

- 0adc679: feat(provider): shared spec v3
- Updated dependencies
  - @ai-sdk/provider@2.1.0-beta.4

## 3.1.0-beta.5

### Patch Changes

- 8dac895: feat: `LanguageModelV3`
- Updated dependencies [8dac895]
  - @ai-sdk/provider@2.1.0-beta.3

## 3.1.0-beta.4

### Patch Changes

- 4616b86: chore: update zod peer depenedency version

## 3.1.0-beta.3

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.1.0-beta.2

## 3.1.0-beta.2

### Patch Changes

- Updated dependencies [0c4822d]
  - @ai-sdk/provider@2.1.0-beta.1

## 3.1.0-beta.1

### Patch Changes

- cbb1d35: Update for provider-util changeset after change in PR #8588

## 3.1.0-beta.0

### Minor Changes

- 78928cb: release: start 5.1 beta

### Patch Changes

- Updated dependencies [78928cb]
  - @ai-sdk/provider@2.1.0-beta.0

## 3.0.9

### Patch Changes

- 0294b58: feat(ai): set `ai`, `@ai-sdk/provider-utils`, and runtime in `user-agent` header

## 3.0.8

### Patch Changes

- 99964ed: fix(provider-utils): fix type inference for toModelOutput

## 3.0.7

### Patch Changes

- 886e7cd: chore(provider-utils): upgrade event-source parser to 3.0.5

## 3.0.6

### Patch Changes

- 1b5a3d3: chore(provider-util): integrate zod-to-json-schema

## 3.0.5

### Patch Changes

- 0857788: fix(provider/groq): `experimental_transcribe` fails with valid Buffer

## 3.0.4

### Patch Changes

- 68751f9: fix(provider-utils): add inject json utility function

## 3.0.3

### Patch Changes

- 034e229: fix(provider/utils): fix FlexibleSchema type inference with zod/v3
- f25040d: fix(provider-utils): fix tools type inference

## 3.0.2

### Patch Changes

- 38ac190: feat(ai): preliminary tool results

## 3.0.1

### Patch Changes

- 90d212f: feat (ai): add experimental tool call context

## 3.0.0

### Major Changes

- 5d142ab: remove deprecated `CoreToolCall` and `CoreToolResult` types
- d5f588f: AI SDK 5
- e025824: refactoring (ai): restructure provider-defined tools
- 40acf9b: feat (ui): introduce ChatStore and ChatTransport
- 957b739: chore (provider-utils): rename TestServerCall.requestBody to requestBodyJson
- ea7a7c9: feat (ui): UI message metadata
- 41fa418: chore (provider-utils): return IdGenerator interface
- 71f938d: feat (ai): add output schema for tools

### Patch Changes

- a571d6e: chore(provider-utils): move ToolResultContent to provider-utils
- e7fcc86: feat (ai): introduce dynamic tools
- 45c1ea2: refactoring: introduce FlexibleSchema
- 060370c: feat(provider-utils): add TestServerCall#requestCredentials
- 0571b98: chore (provider-utils): update eventsource-parser to 3.0.3
- 4fef487: feat: support for zod v4 for schema validation

  All these methods now accept both a zod v4 and zod v3 schemas for validation:

  - `generateObject()`
  - `streamObject()`
  - `generateText()`
  - `experimental_useObject()` from `@ai-sdk/react`
  - `streamUI()` from `@ai-sdk/rsc`

- 0c0c0b3: refactor (provider-utils): move `customAlphabet()` method from `nanoid` into codebase
- 8ba77a7: chore (provider-utils): use eventsource-parser library
- a166433: feat: add transcription with experimental_transcribe
- 9f95b35: refactor (provider-utils): copy relevant code from `secure-json-parse` into codebase
- 66962ed: fix(packages): export node10 compatible types
- 05d2819: feat: allow zod 4.x as peer dependency
- ac34802: Add clear object function to StructuredObject
- 63d791d: chore (utils): remove unused test helpers
- 87b828f: fix(provider-utils): fix SSE parser bug (CRLF)
- bfdca8d: feat (ai): add InferToolInput and InferToolOutput helpers
- 0ff02bb: chore(provider-utils): move over jsonSchema
- 39a4fab: fix (provider-utils): detect failed fetch in browser environments
- 57edfcb: Adds support for async zod validators
- faf8446: chore (provider-utils): switch to standard-schema
- d1a034f: feature: using Zod 4 for internal stuff
- 88a8ee5: fix (ai): support abort during retry waits
- 205077b: fix: improve Zod compatibility
- 28a5ed5: refactoring: move tools helper into provider-utils
- dd5fd43: feat (ai): support dynamic tools in Chat onToolCall
- 383cbfa: feat (ai): add isAborted to onFinish callback for ui message streams
- Updated dependencies
  - @ai-sdk/provider@2.0.0

## 3.0.0-beta.10

### Patch Changes

- 88a8ee5: fix (ai): support abort during retry waits

## 3.0.0-beta.9

### Patch Changes

- Updated dependencies [27deb4d]
  - @ai-sdk/provider@2.0.0-beta.2

## 3.0.0-beta.8

### Patch Changes

- dd5fd43: feat (ai): support dynamic tools in Chat onToolCall

## 3.0.0-beta.7

### Patch Changes

- e7fcc86: feat (ai): introduce dynamic tools

## 3.0.0-beta.6

### Patch Changes

- ac34802: Add clear object function to StructuredObject

## 3.0.0-beta.5

### Patch Changes

- 57edfcb: Adds support for async zod validators
- 383cbfa: feat (ai): add isAborted to onFinish callback for ui message streams

## 3.0.0-beta.4

### Patch Changes

- 205077b: fix: improve Zod compatibility

## 3.0.0-beta.3

### Patch Changes

- 05d2819: feat: allow zod 4.x as peer dependency

## 3.0.0-beta.2

### Patch Changes

- 0571b98: chore (provider-utils): update eventsource-parser to 3.0.3
- 39a4fab: fix (provider-utils): detect failed fetch in browser environments
- d1a034f: feature: using Zod 4 for internal stuff

## 3.0.0-beta.1

### Major Changes

- e025824: refactoring (ai): restructure provider-defined tools
- 71f938d: feat (ai): add output schema for tools

### Patch Changes

- 45c1ea2: refactoring: introduce FlexibleSchema
- bfdca8d: feat (ai): add InferToolInput and InferToolOutput helpers
- 28a5ed5: refactoring: move tools helper into provider-utils
- Updated dependencies
  - @ai-sdk/provider@2.0.0-beta.1

## 3.0.0-alpha.15

### Patch Changes

- 8ba77a7: chore (provider-utils): use eventsource-parser library
- Updated dependencies [48d257a]
  - @ai-sdk/provider@2.0.0-alpha.15

## 3.0.0-alpha.14

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-alpha.14

## 3.0.0-alpha.13

### Patch Changes

- Updated dependencies [68ecf2f]
  - @ai-sdk/provider@2.0.0-alpha.13

## 3.0.0-alpha.12

### Patch Changes

- Updated dependencies [e2aceaf]
  - @ai-sdk/provider@2.0.0-alpha.12

## 3.0.0-alpha.11

### Patch Changes

- Updated dependencies [c1e6647]
  - @ai-sdk/provider@2.0.0-alpha.11

## 3.0.0-alpha.10

### Patch Changes

- Updated dependencies [c4df419]
  - @ai-sdk/provider@2.0.0-alpha.10

## 3.0.0-alpha.9

### Patch Changes

- Updated dependencies [811dff3]
  - @ai-sdk/provider@2.0.0-alpha.9

## 3.0.0-alpha.8

### Patch Changes

- 4fef487: feat: support for zod v4 for schema validation

  All these methods now accept both a zod v4 and zod v3 schemas for validation:

  - `generateObject()`
  - `streamObject()`
  - `generateText()`
  - `experimental_useObject()` from `@ai-sdk/react`
  - `streamUI()` from `@ai-sdk/rsc`

- Updated dependencies [9222aeb]
  - @ai-sdk/provider@2.0.0-alpha.8

## 3.0.0-alpha.7

### Patch Changes

- Updated dependencies [5c56081]
  - @ai-sdk/provider@2.0.0-alpha.7

## 3.0.0-alpha.6

### Patch Changes

- Updated dependencies [0d2c085]
  - @ai-sdk/provider@2.0.0-alpha.6

## 3.0.0-alpha.4

### Patch Changes

- Updated dependencies [dc714f3]
  - @ai-sdk/provider@2.0.0-alpha.4

## 3.0.0-alpha.3

### Patch Changes

- Updated dependencies [6b98118]
  - @ai-sdk/provider@2.0.0-alpha.3

## 3.0.0-alpha.2

### Patch Changes

- Updated dependencies [26535e0]
  - @ai-sdk/provider@2.0.0-alpha.2

## 3.0.0-alpha.1

### Patch Changes

- Updated dependencies [3f2f00c]
  - @ai-sdk/provider@2.0.0-alpha.1

## 3.0.0-canary.19

### Patch Changes

- faf8446: chore (provider-utils): switch to standard-schema

## 3.0.0-canary.18

### Major Changes

- 40acf9b: feat (ui): introduce ChatStore and ChatTransport

## 3.0.0-canary.17

### Major Changes

- ea7a7c9: feat (ui): UI message metadata

## 3.0.0-canary.16

### Patch Changes

- 87b828f: fix(provider-utils): fix SSE parser bug (CRLF)

## 3.0.0-canary.15

### Major Changes

- 41fa418: chore (provider-utils): return IdGenerator interface

### Patch Changes

- a571d6e: chore(provider-utils): move ToolResultContent to provider-utils
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.14

## 3.0.0-canary.14

### Major Changes

- 957b739: chore (provider-utils): rename TestServerCall.requestBody to requestBodyJson

### Patch Changes

- Updated dependencies [9bd5ab5]
  - @ai-sdk/provider@2.0.0-canary.13

## 3.0.0-canary.13

### Patch Changes

- 0ff02bb: chore(provider-utils): move over jsonSchema
- Updated dependencies [7b3ae3f]
  - @ai-sdk/provider@2.0.0-canary.12

## 3.0.0-canary.12

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.11

## 3.0.0-canary.11

### Patch Changes

- 66962ed: fix(packages): export node10 compatible types
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.10

## 3.0.0-canary.10

### Patch Changes

- Updated dependencies [e86be6f]
  - @ai-sdk/provider@2.0.0-canary.9

## 3.0.0-canary.9

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.8

## 3.0.0-canary.8

### Major Changes

- 5d142ab: remove deprecated `CoreToolCall` and `CoreToolResult` types

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.7

## 3.0.0-canary.7

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.6

## 3.0.0-canary.6

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.5

## 3.0.0-canary.5

### Patch Changes

- Updated dependencies [6f6bb89]
  - @ai-sdk/provider@2.0.0-canary.4

## 3.0.0-canary.4

### Patch Changes

- Updated dependencies [d1a1aa1]
  - @ai-sdk/provider@2.0.0-canary.3

## 3.0.0-canary.3

### Patch Changes

- a166433: feat: add transcription with experimental_transcribe
- 9f95b35: refactor (provider-utils): copy relevant code from `secure-json-parse` into codebase
- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.2

## 3.0.0-canary.2

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.0.0-canary.1

## 3.0.0-canary.1

### Patch Changes

- 060370c: feat(provider-utils): add TestServerCall#requestCredentials
- 0c0c0b3: refactor (provider-utils): move `customAlphabet()` method from `nanoid` into codebase
- 63d791d: chore (utils): remove unused test helpers

## 3.0.0-canary.0

### Major Changes

- d5f588f: AI SDK 5

### Patch Changes

- Updated dependencies [d5f588f]
  - @ai-sdk/provider@2.0.0-canary.0

## 2.2.3

### Patch Changes

- 28be004: chore (provider-utils): add error method to TestStreamController

## 2.2.2

### Patch Changes

- b01120e: chore (provider-utils): update unified test server

## 2.2.1

### Patch Changes

- f10f0fa: fix (provider-utils): improve event source stream parsing performance

## 2.2.0

### Minor Changes

- 5bc638d: AI SDK 4.2

### Patch Changes

- Updated dependencies [5bc638d]
  - @ai-sdk/provider@1.1.0

## 2.1.15

### Patch Changes

- d0c4659: feat (provider-utils): parseProviderOptions function

## 2.1.14

### Patch Changes

- Updated dependencies [0bd5bc6]
  - @ai-sdk/provider@1.0.12

## 2.1.13

### Patch Changes

- Updated dependencies [2e1101a]
  - @ai-sdk/provider@1.0.11

## 2.1.12

### Patch Changes

- 1531959: feat (provider-utils): add readable-stream to unified test server

## 2.1.11

### Patch Changes

- Updated dependencies [e1d3d42]
  - @ai-sdk/provider@1.0.10

## 2.1.10

### Patch Changes

- Updated dependencies [ddf9740]
  - @ai-sdk/provider@1.0.9

## 2.1.9

### Patch Changes

- Updated dependencies [2761f06]
  - @ai-sdk/provider@1.0.8

## 2.1.8

### Patch Changes

- 2e898b4: chore (ai): move mockId test helper into provider utils

## 2.1.7

### Patch Changes

- 3ff4ef8: feat (provider-utils): export removeUndefinedEntries for working with e.g. headers

## 2.1.6

### Patch Changes

- Updated dependencies [d89c3b9]
  - @ai-sdk/provider@1.0.7

## 2.1.5

### Patch Changes

- 3a602ca: chore (core): rename CoreTool to Tool

## 2.1.4

### Patch Changes

- 066206e: feat (provider-utils): move delay to provider-utils from ai

## 2.1.3

### Patch Changes

- 39e5c1f: feat (provider-utils): add getFromApi and response handlers for binary responses and status-code errors

## 2.1.2

### Patch Changes

- ed012d2: feat (provider): add metadata extraction mechanism to openai-compatible providers
- Updated dependencies [3a58a2e]
  - @ai-sdk/provider@1.0.6

## 2.1.1

### Patch Changes

- e7a9ec9: feat (provider-utils): include raw value in json parse results
- Updated dependencies [0a699f1]
  - @ai-sdk/provider@1.0.5

## 2.1.0

### Minor Changes

- 62ba5ad: release: AI SDK 4.1

## 2.0.8

### Patch Changes

- 00114c5: feat: expose IDGenerator and createIdGenerator

## 2.0.7

### Patch Changes

- 90fb95a: chore (provider-utils): switch to unified test server
- e6dfef4: feat (provider/fireworks): Support add'l image models.
- 6636db6: feat (provider-utils): add unified test server

## 2.0.6

### Patch Changes

- 19a2ce7: feat (provider/fireworks): Add image model support.
- 6337688: feat: change image generation errors to warnings
- Updated dependencies
  - @ai-sdk/provider@1.0.4

## 2.0.5

### Patch Changes

- 5ed5e45: chore (config): Use ts-library.json tsconfig for no-UI libs.
- Updated dependencies [5ed5e45]
  - @ai-sdk/provider@1.0.3

## 2.0.4

### Patch Changes

- Updated dependencies [09a9cab]
  - @ai-sdk/provider@1.0.2

## 2.0.3

### Patch Changes

- 0984f0b: feat (provider-utils): Add resolvable type and utility routine.

## 2.0.2

### Patch Changes

- Updated dependencies [b446ae5]
  - @ai-sdk/provider@1.0.1

## 2.0.1

### Patch Changes

- c3ab5de: fix (provider-utils): downgrade nanoid and secure-json-parse (ESM compatibility)

## 2.0.0

### Major Changes

- b469a7e: chore: remove isXXXError methods
- b1da952: chore (provider-utils): remove convertStreamToArray
- 8426f55: chore (ai):increase id generator default size from 7 to 16.
- db46ce5: chore (provider-utils): remove isParseableJson export

### Patch Changes

- dce4158: chore (dependencies): update eventsource-parser to 3.0.0
- dce4158: chore (dependencies): update nanoid to 5.0.8
- Updated dependencies
  - @ai-sdk/provider@1.0.0

## 2.0.0-canary.3

### Major Changes

- 8426f55: chore (ai):increase id generator default size from 7 to 16.

## 2.0.0-canary.2

### Patch Changes

- dce4158: chore (dependencies): update eventsource-parser to 3.0.0
- dce4158: chore (dependencies): update nanoid to 5.0.8

## 2.0.0-canary.1

### Major Changes

- b1da952: chore (provider-utils): remove convertStreamToArray

## 2.0.0-canary.0

### Major Changes

- b469a7e: chore: remove isXXXError methods
- db46ce5: chore (provider-utils): remove isParseableJson export

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@1.0.0-canary.0

## 1.0.22

### Patch Changes

- aa98cdb: chore: more flexible dependency versioning
- 7b937c5: feat (provider-utils): improve id generator robustness
- 811a317: feat (ai/core): multi-part tool results (incl. images)
- Updated dependencies
  - @ai-sdk/provider@0.0.26

## 1.0.21

### Patch Changes

- Updated dependencies [b9b0d7b]
  - @ai-sdk/provider@0.0.25

## 1.0.20

### Patch Changes

- Updated dependencies [d595d0d]
  - @ai-sdk/provider@0.0.24

## 1.0.19

### Patch Changes

- 273f696: fix (ai/provider-utils): expose size argument in generateId

## 1.0.18

### Patch Changes

- 03313cd: feat (ai): expose response id, response model, response timestamp in telemetry and api
- Updated dependencies
  - @ai-sdk/provider@0.0.23

## 1.0.17

### Patch Changes

- Updated dependencies [26515cb]
  - @ai-sdk/provider@0.0.22

## 1.0.16

### Patch Changes

- 09f895f: feat (ai/core): no-schema output for generateObject / streamObject

## 1.0.15

### Patch Changes

- d67fa9c: feat (provider/amazon-bedrock): add support for session tokens

## 1.0.14

### Patch Changes

- Updated dependencies [f2c025e]
  - @ai-sdk/provider@0.0.21

## 1.0.13

### Patch Changes

- Updated dependencies [6ac355e]
  - @ai-sdk/provider@0.0.20

## 1.0.12

### Patch Changes

- dd712ac: fix: use FetchFunction type to prevent self-reference

## 1.0.11

### Patch Changes

- Updated dependencies [dd4a0f5]
  - @ai-sdk/provider@0.0.19

## 1.0.10

### Patch Changes

- 4bd27a9: chore (ai/provider): refactor type validation
- 845754b: fix (ai/provider): fix atob/btoa execution on cloudflare edge workers
- Updated dependencies [4bd27a9]
  - @ai-sdk/provider@0.0.18

## 1.0.9

### Patch Changes

- Updated dependencies [029af4c]
  - @ai-sdk/provider@0.0.17

## 1.0.8

### Patch Changes

- Updated dependencies [d58517b]
  - @ai-sdk/provider@0.0.16

## 1.0.7

### Patch Changes

- Updated dependencies [96aed25]
  - @ai-sdk/provider@0.0.15

## 1.0.6

### Patch Changes

- 9614584: fix (ai/core): use Symbol.for
- 0762a22: feat (ai/core): support zod transformers in generateObject & streamObject

## 1.0.5

### Patch Changes

- a8d1c9e9: feat (ai/core): parallel image download
- Updated dependencies [a8d1c9e9]
  - @ai-sdk/provider@0.0.14

## 1.0.4

### Patch Changes

- 4f88248f: feat (core): support json schema

## 1.0.3

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@0.0.13

## 1.0.2

### Patch Changes

- Updated dependencies [b7290943]
  - @ai-sdk/provider@0.0.12

## 1.0.1

### Patch Changes

- d481729f: fix (ai/provider-utils): generalize to Error (DomException not always available)

## 1.0.0

### Major Changes

- 5edc6110: feat (provider-utils): change getRequestHeader() test helper to return Record (breaking change)

### Patch Changes

- 5edc6110: feat (provider-utils): add combineHeaders helper
- Updated dependencies [5edc6110]
  - @ai-sdk/provider@0.0.11

## 0.0.16

### Patch Changes

- 02f6a088: feat (provider-utils): add convertArrayToAsyncIterable test helper

## 0.0.15

### Patch Changes

- 85712895: feat (@ai-sdk/provider-utils): add createJsonStreamResponseHandler
- 85712895: chore (@ai-sdk/provider-utils): move test helper to provider utils

## 0.0.14

### Patch Changes

- 7910ae84: feat (providers): support custom fetch implementations

## 0.0.13

### Patch Changes

- Updated dependencies [102ca22f]
  - @ai-sdk/provider@0.0.10

## 0.0.12

### Patch Changes

- 09295e2e: feat (@ai-sdk/provider-utils): add download helper
- 043a5de2: fix (provider-utils): rename to isParsableJson
- Updated dependencies [09295e2e]
  - @ai-sdk/provider@0.0.9

## 0.0.11

### Patch Changes

- Updated dependencies [f39c0dd2]
  - @ai-sdk/provider@0.0.8

## 0.0.10

### Patch Changes

- Updated dependencies [8e780288]
  - @ai-sdk/provider@0.0.7

## 0.0.9

### Patch Changes

- 6a50ac4: feat (provider-utils): add loadSetting and convertAsyncGeneratorToReadableStream helpers
- Updated dependencies [6a50ac4]
  - @ai-sdk/provider@0.0.6

## 0.0.8

### Patch Changes

- Updated dependencies [0f6bc4e]
  - @ai-sdk/provider@0.0.5

## 0.0.7

### Patch Changes

- Updated dependencies [325ca55]
  - @ai-sdk/provider@0.0.4

## 0.0.6

### Patch Changes

- 276f22b: fix (ai/provider): improve request error handling

## 0.0.5

### Patch Changes

- Updated dependencies [41d5736]
  - @ai-sdk/provider@0.0.3

## 0.0.4

### Patch Changes

- 56ef84a: ai/core: fix abort handling in transformation stream

## 0.0.3

### Patch Changes

- 25f3350: ai/core: add support for getting raw response headers.
- Updated dependencies
  - @ai-sdk/provider@0.0.2

## 0.0.2

### Patch Changes

- eb150a6: ai/core: remove scaling of setting values (breaking change). If you were using the temperature, frequency penalty, or presence penalty settings, you need to update the providers and adjust the setting values.
- Updated dependencies [eb150a6]
  - @ai-sdk/provider@0.0.1

## 0.0.1

### Patch Changes

- 7b8791d: Rename baseUrl to baseURL. Automatically remove trailing slashes.
