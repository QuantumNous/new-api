<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/perplexity

## Purpose

Perplexity AI 适配器。`Adaptor` 不嵌入 `openai.Adaptor`（空 struct），通过运行时实例化 `openai.Adaptor{}` 委托 `ConvertClaudeRequest` 与 `DoResponse`，自行处理 `ConvertOpenAIRequest`（TopP 上限钳制 + 字段精简）与 `ConvertOpenAIResponsesRequest`（透传）。支持 chat/completions 与 responses 两种 relay mode。响应侧完全复用 OpenAI 的 handler（`openai.Adaptor{}.DoResponse`）。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体（空 struct）及接口实现：`Init`（空）、`GetRequestURL`（responses→`{ChannelBaseUrl}/v1/responses`，其他→`{ChannelBaseUrl}/chat/completions`）、`SetupRequestHeader`（`Authorization: Bearer`）、`ConvertOpenAIRequest`（**TopP 钳制**：`>= 1` 时降为 `0.99`，再委托 `requestOpenAI2Perplexity`）、`ConvertClaudeRequest`（实例化 `openai.Adaptor{}` 委托）、`ConvertOpenAIResponsesRequest`（透传 request）、`ConvertGeminiRequest`/`ConvertAudioRequest`/`ConvertImageRequest`/`ConvertEmbeddingRequest`（not implemented）、`ConvertRerankRequest`（nil）、`DoRequest`（`channel.DoApiRequest`）、`DoResponse`（实例化 `openai.Adaptor{}` 委托全部响应处理）、`GetModelList`/`GetChannelName` |
| `relay-perplexity.go` | `requestOpenAI2Perplexity(request)`：将 `GeneralOpenAIRequest` 精简为 Perplexity 支持的子集（`Model`/`Stream`/`Messages`（仅保留 `Role`/`Content`，丢弃 tool_calls 等）/`Temperature`/`TopP`/`FrequencyPenalty`/`PresencePenalty`/`SearchDomainFilter`/`SearchRecencyFilter`/`ReturnImages`/`ReturnRelatedQuestions`/`SearchMode`/`MaxTokens`），剔除 `Tools`/`ToolChoice`/`Stop`/`Seed` 等不支持字段 |
| `constants.go` | `ModelList`（`llama-3-sonar-small-32k-chat`、`llama-3-sonar-small-32k-online`、`llama-3-sonar-large-32k-chat`、`llama-3-sonar-large-32k-online`、`llama-3-8b-instruct`、`llama-3-70b-instruct`、`mixtral-8x7b-instruct`、`sonar`、`sonar-pro`、`sonar-reasoning`）与 `ChannelName = "perplexity"` |

## For AI Agents

### Working In This Directory

- **组合委托（非嵌入）**：`Adaptor` 是空 struct，通过 `adaptor := openai.Adaptor{}` 实例化委托 `ConvertClaudeRequest` 与 `DoResponse`。注意 `openai.Adaptor.Init` 不会被调用——但 perplexity 的 `DoResponse` 委托不依赖 `Init` 设置的状态（`ResponseFormat` 字段仅在 audio 路径使用，perplexity 不走 audio）。
- **TopP 上限钳制**：Perplexity 上游要求 `top_p < 1`。`ConvertOpenAIRequest` 在 `lo.FromPtrOr(request.TopP, 0) >= 1` 时强制设为 `0.99`。这是 Perplexity 独有的兼容处理。
- **请求字段精简**：`requestOpenAI2Perplexity` 仅保留 Perplexity 支持的字段，包括 Perplexity 特有的搜索相关字段（`SearchDomainFilter`/`SearchRecencyFilter`/`ReturnImages`/`ReturnRelatedQuestions`/`SearchMode`）。messages 仅保留 `Role`/`Content`，丢弃 `tool_calls`/`tool_call_id`/`name` 等。
- **responses API 支持**：`GetRequestURL` 与 `ConvertOpenAIResponsesRequest` 支持 `RelayModeResponses` 路径（`/v1/responses`），responses 请求透传不做转换。
- **Rule 1**：本目录未直接调用 `encoding/json` 的 marshal/unmarshal，符合规范。
- **Rule 5**：`requestOpenAI2Perplexity` 使用 `request.GetMaxTokens()` 统一获取 `MaxTokens`/`MaxCompletionTokens`，输出为 `*int`。

### Testing Requirements

- `go build ./relay/channel/perplexity/...` 必须通过
- `go test ./relay/channel/...`
- 无独立 `_test.go`；手动测试 chat/completions 与 responses 路径，以及 TopP 钳制行为

### Common Patterns

- **请求侧精简 + 响应侧复用**：`requestOpenAI2Perplexity` 做请求字段过滤，`DoResponse` 完全委托 `openai.Adaptor`——典型"请求侧有差异、响应侧兼容"模式。
- **参数钳制**：`ConvertOpenAIRequest` 的 TopP 钳制是 provider 特定参数限制的常见处理方式。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`ClaudeRequest`、`GeminiChatRequest`、`AudioRequest`、`ImageRequest`、`EmbeddingRequest`、`RerankRequest`、`OpenAIResponsesRequest`、`Message`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/openai` — `Adaptor`（ConvertClaudeRequest / DoResponse 委托）
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`
- `relayconstant "github.com/QuantumNous/new-api/relay/constant"` — `RelayModeResponses`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`

### External

- `github.com/gin-gonic/gin` — HTTP 上下文
- `net/http`、`io`、`errors`、`fmt` — 标准库
- `github.com/samber/lo` — `FromPtrOr`、`ToPtr`

<!-- MANUAL: -->
