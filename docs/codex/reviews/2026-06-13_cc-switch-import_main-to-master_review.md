# 2026-06-13 CC Switch 导入功能安全审查

## 审查范围

- 类型：功能多提交范围安全审查。
- base：`main`
- head：`master`
- diff：`main...master`
- 功能：令牌管理中的 CC Switch 导入，包括导入选项、导入链接生成、前端导入弹窗、相关测试和文档。
- 不做：不审查无关历史，不做全仓 deep scan，不修改业务代码，不安装依赖，不修改数据库、配置、CI/CD 或生产环境文件。

## Git 范围确认

- `git status --short`：无输出，工作区当时干净。
- `git branch --show-current`：`master`
- `git merge-base main master`：`d2576ddcd31ff752c30b54d1781e802e4021f824`
- `git log --oneline --decorate --graph main..master`：`master` 相对 `main` 有 9 个提交：
  - `83f8ba8d (HEAD -> master, origin/master) 图形调整`
  - `79db80f8 布局修改`
  - `75179a67 Refine CC Switch import modal styling`
  - `bae38ba0 图形展示`
  - `9407f662 频繁搜索报错`
  - `7d8e25d5 导入`
  - `cbec0c61 Add Windows Docker launch script and local compose setup`
  - `66a80cc2 需求分析`
  - `5fe9bd51 AGENTS.md`
- `git diff --stat main...master`：85 个文件，约 10062 行新增、1088 行删除。
- `git diff --name-only main...master`：已用于生成 Codex Security diff worklist。
- Codex Security worklist：`deep_review_input.csv` 共 38 行，`work_ledger.jsonl` 共 38 条完成收据。

## 总体结论

需修复后继续。

本次没有发现 SQL 注入、命令注入、路径穿越、XSS/模板注入、不安全反序列化、配置注入、跨用户越权、动态 SQL/排序字段白名单缺失导致的直接漏洞。核心未关闭风险是：导入链接把用户完整 token key 与硬编码第三方 endpoint 组合，可能让非 Xistree/self-hosted 部署的用户 token 被配置到错误的外部 API 主机。

## 已运行检查

- `git status --short`
- `git branch --show-current`
- `git merge-base main master`
- `git log --oneline --decorate --graph main..master`
- `git diff --stat main...master`
- `git diff --name-only main...master`
- `git diff main...master`，结合相关支持文件做完整功能差异审查。
- Codex Security diff scan：已按 threat-model、finding-discovery、validation、attack-path-analysis、final report 顺序完成。
- `gitleaks detect --source . --no-banner --log-opts "main..master" --report-format json --report-path ... --redact=100`：通过，扫描 9 个提交，未发现本次范围内泄露。
- `trivy fs . --format json --output ...`：完成；0 个漏洞、0 个 misconfiguration；2 个 secret 命中位于不属于 `main...master` 变更的旧文件/构建产物，作为范围外工具输出记录。
- `zizmor .github/workflows --format json`：完成并生成报告；命中 CI workflow 风险，但 workflow 文件未在 `main...master` 中变更，本次不计入功能审查结论。
- Codex Security 最终报告：
  - Markdown：`C:\tmp\codex-security-scans\new-api\83f8ba8da2c0_20260613T000000Z\report.md`
  - HTML：`C:\tmp\codex-security-scans\new-api\83f8ba8da2c0_20260613T000000Z\report.html`
  - 报告格式校验：通过。

## 未能运行检查及原因

- `.\scripts\codex-check.ps1 -ReviewBase main -ReviewHead master -Security`：直接执行被本机 PowerShell 执行策略阻止。
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\codex-check.ps1 -ReviewBase main -ReviewHead master -Security`：脚本解析失败，`scripts/codex-check.ps1:70` 与 `scripts/codex-check.ps1:138` 报 `Unexpected token '}'`。本次只记录，不修改脚本。
- 定向 Go 测试未能运行：`go` 未安装或不在 `PATH`。
- `semgrep scan --config p/security-audit --config p/owasp-top-ten`：超时，未生成可用报告。

## 高风险

无。

## 中风险

### [P2] CC Switch 导入链接硬编码第三方 endpoint，同时嵌入用户完整 API key

- 位置：`service/ccswitch_import.go:15`、`service/ccswitch_import.go:78`、`service/ccswitch_import.go:79`、`controller/token_test.go:852-866`
- 风险：`CreateCCSwitchImportLink` 生成 `ccswitch://v1/import` 时固定写入 `endpoint=https://api.xistree.hk/`，同时把 `token.GetFullKey()` 写入 `apiKey`。如果部署不是 `api.xistree.hk`，导入后的本地客户端会把当前部署签发的用户 token 发往硬编码第三方 endpoint。
- 现有缓解：接口需要登录，服务层按 `id + user_id` 查询 token；响应使用 `DisableCache`；导入链接使用 `url.Values` 编码；import-link 路由有 `CriticalRateLimit`。
- 为什么仍成立：这些控制能降低越权、缓存和 query 注入风险，但不能保证 endpoint 与签发 token 的部署一致。测试还明确断言忽略 `ServerAddress`。
- 建议：用当前部署的 canonical `ServerAddress` 生成 endpoint，并在配置缺失时 fail closed；如果该功能只允许 Xistree 专用部署使用，应增加显式开关/环境约束，并在测试里覆盖该前提。

## 低风险

### [P3] 导入链接的 model 字段未强制使用后端返回的模型白名单

- 位置：`service/ccswitch_import.go:65-66`、`service/ccswitch_import.go:80`、`service/ccswitch_import.go:92-97`、`service/ccswitch_model_cache.go:34-50`、`controller/token_test.go:736`、`controller/token_test.go:773`
- 风险：`import-options` 会按用户可用组返回模型列表，但 `import-link` 只校验主 `model` 非空，未校验请求值是否来自同一后端白名单；Claude alias 字段也直接写入导入链接。
- 影响校准：`url.Values` 阻止 query 注入，`middleware/distributor.go:59-74` 在实际 relay 时仍检查 token 模型限制，因此没有证明可绕过 New API 服务端授权。当前更偏配置完整性和外部客户端导入质量问题。
- 建议：在服务端用 `GetCCSwitchModelOptionsForUser` 的结果做 allowlist 校验；如需支持自定义模型，应显式定义长度、字符集、枚举/别名策略，并补充未知模型和异常 alias 的负向测试。

### 产品验收问题：新增中文 i18n 文案出现乱码/占位符

- 位置：`web/default/src/i18n/locales/zh.json` 等本次新增/修改的导入相关文案。
- 判断：未发现 XSS/模板注入路径，但存在人工验收风险，建议发布前校对。

## 可能误报 / 范围外发现

- `gitleaks` 全历史扫描曾发现旧历史泄露，但 scoped `main..master` 扫描无泄露；本次不把旧历史计入功能审查。
- `trivy` 的 2 个 secret 命中位于 `web/classic/src/components/table/channels/modals/EditChannelModal.jsx` 和 `web/classic/dist/static/js/index.2f066424e5.js`，这两个文件未在 `main...master` 中变更，本次作为范围外记录。
- `zizmor` 报告了 `.github/workflows` 的 CI 风险，但 workflow 文件未在本次 diff 中变更，建议后续单独做 CI 安全审查。
- demo/local compose 中的测试 key 和本地默认密码属于示例/本地开发配置；scoped gitleaks 未发现本次范围内真实密钥泄露。

## 可自动修复项

- 将 `CCSwitchEndpoint` 改为从当前部署配置生成，并增加空配置失败处理。
- import-link 对 `model` / Claude alias 字段使用后端模型 allowlist 或明确的 custom model policy。
- 修正新增 i18n 乱码文案。

本次按用户要求只读审查，未修改业务代码。

## 必须人工确认项

- `master` 的 CC Switch 导入是否必须支持 self-hosted / 非 `api.xistree.hk` 部署。
- 如果确实只面向 Xistree 专用部署，是否接受用显式配置开关限制该功能，并在文档/测试中固化。
- 下游 CC Switch 协议处理器对异常 model 字符串是否有额外危险行为；本仓库无法动态验证。

## 建议处理顺序

1. 先修复硬编码 endpoint + full token key 的组合风险。
2. 再补服务端模型 allowlist 和负向测试。
3. 修正 i18n 文案乱码。
4. 安装/配置 Go 后重跑定向后端测试；修复 `scripts/codex-check.ps1` 后重跑统一检查。

## 关联扫描产物

- Threat model：`C:\tmp\codex-security-scans\new-api\83f8ba8da2c0_20260613T000000Z\artifacts\01_context\threat_model.md`
- Discovery：`C:\tmp\codex-security-scans\new-api\83f8ba8da2c0_20260613T000000Z\artifacts\02_discovery\finding_discovery_report.md`
- Finding 1 validation：`C:\tmp\codex-security-scans\new-api\83f8ba8da2c0_20260613T000000Z\artifacts\05_findings\CS-CCSWITCH-001\validation_report.md`
- Finding 1 attack path：`C:\tmp\codex-security-scans\new-api\83f8ba8da2c0_20260613T000000Z\artifacts\05_findings\CS-CCSWITCH-001\attack_path_analysis_report.md`
- Finding 2 validation：`C:\tmp\codex-security-scans\new-api\83f8ba8da2c0_20260613T000000Z\artifacts\05_findings\CS-CCSWITCH-002\validation_report.md`
- Finding 2 attack path：`C:\tmp\codex-security-scans\new-api\83f8ba8da2c0_20260613T000000Z\artifacts\05_findings\CS-CCSWITCH-002\attack_path_analysis_report.md`
