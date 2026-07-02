<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/minimax

## Purpose

MiniMax（海螺，`https://api.minimax.chat`）上游适配器，实现 `channel.Adaptor` 接口。多模态多端点适配器，覆盖三种 RelayMode + Claude 格式：

- **chat completions**：`/v1/text/chatcompletion_v2`（OpenAI 兼容），`ConvertOpenAIRequest` 透传；`DoResponse` 按 `RelayFormat` 委托 `openai.Adaptor` 或 `claude.Adaptor`。
- **`RelayFormatClaude`**：`/anthropic/v1/messages`，`ConvertClaudeRequest` 委托 `claude.Adaptor`。
- **`RelayModeImagesGenerations`**：`/v1/image_generation`，自定义 `MiniMaxImageRequest`（`aspect_ratio` + `prompt_optimizer` + `aigc_watermark`），`N` 支持，size 自动转换为 aspect ratio（含 gcd 约简）。
- **`RelayModeAudioSpeech`（TTS）**：`/v1/t2a_v2`，自定义 `MiniMaxTTSRequest`（voice_setting / pronunciation_dict / audio_setting / timbre_weights / voice_modify / stream_options），响应支持 hex 音频解码或 HTTP URL 重定向。

已注册到 `streamSupportedChannels`（Rule 4），MiniMax 支持 stream_options。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体及 `Adaptor` 接口实现；含 TTS 请求构造、image 请求构造入口、DoResponse 多路分发 |
| `adaptor_test.go` | 单元测试：`TestGetRequestURLForImageGeneration` / `TestConvertImageRequest`（验证 aspect ratio / N / response_format 映射）/ `TestDoResponseForImageGeneration`（验证 `image_urls` 被转换为 OpenAI 格式且不泄漏 MiniMax 原生字段） |
| `constants.go` | `ModelList`（abab / MiniMax-M2.* / speech / image-01 系列 21 个），`ChannelName = "minimax"`，注释含官方文档链接 |
| `image.go` | MiniMax image 请求/响应 DTO + 转换：`oaiImage2MiniMaxImageRequest`、`aspectRatioFromImageRequest`、`parseImageSize` / `reduceAspectRatio` / `gcd`、`normalizeMiniMaxResponseFormat`、`responseMiniMax2OpenAIImage`、`miniMaxImageHandler` |
| `relay-minimax.go` | `GetRequestURL(info)` 独立函数（便于测试）：按 `RelayFormat` / `RelayMode` 路由 chat / image / tts 端点，空 base url 时回退到 `constant.ChannelBaseURLs[ChannelTypeMiniMax]` |
| `tts.go` | TTS 完整实现：`MiniMaxTTSRequest` 与配套 DTO（`VoiceSetting` / `AudioSetting` / `PronunciationDict` / `TimbreWeight` / `VoiceModify` / `StreamOptions`）、`handleTTSResponse`（hex 解码或 URL 302 重定向）、`handleChatCompletionResponse`（兜底透传）、`getContentTypeByFormat` |

## For AI Agents

### Working In This Directory

- 已实现的 `Convert*` 方法：`ConvertOpenAIRequest`（透传）、`ConvertClaudeRequest`（委托 `claude.Adaptor`）、`ConvertAudioRequest`（→ `MiniMaxTTSRequest`，仅支持 `RelayModeAudioSpeech`）、`ConvertImageRequest`（→ `MiniMaxImageRequest`，仅支持 `RelayModeImagesGenerations`）、`ConvertEmbeddingRequest`（透传）。`ConvertRerankRequest` 返回 `nil, nil`；Gemini / OpenAIResponses 返回 `not implemented`。
- **`ConvertAudioRequest` 特殊行为**：解析 `request.Metadata`（json.Unmarshal）合并到 `MiniMaxTTSRequest`，作为厂商自定义参数扩展点；并把 `outputFormat` 规范化为 `"hex"` 或 `"url"` 写入 context `response_format`（非 hex 一律视为 url）。
- **`ConvertImageRequest` 的 `aspect_ratio` 来源**（优先级）：
  1. `request.Extra["aspect_ratio"]`（直接字符串）
  2. `request.Size` 字符串映射（`1024x1024` → `1:1` 等 8 种预设）
  3. `request.Size` 解析为 `width x height` 后通过 `gcd` 约简，并校验结果在 8 个允许值内
- **`oaiImage2MiniMaxImageRequest` 默认值**：`Model` 空时回退 `"image-01"`；`N` 默认 1，`*request.N > 0` 时覆盖；`ResponseFormat` 经 `normalizeMiniMaxResponseFormat` 规范化（`""` / `"url"` → `"url"`，`"b64_json"` / `"base64"` → `"base64"`，其余原样透传）。
- **`miniMaxImageHandler` 错误判定**：`BaseResp.StatusCode != 0` 视为错误，返回 `types.OpenAIError{Type: "minimax_image_error", Code: "<status_code>"}` + 上游 status code。
- **`handleTTSResponse` 行为**：
  - `BaseResp.StatusCode != 0` → 错误
  - `Data.Audio == ""` → 错误
  - `Data.Audio` 以 `"http"` 开头 → `c.Redirect(http.StatusFound, audio)`（302 重定向到 MiniMax 音频 URL）
  - 否则视为 hex 编码 → `hex.DecodeString` 后 `c.Data(200, "audio/mpeg", audioData)`（注意 content type 固定 mp3，不根据 `output_format` 选择，`getContentTypeByFormat` 函数定义了映射表但未在主路径使用）
  - usage：`PromptTokens = info.GetEstimatePromptTokens()`，`TotalTokens = ExtraInfo.UsageCharacters`
- **`GetRequestURL`** 是独立公开函数（非 `Adaptor` 方法），便于测试直接调用；空 base url 时回退 `ChannelBaseURLs[ChannelTypeMiniMax]`。
- **`handleChatCompletionResponse`**（tts.go 中定义但未在 `DoResponse` 中调用）：保留作为兜底透传工具，未来 chat completions 路径如需直通而非转 OpenAI 格式可启用。
- ⚠️ **Rule 1 违规（已存在）**：`adaptor.go` / `adaptor_test.go` / `tts.go` 直接 `import "encoding/json"` 并调用 `json.Marshal` / `json.Unmarshal`。`image.go` 则**遵守 Rule 1**（用 `common.Marshal` / `common.Unmarshal`）。新增 JSON 操作必须走 `common.*`。
- **Rule 4（StreamOptions）**：`streamSupportedChannels[ChannelTypeMiniMax] = true`（见 `relay/common/relay_info.go:341`）。
- **测试**（`adaptor_test.go`）：覆盖 image generation 的 URL 路由、请求转换（aspect ratio / N / response_format）、响应处理（验证 `image_urls` 被转换为 OpenAI `url` 字段且不泄漏 MiniMax 原生字段）。使用 `httptest.NewRecorder` + 自定义 `nopReadCloser`。

### Testing Requirements

- `go build ./relay/channel/minimax/...` 必须通过
- `go test ./relay/channel/minimax/...` — 现有 3 个测试覆盖 image generation 路径
- `go test ./relay/channel/...`
- 手动验证：chat completions（OpenAI / Claude 两种 RelayFormat）、image generation（覆盖 8 种 size 预设 + 自定义 aspect_ratio + b64_json format）、TTS（hex 路径 + URL 重定向路径）

### Common Patterns

- "多端点单适配器"模式：一个 `Adaptor` 通过 `RelayMode` 路由到 3 个不同端点（chat / image / tts），每个端点有独立的请求与响应 DTO。
- aspect ratio 自动映射：OpenAI `size` 参数自动约简为 MiniMax `aspect_ratio`，同时允许客户端通过 `Extra` 字段直接指定。
- hex 音频处理：MiniMax TTS 返回 hex 编码的 PCM/MP3 数据，本适配器负责解码并设置 content-type。
- TTS metadata 扩展：`request.Metadata` 反序列化合并到请求结构体，是厂商自定义参数的扩展点（与 jimeng 的 `ExtraFields`、gemini 的 `extra_body` 类似机制）。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal`（仅 `image.go` 遵守 Rule 1）
- `github.com/QuantumNous/new-api/constant`（`channelconstant` alias）— `ChannelBaseURLs`、`ChannelTypeMiniMax`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`ImageRequest`、`ImageResponse`、`ImageData`、`AudioRequest`、`Usage`、`ClaudeRequest`、`GeminiChatRequest`、`EmbeddingRequest`、`RerankRequest`、`OpenAIResponsesRequest`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/claude` — 委托 `ConvertClaudeRequest` / `DoResponse`
- `github.com/QuantumNous/new-api/relay/channel/openai` — 委托 `DoResponse`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/constant` — `RelayModeChatCompletions` / `RelayModeImagesGenerations` / `RelayModeAudioSpeech`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`、`ShouldCopyUpstreamHeader`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewOpenAIError`、`NewError`、`NewErrorWithStatusCode`、`WithOpenAIError`、`OpenAIError`、`ErrorCode*`、`RelayFormatClaude`

### External

- `github.com/gin-gonic/gin`
- `github.com/samber/lo` — `FromPtrOr`
- `bytes`、`encoding/hex`、`encoding/json`（违规，见上）、`errors`、`fmt`、`io`、`net/http`、`net/http/httptest`（仅测试）、`strconv`、`strings`、`testing`（仅测试）

<!-- MANUAL: -->
