<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/jimeng

## Purpose

字节跳动「即梦」（火山引擎 CV）图像生成上游适配器，实现 `channel.Adaptor` 接口。核心场景是 `RelayModeImagesGenerations`：调用即梦 `/?Action=CVProcess&Version=2022-08-31` 端点（火山引擎 CV 服务），将 OpenAI ImageRequest 映射为 `imageRequestPayload`（`req_key` = 模型 ID，默认 `jimeng_high_aes_general_v21_L`）。

特色：
- **火山引擎 HMAC-SHA256 签名**（`sign.go`）：`Sign(c, req, apiKey)` 实现完整的火山引擎 V4 风格签名链路（canonical request → string to sign → 派生 signing key → `Authorization` 头）。`apiKey` 必须是 `<accessKey>|<secretKey>` 格式，否则报错。
- chat completions 路径**不走即梦自有逻辑**，而是委托 `openai.OaiStreamHandler` / `openai.OpenaiHandler`（与图像路径共存的兜底）。
- 即梦原生只支持图像生成，`SetupRequestHeader` 直接返回 `not implemented`（签名在 `DoRequest` 中通过 `Sign` 单独处理）。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `Adaptor` 结构体及 `Adaptor` 接口实现；含 `imageRequestPayload` 与 `LogoInfo` 类型定义、`ConvertImageRequest` 的 extra fields merge 逻辑 |
| `constants.go` | `ChannelName = "jimeng"`、`ModelList = ["jimeng_high_aes_general_v21_L"]` |
| `image.go` | 即梦响应 DTO `ImageResponse`、`responseJimeng2OpenAIImage` 映射、`jimengImageHandler`（响应处理，code != 10000 视为错误） |
| `sign.go` | 火山引擎 HMAC-SHA256 签名实现：`Sign(c, req, apiKey)`、`SetPayloadHash`、`hmacSHA256` 辅助；含 `HexPayloadHashKey` context key |

## For AI Agents

### Working In This Directory

- 已实现的 `Convert*` 方法：`ConvertOpenAIRequest`（透传 `*dto.GeneralOpenAIRequest`）、`ConvertImageRequest`（→ `imageRequestPayload`）。其余 Convert 方法返回 `errors.New("not implemented")`。
- **`DoRequest` 自定义实现**（不走 `channel.DoApiRequest`）：构造请求 → 调用 `Sign(c, req, info.ApiKey)` 注入签名头 → 调用 `channel.DoRequest(c, req, info)`。原因是签名需要读取并重写 body 与 headers。
- **`SetupRequestHeader` 故意返回 `not implemented`**：签名逻辑统一在 `DoRequest` 中通过 `Sign` 完成，调用方不应在 `DoRequest` 之前调用 `SetupRequestHeader`。
- `ConvertImageRequest` 关键字段：`ReqKey = request.Model`（即梦服务标识符），默认 `ReturnURL = true`（除非 `ResponseFormat != "" && != "url"`）；`request.ExtraFields` 通过 `json.Unmarshal` 合并到 payload（支持 seed / width / height / use_pre_llm / use_sr / logo_info / image_urls / binary_data_base64 等即梦原生字段透传）。
- **`DoResponse` 分发**：`RelayModeImagesGenerations` → `jimengImageHandler`；其余按 `info.IsStream` 委托 `openai.OaiStreamHandler` / `openai.OpenaiHandler`。
- `jimengImageHandler` 错误判定：`response.Code != 10000` 视为错误，返回 `types.OpenAIError{Type: "jimeng_error", Code: "<code>"}` + 上游 status code。
- ⚠️ **Rule 1 违规（已存在）**：`adaptor.go` / `image.go` / `sign.go` 均直接 `import "encoding/json"` 并调用 `json.Unmarshal` / `json.Marshal`。新增 JSON 操作必须走 `common.*`。
- **签名细节**（`sign.go`）：
  - `apiKey` 格式必须为 `<accessKey>|<secretKey>`，否则 `errors.New("invalid api key format for jimeng: expected 'ak|sk'")`。
  - region 固定 `"cn-north-1"`，serviceName 固定 `"cv"`。
  - 签名 headers：`host` / `x-date` / `x-content-sha256` / `content-type`，按字典序排序。
  - `X-Date` 格式 `20060102T150405Z`，`shortDate` 格式 `20060102`。
  - signing key 派生：`kDate = HMAC(secretKey, shortDate)` → `kRegion = HMAC(kDate, region)` → `kService = HMAC(kRegion, "cv")` → `kSigning = HMAC(kService, "request")`。
  - `Authorization` 头格式：`HMAC-SHA256 Credential=<ak>/<credentialScope>, SignedHeaders=<...>, Signature=<hex>`。
  - `SetPayloadHash(c, req)` 是预留的工具函数，先把任意 `req` 序列化为 JSON 再计算 SHA256，写入 gin context（当前 `Sign` 不读 context，而是自行读 body 计算）。
- **Rule 4（StreamOptions）**：即梦未注册到 `streamSupportedChannels`（不支持 stream_options）。
- 异步任务变体：火山引擎即梦也通过 `relay/channel/task/jimeng/` 的 `TaskAdaptor` 异步路径接入（与本目录同步适配器并存，由 `relay_adaptor.go` 按渠道类型分发）。

### Testing Requirements

- `go build ./relay/channel/jimeng/...` 必须通过
- `go test ./relay/channel/...`
- 手动验证：图像生成路径（含签名校验）、`ExtraFields` 透传、`Code != 10000` 错误分支

### Common Patterns

- "签名前置"模式：本目录是少数 `DoRequest` 不复用 `channel.DoApiRequest` 的适配器（blockrun、codex image 类似），因为签名需要读 body。
- 错误响应统一为 `types.WithOpenAIError(types.OpenAIError{Type: "<provider>_error", Code: "<code>"}, statusCode)`。
- `imageRequestPayload` 的 `ExtraFields` 合并模式允许客户端透传 provider 特有参数，类似 minimax / gemini 的扩展机制。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest`、`ImageRequest`、`ImageResponse`、`ImageData`、`GeminiChatRequest`、`ClaudeRequest`、`AudioRequest`、`EmbeddingRequest`、`RerankRequest`、`OpenAIResponsesRequest`
- `github.com/QuantumNous/new-api/logger` — `LogInfo`（仅 `SetPayloadHash`）
- `github.com/QuantumNous/new-api/relay/channel` — `DoRequest`（注意不是 `DoApiRequest`）、`SetupApiRequestHeader`
- `github.com/QuantumNous/new-api/relay/channel/openai` — 委托 `OaiStreamHandler` / `OpenaiHandler`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`
- `relayconstant "github.com/QuantumNous/new-api/relay/constant"` — `RelayModeImagesGenerations`
- `github.com/QuantumNous/new-api/service` — `CloseResponseBodyGracefully`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`NewOpenAIError`、`NewError`、`WithOpenAIError`、`OpenAIError`、`ErrorCode*`

### External

- `github.com/gin-gonic/gin`
- `bytes`、`crypto/hmac`、`crypto/sha256`、`encoding/hex`、`encoding/json`（违规，见上）、`errors`、`fmt`、`io`、`net/http`、`net/url`、`sort`、`strings`、`time`

<!-- MANUAL: -->
