# Codex 桌面端商业项目规则包 v2

这是一套给 Codex 桌面端/CLI 在真实商业项目中使用的最小增强规则包。

它适用于：

- 新项目初始化；
- 已有项目接入；
- 日常开发、Bug 修复、UI 调整；
- 需求分析、产品文档、UI 方案、任务拆解；
- 模块开发、技术迭代、架构调整；
- 未提交代码审查；
- 某个功能多提交范围审查；
- 阶段性安全扫描；
- 支付、交易、余额、权限等严格审查。

## 文件说明

```text
AGENTS.md                         # 核心入口：边界、风险分级、按需加载
.agents/WORKFLOW.md               # 日常开发、Bug、UI、架构调整、新项目接入
.agents/PLAN_POLICY.md            # 执行前计划、任务拆解、阶段执行记录规则
.agents/PRODUCT_WORKFLOW.md       # 需求分析、UI 设计、产品文档、验收标准
.agents/REVIEW_SECURITY.md        # 两类代码审查、安全扫描、Codex Security 工作流
.agents/PAYMENT_REVIEW.md         # 支付、交易、权限、生产数据严格审查
.agents/TOKEN_POLICY.md           # token 控制、RTK/摘要、证据保留策略
.agents/LOOP_POLICY.md            # 受控 Loop、自动修复轮数、停止条件
.agents/CHANGE_POLICY.md          # Bug/需求变更/决策记录的索引与归档规则
scripts/codex-check.ps1           # Windows PowerShell 通用检查脚本
USAGE_GUIDE.md                    # 使用手册与提示词模板
README.md                         # 本说明
```

## 重要设计取舍

本规则包不包含 `docs/codex/*`，因为这些是项目使用过程中生成的项目资料，不应该预置到所有项目里。

升级已有项目时，只覆盖规则文件，不要删除已有：

```text
docs/codex/*
```

## 快速使用

把本包解压到项目根目录后，在 Codex 桌面端输入：

```text
请先读取 AGENTS.md 和 .agents/WORKFLOW.md。
这是一个商业项目，请先接入 Codex 工作流，但不要修改业务代码。
```

日常开发：

```text
请按 AGENTS.md 执行。任务：……
```

需求/产品文档：

```text
请读取 AGENTS.md 和 .agents/PRODUCT_WORKFLOW.md，把下面想法整理成需求分析、UI 方案、任务拆解和验收标准：……
```

未提交代码审查：

```text
请按 .agents/REVIEW_SECURITY.md 审查当前未提交代码，不要修改代码。
```

支付/交易严格审查：

```text
请读取 .agents/PAYMENT_REVIEW.md，对当前支付/交易相关改动做严格审查，不要修改代码。
```

## 检查脚本

日常检查：

```powershell
.\scripts\codex-check.ps1
```

阶段性安全扫描：

```powershell
.\scripts\codex-check.ps1 -Security
```

严格模式：

```powershell
.\scripts\codex-check.ps1 -Security -Strict
```

多提交范围辅助：

```powershell
.\scripts\codex-check.ps1 -ReviewBase <base> -ReviewHead <head>
```
