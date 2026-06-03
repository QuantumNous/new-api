# 原生分销接手后续开发 Tasklist v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项执行本 tasklist。每个实现项必须按 checkbox 跟踪，先 RED 再 GREEN，完成后追加脱敏复盘。

**Goal:** 指导后续接手 `feature/native-affiliate-minimal` 的原生分销开发，优先收口当前线程暴露的运行态、发布治理、规则表格化、结算可靠性、SMS 和外部验收缺口。

**Architecture:** 分销功能继续走最小侵入 sidecar 架构，业务状态优先落在 `affiliate_*`、`sms_*`、`user_phone_bindings`、`user_quota_source_*` 等独立表；官方主链路只保留注册、充值、扣费、退款、使用日志等必要 thin hook。前端保持 default 与 classic 功能 parity，但分别遵守 default/shadcn/Tailwind 与 classic/Semi Design 的既有设计系统。

**Tech Stack:** Go + Gin + GORM + PostgreSQL/SQLite tests，React 19，Rsbuild，Bun，default frontend，classic frontend，Docker Compose，tmux，Playwright/in-app Browser，Superpowers，项目 `.agents/skills`，飞书资料只作为脱敏业务口径来源。

---

## 0. 当前接手事实

- [x] 当前分支：`feature/native-affiliate-minimal`。
- [x] 当前本 tasklist 创建前 HEAD：`db5c861f feat: polish affiliate commission rule status UI`。
- [x] `/api/affiliate/team` 后端路由已存在，源码在 `router/api-router.go`、`controller/affiliate.go`、`service/affiliate.go`，后续不要重复实现。
- [x] WSL 内未登录访问 `3000/5173/5174` 的 `/api/affiliate/team` 已验证为 401，不是旧 `Invalid URL` 404。
- [x] 登录并带 `New-Api-User` header 后，`3000/5173/5174` 的 `/api/affiliate/team` 已验证为 200 且 `total=9`。
- [x] `5173` default 与 `5174` classic 是 WSL 内 Rsbuild dev server 进程，不是 Docker 容器；电脑或 WSL 重启后拒绝连接是正常现象，需要重新运行 `./scripts/dev-web-tmux.sh`。
- [x] dev compose 的应用服务应使用本仓库源码构建的 `new-api:dev`；如果应用服务改成官方 `calciumion/new-api:latest`，仓库二开代码不会生效。
- [x] dev compose 使用官方 PostgreSQL/Redis 基础设施镜像不影响仓库代码；真正影响二开功能的是 `new-api` 应用镜像来源。
- [x] 生产发布不能把官方 `calciumion/new-api:latest` 当成包含本仓库二开的应用镜像，必须从当前仓库根目录 `Dockerfile` 构建不可变 tag 并嵌入 default/classic 前端 dist。
- [x] 分销管理规则配置更适合表格/矩阵；分销商看板不建议全表格化，应保留摘要卡片、趋势、关系树、明细表组合。

## 1. 接手前固定读取清单

- [ ] 阅读 `docs/affiliate/native-affiliate-master-plan.zh-CN.md`，确认业务目标、分销层级、飞书口径和最小侵入架构。
- [ ] 阅读 `docs/affiliate/native-affiliate-development-principles.zh-CN.md`，确认 sidecar、TDD、脱敏、RMB 单位、权限、发布证据和文档治理原则。
- [ ] 阅读 `docs/affiliate/native-affiliate-new-thread-tasklist.zh-CN.md`，理解 Phase 1 到 Phase 13 已完成项与历史残留风险。
- [ ] 阅读 `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`，以最新复盘为准判断已完成项，不重复做 P0/P1 已收口任务。
- [ ] 阅读 `docs/affiliate/native-affiliate-dev-compose-runbook.zh-CN.md`，确认 WSL dev compose、前端 tmux、dump 恢复和清理方式。
- [ ] 阅读 `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`，确认 dev/prod 镜像切换和生产发布流程。
- [ ] 阅读 `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`，确认本地 smoke 不能替代 staging/生产验收。
- [ ] 阅读 `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`，确认当前缺少 `affiliate_job_runs` 与 `sms_rate_limit_counters` 的 Docker PostgreSQL schema diff。
- [ ] 阅读 `docs/affiliate/native-affiliate-sms-reference-audit.zh-CN.md`，确认手机号/SMS 继续走 provider + sidecar，不直接迁移旧 fork 的 `users.phone`。
- [ ] 涉及 default UI 前阅读 `.agents/skills/shadcn-ui/SKILL.md`；涉及 i18n 前阅读 `.agents/skills/i18n-translate/SKILL.md`；涉及 classic/default parity 前阅读 `.agents/skills/classic-to-default-sync/SKILL.md`。

## 2. 通用执行纪律

- [ ] 每次改代码前运行 `git status --short --branch` 和 `git log --oneline -8`，确认没有未归属改动。
- [ ] 每个后端逻辑变更必须先写失败测试；可用命令优先从 `go test -count=1 ./model ./service ./controller ./router -run '<pattern>'` 缩小范围开始。
- [ ] 每个前端 helper/API/表单变更必须先写 default/classic 对应 helper 测试，再改 UI 接入。
- [ ] 每个前端变更后至少运行相关 `bun test`；影响页面或构建入口时运行 `cd web/default && bun run build` 与 `cd web/classic && bun run build`。
- [ ] 每个运行态、缓存、端口、Docker 或认证问题必须先取证，使用 `curl -i`、DevTools Network、in-app Browser、Playwright、`ss -ltnp`、`tmux ls`、`docker inspect` 等证据定位，不凭猜测改代码。
- [ ] 所有复盘、commit message、测试日志和文档不得包含密码、cookie、session、DSN、token、完整手机号、生产地址、敏感截图或飞书内部原文。
- [ ] 飞书资料只写脱敏业务摘要和核对日期；比例、KPI、人头费、风控阈值只能作为 seed/default，不硬编码进计算逻辑。
- [ ] 每个主题完成后按主题提交，不堆大 commit；建议 commit 分类：runtime/cache、scoped logs、admin rules UX、settlement reliability、SMS、schema impact、docs/runbook。

## 3. P0 运行态与缓存收口

### Task 3.1 Windows 浏览器旧 404 最终取证

**Files:**
- Inspect only: `web/default/src/features/affiliate/api.ts`
- Inspect only: `web/classic/src/pages/Affiliate/index.jsx`
- Inspect only: `router/api-router.go`
- Update after evidence: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 在 Windows 浏览器 DevTools Network 打开 `/api/affiliate/team` 请求，记录脱敏证据：Request URL、Status、是否 `from disk cache` / `from memory cache`、Response body 是否 `Invalid URL (GET /api/affiliate/team)`、Request Headers 是否包含 `New-Api-User`。
- [ ] 在 WSL 内运行未登录 smoke：

```bash
cd /home/rain/projects/new-api-rain021217
timeout 15s curl -i http://127.0.0.1:5173/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:5174/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:3000/api/affiliate/team
```

Expected: 三个入口均返回 401 JSON，不返回 404，也不返回 `Invalid URL`。

- [ ] 如果 Windows 浏览器仍显示旧 404，但 WSL curl 为 401/200，先清浏览器站点缓存或勾选 Disable cache 后硬刷新，不改后端路由。
- [ ] 如果 Windows 浏览器 Request URL 指向非 `127.0.0.1:5173` / `127.0.0.1:5174` / 当前 `3000`，先定位代理、端口映射、hosts、浏览器标签页实际地址。
- [ ] 如果 3000 仍缺少 no-store 响应头，先恢复 Docker Desktop/WSL engine 后重建当前仓库 `new-api:dev`，再复测 `middleware.DisableCache()` 是否生效。
- [ ] 完成后在 `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md` 追加复盘，明确是浏览器缓存、错误端口、错误后端、旧 bundle 还是 Docker stale build。

### Task 3.2 前端 dev server 日常启动

**Files:**
- Execute: `scripts/dev-web-tmux.sh`
- Reference: `docs/affiliate/native-affiliate-dev-compose-runbook.zh-CN.md`

- [ ] 电脑或 WSL 重启后，在 WSL 内启动前端：

```bash
cd /home/rain/projects/new-api-rain021217
./scripts/dev-web-tmux.sh
```

Expected: tmux session `new-api-web` 包含 `default` 和 `classic` 两个 window。

- [ ] 验证端口：

```bash
tmux list-windows -t new-api-web
timeout 15s curl -I http://127.0.0.1:5173/
timeout 15s curl -I http://127.0.0.1:5174/
timeout 15s curl -i http://127.0.0.1:5173/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:5174/api/affiliate/team
```

Expected: `5173` 与 `5174` 页面返回 200；未登录 team API 返回 401。

- [ ] 如果提示缺少 `rsbuild`，按 runbook 分别执行 `cd web/default && bun install` 与 `cd web/classic && bun install`，不要用 Windows 侧临时进程替代默认 WSL 路线。

## 4. P0/P1 Docker 与 dev/prod 镜像治理

### Task 4.1 恢复 Docker engine 后补运行态证据

**Files:**
- Reference: `docker-compose.dev.yml`
- Reference: `Dockerfile.dev`
- Reference: `Dockerfile`
- Update: `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] Docker Desktop/WSL engine 恢复后先运行：

```bash
cd /home/rain/projects/new-api-rain021217
timeout 60s docker version
timeout 60s docker info --format '{{.ServerVersion}} {{.Name}}'
timeout 60s docker compose version
timeout 60s docker ps --filter 'name=new-api'
```

Expected: Docker server 可查询，不再空输出或挂起。

- [ ] 确认 dev 应用镜像是当前仓库构建：

```bash
timeout 600s docker compose -f docker-compose.dev.yml build new-api
timeout 600s docker compose -f docker-compose.dev.yml up -d --force-recreate new-api
docker inspect new-api --format '{{.Config.Image}}'
```

Expected: 应用镜像为 `new-api:dev` 或等价本地构建镜像，不是官方应用 latest。

- [ ] 复测 `GET /api/affiliate/team` 未登录为 401，登录后为 200；若是 404，先检查容器镜像来源和端口映射。

### Task 4.2 生产切换准备

**Files:**
- Reference: `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`
- Reference: `docker-compose.prod.local.example.yml`
- Reference: `docker-compose.yml`

- [ ] 发布前从当前仓库构建不可变生产镜像，例如 `new-api-rain:20260604-<shortsha>`。
- [ ] 验证生产镜像构建会生成并嵌入 `web/default/dist` 与 `web/classic/dist`。
- [ ] 生产或 staging compose 必须用本仓库镜像 tag 覆盖 `new-api` 应用服务；官方 `calciumion/new-api:latest` 只能代表上游应用，不包含当前二开。
- [ ] 发布后 smoke 必须覆盖 `/api/status`、`/api/affiliate/status`、`/api/affiliate/team`、default/classic 分销页面、管理员规则页、佣金页和结算页。

## 5. P1 管理端规则与指标表格化

### 结论

- [x] 管理端规则、KPI、人头费、风控和结算配置适合表格/矩阵化，这比 JSON textarea 更适合运营维护、二次确认和审计。
- [x] 高级 JSON 导入/导出仍应保留，但不能作为默认入口。
- [x] 分销商端 dashboard 不应整体改成表格；应继续采用摘要卡片、趋势图、关系树和 scoped logs 表格明细组合。

### Task 5.1 人头费规则启停字段（2026-06-04 已完成）

**Files:**
- Modify: `model/affiliate.go`
- Modify: `service/affiliate_rules.go`
- Modify: `service/affiliate_head_fee.go`
- Modify: `service/affiliate_rule_seed.go`
- Test: `service/affiliate_rules_test.go`
- Test: `service/affiliate_head_fee_test.go`
- Modify: `web/default/src/features/affiliate/admin-lib.ts`
- Modify: `web/default/src/features/affiliate/rule-array-editor.tsx`
- Test: `web/default/src/features/affiliate/admin-lib.test.ts`
- Test: `web/default/src/features/affiliate/rule-array-editor.test.ts`
- Modify: `web/classic/src/pages/AffiliateAdmin/affiliateAdminRules.js`
- Modify: `web/classic/src/pages/AffiliateAdmin/RuleArrayEditor.jsx`
- Test: `web/classic/src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs`
- Test: `web/classic/src/pages/AffiliateAdmin/ruleArrayEditor.test.mjs`

- [x] RED: 新增 Go 测试，要求 head fee rule 缺省为 `active`，`disabled` 时不生成人头费事件，历史 snapshot 缺字段时表单补 `active`。
- [x] GREEN: 在后端输入、保存、seed、复制、回滚和生成人头费事件时规范化 `active/disabled`。
- [x] RED/GREEN: default/classic admin rule helper 测试要求旧 snapshot、导入、复制和默认 seed 中的人头费规则显示 `status: active`。
- [x] 验证：

```bash
go test -count=1 ./service -run 'HeadFee|AffiliateRuleSet|DefaultAffiliateRuleSetSeed'
cd web/default && bun test src/features/affiliate/rule-array-editor.test.ts src/features/affiliate/admin-lib.test.ts
cd web/classic && bun test src/pages/AffiliateAdmin/ruleArrayEditor.test.mjs src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs
```

2026-06-04 实际验证：`go test -count=1 ./model ./service -run 'AffiliateSidecar|MigrateDBCreatesAffiliateSidecar|AffiliateRuleSet|HeadFee|DefaultAffiliateRuleSetSeed|CommissionRuleStatus'` 通过；default 24 pass；classic 14 pass。

### Task 5.2 风控动作与自刷/批量异常策略（2026-06-04 已完成配置模型化）

**Files:**
- Modify: `model/affiliate.go`
- Modify: `service/affiliate_rules.go`
- Modify: `service/affiliate_commission.go`
- Modify: `service/affiliate_kpi.go`
- Test: `service/affiliate_commission_test.go`
- Test: `service/affiliate_kpi_test.go`
- Modify/Test: default/classic admin rules files listed in Task 5.1

- [x] RED: 测试要求 risk rules 支持处理动作，例如 `review_only`、`hold_commission`、`exclude_from_kpi`，且未知动作保存时被拒绝。
- [x] GREEN: 风控规则只在规则模型和 service 层规范化，不把动作硬编码到前端。
- [x] 前端表格展示纯赠金占比、异常用户占比、退款阈值、二次付费率、自刷/批量异常策略和处理动作。
- [x] 复盘时说明风控动作是否只影响后续生成任务，不回写历史已结算单。
- [x] 复盘：见 `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md` 的 P1-30；本轮只完成配置模型化和表格化，未接入生成任务自动处置。

### Task 5.3 结算配置自动开关与备注（2026-06-04 已完成）

**Files:**
- Modify: `service/affiliate_rules.go`
- Modify: `service/affiliate_settlement.go`
- Modify: `service/affiliate_job_run.go`
- Test: `service/affiliate_rules_test.go`
- Test: `service/affiliate_settlement_test.go`
- Modify/Test: default/classic admin rules files listed in Task 5.1

- [x] RED: 测试要求 settlement config 支持 `auto_settlement_enabled` 与 `review_note`，旧 snapshot 缺字段时安全回填默认值。
- [x] GREEN: 保存草稿、发布、回滚、复制和导入 JSON 均保留这些字段。
- [x] 生成结算任务读取自动开关；若关闭自动结算，只允许管理员显式手动生成。
- [x] 前端用表单或小矩阵展示周期、冻结天数、最低结算金额、人工复核阈值、自动结算开关和备注。
- [x] 复盘：见 `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md` 的 P1-29；本轮无 GORM schema 变更，仅修改规则 JSON snapshot 和 service input。

## 6. P1 结算任务可靠性

### Task 6.1 cursor 跳扫式 resume

**Files:**
- Modify: `model/affiliate.go`
- Modify: `service/affiliate_job_run.go`
- Modify: `service/affiliate_settlement_run.go`
- Modify: `service/affiliate_commission.go`
- Modify: `service/affiliate_kpi.go`
- Modify: `service/affiliate_head_fee.go`
- Test: `service/affiliate_settlement_run_test.go`
- Test: `service/affiliate_commission_test.go`
- Test: `service/affiliate_kpi_test.go`
- Test: `service/affiliate_head_fee_test.go`

- [ ] RED: 模拟 job 在 commission/KPI/head fee/settlement 某阶段失败后，重跑同 idempotency key 应从已持久化 cursor 后继续或安全跳过已完成段。
- [ ] GREEN: stage-specific cursor payload 明确包含阶段、窗口、最后扫描 ID、已完成标记和安全校验输入。
- [ ] 失败恢复不能重复计佣、重复发人头费、重复生成结算单，也不能静默跳过未处理事件。
- [ ] 验证：

```bash
go test -count=1 ./service -run 'Affiliate.*JobRun|Settlement.*Resume|Commission.*Resume|KPI.*Resume|HeadFee.*Resume'
```

### Task 6.2 外部完整结算周期双跑

**Files:**
- Reference: `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`
- Update: `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md`

- [ ] 在 staging 或受控本地恢复库中执行 dry-run 与正式 run 对比。
- [ ] 重复正式 run，确认不会重复计佣、重复人头费或重复结算。
- [ ] 对比原生 KPI snapshot、pending commission、head fee、draft settlement 与外接控制台只读口径。
- [ ] 只记录脱敏汇总：计数、金额汇总、差异原因、job run ID、HTTP 状态，不记录真实用户、cookie、token、DSN 或完整响应体。

## 7. P1/P2 schema impact

### Task 7.1 补 Docker PostgreSQL schema diff

**Files:**
- Update: `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`
- Runtime only: `runtime/schema-impact/`

- [ ] Docker engine 恢复后导出包含 `affiliate_job_runs`、`sms_rate_limit_counters`、`affiliate_head_fee_rules.status` 与 `affiliate_risk_rules` 新增策略/动作字段的 before/after PostgreSQL schema。
- [ ] 运行 diff 检查，确认只出现预期 sidecar DDL，不出现官方核心表 `ALTER` 或 `DROP`。
- [ ] `runtime/schema-impact/` 文件必须继续保持 git ignored，不提交。
- [ ] 更新 schema impact 报告，只写快照文件名、sha256 验证和脱敏结论。

## 8. P2 SMS 与手机号入口

### Task 8.1 手机号注册归因

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
- [ ] RED: 手机号注册必须复用统一 invite context、初始额度、`affiliate_invite_events`，不得绕过分销归因。
- [ ] GREEN: 不修改官方 `users` 表新增手机号字段；手机号唯一性走 hash + active binding 语义。
- [ ] 日志只记录脱敏手机号、场景、provider、模板版本、返回码和耗时。

### Task 8.2 手机号登录/绑定/换绑

**Files:**
- Modify: `controller/sms.go`
- Modify: `controller/user.go`
- Modify: `service/sms.go`
- Modify: `model/sms.go`
- Test: `controller/sms_test.go`
- Test: `service/sms_test.go`

- [ ] RED: `/api/user/login/phone` 只允许已绑定手机号登录，不自动注册。
- [ ] RED: 自助绑定/换绑写 `user_phone_bindings`，旧 active binding 被安全停用。
- [ ] GREEN: 所有发送动作走 SMS-scoped Turnstile 或等价验证，以及手机号/IP/账号/场景维度 DB-backed 限流。

### Task 8.3 短信宝真实通道 smoke

**Files:**
- Reference: `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`

- [ ] 仅在签名、模板、专用测试手机号和限流配置就绪后执行。
- [ ] `GET /api/option/sms/status` 只输出 provider code、余额/条数等脱敏状态，不输出 endpoint、账号或凭据。
- [ ] `POST /api/option/sms/test` 对专用测试手机号发送成功，测试记录只保留脱敏手机号和 provider code。
- [ ] 连续触发超过阈值，确认 provider 调用前被限流拒绝。

## 9. P2 Dashboard、趋势与管理端列表

### Task 9.1 分销商端趋势图

**Files:**
- Modify: `service/affiliate_summary.go`
- Modify: `controller/affiliate.go`
- Test: `service/affiliate_summary_test.go`
- Test: `controller/affiliate_test.go`
- Modify: `web/default/src/features/affiliate/*`
- Modify: `web/classic/src/pages/Affiliate/*`

- [ ] RED: 后端提供按日/周的 paid 净消耗、有效新用户、预估佣金、待结算金额趋势，不把 gift/trial/refund/legacy_unknown 算入 paid。
- [ ] GREEN: default/classic 展示趋势图，RMB 为主单位，raw quota 只作为附加信息。
- [ ] 分销商端保持摘要卡片、趋势图、关系树、明细表组合，不整体改为纯表格。

### Task 9.2 管理端佣金/结算列表操作

**Files:**
- Modify: `controller/affiliate_finance.go`
- Modify: `service/affiliate_finance.go`
- Test: `controller/affiliate_test.go`
- Test: `service/affiliate_commission_admin_test.go`
- Modify: `web/default/src/features/affiliate/admin-lib.ts`
- Modify: `web/classic/src/pages/AffiliateAdmin/affiliateAdminFinance.js`

- [ ] 管理端佣金表支持状态筛选、冻结/作废/调整、二次确认和操作原因。
- [ ] 管理端结算表支持冻结、标记已支付、作废、导出脱敏摘要和 job run 审计跳转。
- [ ] default/classic 功能 parity，视觉遵守各自设计系统。

## 10. 外部验收与灰度

- [ ] staging/生产发布前确认当前分支已分批提交，`git status --short` 干净或只剩明确不提交文件。
- [ ] staging/生产发布前备份 PostgreSQL，并记录可回滚镜像 tag。
- [ ] staging/生产发布后检查真实入口 HTTP cache header，避免 `/api/*` 缓存 404、401 或敏感 JSON。
- [ ] 灰度顺序：管理员只读、少量分销商只读、规则发布、结算任务、外接控制台只读归档。
- [ ] 外接控制台归档前确认原生分销页面、管理员 profiles、规则集、佣金/结算操作、用户 inviter 管理均通过外部 smoke。
- [ ] 外部验收记录只写脱敏证据，不写账号、密码、cookie、token、DSN、完整手机号、生产地址或敏感截图。

## 11. 建议下一批执行顺序

- [ ] 第一批：Windows 浏览器旧 404 最终取证与 Docker engine 恢复后 no-store/header 复核。
- [ ] 第二批：Docker PostgreSQL schema diff，补 `affiliate_job_runs`、`sms_rate_limit_counters`、`affiliate_head_fee_rules.status` 和 `affiliate_risk_rules` 新增字段发布前证据。
- [x] 第三批：人头费规则 `status`，保持 default/classic 表格 parity。
- [x] 第四批：风控动作和结算配置自动开关/备注已在 2026-06-04 Task 5.2/5.3 收口。
- [ ] 第五批：cursor 跳扫式 resume 与完整结算周期双跑。
- [ ] 第六批：手机号注册/登录/绑定主链路与真实短信宝 smoke。
- [ ] 第七批：分销商趋势图、管理端佣金/结算列表和外部灰度验收。

## 12. 完成复盘模板

每完成一个任务，追加到 `docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md` 或本文件对应任务下：

```markdown
### Task X-Y 复盘（YYYY-MM-DD 本线程）

- RED：写了哪些失败测试，旧实现如何失败。
- 完成内容：改了哪些业务行为，是否保持 sidecar/minimal hook/default-classic parity。
- 验证命令：列出实际运行过的命令和通过结果。
- 浏览器/运行态证据：如适用，写 HTTP code、页面、Network/cache 状态和脱敏计数。
- 残留风险：明确未覆盖的真实支付、真实短信、Docker schema、staging/生产、登录态 smoke 等。
- 下一步：指向本 tasklist 中的下一个 checkbox。
```
