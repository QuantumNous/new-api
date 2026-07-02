<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/tencent

## Purpose

腾讯混元（Tencent Hunyuan）provider 适配器。腾讯混元 API 使用自定义协议（PascalCase 字段、`Messages` 而非 `messages`、上下文限 40 条），并通过 **TC3-HMAC-SHA256** 签名鉴权（与腾讯云 API 体系一致）。本适配器负责 OpenAI ↔ Tencent 双向转换，并在 `ConvertOpenAIRequest` 中即时计算签名（存入 `a.Sign`），`SetupRequestHeader` 把签名写入 `Authorization` 头并附带 `X-TC-Action` / `X-TC-Version` / `X-TC-Timestamp`。仅支持 chat completions（流式 SSE 与非流式），其余端点未实现。鉴权凭据通过 `appId|secretId|secretKey` 三段式从 channel key 中解析。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 实现 `Adaptor` 接口。`Adaptor` 结构体持有 `Sign`、`AppID`、`Action`（="ChatCompletions"）、`Version`（="2023-09-01"）、`Timestamp`；`Init` 填充 Action/Version/Timestamp；`GetRequestURL` 返回 `<base>/`（POST 根路径）；`ConvertOpenAIRequest` 解析三段式 apikey → 调 `requestOpenAI2Tencent` → 调 `getTencentSign` 计算签名；`DoResponse` 按流式/非流式分流到 `tencentStreamHandler` / `tencentHandler` |
| `constants.go` | 定义 `ModelList`（`hunyuan-lite`、`hunyuan-standard`、`hunyuan-standard-256K`、`hunyuan-pro`）与 `ChannelName = "tencent"` |
| `dto.go` | 定义腾讯协议 DTO：`TencentChatRequest`（PascalCase、`Model *string` 指针、`TopP *float64` 指针、`Stream *bool` 指针，符合 Rule 5 指针语义）、`TencentChatResponse`（含 `Error.Code/Message`、`Usage`）、`TencentChatResponseSB`（外层 `{Response: {...}}` 包装）|
| `relay-tencent.go` | (1) `requestOpenAI2Tencent` / `responseTencent2OpenAI` / `streamResponseTencent2OpenAI` 双向转换；(2) `tencentStreamHandler` 用 `helper.NewStreamScanner` + `bufio.ScanLines` 读 SSE，逐条 `data:` 解析后转 OpenAI 流式块并聚合 usage；(3) `tencentHandler` 解析 `TencentChatResponseSB`，错误时通过 `types.WithOpenAIError` 上报；(4) `parseTencentConfig` 拆 `appid|secretId|secretKey`；(5) `getTencentSign` 实现 TC3-HMAC-SHA256 规范签名（canonical request → string to sign → HMAC-SHA256 派生签名密钥） |

## For AI Agents

### Working In This Directory

- **签名在 Convert 阶段计算**：`ConvertOpenAIRequest` 会先序列化 request body 再计算签名，意味着 request body 在签名后**不能再被改动**（否则上游返回签名失败）。`DoRequest`/`SetupRequestHeader` 必须原样使用 `ConvertOpenAIRequest` 返回的 body。
- **三段式 Key 解析**：`parseTencentConfig` 要求 channel key 形如 `appId|secretId|secretKey`（用 `|` 分隔），三段缺一不可。
- **签名实现细节**：`getTencentSign` 硬编码 `host = "hunyuan.tencentcloudapi.com"`、`service = "hunyuan"`、`content-type: application/json`；payload 由 `json.Marshal(req)` 计算 SHA256。
- **流式 SSE 协议**：腾讯返回的每行以 `data:` 前缀开头（无空格），handler 手工 `strings.TrimPrefix(data, "data:")` 而不是用 `helper.StreamScannerHandler`，注意与 OpenAI SSE 解析模式不同。
- **已知违规（勿扩散）**：`relay-tencent.go` 的 `getTencentSign`、`tencentHandler` 直接使用 `encoding/json` 的 `Marshal`/`Unmarshal`，违反 Rule 1。修改时新增代码必须走 `common.*`，但本次仅生成文档不做修复。
- `ConvertClaudeRequest` 含 `panic("implement me")` —— 调用前必须确认上层不会路由到该路径。

### Testing Requirements
- `go build ./relay/channel/tencent/...` 必须通过
- `go test ./relay/channel/...`

### Common Patterns
- Provider 私有协议：DTO 用 PascalCase + 指针字段（Rule 5），handler 内做 `Xxx2OpenAI` / `OpenAI2Xxx` 双向转换。
- 签名型 provider：`Adaptor` 持有 `Sign` 字段，`ConvertOpenAIRequest` 末尾调 `getXxxSign` 填充，`SetupRequestHeader` 读取后写入 `Authorization`。
- 非标准 SSE：某些 provider 的 `data:` 行无空格分隔，需手工 `strings.TrimPrefix`。

## Dependencies

### Internal
- `github.com/QuantumNous/new-api/common` — `GetTimestamp`、`Marshal`/`Unmarshal`、`GetContextKeyString`、`SysLog`
- `github.com/QuantumNous/new-api/constant` — `ContextKeyChannelKey`、`FinishReasonStop`
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`Message`、`OpenAITextResponse`、`ChatCompletionsStreamResponse`、`Usage`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/common` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/helper` — `NewStreamScanner`、`SetEventStreamHeaders`、`ObjectData`、`Done`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`、`IOCopyBytesGracefully`、`ResponseText2Usage`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewOpenAIError`、`WithOpenAIError`、错误码

### External
- `github.com/gin-gonic/gin` — HTTP 上下文
- `bufio`、`crypto/hmac`、`crypto/sha256`、`encoding/hex`、`encoding/json`、`io`、`net/http`、`strconv`、`strings`、`time`、`fmt`、`errors` — 标准库

<!-- MANUAL: -->
