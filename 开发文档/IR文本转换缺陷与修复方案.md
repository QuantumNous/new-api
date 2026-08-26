# IR 文本转换缺陷与修复方案

> 状态：**本地 P0/P1 已落地并通过 `go test`。** https://shapi.vip 仍是修复前的线上包，跨协议 500/空回要等部署后才能复验。
> 范围：Chat Completions / Responses / Claude Messages / Gemini `generateContent`。
> 不改：embedding / image / audio / realtime；不把 Chat 重新当中枢。

---

## 1. 现象对照

| # | 用户路径 | 现场症状 | 判定 |
|---|---|---|---|
| A | Claude → Chat | 上游（Console Go）校验失败：`messages[0]` 期望 string，实际是带 `cache_control` 的 content 数组 | **确认，请求投影 bug** |
| B | Claude → Responses | 丢失思维链 | **确认，请求/流式投影都不完整** |
| C | Chat → Responses | 丢失思维链 | **确认，同 B** |
| D | Claude 工具调用 | `invalid tool_result content (2013)` | **确认，ToClaude 把 JSON 对象当 content** |
| E | Responses → Chat | Internal server error | **高概率：状态字段硬失败被当成 500** |
| F | Responses → Claude / Gemini | `item_id not found` | **确认，Responses SSE/item 缺少 `id`/`item_id`** |
| G | Gemini → Chat | `stream_options is only valid when stream=true` | **确认，Gemini 入站没有 `stream` 字段** |
| H | Gemini → Responses / Claude | 空回 | **高概率：流式 ToGemini/ToResponses 丢块；次因 Gemini contents 角色序** |
| I | Gemini | 暂未发现问题 | 先不改 Gemini 方言 |

---

## 2. 根因（按代码）

### A. Claude → Chat：`cache_control` 泄漏 + 内容被强制成数组

Claude 系统/用户块常带 `cache_control: {type: ephemeral, ttl: 1h}`。IR 摄入正确。

`ToChat` 现在：

- 单块 text **只要有 cache_control** 就不展成 string，改发 part 数组
- part 上原样写 `cache_control`

标准 Chat（以及 Console Go 的 Pydantic 模型）只接受 `content: string`，且 part 不允许 `cache_control`。

对应实现：`relaykit/ir/project/chat/block.go` 的 `blocksToChatContent` / `blockToChatPart`。

**修复原则：** `cache_control` 是 Claude 私货。ToChat 必须丢（已有 `ProjectionReport`），text-only 消息展成 string。OpenRouter 若仍要 cache_control，放 adaptor 方言，不放 IR→Chat 投影。

### B/C. 思维链进不了 Responses

IR 里 thinking 是 `BlockKindThink`。ToResponses 只在两种窄情况下发出 `reasoning`：

1. **整条 message 只有一个 think 块**（`messageToResponsesInput`）
2. **非流式响应**的 think 块（`blockToResponsesOutput`）

真实对话是 `thinking + text + tool_use` 混在同一 assistant 消息里。`blockToResponsesPart` 对 think 直接 `return nil`，历史思维链被静默丢掉。

流式更差：`ToStream` 给 text 发了 `output_item.added`，给 think **没有** 建 reasoning item，只有可能出现的 `reasoning_summary_text.delta`，客户端对不上 item。

Chat 的 `reasoning_content`、Claude 的 `thinking` block 都能进 IR；缺的是 **ToResponses 要把 think 拆成独立 `reasoning` item**，不能塞进 `message.content`。

### D. Claude `tool_result` 2013

`toolResultContent` 把 tool 返回的 JSON **字符串反序列化成 object/array 再塞进 `content`**：

```go
if err := json.Unmarshal([]byte(text), &value); err == nil {
    switch value.(type) {
    case map[string]any, []any:
        return value, nil // 上游 Claude 不认
    }
}
```

Anthropic 要求 `tool_result.content` 只能是：

- string，或
- `[{type:text,text:...}]` / image 等合法 content block

`{"ok": true}` 这种工具 JSON 必须仍是 **string**（或包在 text block 里）。Chat / Gemini / Responses 的 tool 输出几乎都是 JSON 对象字符串，所以一转 Claude 就 2013。

### E. Responses → Chat 报 Internal server error

`rejectStatefulResponses`：入站带 `previous_response_id` / `conversation` / `prompt` / `context_management` 且目标不是 Responses 时直接 `error`。

宿主用 `types.NewError(..., ErrorCodeConvertRequestFailed)`，**没设 400**，对外经常是 500 Internal server error。

这是产品决策（Q5 硬失败）+ 错误码包装问题，不一定是投影崩溃。需日志确认是否还有别的 panic；第一刀先把这类失败变成明确的 400。

### F. Responses `item_id not found`

官方 Responses 流约定：

1. `response.output_item.added` 带稳定 `item.id`（如 `msg_...` / `fc_...`）
2. 后续 `output_text.delta` / `function_call_arguments.delta` 必须带 **同一个** `item_id`
3. `function_call` 同时要有 `id`（item）和 `call_id`（给 `function_call_output` 用）

当前 `ToStream`：

- text item id = `state.ID + "_msg"`，delta **不写 item_id**
- tool item 把 tool_use id 既当 `id` 又当 `call_id`
- `function_call_arguments.delta` **不写 item_id**
- 非流式 `function_call` 只写 `call_id`，没有 item `id`

Codex / 官方 SDK 会按 `item_id` 找 output item，找不到就是这句错。Claude/Gemini 上游不会说 `item_id`，所以这是 **回写给 Responses 客户端** 的事件形状问题，不是上游协议。

另：入站 Responses 的 `function_call` 常有 `id`（item）+ `call_id`（调用）。From 只留了 `call_id`。多轮 `function_call_output` 一般用 `call_id`，这条次要；流式缺 `item_id` 是主因。

### G. Gemini → Chat：`stream_options` 与 `stream` 不一致

Gemini 是否流式只看 URL（`:streamGenerateContent`），body **没有** `stream`。`FromGemini` 不设 `ir.Request.Stream`。

ToChat 因此不写 `stream: true`。OpenAI/Azure 方言却看 `info.IsStream`，补上 `stream_options.include_usage`。上游看到 `stream_options` 且 `stream≠true`，直接 400。

**修复：** `convertRequestIR` 在 From 之后用 `info.GetIsStream()` 写入 `irReq.Stream`；方言层若写 `stream_options` 必须同时保证 body `stream=true`。

### H. Gemini 客户端空回

两处叠加：

1. **Gemini `ToStream` 只消费 `EventBlockDelta` / Finish / Usage**，忽略 `EventBlockStart`。若某条上游路径把文本放在 start/stop 而不是 delta，Gemini 客户端就是空 chunk。
2. **ToResponses 流** 同样可能只发 `response.completed`、没有 text item，客户端显示空。
3. Gemini 请求投影：contents 必须 user/model 交替且通常以 user 开头。Responses 历史若以 `function_call`（assistant）开头，转 Gemini 可能被上游丢弃或空生成。

先修 1+2（事件对齐），再用 fixture 验证 3。

---

## 3. 建议修复（请确认优先级）

原则：投影层按目标协议约束输出；损失进 `ProjectionReport`；不恢复 pairwise Chat 枢纽。

### P0 — 先止血（建议第一批一起做）

1. **ToChat 丢掉 `cache_control`**；纯 text 消息展成 string。OpenRouter cache 若要保留，只在 OpenRouter adaptor 补。
2. **ToClaude `tool_result.content` 不再把 JSON 对象/数组当 content**。string 原样；多块则只输出合法 Claude block。
3. **`irReq.Stream = info.GetIsStream()`**；Chat 方言写 `stream_options` 时同步 `stream=true`。
4. **Responses 流/非流：每个 output item 有稳定 `id`；所有 delta/done 带 `item_id`；`function_call` 同时有 `id` 与 `call_id`。**
5. **状态字段失败改为 400**，文案带上 `previous_response_id` 等字段名。不在本批做「拉 previous response 展开」。

### P1 — 思维链与空回

6. **ToResponses 请求**：assistant 消息按块拆 item  
   `reasoning`（think）→ `message`（text）→ `function_call`（tool_use），不再把 think 吞掉。
7. **ToResponses 流**：think 先 `output_item.added`（type=reasoning），再 `reasoning_summary_text.delta`，最后 item.done。
8. **Gemini `ToStream`**：BlockStart 开 part；delta 追加；Finish 一定带 candidate。避免空 `candidates[].content.parts`。
9. **Gemini contents**：必要时插入空 user 或合并，保证 user/model 交替（需 fixture 后再动，避免改坏 tool 多轮）。

### P2 — 加固

10. 投影损失打 debug 日志（已有雏形），P0 的 cache_control / 被展平的 tool JSON 要记 Report。
11. 补 golden / roundtrip：  
    Claude system+cache → Chat string；  
    Chat/Claude thinking+text+tool → Responses 三项；  
    JSON tool_result → Claude string content；  
    Gemini stream → Chat 必有 `stream:true`；  
    Chat/Claude 流 → Responses 事件含 `item_id`。
12. Responses 状态字段：维持硬失败（现状 Q5）。若以后要多轮，另开「展开 previous_response」任务，不塞进本批。

---

## 4. 需要你拍板的点

| 题 | 建议 | 备选 |
|---|---|---|
| Chat 是否完全禁止 content 数组？ | **仅 text-only 展 string**；有图/文件仍用数组（去掉 cache_control） | 一律 string（多模态会坏） |
| OpenRouter `cache_control` | 方言层再贴，ToChat 统一丢 | ToChat 看 ChannelType 特例（IR 投影不该认渠道） |
| 思维链进 Responses 用 `reasoning.summary` 还是 `encrypted_content`？ | **summary_text**（我们只有明文 thinking，没有 OpenAI 加密链） | 两边都写（无加密材料，第二份是空的） |
| `previous_response_id` | **继续硬失败，改 400** | 丢字段继续发（会让上游「失忆」） |
| Gemini 空回若仍在 P0 之后出现 | P1 第 8/9 条立刻跟 | 先抓一条真实 SSE 再改 |

---

## 5. 建议实施顺序

```
P0: A cache_control + D tool_result + G stream 标志 + F item_id + E 400
    → 可发布：Claude↔Chat 能聊，Claude 工具能跑，Gemini 流式 Chat 不再 400，
      Responses 客户端不再 item_id not found
P1: B/C 思维链拆 item + H Gemini/Responses 流式空块
    → 可发布：思维链可见，Gemini 客户端不再空回
P2: Report + golden
```

P0 五条互相独立，可以同一张提交。P1 动 Responses/Gemini 事件形状，要单独回归流式 golden。

---

## 6. 验收用例（落地时必须有）

- Claude `system: [{text, cache_control}]` → Chat：`messages[0].content` 为 string，无 `cache_control`
- Chat/Claude assistant `[thinking, text, tool_use]` → Responses input：3 个 item，顺序 reasoning / message / function_call
- Chat tool 角色 content 为 `{"ok":true}` → Claude：`tool_result.content` 为 string `"{\"ok\":true}"`（或单个 text block），不是 object
- Gemini `:streamGenerateContent` → Chat body：`stream=true` 且才允许 `stream_options`
- Chat 流式 text → Responses：`output_item.added` 的 id = 后续 `output_text.delta.item_id`
- Responses 带 `previous_response_id` → Chat：HTTP 400，消息含字段名，不是 500

---

## 7. 明确不做

- 不恢复 Claude↔Gemini 经 Chat 两跳
- 不把 IR 暴露成 HTTP API
- 本批不实现 previous_response 展开
- 不把 `extra_body.google` 重新解读成 Gemini thinking（Q7 已关）

---

## 8. 落地与实测（2026-08-26）

### 本地已改

- ToChat：丢掉 `cache_control`，纯 text 展成 string
- ToClaude：`tool_result.content` 保持 JSON 字符串，不再解成 object
- `convertRequestIR`：`info.GetIsStream()` 写入 `irReq.Stream`；OpenAI 方言 `stream_options` 与 `stream=true` 绑定
- ToResponses：thinking/text/tool 拆成独立 item；流式 `output_item.added` + delta/`done` 带同一 `item_id`；`function_call` 同时有 `id` 与 `call_id`
- 文本转换失败改为 HTTP 400
- Gemini ToStream 认 BlockStart；contents 若以 model 开头则补 user
- MiniMax 按 Moonshot 做双协议：Claude 客户端 native=claude（`/anthropic/v1/messages`），其它走 Chat URL；DoResponse 读 `TextNative()`

`GOWORK=off go test`：`relaykit/ir/...`、`relaykit/relayconvert`、`relay`、`relay/common`、`relay/channel/{openai,claude,gemini,minimax}` 通过。

### https://shapi.vip 线上（旧包）

Key 测的是**尚未包含本批修复**的部署。

| 路径 | 模型 | 结果 |
|---|---|---|
| POST `/v1/chat/completions` | glm-5.2 | 200，有 `reasoning_content`，工具会 `tool_calls` |
| POST `/v1/messages` | MiniMax-M3-福利 | 200 文本；工具 `tool_use`；tool_result 二次回合 200（MiniMax 兼容层比官方 Anthropic 松） |
| POST `/v1/messages` + cache_control | glm-5.2 | 200（该上游不拒数组；Console Go 仍会拒，本地已展 string） |
| POST `/v1/responses` | gpt-5.6-sol | 200；加 `reasoning.summary=auto` 才有 reasoning item |
| POST `/v1beta/models/gemini-3.7-flash:generateContent` | gemini-3.7-flash | 200，thought+text |
| Chat → MiniMax | MiniMax-M3-福利 | 200 |
| Claude → Gemini | gemini-3.7-flash | 200，thinking+text |
| Gemini 流式 → glm-5.2 | glm-5.2 | 200 SSE，有 thought delta |
| **Responses → glm-5.2** | glm-5.2 | **500 Internal server error**（E，线上未修） |
| **Responses + previous_response_id → glm-5.2** | glm-5.2 | **500**（应为 400，线上未修） |
| **Gemini/Responses → MiniMax-M3-福利** | MiniMax | **200 空 body**（URL/DoResponse 仍按客户端格式，线上未修） |

部署本批后再用同一组请求回归：Responses→Chat 应变 400/成功 JSON；Gemini/Responses→MiniMax 应有非空 body。
