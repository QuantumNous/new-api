<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/openai

## Purpose

OpenAI 原生适配器，直接对接 OpenAI 官方 API（chat/completions、completions、embeddings、rerank、images generations/edits、audio speech/transcription/translation、realtime、responses 与 responses compact 等多种 relay mode），同时也作为绝大多数 OpenAI 兼容 provider（ai360、lingyiwanwu、openrouter、xinference 等）的**基础实现**——这些 provider 在 `relay/relay_adaptor.go` 工厂中直接返回 `&openai.Adaptor{}`，由本目录的 `GetModelList` / `GetChannelName` / `ConvertOpenAIRequest` 根据 `info.ChannelType` 内部分支处理（如 OpenRouter 的 reasoning 后缀、usage 字段注入等）。

本目录是 relay 中代码量最大的 adapter 之一：既负责请求转换，也负责**流式/非流式响应解析、多 RelayFormat（OpenAI / Claude / Gemini）输出适配、usage 后处理（含 cached_tokens 从非标准位置提取）**，以及 Realtime WebSocket 双向代理与 token 计费。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体（仅含 `ChannelType int` 与 `ResponseFormat string` 两个字段）及 `Adaptor` 接口的所有方法实现：`Init`、`GetRequestURL`（按 ChannelType 分支：Azure 的 deployment 路径与 api-version、Custom 的 `{model}` 占位、realtime 的 ws/wss 协议转换、Claude/Gemini RelayFormat 强制走 `/v1/chat/completions` 等）、`SetupRequestHeader`（Azure 用 `api-key`、OpenAI 的 `OpenAI-Organization`、OpenRouter 的 `HTTP-Referer`/`X-OpenRouter-Title`、realtime 的 `Sec-WebSocket-Protocol` 鉴权）、`ConvertOpenAIRequest`（核心转换：剔除空 tools 时的 parallel_tool_calls、非 OpenAI/Azure 渠道清空 StreamOptions、OpenRouter 的 `-thinking` 后缀→reasoning、O 系列与 GPT-5 系列参数归零、`ParseOpenAIReasoningEffortFromModelSuffix` 解析、system→developer 角色改名）、`ConvertClaudeRequest`（委托 `service.ClaudeToOpenAIRequest` 后回流到 `ConvertOpenAIRequest`）、`ConvertGeminiRequest`（委托 `service.GeminiToOpenAIRequest`）、`ConvertImageRequest`（images edits 的 multipart 构造，含 `image` / `image[]` 字段兼容与 MIME 探测 `detectImageMimeType`，并剔除 `Stream`/`PartialImages`）、`ConvertAudioRequest`（TTS 的 JSON body 与 STT 的 multipart form）、`ConvertEmbeddingRequest`/`ConvertRerankRequest`（透传）、`ConvertOpenAIResponsesRequest`（解析 reasoning effort 后缀）、`DoRequest`（按 mode 分发到 `channel.DoFormRequest`/`channel.DoWssRequest`/`channel.DoApiRequest`）、`DoResponse`（按 mode 分发到对应 handler）、`GetModelList`/`GetChannelName`（按 ChannelType 返回 ai360/lingyiwanwu/xinference/openrouter 或自身列表） |
| `constant.go` | `ModelList`（硬编码 70+ OpenAI 模型名，含 gpt-3.5/4/4o/4.1/4.5/o1/o3/o4/gpt-5.x 系列、audio/realtime、embedding、moderation、dall-e、gpt-image、whisper、tts、sora 等）与 `ChannelName = "openai"` |
| `relay-openai.go` | OpenAI 格式响应处理核心：`OaiStreamHandler`（流式 chat/completions，逐行 SSE 扫描、`HandleStreamFormat` 多格式输出、音频模型从倒数第二个 SSE 提取 usage、`handleLastResponse` 处理末帧 usage、`applyUsagePostProcessing` 按渠道补 cached_tokens）、`OpenaiHandler`（非流式，含 OpenRouter Enterprise 的 `{success,data}` 信封拆包、`forceFormat` 重序列化、按 RelayFormat 转换为 Claude/Gemini）、`OpenaiHandlerWithUsage`（images 路径，基于 `SimpleResponse`）、`sendStreamData`（`thinkToContent` 模式把 `<think>...</think>` 标签注入 content）、`OpenaiRealtimeHandler`（Realtime WebSocket 双向代理 + `preConsumeUsage` 增量计费）、`applyUsagePostProcessing`（DeepSeek/智谱/Moonshot/OpenAI 的 cached_tokens 从非标准字段补齐）、`extractCachedTokensFromBody`/`extractMoonshotCachedTokensFromBody`/`extractLlamaCachedTokensFromBody`（从 `prompt_cache_hit_tokens`、`choices[].usage.cached_tokens`、`timings.cache_n` 等非标准位置提取缓存命中 token）、`streamTTSResponse`（二进制音频流转发） |
| `relay_responses.go` | Responses API 响应处理：`OaiResponsesHandler`（非流式，解析 `OpenAIResponsesResponse`，提取 image_generation_call 上下文与 built-in tools 调用计数）、`OaiResponsesStreamHandler`（流式，按事件类型 `response.completed`/`response.output_text.delta`/`ResponsesOutputTypeItemDone` 聚合 usage 与 web_search 工具调用，含 FRT watchdog：首字超时且未写客户端时返回 `ErrorCodeChannelResponseTimeExceeded` 触发重试） |
| `relay_responses_compact.go` | `OaiResponsesCompactionHandler`：非流式解析 `OpenAIResponsesCompactionResponse`，透传 body 并从 `usage` 提取 input/output/total/cached tokens |
| `chat_via_responses.go` | Responses→Chat Completions 转换层（当客户端用 chat 格式但渠道走 responses 时）：`OaiResponsesToChatHandler`（非流式，`service.ResponsesResponseToChatCompletionsResponse` 后按 RelayFormat 输出）、`OaiResponsesToChatStreamHandler`（流式，逐事件转换为 `chat.completion.chunk`，处理 `response.output_text.delta`、`response.function_call_arguments.delta`、`response.reasoning_summary_text.delta`、`response.completed`，支持 tool_calls 累积与 finish_reason 判定）|
| `audio.go` | 音频 handler：`OpenaiTTSHandler`（流式与非流式两种，非流式按音频格式计算时长——PCM 按 24kHz/16bit/mono 直接算、其他走 `common.GetAudioDuration`——再换算为每分钟 1000 tokens；流式扫描 `usage` 字段）、`OpenaiSTTHandler`（优先用响应体中的 usage，否则只计 prompt tokens） |
| `helper.go` | 流式辅助：`HandleStreamFormat`（按 RelayFormat 分发到 `sendStreamData`/`handleClaudeFormat`/`handleGeminiFormat`）、`handleClaudeFormat`/`handleGeminiFormat`（OpenAI 流块→Claude/Gemini 流块）、`ProcessStreamResponse`/`processTokenData`（按 relayMode 解析 chat 或 completions 流块并累计文本与 tool 计数）、`processCompletionsStreamResponse`、`handleLastResponse`（解析末帧 usage 与 `ShouldIncludeUsage` 时的去重判定）、`HandleFinalResponse`（按 RelayFormat 发送末帧 usage chunk 与 `[DONE]`）、`sendResponsesStreamData`（透传到 `helper.ResponseChunkData`） |
| `adaptor_test.go` | 单元测试：`TestConvertOpenAIRequest_DropParallelToolCallsWhenNoTools`（验证空 tools 时 `parallel_tool_calls` 被剔除），覆盖 OpenAI/Azure/其他渠道三类 ChannelType |

## For AI Agents

### Working In This Directory

- **基础 adapter 角色**：本目录的 `Adaptor` 不仅是 OpenAI 渠道的适配器，还是 ai360 / lingyiwanwu / openrouter / xinference 等渠道的**实际实现**（工厂直接返回 `&openai.Adaptor{}`）。修改 `ConvertOpenAIRequest`、`DoResponse`、`GetModelList` 等方法会影响所有这些渠道——改动前必须用 GitNexus `impact` 评估 blast radius，并在 PR 中说明波及面（参考根 CLAUDE.md GitNexus 章节）。
- **Rule 1（JSON 包装）**：本目录已统一通过 `common.Marshal`/`common.Unmarshal`/`common.UnmarshalJsonStr` 操作 JSON；`adaptor.go` 中对 `encoding/json` 的 import 仅用于类型引用（`json.RawMessage`），符合 Rule 1 例外。新增代码不得直接调用 `encoding/json` 的 marshal/unmarshal。
- **Rule 4（StreamOptions）**：`ConvertOpenAIRequest` 在 `info.SupportStreamOptions && info.IsStream` 时为 Claude 转换路径注入 `StreamOptions.IncludeUsage=true`；OpenAI 与 Azure 渠道保留客户端的 StreamOptions，**其他所有渠道一律清空 `request.StreamOptions = nil`**（避免向上游发送不支持的字段）。新增兼容渠道若支持 `stream_options`，需在 `relay/common/relay_info.go` 的 `streamSupportedChannels` 注册。
- **Rule 5（指针零值）**：`dto.GeneralOpenAIRequest` 的可选标量字段（`MaxTokens`、`MaxCompletionTokens`、`Temperature`、`TopP`、`ReasoningEffort` 等）均为指针 + `omitempty`。本目录的 O 系列/GPT-5 系列适配大量依赖"字段是否为 nil"来判断是否上游支持，修改时不要破坏这一语义。
- **Azure 特殊路径**：`GetRequestURL` 中 Azure 分支会根据 `ChannelCreateTime` 决定是否移除模型名中的 `.`（`AzureNoRemoveDotTime` 之前创建的渠道移除），responses API 走 `/openai/v1/responses` 或 `/openai/responses`（按域名探测），compact 模式追加 `/compact`，`AzureResponsesVersion` 可被 `ChannelOtherSettings` 覆盖。
- **usage 后处理**：`applyUsagePostProcessing` 按 `ChannelType` 从非标准位置补 `PromptTokensDetails.CachedTokens`。DeepSeek 走 `prompt_cache_hit_tokens`、智谱走 `input_tokens_details.cached_tokens` 或 body 内 `prompt_tokens_details.cached_tokens`、Moonshot 走 `choices[].usage.cached_tokens`（非标准）、OpenAI 走 `timings.cache_n`（llama.cpp 自部署）。新增渠道若 cached tokens 在非标准位置，在此添加分支。
- **multipart form 内存**：`ConvertImageRequest` 与 `ConvertAudioRequest` 会重复使用 `c.Request.MultipartForm`，并通过 `c.Request.Header.Set("Content-Type", ...)` 覆盖请求头以传递新的 boundary——注意这是在请求体已经构造完成后修改 gin Context 的 header。
- **Realtime WebSocket**：`OpenaiRealtimeHandler` 使用 `gopool.Go` 启动两个 goroutine 读写 client/target WebSocket，通过 channel 协调；`preConsumeUsage` 在每次 `response.done` 事件时增量计费（`service.PreWssConsumeQuota`）。超时/连接关闭时仍会结算残余 usage。
- **Responses→Chat 转换**：`chat_via_responses.go` 是当客户端发 chat completions 但上游渠道配置为走 responses API 时的桥接层。流式转换维护了 `toolCallIndexByID`/`toolCallArgsByID`/`toolCallCanonicalIDByItemID` 等 map 来正确累积 tool_calls 的 index、name 和 arguments delta。
- **FRT watchdog**：`OaiResponsesStreamHandler` 在 `StreamStatus.EndReason == StreamEndReasonFirstResponseTimeout` 且尚未向客户端写任何数据时，返回 `ErrorCodeChannelResponseTimeExceeded` 错误——这会让 `controller/relay.go` 的重试循环尝试下一个渠道。修改流式 handler 时不要破坏这一早期失败语义。

### Testing Requirements

- `go build ./relay/channel/openai/...` 必须通过
- `go test ./relay/channel/openai/...` 运行 `adaptor_test.go`
- `go test ./relay/channel/...` 跑全 channel 包测试
- 手动测试流式与非流式两条路径，以及 Claude/Gemini RelayFormat 转换

### Common Patterns

- **DoResponse 分发**：`DoResponse` 是一个大的 switch on `info.RelayMode`，每个 case 调用对应的 handler 函数，返回 `(usage any, err *types.NewAPIError)`。新增 relay mode 在此添加 case。
- **handler 函数命名**：`Oai*Handler`（导出，供其他 adapter 复用）、`Openai*Handler`（导出）、`openai*` / `ollama*`（私有）。其他 OpenAI 兼容 adapter（mistral、ollama、perplexity、moonshot）直接调用 `openai.OaiStreamHandler` / `openai.OpenaiHandler` 复用响应解析。
- **usage 后处理链**：handler 解析完 usage → `applyUsagePostProcessing` 补 cached_tokens → 返回给 relay 层计费。
- **流式 chunk 输出**：所有流式输出最终经过 `helper.StringData` / `helper.ObjectData` / `helper.ClaudeData` / `helper.ResponseChunkData` 写到 gin Context，再由 `helper.FlushWriter` 刷新。
- **error 转换**：上游错误统一转为 `types.NewOpenAIError` / `types.WithOpenAIError` / `types.NewError`，携带 `ErrorCode*` 与 HTTP status code。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — JSON 包装、`SysLog`、`GetUUID`、`GetTimestamp`、`GetStringIfEmpty`、`StringToByteSlice`、`SetContextKey`、`GetPointer`、`Debug` 等
- `github.com/QuantumNous/new-api/constant` — `ChannelType*`、`FinishReason*`、`AzureDefaultAPIVersion`、`AzureNoRemoveDotTime`、`StreamingFirstResponseTimeout`、`ContextKeyAdminRejectReason`、`ContextKeyLocalCountTokens`、`ChannelBaseURLs`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`ClaudeRequest`、`GeminiChatRequest`、`ImageRequest`、`AudioRequest`、`EmbeddingRequest`、`RerankRequest`、`OpenAIResponsesRequest`/`Response`、`ChatCompletionsStreamResponse`、`Usage`、`RealtimeUsage`/`Event`、`ToolCallResponse`、`Thinking`、`StreamOptions`、`IsOpenAIReasoningOModel`/`IsOpenAIGPT5Model` 等
- `github.com/QuantumNous/new-api/logger` — 结构化日志
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`、`DoFormRequest`、`DoWssRequest`
- `github.com/QuantumNous/new-api/relay/channel/ai360`、`lingyiwanwu`、`openrouter`、`xinference` — `ModelList`/`ChannelName` 委托
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`、`ThinkingContentInfo`、`ClaudeConvertInfo`、`StreamStatus`、`GetFullRequestURL`
- `github.com/QuantumNous/new-api/relay/common_handler` — `RerankHandler`
- `relayconstant "github.com/QuantumNous/new-api/relay/constant"` — `RelayMode*` 常量
- `github.com/QuantumNous/new-api/relay/helper` — `StringData`、`ObjectData`、`StreamScannerHandler`、`GenerateStartEmptyResponse`、`GenerateStopResponse`、`GenerateFinalUsageResponse`、`ClaudeData`、`FlushWriter`、`SetEventStreamHeaders`、`Done`、`WssString`、`NewStreamScanner`、`GetResponseID`、`ResponseChunkData`
- `github.com/QuantumNous/new-api/service` — `ClaudeToOpenAIRequest`、`GeminiToOpenAIRequest`、`ResponseOpenAI2Claude`/`Gemini`、`StreamResponseOpenAI2Claude`/`Gemini`、`ResponsesResponseToChatCompletionsResponse`、`ResponseText2Usage`、`CountTextToken`、`CountTokenRealtime`、`PreWssConsumeQuota`、`CloseResponseBodyGracefully`、`IOCopyBytesGracefully`、`GetBase64Data`、`GetImageFromUrl`、`GetAudioDuration`、`GetHttpClient`、`ValidUsage`、`ShouldCopyUpstreamHeader`、`SundaySearch`、`ExtractOutputTextFromResponses`
- `github.com/QuantumNous/new-api/setting/model_setting` — `ShouldPreserveThinkingSuffix`
- `github.com/QuantumNous/new-api/setting/reasoning` — `ParseOpenAIReasoningEffortFromModelSuffix`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewError`、`NewOpenAIError`、`WithOpenAIError`、`OpenAIError`、`RelayFormatOpenAI`/`Claude`/`Gemini`、`ErrorCode*`

### External

- `github.com/gin-gonic/gin` — HTTP 上下文
- `net/http`、`net/textproto`、`mime/multipart`、`path/filepath`、`bytes`、`io`、`strings`、`fmt`、`errors`、`time`、`math` — 标准库
- `encoding/json` — **仅用于类型引用**（`json.RawMessage`），marshal/unmarshal 走 `common.*`（Rule 1）
- `github.com/samber/lo` — `FromPtrOr`、`ToPtr`、`SomeBy` 指针/切片工具
- `github.com/bytedance/gopkg/util/gopool` — Realtime goroutine 池
- `github.com/gorilla/websocket` — Realtime WebSocket 连接
- `github.com/stretchr/testify/require` — 测试断言（仅 `adaptor_test.go`）

<!-- MANUAL: -->
