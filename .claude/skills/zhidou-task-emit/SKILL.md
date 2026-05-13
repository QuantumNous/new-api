---
name: zhidou-task-emit
description: 从知豆 Agent 改造任务清单(§14)里挑一条,生成规范的 Codex 任务单(Markdown),含分支名、改动范围、验收条件、高压线文件清单
when_to_use: 准备给 Codex 派活前,把任务号(如 T-01-06)传给我,我生成一份完整任务单
---

# Skill: zhidou-task-emit

## 作用

把知豆 Agent 改造项目的任务清单(存在 `C:\Users\道初\.claude\plans\ai-cosmic-dragonfly.md` 的 §14)里的一条任务,转换成 Codex 能直接执行的规范任务单。

## 输入

- **任务号**(如 `T-01-06` / `T-S3` / `T-A2`)

## 输出

一份 Markdown 任务单,包含:

1. **任务标题**:任务号 + 简短描述
2. **分支名建议**:如 `feat/agent-phase1-orchestrator`
3. **任务目标**:用 1~2 句话说清楚这个任务要达成什么
4. **改动范围**:
   - 新建文件清单(含路径)
   - 修改文件清单(含路径 + 修改点)
5. **依赖关系**:如果有前置任务,列出来
6. **验收条件**:如何判断任务完成(编译通过 / 单测通过 / 接口返回 200 / 前端显示 XX)
7. **高压线文件清单**(绝不允许改动):
   - `middleware/auth.go`(特别是 `New-Api-User` 校验逻辑)
   - `controller/relay.go`(特别是 225-236 行的 Pre/Refund 配对)
   - `controller/topup.go` / `controller/stripe.go` / `controller/creem.go` / `controller/waffo.go`(支付回调)
   - `model/user.go` 的 `role` / `status` / `quota` 字段修改逻辑
   - 任何现有 `relay/` / `middleware/` / `router/` 下的文件(除非任务明确说要改)
8. **参考资料**:
   - 相关的 plan 章节(如"见 §2.4 Orchestrator 伪代码")
   - 相关的现有代码文件(如"参考 `controller/user.go:GetSelf` 的鉴权模式")

## 执行步骤

1. **读取 plan 文件**:`C:\Users\道初\.claude\plans\ai-cosmic-dragonfly.md`
2. **定位任务**:在 §14 里找到对应任务号的那一行
3. **提取信息**:从表格列提取:分支名建议 / 任务描述 / 新建文件 / 修改文件 / 依赖 / 验收
4. **补充上下文**:
   - 如果任务涉及"工具实现",补充 §12.1 的"工具契约"要求
   - 如果任务涉及"前端组件",补充"保持 Semi UI 风格 + i18n"
   - 如果任务涉及"数据库表",补充"预留 `tenant_id INT DEFAULT 0` 列"(见 §5.0.1)
5. **生成高压线清单**:从 §5.0 的七条铁律 + §8 风险登记里提取"绝不能改的文件"
6. **格式化输出**:按上述"输出"章节的 8 点结构,生成 Markdown

## 示例

### 输入

```
T-01-06
```

### 输出

```markdown
# 任务单:T-01-06 实现 Orchestrator 主循环

**分支名建议**:`feat/agent-phase1-orchestrator`

## 任务目标

实现 Agent 的核心编排循环(ReAct 模式):调 LLM → 拿到 tool_calls → 执行工具 → 塞回结果 → 再调 LLM,直到 LLM 不再调工具或达到 max_tool_steps。

## 改动范围

### 新建文件

无(本任务是补全已有空壳)

### 修改文件

- `service/agent/orchestrator.go`:补全 `RunConversationTurn(ctx, userId, userMessage)` 函数
  - 调用 `loopback.CallChatCompletion()` 发起 LLM 请求
  - 解析返回的 `tool_calls` 数组
  - 遍历每个 tool_call,从 `registry.GetTool(name)` 拿到工具函数,执行
  - 把工具结果塞回 messages 数组,再次调 LLM
  - 循环直到 LLM 返回 `finish_reason="stop"` 或达到 `max_tool_steps=10`

## 依赖关系

- **前置任务**:T-01-01(loopback 调用器) / T-01-03(入口护栏)
- **后续任务**:T-01-08(Agent 控制器会调用这个 Orchestrator)

## 验收条件

1. 编译通过,`go vet` 0 警告
2. 单测通过:模拟 2 轮工具调用(第 1 轮调 `list_tokens`,第 2 轮调 `get_balance`,第 3 轮 LLM 返回最终回答)
3. 单测覆盖:超 10 步强制终止(防死循环)

## 高压线文件清单(绝不允许改动)

- `middleware/auth.go`(特别是 `New-Api-User` 校验逻辑,行 95-122)
- `controller/relay.go`(特别是 225-236 行的 Pre/Refund 配对)
- `controller/topup.go` / `controller/stripe.go` / `controller/creem.go` / `controller/waffo.go`(支付回调)
- `model/user.go` 的 `role` / `status` / `quota` 字段修改逻辑
- 任何现有 `relay/` / `middleware/` / `router/` 下的文件

## 参考资料

- **Plan §2.4**:Orchestrator 伪代码
- **Plan §12.1 第④步**:编排循环(ReAct)的业界标准模式
- **现有代码**:`controller/relay.go:relayHandler` 的流式处理模式可参考

## 实现提示

- `max_tool_steps` 硬编码为 10,后续可改为配置项
- 工具执行失败时,把错误信息塞回 LLM,让它决定是重试还是告诉用户
- 每轮循环都要检查 `ctx.Done()`,支持用户中断
```

## 注意事项

1. **高压线清单是硬性的**:Codex 如果改了这些文件,PR 会被我(Claude Code)直接驳回。
2. **验收条件要具体**:不要写"功能正常",要写"单测通过 / 接口返回 200 / 前端显示 XX"。
3. **参考资料要精准**:给出 plan 章节号 + 现有代码文件路径,Codex 才能快速定位。
