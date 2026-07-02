<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/palm

## Purpose

Google PaLM（旧版 Generative AI API v1beta2）适配器，对接 `chat-bison-001:generateMessage` 端点。`Adaptor` 不嵌入 `openai.Adaptor`（空 struct），自行实现全部接口方法。仅支持 OpenAI 格式的 chat completions 透传（`ConvertOpenAIRequest` 不做转换，直接返回原 request），将 PaLM 响应转换为 OpenAI `OpenAITextResponse` 或流式 `ChatCompletionsStreamResponse`。流式模式下 PaLM 实际返回的是完整 JSON（非 SSE），本目录的 `palmStreamHandler` 将其包装为单帧 SSE 输出。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体（空 struct）及接口实现：`Init`（空）、`GetRequestURL`（固定 `{ChannelBaseUrl}/v1beta2/models/chat-bison-001:generateMessage`）、`SetupRequestHeader`（`x-goog-api-key` 而非 Bearer）、`ConvertOpenAIRequest`（透传 request 不做转换）、`ConvertClaudeRequest`/**`panic("implement me")`**、`ConvertGeminiRequest`/`ConvertAudioRequest`/`ConvertImageRequest`/`ConvertEmbeddingRequest`/`ConvertOpenAIResponsesRequest`（not implemented）、`ConvertRerankRequest`（nil）、`DoRequest`（`channel.DoApiRequest`）、`DoResponse`（流式→`palmStreamHandler` + `service.ResponseText2Usage` 估算 usage；非流式→`palmHandler`）、`GetModelList`/`GetChannelName` |
| `dto.go` | PaLM 原生结构体：`PaLMChatMessage`（`Author`/`Content`）、`PaLMPrompt`（`Messages []PaLMChatMessage`）、`PaLMChatRequest`（`Prompt`/`Temperature *float64`/`CandidateCount int`/`TopP float64`/`TopK uint`）、`PaLMError`（`Code`/`Message`/`Status`）、`PaLMChatResponse`（`Candidates []PaLMChatMessage`/`Messages []dto.Message`/`Filters []PaLMFilter`/`Error PaLMError`）、`PaLMFilter`（`Reason`/`Message`） |
| `relay-palm.go` | 响应转换与 handler：`responsePaLM2OpenAI`（`PaLMChatResponse` → `OpenAITextResponse`，每个 candidate 变为一个 choice）、`streamResponsePaLM2OpenAI`（→ `ChatCompletionsStreamResponse` 单帧，`Model` 硬编码 `"palm2"`）、`palmStreamHandler`（**读取完整 body 后一次性解析**——因 PaLM 不支持真正的流式，goroutine 内 `json.Unmarshal` 后发单帧 + `[DONE]`，使用 `dataChan`/`stopChan` 与 `c.Stream` 协调）、`palmHandler`（非流式：解析→错误检查（`Error.Code != 0` 或无 candidates）→转换→`service.ResponseText2Usage` 估算 usage→写回） |
| `constants.go` | `ModelList`（仅 `PaLM-2`）与 `ChannelName = "google palm"` |

## For AI Agents

### Working In This Directory

- **PaLM 旧版 API**：PaLM 2 的 `v1beta2` `generateMessage` API 已被 Google Gemini 取代。本目录是遗留适配器，新渠道应使用 `relay/channel/gemini/`。
- **`ConvertClaudeRequest` 会 panic**：`adaptor.go:28` 调用 `panic("implement me")`——Claude 格式请求会导致崩溃。
- **请求头差异**：PaLM 使用 `x-goog-api-key` 而非标准的 `Authorization: Bearer`，这是 Google API 的惯例。
- **流式是伪流式**：PaLM 的 `generateMessage` 不支持真正的 SSE 流式。`palmStreamHandler` 实际上读取完整 JSON 响应后，用 goroutine + channel 将其包装为单帧 SSE + `[DONE]` 发送给客户端——客户端看到的是"一次性到达的流式响应"。
- **usage 全靠估算**：PaLM 响应不返回 token 用量，`DoResponse` 与 `palmHandler` 均使用 `service.ResponseText2Usage`（基于文本长度 + 模型 tokenizer）估算 usage。
- **Rule 1 违规（已存在）**：`relay-palm.go` 导入了 `encoding/json` 并直接调用 `json.Unmarshal`（`relay-palm.go:68`、`relay-palm.go:111`）和 `json.Marshal`（`relay-palm.go:80`）。这些应使用 `common.Unmarshal`/`common.Marshal`（Rule 1）。`palmHandler` 中的 `common.Marshal`（`relay-palm.go:126`）是正确的。修改此文件时新代码应使用 `common.*`。
- **Rule 5（DTO 指针零值）**：`PaLMChatRequest` 的 `CandidateCount int`/`TopP float64`/`TopK uint` 使用非指针标量 + `omitempty`——这是 Rule 5 指出的问题模式（零值会被静默丢弃）。但因此 adapter 的 `ConvertOpenAIRequest` 直接透传 OpenAI request 而不构造 `PaLMChatRequest`，这些字段实际上从未被使用，不影响运行。

### Testing Requirements

- `go build ./relay/channel/palm/...` 必须通过
- `go test ./relay/channel/...`
- 无独立 `_test.go`；手动测试流式与非流式 chat completions

### Common Patterns

- **伪流式包装**：`palmStreamHandler` 的 `dataChan`/`stopChan` + `c.Stream` 模式用于将非流式上游包装为流式输出。
- **错误透传**：`palmHandler` 检查 `PaLMChatResponse.Error.Code != 0` 并转为 `types.WithOpenAIError`。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal`、`GetTimestamp`、`GetUUID`、`CustomEvent`、`SysLog`
- `github.com/QuantumNous/new-api/constant` — `FinishReasonStop`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`ClaudeRequest`、`GeminiChatRequest`、`AudioRequest`、`ImageRequest`、`EmbeddingRequest`、`RerankRequest`、`OpenAIResponsesRequest`、`OpenAITextResponse`/`Choice`、`ChatCompletionsStreamResponse`/`Choice`、`Message`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/helper` — `SetEventStreamHeaders`、`GetResponseID`
- `github.com/QuantumNous/new-api/service` — `ResponseText2Usage`、`CloseResponseBodyGracefully`、`IOCopyBytesGracefully`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewOpenAIError`、`NewError`、`WithOpenAIError`、`OpenAIError`、`ErrorCodeBadResponseBody`、`ErrorCodeReadResponseBodyFailed`

### External

- `github.com/gin-gonic/gin` — HTTP 上下文
- `net/http`、`io`、`fmt`、`errors` — 标准库
- `encoding/json` — **违规直接调用**（`relay-palm.go` 的 `json.Unmarshal`/`json.Marshal`，应改为 `common.*`，Rule 1）

<!-- MANUAL: -->
