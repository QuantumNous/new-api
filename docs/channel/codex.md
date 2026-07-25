# Codex 渠道接入说明

本文记录 newapi 接入 ChatGPT Codex 后端（`chatgpt.com/backend-api/codex/responses`）作为上游 AI 中转渠道的完整能力、限制与设计。

Codex 渠道复用用户的 ChatGPT 订阅（OAuth access_token + chatgpt-account-id），上游协议是 OpenAI 的 **Responses API**，不接受标准的 Chat Completions / Messages / Embeddings 等其它端点。newapi 在 `relay/channel/codex/` 内做协议适配，让客户端可以同时用 `/v1/responses` 和 `/v1/chat/completions` 两个入口访问 Codex。

---

## 1. 鉴权与渠道配置

| 项 | 说明 |
|---|---|
| 渠道类型 | `codex`（Channel Type ID 见 `constant/`）|
| 密钥字段 | JSON 字符串：`{"access_token":"...","account_id":"...","refresh_token":"...","expires_at":"..."}` |
| 上游 Endpoint | `POST <base_url>/backend-api/codex/responses` |
| Base URL 示例 | `https://chatgpt.com` |
| 必带 Header | `Authorization: Bearer <access_token>`、`chatgpt-account-id: <account_id>`、`OpenAI-Beta: responses=experimental`、`originator: codex_cli_rs` |

access_token 由 newapi 在调用前自动按 `expires_at` 判断是否刷新（见 `service/codex_credential_refresh.go`）。

---

## 2. 入口能力矩阵

| 客户端入口 | 流式 | 非流式 | 上游实际请求 | 说明 |
|---|---|---|---|---|
| `POST /v1/chat/completions` | ✅ | ✅（内部聚合）| `/backend-api/codex/responses`（流式）| 见 § 3 |
| `POST /v1/responses` | ✅ | ❌ Codex 拒绝 | `/backend-api/codex/responses`（按客户端 stream 透传）| 见 § 4 |
| `POST /v1/responses/compact` | ❌ 上游不支持 stream | ✅ | `/backend-api/codex/responses/compact` | 见 § 5 |
| `POST /v1/messages`（Claude 格式）| — | — | — | 直接 400：`codex channel: /v1/messages endpoint not supported` |
| `/v1/embeddings` / `/v1/audio/*` / `/v1/images/*` / `/v1/rerank` | — | — | — | 同上，直接 400 |

---

## 3. `/v1/chat/completions`：chat ↔ Responses 双向桥接

客户端发标准 chat completions 请求，newapi 内部走以下链路：

```
Client (chat completions)
   │
   ▼
relay/channel/codex/adaptor.go::ConvertOpenAIRequest
   │
   ├──> chat_bridge.ToCompatChatRequest
   │       dto.GeneralOpenAIRequest → apicompat.ChatCompletionsRequest
   │
   ├──> apicompat.ChatCompletionsToResponses
   │       messages[] → input[]、system → instructions、max_tokens → max_output_tokens、
   │       reasoning_effort → reasoning.{effort,summary}、tools[] / tool_choice 归一化
   │
   ├──> chat_bridge.applyCodexConstraints
   │       强制 store=false、stream=true；剥 max_output_tokens / temperature / top_p
   │
   ├──> chat_bridge.ensureInstructionsField
   │       序列化后保证 JSON body 含 "instructions" 键（Codex 后端硬性要求）
   │
   ▼
HTTP POST → /backend-api/codex/responses （上游永远是流式）
   │
   ▼
relay/channel/codex/adaptor.go::DoResponse → chat_bridge.RelayChatOverCodex
   │
   ├──> 解析上游 Responses SSE 事件流
   │
   ├──> 若 info.UserWantsStream == true：
   │       apicompat.ResponsesEventToChatChunks 把事件改写为 chat completions SSE chunk
   │       (response.output_text.delta → choices[].delta.content
   │        response.function_call_arguments.delta → tool_calls[].function.arguments
   │        response.reasoning_summary_text.delta → reasoning_content
   │        response.completed → finish_reason + 末尾 [DONE]
   │        若 info.ShouldIncludeUsage：额外发一条 usage chunk)
   │
   └──> 若 info.UserWantsStream == false：
           apicompat.BufferedResponseAccumulator 聚合所有 delta + 末尾 usage
           apicompat.ResponsesToChatCompletions 转成 ChatCompletionsResponse
           c.JSON(200, ...) 一次性返回
```

### 关键设计要点

- **上游强制流式**：Codex 后端要求 `stream: true`；newapi 在内部固定开启上游流式，对客户端"是否要流"由 `info.UserWantsStream` 解耦决定。
- **usage 计费同源**：流式与非流式都从 `response.completed` / `response.incomplete` / `response.failed` / `response.done` 抓 `evt.Response.Usage`，转成 `*dto.Usage` 交给 `BillingSettler`，与原 `/v1/responses` 路径计费链路一致。
- **HTTP 状态码透传**：上游非 2xx 时（如 429 rate limit），通过 `types.NewErrorWithStatusCode` 保留 `StatusCode`，避免上层重试逻辑失去信号。
- **finish_reason 准确**：上游 `response.incomplete` + `incomplete_details.reason=max_output_tokens` 映射为 chat 的 `finish_reason: "length"`；`response.failed` 映射为 `content_filter` 并把错误消息作为额外 delta chunk 发出。

---

## 4. `/v1/responses` 入口

完全保留客户端意图，仅做 Codex 后端的硬性钳制（`store=false`、注入 `instructions=""` 等），不做协议改写。

```
Client (Responses API)
   │
   ▼
adaptor.go::ConvertOpenAIResponsesRequest
   │  dto.OpenAIResponsesRequest → JSON → map[string]any
   │  chat_bridge.applyCodexConstraintsToMap (delete user/metadata/stream_options 等；
   │                                          保留 dto 独有字段如 conversation/truncation 等)
   │  
   │  注：这里不强制 stream=true，保留客户端的 stream 值
   │
   ▼
adaptor.go::DoResponse
   │  info.IsStream == true → openai.OaiResponsesStreamHandler （原生 Responses SSE 透传）
   │  info.IsStream == false → openai.OaiResponsesHandler   （但见 § 4.1 限制）
```

### 4.1 ⚠️ 已知限制：`/v1/responses` 非流式不可用

**Codex 后端硬性要求所有 `/backend-api/codex/responses` 请求必须带 `stream: true`。** 客户端如果发 `stream: false` 到 newapi 的 `/v1/responses`：

```json
{"error":{"message":"Stream must be set to true","type":"bad_response_status_code","param":"","code":"bad_response_status_code"}}
HTTP 400
```

这是上游约束，不是 newapi 的缺陷。该行为在 codex 渠道**自始至终**如此（pre/post 此次重构表现一致）。

**推荐方案**：客户端如果需要非流式 chat 响应，请改用 `POST /v1/chat/completions` 不传 `stream` 字段（newapi 内部会让上游走流式，聚合后一次性 JSON 返回）。如果一定要 Responses 协议响应体，请把 `stream` 设为 `true` 并在客户端做聚合，或者把模型路由到普通 OpenAI 渠道（不走 Codex 后端）。

---

## 5. `/v1/responses/compact` 入口

Codex CLI 私有的对话压缩端点，用于把多轮历史摘要成更短的 context。

- 上游路径：`/backend-api/codex/responses/compact`
- 强制 **非流式**（上游不接受 `stream: true`）
- 过滤真实上游已确认不接受的 `temperature` / `top_p` / `max_output_tokens` / `max_tool_calls` / `top_logprobs`
- 保留真实上游接受的 `parallel_tool_calls: false`
- 同时剥掉 `user` / `metadata` / `stream_options` / `frequency_penalty` / `presence_penalty` 等 Codex 后端禁字段
- 保证 JSON body 含 `instructions` 键

---

## 6. 客户端透传字段保留情况

| 字段 | `/v1/responses` | `/v1/responses/compact` | `/v1/chat/completions` |
|---|---|---|---|
| `instructions` | 透传（含 null / 数组 / 对象 等非 string 形态）| 同左 | 由 `messages[0]` 的 system content 抽取 |
| `conversation` | ✅ 透传 | ✅ 透传 | 不适用 |
| `truncation` | ✅ 透传 | ✅ 透传 | 不适用 |
| `max_tool_calls` | ✅ 透传 | ❌ 剥（Codex Compact 禁） | 不适用 |
| `previous_response_id` | ✅ 透传 | ✅ 透传 | 不适用 |
| `top_logprobs` | ✅ 透传 | ❌ 剥（Codex Compact 禁） | 不适用 |
| `reasoning.{effort,summary,mode,context}` | ✅ 透传 | ✅ 透传 | 由 `reasoning_effort` 转换；`mode/context` 不适用 |
| `tools[]` / `tool_choice` | ✅ 透传 | ✅ 透传 | 转换为 Responses 格式 |
| `temperature` / `top_p` / `max_output_tokens` | ❌ 剥（Codex 禁）| ❌ 剥（Codex Compact 禁） | ❌ 剥 |
| `prompt_cache_options` | ❌ 剥（真实上游返回 Unsupported parameter） | ❌ 剥（同左） | 不适用 |
| `user` / `metadata` / `stream_options` / `frequency_penalty` / `presence_penalty` / `prompt_cache_retention` / `safety_identifier` | ❌ 剥 | ❌ 剥 | ❌ 剥 |
| `store` | 强制 `false` | 由路径决定（删除该键）| 强制 `false` |
| `stream` | 保留客户端值（但 false 时上游 400，见 § 4.1）| 强制非流 | 强制上游流式；客户端意图通过聚合实现 |

`reasoning.context` 当前有效值为 `auto` / `current_turn` / `all_turns`；
`reasoning.mode` 当前有效值为 `standard` / `pro`，且 `pro` 是否可用取决于具体模型。

---

## 7. 计费

所有路径统一从上游 `usage` 字段抓 token 数：

```
ResponsesUsage.InputTokens          → dto.Usage.PromptTokens
ResponsesUsage.OutputTokens         → dto.Usage.CompletionTokens
ResponsesUsage.InputTokensDetails.CachedTokens   → dto.Usage.PromptTokensDetails.CachedTokens
                                                  → dto.Usage.PromptCacheHitTokens
ResponsesUsage.OutputTokensDetails.ReasoningTokens → dto.Usage.CompletionTokenDetails.ReasoningTokens
```

`BillingSettler` 后续按 token 数 + 模型单价结算。当上游事件中没有 `usage`（极少：连接被中断 / scanner 缓冲溢出 / `response.failed` 不带 usage 等），`buildUsage` 返回**非 nil 的零值 `*dto.Usage`** —— 这是为了避免上层 `usage.(*dto.Usage)...` 类型断言 panic，**代价是该次请求被记为零 token**。运维侧可结合错误日志（`common.SysError("codex chat bridge: SSE scan error: ...")`）和 `text_quota.go` 中"上游没有返回计费信息"提示定位异常。

---

## 8. 错误回归矩阵（运维参考）

| 现象 | 上游状态 | 原因 | 处理 |
|---|---|---|---|
| `Stream must be set to true` | 400 | `/v1/responses` 客户端发 `stream:false` | 改走 `/v1/chat/completions` 或加 `stream:true` |
| `The 'gpt-X' model is not supported when using Codex with a ChatGPT account` | 400 | Codex 后端按订阅等级限制可用模型 | 换 ChatGPT 账号订阅或换模型 |
| `Invalid token` / `Token has expired` | 401 | access_token 过期且 refresh_token 失效 | 重新走 OAuth 取新 token，更新渠道密钥 |
| `Store must be set to false` | 400 | 客户端绕过 newapi 改了 store | 不应该出现，定位 middleware 链 |
| `instructions: missing` | 400 | newapi 没注入 `instructions` 键 | 不应该出现；如发生看是否绕过 `ensureInstructionsField` |
| 流式中断、客户端拿到空 content + `finish_reason:"stop"` | — | 上游 `response.failed` 但 newapi 没透传 error | 检查 newapi 版本是否含 N 修复（commit `ebe6be413`）|

---

## 9. 相关代码定位

| 关注点 | 文件 |
|---|---|
| 渠道适配器主入口 | `relay/channel/codex/adaptor.go` |
| chat ↔ Responses 桥接、SSE 改写、约束钳制 | `relay/channel/codex/chat_bridge.go` |
| OAuth token 管理 | `relay/channel/codex/oauth_key.go`、`service/codex_credential_refresh.go` |
| Responses 协议数据结构与转换器（vendor 自 sub2api）| `pkg/apicompat/` |
| 计费下沉 | `relay/common/` 的 `BillingSettler`、`service/text_quota.go` |

---

## 10. 不在本渠道范围内

- Codex 渠道**不支持** `/v1/messages`（Claude 格式）。如需 Claude 协议入口，请用 `flatkey` 或其它兼容渠道。
- 不支持 embeddings / audio / image / rerank。
- 上游 `/backend-api/codex/responses` 是 ChatGPT 私有 endpoint，**不是 OpenAI 公开 API**，账号订阅等级直接决定可用模型；同一账号在 chatgpt.com Web 端能选到哪些模型，本渠道大致能用到哪些。
