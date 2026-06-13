# .agents/REVIEW_SECURITY.md

> 目标：用于未提交代码审查、多提交功能审查、阶段性安全排查、PR 前检查、发布前检查。  
> 原则：日常不全量重审；风险变高时扩大范围；安全证据必须可追溯。

## 1. 触发条件

以下情况执行阶段性代码审查或安全扫描：

- 用户明确要求“代码审查”“安全排查”“阶段性审查”。
- 功能开发完成，准备提交 PR、合并主分支或发布。
- 某个功能跨多个 commit，需要审查整个功能范围。
- 依赖升级后。
- 修改登录、权限、支付、交易、文件读写、远程接口、Webhook、Token、密钥、CI/CD。

小文案、小 UI 不默认执行完整安全扫描，但仍保留明显风险检查。

## 2. 未提交代码审查

适用：当前工作区有未提交改动，需要审查即将提交的内容。

优先范围：

```bash
git status --short
git diff --stat
git diff --name-only
git diff
```

如已安装 RTK，可先用：

```bash
rtk git status
rtk git diff
```

要求：

- 只审查未提交 diff 和直接相关文件。
- 不修改代码，除非用户明确要求修复。
- 输出高/中/低风险和可能误报。
- 每个问题给出文件位置、原因、影响、建议修复方式。

如安装 Codex Security，可使用：

```text
Use $codex-security:security-diff-scan to review the current working tree diff for security regressions. Keep the review scoped to changed code and directly supporting files. Do not modify code.
```

## 3. 功能多提交范围审查

适用：某个功能已经提交多次，需要审查 base 到 head 的最终状态。

优先让用户提供：

```text
base: main 或 commit id
head: feature branch 或 commit id
```

如果用户未提供，先尝试：

```bash
git branch --show-current
git merge-base main HEAD
git log --oneline --decorate --graph --max-count=30
git diff --stat <base>...<head>
git diff <base>...<head>
```

要求：

- 审查整个功能范围，不只看最后一次 commit。
- 检查最终状态，不逐个 commit 挑风格问题。
- 检查遗漏、回滚残留、重复逻辑、临时调试代码。
- 检查是否需要补测试、补文档、补回滚说明。
- 输出是否建议合并、是否需要 squash、是否有阻塞风险。

如安装 Codex Security，可使用：

```text
Use $codex-security:security-diff-scan to review the diff from <base> to <head> for security regressions. Keep the review scoped to this feature range and directly supporting files. Do not modify code.
```

## 4. Codex Security 工作流

如 Codex 桌面端已安装 Codex Security 插件，优先选择能回答问题的最窄 workflow：

- 当前 diff / branch diff：`security-diff-scan`
- 指定路径或中等范围：`security-scan`
- 发版前、安全专项、大重构后：`deep-security-scan`
- 修复确认后的单个 finding：`fix-finding`

原则：

- `deep-security-scan` 不作为日常默认流程。
- 首次扫描默认只读，不修改代码。
- Codex Security 不替代 Gitleaks、Semgrep、Trivy、zizmor 和人工验收。
- AI 审查适合上下文漏洞判断；确定性工具适合固定模式扫描。

## 5. 确定性安全扫描工具

阶段性审查时，根据场景运行：

```bash
gitleaks detect --source . --no-banner
semgrep scan --config p/security-audit --config p/owasp-top-ten
trivy fs .
```

如果存在 `.github/workflows`：

```bash
zizmor .github/workflows
```

Windows 统一入口：

```powershell
.\scripts\codex-check.ps1 -Security
```

工具缺失时：

- 不自动安装，除非用户明确要求。
- 记录缺失工具和建议安装方式。
- 继续做可用的本地检查和人工逻辑审查。
- 严格模式下，关键工具缺失应阻塞合并/发布，除非人工确认豁免。

## 6. 必查风险清单

### 6.1 常见安全漏洞

- SQL 注入：字符串拼接 SQL、动态 order/filter、未参数化查询。
- 命令注入：用户输入进入 shell、脚本、系统命令。
- XSS：未转义 HTML、危险 innerHTML、模板拼接。
- SSRF：用户可控 URL 请求内网或元数据服务。
- 路径穿越：用户输入拼接文件路径。
- 任意文件读写：上传/下载/删除路径未限制。
- 越权访问：缺少身份、租户、角色、资源归属检查。
- 敏感信息泄露：Token、cookie、Authorization、密钥、手机号、邮箱、生产路径。
- CSRF/CORS：跨站请求、防护和跨域配置不当。
- 反序列化/模板注入：用户输入进入模板或对象恢复逻辑。

### 6.2 业务与数据风险

- 旧数据兼容。
- 并发与幂等。
- 重试导致重复扣费/重复提交。
- 回滚后数据状态不一致。
- 日志泄露业务敏感数据。
- feature flag 关闭后是否仍安全。

### 6.3 资源泄露

- 前端：事件监听、定时器、订阅、AbortController、无限缓存。
- Node.js：stream/socket/file handle、全局 Map、异步任务堆积。
- Go：goroutine、context、defer Close、channel。
- Python：文件/session/连接、全局缓存、后台任务。
- Java/C#：连接池、线程池、Disposable、listener/subscription。

## 7. 审查输出格式

```md
## 审查结论

- 审查类型：未提交代码 / 功能多提交范围 / 阶段性安全 / 发布前安全
- 审查范围：
- 总体判断：可继续 / 需修复后继续 / 暂不建议合并
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
