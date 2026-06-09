<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# apicompat

## Purpose
OpenAI Chat Completions API ↔ OpenAI Responses API 双向格式转换层。使网关能够：
1. 将客户端发来的 **Chat Completions 请求** 转成 Responses API 格式发往上游（`ChatCompletionsToResponses`）。
2. 将客户端发来的 **Responses API 请求** 转成 Chat Completions 格式发往只实现 `/v1/chat/completions` 的上游（`ResponsesToChatCompletionsRequest`）。
3. 将上游返回的响应/流式事件在两种协议之间互转，保证客户端始终收到它期望的格式。

所有类型定义（`ResponsesRequest`、`ChatCompletionsRequest`、流式 chunk/event 等）都自包含在本包内，不依赖外部 `dto` 包，避免循环依赖。

## Key Files

| File | Description |
|------|-------------|
| `types.go` | 两套协议的完整类型定义：`ResponsesRequest/Response/StreamEvent`、`ChatCompletionsRequest/Response/Chunk` 及其所有子类型。`ResponsesUsage.UnmarshalJSON` 兼容 `prompt_tokens`/`completion_tokens` 旧字段名 |
| `chatcompletions_to_responses.go` | `ChatCompletionsToResponses`：将 Chat Completions 请求转为 Responses API 请求，处理消息格式、工具定义、tool_choice、response_format→text.format、reasoning_effort→reasoning.effort、采样参数（推理模型不传 temperature/top_p）|
| `responses_to_chatcompletions.go` | 三个方向的转换：`ResponsesToChatCompletions`（非流式响应）、`ResponsesEventToChatChunks`（流式事件→Chat chunk，有状态）、`ChatCompletionsResponseToResponses`、`ChatCompletionsChunkToResponsesEvents`（Chat chunk→Responses 事件，有状态）；`BufferedResponseAccumulator` 用于非流式路径下对 delta 事件的缓冲重建 |
| `chatcompletions_responses_bridge.go` | `ResponsesToChatCompletionsRequest`：将 Responses API 请求转为 Chat Completions 请求（给只支持 `/v1/chat/completions` 的上游使用）；处理 instructions→system 消息、input 数组的多类型 item（role-based、function_call、function_call_output、input_image）、工具定义反向映射、tool_choice 形状归一化 |
| `chatcompletions_responses_test.go` | 端到端转换测试：基础文本、系统消息、工具调用、图片 URL、reasoning_effort、legacy functions、service_tier、助理多部分内容（thinking 标签）等 |
| `chatcompletions_responses_bridge_test.go` | `ResponsesToChatCompletionsRequest` 测试：developer 角色映射为 system、空角色降级为 user、大小写不敏感等 |
| `chatcompletions_responseformat_test.go` | response_format 转换测试：json_schema 嵌套展平、json_object 直传、无 response_format 时返回 nil |
| `chatcompletions_toolchoice_test.go` | tool_choice 归一化测试：Chat 强制函数对象展平、字符串形式直传 |

## For AI Agents

### Working In This Directory
- **Rule 1**：所有序列化调用均通过 `common.Marshal`/`common.Unmarshal`，`encoding/json` 仅用于类型声明（`json.RawMessage`）。
- **Rule 5**：可选标量字段全部使用指针类型（`*int`、`*float64`、`*bool`、`*string`）配合 `omitempty`，确保客户端显式传 `0`/`false` 时仍能转发给上游。
- 两套协议的类型**自包含**于本包，不引用 `dto/` 包。若需共享上下游行为，通过接受/返回本包类型的函数暴露接口。
- 流式转换是**有状态**的：`ResponsesEventToChatState` 和 `ChatCompletionsToResponsesStreamState` 必须在整个 SSE 流生命周期内保持，不能在每个事件间重建。
- `isReasoningModel` 目前用 `strings.HasPrefix(model, "gpt-5")` 判断推理模型，新增推理模型系列时需在此处更新。
- `minMaxOutputTokens = 128`：将 Chat `max_tokens` 映射到 Responses `max_output_tokens` 时有下界截断，避免上游因值过小而拒绝请求。
- `BufferedResponseAccumulator` 用于非流式路径：当 `response.completed` 的 `output[]` 为空时，从前序 delta 事件中重建输出内容。修改 delta 事件处理逻辑时须同步更新此类。
- tool_choice 在两套 API 的对象形状不同——Chat 用 `{"type":"function","function":{"name":"X"}}`，Responses 用 `{"type":"function","name":"X"}`——转换时必须主动展平/还原，否则上游会返回参数缺失错误。

### Testing Requirements
- 运行命令：`go test ./pkg/apicompat/...`
- 测试覆盖了请求和非流式响应的主要场景；流式路径目前依赖上层集成测试覆盖。
- 新增转换逻辑时，必须在对应 `*_test.go` 文件中补充至少一个 table-driven 测试用例，包含输入和预期输出的完整断言。

### Common Patterns

```go
// Chat Completions → Responses（上游是 Responses API）
responsesReq, err := apicompat.ChatCompletionsToResponses(chatReq)

// Responses → Chat Completions（上游只支持 Chat Completions）
chatReq, err := apicompat.ResponsesToChatCompletionsRequest(responsesReq)

// 流式：Responses 事件 → Chat chunk
state := apicompat.NewResponsesEventToChatState()
state.Model = "gpt-4o"
state.IncludeUsage = true
for _, evt := range events {
    chunks := apicompat.ResponsesEventToChatChunks(evt, state)
    // ... 写出 chunks
}
finalChunks := apicompat.FinalizeResponsesChatStream(state)

// 流式：Chat chunk → Responses 事件
state := apicompat.NewChatCompletionsToResponsesStreamState(model)
for _, chunk := range chunks {
    events := apicompat.ChatCompletionsChunkToResponsesEvents(chunk, state)
    // ... 写出 events
}
terminalEvents := apicompat.FinalizeChatCompletionsResponsesStream(state)
```

## Dependencies

### Internal
- `common` — `Marshal`/`Unmarshal`（Rule 1）

### External
- `encoding/json` — `json.RawMessage` 类型声明（仅类型，不调用序列化方法）
- `crypto/rand` — 生成随机 ID（`chatcmpl-*`、`resp_*`、`item_*`）
- 标准库：`fmt`、`strings`、`time`

<!-- MANUAL: -->
