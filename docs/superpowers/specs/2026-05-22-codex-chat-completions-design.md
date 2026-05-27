# Codex 渠道支持 /v1/chat/completions 入口 — 设计文档

- **日期**：2026-05-22
- **作者**：ForrestMercadoarg（与 Claude Code 协作）
- **范围**：仅 new-api 仓库；仅 codex 渠道；客户端方向为 chat → Responses（不做反向）
- **前置阅读**：`CLAUDE.md` 规则 1（JSON 包）、规则 4（StreamOptions）、规则 6（指针零值）

---

## 1. 背景

new-api 的 codex 渠道当前只支持 `/v1/responses` / `/v1/responses/compact` 入口，客户端发到 `/v1/chat/completions` 会直接被 `relay/channel/codex/adaptor.go` 拒绝。

而 sub2api 仓库的 `backend/internal/pkg/apicompat/` 已经实现了完整的 Chat Completions ↔ Responses 双向协议转换（请求结构、非流响应、SSE 流事件状态机），并经过 ~5000 行测试验证。

目标：在 new-api 内复用 sub2api 的转换器，让 codex 渠道也能吃 `/v1/chat/completions`，对客户端表现为标准 chat completions（含非流/流/工具调用/推理）。

## 2. 总体架构

```
Client(chat) → new-api codex adaptor + pkg/apicompat → Codex 后端(Responses)
       ←                                            ←
   chat resp                                    Responses SSE
```

变更面：

| 路径 | 动作 | 说明 |
|---|---|---|
| `pkg/apicompat/` | 新增 | vendor 自 sub2api：`chatcompletions_to_responses.go` / `responses_to_chatcompletions.go` / `chatcompletions_responses_bridge.go` / `types.go` + 配套 `_test.go` |
| `relay/channel/codex/adaptor.go` | 改 3 方法 | `ConvertOpenAIRequest`、`GetRequestURL`、`DoResponse` 各加 chat 分支；现有 Responses 分支保持字节级不变 |
| `relay/channel/codex/chat_bridge.go` | 新增 | `dto.GeneralOpenAIRequest ↔ apicompat.ChatCompletionsRequest` 类型转译；SSE 回写循环；`applyCodexConstraints` 私有共享函数 |

`go.mod`、`go.sum` 不变（apicompat 零外部依赖）。

## 3. 请求侧：chat → Responses

1. relay 层在客户端命中 `/v1/chat/completions` 时调用 `ConvertOpenAIRequest`。
2. adaptor 调 `chat_bridge.ToCompatChatRequest` 把 `*dto.GeneralOpenAIRequest` 转 `apicompat.ChatCompletionsRequest`（一次 JSON 中转）。
3. 调 `apicompat.ChatCompletionsToResponses` 转换为 Responses 请求体。
4. 调 `applyCodexConstraints` 做钳制（与原 Responses 入口共享）：
   - `Instructions`：空时填 `""`；`ChannelSetting.SystemPrompt` 存在则按规则注入/覆盖。
   - `Store=false`、`Stream=true`（上游不接受 `store=true` / 非流）。
   - 删除字段（对齐 sub2api 完整名单）：`max_output_tokens`、`max_completion_tokens`、`temperature`、`top_p`、`frequency_penalty`、`presence_penalty`、`user`、`metadata`、`prompt_cache_retention`、`safety_identifier`、`stream_options`。
5. `GetRequestURL` 新增 `RelayModeChatCompletions` 分支，URL 仍指向 `/backend-api/codex/responses`。
6. `SetupRequestHeader` 不动（强制 `OpenAI-Beta: responses=experimental` / Stream Accept 头对新分支同样适用）。

字段映射要点：

| chat completions | Responses（上游） |
|---|---|
| `messages[]` | `input[]`（含 type=function_call / function_call_output / role-based） |
| 头部 `system` message | 抽到 `instructions` |
| `max_tokens` / `max_completion_tokens` | 强制丢弃 |
| `temperature` / `top_p` | 强制丢弃 |
| `tools[]` / `functions[]` | `tools[]`（ResponsesTool） |
| `tool_choice` / `function_call` | `tool_choice`（json.RawMessage） |
| `reasoning_effort` | `reasoning.effort` + `reasoning.summary="auto"` |
| `stream` | 上游强制 `true`；客户端意图独立记录 |

## 4. 响应侧：Responses → chat

1. relay 层调 `DoResponse`，按 `info.RelayMode` 分支：
   - `RelayModeResponses` / `RelayModeResponsesCompact`：原 handler 不动。
   - `RelayModeChatCompletions`：调 `chat_bridge.RelayChatOverCodex`。
2. `RelayChatOverCodex` 读取 `info.UserWantsStream`（请求侧设置）决定走流式回写或缓冲回写：
   - **流式**：循环读取上游 SSE → `apicompat.ResponsesEventToChatChunks(evt, state)` → 写 chat SSE 给客户端 → 末尾补 `[DONE]`。
   - **非流**：用 `apicompat.BufferedResponseAccumulator` 累计上游 SSE → `apicompat.ResponsesToChatCompletions` 一次性 JSON 回写。
3. usage：用 accumulator 提取上游 `input_tokens / output_tokens / cached_tokens / reasoning_tokens`，构造 `dto.Usage` 返回给 relay 层走 `BillingSettler`，**与原 Responses 路径同一计费链**。
4. 错误：上游 4xx/5xx 原样转译为 `types.NewAPIError`；流中断时已写部分 + `finish_reason="error"` chunk + `[DONE]`，已收 usage 计费。

SSE 事件映射（apicompat 已实现）：

| 上游 Responses 事件 | 改写为 chat chunk |
|---|---|
| `response.created` | `{role:"assistant"}` 首 delta |
| `response.output_text.delta` | `{content:"..."}` delta |
| `response.reasoning_summary_text.delta` | `{reasoning_content:"..."}` delta |
| `response.output_item.added (type=function_call)` | `tool_calls[].{index,id,type:"function",function:{name}}` |
| `response.function_call_arguments.delta` | `tool_calls[].function.arguments` 累拼 |
| `response.completed` / `response.done` | `finish_reason` chunk + `[DONE]` |

## 5. 数据契约与工程约束

### 5.1 计费 usage
- 按上游 Responses 返回的原始 token 计数计费（与现有 Responses 路径同源）。
- 客户端响应里同步装 chat 命名的 `prompt_tokens / completion_tokens / completion_tokens_details.reasoning_tokens`，仅作为"账面回执"。

### 5.2 客户端 stream 意图
- 在 `RelayInfo` 上新增 `UserWantsStream bool`（命名沿用现有 `IsStream` 风格），仅 codex chat 分支读写。
- 在 `chat_bridge.ToCompatChatRequest` 中按 `request.Stream` 写入；其它渠道不读 → 零影响。

### 5.3 JSON 规则（CLAUDE.md Rule 1）
- vendor 进来的 apicompat 包内 `encoding/json` 替换为 new-api 的 `common.Marshal` / `common.Unmarshal`。
- 仅保留 `json.RawMessage`、`json.Number` 等类型引用。
- 测试同步替换并跑通。

### 5.4 共享钳制
- `applyCodexConstraints(req *apicompat.ResponsesRequest, info *relaycommon.RelayInfo)` 在 `chat_bridge.go`。
- 原 `ConvertOpenAIResponsesRequest` 内的等价代码改为调用此函数，保留行为不变。
- 禁字段名单对齐 sub2api 完整版（见 §3 第 4 条）。

## 6. 兼容矩阵

| 客户端入口 | 改造前 | 改造后 |
|---|---|---|
| `/v1/responses`（流/非流/compact） | ✅ 工作 | ✅ 工作（字节级一致） |
| `/v1/chat/completions` 非流 | ❌ 400 | ✅ 工作（上游聚合后回写） |
| `/v1/chat/completions` 流 | ❌ 400 | ✅ 工作 |
| `/v1/messages` / embeddings / audio / image / rerank | ❌ 400 | ❌ 400（不变） |

## 7. 测试

### 7.1 单元测试（CI 可跑，无需真账号）
- 随 vendor 带来 sub2api 现有测试：`chatcompletions_responses_test.go`（~1000 行）、`chatcompletions_responses_bridge_test.go`。
- 新增 `pkg/apicompat/jsonadapter_test.go`：验证 `encoding/json` → `common.*` 替换后行为一致。
- 新增 `relay/channel/codex/chat_bridge_test.go`：
  - `dto.GeneralOpenAIRequest ↔ apicompat.ChatCompletionsRequest` 双向不丢字段。
  - `applyCodexConstraints` 名单与 sub2api 一致；钳制后字段消失。
  - `info.UserWantsStream` 在 `request.Stream=true/false` 下正确写入。

### 7.2 手动 smoke 验证（用真 codex 账号，挂测试环境）
1. chat 非流 + 简单对话 → 200 + 完整 message + usage 三件套
2. chat 流 + 简单对话 → SSE 正常 + `finish_reason:"stop"` + `[DONE]`
3. chat 非流 + 工具调用 → `tool_calls[]` 完整 + `finish_reason:"tool_calls"`
4. chat 流 + 工具调用 → 分片拼接正确（index/id/name/arguments）
5. chat 流 + `reasoning_effort:"high"`（gpt-5 类） → 含 `reasoning_content` delta
6. chat 请求带 `temperature/max_tokens/top_p` → 静默丢弃，请求成功
7. **回归**：`/v1/responses` 流式 → 与改造前完全一致
8. **回归**：`/v1/messages` / embeddings → 仍报 endpoint not supported

## 8. 不在本次范围

- codex 渠道支持 `/v1/messages`（Claude 格式）
- openai / aws 等渠道的 chat ↔ responses 互转
- compact 模式叠加 chat 翻译
- 新增渠道配置项（客户端格式按入口路径自动识别）

## 9. 风险与回滚

| 风险 | 兜底 |
|---|---|
| adaptor 改动伤到原 Responses 路径 | 早返回风格分支，配 §7.2 第 7 条回归用例 |
| apicompat 替换 JSON 工具后行为不一致 | §7.1 jsonadapter_test 兜底 |
| Codex 后端额外拒绝某 tool 配置 | smoke 第 3、4 条覆盖；如出问题在 `normalizeCodexTools` 等价处理点加规则 |
| 计费字段错位 | usage 与原 Responses 同源 + 同 BillingSettler 路径，单测对账 |

回滚：单 commit revert 即可（无 DB 迁移、无配置变更）。

## 10. 实施顺序建议（交给 writing-plans 细化）

1. vendor `pkg/apicompat/` + 替换 JSON 工具 + 跑通现有测试
2. 在 `RelayInfo` 加 `UserWantsStream` 字段
3. `chat_bridge.go`：类型转译 + `applyCodexConstraints` + RelayChatOverCodex
4. 改 `adaptor.go` 三个方法的分支（保留原分支）
5. 新增 `chat_bridge_test.go`
6. 本地 `make build` + `make test`
7. 真账号 8 条 smoke 验证
8. 提交 PR
