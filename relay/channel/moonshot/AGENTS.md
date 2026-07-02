<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/moonshot

## Purpose

Moonshot（Kimi）适配器。`Adaptor` 不嵌入 `openai.Adaptor`（空 struct），而是通过**运行时实例化** `claude.Adaptor{}` 与 `openai.Adaptor{}` 并调用其方法来复用逻辑——这是本目录的独特复用模式。支持三种 RelayFormat：OpenAI（chat/completions、completions、embeddings、rerank）、Claude（`/anthropic/v1/messages` 或特殊 base URL）、以及基于 `channelconstant.ChannelSpecialBases` 的特殊套餐路由。对 `kimi-k2.6` 模型强制 `Temperature=1.0`（上游限制）。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体（空 struct）及接口实现：`Init`（空）、`GetRequestURL`（按 `channelconstant.ChannelSpecialBases[baseURL]` 特殊套餐与 `RelayFormat`/`RelayMode` 分支：Claude 走 `{ClaudeBaseURL}/v1/messages`、OpenAI 走 `{OpenAIBaseURL}/chat/completions`；默认 Claude 走 `/anthropic/v1/messages`，其他按 mode 走 `/v1/rerank`、`/v1/embeddings`、`/v1/chat/completions`、`/v1/completions`）、`SetupRequestHeader`（`Authorization: Bearer`）、`ConvertOpenAIRequest`（对 `kimi-k2.6` 强制 `Temperature=1.0`，其他透传）、`ConvertClaudeRequest`（实例化 `claude.Adaptor{}` 并委托）、`ConvertImageRequest`（实例化 `openai.Adaptor{}` 并委托）、`ConvertEmbeddingRequest`/`ConvertRerankRequest`（透传）、`ConvertGeminiRequest`/`ConvertAudioRequest`/`ConvertOpenAIResponsesRequest`（not implemented）、`DoRequest`（`channel.DoApiRequest`）、`DoResponse`（Claude 格式→实例化 `claude.Adaptor{}` 委托，其他→实例化 `openai.Adaptor{}` 委托）、`GetModelList`/`GetChannelName`、`getUpstreamModelName`（从 `info.ChannelMeta` 或 fallback 获取上游模型名）、`isTemperatureOneOnlyModel`（判断是否 `kimi-k2.6`） |
| `constants.go` | `ModelList`（`kimi-k2.5`、`kimi-k2-0905-preview`、`kimi-k2-turbo-preview`、`kimi-k2-thinking`、`kimi-k2-thinking-turbo`）与 `ChannelName = "moonshot"` |
| `adaptor_test.go` | 单元测试（3 个 case）：`TestConvertOpenAIRequestKimiK26UsesOnlyAllowedTemperature`（kimi-k2.6 的 `Temperature=0.7` 被强制为 `1.0`）、`TestConvertOpenAIRequestKimiK26KeepsOmittedTemperatureOmitted`（未设 Temperature 时保持 nil）、`TestConvertOpenAIRequestOtherMoonshotModelKeepsTemperature`（kimi-k2.5 的 `Temperature=0.7` 保持不变） |

## For AI Agents

### Working In This Directory

- **组合委托模式（非嵌入）**：moonshot 的 `Adaptor` 是空 struct，通过 `adaptor := claude.Adaptor{}` / `adaptor := openai.Adaptor{}` 在方法内**每次调用都新建实例**来委托。这意味着 `claude.Adaptor` / `openai.Adaptor` 的 `Init` 不会被调用——若它们依赖 `Init` 设置的状态（如 `ChannelType`、`ResponseFormat`、`ThinkingContentInfo`），委托路径会有状态缺失。修改 claude/openai 的 `Init` 时需注意此调用方。
- **`kimi-k2.6` 温度限制**：`ConvertOpenAIRequest` 在检测到上游模型为 `kimi-k2.6`（大小写不敏感）且客户端显式设置了 `Temperature != 1.0` 时，强制覆写为 `1.0`。**未设置 Temperature 时保持 nil**（透传"未设"语义，Rule 5）。新增受温度限制的模型时在 `isTemperatureOneOnlyModel` 添加。
- **特殊套餐路由**：`GetRequestURL` 查 `channelconstant.ChannelSpecialBases[baseURL]`（来自 `constant` 包），命中时按 `RelayFormat` 路由到不同的 `ClaudeBaseURL`/`OpenAIBaseURL`——这允许同一个渠道 key 对接不同的上游端点。
- **cached_tokens 后处理**：moonshot 的 `cached_tokens` 在非标准位置 `choices[].usage.cached_tokens`。`openai` 包的 `extractMoonshotCachedTokensFromBody` 会处理此格式（由 `applyUsagePostProcessing` 在 `ChannelTypeMoonshot` 分支调用）——moonshot 通过委托 `openai.Adaptor{}.DoResponse` 自动获得此处理。
- **Rule 1**：本目录使用 `common.GetPointer`，未直接调用 `encoding/json` 的 marshal/unmarshal。
- **Rule 5**：`Temperature` 为 `*float64`，`ConvertOpenAIRequest` 正确区分了"显式设为 1.0 之外的值"与"未设"两种情况。

### Testing Requirements

- `go build ./relay/channel/moonshot/...` 必须通过
- `go test ./relay/channel/moonshot/...` 运行 `adaptor_test.go`（3 个 case）
- `go test ./relay/channel/...`
- 手动测试 OpenAI 与 Claude 两种 RelayFormat 路径，以及 rerank/embeddings

### Common Patterns

- **委托复用**：`ConvertClaudeRequest`/`ConvertImageRequest`/`DoResponse` 通过实例化其他 adapter 并调用其方法来复用逻辑，而非嵌入。每次调用创建新实例。
- **模型特定参数修正**：`isTemperatureOneOnlyModel` + `ConvertOpenAIRequest` 的模式用于处理上游对特定模型的参数限制。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `GetPointer[float64]`
- `channelconstant "github.com/QuantumNous/new-api/constant"` — `ChannelSpecialBases`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`ClaudeRequest`、`GeminiChatRequest`、`AudioRequest`、`ImageRequest`、`EmbeddingRequest`、`RerankRequest`、`OpenAIResponsesRequest`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/claude` — `Adaptor`（ConvertClaudeRequest / DoResponse 委托）
- `github.com/QuantumNous/new-api/relay/channel/openai` — `Adaptor`（ConvertImageRequest / DoResponse 委托）
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`、`ChannelMeta`
- `"github.com/QuantumNous/new-api/relay/constant"` — `RelayModeRerank`、`RelayModeEmbeddings`、`RelayModeChatCompletions`、`RelayModeCompletions`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`RelayFormatClaude`、`RelayFormatOpenAI`

### External

- `github.com/gin-gonic/gin` — HTTP 上下文
- `net/http`、`io`、`errors`、`fmt`、`strings` — 标准库
- `github.com/stretchr/testify/require` — 测试断言（仅 `adaptor_test.go`）

<!-- MANUAL: -->
