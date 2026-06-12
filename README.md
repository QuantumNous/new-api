# Codex 商业项目规则包（含 Codex Security 版）

这是一套给 Codex 桌面端/CLI 在真实商业项目中使用的最小但完整规则包，适用于：

- 新项目初始化；
- 开发到一半的项目接入；
- 新需求开发；
- Bug 修复；
- UI 调整；
- 技术迭代；
- 性能优化；
- 阶段性代码审查；
- Codex Security 安全审查。

## 文件说明

```text
AGENTS.md                         # Codex 每次进入项目都应遵守的核心规则
.agents/WORKFLOW.md               # 新项目、中途接入、迭代、Bug 修复、沉淀文档流程
.agents/REVIEW_SECURITY.md        # 阶段性代码审查、安全扫描、Codex Security 插件优先级
scripts/codex-check.ps1           # Windows PowerShell 通用检查脚本
examples/USAGE_GUIDE.md           # 长期参照的使用说明
README.md                         # 本说明
```

## 使用方式

把这些文件复制到项目根目录。

第一次使用时，在 Codex 中输入：

```text
请先读取 AGENTS.md，初始化项目上下文文档。不要修改业务代码。
```

开发到一半的项目接入时，使用：

```text
请先读取 AGENTS.md 和 .agents/WORKFLOW.md。

这是一个已经开发到一半的商业项目，请先接入 Codex 工作流，但不要修改业务代码。

请完成：
1. 查看 git status，识别当前是否有未提交改动。
2. 识别项目技术栈、目录结构、启动/构建/测试命令。
3. 创建或更新 docs/codex/PROJECT_CONTEXT.md。
4. 创建或更新 docs/codex/CODE_STYLE.md。
5. 如果当前 git diff 中已有改动，请总结这些改动属于哪些模块，不要覆盖。
6. 发现风险时写入 docs/codex/RISKS.md。
7. 最后告诉我：当前项目是否适合继续让 Codex 参与开发，以及后续建议怎么分阶段执行。
```

开发功能时：

```text
请按 AGENTS.md 和 .agents/WORKFLOW.md 执行。
任务：……
```

修 Bug 时：

```text
请按 Bug 修复流程处理。
现象：……
报错：……
```

阶段性代码审查/安全扫描时：

```text
请按 .agents/REVIEW_SECURITY.md 对当前变更做阶段性审查。
```

如果已安装 Codex Security 插件，当前改动安全审查优先使用：

```text
Use $codex-security:security-diff-scan to review the current branch diff for security regressions. Keep the review scoped to changed code and directly supporting files. Do not modify code.
```

## 自动生成的文档

以下文档不随包提供，由 Codex 在项目使用过程中自动创建和维护：

```text
docs/codex/PROJECT_CONTEXT.md
docs/codex/CODE_STYLE.md
docs/codex/DECISIONS.md
docs/codex/CHANGELOG.md
docs/codex/BUGS.md
docs/codex/ASSUMPTIONS.md
docs/codex/RISKS.md
```

这样可以避免新项目一开始出现大量空文档，同时保留长期沉淀能力。

## 检查脚本

日常验证：

```powershell
.\scripts\codex-check.ps1
```

阶段性安全扫描：

```powershell
.\scripts\codex-check.ps1 -Security
```

严格模式，工具缺失也视为失败：

```powershell
.\scripts\codex-check.ps1 -Security -Strict
```
