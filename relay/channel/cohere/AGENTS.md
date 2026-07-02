<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/cohere

## Purpose

Cohere 上游适配器，实现 `channel.Adaptor` 接口。支持两类 RelayMode：
- `RelayModeRerank`：调用上游 `/v1/rerank`，将 OpenAI rerank 请求转换为 Cohere rerank 格式并回写。
- 默认（chat）：调用上游 `/v1/chat`，将 OpenAI Chat Completions 请求转换为 Cohere Chat 格式（`CohereRequest`：`chat_history` + `message` + `safety_mode`），流式与非流式分别由 `cohereStreamHandler` 与 `cohereHandler` 处理。

不实现 Claude / Gemini / Embedding / Audio / Image / OpenAIResponses 转换（均返回 `not implemented`）。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体及 `Adaptor` 接口方法实现；按 `RelayMode` 分发 URL 与响应处理 |
| `constant.go` | 硬编码 `ModelList`（command / aya / rerank 系列）与 `ChannelName = "cohere"` |
| `dto.go` | Cohere 请求/响应 DTO：`CohereRequest`、`CohereRerankRequest`、`CohereResponseResult`、`CohereRerankResponseResult`、`CohereMeta` / `CohereBilledUnits` |
| `relay-cohere.go` | 请求转换（`requestOpenAI2Cohere` / `requestConvertRerank2Cohere`）、stop reason 映射、流式 / 非流式 / rerank 三个响应处理器 |

## For AI Agents

### Working In This Directory

- 已实现的 `Convert*` 方法：`ConvertOpenAIRequest`（→ `CohereRequest`）、`ConvertRerankRequest`（→ `CohereRerankRequest`）。其余 Convert 方法（Claude / Gemini / Embedding / Audio / Image / Responses）返回 `errors.New("not implemented")`；`ConvertClaudeRequest` 当前会 `panic("implement me")`，调用方需避免触发。
- `DoResponse` 按 `info.RelayMode` 与 `info.IsStream` 三路分发：rerank → `cohereRerankHandler`；流式 chat → `cohereStreamHandler`；非流式 chat → `cohereHandler`。
- 安全模式：`requestOpenAI2Cohere` 读取全局 `common.CohereSafetySetting`，非 `"NONE"` 时写入 `safety_mode`。
- ⚠️ **Rule 1 违规（已存在）**：`relay-cohere.go` 直接 `import "encoding/json"` 并调用 `json.Unmarshal` / `json.Marshal`，未走 `common.Unmarshal` / `common.Marshal`。修改本目录代码时不应扩大此违规，新增 JSON 调用必须使用 `common.*`。
- MaxTokens 默认值：`requestOpenAI2Cohere` 在请求未指定时回退 `4000`。
- rerank 默认 `TopN=1`（`requestConvertRerank2Cohere`），并强制 `ReturnDocuments=true`。
- 流式响应以 `\n` 分隔逐行解析（自定义 `Split`），每个 JSON 对象按 `IsFinished` 区分增量 / 终态；终态时从 `response.Meta.BilledUnits` 提取 usage，若 `PromptTokens==0` 则用 `service.ResponseText2Usage` 估算。

### Testing Requirements

- `go build ./relay/channel/cohere/...` 必须通过
- `go test ./relay/channel/...`
- 手动验证 chat 流式 / 非流式、rerank 三条路径

### Common Patterns

- `Adaptor` 结构体为空 struct（无状态），所有状态从 `relaycommon.RelayInfo` 传入。
- `DoRequest` 直接复用 `channel.DoApiRequest(a, c, info, requestBody)`。
- `SetupRequestHeader` 调用 `channel.SetupApiRequestHeader` 后注入 `Authorization: Bearer <key>`。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `SysLog`、`GetTimestamp`、`CustomEvent`、`CohereSafetySetting`
- `github.com/QuantumNous/new-api/dto` — OpenAI 请求/响应、`RerankRequest` / `RerankResponseResult`、`Usage`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/constant` — `RelayModeRerank`
- `github.com/QuantumNous/new-api/relay/helper` — `NewStreamScanner`、`SetEventStreamHeaders`、`GetResponseID`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`、`ResponseText2Usage`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewError`、`ErrorCodeBadResponseBody`

### External

- `github.com/gin-gonic/gin`
- `github.com/samber/lo` — `FromPtrOr`
- `net/http`、`io`、`strings`、`time`、`errors`、`fmt`
- `encoding/json`（已存在，违反 Rule 1，参见上文）

<!-- MANUAL: -->
