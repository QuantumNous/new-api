<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/mokaai

## Purpose

MokaAI 适配器，当前**仅支持 embedding 路径**（`RelayModeEmbeddings`）。`Adaptor` 不嵌入 `openai.Adaptor`（空 struct），自行实现接口。将 OpenAI 格式的 embedding 请求转换为 Moka（m3e 系列）的 embedding 格式（`input` → `[]string`），将上游响应转回 `OpenAIEmbeddingResponse`。chat/rerank/audio/image 等路径均未实现。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体（空 struct）及接口实现：`Init`（空）、`GetRequestURL`（按上游模型名前缀 `m3e` 决定 suffix 为 `embeddings`，否则 `chat/`）、`SetupRequestHeader`（`Authorization: Bearer`）、`ConvertOpenAIRequest`（仅处理 `RelayModeEmbeddings`，委托 `embeddingRequestOpenAI2Moka`；其他 mode 返回 `errors.New("not implemented")`）、`ConvertEmbeddingRequest`（透传 request）、`ConvertClaudeRequest`/**`panic("implement me")`**、`ConvertGeminiRequest`/`ConvertAudioRequest`/`ConvertImageRequest`/`ConvertOpenAIResponsesRequest`/`ConvertRerankRequest` 返回 not implemented 或 nil、`DoRequest`（`channel.DoApiRequest`）、`DoResponse`（仅 `RelayModeEmbeddings` 调用 `mokaEmbeddingHandler`，其他 mode 空返回）、`GetModelList`/`GetChannelName` |
| `relay-mokaai.go` | embedding 转换与响应处理：`embeddingRequestOpenAI2Moka`（将 `request.Input` 的 `string`/`[]string`/`[]interface{}` 统一转为 `[]string`，构造 `dto.EmbeddingRequest`）、`embeddingResponseMoka2OpenAI`（`EmbeddingResponse` → `OpenAIEmbeddingResponse`，`Model` 固定为 `"baidu-embedding"`）、`mokaEmbeddingHandler`（读取 body → **`json.Unmarshal`**（违规，见下）→ 转换 → `common.Marshal` → 写回客户端）|
| `constants.go` | `ModelList`（`m3e-large`、`m3e-base`、`m3e-small`）与 `ChannelName = "mokaai"` |

## For AI Agents

### Working In This Directory

- **仅 embedding**：当前实现仅支持 `RelayModeEmbeddings`，chat 路径的 handler 已注释掉（`adaptor.go:100`）。若需支持 chat completions，需要实现 handler 并在 `DoResponse` 中添加分支。
- **`ConvertClaudeRequest` 会 panic**：`adaptor.go:29` 调用 `panic("implement me")`——Claude 格式请求会导致崩溃。
- **Rule 1 违规（已存在）**：`relay-mokaai.go:4` 导入了 `encoding/json`，`relay-mokaai.go:62` 的 `mokaEmbeddingHandler` 直接调用 `json.Unmarshal(responseBody, &baiduResponse)` 而非 `common.Unmarshal`。修改此文件时应一并修正为 `common.Unmarshal`，新代码不得复制此模式。
- **URL 后缀判定**：`GetRequestURL` 以 `info.UpstreamModelName` 是否以 `m3e` 开头来决定路径后缀（`embeddings` vs `chat/`），而非根据 `RelayMode`。
- **响应 Model 固定**：`embeddingResponseMoka2OpenAI` 硬编码 `Model: "baidu-embedding"`，不随上游模型名变化。

### Testing Requirements

- `go build ./relay/channel/mokaai/...` 必须通过
- `go test ./relay/channel/...`
- 无独立 `_test.go`；手动测试 embedding 路径

### Common Patterns

- **单一 mode 实现**：`ConvertOpenAIRequest` 与 `DoResponse` 均通过 `switch info.RelayMode` 仅处理 `RelayModeEmbeddings`，其余直接返回 not implemented。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`EmbeddingRequest`、`EmbeddingResponse`、`OpenAIEmbeddingResponse`/`Item`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/constant` — `RelayModeEmbeddings`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`、`IOCopyBytesGracefully`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewError`

### External

- `github.com/gin-gonic/gin` — HTTP 上下文
- `net/http`、`io`、`errors`、`fmt`、`strings` — 标准库
- `encoding/json` — **违规使用**（`relay-mokaai.go` 直接调用 `json.Unmarshal`，应改为 `common.Unmarshal`，Rule 1）

<!-- MANUAL: -->
