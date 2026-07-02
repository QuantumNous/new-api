<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/ali

## Purpose

阿里云百炼（DashScope）适配器。上游既支持 OpenAI 兼容 chat completions（`/compatible-mode/v1/chat/completions`）与 embeddings（`/compatible-mode/v1/embeddings`），也支持 DashScope 原生的 rerank（`/api/v1/services/rerank/text-rerank/text-rerank`）、Responses（`/api/v2/apps/protocols/compatible-mode/v1/responses`）、多模态/同步图像（`/api/v1/services/aigc/multimodal-generation/generation`）、异步图像生成（`/api/v1/services/aigc/text2image/image-synthesis`）以及 image2image（含旧版 wan 模型路径）。

鉴权用 `Bearer <api-key>`，流式请求额外设 `X-DashScope-SSE: enable`，异步图像生成设 `X-DashScope-Async: enable`。

支持 Anthropic Messages 入站直通（部分模型，见 `supportsAliAnthropicMessages`）。

实际实现的 Convert：`ConvertOpenAIRequest`、`ConvertImageRequest`（generations + edits + sync/async + wan 分支）、`ConvertRerankRequest`、`ConvertEmbeddingRequest`、`ConvertOpenAIResponsesRequest`、`ConvertClaudeRequest`（含 anthropic-messages 分支与 OpenAI 转换分支）。`ConvertAudioRequest` / `ConvertGeminiRequest` 返回 `errors.New("not implemented")`。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 定义 `Adaptor struct{ IsSyncImageModel bool }` 实现 `Adaptor` 接口；`GetRequestURL` 按 RelayFormat / RelayMode / 模型名组合分派到 6+ 个不同端点；`SetupRequestHeader` 设 Bearer + DashScope SSE/Async 头；`DoResponse` 按 RelayFormat 分派（Claude 直通→`claude.Adaptor`，否则 image/rerank/openai 三路）|
| `constants.go` | `ModelList`（qwen-turbo/plus/max、qwq-32b、qwen3-235b-a22b、text-embedding-v1、gte-rerank-v2）+ `ChannelName = "ali"` |
| `dto.go` | DashScope 专属结构：`AliMessage`/`AliInput`/`AliParameters`/`AliChatRequest`、`AliEmbeddingRequest`/`AliEmbeddingResponse`、`AliImageRequest`/`AliImageParameters`/`AliImageInput`、`WanImageInput`/`WanImageParameters`（wan 系图生图）、`AliRerankRequest`/`AliRerankResponse`、`AliResponse`/`AliOutput`/`TaskResult`/`AliUsage`/`AliError`；`AliOutput` 上挂 `ChoicesToOpenAIImageDate` / `ResultToOpenAIImageDate` 两个转换方法 |
| `text.go` | `requestOpenAI2Ali`：把 `TopP` 限制到 `(0,1)` 区间（ali 不接受 0 或 1）|
| `rerank.go` | `ConvertRerankRequest`（OpenAI → `AliRerankRequest`，默认 `ReturnDocuments=true`）与 `RerankHandler`（解析 `AliRerankResponse` → OpenAI rerank 格式）|
| `image.go` | 同步/异步图像路径核心：`oaiImage2AliImageRequest`（含 `Extra["parameters"]` / `Extra["input"]` 解析、`z-image` 的 prompt_extend 倍率计费）、`oaiFormEdit2AliImageEdit`（multipart form → base64）、`getImageBase64sFromForm`、`updateTask` + `asyncTaskWait`（异步任务轮询，最多 20 步 × 10 秒）、`responseAli2OpenAIImage`、`aliImageHandler` |
| `image_wan.go` | wan 系图生图：`oaiFormEdit2WanxImageEdit`（旧版 wan）、`isOldWanModel` / `isWanModel` 模型名判定（`wan2.6` / `wan2.7` 视为新版）|

## For AI Agents

### Working In This Directory

- **多端点路由是核心复杂度**：`GetRequestURL` 同时考虑 `info.RelayFormat`（Claude 特殊路径）、`info.RelayMode`、`isSyncImageModel`、`isOldWanModel`、`isWanModel` 五个变量。改动 URL 逻辑时务必把所有组合走一遍。
- **Anthropic Messages 直通（`supportsAliAnthropicMessages`）**：模型名匹配 env `ALI_ANTHROPIC_MESSAGES_MODELS`（默认 `qwen,deepseek-v4,kimi,glm,minimax-m`）时走 `/apps/anthropic/v1/messages`，DoResponse 委托 `claude.Adaptor`。新增模型到该 env 即可启用，不需要改代码。
- **异步图像任务**：异步图像生成的响应只含 `task_id`，本适配器在 `asyncTaskWait` 内**同步轮询**直到 `SUCCEEDED/FAILED/CANCELED/UNKNOWN` 或 20 步超时（总等待 ~200s）。这是 process-local 阻塞，每个并发请求占一个 goroutine，注意 Rule 11 下多节点的总并发量。
- **`IsSyncImageModel` 是 adaptor 实例字段**：每次请求一个新 `Adaptor` 实例，因此该字段只用于同一次请求的 DoResponse 路由，不要当作跨请求缓存。
- **`z-image` + `prompt_extend`**：`oaiImage2AliImageRequest` 检测到 `z-image` + `PromptExtend=true` 时会调 `info.PriceData.AddOtherRatio("prompt_extend", 2)`，这是**计费表达式系统**（见 Rule 6 / `pkg/billingexpr/`）的一部分；动这里时必须理解计费表达式如何消费 OtherRatio。
- **图像 `n` 参数计费**：`oaiImage2AliImageRequest` 把 `N` 写进 `info.PriceData.OtherRatio["n"]`；`aliImageHandler` 在响应里再用真实 `ImageCount` 或 `len(Data)` 覆盖。改 n 计费时两边都要看。
- 适用 Rule 1（image.go / dto.go 用 `common.Unmarshal` / `common.Marshal`，但 rerank.go 仍用 `encoding/json`——**违反 Rule 1**，改动时顺手迁）。
- **multipart 文件读取**：`getImageBase64sFromForm` 支持三种字段名约定：`image`、`image[]`、`image[N]`。新增字段名约定时保持同一优先级顺序（`image` > `image[]` > `image[N]` 通配）。

### Testing Requirements

- `go build ./relay/channel/ali/...` 必须通过
- `go test ./relay/channel/...`
- 关键路径：流式 chat（DashScope SSE）、异步图像生成轮询、Claude 直通（Anthropic Messages）、wan 系图生图

### Common Patterns

- **`claude.Adaptor` / `openai.Adaptor` 实例化委托**：`ConvertClaudeRequest`、`DoResponse` 直接 `adaptor := claude.Adaptor{}` / `openai.Adaptor{}` 然后调方法，跨 adaptor 共享。
- **DashScope 请求头约定**：流式 = `X-DashScope-SSE: enable`；异步图像 = `X-DashScope-Async: enable`；image edits 还要显式 `Content-Type: application/json`。
- **`Info.PriceData.AddOtherRatio`**：所有 ali 的图像计费变量（n、prompt_extend）都通过这个 API 注入计费表达式系统，不在响应里直接改 quota。

## Dependencies

### Internal

- `relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `relay/channel/claude` — 复用 `Adaptor.DoResponse`（Anthropic Messages 路径）
- `relay/channel/openai` — 复用 `Adaptor.DoResponse`（默认 chat/embedding 路径）
- `relay/common` — `RelayInfo`、`PriceData.AddOtherRatio`
- `relay/constant` — `RelayModeChatCompletions` / `Embeddings` / `Rerank` / `Responses` / `ImagesGenerations` / `ImagesEdits` / `Completions`
- `service` — `ClaudeToOpenAIRequest`、`ResponseText2Usage`（未直接用，via openai）、`CloseResponseBodyGracefully`、`IOCopyBytesGracefully`、`GetImageFromUrl`、`UnmarshalBodyReusable`、`GetHttpClient`
- `setting/model_setting` — `IsSyncImageModel`
- `dto` — `GeneralOpenAIRequest`、`ClaudeRequest`、`GeminiChatRequest`、`ImageRequest`、`EmbeddingRequest`、`AudioRequest`、`RerankRequest`、`OpenAIResponsesRequest`、`StreamOptions`、`ImageResponse`、`ImageData`、`Usage`、`RerankResponseResult`
- `types` — `NewAPIError`、`NewOpenAIError`、`WithOpenAIError`、`NewError`、`OpenAIError`、`ErrorCode*`、`RelayFormatClaude`
- `common` — `Marshal`、`Unmarshal`、`SysLog`、`GetEnvOrDefaultString`
- `logger` — `LogError`、`LogWarn`、`LogDebug`

### External

- `github.com/gin-gonic/gin`
- `github.com/samber/lo` — `SomeBy`、`FilterMap`、`FromPtrOr`、`ToPtr`
- 标准库 `encoding/base64`、`encoding/json`（rerank.go 遗留）、`mime/multipart`、`net/http`、`io`、`fmt`、`strings`、`errors`、`time`

<!-- MANUAL: -->
