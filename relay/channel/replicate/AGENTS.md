<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/replicate

## Purpose

Replicate 适配器，**仅支持图像生成**（`ConvertImageRequest`：`RelayModeImagesGenerations` 与 `RelayModeImagesEdits`）。`Adaptor` 不嵌入 `openai.Adaptor`（空 struct），自行实现全部接口方法。对接 Replicate 的 `/v1/models/{model}/predictions` 端点（默认模型 `black-forest-labs/flux-1.1-pro`），使用 `Prefer: wait` 头让 Replicate 同步返回 prediction 结果。将 OpenAI images 请求转为 Replicate 的 `{"input": {...}}` 格式，解析 prediction 输出（URL 字符串或 URL 数组）并组装为 `dto.ImageResponse`。支持图片编辑路径（先上传图片文件到 `/v1/files` 获得 URL，再作为 `image_prompt` 传入）。chat/embeddings/rerank/audio/responses/claude/gemini 等路径均返回 not implemented。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体（空 struct）及接口实现：`Init`（空）、`GetRequestURL`（补全 `ChannelBaseUrl` 默认值后 `relaycommon.GetFullRequestURL`）、`SetupRequestHeader`（`Authorization: Bearer` + **`Prefer: wait`** + `Content-Type`/`Accept` 默认值）、`ConvertImageRequest`（核心：解析 prompt、确定模型名并设置 `RequestURLPath=/v1/models/{model}/predictions`、构建 `input` payload——prompt/aspect_ratio/width/height/output_format/num_outputs/prompt_upsampling——合并 `ExtraFields`/`Extra["input"]`、images edits 路径调用 `uploadFileFromForm` 上传图片→`image_prompt` URL）、`ConvertOpenAIRequest`/`ConvertRerankRequest`/`ConvertEmbeddingRequest`/`ConvertAudioRequest`/`ConvertOpenAIResponsesRequest`/`ConvertClaudeRequest`/`ConvertGeminiRequest`（全部返回 not implemented）、`DoRequest`（`channel.DoApiRequest`）、`DoResponse`（解析 `PredictionResponse`：检查 error/status、提取 output URL(s)、可选 `downloadImagesToBase64` 转 b64_json、组装 `ImageResponse`）、`GetModelList`/`GetChannelName`、辅助函数：`downloadImagesToBase64`（via `service.GetImageFromUrl`）、`mapOpenAISizeToFlux`（OpenAI size→Flux aspect_ratio/custom 维度）、`reduceRatio`/`gcd`/`normalizeFluxDimension`（比例计算与维度归一化到 256-1440、step 32 的倍数）、`uploadFileFromForm`（multipart form 文件→Replicate `/v1/files` 上传→返回 URL） |
| `dto.go` | Replicate 响应 DTO：`PredictionResponse`（`Status`/`Output any`/`Error *PredictionError`）、`PredictionError`（`Code`/`Message`/`Detail`）、`FileUploadResponse`（`Urls.Get string`） |
| `constants.go` | `const` 块定义 `ChannelName = "replicate"`、`ModelFlux11Pro = "black-forest-labs/flux-1.1-pro"`（默认模型），以及 `ModelList`（仅含 `ModelFlux11Pro`） |

## For AI Agents

### Working In This Directory

- **仅图像生成**：本 adapter 只实现了 `ConvertImageRequest`，其他所有 Convert 方法（chat/embeddings/rerank/audio/responses/claude/gemini）返回 `errors.New("... not implemented")`。Replicate 渠道不适用于 chat completions 等路径。
- **`Prefer: wait` 同步模式**：`SetupRequestHeader` 设置 `Prefer: wait`，让 Replicate 同步等待 prediction 完成后返回结果（而非返回 prediction ID 后轮询）。`DoResponse` 因此可以直接解析最终 output，无需实现轮询逻辑。
- **默认模型**：若 `info.UpstreamModelName` 与 `request.Model` 均为空，`ConvertImageRequest` 回退到 `ModelFlux11Pro`（`black-forest-labs/flux-1.1-pro`）。`ConvertImageRequest` 会修改 `info.UpstreamModelName` 与 `info.RequestURLPath`（设为 `/v1/models/{model}/predictions`）——这是副作用，relay 层后续会使用修改后的值。
- **size→aspect_ratio 映射**：`mapOpenAISizeToFlux` 将 OpenAI 的 `{width}x{height}` 格式（如 `1024x1024`、`1792x1024`）映射到 Flux 支持的 `aspect_ratio`（如 `1:1`、`16:9`）。不在预设比例中的尺寸会通过 `reduceRatio` 计算最简比，若仍不匹配则回退到 `custom` + `normalizeFluxDimension`（256-1440 范围、32 的倍数）。
- **ExtraFields / Extra 合并**：`ConvertImageRequest` 支持通过 `request.ExtraFields`（JSON map）与 `request.Extra["input"]`（JSON map）注入额外的 input 参数——这允许客户端传递 Flux 特有参数（如 `safety_tolerance`、`output_quality`）。`Extra["input"]` 的 key 被特殊处理（其 value 作为 map 展开合并到 input），其他 `Extra` key 直接作为顶层 input key。
- **图片编辑路径**：`RelayModeImagesEdits` 时调用 `uploadFileFromForm`，从 multipart form 的 `image`/`image[]`/`image_prompt` 字段（或第一个文件）读取图片，POST 到 Replicate `/v1/files` 上传，返回的 URL 作为 `image_prompt` 参数。
- **output 格式兼容**：`DoResponse` 处理 `prediction.Output` 为 `string`（单个 URL）、`[]any`（URL 数组）或 nil 的情况。`b64_json` 模式下通过 `downloadImagesToBase64` 下载并转 base64。
- **Rule 1**：`adaptor.go` 导入 `encoding/json`，但仅在 `ConvertImageRequest` 中用于 `json.Unmarshal(request.OutputFormat, &outputFormat)`（`adaptor.go:114`）——这应改为 `common.UnmarshalJsonStr` 或 `common.Unmarshal`（Rule 1）。其余 JSON 操作已使用 `common.Unmarshal`/`common.Marshal`。
- **Rule 5**：`PredictionResponse.Output any` 使用 `any` 类型以兼容 string 和 array 输出，避免了指针零值问题。

### Testing Requirements

- `go build ./relay/channel/replicate/...` 必须通过
- `go test ./relay/channel/...`
- 无独立 `_test.go`；手动测试图像生成与编辑路径
- 测试 `mapOpenAISizeToFlux` 的各种 size 输入（含非标准尺寸）、`ExtraFields`/`Extra` 注入、b64_json 响应格式

### Common Patterns

- **单功能 adapter**：仅实现一种 relay mode（images），其他 Convert 方法返回 not implemented——当 provider 仅提供单一能力时使用此模式。
- **副作用初始化**：`ConvertImageRequest` 在转换过程中修改 `info.UpstreamModelName` 与 `info.RequestURLPath`，影响后续 `DoRequest` 的 URL 拼接。
- **同步 prediction**：通过 `Prefer: wait` 头避免异步轮询，简化实现。
- **文件上传 + URL 引用**：图片编辑路径先上传文件获取 URL，再作为请求参数传入——避免 base64 内联大文件。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal`、`Unmarshal`、`GetTimestamp`
- `github.com/QuantumNous/new-api/constant` — `ChannelTypeReplicate`、`ChannelBaseURLs`
- `github.com/QuantumNous/new-api/dto` — `ImageRequest`、`ImageResponse`、`ImageData`、`GeneralOpenAIRequest`、`ClaudeRequest`、`GeminiChatRequest`、`AudioRequest`、`EmbeddingRequest`、`RerankRequest`、`OpenAIResponsesRequest`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`、`GetFullRequestURL`
- `relayconstant "github.com/QuantumNous/new-api/relay/constant"` — `RelayModeImagesEdits`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`（间接）、`GetImageFromUrl`、`GetHttpClient`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewError`、`ErrorCodeBadResponse`、`ErrorCodeBadResponseBody`、`ErrorCodeReadResponseBodyFailed`

### External

- `github.com/gin-gonic/gin` — HTTP 上下文
- `net/http`、`io`、`fmt`、`errors`、`strings`、`bytes`、`strconv`、`mime/multipart`、`net/textproto` — 标准库
- `encoding/json` — `adaptor.go:114` 的 `json.Unmarshal(request.OutputFormat, ...)`（**应改为 `common.Unmarshal`**，Rule 1）；类型引用不涉及
- `github.com/samber/lo` — `FromPtrOr`（`request.N` 指针解引用）

<!-- MANUAL: -->
