# 原生分销后续开发接手 Tasklist v3

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项执行。遇到运行态、缓存、端口、Docker、认证问题时先用 `superpowers:systematic-debugging` 取证；涉及后端逻辑、脱敏、结算、规则转换时先用 `superpowers:test-driven-development`；声称完成前用 `superpowers:verification-before-completion` 做新鲜验证。

**Goal:** 指导后续接手 `feature/native-affiliate-minimal` 的 new-api 原生分销开发，先收口运行态和发布治理，再推进结算可靠性、schema impact、SMS、Dashboard、管理端 finance 和外部验收。

**Architecture:** 继续坚持最小侵入 sidecar 架构。分销、SMS、手机号绑定、quota source 与 job run 状态优先落在独立 sidecar 表；官方主链路只保留注册、充值、扣费、退款、使用日志等必要 thin hook。default 与 classic 前端保持功能 parity，但分别遵守 default/shadcn/Tailwind 与 classic/Semi Design 既有风格。

**Tech Stack:** Go + Gin + GORM + PostgreSQL/SQLite tests，React 19，Rsbuild，Bun，Docker Compose，tmux，Playwright/in-app Browser，Superpowers，项目 `.agents/skills`，飞书资料只作为脱敏业务口径来源。

---

## 0. 当前接手事实

- [x] 仓库路径：`/home/rain/projects/new-api-rain021217`。
- [x] 当前分支：`feature/native-affiliate-minimal`。
- [x] 本文件创建前 HEAD：`e1507f12 feat: add affiliate settlement dry run`。
- [x] 本文件创建前工作树：`git status --short --branch` 只显示 `## feature/native-affiliate-minimal`，无未提交改动。
- [x] `/api/affiliate/team` 后端路由已存在，源码在 `router/api-router.go`、`controller/affiliate.go`、`service/affiliate.go`，后续不要重复实现该路由。
- [x] WSL 内未登录访问 `3000/5173/5174` 的 `/api/affiliate/team` 已验证为 401，不是旧 `Invalid URL` 404。
- [x] 登录并带 `New-Api-User` header 后，`3000/5173/5174` 的 `/api/affiliate/team` 已验证为 200 且 `total=9`。
- [x] `5173` default 与 `5174` classic 是 WSL 内 Rsbuild dev server 进程，不是 Docker 容器；电脑、WSL 或 tmux 重启后端口拒绝连接是正常现象。
- [x] 前端 dev server 的默认启动方式是在 WSL 内运行 `./scripts/dev-web-tmux.sh`，不要把 Windows 侧临时进程作为默认路线。
- [x] dev compose 使用官方 PostgreSQL/Redis 基础设施镜像不影响仓库代码；真正决定二开功能是否存在的是 `new-api` 应用服务镜像来源。
- [x] 如果 `new-api` 应用服务使用官方 `calciumion/new-api:latest`，仓库里的二开路由、前端页面、缓存规避、脱敏、结算 dry-run 等不会生效。
- [x] dev 应用镜像应从本仓库构建 `new-api:dev`；生产或 staging 应从本仓库根目录 `Dockerfile` 构建不可变 tag，并嵌入 default/classic 前端 dist。
- [x] 分销管理端的规则、KPI、人头费、风控和结算配置适合表格或矩阵；分销商端 dashboard 不建议全表格化，应保留摘要卡片、趋势、关系树、明细表组合。
- [x] 当前已具备 settlement pipeline service/API `dry_run` 预览能力；dry-run 不落库，正式 run 仍写 job run 和结算数据。
- [x] 当前已具备 failed job run cursor payload 保留、整阶段 resume、resume 输出校验；阶段内部 cursor 断点续扫仍未完成。
- [x] Docker engine 当前在本线程多次 probe 中仍出现只返回 client 或无 server 输出的问题；Docker PostgreSQL schema diff 仍不能视为完成。

## 1. 接手前固定读取清单

- [ ] 阅读 `docs/affiliate/native-affiliate-master-plan.zh-CN.md`，确认业务目标、分销层级、飞书口径、手机号/SMS 和最小侵入架构。
- [ ] 阅读 `docs/affiliate/native-affiliate-development-principles.zh-CN.md`，确认 sidecar、TDD、脱敏、RMB 单位、权限、发布证据、文档治理和新线程启动原则。
- [ ] 阅读 `docs/affiliate/native-affiliate-new-thread-tasklist.zh-CN.md`，理解 Phase 1 到 Phase 13 的完成项、历史风险和敏感数据治理边界。
- [ ] 阅读 `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`，以最新 P0/P1/P2 复盘判断哪些事项已经完成，避免重复实现。
- [ ] 阅读 `docs/affiliate/native-affiliate-handoff-tasklist-v2.zh-CN.md`，理解 v2 任务拆分；本 v3 以最新 HEAD 和后续优先级为准。
- [ ] 阅读 `docs/affiliate/native-affiliate-dev-compose-runbook.zh-CN.md`，确认 WSL dev compose、tmux 前端、dump 恢复、schema baseline 和清理方式。
- [ ] 阅读 `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`，确认 dev/prod 镜像区别、不可变 tag、compose override、smoke 和回滚。
- [ ] 阅读 `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`，确认本地 smoke 不能替代 staging/生产验收。
- [ ] 阅读 `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`，确认缺少 Docker PostgreSQL diff 的对象：`affiliate_job_runs`、`sms_rate_limit_counters`、`affiliate_head_fee_rules.status`、`affiliate_risk_rules` 新增字段。
- [ ] 阅读 `docs/affiliate/native-affiliate-sms-reference-audit.zh-CN.md`，确认手机号/SMS 继续走 provider + sidecar，不迁移旧 fork 的 `users.phone` 侵入式方案。
- [ ] 涉及 default UI 前阅读 `.agents/skills/shadcn-ui/SKILL.md` 或项目实际可用 shadcn skill。
- [ ] 涉及 i18n 前阅读 `.agents/skills/i18n-translate/SKILL.md`，所有新增文案必须走 locale。
- [ ] 涉及 classic/default parity 前阅读 `.agents/skills/classic-to-default-sync/SKILL.md`。
- [ ] 涉及飞书资料前使用飞书相关 skill 或 CLI 读取，只写脱敏业务摘要和核对日期，不复制内部原文。

## 2. 通用执行纪律

- [ ] 每次开始代码或文档改动前运行：

```bash
cd /home/rain/projects/new-api-rain021217
git status --short --branch
git log --oneline -8
```

Expected: 明确当前分支、HEAD、未提交文件来源；不得覆盖或回滚用户改动。

- [ ] 每个后端行为变更先写失败测试，再实现到 GREEN。优先从窄范围命令开始：

```bash
go test -count=1 ./service -run '<exact-test-or-pattern>'
go test -count=1 ./controller -run '<exact-test-or-pattern>'
```

Expected: RED 阶段失败原因和目标缺口一致；GREEN 阶段目标测试通过。

- [ ] 每个后端主题完成后至少运行相关回归：

```bash
go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|JobRun|SMS|Phone'
```

Expected: 相关包通过；无关包如果 no tests to run 需要记录。

- [ ] 每个前端 helper/API/表单变更先写 default/classic 对应测试，再改 UI 接入。
- [ ] 影响前端页面或构建入口时运行：

```bash
cd web/default && bun run build
cd web/classic && bun run build
```

Expected: default/classic 均构建通过；如 classic i18n CLI 版本不兼容，必须说明实际失败点和是否已手动补齐 locale。

- [ ] 每个运行态、缓存、端口、Docker、认证问题先取证，不凭猜测改代码。优先使用 `curl -i`、DevTools Network、in-app Browser、Playwright、`ss -ltnp`、`tmux ls`、`docker inspect`、`docker compose ps`。
- [ ] 所有复盘、commit message、测试日志和文档不得包含密码、cookie、session、DSN、token、完整手机号、生产地址、敏感截图或飞书内部原文。
- [ ] 飞书资料只能沉淀为脱敏规则口径、比例、阈值和核对日期；默认 seed 可以体现业务口径，但计算逻辑不能硬编码某个外部文档的不可变假设。
- [ ] 每个主题完成后按主题提交，不堆一个巨大 commit。建议主题：runtime/cache、dev/prod image、scoped logs、admin rules UX、settlement reliability、SMS、schema impact、dashboard、docs/runbook。
- [ ] 每完成 P0/P1/P2 任务，在 `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md` 或本文件对应任务下追加复盘：RED、完成内容、验证命令、运行态证据、残留风险、下一步。

## 3. P0 运行态与缓存收口

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
- [ ] 复盘必须明确结论属于浏览器缓存、错误端口、错误后端、旧 bundle、Docker stale build 或其他证据充分的类别。

### Task 3.2 WSL 前端 dev server 启动

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

- [ ] 如果缺少依赖，分别在 `web/default` 和 `web/classic` 执行 `bun install`；不要在 Windows 侧开一个不可复现的临时前端进程替代 WSL 路线。

## 4. P0/P1 Docker 与 dev/prod 镜像治理

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

### Task 4.2 生产或 staging 切换准备

**Files:**
- Reference: `Dockerfile`
- Reference: `docker-compose.prod.local.example.yml`
- Reference: `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`

- [ ] 发布前确认当前 commit 和工作树：

```bash
git status --short --branch
git log --oneline -8
```

Expected: 工作树干净或只剩明确不提交文件；待发布 commit 已记录。

- [ ] 从本仓库构建不可变应用镜像：

```bash
APP_TAG="$(date +%Y%m%d-%H%M)-$(git rev-parse --short HEAD)"
APP_IMAGE="new-api-rain:${APP_TAG}"
timeout 1800s docker build --pull -t "${APP_IMAGE}" .
```

Expected: 生产 `Dockerfile` 构建 Go 应用并嵌入 default/classic 前端 dist。

- [ ] 生产或 staging compose 使用本仓库镜像 tag 覆盖 `new-api` 应用服务；不要把官方 `calciumion/new-api:latest` 当作包含二开功能的镜像。
- [ ] 发布后 smoke 覆盖 `/api/status`、`/api/affiliate/status`、`/api/affiliate/team`、分销商中心、管理员规则页、佣金页和结算页。

## 5. P1 管理端指标体系表格化

### 结论

- [x] 管理端规则、KPI、人头费、风控、结算配置、佣金审核和结算审核适合表格或矩阵化。
- [x] 高级 JSON 导入/导出可以保留，但不能作为默认运营入口。
- [x] 分销商端 dashboard 不建议整体表格化；应保留摘要卡片、趋势图、关系树和 scoped logs 明细表组合。
- [x] 金额面向运营用“元”，比例用“百分比”；内部 cents/bps 只在保存转换层出现。

### Task 5.1 已完成规则表格化范围复核

**Files:**
- Inspect: `web/default/src/features/affiliate/rule-array-editor.tsx`
- Inspect: `web/default/src/features/affiliate/admin-lib.ts`
- Inspect: `web/classic/src/pages/AffiliateAdmin/RuleArrayEditor.jsx`
- Inspect: `web/classic/src/pages/AffiliateAdmin/affiliateAdminRules.js`
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 复核佣金 tier、KPI tier、人头费规则、风控规则、结算配置当前字段是否与 followup P1-26 到 P1-30 一致。
- [ ] 如发现 default/classic 有字段缺口，先补 helper 测试，再补 UI 和 locale。
- [ ] 运行：

```bash
cd web/default && bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/rule-array-editor.test.ts
cd web/classic && bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs src/pages/AffiliateAdmin/ruleArrayEditor.test.mjs
```

Expected: 两端规则 helper 和表格测试通过。

### Task 5.2 管理端佣金与结算列表表格增强

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

## 6. P1 结算任务可靠性

### Task 6.1 阶段内部 cursor 断点续扫可行性设计

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
- [ ] 若只实现整阶段 resume 之外的子能力，必须先有 RED 测试证明旧实现会重复扫描或丢数据，再实现最小安全切片。
- [ ] 复盘必须写清楚未实现阶段内部 cursor 的原因和下一步 schema 或算法前置条件。

### Task 6.2 阶段内部 resume 安全切片

**Files:**
- Modify: `model/affiliate.go`
- Modify: `service/affiliate_job_run.go`
- Modify: `service/affiliate_settlement_run.go`
- Modify: target stage service file
- Test: `service/affiliate_settlement_run_test.go`

- [ ] RED: 构造某一阶段中途失败，重跑同 idempotency key 后不重复已完成 durable side effect，也不跳过未处理输入。
- [ ] GREEN: cursor payload 包含阶段、窗口、最后扫描 ID、输出校验计数、输入 hash 或等价安全校验。
- [ ] GREEN: resume 前校验持久化输出，不满足时降级从最早不可信阶段重跑。
- [ ] 验证：

```bash
go test -count=1 ./service -run 'SettlementPipeline.*Resume|Affiliate.*JobRun|Commission.*Resume|KPI.*Resume|HeadFee.*Resume'
```

Expected: 新增 resume 测试和既有 job run 测试通过。

### Task 6.3 外部完整结算周期双跑

**Files:**
- Reference: `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 在 staging 或受控本地恢复库执行 `dry_run=true` 预览，记录脱敏计数、金额汇总和差异摘要。
- [ ] 执行正式 run，确认 KPI snapshot、commission event、head fee event、draft settlement 与 dry-run 预览一致。
- [ ] 重复正式 run，确认不会重复计佣、重复发人头费、重复生成结算单。
- [ ] 核对结算单金额等于 linked commission/head fee event 合计。
- [ ] 与外接控制台只读口径对比，差异只记录规则版本、paid/gift/trial 来源、退款归属、时间边界、数据缺失等脱敏原因。

## 7. P1 Schema Impact

### Task 7.1 Docker PostgreSQL schema diff

**Files:**
- Update: `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`
- Runtime only: `runtime/schema-impact/`

- [ ] Docker engine 恢复后导出 before/after PostgreSQL schema，覆盖 `affiliate_job_runs`、`sms_rate_limit_counters`、`affiliate_head_fee_rules.status`、`affiliate_risk_rules.self_brush_strategy`、`affiliate_risk_rules.bulk_abuse_strategy`、`affiliate_risk_rules.action`。
- [ ] 运行 diff，确认只出现预期 sidecar DDL；不得出现官方核心表 `ALTER` 或 `DROP`。
- [ ] `runtime/schema-impact/` 输出必须保持 git ignored，不提交。
- [ ] 报告只写快照文件名、sha256、脱敏结论和残留风险。

### Task 7.2 新增 model 前置检查

**Files:**
- Modify only after approval: `model/*.go`
- Update: `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`

- [ ] 每次新增 GORM model 或字段前，先说明是否为 sidecar、是否触碰官方核心表、是否需要数据回填。
- [ ] 每次新增 model 后运行：

```bash
go test -count=1 ./model -run 'Sidecar|MigrateDBCreates'
```

Expected: SQLite AutoMigrate 覆盖新增对象；Docker 恢复后补 PostgreSQL diff。

## 8. P2 飞书业务口径与 seed

### Task 8.1 最新飞书口径复核

**Files:**
- Reference: `docs/affiliate/native-affiliate-master-plan.zh-CN.md`
- Modify if changed: `service/affiliate_rule_seed.go`
- Test: `service/affiliate_rules_test.go`
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 重新核对净付费口径：只计算 paid 净付费消耗，不计算赠金、试用、退款、异常、自刷、内部测试、legacy_unknown。
- [ ] 重新核对有效新用户口径：邀请归因有效、首充达标、14 天净付费达标、无退款、自刷、批量异常。
- [ ] 重新核对一级和二级佣金档位、KPI 档位、人头费门槛、风控阈值、邀请赠送额度差异。
- [ ] 如 seed 需要更新，先写测试覆盖区间连续、无重叠、单位转换和发布不可变，再改 seed。
- [ ] 复盘只写脱敏业务摘要、核对日期和变更结论，不写飞书内部账号、密码、链接密钥、完整原文或截图。

## 9. P2 SMS 与手机号入口

### Task 9.1 手机号注册归因

**Files:**
- Modify: `controller/sms.go`
- Modify: `controller/user.go`
- Modify: `service/sms.go`
- Modify: `service/affiliate_invite.go`
- Modify: `model/sms.go`
- Test: `controller/sms_test.go`
- Test: `controller/affiliate_invite_test.go`
- Test: `service/sms_test.go`

- [ ] RED: 手机号注册开启时，验证码通过后创建用户并写 `user_phone_bindings` sidecar。
- [ ] RED: 手机号注册复用统一 invite context、初始额度和 `affiliate_invite_events`，不得绕过分销归因。
- [ ] GREEN: 不向官方 `users` 表新增手机号字段；手机号唯一性走 hash + active binding。
- [ ] GREEN: 日志只记录脱敏手机号、场景、provider、模板版本、返回码和耗时。

### Task 9.2 手机号登录、绑定、换绑

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

### Task 9.3 短信宝真实通道 smoke

**Files:**
- Reference: `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`

- [ ] 仅在签名、模板、专用测试手机号和限流配置就绪后执行。
- [ ] `GET /api/option/sms/status` 只输出 provider code、余额或条数等脱敏状态，不输出 endpoint、账号或凭据。
- [ ] `POST /api/option/sms/test` 对专用测试手机号发送成功，测试记录只保留脱敏手机号和 provider code。
- [ ] 连续触发超过阈值，确认 provider 调用前被限流拒绝。

## 10. P2 Dashboard 与分销商前端

### Task 10.1 分销商趋势图

**Files:**
- Modify: `service/affiliate_summary.go`
- Modify: `controller/affiliate.go`
- Test: `service/affiliate_summary_test.go`
- Test: `controller/affiliate_test.go`
- Modify: `web/default/src/features/affiliate/*`
- Modify: `web/classic/src/pages/Affiliate/*`

- [ ] RED: 后端提供按日或周的 paid 净消耗、有效新用户、预估佣金、待结算金额趋势，不把 gift/trial/refund/legacy_unknown 算入 paid。
- [ ] GREEN: default/classic 展示趋势图，RMB 为主单位，raw quota 只作为附加信息。
- [ ] GREEN: 分销商端保持摘要卡片、趋势图、关系树、scoped logs 表格，不整体改成纯表格。

### Task 10.2 浏览器 smoke 与截图回归

**Files:**
- Runtime only: `runtime/` or ignored smoke output
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 使用 in-app Browser 或 Playwright 打开 `5173/affiliate` 与 `5174/console/affiliate`，验证未登录跳转、登录态 API、关系树、summary、logs 表格。
- [ ] 如使用本地 secret 登录，只输出角色标签、HTTP code、success、脱敏计数，不输出密码、cookie、session 或完整响应体。
- [ ] 截图仅用于本地对比；如写入文档，只写截图文件名和脱敏结论，不提交敏感截图。

## 11. 外部验收与灰度

### Task 11.1 Staging/生产发布前检查

**Files:**
- Reference: `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`
- Reference: `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`

- [ ] 确认当前分支已分批提交，`git status --short` 干净或只剩明确不提交文件。
- [ ] 确认 PostgreSQL 已备份，并记录可恢复路径和回滚镜像 tag。
- [ ] 确认生产应用镜像来自本仓库不可变 tag，非官方 latest。
- [ ] 确认 default/classic 前端 dist 嵌入生产镜像。
- [ ] 确认真实入口 `/api/*` 不缓存 404、401 或敏感 JSON。

### Task 11.2 灰度与外接控制台归档

- [ ] 灰度顺序：管理员只读、少量分销商只读、规则发布、结算任务、外接控制台只读归档。
- [ ] 外接控制台归档前确认原生分销页面、管理员 profiles、规则集、佣金/结算操作、用户 inviter 管理均通过外部 smoke。
- [ ] 至少一个完整结算周期双跑通过后，才把原生模块作为唯一写入口。
- [ ] 外部验收记录只写脱敏证据，不写账号、密码、cookie、token、DSN、完整手机号、生产地址或敏感截图。

## 12. 建议下一批执行顺序

- [ ] 第一批：Windows 浏览器旧 404 最终取证；如果仍复现，先清缓存/确认端口/确认后端镜像来源。
- [ ] 第二批：Docker engine 恢复后重建 `new-api:dev`，复核 `/api/*` no-store header 和 `/api/affiliate/team` 401/200。
- [ ] 第三批：Docker PostgreSQL schema diff，补齐 `affiliate_job_runs`、`sms_rate_limit_counters`、`affiliate_head_fee_rules.status`、`affiliate_risk_rules` 新字段证据。
- [ ] 第四批：外部完整结算周期 dry-run/正式 run 双跑，使用已实现的 `dry_run` API 能力。
- [ ] 第五批：阶段内部 cursor resume 设计与安全切片；没有 durable output 前不要实现 unsafe 跳扫。
- [ ] 第六批：最新飞书口径复核，必要时更新默认 seed 和测试。
- [ ] 第七批：手机号注册归因、手机号登录/绑定/换绑、短信宝真实通道 smoke。
- [ ] 第八批：管理端佣金/结算列表操作表格增强，分销商趋势图和浏览器回归。
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
