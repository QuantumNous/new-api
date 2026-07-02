<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/coze

## Purpose

Coze（字节跳动）上游适配器，实现 `channel.Adaptor` 接口。仅支持 chat completions（`/v3/chat`），将 OpenAI Chat Completions 请求映射为 Coze v3 的 `CozeChatRequest`（`bot_id` + `user_id` + `additional_messages`）。

Coze 的 chat 是异步的：非流式时，`DoRequest` 内部串联三步——发送创建消息请求 → 1 秒间隔轮询 `/v3/chat/retrieve` 直到 `status == "completed"` → 调用 `/v3/chat/message/list` 拉取明细；流式时直接透传上游 SSE 并按 `event:` / `data:` 行解析事件（`conversation.chat.completed`、`conversation.message.delta`、`error`）。

`bot_id` 从 gin context 的 `"bot_id"` key 读取（由上游中间件注入），不由本适配器从 `RelayInfo` 解析。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体及 `Adaptor` 接口实现；`DoRequest` 含非流式轮询+拉取明细的串联逻辑 |
| `constants.go` | 硬编码 `ModelList`（moonshot / baichuan / abab / glm / qwen / deepseek / Doubao 等 25 个），`ChannelName = "coze"` |
| `dto.go` | Coze 请求/响应 DTO：`CozeChatRequest`、`CozeChatResponse(Data)`、`CozeChatDetailResponse`、`CozeChatV3MessageDetail` 等，大量使用 `json.RawMessage` |
| `relay-coze.go` | 请求转换（`convertCozeChatRequest`）、非流式 `cozeChatHandler`、流式 `cozeChatStreamHandler` + `handleCozeEvent`、轮询 `checkIfChatComplete` + `getChatDetail` + `doRequest`（支持代理） |

## For AI Agents

### Working In This Directory

- 已实现的 `Convert*` 方法：仅 `ConvertOpenAIRequest`（→ `CozeChatRequest`）。其余 Convert 方法返回 `errors.New("not implemented")`。
- `convertCozeChatRequest` 只采纳 `role == "user"` 的消息并以 `ContentType: "text"` 透传（注释中标注 "TODO: support more content type"）。
- 非流式 `DoRequest` 阻塞轮询：失败状态（`failed` / `canceled` / `requires_action`）以 `fmt.Errorf` 返回；`resp == nil` 防御性判断避免 panic。
- 流式 `cozeChatStreamHandler` 不使用 `helper.StreamScannerHandler`，而是自行 `bufio.ScanLines` 扫描，按空行界定一个 SSE event 边界，分别累积 `event:` 与 `data:` 行后调用 `handleCozeEvent`。
- usage 来源：非流式来自轮询阶段写入 context 的 `coze_input_count` / `coze_output_count` / `coze_token_count`；流式来自 `conversation.chat.completed` 事件的 `CozeChatUsage`。若 `TotalTokens == 0`，回退到 `service.ResponseText2Usage` 估算。
- ⚠️ **Rule 1 违规（已存在）**：`adaptor.go` / `dto.go` / `relay-coze.go` 直接 `import "encoding/json"` 并调用 `json.Unmarshal` / `json.Marshal`，未走 `common.*` 包装。新增 JSON 操作必须使用 `common.Unmarshal` / `common.Marshal`；`json.RawMessage` 类型引用可保留。
- `doRequest` 内构造 `http.Client`：当 `info.ChannelSetting.Proxy != ""` 时调用 `service.NewProxyHttpClient(proxy)`，否则复用 `service.GetHttpClient()`。
- `ModelList` 中的字符串并非全部为 Coze 自有模型，部分（moonshot / baichuan / glm / qwen / deepseek / Doubao 等）是 Coze 平台可挂接的第三方 bot 代号。

### Testing Requirements

- `go build ./relay/channel/coze/...` 必须通过
- `go test ./relay/channel/...`
- 手动验证：流式（含 `conversation.message.delta`、`conversation.chat.completed`、`error` 三个事件分支）与非流式（创建 → 轮询 → 拉明细）路径

### Common Patterns

- 状态在 gin context 中传递：`c.Set("coze_conversation_id", ...)` / `c.Set("coze_chat_id", ...)` / `c.Set("coze_input_count", ...)` 等。
- `Adaptor` 结构体为空 struct，无 `Init` 副作用。
- 错误响应统一走 `types.NewError(err, types.ErrorCodeBadResponseBody)`。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `SysLog`、`GetTimestamp`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`TextResponse`、`Usage`、`ChatCompletionsStreamResponse`、`Message`
- `"github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`（本包内 alias 为 `common`，注意与全局 `common` 包区分）
- `github.com/QuantumNous/new-api/relay/channel` — `DoApiRequest`、`SetupApiRequestHeader`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/helper` — `NewStreamScanner`、`SetEventStreamHeaders`、`GenerateStopResponse`、`ObjectData`、`Done`、`GetResponseID`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`、`ResponseText2Usage`、`GetHttpClient`、`NewProxyHttpClient`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewError`、`ErrorCodeBadResponseBody`

### External

- `github.com/gin-gonic/gin`
- `github.com/samber/lo` — `FromPtrOr`
- `bufio`、`encoding/json`（违规，见上）、`errors`、`fmt`、`io`、`net/http`、`strings`、`time`

<!-- MANUAL: -->
