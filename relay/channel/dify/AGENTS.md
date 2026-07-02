<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/dify

## Purpose

Dify 平台上游适配器，实现 `channel.Adaptor` 接口。仅支持 chat completions，将 OpenAI Chat Completions 请求转换为 Dify 的 `/v1/chat-messages`（默认 chatflow）/ `/v1/workflows/run` / `/v1/completion-messages` 三种端点之一。

Dify 与 OpenAI 模型语义差异较大：
- 多轮对话被压扁为单一 `query` 字符串（`USER: ... ASSISTANT: ... SYSTEM: ...`），而非结构化 `messages`。
- 图片支持：`requestOpenAI2Dify` 通过 `uploadDifyFile` 把 base64 解码后 multipart 上传到 `/v1/files/upload` 换取 `upload_file_id`；远程图片则直接构造 `DifyFile{TransferMode: "remote_url"}`。
- 流式响应以 SSE event 类型区分：`message` / `agent_message` / `workflow_*` / `node_*` / `message_end` / `error`。思维链通过 HTML `<details>` 标签检测并改写为 `<think>` / `</think>`。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体（持 `BotType` 字段）及 `Adaptor` 接口实现；定义 4 个 BotType 常量（ChatFlow / Agent / WorkFlow / Completion） |
| `constants.go` | `ModelList`（声明为空切片，由前端 / 渠道配置注入实际模型）、`ChannelName = "dify"` |
| `dto.go` | Dify 请求/响应 DTO：`DifyChatRequest`、`DifyFile`、`DifyMetaData`、`DifyData`、`DifyChatCompletionResponse`、`DifyChunkChatCompletionResponse` |
| `relay-dify.go` | 文件上传 `uploadDifyFile`、请求转换 `requestOpenAI2Dify`、流式响应映射 `streamResponseDify2OpenAI`、流式 / 非流式 handler |

## For AI Agents

### Working In This Directory

- 已实现的 `Convert*` 方法：仅 `ConvertOpenAIRequest`（→ `DifyChatRequest`）。其余 Convert 方法返回 `errors.New("not implemented")` 或 `nil, nil`（rerank）。
- `Init` 当前**硬编码** `a.BotType = BotTypeChatFlow`（其他 BotType 分支被注释掉），所以默认走 `/v1/chat-messages`。
- `GetRequestURL` 按 `BotType` 分流：WorkFlow → `/v1/workflows/run`，Completion → `/v1/completion-messages`，Agent / 默认 → `/v1/chat-messages`。
- `DoResponse` 按 `info.IsStream` 分流：流式 `difyStreamHandler` / 非流式 `difyHandler`。
- `uploadDifyFile`（relay-dify.go）流程：base64 解码 → 写临时文件 → multipart `POST /v1/files/upload` → 解析返回的 `id` → 构造 `DifyFile{UploadFileId, Type:"image", TransferMode:"local_file"}`。失败时 `common.SysLog` 记录并返回 `nil`（不阻断主请求）。
- 修复痕迹（注释 #2083）：远程图片分支此前未初始化 `file`，导致后续 `file.Type = ...` nil panic；现已修复为直接构造 `&DifyFile{...}`。
- 思维链映射：`streamResponseDify2OpenAI` 检测 Dify 返回的 `<details style="color:gray;..." open> <summary> Thinking... </summary>\n` 起始串改写为 `<think>`，`</details>` 改写为 `</think>`。
- workflow / node 事件仅在 `constant.DifyDebug` 开启时输出为 `Delta.SetReasoningContent`（调试用）。
- ⚠️ **Rule 1 违规（已存在）**：`relay-dify.go` 直接 `import "encoding/json"` 并调用 `json.NewDecoder().Decode` / `json.Unmarshal` / `json.Marshal` / `json.RawMessage`。新增 JSON 操作必须走 `common.*`；`json.RawMessage` 类型引用可保留。
- `DifyChatRequest.User`：当 OpenAI 请求 `request.User` 为空时，回退到 `helper.GetResponseID(c)` 作为字符串 user。
- `ResponseMode`：根据 `request.Stream` 设置 `"streaming"` / `"blocking"`。

### Testing Requirements

- `go build ./relay/channel/dify/...` 必须通过
- `go test ./relay/channel/...`
- 手动验证：流式（覆盖 `message` / `agent_message` / `message_end` / `error` 事件）、非流式、base64 图片上传、远程图片路径

### Common Patterns

- 多轮消息压扁为单字符串 `query`，非结构化 messages。
- BotType 通过 model name 前缀路由的逻辑已被注释，未来如需恢复需在 `Init` 中重新启用。
- 流式 handler 用 `helper.StreamScannerHandler`（与 cohere 自定义 Split 不同），通过 `sr.Done()` / `sr.Error(err)` / `sr.Stop(err)` 控制。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `SysLog`、`GetTimestamp`
- `github.com/QuantumNous/new-api/constant` — `DifyDebug`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`Usage`、`OpenAITextResponse`、`ChatCompletionsStreamResponse`、`Message`、`ContentTypeText` / `ContentTypeImageURL`、`MediaContent`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/helper` — `StreamScannerHandler`、`ObjectData`、`Done`、`SetEventStreamHeaders`、`GetResponseID`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`、`ResponseText2Usage`、`GetHttpClient`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewError`、`ErrorCodeBadResponseBody`

### External

- `github.com/gin-gonic/gin`
- `github.com/samber/lo` — `FromPtrOr`
- `bytes`、`encoding/base64`、`encoding/json`（违规，见上）、`fmt`、`io`、`mime/multipart`、`net/http`、`os`、`strings`

<!-- MANUAL: -->
