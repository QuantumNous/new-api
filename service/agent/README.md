# Agent Service

知豆AI的Agent服务模块，负责将用户自然语言转换为API调用。

## 目录结构

- `orchestrator.go` - 核心编排循环（ReAct模式）
- `registry.go` - 工具注册表，管理所有可用工具
- `guard_in.go` - 入口护栏：身份校验、速率限制、破冰额度检查
- `guard_out.go` - 出口护栏：输出脱敏、审计落库
- `loopback.go` - 内部HTTP调用器（后续添加）
- `tools_readonly.go` - 只读工具实现（后续添加）
- `tools_mutation.go` - 写入工具实现（后续添加）

## 核心流程

用户消息 -> GuardIn -> Orchestrator -> LLM -> 工具执行 -> GuardOut -> 返回用户
