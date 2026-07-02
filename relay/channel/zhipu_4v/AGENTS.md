<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/zhipu_4v

## Purpose

智谱 AI（GLM-4V / GLM-4.x / GLM-5）**新版 API**（v4 `paas/v4`）provider 适配器。这是智谱当前的 OpenAI 兼容 API，也是推荐使用的新版接口（与 `relay/channel/zhipu/` 的旧版 v3 `model-api` 共存，由 `ChannelType` 区分）：

- **OpenAI 格式 chat completions**：`<base>/api/paas/v4/chat/completions`，请求体结构与 OpenAI 一致（`messages`/`model`/`stream` 等）。
- **Claude 格式（Anthropic 兼容入口）**：`RelayFormatClaude` 时走 `<base>/api/anthropic/v1/messages`，响应处理委托 `claude.Adaptor{}`。
- **Embeddings**：`<base>/api/paas/v4/embeddings`，透传请求。
- **Image Generations**：`<base>/api/paas/v4/images/generations`，响应由 `zhipu4vImageHandler` 转换（智谱返回的 `data[].url`/`image_url`/`b64_json`/`b64_image` 多种格式归一化为 OpenAI 的 `b64_json`）。
- **ChannelSpecialBases 多方案**：命中时 OpenAI 格式走 `specialPlan.OpenAIBaseURL`，Claude 格式走 `specialPlan.ClaudeBaseURL`。

鉴权用简单的 `Authorization: Bearer <apikey>`（不再用旧版 JWT）。`ConvertOpenAIRequest` 对 `TopP >= 1` 钳制为 0.99。`ConvertImageRequest` 剥离 `Stream`/`PartialImages`（智谱不流式）。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 实现 `Adaptor` 接口。`GetRequestURL` 按 `RelayFormat`（Claude 走 `/v1/messages`）× `RelayMode`（embeddings/images/default）× 是否 `ChannelSpecialBases` 命中分派端点；`ConvertClaudeRequest` 直接透传（智谱 Claude 兼容入口原生接受 ClaudeRequest）；`ConvertImageRequest` 剥离 Stream 字段后透传；`ConvertOpenAIRequest` TopP 钳制 + 调 `requestOpenAI2Zhipu`（处理图片 base64 data URI 前缀剥离）；`ConvertEmbeddingRequest` 透传；`DoResponse` 按 `RelayFormat`（Claude → claude.Adaptor）→ `RelayMode`（ImagesGenerations → `zhipu4vImageHandler`）→ 默认（openai.Adaptor）分派 |
| `constants.go` | 定义 `ModelList`（`glm-4`、`glm-4v`、`glm-3-turbo`、`glm-4-alltools`、`glm-4-plus`、`glm-4-0520`、`glm-4-air`、`glm-4-airx`、`glm-4-long`、`glm-4-flash`、`glm-4v-plus`、`glm-4.6`、`glm-4.6v`、`glm-4.7`、`glm-4.7-flash`、`glm-5`）与 `ChannelName = "zhipu_4v"` |
| `dto.go` | 定义新版协议 DTO：`ZhipuV4Response`（OpenAI 兼容结构，复用 `dto.OpenAITextResponseChoice`/`Usage`/`types.OpenAIError`）、`ZhipuV4StreamResponse`（复用 `dto.ChatCompletionsStreamResponseChoice`）。文件顶部大量注释代码保留了旧版（自定义 message 结构）的定义，标记为已弃用。内部 `tokenData` 结构体未使用（新版不再 JWT 缓存）|
| `image.go` | 智谱图像生成专用 handler。定义 `zhipuImageRequest`（含 `watermark_enabled`/`user_id`/`quality` 智谱特有字段）、`zhipuImageResponse`（智谱返回多种图片字段：`url`/`image_url`/`b64_json`/`b64_image`、含 `error`/`request_id`/`extendParam`）、`openAIImagePayload`/`openAIImageData`（归一化为 OpenAI 的 `b64_json`）。`zhipu4vImageHandler`：读 body → 解 `zhipuImageResponse` → 错误检查 → 遍历 `data[]` 取 url 下载或直接用 b64 → 拼 `openAIImagePayload` 回写 |
| `relay-zhipu_v4.go` | `requestOpenAI2Zhipu`：消息转换，对图片消息做 data URI 前缀剥离（`data:image/...` → 纯 base64），处理 `Stop` 字段的 string→[]string 归一化，组装 `dto.GeneralOpenAIRequest`（保留 `THINKING` 字段） |

## For AI Agents

### Working In This Directory

- **新版 vs 旧版**：本目录是智谱新版 v4 API（`paas/v4`/OpenAI 兼容），旧版在 `relay/channel/zhipu/`。新功能优先在此实现。两者由 `ChannelType`（`ChannelTypeZhipu` vs `ChannelTypeZhipu_v4`）区分。
- **Claude 格式透传**：智谱提供 Anthropic 兼容入口（`/api/anthropic/v1/messages`），`ConvertClaudeRequest` 直接 `return req, nil` 不做转换，`DoResponse` 委托 `claude.Adaptor{}`。这是智谱官方支持的，不是 bug。
- **图片 data URI 剥离**：`requestOpenAI2Zhipu` 会把 `image_url.url` 的 `data:image/...;base64,` 前缀剥掉，只保留纯 base64 部分——智谱 v4 不接受 data URI。
- **图像响应多格式归一**：智谱 image API 可能返回 `url`、`image_url`、`b64_json`、`b64_image` 四种字段之一，`zhipu4vImageHandler` 按优先级取值，无 b64 时调 `service.GetImageFromUrl(url)` 下载后转 b64。日志告警：`zhipu_image_missing_url` / `zhipu_image_empty_b64` / `zhipu_image_get_b64_failed`。
- **TopP 钳制**：与旧版 zhipu 一致，`TopP >= 1` 时强制改为 0.99。
- **ChannelSpecialBases**：与 volcengine 相同的多 URL 方案机制（`channelconstant.ChannelSpecialBases`），命中时 Claude/OpenAI 各用独立 base URL。
- **Image 流式剥离**：`ConvertImageRequest` 显式 `request.Stream = nil; request.PartialImages = nil`，注释说明"智谱 passthrough 不支持 image 流式，new-api 仅为 blockrun 等渠道合成 SSE"。
- **ChannelBaseURLs 兜底**：`GetRequestURL` 在 `info.ChannelBaseUrl == ""` 时回退到 `channelconstant.ChannelBaseURLs[ChannelTypeZhipu_v4]`。

### Testing Requirements
- `go build ./relay/channel/zhipu_4v/...` 必须通过
- `go test ./relay/channel/...`
- 手动测试矩阵：chat（流式+非流式）、Claude 格式入口、embeddings、image generations（验证 url/b64 两种返回路径）、ChannelSpecialBases 命中 vs 未命中。

### Common Patterns
- **多 RelayFormat 支持**：`GetRequestURL` 和 `DoResponse` 都先判 `RelayFormat`（Claude）再判 `RelayMode`，与 volcengine 一致——支持 Anthropic 兼容入口的标准模式。
- **图片格式归一化**：provider 返回多种图片字段（url/image_url/b64_json/b64_image），统一下载/解码后转为 OpenAI 标准的 `b64_json`，用 `service.GetImageFromUrl` 做下载。
- **委托 + 特化**：Claude 委托 claude.Adaptor，image 走自有 handler，其余委托 openai.Adaptor。
- **v4 OpenAI 兼容**：新版智谱直接用 `dto.GeneralOpenAIRequest` 作为请求体，不再需要 provider 专有的 message 结构。

## Dependencies

### Internal
- `github.com/QuantumNous/new-api/common` — `Marshal`、`Unmarshal`
- `github.com/QuantumNous/new-api/constant`（`channelconstant`）— `ChannelTypeZhipu_v4`、`ChannelBaseURLs`、`ChannelSpecialBases`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`Message`、`ImageRequest`、`ClaudeRequest`、`EmbeddingRequest`、`OpenAIResponsesRequest`、`Usage`、`ContentTypeImageURL`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/claude` — `Adaptor`（Claude 格式响应处理）
- `github.com/QuantumNous/new-api/relay/channel/openai` — `Adaptor`（默认响应处理）
- `github.com/QuantumNous/new-api/relay/common` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/constant`（`relayconstant`）— `RelayModeEmbeddings`、`RelayModeImagesGenerations`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`、`IOCopyBytesGracefully`、`GetImageFromUrl`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewOpenAIError`、`WithOpenAIError`、`OpenAIError`、`RelayFormat`、错误码
- `github.com/QuantumNous/new-api/logger` — `LogWarn`、`LogError`
- `github.com/samber/lo` — `FromPtrOr`、`ToPtr`

### External
- `github.com/gin-gonic/gin` — HTTP 上下文
- `io`、`net/http`、`fmt`、`strings`、`errors`、`time` — 标准库

<!-- MANUAL: -->
