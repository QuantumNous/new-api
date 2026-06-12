# Codex 商业项目使用说明

> 这份文档用于你以后在需求开发、Bug 修复、UI 调整、技术迭代、优化、代码审查、安全扫描时参考。

## 1. 核心原则

Codex 不是“全自动乱改工具”，而是“受控工程执行器”。

正确工作流：

```text
理解项目 → 判断风险 → 制定计划 → 最小修改 → 运行验证 → 记录沉淀 → 人工验收
```

开发到一半的项目尤其不能让 Codex 一上来大改，必须先建立项目上下文和当前开发基线。

## 2. 第一次接入项目

### 2.1 新项目

```text
请先读取 AGENTS.md 和 .agents/WORKFLOW.md。

这是一个新商业项目，请初始化 Codex 项目上下文。
要求：
1. 识别技术栈、目录结构、启动/构建/测试命令。
2. 创建 docs/codex/PROJECT_CONTEXT.md。
3. 创建 docs/codex/CODE_STYLE.md。
4. 不修改业务代码。
5. 最后说明后续如何使用 Codex 参与开发。
```

### 2.2 开发到一半的项目

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

## 3. 新需求开发

```text
请按 AGENTS.md 和 .agents/WORKFLOW.md 执行。

任务：
【写清楚需求】

要求：
1. 先查看 git status，保护现有改动。
2. 先说明执行计划。
3. 如果没有高风险或必须确认的问题，可以直接按计划修改。
4. 修改后运行 .\scripts\codex-check.ps1。
5. 更新 docs/codex/CHANGELOG.md。
6. 如果形成长期设计决策，更新 docs/codex/DECISIONS.md。
7. 最后总结修改文件、原因、风险点、验证方式、人工验收点。
```

## 4. Bug 修复

```text
请按 AGENTS.md 和 .agents/WORKFLOW.md 的 Bug 修复流程处理。

Bug 现象：
【描述现象】

复现步骤：
【描述步骤】

报错信息：
【粘贴报错】

要求：
1. 先定位可能原因，不要直接改。
2. 找到最小修复点。
3. 不要做无关重构。
4. 修复后补充或说明无法补充测试的原因。
5. 更新 docs/codex/BUGS.md。
6. 运行 .\scripts\codex-check.ps1。
7. 输出回归验证步骤。
```

## 5. UI 调整

```text
请按 AGENTS.md 和 .agents/WORKFLOW.md 执行 UI 调整。

目标：
【描述页面、弹窗、按钮、布局、交互】

要求：
1. 保持现有 UI 风格，不引入新 UI 体系。
2. 先找到页面入口、组件、样式、文案、状态处理。
3. 检查 loading、empty、error 状态。
4. 不修改无关页面。
5. 修改后运行检查脚本。
6. 输出人工验收点。
```

## 6. 隐藏功能或关闭入口

```text
请按 AGENTS.md 和 .agents/WORKFLOW.md 执行功能隐藏。

需要隐藏：
【写功能名称】

要求：
1. 优先使用 feature flag、菜单过滤、路由过滤、条件渲染。
2. 不直接删除底层代码。
3. 检查是否存在多个入口：菜单、路由、快捷入口、弹窗、右键菜单、通知、设置页。
4. 修改后运行检查脚本。
5. 输出回滚方式。
6. 更新 docs/codex/CHANGELOG.md。
```

## 7. 技术迭代或重构

技术迭代默认是高风险任务，不能直接让 Codex 大改。

```text
请按 AGENTS.md 和 .agents/WORKFLOW.md 执行技术迭代分析。

目标：
【写技术目标】

要求：
1. 先只做影响分析，不修改代码。
2. 判断风险等级。
3. 列出影响模块、替代方案、阶段计划、回滚方式。
4. 拆成多个小任务。
5. 等我确认后再执行第一阶段。
```

## 8. 阶段性代码审查和安全扫描

不要每次小修改都跑完整安全扫描。适合在以下场景执行：

- 功能开发完成；
- 准备提交 PR；
- 准备合并主分支；
- 准备发布；
- 依赖升级后；
- 修改登录、权限、支付、文件读写、远程接口、CI/CD 后。

### 8.1 安装了 Codex Security 插件

当前改动安全审查：

```text
请读取 AGENTS.md 和 .agents/REVIEW_SECURITY.md。

使用 $codex-security:security-diff-scan 审查当前 branch diff 是否引入安全回归。
要求：
1. 只审查当前改动和直接相关文件。
2. 不修改代码。
3. 按高风险 / 中风险 / 低风险 / 可能误报分类。
4. 输出证据、影响和建议修复方式。
```

模块安全审查：

```text
请使用 $codex-security:security-scan 对【指定目录/模块】做安全审查。
要求：
1. 优先限定范围，不做全仓泛扫。
2. 不修改代码。
3. 输出报告路径和重点 findings。
```

深度全仓审计：

```text
请使用 $codex-security:deep-security-scan 对整个仓库做深度安全审计。
要求：
1. 不修改代码。
2. 输出报告路径和高风险问题。
3. 按修复优先级排序。
```

修复单个 finding：

```text
请使用 $codex-security:fix-finding 修复报告中的 finding【编号或报告引用】。
要求：
1. 只修复这个 finding。
2. 不做无关重构。
3. 增加聚焦回归验证。
4. 修复后运行 .\scripts\codex-check.ps1。
5. 输出修改文件、修复原因、验证结果、仍需人工确认的地方。
```

### 8.2 本地确定性安全扫描

```powershell
.\scripts\codex-check.ps1 -Security
```

或手动执行：

```bash
gitleaks detect --source . --no-banner
semgrep scan --config p/security-audit --config p/owasp-top-ten
trivy fs .
zizmor .github/workflows
```

## 9. 常见错误用法

不要这样说：

```text
帮我优化整个项目。
```

更好的说法：

```text
请先分析当前项目的性能瓶颈，不修改代码。列出可以分阶段优化的点、风险和验证方式。
```

不要这样说：

```text
把没用的代码都删掉。
```

更好的说法：

```text
请先识别疑似无用代码，不要删除。列出依据、调用链、风险和建议处理方式。
```

## 10. 推荐日常节奏

```text
开始前：让 Codex 查看 git status，保护已有改动。
开发中：只处理当前任务相关文件，不做无关重构。
完成后：运行 .\scripts\codex-check.ps1。
重要节点：使用 .agents/REVIEW_SECURITY.md 做阶段性审查。
长期沉淀：更新 docs/codex/CHANGELOG.md、BUGS.md、DECISIONS.md、RISKS.md。
```
