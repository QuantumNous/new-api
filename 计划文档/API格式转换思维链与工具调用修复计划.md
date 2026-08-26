# API 格式转换思维链与工具调用修复计划

## 1. 文档信息

- 状态：已确认，待实施
- 目标版本：下一次后端转换层修复
- 问题范围：Chat Completions、OpenAI Responses、Claude Messages、Gemini `generateContent` 之间的文本协议转换
- 术语约定：本文中的“A → B”表示“客户端使用 A 协议，请求被转换为上游模型原生的 B 协议”
- 调查请求：
  - `C:\Users\31290\Downloads\chat-to-gemini.txt`
  - `C:\Users\31290\Downloads\res-to-gemini.txt`
  - `C:\Users\31290\Downloads\claude-to-res.txt`
  - `C:\Users\31290\Downloads\gemini-to-chat.txt`

## 2. 修复目标

本次不针对单条转换路径做局部补丁，而是统一修正内部 IR 对“思维强度、思维展示、工具调用流”的表达与各协议边界映射，确保：

1. 客户端明确设置的推理强度不会在跨协议转换中丢失。
2. 客户端要求返回思维摘要时，目标协议会收到对应的原生展示参数。
3. Gemini `generateContent` 请求使用符合原生 REST API 的字段和值。
4. Chat 流式工具调用转换到 Gemini 时，一个逻辑工具调用只生成一个 `functionCall`。
5. 非流式和流式响应都能把上游可见思维正确投影回客户端协议。
6. 实际运行二进制与当前源码版本一致，避免“源码已修复、运行产物仍是旧实现”。

## 3. 调查结论概览

| 编号 | 转换路径 | 表面现象 | 主要根因 |
| --- | --- | --- | --- |
| 1 | Chat → Gemini | `reasoning_effort=xhigh`，客户端看不到思维 | Gemini `thinkingLevel` 使用了内部小写值 `high`，未转换为 `generateContent` 原生枚举 `HIGH` |
| 2 | Responses → Gemini | `reasoning.effort=xhigh`、`summary=auto`，客户端看不到思维 | 与问题 1 相同，IR → Gemini 边界错误地直接输出内部小写等级 |
| 3 | Claude → Responses | Claude 已设置 `adaptive + summarized + xhigh`，客户端看不到思维 | Claude 的 `display=summarized` 被原样存入公共 IR，而 Responses 只识别 `auto/concise/detailed`，导致 `reasoning.summary` 被丢弃；旧运行产物还缺少 Responses 思维摘要到 Claude 的流式响应投影 |
| 4 | Gemini → Chat | 第一次工具调用为空参数，第二次才正确 | 上一轮 Chat 流式响应转换为 Gemini 时，每个 `arguments` 分片被过早输出为独立 `functionCall`；当前源码虽已初步缓冲，但仍会在 `{}` 等“暂时合法 JSON”出现时过早提交 |
| 5 | 构建产物 | 抓到的行为与当前源码不完全一致 | `bin/new-api.exe` 内嵌修订为 `b4fabb7`，而当前源码 HEAD 为 `3dddb63`；关键 IR 修复均晚于该二进制 |

## 4. 详细根因

### 4.1 Chat → Gemini 的思维等级序列化错误

输入请求中明确包含：

```json
{
  "reasoning_effort": "xhigh"
}
```

当前源码可识别该字段，并在 IR 中保留为规范化等级 `xhigh`。但投影到 Gemini 后得到：

```json
{
  "thinkingConfig": {
    "includeThoughts": true,
    "thinkingLevel": "high"
  }
}
```

涉及代码：

- `relaykit/relayconvert/reasoning/level.go`
- `relaykit/relayconvert/internal/shared/gemini/request.go`
- `relaykit/ir/project/gemini/request.go`

内部等级使用小写是合理的，但 Gemini `generateContent` REST API 的 `thinkingLevel` 是枚举，原生值为：

```text
MINIMAL
LOW
MEDIUM
HIGH
```

当前实现把内部规范值直接当作目标协议线格式，混淆了“内部表示”和“协议原生表示”。

此外，`includeThoughts=true` 只表示“有思维时将其返回”，不应被当作推理强度开关。

### 4.2 Responses → Gemini 与 Chat → Gemini 共用同一错误边界

Responses 输入中包含：

```json
{
  "reasoning": {
    "summary": "auto",
    "effort": "xhigh"
  }
}
```

Responses → IR 阶段可以提取：

- 推理等级：`xhigh`
- 展示要求：`auto`

但 IR → Gemini 阶段仍输出小写 `high`。因此该问题不是 Responses 入站解析缺失，而是所有来源协议共用的 Gemini 出站序列化错误。

修复必须落在统一 Gemini 投影边界，不能分别在 Chat、Responses 转换器中硬编码。

### 4.3 Claude `summarized` 与 Responses `summary` 没有公共语义

Claude 请求包含：

```json
{
  "thinking": {
    "type": "adaptive",
    "display": "summarized"
  },
  "output_config": {
    "effort": "xhigh"
  }
}
```

当前 IR 解析把 `display=summarized` 原样写入 `ThinkConfig.Display`。但 Responses 出站投影只允许：

```text
auto
concise
detailed
```

因此最终请求退化为：

```json
{
  "reasoning": {
    "effort": "xhigh"
  }
}
```

缺少用于请求可见思维摘要的：

```json
{
  "summary": "auto"
}
```

涉及代码：

- `relaykit/ir/request.go`
- `relaykit/ir/project/claude/request.go`
- `relaykit/ir/project/responses/request.go`

根本问题是公共 IR 的 `Display` 字段混用了供应商原生枚举：

- Claude：`summarized`、`omitted`
- Responses：`auto`、`concise`、`detailed`
- Gemini：`includeThoughts`
- Chat：`reasoning_content`

公共 IR 应表达协议无关语义，而不应直接保存某个供应商的线格式值。

### 4.4 Gemini → Chat 工具错误实际发生在上一轮 Chat → Gemini 流式响应

提供的 Gemini 会话历史中已经存在两个调用：

```json
{
  "functionCall": {
    "name": "eval_javascript",
    "args": {}
  }
},
{
  "functionCall": {
    "name": "eval_javascript",
    "args": {
      "code": "..."
    }
  }
}
```

这说明本轮 Gemini → Chat 请求转换只是忠实保留了客户端提交的两条历史调用。错误来源是上一轮 Chat 原生流式响应转换为 Gemini 响应时，把工具参数分片投影成了多个 `functionCall`。

旧逻辑在收到任意 `arguments` 分片时立即生成 Gemini 调用。例如上游依次发送：

```text
{}
{"code":"..."}
```

旧逻辑会输出两次调用。客户端会先执行空参数调用，从而产生 `Script cannot be null`。

当前源码在 `b7c9dac` 后增加了缓冲，但仍存在以下风险：

1. 只要当前累计值能解析成合法 JSON，就可能提前输出。
2. `{}` 是合法 JSON，但可能只是供应商的临时快照，并不代表参数已经结束。
3. 当前状态主要按“增量字符串拼接”处理，未完整兼容返回累计快照的 OpenAI 兼容供应商。
4. 并行工具调用的名称、ID、参数应按调用索引保存，不能依赖全局 `OpenName` 作为主要来源。

涉及代码：

- `relaykit/ir/stream.go`
- `relaykit/ir/project/chat/stream.go`
- `relaykit/ir/project/gemini/stream.go`

### 4.5 实际二进制版本落后

本地构建产物检查结果：

```text
bin/new-api.exe vcs.revision = b4fabb7f4ae4216a07e59869ecd43279438a4e29
当前源码 HEAD               = 3dddb63eec066ac34ab1485f6063dfb097abc2dc
```

关键提交时间顺序：

```text
b4fabb7  旧二进制对应版本
be0bc02  文本协议改为统一 IR 转换
b7c9dac  增加思维摘要、工具流和 tool_result 修复
3dddb63  修复原生文本格式路由
```

因此测试结果同时包含：

- 旧二进制已经存在的问题；
- 当前源码仍未修完的协议语义问题。

只重新编译不能解决全部问题，但修复代码后必须重新构建并校验产物修订号。

## 5. 已确认的默认修复语义

### 5.1 内部推理等级

IR 内部继续使用小写规范值：

```text
none
minimal
low
medium
high
xhigh
max
```

所有入站协议先规范化到这些值；所有出站协议在边界处转换为自己的原生枚举。

### 5.2 内部思维展示方式

将公共 IR 的展示语义收敛为明确枚举，建议新增 `ThinkDisplayMode`：

```text
hidden
auto
concise
detailed
```

不再允许 Claude 的 `summarized/omitted` 直接穿透到 Responses，也不允许 Responses 的 `auto` 原样穿透到 Claude。

### 5.3 Gemini 原生等级映射

对于使用 `thinkingLevel` 的 Gemini `generateContent` 模型：

| IR 等级 | Gemini 原生值 |
| --- | --- |
| `minimal` | `MINIMAL` |
| `low` | `LOW` |
| `medium` | `MEDIUM` |
| `high` | `HIGH` |
| `xhigh` | `HIGH` |
| `max` | `HIGH` |

`xhigh/max → HIGH` 属于目标协议能力降级，应进入转换损失报告或审计信息。

### 5.4 Gemini 模型能力分流

新增统一的 Gemini 思维控制能力判断，避免所有模型无条件使用同一字段：

```text
Level 模式：使用 thinkingLevel
Budget 模式：使用 thinkingBudget
Unknown：只在请求有明确意图时做保守投影
```

规则：

1. Gemini 3 及以上的已知文本思维模型优先使用 `thinkingLevel`。
2. 只支持预算的模型保留显式 `thinkingBudget`。
3. 从 effort 转换到预算型模型且没有原始数值预算时，使用动态预算 `-1` 表达“开启并由模型自行决定”，同时记录等级量化损失。
4. 明确关闭思维时使用目标模型支持的原生关闭方式；预算型模型使用 `thinkingBudget=0`。
5. 不同时发送互相冲突的 `thinkingLevel` 和 `thinkingBudget`。

### 5.5 Claude 与 Responses 的展示映射

| 来源 | IR | 目标 |
| --- | --- | --- |
| Claude `display=summarized` | `auto` | Responses `summary=auto` |
| Claude `display=omitted` | `hidden` | Responses 不发送 `summary` |
| Responses `summary=auto` | `auto` | Claude `display=summarized` |
| Responses `summary=concise` | `concise` | Claude `display=summarized`，记录细节降级 |
| Responses `summary=detailed` | `detailed` | Claude `display=summarized`，记录细节降级 |
| Gemini `includeThoughts=true` | `auto` | 目标协议请求可见思维 |

本次 Claude → Responses 示例的期望结果为：

```json
{
  "reasoning": {
    "effort": "xhigh",
    "summary": "auto"
  }
}
```

### 5.6 Gemini 数值预算转 Chat effort

当 Gemini 请求明确开启思维、带正数 `thinkingBudget`，但目标 Chat 只能表达离散 `reasoning_effort` 且没有 `thinkingLevel` 时：

```text
正预算 → reasoning_effort=high
预算 0 → reasoning_effort=none
```

这是语义保留型降级，不尝试根据任意阈值把数值预算猜测为 `xhigh`。降级信息应进入转换损失报告。

## 6. 实施计划

### 阶段一：建立协议无关的思维规范化层

#### 目标

把等级、启停、展示方式的规范化集中到 `relaykit`，避免每个协议转换器自行猜测。

#### 计划修改

1. 在 `relaykit/ir/request.go` 中为展示方式增加强类型枚举，或在不破坏兼容性的前提下增加统一常量与规范化入口。
2. 在 `relaykit/relayconvert/reasoning/` 中补充：
   - 内部等级规范化；
   - Gemini 原生等级序列化；
   - Gemini 原生等级反序列化；
   - 展示方式规范化；
   - 预算型思维到 effort 型思维的降级规则。
3. 保证 IR 内部不保存目标协议大小写和供应商原生枚举。

#### 重点文件

- `relaykit/ir/request.go`
- `relaykit/relayconvert/reasoning/level.go`
- `relaykit/relayconvert/reasoning/intent.go`
- 对应 `*_test.go`

### 阶段二：修复 Gemini 请求投影

#### 目标

让所有来源协议共用同一个正确的 Gemini 思维投影，不在 Chat、Responses、Claude 各自打补丁。

#### 计划修改

1. `IR → Gemini` 时调用 Gemini 原生序列化函数，输出大写 `MINIMAL/LOW/MEDIUM/HIGH`。
2. `Gemini → IR` 时接受大小写输入并统一为小写内部等级。
3. 根据上游模型选择 `thinkingLevel` 或 `thinkingBudget`。
4. 显式开启可见思维时设置 `includeThoughts=true`。
5. 显式关闭时避免生成因 `omitempty` 而退化为 `{}` 的无效配置。
6. 删除或收敛重复的思维配置应用路径，避免 `project.ToRequest` 与 `adaptGeminiRequest` 二次覆盖产生不一致。
7. 保留原始显式预算，不用离散等级无条件覆盖客户端预算。

#### 重点文件

- `relaykit/ir/project/gemini/request.go`
- `relaykit/relayconvert/internal/shared/gemini/request.go`
- `relaykit/relayconvert/ir_hub.go`
- `relaykit/relayconvert/reasoning/level.go`
- `relaykit/dto/gemini.go`（仅在序列化类型确有必要时修改）

### 阶段三：修复 Claude 与 Responses 的思维展示映射

#### 目标

让 Claude `summarized` 和 Responses `summary` 通过 IR 进行语义转换，而不是字符串透传。

#### 计划修改

1. Claude 入站：
   - `summarized → auto`
   - `omitted → hidden`
   - 开启思维但未给 display 时，根据 Claude 模型默认语义决定是否标记为可见，不能无条件伪造供应商枚举。
2. Responses 出站：
   - `auto/concise/detailed` 输出同名 `reasoning.summary`；
   - `hidden` 不输出 summary。
3. Responses 入站：规范化 summary。
4. Claude 出站：
   - 可见摘要映射为 `display=summarized`；
   - 隐藏映射为 `display=omitted`；
   - `concise/detailed` 到 Claude 时记录粒度损失。
5. 同时验证流式 Responses reasoning summary 能投影为 Claude thinking delta。

#### 重点文件

- `relaykit/ir/project/claude/request.go`
- `relaykit/ir/project/claude/stream.go`
- `relaykit/ir/project/responses/request.go`
- `relaykit/ir/project/responses/stream.go`
- `relaykit/relayconvert/response_registry_test.go`

### 阶段四：重构 Chat → Gemini 流式工具调用状态

#### 目标

一个逻辑工具调用只生成一个 Gemini `functionCall`，最终参数必须来自工具调用结束时的稳定状态。

#### 状态模型

每个工具调用索引独立保存：

```text
index
call ID
function name
收到的参数片段序列
累计参数候选
最近一次完整 JSON 快照
是否已经输出
```

#### 输出时机

1. `EventBlockStart`：创建状态，不输出 `functionCall`。
2. `EventBlockDelta`：只更新状态，不输出。
3. `EventBlockStop`：解析最终参数并输出一次。
4. `EventFinish`：按索引排序补齐尚未关闭的工具调用。
5. 已输出的索引禁止再次输出。

#### 分片兼容策略

最终参数选择顺序：

1. 标准增量片段拼接后是合法 JSON：使用拼接结果。
2. 若拼接无效，但后续片段是完整 JSON 对象且表现为累计快照：使用最新完整快照。
3. 若出现 `{}` 后又出现更完整对象，不允许把 `{}` 提前提交。
4. 如果最终仍无法解析，按现有兼容策略输出空对象或明确转换错误；具体行为由现有外部兼容要求决定，但不得生成多个调用。
5. 并行调用严格按各自 index、ID、name 分离，不能使用另一个调用的 `OpenName`。

#### 重点文件

- `relaykit/ir/stream.go`
- `relaykit/ir/project/chat/stream.go`
- `relaykit/ir/project/gemini/stream.go`
- `relaykit/ir/project/gemini/roundtrip_test.go`
- `relaykit/relayconvert/terminal_stream_test.go`

### 阶段五：补齐转换损失报告

以下情况应被标记为可审计的语义降级，而不是静默发生：

1. `xhigh/max → Gemini HIGH`
2. 数值预算 → Chat `high`
3. Responses `concise/detailed → Claude summarized`
4. effort → Gemini 动态预算 `-1`
5. 目标模型不支持源协议要求的完全关闭或展示粒度

重点文件：

- `relaykit/ir/loss.go`
- `relaykit/ir/request.go`
- `relaykit/relayconvert/ir_hub.go`
- 对应 loss/report 测试

### 阶段六：构建产物一致性

1. 完成代码和测试后重新构建 Windows 后端产物。
2. 执行：

```bash
go version -m bin/new-api.exe
git rev-parse HEAD
```

3. 验收要求：`vcs.revision` 与当前提交一致，且构建产物不能继续指向 `b4fabb7`。
4. 评估在构建脚本中增加自动校验，防止旧二进制被误用于回归测试。
5. 回归测试必须新建会话；旧 Gemini 会话历史中已经存在的两个 `functionCall` 不应被请求转换器擅自删除。

## 7. 测试计划

### 7.1 精确请求回归

使用四份原始请求体构建测试夹具，验证转换后的关键字段。

#### Chat → Gemini

输入：

```json
"reasoning_effort": "xhigh"
```

期望：

```json
"thinkingConfig": {
  "includeThoughts": true,
  "thinkingLevel": "HIGH"
}
```

#### Responses → Gemini

输入：

```json
"reasoning": {
  "summary": "auto",
  "effort": "xhigh"
}
```

期望：

```json
"thinkingConfig": {
  "includeThoughts": true,
  "thinkingLevel": "HIGH"
}
```

#### Claude → Responses

输入：

```json
"thinking": {
  "type": "adaptive",
  "display": "summarized"
},
"output_config": {
  "effort": "xhigh"
}
```

期望：

```json
"reasoning": {
  "effort": "xhigh",
  "summary": "auto"
}
```

#### Gemini → Chat

输入包含：

```json
"thinkingBudget": 16000
```

期望至少保留：

```json
"reasoning_effort": "high"
```

### 7.2 Gemini 原生值测试

覆盖：

- `minimal → MINIMAL`
- `low → LOW`
- `medium → MEDIUM`
- `high/xhigh/max → HIGH`
- 入站 `HIGH/high/High` 均规范化为内部 `high`
- `includeThoughts=true` 保留
- 关闭配置不会序列化成空 `thinkingConfig:{}`
- `thinkingLevel` 与 `thinkingBudget` 不冲突共存

### 7.3 展示语义测试

覆盖：

- Claude `summarized → Responses auto`
- Claude `omitted → Responses 无 summary`
- Responses `auto → Claude summarized`
- Responses `concise/detailed → Claude summarized + loss`
- Gemini `includeThoughts=true → Responses summary=auto`
- Chat 明确 reasoning effort → Responses summary 可见

### 7.4 工具调用流测试

必须覆盖：

1. 标准增量：

```text
{"code":
"1+1"}
```

结果：一个调用，参数完整。

2. 临时空对象后完整快照：

```text
{}
{"code":"1+1"}
```

结果：只输出后者，一个调用。

3. 累计快照：

```text
{"code":
{"code":"1+1"}
```

结果：识别为快照更新，不重复调用。

4. 并行工具：两个 index 交错发送参数，名称和参数不能串线。
5. arguments 分片省略 index 时，使用已知 ID/当前唯一打开调用安全关联；有歧义时不得错误归并。
6. finish 前没有显式 block stop 时，由 Finalize 补齐一次。
7. 空参数本来就是最终合法参数时，仍只能输出一次 `{}`。

### 7.5 响应投影测试

覆盖非流式和流式：

- Gemini thought part → Chat `reasoning_content`
- Gemini thought part → Responses reasoning summary item/event
- Responses reasoning summary → Claude thinking block/delta
- Responses reasoning summary → Chat `reasoning_content`
- 工具调用和思维内容同时出现时顺序稳定

### 7.6 路由级测试

通过 `relay.ConvertRequestToChannelNative` 和各渠道计划验证：

- Chat 客户端 + Gemini 渠道最终请求格式为 Gemini
- Responses 客户端 + Gemini 渠道最终请求格式为 Gemini
- Claude 客户端 + Responses 原生模型最终请求格式为 Responses
- Gemini 客户端 + Chat 原生模型最终请求格式为 Chat
- `FinalRequestRelayFormat`、请求路径和响应解析协议保持一致

## 8. 验收标准

### 功能验收

1. 四份请求体均能得到计划中的目标思维字段。
2. Gemini 3.7 的 `thinkingLevel` 不再输出小写。
3. Claude `display=summarized` 转 Responses 后必定包含 `summary=auto`。
4. 新会话中 Chat → Gemini 工具流不会再产生“空调用 + 正确调用”两次执行。
5. 流式和非流式响应都能把可见思维返回客户端。
6. 不破坏已有 tool result、并行工具和 thought signature 逻辑。

### 构建验收

1. Go 格式化通过。
2. 根模块和 `relaykit` 模块测试通过。
3. `golangci-lint` 通过。
4. OXLint、Vitest 和前端编译通过。
5. 后端编译通过。
6. 新二进制内嵌 Git revision 与实施完成后的 HEAD 一致。

## 9. 计划执行命令

实施完成后按项目要求执行：

```bash
# Go 格式化
gofmt -w <本次修改的 Go 文件>

# 根模块与 relaykit 测试
make test

# 如需分别定位
go test ./...
cd relaykit && go test ./...

# Go lint
golangci-lint run ./...
cd relaykit && golangci-lint run ./...

# 前端检查
cd web
bun run lint
bun run test
bun run build:check

# 后端编译
go build ./...
go build -o bin/new-api.exe .

# 构建来源校验
go version -m bin/new-api.exe
git rev-parse HEAD
```

若根模块因嵌入式前端产物或嵌套模块需要使用项目既有构建顺序，则以 `makefile` 中的构建方式为准，但不得省略 AGENTS.md 要求的检查项。

## 10. 风险与控制

### 10.1 Gemini 兼容代理接受非标准小写值

部分兼容代理可能宽松接受 `high`，但本项目目标是模型原生 API 格式，因此出站必须使用原生 `HIGH`。入站可继续宽松接受大小写，保证兼容性。

### 10.2 工具调用输出延迟

把 Gemini `functionCall` 延迟到工具 block 结束会比“看到合法 JSON 就输出”稍晚，但能保证参数稳定。工具真正可执行的时间本来就应在参数结束后，因此这是正确的协议行为，不属于功能退化。

### 10.3 旧会话已污染

已经写入 Gemini 会话历史的空调用不会自动消失。修复验收必须使用新会话；不能在请求转换阶段根据“空参数”猜测并删除历史调用，因为无参数工具调用可能本来就是合法的。

### 10.4 不同模型的思维能力不同

Gemini 不同代际支持的 level、budget 和最低等级不同。能力判断应集中维护，不能在多个转换器中散落模型名判断。未知模型采用保守策略并记录转换损失。

## 11. 非目标范围

本次不处理：

1. 暴露模型完整私有思维链；只转换供应商允许返回的 reasoning summary/thought 内容。
2. 自动清洗客户端已经提交的错误历史工具调用。
3. 为每个非标准 OpenAI 兼容供应商建立专用工具流协议；本次提供通用的增量与累计快照兼容。
4. 修改前端 UI 文案或增加新的系统设置；如实施中确需新增设置，再单独评估前后端与 i18n 一致性。

## 12. 预期实施结果

修复后，四条路径的关键结果应为：

```text
Chat xhigh
  → Gemini includeThoughts=true + thinkingLevel=HIGH

Responses xhigh + summary=auto
  → Gemini includeThoughts=true + thinkingLevel=HIGH

Claude adaptive + summarized + xhigh
  → Responses effort=xhigh + summary=auto

Chat 流式工具参数
  → Gemini 每个工具索引仅一个最终 functionCall
```

同时，重新构建后的运行产物必须包含本次修复提交，避免再次由旧二进制复现已修复行为。
