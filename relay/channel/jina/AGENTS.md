<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/jina

## Purpose

Jina AI 上游适配器，实现 `channel.Adaptor` 接口。Jina 是一家专注于 embedding / reranker 的 AI 公司，本适配器仅支持两种 RelayMode：
- `RelayModeRerank`：调用上游 `/v1/rerank`，请求透传 `dto.RerankRequest`，响应委托 `relay/common_handler.RerankHandler`（**通用 rerank handler**，非 provider-specific）。
- `RelayModeEmbeddings`：调用上游 `/v1/embeddings`，请求透传 `dto.EmbeddingRequest`（清空 `EncodingFormat`），响应委托 `openai.OpenaiHandler`（直接复用 OpenAI 非流式 handler）。

其他 RelayMode（包括 chat completions）调用 `GetRequestURL` 时返回 `errors.New("invalid relay mode")`。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体及 `Adaptor` 接口实现；URL 路由、Convert 透传、DoResponse 委托 common_handler / openai |
| `constant.go` | 硬编码 `ModelList`（`jina-clip-v1`、`jina-reranker-v2-base-multilingual`、`jina-reranker-m0`），`ChannelName = "jina"` |
| `relay-jina.go` | 占位文件，仅 `package jina` 一行（无内容） |

## For AI Agents

### Working In This Directory

- 已实现的 `Convert*` 方法：`ConvertOpenAIRequest`（直接透传 `*dto.GeneralOpenAIRequest`，但 URL 路由层不接受 chat 模式）、`ConvertRerankRequest`（直接透传 `dto.RerankRequest`）、`ConvertEmbeddingRequest`（清空 `EncodingFormat` 后透传）。其余 Convert 方法返回 `errors.New("not implemented")`；`ConvertClaudeRequest` 当前会 `panic("implement me")`，调用方需避免触发。
- `DoRequest` 直接复用 `channel.DoApiRequest(a, c, info, requestBody)`。
- `DoResponse` 按 `RelayMode` 分发：rerank → `common_handler.RerankHandler(c, info, resp)`（跨 provider 通用 rerank handler）；embeddings → `openai.OpenaiHandler(c, info, resp)`（复用 OpenAI 非流式 chat handler，因为 Jina embedding 响应与 OpenAI embedding 格式一致）。
- **`ConvertEmbeddingRequest` 主动清空 `request.EncodingFormat`**：Jina 不支持 OpenAI 的 `encoding_format` 参数，透传会被上游拒绝，所以强制清空。
- **`relay-jina.go` 是空文件**（仅 `package jina` 一行）：历史上预留，可删除或保留。新增功能不应写入此文件。
- **Rule 4（StreamOptions）**：Jina 未注册到 `streamSupportedChannels`（不支持 stream_options）。
- **Rule 1（JSON）**：本目录当前无 JSON 操作，无违规。

### Testing Requirements

- `go build ./relay/channel/jina/...` 必须通过
- `go test ./relay/channel/...`
- 手动验证 rerank 与 embedding 两条路径

### Common Patterns

- 极简适配器：所有逻辑都在 `adaptor.go`，无自定义 DTO 与响应处理代码（全部委托 / 透传）。
- `Adaptor` 为空 struct，`Init` 空实现。
- "薄壳 + 复用 OpenAI handler" 模式：embedding 路径复用 `openai.OpenaiHandler`，rerank 路径复用 `common_handler.RerankHandler`。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`RerankRequest`、`EmbeddingRequest`、`AudioRequest`、`ImageRequest`、`ClaudeRequest`、`GeminiChatRequest`、`OpenAIResponsesRequest`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/openai` — `OpenaiHandler`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/common_handler` — `RerankHandler`
- `github.com/QuantumNous/new-api/relay/constant` — `RelayModeRerank`、`RelayModeEmbeddings`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`

### External

- `github.com/gin-gonic/gin`
- `errors`、`fmt`、`io`、`net/http`

<!-- MANUAL: -->
