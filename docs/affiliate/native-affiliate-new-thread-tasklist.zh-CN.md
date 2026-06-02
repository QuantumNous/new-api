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
- [x] Docker 阻塞非 Docker 诊断：`/var/run/docker.sock` 存在，权限为 `root:docker` `660`，当前用户 `rain` 已在 `docker` 组；进程列表可见 Docker Desktop WSL proxy，但 daemon/server 仍未响应 `docker version`。
- [ ] 补齐或确认服务器 SSH 入口、compose 项目名、PostgreSQL 容器名；当前仓库未发现可直接使用的服务器连接 runbook。
- [x] 确认本机 `psql`、`pg_dump`、`pg_restore` 16.14 可用，本机 PostgreSQL service 未运行，符合优先使用 Docker PostgreSQL 隔离库的路径。
- [x] 因服务器 PostgreSQL 为 18.4，按 PostgreSQL 官方 PGDG APT 源安装 `postgresql-client-18`，使用 `/usr/lib/postgresql/18/bin/pg_dump` / `pg_restore` 18.4 作为快照工具。
- [x] 新增无密钥快照下载、Docker PostgreSQL 恢复、核心表行数采集 runbook 和脚本。
- [x] Docker Desktop WSL 集成修复后重跑 `docker version`、`docker info`、`docker ps`，再执行本地隔离库恢复；2026-06-02 已确认 `new-api`、`new-api-postgres`、`new-api-redis` 运行。
- [ ] 确认服务器 SSH 入口、compose 项目名、PostgreSQL 容器名。
- [ ] 在服务器 compose 网络内执行 `pg_dump --format=custom --no-owner --no-privileges`。
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
- [x] 用本地密钥文件中的三类账号完成登录 smoke，不输出密码；三类账号均 HTTP 200 / `success=true`。
- [x] 记录 compose 启停、重建、恢复 dump、清理 volume 的本地 runbook：`docs/affiliate/native-affiliate-dev-compose-runbook.zh-CN.md`。

## Phase 2：schema impact 基线

- [x] 在未开发前导出官方基线 PostgreSQL schema；严格意义上无法回到功能分支最初未开发时间点，但当前 `AffiliateSidecarModels()` 尚未接入全局 AutoMigrate，2026-06-02 已从恢复后的 compose PostgreSQL 导出 sidecar 接入前 baseline：`runtime/schema-impact/20260602T150911Z-compose-official-baseline.sql`，sha256 校验通过且 runtime 被 Git 忽略。
- [x] 建立 schema impact 脚本或手工流程。
- [x] 后续每次新增 GORM model 前后都生成 diff；2026-06-02 本次 `AffiliateSidecarModels()` 接入 AutoMigrate 已生成 before/after schema 和 diff：`runtime/schema-impact/20260602T150911Z-compose-official-baseline.sql` -> `runtime/schema-impact/20260602T152044Z-affiliate-sidecar-after.sql`，diff 保存在 `runtime/schema-impact/20260602T152044Z-affiliate-sidecar.diff`，runtime 被 Git 忽略。
- [x] 确认新增内容只包括预期 `affiliate_*` / sidecar 表和索引；2026-06-02 diff 显示新增 15 个 `affiliate_*` 表及其序列/索引/主键，反向检查未发现非 `affiliate_*` 的新增 `CREATE` / `ALTER`。
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
- [ ] 如果需要 paid/gift/trial 计佣，新增 `user_quota_source_*` sidecar 表。
- [x] `AffiliateSidecarModels()` 清单已建立；Phase 2 baseline 完成后已接入 `model/main.go` 的 `migrateDB` / `migrateDBFast` 全局 AutoMigrate。
- [x] 所有模型进入 AutoMigrate 前后跑 schema impact；2026-06-02 已在 compose PostgreSQL 上触发迁移、导出 after schema 并确认只新增 `affiliate_*` 对象。
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
- [ ] 普通用户访问分销页返回友好未开通状态；后端 `/api/affiliate/status` 已返回 `available`、`unavailable_reason` 和中文 `message`，classic `/console/affiliate` 已接入，default 前端仍待 parity。
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
- Phase 3/4 残留风险：普通用户友好状态目前只有后端 `/api/affiliate/status`，classic/default 页面展示仍未接入；Phase 3 sidecar 表已进入本地 PostgreSQL schema impact，但尚未覆盖 staging/生产。
- Phase 3/4 下一步：推进 Phase 5 邀请归因 thin hook，或先接入 classic/default 分销入口的友好未开通提示。

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
- [ ] 截图回归：普通用户、一级、二级、管理员、超级管理员、模块关闭、移动端。
- [x] 2026-06-03 classic browser smoke：用本地恢复库和三类测试账号验证 `super_admin`、一级分销、二级分销桌面，以及一级分销移动端均能访问 `/console/affiliate`；`/api/affiliate/status` 与 `/api/affiliate/logs` 均 HTTP 200 / `success=true`。

### Phase 7 classic browser smoke 复盘（2026-06-03 本线程）

- 完成内容：网络切换后确认 5173/5174 dev server 已运行；重建 `new-api:dev` 主容器使 `/api/affiliate/logs` 路由进入运行态；通过管理员 API 在本地恢复库启用 `AffiliateEnabled` 并恢复测试账号 active profile；清理本地 dev Redis 的登录限流 `CT` 键后完成 classic 分销页真实浏览器 smoke。
- 验证方式：`timeout 10s curl` 验证 3000/5173/5174；API smoke 覆盖 `super_admin` global scope、一级/二级 affiliate scope 和 logs success；`runtime/smoke/node_modules/.bin/playwright test --config=runtime/smoke/playwright.config.cjs` 4/4 通过，覆盖桌面管理员、桌面一级、桌面二级和一级移动端。临时脚本、runner、截图均位于 Git 忽略的 `runtime/smoke/`。
- 残留风险：本轮 browser smoke 为本地恢复库验证，且为跑 smoke 修改了本地库中的 `AffiliateEnabled` 和测试账号 profile；普通用户、profile disabled、模块关闭、完整管理员管理页和 default 分销前端仍未做 browser 回归。
- 下一步：补普通用户/profile disabled/模块关闭截图回归；随后做 default parity，或继续 Phase 7 统计看板/RMB 主显示。

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
- [ ] default 真实账号 browser smoke：管理员/一级/二级/普通用户/profile disabled/模块关闭/移动端。

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

## Phase 9：RMB 单位

- [x] 梳理 classic 分销页面字段单位：统计看板金额卡、scoped 使用日志花费列；classic 管理员分销 profile 页暂无金额字段。
- [x] classic 分销页面金额主显示 RMB：看板和 scoped 使用日志花费列均使用站内 `quota_per_unit` 与 `usd_exchange_rate` 换算 RMB，不跟随 `quota_display_type=TOKENS/CUSTOM` 改变主单位。
- [x] default 分销页面金额主显示 RMB：看板和 scoped logs 花费列均以 RMB 为主单位，原始 quota 保留为 tooltip/说明。
- [ ] default 复用 `formatQuotaWithCurrency()`。
- [x] classic 原始 quota/token 仅保留 tooltip、调试字段或导出附加列；scoped 使用日志花费列 tooltip 保留原始 quota。
- [ ] 用真实账号数据核对页面 RMB 值。
- [ ] 导出文件同时包含 RMB 主字段和原始 quota 附加字段。

### Phase 9 classic RMB 使用日志复盘（2026-06-03 本线程）

- 完成内容：新增 classic affiliate quota RMB helper，按 `quota_per_unit` 与 `status.usd_exchange_rate` 将 quota 换算为 RMB；`/console/affiliate` scoped 使用日志花费列在 affiliate mode 下主显示 RMB，原始 quota 仅放入 tooltip；订阅抵扣 tooltip 同步改为 RMB 等价金额加原始 quota。
- 验证方式：`bun test src/helpers/affiliateQuota.test.mjs src/hooks/usage-logs/usageLogsUrls.test.mjs src/pages/Affiliate/affiliateDashboardCards.test.mjs src/pages/Affiliate/affiliateViewState.test.mjs` 12/12 通过；`cd web/classic && bun run build` 通过。
- 残留风险：本批未跑真实账号浏览器核对；default 分销前端、导出字段和真实账号 RMB 值核对仍待后续 Phase 8/9。
- 下一步：推进 default parity，或用本地恢复库账号做 RMB 页面核对并补截图回归。

## Phase 10：KPI、佣金、人头费与结算

- [ ] 以飞书分销方案作为默认 seed value，不直接硬编码到计算逻辑。
- [ ] 管理员端提供规则集草稿、发布、停用、生效时间配置。
- [ ] 管理员端可配置一级/二级分销商的消耗区间、基准比例、最高 cap。
- [ ] 管理员端可配置特殊大客户人工审批比例和启用条件。
- [ ] 管理员端可配置 KPI 档位名称、有效新用户阈值、净付费消耗阈值、系数。
- [ ] 管理员端可配置质量门槛：纯赠金占比、异常用户占比、二次付费率、退款/争议扣回。
- [ ] 管理员端可配置人头费有效用户定义和各档位人头费金额。
- [ ] 管理员端可配置结算周期、冻结时间、最小结算金额、人工审核开关。
- [x] 后端管理员 API 支持规则集草稿保存、发布、归档和生效时间配置，并写入配置审计日志。
- [x] 发布规则前校验一级最高档不超过 30% 业务 cap。
- [x] 发布规则前校验二级有效比例不高于一级，避免倒挂。
- [ ] 佣金、KPI 快照、结算单必须记录规则集版本。
- [ ] 实现保留单用户累计净付费消耗区间的分佣规则。
- [ ] 实现 KPI 系数，最低 1，其他档位大于 1。
- [ ] 一级分销商最高档有效分佣可达 30%，但不超过业务 cap。
- [ ] 佣金只统计 paid 来源净消耗。
- [ ] 支持退款/负向日志扣回。
- [ ] 实现人头费条件：首次付费、最低净付费、周期净付费等。
- [ ] 实现 KPI 快照。
- [ ] 实现 pending 佣金明细。
- [ ] 实现结算单生成、冻结、作废、标记已支付。
- [ ] 分销商只读自己的佣金/结算。
- [ ] 管理员可全局管理规则、佣金和结算。

### Phase 10 阶段复盘（2026-06-03 后端规则集 API）

- 完成内容：新增规则集后端服务和管理员 API，支持 draft 保存、published 发布、archived 归档、旧 published 自动归档、配置快照、配置审计日志；规则输入覆盖一级/二级分佣区间、人工审批开关、KPI 档位、质量门槛、人头费条件和结算周期。
- 验证方式：已运行 `go test -count=1 ./service -run 'AffiliateRuleSet|RuleSet'` 和 `go test -count=1 ./controller -run 'AffiliateRuleSet|RuleSet'`，覆盖草稿持久化、发布归档、发布前持久化配置复校、列表过滤、后台权限、一级 30% cap、二级不倒挂、KPI 系数最低 1、生效时间窗口。
- 残留风险：尚未实现管理员前端规则配置页；尚未接入真实佣金、KPI 快照、人头费事件和结算单生成；本批未跑 Docker/PostgreSQL schema smoke，仍依赖已有 sidecar schema 迁移验证。
- 下一步：继续补规则集管理 UI 或优先实现佣金/KPI/结算计算切片，并为规则集版本贯穿事件、快照、结算单。

## Phase 11：用户管理 `inviter_id`

- [ ] 在用户管理编辑页增加邀请人 ID 字段。
- [ ] 支持按用户 ID/用户名检索邀请人。
- [ ] 保存前显示原邀请人、新邀请人、影响路径预览。
- [ ] 保存时校验不能形成无效或循环关系。
- [ ] 保存后写入审计日志。
- [ ] 变更后失效相关分销 scope 缓存。
- [ ] 增加管理员/普通用户权限测试。

## Phase 12：发布与回归

- [ ] 本地通过核心 Go 测试。
- [ ] 复核并修复/隔离当前 `go test ./...` 基线失败：根包缺少 `web/classic/dist` embed，controller 现有 model list 测试失败，Claude relay 与 stream scanner 现有测试失败；本批 affiliate 定向测试已通过。
- [x] classic 前端构建通过。
- [x] default 前端构建或 typecheck 通过（2026-06-03 `cd web/default && bun run build` 通过；typecheck 仍有既有 baseline，见 Phase 8 复盘）。
- [ ] Playwright 截图回归通过；classic 分销页管理员/一级/二级/移动端 2026-06-03 已通过，普通用户、profile disabled、模块关闭和 default 仍待补齐。
- [ ] schema impact 报告无非预期官方表改动。
- [x] 用服务器 PG 快照完成真实账号 smoke；2026-06-03 在本地恢复库中用三类测试账号完成 API smoke 和 classic browser smoke，未输出用户名、密码、cookie 或 token。
- [ ] 管理员端规则配置页面可修改分佣比例、KPI 阈值、系数、人头费、质量门槛和结算周期。
- [ ] 如果启用手机号/SMS，短信宝签名、模板、通道、限流和测试发送通过 smoke。
- [ ] 外接控制台与原生模块双跑一个完整结算周期。
- [ ] 灰度启用分销入口。
- [ ] 外接控制台只读归档。

## Phase 13：Git 分批提交

- [ ] 提交前确认 `git status --short`。
- [ ] 不提交 dump、runtime、账号密码、生产 DSN。
- [ ] 第 1 批：文档与基线记录。
- [ ] 第 2 批：PG dump/restore 本地工具和 runbook。
- [ ] 第 3 批：WSL2 docker-compose dev 部署、`new-api:dev` 镜像、PostgreSQL/Redis 本地恢复 runbook。
- [ ] 第 4 批：sidecar 表、service、thin hook。
- [ ] 第 5 批：规则配置表、管理员配置页、seed value。
- [ ] 第 6 批：邀请归因、手机号/SMS provider、短信宝配置。
- [ ] 第 7 批：scope 与 scoped 使用日志。
- [ ] 第 8 批：classic 前端。
- [x] 第 9 批：default parity 与 i18n。
- [ ] 第 10 批：KPI、佣金、人头费、结算。
- [ ] 第 11 批：用户管理 `inviter_id` 与审计。
- [ ] 每批提交前运行对应最小测试。
