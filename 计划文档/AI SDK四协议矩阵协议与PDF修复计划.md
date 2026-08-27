# AI SDK 四协议矩阵协议与 PDF 修复计划

## 1. 文档信息

- 状态：问题已定位，待实施
- 调查基线：`c9a2e52f394711e73aac895fced1e4848d0be54a`
- 服务端版本证据：报告响应头中的 `x-new-api-version=main-c9a2e52`
- 唯一有效报告：`tests/ai-sdk-protocol-matrix/artifacts/2026-08-27T20-41-40-838Z/`
- 运行结果：48 个场景，25 PASS、6 WARN、17 FAIL
- 输出上限：所有应用层调用统一为 `maxOutputTokens=131072`
- 本文范围：只制定修复方案和实施计划，不修改生产代码

术语约定：本文中的“A → B”表示客户端使用 A 协议，NewAPI 将请求转换为 B 原生上游协议，并把 B 的响应投影回 A。

## 2. 调查结论

本轮报告已经排除了输出 token 上限的干扰。所有 conversation 失败都不是 `finishReason=length`，而是以下四类稳定的协议问题：

1. Responses 的 `developer` 指令角色被原样发送给不支持该角色的 Chat 上游；
2. Gemini 原生工具调用没有 ID，投影到 Chat/Claude 时也没有补充协议要求的 ID；
3. Claude/Gemini 上游工具调用投影为 Responses SSE 时，只发送了部分生命周期事件；
4. PDF 的 data URL、纯 base64、MIME、文件名和 URL/ID 没有通过统一媒体语义转换。

此外还有一项必须与转换缺陷分开处理的能力边界：

5. 报告中的 Chat 原生模型 `kimi-k2.7-code` 不接受 Chat message 的 `type=file` PDF part。该问题不能通过继续透传同一个 part 解决，应进入能力判断或显式文档降级链路。

报告中的 6 个 WARN 都是模型没有足够明确陈述“最终现金转移余额为零”，不是线协议错误；本计划不通过修改转换器来操纵模型措辞。

## 3. 问题矩阵与优先级

| 优先级 | 问题 | 直接失败路径 | 连带失败 | 结论 |
| --- | --- | --- | --- | --- |
| P0 | Responses `developer` 未映射 | Responses → Chat conversation | Responses → Chat PDF、PNG | 请求侧角色语义错误 |
| P0 | Gemini 工具调用缺 ID | Chat → Gemini、Claude → Gemini conversation | 工具结果无法可靠回放 | 响应侧身份补全缺失 |
| P0 | Responses SSE 生命周期不完整 | Responses → Claude、Responses → Gemini conversation | 后续上下文回忆全部失败 | 响应投影协议不完整 |
| P1 | PDF 媒体语义不完整 | Chat/Claude/Gemini → Responses；Chat/Responses → Claude/Gemini | 多种 400 错误 | IR 和目标投影缺陷 |
| P1 | Chat 目标不支持 PDF file part | 任意来源 → Chat PDF | Responses → Chat 还被角色问题提前阻断 | 模型/渠道能力边界 |
| P2 | 缺少可观测的转换证据 | 所有跨格式问题 | 根因只能靠 request ID 关联服务端日志 | 诊断能力不足 |

关键请求 ID：

- Responses → Chat `developer`：`202608272046520770786898268d9d6HpUpSQDN`
- Chat → Gemini 工具 ID：`202608272046295261384528268d9d6832GAUr4`
- Claude → Gemini 工具 ID：`202608272052376123860698268d9d6ASZzUtYZ`
- Responses → Claude 工具 SSE：`202608272049075717003228268d9d6WmBjVkFV`
- Responses → Gemini 工具 SSE：`202608272049376240704868268d9d6494qKOqX`
- Chat → Responses PDF：`202608272043291142574168268d9d65GPgdONU`
- Claude → Responses PDF：`202608272051041783749098268d9d6NOWctw8o`
- Gemini → Responses PDF：`202608272054485701472088268d9d6lxAnWuJw`
- Chat → Gemini PDF：`202608272046476411071798268d9d6KgB0Lc0t`
- Responses → Claude PDF：`202608272049219343550088268d9d6Ql0D9Gaw`

## 4. 详细根因

### 4.1 Responses `developer` 角色没有进入协议无关的指令语义

Responses AI SDK 发送：

```json
{
  "input": [
    {
      "role": "developer",
      "content": "..."
    }
  ]
}
```

Responses → Chat 后，上游收到的仍是：

```json
{
  "role": "developer"
}
```

Kimi 返回：

```text
Invalid request: role 'developer' is not allowed
```

当前 IR 只声明了：

```text
system / user / assistant / tool
```

但 `relaykit/ir/project/responses/input.go` 会直接执行类似：

```go
role := ir.Role(rawRole)
```

因此未声明的 `developer` 字符串仍可进入 IR，并最终由 `relaykit/ir/project/chat/block.go` 原样写回 Chat。

这不是图片或 PDF 编码问题。Responses → Chat 的 conversation、PDF 和 PNG 在首个请求中都被同一个角色错误阻断。

#### 目标语义

跨协议转换时，Responses 的 `developer` 应被视为高优先级指令，并映射到目标协议可表达的指令位置：

- Responses → Chat：默认映射为 `system`，而不是假设所有 Chat 兼容上游都支持 `developer`；
- Responses → Claude：进入顶层 `system`；
- Responses → Gemini：进入 `systemInstruction`；
- Responses → Responses 同格式透传：保持客户端原始形状，不额外改写。

不建议在 Kimi 模型名上增加单点特判。应在 Responses 入站的协议语义层完成规范化，或为 IR 增加明确的 instruction/developer 语义并由各目标统一投影。

### 4.2 Gemini 工具调用没有原生 ID，ID 必须由网关补全

Gemini `functionCall` 原生结构主要包含：

```json
{
  "functionCall": {
    "name": "analyze_parking_ledger",
    "args": {}
  }
}
```

它不提供 Chat `tool_calls[].id` 或 Claude `tool_use.id`。

当前流式路径中：

- `relaykit/ir/project/gemini/stream.go` 使用空 ID 调用 `EnsureTool`；
- `relaykit/ir/project/chat/stream.go` 将空 ID写入 `tool_calls`；
- `relaykit/ir/project/claude/stream.go` 将空 ID写入 `tool_use`。

报告中的实际错误：

#### Chat → Gemini

Chat SSE 中出现：

```json
{
  "tool_calls": [
    {
      "index": 1,
      "type": "function",
      "function": {
        "name": "analyze_parking_ledger",
        "arguments": ""
      }
    }
  ]
}
```

缺少 `id` 后，AI SDK 的完整结果 promise 无法正常完成，最终超时。

#### Claude → Gemini

Claude SSE 中出现：

```json
{
  "type": "content_block_start",
  "content_block": {
    "type": "tool_use",
    "name": "analyze_parking_ledger",
    "input": {}
  }
}
```

AI SDK 明确报错：

```text
content_block.id: expected string, received undefined
```

#### 目标语义

网关必须为“不提供工具 ID 的源协议”生成一个稳定、可移植、可回放的规范 ID：

```text
call_<stable-stream-scope>_<source-index>
```

要求：

1. 同一个逻辑工具调用的所有分片使用同一个 ID；
2. 并行工具按 source index 隔离；
3. 流式与非流式共用同一 ID 生成规则；
4. ID 只包含安全 ASCII 字符，不含空白和控制字符；
5. ID 长度受控，避免目标供应商的长度限制；
6. 后续 Chat `tool`、Claude `tool_result`、Responses `function_call_output` 能使用同一个 ID；
7. 不用工具名作为唯一 ID，避免并行调用同名工具时冲突；
8. 不在每个响应投影器中各自随机生成，防止 Chat、Claude、Responses 结果不一致。

当前非流式 `adaptIRResponse` 已经会为缺失 ID 的工具调用生成 UUID，但流式路径没有等价能力。两套逻辑应合并为公共工具身份分配器。

### 4.3 Responses SSE 只输出了 delta，没有输出完整 item 生命周期

当前 Responses 投影生成的工具事件大致为：

```text
response.created
response.output_item.added(function_call)
response.function_call_arguments.delta
response.function_call_arguments.done
response.completed
```

缺少至少以下关键事件或有效负载：

```text
response.output_item.done
```

同时：

- reasoning 没有 `reasoning_summary_text.done`、`reasoning_summary_part.done`、`output_item.done`；
- message 没有完整的 content part 生命周期；
- `response.completed.response.output` 为 `null`，没有完整 completed items；
- done 事件没有携带累计 arguments/text；
- 当前 DTO 没有完整表达原生 Responses done 事件所需的 `text`、`arguments`、`sequence_number` 等字段；
- 当前 `ToStream` 把大部分关闭行为推迟到 `EventUsage`，忽略了 `EventBlockStop` 的协议语义。

原生 Responses 成功基准的工具生命周期为：

```text
response.output_item.added
response.function_call_arguments.delta ...
response.function_call_arguments.done
response.output_item.done
response.completed（包含完整 output）
```

reasoning 成功基准为：

```text
response.output_item.added(reasoning)
response.reasoning_summary_part.added
response.reasoning_summary_text.delta ...
response.reasoning_summary_text.done
response.reasoning_summary_part.done
response.output_item.done
```

AI SDK 只有在 item 完整关闭后才会把函数调用组装为可执行的 tool call。当前 Responses → Claude/Gemini 场景虽然 HTTP 200，但 AI SDK 观察到 0 次工具执行。

后续的：

- `final-marker-recall`；
- `final-tool-recall`；
- `final-puzzle-recall`；

都是工具没有执行、没有第二步模型调用造成的连带失败，不应被误判为独立的上下文丢失问题。

#### Responses 入站还存在关联键混用风险

Responses 同时存在：

- `item.id` / `item_id`：输出 item 的身份；
- `call_id`：函数调用与函数结果的逻辑关联身份。

当前 `response.function_call_arguments.delta` 路径可能把 `item_id` 再次传给 `EnsureTool`，从而覆盖此前保存的 `call_id`。即使本轮报告没有直接因该点失败，也应在本次生命周期重构中一并修正。

### 4.4 PDF 没有统一的媒体规范化模型

四种客户端发送 PDF 的形状不同：

#### Chat

```json
{
  "type": "file",
  "file": {
    "filename": "matrix-document.pdf",
    "file_data": "data:application/pdf;base64,JVBERi0..."
  }
}
```

#### Responses

```json
{
  "type": "input_file",
  "filename": "matrix-document.pdf",
  "file_data": "data:application/pdf;base64,JVBERi0..."
}
```

#### Claude

```json
{
  "type": "document",
  "source": {
    "type": "base64",
    "media_type": "application/pdf",
    "data": "JVBERi0..."
  }
}
```

#### Gemini

```json
{
  "inlineData": {
    "mimeType": "application/pdf",
    "data": "JVBERi0..."
  }
}
```

当前 `ir.MediaBlock` 只有 kind、MIME、source、URL、Data、FileID，没有文件名。各解析器和投影器对 data URL 的处理也不一致：

1. Chat `file_data` 被整体保存到 `Media.Data`，没有拆出 MIME 和纯 base64；
2. Responses `input_file` 只读取 `file_url/file_id`，忽略 `file_data/filename`；
3. Responses 出站只写 `file_url/file_id`，无法生成 base64 `input_file`；
4. Claude/Gemini 出站把带 `data:...;base64,` 前缀的整串值放入只接受纯 base64 的字段；
5. Chat/Responses 的 `filename` 没有进入 IR，投影到 Responses 时无法完整构造 `input_file`；
6. URL、data URL、纯 base64、file ID 没有“只能选择一个 locator”的统一校验；
7. 旧的 context-aware 直连转换器会使用 `ResolveBase64Data`，统一 IR 路径却没有在投影前接入同等的媒体解析能力；
8. `OpenAIResponsesRequest.ParseInput` 和 token/file 元数据路径也忽略 `file_data`，导致转换与计量使用不同的媒体理解。

这些缺陷分别对应报告中的错误：

- Chat/Claude/Gemini → Responses：`input_file` 缺少 `file_id/file_data/file_url`；
- Chat → Claude：data URL 被当作纯 base64；
- Chat → Gemini：`inline_data.data` 收到完整 data URL；
- Responses → Claude：data URL 被当成下载 URL；
- Responses → Gemini：请求参数无效或 base64/MIME 结构错误。

### 4.5 Chat 目标的 PDF 失败属于能力边界

报告中的 Kimi Chat 上游返回：

```text
the message ... contains an invalid part type: file
```

涉及：

- Chat → Chat PDF；
- Claude → Chat PDF；
- Gemini → Chat PDF；
- Responses → Chat PDF 在修复 `developer` 后也会进入同一能力边界。

Chat 协议的兼容实现并不保证所有模型都支持 `type=file`。因此不能只把 PDF 正确规范化后继续发送同一种 file part，并期待 Kimi 接受。

本计划推荐的默认行为是：

1. 建立目标模型/渠道媒体能力判断；
2. 对明确不支持 Chat PDF 的目标，在请求出站前返回结构化的 `capability_unsupported`，不要再把无效 part 发给上游；
3. 测试矩阵把该结果标记为 `CAPABILITY UNSUPPORTED`，与协议转换 FAIL 分开；
4. 如产品要求 Chat 目标也读取 PDF，再单独实施“文档桥接”：PDF 安全解析后转文本或逐页图片，再投影为 Chat 支持的 text/image parts。

不建议默认静默做 PDF → 图片/文本，因为这会引入：

- 页数和分辨率限制；
- OCR/文本抽取准确性；
- PDF 解析器安全面；
- token 和图片计费变化；
- 文件版式与原文语义损失。

## 5. 统一目标设计

### 5.1 指令角色

公共 IR 应只保存协议无关的角色语义。

建议规则：

| 来源角色 | IR 语义 | Chat | Responses | Claude | Gemini |
| --- | --- | --- | --- | --- | --- |
| `system` | instruction | `system` | `instructions` 或 system item | 顶层 `system` | `systemInstruction` |
| `developer` | instruction | 默认 `system` | 同格式保持原状；跨格式可归一化 | 顶层 `system` | `systemInstruction` |
| `user` | user | `user` | `user` | `user` | `user` |
| `assistant/model` | assistant | `assistant` | `assistant` | `assistant` | `model` |
| tool result | tool result | `tool` | `function_call_output` | user 下的 `tool_result` | `functionResponse` |

如果未来确实需要保留 `system` 与 `developer` 的优先级差异，应为 IR 增加明确的 instruction priority，而不是让任意字符串角色穿透。

### 5.2 工具调用身份

新增公共工具 ID 规范化入口，流式状态至少保存：

```text
source index
block index
provider item ID
canonical call ID
function name
arguments fragments
emitted/closed 状态
```

其中 `provider item ID` 与 `canonical call ID` 必须分开。

ID 生成建议：

```text
call_<短哈希或会话随机前缀>_<source-index>
```

- 同一 stream state 中生成一次并缓存；
- 非流式响应使用同一个 helper；
- 目标 Responses 的 item ID 可由 call ID 派生为 `fc_<call-id>`，但不能反向覆盖 call ID；
- Gemini 目标虽然不在线协议中输出 ID，IR 内仍保留 ID，用于工具结果回放和跨协议再次转换。

### 5.3 Responses SSE 状态机

Responses 投影器必须以 block 生命周期为准，而不是只在 usage 到达时批量猜测关闭事件。

#### Text block

```text
EventBlockStart
  → response.output_item.added(message)
  → response.content_part.added(output_text)

EventBlockDelta
  → response.output_text.delta

EventBlockStop
  → response.output_text.done(text=累计文本)
  → response.content_part.done
  → response.output_item.done(item.status=completed)
```

#### Reasoning block

```text
EventBlockStart
  → response.output_item.added(reasoning)
  → response.reasoning_summary_part.added

EventBlockDelta
  → response.reasoning_summary_text.delta

EventBlockStop
  → response.reasoning_summary_text.done(text=累计摘要)
  → response.reasoning_summary_part.done
  → response.output_item.done(item.status=completed)
```

#### Function call block

```text
EventBlockStart
  → response.output_item.added(function_call, call_id, name)

EventBlockDelta
  → response.function_call_arguments.delta

EventBlockStop
  → response.function_call_arguments.done(arguments=累计 JSON)
  → response.output_item.done(item.status=completed, arguments=累计 JSON)
```

#### Terminal

```text
EventFinish / EventUsage / EOF Finalize
  → response.completed
```

`response.completed.response.output` 必须包含所有 completed items，usage 使用最终上游值或既有估算值。所有事件应维护单调递增的 `sequence_number`。

### 5.4 统一媒体 IR

建议扩充 `ir.MediaBlock`：

```go
type MediaBlock struct {
    Kind      MediaKind
    MIME      string
    Filename  string
    Source    MediaSourceKind
    URL       string
    Data      string // 只保存纯 base64，不保存 data URL 前缀
    FileID    string
    Detail    string
}
```

不变量：

1. `Data` 一律为纯 base64；
2. data URL 在入站时立即拆为 MIME + Data；
3. URL、Data、FileID 三种 locator 至多一个有效；
4. `Filename` 独立保存；
5. MIME 优先取协议显式字段，其次 data URL，其次文件名/内容嗅探；
6. file ID 只在同供应商或有明确文件迁移能力时跨协议使用；
7. 大文件不在多个中间对象中反复复制完整 base64。

目标投影规则：

| 目标 | Base64 PDF | URL PDF | File ID |
| --- | --- | --- | --- |
| Chat | `type=file` + data URL，仅在目标能力允许时 | 目标支持时 URL/file；否则 materialize 或拒绝 | 仅同供应商能力允许 |
| Responses | `input_file.file_data=data:...` + `filename` | `input_file.file_url` | `input_file.file_id` |
| Claude | `document.source.type=base64` + 纯 base64 + MIME | 支持 URL 时用 URL，否则解析为 base64 | 支持 Files API 时才保留 |
| Gemini | `inlineData` + 纯 base64 + MIME | 通用 HTTP URL先解析为 inlineData；原生 file URI 才用 fileData | 不能把其他供应商 ID 当 Gemini URI |

### 5.5 Context-aware 媒体物化

统一 IR 转换需要恢复旧转换器已有的 context-aware 文件解析能力。

计划把 `context.Context` 传入统一请求转换过程：

```text
ConvertRequest
  → convertRequestIR(ctx, info, from, target, request)
  → normalize/materialize media
  → project.ToRequest(target)
```

媒体物化继续复用：

- `types.FileSource`；
- `service.LoadFileSource` / `GetBase64Data`；
- 请求级缓存与清理；
- 文件下载大小限制；
- SSRF/下载安全策略；
- MIME 嗅探。

协议投影包本身不直接发起网络请求。下载和解码放在 relayconvert 的准备阶段，通过现有 resolver 注入。

## 6. 实施计划

### 阶段一：先补失败测试和线协议夹具

在修改生产代码前，用本轮 artifact 固化最小线协议夹具：

1. Responses `developer` → Chat；
2. Gemini tool call → Chat SSE；
3. Gemini tool call → Claude SSE；
4. Claude/Gemini tool call → Responses SSE；
5. 四种 PDF 入站形状；
6. Responses 原生成功 SSE 的完整事件顺序。

测试夹具不保存完整大 base64，可使用小型 `%PDF` 内容验证结构，并用现有 `matrix-document.pdf` 做路由级 SHA-256 回归。

重点文件：

```text
relaykit/ir/project/responses/roundtrip_test.go
relaykit/ir/project/chat/roundtrip_test.go
relaykit/ir/project/claude/roundtrip_test.go
relaykit/ir/project/gemini/roundtrip_test.go
relaykit/relayconvert/format_matrix_test.go
relaykit/relayconvert/terminal_stream_test.go
relaykit/relayconvert/response_registry_test.go
relay/request_adapt_test.go
```

### 阶段二：修复 Responses instruction 角色

1. Responses 入站显式识别 `system/developer`；
2. 跨协议时统一为 instruction/system 语义；
3. Chat 出站禁止未声明的任意角色字符串穿透；
4. Claude/Gemini 继续使用各自顶层系统指令；
5. 保证 assistant/tool 的角色和消息分组不受影响；
6. 增加同时存在 developer、user、assistant、tool 的多轮测试；
7. 确认 Responses → Chat 的 conversation、PNG 不再被首个请求阻断。

重点文件：

```text
relaykit/ir/request.go
relaykit/ir/project/responses/input.go
relaykit/ir/project/responses/request.go
relaykit/ir/project/chat/request.go
relaykit/ir/project/chat/block.go
relaykit/relayconvert/ir_hub.go
```

### 阶段三：统一缺失工具 ID 的分配

1. 在 IR 或 relayconvert 增加公共 canonical tool call ID helper；
2. `StreamState.EnsureTool` 在源 ID 为空时分配并缓存规范 ID；
3. Gemini `FromStream` 通过 source index 获取同一个 ID；
4. Chat/Claude/Responses `ToStream` 从 block/state 读取规范 ID；
5. 非流式 `adaptIRResponse` 改用同一个 helper；
6. Gemini 请求历史中的 tool use/result 继续成对绑定；
7. Responses 的 item ID 与 call ID 分离；
8. 并行同名工具、无 name 首分片、arguments-only 分片均不串线。

重点文件：

```text
relaykit/ir/stream.go
relaykit/ir/block.go
relaykit/ir/project/gemini/stream.go
relaykit/ir/project/chat/stream.go
relaykit/ir/project/claude/stream.go
relaykit/ir/project/responses/stream.go
relaykit/relayconvert/ir_hub.go
```

### 阶段四：重构 Responses SSE 完整生命周期

1. 扩充 Responses stream DTO，表达 done/part/sequence 所需字段；
2. 为每个 output index 保存：
   - item 类型和 ID；
   - call ID、name；
   - 累计 text/reasoning/arguments；
   - added/part-added/done 状态；
3. 在 `EventBlockStop` 生成对应 done 和 `output_item.done`；
4. 在 EOF Finalize 关闭未显式停止的 block；
5. `response.completed.output` 填入完整 completed items；
6. `response.completed.status=completed`，usage 完整；
7. 每个事件分配单调 sequence number；
8. 同一 item 的关闭事件只输出一次；
9. usage-only 终块不能重复关闭工具；
10. Responses 入站支持从 `output_item.done` 或 terminal output 回填上游省略的 delta。

重点文件：

```text
relaykit/dto/openai_response.go
relaykit/ir/stream.go
relaykit/ir/project/responses/stream.go
relaykit/relayconvert/ir_hub.go
relay/helper/text_project.go
relay/helper/stream_result.go
```

### 阶段五：扩充并规范化媒体 IR

1. 为 `MediaBlock` 增加 `Filename`；
2. 提供统一 data URL 解析和生成 helper；
3. Chat 入站读取：
   - `filename`；
   - 兼容 `file_name`；
   - `file_data`；
   - `file_id`；
   - `mime_type`；
4. Responses 入站读取：
   - `file_data`；
   - `filename`；
   - `file_url`；
   - `file_id`；
5. Claude/Gemini 入站保持纯 base64 语义；
6. 校验 locator 互斥；
7. 修复 DTO 中 `filename/file_name` 命名不一致；
8. 更新 Responses `ParseInput`、token/file 元数据，使计量和转换使用同一文件来源。

重点文件：

```text
relaykit/ir/block.go
relaykit/ir/internal/jsonx/jsonx.go
relaykit/ir/project/chat/block.go
relaykit/ir/project/responses/input.go
relaykit/ir/project/claude/block.go
relaykit/ir/project/gemini/block.go
relaykit/dto/openai_request.go
relaykit/types/file_source.go
```

### 阶段六：接入媒体物化并修复各目标协议

1. 将 context 传入统一 IR 请求转换；
2. 在目标投影前规范化 data URL、MIME 和 filename；
3. Chat/Responses base64 出站重新生成 data URL；
4. Claude/Gemini base64 出站只使用纯 base64；
5. 通用 HTTP URL 转 Gemini 时先安全下载并转 inlineData；
6. file ID 跨供应商时返回明确错误，不伪造 URL/URI；
7. Responses `input_file` 只输出 `file_data/file_url/file_id` 中的一种；
8. 对 base64 Responses 文件保留 filename；
9. 避免把 data URL 传给下载器；
10. 避免把完整 data URL 传给 Claude/Gemini base64 字段。

重点文件：

```text
relaykit/relayconvert/request_registry.go
relaykit/relayconvert/ir_hub.go
relaykit/relayconvert/internal/media/media.go
service/request_converter.go
service/file_service.go
relaykit/ir/project/responses/input.go
relaykit/ir/project/chat/block.go
relaykit/ir/project/claude/block.go
relaykit/ir/project/gemini/block.go
```

### 阶段七：增加 Chat PDF 能力判断

1. 定义协议能力与模型能力的区别；
2. 为目标 Chat 模型/渠道提供 media capability 查询；
3. `kimi-k2.7-code` 明确不支持 PDF file part 时，在出站前返回结构化能力错误；
4. 同格式 Chat → Chat 也必须经过能力预检，不能因为无需格式转换而跳过；
5. 支持 file part 的 Chat 上游继续原样使用；
6. 矩阵报告新增 `CAPABILITY UNSUPPORTED`，不计为协议 FAIL；
7. 如后续实施文档桥接，应独立增加配置、资源限制、计费说明和安全评审。

重点文件：

```text
relay/request_adapt.go
relay/common/text_plan.go
relay/common/relay_info.go
relaykit/relayconvert/convmeta/
relaykit/ir/loss.go
测试矩阵的 analysis/report 类型与判定逻辑
```

### 阶段八：增强转换可观测性

为调试模式增加不泄露文件内容的转换摘要：

```text
source protocol
native target protocol
model
role mapping
media kind
MIME
filename
source kind
byte length
SHA-256
canonical tool call ID
Responses item ID/call ID
projection losses
```

禁止记录：

- 完整 base64；
- API key；
- 未脱敏 Authorization；
- 用户文件正文。

可在日志中使用 request ID 关联客户端请求、IR 摘要和最终上游请求摘要。

## 7. 测试计划

### 7.1 角色测试

覆盖：

1. Responses `developer` → Chat `system`；
2. Responses `developer` → Claude 顶层 system；
3. Responses `developer` → Gemini systemInstruction；
4. Responses 原生透传不被错误改写；
5. Chat 出站遇到未知角色时明确报错或规范化，不能静默透传；
6. developer + user + assistant + tool 多轮顺序稳定。

### 7.2 工具 ID 测试

覆盖：

1. Gemini 单工具 → Chat：`tool_calls[].id` 非空；
2. Gemini 单工具 → Claude：`tool_use.id` 非空；
3. Gemini 单工具 → Responses：`call_id` 和 item ID 均非空且不同语义；
4. Chat/Claude/Responses 原生已有 ID 时保持原值；
5. 并行同名工具生成不同 ID；
6. 一个工具的 name、arguments 分片分开发送时 ID 稳定；
7. 工具结果使用相同 ID 回放；
8. ID 不含空白/控制字符，长度在约束内；
9. 非流式和流式使用同一规范。

### 7.3 Responses SSE 合同测试

对 text、reasoning、tool 分别断言完整事件顺序。

工具场景至少要求：

```text
added = 1
arguments.done = 1
output_item.done = 1
completed = 1
```

并断言：

- `output_item.done.item.arguments` 为完整 JSON；
- `response.completed.output` 包含 completed function_call；
- AI SDK 实际执行工具恰好一次；
- 第二次 HTTP 请求携带 function_call_output；
- 最终回复能看到 receipt；
- sequence number 严格递增；
- EOF、finish、usage-only chunk 不造成重复关闭。

### 7.4 PDF 精确转换测试

使用同一 PDF 字节，断言转换前后 SHA-256 一致。

#### Chat → Responses

期望：

```json
{
  "type": "input_file",
  "filename": "matrix-document.pdf",
  "file_data": "data:application/pdf;base64,..."
}
```

不得输出空 `input_file`，不得同时输出 `file_url/file_id`。

#### Chat → Claude

期望：

```json
{
  "type": "document",
  "source": {
    "type": "base64",
    "media_type": "application/pdf",
    "data": "JVBERi0..."
  }
}
```

`data` 不得以 `data:` 开头。

#### Chat → Gemini

期望：

```json
{
  "inlineData": {
    "mimeType": "application/pdf",
    "data": "JVBERi0..."
  }
}
```

`data` 不得以 `data:` 开头。

#### Responses → Claude/Gemini

使用顶层 `file_data + filename`，期望与上述 Claude/Gemini 结果一致，不触发 URL 下载。

#### Claude/Gemini → Responses

期望生成 `file_data + filename`，且 Responses API 接受。

### 7.5 URL、ID 和异常输入

覆盖：

1. HTTPS PDF URL → Responses `file_url`；
2. HTTPS PDF URL → Gemini 安全下载后 inlineData；
3. data URL 不进入下载器；
4. 纯 base64 + MIME 正常；
5. 纯 base64无 MIME时内容嗅探；
6. 非法 base64 返回 400 转换错误；
7. 同时存在 file_data 和 file_url 时拒绝；
8. 跨供应商 file_id 明确拒绝；
9. 超大文件、超时、SSRF 地址继续受现有安全限制；
10. 请求结束后缓存和临时文件正常清理。

### 7.6 路由级测试

通过 `relay.ConvertRequestToChannelNative` 验证最终线格式，而不是只调用单个 projector：

- Responses 客户端 + Chat 原生模型；
- Chat 客户端 + Responses 原生模型；
- Chat/Responses 客户端 + Claude 原生模型；
- Chat/Responses 客户端 + Gemini 原生模型；
- Claude/Gemini 客户端 + Responses 原生模型；
- 任意客户端 + Kimi Chat PDF 能力预检；
- `TextPlan.Native`、请求 URL、请求 DTO 和响应处理器保持一致。

### 7.7 AI SDK 矩阵回归

修复后清空旧 artifact，使用相同依赖和 128K 设置重新运行：

```bash
cd tests/ai-sdk-protocol-matrix
bun run check
bun run matrix -- --max-output-tokens 131072
```

重新运行必须使用新目录和新 Run ID，不得把本轮 artifact 覆盖后当作同一次运行。

## 8. 验收标准

### 8.1 Conversation

以下路径必须从 FAIL 变为 PASS：

- Responses → Chat；
- Chat → Gemini；
- Claude → Gemini；
- Responses → Claude；
- Responses → Gemini。

具体要求：

1. Responses → Chat 不再向 Kimi 发送 `developer`；
2. Chat → Gemini 的 tool call ID 非空，AI SDK promise 正常完成；
3. Claude → Gemini 的 `tool_use.id` 非空；
4. Responses → Claude/Gemini 工具执行恰好一次；
5. tool receipt 可见；
6. 最终 marker、tool receipt 和题目结论可跨轮保留；
7. 不能通过关闭工具调用或改成非流式来规避问题。

### 8.2 Image

Responses → Chat PNG 在修复 developer 映射后应变为 PASS。其他 15 格保持 PASS。

### 8.3 PDF

协议转换层验收目标：

- Chat → Responses/Claude/Gemini PASS；
- Responses → Responses/Claude/Gemini PASS；
- Claude → Responses/Claude/Gemini PASS；
- Gemini → Responses/Claude/Gemini PASS。

所有目标为 Chat 且模型明确不支持 PDF file part 的单元格应返回：

```text
CAPABILITY UNSUPPORTED
```

而不是上游 400 或笼统 transport FAIL。

如果后续另行实施 PDF 文档桥接，则再把这些 Chat 目标单元格提升为 PASS；文档桥接不是本轮协议修复的默认验收条件。

### 8.4 协议结构

1. Responses SSE 的每个 item 都有 added → delta → done → output_item.done；
2. `response.completed.output` 非空且与流中 item 一致；
3. item ID 与 call ID 不混用；
4. Gemini 缺失 ID 时只生成一次规范 ID；
5. PDF 字节在跨协议转换后 SHA-256 不变；
6. Claude/Gemini base64 字段不包含 data URL 前缀；
7. Responses base64 文件包含 filename 和合法 file_data；
8. 同一个媒体 part 不同时包含多个 locator。

### 8.5 非回归

1. 现有 Chat、Responses、Claude、Gemini 原生 conversation 保持 PASS；
2. 现有 15 个图片 PASS 不回退；
3. Claude → Gemini、Gemini → Claude 的 PDF 成功路径保持 PASS；
4. 现有思维等级、预算、可见摘要和 thought signature 逻辑不回退；
5. 不修改统一 128K 回归设置；
6. 不把模型措辞 WARN 伪装为协议 PASS。

## 9. 预计涉及文件

核心 IR：

```text
relaykit/ir/request.go
relaykit/ir/block.go
relaykit/ir/stream.go
relaykit/ir/loss.go
relaykit/ir/internal/jsonx/jsonx.go
```

协议投影：

```text
relaykit/ir/project/chat/block.go
relaykit/ir/project/chat/request.go
relaykit/ir/project/chat/stream.go
relaykit/ir/project/responses/input.go
relaykit/ir/project/responses/request.go
relaykit/ir/project/responses/stream.go
relaykit/ir/project/claude/block.go
relaykit/ir/project/claude/stream.go
relaykit/ir/project/gemini/block.go
relaykit/ir/project/gemini/stream.go
```

DTO、转换和文件服务：

```text
relaykit/dto/openai_request.go
relaykit/dto/openai_response.go
relaykit/types/file_source.go
relaykit/relayconvert/request_registry.go
relaykit/relayconvert/ir_hub.go
relaykit/relayconvert/internal/media/media.go
service/request_converter.go
service/file_service.go
```

运行层和路由：

```text
relay/request_adapt.go
relay/common/text_plan.go
relay/common/relay_info.go
relay/helper/text_project.go
relay/helper/stream_result.go
```

测试与矩阵：

```text
relay/request_adapt_test.go
relaykit/ir/project/*/roundtrip_test.go
relaykit/relayconvert/format_matrix_test.go
relaykit/relayconvert/response_registry_test.go
relaykit/relayconvert/terminal_stream_test.go
tests/ai-sdk-protocol-matrix/src/analysis.ts
tests/ai-sdk-protocol-matrix/src/report.ts
tests/ai-sdk-protocol-matrix/test/*.test.ts
```

## 10. 实施顺序

1. 固化本轮五个 conversation 失败和 PDF 结构夹具；
2. 修复 Responses developer → instruction/system；
3. 统一 Gemini 缺失工具 ID 的流式/非流式分配；
4. 完成 Responses SSE item 生命周期；
5. 扩充 MediaBlock 和四协议入站解析；
6. 接入 context-aware 媒体物化；
7. 修复 Responses/Claude/Gemini PDF 出站；
8. 增加 Chat PDF 能力预检和矩阵分类；
9. 增加转换摘要日志；
10. 运行单元、路由、处理器和 AI SDK 矩阵回归；
11. 构建正式二进制并核验 VCS revision。

角色、工具 ID、Responses SSE 可以在独立分支并行实现；媒体 IR 与各协议 PDF 投影应在同一分支完成，避免中间状态再次出现“某两个协议能用、其余协议仍各自特判”。

## 11. 验证命令

实施完成后按项目 `AGENTS.md` 执行完整检查。

```bash
# Go 格式化
gofmt -w <本次修改的 Go 文件>
git diff --check

# 根模块和 relaykit 测试
make test
GOWORK=off go test ./... -count=1
cd relaykit && GOWORK=off go test ./... -count=1 && cd ..

# Go lint
golangci-lint run ./...
cd relaykit && golangci-lint run ./... && cd ..

# 前端 OXLint、Vitest、编译
cd web
bun run lint
bun run test
bun run build:check
cd ..

# AI SDK 测试工程
cd tests/ai-sdk-protocol-matrix
bun run check
cd ../..

# 后端编译
go build ./...
go build -o bin/new-api.exe .

# 构建来源校验
git rev-parse HEAD
go version -m bin/new-api.exe
```

正式构建要求：

- `vcs.revision` 与最终提交一致；
- `vcs.modified=false`；
- 二进制不使用旧工作树；
- E2E 报告记录实际 `x-new-api-version`。

## 12. 风险与控制

### 12.1 `developer → system` 的优先级差异

Responses 的 developer 指令和某些 OpenAI 模型的 system/developer 优先级并不完全等价。

控制：

- 本轮目标是跨到不支持 developer 的 Chat 上游时保留指令内容；
- 记录角色语义降级；
- 同格式 Responses 不改写；
- 如未来 IR 增加 instruction priority，再由支持 developer 的目标恢复原生角色。

### 12.2 合成工具 ID 与供应商约束

不同供应商对 ID 字符和长度可能存在限制。

控制：

- 使用保守 ASCII 字符集；
- 限长；
- 添加 Chat、Claude、Responses 三方验证；
- 不把完整用户文本或工具参数写入 ID。

### 12.3 Responses SSE 事件增加

完整生命周期会比当前简化流产生更多 SSE 事件。

控制：

- 这是协议要求，不属于冗余业务输出；
- 严格保证每个事件只发一次；
- 使用单调 sequence number 和状态位防重；
- 压测事件数和序列化开销。

### 12.4 Base64 内存放大

PDF data URL 在解析、IR、DTO 和日志中多次复制会放大内存。

控制：

- IR 只保存纯 base64；
- 避免重复生成 data URL，尽量在最终序列化边界生成；
- 复用现有磁盘缓存阈值；
- 日志只记录长度和哈希；
- 增加大文件内存测试。

### 12.5 URL 下载安全

Responses/Chat URL 转 Gemini inlineData 需要服务端下载。

控制：

- 只复用现有安全下载入口；
- 保持 SSRF、防重定向、超时和大小限制；
- 不在 projector 内自行使用裸 `http.Get`；
- 请求结束时清理缓存。

### 12.6 Chat PDF 文档桥接

自动 PDF → 文本/图片可能改变内容、费用和延迟。

控制：

- 默认只做能力预检，不静默桥接；
- 若实施桥接，必须显式配置并单独评审；
- 给出页数、像素、文件大小、超时和费用上限；
- 无法无损转换时返回明确错误。

## 13. 非目标范围

本计划默认不处理：

1. 强制模型在停车题中使用某句固定措辞；
2. 暴露模型私有完整思维链；
3. 通过降低输出上限或关闭 reasoning 规避问题；
4. 通过禁用工具、改成非流式或删除多轮上下文使测试“通过”；
5. 把其他供应商的 file ID 当成可跨平台通用 ID；
6. 默认启用 PDF OCR、文本抽取或页面渲染；
7. 为 Kimi 单独复制一套 PDF 转换器；
8. 修改前端页面或新增设置。

本轮后端协议修复不改变公开前端 API 和 UI。若后续新增“文档桥接”开关或展示转换损失，必须同步设计后端字段、前端类型、交互和全部 i18n 文案。

## 14. 预期结果

修复后的关键链路应为：

```text
Responses developer
  → IR instruction
  → Chat system
  → Kimi 正常处理

Gemini functionCall（无原生 ID）
  → IR 分配稳定 canonical call ID
  → Chat tool_calls.id / Claude tool_use.id
  → 工具结果使用相同 ID 回放

Claude/Gemini 工具流
  → 完整 Responses item 生命周期
  → AI SDK 执行工具一次
  → function_call_output 回传
  → 最终上下文回忆通过

Chat/Responses PDF data URL
  → MIME + 纯 base64 + filename
  → Responses file_data / Claude document / Gemini inlineData
  → PDF 字节不变

不支持 PDF 的 Chat 模型
  → 出站前 capability_unsupported
  → 不再产生不可解释的上游 400
```

最终，conversation 的 5 个协议 FAIL 和 Responses → Chat 图片 FAIL 应全部消失；非 Chat 目标的 PDF 转换应通过；Chat 目标 PDF 应被准确分类为能力不支持，除非后续明确实施文档桥接。