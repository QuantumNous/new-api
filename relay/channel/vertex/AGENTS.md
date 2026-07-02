<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/vertex

## Purpose

Google Vertex AI provider 适配器。这是仓库中**最复杂**的 provider 之一：同一个 channel 同时承载三类上游模型，通过 `RequestMode` 在 `Init` 中按模型名前缀分派：

- `RequestModeClaude`（模型前缀 `claude`）→ 走 Anthropic on Vertex 的 `rawPredict` / `streamRawPredict` 端点，请求体为 `VertexAIClaudeRequest`（带 `anthropic_version`），响应处理委托 `claude.Adaptor{}`。
- `RequestModeGemini`（默认）→ 走 Google publisher 的 `generateContent` / `streamGenerateContent?alt=sse` / `predict`（imagen）端点，响应处理委托 `gemini.GeminiChat*Handler` / `GeminiTextGeneration*Handler` / `GeminiImageHandler`。
- `RequestModeOpenSource`（模型名含 `llama` 或 `-maas`）→ 走 OpenAPI chat completions（`v1beta1`），响应处理委托 `openai.OaiStreamHandler` / `OpenaiHandler`。

鉴权有两种模式：(1) **Service Account JWT**（默认）—— 用 GCP service account 的 private key 签发 JWT，与 `https://www.googleapis.com/oauth2/v4/token` 换 access token，token 通过 `asynccache` 缓存 30 分钟；(2) **API Key**（`VertexKeyTypeAPIKey`）—— 直接把 `info.ApiKey` 作为 `?key=` 或 `&key=` 追加到 URL，跳过 OAuth。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 实现 `Adaptor` 接口。定义三种 RequestMode 常量、`claudeModelMap`（OpenAI 模型名 → Vertex 模型名映射，如 `claude-sonnet-4-20250514` → `claude-sonnet-4@20250514`）、`anthropicVersion`。`Init` 按模型名分派 RequestMode；`GetRequestURL` 按模式 + 流式/非流式/imagen 选择 suffix，处理 `-thinking-<budget>` / `-thinking` / `-nothinking` 后缀剥离（配合 `model_setting.GetGeminiSettings().ThinkingAdapterEnabled`），最终委托 `getRequestUrl` 拼 URL；`SetupRequestHeader` 按鉴权模式设置 `Authorization: Bearer <accessToken>` 或跳过，对 claude 模型追加 `claude.CommonClaudeHeadersOperation`；`ConvertOpenAIRequest` 按 RequestMode 分派到 imagen/image / claude / gemini / opensource 四条转换路径；`ConvertClaudeRequest`/`ConvertGeminiRequest`/`ConvertImageRequest` 各自委托或转换；`DoResponse` 按 IsStream × RequestMode × RelayMode 分派到对应的 claude/gemini/openai handler |
| `constants.go` | 定义 `ModelList`（实际注释掉了 claude/gemini 条目，仅保留 `meta/llama3-405b-instruct-maas`）与 `ChannelName = "vertex-ai"`。运行时 `GetModelList` 会动态合并 vertex + `claude.ModelList` + `gemini.ModelList` 三列表 |
| `dto.go` | 定义 `VertexAIClaudeRequest`（Anthropic on Vertex 请求体，含 `AnthropicVersion`、`OutputConfig json.RawMessage`，所有可选字段用指针 + `omitempty` 符合 Rule 5）与 `copyRequest`（从 `dto.ClaudeRequest` 拷贝字段，注入 `anthropic_version`）|
| `url_builder.go` | URL 拼装工具。`BuildAPIBaseURL` 处理自定义 base URL / region（默认 `global`）/ projectID 的三种组合；`BuildPublisherModelURL` 拼 `publishers/{publisher}/models/{model}:{action}`；`BuildGoogleModelURL` / `BuildAnthropicModelURL` 是 publisher=google/anthropic 的快捷封装；`BuildOpenSourceChatCompletionsURL` 拼 `{base}/endpoints/openapi/chat/completions`（用 `OpenSourceAPIVersion = "v1beta1"`） |
| `service_account.go` | GCP service account 鉴权。`Credentials` 结构体（ProjectID / PrivateKeyID / PrivateKey / ClientEmail / ClientID）；`Cache`（`asynccache`，30 分钟过期、35 分钟刷新）；`getAccessToken` 按 channelId（多 key 时加 keyIndex）缓存 token；`createSignedJWT` 解析 PKCS8 PEM 私钥、构造 RS256 JWT（scope=`cloud-platform`、exp=35min）；`exchangeJwtForAccessToken` POST 到 Google OAuth 端点换 token；`AcquireAccessToken` / `exchangeJwtForAccessTokenWithProxy` 是带 proxy 参数的独立版本（供外部包使用） |
| `relay-vertex.go` | 仅含 `GetModelRegion(other, localModelName)`：解析 channel 的 region 配置（支持 JSON 字符串 `{model: region}` 或 `"default"` 兜底，最终回退 `"global"`） |

## For AI Agents

### Working In This Directory

- **三模式分派是核心**：任何改动都必须先确认影响哪个 RequestMode。`Init` 用 `strings.HasPrefix(info.UpstreamModelName, "claude")` 判 claude，`strings.Contains(..., "llama") || strings.Contains(..., "-maas")` 判开源模型，其余归 Gemini。
- **模型名映射**：`claudeModelMap` 把 OpenAI 风格的 claude 模型名映射到 Vertex 风格（`@` 分隔版本）。`ConvertClaudeRequest` 和 `GetRequestURL`(claude 模式) 都会查这张表。新增 claude 版本时**必须同时更新此 map**，否则上游会 404。
- **Thinking 后缀剥离**（仅 Gemini 模式）：当 `ThinkingAdapterEnabled` 且模型不在 `ShouldPreserveThinkingSuffix` 名单时，`GetRequestURL` 会剥离 `-thinking-<budget>` / `-thinking` / `-nothinking` / reasoning effort 后缀。修改 reasoning 后缀逻辑需同步 `setting/reasoning`。
- **FunctionResponse ID 剥离**：`ConvertGeminiRequest` 在 `RemoveFunctionResponseIdEnabled` 开启时调 `removeFunctionResponseID`，递归清除 `FunctionResponse.ID`（Vertex 不支持该字段）。
- **Token 缓存 key**：`getAccessToken` 的 cacheKey 为 `access-token-{channelId}` 或 `access-token-{channelId}-{keyIndex}`（多 key 渠道），**不会按凭据内容区分**——如果渠道的 service account JSON 被更换，旧 token 仍可能命中缓存直到 30 分钟过期。
- **Imagen 路径**：`ConvertOpenAIRequest` 在 Gemini 模式下若模型以 `imagen` 开头，会从 `request.Messages` 抽取首个 user 消息作为 prompt，并支持从 `request.ExtraBody` 读取 `n` / `size` / `aspectRatio`（含嵌套 `parameters.aspectRatio`），最终调 `ConvertImageRequest` 委托 gemini。
- **已知违规（勿扩散）**：`adaptor.go` 的 imagen 分支与 `service_account.go` 的 `exchangeJwtForAccessToken` 直接用 `encoding/json`，违反 Rule 1。新增代码必须走 `common.*`。
- **`AcquireAccessToken` 为公开导出**：被外部包（如渠道测试、CLI 工具）调用，签名变更需排查调用方。

### Testing Requirements
- `go build ./relay/channel/vertex/...` 必须通过
- `go test ./relay/channel/...`
- 手动测试：claude（流式+非流式）、gemini（流式+非流式）、imagen、llama（opensource 模式）、API Key 模式 vs Service Account 模式、多 key 渠道。

### Common Patterns
- **多模式 Adaptor**：用 `RequestMode` 枚举在 `Init` 中一次性确定模式，后续所有方法 switch 分派。
- **委托模式**：claude/gemini/openai 的 Convert 与 DoResponse 大量委托给 `claude.Adaptor{}` / `gemini.Adaptor{}` / `openai.Adaptor{}`，vertex 自身只处理 URL、鉴权、模型名映射。
- **URL builder 分离**：把 URL 拼装逻辑抽到 `url_builder.go`，便于处理 base URL / region / version 的组合。
- **Token 缓存**：用 `asynccache.NewAsyncCache` 缓存短期 OAuth token，按 channelId 维度。

## Dependencies

### Internal
- `github.com/QuantumNous/new-api/common` — `Unmarshal`、`IsJsonObject`、`StrToMap`
- `github.com/QuantumNous/new-api/dto` — `ClaudeRequest`、`GeminiChatRequest`、`GeneralOpenAIRequest`、`ImageRequest`、`ClaudeMessage`、`Thinking`、`VertexKeyTypeAPIKey`
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/claude` — `Adaptor`、`RequestOpenAI2ClaudeMessage`、`CommonClaudeHeadersOperation`、`ModelList`
- `github.com/QuantumNous/new-api/relay/channel/gemini` — `Adaptor`、`CovertOpenAI2Gemini`、`GeminiChat*Handler`、`GeminiTextGeneration*Handler`、`GeminiImageHandler`、`ModelList`
- `github.com/QuantumNous/new-api/relay/channel/openai` — `OaiStreamHandler`、`OpenaiHandler`
- `github.com/QuantumNous/new-api/relay/common` — `RelayInfo`
- `github.com/QuantumNous/new-api/relay/constant` — `RelayModeGemini`
- `github.com/QuantumNous/new-api/service` — `GetHttpClient`、`NewProxyHttpClient`
- `github.com/QuantumNous/new-api/setting/model_setting` — `GetGeminiSettings`
- `github.com/QuantumNous/new-api/setting/reasoning` — `TrimEffortSuffix`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`、`RelayFormat`

### External
- `github.com/gin-gonic/gin` — HTTP 上下文
- `github.com/samber/lo` — `ToPtr`、`FromPtrOr`
- `github.com/bytedance/gopkg/cache/asynccache` — token 缓存
- `github.com/golang-jwt/jwt/v5` — RS256 / HS256 JWT 签名
- `crypto/rsa`、`crypto/x509`、`encoding/pem`、`encoding/json`、`net/http`、`net/url`、`io`、`fmt`、`errors`、`strings`、`time` — 标准库

<!-- MANUAL: -->
