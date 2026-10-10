# @ai-sdk/mcp

## 2.0.15

### Patch Changes

- d84ea43: fix(mcp): accept OAuth metadata without code challenge methods
- Updated dependencies [cd06458]
  - @ai-sdk/provider-utils@5.0.11

## 2.0.14

### Patch Changes

- 48e7e78: Harden MCP Apps handling of server-supplied resource metadata and the host/iframe bridge:

  - Runtime-validate `_meta.ui` and drop malformed or non-string fields.
  - Gate iframe permissions deny-by-default via a new `sandbox.allowedPermissions` allowlist.
  - Derive a concrete `postMessage` target origin and validate inbound message origins.
  - Validate inbound bridge params: limit `resources/read` to `ui://` resources and allow only `https`/`http`/`mailto` in `ui/open-link`.
  - Add `fingerprintMCPAppResource` / `detectMCPAppResourceDrift` for pinning and comparing app resources.

## 2.0.13

### Patch Changes

- Updated dependencies [31c7be8]
  - @ai-sdk/provider-utils@5.0.10

## 2.0.12

### Patch Changes

- Updated dependencies [4be62c1]
- Updated dependencies [7805e4a]
- Updated dependencies [cd12954]
  - @ai-sdk/provider-utils@5.0.9

## 2.0.11

### Patch Changes

- Updated dependencies [e193290]
  - @ai-sdk/provider-utils@5.0.8

## 2.0.10

### Patch Changes

- Updated dependencies [0f93c57]
  - @ai-sdk/provider@4.0.3
  - @ai-sdk/provider-utils@5.0.7

## 2.0.9

### Patch Changes

- Updated dependencies [ac306ed]
  - @ai-sdk/provider-utils@5.0.6

## 2.0.8

### Patch Changes

- 3e6e955: Reject in-flight MCP requests when their abort signal fires and remove the pending response handler.
- eebd14b: Prevent streamable HTTP MCP background SSE disconnects from surfacing as unhandled promise rejections.

## 2.0.7

### Patch Changes

- 5c5c0f5: Add experimental streaming transcription support for transcription models, including OpenAI `gpt-realtime-whisper` and xAI WebSocket STT.
- Updated dependencies [5c5c0f5]
  - @ai-sdk/provider@4.0.2
  - @ai-sdk/provider-utils@5.0.5

## 2.0.6

### Patch Changes

- 3c30eb4: feat(mcp): expose a json-rpc message validator
- Updated dependencies [c6f5e62]
  - @ai-sdk/provider-utils@5.0.4

## 2.0.5

### Patch Changes

- 8c616f0: feat(mcp): add maxRetries option for failed mcp tool calls
- Updated dependencies [8c616f0]
  - @ai-sdk/provider-utils@5.0.3

## 2.0.4

### Patch Changes

- Updated dependencies [0274f34]
  - @ai-sdk/provider@4.0.1
  - @ai-sdk/provider-utils@5.0.2

## 2.0.3

### Patch Changes

- 68a739a: feat(mcp): allow MCP client to use server completions
- Updated dependencies [6a436e3]
  - @ai-sdk/provider-utils@5.0.1

## 2.0.2

### Patch Changes

- ba6d510: chore: fix deprecated use of zod `.passthrough()`

## 2.0.1

### Patch Changes

- 241a8c5: Add Streamable HTTP session hooks, cached initialize metadata, and detach-on-close support for reattaching to MCP sessions.

## 2.0.0

### Major Changes

- 23fa161: fix(mcp): setting redirect: error for MCP transport
- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.
- 8359612: Start v7 pre-release

### Patch Changes

- b79094c: Add `resource_link` content type to `CallToolResultSchema` and `PromptMessageSchema` per MCP spec. Fixes hard rejection when MCP servers return `resource_link` content parts with zod ≥ 4.4.x.
- 78e0023: fix(mcp): await addClientAuthentication in token exchange and refresh
- b567a6c: dependency updates
- e33ad0b: fix(mcp): add optional hook to validate authorization servers
- e3ea484: fix(mcp): bypass outputSchema validation when tool returns isError
- 93afb28: feat(mcp): expose server instructions to be accessible through client
- a00d1d3: feat(mcp): allow custom fetch for HTTP and SSE transports
- a98bf66: feat(mcp): surface 'serverInfo' exposed from the MCP server
- 2a150f8: fix(mcp): lock first sse endpoint received via event
- 2655da8: fix(mcp): use negotiated protocol version in transport request headers
- 9f0e36c: trigger release for all packages after provenance setup
- f7bc0b4: feat(mcp): expose `statusCode`, `url`, and `responseBody` on `MCPClientError` for HTTP transport failures

  `MCPClientError` now carries structured HTTP context when it originates from the
  streamable HTTP transport. This lets downstream consumers (e.g. agent frameworks
  that need to decide whether to fall back from streamable HTTP to legacy SSE
  transport per the MCP spec) branch on the actual response status without parsing
  the error message string.

  Fields are optional — they remain `undefined` for stdio transport errors and for
  non-response failures (network errors, aborts).

- dcefad3: fix(mcp): respond to ping requests with an empty result per JSON-RPC spec (closes #6282)
- b44b051: fix(mcp): prevent prototype-named tools from bypassing the `schemas` allowlist

  When using `client.tools({ schemas })` to expose only an explicitly allowed
  subset of an MCP server's tools, the allowlist check used the `in` operator,
  which also matches inherited `Object.prototype` properties. A server-advertised
  tool named `constructor`, `toString`, `__proto__`, etc. would pass the check
  even though the developer never defined it in `schemas`, and was then exposed to
  the model and executable. The check now uses `Object.hasOwn`, so only
  explicitly defined tools are returned.

- f634bac: feat(mcp): add new McpProviderMetadata type
- b9b3899: changeset for #13384
- 1e89d62: fix(mcp): strip trailing slash from OAuth resource parameter
- 3e0b82f: fix(mcp): support official sdk protocol version negotiation
- 1451759: feat(mcp): deprecate name and use clientName for MCPClient
- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- 08d2129: feat(mcp): propagate the server name through dynamic tool parts
- 58c9eb1: feat(mcp): add `redirect` option to `MCPTransportConfig` for controlling HTTP redirect behavior
- 0c4c275: trigger initial canary release
- 611f621: feat(mcp): feat(mcp): add support for MCP Apps
- 9ecd8ae: fix(mcp): add MCP protocol version 2025-11-25 to supported versions
- 6c17a9f: fix(mcp): deduplicate auth refresh on http transport
- 69254e0: feat(ai): add toolMetadata for tool specific metdata
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- f0c6770: fix(mcp): prevent mcp oauth credential exfiltration during rediscovery
- 5463d0d: feat(provider): align tool result output content file part types with top-level message file part types
- b8396f0: trigger initial beta release
- b29e087: fix (mcp): handle SSE messages without explicit event fields
- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling
- 024a6b4: fix(mcp): validate oauth metadata issuer during discovery
- 9b0bc8a: fix(mcp): prevent prototype pollution by using secureJsonParse
- ff5eba1: feat: roll `image-*` tool output types into their equivalent `file-*` types

## 2.0.0-beta.67

### Patch Changes

- Updated dependencies [0416e3e]
  - @ai-sdk/provider@4.0.0-beta.20
  - @ai-sdk/provider-utils@5.0.0-beta.50

## 2.0.0-beta.66

### Patch Changes

- b8396f0: trigger initial beta release
- Updated dependencies [b8396f0]
  - @ai-sdk/provider-utils@5.0.0-beta.49
  - @ai-sdk/provider@4.0.0-beta.19

## 2.0.0-canary.65

### Patch Changes

- b29e087: fix (mcp): handle SSE messages without explicit event fields

## 2.0.0-canary.64

### Patch Changes

- 024a6b4: fix(mcp): validate oauth metadata issuer during discovery

## 2.0.0-canary.63

### Patch Changes

- 2a150f8: fix(mcp): lock first sse endpoint received via event
- b44b051: fix(mcp): prevent prototype-named tools from bypassing the `schemas` allowlist

  When using `client.tools({ schemas })` to expose only an explicitly allowed
  subset of an MCP server's tools, the allowlist check used the `in` operator,
  which also matches inherited `Object.prototype` properties. A server-advertised
  tool named `constructor`, `toString`, `__proto__`, etc. would pass the check
  even though the developer never defined it in `schemas`, and was then exposed to
  the model and executable. The check now uses `Object.hasOwn`, so only
  explicitly defined tools are returned.

- Updated dependencies [aeda373]
- Updated dependencies [375fdd7]
- Updated dependencies [b4507d5]
  - @ai-sdk/provider-utils@5.0.0-canary.48

## 2.0.0-canary.62

### Patch Changes

- e33ad0b: fix(mcp): add optional hook to validate authorization servers
- 3e0b82f: fix(mcp): support official sdk protocol version negotiation

## 2.0.0-canary.61

### Patch Changes

- Updated dependencies [bae5e2b]
  - @ai-sdk/provider-utils@5.0.0-canary.47

## 2.0.0-canary.60

### Patch Changes

- f0c6770: fix(mcp): prevent mcp oauth credential exfiltration during rediscovery

## 2.0.0-canary.59

### Patch Changes

- Updated dependencies [ce769dd]
  - @ai-sdk/provider@4.0.0-canary.18
  - @ai-sdk/provider-utils@5.0.0-canary.46

## 2.0.0-canary.58

### Patch Changes

- Updated dependencies [ee798eb]
- Updated dependencies [daf6637]
  - @ai-sdk/provider-utils@5.0.0-canary.45

## 2.0.0-canary.57

### Patch Changes

- 78e0023: fix(mcp): await addClientAuthentication in token exchange and refresh

## 2.0.0-canary.56

### Patch Changes

- dcefad3: fix(mcp): respond to ping requests with an empty result per JSON-RPC spec (closes #6282)

## 2.0.0-canary.55

### Patch Changes

- f7bc0b4: feat(mcp): expose `statusCode`, `url`, and `responseBody` on `MCPClientError` for HTTP transport failures

  `MCPClientError` now carries structured HTTP context when it originates from the
  streamable HTTP transport. This lets downstream consumers (e.g. agent frameworks
  that need to decide whether to fall back from streamable HTTP to legacy SSE
  transport per the MCP spec) branch on the actual response status without parsing
  the error message string.

  Fields are optional — they remain `undefined` for stdio transport errors and for
  non-response failures (network errors, aborts).

## 2.0.0-canary.54

### Patch Changes

- Updated dependencies [6c93e36]
- Updated dependencies [f617ac2]
  - @ai-sdk/provider-utils@5.0.0-canary.44

## 2.0.0-canary.53

### Patch Changes

- 6c17a9f: fix(mcp): deduplicate auth refresh on http transport

## 2.0.0-canary.52

### Patch Changes

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- Updated dependencies [7fc6bd6]
  - @ai-sdk/provider-utils@5.0.0-canary.43
  - @ai-sdk/provider@4.0.0-canary.17

## 2.0.0-canary.51

### Patch Changes

- b567a6c: dependency updates
- Updated dependencies [a6617c5]
  - @ai-sdk/provider-utils@5.0.0-canary.42

## 2.0.0-canary.50

### Patch Changes

- Updated dependencies [28dfa06]
- Updated dependencies [e93fa91]
  - @ai-sdk/provider-utils@5.0.0-canary.41

## 2.0.0-canary.49

### Patch Changes

- Updated dependencies [a7de9c9]
  - @ai-sdk/provider-utils@5.0.0-canary.40

## 2.0.0-canary.48

### Patch Changes

- Updated dependencies [105f95b]
  - @ai-sdk/provider-utils@5.0.0-canary.39

## 2.0.0-canary.47

### Patch Changes

- 2655da8: fix(mcp): use negotiated protocol version in transport request headers
- Updated dependencies [ca446f8]
  - @ai-sdk/provider-utils@5.0.0-canary.38

## 2.0.0-canary.46

### Patch Changes

- Updated dependencies [d848405]
  - @ai-sdk/provider-utils@5.0.0-canary.37

## 2.0.0-canary.45

### Patch Changes

- Updated dependencies [ca39020]
  - @ai-sdk/provider-utils@5.0.0-canary.36

## 2.0.0-canary.44

### Patch Changes

- 611f621: feat(mcp): feat(mcp): add support for MCP Apps

## 2.0.0-canary.43

### Patch Changes

- f634bac: feat(mcp): add new McpProviderMetadata type
- Updated dependencies [f634bac]
  - @ai-sdk/provider-utils@5.0.0-canary.35

## 2.0.0-canary.42

### Patch Changes

- 69254e0: feat(ai): add toolMetadata for tool specific metdata
- Updated dependencies [69254e0]
- Updated dependencies [3015fc3]
  - @ai-sdk/provider-utils@5.0.0-canary.34

## 2.0.0-canary.41

### Patch Changes

- b79094c: Add `resource_link` content type to `CallToolResultSchema` and `PromptMessageSchema` per MCP spec. Fixes hard rejection when MCP servers return `resource_link` content parts with zod ≥ 4.4.x.
- 1451759: feat(mcp): deprecate name and use clientName for MCPClient

## 2.0.0-canary.40

### Patch Changes

- Updated dependencies [2427d88]
  - @ai-sdk/provider-utils@5.0.0-canary.33

## 2.0.0-canary.39

### Patch Changes

- 5463d0d: feat(provider): align tool result output content file part types with top-level message file part types
- Updated dependencies [5463d0d]
  - @ai-sdk/provider-utils@5.0.0-canary.32
  - @ai-sdk/provider@4.0.0-canary.16

## 2.0.0-canary.38

### Patch Changes

- 0c4c275: trigger initial canary release
- Updated dependencies [0c4c275]
  - @ai-sdk/provider-utils@5.0.0-canary.31
  - @ai-sdk/provider@4.0.0-canary.15

## 2.0.0-beta.37

### Patch Changes

- 08d2129: feat(mcp): propagate the server name through dynamic tool parts
- Updated dependencies [08d2129]
  - @ai-sdk/provider-utils@5.0.0-beta.30

## 2.0.0-beta.36

### Patch Changes

- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- Updated dependencies [9bd6512]
- Updated dependencies [258c093]
- Updated dependencies [b6783da]
  - @ai-sdk/provider-utils@5.0.0-beta.29
  - @ai-sdk/provider@4.0.0-beta.14

## 2.0.0-beta.35

### Patch Changes

- 9f0e36c: trigger release for all packages after provenance setup
- Updated dependencies [9f0e36c]
  - @ai-sdk/provider@4.0.0-beta.13
  - @ai-sdk/provider-utils@5.0.0-beta.28

## 2.0.0-beta.34

### Patch Changes

- 93afb28: feat(mcp): expose server instructions to be accessible through client
- 9b0bc8a: fix(mcp): prevent prototype pollution by using secureJsonParse
- Updated dependencies [785fe16]
- Updated dependencies [67df0a0]
- Updated dependencies [befb78c]
- Updated dependencies [0458559]
- Updated dependencies [5852c0a]
- Updated dependencies [fc92055]
  - @ai-sdk/provider-utils@5.0.0-beta.27

## 2.0.0-beta.33

### Patch Changes

- Updated dependencies [2e98477]
  - @ai-sdk/provider-utils@5.0.0-beta.26

## 2.0.0-beta.32

### Patch Changes

- Updated dependencies [eea8d98]
  - @ai-sdk/provider-utils@5.0.0-beta.25

## 2.0.0-beta.31

### Patch Changes

- Updated dependencies [f807e45]
  - @ai-sdk/provider-utils@5.0.0-beta.24

## 2.0.0-beta.30

### Patch Changes

- Updated dependencies [350ea38]
  - @ai-sdk/provider-utils@5.0.0-beta.23

## 2.0.0-beta.29

### Patch Changes

- Updated dependencies [083947b]
  - @ai-sdk/provider-utils@5.0.0-beta.22

## 2.0.0-beta.28

### Patch Changes

- Updated dependencies [add1126]
  - @ai-sdk/provider-utils@5.0.0-beta.21

## 2.0.0-beta.27

### Patch Changes

- ff5eba1: feat: roll `image-*` tool output types into their equivalent `file-*` types
- Updated dependencies [b3976a2]
- Updated dependencies [ff5eba1]
  - @ai-sdk/provider-utils@5.0.0-beta.20
  - @ai-sdk/provider@4.0.0-beta.12

## 2.0.0-beta.26

### Major Changes

- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.

### Patch Changes

- Updated dependencies [ef992f8]
  - @ai-sdk/provider@4.0.0-beta.11
  - @ai-sdk/provider-utils@5.0.0-beta.19

## 2.0.0-beta.25

### Patch Changes

- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling
- Updated dependencies [90e2d8a]
  - @ai-sdk/provider-utils@5.0.0-beta.18

## 2.0.0-beta.24

### Patch Changes

- Updated dependencies [3ae1786]
  - @ai-sdk/provider-utils@5.0.0-beta.17

## 2.0.0-beta.23

### Patch Changes

- a98bf66: feat(mcp): surface 'serverInfo' exposed from the MCP server

## 2.0.0-beta.22

### Patch Changes

- Updated dependencies [176466a]
  - @ai-sdk/provider@4.0.0-beta.10
  - @ai-sdk/provider-utils@5.0.0-beta.16

## 2.0.0-beta.21

### Patch Changes

- Updated dependencies [e311194]
  - @ai-sdk/provider@4.0.0-beta.9
  - @ai-sdk/provider-utils@5.0.0-beta.15

## 2.0.0-beta.20

### Patch Changes

- Updated dependencies [34bd95d]
- Updated dependencies [008271d]
  - @ai-sdk/provider@4.0.0-beta.8
  - @ai-sdk/provider-utils@5.0.0-beta.14

## 2.0.0-beta.19

### Patch Changes

- Updated dependencies [b0c2869]
- Updated dependencies [7e26e81]
  - @ai-sdk/provider-utils@5.0.0-beta.13

## 2.0.0-beta.18

### Patch Changes

- e3ea484: fix(mcp): bypass outputSchema validation when tool returns isError

## 2.0.0-beta.17

### Patch Changes

- a00d1d3: feat(mcp): allow custom fetch for HTTP and SSE transports

## 2.0.0-beta.16

### Patch Changes

- Updated dependencies [46d1149]
  - @ai-sdk/provider-utils@5.0.0-beta.12

## 2.0.0-beta.15

### Patch Changes

- Updated dependencies [6fd51c0]
  - @ai-sdk/provider-utils@5.0.0-beta.11
  - @ai-sdk/provider@4.0.0-beta.7

## 2.0.0-beta.14

### Patch Changes

- 1e89d62: fix(mcp): strip trailing slash from OAuth resource parameter
- Updated dependencies [c29a26f]
  - @ai-sdk/provider-utils@5.0.0-beta.10
  - @ai-sdk/provider@4.0.0-beta.6

## 2.0.0-beta.13

### Patch Changes

- Updated dependencies [2e17091]
  - @ai-sdk/provider-utils@5.0.0-beta.9

## 2.0.0-beta.12

### Patch Changes

- Updated dependencies [986c6fd]
- Updated dependencies [493295c]
  - @ai-sdk/provider-utils@5.0.0-beta.8

## 2.0.0-beta.11

### Patch Changes

- Updated dependencies [1f509d4]
  - @ai-sdk/provider-utils@5.0.0-beta.7
  - @ai-sdk/provider@4.0.0-beta.5

## 2.0.0-beta.10

### Patch Changes

- Updated dependencies [3887c70]
  - @ai-sdk/provider-utils@5.0.0-beta.6
  - @ai-sdk/provider@4.0.0-beta.4

## 2.0.0-beta.9

### Patch Changes

- Updated dependencies [776b617]
  - @ai-sdk/provider-utils@5.0.0-beta.5
  - @ai-sdk/provider@4.0.0-beta.3

## 2.0.0-beta.8

### Patch Changes

- Updated dependencies [61753c3]
  - @ai-sdk/provider-utils@5.0.0-beta.4

## 2.0.0-beta.7

### Major Changes

- 23fa161: fix(mcp): setting redirect: error for MCP transport

## 2.0.0-beta.6

### Patch Changes

- 58c9eb1: feat(mcp): add `redirect` option to `MCPTransportConfig` for controlling HTTP redirect behavior

## 2.0.0-beta.5

### Patch Changes

- Updated dependencies [f7d4f01]
  - @ai-sdk/provider-utils@5.0.0-beta.3
  - @ai-sdk/provider@4.0.0-beta.2

## 2.0.0-beta.4

### Patch Changes

- Updated dependencies [5c2a5a2]
  - @ai-sdk/provider@4.0.0-beta.1
  - @ai-sdk/provider-utils@5.0.0-beta.2

## 2.0.0-beta.3

### Patch Changes

- b9b3899: fix(mcp): validate state param in oauth flow

## 2.0.0-beta.2

### Patch Changes

- 9ecd8ae: fix(mcp): add MCP protocol version 2025-11-25 to supported versions

## 2.0.0-beta.1

### Patch Changes

- Updated dependencies [531251e]
  - @ai-sdk/provider-utils@5.0.0-beta.1

## 2.0.0-beta.0

### Major Changes

- 8359612: Start v7 pre-release

### Patch Changes

- Updated dependencies [8359612]
  - @ai-sdk/provider@4.0.0-beta.0
  - @ai-sdk/provider-utils@5.0.0-beta.0

## 1.0.25

### Patch Changes

- Updated dependencies [ad4cfc2]
  - @ai-sdk/provider-utils@4.0.19

## 1.0.24

### Patch Changes

- Updated dependencies [824b295]
  - @ai-sdk/provider-utils@4.0.18

## 1.0.23

### Patch Changes

- Updated dependencies [08336f1]
  - @ai-sdk/provider-utils@4.0.17

## 1.0.22

### Patch Changes

- Updated dependencies [58bc42d]
  - @ai-sdk/provider-utils@4.0.16

## 1.0.21

### Patch Changes

- Updated dependencies [4024a3a]
  - @ai-sdk/provider-utils@4.0.15

## 1.0.20

### Patch Changes

- 60ee2df: feat(mcp): expose serializable data from the server tools

## 1.0.19

### Patch Changes

- Updated dependencies [7168375]
  - @ai-sdk/provider@3.0.8
  - @ai-sdk/provider-utils@4.0.14

## 1.0.18

### Patch Changes

- Updated dependencies [53f6731]
  - @ai-sdk/provider@3.0.7
  - @ai-sdk/provider-utils@4.0.13

## 1.0.17

### Patch Changes

- Updated dependencies [96936e5]
  - @ai-sdk/provider-utils@4.0.12

## 1.0.16

### Patch Changes

- 8d022fd: fix(mcp): support image returns in tool results

## 1.0.15

### Patch Changes

- Updated dependencies [2810850]
  - @ai-sdk/provider-utils@4.0.11
  - @ai-sdk/provider@3.0.6

## 1.0.14

### Patch Changes

- Updated dependencies [462ad00]
  - @ai-sdk/provider-utils@4.0.10

## 1.0.13

### Patch Changes

- 4de5a1d: chore: excluded tests from src folder in npm package
- Updated dependencies [4de5a1d]
  - @ai-sdk/provider@3.0.5
  - @ai-sdk/provider-utils@4.0.9

## 1.0.12

### Patch Changes

- 8dc54db: chore: add src folders to package bundle

## 1.0.11

### Patch Changes

- d80fc3b: feat(mcp): capture server title from top level

## 1.0.10

### Patch Changes

- Updated dependencies [5c090e7]
  - @ai-sdk/provider@3.0.4
  - @ai-sdk/provider-utils@4.0.8

## 1.0.9

### Patch Changes

- ec84ffd: fix(mcp): lenient JSON-RPC parsing for http transport

## 1.0.8

### Patch Changes

- Updated dependencies [46f46e4]
  - @ai-sdk/provider-utils@4.0.7

## 1.0.7

### Patch Changes

- Updated dependencies [1b11dcb]
  - @ai-sdk/provider-utils@4.0.6
  - @ai-sdk/provider@3.0.3

## 1.0.6

### Patch Changes

- Updated dependencies [34d1c8a]
  - @ai-sdk/provider-utils@4.0.5

## 1.0.5

### Patch Changes

- 9cc0f88: feat(mcp): add support for structuredContent / outputSchema for typed tool outputs

## 1.0.4

### Patch Changes

- Updated dependencies [d937c8f]
  - @ai-sdk/provider@3.0.2
  - @ai-sdk/provider-utils@4.0.4

## 1.0.3

### Patch Changes

- Updated dependencies [0b429d4]
  - @ai-sdk/provider-utils@4.0.3

## 1.0.2

### Patch Changes

- 863d34f: fix: trigger release to update `@latest`
- Updated dependencies [863d34f]
  - @ai-sdk/provider@3.0.1
  - @ai-sdk/provider-utils@4.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [29264a3]
  - @ai-sdk/provider-utils@4.0.1

## 1.0.0

### Major Changes

- eca63f3: feat(ai): add OAuth for MCP clients + refactor to new package

  This change replaces

  ```ts
  import { experimental_createMCPClient } from "ai";
  import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";
  ```

  with

  ```ts
  import { experimental_createMCPClient } from "@ai-sdk/mcp";
  import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
  ```

### Patch Changes

- 90ede04: feat(mcp): make MCPClient stable
- 6f1577e: fix(mcp): pass json header for refreshAuth
- 17c04d4: feat(mcp): expose `_meta` field from MCP tool definitions
- 1cff766: feat(packages/mcp): add support for MCP server prompts exposed
- 3ed5519: chore: rename ToolCallOptions to ToolExecutionOptions
- ba2ca2d: feat(mcp): add the possibility to define client version in mcp client definition
- f702df2: feat(mcp): add client elicitation support
- 5939b92: feat(mcp): adding resources support to MCP client
- Updated dependencies
  - @ai-sdk/provider@3.0.0
  - @ai-sdk/provider-utils@4.0.0

## 1.0.0-beta.46

### Patch Changes

- Updated dependencies [475189e]
  - @ai-sdk/provider@3.0.0-beta.32
  - @ai-sdk/provider-utils@4.0.0-beta.59

## 1.0.0-beta.45

### Patch Changes

- Updated dependencies [2625a04]
  - @ai-sdk/provider@3.0.0-beta.31
  - @ai-sdk/provider-utils@4.0.0-beta.58

## 1.0.0-beta.44

### Patch Changes

- Updated dependencies [cbf52cd]
  - @ai-sdk/provider@3.0.0-beta.30
  - @ai-sdk/provider-utils@4.0.0-beta.57

## 1.0.0-beta.43

### Patch Changes

- Updated dependencies [9549c9e]
  - @ai-sdk/provider@3.0.0-beta.29
  - @ai-sdk/provider-utils@4.0.0-beta.56

## 1.0.0-beta.42

### Patch Changes

- Updated dependencies [50b70d6]
  - @ai-sdk/provider-utils@4.0.0-beta.55

## 1.0.0-beta.41

### Patch Changes

- Updated dependencies [9061dc0]
  - @ai-sdk/provider-utils@4.0.0-beta.54
  - @ai-sdk/provider@3.0.0-beta.28

## 1.0.0-beta.40

### Patch Changes

- 90ede04: feat(mcp): make MCPClient stable

## 1.0.0-beta.39

### Patch Changes

- Updated dependencies [366f50b]
  - @ai-sdk/provider@3.0.0-beta.27
  - @ai-sdk/provider-utils@4.0.0-beta.53

## 1.0.0-beta.38

### Patch Changes

- Updated dependencies [763d04a]
  - @ai-sdk/provider-utils@4.0.0-beta.52

## 1.0.0-beta.37

### Patch Changes

- Updated dependencies [c1efac4]
  - @ai-sdk/provider-utils@4.0.0-beta.51

## 1.0.0-beta.36

### Patch Changes

- Updated dependencies [32223c8]
  - @ai-sdk/provider-utils@4.0.0-beta.50

## 1.0.0-beta.35

### Patch Changes

- Updated dependencies [83e5744]
  - @ai-sdk/provider-utils@4.0.0-beta.49

## 1.0.0-beta.34

### Patch Changes

- Updated dependencies [960ec8f]
  - @ai-sdk/provider-utils@4.0.0-beta.48

## 1.0.0-beta.33

### Patch Changes

- Updated dependencies [e9e157f]
  - @ai-sdk/provider-utils@4.0.0-beta.47

## 1.0.0-beta.32

### Patch Changes

- Updated dependencies [81e29ab]
  - @ai-sdk/provider-utils@4.0.0-beta.46

## 1.0.0-beta.31

### Patch Changes

- Updated dependencies [3bd2689]
  - @ai-sdk/provider@3.0.0-beta.26
  - @ai-sdk/provider-utils@4.0.0-beta.45

## 1.0.0-beta.30

### Patch Changes

- 6f1577e: fix(mcp): pass json header for refreshAuth

## 1.0.0-beta.29

### Patch Changes

- Updated dependencies [53f3368]
  - @ai-sdk/provider@3.0.0-beta.25
  - @ai-sdk/provider-utils@4.0.0-beta.44

## 1.0.0-beta.28

### Patch Changes

- Updated dependencies [dce03c4]
  - @ai-sdk/provider-utils@4.0.0-beta.43
  - @ai-sdk/provider@3.0.0-beta.24

## 1.0.0-beta.27

### Patch Changes

- 3ed5519: chore: rename ToolCallOptions to ToolExecutionOptions
- Updated dependencies [3ed5519]
  - @ai-sdk/provider-utils@4.0.0-beta.42

## 1.0.0-beta.26

### Patch Changes

- 17c04d4: feat(mcp): expose `_meta` field from MCP tool definitions

## 1.0.0-beta.25

### Patch Changes

- Updated dependencies [1bd7d32]
  - @ai-sdk/provider-utils@4.0.0-beta.41
  - @ai-sdk/provider@3.0.0-beta.23

## 1.0.0-beta.24

### Patch Changes

- Updated dependencies [544d4e8]
  - @ai-sdk/provider-utils@4.0.0-beta.40
  - @ai-sdk/provider@3.0.0-beta.22

## 1.0.0-beta.23

### Patch Changes

- Updated dependencies [954c356]
  - @ai-sdk/provider-utils@4.0.0-beta.39
  - @ai-sdk/provider@3.0.0-beta.21

## 1.0.0-beta.22

### Patch Changes

- Updated dependencies [03849b0]
  - @ai-sdk/provider-utils@4.0.0-beta.38

## 1.0.0-beta.21

### Patch Changes

- Updated dependencies [457318b]
  - @ai-sdk/provider@3.0.0-beta.20
  - @ai-sdk/provider-utils@4.0.0-beta.37

## 1.0.0-beta.20

### Patch Changes

- Updated dependencies [8d9e8ad]
  - @ai-sdk/provider@3.0.0-beta.19
  - @ai-sdk/provider-utils@4.0.0-beta.36

## 1.0.0-beta.19

### Patch Changes

- Updated dependencies [10d819b]
  - @ai-sdk/provider@3.0.0-beta.18
  - @ai-sdk/provider-utils@4.0.0-beta.35

## 1.0.0-beta.18

### Patch Changes

- ba2ca2d: feat(mcp): add the possibility to define client version in mcp client definition

## 1.0.0-beta.17

### Patch Changes

- f702df2: feat(mcp): add client elicitation support

## 1.0.0-beta.16

### Patch Changes

- Updated dependencies [db913bd]
  - @ai-sdk/provider@3.0.0-beta.17
  - @ai-sdk/provider-utils@4.0.0-beta.34

## 1.0.0-beta.15

### Patch Changes

- Updated dependencies [b681d7d]
  - @ai-sdk/provider@3.0.0-beta.16
  - @ai-sdk/provider-utils@4.0.0-beta.33

## 1.0.0-beta.14

### Patch Changes

- Updated dependencies [32d8dbb]
  - @ai-sdk/provider-utils@4.0.0-beta.32

## 1.0.0-beta.13

### Patch Changes

- 1cff766: feat(packages/mcp): add support for MCP server prompts exposed

## 1.0.0-beta.12

### Patch Changes

- Updated dependencies [bb36798]
  - @ai-sdk/provider@3.0.0-beta.15
  - @ai-sdk/provider-utils@4.0.0-beta.31

## 1.0.0-beta.11

### Patch Changes

- Updated dependencies [4f16c37]
  - @ai-sdk/provider-utils@4.0.0-beta.30

## 1.0.0-beta.10

### Patch Changes

- Updated dependencies [af3780b]
  - @ai-sdk/provider@3.0.0-beta.14
  - @ai-sdk/provider-utils@4.0.0-beta.29

## 1.0.0-beta.9

### Patch Changes

- Updated dependencies [016b111]
  - @ai-sdk/provider-utils@4.0.0-beta.28

## 1.0.0-beta.8

### Patch Changes

- Updated dependencies [37c58a0]
  - @ai-sdk/provider@3.0.0-beta.13
  - @ai-sdk/provider-utils@4.0.0-beta.27

## 1.0.0-beta.7

### Patch Changes

- Updated dependencies [d1bdadb]
  - @ai-sdk/provider@3.0.0-beta.12
  - @ai-sdk/provider-utils@4.0.0-beta.26

## 1.0.0-beta.6

### Patch Changes

- Updated dependencies [4c44a5b]
  - @ai-sdk/provider@3.0.0-beta.11
  - @ai-sdk/provider-utils@4.0.0-beta.25

## 1.0.0-beta.5

### Patch Changes

- Updated dependencies [0c3b58b]
  - @ai-sdk/provider@3.0.0-beta.10
  - @ai-sdk/provider-utils@4.0.0-beta.24

## 1.0.0-beta.4

### Patch Changes

- Updated dependencies [a755db5]
  - @ai-sdk/provider@3.0.0-beta.9
  - @ai-sdk/provider-utils@4.0.0-beta.23

## 1.0.0-beta.3

### Patch Changes

- 5939b92: feat(mcp): adding resources support to MCP client

## 1.0.0-beta.2

### Patch Changes

- Updated dependencies [58920e0]
  - @ai-sdk/provider-utils@4.0.0-beta.22

## 1.0.0-beta.1

### Patch Changes

- Updated dependencies [293a6b7]
  - @ai-sdk/provider-utils@4.0.0-beta.21

## 1.0.0-beta.0

### Major Changes

- eca63f3: feat(ai): add OAuth for MCP clients + refactor to new package

  This change replaces

  ```ts
  import { experimental_createMCPClient } from "ai";
  import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";
  ```

  with

  ```ts
  import { experimental_createMCPClient } from "@ai-sdk/mcp";
  import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
  ```
