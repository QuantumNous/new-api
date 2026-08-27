# Gemini 到 Chat 流式工具调用生命周期修复计划

## 1. 文档信息

- 状态：根因已确认，待实施第二轮修复
- 问题类型：OpenAI Chat 上游流投影入口的协议判断与流生命周期管理错误
- 客户端协议：Gemini `generateContent` / `streamGenerateContent`
- 上游协议：OpenAI Chat Completions
- 目标协议：Gemini `functionCall`
- 原始问题：Gemini 工具调用参数已经从 Chat SSE 接收并进入 IR 缓冲，但 EOF 时没有完成最终提交
- 新回归：修复后使用 `RelayMode` 判断上游协议，导致合法的 Gemini → Chat 流在读取 SSE 前被拒绝
- 原始调查版本：`0180c3eb771a939311bb76ab3c6c2d8498475800`
- 引入回归的提交：`a6d2b3e218ae98d416f7f8543c30526636da4b7d`
- 本计划范围：修正 OpenAI Chat 上游流处理器的职责边界、协议判断、统计和测试
- 本计划不包含：本轮只写计划，不修改代码

## 2. 最终问题结论

前一轮分析需要缩小范围。

### 2.1 仍然成立的核心问题

Gemini → OpenAI Chat 的跨格式流投影确实存在生命周期缺口：

```text
Gemini streamGenerateContent
        ↓
Gemini 请求转换为 Chat Completions 请求
        ↓
OpenAI Chat 上游返回 tool_calls 参数分片
        ↓
Chat 流解析器将工具名称、ID、arguments 写入 IR 状态
        ↓
Gemini 投影器等待 block stop 或 Finalize 再输出 functionCall
        ↓
旧的 OaiStreamHandler 在 EOF 没有调用 FinalizeStreamResponse
        ↓
Gemini 客户端收不到 functionCall
```

因此，原始故障不是：

- Gemini 工具声明转换失败；
- JSON Schema 丢失；
- Chat 上游没有生成工具调用；
- Chat chunk 解析失败。

而是：

> 旧的 `OaiStreamHandler` 使用逐块兼容入口处理 Chat → Gemini 流，却没有在 HTTP/SSE EOF 处提交 IR 中尚未关闭的工具 block。

### 2.2 前一轮分析中需要修正的部分

不能将 Claude、Responses 和 Gemini 简单归类为同一个未接入生命周期的问题。

在 `a6d2b3e` 之前，下列处理器已经具备独立的状态式生命周期：

- `OaiChatToResponsesStreamHandler`
- `OaiResponsesToChatStreamHandler`
- `ClaudeStreamHandler`
- Gemini 原生流处理器

这些处理器已经使用：

```text
NewResponseStreamState
        ↓
ConvertStreamResponseChunk
        ↓
FinalizeStreamResponse
```

因此，本次修复不应重新改造这些已经正常工作的处理器。

### 2.3 当前回归的独立原因

`a6d2b3e` 新增了类似以下判断：

```go
projected := info.RelayFormat != "" &&
    info.RelayFormat != types.RelayFormatOpenAI

if projected && info.RelayMode != relayconstant.RelayModeChatCompletions {
    return error
}
```

该判断混淆了两个不同概念：

- `RelayMode`：客户端入口路径或业务模式；
- `TextPlan.Native`：上游实际使用的原生文本协议。

真实 Gemini 请求的状态是：

```text
RelayMode   = RelayModeGemini
RelayFormat = RelayFormatGemini
TextPlan.Client = RelayFormatGemini
TextPlan.Native = RelayFormatOpenAI
```

因此，Gemini 请求经过转换后接收 OpenAI Chat SSE 是合法行为，不应因为 `RelayModeGemini != RelayModeChatCompletions` 被拒绝。

当前报错：

```text
cannot project OpenAI completions stream to gemini
```

发生在读取上游 SSE 之前，是新增加的前置协议判断造成的回归，不是上游返回了错误的 legacy Completions 响应。

## 3. 处理器与协议边界

### 3.1 协议字段职责

后续实现必须严格区分以下字段：

| 字段 | 职责 | 是否用于判断上游响应 DTO |
|---|---|---|
| `RelayMode` | 客户端入口路径、业务类型 | 否 |
| `RelayFormat` | 客户端目标响应协议 | 是，用于决定目标投影格式 |
| `TextPlan.Client` | 客户端文本协议 | 否，主要用于记录规划结果 |
| `TextPlan.Native` | 上游实际文本协议 | 是 |
| 处理器入口 | 当前函数被调用时承诺的上游协议 | 是 |

禁止继续使用 `RelayMode` 推断上游响应是 Chat、Responses、Claude 或 Gemini。

### 3.2 OpenAI Chat 上游的正确入口

`DoPlannedTextResponse` 已经根据 `TextPlan.Native` 选择响应处理器：

```text
Native = OpenAI Responses
        → OaiResponsesStreamHandler 或 OaiResponsesToChatStreamHandler

Native = OpenAI Chat
        → OaiStreamHandler
```

因此，`OaiStreamHandler` 的职责应明确为：

> 处理已经确认是 OpenAI Chat Completions 的上游流，并根据客户端目标格式选择原样透传或跨格式投影。

它不应再要求客户端入口 `RelayMode` 必须是 `RelayModeChatCompletions`。

### 3.3 Legacy Completions 的边界

OpenAI `/v1/completions` 属于另一种上游响应格式，不能与 Chat Completions 混用。

计划中需要明确：

1. TextPlan 选择 `RelayFormatOpenAI` 时，`OaiStreamHandler` 接收的是 Chat Completions SSE；
2. 未经过 TextPlan 的 legacy Completions 请求继续保留原有 Completions 处理行为；
3. legacy Completions 不得被误判为 Chat，也不得被直接投影到 Gemini、Claude 或 Responses；
4. 如果现有调用结构无法从入口区分两种上游响应，应拆分 Chat 和 Completions 流处理入口，或在进入处理器时显式传递 source format；
5. 不能通过再次读取 `RelayMode` 来补充上游响应格式判断。

## 4. 受影响路径矩阵

| 客户端 | 上游原生协议 | 修复前处理器 | 修复前状态 | 本次计划 |
|---|---|---|---|---|
| Gemini | OpenAI Chat | `OaiStreamHandler` | 旧逐块入口，EOF 未 Finalize | 修复 |
| Claude | OpenAI Chat | `OaiStreamHandler` | 可能缺少尾部终止，但工具 JSON 可增量输出 | 纳入回归验证，统一修复入口 |
| OpenAI Chat | OpenAI Chat | `OaiStreamHandler` | 原样透传 | 保持原样透传 |
| OpenAI | OpenAI Responses | `OaiChatToResponsesStreamHandler` | 已状态式 | 不重构 |
| Responses | OpenAI Chat | `OaiResponsesToChatStreamHandler` | 已状态式 | 不重构 |
| Gemini | OpenAI Responses | `OaiResponsesToChatStreamHandler` | 已状态式 | 不重构，仅回归验证 |
| Claude | OpenAI Responses | `OaiResponsesToChatStreamHandler` | 已状态式 | 不重构，仅回归验证 |
| Claude | Claude | `ClaudeStreamHandler` | 已状态式 | 不重构 |
| Gemini | Gemini | Gemini 原生处理器 | 同格式或已有专用转换 | 不重构 |
| OpenAI Completions | Legacy Completions | Legacy 处理入口 | 非 Chat 流 | 保持兼容并增加边界测试 |

说明：Claude → OpenAI Chat 在技术上也经过 `OaiStreamHandler`，因此需要验证其终止事件；但它与 Gemini 的可见故障不同。Claude 投影器可以在参数分片阶段输出 `input_json_delta`，而 Gemini 只有在 block stop 或 Finalize 时才生成最终 `functionCall`。

## 5. 修复目标

本次修复需要同时满足以下目标：

1. Gemini → OpenAI Chat 的合法流不再触发 `cannot project ...`；
2. OpenAI Chat 上游跨格式流使用一个明确的 `ResponseStreamState`；
3. 每个上游 Chat chunk 只解析和转换一次；
4. EOF 时恰好调用一次 `FinalizeStreamResponse`；
5. Gemini 工具参数在 EOF 时生成一个完整且稳定的 `functionCall`；
6. Claude、Responses 的既有状态式处理器不被重复改造或破坏；
7. token、工具调用计费和 usage 统计基于实际解析出的 Chat chunk，而不是基于客户端 `RelayMode`；
8. Chat 原样透传、legacy Completions 和跨格式投影之间的职责边界清晰；
9. 前端入口协议和 API 响应协议保持不变。

## 6. 实施计划

### 阶段一：先修正处理器入口判断

#### 目标

移除错误的客户端模式限制，使合法的 Gemini/Claude → OpenAI Chat 流能够进入投影处理。

#### 计划内容

1. 检查并移除 `OaiStreamHandler` 中基于以下条件的拒绝逻辑：

   ```go
   projected && info.RelayMode != relayconstant.RelayModeChatCompletions
   ```

2. 以处理器职责或 `info.TextNative()` 确认源格式为 OpenAI Chat，而不是使用客户端 `RelayMode`。
3. 保留目标格式判断：

   ```go
   projected := info.RelayFormat != "" &&
       info.RelayFormat != types.RelayFormatOpenAI
   ```

4. 如果源格式不是 OpenAI Chat，必须在更早的路由层进入对应处理器，而不是让 `OaiStreamHandler` 猜测响应 DTO。
5. 对 legacy Completions 保留独立处理路径，避免为了放开 Gemini 投影而错误地允许 Completions → Gemini。
6. 错误信息应反映真实的 source/target 协议，例如：

   ```text
   OpenAI Chat stream handler received unexpected source format
   ```

   不再使用“客户端不是 Chat 所以拒绝”的错误语义。

#### 重点文件

- `relay/channel/openai/relay-openai.go`
- `relay/channel/openai/text_plan_response.go`
- `relay/channel/openai/adaptor.go`
- `relay/common/text_plan.go`

### 阶段二：完善 OpenAI Chat 跨格式流状态

#### 目标

确保 `OaiStreamHandler` 对 Chat → Gemini、Chat → Claude 等目标协议使用单一状态对象。

#### 计划内容

1. 仅在目标协议与 OpenAI Chat 不同的情况下创建：

   ```go
   relayconvert.NewResponseStreamState(
       types.RelayFormatOpenAI,
       info.RelayFormat,
       options,
   )
   ```

2. 状态对象的生命周期覆盖整个 HTTP/SSE 响应流：

   ```text
   创建一次
   每个 chunk 使用一次
   EOF Finalize 一次
   ```

3. 每个 Chat chunk 的处理顺序固定为：

   ```text
   JSON 解析
       ↓
   metadata / usage / 统计信息更新
       ↓
   ConvertStreamResponseChunk
       ↓
   WriteProjectedStreamResults
   ```

4. 不得在 chunk 之间重新创建 state。
5. 不得在 EOF 再次把最后一个原始 chunk 传给 `ConvertStreamResponse` 或 `ConvertStreamResponseChunk`。
6. Chat → Chat 继续使用原样透传，不经过跨格式 IR 投影。
7. 如果一个源 chunk 产生多个目标事件，必须全部写出。
8. 上游响应解析失败时，区分：
   - 尚未写出响应时的结构化错误返回；
   - 已经开始流式响应后的终止和记录策略。

#### 重点文件

- `relay/channel/openai/relay-openai.go`
- `relay/channel/openai/helper.go`
- `relay/helper/text_project.go`
- `relaykit/relayconvert/response_registry.go`

### 阶段三：将 token、文本和工具统计与客户端模式解耦

#### 目标

修复当前 `switch info.RelayMode` 导致 Gemini/Claude 跨格式路径不执行 Chat chunk 统计的问题。

#### 现状问题

当前响应已经被解析为：

```go
dto.ChatCompletionsStreamResponse
```

但统计逻辑仍然类似：

```go
switch info.RelayMode {
case RelayModeChatCompletions:
    ProcessStreamResponse(...)
case RelayModeCompletions:
    processTokenData(...)
}
```

真实 Gemini 请求的 `RelayMode` 是 `RelayModeGemini`，因此即使上游实际返回 Chat chunk，也会跳过：

- 文本统计；
- reasoning 统计；
- 工具名称统计；
- 工具参数统计；
- 无 usage 时的 completion token 估算。

#### 计划内容

1. 对已经确认的 OpenAI Chat source，直接基于解析出的 `ChatCompletionsStreamResponse` 调用 Chat 统计逻辑。
2. 统计逻辑使用 source format 或处理器职责，而不是客户端 `RelayMode`。
3. 保证跨格式 Gemini 和 Claude 流也会执行：
   - `ProcessStreamResponse`；
   - 工具调用名称收集；
   - 文本和 reasoning 累计；
   - 无上游 usage 时的 token 估算。
4. legacy Completions 使用独立的 `CompletionsStreamResponse` 统计逻辑。
5. 工具调用数量按稳定的 choice/index 和 call ID 统计，避免：
   - 同一工具名称的多个参数 chunk 被重复计费；
   - 并行工具调用被合并；
   - 当前 chunk 的数组长度被错误地当作全局工具数量。
6. usage 估算只在上游没有有效 usage 时执行。
7. usage 后处理和工具计费不应影响 stream state 的终止顺序。

#### 重点文件

- `relay/channel/openai/relay-openai.go`
- `relay/channel/openai/helper.go`
- `relay/channel/openai/usage.go`
- `relay/common/tool_usage.go`
- `service/usage_helpr.go`

### 阶段四：在 EOF 统一完成 Finalize

#### 目标

把 HTTP/SSE EOF 作为正式终止边界，确保所有尚未结束的工具 block 和文本 block 都能提交。

#### 计划内容

1. SSE 扫描结束后确定最终 usage：
   - 优先使用上游有效 usage；
   - 没有有效 usage 时使用当前文本、reasoning 和工具统计估算；
   - 保持现有 usage 后处理逻辑。
2. 将最终 usage 写入 state：

   ```go
   streamState.SetUsage(usage)
   ```

3. Claude 目标继续向 `ClaudeConvertInfo` 同步 usage，但不改变公共 state 的终止流程。
4. 调用一次：

   ```go
   relayconvert.FinalizeStreamResponse(...)
   ```

5. 将 Finalize 返回的所有结果完整写出。
6. Finalize 成功后禁止：
   - 再次转换最后一个 chunk；
   - 再次调用 Finalize；
   - 重复发送工具调用；
   - 重复发送终止事件。
7. 上游有 `finish_reason` 时，finish chunk 只负责更新 IR 状态；最终 block stop、工具提交和目标协议终止由统一 Finalize 完成。
8. 上游没有 `finish_reason` 但正常 EOF 时，仍然必须：
   - 关闭打开的文本 block；
   - 刷新工具参数；
   - 生成目标协议终止事件；
   - 完成 usage。
9. 上游出现错误或异常 EOF 时，遵循现有错误响应策略，不把不完整工具参数伪装成成功的完整调用。

#### 重点文件

- `relay/channel/openai/relay-openai.go`
- `relaykit/relayconvert/response_registry.go`
- `relaykit/relayconvert/ir_hub.go`
- `relay/helper/stream_result.go`

### 阶段五：保持工具调用投影语义不变

#### 目标

只修复生命周期，不通过提前输出或局部 Gemini 分支补丁规避问题。

#### 计划内容

1. 工具名称、ID、arguments 按 source index 隔离。
2. arguments 分片阶段不提前生成 Gemini `functionCall`。
3. 工具调用只在 block stop 或 Finalize 阶段提交。
4. `{}` 快照不能覆盖后续完整参数。
5. 已提交的工具索引不能重复输出。
6. 并行工具调用需要保持：
   - name 不串线；
   - ID 不串线；
   - arguments 不串线；
   - 输出顺序稳定。
7. Claude 的 `input_json_delta` 增量输出行为保持不变。
8. Responses 的既有事件转换和终止事件保持不变。
9. 只有在现有 projector 测试暴露实际缺陷时，才调整 `relaykit` 的 IR 状态实现；不因为本次入口回归而重新改写已验证的 Gemini/Claude/Responses projector。

#### 重点文件

- `relaykit/ir/stream.go`
- `relaykit/ir/project/chat/stream.go`
- `relaykit/ir/project/gemini/stream.go`
- `relaykit/ir/project/claude/stream.go`

### 阶段六：隔离并验证已有状态式处理器

#### 目标

证明本次修复不会将已经正常的 Claude、Responses 路径重新纳入不必要的重构。

#### 计划内容

1. 不修改以下处理器的生命周期实现，除非回归测试证明存在独立缺陷：
   - `OaiChatToResponsesStreamHandler`；
   - `OaiResponsesToChatStreamHandler`；
   - `ClaudeStreamHandler`；
   - Gemini 原生流处理器。
2. 对这些处理器补充或保留回归测试，确认：
   - state 创建一次；
   - chunk 转换一次；
   - EOF Finalize 一次；
   - 终止事件只发送一次。
3. 不使用 `RelayMode` 改写或覆盖上游协议。
4. 不让 OpenAI Chat 处理器接管 Responses 或 Claude 原生 SSE。
5. 不将 Gemini 的特殊工具提交时机复制到 Claude 或 Responses 投影器。

## 7. 测试计划

### 7.1 真实 Gemini 元数据处理器测试

修正现有处理器测试中失真的上下文，不能手工把 Gemini 请求设置成 `RelayModeChatCompletions`。

测试上下文应至少包含：

```text
RelayMode          = RelayModeGemini
RelayFormat        = RelayFormatGemini
TextPlan.Client    = RelayFormatGemini
TextPlan.Native    = RelayFormatOpenAI
```

验证：

1. 不再返回 `cannot project OpenAI completions stream to gemini`；
2. 能够读取完整 Chat SSE；
3. 普通文本能够投影到 Gemini；
4. 工具调用能够在 EOF 生成 `functionCall`。

建议位置：

```text
relay/channel/openai/relay_openai_stream_projection_test.go
```

### 7.2 Gemini Chat 工具流

输入：

```text
chunk 1: tool id + name + {"code":
chunk 2: "1+1"}
chunk 3: finish_reason=tool_calls
EOF
```

期望：

1. 参数分片阶段不提前输出 `functionCall`；
2. EOF Finalize 输出一个完整 `functionCall`；
3. 名称为 `eval_javascript`；
4. 参数为 `{"code":"1+1"}`；
5. 工具调用不重复；
6. Gemini 响应包含正确的终止语义。

### 7.3 Gemini 无 finish_reason

输入有效工具参数后直接 EOF。

期望：

- EOF 自动关闭工具 block；
- 输出一次完整 `functionCall`；
- 使用公共默认终止语义；
- 不静默丢弃工具调用。

### 7.4 finish 后独立 usage chunk

输入：

```text
1. 工具参数 chunk
2. finish_reason=tool_calls
3. choices 为空、仅包含 usage 的 chunk
4. EOF
```

期望：

- 工具调用只输出一次；
- usage 不丢失；
- usage-only chunk 不重复触发 finish；
- EOF Finalize 幂等完成。

### 7.5 `{}` 快照与完整参数

输入：

```text
{}
{"code":"1+1"}
finish
EOF
```

期望只得到：

```json
{
  "functionCall": {
    "name": "eval_javascript",
    "args": {
      "code": "1+1"
    }
  }
}
```

不得先提交空参数调用。

### 7.6 并行工具调用

至少两个不同 index 的工具调用交错返回 arguments。

期望：

- 工具 ID、名称、参数不串线；
- 输出顺序稳定；
- 每个工具只输出一次；
- 一个工具的空快照不覆盖另一个工具的完整参数。

### 7.7 文本、reasoning 和 usage 统计

使用真实 Gemini、Claude 元数据验证：

1. Chat chunk 中的文本会参与 completion token 估算；
2. reasoning 会参与既有统计；
3. 工具名称和参数会参与工具 token 估算；
4. 上游有效 usage 优先于估算 usage；
5. Gemini/Claude 的 `RelayMode` 不会导致 Chat 统计逻辑被跳过；
6. 工具计费不会因多个 arguments chunk 重复发生。

### 7.8 最后一块只处理一次

对最后一个 chunk 同时包含 arguments、finish 或 usage 的场景增加断言：

- 源 chunk 只进入转换器一次；
- 文本不重复；
- arguments 不重复拼接；
- `functionCall` 不重复；
- 终止事件不重复；
- usage 不重复累计。

### 7.9 Claude → Chat 回归

使用真实 Claude 入口模式：

```text
RelayMode       = RelayModeUnknown
RelayFormat     = RelayFormatClaude
TextPlan.Native = RelayFormatOpenAI
```

验证：

- Claude `tool_use` 输入增量保持正常；
- `content_block_stop`、`message_delta`、`message_stop` 完整；
- 无 finish 的 EOF 仍能生成终止事件；
- usage 正确；
- 不因 `RelayModeUnknown` 被拒绝。

### 7.10 Responses 专用处理器回归

确认以下路径不受本次改动影响：

- OpenAI Chat → OpenAI Responses；
- OpenAI Responses → Chat；
- Gemini → OpenAI Responses；
- Claude → OpenAI Responses。

验证 Responses 事件顺序、工具调用、usage 和终止事件保持原有行为。

### 7.11 原样 Chat 透传

使用：

```text
RelayFormat = RelayFormatOpenAI
TextPlan.Native = RelayFormatOpenAI
```

验证：

- 不创建跨格式 state；
- 不执行 IR 二次投影；
- 每个 Chat chunk 只发送一次；
- usage-only chunk 的隐藏规则保持不变；
- 最终 `data: [DONE]` 只发送一次。

### 7.12 Legacy Completions 边界测试

验证 legacy Completions：

1. 仍然使用 `CompletionsStreamResponse` 解析；
2. 不被错误当成 Chat Completions；
3. 不因为移除 Gemini/Chat 模式限制而被错误投影到 Gemini；
4. 原有 OpenAI Completions 客户端行为不回退。

### 7.13 处理器级完整 SSE 集成测试

必须覆盖真实调用链：

```text
HTTP response body
  → StreamScannerHandler
  → OaiStreamHandler
  → ChatCompletionsStreamResponse
  → ConvertStreamResponseChunk
  → FinalizeStreamResponse
  → Gemini SSE writer
```

测试不应只调用 relaykit projector，还必须断言最终写出的 SSE：

- 包含一个完整 `functionCall`；
- 不包含错误 `cannot project ...`；
- 工具调用和终止事件不重复；
- usage 或估算 usage 存在。

## 8. 验收标准

### 8.1 Gemini 功能验收

1. 真实 `RelayModeGemini` 请求能够进入 OpenAI Chat 流投影。
2. 原始 Gemini 请求中的 5 个工具声明仍完整转换为 Chat 工具。
3. Chat 上游工具参数最终能够生成 Gemini `functionCall`。
4. `functionCall.args` 是完整 JSON，而不是 `{}` 或单个参数分片。
5. 上游没有 `finish_reason` 时，EOF 仍能提交工具调用。
6. finish 后独立 usage chunk 不丢失 usage、不重复工具调用。
7. 并行工具调用互不串线。
8. 当前错误 `cannot project OpenAI completions stream to gemini` 不再出现于合法 Gemini → Chat 请求。

### 8.2 生命周期验收

每个跨格式 Chat 流会话必须满足：

```text
创建 state 一次
每个 chunk 转换一次
最终 usage 设置至多一次
Finalize 一次
终止事件发送一次
```

### 8.3 协议边界验收

1. 不使用 `RelayMode` 判断 OpenAI 上游响应 DTO。
2. `TextPlan.Native` 或处理器入口负责描述上游协议。
3. Chat、Responses、Claude、Gemini 原生处理器职责不混用。
4. Legacy Completions 不与 Chat Completions 共用错误的解析路径。
5. 客户端入口协议、上游实际协议和响应目标协议不互相覆盖。

### 8.4 回归验收

1. Claude 原有工具调用行为保持正常。
2. Responses 原有流式事件顺序保持正常。
3. OpenAI Chat 原样透传不重复、不延迟异常。
4. 非流式 Chat、Claude、Gemini 请求不受影响。
5. 前端 API、页面和国际化资源无需修改。

## 9. 预计涉及文件

重点运行层文件：

```text
relay/channel/openai/relay-openai.go
relay/channel/openai/helper.go
relay/channel/openai/text_plan_response.go
relay/channel/openai/adaptor.go
relay/common/text_plan.go
relay/helper/text_project.go
```

统计和 usage 相关文件：

```text
relay/channel/openai/usage.go
relay/common/tool_usage.go
service/usage_helpr.go
```

测试文件：

```text
relay/channel/openai/relay_openai_stream_projection_test.go
relay/channel/openai/stream_tool_billing_test.go
relay/channel/openai/chat_via_responses_test.go
relaykit/relayconvert/terminal_stream_test.go
relaykit/relayconvert/request_registry_test.go
relay/request_adapt_test.go
```

只有在测试证明 IR projector 本身存在独立缺陷时，才修改：

```text
relaykit/ir/stream.go
relaykit/ir/project/chat/stream.go
relaykit/ir/project/gemini/stream.go
relaykit/ir/project/claude/stream.go
relaykit/relayconvert/response_registry.go
```

## 10. 非目标

本次不计划：

1. 修改 Gemini 客户端请求协议；
2. 修改 Gemini 工具声明和 JSON Schema 的公共定义；
3. 修改 `thinkingBudget → reasoning_effort` 的既定映射；
4. 让工具调用在 arguments 尚未稳定时提前输出；
5. 重构已经正常的 Responses 专用流处理器；
6. 重构已经正常的 Claude 原生流处理器；
7. 将 Gemini 的工具提交策略复制到 Claude 或 Responses；
8. 通过删除流式工具调用能力规避问题；
9. 通过把所有客户端 `RelayMode` 强行改成 Chat 来绕过判断；
10. 修改前端页面、前端 API 或国际化资源；
11. 为单个模型增加供应商专用分支。

## 11. 实施顺序

1. 先修正处理器级测试上下文，使用真实的 Gemini、Claude 元数据。
2. 增加当前回归的失败测试，确认 `RelayModeGemini` 不应被拒绝。
3. 移除或重构 `RelayMode` 上游协议判断。
4. 明确 Chat 与 legacy Completions 的源协议入口。
5. 保留并检查 OpenAI Chat 跨格式 state 的单次创建。
6. 将 Chat chunk 统计改为依据实际 source，而不是客户端 `RelayMode`。
7. 删除跨格式路径对最后一个原始 chunk 的重复转换。
8. 确认 EOF 只执行一次 `FinalizeStreamResponse`。
9. 补齐 Gemini 工具流、无 finish、usage、并行工具和重复处理测试。
10. 补齐 Claude、Responses、原样 Chat 和 legacy Completions 回归测试。
11. 执行完整静态检查、测试、编译和构建验证。
12. 提交并推送修复，重新构建正式二进制并确认构建版本一致。

## 12. 验证命令

实施完成后按照项目要求执行以下检查。

### 12.1 Go 格式与差异检查

```bash
gofmt -w <本次修改的所有 Go 文件>
git diff --check
```

### 12.2 Go 测试

```bash
make test
```

根模块和 relaykit 关键模块分别验证：

```bash
go test ./... -count=1
cd relaykit
go test ./... -count=1
```

### 12.3 golangci-lint

```bash
golangci-lint run ./...
cd relaykit
golangci-lint run ./...
```

### 12.4 OXLint、Vitest 和前端构建检查

```bash
cd web
bun run lint
bun run test
bun run build:check
```

### 12.5 后端编译

```bash
go build ./...
go build -o bin/new-api.exe .
```

### 12.6 提交和构建产物校验

```bash
git status --short
git rev-parse HEAD
go version -m bin/new-api.exe
```

正式构建验收要求：

- `vcs.revision` 与最终提交一致；
- `vcs.modified=false`；
- 二进制包含最新修复；
- 不使用旧提交或 dirty 工作区构建正式产物。
