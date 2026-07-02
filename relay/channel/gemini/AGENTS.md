<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/gemini

## Purpose

Google Gemini 原生 API 适配器，实现 `channel.Adaptor` 接口。这是功能最丰富的 provider 适配器之一，覆盖：

- **OpenAI ↔ Gemini 格式双向转换**：`ConvertOpenAIRequest` → `CovertOpenAI2Gemini`（含 messages / tools / response_modalities / thinking_config 等映射），并支持 `ConvertClaudeRequest`（先经 `openai.Adaptor` 转为 GeneralOpenAIRequest 再转 Gemini）、`ConvertGeminiRequest`（原生透传，补默认 `role=user` 与 YouTube `video/webm` mime 猜测）。
- **多 RelayMode**：chat completions、Gemini 原生格式（`RelayModeGemini`，含 `:embedContent` / `:batchEmbedContents` 原生端点直通）、embeddings（强制 `IsGeminiBatchEmbedding=true` 走批量端点）、imagen 图像生成（`:predict` 端点）。
- **thinking 适配器**：`ThinkingAdaptor` 解析模型名后缀 `-thinking[-<budget>]` / `-nothinking` / `<effort>` 五种形态，按模型（2.5-pro / 2.5-flash / 2.5-flash-lite）clamp `thinking_budget` 到允许范围。
- **extra_body.google.thinking_config**：`CovertOpenAI2Gemini` 支持解析客户端 `extra_body.google.thinking_config.{thinking_budget,include_thoughts,thinking_level}`，并主动拒绝驼峰命名的错误参数。
- **响应处理**：流式 / 非流式 chat、原生 generateContent / streamGenerateContent、imagen、embedding 共 6 个 handler。
- **usage 计算**：`buildUsageFromGeminiMetadata` 将 `UsageMetadata` 映射为 OpenAI usage，区分 prompt / tool_use_prompt / candidates / thoughts / cached，并细分 IMAGE / AUDIO / TEXT 模态 token。

已注册到 `streamSupportedChannels`（Rule 4），Gemini 支持 stream_options。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体及 `Adaptor` 接口实现；含 imagen 图像请求构造、URL 路由（按 model 前缀与 action）、thinking 后缀剥离 |
| `constant.go` | 硬编码 `ModelList`（gemini / gemma / embedding / imagen / veo / aqa 系列），`SafetySettingList`（4 个 harm category），`ChannelName = "google gemini"` |
| `relay-gemini.go` | 核心转换与响应处理（1500+ 行）：`CovertOpenAI2Gemini`、`ThinkingAdaptor`、`clampThinkingBudget`、`responseGeminiChat2OpenAI`、`streamResponseGeminiChat2OpenAI`、`geminiStreamHandler`、6 个对外 handler、`buildUsageFromGeminiMetadata`、`FetchGeminiModels`、工具调用 / schema 清理 / 字符串转义等辅助函数 |
| `relay-gemini-native.go` | Gemini 原生格式透传 handler：`GeminiTextGenerationHandler` / `GeminiTextGenerationStreamHandler` / `NativeGeminiEmbeddingHandler`（直接 `IOCopyBytesGracefully` 回写，不转换为 OpenAI 格式） |
| `relay_gemini_usage_test.go` | usage 计算单元测试：覆盖 `GeminiChatHandler` / `geminiStreamHandler` / `GeminiTextGenerationHandler` 三路径在 `ToolUsePromptTokenCount` 存在 / 缺失 / `PromptTokenCount==0` 三种场景 |

## For AI Agents

### Working In This Directory

- **已实现的 Convert 方法**：`ConvertOpenAIRequest`（→ `GeminiChatRequest`）、`ConvertGeminiRequest`（原生透传 + 默认值 / mime 修补）、`ConvertClaudeRequest`（链式：claude.Adaptor → 本类 `ConvertOpenAIRequest`）、`ConvertEmbeddingRequest`（构造 batch `requests` 数组）、`ConvertImageRequest`（仅 `imagen-*` 模型）。`ConvertRerankRequest` 返回 `nil, nil`；Audio / OpenAIResponses 返回 `not implemented`。
- **`GetRequestURL` 路由逻辑**：
  - 先在 `ThinkingAdapterEnabled` 且非 preserve-suffix 时剥离 `-thinking-<budget>` / `-thinking` / `-nothinking` / `<effort>` 后缀（同步改写 `info.UpstreamModelName`）。
  - 再按 model 前缀选 action：`imagen-*` → `:predict`；`*-embedding-*` → `:embedContent` 或 `:batchEmbedContents`（取决于 `info.IsGeminiBatchEmbedding`）；其余 → `:generateContent` 或 `:streamGenerateContent?alt=sse`（流式）。
  - 版本由 `model_setting.GetGeminiVersionSetting(model)` 决定。
- **`DoResponse` 分发**（6 路）：
  - `RelayModeGemini` + URL 含 `:embedContent` / `:batchEmbedContents` → `NativeGeminiEmbeddingHandler`
  - `RelayModeGemini` 流式 / 非流式 → `GeminiTextGenerationStreamHandler` / `GeminiTextGenerationHandler`（原生透传，不转 OpenAI）
  - `imagen-*` → `GeminiImageHandler`
  - `text-embedding-*` / `embedding-*` / `gemini-embedding-*` → `GeminiEmbeddingHandler`
  - 其余流式 / 非流式 → `GeminiChatStreamHandler` / `GeminiChatHandler`（转 OpenAI 格式）
- **thinking budget clamp 常量**：`pro25MinBudget=128` / `pro25MaxBudget=32768` / `flash25MaxBudget=24576` / `flash25LiteMinBudget=512` / `flash25LiteMaxBudget=24576`。`clampThinkingBudgetByEffort` 按 effort (high 80% / medium 50% / low 20% / minimal 5%) 缩放。
- **thought signature bypass**：常量 `thoughtSignatureBypassValue = "context_engineering_is_the_way_to_go"`，用于绕过 function call thought signature 校验（仅在 `FunctionCallThoughtSignatureEnabled` + Gemini/VertexAI 渠道启用）。
- **`buildUsageFromGeminiMetadata`**：prompt = `PromptTokenCount + ToolUsePromptTokenCount`（≤0 时回退 estimate）；completion = `CandidatesTokenCount + ThoughtsTokenCount`；细分 `PromptTokensDetails.{Cached,Text,Audio}` 与 `CompletionTokenDetails.{Reasoning,Image,Audio,Text}`。当 `TotalTokens>0` 且 `CompletionTokens≤0` 时按差值补全。
- **`responseGeminiChat2OpenAI`**：媒体部分按 mime 区分 `![image](data:...)` vs `[media](data:...)`；`strings.Builder` 预分配 `inlineGrow` 容量以减少大 base64 的堆分配（性能注释明确写了）。
- **finishReason 映射**：`STOP`→stop、`MAX_TOKENS`→length、`SAFETY`/`RECITATION`/`BLOCKLIST`/`PROHIBITED_CONTENT`/`SPII`/`OTHER`→content_filter。
- **工具调用清理**：`cleanFunctionParametersWithDepth`、`normalizeGeminiSchemaTypeAndNullable`、`removeAdditionalPropertiesWithDepth`（递归到 5 层）等处理 JSON schema 兼容性问题。
- **`FetchGeminiModels`**：调用上游 `/v1beta/models` 拉取可用模型列表（支持 proxy），返回 `[]string` 给前端做渠道模型自动填充。
- **Rule 1（已部分违规）**：`adaptor.go` / `relay-gemini-native.go` / 测试文件遵守 Rule 1（用 `common.Marshal` / `common.Unmarshal`）；**`relay-gemini.go` 直接 `import "encoding/json"`** 并大量调用 `json.Marshal` / `json.Unmarshal`（违规，已存在）。新增 JSON 操作必须走 `common.*`。
- **Rule 4（StreamOptions）**：`streamSupportedChannels[ChannelTypeGemini] = true`（见 `relay/common/relay_info.go:328`）。
- **Rule 5（指针 + omitempty）**：依赖 `dto.GeminiChatRequest` / `GeminiChatGenerationConfig` 的指针字段约定；新增可选字段需遵守。

### Testing Requirements

- `go build ./relay/channel/gemini/...` 必须通过
- `go test ./relay/channel/gemini/...` — 当前测试集中在 usage 计算路径（`relay_gemini_usage_test.go`）
- `go test ./relay/channel/...`
- 手动验证：OpenAI chat 流式 / 非流式、Gemini 原生 `RelayModeGemini`（含 `:embedContent` / `:batchEmbedContents`）、imagen、embedding、`-thinking-<budget>` / `-nothinking` / effort 后缀

### Common Patterns

- "薄 adaptor + 厚 relay-*.go"：`adaptor.go` 主要做分发，转换与响应逻辑全部下沉到 `relay-gemini.go`（1500+ 行）。
- 委托模式：`ConvertClaudeRequest` 与 `ConvertImageRequest`（部分逻辑）复用其他适配器。
- 流式 handler 用 `helper.StringData` + `geminiStreamHandler`（统一封装），原生格式透传用 `IOCopyBytesGracefully`。
- thinking 后缀剥离与 `info.UpstreamModelName` 改写在 `GetRequestURL` 与 `ThinkingAdaptor` 中各做一次（注意一致性）。
- 性能优化痕迹：`responseGeminiChat2OpenAI` / `streamResponseGeminiChat2OpenAI` 用 `strings.Builder.Grow(inlineGrow)` 预分配大 base64 容量。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal` / `GetPointer` / `GetTimestamp` / `SetContextKey`
- `github.com/QuantumNous/new-api/constant` — `ContextKeyAdminRejectReason`、`FinishReason*`、`ChannelTypeGemini` / `ChannelTypeVertexAi`、`StreamingTimeout`
- `github.com/QuantumNous/new-api/dto` — `GeminiChatRequest` / `GeminiChatResponse` / `GeminiChatCandidate` / `GeminiUsageMetadata` / `GeminiImageRequest` / `GeneralOpenAIRequest` / `OpenAITextResponse` / `ChatCompletionsStreamResponse` / `Usage` / `ToolCallResponse` / `ClaudeRequest` / `EmbeddingRequest` / `ImageRequest` / `RerankRequest` / `AudioRequest` / `OpenAIResponsesRequest` / `GeminiEmbeddingResponse` / `GeminiBatchEmbeddingResponse`
- `github.com/QuantumNous/new-api/logger` — `LogDebug` / `LogError` / `LogInfo`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader` / `DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/openai` — 委托 `ConvertClaudeRequest`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo` / `ChannelMeta`
- `github.com/QuantumNous/new-api/relay/constant` — `RelayModeGemini`
- `github.com/QuantumNous/new-api/relay/helper` — `StringData` / `SetEventStreamHeaders` / `ObjectData` / `Done` / `GetResponseID` / `NewStreamScanner` / `GenerateStopResponse` / `StreamScannerHandler`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully` / `IOCopyBytesGracefully` / `ResponseText2Usage` / `GetHttpClientWithProxy`
- `github.com/QuantumNous/new-api/setting/model_setting` — `GetGeminiSettings` / `GetGeminiVersionSetting` / `IsGeminiModelSupportImagine` / `ShouldPreserveThinkingSuffix`
- `github.com/QuantumNous/new-api/setting/reasoning` — `TrimEffortSuffix`
- `github.com/QuantumNous/new-api/types` — `NewAPIError` / `NewOpenAIError` / `WithOpenAIError` / `NewError` / `NewErrorWithStatusCode` / `ErrorCode*` / `RelayFormatClaude` / `RelayFormatGemini`

### External

- `github.com/gin-gonic/gin`
- `github.com/samber/lo` — `FromPtrOr`
- `github.com/stretchr/testify/require`（仅测试）
- `bytes`、`context`、`encoding/json`（违规，见上）、`errors`、`fmt`、`io`、`net/http`、`net/http/httptest`（仅测试）、`strconv`、`strings`、`testing`（仅测试）、`time`、`unicode/utf8`

<!-- MANUAL: -->
