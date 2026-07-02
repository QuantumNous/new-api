<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/zhipu

## Purpose

智谱 AI（ChatGLM）**旧版 API**（v3 `model-api`）provider 适配器。这是智谱早期的请求/响应格式：

- 端点：`<base>/api/paas/v3/model-api/<model>/invoke`（非流式）或 `<base>/api/paas/v3/model-api/<model>/sse-invoke`（流式）。
- 请求体用 `prompt: [{role, content}]` 而非 OpenAI 的 `messages`，字段名 `top_p` 是 `float64`（非指针）。
- 响应体外层是 `{code, msg, success, data: {task_id, request_id, task_status, choices, usage}}`，需判断 `success` 字段而非 HTTP 状态码。
- 流式协议是自定义的 `data:` + `meta:` 双通道（meta 行携带最终 usage）。
- 鉴权用 **JWT（HS256）**：api key 形如 `<id>.<secret>`，用 secret 签发带 `api_key`/`exp`/`timestamp` claims 的 JWT，header 额外带 `sign_type: SIGN`。JWT 通过 `sync.Map` 全局缓存 24 小时。

仅支持 chat completions。`ConvertClaudeRequest` 含 `panic("implement me")`（不可调用）。其余端点返回 `not implemented`。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 实现 `Adaptor` 接口。`GetRequestURL` 按 `info.IsStream` 选 `sse-invoke` 或 `invoke`；`SetupRequestHeader` 调 `getZhipuToken(info.ApiKey)` 取 JWT 设入 `Authorization`；`ConvertOpenAIRequest` 对 `TopP >= 1` 做钳制（改为 0.99，因智谱要求 TopP < 1）后调 `requestOpenAI2Zhipu`；`DoResponse` 按流式/非流式分流到 `zhipuStreamHandler` / `zhipuHandler` |
| `constants.go` | 定义 `ModelList`（`chatglm_turbo`、`chatglm_pro`、`chatglm_std`、`chatglm_lite`）与 `ChannelName = "zhipu"` |
| `dto.go` | 定义旧版协议 DTO：`ZhipuMessage`（role/content）、`ZhipuRequest`（`Prompt []ZhipuMessage`、`Temperature *float64`、`TopP float64`、`Incremental bool`）、`ZhipuResponse`（含 `Code`/`Msg`/`Success`、`Data ZhipuResponseData`）、`ZhipuStreamMetaResponse`（流式 meta 行结构，含 `Usage`）、内部 `zhipuTokenData`（缓存 JWT 与过期时间）|
| `relay-zhipu.go` | (1) `getZhipuToken`：JWT 签发与缓存（`sync.Map`，24h 过期，用 `golang-jwt/jwt/v5` HS256）；(2) `requestOpenAI2Zhipu`：消息转换，把 `system` 消息拆成 `system`+`user:"Okay"` 对（与讯飞类似的 hack）；(3) `responseZhipu2OpenAI` / `streamResponseZhipu2OpenAI` / `streamMetaResponseZhipu2OpenAI`：响应转 OpenAI 格式；(4) `zhipuStreamHandler`：用 `helper.NewStreamScanner` 逐行读，按 `data:`/`meta:` 前缀分发到 `dataChan`/`metaChan`，用 `c.Stream` + select 循环写回；(5) `zhipuHandler`：非流式，读 body → 解 `ZhipuResponse` → 据 `Success` 判断 → 转 OpenAI 格式写回 |

## For AI Agents

### Working In This Directory

- **旧版 vs 新版**：本目录是智谱旧版 v3 API（`model-api`/`prompt` 字段）。新版 GLM-4V API 在 `relay/channel/zhipu_4v/`（v4 `paas/v4`/`messages` 字段，OpenAI 兼容）。两者共存，由 `ChannelType` 区分。新功能应优先在 `zhipu_4v` 实现。
- **JWT 全局缓存**：`zhipuTokens` 是 `sync.Map`，key 为完整 apikey 字符串，缓存 24 小时。多节点部署（Rule 11）下每个节点独立缓存，不影响正确性（JWT 无状态）。
- **TopP 钳制**：智谱旧版要求 `TopP < 1`，`ConvertOpenAIRequest` 对 `TopP >= 1` 强制改为 0.99。
- **system 消息 hack**：`requestOpenAI2Zhipu` 把 system 消息拆成 system+user:"Okay" 对——这是智谱旧版协议的 quirk，修改消息转换逻辑时不要丢失此行为。
- **流式 data:/meta: 双通道**：智谱流式响应中，增量文本走 `data:` 行，最终 usage 走 `meta:` 行。`zhipuStreamHandler` 用两个 channel 分别处理。
- **已知违规（勿扩散）**：`relay-zhipu.go` 大量直接用 `encoding/json` 的 `Marshal`/`Unmarshal`，违反 Rule 1。新增代码必须走 `common.*`。
- **`ConvertClaudeRequest` 含 `panic("implement me")`**：调用前确认上层不会路由到该路径。

### Testing Requirements
- `go build ./relay/channel/zhipu/...` 必须通过
- `go test ./relay/channel/...`
- 手动测试：流式（`stream:true`，验证 data:/meta: 双通道）与非流式。

### Common Patterns
- **JWT 签权 provider**：api key 形如 `id.secret` → HS256 JWT → 缓存复用。`sync.Map` 做进程级缓存（多节点各自缓存，无一致性问题）。
- **自定义 SSE 变体**：非标准 SSE（如 `data:`+`meta:` 双前缀）不能用 `helper.StreamScannerHandler` 统一处理，需用 `helper.NewStreamScanner` + 手工 `strings.HasPrefix` 分发。
- **错误用 `Success` 字段而非 HTTP 状态**：智谱旧版即使业务失败也返回 200，需在 handler 中判断 `response.Success`。

## Dependencies

### Internal
- `github.com/QuantumNous/new-api/common` — `GetTimestamp`、`SysLog`、`CustomEvent`
- `github.com/QuantumNous/new-api/constant` — `FinishReasonStop`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`Message`、`Usage`、`OpenAITextResponse`、`ChatCompletionsStreamResponse`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/common` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/helper` — `NewStreamScanner`、`SetEventStreamHeaders`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewOpenAIError`、`WithOpenAIError`、错误码
- `github.com/samber/lo` — `FromPtrOr`

### External
- `github.com/gin-gonic/gin` — HTTP 上下文（`c.Stream`、`c.Render`、`c.Writer`）
- `github.com/golang-jwt/jwt/v5` — HS256 JWT 签发
- `bufio`、`encoding/json`、`io`、`net/http`、`strings`、`sync`、`time` — 标准库

<!-- MANUAL: -->
