## ADDED Requirements

### Requirement: Endpoint-driven source format detection

The gateway SHALL classify the inbound request's source format from the URL path before consulting the body shape. A request whose path contains `/v1/responses` SHALL be treated as the Responses-API source format. A request whose path contains `/v1/messages` SHALL be treated as the Anthropic-Messages source format. A request whose path contains `/v1/chat/completions` SHALL be treated as the OpenAI Chat-Completions source format, except that when its JSON body has a top-level `input` field that is an array, it SHALL be reclassified as the Responses-API source format.

#### Scenario: `/v1/responses` path is Responses-API source

- **WHEN** a client sends `POST /v1/responses`
- **THEN** the gateway SHALL select the Responses-API translator chain regardless of body shape

#### Scenario: `/v1/messages` path is Anthropic source

- **WHEN** a client sends `POST /v1/messages`
- **THEN** the gateway SHALL select the Anthropic-source translator chain regardless of body shape

#### Scenario: `/v1/chat/completions` with Responses-style body

- **WHEN** a client sends `POST /v1/chat/completions` with a JSON body whose `input` field is an array
- **THEN** the gateway SHALL select the Responses-API source format

#### Scenario: `/v1/chat/completions` with normal body

- **WHEN** a client sends `POST /v1/chat/completions` with a JSON body that has no `input` array and uses `messages[]`
- **THEN** the gateway SHALL select the OpenAI Chat-Completions source format

### Requirement: Two-step pivot through Chat-Completions intermediate

When the inbound source format and the outbound target format differ, the gateway SHALL perform translation in two hops through a Chat-Completions-shaped intermediate object. The Responses-API to Anthropic-Messages request translation SHALL execute `Responses → ChatCompletions` followed by `ChatCompletions → AnthropicMessages`. The Anthropic-Messages to Responses-API response translation SHALL execute `AnthropicMessages → ChatCompletions` followed by `ChatCompletions → ResponsesEvents`.

#### Scenario: Request pivot is two-hop

- **WHEN** a Responses-API request body is routed to an Anthropic-typed channel
- **THEN** the request body delivered to the upstream SHALL be the result of applying the Responses→ChatCompletions translator followed by the ChatCompletions→AnthropicMessages translator, in that order

#### Scenario: Response pivot is two-hop

- **WHEN** an Anthropic streaming response chunk is received and the original client expects Responses-API events
- **THEN** the chunk SHALL be passed through the Anthropic→ChatCompletions translator, and each emitted Chat-Completions chunk SHALL be passed through the ChatCompletions→ResponsesEvents translator before being written to the client

#### Scenario: Same-format requests skip translation

- **WHEN** the source and target formats are identical
- **THEN** no translator is invoked and the body or chunk passes through unchanged

### Requirement: Responses-API input shape normalization

The gateway SHALL accept the Responses-API `input` field in three shapes and normalize them to an internal array of input items before translation: (a) a non-empty string, (b) an empty or whitespace-only string, (c) an array (possibly empty). A non-empty string SHALL be wrapped as a single user message item whose content is a single `input_text` part with the original text. An empty or whitespace-only string SHALL be wrapped as a single user message item whose content is a single `input_text` part with the placeholder text `"..."`. An empty array SHALL be replaced with a single user message item whose content is a single `input_text` part with the placeholder text `"..."`. A non-empty array SHALL be passed through unchanged. Any other shape SHALL be treated as invalid and SHALL cause the body to be forwarded unchanged (no translation).

#### Scenario: String input is wrapped as user message

- **WHEN** the request body contains `input: "hello world"`
- **THEN** the normalized input items SHALL be `[{ type: "message", role: "user", content: [{ type: "input_text", text: "hello world" }] }]`

#### Scenario: Empty string input is wrapped as placeholder

- **WHEN** the request body contains `input: ""`
- **THEN** the normalized input items SHALL be `[{ type: "message", role: "user", content: [{ type: "input_text", text: "..." }] }]`

#### Scenario: Empty array input is replaced with placeholder

- **WHEN** the request body contains `input: []`
- **THEN** the normalized input items SHALL be `[{ type: "message", role: "user", content: [{ type: "input_text", text: "..." }] }]`

#### Scenario: Non-empty array is passed through

- **WHEN** the request body contains `input: [{ type: "message", role: "user", content: [...] }]`
- **THEN** the normalized input items SHALL equal the original array

#### Scenario: Non-string non-array input

- **WHEN** the request body contains `input: 42` or `input: { foo: "bar" }`
- **THEN** the gateway SHALL forward the body unchanged without invoking the Responses→ChatCompletions translator

### Requirement: Responses-API `instructions` becomes a system message

When the Responses-API request body contains a non-empty `instructions` string, the gateway SHALL prepend a single `role: "system"` message whose `content` is that string to the Chat-Completions `messages[]`.

#### Scenario: Instructions prepended as system

- **WHEN** the request body contains `instructions: "You are helpful."`
- **THEN** the first message in the resulting Chat-Completions `messages[]` SHALL be `{ role: "system", content: "You are helpful." }`

#### Scenario: Empty instructions is skipped

- **WHEN** the request body contains `instructions: ""` or no `instructions` field
- **THEN** no system message SHALL be prepended on behalf of `instructions`

### Requirement: Input item type detection with role-only fallback

The gateway SHALL determine each input item's type by reading its `type` field. If the `type` field is missing but a `role` field is present, the item SHALL be treated as type `"message"`. If neither field is present, the item SHALL be skipped silently.

#### Scenario: Explicit type wins

- **WHEN** an input item is `{ type: "function_call", call_id: "x", name: "y", arguments: "{}" }`
- **THEN** the item SHALL be processed as a function call

#### Scenario: Role-only fallback

- **WHEN** an input item is `{ role: "user", content: [{ type: "input_text", text: "hi" }] }` with no `type` field
- **THEN** the item SHALL be processed as type `"message"`

#### Scenario: Neither type nor role

- **WHEN** an input item is `{ foo: "bar" }`
- **THEN** the item SHALL be skipped without error

### Requirement: Message item content normalization

For each input item of type `"message"`, the gateway SHALL map content parts to Chat-Completions content parts as follows: `input_text` and `output_text` parts SHALL become `{ type: "text", text }` parts; `input_image` parts SHALL become `{ type: "image_url", image_url: { url, detail } }` parts where `url` is the part's `image_url` field (if a string) or `file_id` field (if no `image_url`), and `detail` is the part's `detail` field or `"auto"` if absent. Parts of any other type SHALL be passed through unchanged.

#### Scenario: input_text becomes text

- **WHEN** a message item has `content: [{ type: "input_text", text: "hello" }]`
- **THEN** the converted Chat-Completions message content SHALL be `[{ type: "text", text: "hello" }]`

#### Scenario: output_text becomes text

- **WHEN** a message item has `content: [{ type: "output_text", text: "answer" }]`
- **THEN** the converted Chat-Completions message content SHALL be `[{ type: "text", text: "answer" }]`

#### Scenario: input_image with image_url becomes image_url

- **WHEN** a message item has `content: [{ type: "input_image", image_url: "https://example.com/a.png", detail: "high" }]`
- **THEN** the converted Chat-Completions message content SHALL be `[{ type: "image_url", image_url: { url: "https://example.com/a.png", detail: "high" } }]`

#### Scenario: input_image with file_id fallback

- **WHEN** a message item has `content: [{ type: "input_image", file_id: "file_abc" }]` and no `image_url`
- **THEN** the converted content SHALL be `[{ type: "image_url", image_url: { url: "file_abc", detail: "auto" } }]`

#### Scenario: input_image with no url or file_id

- **WHEN** a message item has `content: [{ type: "input_image" }]` with neither `image_url` nor `file_id`
- **THEN** the converted content SHALL be `[{ type: "image_url", image_url: { url: "", detail: "auto" } }]`

### Requirement: Function-call items become assistant tool_calls

For each input item of type `"function_call"`, the gateway SHALL append the call to a buffered assistant message in the form `{ role: "assistant", content: null, tool_calls: [...] }`. Each tool call SHALL be `{ id: <call_id>, type: "function", function: { name, arguments } }`. The buffered assistant message SHALL be flushed to the message list when the next non-function-call item is encountered or at end-of-input. Function-call items whose `name` is missing, not a string, or trimmed-empty SHALL be skipped silently.

#### Scenario: Single function call

- **WHEN** input contains `{ type: "function_call", call_id: "c1", name: "search", arguments: "{\"q\":\"x\"}" }` followed by no more items
- **THEN** the resulting messages SHALL include `{ role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "search", arguments: "{\"q\":\"x\"}" } }] }`

#### Scenario: Multiple consecutive function calls collapse

- **WHEN** input contains two consecutive function_call items with call_ids `c1` and `c2`
- **THEN** both calls SHALL be in the same assistant message's `tool_calls` array, in order

#### Scenario: Function call with empty name is dropped

- **WHEN** input contains `{ type: "function_call", call_id: "c1", name: "", arguments: "{}" }`
- **THEN** the call SHALL NOT appear in any resulting assistant message

#### Scenario: Function call with missing name is dropped

- **WHEN** input contains `{ type: "function_call", call_id: "c1", arguments: "{}" }` with no `name` field
- **THEN** the call SHALL NOT appear in any resulting assistant message

### Requirement: Function-call-output items become tool messages

For each input item of type `"function_call_output"`, the gateway SHALL flush any buffered assistant message and SHALL append a tool message `{ role: "tool", tool_call_id: <call_id>, content: <output> }` where `<output>` is the item's `output` field if it is a string, or the JSON-stringified value of `output` otherwise.

#### Scenario: String output passes through

- **WHEN** input contains `{ type: "function_call_output", call_id: "c1", output: "result text" }`
- **THEN** the resulting messages SHALL include `{ role: "tool", tool_call_id: "c1", content: "result text" }`

#### Scenario: Non-string output is JSON-stringified

- **WHEN** input contains `{ type: "function_call_output", call_id: "c1", output: { ok: true, n: 7 } }`
- **THEN** the resulting messages SHALL include `{ role: "tool", tool_call_id: "c1", content: "{\"ok\":true,\"n\":7}" }`

#### Scenario: Output flushes pending assistant first

- **WHEN** input contains a `function_call` item followed by a `function_call_output` item
- **THEN** the assistant message containing the call SHALL be appended to the message list BEFORE the tool message

### Requirement: Reasoning input items are buffered, not emitted

For each input item of type `"reasoning"`, the gateway SHALL extract its text by joining the `text` fields of every entry in its `summary[]` array with newlines if `summary[]` is a non-empty array; otherwise by joining the `text` fields of every entry in its `content[]` array; otherwise SHALL extract an empty string. The extracted text SHALL be buffered. The buffered text SHALL be attached as `reasoning_content` to the next assistant message OR to the next buffered assistant tool-call message, whichever comes first. After attachment the buffer SHALL be cleared. A `reasoning` item SHALL NOT appear in the Chat-Completions `messages[]` directly.

#### Scenario: Reasoning text attached to next assistant message

- **WHEN** input contains `{ type: "reasoning", summary: [{ text: "thinking step 1" }] }` followed by `{ type: "message", role: "assistant", content: [{ type: "output_text", text: "answer" }] }`
- **THEN** the resulting assistant message SHALL be `{ role: "assistant", content: [{ type: "text", text: "answer" }], reasoning_content: "thinking step 1" }`

#### Scenario: Reasoning text attached to tool-call assistant message

- **WHEN** input contains a `reasoning` item followed by a `function_call` item
- **THEN** the assistant message synthesised for the function_call SHALL include `reasoning_content` equal to the buffered reasoning text

#### Scenario: Reasoning falls back to content array

- **WHEN** input contains `{ type: "reasoning", content: [{ text: "alt thinking" }] }` and no `summary[]`
- **THEN** the buffered reasoning text SHALL be `"alt thinking"`

#### Scenario: Multiple reasoning items concatenate with newline

- **WHEN** input contains two consecutive `reasoning` items with summaries `"a"` and `"b"`
- **THEN** the buffered reasoning text presented to the next assistant turn SHALL be `"a\nb"`

#### Scenario: Reasoning buffer is cleared after attachment

- **WHEN** a reasoning item's text has been attached to an assistant message and a subsequent assistant message arrives with no preceding reasoning
- **THEN** the second assistant message SHALL NOT have `reasoning_content`

### Requirement: Tool declarations conversion (Responses → ChatCompletions)

The gateway SHALL accept Responses-API tool declarations in two shapes: (a) already-Chat-Completions-shaped `{ type: "function", function: { name, description, parameters, strict } }`, which SHALL pass through unchanged; (b) Responses-flat `{ type: "function", name, description, parameters, strict }`, which SHALL be converted to the Chat-Completions shape. A tool declaration whose effective name is missing, non-string, or trimmed-empty SHALL be filtered out (this discards hosted tools that have no `name`). Tool parameter schemas that have `type: "object"` but no `properties` field SHALL be normalized to include `properties: {}`. Tools whose `type` is not `"function"` SHALL be retained unchanged when the target is Anthropic; they SHALL be filtered out when the intermediate is being normalized to OpenAI for non-Anthropic upstreams.

#### Scenario: Already-Chat-Completions tool passes through

- **WHEN** tools contains `{ type: "function", function: { name: "search", parameters: { type: "object", properties: { q: { type: "string" } } } } }`
- **THEN** the converted tools array SHALL contain that entry unchanged

#### Scenario: Flat Responses tool is converted

- **WHEN** tools contains `{ type: "function", name: "search", description: "find", parameters: { type: "object", properties: {} }, strict: true }`
- **THEN** the converted tools array SHALL contain `{ type: "function", function: { name: "search", description: "find", parameters: { type: "object", properties: {} }, strict: true } }`

#### Scenario: Empty-name hosted tool is dropped

- **WHEN** tools contains `{ type: "request_user_input" }` (no `name`)
- **THEN** the converted tools array SHALL NOT contain that entry

#### Scenario: Object schema without properties gets `properties: {}`

- **WHEN** a tool's parameters is `{ type: "object" }`
- **THEN** the converted parameters SHALL be `{ type: "object", properties: {} }`

### Requirement: Responses-API request-body cleanup

After translating to the Chat-Completions intermediate, the gateway SHALL remove the following fields from the result body: `input`, `instructions`, `include`, `prompt_cache_key`, `store`, `reasoning`.

#### Scenario: All Responses-only fields are removed

- **WHEN** a Responses-API body containing `input`, `instructions`, `include`, `prompt_cache_key`, `store`, and `reasoning` is translated
- **THEN** the resulting Chat-Completions body SHALL have none of those six fields

### Requirement: System message extraction for Anthropic target

When translating Chat-Completions → Anthropic, the gateway SHALL collect every `role: "system"` message's content into a single `systemParts` list, removing those messages from the main `messages[]`. When `systemParts` is non-empty, the gateway SHALL emit the Anthropic `system` field as an array of text blocks. When the upstream channel type is the Anthropic OAuth profile, the gateway MAY prepend a project-defined client-identity system block; this block is always present and is positioned first when present, with cache_control `{ type: "ephemeral", ttl: "1h" }` applied to the LAST system block when there is more than one system block.

#### Scenario: Single system message extracted

- **WHEN** the intermediate has `messages: [{ role: "system", content: "You are helpful." }, { role: "user", content: "hi" }]`
- **THEN** the Anthropic body SHALL have `system` as a non-empty array containing a text block whose text is or includes `"You are helpful."`, and `messages` SHALL NOT contain the system message

#### Scenario: Multiple system messages concatenated

- **WHEN** the intermediate has two `role: "system"` messages with contents `"A"` and `"B"`
- **THEN** their texts SHALL be concatenated with newline separators into a single text block in the Anthropic `system` array

#### Scenario: No system messages

- **WHEN** the intermediate has no `role: "system"` messages and no client-identity block is configured
- **THEN** the Anthropic body SHALL have no `system` field (or an empty `system` is acceptable depending on host config)

#### Scenario: Cache_control applied to last system block

- **WHEN** the Anthropic `system` array has two or more text blocks
- **THEN** the LAST block SHALL have `cache_control: { type: "ephemeral", ttl: "1h" }` and no other block SHALL

### Requirement: Tool-use / tool-result ordering for Anthropic

When translating Chat-Completions → Anthropic, the gateway SHALL ensure that every tool_use block in an assistant message is followed in the next message by the matching tool_result block. The translator SHALL:
1. Split any user-or-tool message that contains both `tool_result` blocks and non-tool-result blocks: the tool_result blocks SHALL be emitted first in their own user message; the remaining blocks SHALL be emitted in a subsequent user message.
2. Flush the in-progress message immediately after appending tool_use blocks.
3. Drop assistant text blocks that appear AFTER a `tool_use` block within the same assistant content array (Anthropic rejects them).
4. Merge consecutive messages that share the same role after the above transforms.
5. When merging messages that contain tool_result blocks alongside non-tool-result blocks, place all tool_result blocks first in the merged content array.

#### Scenario: Tool_result moved to its own user message

- **WHEN** a Chat-Completions input has a tool message followed by a user message with text content, both originally adjacent
- **THEN** the Anthropic `messages[]` SHALL contain a user message whose content is exclusively the tool_result block, followed by a user message whose content is the text block

#### Scenario: Assistant text after tool_use is dropped

- **WHEN** an assistant message has content `[{ type: "text", text: "before" }, { type: "tool_use", id: "t1", name: "x", input: {} }, { type: "text", text: "after" }]`
- **THEN** the Anthropic assistant message content SHALL be `[{ type: "text", text: "before" }, { type: "tool_use", id: "t1", name: "x", input: {} }]` (the `"after"` text is removed)

#### Scenario: Thinking block before tool_use preserved

- **WHEN** an assistant message has content `[{ type: "thinking", thinking: "T" }, { type: "tool_use", id: "t1", name: "x", input: {} }]`
- **THEN** both blocks SHALL be preserved in the Anthropic assistant message content

#### Scenario: Consecutive user messages are merged

- **WHEN** the intermediate `messages[]` has two consecutive `role: "user"` messages with text contents `"a"` and `"b"`
- **THEN** the Anthropic `messages[]` SHALL have a single user message whose content includes both text blocks (preserving order)

#### Scenario: Merge with tool_result-first ordering

- **WHEN** merging consecutive user messages, the first contains a `tool_result` block and the second contains a `text` block
- **THEN** the merged user message's content SHALL list the tool_result block before the text block

### Requirement: Missing tool-result auto-injection

If an assistant message contains one or more tool_calls (OpenAI shape) or tool_use blocks (Claude shape) and the next message does not contain a matching tool_result for at least one of those call IDs, the gateway SHALL insert an empty tool message `{ role: "tool", tool_call_id: <id>, content: "" }` for EACH missing call between the assistant message and whatever follows.

#### Scenario: Single missing tool result is filled

- **WHEN** messages are `[{ role: "assistant", tool_calls: [{ id: "c1", function: { name: "x", arguments: "{}" } }] }, { role: "user", content: "next" }]`
- **THEN** the resulting messages SHALL be `[{ role: "assistant", ... }, { role: "tool", tool_call_id: "c1", content: "" }, { role: "user", content: "next" }]`

#### Scenario: Multiple missing tool results

- **WHEN** an assistant message has two tool_calls with IDs `c1` and `c2` and the next message is a user message
- **THEN** TWO empty tool messages SHALL be inserted, one per call ID, in the order the calls appeared

#### Scenario: Existing tool result is not duplicated

- **WHEN** an assistant message has a tool_call with ID `c1` and the next message is `{ role: "tool", tool_call_id: "c1", content: "result" }`
- **THEN** no additional tool message SHALL be inserted

### Requirement: Tool-call ID sanitization

The gateway SHALL ensure that every tool_call ID (in `tool_calls[].id` of assistant messages, `tool_call_id` of tool messages, `tool_use.id` and `tool_result.tool_use_id` of content blocks) matches the regex `^[a-zA-Z0-9_-]+$` AND is no longer than 64 characters before being forwarded to the Anthropic upstream. The gateway SHALL apply the following three-tier policy in order:

1. **Pass-through**: if the ID already matches the regex AND is ≤ 64 characters, it SHALL be forwarded unchanged.
2. **Strip-and-keep**: otherwise, the gateway SHALL strip every character not in `[a-zA-Z0-9_-]`. If the residue is non-empty AND ≤ 64 characters, the residue SHALL be used.
3. **UUID fallback**: otherwise (residue empty, or residue longer than 64 characters), the gateway SHALL generate a fresh RFC-4122 UUID (with dashes removed so it matches the regex) and use that as the ID. The fallback SHALL NOT depend on the message index, tool-call index, or tool name.

The same ID replacement SHALL be applied consistently to BOTH the originating `tool_use.id` / `tool_calls[].id` AND any matching `tool_result.tool_use_id` / `tool_call_id` references within the same request so the upstream sees a consistent mapping.

The gateway SHALL also ensure that every tool_call's `type` field is set to `"function"` if missing, and that every tool_call's `function.arguments` field is a JSON string (the gateway SHALL JSON-stringify object values).

#### Scenario: Valid ID passes through

- **WHEN** a tool_call has `id: "call_abc-123"`
- **THEN** the ID SHALL remain `"call_abc-123"`

#### Scenario: ID with invalid characters is sanitized

- **WHEN** a tool_call has `id: "call:abc/123"`
- **THEN** the ID SHALL become `"callabc123"`

#### Scenario: ID is entirely invalid characters

- **WHEN** a tool_call has `id: "::::"`
- **THEN** the ID SHALL become a freshly generated UUID (matching `^[a-zA-Z0-9]+$` after dash removal), independent of message index or tool name

#### Scenario: ID exceeds 64 characters after stripping

- **WHEN** a tool_call has `id: "<70-character-alphanumeric-string>"`
- **THEN** the ID SHALL be replaced with a freshly generated UUID

#### Scenario: tool_result references are remapped consistently

- **WHEN** an assistant message has a tool_call whose ID is replaced with `X`, and the following user message has a `tool_result` with `tool_use_id` matching the original
- **THEN** the user message's `tool_use_id` SHALL also be `X` so the upstream sees a consistent pair

#### Scenario: Object arguments stringified

- **WHEN** a tool_call has `function.arguments: { q: "x" }` (an object, not a string)
- **THEN** `function.arguments` SHALL become the string `"{\"q\":\"x\"}"`

#### Scenario: Type defaulted to function

- **WHEN** a tool_call has no `type` field
- **THEN** `type` SHALL be set to `"function"`

### Requirement: Tool declaration conversion (ChatCompletions → Anthropic)

When translating Chat-Completions → Anthropic, the gateway SHALL convert each tool declaration as follows: a `{ type: "function", function: { name, description, parameters } }` declaration SHALL become `{ name: <name>, description: <description or "">, input_schema: <parameters or input_schema or empty-object-schema> }`. A non-function tool declaration (e.g. an Anthropic-native server tool with a `type` other than `"function"`) SHALL be passed through unchanged. No tool-name prefix is applied; tool names are forwarded verbatim.

If the converted tools array is non-empty, the LAST tool SHALL receive `cache_control: { type: "ephemeral", ttl: "1h" }` and no other tool SHALL.

#### Scenario: Function tool conversion

- **WHEN** the intermediate has `tools: [{ type: "function", function: { name: "search", description: "find", parameters: { type: "object", properties: { q: { type: "string" } } } } }]`
- **THEN** the Anthropic tools SHALL be `[{ name: "search", description: "find", input_schema: { type: "object", properties: { q: { type: "string" } } }, cache_control: { type: "ephemeral", ttl: "1h" } }]`

#### Scenario: Default empty input_schema

- **WHEN** a function tool has no `parameters` and no `input_schema`
- **THEN** the converted `input_schema` SHALL be `{ type: "object", properties: {}, required: [] }`

#### Scenario: Server tool passes through

- **WHEN** the intermediate has `tools: [{ type: "web_search_20250305", name: "web_search" }]`
- **THEN** that entry SHALL appear unchanged in the Anthropic tools array (no prefix applied)

#### Scenario: Cache_control on last tool only

- **WHEN** there are three function tools after conversion
- **THEN** only the third tool SHALL have `cache_control` set

### Requirement: tool_choice conversion (ChatCompletions → Anthropic)

The gateway SHALL convert the Chat-Completions `tool_choice` value to the Anthropic form as follows:
- `"auto"` or `"none"` → `{ type: "auto" }`
- `"required"` → `{ type: "any" }`
- `{ type: "function", function: { name: <n> } }` → `{ type: "tool", name: <n> }`
- An Anthropic-shaped object (one that already has `type`) SHALL pass through unchanged
- Any other value SHALL default to `{ type: "auto" }`

#### Scenario: Auto

- **WHEN** the intermediate has `tool_choice: "auto"`
- **THEN** the Anthropic `tool_choice` SHALL be `{ type: "auto" }`

#### Scenario: Required becomes any

- **WHEN** the intermediate has `tool_choice: "required"`
- **THEN** the Anthropic `tool_choice` SHALL be `{ type: "any" }`

#### Scenario: Specific function

- **WHEN** the intermediate has `tool_choice: { type: "function", function: { name: "search" } }`
- **THEN** the Anthropic `tool_choice` SHALL be `{ type: "tool", name: "search" }`

#### Scenario: Already-Anthropic-shaped

- **WHEN** the intermediate has `tool_choice: { type: "any" }`
- **THEN** the Anthropic `tool_choice` SHALL be `{ type: "any" }`

### Requirement: max_tokens adjustment

The gateway SHALL set the Anthropic `max_tokens` field as follows:
1. Start with the request's `max_tokens` if present, else the project default.
2. If `tools` is a non-empty array AND the current value is below the project's minimum-with-tools threshold, raise the value to that minimum.
3. If `thinking.budget_tokens` is set AND the current value is less than or equal to `budget_tokens`, raise the value to `budget_tokens + 1024`.

#### Scenario: Request max_tokens passes through

- **WHEN** the request has `max_tokens: 4096` and no tools and no thinking
- **THEN** the Anthropic `max_tokens` SHALL be `4096`

#### Scenario: Default applied when missing

- **WHEN** the request has no `max_tokens` and no tools and no thinking
- **THEN** the Anthropic `max_tokens` SHALL be the project's default `DEFAULT_MAX_TOKENS`

#### Scenario: Raised by tools minimum

- **WHEN** the request has `max_tokens: 256` and a non-empty `tools` array, with project minimum `DEFAULT_MIN_TOKENS = 4096`
- **THEN** the Anthropic `max_tokens` SHALL be `4096`

#### Scenario: Raised above thinking budget

- **WHEN** the request has `max_tokens: 2048` and `thinking.budget_tokens: 8192`
- **THEN** the Anthropic `max_tokens` SHALL be `9216` (i.e. `budget_tokens + 1024`)

#### Scenario: Thinking budget equal triggers raise

- **WHEN** the request has `max_tokens: 8192` and `thinking.budget_tokens: 8192` (equal, not strictly greater)
- **THEN** the Anthropic `max_tokens` SHALL be `9216`

### Requirement: reasoning_effort to thinking.budget_tokens mapping

When the Chat-Completions intermediate has a `reasoning_effort` field but no explicit `thinking` block, the gateway SHALL map the effort to an Anthropic `thinking` configuration using the table: `none → no thinking emitted`, `low → { type: "enabled", budget_tokens: 4096 }`, `medium → { type: "enabled", budget_tokens: 8192 }`, `high → { type: "enabled", budget_tokens: 16384 }`, `xhigh → { type: "enabled", budget_tokens: 32768 }`. The mapping SHALL be case-insensitive. Any other effort value SHALL be ignored.

#### Scenario: medium effort

- **WHEN** the intermediate has `reasoning_effort: "medium"` and no `thinking` field
- **THEN** the Anthropic body SHALL include `thinking: { type: "enabled", budget_tokens: 8192 }`

#### Scenario: none effort emits no thinking

- **WHEN** the intermediate has `reasoning_effort: "none"`
- **THEN** the Anthropic body SHALL NOT include a `thinking` field

#### Scenario: Explicit thinking wins over effort

- **WHEN** the intermediate has both `reasoning_effort: "low"` and `thinking: { type: "enabled", budget_tokens: 999 }`
- **THEN** the Anthropic `thinking` SHALL be `{ type: "enabled", budget_tokens: 999 }`

#### Scenario: Case-insensitive

- **WHEN** the intermediate has `reasoning_effort: "HIGH"`
- **THEN** the Anthropic body SHALL include `thinking: { type: "enabled", budget_tokens: 16384 }`

### Requirement: response_format JSON-mode shim

When the Chat-Completions intermediate has `response_format`, the gateway SHALL append an additional system block to `systemParts` before assembling the Anthropic `system` array. For `response_format.type === "json_schema"` with a non-null `json_schema.schema`, the appended text SHALL include the literal phrase "You must respond with valid JSON" AND a pretty-printed JSON rendering of the schema AND the literal phrase "Respond ONLY with the JSON object". For `response_format.type === "json_object"`, the appended text SHALL include the literal phrase "You must respond with valid JSON" AND the literal phrase "Respond ONLY with a JSON object". For any other `response_format` value, no system block SHALL be appended.

#### Scenario: json_schema appends instructions and schema

- **WHEN** the intermediate has `response_format: { type: "json_schema", json_schema: { schema: { type: "object", properties: { answer: { type: "number" } } } } }`
- **THEN** the Anthropic `system` array SHALL contain a text block whose text contains both `"You must respond with valid JSON"` and the substring `"answer"` and `"Respond ONLY with the JSON object"`

#### Scenario: json_object appends generic instruction

- **WHEN** the intermediate has `response_format: { type: "json_object" }`
- **THEN** the Anthropic `system` array SHALL contain a text block whose text contains `"You must respond with valid JSON"` and `"Respond ONLY with a JSON object"`

#### Scenario: Other type ignored

- **WHEN** the intermediate has `response_format: { type: "text" }` or no `response_format`
- **THEN** no JSON-mode system block SHALL be appended

#### Scenario: Coexists with user-supplied system

- **WHEN** the intermediate has both a `role: "system"` message `"You are helpful."` and `response_format: { type: "json_object" }`
- **THEN** the Anthropic `system` array SHALL contain a text block whose combined text contains BOTH `"You are helpful."` AND `"You must respond with valid JSON"`

### Requirement: Image content mapping (ChatCompletions → Anthropic)

When translating Chat-Completions → Anthropic for a user message content block of type `image_url`, the gateway SHALL inspect the URL:
- If the URL matches `^data:([^;]+);base64,(.+)$`, emit an Anthropic block `{ type: "image", source: { type: "base64", media_type: <captured group 1>, data: <captured group 2> } }`.
- Else if the URL starts with `http://` or `https://`, emit `{ type: "image", source: { type: "url", url } }`.
- Else drop the image block.

Anthropic-shape image blocks `{ type: "image", source: ... }` SHALL be passed through unchanged.

#### Scenario: Base64 data URL

- **WHEN** a user message content has `{ type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } }`
- **THEN** the Anthropic block SHALL be `{ type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } }`

#### Scenario: HTTP URL

- **WHEN** a user message content has `{ type: "image_url", image_url: { url: "https://example.com/a.png" } }`
- **THEN** the Anthropic block SHALL be `{ type: "image", source: { type: "url", url: "https://example.com/a.png" } }`

#### Scenario: Unsupported URL is dropped

- **WHEN** a user message content has `{ type: "image_url", image_url: { url: "ftp://x/y" } }`
- **THEN** no image block SHALL appear in the Anthropic message content

### Requirement: Assistant content blocks (ChatCompletions → Anthropic)

For each assistant message in the Chat-Completions intermediate, the gateway SHALL map its content blocks and tool_calls into Anthropic content blocks as follows:

- A `text` block with non-empty `text` SHALL become an Anthropic `{ type: "text", text }` block.
- A `tool_use` block SHALL become `{ type: "tool_use", id, name, input }`. The name is forwarded verbatim with no prefix applied.
- A `thinking` or `redacted_thinking` block SHALL pass through with its `cache_control` field stripped (these block types do not accept cache_control).
- A string `content` SHALL be emitted as a single text block when non-empty.
- For each entry in `tool_calls[]` whose `type` is `"function"`, an Anthropic `{ type: "tool_use", id, name: <function.name>, input: <parsed function.arguments> }` block SHALL be appended; `function.arguments` SHALL be parsed as JSON if it is a string, falling back to the raw string when parsing fails.

#### Scenario: Text block conversion

- **WHEN** an assistant message has `content: [{ type: "text", text: "hi" }]`
- **THEN** the Anthropic assistant content SHALL contain `{ type: "text", text: "hi" }`

#### Scenario: tool_calls become tool_use

- **WHEN** an assistant message has `tool_calls: [{ id: "c1", type: "function", function: { name: "search", arguments: "{\"q\":\"x\"}" } }]`
- **THEN** the Anthropic assistant content SHALL contain `{ type: "tool_use", id: "c1", name: "search", input: { q: "x" } }`

#### Scenario: Unparseable arguments kept as string

- **WHEN** a tool_call has `function.arguments: "not json"`
- **THEN** the Anthropic `tool_use.input` SHALL be the string `"not json"`

#### Scenario: Thinking block strips cache_control

- **WHEN** an assistant message has `content: [{ type: "thinking", thinking: "T", cache_control: { type: "ephemeral" } }]`
- **THEN** the Anthropic assistant content SHALL contain `{ type: "thinking", thinking: "T" }` with no `cache_control`

### Requirement: User and tool content blocks (ChatCompletions → Anthropic)

For a tool message (`role: "tool"`), the gateway SHALL emit `{ type: "tool_result", tool_use_id: <tool_call_id>, content: <content> }` as the sole block.

For a user message:
- A string `content` SHALL produce a single `{ type: "text", text }` block when non-empty; empty strings emit nothing.
- An array `content` SHALL be walked: `text` blocks with non-empty text become Anthropic text blocks; `tool_result` blocks pass through (with their optional `is_error` field preserved); `image_url` and `image` blocks are mapped per the Image content mapping requirement.

#### Scenario: Tool message becomes tool_result

- **WHEN** messages contain `{ role: "tool", tool_call_id: "c1", content: "result text" }`
- **THEN** the Anthropic message SHALL be `{ role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: "result text" }] }`

#### Scenario: Tool_result with is_error

- **WHEN** a user message has `content: [{ type: "tool_result", tool_use_id: "c1", content: "err", is_error: true }]`
- **THEN** the Anthropic block SHALL preserve `is_error: true`

#### Scenario: Empty user string drops text block

- **WHEN** a user message has `content: ""`
- **THEN** no text block SHALL be emitted for that message

### Requirement: Cache_control on last assistant content block

After all content blocks are assembled, the gateway SHALL apply `cache_control: { type: "ephemeral" }` to the LAST eligible content block of the LAST assistant message (eligible means type in `{text, tool_use, tool_result, image}` — thinking blocks are not eligible). At most one such marker SHALL be added per request.

#### Scenario: Marker applied to last text block

- **WHEN** the last assistant message has content `[{ type: "thinking", thinking: "T" }, { type: "text", text: "answer" }]`
- **THEN** the text block SHALL receive `cache_control: { type: "ephemeral" }` and the thinking block SHALL NOT

#### Scenario: Skip past trailing thinking

- **WHEN** the last assistant message has content `[{ type: "text", text: "answer" }, { type: "thinking", thinking: "T" }]`
- **THEN** the text block (not the thinking block) SHALL receive `cache_control`

#### Scenario: No assistant message

- **WHEN** there is no assistant message in the conversation
- **THEN** no cache_control marker SHALL be added on the assistant side

### Requirement: Response stream — message_start

On the FIRST chunk received from the upstream that yields any usable delta, the streaming translator (Anthropic → ChatCompletions hop) SHALL emit a `message_start` event whose `message` field includes `id`, `type: "message"`, `role: "assistant"`, `model`, `content: []`, `stop_reason: null`, `stop_sequence: null`, and `usage: { input_tokens: 0, output_tokens: 0 }`. The translator SHALL derive `id` from the chunk's id (stripping a `chatcmpl-` prefix if present); if the derived id is empty, the value `"chat"`, or shorter than 8 characters, the translator SHALL fall back to a request-id or trace-id from the chunk's `extend_fields`, finally to `msg_<timestamp>`. The `model` field SHALL be the chunk's `model` field or `"unknown"`. This event SHALL fire exactly once per stream.

#### Scenario: message_start fires once

- **WHEN** two non-empty chunks are processed in sequence at the start of a stream
- **THEN** exactly one `message_start` event SHALL be emitted, on or before the first emission of any content_block event

#### Scenario: Empty id falls back to msg_<timestamp>

- **WHEN** the first chunk has `id: ""` and no `extend_fields`
- **THEN** the emitted `message.id` SHALL match the regex `^msg_\d+$`

#### Scenario: chatcmpl-prefix stripped

- **WHEN** the first chunk has `id: "chatcmpl-abc12345"`
- **THEN** the emitted `message.id` SHALL be `"abc12345"`

### Requirement: Response stream — text content blocks

When a chunk's `delta.content` is non-empty, the translator SHALL ensure a text content_block is open (opening with `content_block_start` of type `text` at the next available index if not yet open) and SHALL emit a `content_block_delta` event of type `text_delta` carrying the content string. Before opening a text block, any open thinking block SHALL be closed via `content_block_stop`.

#### Scenario: First text delta opens a text block

- **WHEN** the first content-bearing chunk has `delta.content: "hello"`
- **THEN** the translator SHALL emit a `content_block_start` (type text) followed by a `content_block_delta` (type text_delta, text "hello")

#### Scenario: Subsequent text delta reuses the open block

- **WHEN** a second chunk has `delta.content: " world"` and the text block is open
- **THEN** the translator SHALL emit ONLY a `content_block_delta` for that block index

#### Scenario: Text after thinking closes thinking first

- **WHEN** a thinking block is open and a chunk has `delta.content: "hello"`
- **THEN** a `content_block_stop` for the thinking block SHALL be emitted BEFORE the new text block's `content_block_start`

### Requirement: Response stream — thinking content blocks

When a chunk has `delta.reasoning_content` or `delta.reasoning` non-empty, the translator SHALL ensure a thinking content_block is open (opening with `content_block_start` of type `thinking` if not yet open) and SHALL emit a `content_block_delta` of type `thinking_delta`. Before opening a thinking block, any open text block SHALL be closed via `content_block_stop` (idempotent).

#### Scenario: reasoning_content opens thinking

- **WHEN** a chunk has `delta.reasoning_content: "step 1"` and no prior thinking emitted
- **THEN** the translator SHALL emit `content_block_start` (type thinking) followed by `content_block_delta` (type thinking_delta, thinking "step 1")

#### Scenario: reasoning alias

- **WHEN** a chunk has `delta.reasoning: "step 2"` (note the alternate field name) and no `reasoning_content`
- **THEN** the translator SHALL behave as if `delta.reasoning_content` were `"step 2"`

### Requirement: Response stream — tool_use content blocks

When a chunk's `delta.tool_calls[]` contains an entry with a non-empty `id`, the translator SHALL close any open text or thinking block and SHALL open a new tool_use content_block at the next available index. The block's `name` SHALL be the entry's `function.name` (forwarded verbatim, no prefix stripping). The block's `input` SHALL start as `{}`. When a subsequent chunk emits `function.arguments` for the same tool_call index, the translator SHALL emit `content_block_delta` of type `input_json_delta` with `partial_json` equal to that argument fragment. On finish, every open tool_use block SHALL be closed via `content_block_stop`.

#### Scenario: tool_call opens tool_use block

- **WHEN** a chunk has `delta.tool_calls: [{ index: 0, id: "c1", function: { name: "search" } }]`
- **THEN** the translator SHALL emit `content_block_start` of type `tool_use` with `id: "c1"`, name `"search"`, input `{}`

#### Scenario: Subsequent argument fragments emit input_json_delta

- **WHEN** chunk 2 has `delta.tool_calls: [{ index: 0, function: { arguments: "{\"q\":" } }]` and chunk 3 has `delta.tool_calls: [{ index: 0, function: { arguments: "\"x\"}" } }]`
- **THEN** the translator SHALL emit TWO `content_block_delta` events with `input_json_delta`, with partial_json `"{\"q\":"` then `"\"x\"}"`

#### Scenario: Tool name forwarded verbatim

- **WHEN** a tool_call has `function.name: "search"`
- **THEN** the emitted tool_use block's `name` SHALL be `"search"` (no prefix added, no prefix stripped)

#### Scenario: All tool_use blocks closed on finish

- **WHEN** the upstream emits two tool_calls and then a `finish_reason: "tool_calls"` chunk
- **THEN** TWO `content_block_stop` events SHALL be emitted, one per open tool_use block

### Requirement: Response stream — finish and usage

When a chunk has a non-null `finish_reason`, the translator (Anthropic → ChatCompletions hop) SHALL close any open text, thinking, and tool_use blocks, emit a `message_delta` event whose `delta.stop_reason` is the mapped value of the finish reason (`stop → end_turn`, `length → max_tokens`, `tool_calls → tool_use`, any other → `end_turn`) and whose `usage` is the accumulated usage, then emit `message_stop`. The accumulated `usage` SHALL be computed from any chunk that carries a `usage` object: `input_tokens = max(0, prompt_tokens − cached_tokens − cache_creation_tokens)`, `output_tokens = completion_tokens`, `cache_read_input_tokens = cached_tokens` (omitted when zero), `cache_creation_input_tokens = cache_creation_tokens` (omitted when zero). Cache token fields are read from `usage.prompt_tokens_details.{cached_tokens, cache_creation_tokens}`. Reasoning-token sub-detail SHALL NOT be added to output_tokens (it is already included in completion_tokens).

#### Scenario: stop maps to end_turn

- **WHEN** the finishing chunk has `finish_reason: "stop"`
- **THEN** the emitted `message_delta` SHALL have `delta.stop_reason: "end_turn"`

#### Scenario: length maps to max_tokens

- **WHEN** the finishing chunk has `finish_reason: "length"`
- **THEN** the emitted `message_delta` SHALL have `delta.stop_reason: "max_tokens"`

#### Scenario: tool_calls maps to tool_use

- **WHEN** the finishing chunk has `finish_reason: "tool_calls"`
- **THEN** the emitted `message_delta` SHALL have `delta.stop_reason: "tool_use"`

#### Scenario: Unknown finish reason maps to end_turn

- **WHEN** the finishing chunk has `finish_reason: "content_filter"`
- **THEN** the emitted `message_delta` SHALL have `delta.stop_reason: "end_turn"`

#### Scenario: Cache tokens propagated

- **WHEN** any chunk's `usage` is `{ prompt_tokens: 100, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 30, cache_creation_tokens: 20 } }`
- **THEN** the emitted `usage` SHALL be `{ input_tokens: 50, output_tokens: 50, cache_read_input_tokens: 30, cache_creation_input_tokens: 20 }`

#### Scenario: Zero cache tokens omitted

- **WHEN** any chunk's `usage` is `{ prompt_tokens: 100, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 0 } }`
- **THEN** the emitted `usage` SHALL be `{ input_tokens: 100, output_tokens: 50 }` (no cache fields)

### Requirement: Response stream — Chat-Completions → Responses-API events

The streaming translator (ChatCompletions → Responses-API hop) SHALL emit Responses-API events with strictly increasing `sequence_number` values starting from 1. On the first usable chunk it SHALL emit `response.created` then `response.in_progress` exactly once each. For each `delta.content` it SHALL ensure a `message` output_item is open (emitting `response.output_item.added` of type `message` with content `[]` and role `"assistant"`, then `response.content_part.added` of type `output_text`) and SHALL emit `response.output_text.delta` events. For each `delta.reasoning_content` it SHALL ensure a `reasoning` output_item is open (emitting `response.output_item.added` of type `reasoning` and `response.reasoning_summary_part.added` of type `summary_text`) and SHALL emit `response.reasoning_summary_text.delta`. On finish it SHALL close every open item (`response.output_text.done`, `response.content_part.done`, `response.output_item.done` for messages; `response.reasoning_summary_text.done`, `response.reasoning_summary_part.done`, `response.output_item.done` for reasoning; `response.function_call_arguments.done`, `response.output_item.done` for function calls) and emit `response.completed` exactly once. The `response.id` value SHALL be the upstream `chunk.id` prefixed by `resp_`. The `created_at` field SHALL be a Unix timestamp captured at stream start.

#### Scenario: sequence_number is strictly increasing

- **WHEN** any sequence of events is emitted for a stream
- **THEN** every event's `sequence_number` SHALL equal the previous event's value plus 1, starting at 1

#### Scenario: response.created precedes response.in_progress precedes any delta

- **WHEN** the first usable chunk produces a text delta
- **THEN** the emitted events SHALL be, in order: `response.created`, `response.in_progress`, `response.output_item.added`, `response.content_part.added`, `response.output_text.delta`

#### Scenario: response.completed fires once

- **WHEN** any stream ends successfully
- **THEN** exactly ONE `response.completed` event SHALL be emitted

#### Scenario: response id derived from chunk id

- **WHEN** the first chunk has `id: "abc12345"`
- **THEN** the emitted `response.id` SHALL be `"resp_abc12345"`

#### Scenario: Reasoning open/close events

- **WHEN** the upstream emits two `delta.reasoning_content` fragments then finishes
- **THEN** the emitted events SHALL include `response.output_item.added` (type reasoning), `response.reasoning_summary_part.added`, two `response.reasoning_summary_text.delta`, `response.reasoning_summary_text.done` (with full buffered text), `response.reasoning_summary_part.done`, `response.output_item.done`

### Requirement: Response stream — `<think>` inline marker recognition

When a chunk's `delta.content` contains the literal substring `<think>`, the translator SHALL split the chunk at that point, emit any text before `<think>` as normal text, open a reasoning output_item, and route the text AFTER `<think>` into the reasoning channel. When a subsequent chunk's content contains `</think>`, the translator SHALL split at that point, emit the part before `</think>` as reasoning, close the reasoning item, then emit the part after `</think>` as normal text.

#### Scenario: Open marker mid-stream

- **WHEN** a chunk has `delta.content: "intro<think>step"`
- **THEN** the translator SHALL emit a text delta for `"intro"`, open a reasoning item, and emit a reasoning delta for `"step"`

#### Scenario: Close marker mid-stream

- **WHEN** while a reasoning item is open via inline marker a chunk has `delta.content: "more</think>answer"`
- **THEN** the translator SHALL emit a reasoning delta for `"more"`, close the reasoning item, and emit a text delta for `"answer"`

#### Scenario: Open without close at EOS

- **WHEN** the stream ends while still inside an inline `<think>` block
- **THEN** the flush path SHALL close the reasoning item before `response.completed`

### Requirement: Response stream — function_call output items

When the Chat-Completions chunk indicates a tool_call (a `delta.tool_calls[]` entry), the translator SHALL emit Responses-API events as follows. For the first chunk that carries a `tool_calls[].id`, it SHALL close any currently-open `message` output_item via `closeMessage` (emitting `response.output_text.done`, `response.content_part.done`, `response.output_item.done`) and emit `response.output_item.added` of type `function_call` with `arguments: ""`, `call_id: <id>`, `name: <function.name or "">`. For each subsequent chunk carrying `function.arguments` it SHALL emit `response.function_call_arguments.delta`. On finish or end-of-stream it SHALL emit `response.function_call_arguments.done` (with the buffered arguments string, or `"{}"` if empty) followed by `response.output_item.done` of type `function_call`.

#### Scenario: function_call.added precedes any arguments delta

- **WHEN** the first tool_call chunk has `delta.tool_calls: [{ index: 0, id: "c1", function: { name: "search", arguments: "{" } }]`
- **THEN** the emitted events SHALL be `response.output_item.added` (type function_call, name "search", arguments "") then `response.function_call_arguments.delta` (delta "{")

#### Scenario: function_call done emits buffered arguments

- **WHEN** chunk 1 emits arguments `"{\"q\":"` and chunk 2 emits arguments `"\"x\"}"` and then finish is signalled
- **THEN** `response.function_call_arguments.done` SHALL carry `arguments: "{\"q\":\"x\"}"`

#### Scenario: Empty arguments default to "{}"

- **WHEN** a tool_call is opened and closed without any `function.arguments` fragments
- **THEN** the emitted `response.function_call_arguments.done` SHALL carry `arguments: "{}"`

### Requirement: Response stream — error event mapping

When the upstream emits an `error` event or a `response.failed` event, the translator (Responses-API → Chat-Completions hop) SHALL emit a single OpenAI-shaped error chunk: a `chat.completion.chunk` with `choices[0].delta.content` set to `[Error] <error.message or stringified error>` and `choices[0].finish_reason: "stop"`. The translator SHALL emit AT MOST ONE such chunk per stream — back-to-back `error` and `response.failed` events SHALL be deduplicated.

#### Scenario: error event surfaces as content chunk

- **WHEN** an `error` event arrives with `data.error: { message: "model_not_found" }`
- **THEN** the next emitted chunk SHALL be `{ choices: [{ index: 0, delta: { content: "[Error] model_not_found" }, finish_reason: "stop" }], ... }`

#### Scenario: response.failed after error is suppressed

- **WHEN** an `error` event is followed by a `response.failed` event in the same stream
- **THEN** only ONE error chunk SHALL be emitted

### Requirement: Response stream — flush on null chunk

When the streaming translator receives a `null` chunk (end-of-stream sentinel), it SHALL close every still-open output_item, emit `response.completed` if not already emitted, and emit a final Chat-Completions chunk with empty delta and a computed `finish_reason` (`tool_calls` if any tool_call was emitted, else `stop`). The flush path SHALL be idempotent: a second null chunk produces no events.

#### Scenario: Null flush closes open message

- **WHEN** the translator has an open message output_item and receives `null`
- **THEN** it SHALL emit `response.output_text.done`, `response.content_part.done`, `response.output_item.done`, `response.completed`

#### Scenario: Null flush finish_reason is tool_calls when a tool was emitted

- **WHEN** the stream emitted a tool_call and then null
- **THEN** the final Chat-Completions chunk's `finish_reason` SHALL be `"tool_calls"`

#### Scenario: Idempotent null flush

- **WHEN** the translator has already emitted `response.completed` and a second null arrives
- **THEN** no further events SHALL be emitted

### Requirement: Response stream — usage propagation on completed event

When the streaming translator (Responses-API → Chat-Completions hop) encounters a `response.completed` event whose `response.usage` is present, it SHALL set the accumulated usage to `{ prompt_tokens: input_tokens (or prompt_tokens), completion_tokens: output_tokens (or completion_tokens), total_tokens: prompt_tokens + completion_tokens }`. If `input_tokens_details.cached_tokens` (or `cache_read_input_tokens`) is > 0, it SHALL add `prompt_tokens_details: { cached_tokens: <value> }`. The usage SHALL be attached to the final Chat-Completions chunk's `usage` field.

#### Scenario: usage propagated

- **WHEN** a `response.completed` event has `response.usage: { input_tokens: 100, output_tokens: 50, input_tokens_details: { cached_tokens: 30 } }`
- **THEN** the final Chat-Completions chunk's `usage` SHALL be `{ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, prompt_tokens_details: { cached_tokens: 30 } }`

#### Scenario: Legacy field names accepted

- **WHEN** the upstream uses `prompt_tokens`/`completion_tokens`/`cache_read_input_tokens` instead of the Responses field names
- **THEN** the translator SHALL accept those values as equivalent

### Requirement: Response stream — custom_tool_call variant

The streaming translator SHALL treat `response.output_item.added` events whose `item.type` is `"custom_tool_call"` identically to `"function_call"` events. The translator SHALL treat `response.custom_tool_call_input.delta` events identically to `response.function_call_arguments.delta`. The translator SHALL treat `response.output_item.done` for `custom_tool_call` items as a tool-call increment trigger identical to `function_call`.

#### Scenario: custom_tool_call opens like function_call

- **WHEN** a `response.output_item.added` event has `item: { type: "custom_tool_call", call_id: "c1", name: "x" }`
- **THEN** the emitted Chat-Completions chunk SHALL contain `delta.tool_calls[0] = { index: 0, id: "c1", type: "function", function: { name: "x", arguments: "" } }`

#### Scenario: custom_tool_call_input.delta forwarded

- **WHEN** a `response.custom_tool_call_input.delta` event has `delta: "{}"`
- **THEN** the emitted Chat-Completions chunk SHALL contain `delta.tool_calls[0].function.arguments: "{}"`

### Requirement: Backward compatibility — no behavior change for non-Anthropic upstreams

The translation pipeline SHALL only execute when the source format and target format differ. A `/v1/responses` request routed to an OpenAI-compatible upstream SHALL behave exactly as today. A `/v1/messages` request routed to an Anthropic upstream SHALL behave exactly as today. A `/v1/chat/completions` request SHALL behave exactly as today unless its body contains an `input` array.

#### Scenario: Responses to OpenAI passthrough

- **WHEN** a `/v1/responses` request is routed to an OpenAI-compatible channel
- **THEN** the request body and response stream SHALL pass through with no transformation (same-format pivot)

#### Scenario: /v1/messages unchanged

- **WHEN** a `/v1/messages` request is routed to an Anthropic channel
- **THEN** no translation step SHALL be invoked

### Requirement: No leakage of internal state into upstream body

The gateway SHALL strip any internal scratch fields it may have attached to the body (for example fields used by the translation layer to carry per-request scratch state) before sending the body to the upstream. By convention every such scratch field's name starts with an underscore so the strip rule can match by prefix.

#### Scenario: Internal underscore-prefixed fields stripped

- **WHEN** the translator attaches an internal underscore-prefixed scratch field to the intermediate body (for example to track per-stream state)
- **THEN** the JSON body delivered to the upstream SHALL NOT contain any top-level field whose name begins with `_`
