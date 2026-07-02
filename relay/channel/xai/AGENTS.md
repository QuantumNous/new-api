<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/xai

## Purpose

xAI（Grok）provider 适配器。以 OpenAI 兼容协议为基础，额外支持：

- **Live Search**：模型名 `-search` 后缀触发，向请求注入 `search_parameters.mode = "on"`。
- **grok-3-mini reasoning effort**：模型名 `-high` / `-low` 后缀映射到 `reasoning_effort`，并把 `max_tokens` 迁移到 `max_completion_tokens`。
- **Image Generation**：通过 `ImageRequest` DTO（仅暴露 `model`/`prompt`/`n`/`response_format`，注释掉 `size`/`quality`/`style` 因为 xAI 不支持）。
- **Responses API**：`ConvertOpenAIResponsesRequest` 透传，`DoResponse` 在 `RelayModeResponses` 时委托 `openai.OaiResponsesHandler` / `OaiResponsesStreamHandler`。
- **自定义流式与非流式 handler**（`text.go`）：xAI 流式响应的 `usage` 只含 `prompt_tokens`/`total_tokens`，handler 需要自己算 `completion_tokens = total - prompt`；非流式 handler 还需补 `completion_tokens_details.text_tokens`。当流式响应不含 usage 时回退到 `service.ResponseText2Usage` 估算并补 toolCount*7 个 token。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 实现 `Adaptor` 接口。`ConvertOpenAIRequest` 处理 `-search` 后缀（注入 `search_parameters`）与 `grok-3-mini` 的 `-high`/`-low` reasoning effort 映射；`ConvertImageRequest` 把 `dto.ImageRequest` 映射为 xAI 的 `ImageRequest`；`ConvertOpenAIResponsesRequest` 补默认 model 后透传；`DoResponse` 按 `RelayModeImagesGenerations`/`ImagesEdits`（→ `openai.OpenaiHandlerWithUsage`）、`RelayModeResponses`（→ openai responses handler）、default（→ `xAIStreamHandler`/`xAIHandler`）分派 |
| `constants.go` | 定义 `ModelList`：语言模型（grok-4-1-fast-*、grok-4-*、grok-3*、grok-2-vision）、`-search` 变体、`grok-3-mini-{high,low}` reasoning 变体、图像模型（`grok-imagine-image*`、`grok-2-image-1212`）、视频模型（`grok-imagine-video`）；`ChannelName = "xai"` |
| `dto.go` | 定义 `ChatCompletionResponse`（复用 `dto.OpenAITextResponseChoice` / `dto.Usage`）、`ImageRequest`（xAI 特化，注释掉 `Size`/`Quality`/`Style`/`User`/`ExtraFields` 字段，仅保留 `Model`/`Prompt`/`N`/`ResponseFormat`）|
| `text.go` | `streamResponseXAI2OpenAI`（把 xAI usage 的 completion_tokens 覆写为本地计算值）、`xAIStreamHandler`（用 `helper.StreamScannerHandler` 逐块解析、`openai.ProcessStreamResponse` 聚合 toolCount/responseText、无 usage 时回退估算）、`xAIHandler`（非流式，重算 `completion_tokens` 与 `text_tokens` 后重 marshal 回写） |

## For AI Agents

### Working In This Directory

- **`-search` 与 `-high`/`-low` 后缀剥离**：`ConvertOpenAIRequest` 会修改 `info.UpstreamModelName` 和 `request.Model`，剥离后缀后的模型名才是真正发给上游的。新增后缀变体时注意 `constants.go` 的 ModelList 与此处逻辑保持同步。
- **reasoning_effort 双写**：`ConvertOpenAIRequest` 同时写 `request.ReasoningEffort` 与 `info.ReasoningEffort`，下游 handler 依赖后者。
- **Image 字段约束**：xAI image API 不支持 size/quality/style（注释中明确说明），`ImageRequest` 故意不暴露这些字段。`ConvertImageRequest` 也只映射 `model`/`prompt`/`n`/`response_format`。
- **N 字段处理**：`dto.ImageRequest.N` 是 `*uint` 指针（Rule 5），`ConvertImageRequest` 用 `lo.FromPtrOr(request.N, uint(1))` 取默认值 1。
- **流式 usage 不可靠**：xAI 流式响应的 usage 仅含 prompt/total 两字段，completion 由本地相减得到；若整段流式无 usage，则走 `service.ResponseText2Usage` 估算并补偿 `toolCount * 7` 个 token（工具调用 token 经验值）。
- **非流式 text_tokens 补全**：`xAIHandler` 显式计算 `completion_tokens_details.text_tokens = completion_tokens - reasoning_tokens`，因为 xAI 不返回此字段。

### Testing Requirements
- `go build ./relay/channel/xai/...` 必须通过
- `go test ./relay/channel/...`

### Common Patterns
- **后缀触发特性**：通过模型名后缀（`-search`、`-high`、`-low`）在 `ConvertOpenAIRequest` 注入额外参数，是 xAI/grok 系的惯用模式。
- **委托 + 特化**：image/responses 路径委托 openai handler，chat 路径用自有 handler 处理 xAI 的 usage 差异。
- **helper.StreamScannerHandler + openai.ProcessStreamResponse**：标准流式聚合套路，responseTextBuilder 收集文本，toolCount 统计工具调用次数。

## Dependencies

### Internal
- `github.com/QuantumNous/new-api/common` — `SysLog`、`UnmarshalJsonStr`、`Marshal`、`Unmarshal`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`ImageRequest`、`OpenAIResponsesRequest`、`ChatCompletionsStreamResponse`、`Usage`、`OpenAITextResponseChoice`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/openai` — `OaiResponsesHandler`、`OaiResponsesStreamHandler`、`OpenaiHandlerWithUsage`、`ProcessStreamResponse`
- `github.com/QuantumNous/new-api/relay/common` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/constant` — `RelayModeImagesGenerations`、`RelayModeImagesEdits`、`RelayModeResponses`
- `github.com/QuantumNous/new-api/relay/helper` — `StreamScannerHandler`、`ObjectData`、`SetEventStreamHeaders`、`Done`、`StreamResult`
- `github.com/QuantumNous/new-api/service` — `ResponseText2Usage`、`CloseResponseBodyGracefully`、`IOCopyBytesGracefully`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、错误码

### External
- `github.com/gin-gonic/gin` — HTTP 上下文
- `github.com/samber/lo` — `FromPtrOr`、`ToPtr`
- `io`、`net/http`、`strings`、`errors` — 标准库

<!-- MANUAL: -->
