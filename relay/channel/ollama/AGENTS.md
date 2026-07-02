<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/ollama

## Purpose

Ollama 本地模型服务适配器。`Adaptor` 不嵌入 `openai.Adaptor`（空 struct），将 OpenAI 格式转换为 Ollama 原生 API 格式（`/api/chat`、`/api/generate`、`/api/embed`），支持 chat（含 tool_calls、thinking、image base64）、completions（generate）、embeddings 三种 relay mode。Claude 格式请求通过 `openai.Adaptor{}.ConvertClaudeRequest` 转为 OpenAI 后再转 Ollama。此外提供模型管理工具函数（`FetchOllamaModels`、`PullOllamaModel`/`PullOllamaModelStream`、`DeleteOllamaModel`、`FetchOllamaVersion`）供 controller 层调用。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体（空 struct）及接口实现：`Init`（空）、`GetRequestURL`（embeddings→`/api/embed`，completions→`/api/generate`，其他→`/api/chat`）、`SetupRequestHeader`（`Authorization: Bearer`）、`ConvertOpenAIRequest`（completions→`openAIToGenerate`，其他→`openAIChatToOllamaChat`）、`ConvertClaudeRequest`（实例化 `openai.Adaptor{}` 转 Claude→OpenAI，注入 `StreamOptions.IncludeUsage=true`，再 `openAIChatToOllamaChat`）、`ConvertEmbeddingRequest`（`requestOpenAI2Embeddings`）、`ConvertGeminiRequest`/`ConvertAudioRequest`/`ConvertImageRequest`/`ConvertOpenAIResponsesRequest`/`ConvertRerankRequest`（not implemented 或 nil）、`DoRequest`（`channel.DoApiRequest`）、`DoResponse`（embeddings→`ollamaEmbeddingHandler`，流式→`ollamaStreamHandler`，非流式→`ollamaChatHandler`）、`GetModelList`/`GetChannelName` |
| `dto.go` | Ollama 原生请求/响应结构体：`OllamaChatMessage`（含 `Images []string` base64、`ToolCalls`、`ToolName`、`Thinking json.RawMessage`）、`OllamaTool`/`OllamaToolFunction`/`OllamaToolCall`、`OllamaChatRequest`（`Model/Messages/Tools/Format/Stream/Options/KeepAlive/Think`）、`OllamaGenerateRequest`（completions 路径，`Prompt/Suffix/Images/Format/Stream/Options/KeepAlive/Think`）、`OllamaEmbeddingRequest`/`Response`（`Embeddings [][]float64`、`PromptEvalCount`）、`OllamaTagsResponse`/`OllamaModel`/`OllamaModelDetail`（模型列表与详情）、`OllamaPullRequest`/`OllamaPullResponse`（模型拉取）、`OllamaDeleteRequest` |
| `relay-ollama.go` | 请求转换与 embedding/模型管理：`openAIChatToOllamaChat`（`GeneralOpenAIRequest` → `OllamaChatRequest`：处理 `ResponseFormat`→`Format` json/json_schema、options map 映射 temperature/top_p/top_k/num_predict/stop/seed、messages 解析 image_url→base64 via `service.GetBase64Data`、tool_calls arguments JSON→interface{}）、`openAIToGenerate`（completions 路径，类似但生成 `OllamaGenerateRequest`，含 `Prompt`/`Suffix` 提取）、`requestOpenAI2Embeddings`（`EmbeddingRequest` → `OllamaEmbeddingRequest`，单条 input 时 `Input` 为 string 而非 slice）、`ollamaEmbeddingHandler`（响应→`OpenAIEmbeddingResponse`，usage 取 `PromptEvalCount`）、`FetchOllamaModels`（GET `/api/tags`）、`PullOllamaModel`（POST `/api/pull` 非流式，30 分钟超时）、`PullOllamaModelStream`（流式拉取，1 小时超时，`helper.NewStreamScanner` 逐行读，支持 `progressCallback`，遇 error 或 success 状态终止）、`DeleteOllamaModel`（DELETE `/api/delete`）、`FetchOllamaVersion`（GET `/api/version`） |
| `stream.go` | 流式与非流式 chat/generate 响应处理：`ollamaChatStreamChunk`（统一 chat 与 generate 的流块结构，含 `Message`/`Response`/`Done`/`DoneReason`/`PromptEvalCount`/`EvalCount` 等）、`toUnix`（时间字符串→Unix 时间戳）、`ollamaStreamHandler`（逐行 `json.Unmarshal` 每个 NDJSON chunk，非 done 帧发 `chat.completion.chunk` delta——含 content/thinking/tool_calls→`ToolCallResponse`，done 帧发 stop + usage + `[DONE]`）、`ollamaChatHandler`（非流式：因 Ollama 的非流式响应也是 NDJSON 多行，需逐行解析聚合 content/thinking，再组装 `OpenAITextResponse`；单行时直接解析）、`contentPtr`（空字符串→nil 指针辅助） |
| `constants.go` | `ModelList`（仅 `llama3-7b`）与 `ChannelName = "ollama"` |

## For AI Agents

### Working In This Directory

- **Ollama 原生 API（非 OpenAI 兼容）**：与多数 provider 不同，Ollama 使用自己的原生 API（`/api/chat`、`/api/generate`、`/api/embed`），请求与响应格式均与 OpenAI 不同。本目录做了完整的双向转换（OpenAI↔Ollama、Claude→OpenAI→Ollama）。
- **NDJSON 响应**：Ollama 的响应是 NDJSON（Newline Delimited JSON），即使非流式也可能有多行。`ollamaChatHandler` 的非流式路径需逐行解析并聚合 content——这是 Ollama 独有的处理方式，不要假设非流式响应是单个 JSON 对象。
- **图片 base64 内联**：`openAIChatToOllamaChat` 通过 `service.GetBase64Data(c, source, "fetch image for ollama chat")` 将 image_url 转为 base64 字符串放入 `OllamaChatMessage.Images`——Ollama 不支持 URL 引用图片，必须内联。
- **tool_calls arguments 转换**：OpenAI 的 `tool_calls[].function.arguments` 是 JSON 字符串，Ollama 要求 `interface{}`。转换时 `json.Unmarshal` 字符串→`interface{}`，空 arguments 转为 `map[string]any{}`。
- **Rule 1 违规（已存在）**：`relay-ollama.go` 和 `stream.go` 均导入了 `encoding/json` 并直接调用 `json.Unmarshal`/`json.Marshal`（如 `relay-ollama.go:36` 的 `json.Unmarshal(r.ResponseFormat.JsonSchema, &schema)`、`stream.go:90` 的 `json.Unmarshal([]byte(line), &chunk)`、`stream.go:138` 的 `json.Marshal(tc.Function.Arguments)` 等）。`dto.go` 的 `json.RawMessage` 引用符合 Rule 1 例外。修改此目录代码时，新代码应使用 `common.Unmarshal`/`common.Marshal`，但存量违规需谨慎重构（流式路径的逐行解析性能可能受影响）。
- **Rule 5（指针零值）**：`OllamaChatRequest`/`OllamaGenerateRequest` 的 `Options map[string]any` 模式绕过了指针零值问题（map 按需添加 key），但 `OllamaChatMessage` 的标量字段（如 `OllamaToolFunction.Parameters interface{}`）使用 `omitempty`——因 `interface{}` 的零值是 nil，`omitempty` 能正确区分"未设"与"显式设为空"。
- **模型管理函数**：`FetchOllamaModels`/`PullOllamaModel`/`PullOllamaModelStream`/`DeleteOllamaModel`/`FetchOllamaVersion` 是供 controller 层（渠道管理）调用的工具函数，不参与 relay 请求路径。`PullOllamaModelStream` 的 `progressCallback` 用于 UI 进度展示。
- **超时设置**：`PullOllamaModel` 30 分钟超时，`PullOllamaModelStream` 1 小时超时（支持超大模型），`FetchOllamaVersion` 10 秒超时。修改时注意不要缩短这些超时。
- **ModelList 仅含一个模型**：`ModelList` 只有 `llama3-7b`，实际渠道通过 `FetchOllamaModels` 动态获取可用模型列表。

### Testing Requirements

- `go build ./relay/channel/ollama/...` 必须通过
- `go test ./relay/channel/...`
- 无独立 `_test.go`；手动测试流式/非流式 chat、embeddings、completions(generate) 路径
- 测试图片消息（image_url base64 转换）与 tool_calls

### Common Patterns

- **OpenAI→Ollama 双向转换**：`openAIChatToOllamaChat` / `openAIToGenerate` 是请求侧转换，`ollamaStreamHandler` / `ollamaChatHandler` 是响应侧转换。Claude 格式经由 OpenAI 中转。
- **NDJSON 逐行解析**：`stream.go` 使用 `helper.NewStreamScanner(resp.Body)` 按行扫描，`json.Unmarshal` 每行。非流式 handler 也用 `strings.Split(raw, "\n")` 逐行解析。
- **options map 映射**：OpenAI 的 `temperature`/`top_p`/`max_tokens` 等映射到 Ollama 的 `options` map（key 名不同，如 `num_predict` 对应 `max_tokens`）。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal`、`Unmarshal`、`GetUUID`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`EmbeddingRequest`、`ChatCompletionsStreamResponse`/`Choice`/`Delta`、`OpenAITextResponse`/`Choice`、`OpenAIEmbeddingResponse`/`Item`、`Message`、`ToolCallResponse`、`Usage`、`StreamOptions`、`ContentTypeImageURL`、`ContentTypeText`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/openai` — `Adaptor`（ConvertClaudeRequest 委托）
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`
- `relayconstant "github.com/QuantumNous/new-api/relay/constant"` — `RelayModeEmbeddings`、`RelayModeCompletions`
- `github.com/QuantumNous/new-api/relay/helper` — `NewStreamScanner`、`SetEventStreamHeaders`、`GenerateStartEmptyResponse`、`GenerateStopResponse`、`GenerateFinalUsageResponse`、`StringData`、`Done`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`、`IOCopyBytesGracefully`、`GetBase64Data`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewOpenAIError`、`ErrorCodeBadResponseBody`、`ErrorCodeReadResponseBodyFailed`、`ErrorCodeBadResponse`

### External

- `github.com/gin-gonic/gin` — HTTP 上下文
- `net/http`、`io`、`fmt`、`strings`、`time`、`errors` — 标准库
- `encoding/json` — **违规直接调用**（`relay-ollama.go`、`stream.go` 的 Marshal/Unmarshal，应改为 `common.*`，Rule 1）；`dto.go` 的 `json.RawMessage` 类型引用符合例外
- `github.com/samber/lo` — `FromPtrOr`、`FromPtr`、`ToPtr`（`relay-ollama.go`）

<!-- MANUAL: -->
