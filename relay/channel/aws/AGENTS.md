<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/aws

## Purpose

AWS Bedrock Runtime 适配器，支持两种鉴权模式与两类模型家族：

- **`ClientModeApiKey`**：API key 模式。`info.ApiKey` 形如 `<bearer>\|<region>`，`info.ChannelOtherSettings.AwsKeyType == AwsKeyTypeApiKey`。走标准 HTTP 路径 `https://bedrock-runtime.<region>.amazonaws.com/model/<modelId>/converse`，`DoRequest` 复用 `channel.DoApiRequest`，`DoResponse` **完全委托 `claude.Adaptor.DoResponse`**。
- **`ClientModeAKSK`**：AK/SK 模式（默认）。`info.ApiKey` 形如 `<ak>\|<sk>\|<region>`（2 段也被接受作 apiKey|region 的 API key 模式，3 段才走 AK/SK）。`newAwsClient` 用 `bedrockruntime.New` 构造带 SigV4 凭证的 SDK client，请求走 `InvokeModel` / `InvokeModelWithResponseStream`。

模型家族：
- **Claude**（`anthropic.claude-*`）：请求体转成 `AwsClaudeRequest`（`anthropic_version: "bedrock-2023-05-31"`），通过 Bedrock SDK 调用；响应解析复用 `claude.HandleStreamResponseData` / `HandleClaudeResponseData` / `HandleStreamFinalResponse`。
- **Nova**（`amazon.nova-*`）：`convertToNovaRequest` 把 OpenAI 请求转成 Nova 的 `messages-v1` schema，走 `InvokeModel`（非流式），响应在 `handleNovaRequest` 里直接构造成 `dto.OpenAITextResponse` 返回。

跨区域推理：`awsModelCanCrossRegionMap` + `awsRegionCrossModelPrefixMap` 决定是否在 modelId 前加 `us.` / `eu.` / `apac.` 前缀（如 `anthropic.claude-3-5-sonnet-...` 在 us/eu/ap 都支持跨区域；Nova 在 us/eu/apac；`claude-opus-4-*` 仅在 us 跨区域，等）。

实际实现的 Convert：`ConvertOpenAIRequest`（含 Nova/Claude 分支）、`ConvertClaudeRequest`（把 url 类型的 image source 转 base64）。其余 Convert（image/audio/rerank/embedding/responses/gemini）返回 `errors.New("not implemented")`。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 定义 `Adaptor struct{ ClientMode, AwsClient, AwsModelId, AwsReq, IsNova }` 实现 `Adaptor` 接口；`GetRequestURL` 仅在 API key 模式返回 URL，AK/SK 模式返回空（实际 URL 在 SDK 内部构造）；`ConvertClaudeRequest` 把 message 里 `source.type=="url"` 的图片下载并转 base64（Claude 上游要求 base64）；`DoRequest` / `DoResponse` 按 ClientMode 分派 |
| `constants.go` | `awsModelIDMap`（21 个 Claude 模型 + 8 个 Nova 模型，把客户端模型名映射到 Bedrock modelId）、`awsModelCanCrossRegionMap`（modelId × {us,eu,ap,apac} 的跨区域支持矩阵）、`awsRegionCrossModelPrefixMap`（region 前缀到 cross-region 前缀映射：us→us, eu→eu, ap→apac）、`isNovaModel` |
| `dto.go` | `AwsClaudeRequest`（Bedrock 专属 Claude 请求体，含 `AnthropicVersion="bedrock-2023-05-31"` / `AnthropicBeta` / `OutputConfig` / `Thinking`）、`formatRequest`（从 io.Reader 解析 + 注入 anthropic_version + 从 anthropic-beta 头提取 beta 列表）；`NovaMessage`/`NovaContent`/`NovaRequest`/`NovaInferenceConfig`、`convertToNovaRequest`（OpenAI→Nova）、`parseStopSequences` |
| `relay-aws.go` | Bedrock 客户端与请求/响应处理：`newAwsClient`（支持 Bearer token 与 AK/SK 两种凭证；按 channelSetting.Proxy 配置 HTTP client）、`doAwsClientRequest`（构造 InvokeModelInput / InvokeModelWithResponseStreamInput）、`buildAwsRequestBody`（PassThrough 透传支持）、`awsHandler`（非流式 Claude，复用 `claude.HandleClaudeResponseData`）、`awsStreamHandler`（流式 Claude，遍历 `ResponseStreamMemberChunk` 并调 `claude.HandleStreamResponseData`）、`handleNovaRequest`（Nova 响应→OpenAITextResponse）、`getAwsErrorStatusCode`、`newAwsInvokeContext`（按 `common.RelayTimeout` 设 deadline）、跨区域推理辅助函数 |

## For AI Agents

### Working In This Directory

- **两个客户端模式共用同一个 `Adaptor` struct**：`ClientMode` 字段在 `GetRequestURL` 时确定，但**只在 Init 之后才可用**。改动 `GetRequestURL` / `SetupRequestHeader` / `DoRequest` 时注意两条路径的行为差异。
- **API key 模式 DoResponse 委托 claude.Adaptor**：API key 模式本质上是把 Bedrock 的 `/converse` 端点当作 Anthropic Messages API 消费，响应处理 100% 复用 claude。只有 AK/SK 模式才走自研的 `awsHandler` / `awsStreamHandler`。
- **跨区域推理**：`doAwsClientRequest` 调用 `awsModelCanCrossRegion` / `awsModelCrossRegion` 在 modelId 前加 region 前缀。**新增模型时必须更新 `awsModelCanCrossRegionMap`**，否则该模型会被当作不支持跨区域，在 us/eu/ap 区域外失败。
- **`ConvertClaudeRequest` 的 image URL→base64 转换**：Bedrock 不接受 `source.type=="url"` 的图片，本适配器在 Convert 阶段调 `service.GetBase64Data` 把 URL 图片下载并转 base64。改动 image 处理时注意这段会触发同步 HTTP 下载。
- **PassThrough 透传**：`buildAwsRequestBody` 在 `model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled` 时从 `common.GetBodyStorage(c)` 取原始请求体（剥掉 `model`/`stream` 字段）作为上游 body，跳过 `awsClaudeReq` 转换。这是 Claude Messages API 透传的关键路径。
- **Nova 模型不支持流式**：`handleNovaRequest` 只调 `InvokeModel`（非流式），即便客户端请求 stream，Nova 路径也不会进入 `awsStreamHandler`。
- **`newAwsInvokeContext` 的超时**：若 `common.RelayTimeout <= 0`，返回 `context.Background()` 无超时——长请求可能挂死。生产建议显式配置 RelayTimeout。
- **`relay-aws.go` 中存在 `fmt.Println`**（`awsStreamHandler` 的 unknown tag 分支）：这是 debug 残留，违反"无临时调试代码"规则；改动该函数时建议替换为 `logger.LogWarn` 或 `common.SysLog`。
- 适用 Rule 1：`dto.go` 的 `formatRequest` 用 `common.DecodeJson`；`relay-aws.go` 用 `common.Marshal` / `common.Unmarshal` / `common.DecodeJson`。**`awsHandler` 路径中 `handleNovaRequest` 用 `json.Unmarshal`**（违反 Rule 1），改动时顺手迁。
- 适用 Rule 5：`AwsClaudeRequest.Temperature` 是 `*float64` + omitempty（指针零值语义），符合规范；但 `TopP` / `TopK` 是非指针 + omitempty——**违反 Rule 5**，零值会被丢弃。新增字段务必用指针。

### Testing Requirements

- `go build ./relay/channel/aws/...` 必须通过
- `go test ./relay/channel/aws/...`（有 `relay_aws_test.go`）
- 重点验证：API key 与 AK/SK 两种模式的 DoRequest/DoResponse、跨区域推理前缀、Nova 模型路径、ConvertClaudeRequest 的 URL→base64 转换

### Common Patterns

- **`claude.ClaudeResponseInfo` 共享**：aws / ali（直通） / blockrun 都通过实例化 `claude.ClaudeResponseInfo{...}` 并调 `claude.HandleStreamResponseData` 复用流式状态机。
- **错误状态码提取**：`getAwsErrorStatusCode` 用 `errors.As` 断言 `HTTPStatusCode()` 接口，兜底 500；不在 SDK error 类型上硬编码。
- **`awsModelIDMap` 双向查找**：`getAwsModelID` 把客户端模型名→Bedrock modelId；`GetModelList` 反向遍历该 map 生成模型清单。

## Dependencies

### Internal

- `relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`、`ResolveHeaderOverride`
- `relay/channel/claude` — `Adaptor.DoResponse`（API key 模式）、`ClaudeResponseInfo`、`HandleStreamResponseData`、`HandleStreamFinalResponse`、`HandleClaudeResponseData`、`CommonClaudeHeadersOperation`
- `relay/common` — `RelayInfo`
- `relay/helper` — `GetResponseID`
- `service` — `NewProxyHttpClient`、`GetHttpClient`、`GetBase64Data`
- `setting/model_setting` — `GetGlobalSettings().PassThroughRequestEnabled`
- `dto` — `AwsKeyType*`、`GeneralOpenAIRequest`、`ClaudeRequest`、`ClaudeMessage`、`GeminiChatRequest`、`ImageRequest`、`AudioRequest`、`RerankRequest`、`EmbeddingRequest`、`OpenAIResponsesRequest`、`OpenAITextResponse`、`Message`、`Usage`、`Thinking`
- `types` — `NewAPIError`、`NewError`、`NewOpenAIError`、`ErrorCode*`（`AwsInvokeError`、`AwsClientError`、`BadResponseBody`、`BadRequestBody`、`InvalidRequest`）
- `common` — `Marshal`、`Unmarshal`、`DecodeJson`、`GetBodyStorage`、`RelayTimeout`、`GetTimestamp`
- `logger` — `LogJson`

### External

- `github.com/aws/aws-sdk-go-v2/service/bedrockruntime` + `types` — Bedrock Runtime SDK
- `github.com/aws/aws-sdk-go-v2/aws` / `credentials` — AK/SK 凭证
- `github.com/aws/smithy-go/auth/bearer` — API key 模式的 Bearer token provider
- `github.com/pkg/errors` — `Wrap` / `As`
- `github.com/gin-gonic/gin`
- 标准库 `context`、`encoding/json`、`fmt`、`io`、`net/http`、`strings`、`time`

<!-- MANUAL: -->
