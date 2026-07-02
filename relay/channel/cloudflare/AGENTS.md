<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/cloudflare

## Purpose

Cloudflare Workers AI 适配器。上游同时暴露 OpenAI 兼容端点（`/client/v4/accounts/{account_id}/ai/v1/chat/completions`、`.../embeddings`、`.../responses`）与 Cloudflare 原生 per-model 端点（`/client/v4/accounts/{account_id}/ai/run/{model}`，用于 text completions 等非 chat 任务）。鉴权用 `Bearer <API token>`，`info.ApiVersion` 字段被复用为 Cloudflare **Account ID**。

实际实现的 Convert：`ConvertOpenAIRequest`（含 text completions → `CfRequest` 的分支）、`ConvertRerankRequest`（透传）、`ConvertEmbeddingRequest`（透传）、`ConvertAudioRequest`（从 multipart/form-data 读取音频文件）、`ConvertOpenAIResponsesRequest`（透传）。其余 Convert 返回 `nil, errors.New("not implemented")` 或 panic。`DoResponse` 按 RelayMode 分派：chat/embedding 走自研 `cfStreamHandler` / `cfHandler`，responses 复用 `openai.OaiResponses*Handler`，audio transcription/translation 走 `cfSTTHandler`。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 定义 `Adaptor struct{}` 并实现 `Adaptor` 接口；`GetRequestURL` 按 RelayMode 拼 `/client/v4/accounts/{ApiVersion}/ai/v1/...` 或 `/ai/run/{model}`；`SetupRequestHeader` 只设 Bearer 与公共请求头 |
| `relay_cloudflare.go` | CF 专用响应处理：`convertCf2CompletionsRequest`（`GeneralOpenAIRequest` → `CfRequest`）、`cfStreamHandler` / `cfHandler`（chat，含 token 重估 `service.ResponseText2Usage`）、`cfSTTHandler`（把 `CfAudioResponse.Result.Text` 转 `dto.AudioResponse`）|
| `dto.go` | `CfRequest`（prompt/max_tokens/lora/stream/temperature 原生格式）、`CfAudioResponse` + `CfSTTResult`（STT 上游结构）|
| `constant.go` | `ModelList`（33 个 `@cf/...` / `@hf/...` 模型）与 `ChannelName = "cloudflare"` |

## For AI Agents

### Working In This Directory

- **`info.ApiVersion` 的语义不是版本号**：Cloudflare 要求 URL 嵌入 Account ID，本适配器把它当作 Account ID 使用。新增渠道测试时务必提示用户填 Account ID 而非版本字符串。
- **text completions 走原生端点**：`RelayModeCompletions` 的 URL 落到 `/ai/run/{model}`，请求体也由 `convertCf2CompletionsRequest` 转成 `CfRequest`（带 `lora` / `raw` 等 CF 专属字段），与 chat completions 的 OpenAI 兼容路径不同。
- **`relay_cloudflare.go` 直接用 `encoding/json`**：这是历史遗留，**违反 Rule 1**；改动本目录的 JSON 调用时应顺手迁到 `common.Marshal` / `common.Unmarshal`，但不要在无关 PR 中扩大范围。
- **流式 token 重估**：`cfStreamHandler` / `cfHandler` 都会调用 `service.ResponseText2Usage` 重算 usage，不是透传上游 usage。
- `ConvertClaudeRequest` 会在上游被 `panic("implement me")` 触发——调用方不应进入此分支（Claude 入口走 `claude.Adaptor`，不会路由到 cloudflare）。

### Testing Requirements

- `go build ./relay/channel/cloudflare/...` 必须通过
- `go test ./relay/channel/...`

### Common Patterns

- `DoRequest` 复用 `channel.DoApiRequest(a, c, info, requestBody)`（`relay/channel/api_request.go`），不自建 HTTP client。
- 所有未实现的 Convert 返回 `errors.New("not implemented")`，而非返回零值，便于上层立即失败。

## Dependencies

### Internal

- `relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `relay/channel/openai` — 复用 `OaiResponsesStreamHandler` / `OaiResponsesHandler`（Responses RelayMode）
- `relay/common` — `RelayInfo`
- `relay/constant` — `RelayMode*`
- `relay/helper` — `NewStreamScanner`、`ObjectData`、`GenerateFinalUsageResponse`、`SetEventStreamHeaders`、`GetResponseID`、`Done`
- `dto` — `GeneralOpenAIRequest`、`TextResponse`、`ChatCompletionsStreamResponse`、`AudioResponse`、`ImageRequest`、`AudioRequest`、`RerankRequest`、`EmbeddingRequest`、`OpenAIResponsesRequest`、`GeminiChatRequest`、`ClaudeRequest`、`Message`、`Usage`
- `service` — `ResponseText2Usage`、`CloseResponseBodyGracefully`
- `types` — `NewError`、`NewOpenAIError`、`ErrorCode*`、`RelayFormat*`
- `logger` — `LogError`

### External

- `github.com/gin-gonic/gin`
- `github.com/samber/lo` — `FromPtrOr`（`convertCf2CompletionsRequest`）

<!-- MANUAL: -->
