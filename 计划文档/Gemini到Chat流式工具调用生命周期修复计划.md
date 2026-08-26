# Gemini 到 Chat 流式工具调用生命周期修复计划

## 1. 文档信息

- 状态：已实施，已验证
- 问题类型：跨协议流式响应生命周期接入错误
- 客户端协议：Gemini `generateContent` / `streamGenerateContent`
- 上游协议：OpenAI Chat Completions
- 实际故障方向：Gemini 请求转换为 Chat 请求后，Chat 流式工具调用响应无法正确投影回 Gemini `functionCall`
- 调查请求：`C:\Users\31290\Downloads\gemini-to-chat.txt`
- 调查源码版本：`45172d9`
- 调查构建产物：`bin/new-api.exe`，`vcs.revision=0180c3eb771a939311bb76ab3c6c2d8498475800`，`vcs.modified=true`
- 本文只制定实施计划，不包含代码修改。

## 2. 问题结论

提供的 Gemini 请求本身可以被当前转换器正确转换为 Chat Completions 请求：

- `systemInstruction` 被转换为 Chat `system` 消息；
- Gemini `user/model` 角色被转换为 Chat `user/assistant`；
- 5 个 `functionDeclarations` 均被转换为 Chat `tools[].function`；
- 工具名称、描述、JSON Schema、`required` 字段均被保留；
- Gemini `thinkingBudget=16000` 被语义降级为 Chat `reasoning_effort=high`；
- 流式标记由 Gemini URL/请求上下文通过转换元数据传递为 Chat `stream=true`。

因此，本次故障不是“Gemini 工具声明在请求转换时丢失”，而是：

> Chat 流式工具调用为了避免参数分片被错误地提前输出，已经在转换层改为缓冲到流结束后再生成 Gemini `functionCall`；但 OpenAI Chat 上游运行处理器仍使用旧的逐块转换入口，并且在 HTTP/SSE 流结束时没有执行 `FinalizeStreamResponse`，导致工具调用永久停留在缓冲区中。

实际运行链路为：

```text
Gemini streamGenerateContent 请求
              ↓
Gemini 请求正确转换为 Chat Completions 请求
              ↓
Chat 上游返回 tool_calls 参数分片
              ↓
IR 流状态缓冲工具名称、ID 和 arguments
              ↓
OpenAI 流处理器未执行 FinalizeStreamResponse
              ↓
没有 EventBlockStop / EventFinish
              ↓
Gemini 投影器不输出 functionCall
              ↓
客户端无法执行工具
```

## 3. 调查证据

### 3.1 原始请求中的工具声明完整

原始请求包含一个 Gemini `tools` 容器，共 5 个函数声明：

1. `eval_javascript`
2. `workspace_read_file`
3. `workspace_write_file`
4. `workspace_edit_file`
5. `workspace_shell`

以 `eval_javascript` 为例，转换后是合法的 Chat 工具定义：

```json
{
  "type": "function",
  "function": {
    "name": "eval_javascript",
    "description": "Execute JavaScript code using QuickJS engine...",
    "parameters": {
      "type": "object",
      "properties": {
        "code": {
          "type": "string",
          "description": "The JavaScript code to execute"
        }
      },
      "required": ["code"]
    }
  }
}
```

请求侧不存在工具名称、参数 Schema 或必填字段丢失。

### 3.2 当前工具流投影有意延迟输出

涉及文件：

- `relaykit/ir/project/chat/stream.go`
- `relaykit/ir/stream.go`
- `relaykit/ir/project/gemini/stream.go`

Chat 流解析器收到 `tool_calls` 后会：

1. 按工具调用的 source index、ID、名称建立独立状态；
2. 将 `arguments` 分片写入 `ToolStreamState`；
3. 收到 `finish_reason=tool_calls` 时调用 `SetFinish`；
4. 不在参数分片阶段直接输出 Gemini `functionCall`。

Gemini 流投影器只在以下事件出现时提交工具调用：

- `EventBlockStop`；
- `EventFinish` 触发的工具状态刷新。

这种延迟提交设计本身是正确的，可以避免：

- `{}` 被当作最终参数提前提交；
- 每个 arguments 分片生成一个独立 `functionCall`；
- 并行工具调用之间的 ID、名称和参数串线。

### 3.3 运行处理器没有完成状态机生命周期

涉及文件：

- `relay/channel/openai/relay-openai.go`
- `relay/channel/openai/helper.go`
- `relaykit/relayconvert/response_registry.go`
- `relaykit/relayconvert/ir_hub.go`

当前 `OaiStreamHandler` 的跨格式流处理仍通过：

```go
ConvertStreamResponse(...)
```

逐块转换 Chat SSE 数据。

在 HTTP/SSE 流结束时，`HandleFinalResponse` 对 Gemini/Claude 分支只是再次转换最后一个原始 chunk，没有建立并持有公开的 `ResponseStreamState`，也没有调用：

```go
FinalizeStreamResponse(...)
```

因此 `chat.FromStream` 写入状态的 `PendingFinish`、工具参数和 usage 无法转换为最终的 block stop、finish 和 usage 事件。

### 3.4 运行方式可稳定复现

按照当前运行处理器使用的旧入口，依次输入：

1. 工具名称和第一段 arguments；
2. 剩余 arguments；
3. `finish_reason=tool_calls`。

实际转换结果为：

```text
legacy chunk 1 => null
legacy chunk 2 => null
legacy chunk 3 => null
```

说明不是模型没有生成工具调用，而是转换器状态已经接收分片，却没有机会刷新成 Gemini `functionCall`。

### 3.5 状态式转换器测试可以通过

现有测试：

```text
relaykit/relayconvert/terminal_stream_test.go
TestChatToGeminiStatefulStreamEmitsOneStableToolCall
```

该测试使用：

```go
NewResponseStreamState(...)
ConvertStreamResponseChunk(...)
FinalizeStreamResponse(...)
```

并能正确得到一个参数稳定的 Gemini `functionCall`。

这进一步证明：

- IR 工具状态和 Gemini 工具投影主体逻辑可工作；
- 缺陷位于运行处理器与状态式转换器之间的生命周期接入；
- 当前测试只覆盖转换器，不覆盖 OpenAI 上游处理器的真实调用方式。

## 4. 影响范围

### 4.1 直接影响

以下条件同时成立时会触发：

1. 客户端使用 Gemini 流式协议；
2. 渠道最终选择 OpenAI Chat Completions 作为上游原生协议；
3. 上游模型返回流式 `tool_calls`；
4. 工具调用由 IR 投影回 Gemini `functionCall`。

典型表现：

- 普通文本增量可能正常返回；
- 工具名称和 arguments 已被上游生成；
- Gemini 客户端始终收不到可执行的 `functionCall`；
- 最后一段响应可能只表现为空数据或没有候选内容；
- Agent 停止在“应该执行工具”的阶段。

### 4.2 同源风险

OpenAI 上游处理器中的相同生命周期还服务于 Chat → Claude 等跨格式流转换，因此可能同时造成：

- Claude `tool_use` 延迟块未提交；
- Claude `message_delta` / `message_stop` 终止事件缺失；
- 上游未发送 `finish_reason` 时，已缓冲文本、工具或 usage 无法在 EOF 刷新；
- 最后一个原始 chunk 被重复转换，形成重复输出风险。

本次已确认采用共享生命周期修复，不为 Gemini 分支单独增加局部补丁。

### 4.3 不受直接影响

- Gemini → Chat 非流式请求和响应转换；
- 工具声明的 JSON Schema 转换；
- Chat 客户端到 Chat 上游的原样流式透传；
- Gemini 原生上游到 Gemini 客户端的同格式透传；
- 前端页面和前端 API 类型。

## 5. 已确认的修复原则

### 5.1 使用完整的状态式流生命周期

所有跨文本协议的多 chunk 流转换统一遵循：

```text
NewResponseStreamState
        ↓
ConvertStreamResponseChunk（每个 chunk 恰好一次）
        ↓
SetUsage（存在最终或估算 usage 时）
        ↓
FinalizeStreamResponse（EOF 时恰好一次）
```

不得继续混用：

```text
多个 ConvertStreamResponse + 最后一个 chunk 再转换一次
```

### 5.2 工具调用只允许最终提交一次

继续保留现有工具参数缓冲语义：

1. 工具名称、ID、参数按调用索引隔离；
2. arguments 分片阶段不输出 Gemini `functionCall`；
3. block stop、finish 或 EOF finalization 时输出一次；
4. 已提交的工具索引禁止重复提交；
5. 并行工具调用按稳定索引顺序输出。

不得通过恢复“收到合法 JSON 就立即输出”来修复本问题。

### 5.3 EOF 是正式的终止边界

不能依赖所有 OpenAI 兼容供应商都发送：

```json
{"finish_reason":"tool_calls"}
```

当 HTTP/SSE 正常到达 EOF 时，即使缺少 finish chunk，也必须：

- 停止所有打开的 IR block；
- 刷新已缓冲的工具调用；
- 生成目标协议的终止事件；
- 附带最终 usage；
- 将流状态标记为已完成。

### 5.4 每个上游 chunk 只处理一次

当前“保留最后一个 chunk，结束后再次转换”的结构必须被收敛，保证：

- 工具参数不会重复追加；
- 文本不会重复输出；
- finish 不会重复发送；
- usage 不会重复累计；
- 最后一个 chunk 与 Finalize 的职责明确分离。

### 5.5 目标协议共享生命周期，投影格式各自负责

流生命周期由公共响应转换层管理，协议投影器只负责：

- Chat chunk → IR event；
- IR event → Gemini/Claude/Responses/Chat 线格式。

不得在 Gemini 处理器内复制一套终止状态机，也不得在 Claude 处理器内维护另一套不一致逻辑。

## 6. 实施计划

### 阶段一：建立 OpenAI 上游跨格式流会话

#### 目标

让 `OaiStreamHandler` 对跨格式输出持有明确的 `ResponseStreamState`，而不是依赖 `RelayInfo.StreamHub` 和旧的逐块兼容入口隐式保存状态。

#### 计划修改

1. 在 OpenAI 流处理开始时，根据：
   - 源格式 `RelayFormatOpenAI`；
   - 客户端目标格式 `info.RelayFormat`；
   - 响应 ID、模型、创建时间和 usage 选项；
   创建一次 `ResponseStreamState`。
2. Chat → Chat 原样透传继续使用现有 Chat SSE 写出逻辑，不引入不必要的二次转换。
3. Chat → Gemini、Chat → Claude、Chat → Responses 等跨格式路径统一使用状态式 API。
4. 状态对象的所有权归一次 HTTP 流会话，不能在 chunk 之间重新创建。
5. 明确初始化失败时的错误返回和已写响应后的错误处理策略。

#### 建议重点文件

- `relay/channel/openai/relay-openai.go`
- `relay/channel/openai/helper.go`
- `relay/helper/text_project.go`
- `relaykit/relayconvert/response_registry.go`

### 阶段二：统一 chunk 处理和写出

#### 目标

每个 Chat SSE chunk 只解析、投影和写出一次。

#### 计划修改

1. 将跨格式 chunk 处理收敛到单一入口：
   - 解析 `dto.ChatCompletionsStreamResponse`；
   - 调用 `ConvertStreamResponseChunk`；
   - 使用 `WriteProjectedStreamResults` 依次写出所有目标协议事件。
2. 不再通过 `ConvertStreamResponse` 处理一个长期存在的多 chunk 会话。
3. 保留现有 token 计数、工具计费名称收集、音频 usage 提取等旁路逻辑，但不能让这些逻辑决定转换状态机是否结束。
4. 清理“最后一个原始 chunk 重新转换”的行为；如果仍需为 Chat 原样客户端保留最后一块延迟发送，则该逻辑必须与跨格式投影分离。
5. 确保一个源 chunk 产生多个目标事件时全部写出，不能只保留第一个或最后一个事件。

#### 建议重点文件

- `relay/channel/openai/relay-openai.go`
- `relay/channel/openai/helper.go`
- `relay/helper/text_project.go`

### 阶段三：在 EOF 统一 Finalize

#### 目标

将 SSE/HTTP EOF 作为跨格式流的可靠终止边界。

#### 计划修改

1. 流扫描结束后，先确定最终 usage：
   - 优先使用上游返回的有效 usage；
   - 否则使用当前文本和工具统计生成的估算 usage。
2. 在 Finalize 前通过 `ResponseStreamState.SetUsage` 写入最终 usage。
3. 调用一次 `FinalizeStreamResponse`。
4. 将 Finalize 产生的全部结果通过 `WriteProjectedStreamResults` 写出。
5. Finalize 成功后禁止：
   - 再次转换最后一个原始 chunk；
   - 再次调用 Finalize；
   - 再次发送目标协议终止事件。
6. 如果上游已经发送 finish chunk，仍由 EOF Finalize 统一完成 block stop、工具刷新和 usage；finish chunk只更新状态，不直接结束会话所有权。
7. 如果上游没有 finish chunk，Finalize 使用公共默认语义补齐结束事件。

#### 建议重点文件

- `relay/channel/openai/relay-openai.go`
- `relay/channel/openai/helper.go`
- `relaykit/relayconvert/response_registry.go`
- `relaykit/relayconvert/ir_hub.go`

### 阶段四：收敛旧兼容入口的职责

#### 目标

防止后续处理器再次误用 `ConvertStreamResponse` 管理多 chunk 会话。

#### 计划修改

1. 明确 `ConvertStreamResponse` 的兼容定位：
   - 仅用于无长期生命周期要求的单次转换；或
   - 由内部自动完成明确的一次性终止语义。
2. 对需要跨 chunk 状态的文本协议转换，文档和代码注释必须要求使用：
   - `NewResponseStreamState`；
   - `ConvertStreamResponseChunk`；
   - `FinalizeStreamResponse`。
3. 评估增加统一的高层流会话封装，避免各渠道重复编排三段 API。
4. 搜索所有 `ConvertStreamResponse` 调用点，逐一确认：
   - 是否处理多 chunk 会话；
   - 是否需要 Finalize；
   - 是否存在同类未提交状态。
5. 对已经迁移的运行处理器增加防回退测试。

#### 建议重点文件

- `relaykit/relayconvert/response_registry.go`
- `relaykit/relayconvert/ir_hub.go`
- `relay/channel/openai/helper.go`
- 其他 `ConvertStreamResponse` 运行调用点

### 阶段五：强化工具参数缓冲不变量

#### 目标

在生命周期修复后，确保最终输出仍然是一个稳定、完整的 Gemini `functionCall`。

#### 计划检查与调整

1. 保持按工具 source index 隔离：
   - call ID；
   - function name；
   - arguments fragments；
   - accumulated candidate；
   - latest complete snapshot；
   - emitted 状态。
2. 最终参数候选顺序保持确定性：
   - 标准增量拼接结果合法时优先；
   - 拼接无效时使用最新完整快照；
   - 最终仍无法解析时按既有兼容策略生成空对象或返回明确转换错误；
   - 不得输出多个相同工具调用。
3. 检查 `{}` 后完整快照、标准分片、累计快照和合法空参数四类场景。
4. 检查工具 block stop 和 EOF Finalize 同时出现时 `Emitted` 能阻止重复输出。
5. 检查并行工具调用排序和无 index 分片的歧义错误处理。

#### 建议重点文件

- `relaykit/ir/stream.go`
- `relaykit/ir/project/chat/stream.go`
- `relaykit/ir/project/gemini/stream.go`

### 阶段六：同步修复 Claude 等共享路径

#### 目标

避免只修 Gemini 分支后，OpenAI 上游到其他客户端协议继续缺少终止事件。

#### 计划修改

1. Chat → Claude 使用同一 `ResponseStreamState` 生命周期。
2. EOF 时确保 Claude 输出完整的：
   - `content_block_stop`；
   - `message_delta`；
   - `message_stop`。
3. 工具调用场景确保 Claude `tool_use` 只输出一次，input 为最终 JSON 对象。
4. Chat → Responses 若经过同一 OpenAI 流处理器，也必须使用状态式会话并在 EOF Finalize。
5. 保留各目标协议自身的线格式，不共享供应商专用字段。

#### 建议重点文件

- `relay/channel/openai/relay-openai.go`
- `relay/helper/text_project.go`
- `relaykit/ir/project/claude/stream.go`
- `relaykit/ir/project/responses/stream.go`

## 7. 测试计划

### 7.1 原始 Gemini 请求回归

使用 `gemini-to-chat.txt` 构建脱敏后的固定测试夹具，验证：

1. 5 个 Gemini 函数声明全部出现在 Chat `tools`；
2. `eval_javascript.parameters.required=["code"]`；
3. `workspace_shell.parameters.required=["command"]`；
4. `systemInstruction` 位于第一条 Chat system 消息；
5. `model` 角色转换为 `assistant`；
6. 流式上下文被保留；
7. 工具相关字段没有进入消息文本。

建议位置：

- `relaykit/relayconvert/request_registry_test.go`
- `relay/request_adapt_test.go`

### 7.2 Chat → Gemini 标准工具流

输入顺序：

```text
chunk 1: tool id + name + {"code":
chunk 2: "1+1"}
chunk 3: finish_reason=tool_calls
EOF
```

期望：

1. 参数分片阶段没有提前输出 `functionCall`；
2. EOF Finalize 输出一个 `functionCall`；
3. 名称为 `eval_javascript`；
4. 参数为 `{"code":"1+1"}`；
5. 不输出第二个重复调用；
6. Gemini 候选包含终止原因和 usage metadata。

### 7.3 `{}` 后完整快照

输入：

```text
{}
{"code":"1+1"}
finish
EOF
```

期望只输出：

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

不得先输出空参数调用。

### 7.4 上游无 finish_reason

输入有效工具参数后直接 EOF。

期望：

- Finalize 自动停止工具 block；
- 输出一次完整工具调用；
- 使用公共默认终止语义；
- 流不会静默结束。

### 7.5 finish 后独立 usage chunk

输入：

1. 工具参数；
2. `finish_reason=tool_calls`；
3. choices 为空、仅包含 usage 的 chunk；
4. EOF。

期望：

- 工具只输出一次；
- usage 不丢失；
- usage chunk 不造成第二次 finish；
- Finalize 后状态完成。

### 7.6 并行工具调用

至少两个不同 index 的工具调用交错返回参数。

期望：

- ID、名称和参数不串线；
- 输出顺序稳定；
- 每个工具只输出一次；
- 任一调用的空快照不覆盖另一调用参数。

### 7.7 最后一块不重复处理

为最后一个 chunk 同时包含 arguments 或 finish 的场景增加计数断言：

- 源 chunk 只进入转换器一次；
- 文本不重复；
- arguments 不重复拼接；
- `functionCall` 不重复；
- 终止事件不重复。

### 7.8 Chat → Claude 共享生命周期回归

验证：

- 文本流完整结束；
- thinking block 完整结束；
- tool_use 完整结束；
- usage 正确；
- EOF 无 finish 时仍有 `message_stop`。

### 7.9 非流式回归

确认以下非流式路径不受状态式流修改影响：

- Chat → Gemini 工具调用响应；
- Gemini → Chat 工具声明请求；
- Chat → Claude 工具调用响应；
- 相同协议直接返回。

### 7.10 处理器级集成测试

除 relaykit 单元测试外，必须增加至少一个 OpenAI 上游处理器级测试，模拟完整 SSE 生命周期：

```text
HTTP response body
  → StreamScannerHandler
  → OaiStreamHandler
  → ConvertStreamResponseChunk
  → FinalizeStreamResponse
  → Gemini SSE writer
```

该测试必须断言最终写出的 SSE 中存在且只存在一个完整 `functionCall`。仅测试 relaykit projector 不足以验收本问题。

## 8. 验收标准

### 8.1 功能标准

1. 提供的 Gemini 请求转换后，所有 Chat 工具声明完整存在。
2. Chat 上游流式工具调用最终可被 Gemini 客户端执行。
3. 一个逻辑工具调用只生成一个 Gemini `functionCall`。
4. `functionCall.args` 是最终完整 JSON，不是空快照或单个参数分片。
5. 上游缺少 `finish_reason` 时，EOF 仍能提交工具调用。
6. finish 后独立 usage chunk 不丢 usage、不重复工具调用。
7. 并行工具调用互不串线。
8. Chat → Claude 共享路径拥有完整终止事件。
9. 非流式路径行为不回退。

### 8.2 生命周期标准

每个跨格式流会话必须满足：

```text
创建状态一次
每个 chunk 转换一次
设置最终 usage 至多一次
Finalize 一次
终止事件发送一次
```

### 8.3 代码结构标准

1. 不增加 Gemini 专用的运行层临时状态机。
2. 不恢复工具参数即时提交。
3. 不让 `OaiStreamHandler` 同时使用状态式和旧式转换入口处理同一流。
4. 公共生命周期可以被 Gemini、Claude、Responses 投影复用。
5. 前端 API 不变，无需前端兼容分支。

## 9. 验证命令

实施完成后必须按照项目要求执行完整检查。

### 9.1 Go 格式化

```bash
gofmt -w <本次修改的所有 Go 文件>
git diff --check
```

### 9.2 Go 测试

```bash
make test
```

并针对关键模块单独执行：

```bash
cd relaykit
go test ./ir/project/chat ./ir/project/gemini ./ir/project/claude ./relayconvert -count=1
```

### 9.3 golangci-lint

根模块与 relaykit 子模块分别检查：

```bash
golangci-lint run ./...
cd relaykit && golangci-lint run ./...
```

### 9.4 OXLint

```bash
cd web
bun run lint
```

### 9.5 Vitest

```bash
cd web
bun run test
```

### 9.6 前端类型与编译

```bash
cd web
bun run build:check
```

### 9.7 后端编译

在前端产物准备完成后执行：

```bash
go build ./...
go build -o bin/new-api.exe .
```

### 9.8 构建产物一致性

```bash
git rev-parse HEAD
go version -m bin/new-api.exe
```

验收要求：

- `vcs.revision` 与实施修复后的提交一致；
- 不继续使用未包含本次生命周期修复的旧二进制；
- 明确说明 `vcs.modified` 状态，正式产物不应无意中以 dirty 工作区构建。

## 10. 计划涉及文件

预计重点文件：

```text
relay/channel/openai/relay-openai.go
relay/channel/openai/helper.go
relay/helper/text_project.go
relaykit/relayconvert/response_registry.go
relaykit/relayconvert/ir_hub.go
relaykit/ir/stream.go
relaykit/ir/project/chat/stream.go
relaykit/ir/project/gemini/stream.go
relaykit/ir/project/claude/stream.go
relaykit/relayconvert/terminal_stream_test.go
relaykit/relayconvert/request_registry_test.go
relay/request_adapt_test.go
```

最终以职责收敛后的实际实现为准，不要求为了匹配清单而修改无关文件。

## 11. 非目标

本次不计划：

1. 修改 Gemini 客户端请求格式；
2. 修改工具 JSON Schema 的公共定义；
3. 改变 `thinkingBudget → reasoning_effort` 的既定映射；
4. 让工具调用在 arguments 尚未稳定时提前输出；
5. 修改前端页面、国际化文案或前端 API；
6. 为单个模型增加供应商特例；
7. 通过删除流式工具调用能力规避问题。

## 12. 最终实施顺序

1. 增加能够复现运行层 `null/null/null` 行为的失败集成测试。
2. 在 OpenAI 上游处理器建立单一 `ResponseStreamState`。
3. 将跨格式 chunk 处理迁移到 `ConvertStreamResponseChunk`。
4. 删除最后一个原始 chunk 的重复跨格式转换。
5. 在 EOF 前写入最终 usage。
6. 在 EOF 调用一次 `FinalizeStreamResponse` 并写出所有结果。
7. 补齐 Gemini 工具调用、无 finish、独立 usage、并行工具调用测试。
8. 补齐 Claude 共享生命周期回归。
9. 检查并收敛其他多 chunk 场景对 `ConvertStreamResponse` 的误用。
10. 执行 gofmt、go test、golangci-lint、OXLint、Vitest、前后端编译和构建修订校验。
