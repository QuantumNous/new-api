# 新线程执行 Tasklist

更新日期：2026-06-03

## 0. 启动要求

新线程应先读取以下本地文档：

- `docs/affiliate/native-affiliate-master-plan.zh-CN.md`
- `docs/affiliate/native-affiliate-development-principles.zh-CN.md`
- `docs/affiliate/native-affiliate-new-thread-tasklist.zh-CN.md`

新线程必须遵守：

- 基于 `/home/rain/projects/new-api-rain021217` 开发。
- 当前仓库是官方最新干净基线。
- `projects/new-api-liu23zhi` 只作为 reference-only。
- 不推送远端，除非用户明确要求。
- 不把账号密码、生产 DSN、dump 文件或 runtime 大文件写入 git。

## Phase 0：干净基线确认

- [x] 确认当前路径是 `/home/rain/projects/new-api-rain021217`。
- [x] 运行 `git status --short`，确认只有本地指导文档或明确改动。
- [x] 记录 `origin`、`upstream`、`HEAD` commit。
- [x] 新建本地功能分支，例如 `feature/native-affiliate-minimal`.
- [x] 确认 `origin/main` 与 `upstream/main` 的关系。
- [x] 阅读 `.agents/skills`，至少确认 `classic-to-default-sync`、`i18n-translate`、`shadcn-ui`、`vercel-react-best-practices` 的适用范围。
- [x] 读取飞书分销方案文档及子页，重点同步分佣比例、KPI、人头费、“实践经验”和最新讨论口径。
- [x] 阅读短信宝接口说明，确认手机号/SMS 模块的模板备案、签名自定义、ApiKey/MD5 password 模式和限流要求。
- [x] 对旧 `projects/new-api-liu23zhi` 只做只读参考，不整包迁移。
- [x] 明确飞书内部账号密码表只作业务背景，不写入代码、报告、commit、runbook 或测试日志。

## Phase 1：服务器 PostgreSQL 快照下载与本地恢复

- [x] 确认 `.codex-local/sources.yml`、`.codex-local/affiliate-test-accounts.secret.json` 和 `runtime/prod-pg-snapshots/` 均被 Git 忽略。
- [x] 明确 `.codex-local/sources.yml` 允许 AI/脚本读取作为本地密钥源，但禁止输出、复制、提交或记录其中的 DSN、密码、端点和 YAML 内容。
- [x] 确认已下载本地最新 dump：`runtime/prod-pg-snapshots/new-api-prod-20260602-193617.dump`，后续默认不再直连生产数据库。
- [x] TAC/安全风险复盘：本轮已确认 `.codex-local/`、`runtime/` 未被 Git 追踪，已脱敏 tasklist 中出现的具体生产数据库端点；当前 modified files 精确敏感模式扫描无命中，dump sha256 校验通过。
- [x] 如连接信息曾在聊天、命令、日志或文档中暴露，评估是否需要更换临时数据库密码或吊销临时访问；用户已提示旧会话曾明文粘贴数据库密码，本轮建议轮换临时数据库密码或吊销临时访问，后续默认只用本地 dump。
- [x] 解除本地 Docker daemon 阻塞；2026-06-02 用户提示另一线程已构建 `new-api-rain021217`，旧线程按容器名、Compose project label、`docker compose -p new-api-rain021217 ps --all` 均超时，`docker ps -a`、`docker image ls`、`docker compose -f docker-compose.dev.yml ps --all` 均在 15s 超时无输出，`curl --unix-socket /var/run/docker.sock http://localhost/_ping` 也超时；本线程先按规则执行 `timeout 15s docker version`，超时且只返回 client 信息。用户随后要求 Phase 1/1A/2 优先并允许更长等待，本线程复跑 `timeout 60s docker version` 仍超时且只返回 client 信息。用户在 Windows 侧修复 Docker 后，本线程重跑 preflight 成功：`docker version` 返回 server Docker Desktop 4.76.0 / engine 29.5.2，`docker info --format '{{.ServerVersion}} {{.Name}}'` 返回 `29.5.2 docker-desktop`，`docker compose version` 返回 v5.1.4。
- [x] 2026-06-03 用户切换网络后重新执行一次 Docker preflight：`timeout 60s docker version`、`timeout 60s docker info --format '{{.ServerVersion}} {{.Name}}'`、`timeout 60s docker compose version`、`timeout 60s docker ps --filter 'name=new-api'` 均在 timeout 内成功；目标容器 `new-api`、`new-api-postgres`、`new-api-redis` 均为 running。
- [x] Docker 阻塞非 Docker 诊断：`/var/run/docker.sock` 存在，权限为 `root:docker` `660`，当前用户 `rain` 已在 `docker` 组；进程列表可见 Docker Desktop WSL proxy，但 daemon/server 仍未响应 `docker version`。
- [ ] 补齐或确认服务器 SSH 入口、compose 项目名、PostgreSQL 容器名；当前仍需用户/运维提供真实入口，执行步骤和脱敏证据标准见 `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`。
- [x] 确认本机 `psql`、`pg_dump`、`pg_restore` 16.14 可用，本机 PostgreSQL service 未运行，符合优先使用 Docker PostgreSQL 隔离库的路径。
- [x] 因服务器 PostgreSQL 为 18.4，按 PostgreSQL 官方 PGDG APT 源安装 `postgresql-client-18`，使用 `/usr/lib/postgresql/18/bin/pg_dump` / `pg_restore` 18.4 作为快照工具。
- [x] 新增无密钥快照下载、Docker PostgreSQL 恢复、核心表行数采集 runbook 和脚本。
- [x] Docker Desktop WSL 集成修复后重跑 `docker version`、`docker info`、`docker ps`，再执行本地隔离库恢复；2026-06-02 已确认 `new-api`、`new-api-postgres`、`new-api-redis` 运行。
- [ ] 确认服务器 SSH 入口、compose 项目名、PostgreSQL 容器名；不得把真实服务器地址、容器名或凭据写入仓库。
- [ ] 在服务器 compose 网络内执行 `pg_dump --format=custom --no-owner --no-privileges`；命令模板和本地 sha256/`pg_restore --list` 验收步骤见 external acceptance runbook。
- [x] 在 SSH 未授权但临时生产 PostgreSQL 端点可连的情况下，通过静默 stdin 读取临时 DSN，并用本机 PGDG `pg_dump` 18.4 直连下载最新快照；未把 DSN 写入 shell history、文件、commit 或报告。
- [x] 下载到本地 runtime 目录：`runtime/prod-pg-snapshots/new-api-prod-20260602-193617.dump`。
- [x] 计算 dump sha256，并从仓库根目录执行 `sha256sum -c runtime/prod-pg-snapshots/new-api-prod-20260602-193617.dump.sha256` 校验通过。
- [x] 用 `/usr/lib/postgresql/18/bin/pg_restore --list` 验证 dump 可读；archive 显示 dump 来自 PostgreSQL 18.4，TOC Entries 283。
- [x] 在本地 Docker PostgreSQL 恢复到隔离库；2026-06-02 已将 `runtime/prod-pg-snapshots/new-api-prod-20260602-193617.dump` 恢复到 compose `new-api-postgres` / `new-api` 数据库。
- [x] 采集核心表行数：`users`、`channels`、`abilities`、`options`、`logs`、`top_ups`、`affiliate_*`；2026-06-02 行数为 `users=80`、`channels=38`、`abilities=334`、`options=116`、`logs=426295`、`top_ups=84`，dump 当前无 `affiliate_*` 表。
- [x] 启动 new-api 指向本地恢复库；2026-06-02 `new-api:dev` 主容器已重建并启动，日志显示系统已初始化并完成 channels sync。
- [x] 验证 `/api/status`、`channels` 查询和登录页可用；2026-06-02 `/api/status` 返回 `success=true`，登录页 `GET /` 返回 HTTP 200，`channels` 表行数为 38。
- [x] 用 `Rain`、`ChengyuWang0807`、`nr_mm2z5vr` 完成本地登录 smoke，不记录密码；2026-06-02 从 `.codex-local/affiliate-test-accounts.secret.json` 读取密码且仅输出角色标签，`super_admin`、`level_1_affiliate`、`level_2_affiliate` 均 HTTP 200 / `success=true` / `require_2fa=false`。

## Phase 1A：WSL2 Docker Compose Dev 部署

- [x] 修复或确认 WSL2 Docker daemon 可用；当前 Compose 插件和 `docker compose -f docker-compose.dev.yml config` 曾验证可用，本线程 `timeout 15s docker version` 与 `timeout 60s docker version` 曾超时且未返回 server 信息；用户在 Windows 侧修复后，Docker daemon/server 已恢复响应并完成 build/up/restore/smoke。
- [x] 审查现有 `docker-compose.yml`、`docker-compose.dev.yml`、`Dockerfile.dev`，确定修改 dev compose。
- [x] 本地 dev compose 主服务镜像名设为 `new-api:dev`。
- [x] 本地 dev compose 主服务容器名设为 `new-api`。
- [x] Redis 使用官方 `redis:latest`，容器名建议 `new-api-redis`。
- [x] PostgreSQL 使用官方 `postgres:latest`，容器名建议 `new-api-postgres`。
- [x] compose 内部 `SQL_DSN` 指向 `postgres` 服务，不使用生产 DSN。
- [x] compose 内部 `REDIS_CONN_STRING` 指向 `redis` 服务，不使用生产 Redis。
- [x] 使用隔离 volume 和 network，避免覆盖其他项目或旧 dev 数据。
- [x] 复核并接收另一线程的 compose 改动：`Dockerfile.dev` builder 升到 `golang:1.26.3-alpine`，PostgreSQL 命名卷挂载到 `/var/lib/postgresql`，默认 PGDATA 子目录仍位于隔离命名卷 `new_api_dev_pg_data` 内；`docker compose -f docker-compose.dev.yml config --quiet` 通过，运行态仍待 Docker daemon 可访问后用 `docker inspect` 复核。
- [x] 构建本地镜像：`docker compose -f docker-compose.dev.yml build new-api`，确认生成 `new-api:dev`；2026-06-02 本线程已重建镜像，输出 `Image new-api:dev Built`。
- [x] 启动容器：`docker compose -f docker-compose.dev.yml up -d`；2026-06-02 `new-api`、`new-api-postgres`、`new-api-redis` 均运行。
- [x] 将 `runtime/prod-pg-snapshots/new-api-prod-20260602-193617.dump` 恢复到 compose PostgreSQL 隔离库。
- [x] 采集核心表行数：`users`、`channels`、`abilities`、`options`、`logs`、`top_ups`、`affiliate_*`；结果同 Phase 1 记录。
- [x] 验证 `http://127.0.0.1:3000/api/status`；受限执行环境内直接 curl 被 sandbox 网络限制拒绝，提升后本地 curl 成功且返回 `success=true`。
- [x] 2026-06-03 网络切换后复核 HTTP smoke：`http://127.0.0.1:3000/` 返回 dev frontend 提示，`http://127.0.0.1:3000/api/status` 返回 HTTP 200 JSON，`http://127.0.0.1:5173/` 与 `http://127.0.0.1:5174/` 均返回 HTTP 200 HTML。
- [x] 用本地密钥文件中的三类账号完成登录 smoke，不输出密码；三类账号均 HTTP 200 / `success=true`。
- [x] 记录 compose 启停、重建、恢复 dump、清理 volume 的本地 runbook：`docs/affiliate/native-affiliate-dev-compose-runbook.zh-CN.md`。

## Phase 2：schema impact 基线

- [x] 在未开发前导出官方基线 PostgreSQL schema；严格意义上无法回到功能分支最初未开发时间点，但当前 `AffiliateSidecarModels()` 尚未接入全局 AutoMigrate，2026-06-02 已从恢复后的 compose PostgreSQL 导出 sidecar 接入前 baseline：`runtime/schema-impact/20260602T150911Z-compose-official-baseline.sql`，sha256 校验通过且 runtime 被 Git 忽略。
- [x] 建立 schema impact 脚本或手工流程。
- [x] 后续每次新增 GORM model 前后都生成 diff；2026-06-02 本次 `AffiliateSidecarModels()` 接入 AutoMigrate 已生成 before/after schema 和 diff：`runtime/schema-impact/20260602T150911Z-compose-official-baseline.sql` -> `runtime/schema-impact/20260602T152044Z-affiliate-sidecar-after.sql`，diff 保存在 `runtime/schema-impact/20260602T152044Z-affiliate-sidecar.diff`，runtime 被 Git 忽略；2026-06-03 新增 `QuotaSourceSidecarModels()` 时再次生成 `runtime/schema-impact/20260603T003059Z-quota-source-before.sql` -> `runtime/schema-impact/20260603T003059Z-quota-source-after.sql`。
- [x] 确认新增内容只包括预期 `affiliate_*` / sidecar 表和索引；2026-06-02 diff 显示新增 15 个 `affiliate_*` 表及其序列/索引/主键，反向检查未发现非 `affiliate_*` 的新增 `CREATE` / `ALTER`；2026-06-03 quota source diff 只新增 `user_quota_source_balances`、`user_quota_source_events` 及其序列、主键和索引。
- [x] 明确禁止改动官方核心表结构，除非有单独批准和记录；2026-06-02 已在 sidecar 接入前导出 baseline，随后仅将 `AffiliateSidecarModels()` 接入 `model/main.go` 的 `migrateDB` / `migrateDBFast`，schema diff 反向检查未发现非 `affiliate_*` 的新增 `CREATE` / `ALTER`。

## Phase 3：分销 sidecar 表与服务骨架

- [x] 新增 `affiliate_profiles` 模型。
- [x] 新增 `affiliate_relations` 模型。
- [x] 新增 `affiliate_invite_events` 模型。
- [x] 新增 `affiliate_audit_logs` 模型。
- [x] 新增 `affiliate_commission_rules` 模型。
- [x] 新增 `affiliate_commission_events` 模型。
- [x] 新增 `affiliate_head_fee_events` 模型。
- [x] 新增 `affiliate_kpi_snapshots` 模型。
- [x] 新增 `affiliate_settlements` 模型。
- [x] 新增 `affiliate_rule_sets` 模型，用于分销规则版本、草稿、发布、生效时间。
- [x] 新增 `affiliate_commission_tiers` 模型，用于单用户累计净付费消耗区间、基准比例、cap。
- [x] 新增 `affiliate_kpi_tiers` 模型，用于一级/二级 KPI 阈值、系数和质量门槛。
- [x] 新增 `affiliate_head_fee_rules` 模型，用于有效用户定义和人头费金额。
- [x] 新增 `affiliate_risk_rules` 模型，用于纯赠金占比、异常用户占比、退款/刷量等阈值。
- [x] 新增 `affiliate_config_audit_logs` 模型，用于管理员规则变更审计。
- [x] 如果需要 paid/gift/trial 计佣，新增 `user_quota_source_*` sidecar 表。
- [x] `AffiliateSidecarModels()` 清单已建立；Phase 2 baseline 完成后已接入 `model/main.go` 的 `migrateDB` / `migrateDBFast` 全局 AutoMigrate。
- [x] 所有模型进入 AutoMigrate 前后跑 schema impact；2026-06-02 已在 compose PostgreSQL 上触发迁移、导出 after schema 并确认只新增 `affiliate_*` 对象；2026-06-03 quota source sidecar 复核只新增 `user_quota_source_*` 对象。
- [x] 新增基础 service：scope、profile、relation、audit。
- [x] 新增 `AffiliateEnabled` 管理员配置开关，默认关闭，用于分销模块总熔断和分销码降级。
- [x] 新增基础 controller 和 `/api/affiliate/*` 路由组。

## Phase 4：分销身份与权限

- [x] 保持 `users.role` 不变。
- [x] 用 `affiliate_profiles.status=active` 派生分销身份。
- [x] 支持管理员指定一级/二级分销商（后端 service/controller/API）。
- [x] 增加管理员指定二级分销商的后端层级校验：二级 profile 必须指定 active 一级 parent，禁止缺失 parent、disabled parent 或自引用 parent。
- [x] 支持启用/禁用分销 profile（后端 service/controller/API；重新启用不自动恢复已 ended relation，后续需明确恢复策略）。
- [x] 新增分销商端 middleware（普通用户需模块开启且 profile active，管理员/超级管理员默认放行并注入全局 scope）。
- [x] 新增管理员端权限校验（`/api/affiliate/admin/*` 使用 `AdminAuth`）。
- [x] 普通用户访问分销页返回友好未开通状态；后端 `/api/affiliate/status` 已返回 `available`、`unavailable_reason` 和中文 `message`，classic `/console/affiliate` 已接入，default `/affiliate` 已优先展示后端 `message`，并保持 summary/logs 查询只在 `available=true` 时启用。
- [x] 增加 profile 创建、启用、禁用、权限校验测试；已覆盖 profile 创建/更新/禁用/启用 happy path，以及管理员路由未登录/普通用户拒绝访问；2026-06-02 本线程复跑 `go test ./model ./service ./middleware ./controller -run 'Affiliate|AdminSetAffiliateProfile|AdminUpdateAffiliateProfileStatus|AffiliateAdminRoutes|GetAffiliateStatus'` 通过。
- [x] 增加二级分销商 parent 校验测试；2026-06-02 本线程先观察到新增测试 RED，再实现 service 校验，`go test ./service -run 'TestSetAffiliateProfileRequiresActiveLevelOneParentForLevelTwo|TestSetAffiliateProfileAcceptsLevelTwoWithActiveLevelOneParent'` 通过。

### Phase 1-4 接手复盘（2026-06-02 本线程）

- Phase 1/1A 完成内容：确认 `.codex-local/`、`runtime/`、dump、secret JSON、`sources.yml` 未被 Git 追踪；Docker 初始 15s/60s preflight 曾超时，用户在 Windows 侧修复后重跑 preflight 成功；已重建 `new-api:dev`，启动 `new-api`、`new-api-postgres`、`new-api-redis`，恢复本地 dump，采集核心表行数，完成 `/api/status`、登录页和三类真实账号登录 smoke。
- Phase 1/1A 验证方式：`git ls-files`、`git check-ignore -v`、tracked 敏感模式脱敏扫描、`docker version`、`docker info`、`docker compose version`、`docker ps --filter 'name=new-api'`、`docker compose build/up`、`docker exec pg_restore`、容器内 `psql` 行数查询、本地 curl smoke、secret JSON 登录脚本。
- Phase 1/1A 残留风险：HTTP smoke 的非提升 curl 受当前 sandbox 网络限制失败，提升后成功；生产/staging 证据仍未覆盖，不能把本地 smoke 冒充正式验收。
- Phase 1/1A 下一步：如继续做浏览器/前端 smoke，仍需避免输出真实账号密码和 cookie；本地 smoke 不能替代 staging/生产验收。
- Phase 2 完成内容：复核 schema impact 脚本存在，先从恢复后的 compose PostgreSQL 导出 sidecar 接入前 baseline，再将 `AffiliateSidecarModels()` 接入全局 AutoMigrate，重建镜像并触发 PostgreSQL 迁移，最后导出 after schema 和 diff。
- Phase 2 验证方式：读取 `ops/schema-impact/*`、`model/affiliate.go`、`model/main.go`；`pg_dump --schema-only` 导出 `runtime/schema-impact/20260602T150911Z-compose-official-baseline.sql` 与 `runtime/schema-impact/20260602T152044Z-affiliate-sidecar-after.sql`，两者 sha256 校验通过且 runtime 被 Git 忽略；`ops/schema-impact/diff-schema.sh` 生成 diff；反向检查未发现非 `affiliate_*` 的新增 `CREATE` / `ALTER`。
- Phase 2 残留风险：schema diff 已覆盖本次 sidecar AutoMigrate；后续新增 GORM model 或修改 sidecar 索引时仍必须重复 before/after diff。
- Phase 2 下一步：如果继续后端推进，进入 Phase 5 注册/OAuth/微信邀请归因 thin hook；如果继续 Phase 4 前端，接入 `/api/affiliate/status` 友好提示。
- Phase 3/4 完成内容：复核 affiliate sidecar 模型、profile/relation/invite/audit service、status/admin controller、管理员权限和分销商 middleware 骨架；补充二级分销商必须绑定 active 一级 parent 的 service 校验。
- Phase 3/4 验证方式：affiliate 定向 Go 测试通过；二级 parent 校验先观察到 RED，再实现 service 最小校验并通过；大范围 `go test ./model ./service ./controller ./middleware` 中 controller 包仍因既有非 affiliate `controller/model_list_test.go` 基线问题失败，继续按 Phase 12 待办处理。
- Phase 3/4 残留风险：普通用户友好状态已覆盖后端 `/api/affiliate/status`、classic `/console/affiliate` 和 default `/affiliate`，但 default 尚未做真实账号截图回归；Phase 3 sidecar 表已进入本地 PostgreSQL schema impact，但尚未覆盖 staging/生产。
- Phase 3/4 下一步：继续补 default 真实账号 browser smoke，或推进 Phase 5/Phase 9 后续缺口。

### 当前剩余 gate 审计（2026-06-03 本线程）

- 当前状态：`feature/native-affiliate-minimal` 工作树干净；Phase 1-4 本地可落地项、quota source sidecar/写入 hook、任务钱包 source segment、classic/default 本地 smoke、RMB 核对、KPI/佣金/人头费/结算和用户管理主链路均已有本地提交与复盘记录。
- 剩余未打勾项：服务器 SSH/compose/PostgreSQL 容器信息和服务器内 `pg_dump` 需要用户/运维提供入口；手机号注册归因只在业务决定启用手机号/SMS 注册入口时才落地；短信宝真实通道 smoke、完整结算周期双跑、灰度启用和外接控制台只读归档均属于外部验收，执行步骤见 external acceptance runbook。
- 本地约束：后续如无新增 GORM model 或 sidecar 字段，不需要重复 Docker schema impact；如需要 Docker，仍必须单条 `timeout` 且不并发。不得读取输出 `.codex-local/sources.yml`，不得提交 `.codex-local/`、`runtime/`、dump、账号、密码、DSN 或截图。
- 下一步：拿到外部信息后按 runbook 执行对应验收；如业务决定启用手机号注册，再先补手机号注册归因 TDD，再执行真实短信通道 smoke。

### Phase 3 quota source sidecar 复盘（2026-06-03 本线程）

- 完成内容：新增 `model.QuotaSourceSidecarModels()`，包含 `user_quota_source_balances` 和 `user_quota_source_events`；接入 `migrateDB` / `migrateDBFast` AutoMigrate。佣金、KPI snapshot、人头费 paid stats 统一通过 quota attribution 解析：日志 `Other` 中显式 `quota_source` / `affiliate_quota_source` / `billing_source` 仍优先，缺失时按 `source_log_id` / `related_type=log` / `request_id` 查 quota source sidecar；同一日志混合 paid/gift/trial 时只按 paid 部分计佣，未标记且无 sidecar 的日志仍不默认 paid。
- 验证方式：先观察 `go test -count=1 ./model -run 'QuotaSourceSidecar|AffiliateSidecarModels|MigrateDBCreatesAffiliateSidecar'` 与 `go test -count=1 ./service -run 'QuotaSourceSidecar'` RED；实现后目标测试通过。补充 `go test -count=1 ./service -run 'QuotaSourceSidecar|AffiliatePendingCommission|CommissionEvents|Commission|AffiliateKPI|KPISnapshot|AffiliateHeadFee|HeadFee'` 通过。Docker schema impact 使用 `timeout 600s docker compose -f docker-compose.dev.yml up -d --build new-api` 触发迁移，`20260603T003059Z-quota-source.diff` 只新增 `user_quota_source_*` 表、序列、主键和索引，runtime 文件被 `.gitignore` 忽略。
- 残留风险：本批完成 sidecar schema 和计算读取逻辑，但真实支付成功、钱包扣费和退款 thin hook 是否持续写入 `user_quota_source_events` 仍需 staging/生产链路验证；历史未标记日志不会被默认视为 paid，双跑差异仍可能来自来源缺失。

### Phase 3 quota source 写入 hook 复盘（2026-06-03 本线程）

- 完成内容：新增 source-aware quota ledger helper：paid/gift/trial/legacy_unknown 来源余额与 credit/debit/refund 事件和 `users.quota` 同事务更新；钱包扣费按 legacy_unknown -> trial -> gift -> paid 顺序消耗，退款按原消费 segment 回补，保证 mixed source 时只把 paid 部分交给分销计算。Stripe、epay、Creem、Waffo、Waffo Pancake 和管理员补单成功路径写入 paid 来源账本；relay `WalletFunding` preconsume/settle/refund 写入 request_id 关联的 source debit/refund，并把钱包来源拆分写入日志 `Other`。
- 验证方式：按 TDD 先观察 `go test -count=1 ./model -run 'QuotaSourceLedger|IncreaseUserQuotaWithSource|ManualCompleteTopUpCreditsPaidSourceLedger'` 和 `go test -count=1 ./service -run 'WalletFunding.*Source|NewBillingSessionWalletFunding'` RED（缺少 helper 和 wallet source segment 字段）；实现后两组测试通过。补充 `go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin|Inviter|QuotaSource|TopUp|Waffo|PaymentMethod|Billing|WalletFunding'`、`go test -count=1 ./model`、`go test -count=1 ./service` 和 `git diff --check` 均通过。
- 残留风险：本批只完成本地真实代码路径的 thin hook 和单元/集成测试，尚未在 staging/生产执行真实支付网关回调、真实 relay 调用和失败退款 smoke；历史未标记日志仍不会默认视为 paid。
- 下一步：外部验收时按 runbook 采集真实充值、relay 消耗、退款和周期结算的脱敏证据。
- 下一步：在完整结算周期双跑中重点核对真实 paid/gift/trial sidecar 事件覆盖率、退款归属和外接控制台口径差异。

### Phase 3 task billing quota source segment 复盘（2026-06-03 本线程）

- 完成内容：异步任务创建时把 relay wallet paid/gift/trial/legacy_unknown source breakdown 保存到 `tasks.private_data`；任务轮询阶段的 wallet 差额补扣改为 `DecreaseUserQuotaWithSource`，失败退款/差额退款按原消费 segment 回补；任务 billing 日志写入 `request_id=task_id`，日志 `Other` 记录本次 wallet 来源拆分，使佣金/KPI/人头费可通过 quota source sidecar request_id 归因任务扣费。
- 验证方式：按 TDD 先观察 `go test -count=1 ./service -run 'TaskQuota_WalletRestoresSourceSegments|PositiveDelta_WalletWritesQuotaSourceSidecar'` RED（`TaskPrivateData` 缺少 wallet source segment 字段），实现后同命令通过；补充 `go test -count=1 ./service -run 'TaskQuota|Recalculate|Settle_|WalletFunding|QuotaSource'` 和 `go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin|Inviter|QuotaSource|TopUp|Waffo|PaymentMethod|Billing|WalletFunding|TaskQuota|Recalculate'` 通过。
- 残留风险：本批仍是本地单元/集成覆盖，未用真实异步任务 provider 在 staging/生产验证任务创建、轮询成功/失败、退款和 sidecar/log request_id 对齐；历史任务没有 private_data source segment 时会按 legacy_unknown 回补，不能反推 paid。
- 下一步：完整结算周期双跑时纳入异步任务样本，检查 task_id request_id 的 source event 覆盖率和 paid 归因金额。

### Phase 4 default 未开通状态复盘（2026-06-03 本线程）

- 完成内容：default `/affiliate` 未开通状态补齐 classic parity，优先展示后端 `/api/affiliate/status` 返回的 `message`；未知或空 message 时仍回退到前端 reason 文案；summary/logs 查询继续只在 `available=true` 时启用，避免普通用户误触 scoped API。
- 验证方式：先观察 `bun --bun test src/features/affiliate/lib.test.ts` RED，确认 `not_opened` 时后端中文 message 被前端通用文案覆盖；实现后同命令 6 项通过。
- 残留风险：本批为 helper 与页面数据流修正，未新增浏览器截图回归；default 真实账号多角色 browser smoke 仍归入 Phase 8/12。
- 下一步：继续补 default 真实账号 browser smoke，或推进 Phase 9 导出 RMB 主字段和 raw quota 附加字段。

## Phase 5：邀请归因与初始额度

- [x] 梳理官方密码注册、OAuth、微信、手机号注册入口：密码注册读取请求体 `AffCode`；标准 OAuth 从 session `aff` 读取；微信首次注册当前未接邀请码；当前官方基线未发现手机号/SMS 注册入口。
- [x] 设计统一 `ResolveInviteContext` / `RecordAffiliateInviteEvent` service。
- [x] 密码注册薄 hook 接入邀请归因。
- [x] OAuth 首次注册薄 hook 接入邀请归因。
- [x] 微信首次注册薄 hook 接入邀请归因。
- [ ] 手机号注册如移植旧 fork，则接入相同归因链路。
- [x] `affiliate_invite_events` 记录普通邀请码和 active 分销商邀请码的不同初始额度规则标识：`normal_invite` / `affiliate_invite`。
- [x] 管理员可配置普通邀请码和 active 分销商邀请码不同初始额度，并应用到实际注册赠送额度；`AffiliateQuotaForInvitee=-1` 表示继承普通邀请码额度，`0` 表示不给分销邀请码注册奖励，正数表示专用分销邀请码注册奖励额度。
- [x] 分销模块关闭时 active 分销码降级普通邀请码规则。
- [x] `affiliate_invite_events` service 支持记录注册方式、provider、初始额度规则和金额，并已接入密码注册、OAuth 首次注册、微信首次注册 hook。
- [x] 补充注册/OAuth/微信归因测试；密码注册有 controller 集成覆盖，OAuth/微信覆盖统一 helper 与 method/provider 事件元数据。
- [ ] 手机号归因测试待 Phase 5A/手机号注册入口落地后补充。

### Phase 5 阶段复盘（2026-06-02 本线程）

- 完成内容：新增 controller 层统一归因 helper；密码注册、标准 OAuth 首次注册、微信首次注册创建用户时解析邀请上下文，复用 legacy inviter 奖励链路，同时写入 `affiliate_invite_events`；active 分销码在模块开启时创建 `affiliate_relations`，模块关闭时降级为普通邀请码且不进入分销关系。
- 验证方式：先观察 `go test ./controller -run 'TestRecordAffiliateRegistrationAttribution'` RED，随后实现 helper 和 hook；`go test ./controller -run 'TestRecordAffiliateRegistrationAttribution|TestPasswordRegisterRecordsAffiliateAttribution'` 通过；`go test ./model ./service ./middleware ./controller -run 'Affiliate|AdminSetAffiliateProfile|AdminUpdateAffiliateProfileStatus|AffiliateAdminRoutes|GetAffiliateStatus|RecordAffiliateRegistrationAttribution|PasswordRegisterRecordsAffiliateAttribution'` 通过。
- 第二批完成内容：新增 `AffiliateQuotaForInvitee` 后端配置、通用 settings API 接入、classic/default 管理员额度设置字段；密码注册、OAuth 首次注册、微信首次注册按 invite source 选择实际 invitee quota，并同步写入 `affiliate_invite_events.InitialQuota`。
- 第二批验证方式：先观察 `go test ./controller -run 'TestPasswordRegisterAppliesAffiliateInviteeQuota|TestPasswordRegisterKeepsNormalInviteeQuotaForNonAffiliateCode'` RED，随后实现配置和实际额度应用；`go test ./model ./controller -run 'TestAffiliateQuotaForInviteeOptionMap|TestPasswordRegisterAppliesAffiliateInviteeQuota|TestPasswordRegisterKeepsNormalInviteeQuotaForNonAffiliateCode|TestPasswordRegisterRecordsAffiliateAttribution|TestRecordAffiliateRegistrationAttribution'` 通过；`go test ./model ./service ./middleware ./controller -run 'Affiliate|AdminSetAffiliateProfile|AdminUpdateAffiliateProfileStatus|AffiliateAdminRoutes|GetAffiliateStatus|RecordAffiliateRegistrationAttribution|PasswordRegisterRecordsAffiliateAttribution|PasswordRegisterAppliesAffiliateInviteeQuota|PasswordRegisterKeepsNormalInviteeQuotaForNonAffiliateCode'` 通过。
- 残留风险：`go test ./controller` 全包仍会在既有 `TestListModelsTokenLimitIncludesTieredBillingModel` 中因 Redis 未初始化 panic，单独复现同样失败，已归入 Phase 12 基线修复；本批未实现手机号/SMS 注册入口。前端验证未完成：`web/default` 本地缺少 `tsc`，`web/classic` `bunx prettier` 因受限网络无法下载 prettier manifest。
- 下一步：进入 Phase 5A 只读审查旧 fork 手机号/SMS 实现，或先修复 Phase 12 controller 测试隔离基线。

## Phase 5A：手机号/SMS 与短信宝 provider

- [x] 只读审查旧 `projects/new-api-liu23zhi` 中手机号/SMS 登录注册实现；审查记录见 `docs/affiliate/native-affiliate-sms-reference-audit.zh-CN.md`。
- [x] 确认官方最新基线是否已有手机号能力，避免重复移植；当前仓库未发现 `common/sms.go`、`model.User.Phone`、`PhoneLogin`、`SendSMSVerification`、`/api/sms/verification`、`/api/user/login/phone` 等手机号/SMS 登录注册能力。
- [x] 设计并实现 SMS provider 抽象，短信宝只是一个 provider，不把参数写死进业务代码；手机号绑定使用 sidecar，不直接迁移旧 fork 的 `users.phone`。
- [x] 新增短信配置项：provider、启用状态、账号、密钥模式、endpoint、专用通道产品 ID；`SMSBaoCredential` 不在 `InitOptionMap` 中回显既有值。
- [x] 支持短信签名后台配置，并标记备案/审核状态；当前发送内容渲染要求签名状态为 `approved`。
- [x] 支持按场景配置模板：注册、登录、绑定手机号、换绑、重置密码。
- [x] 支持模板变量：验证码、有效期、产品名、站点名。
- [x] 支持测试发送，不在响应或日志中暴露完整验证码、手机号、ApiKey 或密码；后端 root 接口为 `POST /api/option/sms/test`。
- [x] 支持短信宝余额查询或状态检查入口；后端 root 接口为 `GET /api/option/sms/status`。
- [x] 支持手机号、IP、账号、场景维度限流；后端配置项包括 `SMSRateLimitEnabled`、窗口秒数和 phone/IP/account/scene 计数阈值。
- [ ] 手机号注册如启用，必须接入 Phase 5 的统一邀请归因和初始额度规则。
- [x] classic 管理员端提供短信 provider、签名、模板、限流、状态查询和测试发送配置页面。
- [x] default 管理员端短信配置页面 parity（按 default 系统设置风格实现，不复制 Semi Design）。
- [x] 增加短信宝 provider 发送成功和错误码映射单元测试。
- [x] 增加 SMS 模板缺失、签名未备案/未审核通过场景测试。
- [x] 增加 SMS 限流完整发送链路场景测试。
- [x] 增加签名未备案完整发送链路场景测试。
- [x] 新增 `user_phone_bindings` sidecar 表设计和本地 AutoMigrate schema 验证，不直接修改官方 `users` 表。
- [x] 如 Docker 稳定，集中用本地 PostgreSQL dump 复核 `user_phone_bindings` schema impact。
- [x] 新增 `sms_send_logs` sidecar 表设计和本地 AutoMigrate schema 验证，日志只记录脱敏手机号、场景、provider、模板版本、返回码和耗时。
- [x] 如 Docker 稳定，集中用本地 PostgreSQL dump 复核 `sms_send_logs` schema impact。

### Phase 5A 审查复盘（2026-06-02 本线程）

- 完成内容：确认当前官方基线没有手机号/SMS 登录注册能力；只读审查旧 fork 的 SMSBao、手机号登录、注册校验、换绑、Turnstile、路由、配置和测试；新增 `native-affiliate-sms-reference-audit.zh-CN.md` 记录可参考点和不可直接迁移点。
- 验证方式：使用 `rg --files` 和关键词搜索当前仓库与旧 fork；读取旧 fork 的 `common/sms.go`、`controller/misc.go`、`controller/user.go`、`model/user.go`、`router/api-router.go`、`middleware/turnstile-check.go`、SMS/phone 相关测试和旧设计文档。
- 残留风险：本批只完成审查和设计边界，未实现 SMS provider、配置、sidecar 表、限流和手机号注册入口；旧 fork 的直接 `users.phone` 方案不符合当前最小侵入原则，后续必须走 sidecar + schema impact。
- 下一步：按 TDD 实现 SMS provider 抽象和短信宝 provider 单元测试，再做配置项和 sidecar schema impact。

### Phase 5A Provider/config 复盘（2026-06-03 本线程）

- 完成内容：新增 `common/sms.go`，实现 `SMSProvider` 抽象、`SMSBaoProvider`、手机号规范化、短信宝请求构造、返回码映射和 `NewSMSProvider`；新增 SMS 配置变量和 `OptionMap` 接入，覆盖 `SMSEnabled`、`SMSProvider`、`SMSBaoEndpoint`、`SMSBaoUsername`、`SMSBaoCredential`、`SMSBaoCredentialMode`、`SMSBaoProductID`、验证码有效期和冷却时间。
- 验证方式：先观察 `go test ./common ./model -run 'SMS|SMSBao|NormalizePhone'` RED；实现后同命令通过。测试使用自定义 `http.RoundTripper`，不监听本地端口、不访问真实短信宝。
- 残留风险：尚未实现短信签名/模板配置、测试发送 API、短信发送日志、限流、SMS Turnstile、手机号绑定 sidecar、手机号注册/登录入口和注册归因接入；当前 provider 只完成后端基础发送抽象和配置同步。
- 下一步：按 TDD 实现短信签名/模板配置，或先设计 `sms_send_logs` / `user_phone_bindings` sidecar 并跑 schema impact。

### Phase 5A SMS template 复盘（2026-06-03 本线程）

- 完成内容：新增短信签名、签名审核状态、产品名、注册/登录/绑定/换绑/重置密码场景模板配置；新增 `RenderSMSVerificationContent`，支持 `{code}`、`{minutes}`、`{product}`、`{site}` 变量，并在签名未 approved 或模板缺失时拒绝渲染。
- 验证方式：先观察 `go test ./common ./model -run 'SMS|SMSSignature|SMSTemplate|RenderSMS'` RED；实现后同命令通过。覆盖签名 approved 渲染、pending 签名拒绝、模板缺失拒绝、全局配置渲染、OptionMap 初始化和更新。
- 残留风险：尚未实现测试发送 API、短信发送日志、限流、SMS Turnstile、手机号绑定 sidecar、手机号注册/登录入口和注册归因接入；签名审核状态目前是配置标记和渲染门禁，未接入外部备案校验流程。
- 下一步：实现测试发送 API 且响应/日志不暴露验证码和完整手机号，或先设计 `sms_send_logs` / `user_phone_bindings` sidecar 并跑 schema impact。

### Phase 5A SMS test send 复盘（2026-06-03 本线程）

- 完成内容：新增后端测试发送接口 `POST /api/option/sms/test`，继承 `/api/option` 的 `RootAuth`；接口渲染当前场景模板并调用 SMS provider，但响应只返回脱敏手机号、provider、provider code 和场景，不返回完整手机号、验证码、凭据或短信正文。
- 验证方式：先观察 `go test ./controller -run 'TestAdminTestSMS'` RED；实现 `common.SMSProviderFactory` 注入点、`common.MaskPhone`、`controller.AdminTestSMS` 和路由后，同命令通过；补充 `go test ./common -run TestSMSBaoProviderDoesNotExposeCredentialOnTransportError` RED/GREEN，确认网络错误不会回显带 query 的 provider URL；`go test -count=1 ./common ./model ./controller -run 'SMS|SMSBao|SMSSignature|SMSTemplate|RenderSMS|AdminTestSMS|NormalizePhone'` 通过；`go test -count=1 ./common ./model ./controller` 中 `common`、`model` 通过，`controller` 仍受既有 `TestListModelsTokenLimitIncludesTieredBillingModel` / `sql: database is closed` baseline 影响。
- 残留风险：尚未实现管理员前端测试发送按钮、短信发送日志、限流、SMS Turnstile、手机号绑定 sidecar、手机号注册/登录入口和注册归因接入；当前测试发送失败未落库审计；controller 全量包测试存在既有非 SMS baseline 失败。
- 下一步：实现 `sms_send_logs` sidecar 和脱敏发送日志，或补 SMS 限流/SMS Turnstile。

### Phase 5A SMS status 复盘（2026-06-03 本线程）

- 完成内容：基于短信宝官方余额查询协议新增 `SMSProviderStatusChecker`、`SMSBaoProvider.CheckStatus`、`SMSBaoQueryEndpoint` 配置和后端 root 状态入口 `GET /api/option/sms/status`；响应只返回 provider、provider code、发送条数和剩余条数，不返回用户名、credential、endpoint 或请求 URL。
- 验证方式：先观察 `go test ./common ./model ./controller -run 'SMSBaoProviderQueriesBalance|SMSBaoProviderDoesNotExposeCredentialOnBalance|SMSBaoProviderRejectsMalformedBalance|SMSOptionMapInitializesProvider|UpdateOptionMapUpdatesSMSProvider|AdminGetSMSStatus'` RED；实现后 `go test -count=1 ./common ./model ./controller -run 'SMSBaoProviderQueriesBalance|SMSBaoProviderDoesNotExposeCredentialOnBalance|SMSBaoProviderRejectsMalformedBalance|SMSOptionMapInitializesProvider|UpdateOptionMapUpdatesSMSProvider|AdminGetSMSStatus'` 通过。
- 残留风险：状态查询未做 1 次/分钟缓存或限流，管理员前端入口未接入，provider 状态查询结果未写入审计日志；controller 全量包测试仍存在既有非 SMS baseline 失败。
- 下一步：实现 `sms_send_logs` sidecar 和脱敏发送日志，或补 SMS 限流/SMS Turnstile。

### Phase 5A SMS send logs 复盘（2026-06-03 本线程）

- 完成内容：新增 `sms_send_logs` sidecar model 和 `SMSSidecarModels()`，接入主库 AutoMigrate；新增 `service.RecordSMSSendLog`，测试发送接口完成 provider 调用后 best-effort 写入日志；日志仅保存脱敏手机号、场景、provider、模板 hash 版本、provider code 和耗时，不保存完整手机号、验证码、credential、endpoint 或短信正文。
- 验证方式：先观察 `go test ./model ./service ./controller -run 'SMSSidecar|RecordSMSSendLog|AdminTestSMSRecordsRedactedSendLog'` RED；实现后 `go test -count=1 ./model ./service ./controller -run 'SMSSidecar|RecordSMSSendLog|AdminTestSMSRecordsRedactedSendLog'` 通过；`go test -count=1 ./common ./model ./service ./controller -run 'SMS|SMSBao|SMSSignature|SMSTemplate|RenderSMS|AdminTestSMS|AdminGetSMSStatus|NormalizePhone|SMSSidecar|RecordSMSSendLog'` 通过；`git diff --check` 通过。
- 残留风险：本批未再执行 Docker/PostgreSQL dump schema diff，已新增单独待办；日志当前只接入管理员测试发送，真实验证码发送入口、限流、SMS Turnstile、手机号绑定/注册/登录尚未实现；controller 全量包测试仍存在既有非 SMS baseline 失败。
- 下一步：实现手机号、IP、账号、场景维度限流，或设计 `user_phone_bindings` sidecar。

### Phase 5A SMS rate limit 复盘（2026-06-03 本线程）

- 完成内容：新增 SMS 多维限流配置和 `service.CheckSMSRateLimit`；按 scene 分桶检查手机号、IP、账号和场景总量，命中任一维度会在 provider 调用前拒绝；测试发送入口已接入限流。计数阈值小于等于 0 时对应维度关闭，`SMSRateLimitEnabled=false` 时整体关闭。
- 验证方式：先观察 `go test ./service ./model ./controller -run 'SMSRateLimit|CheckSMSRateLimit|AdminTestSMSAppliesRateLimit'` RED；实现后 `go test -count=1 ./service ./model ./controller -run 'SMSRateLimit|CheckSMSRateLimit|AdminTestSMSAppliesRateLimit'` 通过；`go test -count=1 ./common ./model ./service ./controller -run 'SMS|SMSBao|SMSSignature|SMSTemplate|RenderSMS|AdminTestSMS|AdminGetSMSStatus|NormalizePhone|SMSSidecar|RecordSMSSendLog|CheckSMSRateLimit'` 通过；`git diff --check` 通过。
- 残留风险：当前限流为进程内内存实现，未接 Redis/多实例共享；管理员前端限流配置入口未实现；真实手机号注册/登录验证码发送入口尚未实现。
- 下一步：设计 `user_phone_bindings` sidecar，或实现手机号注册入口并接入 Phase 5 邀请归因。

### Phase 5A User phone bindings 复盘（2026-06-03 本线程）

- 完成内容：新增 `user_phone_bindings` sidecar model 并纳入 `SMSSidecarModels()` 和主库 AutoMigrate；新增 `service.BindUserPhone`，绑定时只保存规范化手机号 hash、脱敏手机号、状态、provider、验证/绑定/解绑时间，不写 `users.phone`，不保存完整手机号。同一用户新绑定会把旧 active 绑定置为 `replaced`，同一手机号 active 绑定到其他用户时拒绝。
- 验证方式：先观察 `go test ./model ./service -run 'UserPhoneBinding|BindUserPhone'` RED；实现后 `go test -count=1 ./model ./service -run 'UserPhoneBinding|BindUserPhone'` 通过；`go test -count=1 ./common ./model ./service ./controller -run 'SMS|PhoneBinding|UserPhoneBinding|BindUserPhone|SMSBao|SMSSignature|SMSTemplate|RenderSMS|AdminTestSMS|AdminGetSMSStatus|NormalizePhone|SMSSidecar|RecordSMSSendLog|CheckSMSRateLimit'` 通过；`git diff --check` 通过；关键词扫描确认未新增 `users.phone`。
- 残留风险：本批未执行 Docker/PostgreSQL dump schema diff，已新增单独待办；手机号绑定尚未接入真实验证码校验、注册/登录入口、换绑入口、SMS Turnstile 或邀请归因。
- 下一步：实现手机号注册入口并接入 Phase 5 邀请归因，或进入 Phase 6 分销 scope 与 scoped 使用日志。

### Phase 5A SMS unapproved signature chain 复盘（2026-06-03 本线程）

- 完成内容：新增 `TestAdminTestSMSRejectsUnapprovedSignatureBeforeProvider`，覆盖管理员测试发送在签名状态为 `pending` 时的完整后端链路；请求会在模板渲染阶段被拒绝，不调用 SMS provider，也不写入 `sms_send_logs`。
- 验证方式：`go test -count=1 ./controller -run TestAdminTestSMSRejectsUnapprovedSignatureBeforeProvider` 通过；`go test -count=1 ./common ./model ./service ./controller -run 'SMS|PhoneBinding|UserPhoneBinding|BindUserPhone|SMSBao|SMSSignature|SMSTemplate|RenderSMS|AdminTestSMS|AdminGetSMSStatus|NormalizePhone|SMSSidecar|RecordSMSSendLog|CheckSMSRateLimit'` 通过。本批测试直接通过，说明现有生产代码已具备该门禁；本批只补链路覆盖，没有修改生产代码。
- 残留风险：真实手机号注册/登录入口、SMS Turnstile 仍未完成；controller 全量包测试仍存在既有非 SMS baseline 失败。
- 下一步：实现手机号注册入口并接入 Phase 5 邀请归因，或进入 Phase 6 分销 scope 与 scoped 使用日志。

### Phase 5A classic SMS settings 复盘（2026-06-03 本线程）

- 完成内容：新增 classic 运营设置中的 `SettingsSMS` 卡片，支持启用状态、provider、短信宝发送/查询 endpoint、账号、凭据写入、凭据模式、专用通道产品 ID、签名审核状态、产品名、五类场景模板、验证码有效期/冷却、手机号/IP/账号/场景限流、测试发送和短信宝状态查询；凭据字段留空表示保留原值。后端 `GetOptions` 增加 `Credential` 后缀过滤，避免 `SMSBaoCredential` 从配置读接口回显。
- 验证方式：先观察 `go test -count=1 ./controller -run TestGetOptionsHidesSMSBaoCredential` RED，修复后同命令通过；`go test -count=1 ./common ./model ./service ./controller -run 'SMS|PhoneBinding|UserPhoneBinding|BindUserPhone|SMSBao|SMSSignature|SMSTemplate|RenderSMS|AdminTestSMS|AdminGetSMSStatus|NormalizePhone|SMSSidecar|RecordSMSSendLog|CheckSMSRateLimit|GetOptionsHidesSMSBaoCredential'` 通过；`bun install --frozen-lockfile --registry https://registry.npmjs.org` 补齐前端依赖后，`bun run --cwd classic build` 通过；`git diff --check` 通过。
- 残留风险：真实手机号注册/登录入口、SMS Turnstile 仍未完成；classic 页面只调用已存在后端测试发送/状态接口，未做浏览器级 smoke。
- 下一步：实现手机号注册入口并接入 Phase 5 邀请归因，或进入 Phase 6 分销 scope 与 scoped 使用日志。

### Phase 5A default SMS settings parity 复盘（2026-06-03 本线程）

- 完成内容：新增 default 系统设置 SMS section，按 default/shadcn 风格接入运营设置 registry；支持启用状态、provider、短信宝发送/查询 endpoint、账号、凭据写入、凭据模式、专用通道产品 ID、签名审核状态、产品名、五类场景模板、验证码有效期/冷却、手机号/IP/账号/场景限流、测试发送和短信宝状态查询；凭据字段留空表示保留原值。
- 验证方式：`bun test default/src/features/system-settings/operations/sms-settings.test.ts` 通过，覆盖凭据空值不覆盖和新凭据提交；`bun run --cwd default build` 通过；`bun run --cwd default typecheck` 仍只命中既有 baseline：`hast` 类型缺失和 usage-logs mobile card 泛型字段错误，未指向本次 SMS 文件；`go test -count=1 ./common ./model ./service ./controller -run 'SMS|PhoneBinding|UserPhoneBinding|BindUserPhone|SMSBao|SMSSignature|SMSTemplate|RenderSMS|AdminTestSMS|AdminGetSMSStatus|NormalizePhone|SMSSidecar|RecordSMSSendLog|CheckSMSRateLimit|GetOptionsHidesSMSBaoCredential'` 通过；`git diff --check` 通过。
- 残留风险：真实手机号注册/登录入口、SMS Turnstile 仍未完成；default 页面未做浏览器级 smoke。
- 下一步：实现手机号注册入口并接入 Phase 5 邀请归因，或进入 Phase 6 分销 scope 与 scoped 使用日志。

### Phase 5A SMS sidecar PostgreSQL schema impact 复盘（2026-06-03 本线程）

- 完成内容：使用本地 dev compose PostgreSQL 在 AutoMigrate 前后导出 schema snapshot，复核 `SMSSidecarModels()` 对真实 PostgreSQL schema 的影响；重建并重启 `new-api:dev` 主容器触发迁移后，`sms_send_logs` 与 `user_phone_bindings` 均出现在本地库中。
- 验证方式：`timeout 60s docker ps --filter 'name=new-api'` 确认 `new-api`、`new-api-postgres`、`new-api-redis` 运行；迁移前查询目标表为空；导出 `runtime/schema-impact/20260602T175546Z-sms-sidecar-before.sql` 并通过 sha256 校验；`timeout 600s docker compose -f docker-compose.dev.yml build new-api` 与 `timeout 600s docker compose -f docker-compose.dev.yml up -d --force-recreate new-api` 成功；迁移后查询目标表返回 `sms_send_logs`、`user_phone_bindings`；导出 `runtime/schema-impact/20260602T175809Z-sms-sidecar-after.sql` 并通过 sha256 校验；`ops/schema-impact/diff-schema.sh` 生成 `runtime/schema-impact/20260602T175809Z-sms-sidecar.diff`，结构性新增仅包含两个 SMS sidecar 表、序列、主键和索引，未出现官方核心表 ALTER 或删除 DDL。
- 残留风险：本地 schema impact 不能替代 staging/生产发布前复核；真实手机号注册/登录入口和 SMS Turnstile 仍未实现。
- 下一步：实现手机号注册入口并接入 Phase 5 统一邀请归因，或进入 Phase 6 分销 scope 与 scoped 使用日志。

## Phase 6：分销 scope 与 scoped 使用日志

- [x] 实现一级/二级/二级下线三层 scope。
- [x] 一级分销商可见二级分销商及二级下线。
- [x] 二级分销商只可见自己的下线。
- [x] 普通用户不可查分销 scope。
- [x] 管理员/超级管理员默认全局。
- [x] 实现 scoped 使用日志 API。
- [x] scoped 使用日志隐藏敏感字段。
- [x] 支持按时间、用户、二级分销商、模型、分组、请求状态过滤。
- [x] 复用或抽取 classic 使用日志表格/筛选/分页/移动端卡片。
- [x] 增加越权查询测试。

### Phase 6 scope service 复盘（2026-06-03 本线程）

- 完成内容：新增 `ListAffiliateVisibleUserIds` service，将 `ResolveAffiliateAccessScope` 产出的 scope 转换为可用于后续 scoped API 的用户过滤结果；管理员/超级管理员返回 global unfiltered，普通 none scope 直接拒绝，一级分销商基于 active `affiliate_relations` 可见 depth 1-2 下线，二级分销商只可见 depth 1 下线，disabled 或超深度关系不进入结果。
- 验证方式：先观察 `go test -count=1 ./service -run 'TestListAffiliateVisibleUserIds'` RED（函数未实现编译失败），实现后同命令通过；`go test -count=1 ./model ./service ./middleware ./controller -run 'Affiliate|AdminSetAffiliateProfile|AdminUpdateAffiliateProfileStatus|AffiliateAdminRoutes|GetAffiliateStatus|RecordAffiliateRegistrationAttribution|PasswordRegisterRecordsAffiliateAttribution|PasswordRegisterAppliesAffiliateInviteeQuota|PasswordRegisterKeepsNormalInviteeQuotaForNonAffiliateCode'` 通过；`git diff --check` 通过。
- 残留风险：本批只完成 scope service 基础；scoped 使用日志 API 已由后续批次补齐，但前端表格复用/接入和浏览器验证仍未完成；全量 controller 测试仍存在既有非 affiliate baseline 风险。
- 下一步：复用或抽取 classic 使用日志表格/筛选/分页/移动端卡片，并接入 scoped 使用日志 API。

### Phase 6 scoped usage logs API 复盘（2026-06-03 本线程）

- 完成内容：新增 `GET /api/affiliate/logs`，复用 `PageInfo` 和 `model.Log` 返回结构；路由在 `UserAuth` 后叠加 `AffiliateAuth`，后端使用 `ListAffiliateVisibleUserIds` 限制一级/二级分销 scope。管理员/超级管理员可走 global scope；普通 none scope 无法使用；一级可查二级及二级下线，二级只可查自己的下线。
- 验证方式：先观察 `go test -count=1 ./controller -run 'TestGetAffiliateScopedLogs'` RED（`GetAffiliateScopedLogs` 未实现编译失败），实现后同命令通过；`go test -count=1 ./model ./service ./middleware ./controller -run 'Affiliate|GetAffiliateScopedLogs|ListAffiliateScopedLogs|AdminSetAffiliateProfile|AdminUpdateAffiliateProfileStatus|AffiliateAdminRoutes|GetAffiliateStatus|RecordAffiliateRegistrationAttribution|PasswordRegisterRecordsAffiliateAttribution|PasswordRegisterAppliesAffiliateInviteeQuota|PasswordRegisterKeepsNormalInviteeQuotaForNonAffiliateCode'` 通过；`go test -count=1 ./router` 通过；`git diff --check` 通过。
- 安全与过滤：scoped 日志响应清空 `channel` / `channel_name` / `token_id` / `token_name` / `ip` / `request_id` / `upstream_request_id`，并移除 `other.admin_info` 与 `other.stream_status`；测试覆盖 scope 外用户过滤拒绝、二级分销商过滤、`request_status`、起止时间、模型和分组过滤。
- 残留风险：本批未接 classic/default 前端；未复用 usage logs 表格筛选分页组件；全量 controller 测试仍存在既有非 affiliate baseline 风险。
- 下一步：复用或抽取 classic 使用日志表格/筛选/分页/移动端卡片，接入 `/api/affiliate/logs`。

### Phase 6 classic scoped logs 前端复盘（2026-06-03 本线程）

- 完成内容：新增 classic `/console/affiliate` 分销中心页面，先调用 `/api/affiliate/status` 展示未开通/模块关闭的中文友好提示；可用时复用 classic 使用日志表格、筛选、分页、列设置和紧凑/移动端表格能力，并以 `affiliate` 模式接入 `/api/affiliate/logs`。普通日志仍使用原 `/api/log` / `/api/log/self`，分销模式隐藏 token/channel/request_id 等不适用筛选和 token/IP 空列，保留时间、模型、分组、用户 ID、二级分销商用户 ID、请求状态和日志类型筛选。侧边栏新增“分销中心”入口，并同步默认模块配置、用户/管理员侧边栏设置和新用户默认 sidebar 配置。
- 验证方式：先观察 `bun test web/classic/src/hooks/usage-logs/usageLogsUrls.test.mjs` RED（URL builder 缺失），实现后同命令 3 项通过；`go test -count=1 ./model ./controller -run 'Sidebar|Affiliate'` 通过；提升权限启动 `make dev-web` 后 classic/default dev server 分别监听 5174/5173，热更新输出无编译错误；`cd web/classic && bun run build` 通过。
- 2026-06-03 追加验证：网络切换后确认 3000/5173/5174 均 HTTP 200；发现旧 `new-api:dev` 容器未包含 `/api/affiliate/logs`，按 Docker 规则用 `timeout 600s docker compose -f docker-compose.dev.yml up -d --build new-api` 重建主容器后，`/api/affiliate/logs` 从 404 恢复为已挂载路由；随后用本地测试账号文件完成 API smoke，不输出用户名、密码、cookie 或 token。
- 残留风险：classic 真实账号 browser smoke 已覆盖管理员/一级/二级和移动端，但普通用户、profile disabled、模块关闭和 default parity 尚未覆盖；当前 classic 页面主要完成 scoped 使用日志和友好状态提示，统计看板、RMB 主显示、KPI/佣金/人头费/结算仍待后续 Phase 7/9/10。
- 下一步：补普通用户/profile disabled/模块关闭截图回归，再推进分销统计看板、RMB 单位和 default parity。

## Phase 7：classic 分销前端

- [x] 使用 Playwright/Chromium 复现一级分销商“数据看板页面渲染出错”；2026-06-03 在当前 `/console/affiliate` scoped logs 页面未再复现整页渲染错误，一级分销商桌面和移动端 browser smoke 均通过。
- [x] 修复 classic 分销页整页渲染错误（新增 `/console/affiliate` 状态门禁和 scoped logs 页面，classic build 已通过；真实浏览器 smoke 已覆盖管理员/一级/二级/移动端）。
- [x] 增加组件级错误边界和分区加载状态；2026-06-03 classic `/console/affiliate` 已为 scoped logs 分区增加局部错误边界和重试，不再依赖整页 ErrorBoundary 承接明细表渲染异常。
- [x] 重构分销首页为统计分析看板（classic MVP 已接 `/api/affiliate/summary`，看板位于 scoped 使用日志上方）。
- [x] 看板包含团队人数、有效新用户、净付费消耗、预估佣金、人头费、待结算金额、KPI 档位（佣金/人头费/待结算/KPI 在规则落地前以安全占位展示）。
- [x] 金额/额度主显示 RMB（classic 看板金额卡片主显示 RMB，并保留原始 quota 作为说明；scoped logs 表格的统一 RMB 化继续归入 Phase 9）。
- [x] 消耗明细复用 scoped 使用日志。
- [x] 普通用户、profile 未启用、模块关闭、权限不足显示中文友好提示（classic 已接 `/api/affiliate/status`；default 待 parity）。
- [x] 管理员无 profile 时仍可进入管理员分销管理（classic 新增 `/console/affiliate/admin`，使用 `AdminRoute`，不依赖分销 profile）。
- [x] 管理员端支持指定一级/二级分销商（classic 管理页接 `/api/affiliate/admin/profiles`，二级需填写 active 一级上级用户 ID）。
- [x] 管理员端支持编辑用户 `inviter_id` 或跳转用户管理（本批按最小侵入先提供“跳转用户管理”，直接编辑 `inviter_id` 继续放在 Phase 11）。
- [x] 截图回归：普通用户、一级、二级、管理员、超级管理员、模块关闭、移动端；2026-06-03 已用 classic `/console/affiliate` Playwright smoke 覆盖 7 个截图场景。
- [x] 2026-06-03 classic browser smoke：用本地恢复库和三类测试账号验证 `super_admin`、一级分销、二级分销桌面，以及一级分销移动端均能访问 `/console/affiliate`；`/api/affiliate/status` 与 `/api/affiliate/logs` 均 HTTP 200 / `success=true`。

### Phase 7 classic browser smoke 复盘（2026-06-03 本线程）

- 完成内容：网络切换后确认 5173/5174 dev server 已运行；重建 `new-api:dev` 主容器使 `/api/affiliate/logs` 路由进入运行态；通过管理员 API 在本地恢复库启用 `AffiliateEnabled` 并恢复测试账号 active profile；清理本地 dev Redis 的登录限流 `CT` 键后完成 classic 分销页真实浏览器 smoke。
- 验证方式：`timeout 10s curl` 验证 3000/5173/5174；API smoke 覆盖 `super_admin` global scope、一级/二级 affiliate scope 和 logs success；`runtime/smoke/node_modules/.bin/playwright test --config=runtime/smoke/playwright.config.cjs` 4/4 通过，覆盖桌面管理员、桌面一级、桌面二级和一级移动端。临时脚本、runner、截图均位于 Git 忽略的 `runtime/smoke/`。
- 残留风险：本轮 browser smoke 为本地恢复库验证，且为跑 smoke 修改了本地库中的 `AffiliateEnabled` 和测试账号 profile；普通用户、profile disabled、模块关闭、完整管理员管理页和 default 分销前端仍未做 browser 回归。
- 下一步：补普通用户/profile disabled/模块关闭截图回归；随后做 default parity，或继续 Phase 7 统计看板/RMB 主显示。

### Phase 7 classic 截图回归补齐复盘（2026-06-03 本线程）

- 完成内容：补齐 classic `/console/affiliate` 截图回归缺口，覆盖 `super_admin`、一级分销、二级分销、一级移动端、普通用户未开通、二级 profile disabled、模块关闭 7 个场景；同时修复管理员场景 summary 加载失败时看板 helper 读取 null 导致整页 ErrorBoundary 的问题。
- 验证方式：按 TDD 先观察 `bun test web/classic/src/pages/Affiliate/affiliateDashboardCards.test.mjs` 中 null summary 用例 RED，再以最小变更转 GREEN；随后 `runtime/smoke/node_modules/.bin/playwright test --config=runtime/smoke/playwright.config.cjs` 7/7 通过，截图保存在 Git 忽略的 `runtime/smoke/screenshots/`；运行态收尾确认 `AffiliateEnabled=true`、临时普通用户数量为 0、二级 profile 为 active，并精确清理本地 Redis `CT` 登录限流 key。
- 残留风险：本批补齐 classic 分销页截图回归，不覆盖 default `/affiliate` 全量多角色截图；default 真实账号 browser smoke 仍按 Phase 8/12 后续项推进。Playwright runner 和截图仍位于 Git 忽略的 `runtime/smoke/`，不提交。
- 下一步：继续 default 分销页多角色 browser smoke，或推进 SMS 真实通道 smoke、结算周期双跑和灰度流程。

### Phase 7 classic 分区错误边界复盘（2026-06-03 本线程）

- 完成内容：`/console/affiliate` 状态加载卡片增加明确中文 loading 文案；scoped logs 明细区增加局部 `AffiliateSectionErrorBoundary`，明细表渲染异常时仅替换当前分区为中文失败提示和“重新加载明细”按钮，避免整页进入全局错误页。
- 验证方式：按 TDD 先观察 `bun test web/classic/src/pages/Affiliate/affiliateViewState.test.mjs` RED（helper 缺失），实现后 `bun test web/classic/src/pages/Affiliate/affiliateViewState.test.mjs web/classic/src/hooks/usage-logs/usageLogsUrls.test.mjs` 6/6 通过；`bunx prettier src/pages/Affiliate/index.jsx src/pages/Affiliate/affiliateViewState.js src/pages/Affiliate/affiliateViewState.test.mjs --check` 通过；`cd web/classic && bun run build` 通过；`git diff --check` 通过。
- 残留风险：本批未重启 5174 dev server，因此未重新跑 Playwright browser smoke；局部错误边界覆盖 scoped logs 分区，统计看板分区需在后续看板落地时继续拆分。
- 下一步：继续 Phase 7 统计看板/RMB 主显示，或先补普通用户/profile disabled/模块关闭 browser 回归。

### Phase 7 classic 统计看板 MVP 复盘（2026-06-03 本线程）

- 完成内容：新增 scoped `/api/affiliate/summary`，按后端 `affiliate_scope` 汇总团队人数、分销邀请码归因的新用户、消耗/退款净 quota，并按 `QuotaPerUnit` 与当前 USD 汇率换算 RMB；classic `/console/affiliate` 增加统计看板卡片和看板分区失败兜底，金额卡片以 RMB 为主显示并保留原始 quota 说明。
- 验证方式：`go test -count=1 ./service -run 'TestBuildAffiliateDashboardSummary|TestListAffiliateVisibleUserIds'` 通过；`go test -count=1 ./controller -run 'TestGetAffiliateSummaryReturnsScopedDashboard|TestGetAffiliateScopedLogs|TestGetAffiliateStatus|TestAffiliateAdminRoutes|TestAdminSetAffiliateProfile|TestAdminUpdateAffiliateProfileStatus'` 通过；`go test -count=1 ./router` 通过；`bun test src/pages/Affiliate/affiliateDashboardCards.test.mjs src/pages/Affiliate/affiliateViewState.test.mjs src/hooks/usage-logs/usageLogsUrls.test.mjs` 8/8 通过；`cd web/classic && bun run build` 通过。
- 残留风险：佣金、KPI、人头费、待结算金额尚未接入管理员可配置规则，本轮只做 `pending_rules` 安全占位；未重新跑真实浏览器截图回归；scoped logs 表格仍保留原有额度展示逻辑，统一 RMB 化继续放在 Phase 9。
- 下一步：落地管理员分销规则配置与计算链路，再补普通用户/profile disabled/模块关闭截图回归和 default parity。

### Phase 7 classic 管理员分销管理复盘（2026-06-03 本线程）

- 完成内容：新增 `GET /api/affiliate/admin/profiles` 分页列表接口，支持按用户 ID、等级、状态过滤；classic 新增 `/console/affiliate/admin` 管理页和管理员侧边栏入口，可指定一级/二级分销商、查看 profile 列表、启用/禁用 profile，并提供跳转用户管理入口；旧 `SidebarModulesAdmin` 配置加载时会合并新增分销管理模块默认值。
- 验证方式：按 TDD 先观察 `go test -count=1 ./service -run 'TestListAffiliateProfilesFiltersAndPaginates'` 与 `go test -count=1 ./controller -run 'TestAdminListAffiliateProfiles|TestAffiliateAdminRoutes'` RED，再实现列表 service/controller/router 后转绿；`bun test src/pages/AffiliateAdmin/affiliateAdminProfiles.test.mjs` 4/4 通过；`go test -count=1 ./service -run 'TestListAffiliateProfilesFiltersAndPaginates|TestSetAffiliateProfile|TestDisableAffiliateProfile|TestEnableAffiliateProfile'` 通过；`go test -count=1 ./controller -run 'TestAdminListAffiliateProfiles|TestAdminSetAffiliateProfile|TestAdminUpdateAffiliateProfileStatus|TestAffiliateAdminRoutes'` 通过；`go test -count=1 ./router` 通过；`cd web/classic && bun run build` 通过。
- 残留风险：本批未做真实浏览器截图回归；管理页当前按用户 ID 操作，未接用户名搜索；`inviter_id` 仅提供跳转用户管理，直接编辑、影响预览、循环校验和审计继续在 Phase 11 落地。
- 下一步：补管理员管理页 browser smoke/截图，再推进 default parity 或 Phase 11 `inviter_id` 管理链路。

## Phase 8：default 分销前端

- [x] 不直接展示英文后端错误（default `/affiliate` 通过 `/api/affiliate/status` 门禁，业务不可用原因映射为前端友好 i18n 文案；summary/logs 失败显示固定友好提示，不透传后端英文错误）。
- [x] 对 classic 已完成能力做 default parity 审查（已审查 f96153ff 状态/兜底、a2b11419 统计看板、7565e9ee 日志 RMB、0707729c 管理员 profiles；本批实现 status/summary/scoped logs/RMB，管理员 profiles 标记为待补）。
- [x] 使用 `.agents/skills/classic-to-default-sync` 同步 classic 重要变化（按 f96153ff、a2b11419、7565e9ee、0707729c 的 classic 变更清单做 mapping；管理员 profiles 未在本批实施，单列待办）。
- [x] default 使用自身组件和 Tailwind/Base UI，不复制 Semi Design。
- [x] 新增文案使用 i18n。
- [x] 运行 `cd web/default && bun run i18n:sync`。
- [x] 使用 `.agents/skills/i18n-translate` 补齐 en、zh、fr、ja、ru、vi。
- [x] default 管理员分销 profiles 管理页 parity（列表、指定一级/二级、启用/禁用、跳转用户管理）。
- [x] default 管理员规则集配置页 parity（规则集列表、状态筛选、草稿保存、发布、归档、可编辑规则 JSON 区块）。
- [x] default 管理员佣金/结算操作面板 parity（结算编排、佣金重算、人工佣金调整、最近操作结果）。
- [x] default 真实账号 browser smoke：管理员/一级/二级/普通用户/profile disabled/模块关闭/移动端；2026-06-03 已用 default `/affiliate` Playwright smoke 覆盖 7 个场景。

### Phase 8 default 分销前端 MVP 复盘（2026-06-03 本线程）

- 完成内容：新增 default `/affiliate` 路由、侧边栏入口和分销页面；页面先请求 `/api/affiliate/status` 做后端 scope 门禁，可用时展示统计看板和 scoped logs，不可用时展示本地化友好提示；日志筛选仅包含时间、模型、分组、用户 ID、二级分销商 ID、请求状态，不暴露 channel、token、IP、request_id；日志花费列和看板金额按 RMB 主显示，并保留 raw quota tooltip/说明。
- Classic parity 审查：f96153ff 的状态/分区兜底已在 default 页面以 status 门禁和固定错误提示实现；a2b11419 的团队人数、有效新用户、净付费消耗、佣金/人头费/待结算/KPI 占位已在 default 看板实现；7565e9ee 的分销日志 RMB 主显示已实现；0707729c 的管理员 profiles 管理页尚未实现，已新增独立待办。
- 验证方式：`make dev-web` 已在运行并同时提供 default 5173 与 classic 5174，网络切换后 `timeout 30s curl -I http://127.0.0.1:5173/`、`http://127.0.0.1:5173/affiliate`、`http://127.0.0.1:5174/` 均返回 HTTP 200；`bun test src/features/affiliate/lib.test.ts` 4/4 通过；`bun run i18n:sync` 后 en/zh/fr/ja/ru/vi missing/extras/untranslated 均为 0；`cd web/default && bun run build` 通过。
- 残留风险：`cd web/default && bun run typecheck` 仍命中既有 default baseline（`hast` 类型缺失、`usage-logs-mobile-card` 泛型字段），未指向本批 affiliate 文件；本批未跑 default 真实账号 Playwright/browser smoke；default 管理员 profiles parity、导出字段、真实账号 RMB 核对仍未完成。
- 下一步：优先补 default 管理员 profiles 管理页或 default 真实账号 browser smoke，再推进 Phase 9/10 的通用 RMB helper、导出字段、KPI/佣金/人头费/结算规则。

### Phase 8 default 管理员 profiles 管理页复盘（2026-06-03 本线程）

- 完成内容：新增 default `/affiliate/admin` 管理页和管理员侧边栏入口；接入 `GET/POST/PATCH /api/affiliate/admin/profiles`，支持 profile 分页列表、用户 ID/等级/状态筛选、指定一级/二级分销商、二级上级用户 ID 校验、启用/禁用 profile、跳转用户管理；页面使用 default 自身 Base UI/Tailwind 组件，不复制 Semi Design。
- 验证方式：按 TDD 先观察 `bun test src/features/affiliate/admin-lib.test.ts` RED（`./admin-lib` 缺失），实现后 `bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/lib.test.ts` 8/8 通过；`bun run i18n:sync` 后 en/zh/fr/ja/ru/vi missing/extras/untranslated 均为 0，额外 t() 多行扫描无缺失；`cd web/default && bun run build` 通过；`timeout 30s curl -I http://127.0.0.1:5173/affiliate/admin` 返回 HTTP 200。
- 残留风险：`cd web/default && bun run typecheck` 仍只命中既有 default baseline（`hast` 类型缺失、`usage-logs-mobile-card` 泛型字段），未指向本批 affiliate/admin 文件；本批未用真实管理员账号做浏览器级 profile 创建/启停 smoke；管理员 profiles 仍按用户 ID 操作，用户名搜索和直接编辑 `inviter_id` 继续归入 Phase 11。
- 下一步：补 default 真实账号 browser smoke，或推进 Phase 11 用户管理 `inviter_id` 管理链路。

### Phase 8 default 管理员规则集配置页复盘（2026-06-03 本线程）

- 完成内容：default `/affiliate/admin` 管理页在 profiles 管理之外新增规则集管理区块，接入 `GET /api/affiliate/admin/rule-sets`、`POST /api/affiliate/admin/rule-sets/draft`、`PATCH /api/affiliate/admin/rule-sets/:id/publish|archive`；支持状态筛选、分页列表、草稿保存、发布、归档和从 `config_snapshot` 回填表单。新增 default `admin-lib` 规则集 helper 和 API/types，提供可编辑的飞书方案 seed JSON，覆盖分佣区间、KPI、质量门槛、人头费和结算配置。
- 验证方式：先观察 `bun --bun test src/features/affiliate/admin-lib.test.ts` 因缺少 rule set helper RED；实现后 `bun --bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/lib.test.ts` 13 项通过；`cd web/default && bun run i18n:sync` 通过且无额外 locale diff；`cd web/default && bun run build` 通过；`git diff --check` 通过。
- 残留风险：当前 default 与 classic 一样是 JSON 区块编辑入口，不是运营友好的动态表格；未做真实管理员账号浏览器 smoke。
- 下一步：补 default 真实账号 browser smoke，或继续扩展佣金/结算列表、冻结/支付/作废操作和批次审计展示。

### Phase 8 default browser smoke 复盘（2026-06-03 本线程）

- 完成内容：补齐 default `/affiliate` 真实账号浏览器 smoke，覆盖管理员 global scope、一级分销桌面、一级分销移动端、二级分销桌面、普通用户未开通、二级 profile disabled、模块关闭 7 个场景；为避免 dev 登录限流，ignored Playwright smoke 改为单个串行全流程测试，保留 admin session 并用多个 browser context 复用真实登录状态。
- 验证方式：`node --check runtime/smoke/affiliate-default-smoke.spec.cjs` 与 `node --check runtime/smoke/playwright.default.config.cjs` 通过；`timeout 30s curl http://127.0.0.1:3000/api/status` 返回 HTTP 200；`timeout 600s runtime/smoke/node_modules/.bin/playwright test --config=runtime/smoke/playwright.default.config.cjs` 1/1 通过，输出 7 个场景的 status/summary/logs 或 unavailable_reason 复核结果；运行态收尾确认 `AffiliateEnabled=true`、`afd%` 临时用户数为 0、二级 profile 为 active，并清理本地 Redis `GA/CT/SR` rateLimit key。
- 残留风险：本轮为本地恢复库 + ignored runtime smoke 验证，截图、测试账号、runner 均不提交；default 管理端规则/佣金/结算操作仍未做逐按钮真实浏览器点击；`cd web/default && bun run typecheck` 仍有既有 baseline，未在本批扩大处理。
- 下一步：继续 SMS 真实通道 smoke、完整结算周期双跑、灰度启用和外接控制台归档；如推进 Phase 9，可用本轮真实账号页面作为 RMB 值核对入口。

## Phase 9：RMB 单位

- [x] 梳理 classic 分销页面字段单位：统计看板金额卡、scoped 使用日志花费列；classic 管理员分销 profile 页暂无金额字段。
- [x] classic 分销页面金额主显示 RMB：看板和 scoped 使用日志花费列均使用站内 `quota_per_unit` 与 `usd_exchange_rate` 换算 RMB，不跟随 `quota_display_type=TOKENS/CUSTOM` 改变主单位。
- [x] default 分销页面金额主显示 RMB：看板和 scoped logs 花费列均以 RMB 为主单位，原始 quota 保留为 tooltip/说明。
- [x] default 复用 `formatQuotaWithCurrency()`；为全局 formatter 增加调用方 CNY override，default 分销 helper 不再手写 quota->RMB 换算。
- [x] classic 原始 quota/token 仅保留 tooltip、调试字段或导出附加列；scoped 使用日志花费列 tooltip 保留原始 quota。
- [x] 用真实账号数据核对页面 RMB 值；2026-06-03 用本地恢复库管理员真实账号完成 default `/affiliate` quota 换算核对和 classic `/console/affiliate` 当前筛选页 RMB 明细核对。
- [x] 导出文件同时包含 RMB 主字段和原始 quota 附加字段；default `/affiliate` 当前页 CSV 导出已包含 `consumption_rmb` 和 `raw_quota`。
- [x] 如需全量/跨页导出，另行设计后端 scoped export 或安全分页导出，不能绕过后端 scope；2026-06-03 已新增后端 `/api/affiliate/logs/export`，复用 `AffiliateAuth` scope 和 scoped logs 过滤/脱敏逻辑，default 下载按钮改为请求后端 scoped CSV。

### Phase 9 classic RMB 使用日志复盘（2026-06-03 本线程）

- 完成内容：新增 classic affiliate quota RMB helper，按 `quota_per_unit` 与 `status.usd_exchange_rate` 将 quota 换算为 RMB；`/console/affiliate` scoped 使用日志花费列在 affiliate mode 下主显示 RMB，原始 quota 仅放入 tooltip；订阅抵扣 tooltip 同步改为 RMB 等价金额加原始 quota。
- 验证方式：`bun test src/helpers/affiliateQuota.test.mjs src/hooks/usage-logs/usageLogsUrls.test.mjs src/pages/Affiliate/affiliateDashboardCards.test.mjs src/pages/Affiliate/affiliateViewState.test.mjs` 12/12 通过；`cd web/classic && bun run build` 通过。
- 残留风险：本批未跑真实账号浏览器核对；default 分销前端、导出字段和真实账号 RMB 值核对仍待后续 Phase 8/9。
- 下一步：推进 default parity，或用本地恢复库账号做 RMB 页面核对并补截图回归。

### Phase 9 default RMB formatter 复盘（2026-06-03 本线程）

- 完成内容：default 分销 scoped logs RMB helper 改为复用全局 `formatQuotaWithCurrency()`，不再手写 quota->USD->RMB 公式；全局 currency formatter 新增 `currencyOverride`，允许分销场景在系统 `quotaDisplayType=TOKENS/CUSTOM/USD` 时仍强制以 CNY/RMB 主显示，同时继续使用系统 `quota_per_unit` 与 `usd_exchange_rate`。
- 验证方式：先观察 `bun --bun test src/lib/currency.test.ts src/features/affiliate/lib.test.ts` RED，失败于 formatter override 未实现和 affiliate helper 仍输出手写 fixed RMB；实现后同命令通过；补充 `bun --bun test src/lib/currency.test.ts src/features/affiliate/lib.test.ts src/features/affiliate/admin-lib.test.ts` 20 项通过；`cd web/default && bun run i18n:sync` 通过；`cd web/default && bun run build` 通过；`git diff --check` 通过。
- 残留风险：本批只覆盖 helper 与构建，未用真实账号核对页面 RMB 数值；default 当前页 CSV 导出已补 RMB/raw quota 字段，但全量跨页导出仍待单独设计。
- 下一步：用本地恢复库真实账号做 RMB 页面核对，或设计后端 scoped 全量导出。

### Phase 9 default scoped logs CSV 导出复盘（2026-06-03 本线程）

- 完成内容：default `/affiliate` scoped logs 表格新增当前页 CSV 下载按钮；导出 helper 使用稳定字段 `time,user_id,type,model,group,consumption_rmb,raw_quota`，以 RMB 作为主金额字段并保留原始 quota 附加字段；导出仍只使用当前已由后端 scoped API 返回的数据。
- 验证方式：先观察 `bun --bun test src/features/affiliate/lib.test.ts` RED，失败于 `buildAffiliateLogsCsv` 未导出；实现后 `bun --bun test src/features/affiliate/lib.test.ts src/features/affiliate/admin-lib.test.ts src/lib/currency.test.ts` 22 项通过；`cd web/default && bun run i18n:sync` 通过；`cd web/default && bun run build` 通过。
- 残留风险：本批只覆盖 default 当前页导出，不是全量跨页导出；classic 官方使用日志当前未发现文件导出入口。
- 下一步：如业务需要全量导出，设计后端 scoped export 或安全分页导出，并补浏览器下载 smoke。

### Phase 9 真实账号 RMB 页面核对复盘（2026-06-03 本线程）

- 完成内容：新增 Git 忽略的 runtime Playwright RMB smoke，用本地恢复库管理员真实账号分别打开 default `/affiliate` 与 classic `/console/affiliate`，捕获页面自身发出的 `/api/affiliate/logs` 响应，并核对页面表格可见 RMB 文本。
- 验证方式：`node --check runtime/smoke/affiliate-rmb-smoke.spec.cjs` 与 `node --check runtime/smoke/playwright.rmb.config.cjs` 通过；`timeout 600s runtime/smoke/node_modules/.bin/playwright test --config=runtime/smoke/playwright.rmb.config.cjs` 1/1 通过。default 当前页用真实日志 `quota`、`quota_per_unit`、`usd_exchange_rate` 计算并核对 `¥0.006102`；classic 当前默认“今天”筛选页没有可见消费花费列，改核对 API 内容明细中已渲染的 `¥1.000000`。
- 残留风险：本轮 classic RMB 核对覆盖当前可见页面明细，不等同于强制筛选到消费日志花费列；如需更强回归，需要在 smoke 中驱动 classic 筛选到历史消费日志或构造安全本地消费数据。runner、截图和测试账号仍位于 Git 忽略路径，不提交。
- 下一步：继续 Phase 12 SMS 真实通道 smoke、完整结算周期双跑、灰度启用和外接控制台归档。

### Phase 9 scoped logs 后端 CSV 导出复盘（2026-06-03 本线程）

- 完成内容：新增 `GET /api/affiliate/logs/export`，路由使用 `UserAuth + AffiliateAuth`，导出逻辑复用 `ListAffiliateScopedLogs` 的 scope、二级分销筛选、用户筛选、时间、模型、分组和请求状态过滤；CSV 字段固定为 `time,user_id,type,model,group,consumption_rmb,raw_quota`，不导出 channel、token、IP、request_id、upstream_request_id 或敏感 `other` 字段；default `/affiliate` 下载按钮从前端当前页 Blob 改为后端 scoped export URL，并剔除分页参数。
- 验证方式：按 TDD 先观察 `go test -count=1 ./controller -run 'TestExportAffiliateScopedLogsReturnsScopedRmbCsv'` 与 `cd web/default && bun --bun test src/features/affiliate/lib.test.ts` RED，分别失败于 controller/helper 不存在；实现后 `go test -count=1 ./controller -run 'TestExportAffiliateScopedLogsReturnsScopedRmbCsv|TestBuildAffiliateScopedLogsCsvKeepsTinyNegativeRefundVisible|TestGetAffiliateScopedLogs'` 通过，`cd web/default && bun --bun test src/features/affiliate/lib.test.ts` 8 项通过；补充 `go test -count=1 ./controller ./router -run 'Affiliate'`、`cd web/default && bun run build`、`git diff --check` 均通过。
- 残留风险：导出采用安全分页聚合，当前最多导出 10000 条，避免一次性无限导出；如业务需要更大规模，应设计异步任务或后台导出队列。classic 官方使用日志仍未接入单独导出按钮。
- 下一步：继续外部 SMS 真通道、结算周期双跑、灰度和归档验收；如后续新增 paid/gift/trial 来源 sidecar，需同步复核导出字段是否需要追加来源字段。

## Phase 10：KPI、佣金、人头费与结算

- [x] 以飞书分销方案作为默认 seed value，不直接硬编码到计算逻辑；classic 新建规则草稿表单提供可编辑 seed JSON，计算链路仍只读取已保存/发布规则集。
- [x] 管理员端提供规则集草稿、发布、停用、生效时间配置；classic/default 管理页已接入草稿保存、发布、归档和生效时间窗口字段。
- [x] 管理员端可配置一级/二级分销商的消耗区间、基准比例、最高 cap；classic/default 当前通过分佣区间 JSON 区块编辑。
- [x] 管理员端可配置特殊大客户人工审批比例和启用条件；classic/default 当前通过 `requires_manual_approval` / `allow_manual_approval_rate` 与区间 cap JSON 字段编辑。
- [x] 管理员端可配置 KPI 档位名称、有效新用户阈值、净付费消耗阈值、系数；classic/default 当前通过 KPI 档位 JSON 区块编辑。
- [x] 管理员端可配置质量门槛：纯赠金占比、异常用户占比、二次付费率、退款/争议扣回；classic/default 当前通过 KPI/risk JSON 区块编辑。
- [x] 管理员端可配置人头费有效用户定义和各档位人头费金额；classic/default 当前通过人头费规则 JSON 区块编辑。
- [x] 管理员端可配置结算周期、冻结时间、最小结算金额、人工审核开关；classic/default 表单提供结算配置字段。
- [x] 后端管理员 API 支持规则集草稿保存、发布、归档和生效时间配置，并写入配置审计日志。
- [x] 发布规则前校验一级最高档不超过 30% 业务 cap。
- [x] 发布规则前校验二级有效比例不高于一级，避免倒挂。
- [x] 佣金、KPI 快照、结算单必须记录规则集版本。
- [x] pending 佣金事件、KPI snapshot、人头费事件和 settlement snapshot 记录 `rule_set_id` / `rule_set_version`。
- [x] 实现保留单用户累计净付费消耗区间的分佣规则。
- [x] 实现 KPI 系数，最低 1，其他档位大于 1。
- [x] 一级分销商最高档有效分佣可达 30%，但不超过业务 cap。
- [x] 佣金只统计 paid 来源净消耗。
- [x] 支持退款/负向日志扣回。
- [x] 实现人头费条件：首次付费、最低净付费、周期净付费等。
- [x] 实现 KPI 快照。
- [x] 实现 pending 佣金明细。
- [x] 实现结算单生成、冻结、作废、标记已支付。
- [x] 分销商只读自己的佣金/结算。
- [x] 管理员可全局管理规则、佣金和结算基础流程（规则草稿/发布/归档、佣金全局列表、结算生成/冻结/作废/标记已支付）。
- [x] 后端提供管理员一键编排任务，按周期串联 KPI snapshot、pending 佣金事件、pending 人头费事件和 draft settlement 生成。
- [x] 管理员佣金事件人工调整、作废、重算 API：支持手工 pending 调整事件、未结算事件作废、安全重算未入结算的自动 pending 事件。
- [x] classic 管理端接入佣金与结算操作面板：支持结算编排、佣金重算和人工佣金调整。
- [x] default 管理端接入佣金与结算操作面板：支持结算编排、佣金重算和人工佣金调整。

### Phase 10 阶段复盘（2026-06-03 后端规则集 API）

- 完成内容：新增规则集后端服务和管理员 API，支持 draft 保存、published 发布、archived 归档、旧 published 自动归档、配置快照、配置审计日志；规则输入覆盖一级/二级分佣区间、人工审批开关、KPI 档位、质量门槛、人头费条件和结算周期。
- 验证方式：已运行 `go test -count=1 ./service -run 'AffiliateRuleSet|RuleSet'` 和 `go test -count=1 ./controller -run 'AffiliateRuleSet|RuleSet'`，覆盖草稿持久化、发布归档、发布前持久化配置复校、列表过滤、后台权限、一级 30% cap、二级不倒挂、KPI 系数最低 1、生效时间窗口。
- 残留风险：尚未实现管理员前端规则配置页；尚未接入真实佣金、KPI 快照、人头费事件和结算单生成；本批未跑 Docker/PostgreSQL schema smoke，仍依赖已有 sidecar schema 迁移验证。
- 下一步：继续补规则集管理 UI 或优先实现佣金/KPI/结算计算切片，并为规则集版本贯穿事件、快照、结算单。

### Phase 10 阶段复盘（2026-06-03 pending 佣金事件）

- 完成内容：新增后端 pending 佣金事件生成服务，只处理明确 `quota_source=paid` 的消费/退款日志；按 published 规则集、生效时间、分销 profile level、单用户累计净付费区间和 KPI snapshot 系数计算佣金；生成 `accrual` / `clawback` 事件，记录 `rule_set_id`、`rule_set_version`、raw quota、净付费 cents、累计 before/after、base/cap/final rate。
- 验证方式：先观察 `go test -count=1 ./service -run 'AffiliatePendingCommission|CommissionEvents|Commission'` RED；实现后同命令通过；补充 `go test -count=1 ./service` 和 `go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|Admin'` 均通过。
- 残留风险：本批当时 paid 来源依赖日志 `Other` 中明确标记；后续已在 Phase 3 quota source 复盘中补齐 `user_quota_source_*` sidecar 读取和写入 hook。未标记且无 sidecar 的历史日志仍不能默认当 paid；KPI 快照生成、人头费事件、结算单生成和分销商只读结算 API 在后续批次补齐。
- 下一步：实现 KPI snapshot 生成或 settlement draft/freeze/pay 流程，并把规则集版本继续贯穿 KPI 快照和结算单。

### Phase 10 阶段复盘（2026-06-03 KPI snapshot）

- 完成内容：新增 KPI snapshot 生成服务，按 active 分销 profile 的可见下游用户、affiliate invite event 和明确来源日志计算有效新用户、paid 净消耗、gift-only 占比、异常占比、二次付费率，并按 published 规则集 KPI tier 从高到低选择符合阈值和质量门槛的档位。
- 验证方式：先观察 `go test -count=1 ./service -run 'AffiliateKPI|KPISnapshot|KPISnapshots'` RED；实现后同命令通过，并补充 `go test -count=1 ./service -run 'AffiliateKPI|KPISnapshot|KPISnapshots|AffiliatePendingCommission|CommissionEvents|Commission'` 验证 KPI 与佣金事件联动。
- 残留风险：本批当时 gift-only、abnormal、second-payment 质量指标依赖日志 `Other` 中明确标记或可推导的 paid 消费次数；后续已补齐 quota source sidecar 归因。历史未标记且无 sidecar 的日志仍不能反推来源；人头费事件、结算单、分销商只读结算 API 在后续批次补齐。
- 下一步：继续实现人头费事件或 settlement draft/freeze/pay 流程，并把 settlement 的 `rule_set_id`/版本快照补齐。

### Phase 10 阶段复盘（2026-06-03 人头费事件）

- 完成内容：新增 pending 人头费事件生成服务，按 active 分销商、KPI snapshot 档位、`affiliate_head_fee_rules`、affiliate invite event 和明确 `quota_source=paid` 的消费/退款日志判断资格；支持首次付费门槛、周期净付费门槛、资格天数和解锁延迟，生成去重的 pending `affiliate_head_fee_events`。
- 验证方式：先观察 `go test -count=1 ./service -run 'AffiliateHeadFee|HeadFee'` RED；实现后同命令通过；补充 `go test -count=1 ./service` 和 `go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Admin'` 均通过。
- 残留风险：本批当时首次付费和周期净付费仍依赖日志 `Other` 中明确 paid 来源；后续已接入真实充值 paid source ledger、wallet source debit/refund 和 quota source sidecar 归因。历史未标记且无 sidecar 的日志仍不能反推来源；人头费事件进入结算单和分销商只读结算 API 在后续批次补齐。
- 下一步：实现结算单生成、冻结、作废和标记已支付，并把佣金事件、人头费事件合并进 settlement。

### Phase 10 阶段复盘（2026-06-03 结算单）

- 完成内容：新增结算单 service，按 published 规则集和周期汇总 `pending` 佣金事件、人头费事件，生成/更新 draft `affiliate_settlements`；支持已有 draft 增量合并、负向扣回归入 deduction 且 payable 不为负、事件状态从 `pending` 到 `ready`、冻结、作废、标记已支付，并在 settlement snapshot 记录 `rule_set_version` 和事件数量/ID。
- 验证方式：先观察 `go test -count=1 ./service -run 'AffiliateSettlement|Settlement'` RED；实现后同命令通过；补充 `go test -count=1 ./service` 和 `go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin'` 均通过。
- 残留风险：结算 service 尚未暴露管理员/分销商只读 API；人头费事件缺少显式 period 字段，当前按 synthetic marker 中的 `period:start-end` 归属结算周期；最小结算金额、人工审核开关和结算周期配置仍待管理员端 UI/API 消费。
- 下一步：补分销商只读佣金/结算 API、管理员结算管理 API，随后再接 classic 管理页面和 RMB 统一展示。

### Phase 10 阶段复盘（2026-06-03 分销商佣金/结算只读 API）

- 完成内容：新增 scoped 只读查询服务和用户侧接口 `GET /api/affiliate/commissions`、`GET /api/affiliate/settlements`，复用 `AffiliateAuth` 后端 scope；普通分销商只能读取 `affiliate_user_id = scope.UserId` 的佣金事件和结算单，支持状态、规则集、周期、下游用户和 settlement 过滤，分页保持现有 `PageInfo` 响应格式。
- 验证方式：先观察 `go test -count=1 ./controller -run 'AffiliateCommissions|AffiliateSettlements'` RED；实现后同命令通过；补充 `go test -count=1 ./service` 和 `go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin'` 均通过。
- 残留风险：本批只做分销商只读 API，管理员侧全局结算管理、生成/冻结/作废/支付 HTTP API、classic/default 页面消费仍待实现；状态筛选目前按合法状态过滤，未知状态不额外收窄结果，后续前端应只传固定枚举。
- 下一步：补管理员全局管理佣金和结算 API，再接 classic 管理端页面与分销商结算明细页面。

### Phase 10 阶段复盘（2026-06-03 管理员佣金/结算管理 API）

- 完成内容：新增管理员侧 `GET /api/affiliate/admin/commissions`、`GET /api/affiliate/admin/settlements`、`POST /api/affiliate/admin/settlements/generate`、`PATCH /api/affiliate/admin/settlements/:id/freeze|void|pay`；管理员可全局过滤查看佣金/结算，并执行结算生成、冻结、作废、标记已支付，状态流转复用 settlement service 并同步事件状态。
- 验证方式：先观察 `go test -count=1 ./controller -run 'AdminListAffiliateCommissions|AdminSettlement|AdminVoidAffiliateSettlement'` RED；实现后同命令通过；补充 `go test -count=1 ./service` 和 `go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin'` 均通过。
- 残留风险：管理员佣金事件人工调整/作废/重算尚未设计；当前 `/settlements/generate` 仍只消费已存在的 pending 佣金/人头费事件；一键编排缺口见下一节已补齐；前端管理页面仍待接入。
- 下一步：设计管理员端规则配置/结算管理 UI，或细化佣金事件人工调整策略。

### Phase 10 阶段复盘（2026-06-03 管理员结算编排任务）

- 完成内容：新增 `RunAffiliateSettlementPipeline` 后端编排 service 和管理员 API `POST /api/affiliate/admin/settlement-runs`，同一请求按周期依次生成 KPI snapshot、pending 佣金事件、pending 人头费事件和 draft settlement；返回 KPI、佣金、人头费、结算数量及生成的结算单，保留原 `/settlements/generate` 只消费已存在 pending 事件的行为。
- 验证方式：先观察 `go test -count=1 ./service -run 'AffiliateSettlementPipeline|SettlementRun'` 因缺少 pipeline 类型和函数 RED；实现后同命令通过；新增管理员入口测试 `go test -count=1 ./controller -run 'AdminRunAffiliateSettlementPipeline'` 通过；补充 `go test -count=1 ./service -run 'AffiliateSettlementPipeline|SettlementRun|AffiliateSettlement|AffiliateKPI|KPISnapshot|AffiliatePendingCommission|CommissionEvents|Commission|AffiliateHeadFee|HeadFee'`、`go test -count=1 ./controller -run 'AdminRunAffiliateSettlementPipeline|AdminSettlement|AffiliateCommissions|AffiliateSettlements'` 和 `go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin|Inviter'` 均通过。
- 残留风险：编排任务已可读取日志 `Other` 或 `user_quota_source_*` sidecar 归因；任务未做异步队列、幂等运行记录或后台进度展示；前端规则/结算管理页面仍待实现。
- 下一步：佣金事件人工调整/作废/重算见下一节复盘；继续补管理员规则配置/结算管理 UI 或批次运行记录。

### Phase 10 阶段复盘（2026-06-03 管理员佣金事件管理 API）

- 完成内容：新增管理员侧佣金事件管理 service 和 API：`POST /api/affiliate/admin/commissions/adjust` 创建手工 `manual_adjustment` pending 事件；`PATCH /api/affiliate/admin/commissions/:id/void` 作废未入结算且未 settled 的佣金事件；`POST /api/affiliate/admin/commissions/recompute` 作废同周期、同规则集、未入结算的自动 pending 佣金事件并重跑 paid 日志归因，保留手工调整事件不被重算覆盖。
- 验证方式：先观察 `go test -count=1 ./service -run 'ManualCommission|VoidAffiliateCommissionEvent|RecomputeAffiliatePendingCommissionEvents'` 因缺少 service 类型和函数 RED；实现后同命令通过；新增 controller 测试 `go test -count=1 ./controller -run 'AdminCreateVoidAndRecomputeAffiliateCommissions'` 通过；补充 `go test -count=1 ./service -run 'ManualCommission|VoidAffiliateCommissionEvent|RecomputeAffiliatePendingCommissionEvents|AffiliatePendingCommission|CommissionEvents|Commission|AffiliateSettlementPipeline|SettlementRun|AffiliateSettlement|AffiliateKPI|KPISnapshot|AffiliateHeadFee|HeadFee'`、`go test -count=1 ./controller -run 'AdminCreateVoidAndRecomputeAffiliateCommissions|AdminRunAffiliateSettlementPipeline|AdminSettlement|AffiliateCommissions|AffiliateSettlements'` 和 `go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin|Inviter'` 均通过。
- 残留风险：作废 API 拒绝直接作废已入 settlement 的事件，避免结算单金额失配；如要支持 draft settlement 内单条事件作废，需要先设计结算单重算/重开流程；重算可读取日志 `Other` 或 quota source sidecar 归因，但历史未标记日志仍不会默认当 paid。
- 下一步：补管理员规则配置/结算管理 UI，或设计 settlement 内事件重开、批次运行记录和前端操作审计展示。

### Phase 10 阶段复盘（2026-06-03 classic 管理端佣金/结算操作）

- 完成内容：classic `/console/affiliate/admin` 管理页新增“佣金与结算操作”卡片，接入 `POST /api/affiliate/admin/settlement-runs`、`POST /api/affiliate/admin/commissions/recompute` 和 `POST /api/affiliate/admin/commissions/adjust`；新增前端 helper 统一构造查询、操作 payload、校验错误、状态标签和 RMB 金额格式，避免在页面组件中散落接口细节。
- 验证方式：先观察 `bun test src/pages/AffiliateAdmin/affiliateAdminFinance.test.mjs` 因 helper 缺失 RED；实现后 `bun test src/pages/AffiliateAdmin/affiliateAdminFinance.test.mjs src/pages/AffiliateAdmin/affiliateAdminProfiles.test.mjs` 9 项通过；`cd web/classic && bun run build` 通过；网络切换后重试 `make dev-web-classic`，确认依赖安装可用，失败原因仅为已有 `make dev-web` 占用 `5174`，随后 `5173` / `5174` 均 HTTP 200。
- 残留风险：本批只提供操作入口，没有实现完整规则集可视化编辑、结算列表/佣金列表表格管理、批次运行记录或二次确认弹窗；人工调整金额仍以“分”为输入单位，后续可改为 RMB 输入并在提交前转换为 cents。
- 下一步：补管理员规则配置 UI，或在 classic 管理页继续扩展佣金/结算列表、冻结/支付/作废操作和批次审计展示。

### Phase 10 阶段复盘（2026-06-03 classic 规则集配置 UI）

- 完成内容：classic `/console/affiliate/admin` 管理页新增规则集配置卡片，支持规则集列表、状态筛选、草稿保存、发布、归档和生效时间窗口；新增 `affiliateAdminRules` helper，提供规则集列表 URL、状态 payload、后端 draft payload 组装、config snapshot 回填、飞书方案默认 seed JSON、状态标签、BPS 百分比格式化和前端快速校验。当前 UI 通过 JSON 区块完整编辑 commission rules、commission tiers、KPI tiers、head fee rules、risk rules 和 settlement config，不把比例写入计算逻辑。
- 验证方式：先观察 `bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs` 因 helper 缺失 RED；实现后 `bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs src/pages/AffiliateAdmin/affiliateAdminFinance.test.mjs src/pages/AffiliateAdmin/affiliateAdminProfiles.test.mjs` 15 项通过；`cd web/classic && bun run build` 通过；`git diff --check` 通过。
- 残留风险：当前是可落地的 JSON 编辑入口，不是面向运营的动态行表格；没有二次确认弹窗、配置 diff 预览或批次运行记录；发布/归档 smoke 尚未用浏览器真实账号点击验证。
- 下一步：继续把规则 JSON 区块拆成动态表格，或补 classic/default 浏览器 smoke。

### Phase 10 阶段复盘（2026-06-03 default 管理端佣金/结算操作）

- 完成内容：default `/affiliate/admin` 管理页新增“Affiliate Finance Operations”操作面板，按 default 自身 Card/Input/Button 风格接入 `POST /api/affiliate/admin/settlement-runs`、`POST /api/affiliate/admin/commissions/recompute` 和 `POST /api/affiliate/admin/commissions/adjust`；新增 default `admin-lib` finance helper、API/types，统一构造佣金/结算查询 URL、三类操作 payload、前端校验、状态标签和 RMB 分格式化。
- 验证方式：先观察 `bun --bun test src/features/affiliate/admin-lib.test.ts` 因缺少 finance helper 导出 RED；实现后 `bun --bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/lib.test.ts` 18 项通过；`cd web/default && bun run i18n:sync` 通过且无额外 locale diff；`cd web/default && bun run build` 通过；`git diff --check` 通过；tracked 敏感目录/文件检查为空，改动范围敏感模式扫描无命中。
- 残留风险：本批只提供操作入口，没有做佣金/结算列表表格、冻结/支付/作废按钮、批次运行记录、二次确认弹窗或真实管理员浏览器点击 smoke；人工调整金额仍以“分”为输入单位，后续可改为 RMB 输入并转换为 cents。
- 下一步：补 default 真实账号 browser smoke，或继续扩展 classic/default 佣金/结算列表、状态操作和批次审计展示。

## Phase 11：用户管理 `inviter_id`

- [x] classic 用户管理编辑页增加邀请人 ID 字段，并接入候选搜索、影响预览和保存 API。
- [x] default 用户管理邀请人字段 parity：编辑抽屉接入候选搜索、影响预览和保存 API。
- [x] 后端支持按用户 ID/用户名检索邀请人候选。
- [x] 后端提供保存前原邀请人、新邀请人和影响路径预览。
- [x] 保存时校验不能形成无效或循环关系。
- [x] 保存后写入审计日志。
- [x] 变更后重建相关分销 sidecar 关系，并安全触发用户缓存失效防护；当前未发现独立分销 scope 缓存。
- [x] 增加管理员/普通用户权限测试。

### Phase 11 阶段复盘（2026-06-03 后端 inviter 管理 API）

- 完成内容：新增 inviter 管理 service 和管理员 API，支持邀请人候选搜索、变更预览、保存 `users.inviter_id`，同步更新 `affiliate_invite_events` 与 `affiliate_relations`，旧关系置 disabled，新 affiliate 邀请人关系重新激活/生成，并写入 `affiliate_audit_logs`。
- 验证方式：先观察 `go test -count=1 ./service -run 'AffiliateInviter|InviterChange'` RED；实现后同命令通过；补充 `go test -count=1 ./controller -run 'AffiliateInviter|InviterCandidates|PreviewAndUpdateAffiliateInviter'`、`go test -count=1 ./model ./service ./controller ./router -run 'Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin|Inviter'` 和 `go test -count=1 ./service` 均通过。
- 残留风险：classic/default 前端均已接入这些 API。当前只重建目标用户自身的分销关系，若未来允许批量迁移整棵子树，需要单独设计影响范围和重算策略；官方邀请奖励额度历史不回滚。
- 下一步：继续补一键 KPI/佣金/人头费/结算编排任务，或推进管理员规则配置 UI。

### Phase 11 阶段复盘（2026-06-03 classic inviter 前端）

- 完成内容：classic 用户管理编辑 SideSheet 新增“邀请关系”卡片，支持当前邀请人展示、候选搜索、候选选择、手动输入/清空邀请人 ID、操作原因、影响路径预览和保存邀请人变更；新增 `affiliateInviterManagement` helper，避免在组件内硬编码接口路径和 payload 规范。
- 验证方式：先观察 `bun test web/classic/src/components/table/users/affiliateInviterManagement.test.mjs` 因 helper 缺失 RED；实现后同命令通过；补充 classic affiliate/helper 测试 13 项通过；`cd web/classic && bun run build` 通过；Playwright 以本地测试管理员账号打开 `http://127.0.0.1:5174/console/user` 并验证用户编辑 SideSheet 中“邀请关系”“预览影响”“保存邀请人”可见，未输出账号、密码或 token。2026-06-03 追加：运行中后端旧版本曾导致 admin/profiles 和 inviter 路由 404；执行一次 `timeout 600s docker compose -f docker-compose.dev.yml up -d --build new-api` 后，按 classic API 实际 `New-API-User` 头重跑 smoke，`/api/affiliate/admin/profiles`、`/api/affiliate/admin/inviter-candidates`、`/api/affiliate/admin/users/:id/inviter/preview` 和 no-op `PATCH /api/affiliate/admin/users/:id/inviter` 均 HTTP 200 / `success=true`；Playwright 点击“预览影响”后“目标用户”摘要渲染成功。
- 残留风险：Playwright 控制台仍有既有 React `icononly` 非布尔属性日志，本批未扩大修复。
- 下一步：default parity 见下一节复盘；继续转向 Phase 10 编排任务或 Phase 12 更完整回归。

### Phase 11 阶段复盘（2026-06-03 default inviter 前端）

- 完成内容：default 用户管理编辑抽屉新增 `AffiliateInviterSection`，按 default 自身 shadcn/Radix 风格接入当前邀请人展示、候选搜索、候选选择、手动输入/清空邀请人 ID、操作原因、影响路径预览和保存邀请人变更；新增 `features/users/lib/affiliate-inviter` helper 和 API 封装。
- 验证方式：先观察 `bun --bun test web/default/src/features/users/lib/affiliate-inviter.test.ts` 因 helper 缺失 RED；实现后同命令通过；补充 `bun --bun test web/default/src/features/users/lib/affiliate-inviter.test.ts web/default/src/features/affiliate/admin-lib.test.ts web/default/src/features/affiliate/lib.test.ts web/default/src/features/system-settings/operations/sms-settings.test.ts` 共 15 项通过；`cd web/default && bun run build` 通过；Playwright 以本地测试管理员账号打开 `http://127.0.0.1:5173/users`，通过行菜单进入编辑抽屉，验证 “Affiliate Inviter” 区块可见，点击 “Preview impact” 后 “Inviter change preview” 渲染成功，点击 no-op “Save inviter” 后 `PATCH /api/affiliate/admin/users/:id/inviter` HTTP 200 / `success=true`。
- 残留风险：Playwright 控制台仍有既有 default 表单 `checked` 缺少 `onChange` 警告，本批未扩大修复；保存 smoke 使用当前邀请人 ID 做 no-op，未改变业务关系。
- 下一步：Phase 11 前后端主链路已闭合，后续转向 Phase 10 编排任务、管理员规则配置 UI 或 Phase 12 更完整回归。

## Phase 12：发布与回归

- [x] 本地通过核心 Go 测试；2026-06-03 `go test ./...` 通过。
- [x] 复核并修复/隔离当前 `go test ./...` 基线失败：2026-06-03 已修复 controller model list 测试隔离、Claude relay file content 转换和 stream scanner 预初始化状态保留；根包 `web/classic/dist` embed 在当前环境未再复现。
- [x] classic 前端构建通过；2026-06-03 追加 classic 佣金/结算操作面板和规则集配置 UI 后 `cd web/classic && bun run build` 通过。
- [x] default 前端构建或 typecheck 通过（2026-06-03 `cd web/default && bun run build` 通过；typecheck 仍有既有 baseline，见 Phase 8 复盘）。
- [x] Playwright 截图回归通过；classic 分销页 2026-06-03 已覆盖 `super_admin`、一级、二级、一级移动端、普通用户未开通、profile disabled、模块关闭 7 个场景；default `/affiliate` 已覆盖管理员、一级、二级、普通用户、profile disabled、模块关闭、移动端 7 个场景；classic 用户管理 inviter SideSheet、预览接口和 no-op 保存 smoke 已通过；default 用户管理 inviter 编辑抽屉、预览和 no-op 保存 smoke 已通过。
- [x] schema impact 报告无非预期官方表改动；见 `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`。
- [x] 用服务器 PG 快照完成真实账号 smoke；2026-06-03 在本地恢复库中用三类测试账号完成 API smoke、classic browser smoke、default `/affiliate` browser smoke 和 Phase 9 RMB 页面核对，未输出用户名、密码、cookie 或 token。
- [x] 管理员端规则配置页面可修改分佣比例、KPI 阈值、系数、人头费、质量门槛和结算周期；当前完成范围为 classic/default JSON 规则区块，运营友好的动态表格仍待后续。
- [x] 新增外部验收 runbook，覆盖服务器内 pg_dump、SMS 真通道、完整结算周期双跑、灰度启用和外接控制台只读归档的无密钥执行步骤、证据标准和回滚口径。
- [ ] 如果启用手机号/SMS，短信宝签名、模板、通道、限流和测试发送通过 smoke；真实通道执行步骤见 external acceptance runbook。
- [ ] 外接控制台与原生模块双跑一个完整结算周期；对比维度、差异归因和证据标准见 external acceptance runbook。
- [ ] 灰度启用分销入口；灰度范围、检查项和回滚方式见 external acceptance runbook。
- [ ] 外接控制台只读归档；归档前置条件和验收证据见 external acceptance runbook。

### Phase 12 Go 测试基线复盘（2026-06-03 本线程）

- 完成内容：修复 `go test ./...` 当前基线失败：controller token model limit 测试补齐请求上下文 user group，避免测试走数据库查询后触发 closed DB；Claude OpenAI file content 转换按文件名扩展识别 PDF/text/image，PDF 转 document，text 解码为 Claude text，未知扩展跳过；`StreamScannerHandler` 仅在 `StreamStatus` 为 nil 时初始化，保留调用方预先记录的软错误。
- 验证方式：`go test -count=1 ./controller ./relay/channel/claude ./relay/helper` 通过；`go test ./...` 全量通过。网络切换后重试 `make dev-web-classic`，依赖检查可用，失败原因仅为已有 `make dev-web` 占用 `5174`；随后 `http://127.0.0.1:5173/` 和 `http://127.0.0.1:5174/` 均返回 HTTP 200。
- 残留风险：本批只修复当前 Go 基线，不扩大处理前端 typecheck 既有 baseline、截图回归缺口、SMS 真实通道 smoke 或完整结算周期双跑。
- 下一步：提交本批测试基线修复后，继续补 Phase 12 截图回归、schema impact 复核、SMS smoke 和结算周期验证。

### Phase 12 schema impact 发布复核（2026-06-03 本线程）

- 完成内容：新增 `native-affiliate-schema-impact-report.zh-CN.md`，汇总 affiliate sidecar、SMS sidecar 和 quota source sidecar 三组本地 PostgreSQL schema snapshot/diff；复核 `model.AffiliateSidecarModels()` 当前 15 个 `affiliate_*` 模型、`model.SMSSidecarModels()` 的 `sms_send_logs` / `user_phone_bindings`，以及 `model.QuotaSourceSidecarModels()` 的 `user_quota_source_balances` / `user_quota_source_events`。
- 验证方式：6 个 schema snapshot sha256 校验通过；反向过滤 `runtime/schema-impact/*.diff` 中新增/ALTER/DROP DDL，未发现非 `affiliate_*`、`sms_send_logs`、`user_phone_bindings`、`user_quota_source_*` 对象；删除 DDL 扫描无输出；`git check-ignore -v` 确认 runtime snapshot 仍被忽略；`go test -count=1 ./model -run 'QuotaSourceSidecar|AffiliateSidecarModels|MigrateDBCreatesAffiliateSidecar'` 通过。
- 残留风险：本复核只覆盖本地 dev PostgreSQL snapshot，不能替代 staging/生产发布前现场 schema impact；后续修改 sidecar 字段或索引时必须重新导出 before/after schema。
- 下一步：继续补 Phase 12 截图回归、SMS 真实通道 smoke、完整结算周期双跑和灰度/归档流程。

### Phase 12 Playwright 截图回归复盘（2026-06-03 本线程）

- 完成内容：将 Phase 12 截图回归缺口从普通用户/profile disabled/模块关闭补齐到 classic 分销页 7 场景；修复 classic 看板在 `/api/affiliate/summary` 返回失败或 null summary 时读取 `rule_status` 抛错的问题，保证管理员 global scope 无 summary 数据时也不会整页崩溃。
- 验证方式：`bun test web/classic/src/pages/Affiliate/affiliateDashboardCards.test.mjs web/classic/src/pages/Affiliate/affiliateViewState.test.mjs web/classic/src/hooks/usage-logs/usageLogsUrls.test.mjs` 9/9 通过；`cd web/classic && bun run build` 通过；`runtime/smoke/node_modules/.bin/playwright test --config=runtime/smoke/playwright.config.cjs` 7/7 通过；`runtime/smoke/node_modules/.bin/playwright test --config=runtime/smoke/playwright.default.config.cjs` 1/1 通过并输出 default 7 场景复核结果。
- 残留风险：本轮为本地恢复库 + ignored runtime smoke 验证；没有提交截图或测试账号；default 管理端规则/佣金/结算逐按钮 smoke、SMS 真实通道 smoke 和完整结算周期双跑仍未覆盖。
- 下一步：继续 SMS 真实通道 smoke、完整结算周期双跑、灰度启用和外接控制台归档。

### Phase 12 外部验收 runbook 复盘（2026-06-03 本线程）

- 完成内容：新增 `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`，把剩余外部验收拆成服务器 compose 网络内 `pg_dump`、短信宝真实通道 smoke、完整结算周期双跑、灰度启用和外接控制台只读归档五组步骤；每组都明确前置条件、不可记录的敏感字段、脱敏证据和回滚口径。
- 验证方式：本轮为文档 runbook，不执行外部服务器、真实短信宝或生产灰度操作；通过 tasklist 剩余未完成项反向核对，runbook 已覆盖每个剩余外部验收项；`git status --short` 进入本批前为空。
- 残留风险：runbook 不能替代真实执行；服务器 SSH/compose 容器信息、短信宝真实配置、外接控制台导出、生产灰度窗口和归档审批仍需用户/运维提供。
- 下一步：取得外部信息后按 runbook 执行对应验收；如业务决定继续补超大规模 scoped export，再进入新的设计/实现批次。

## Phase 13：Git 分批提交

- [x] 提交前确认 `git status --short`；2026-06-03 Phase 13 收口前工作树干净。
- [x] 不提交 dump、runtime、账号密码、生产 DSN；2026-06-03 已确认 runtime RMB smoke、截图仍由 `.gitignore` 忽略，`.codex-local/` 未进入 Git 状态。
- [x] 第 1 批：文档与基线记录。
- [x] 第 2 批：PG dump/restore 本地工具和 runbook。
- [x] 第 3 批：WSL2 docker-compose dev 部署、`new-api:dev` 镜像、PostgreSQL/Redis 本地恢复 runbook。
- [x] 第 4 批：sidecar 表、service、thin hook。
- [x] 第 5 批：规则配置表、管理员配置页、seed value。
- [x] 第 6 批：邀请归因、手机号/SMS provider、短信宝配置。
- [x] 第 7 批：scope 与 scoped 使用日志。
- [x] 第 8 批：classic 前端。
- [x] 第 9 批：default parity 与 i18n。
- [x] 第 10 批：KPI、佣金、人头费、结算。
- [x] 第 11 批：用户管理 `inviter_id` 与审计。
- [x] 每批提交前运行对应最小测试；各批验证命令和残留风险已记录在对应 Phase 复盘中。

### Phase 13 分批提交收口复盘（2026-06-03 本线程）

- 完成内容：按 `git log` 与 Phase 复盘核对原生分销本地提交批次，确认文档/基线、PG dump/runbook、dev compose、sidecar/service/thin hook、规则配置、邀请归因/SMS provider、scope/scoped logs、classic 前端、default parity、KPI/佣金/结算、用户管理 `inviter_id` 均已有对应本地 commit 和验证记录。
- 验证方式：`git log --oneline --reverse --max-count=80` 覆盖从官方基线到 `63c28932 docs: record affiliate rmb browser check` 的本地提交链；`git status --short` 为空；`git check-ignore -v` 确认 runtime RMB smoke 和截图仍被忽略。
- 残留风险：本收口只确认本地分批提交和本地验证记录，不代表 staging/生产验收；服务器 SSH/compose 容器信息、服务器内 pg_dump、SMS 真通道发送、外接控制台双跑、灰度启用和只读归档仍需外部信息或业务决策。
- 下一步：等待服务器/短信/灰度/外接控制台相关信息后再做外部验收；如业务决定继续补全量 scoped export，再新增对应设计。
