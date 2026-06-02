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
- [x] 确认已下载本地最新 dump：`runtime/prod-pg-snapshots/new-api-prod-20260602-193617.dump`，后续默认不再直连生产数据库。
- [x] TAC/安全风险复盘：本轮已确认 `.codex-local/`、`runtime/` 未被 Git 追踪，已脱敏 tasklist 中出现的具体生产数据库端点；当前 modified files 精确敏感模式扫描无命中，dump sha256 校验通过。
- [x] 如连接信息曾在聊天、命令、日志或文档中暴露，评估是否需要更换临时数据库密码或吊销临时访问；用户已提示旧会话曾明文粘贴数据库密码，本轮建议轮换临时数据库密码或吊销临时访问，后续默认只用本地 dump。
- [ ] 解除本地 Docker daemon 阻塞；2026-06-02 本轮提权短命令确认 `docker version`、`docker info`、`docker compose version`、`docker ps` 可用，Compose 插件为 v5.1.4/5.1.1，但 `docker ps -a`、`docker compose -f docker-compose.dev.yml build new-api` 和 `docker compose -f docker-compose.dev.yml images` 均曾再次无输出挂起，compose 启动前仍需修复稳定性。
- [ ] 补齐或确认服务器 SSH 入口、compose 项目名、PostgreSQL 容器名；当前仓库未发现可直接使用的服务器连接 runbook。
- [x] 确认本机 `psql`、`pg_dump`、`pg_restore` 16.14 可用，本机 PostgreSQL service 未运行，符合优先使用 Docker PostgreSQL 隔离库的路径。
- [x] 因服务器 PostgreSQL 为 18.4，按 PostgreSQL 官方 PGDG APT 源安装 `postgresql-client-18`，使用 `/usr/lib/postgresql/18/bin/pg_dump` / `pg_restore` 18.4 作为快照工具。
- [x] 新增无密钥快照下载、Docker PostgreSQL 恢复、核心表行数采集 runbook 和脚本。
- [ ] Docker Desktop WSL 集成修复后重跑 `docker version`、`docker info`、`docker ps`，再执行本地隔离库恢复。
- [ ] 确认服务器 SSH 入口、compose 项目名、PostgreSQL 容器名。
- [ ] 在服务器 compose 网络内执行 `pg_dump --format=custom --no-owner --no-privileges`。
- [x] 在 SSH 未授权但临时生产 PostgreSQL 端点可连的情况下，通过静默 stdin 读取临时 DSN，并用本机 PGDG `pg_dump` 18.4 直连下载最新快照；未把 DSN 写入 shell history、文件、commit 或报告。
- [x] 下载到本地 runtime 目录：`runtime/prod-pg-snapshots/new-api-prod-20260602-193617.dump`。
- [x] 计算 dump sha256，并从仓库根目录执行 `sha256sum -c runtime/prod-pg-snapshots/new-api-prod-20260602-193617.dump.sha256` 校验通过。
- [x] 用 `/usr/lib/postgresql/18/bin/pg_restore --list` 验证 dump 可读；archive 显示 dump 来自 PostgreSQL 18.4，TOC Entries 283。
- [ ] 在本地 Docker PostgreSQL 恢复到隔离库。
- [ ] 采集核心表行数：`users`、`channels`、`abilities`、`options`、`logs`、`top_ups`、`affiliate_*`。
- [ ] 启动 new-api 指向本地恢复库。
- [ ] 验证 `/api/status`、`channels` 查询和登录页可用。
- [ ] 用 `Rain`、`ChengyuWang0807`、`nr_mm2z5vr` 完成本地登录 smoke，不记录密码。

## Phase 1A：WSL2 Docker Compose Dev 部署

- [x] 修复或确认 WSL2 Docker daemon 可用，命令包括 `docker version`、`docker info`、`docker compose version`、`docker ps`；当前在 Codex sandbox 下访问 Docker socket 需提权，提权后上述命令通过。
- [x] 审查现有 `docker-compose.yml`、`docker-compose.dev.yml`、`Dockerfile.dev`，确定修改 dev compose。
- [x] 本地 dev compose 主服务镜像名设为 `new-api:dev`。
- [x] 本地 dev compose 主服务容器名设为 `new-api`。
- [x] Redis 使用官方 `redis:latest`，容器名建议 `new-api-redis`。
- [x] PostgreSQL 使用官方 `postgres:latest`，容器名建议 `new-api-postgres`。
- [x] compose 内部 `SQL_DSN` 指向 `postgres` 服务，不使用生产 DSN。
- [x] compose 内部 `REDIS_CONN_STRING` 指向 `redis` 服务，不使用生产 Redis。
- [x] 使用隔离 volume 和 network，避免覆盖其他项目或旧 dev 数据。
- [ ] 构建本地镜像：`docker compose -f docker-compose.dev.yml build new-api`，确认生成 `new-api:dev`；2026-06-02 已尝试，输出停在 `Image new-api:dev Building` 后无进展，需 Docker daemon 稳定后重试。
- [ ] 启动容器：`docker compose -f <dev-compose> up -d`。
- [ ] 将 `runtime/prod-pg-snapshots/new-api-prod-20260602-193617.dump` 恢复到 compose PostgreSQL 隔离库。
- [ ] 采集核心表行数：`users`、`channels`、`abilities`、`options`、`logs`、`top_ups`、`affiliate_*`。
- [ ] 验证 `http://127.0.0.1:3000/api/status`。
- [ ] 用本地密钥文件中的三类账号完成登录 smoke，不输出密码。
- [ ] 记录 compose 启停、重建、恢复 dump、清理 volume 的本地 runbook。

## Phase 2：schema impact 基线

- [ ] 在未开发前导出官方基线 PostgreSQL schema。
- [x] 建立 schema impact 脚本或手工流程。
- [ ] 后续每次新增 GORM model 前后都生成 diff。
- [ ] 确认新增内容只包括预期 `affiliate_*` / sidecar 表和索引。
- [ ] 明确禁止改动官方核心表结构，除非有单独批准和记录。

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
- [x] `AffiliateSidecarModels()` 清单已建立，但在 Phase 2 baseline 完成前不接入 `AutoMigrate`。
- [ ] 所有模型进入 AutoMigrate 前后跑 schema impact。
- [x] 新增基础 service：scope、profile、relation、audit。
- [x] 新增 `AffiliateEnabled` 管理员配置开关，默认关闭，用于分销模块总熔断和分销码降级。
- [x] 新增基础 controller 和 `/api/affiliate/*` 路由组。

## Phase 4：分销身份与权限

- [x] 保持 `users.role` 不变。
- [x] 用 `affiliate_profiles.status=active` 派生分销身份。
- [x] 支持管理员指定一级/二级分销商（后端 service/controller/API）。
- [x] 支持启用/禁用分销 profile（后端 service/controller/API；重新启用不自动恢复已 ended relation，后续需明确恢复策略）。
- [x] 新增分销商端 middleware（普通用户需模块开启且 profile active，管理员/超级管理员默认放行并注入全局 scope）。
- [x] 新增管理员端权限校验（`/api/affiliate/admin/*` 使用 `AdminAuth`）。
- [ ] 普通用户访问分销页返回友好未开通状态。
- [x] 增加 profile 创建、启用、禁用、权限校验测试；已覆盖 profile 创建/更新/禁用/启用 happy path，以及管理员路由未登录/普通用户拒绝访问。

## Phase 5：邀请归因与初始额度

- [ ] 梳理官方密码注册、OAuth、微信、手机号注册入口。
- [ ] 设计统一 `ResolveInviteContext` / `RecordAffiliateInviteEvent` service。
- [ ] 密码注册薄 hook 接入邀请归因。
- [ ] OAuth 首次注册薄 hook 接入邀请归因。
- [ ] 微信首次注册薄 hook 接入邀请归因。
- [ ] 手机号注册如移植旧 fork，则接入相同归因链路。
- [ ] 区分普通邀请码和 active 分销商邀请码初始额度。
- [ ] 分销模块关闭时 active 分销码降级普通邀请码规则。
- [ ] `affiliate_invite_events` 记录注册方式、provider、初始额度规则和金额。
- [ ] 补充注册/OAuth/微信/手机号归因测试。

## Phase 5A：手机号/SMS 与短信宝 provider

- [ ] 只读审查旧 `projects/new-api-liu23zhi` 中手机号/SMS 登录注册实现。
- [ ] 确认官方最新基线是否已有手机号能力，避免重复移植。
- [ ] 设计 SMS provider 抽象，短信宝只是一个 provider，不把参数写死进业务代码。
- [ ] 新增短信配置模型或配置项：provider、启用状态、账号、密钥模式、endpoint、专用通道产品 ID。
- [ ] 支持短信签名后台配置，并标记备案/审核状态。
- [ ] 支持按场景配置模板：注册、登录、绑定手机号、换绑、重置密码。
- [ ] 支持模板变量：验证码、有效期、产品名、站点名。
- [ ] 支持测试发送，不在响应或日志中暴露完整验证码、手机号、ApiKey 或密码。
- [ ] 支持短信宝余额查询或状态检查入口。
- [ ] 支持手机号、IP、账号、场景维度限流。
- [ ] 手机号注册如启用，必须接入 Phase 5 的统一邀请归因和初始额度规则。
- [ ] 管理员端提供短信 provider、签名、模板、限流和测试发送配置页面。
- [ ] 增加短信发送成功、错误码、限流、模板缺失、签名未备案场景测试。

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
