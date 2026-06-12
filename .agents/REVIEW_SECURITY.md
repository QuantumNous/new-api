# .agents/REVIEW_SECURITY.md

> 目标：用于阶段性代码审查、安全排查、PR 前检查、发布前检查。
> 注意：日常小修改不要默认执行完整安全扫描，避免浪费时间和上下文。

## 1. 触发条件

只有以下情况执行完整代码审查和安全扫描：

- 用户明确要求“代码审查”“安全排查”“阶段性审查”。
- 功能开发完成，准备提交 PR。
- 准备合并主分支或发布。
- 依赖升级后。
- 修改登录、权限、支付、文件读写、远程接口、Webhook、Token、密钥、CI/CD。

## 2. 审查顺序

1. 查看当前变更：`rtk git status`、`rtk git diff`，必要时回退原始 `git diff`。
2. 识别变更类型和影响范围。
3. 如果已安装 Codex Security 插件，优先选择最窄的 Codex Security 工作流做上下文审查。
4. 继续执行必要的确定性扫描工具：Gitleaks、Semgrep、Trivy、zizmor。
5. 人工逻辑审查。
6. 按风险分级输出结果。
7. 对可自动修复项给出修复计划；高风险和可能误报必须标注人工确认。

## 3. Codex Security 插件优先工作流

如果 Codex 桌面端已安装 Codex Security 插件，阶段性安全审查优先使用它做上下文安全分析。

重要原则：

- Codex Security 不替代 Gitleaks、Semgrep、Trivy、zizmor。
- Codex Security 更适合上下文漏洞判断、威胁建模、攻击路径分析、可疑 finding 验证和最小修复建议。
- 传统扫描器更适合确定性扫描：密钥、规则型漏洞、依赖/文件系统、GitHub Actions workflow 风险。
- 首次扫描默认只读，不修改代码。
- 修复前必须让用户确认具体 finding。

### 3.1 当前改动安全回归审查

适用：功能开发完成、PR 前、合并前、敏感逻辑改动后。

推荐指令：

```text
Use $codex-security:security-diff-scan to review the current branch diff for security regressions. Keep the review scoped to changed code and directly supporting files. Do not modify code.
```

输出要求：

- 只审查当前 diff 和直接相关文件。
- 不修改代码。
- 按高风险 / 中风险 / 低风险 / 可能误报分类。
- 给出证据、影响、建议修复方式。
- 发现问题后先让用户确认，再进入修复。

### 3.2 指定范围安全扫描

适用：某个模块、目录、服务的专项审查。

推荐指令：

```text
Use $codex-security:security-scan to scan this repository or the scoped path for security vulnerabilities. Keep the scan grounded in code evidence, validate plausible findings where feasible, and return the final report paths. Do not modify code.
```

输出要求：

- 优先限定目录或模块，不要默认全仓。
- 先读报告，再判断是否需要修复。
- 不把 finding 当作自动合并依据。

### 3.3 深度全仓扫描

仅在以下情况使用：

- 发版前。
- 大版本重构后。
- 安全专项审计。
- 依赖大规模升级后。
- 用户明确要求全仓深度扫描。

推荐指令：

```text
Use $codex-security:deep-security-scan to run a higher-recall audit for the full repository. Do not modify code.
```

注意：

- deep scan 可能耗时更久，并消耗更多上下文和 tokens。
- 不作为日常小改默认步骤。

### 3.4 修复单个安全发现

只有在用户确认具体 finding 后，才使用：

```text
Use $codex-security:fix-finding to fix finding [finding ID or report reference]. Add focused regression coverage, verify legitimate behavior still works, and show that the original issue no longer reproduces. Do not broaden the change beyond this finding.
```

要求：

- 一次只修一个 finding。
- 最小修改，不做无关重构。
- 必须补充或说明回归测试。
- 修复后仍要运行项目检查脚本。
- 最终输出修改文件、修复原因、验证结果、仍需人工确认的地方。

## 4. 确定性安全扫描工具

阶段性审查时，根据场景继续运行以下命令。安全扫描报告优先保留原始输出，不要只依赖 RTK 压缩结果。

```bash
gitleaks detect --source . --no-banner
semgrep scan --config p/security-audit --config p/owasp-top-ten
trivy fs .
```

如果存在 `.github/workflows`：

```bash
zizmor .github/workflows
```

也可以通过统一脚本运行：

```powershell
.\scripts\codex-check.ps1 -Security
```

工具定位：

- Gitleaks：密钥、Token、凭据泄露扫描。
- Semgrep：规则型代码安全问题扫描。
- Trivy：依赖、镜像、文件系统风险扫描。
- zizmor：GitHub Actions workflow 风险扫描。
- Codex Security：上下文安全审查、攻击路径分析、finding 验证和最小修复建议。

## 5. 工具缺失处理

如果工具未安装：

- 不自动安装，除非用户明确要求。
- 记录缺失工具和建议安装方式。
- 继续做人工逻辑审查和可用的本地检查。

如果 Codex Security 插件未安装：

- 跳过 Codex Security 工作流。
- 使用本文件中的逻辑审查清单和确定性扫描工具。
- 不影响日常开发流程。

## 6. 逻辑审查清单

### 通用质量

- 是否有无关文件被修改。
- 是否存在大范围重构但没有必要说明。
- 是否破坏现有 API、路由、数据结构、配置兼容性。
- 是否缺少错误处理、空状态、加载状态。
- 是否缺少测试或回归验证。
- 是否出现硬编码、重复逻辑、临时调试代码。

### 前端/UI

- 是否兼容不同窗口尺寸和主题。
- 弹窗、按钮、菜单、提示语是否一致。
- 是否有无障碍、键盘操作、焦点、关闭行为问题。
- 隐藏功能是否仍能通过快捷入口、路由、右键菜单进入。

### 后端/API

- 是否校验输入。
- 是否正确鉴权和鉴别资源归属。
- 是否处理超时、重试、幂等、并发。
- 是否泄露内部错误、路径、SQL、Token。
- 日志是否包含敏感信息。

### 数据与兼容

- 是否影响旧数据。
- 是否需要迁移脚本。
- 是否可回滚。
- 是否需要灰度或 feature flag。

## 7. 风险分级

### 高风险

- 密钥、Token、证书泄露。
- 未授权访问、越权、鉴权绕过。
- SQL/命令/模板注入。
- 任意文件读写、路径穿越。
- 支付、账务、权限、生产发布链路问题。

### 中风险

- 重要错误处理缺失。
- 敏感日志泄露风险。
- 依赖漏洞但有利用条件。
- CI/CD 权限过大。
- 数据兼容或回滚风险。

### 低风险

- 可维护性问题。
- 重复代码。
- 非关键依赖提醒。
- 文档或测试不足。

### 可能误报

- 扫描工具无法确认上下文。
- 测试数据、示例密钥、mock 值。
- 需要业务规则判断的问题。

## 8. 输出格式

```md
## 审查结论

- 总体判断：可合并 / 需修复后合并 / 暂不建议合并
- 影响范围：
- 已运行检查：
- 未能运行检查及原因：

## 高风险

### 1. 标题
- 位置：
- 原因：
- 影响：
- 建议修复：
- 是否可自动修复：是/否

## 中风险

## 低风险

## 可能误报

## 建议处理顺序
```
