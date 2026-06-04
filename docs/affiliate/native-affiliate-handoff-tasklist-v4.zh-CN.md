# 原生分销后续开发接手 Tasklist v4

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项执行。运行态、缓存、端口、Docker、认证问题先用 `superpowers:systematic-debugging` 取证；后端逻辑、脱敏、结算、规则转换先用 `superpowers:test-driven-development`；声称完成前用 `superpowers:verification-before-completion` 做新鲜验证。

**Goal:** 作为后续接手 `feature/native-affiliate-minimal` 的最新入口，指导 new-api 原生分销二开继续收口运行态、Docker/schema、结算可靠性、SMS、飞书口径、前端 parity、外部验收和生产切换。

**Architecture:** 继续坚持最小侵入 sidecar 架构。分销、SMS、手机号绑定、quota source、job run 与结算审计优先落在 `affiliate_*`、`sms_*`、`user_*_sidecar` 类独立表；官方主链路只保留注册、充值、扣费、退款、日志写入等薄 hook。default 与 classic 前端必须保持功能 parity，但分别遵守各自组件体系和视觉风格。

**Tech Stack:** Go + Gin + GORM + PostgreSQL/SQLite tests，React/Rsbuild/Bun，Docker Compose，tmux，Playwright/in-app Browser，MCP thread index，飞书/lark skill 或 CLI，项目 `.agents/skills`，Superpowers，CLI。

---

## 0. 当前事实快照

- [x] 仓库路径：`/home/rain/projects/new-api-rain021217`。
- [x] 当前分支：`feature/native-affiliate-minimal`。
- [x] 本文件创建前 HEAD：`b2496894 feat: retain affiliate head fee partial progress`。
- [x] `/api/affiliate/team` 后端路由已存在，源码在 `router/api-router.go`、`controller/affiliate.go`、`service/affiliate.go`；后续不要重复实现该路由。
- [x] WSL 内未登录访问 `3000/5173/5174` 的 `/api/affiliate/team` 已多次验证为 401，不是旧 `Invalid URL` 404。
- [x] 登录并带 `New-Api-User` header 后，`3000/5173/5174` 的 `/api/affiliate/team` 已验证为 200 且 `total=9`。
- [x] 如果用户 Windows 浏览器仍显示“推广关系树接口返回 404”，优先按缓存、错误端口、旧 dev server、旧后端容器、旧 bundle 排查，不改后端路由。
- [x] `5173` 是 default 前端 dev server，`5174` 是 classic 前端 dev server。它们是 WSL 内临时 Rsbuild 进程，不是 Docker 容器；电脑、WSL 或 tmux 重启后端口拒绝连接是正常现象。
- [x] 前端 dev server 的默认启动方式是在 WSL 内运行 `./scripts/dev-web-tmux.sh`，不把 Windows 侧临时进程作为默认路线。
- [x] dev compose 使用官方 PostgreSQL/Redis 基础设施镜像不影响仓库代码；真正决定二开功能是否存在的是 `new-api` 应用服务镜像来源。
- [x] 如果 `new-api` 应用服务使用官方 `calciumion/new-api:latest`，仓库里的分销路由、前端页面、缓存规避、脱敏、SMS 和结算改动都不会生效。
- [x] dev 应用镜像应从本仓库构建 `new-api:dev`；生产或 staging 应从本仓库根目录 `Dockerfile` 构建不可变 tag，并嵌入 default/classic 前端 dist。
- [x] 管理端规则、KPI、人头费、风控、结算配置、佣金审核和结算审核适合表格或矩阵化；高级 JSON 导入/导出保留为高级入口。
- [x] 分销商端 dashboard 不建议整体表格化，应保留摘要卡片、趋势图、关系树和 scoped logs 明细表组合。
- [x] settlement pipeline 已具备 service/API `dry_run` 预览能力；dry-run 不落库，正式 run 写 job run 和结算数据。
- [x] 佣金、KPI、人头费阶段均已具备 durable partial progress 和 failed job run partial count 审计；完整阶段内部 cursor 跳扫仍未实现。
- [x] 当前 Docker server 在本线程多次 probe 中仍只返回 client 或无 server 输出；Docker PostgreSQL schema diff 不能视为完成。

## 1. 固定读取清单

- [ ] 阅读 `docs/affiliate/native-affiliate-master-plan.zh-CN.md`，确认业务目标、分销层级、飞书口径、手机号/SMS 和最小侵入架构。
- [ ] 阅读 `docs/affiliate/native-affiliate-development-principles.zh-CN.md`，确认 sidecar、TDD、脱敏、RMB 单位、权限、发布证据、文档治理和新线程启动原则。
- [ ] 阅读 `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`，以最新 P0/P1/P2 复盘判断哪些事项已经完成，避免重复实现。
- [ ] 阅读 `docs/affiliate/native-affiliate-handoff-tasklist-v3.zh-CN.md`，理解上一版任务拆分；本 v4 以最新 HEAD 和后续优先级为准。
- [ ] 阅读 `docs/affiliate/native-affiliate-dev-compose-runbook.zh-CN.md`，确认 WSL dev compose、tmux 前端、dump 恢复、schema baseline 和清理方式。
- [ ] 阅读 `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`，确认 dev/prod 镜像区别、不可变 tag、compose override、smoke 和回滚。
- [ ] 阅读 `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`，确认本地 smoke 不能替代 staging/生产验收。
- [ ] 阅读 `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`，确认缺少 Docker PostgreSQL diff 的对象和发布前补验要求。
- [ ] 阅读 `docs/affiliate/native-affiliate-sms-reference-audit.zh-CN.md`，确认手机号/SMS 继续走 provider + sidecar，不迁移旧 fork 的 `users.phone` 侵入式方案。
- [ ] 前端 default 改动前阅读 `.agents/skills/shadcn-ui/SKILL.md` 和现有 `web/default` 组件模式。
- [ ] 新增前端文案前阅读 `.agents/skills/i18n-translate/SKILL.md`，所有新增文案必须走 locale。
- [ ] classic/default parity 前阅读 `.agents/skills/classic-to-default-sync/SKILL.md`。
- [ ] React 性能或数据流改动前阅读 `.agents/skills/vercel-react-best-practices/AGENTS.md`。
- [ ] 涉及飞书资料前使用飞书相关 skill 或 CLI 读取，只写脱敏业务摘要、核对日期和变更结论，不复制内部原文、账号、密码、链接密钥或截图。

## 2. 通用执行纪律

- [ ] 每次开始代码或文档改动前运行：

```bash
cd /home/rain/projects/new-api-rain021217
git status --short --branch
git log --oneline -8
```

Expected: 明确当前分支、HEAD、未提交文件来源；不得覆盖、回滚或混入用户改动。

- [ ] 每个后端行为变更先写失败测试，再实现到 GREEN。优先从窄范围命令开始：

```bash
go test -count=1 ./service -run '<exact-test-or-pattern>'
go test -count=1 ./controller -run '<exact-test-or-pattern>'
```

Expected: RED 阶段失败原因和目标缺口一致；GREEN 阶段目标测试通过。

- [ ] 每个后端主题完成后至少运行相关回归：

```bash
go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun|SMS|Phone|Register'
```

Expected: 相关包通过；无关包如果 no tests to run 需要记录。

- [ ] 每个前端 helper/API/表单变更先写 default/classic 对应测试，再改 UI 接入。
- [ ] 影响前端页面或构建入口时运行：

```bash
cd web/default && bun run build
cd web/classic && bun run build
```

Expected: default/classic 均构建通过；如构建因既有工具链或网络问题失败，必须记录实际失败点和替代验证。

- [ ] 每个运行态、缓存、端口、Docker、认证问题先取证，不凭猜测改代码。优先使用 `curl -i`、DevTools Network、in-app Browser、Playwright、`ss -ltnp`、`tmux ls`、`docker inspect`、`docker compose ps`。
- [ ] Docker server 已知不稳定时，不要反复并发 probe；只做带 `timeout` 的单条必要检查，拿到 server 恢复证据后再重建容器和做 schema diff。
- [ ] 所有复盘、commit message、测试日志和文档不得包含密码、cookie、session、DSN、token、完整手机号、生产地址、敏感截图或飞书内部原文。
- [ ] 每个主题完成后按主题提交。建议主题：runtime/cache、dev/prod image、scoped logs、admin rules UX、settlement reliability、SMS、schema impact、dashboard、docs/runbook。
- [ ] 每完成 P0/P1/P2 任务，在 `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md` 或本文件对应任务下追加复盘，包含 RED、完成内容、验证命令、运行态证据、残留风险和下一步。

## 3. P0 运行态与缓存

### Task 3.1 Windows 浏览器旧 404 最终取证

**Files:**
- Inspect: `web/default/src/features/affiliate/api.ts`
- Inspect: `web/classic/src/pages/Affiliate/index.jsx`
- Inspect: `router/api-router.go`
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 在用户实际 Windows 浏览器 DevTools Network 中检查 `/api/affiliate/team`：Request URL、Status、是否 from disk cache/from memory cache、Response body 是否 `Invalid URL (GET /api/affiliate/team)`、Request Headers 是否包含 `New-Api-User`。
- [ ] 在 WSL 内运行未登录 smoke：

```bash
cd /home/rain/projects/new-api-rain021217
timeout 15s curl -i http://127.0.0.1:5173/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:5174/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:3000/api/affiliate/team
```

Expected: 三个入口均返回 401 JSON，不返回 404，不返回 `Invalid URL`。

- [ ] 如果 WSL curl 为 401/200 但 Windows 页面仍 404，优先清站点缓存或勾选 Disable cache 后硬刷新，不改后端路由。
- [ ] 如果 Request URL 指向非当前 `5173`、`5174` 或 `3000`，定位浏览器标签页地址、代理、hosts、端口映射或旧 dev server。
- [ ] 如果 3000 仍缺 no-store 响应头，先恢复 Docker engine 并重建当前仓库 `new-api:dev`，再复测；不要把运行态旧容器误判为源码缺陷。

### Task 3.2 WSL 前端 dev server 启动与验证

**Files:**
- Execute: `scripts/dev-web-tmux.sh`
- Reference: `docs/affiliate/native-affiliate-dev-compose-runbook.zh-CN.md`

- [ ] 电脑或 WSL 重启后，在 WSL 内启动前端：

```bash
cd /home/rain/projects/new-api-rain021217
./scripts/dev-web-tmux.sh
```

Expected: tmux session `new-api-web` 存在，包含 `default` 与 `classic` window。

- [ ] 验证端口：

```bash
tmux list-windows -t new-api-web
timeout 15s curl -I http://127.0.0.1:5173/
timeout 15s curl -I http://127.0.0.1:5174/
timeout 15s curl -i http://127.0.0.1:5173/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:5174/api/affiliate/team
```

Expected: `5173` 与 `5174` 页面返回 200；未登录 team API 返回 401。

## 4. P1 Docker、Schema 与镜像治理

### Task 4.1 Docker engine 恢复后重建 dev 应用镜像

**Files:**
- Reference: `docker-compose.dev.yml`
- Reference: `Dockerfile.dev`
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] Docker Desktop/WSL engine 恢复后先运行：

```bash
cd /home/rain/projects/new-api-rain021217
timeout 60s docker version
timeout 60s docker info --format '{{.ServerVersion}} {{.Name}}'
timeout 60s docker compose version
timeout 60s docker ps --filter 'name=new-api'
```

Expected: Docker server 可查询，不是只返回 client，也不是超时无输出。

- [ ] 重建 dev 应用容器：

```bash
timeout 600s docker compose -f docker-compose.dev.yml build new-api
timeout 600s docker compose -f docker-compose.dev.yml up -d --force-recreate new-api
docker inspect new-api --format '{{.Config.Image}}'
```

Expected: `new-api` 应用镜像为 `new-api:dev` 或等价本仓库构建镜像，不是官方 `calciumion/new-api:latest`。

- [ ] 复测 `/api/affiliate/team` 未登录 401、登录后 200、`/api/*` no-store 响应头。如果仍旧 404，先检查镜像来源和端口映射。

### Task 4.2 Docker PostgreSQL schema diff

**Files:**
- Update: `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`
- Runtime only: `runtime/schema-impact/`

- [ ] Docker engine 恢复后导出 before/after PostgreSQL schema，覆盖 `affiliate_job_runs`、`sms_rate_limit_counters`、`affiliate_head_fee_rules.status`、`affiliate_risk_rules.self_brush_strategy`、`affiliate_risk_rules.bulk_abuse_strategy`、`affiliate_risk_rules.action`。
- [ ] 运行 diff，确认只出现预期 sidecar DDL；不得出现官方核心表 `ALTER` 或 `DROP`。
- [ ] `runtime/schema-impact/` 输出必须保持 git ignored，不提交。
- [ ] 报告只写快照文件名、sha256、脱敏结论和残留风险。

### Task 4.3 生产或 staging 切换准备

**Files:**
- Reference: `Dockerfile`
- Reference: `docker-compose.prod.local.example.yml`
- Reference: `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`

- [ ] 从本仓库构建不可变应用镜像：

```bash
git status --short --branch
git log --oneline -1
APP_TAG="$(date +%Y%m%d-%H%M)-$(git rev-parse --short HEAD)"
APP_IMAGE="new-api-rain:${APP_TAG}"
timeout 1800s docker build --pull -t "${APP_IMAGE}" .
```

Expected: 生产 `Dockerfile` 构建 Go 应用并嵌入 default/classic 前端 dist。

- [ ] 生产或 staging compose 使用本仓库镜像 tag 覆盖 `new-api` 应用服务；不要把官方 `calciumion/new-api:latest` 当作包含二开功能的镜像。
- [ ] 发布后 smoke 覆盖 `/api/status`、`/api/affiliate/status`、`/api/affiliate/team`、分销商中心、管理员规则页、佣金页和结算页。

## 5. P1 结算任务可靠性

### Task 5.1 阶段内部 cursor 跳扫设计

**Files:**
- Inspect: `service/affiliate_job_run.go`
- Inspect: `service/affiliate_settlement_run.go`
- Inspect: `service/affiliate_commission.go`
- Inspect: `service/affiliate_kpi.go`
- Inspect: `service/affiliate_head_fee.go`
- Inspect: `service/affiliate_settlement.go`
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 先确认哪些阶段可以安全从 cursor 续扫，哪些阶段依赖内存聚合或累计上下文，不能直接跳过已扫描数据。
- [ ] 对 KPI、佣金、人头费、settlement grouping 分别写出 durable output 或 persistent aggregate 方案；没有持久化聚合前，不实现“看起来能跳过”的 unsafe resume。
- [ ] 佣金、KPI、人头费已有 durable partial progress，但仍不能直接用 usage log cursor 跳过前序日志，因为规则档位、累计净付费、有效用户和 synthetic marker 仍依赖完整上下文。
- [ ] 若只实现整阶段 resume 之外的子能力，必须先有 RED 测试证明旧实现会重复扫描或丢数据，再实现最小安全切片。

### Task 5.2 外部完整结算周期双跑

**Files:**
- Reference: `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 在 staging 或受控本地恢复库执行 `dry_run=true` 预览，记录脱敏计数、金额汇总和差异摘要。
- [ ] 执行正式 run，确认 KPI snapshot、commission event、head fee event、draft settlement 与 dry-run 预览一致。
- [ ] 重复正式 run，确认不会重复计佣、重复发人头费、重复生成结算单。
- [ ] 核对结算单金额等于 linked commission/head fee event 合计。
- [ ] 与外接控制台只读口径对比，差异只记录规则版本、paid/gift/trial 来源、退款归属、时间边界、数据缺失等脱敏原因。

## 6. P1 管理端表格化与 finance 操作

### Task 6.1 规则指标表格化持续复核

**Files:**
- Inspect: `web/default/src/features/affiliate/rule-array-editor.tsx`
- Inspect: `web/default/src/features/affiliate/admin-lib.ts`
- Inspect: `web/classic/src/pages/AffiliateAdmin/RuleArrayEditor.jsx`
- Inspect: `web/classic/src/pages/AffiliateAdmin/affiliateAdminRules.js`
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 复核佣金 tier、KPI tier、人头费规则、风控规则、结算配置当前字段是否与 followup P1-26 到 P1-30 一致。
- [ ] 如果 default/classic 有字段缺口，先补 helper 测试，再补 UI 和 locale。
- [ ] 运行：

```bash
cd web/default && bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/rule-array-editor.test.ts
cd web/classic && bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs src/pages/AffiliateAdmin/ruleArrayEditor.test.mjs
```

Expected: 两端规则 helper 和表格测试通过。

### Task 6.2 管理端佣金与结算列表增强

**Files:**
- Modify: `controller/affiliate_finance.go`
- Modify: `service/affiliate_finance.go`
- Test: `controller/affiliate_test.go`
- Test: `service/affiliate_commission_admin_test.go`
- Modify: `web/default/src/features/affiliate/admin-lib.ts`
- Modify: `web/classic/src/pages/AffiliateAdmin/affiliateAdminFinance.js`

- [ ] RED: 管理端佣金表支持状态筛选、冻结、作废、调整、二次确认和操作原因。
- [ ] RED: 管理端结算表支持冻结、标记已支付、作废、导出脱敏摘要和 job run 审计跳转。
- [ ] GREEN: 后端校验权限、状态流转、金额一致性和操作原因；前端 default/classic 保持功能 parity。
- [ ] 验证：

```bash
go test -count=1 ./service ./controller -run 'Affiliate.*Finance|Commission.*Admin|Settlement.*Lifecycle|VoidAffiliateSettlement'
cd web/default && bun test src/features/affiliate/admin-lib.test.ts
cd web/classic && bun test src/pages/AffiliateAdmin/affiliateAdminFinance.test.mjs
```

Expected: 后端 finance 流程和两端前端 helper 通过。

## 7. P2 SMS 与手机号入口

### Task 7.1 手机号登录、绑定、换绑

**Files:**
- Modify: `controller/sms.go`
- Modify: `controller/user.go`
- Modify: `service/sms.go`
- Modify: `model/sms.go`
- Test: `controller/sms_test.go`
- Test: `service/sms_test.go`

- [ ] RED: `/api/user/login/phone` 只允许已绑定手机号登录，不自动注册。
- [ ] RED: 自助绑定和换绑写 `user_phone_bindings`，旧 active binding 被安全停用。
- [ ] GREEN: 所有发送动作走 SMS-scoped Turnstile 或等价验证，以及手机号/IP/账号/场景维度 DB-backed 限流。
- [ ] GREEN: 不向官方 `users` 表新增手机号字段；所有日志和响应只出现脱敏手机号。

### Task 7.2 短信宝真实通道 smoke

**Files:**
- Reference: `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`

- [ ] 仅在签名、模板、专用测试手机号和限流配置就绪后执行。
- [ ] `GET /api/option/sms/status` 只输出 provider code、余额或条数等脱敏状态，不输出 endpoint、账号或凭据。
- [ ] `POST /api/option/sms/test` 对专用测试手机号发送成功，测试记录只保留脱敏手机号和 provider code。
- [ ] 连续触发超过阈值，确认 provider 调用前被限流拒绝。

## 8. P2 飞书口径与默认 seed

### Task 8.1 最新飞书口径复核

**Files:**
- Reference: `docs/affiliate/native-affiliate-master-plan.zh-CN.md`
- Modify if changed: `service/affiliate_rule_seed.go`
- Test: `service/affiliate_rules_test.go`
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 重新核对净付费口径：只计算 paid 净付费消耗，不计算赠金、试用、退款、异常、自刷、内部测试、legacy_unknown。
- [ ] 重新核对有效新用户口径：邀请归因有效、首充达标、14 天净付费达标、无退款、自刷、批量异常。
- [ ] 重新核对一级和二级佣金档位、KPI 档位、人头费门槛、风控阈值、邀请赠送额度差异。
- [ ] 如果 seed 需要更新，先写测试覆盖区间连续、无重叠、单位转换和发布不可变，再改 seed。
- [ ] 复盘只写脱敏业务摘要、核对日期和变更结论，不写飞书内部账号、密码、链接密钥、完整原文或截图。

## 9. P2 前端回归与体验债

### Task 9.1 登录态分销页 browser smoke

**Files:**
- Runtime only: `runtime/` or ignored smoke output
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 使用 in-app Browser 或 Playwright 打开 `5173/affiliate` 与 `5174/console/affiliate`，验证未登录跳转、登录态 API、关系树、summary、trend、logs 表格。
- [ ] 如使用本地 secret 登录，只输出角色标签、HTTP code、success、脱敏计数，不输出密码、cookie、session 或完整响应体。
- [ ] Docker 恢复并重建后，复测 `/api/affiliate/summary` 响应包含 `daily_trends`，避免前端新 bundle 对着旧后端运行。
- [ ] 截图仅用于本地对比；如写入文档，只写截图文件名和脱敏结论，不提交敏感截图。

### Task 9.2 前端质量债记录

- [ ] 对 `5173` default 页面已有 React checked/onChange warning 做基线记录，确认是否与分销页面无关。
- [ ] 每次新增 default/classic 文案都补 locale，并运行对应 i18n 检查。
- [ ] 移动端窄屏必须覆盖分销商 dashboard、管理端规则表格、佣金/结算列表；表格不能溢出到不可操作。

## 10. 外部验收、灰度与归档

### Task 10.1 Staging/生产发布前检查

**Files:**
- Reference: `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`
- Reference: `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`

- [ ] 确认当前分支已分批提交，`git status --short` 干净或只剩明确不提交文件。
- [ ] 确认 PostgreSQL 已备份，并记录可恢复路径和回滚镜像 tag。
- [ ] 确认生产应用镜像来自本仓库不可变 tag，非官方 latest。
- [ ] 确认 default/classic 前端 dist 嵌入生产镜像。
- [ ] 确认真实入口 `/api/*` 不缓存 404、401 或敏感 JSON。

### Task 10.2 灰度与外接控制台归档

- [ ] 灰度顺序：管理员只读、少量分销商只读、规则发布、结算任务、外接控制台只读归档。
- [ ] 外接控制台归档前确认原生分销页面、管理员 profiles、规则集、佣金/结算操作、用户 inviter 管理均通过外部 smoke。
- [ ] 至少一个完整结算周期双跑通过后，才把原生模块作为唯一写入口。
- [ ] 外部验收记录只写脱敏证据，不写账号、密码、cookie、token、DSN、完整手机号、生产地址或敏感截图。

## 11. 长期优化债

- [ ] 把 Docker schema impact 流程做成更稳定的一键脚本，减少手工 before/after diff 漏项。
- [ ] 为 `/api/*` cache header 做集中测试和真实入口验收，防止旧 404、401 或敏感 JSON 被缓存。
- [ ] 为结算任务补后台调度器前，先完成自动结算开关、dry-run 预检、job run active/stale、幂等 key 和告警策略。
- [ ] 为历史未标记日志设计运营回填 runbook，明确抽样、人工复核、paid sidecar 补写和回滚方式；不得默认把 unknown 计为 paid。
- [ ] 后续上游合并前保持分批提交，避免二开功能和官方变更混在一个巨大冲突里。

## 12. 建议下一批执行顺序

- [ ] 第一批：如果用户 Windows 浏览器仍显示旧 404，做 DevTools Network 最终取证；否则不再围绕 `/api/affiliate/team` 重复改代码。
- [ ] 第二批：Docker engine 恢复后重建 `new-api:dev`，复核 `/api/*` no-store header、`/api/affiliate/team` 401/200、`/api/status.sms_enabled` 和 summary `daily_trends`。
- [ ] 第三批：Docker PostgreSQL schema diff，补齐 `affiliate_job_runs`、`sms_rate_limit_counters`、`affiliate_head_fee_rules.status`、`affiliate_risk_rules` 新字段证据。
- [ ] 第四批：外部完整结算周期 dry-run/正式 run 双跑，使用已实现的 `dry_run` API 能力和 event totals 审计。
- [ ] 第五批：阶段内部 cursor resume 设计与安全切片；没有 persistent aggregate 或 durable output 前不要实现 unsafe 跳扫。
- [ ] 第六批：最新飞书口径复核，必要时更新默认 seed、规则测试和运营表格字段。
- [ ] 第七批：手机号登录/绑定/换绑、短信宝真实通道 smoke。
- [ ] 第八批：管理端佣金/结算列表操作表格增强，分销商登录态浏览器回归和截图归档。
- [ ] 第九批：staging/生产发布、灰度、外接控制台归档。

## 13. 复盘模板

每完成一个任务，追加如下复盘：

```markdown
### Task X-Y 复盘（YYYY-MM-DD 本线程）

- RED：写了哪些失败测试，旧实现如何失败；如果是运行态问题，写取证步骤和旧现象。
- 完成内容：改了哪些业务行为，是否保持 sidecar/minimal hook/default-classic parity。
- 验证命令：列出实际运行过的命令和通过结果。
- 浏览器/运行态证据：如适用，写 HTTP code、页面、Network/cache 状态和脱敏计数。
- 残留风险：明确未覆盖的真实支付、真实短信、Docker schema、staging/生产、登录态 smoke 等。
- 下一步：指向本 tasklist 中的下一个 checkbox。
```
