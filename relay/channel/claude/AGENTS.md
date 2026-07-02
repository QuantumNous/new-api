<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/claude

## Purpose

Anthropic Claude **原生** Messages API 适配器（`/v1/messages`）。这是 claude 系适配器的基础实现——`aws/`、`ali/`（Anthropic Messages 直通模式）、`blockrun/`（Claude 入站路径）等适配器都嵌入或实例化 `claude.Adaptor` 复用其 `DoResponse` / `RequestOpenAI2ClaudeMessage` / `HandleStreamResponseData` / `HandleClaudeResponseData` 等核心函数。

实际实现的 Convert：`ConvertOpenAIRequest`（委托 `RequestOpenAI2ClaudeMessage`）、`ConvertClaudeRequest`（透传）。其余 Convert（image/audio/rerank/embedding/responses/gemini）返回 `errors.New("not implemented")`。

`DoResponse` 会强制把 `info.FinalRequestRelayFormat = types.RelayFormatClaude`（即便入站是 OpenAI，最终回写格式也按 Claude 处理），然后按 `info.IsStream` 分派到 `ClaudeStreamHandler` / `ClaudeHandler`。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 定义 `Adaptor struct{}` 实现 `Adaptor` 接口；`GetRequestURL` 拼 `/v1/messages`，并在 `shouldAppendClaudeBetaQuery`（`info.IsClaudeBetaQuery` 或 `info.ChannelOtherSettings.ClaudeBetaQuery`）为真时附加 `?beta=true`；`SetupRequestHeader` 设 `x-api-key` + `anthropic-version`（默认 `2023-06-01`），调 `CommonClaudeHeadersOperation` 透传 `anthropic-beta` 与 ClaudeSettings 写入的头 |
| `constants.go` | `ModelList`（claude-3-sonnet/opus/haiku、3-5-sonnet/haiku、3-7-sonnet、sonnet-4 / opus-4 / 4-1 / 4-5 / 4-6 / 4-7 / 4-8 的各种 effort 后缀变体 `-max/-xhigh/-high/-medium/-low/-thinking`，共 40 项）+ `ChannelName = "claude"` |
| `dto.go` | **本文件几乎全部被注释掉**（旧的本地 ClaudeRequest/ClaudeMessage 定义已迁到 `dto/` 包）。仅保留文件作为占位，新增类型应直接加到 `dto/claude.go` 而不是这里 |
| `relay-claude.go` | 核心转换与响应处理：`RequestOpenAI2ClaudeMessage`（OpenAI→Claude 大转换，含 web_search 工具、reasoning/effort/thinking 适配、tool_choice/parallel_tool_calls 映射、system 消息累积、image/pdf base64 包装）、`StreamResponseClaude2OpenAI` / `ResponseClaude2OpenAI`（反向转换）、`ClaudeResponseInfo` 结构、`FormatClaudeResponseInfo`（流式状态机：`message_start`/`content_block_*`/`message_delta`）、`HandleStreamResponseData` / `HandleStreamFinalResponse` / `HandleClaudeResponseData`（同时被 `aws/` 复用）、`ClaudeStreamHandler` / `ClaudeHandler` 入口、`buildOpenAIStyleUsageFromClaudeUsage`（cache token 规范化）、`buildMessageDeltaPatchUsage` + `patchClaudeMessageDeltaUsageData`（AWS Bedrock 的 message_delta usage 缺字段补丁，用 gjson/sjson 在 SSE 原文上修改）、`mapToolChoice`、`maybeMarkClaudeRefusal` |

## For AI Agents

### Working In This Directory

- **这是 Claude 系适配器的根基**。`aws/`、`ali/`（直通模式）、`blockrun/`（Claude 入站）都直接复用本目录的函数（`HandleStreamResponseData`、`HandleClaudeResponseData`、`RequestOpenAI2ClaudeMessage`、`CommonClaudeHeadersOperation`、`ClaudeResponseInfo` 等）。改动这些函数的签名或行为会同时影响三个以上适配器——动之前先 grep 全部调用点。
- **`dto.go` 已废弃**：本目录的 `dto.go` 全是注释；真正的 Claude DTO 定义在 `dto/claude.go`（`ClaudeRequest` / `ClaudeMessage` / `ClaudeMediaMessage` / `ClaudeResponse` / `ClaudeUsage` 等）。新增 Claude 类型写到 `dto/`，不要写到本目录。
- **`info.FinalRequestRelayFormat` 强制设置**：`DoResponse` 第一行就把 FinalRequestRelayFormat 置为 `RelayFormatClaude`。这意味着即便客户端入站是 OpenAI，响应也会被转成 Claude SSE 格式——这是设计意图，不要随意去掉。
- **Effort 后缀适配（`claude-opus-4-6/4-7/4-8-<effort>`）**：`RequestOpenAI2ClaudeMessage` 中 `reasoning.TrimEffortSuffix` 检测到 effort 后缀时会改写 model、注入 `Thinking.Type="adaptive"` + `OutputConfig={"effort":...}`，并对 4-7/4-8 强制清空 temperature/top_p/top_k（上游 400）。新增 effort 变体时同步更新 `ModelList` 与这段分支。
- **`-thinking` 后缀适配**：通过 `model_setting.GetClaudeSettings().ThinkingAdapterEnabled` 控制；对 4-7/4-8 走 adaptive 路径，对其他模型走 `enabled` + BudgetTokens（max_tokens × `ThinkingAdapterBudgetTokensPercentage`，默认 80%，且 max_tokens < 1280 时强制提升到 1280）。修改 budget 比例要走 setting，不要硬编码。
- **`message_delta` usage 补丁**：`shouldSkipClaudeMessageDeltaUsagePatch` 在 PassThroughRequestEnabled 时跳过；`patchClaudeMessageDeltaUsageData` 用 `gjson`/`sjson` 在 SSE 原文上 in-place 修改 `usage.input_tokens`/`cache_read_input_tokens`/`cache_creation_input_tokens` 等字段——主要解决 AWS Bedrock 上游返回的 message_delta 缺少这些字段的问题。修改时注意**只补缺失字段，不覆盖**（`upstreamValue.Exists() && > 0` 时跳过）。
- **cache token 规范化**：`service.NormalizeCacheCreationSplit` 把 `CacheCreationInputTokens` 拆分成 5m / 1h 两档；`buildOpenAIStyleUsageFromClaudeUsage` 会把 cache creation tokens 加到 `PromptTokens` 总数里（按 OpenAI 语义 total_input = prompt + cache_read + cache_creation）。动这里时务必理解计费层（`relay/helper/price.go`、`pkg/billingexpr/`）怎么消费这些字段。
- **`CommonClaudeHeadersOperation` 是导出函数**：被 `aws/adaptor.go` 复用。修改它的行为会影响 AWS Bedrock 路径。
- 适用 Rule 1（`relay-claude.go` 用 `common.Unmarshal`/`common.UnmarshalJsonStr`，但 `json.Marshal` 仍出现在 `ResponseClaude2OpenAI` 的 tool arguments 处理——这是类型 marshalling，符合 Rule 1 的"类型引用"豁免；不过工具参数序列化建议统一走 `common.Marshal`）。
- **web_search 工具映射**：`RequestOpenAI2ClaudeMessage` 把 OpenAI `WebSearchOptions.SearchContextSize` (`low/medium/high`) 映射到 Claude 的 `MaxUses`（1/5/10），并把 `UserLocation` JSON 转成 Claude 的 `approximate` 对象。

### Testing Requirements

- `go build ./relay/channel/claude/...` 必须通过
- `go test ./relay/channel/claude/...`（有 `relay_claude_test.go` 与 `message_delta_usage_patch_test.go`）
- 改动 `RequestOpenAI2ClaudeMessage` 时重点验证：tools + tool_choice + parallel_tool_calls、system 多消息合并、image/pdf base64、effort 后缀（4-6/4-7/4-8 三类）、`-thinking` 后缀（4-7/4-8 与其他模型两路径）。

### Common Patterns

- **双格式回写**：`HandleStreamResponseData` / `HandleClaudeResponseData` 内部按 `info.RelayFormat` 分派——Claude 入站原样透传 SSE，OpenAI 入站转成 OpenAI chunk/JSON。
- **`FormatClaudeResponseInfo` 是流式状态机核心**：识别 `message_start` / `content_block_delta` / `message_delta` / `content_block_start` 四种事件，累积 usage、ResponseId、Model、ResponseText；其他事件类型返回 `false` 表示跳过。
- **token 重估 fallback**：`HandleStreamFinalResponse` 在 usage 不完整时调 `service.ResponseText2Usage` 用本地 tokenizer 重估，避免计费塌到 0。
- **`-thinking` model 名剥除**：通过 `model_setting.ShouldPreserveThinkingSuffix` 决定是否保留后缀传给上游（默认剥除）。

## Dependencies

### Internal

- `relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `relay/channel/openrouter` — `RequestReasoning` 类型（解析 OpenRouter 风格 `reasoning` 字段）
- `relay/common` — `RelayInfo`
- `relay/helper` — `StreamScannerHandler`、`ObjectData`、`GenerateFinalUsageResponse`、`ClaudeChunkData`、`SetEventStreamHeaders`、`GetResponseID`、`Done`、`StreamResult`
- `relay/reasonmap` — `ClaudeStopReasonToOpenAIFinishReason`
- `service` — `GetBase64Data`、`ResponseText2Usage`、`CloseResponseBodyGracefully`、`IOCopyBytesGracefully`、`NormalizeCacheCreationSplit`
- `setting/model_setting` — `GetClaudeSettings`（DefaultMaxTokens / ThinkingAdapter* / WriteHeaders）
- `setting/reasoning` — `TrimEffortSuffix`
- `dto` — `ClaudeRequest` / `ClaudeMessage` / `ClaudeMediaMessage` / `ClaudeMessageSource` / `ClaudeResponse` / `ClaudeUsage` / `ClaudeCacheCreationUsage` / `ClaudeToolChoice` / `ClaudeWebSearchTool` / `ClaudeWebSearchUserLocation` / `Thinking` / `Tool` / `GeneralOpenAIRequest` / `Message` / `OpenAITextResponse` / `ChatCompletionsStreamResponse` / `Usage` / `InputTokenDetails`
- `types` — `NewAPIError`、`NewError`、`WithClaudeError`、`WithOpenAIError`、`ErrorCodeBadResponseBody`、`RelayFormatClaude` / `RelayFormatOpenAI`
- `common` — `Marshal`、`Unmarshal`、`UnmarshalJsonStr`、`GetPointer`、`GetUUID`、`GetTimestamp`、`SysLog`、`SetContextKey`、`DebugEnabled`
- `constant` — `ContextKeyAdminRejectReason`、`FinishReasonStop`
- `logger` — `LogError`、`LogDebug`

### External

- `github.com/gin-gonic/gin`
- `github.com/tidwall/gjson` / `github.com/tidwall/sjson` — message_delta usage 补丁的 in-place JSON 修改
- 标准库 `encoding/json`（类型 marshal，主要在 `ResponseClaude2OpenAI` 工具参数处理）、`io`、`net/http`、`strings`、`fmt`、`errors`

<!-- MANUAL: -->
