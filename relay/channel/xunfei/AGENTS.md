<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/xunfei

## Purpose

讯飞星火（iFlytek SparkDesk）provider 适配器。**这是仓库中唯一不通过 HTTP 调用上游的适配器**——讯飞使用 **WebSocket** 协议（`wss://spark-api.xf-yun.com/<version>/chat`），鉴权通过 HMAC-SHA256 签名 URL 实现。`DoRequest` 返回一个空的 `http.Response{StatusCode: 200}` 占位（不实际发请求），真正的上游交互发生在 `DoResponse` → `xunfeiStreamHandler`/`xunfeiHandler` → `xunfeiMakeRequest`（WebSocket Dialer）链路中。

API key 格式为三段式 `appId|apiSecret|apiKey`，在 `DoResponse` 中拆分。模型版本通过模型名后缀（如 `SparkDesk-v3.5`）或 query 参数 `api-version` 决定 WebSocket 路径与 `domain` 参数。仅支持 chat completions（流式与非流式统一走 WebSocket，非流式只是把所有 chunk 聚合后再返回）。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 实现 `Adaptor` 接口。`Adaptor` 结构体持有 `request *dto.GeneralOpenAIRequest`（在 `ConvertOpenAIRequest` 中暂存，供 `DoResponse` 使用）；`GetRequestURL` 返回空字符串（不用）；`DoRequest` 返回占位 `http.Response`；`DoResponse` 拆 apikey 三段 → 据 `info.IsStream` 调 `xunfeiStreamHandler` 或 `xunfeiHandler` |
| `constants.go` | 定义 `ModelList`（`SparkDesk`、`SparkDesk-v1.1`、`SparkDesk-v2.1`、`SparkDesk-v3.1`、`SparkDesk-v3.5`、`SparkDesk-v4.0`）与 `ChannelName = "xunfei"` |
| `dto.go` | 定义讯飞协议 DTO：`XunfeiMessage`（role/content）、`XunfeiChatRequest`（嵌套 `header.app_id`、`parameter.chat.domain/temperature/top_k/max_tokens/auditing`、`payload.message.text[]`，其中 `temperature *float64` 为指针符合 Rule 5）、`XunfeiChatResponse`（含 `header.code/message/sid/status`、`payload.choices.status/seq/text[]`、`payload.usage.text dto.Usage`），`XunfeiChatResponseTextItem` 含 `Index` 字段 |
| `relay-xunfei.go` | (1) `requestOpenAI2Xunfei`：消息转换，对非 3.5 模型把 `system` 消息转成 `user`+`assistant:"Okay"` 对（讯飞部分版本不接受 system role）；从模型名解析版本→`apiVersion2domain`（v1.1→lite、v2.1→generalv2、v3.1→generalv3、v3.5→generalv3.5、v4.0→4.0Ultra）；(2) `buildXunfeiAuthUrl`：HMAC-SHA256 签名 URL（`host`/`date`/`request-line` → base64 authorization）；(3) `xunfeiStreamHandler`/`xunfeiHandler`：通过 `xunfeiMakeRequest` 建 WebSocket 连接、发请求、用 channel 接收响应、逐块或聚合后转 OpenAI 格式；(4) `getAPIVersion`：从 query 参数 `api-version` → 模型名后缀 → context `api_version` → 默认 `v1.1` |

## For AI Agents

### Working In This Directory

- **WebSocket 非 HTTP**：`DoRequest` 返回占位响应是刻意设计，不是 bug。真正的网络 I/O 在 `DoResponse` 阶段。修改时不能假设 `DoRequest` 的 `*http.Response` 携带真实上游数据。
- **三段式 apikey**：`info.ApiKey` 必须是 `appId|apiSecret|apiKey`（注意顺序与腾讯的 `appId|secretId|secretKey` 不同），`DoResponse` 用 `strings.Split(apiKey, "|")` 拆 3 段，长度不对返回 `ErrorCodeChannelInvalidKey`。
- **system 消息转换**：`requestOpenAI2Xunfei` 对**非 3.5** 模型会把 `system` 消息拆成 `user`+`assistant:"Okay"` 对（讯飞 lite/v2/v3/v4 不接受 system role，3.5 接受）。新增模型版本时注意此分支。
- **版本→domain 映射**：`apiVersion2domain` 是硬编码 switch，新增 SparkDesk 版本必须同步添加 case（如 `v5.0` → 对应 domain）。
- **状态码 2 = 结束**：`payload.choices.status == 2` 表示流式结束，`xunfeiMakeRequest` 的 goroutine 据此关闭连接。
- **非流式也走 WebSocket**：讯飞没有真正的"非流式" API，`xunfeiHandler` 只是内部聚合所有 chunk 后再一次性写回客户端。
- **鉴权签名**：`buildXunfeiAuthUrl` 硬编码 `GET <path> HTTP/1.1` 签名行，date 用 `time.RFC1123` UTC 格式。
- **已知违规（勿扩散）**：`relay-xunfei.go` 大量直接用 `encoding/json` 的 `Marshal`/`Unmarshal`，违反 Rule 1。新增代码必须走 `common.*`。
- **`ConvertClaudeRequest` 含 `panic("implement me")`**：调用前确认上层不会路由到该路径。

### Testing Requirements
- `go build ./relay/channel/xunfei/...` 必须通过
- `go test ./relay/channel/...`
- 手动测试：流式（`stream:true`）与非流式两条路径，各版本模型（v1.1/v3.5/v4.0）。

### Common Patterns
- **WebSocket provider 模式**：`DoRequest` 返回占位响应 → `DoResponse` 内建 WebSocket 连接 → 用 channel 桥接异步消息。参考此模式实现其他 WebSocket 类 provider。
- **状态码驱动结束**：上游协议用固定数字 status（如 2）标识流式结束，handler 据此关闭 channel。
- **goroutine + channel 桥接异步**：`xunfeiMakeRequest` 起 goroutine 读 WebSocket，通过 `dataChan`/`stopChan` 把数据回传到 handler 的 select 循环。

## Dependencies

### Internal
- `github.com/QuantumNous/new-api/common` — `GetTimestamp`、`SysLog`、`CustomEvent`
- `github.com/QuantumNous/new-api/constant` — `FinishReasonStop`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`Message`、`Usage`、`OpenAITextResponse`、`ChatCompletionsStreamResponse`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/common` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/helper` — `NewStreamScanner`、`SetEventStreamHeaders`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、错误码
- `github.com/samber/lo` — `FromPtrOr`

### External
- `github.com/gin-gonic/gin` — HTTP 上下文（`c.Stream`、`c.Render`、`c.Writer`）
- `github.com/gorilla/websocket` — WebSocket 客户端（`Dialer.Dial`、`Conn.ReadMessage`/`WriteJSON`）
- `crypto/hmac`、`crypto/sha256`、`encoding/base64`、`encoding/json`、`fmt`、`io`、`net/url`、`strings`、`time`、`errors` — 标准库

<!-- MANUAL: -->
