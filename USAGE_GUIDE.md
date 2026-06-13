# Codex 桌面端商业项目使用手册 v2

> 使用目标：让 Codex 在商业项目里少打扰、少浪费 token、能执行、可验证、可回滚、可审查、可沉淀。

## 1. 这套规则包解决什么

它不是提示词合集，而是一个最小工程规约：

```text
AGENTS.md 定边界
.agents 按需加载专项流程
scripts 做验证入口
docs/codex 在项目使用中沉淀索引和关键事实
Codex 内置能力负责执行、审查、worktree 隔离和安全扫描
```

## 2. 为什么不预置 docs/codex

`docs/codex/*` 应该由 Codex 根据具体项目生成，例如：

```text
docs/codex/PROJECT_CONTEXT.md
docs/codex/CODE_STYLE.md
docs/codex/DECISIONS.md
docs/codex/OPEN_RISKS.md
docs/codex/BUG_INDEX.md
docs/codex/CHANGE_INDEX.md
docs/codex/TASK_STATE.md
```

这些内容和项目强相关，不应放进通用压缩包。升级规则包时也不要删除它们。

## 3. 第一次接入已有项目

```text
请先读取 AGENTS.md、.agents/WORKFLOW.md 和 .agents/CHANGE_POLICY.md。

这是一个已经开发到一半的商业项目，请先接入 Codex 工作流，但不要修改业务代码。

请完成：
1. 查看 git status，识别当前是否有未提交改动。
2. 识别项目技术栈、目录结构、启动/构建/测试命令。
3. 创建或更新 docs/codex/PROJECT_CONTEXT.md。
4. 创建或更新 docs/codex/CODE_STYLE.md。
5. 如当前 git diff 中已有改动，请总结这些改动属于哪些模块，不要覆盖。
6. 发现风险时写入 docs/codex/OPEN_RISKS.md。
7. 最后告诉我：当前项目适合怎样分阶段让 Codex 参与开发。
```

## 4. 新项目开发

```text
请按 AGENTS.md、.agents/WORKFLOW.md、.agents/PLAN_POLICY.md 执行。

任务：初始化/开发【项目名称】。

要求：
1. 先做执行计划，不直接大规模生成。
2. 先建立最小可运行闭环。
3. 明确本期做什么、不做什么。
4. 创建必要项目文件，但不要引入无关复杂架构。
5. 运行 .\scripts\codex-check.ps1 或项目对应检查。
6. 创建或更新 docs/codex/PROJECT_CONTEXT.md、DECISIONS.md、OPEN_RISKS.md。
```

## 5. 需求分析、产品文档、UI 方案

```text
请读取 AGENTS.md 和 .agents/PRODUCT_WORKFLOW.md。

把下面想法整理为：
1. 需求分析
2. UI/交互方案
3. 功能范围：本期做 / 本期不做
4. 任务拆解
5. 验收标准
6. 风险与待确认问题

想法：
【填写】
```

## 6. 日常需求开发

```text
请按 AGENTS.md、.agents/WORKFLOW.md、.agents/PLAN_POLICY.md 执行。

任务：
【写需求】

要求：
1. 先查看 git status。
2. 先给出简短执行计划。
3. 没有高风险或必须确认问题时，可直接按计划修改。
4. 修改后运行 .\scripts\codex-check.ps1。
5. 按 .agents/CHANGE_POLICY.md 判断是否需要更新 CHANGE_INDEX/DECISIONS/OPEN_RISKS。
6. 输出修改文件、原因、验证结果、风险点和人工验收点。
```

## 7. Bug 修复

```text
请按 AGENTS.md、.agents/WORKFLOW.md、.agents/LOOP_POLICY.md 处理。

Bug 现象：
【描述】

复现步骤：
【描述】

报错信息：
【粘贴】

要求：
1. 先定位根因，不要直接乱改。
2. 做最小修复。
3. 不做无关重构。
4. 修复后运行检查脚本。
5. 判断是否需要写入 docs/codex/BUG_INDEX.md；普通一次性小 bug 不长期记录。
6. 输出回归验证步骤。
```

## 8. UI 调整

```text
请按 AGENTS.md 和 .agents/WORKFLOW.md 执行 UI 调整。

目标：
【描述页面/弹窗/按钮/布局】

要求：
1. 保持现有 UI 风格。
2. 检查 loading、empty、error、disabled、权限不足状态。
3. 不改无关页面。
4. 如果涉及 i18n，同步文案。
5. 修改后输出人工验收点。
```

## 9. 同时修 Bug + 新功能 + UI

```text
请按 AGENTS.md、.agents/WORKFLOW.md、.agents/PLAN_POLICY.md 执行混合任务。

任务包含三部分：
1. Bug 修复：【描述】
2. 新功能：【描述】
3. UI 调整：【描述】

要求：
1. 先判断三部分是否互相影响。
2. 如果没有 L3/L4/L5 风险，按“Bug 修复 → 新功能最小闭环 → UI 调整”的顺序执行。
3. 每部分尽量独立验证。
4. 不做无关重构。
5. 最终按 Bug 修复 / 新功能 / UI 调整 分类总结。
```

## 10. 未提交代码审查

```text
请读取 AGENTS.md、.agents/REVIEW_SECURITY.md 和 .agents/TOKEN_POLICY.md。

任务：
对当前未提交代码做代码审查和安全排查，不要修改代码。

要求：
1. 查看 git status 和 git diff。
2. 只审查当前 diff 和直接相关文件。
3. 检查 SQL 注入、命令注入、XSS、越权、敏感信息泄露、资源泄露、数据损坏风险。
4. 按高风险 / 中风险 / 低风险 / 可能误报分类。
5. 每个问题给出文件位置、原因、影响、建议。
6. 标明哪些可自动修复，哪些必须人工确认。
```

如果已安装 Codex Security，可加：

```text
如果可用，请使用 $codex-security:security-diff-scan 做当前 diff 安全审查；不要修改代码。
```

## 11. 功能多提交范围审查

```text
请读取 AGENTS.md、.agents/REVIEW_SECURITY.md 和 .agents/TOKEN_POLICY.md。

任务：
审查从 <base> 到 <head> 的功能完整改动，不要只看最后一次提交，不要修改代码。

范围：
base: 【main 或 commit id】
head: 【feature 分支或 commit id】

要求：
1. 使用 git diff <base>...<head> 审查完整范围。
2. 检查多次提交之间是否有遗漏、残留、重复逻辑、临时调试代码。
3. 检查最终状态是否可合并。
4. 检查是否需要补测试、补文档、补回滚说明。
5. 输出高/中/低风险和可能误报。
```

脚本辅助：

```powershell
.\scripts\codex-check.ps1 -ReviewBase <base> -ReviewHead <head>
```

## 12. 阶段性安全扫描

用于 PR 前、合并前、发版前、敏感逻辑修改后。

```text
请读取 AGENTS.md、.agents/REVIEW_SECURITY.md 和 .agents/TOKEN_POLICY.md。

任务：
对当前变更做阶段性代码审查和安全扫描。

要求：
1. 不修改代码。
2. 优先使用最窄审查范围。
3. 安全扫描报告保留关键原始输出。
4. 按高风险 / 中风险 / 低风险 / 可能误报分类。
```

本地扫描：

```powershell
.\scripts\codex-check.ps1 -Security
```

## 13. 支付、交易、权限严格审查

只在不能出错的场景手动触发或 L5 自动触发。

```text
请读取 AGENTS.md、.agents/PAYMENT_REVIEW.md、.agents/REVIEW_SECURITY.md 和 .agents/TOKEN_POLICY.md。

任务：
对当前支付/交易/权限相关改动做严格审查，不要修改代码。

要求：
1. 明确数据流、权限边界、失败路径、幂等策略、回滚方案。
2. 检查重复扣费、重复回调、状态机错误、金额精度、SQL 注入、越权、密钥泄露。
3. 检查并发、重试、事务、补偿逻辑。
4. 输出阻塞项、高风险、中风险、低风险、必须人工确认项。
5. 未通过前不建议合并或发布。
```

严格扫描：

```powershell
.\scripts\codex-check.ps1 -Security -Strict
```

## 14. 推荐安装与不建议安装

优先安装/使用：

```text
Codex Security plugin
Semgrep
Gitleaks
可选：Trivy
可选：zizmor
可选：RTK
```

谨慎安装：

```text
大量 code review skills
大量 MCP
数据库写权限 MCP
默认全局压缩上下文的工具
自动写 AGENTS.md 的工具
```

## 15. 最小日常输入

日常开发：

```text
请按 AGENTS.md 执行。任务：……
```

Bug：

```text
请按 Bug 修复流程处理。现象：……
```

产品需求：

```text
请按 PRODUCT_WORKFLOW 整理需求。想法：……
```

未提交代码审查：

```text
请审查当前未提交代码，不要修改代码。
```

支付/交易严格审查：

```text
请按 PAYMENT_REVIEW 严格审查当前支付/交易相关改动，不要修改代码。
```
