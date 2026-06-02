# 新线程执行 Tasklist

更新日期：2026-06-02

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
- [ ] 普通用户访问分销页返回友好未开通状态；后端 `/api/affiliate/status` 已返回 `available`、`unavailable_reason` 和中文 `message`，实际页面展示仍待 classic/default 前端接入。
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
- [ ] 管理员端提供短信 provider、签名、模板、限流和测试发送配置页面。
- [x] 增加短信宝 provider 发送成功和错误码映射单元测试。
- [x] 增加 SMS 模板缺失、签名未备案/未审核通过场景测试。
- [x] 增加 SMS 限流完整发送链路场景测试。
- [ ] 增加签名未备案完整发送链路场景测试。
- [ ] 新增 `user_phone_bindings` sidecar 表设计和 schema impact，不直接修改官方 `users` 表。
- [x] 新增 `sms_send_logs` sidecar 表设计和本地 AutoMigrate schema 验证，日志只记录脱敏手机号、场景、provider、模板版本、返回码和耗时。
- [ ] 如 Docker 稳定，集中用本地 PostgreSQL dump 复核 `sms_send_logs` schema impact。

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
- 残留风险：当前限流为进程内内存实现，未接 Redis/多实例共享；管理员前端限流配置入口未实现；签名未备案的 controller 完整发送链路测试仍待补；真实手机号注册/登录验证码发送入口尚未实现。
- 下一步：补签名未备案完整发送链路测试，或设计 `user_phone_bindings` sidecar。

## Phase 6：分销 scope 与 scoped 使用日志

- [ ] 实现一级/二级/二级下线三层 scope。
- [ ] 一级分销商可见二级分销商及二级下线。
- [ ] 二级分销商只可见自己的下线。
- [ ] 普通用户不可查分销 scope。
- [ ] 管理员/超级管理员默认全局。
- [ ] 实现 scoped 使用日志 API。
- [ ] scoped 使用日志隐藏敏感字段。
- [ ] 支持按时间、用户、二级分销商、模型、分组、请求状态过滤。
- [ ] 复用或抽取 classic 使用日志表格/筛选/分页/移动端卡片。
- [ ] 增加越权查询测试。

## Phase 7：classic 分销前端

- [ ] 使用 Playwright/Chromium 复现一级分销商“数据看板页面渲染出错”。
- [ ] 修复 classic 分销页整页渲染错误。
- [ ] 增加组件级错误边界和分区加载状态。
- [ ] 重构分销首页为统计分析看板。
- [ ] 看板包含团队人数、有效新用户、净付费消耗、预估佣金、人头费、待结算金额、KPI 档位。
- [ ] 金额/额度主显示 RMB。
- [ ] 消耗明细复用 scoped 使用日志。
- [ ] 普通用户、profile 未启用、模块关闭、权限不足显示中文友好提示。
- [ ] 管理员无 profile 时仍可进入管理员分销管理。
- [ ] 管理员端支持指定一级/二级分销商。
- [ ] 管理员端支持编辑用户 `inviter_id` 或跳转用户管理。
- [ ] 截图回归：普通用户、一级、二级、管理员、超级管理员、模块关闭、移动端。

## Phase 8：default 分销前端

- [ ] 不直接展示英文后端错误。
- [ ] 对 classic 已完成能力做 default parity 审查。
- [ ] 使用 `.agents/skills/classic-to-default-sync` 同步 classic 重要变化。
- [ ] default 使用自身组件和 Tailwind/Base UI，不复制 Semi Design。
- [ ] 新增文案使用 i18n。
- [ ] 运行 `cd web/default && bun run i18n:sync`。
- [ ] 使用 `.agents/skills/i18n-translate` 补齐 en、zh、fr、ja、ru、vi。

## Phase 9：RMB 单位

- [ ] 梳理所有分销页面字段单位。
- [ ] classic 复用 `renderQuota` / `quota_display_type` 相关 helper。
- [ ] default 复用 `formatQuotaWithCurrency()`。
- [ ] 原始 quota/token 仅保留 tooltip、调试字段或导出附加列。
- [ ] 用真实账号数据核对页面 RMB 值。
- [ ] 导出文件同时包含 RMB 主字段和原始 quota 附加字段。

## Phase 10：KPI、佣金、人头费与结算

- [ ] 以飞书分销方案作为默认 seed value，不直接硬编码到计算逻辑。
- [ ] 管理员端提供规则集草稿、发布、停用、生效时间配置。
- [ ] 管理员端可配置一级/二级分销商的消耗区间、基准比例、最高 cap。
- [ ] 管理员端可配置特殊大客户人工审批比例和启用条件。
- [ ] 管理员端可配置 KPI 档位名称、有效新用户阈值、净付费消耗阈值、系数。
- [ ] 管理员端可配置质量门槛：纯赠金占比、异常用户占比、二次付费率、退款/争议扣回。
- [ ] 管理员端可配置人头费有效用户定义和各档位人头费金额。
- [ ] 管理员端可配置结算周期、冻结时间、最小结算金额、人工审核开关。
- [ ] 发布规则前校验一级最高档不超过 30% 业务 cap。
- [ ] 发布规则前校验二级有效比例不高于一级，避免倒挂。
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
- [ ] classic 前端构建通过。
- [ ] default 前端构建或 typecheck 通过。
- [ ] Playwright 截图回归通过。
- [ ] schema impact 报告无非预期官方表改动。
- [ ] 用服务器 PG 快照完成真实账号 smoke。
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
- [ ] 第 9 批：default parity 与 i18n。
- [ ] 第 10 批：KPI、佣金、人头费、结算。
- [ ] 第 11 批：用户管理 `inviter_id` 与审计。
- [ ] 每批提交前运行对应最小测试。
