# Claude 到 Gemini 思维预算与等级投影修复计划

## 1. 文档信息

- 状态：已确认，待实施
- 问题类型：跨协议请求转换语义错误
- 影响路径：Claude Messages → Gemini `generateContent`
- 主要影响模型：使用 `thinkingLevel` 的 Gemini 3.x/4.x 文本模型
- 典型复现模型：`gemini-3.7-flash`
- 调查依据：
  - `C:\Users\31290\Desktop\程序\shanghua-api\测试\TEST_REPORT.md`
  - `C:\Users\31290\Desktop\程序\shanghua-api\测试\test_results.json`
  - `C:\Users\31290\Desktop\程序\shanghua-api\测试\run_api_tests.py`
- 本文只制定修复计划，不包含代码修改。

## 2. 问题结论

Claude Messages 请求明确开启思维并提供数值预算时：

```json
{
  "thinking": {
    "type": "enabled",
    "budget_tokens": 2048
  }
}
```

当前公共 Gemini 思维投影会优先保留数值预算，并向 Gemini 3.7 下发类似配置：

```json
{
  "generationConfig": {
    "thinkingConfig": {
      "includeThoughts": true,
      "thinkingBudget": 2048
    }
  }
}
```

但项目已经将 Gemini 3.x/4.x 识别为使用 `thinkingLevel` 的 Level 模式模型。对这类模型，正确的原生控制应为：

```json
{
  "generationConfig": {
    "thinkingConfig": {
      "includeThoughts": true,
      "thinkingLevel": "HIGH"
    }
  }
}
```

实测表明，在报告使用的系统提示、工具定义和任务下：

- `thinkingBudget=2048`：连续请求均未产生 Gemini thought，`thoughtsTokenCount=0`；
- `thinkingLevel=HIGH`：连续请求均产生 Gemini thought；
- Gemini thought 一旦存在，当前 Gemini → Claude 非流式和流式响应投影都能正确生成 Claude thinking block/delta。

因此，本问题不是 `includeThoughts` 丢失，也不是 Gemini thought 到 Claude 响应的转换丢失，而是：

> 公共投影错误地让源协议的数值预算优先于目标模型的原生能力类型，向 Level 模式 Gemini 模型发送了 `thinkingBudget`。

## 3. 复现与证据

### 3.1 Claude 原始场景

请求条件：

- 客户端协议：Claude Messages
- 目标模型：`gemini-3.7-flash`
- `thinking.type=enabled`
- `thinking.budget_tokens=2048`
- 带工具调用
- 非流式

连续 5 次结果：

| 次数 | Claude thinking 字符数 | 工具调用数 |
| --- | ---: | ---: |
| 1 | 0 | 1 |
| 2 | 0 | 1 |
| 3 | 0 | 1 |
| 4 | 0 | 1 |
| 5 | 0 | 1 |

该结果与测试报告中的 Claude Messages → Gemini 无思维现象一致。

### 3.2 直接 Gemini 对照

使用相同提示和工具，直接调用 Gemini 原生接口。

#### 使用数值预算

```json
{
  "thinkingConfig": {
    "includeThoughts": true,
    "thinkingBudget": 2048
  }
}
```

连续 5 次均为：

- thought 文本长度：0
- `thoughtsTokenCount`：0
- 工具调用正常生成

#### 使用原生等级

```json
{
  "thinkingConfig": {
    "includeThoughts": true,
    "thinkingLevel": "HIGH"
  }
}
```

连续 5 次 thought 文本长度分别为：

```text
1454、1262、1821、1834、984
```

说明相同模型、提示和工具下，思维是否产生与下发的原生思维控制字段直接相关。

### 3.3 响应投影对照

Claude 改用可映射为等级的配置：

```json
{
  "thinking": {
    "type": "adaptive",
    "display": "summarized"
  },
  "output_config": {
    "effort": "high"
  }
}
```

实测结果：

- 非流式连续请求均返回 Claude `content[].type=thinking`；
- 流式连续请求均返回：
  - `content_block_start(type=thinking)`；
  - `thinking_delta`；
  - 后续 `tool_use`。

这证明 Gemini thought → Claude thinking 的响应转换链路正常，修复范围应集中在请求侧公共思维投影。

## 4. 当前代码根因

### 4.1 Claude 入站同时保留预算和等级

涉及文件：

- `relaykit/ir/project/claude/request.go`

Claude `thinking.budget_tokens` 被保存在公共 IR：

```go
cfg.Budget = req.Thinking.BudgetTokens
```

Claude `output_config.effort` 也可以被规范化后保存在公共 IR：

```go
cfg.Level = effort
```

这一阶段保留源信息是合理的，问题不应通过丢弃 Claude 入站字段解决。

### 4.2 Gemini 投影无条件优先预算

涉及文件：

- `relaykit/relayconvert/reasoning/gemini.go`

当前 `ProjectGeminiThinking` 虽然先计算了目标模型能力：

```go
control := GeminiThinkingControlForModel(model)
```

但后续只要存在预算，就直接输出 `thinkingBudget` 并返回：

```go
if budget != nil {
    value := *budget
    projection.ThinkingBudget = &value
    return projection
}
```

该分支没有检查 `control` 是否为 `GeminiControlLevel`，导致：

1. Gemini 3.x 已被识别为 Level 模式；
2. Claude 预算仍被原样输出为 `thinkingBudget`；
3. 即使同时存在 `output_config.effort`，等级也会被预算分支覆盖；
4. Gemini 接受请求但未按预期产生 thought；
5. 下游 Claude 没有 thinking 内容可投影。

### 4.3 现有测试固化了错误语义

涉及文件：

- `relaykit/relayconvert/reasoning/gemini_test.go`

当前测试明确要求 Gemini 3 Level 模型保留显式预算：

```go
preserved := ProjectGeminiThinking(
    "gemini-3.7-pro",
    false,
    &explicit,
    LevelHigh,
    &include,
    DisplayAuto,
)
```

并断言应输出数值预算而不是等级。该预期与真实 Gemini 3.7 行为不符，实施时必须修改测试语义，不能只改生产代码。

### 4.4 路由级测试缺少思维配置断言

涉及文件：

- `relay/request_adapt_test.go`

现有 Claude → Gemini 路由测试只验证消息内容和最终协议格式，没有验证：

- `includeThoughts`；
- `thinkingLevel`；
- `thinkingBudget` 是否错误存在；
- Claude effort 与 budget 同时存在时的优先级。

这使错误可以通过所有现有测试。

## 5. 已协商的目标语义

### 5.1 核心原则

思维控制投影必须遵循：

> 目标模型能力优先，源协议信息完整保留在 IR，最终在线协议字段由目标模型支持的控制方式决定。

不得继续采用“只要源请求有数值预算，就无条件输出 `thinkingBudget`”的规则。

### 5.2 Level 模式 Gemini 模型

适用范围：已知使用 `thinkingLevel` 的 Gemini 3.x/4.x 文本模型。

| 源 IR 状态 | Gemini 原生输出 |
| --- | --- |
| 明确关闭思维 | `thinkingLevel=MINIMAL`，`includeThoughts=false`，记录能力降级 |
| 存在明确 effort/level | 使用对应原生 `MINIMAL/LOW/MEDIUM/HIGH` |
| level 与正数 budget 同时存在 | level 优先；不输出 budget；记录预算丢失/量化损失 |
| 只有正数 budget | 降级为 `thinkingLevel=HIGH`；记录 `budget_to_level` 损失 |
| 只请求可见思维，无 level/budget | 保留 `includeThoughts=true`，由模型默认思维策略决定 |

等级映射继续使用既有规则：

| IR 等级 | Gemini Level |
| --- | --- |
| `minimal` | `MINIMAL` |
| `low` | `LOW` |
| `medium` | `MEDIUM` |
| `high` | `HIGH` |
| `xhigh` | `HIGH` |
| `max` | `HIGH` |

`xhigh/max → HIGH` 必须继续记录等级能力降级。

### 5.3 Budget 模式 Gemini 模型

适用范围：Gemini 2.5 和已知只支持数值预算的 thinking 模型。

| 源 IR 状态 | Gemini 原生输出 |
| --- | --- |
| 明确关闭思维 | `thinkingBudget=0`，`includeThoughts=false` |
| 存在明确 budget | 原样保留 `thinkingBudget` |
| budget 与 level 同时存在 | budget 优先；必要时记录 level 无法精确保留 |
| 只有 level | 使用动态预算 `thinkingBudget=-1`，记录 effort 到预算的量化损失 |
| 只请求可见思维 | 设置 `includeThoughts=true`，不伪造固定预算 |

### 5.4 Unknown 模式

未知 Gemini 模型不能被强行套入未经确认的能力规则。

计划采用保守策略：

1. 显式关闭请求继续使用当前安全关闭策略；
2. 显式数值预算可按既有兼容策略保留；
3. 显式等级只在当前兼容策略允许时输出；
4. 不同时发送 `thinkingBudget` 和 `thinkingLevel`；
5. 记录目标模型能力未知的审计信息或转换损失。

### 5.5 不采用预算阈值猜测等级

本次不采用类似以下未经协议定义的规则：

```text
1～2048 → LOW
2049～8192 → MEDIUM
8193 以上 → HIGH
```

原因：

- Gemini 没有公开保证数值预算与 Level 枚举之间存在固定阈值关系；
- 任意阈值会形成新的隐式兼容规则；
- 不同模型代际的 token 行为可能不同；
- 难以稳定测试和长期维护。

对于 Level 模型，只有正数预算而没有 level 时统一降级为 `HIGH`，并通过损失报告明确其非精确转换。

## 6. 实施计划

### 阶段一：重构公共 Gemini 思维投影决策顺序

#### 目标

让 `ProjectGeminiThinking` 真正以 `GeminiThinkingControlForModel` 的结果决定目标线格式。

#### 计划修改

1. 先处理明确关闭语义；
2. 独立计算 `includeThoughts`，使可见性与思维强度继续解耦；
3. 根据 `GeminiThinkingControl` 分支投影：
   - Level 分支只允许输出 `thinkingLevel`；
   - Budget 分支只允许输出 `thinkingBudget`；
   - Unknown 分支采用保守兼容策略；
4. Level 分支中：
   - 明确 level 优先于 budget；
   - 只有正数 budget 时输出 `HIGH`；
5. Budget 分支中：
   - 显式 budget 优先；
   - 只有 level 时输出动态预算 `-1`；
6. 所有分支保证 `thinkingLevel` 与 `thinkingBudget` 互斥；
7. 更新函数注释，删除“显式预算无条件保留”的错误描述。

#### 重点文件

- `relaykit/relayconvert/reasoning/gemini.go`
- `relaykit/relayconvert/reasoning/gemini_test.go`

### 阶段二：补齐转换损失报告

#### 目标

所有无法精确保留的思维控制都必须可审计，不能静默发生。

#### 新增或调整的损失类型

1. `thinking.budget_to_level`
   - 场景：正数数值预算投影到 Gemini Level 模型；
   - 结果：`thinkingLevel=HIGH`。
2. `thinking.budget`
   - 场景：源预算因 Level 目标不支持而无法原样保留；
   - level 已明确时记录预算被丢弃。
3. 继续保留：
   - `thinking.level`：`xhigh/max → HIGH`；
   - `thinking.effort_to_budget`：离散 effort → 动态预算 `-1`；
   - `thinking.mode`：Level 模型无法完全关闭，只能 `MINIMAL + hidden`。

#### 重点文件

- `relaykit/relayconvert/ir_hub.go`
- `relaykit/ir/loss.go`
- 对应 `*_test.go`

### 阶段三：增加 Claude → Gemini 精确请求回归

#### 目标

直接覆盖本次报告中的真实请求语义，避免只测试通用 projector。

#### 测试一：Claude enabled + budget → Gemini 3

输入：

```json
{
  "thinking": {
    "type": "enabled",
    "budget_tokens": 2048
  }
}
```

目标模型：

```text
gemini-3.7-flash
```

期望：

```json
{
  "thinkingConfig": {
    "includeThoughts": true,
    "thinkingLevel": "HIGH"
  }
}
```

并断言：

```text
thinkingBudget == nil
```

#### 测试二：Claude budget + explicit effort → effort 优先

输入：

```json
{
  "thinking": {
    "type": "enabled",
    "budget_tokens": 2048
  },
  "output_config": {
    "effort": "medium"
  }
}
```

期望：

```json
{
  "thinkingConfig": {
    "includeThoughts": true,
    "thinkingLevel": "MEDIUM"
  }
}
```

并记录预算无法原样表达的损失。

#### 测试三：Claude budget → Gemini 2.5

相同 Claude 输入，目标模型：

```text
gemini-2.5-flash
```

期望：

```json
{
  "thinkingConfig": {
    "includeThoughts": true,
    "thinkingBudget": 2048
  }
}
```

并断言 `thinkingLevel` 为空。

#### 测试四：Claude adaptive summarized + xhigh

输入：

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

Gemini 3 期望：

```json
{
  "thinkingConfig": {
    "includeThoughts": true,
    "thinkingLevel": "HIGH"
  }
}
```

#### 重点文件

- `relaykit/relayconvert/request_registry_test.go`
- `relaykit/relayconvert/reasoning/gemini_test.go`
- `relay/request_adapt_test.go`

### 阶段四：补齐路由和模型别名测试

#### 目标

保证生产路由使用的上游模型名、思维后缀和最终原生格式不会绕过新规则。

#### 覆盖场景

1. Claude 客户端 + Gemini 渠道；
2. Claude 客户端 + Vertex Gemini 渠道；
3. 上游模型名为 `gemini-3.7-flash`；
4. 上游模型名带 provider/publisher 前缀；
5. 上游模型名带 `-high/-xhigh` 思维适配后缀；
6. URL 构造剥离思维后缀后，思维等级仍保留在请求体；
7. `FinalRequestRelayFormat` 保持 Gemini；
8. 最终请求体不能同时存在 `thinkingLevel` 和 `thinkingBudget`。

#### 重点文件

- `relay/request_adapt_test.go`
- `relay/common/native_format_test.go`
- `relay/channel/gemini/upstream_model_test.go`
- `relay/channel/vertex/adaptor_url_test.go`
- 必要时增加 Gemini/Vertex 请求转换测试

### 阶段五：确认响应转换不回归

#### 目标

虽然本次根因位于请求侧，但必须锁定已验证正常的 Gemini → Claude 响应能力。

#### 非流式测试

Gemini 响应：

```json
{
  "parts": [
    {
      "thought": true,
      "text": "visible thought"
    },
    {
      "text": "final answer"
    }
  ]
}
```

Claude 期望：

```json
{
  "content": [
    {
      "type": "thinking",
      "thinking": "visible thought"
    },
    {
      "type": "text",
      "text": "final answer"
    }
  ]
}
```

#### 流式测试

Gemini thought part 期望产生：

```text
content_block_start(type=thinking)
thinking_delta
content_block_stop
```

思维后出现工具调用时，还必须保证：

```text
thinking block 完整关闭
tool_use 使用独立 index
工具参数完整
最终 stop_reason=tool_use
```

#### 重点文件

- `relaykit/ir/project/gemini/stream.go`
- `relaykit/ir/project/claude/stream.go`
- `relaykit/relayconvert/format_matrix_test.go`
- `relaykit/relayconvert/response_registry_test.go`
- `relay/channel/gemini/relay_gemini_usage_test.go`

除非新增测试发现独立缺陷，否则本阶段不应修改已正常工作的响应投影逻辑。

### 阶段六：真实接口回归

使用报告中的原始 Claude 场景进行回归，至少覆盖：

1. 非流式、带工具、`enabled + budget_tokens=2048`；
2. 流式、带工具、`enabled + budget_tokens=2048`；
3. 非流式、不带工具；
4. 流式、不带工具；
5. `adaptive + summarized + effort=high/xhigh`；
6. Gemini 3 Level 模型；
7. Gemini 2.5 Budget 模型。

回归时同时记录：

- 最终转换后的脱敏 Gemini 请求体；
- 是否下发 `includeThoughts`；
- 实际下发的是 level 还是 budget；
- Gemini `thoughtsTokenCount`；
- Gemini 是否返回 thought part；
- Claude 是否返回 thinking block/delta；
- 工具调用是否正常。

真实模型输出存在一定非确定性，因此验收必须以“请求字段正确 + 固定响应 fixture 投影正确”为确定性基础，真实 E2E 用于验证供应商行为，不单独承担协议转换正确性证明。

## 7. 测试计划

### 7.1 公共 projector 单元测试矩阵

| 模型 | disabled | budget | level | 期望控制 |
| --- | ---: | ---: | --- | --- |
| Gemini 3.7 | false | 2048 | 空 | `HIGH` |
| Gemini 3.7 | false | 2048 | medium | `MEDIUM` |
| Gemini 3.7 | false | nil | xhigh | `HIGH` |
| Gemini 3.7 | true | nil | 空 | `MINIMAL + hidden` |
| Gemini 2.5 | false | 2048 | 空 | budget 2048 |
| Gemini 2.5 | false | nil | high | budget -1 |
| Gemini 2.5 | true | nil | 空 | budget 0 |
| Unknown | false | 2048 | 空 | 保守兼容结果，且 level/budget 不冲突 |

每个用例同时断言：

- `IncludeThoughts`；
- `ThinkingBudget`；
- `ThinkingLevel`；
- 两种控制字段互斥。

### 7.2 请求转换测试

覆盖：

- Claude → Gemini；
- Claude → Vertex Gemini；
- Chat → Gemini，确保既有 `reasoning_effort` 不回归；
- Responses → Gemini，确保既有 `reasoning.summary/effort` 不回归；
- Gemini 原生请求在同协议转发时不被错误重写。

### 7.3 响应转换测试

覆盖：

- Gemini thought → Claude thinking；
- thought + text；
- thought + tool call；
- 多个流式 thought 分片；
- usage 中 `thoughtsTokenCount`；
- 没有 thought part 时不伪造 thinking 文本。

### 7.4 损失报告测试

覆盖：

- Claude budget → Gemini Level `HIGH`；
- budget 与 explicit level 同时存在；
- `xhigh/max → HIGH`；
- effort → Gemini Budget 动态预算；
- 明确关闭 → Level `MINIMAL + hidden`。

## 8. 验收标准

### 请求侧

1. Claude `enabled + budget_tokens=2048` 转 Gemini 3.7 后必须包含：
   - `includeThoughts=true`；
   - `thinkingLevel=HIGH`；
   - 不包含 `thinkingBudget`。
2. Claude 同时提供 effort 和 budget 时，Gemini Level 模型使用 effort 对应等级。
3. Gemini 2.5 继续保留显式数值预算。
4. 任意最终 Gemini 请求都不能同时包含 level 和 budget。
5. 模型思维后缀、provider 前缀和 Vertex publisher 前缀不能改变以上语义。

### 响应侧

1. 固定 Gemini thought fixture 能转换为 Claude thinking block。
2. 流式 thought 能转换为标准 Claude thinking 事件序列。
3. thought 与工具调用同时存在时顺序和 index 正确。
4. 上游没有 thought part 时不得伪造模型思维内容。

### 兼容性

1. Chat → Gemini 和 Responses → Gemini 已有思维转换测试继续通过。
2. Gemini 2.5 Budget 模式不回归。
3. Claude → Responses、Gemini → Chat 等其他协议路径不受影响。
4. 不新增前端设置，不改变现有前端 API 合同。

## 9. 风险与控制

### 9.1 正数预算统一降级为 HIGH 可能增加推理量

Level 模型无法精确表达数值 token 预算。选择 `HIGH` 的目的是避免“客户端明确开启思维但实际不思考”的静默失效。

控制措施：

- 有明确 effort 时始终使用 effort；
- 只有预算时才降级为 HIGH；
- 记录转换损失；
- 不设计无协议依据的预算阈值。

### 9.2 某些兼容代理可能接受 Gemini 3 的 thinkingBudget

部分代理可能宽松接受该字段，但本项目目标是按目标模型原生能力生成请求，不能依赖代理的偶然兼容行为。

控制措施：

- 已知 Level 模型统一输出原生 Level；
- Budget 模型继续输出 Budget；
- Unknown 模型保留兼容策略。

### 9.3 模型名识别错误

如果模型别名、provider 前缀或自定义映射未正确归一化，可能错误进入 Unknown 分支。

控制措施：

- 使用现有模型名归一化入口；
- 补充带前缀、publisher 和思维后缀测试；
- 能力判断继续集中在 `GeminiThinkingControlForModel`，禁止在多个转换器散落模型名判断。

### 9.4 真实模型 thought 输出仍可能存在非确定性

即使请求字段正确，供应商也可能在个别响应中不返回可见 thought 摘要。

控制措施：

- 确定性验收使用转换后请求断言和固定响应 fixture；
- E2E 将“上游未返回 thought”与“网关请求/响应映射失败”分开记录；
- 不通过重试或伪造文本强制制造思维链。

## 10. 非目标范围

本次不处理：

1. Chat → Gemini、Responses → Gemini 单次无可见 thought 的探针误报；
2. 强制 Gemini 每次都返回可见思维摘要；
3. 在无上游 thought 文本时伪造 Claude thinking；
4. 自动重试已经开始输出或已经生成工具调用的请求；
5. 暴露供应商不允许返回的私有完整思维链；
6. 新增前端开关或修改前端文案；
7. 为预算到等级设计任意 token 阈值。

## 11. 前后端一致性说明

本问题属于后端协议转换语义，不改变客户端请求格式、响应格式或现有系统设置：

- Claude 客户端继续使用原有 `thinking` 和 `output_config`；
- Gemini 上游请求仍使用原生 `generationConfig.thinkingConfig`；
- Claude 响应仍使用标准 thinking block/delta；
- 前端无需新增字段、开关或 i18n 文案；
- 若实施中决定将转换损失展示到前端，应另行设计后端字段、前端类型和所有语言翻译，不在本次默认范围内。

## 12. 实施后检查命令

按照项目 `AGENTS.md` 要求，实施完成后必须执行完整检查，而不是只运行局部测试。

```bash
# Go 格式化
gofmt -w <本次修改的 Go 文件>

# 根模块测试
go test ./...

# relaykit 独立模块测试
cd relaykit
go test ./...
cd ..

# Go lint
golangci-lint run ./...
cd relaykit
golangci-lint run ./...
cd ..

# 前端 OXLint、Vitest 和编译检查
cd web
bun run lint
bun run test
bun run build:check
cd ..

# 后端编译
go build ./...
go build -o bin/new-api.exe .

# 构建来源校验
go version -m bin/new-api.exe
git rev-parse HEAD
```

若项目实际脚本名称与上述命令存在差异，应使用 `package.json`、`makefile` 中的现有命令完成等价检查，但不得省略：

- go test；
- go fmt；
- golangci-lint；
- OXLint；
- Vitest；
- 前端编译；
- 后端编译。

## 13. 预期结果

修复后，报告中的 Claude 场景应从：

```text
Claude enabled + budget_tokens=2048
  → Gemini includeThoughts=true + thinkingBudget=2048
  → Gemini 未产生 thought
  → Claude 无 thinking
```

变为：

```text
Claude enabled + budget_tokens=2048
  → 识别目标 Gemini 3 为 Level 模式
  → Gemini includeThoughts=true + thinkingLevel=HIGH
  → Gemini 返回可见 thought 时
  → Claude thinking block / thinking_delta 正常下发
```

同时保持：

```text
Claude enabled + budget_tokens=2048
  → Gemini 2.5 Budget 模式
  → includeThoughts=true + thinkingBudget=2048
```

最终实现应修正公共能力投影，而不是在 Claude → Gemini 单一路径上增加局部特判。