<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/deepseek

## Purpose

DeepSeek 上游适配器，实现 `channel.Adaptor` 接口。这是 OpenAI 兼容 + Claude 兼容双格式适配器：

- 默认（OpenAI 格式）：走 `/v1/chat/completions`，FIM 补全模式走 `/beta/completions`，响应处理直接复用 `openai.Adaptor{}` 的 `DoResponse`。
- `RelayFormatClaude`：走 `/anthropic/v1/messages`，`ConvertClaudeRequest` 委托 `claude.Adaptor{}` 转换后追加 DeepSeek V4 的 thinking suffix；响应处理也委托 `claude.Adaptor{}`。

特色功能是 **DeepSeek V4 thinking suffix 适配**：通过 `reasoning.ParseDeepSeekV4ThinkingSuffix(modelName)` 解析形如 `deepseek-v4-flash-max` / `-none` 的后缀，把 `type` / `effort` 写入 OpenAI 请求的 `THINKING` / `ReasoningEffort` 字段，或 Claude 请求的 `Thinking.Type` / `OutputConfig` 字段，并同步改写 `info.UpstreamModelName` 为 base model。已注册到 `streamSupportedChannels`（Rule 4），支持 stream_options。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体及 `Adaptor` 接口实现；含 V4 thinking suffix 两个内部函数 `applyDeepSeekV4OpenAIThinkingSuffix` / `applyDeepSeekV4ClaudeThinkingSuffix` |
| `constants.go` | `ModelList`（`deepseek-chat` / `deepseek-reasoner` + 6 个 `deepseek-v4-*` 变体），`ChannelName = "deepseek"` |

## For AI Agents

### Working In This Directory

- 已实现的 `Convert*` 方法：`ConvertOpenAIRequest`（透传 + 应用 V4 thinking suffix）、`ConvertClaudeRequest`（委托 `claude.Adaptor` + 应用 V4 thinking suffix）。其余 Convert 方法返回 `errors.New("not implemented")`。
- `GetRequestURL` 按 `RelayFormat` / `RelayMode` 分三路：
  - `RelayFormatClaude` → `<base>/anthropic/v1/messages`
  - `RelayModeCompletions`（FIM）→ `<base>/beta/completions`（自动补 `/beta` 后缀）
  - 默认 → `<base>/v1/chat/completions`
- `DoResponse` 按 `RelayFormat` 委托：Claude 走 `claude.Adaptor{}`，其他走 `openai.Adaptor{}`，本目录**不实现自己的响应解析**。
- thinking suffix 处理：`applyDeepSeekV4OpenAIThinkingSuffix` 用 `common.Marshal` 序列化 `{"type": thinkingType}` 写入 `request.THINKING`（Rule 1 已遵守）；`applyDeepSeekV4ClaudeThinkingSuffix` 在 `effort != ""` 时同样用 `common.Marshal` 序列化 `{"effort": effort}` 写入 `request.OutputConfig`，`effort == ""` 时清空 `OutputConfig`。
- Rule 4（StreamOptions）：`streamSupportedChannels[ChannelTypeDeepSeek] = true`（见 `relay/common/relay_info.go:334`），DeepSeek 支持 `stream_options`。
- Rule 5（指针 + omitempty）：DeepSeek 直接复用 `dto.GeneralOpenAIRequest` / `dto.ClaudeRequest` 的指针字段约定，未自定义 DTO。

### Testing Requirements

- `go build ./relay/channel/deepseek/...` 必须通过
- `go test ./relay/channel/...`
- 手动验证 OpenAI 默认路径、Claude 路径、FIM 路径，以及 V4 模型后缀（`-flash-max` / `-pro-none` 等）被正确剥离并写入 thinking 字段

### Common Patterns

- "薄壳 + 委托"模式：本适配器只负责 URL 路由与请求字段微调，所有响应解析交给 `openai.Adaptor` / `claude.Adaptor`。
- `Adaptor` 为空 struct，`Init` 空实现。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal`（V4 thinking 字段序列化，遵守 Rule 1）
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`ClaudeRequest`、`Thinking`、`GeminiChatRequest`、`AudioRequest`、`ImageRequest`、`EmbeddingRequest`、`RerankRequest`、`OpenAIResponsesRequest`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/claude` — 委托转换 / 响应处理
- `github.com/QuantumNous/new-api/relay/channel/openai` — 委托响应处理
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/constant` — `RelayModeCompletions`
- `github.com/QuantumNous/new-api/setting/reasoning` — `ParseDeepSeekV4ThinkingSuffix`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`RelayFormatClaude`

### External

- `github.com/gin-gonic/gin`
- `errors`、`fmt`、`io`、`net/http`、`strings`

<!-- MANUAL: -->
