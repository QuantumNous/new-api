<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/siliconflow

## Purpose

SiliconFlow（硅基流动）provider 适配器。OpenAI 兼容协议为主，额外支持 rerank（`/v1/rerank` 自定义端点）、embedding、image generation 三类能力。非 rerank 的响应处理直接委托给 `openai.Adaptor{}`，自身仅实现 `siliconflowRerankHandler` 处理 SiliconFlow 特有的 rerank 响应结构（带 `meta.tokens` 字段）。`ConvertImageRequest` 会从 `request.Extra` 中解析出 SiliconFlow 专属字段（`image_size`、`batch_size`、`negative_prompt` 等）。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 实现 `Adaptor` 接口。`ConvertOpenAIRequest` 对 FIM（Fill-In-the-Middle，`prefix`/`suffix`）请求补一条空 user message；`ConvertImageRequest` 将 `dto.ImageRequest` 映射为 `SFImageRequest`（解析 extra 字段）；`ConvertRerankRequest`/`ConvertEmbeddingRequest` 透传请求；`DoRequest` 直接委托 `openai.Adaptor{}`；`DoResponse` 仅在 `RelayModeRerank` 时走 `siliconflowRerankHandler`，其余委托 `openai.Adaptor` |
| `constant.go` | 定义 `ModelList`（含 Qwen / DeepSeek / Yi / chatglm / FLUX / bge 等 40+ 模型 ID）与 `ChannelName = "siliconflow"` |
| `dto.go` | 定义 `SFRerankResponse`（带 `SFMeta.Tokens`）、`SFImageRequest`（含 `image_size`、`batch_size`、`num_inference_steps`、`guidance_scale` 等硅基流动专属图像参数）|
| `relay-siliconflow.go` | `siliconflowRerankHandler`：读取响应 → 反序列化为 `SFRerankResponse` → 用其 `Meta.Tokens` 填充 `dto.Usage` → 转成标准 `dto.RerankResponse` 回写客户端 |

## For AI Agents

### Working In This Directory

- **已知违规（勿扩散）**：`relay-siliconflow.go` 直接使用 `encoding/json` 的 `Unmarshal`/`Marshal`，违反 Rule 1。新增/修改代码必须用 `common.Marshal` / `common.Unmarshal`，但本次生成文档不做修复。
- **Rerank 端点**：`GetRequestURL` 仅对 `RelayModeRerank` 强制重写为 `<base>/v1/rerank`，其他模式走 `relaycommon.GetFullRequestURL`。
- **FIM 补丁**：当请求带 `prefix` 或 `suffix` 但 `messages` 为空时，`ConvertOpenAIRequest` 注入一条空 user message 以满足 SiliconFlow 校验。
- **Image 请求字段优先级**：`SFImageRequest.ImageSize`/`BatchSize` 若已从 `Extra` 中解析到值则保留；否则回退到 OpenAI 标准 `request.Size`/`request.N`（`request.N` 为 `*uint` 指针，符合 Rule 5 指针语义）。
- **Claude/Audio 转发**：`ConvertClaudeRequest`、`ConvertAudioRequest` 委托 `openai.Adaptor{}` 实现。
- `ConvertOpenAIResponsesRequest` 返回 `not implemented`。

### Testing Requirements
- `go build ./relay/channel/siliconflow/...` 必须通过
- `go test ./relay/channel/...`

### Common Patterns
- OpenAI 兼容路径直接复用 `openai.Adaptor{}` 的 `DoRequest` / `DoResponse`。
- Provider 专有响应结构定义在 `dto.go`，专用 handler 写在 `relay-<name>.go`。

## Dependencies

### Internal
- `github.com/QuantumNous/new-api/common` — JSON 包装（部分调用）
- `github.com/QuantumNous/new-api/dto` — `RerankRequest`、`RerankResponse`、`ImageRequest`、`Usage`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/openai` — 复用 `Adaptor` 处理 chat/embedding/image
- `github.com/QuantumNous/new-api/relay/common` — `RelayInfo`、`GetFullRequestURL`
- `github.com/QuantumNous/new-api/relay/constant` — `RelayModeRerank`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`、`IOCopyBytesGracefully`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewOpenAIError`、错误码

### External
- `github.com/gin-gonic/gin` — HTTP 上下文
- `github.com/samber/lo` — `FromPtrOr` 指针取值
- `encoding/json` — relay-siliconflow.go 遗留直接引用（已知违规）
- `io`、`net/http`、`fmt`、`errors` — 标准库

<!-- MANUAL: -->
