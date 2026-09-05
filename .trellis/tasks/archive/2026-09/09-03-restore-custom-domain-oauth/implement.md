# 恢复 ui-domain 专属域名能力实施计划

## 0. 执行门

- 用户已选择：不改写共享历史，在 `ui-domain` 完整恢复原专属域名能力。
- 用户需审阅 `prd.md`、`design.md` 与本计划，并明确批准开始实现；批准后才运行 `task.py start`。
- 实现前加载 `trellis-before-dev`，按 TDD 先恢复测试、记录失败，再恢复生产代码。
- 不执行远端 push、生产部署、生产数据库写入或 Redis Key 删除。

## 1. 固定基线与保护清单

1. 记录 `git rev-parse HEAD`、`git status --short`、当前分支和现有工作区变更。
2. 验证 `HEAD=89caa020` 或重新评估变化；验证 `git diff --name-status 69837cf8..HEAD` 仍只有 `docker-compose.yml`。
3. 固定恢复源 `2bf6b850`（`69837cf8^`），导出 `69837cf8^..69837cf8` 的路径/状态清单供复核。
4. 明确排除 AGENTS、ignore、Trellis/Codex/OpenCode、Compose、锁文件和构建产物。

验收：恢复清单内没有用户未提交修改或 `69837cf8` 之后的独立代码变化。

## 2. TDD RED：先恢复并运行测试

1. 从 `2bf6b850` 仅恢复 `design.md` 中列出的测试文件。
2. 运行 Go 定向包测试和前端 handoff 测试。
3. 记录预期失败：缺少 `CustomDomain`、DomainContext、handoff controller/service、前端 handoff module 等生产符号；若测试意外通过或失败原因无关，停止并重新核对清单。

建议命令：

```bash
go test ./common ./controller ./middleware ./model ./router ./service
cd web && bun run test -- src/features/auth/lib/__tests__/domain-oauth-handoff.test.ts
```

验收：存在稳定、与被删除生产能力直接对应的 RED 证据。

## 3. 恢复生产代码

1. 从 `2bf6b850` 恢复 `design.md` 中列出的生产文件和 `.env.example`。
2. 保留当前 `docker-compose.yml`，确认 Session/Custom Domain 环境变量映射与健康检查没有回退。
3. 对 Go 恢复文件运行 `gofmt`；对前端恢复文件运行项目定向格式检查。
4. 检查导入、生成路由、迁移注册、JSON wrapper、数据库兼容与 protected project information。
5. 比较恢复清单与 `2bf6b850`；只允许为当前编译/依赖兼容所需且有测试保护的差异。

验收：完整恢复域名配置/CLI、Host guard、邀请归属、OAuth handoff、密码重置和钱包支付回跳；没有部分恢复状态。

## 4. 定向验证

按失败边界逐层运行：

```bash
go test ./common
go test ./model
go test ./service
go test ./middleware
go test ./controller
go test ./router
go test -race ./controller ./middleware ./model ./service/...
```

前端：

```bash
cd web
bun run test -- src/features/auth/lib/__tests__/domain-oauth-handoff.test.ts
bun run typecheck
bun run lint
bun run format:check
bun run build
```

重点验证：

- Host main/custom/apex/unknown/disabled/invalid 矩阵。
- `SESSION_COOKIE_TRUSTED_URL` 固定 Origin 与动态 custom Origin。
- GitHub/LinuxDO login/bind 成功、取消、失败、重放、换域、binding 和目标停用 fallback。
- 密码重置签名上下文。
- 易支付/Stripe 来源持久化、验签/幂等与 browser return。
- 显式/默认邀请人优先级。

验收：所有恢复测试由 RED 转为 GREEN；不删除或弱化原安全测试。

## 5. 全量质量门

```bash
make test
go vet ./...
GOWORK=off go build ./...
cd relaykit && GOWORK=off go vet ./... && GOWORK=off go build ./...
cd web && bun run build:check
git diff --check
```

随后加载 `trellis-check`，执行 spec compliance、跨层数据流、复用、类型/测试和安全检查。核对 diff 不包含 Secret、生产 DSN、OAuth/支付凭据、无关格式化或锁文件。

## 6. 手工/E2E 验收边界

本地使用隔离 SQLite 和测试 Host 验证路由/桥接页面；真实 GitHub/LinuxDO、Nginx、DNS、证书和生产数据库验收需要用户单独授权。

代码交付必须给出 staging 检查单：

- `CUSTOM_DOMAIN_ENABLED=true`
- `SESSION_COOKIE_SECURE=true`
- `SESSION_COOKIE_TRUSTED_URL` 包含精确主站 Origin
- `CUSTOM_DOMAIN_MAIN_ORIGIN=https://yeschoy.com`
- 代理保留 `$host`
- 主站与 wildcard TLS 正常
- OAuth App callback 保持 `https://yeschoy.com/oauth/{provider}`
- `docker compose config` 确认变量进入 new-api 容器

## 7. 最终差异与提交门

1. `git diff --name-status` 必须与恢复白名单一致。
2. `git diff 2bf6b850 -- <恢复清单>` 应为空或只包含已解释并测试的兼容修复。
3. `docker-compose.yml` 必须保持当前 `0a13dee0` 版本；AGENTS/Trellis/ignore 文件不回退。
4. 生成代码审查结论；修复所有阻塞项并重跑相应验证。
5. 未经用户明确授权不 commit、push、部署或修改生产状态。

## 8. 回滚

- 实现阶段如发现恢复源与当前分支存在未识别冲突，只撤销本任务白名单内尚未提交的恢复，不触碰用户文件。
- 发布后运行时回滚优先关闭 `CUSTOM_DOMAIN_ENABLED`；保留数据库表/列与 fallback handler 至在途票据过期。
- 不使用 `git reset --hard`、整树 checkout 或强制推送。
