<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/codex

## Purpose

OpenAI **Codex** CLI 后端适配器（非标准 OpenAI API，走 ChatGPT 订阅的 `chatgpt.com/backend-api/codex/responses` 端点）。Codex 后端**只懂 Responses API**，所以所有入站格式（chat completions、responses、images）都被转成 Responses 请求体，上游统一强制 SSE 流式响应。

三条入站路径：
- **`/v1/chat/completions`** → `ConvertOpenAIRequest` 用 `apicompat.ChatCompletionsToResponses` 把 chat 请求转 Responses，`DoResponse` 调 `RelayChatOverCodex` 把 SSE 再转回 chat chunk/JSON。
- **`/v1/responses`**（含 `/v1/responses/compact`）→ `ConvertOpenAIResponsesRequest` 在 map 上做禁字段清理 + store/stream 钳制，`DoResponse` 复用 `openai.OaiResponsesStreamHandler` / `OaiResponsesHandler` / `OaiResponsesCompactionHandler`。
- **`/v1/images/generations` 与 `/v1/images/edits`** → `ConvertImageRequest` 构造 Responses + `image_generation` 工具请求体，强制 `info.IsStream=true`；`DoResponse` 调 `RelayImageOverCodex` 解析 SSE，抽取 `image_generation_call.result` (base64) 与 `tool_usage.image_gen` 计费 token。

鉴权特殊：`info.ApiKey` 必须是 JSON（`OAuthKey` 结构），从中取 `access_token`（→ `Authorization: Bearer`）与 `account_id`（→ `chatgpt-account-id` 头）。还强制设 `OpenAI-Beta: responses=experimental`、`originator: codex_cli_rs`、`Content-Type: application/json`、流式时 `Accept: text/event-stream`。

实际实现的 Convert：`ConvertOpenAIRequest`、`ConvertOpenAIResponsesRequest`、`ConvertImageRequest`。其余 Convert（claude/gemini/audio/rerank/embedding）返回 `errors.New("codex channel: endpoint not supported")`。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 定义 `Adaptor struct{}` 实现 `Adaptor` 接口；`GetRequestURL` 按 RelayMode 拼 `/backend-api/codex/responses[/compact]`（chat completions 与 images 共用 responses 端点）；`SetupRequestHeader` 解析 OAuthKey JSON 并设鉴权头；`ConvertOpenAIRequest` 调 apicompat 转换 + `applyCodexConstraints` + `ensureInstructionsField`；`ConvertOpenAIResponsesRequest` 走 map mutate 路径（保字段透传）；`ConvertImageRequest` 委托 `buildCodexImageBody`；`DoRequest` 对图像路径非 200 响应调 `sanitizeCodexImageErrorResponse`（白标脱敏）；`DoResponse` 按 RelayMode 分派 |
| `constants.go` | `baseModelList`（gpt-5 / 5-codex / 5.1-codex[-max/-mini] / 5.2-codex / 5.3-codex[-spark] / 5.4）、`imageModelList = ["gpt-image-2"]`、`ModelList`（base + 每个加 compact 后缀 `WithCompactModelSuffix` + 图像，用 `lo.Uniq` 去重）、`ChannelName = "codex"`、`defaultImageCarrierModel = "gpt-5.4"`、`IsCodexImageModel`（前缀匹配 `gpt-image-`）、`withCompactModelSuffix` |
| `oauth_key.go` | `OAuthKey` 结构（id_token/access_token/refresh_token/account_id/last_refresh/email/type/expired）与 `ParseOAuthKey`（JSON 解析，失败统一返回"invalid oauth key json"避免泄露内部字段） |
| `chat_bridge.go` | Chat Completions ↔ Responses 桥：`ToCompatChatRequest`（dto→apicompat JSON 中转）、`applyCodexConstraints`（typed 路径：剥 sampling 字段、强制 store=false/stream=true、注入 instructions）、`applyCodexConstraintsToMap`（map 路径：剥禁字段名单 `frequency_penalty`/`presence_penalty`/`user`/`metadata`/`stream_options`/`prompt_cache_retention`/`safety_identifier`，compact 保留 sampling）、`ensureInstructionsField`（序列化后通过 map 注入空 instructions，因 apicompat 字段是 `omitempty` string）、`writeSSE`、`RelayChatOverCodex`（SSE 扫描 + apicompat.ResponsesEventToChatChunks 流式 chunk 生成，或 buffered accumulation 非流式聚合）、`buildUsage`（apicompat.ResponsesUsage → dto.Usage）|
| `image.go` | 图像路径核心：`resolveImageCarrierModel`（per-channel > 全局 > 默认 `gpt-5.4`）、`ValidateCodexImageRequest`（response_format 只允许 b64_json）、`buildCodexImageBody`（Responses + image_generation 工具 body，含 size/quality/background/output_format/moderation 透传；**不接受 n 参数**）、`readCodexEditImages`（multipart image/image[]/image[N]/mask → base64 data URL，按数字下标排序）、`imageIndexKeyLess`/`parseImageIndex`、`fileHeaderToDataURL`、`detectCodexImageMime`、`RelayImageOverCodex`（SSE 解析，提取 `response.output_item.done` 的 `image_generation_call.result` 与 `response.completed` 的 `tool_usage.image_gen` token；**256 MiB 总读取上限**防恶意上游；token 缺失时兜底 `defaultCodexImageOutputTokens=272`）|

## For AI Agents

### Working In This Directory

- **Codex 后端不是标准 OpenAI API**：所有请求都要走 `/backend-api/codex/responses`，不是 `/v1/chat/completions` 或 `/v1/images/generations`。URL 在 `GetRequestURL` 中强制重写，relay 层的 RelayMode 与上游 URL 是解耦的。
- **`info.ApiKey` 必须是 JSON**：`SetupRequestHeader` 检测不以 `{` 开头会直接报错。OAuthKey 里的 `access_token` 与 `account_id` 都必需。token 过期处理不在本目录（由调用方刷新）。
- **Chat Completions 与 Responses 两套禁字段逻辑**：chat 路径走 `applyCodexConstraints`（typed，`apicompat.ResponsesRequest`），responses 路径走 `applyCodexConstraintsToMap`（map，保留 dto 独有的 ~13 个字段）。**不要把两条路径合并**——map 路径存在正是因为 typed 路径会丢字段。详见 `ConvertOpenAIResponsesRequest` 注释。
- **`instructions` 字段必现**：Codex 后端硬性要求 body 含 `instructions` key。`apicompat.ResponsesRequest.Instructions` 是 `string + omitempty`，空字符串会被省略，所以 `ensureInstructionsField` 在序列化后通过 map 强制注入 `instructions: ""`。修改 Convert 链路时不要漏掉这一步。
- **图像路径上游不接受 `n` 参数**：`buildCodexImageBody` 显式不设 `tool["n"]`（上游返回 `Unknown parameter: 'tools[0].n'`）。每次请求只生成一张图，客户端的 `n` 不向上游透传。改这条限制需要确认上游协议变化。
- **图像计费 token 健壮化**：`RelayImageOverCodex` 分别读 `image_gen.input_tokens`/`output_tokens`/`total_tokens`，任一缺失/为零时用 `defaultCodexImageOutputTokens=272` 兜底（避免计费塌到 0）。`total` 与 `p+comp` 不自洽时重算。这段逻辑的演进历史见代码注释（F2/F3/F11），改动前先读注释理解旧 bug。
- **图像输入 token 没透出 image 细分**：已知限制——`PromptTokensDetails.ImageTokens` 不设，因为 `relay/helper/price.go` 的 `imageRatio` 未配时默认 0，透出会导致输入图被算成"免费"。改动需先改计费引擎（见 image.go 末尾长注释）。
- **白标脱敏**：`sanitizeCodexImageErrorResponse` 在 `DoRequest` 拦截图像路径非 200 响应，把上游原文落服务端日志，替换为通用 `{"error":{"message":"codex image generation failed","type":"upstream_error"}}`——避免 ChatGPT/OpenAI 品牌、`gpt-5.4` 承载模型名、内部模型名泄露给客户端。只作用于图像路径，text/responses 路径不脱敏。
- **SSE 256 MiB 上限**：`RelayImageOverCodex` 用 `io.LimitReader` + 1 字节哨兵检测截断（F8），显式返回 "response exceeded size limit" 而不是误报 "no image returned"。修改读取逻辑时保留这个哨兵机制。
- **chat bridge 的 `state.Model` 显式赋值**：上游 Responses SSE 通常不带 `model` 字段，所以 `RelayChatOverCodex` 用 `info.UpstreamModelName` 作为 chunk model 的起始值。改 chunk 构造时保留。
- **compact 模式**：`RelayModeResponsesCompact` 走 `/backend-api/codex/responses/compact`，禁字段名单略不同（compact 保留 sampling、不接受 store/stream 字段、走 `OaiResponsesCompactionHandler`）。
- 适用 Rule 1（全部用 `common.Marshal` / `common.Unmarshal`）；适用 Rule 5（codex 不定义自己的请求 DTO，借用 apicompat.ResponsesRequest / dto.OpenAIResponsesRequest 的字段约定，指针 + omitempty 由那些类型保证）。
- **不适用 Rule 4**：codex 不是 streaming StreamOptions 的常规 provider；codex 路径在上游强制流式，StreamOptions 的语义由本目录内部处理。

### Testing Requirements

- `go build ./relay/channel/codex/...` 必须通过
- `go test ./relay/channel/codex/...`（有 `chat_bridge_test.go` / `image_test.go` / `image_extra_test.go`）
- 关键路径：chat completions ↔ Responses 双向桥（流式 + 非流式 + usage chunk）、responses（含 compact）禁字段钳制、图像 generate/edit（含 mask、多图排序）、图像计费 token 兜底、SSE 截断上限、白标脱敏
- 安全路径：OAuthKey 解析失败不泄露内部字段、图像错误响应不泄露上游品牌

### Common Patterns

- **typed + map 双轨**：chat 用 typed `apicompat.ResponsesRequest`（字段严格但丢字段），responses 用 `map[string]any`（保字段但无类型安全）。Codex 选择双轨是为了同时满足"chat 不需要 dto 独有字段"与"responses 必须透传 dto 独有字段"两个约束。
- **per-channel > 全局 > 代码默认**：`resolveImageCarrierModel` 是这套优先级的典型实现；新增可覆盖配置时复用这个顺序。
- **`apicompat` 双向转换**：`ChatCompletionsToResponses` / `ResponsesEventToChatChunks` / `ResponsesToChatCompletions` / `BufferedResponseAccumulator` 全部来自 `pkg/apicompat`，本目录只做 Codex 特定的钳制与计费适配。动这些函数时优先看 `pkg/apicompat/AGENTS.md`。
- **流式与非流式客户端意图解耦**：`info.UserWantsStream` 记录客户端意图，上游始终 SSE。`RelayChatOverCodex` 按客户端意图决定流式回写还是聚合 JSON。
- **map mutate + delete 禁字段**：`applyCodexConstraintsToMap` 用 `delete(body, k)` 移除禁字段；这与 typed 路径的"字段不存在于结构"等价但更显式。

## Dependencies

### Internal

- `relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `relay/channel/openai` — 复用 `OaiResponsesStreamHandler` / `OaiResponsesHandler` / `OaiResponsesCompactionHandler`（Responses 与 Compact RelayMode）；`Adaptor.ConvertImageRequest`（图像 generations 透传）
- `relay/common` — `RelayInfo`、`GetFullRequestURL`
- `relay/constant` — `RelayModeResponses` / `ResponsesCompact` / `ChatCompletions` / `ImagesGenerations` / `ImagesEdits`
- `relay/helper` — `SetEventStreamHeaders`、`FlushWriter`
- `pkg/apicompat` — `ChatCompletionsRequest` / `ChatCompletionsToResponses` / `ResponsesRequest` / `ResponsesStreamEvent` / `ResponsesEventToChatChunks` / `ChatChunkToSSE` / `NewResponsesEventToChatState` / `FinalizeResponsesChatStream` / `NewBufferedResponseAccumulator` / `ResponsesResponse` / `ResponsesUsage` / `ResponsesToChatCompletions`
- `setting/model_setting` — `GetCodexSettings().ImageCarrierModel`
- `setting/ratio_setting` — `WithCompactModelSuffix`
- `service` — `CloseResponseBodyGracefully`
- `dto` — `GeneralOpenAIRequest`、`OpenAIResponsesRequest`、`ImageRequest`、`ImageData`、`ImageResponse`、`Usage`、`InputTokenDetails`、`OutputTokenDetails`、`ClaudeRequest`、`GeminiChatRequest`、`AudioRequest`、`RerankRequest`、`EmbeddingRequest`
- `types` — `NewAPIError`、`NewError`、`NewErrorWithStatusCode`、`NewOpenAIError`、`ErrorCode*`（`InvalidRequest` / `BadResponseBody` / `BadResponse` / `ReadResponseBodyFailed`）、`ErrOptionWithSkipRetry`
- `common` — `Marshal`、`Unmarshal`、`SysError`、`LocalLogPreview`

### External

- `github.com/gin-gonic/gin`
- `github.com/samber/lo` — `Map`、`Uniq`（constants.go）
- `github.com/tidwall/gjson` — SSE 字段提取（image.go）
- 标准库 `bufio`、`bytes`、`encoding/base64`、`errors`、`fmt`、`io`、`mime/multipart`、`net/http`、`sort`、`strconv`、`strings`、`time`

<!-- MANUAL: -->
