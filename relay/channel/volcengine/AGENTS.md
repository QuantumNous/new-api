<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/volcengine

## Purpose

火山引擎（字节跳动，豆包/Doubao）provider 适配器。这是仓库中功能最全的国产模型适配器之一，覆盖：

- **Chat Completions**（`/api/v3/chat/completions`）及 bot 专用的 `/api/v3/bots/chat/completions`
- **Claude 格式**（`RelayFormatClaude`，走 `/v1/messages` 或 `/api/v3/chat/completions`）
- **Embeddings**（`/api/v3/embeddings`）
- **Image Generations / Edits**（`/api/v3/images/generations`，豆包生图/图生图统一走 generations 接口）
- **Rerank**（`/api/v3/rerank`）
- **Responses**（`/api/v3/responses`）
- **TTS / Audio Speech**：默认 base URL 下走火山 **WebSocket 二进制协议**（`wss://openspeech.bytedance.com/api/v1/tts/ws_binary`），自定义 base URL 下走 HTTP `/v1/audio/speech`。

支持 `ChannelSpecialBases`（`channelconstant.ChannelSpecialBases`）做多 URL 方案分派（Claude/OpenAI 各自的 base URL 覆盖）。Claude 格式的响应处理在 `ChannelSpecialBases` 命中时委托 `claude.Adaptor{}`，其余一律委托 `openai.Adaptor{}`。TTS 路径实现了一套完整的火山二进制帧编解码（`protocols.go`）和 OpenAI `audio/speech` 兼容映射（`tts.go`）。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 实现 `Adaptor` 接口。`GetRequestURL` 按 `RelayFormat`（Claude vs 默认）× `RelayMode`（chat/embeddings/images/rerank/responses/audio_speech）× 是否 `ChannelSpecialBases` 命中 × 是否 `bot` 模型前缀，分派到不同端点（含 WebSocket URL）；`ConvertAudioRequest` 把 OpenAI `AudioRequest` 映射为 `VolcengineTTSRequest`，支持从 `request.Metadata` 覆盖字段；`ConvertImageRequest` 剥离 `Stream`/`PartialImages` 后透传；`ConvertOpenAIRequest` 处理 deepseek 系模型的 `-thinking` 后缀（注入 `THINKING={"type":"enabled"}`）；`ConvertClaudeRequest` 按 `ChannelSpecialBases` 命中与否委托 claude 或 openai；`DoRequest` 对 TTS 默认 base URL 流式返回 `nil`（由 `DoResponse` 直接连 WebSocket）；`DoResponse` 按 RelayFormat（Claude）→ RelayMode（AudioSpeech）→ 默认（openai）分派 |
| `constants.go` | 定义 `ModelList`（Doubao-pro/lite 各版本、Doubao-embedding、`doubao-seedream-4-0-250828`、`doubao-seedance-1-0-pro-250528`、`doubao-seed-1-6-thinking-250715` 等）与 `ChannelName = "volcengine"` |
| `protocols.go` | 火山 WebSocket TTS 二进制协议实现。定义 `MsgType`（FullClientRequest / AudioOnlyServer / Error 等）、`EventType`（StartConnection / TTSSentenceStart / TTSResponse / TTSEnded 等枚举及 String 方法）、`Message` 结构体（含 Version/HeaderSize/Serialization/Compression/SessionID/ConnectID/Sequence/ErrorCode/Payload）。`Marshal`/`Unmarshal` 实现大端序二进制帧的编解码（4 字节 header + 可选 event/session/sequence/payload）。`ReceiveMessage`/`FullClientRequest` 是 WebSocket 收发便捷函数 |
| `tts.go` | TTS 请求/响应 DTO 与 handler。`VolcengineTTSRequest`（App/User/Audio/Request 四段）、`VolcengineTTSResponse`（带 base64 编码的 `Data` 字段、`Code=3000` 表示成功）。`openAIToVolcengineVoiceMap` 把 OpenAI 的 `alloy`/`echo`/`fable`/`onyx`/`nova`/`shimmer` 映射到火山的中文音色 ID。`responseFormatToEncodingMap` 把 `mp3`/`opus`/`aac`/`flac`/`wav`/`pcm` 映射到火山编码格式。`handleTTSResponse`（HTTP 模式：解码 base64 → 写回二进制音频）与 `handleTTSWebSocketResponse`（WebSocket 模式：建连 → 发 FullClientRequest → 循环接收 AudioOnlyServer 帧 → 流式写回客户端，负 Sequence 表示结束）|

## For AI Agents

### Working In This Directory

- **三段式鉴权（仅 TTS）**：`SetupRequestHeader` 对 `RelayModeAudioSpeech` 拆 `info.ApiKey` 为 `appid|token` 两段，设置 `Authorization: Bearer;<token>`（注意分号不是空格）。`ConvertAudioRequest` 也调 `parseVolcengineAuth` 做同样拆分填入 `VolcengineTTSApp.AppID/Token`。
- **WebSocket vs HTTP**：TTS 路径的 `GetRequestURL` 在 `baseUrl == ChannelBaseURLs[ChannelTypeVolcEngine]`（即默认火山 base）时返回 `wss://...` 并在 `DoRequest` 提前返回（流式跳过 HTTP 请求）；否则返回 `<base>/v1/audio/speech` 走 HTTP。`DoResponse` 据 `info.IsStream`（由 `ConvertAudioRequest` 在 `Operation=="submit"` 时设为 true）选择 WebSocket 路径。
- **Image 编辑被合并到 generations**：代码注释明确"豆包的图生图也走 generations 接口"（官方文档无 edits 表单端点），`RelayModeImagesEdits` 也走 `/api/v3/images/generations`，且 `ConvertImageRequest` 会清掉 `Stream`/`PartialImages`（恢复 pre-Stream 字段行为）。
- **ChannelSpecialBases 多方案**：当 `info.ChannelBaseUrl` 命中 `channelconstant.ChannelSpecialBases` 时，Claude 格式走 `specialPlan.ClaudeBaseURL + /v1/messages`，OpenAI 格式走 `specialPlan.OpenAIBaseURL + /chat/completions` 等。这是为代理商/白标做的 URL 覆写机制。
- **Bot 模型前缀**：`strings.HasPrefix(info.UpstreamModelName, "bot")` 时 chat completions 走 `/api/v3/bots/chat/completions`。
- **DeepSeek thinking 后缀**：`ConvertOpenAIRequest` 对 deepseek 系模型的 `-thinking` 后缀剥离并注入 `{"type":"enabled"}` 到 `request.THINKING`，**仅在 `!ShouldPreserveThinkingSuffix` 时生效**。
- **Claude 响应委托的特殊条件**：仅当 `ChannelSpecialBases` 命中时 `DoResponse` 才委托 `claude.Adaptor`，否则走 openai 路径。
- **已知违规（勿扩散）**：`adaptor.go` 与 `tts.go` 多处直接用 `encoding/json`，违反 Rule 1。新增代码必须走 `common.*`。
- **protocols.go 是纯二进制协议库**：不涉及 gin/dto/types，可独立单测（当前无 `_test.go`）。

### Testing Requirements
- `go build ./relay/channel/volcengine/...` 必须通过
- `go test ./relay/channel/...`
- 手动测试矩阵：TTS（WebSocket 默认 base + HTTP 自定义 base）、images generations/edits、Claude 格式 vs OpenAI 格式、ChannelSpecialBases 命中 vs 未命中、bot 前缀模型、deepseek-thinking。

### Common Patterns
- **RelayFormat + RelayMode 双维度分派**：`GetRequestURL` 和 `DoResponse` 都先判 `RelayFormat`（Claude 优先）再判 `RelayMode`，这是支持 Anthropic 兼容入口的标准模式。
- **ChannelSpecialBases 覆写**：通过 `channelconstant.ChannelSpecialBases[baseUrl]` 查找 specialPlan，命中则用其 `ClaudeBaseURL`/`OpenAIBaseURL` 替换端点路径。新增白标/代理商渠道时在 `constant/` 注册。
- **二进制协议独立文件**：把 WebSocket 帧编解码放 `protocols.go`，业务映射放 `tts.go`，保持关注点分离。
- **OpenAI 兼容字段映射表**：voice/response_format 用 map 做枚举映射（`openAIToVolcengineVoiceMap`、`responseFormatToEncodingMap`），未命中时透传原值。

## Dependencies

### Internal
- `github.com/QuantumNous/new-api/constant`（`channelconstant`）— `ChannelTypeVolcEngine`、`ChannelBaseURLs`、`ChannelSpecialBases`、`ChannelSpecialPlan`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`AudioRequest`、`ImageRequest`、`ClaudeRequest`、`EmbeddingRequest`、`RerankRequest`、`OpenAIResponsesRequest`、`Usage`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/claude` — `Adaptor`（Claude 格式响应处理）
- `github.com/QuantumNous/new-api/relay/channel/openai` — `Adaptor`（默认响应处理）
- `github.com/QuantumNous/new-api/relay/common` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/constant` — 各 `RelayMode*`
- `github.com/QuantumNous/new-api/setting/model_setting` — `ShouldPreserveThinkingSuffix`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewErrorWithStatusCode`、`RelayFormat`、错误码

### External
- `github.com/gin-gonic/gin` — HTTP 上下文
- `github.com/samber/lo` — `FromPtrOr`
- `github.com/google/uuid` — TTS ReqID 生成
- `github.com/gorilla/websocket` — WebSocket 客户端
- `bytes`、`context`、`encoding/base64`、`encoding/binary`、`encoding/json`、`fmt`、`io`、`math`、`net/http`、`path/filepath`、`strings`、`errors` — 标准库

<!-- MANUAL: -->
