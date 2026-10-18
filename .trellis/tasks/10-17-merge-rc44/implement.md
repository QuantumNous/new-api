# 执行计划：合并 rc.44

1. 复核 `git status` / `git worktree list` / `git rev-parse`；保持 `.pi/review-artifacts-be09fdb01.md` 不参与提交。确认目标 `a1342d5bb` 与 tag `633b4c5b1` 未漂移。
2. 在当前 worktree 创建 `feat/partner-oauth-audit-rc44` 并切入；确认合作方 OAuth 文件与契约存在，任务指针和 Trellis 文档可用。
3. 复读涉及冲突的 backend/frontend spec、`.agents/rules/billing.md`、OAuth/OWASP 指南、返现或自定义域名契约（若相应文件受影响）；启动 `git merge --no-ff --no-commit v1.0.0-rc.44`。
4. 按认证/数据库、计费/充值、前端/i18n、文档分组处理 53 个预检冲突。保持两侧行为契约，补必要回归；以 `git diff --check`、`git ls-files -u`、冲突标记检索和人工审查确认一致。
5. 验证：`make test`（必须）；涉及 `relaykit` 时 `cd relaykit && GOWORK=off go build ./...`；`cd web && bun run typecheck && bun run lint && bun run test && bun run build`（按实际包脚本调整），检查 Go 格式化。若更改数据库行为，使用任务隔离 Docker 验证三个引擎；无法启动容器则报告验证受阻，不能称完成。
6. 形成合并差异/验证报告，按 Trellis 提交计划审批后仅提交本次合并文件与必要 Trellis 记录，检查 `git show --format=%P` 恰好两个父提交；不推送、不混入授权日志功能。
7. 将成功的 merge commit 用作 `10-17-partner-oauth-audit` 的实现基线；发现不可控冲突可 `git merge --abort` 并暂停，请用户确认缩小范围，而非静默放弃验证。
