<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/mistral

## Purpose

Mistral AI 适配器。该 adapter **不嵌入 `openai.Adaptor`**（`type Adaptor struct{}`），自行实现 `Adaptor` 接口的全部方法，但在 `DoResponse` 中直接复用 `openai.OaiStreamHandler` / `openai.OpenaiHandler` 解析响应——因为 Mistral 的响应格式与 OpenAI 兼容。差异点在请求侧：Mistral 对 `tool_calls.id` 有严格格式约束（正则 `^[a-zA-Z0-9]{9}$`），不合规的 ID 会被替换为随机生成的 9 字符字符串，通过 `idMap` 保持 messages 内 `tool_calls.id` 与 `tool_call_id` 的一致性。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体（空 struct）及接口实现：`Init`（空）、`GetRequestURL`（`relaycommon.GetFullRequestURL` 透传）、`SetupRequestHeader`（`Authorization: Bearer`）、`ConvertOpenAIRequest`（委托 `requestOpenAI2Mistral`）、`ConvertClaudeRequest`/**`panic("implement me")`**、`ConvertGeminiRequest`/`ConvertAudioRequest`/`ConvertImageRequest`/`ConvertEmbeddingRequest`/`ConvertOpenAIResponsesRequest` 返回 `errors.New("not implemented")`、`ConvertRerankRequest` 返回 `nil, nil`、`DoRequest`（`channel.DoApiRequest`）、`DoResponse`（流式→`openai.OaiStreamHandler`，非流式→`openai.OpenaiHandler`）、`GetModelList`/`GetChannelName` |
| `text.go` | `requestOpenAI2Mistral(request)`：将 `GeneralOpenAIRequest` 转为 Mistral 兼容格式。核心逻辑：(1) 遍历 messages，用 `mistralToolCallIdRegexp` 校验每个 `tool_calls[i].ID`，不匹配的用 `common.GenerateRandomCharsKey(9)` 生成新 ID，`idMap` 维护旧→新映射；(2) 同步替换 `tool_call_id`；(3) 处理 `assistant + tool_calls + 空 content` 的特殊消息（清空 mediaMessages）；(4) 输出仅含 `Model/Stream/Messages/Temperature/TopP/Tools/ToolChoice/MaxTokens` 的精简请求（剔除 `FrequencyPenalty`/`PresencePenalty`/`Stop` 等不支持字段） |
| `constants.go` | `ModelList`（`open-mistral-7b`、`open-mixtral-8x7b`、`mistral-small-latest`、`mistral-medium-latest`、`mistral-large-latest`、`mistral-embed`）与 `ChannelName = "mistral"` |

## For AI Agents

### Working In This Directory

- **不嵌入 openai.Adaptor**：与多数 OpenAI 兼容 provider 不同，mistral 的 `Adaptor` 是空 struct，自行实现所有 Convert 方法。仅 `DoResponse` 复用 `openai` 包的 handler。
- **`ConvertClaudeRequest` 会 panic**：`adaptor.go:28` 的 `ConvertClaudeRequest` 调用 `panic("implement me")`——若 Mistral 渠道收到 Claude 格式请求（`RelayFormatClaude`）会崩溃。修改或调用前注意这一限制，若需支持 Claude 格式必须实现此方法或返回 error。
- **tool_calls.id 规范化**：`text.go` 的 ID 替换逻辑是 Mistral 独有的兼容层。`common.GenerateRandomCharsKey(9)` 失败时（err != nil）会保留原 ID——上游可能因此拒绝请求。`idMap` 是 per-request 的（函数局部变量），不跨请求共享，多节点安全。
- **请求字段精简**：`requestOpenAI2Mistral` 只输出 Mistral 支持的子集字段。新增 OpenAI 请求参数时，需要手动确认 Mistral 是否支持，再决定是否加入输出 struct。
- **Rule 1**：`text.go` 使用 `common.GenerateRandomCharsKey`，未直接调用 `encoding/json`，符合规范。
- **Rule 5**：`GeneralOpenAIRequest` 的 `MaxTokens` 用 `GetMaxTokens()` 统一获取（合并 `MaxTokens` 与 `MaxCompletionTokens`），输出为 `*int`。

### Testing Requirements

- `go build ./relay/channel/mistral/...` 必须通过
- `go test ./relay/channel/...`
- 无独立 `_test.go`；手动测试流式/非流式 chat completions 路径

### Common Patterns

- **Convert 委托 + Handler 复用**：`ConvertOpenAIRequest` 做请求改写（`requestOpenAI2Mistral`），`DoResponse` 完全复用 `openai` 包的 handler——这是"请求侧有差异、响应侧兼容"的典型 provider 模式。
- **工具 ID 规范化**：per-request `idMap` 局部变量，避免全局状态。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `GenerateRandomCharsKey`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`Message`、`MediaContent`、`ContentTypeImageURL`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/openai` — `OaiStreamHandler`、`OpenaiHandler`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`、`GetFullRequestURL`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`

### External

- `github.com/gin-gonic/gin` — HTTP 上下文
- `net/http`、`io`、`errors`、`regexp` — 标准库

<!-- MANUAL: -->
