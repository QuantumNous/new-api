# 官方主线与定制能力合并实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将官方 `upstream/main` 的全部更新接入集成分支，同时保留 Agent、CXM、排行榜和 `actual_base_url` 等当前定制能力，并通过可回滚的构建、迁移和回归门禁。

**Architecture:** 以官方 `upstream/main` 创建唯一长期骨架，先完成 `web/default → web`、RelayKit、plugins、认证和计费基础迁移，再按数据层、服务层、接口层、前端层顺序回迁定制能力。每个阶段独立提交并运行对应测试，最终通过三方数据库、前后端构建和生产 staging 演练后再合并。

**Tech Stack:** Go 1.22+, Gin, GORM v2, SQLite/MySQL 5.7.8+/PostgreSQL 9.6+, React 19, TypeScript, TanStack Router/Query, Bun, RelayKit, sandboxed JS task plugins.

**Spec:** `docs/superpowers/specs/2026-09-09-official-mainline-custom-integration-design.md`

## Global Constraints

- 以 `upstream/main=9bf328d97` 为集成基线，禁止直接在 `custom`、`main` 或生产环境合并。
- 保留 Agent、CXM 迁移/回滚、排行榜、`actual_base_url`、定制镜像和相关审计语义。
- 保护项目标识 `new-api` 和 `QuantumNous`，不修改、删除或替换相关引用。
- 后端 JSON 编解码使用 `common.*` 包；数据库操作使用 GORM 并同时兼容 SQLite、MySQL、PostgreSQL。
- 官方认证、计费、协议转换、数据库兼容和安全修复优先采用官方实现；定制功能必须改接新接口。
- 不用批量 `ours`/`theirs` 解决冲突；每个冲突文件必须记录业务决策和回归测试。
- 前端长期路径为官方 `web/src`；不得重新建立 `web/default` 和 `web/classic` 的长期双轨构建。
- 不修改现有未跟踪 CSV、任务卡和工作区资料；每次提交只暂存本任务文件。
- 所有计费、额度、退款、订阅和兑换路径必须保留非负额度、饱和转换、审计和幂等不变量。

---

### Task 1: 冻结基线并创建集成工作区

**Files:**
- Create: `docs/superpowers/specs/2026-09-09-official-mainline-custom-integration-design.md`（已完成）
- Create: `docs/superpowers/plans/2026-09-09-official-mainline-custom-integration.md`（本计划）
- Create: `docs/superpowers/evidence/2026-09-09-official-mainline-custom-baseline.md`

**Interfaces:**
- Produces: 集成分支名、共同基线、当前/官方 commit、未跟踪文件清单、构建和数据库快照清单。

- [ ] **Step 1: 保存当前工作区证据**

```bash
git status --short --branch > /tmp/new-api-status.txt
git rev-parse HEAD > /tmp/new-api-head.txt
git rev-parse upstream/main > /tmp/new-api-upstream.txt
git diff --check > /tmp/new-api-diff-check.txt
git ls-files --others --exclude-standard > /tmp/new-api-untracked.txt
```

将输出中的 commit、分支和未跟踪路径写入 `docs/superpowers/evidence/2026-09-09-official-mainline-custom-baseline.md`，不得复制 CSV 内容。

- [ ] **Step 2: 创建隔离分支**

```bash
git switch -c codex/official-mainline-custom-integration upstream/main
```

Expected: 新分支指向 `9bf328d97`，`custom` 工作树仍保持原样。

- [ ] **Step 3: 记录共同基线和差异统计**

```bash
BASE=$(git merge-base custom upstream/main)
git rev-list --left-right --count custom...upstream/main
git diff --shortstat custom..upstream/main
git merge-tree --write-tree --messages custom upstream/main > /tmp/new-api-merge-tree.txt 2>&1 || true
```

Expected: 记录 79/244 提交分叉、约 2,802 个文件差异和 59 个潜在冲突，作为后续验收基准。

- [ ] **Step 4: 提交基线文档**

```bash
git add docs/superpowers/specs/2026-09-09-official-mainline-custom-integration-design.md docs/superpowers/plans/2026-09-09-official-mainline-custom-integration.md docs/superpowers/evidence/2026-09-09-official-mainline-custom-baseline.md
git commit -m "docs: define official mainline custom integration"
```

### Task 2: 验证官方骨架和依赖变更

**Files:**
- Modify: `go.mod`, `go.sum`
- Modify: `Dockerfile`, `Dockerfile.dev`, `docker-compose.yml`, `docker-compose.dev.yml`
- Modify: `makefile`, `.env.example`
- Add/modify: `relaykit/`, `plugins/`, `.github/workflows/ci.yml`
- Test: `common/`, `relay/`, `relaykit/`, `plugins/` existing Go tests

**Interfaces:**
- Consumes: 官方 `upstream/main` tree。
- Produces: 能独立构建的官方后端、RelayKit、plugins 和开发容器基线。

- [ ] **Step 1: 检查官方依赖和构建入口**

```bash
go mod download
go test ./common ./relay/... ./relaykit/... ./plugins/... -count=1
go vet ./...
```

Expected: 官方骨架测试通过；若失败，只修复依赖锁、模块路径或官方构建入口，不迁入定制业务。

- [ ] **Step 2: 验证三种数据库初始化**

使用仓库现有测试 fixture 分别运行 SQLite、MySQL、PostgreSQL 初始化和 AutoMigrate，记录 schema 差异；禁止使用开发机默认数据库替代明确 fixture。

- [ ] **Step 3: 提交官方骨架检查点**

```bash
git add go.mod go.sum Dockerfile Dockerfile.dev docker-compose.yml docker-compose.dev.yml makefile .env.example relaykit plugins .github/workflows/ci.yml
git commit -m "chore: establish official mainline runtime baseline"
```

### Task 3: 完成官方前端目录迁移

**Files:**
- Create/move: `web/src/**` from official tree
- Remove after verification: `web/default/**`, `web/classic/**`
- Modify: `Dockerfile`, `makefile`, `.github/workflows/ci.yml`, root frontend scripts
- Test: `web/package.json`, `web/bun.lock`, `web/vitest.config.ts`

**Interfaces:**
- Consumes: 官方 `web/src`、官方前端脚本和组件路径。
- Produces: 唯一 `web` 前端构建入口，供后续定制 feature 回迁。

- [ ] **Step 1: 检查目录引用**

```bash
rg -n "web/default|web/classic|default/src|classic/src" --glob '!docs/superpowers/evidence/**' .
```

将每个命中分为构建入口、文档、源码导入三类；源码和 CI 只能指向 `web`。

- [ ] **Step 2: 运行官方前端检查**

```bash
cd web
bun install --frozen-lockfile
bun run typecheck
bun run test --run
bun run build
cd ..
```

Expected: 官方前端可以单独完成安装、类型检查、测试和生产构建。

- [ ] **Step 3: 删除旧构建入口并提交**

确认 Docker、makefile 和 CI 不再读取旧目录后，删除旧双轨前端的构建入口并提交：

```bash
git add web Dockerfile makefile .github/workflows/ci.yml
git commit -m "refactor(web): adopt official root frontend"
```

### Task 4: 解决官方后端冲突并接入认证、计费和 RelayKit

**Files:**
- Modify: `controller/audit.go`, `controller/channel-billing.go`, `controller/channel.go`, `controller/channel_upstream_update.go`, `controller/log.go`, `controller/oauth.go`, `controller/ratio_sync.go`, `controller/relay.go`, `controller/video_proxy.go`
- Modify: `model/log.go`, `model/main.go`, `model/redemption.go`, `model/subscription.go`, `model/user.go`
- Modify: `relay/common/relay_info.go`, `relay/relay_task.go`, `router/api-router.go`, `service/task_polling.go`
- Test: corresponding `*_test.go`, `relaykit/*_test.go`, `service/*billing*_test.go`

**Interfaces:**
- Consumes: 官方认证、模型、计费、RelayKit、插件接口。
- Produces: 定制层可调用的用户、渠道、日志、额度和任务接口；不保留旧协议转换副本。

- [ ] **Step 1: 建立冲突清单和决策表**

```bash
git merge-tree --write-tree --messages custom upstream/main > /tmp/new-api-merge-tree.txt 2>&1 || true
rg '^CONFLICT' /tmp/new-api-merge-tree.txt | grep -v '/web/' > /tmp/new-api-backend-conflicts.txt
```

将 19 个非前端冲突按“官方安全/计费/协议优先，定制业务调用改接新接口”记录到本任务提交说明中。

- [ ] **Step 2: 先处理 DTO 和 RelayInfo 边界**

把官方 `relaykit` DTO、模型修饰符、usage 字段和任务轮询上下文接入 `relay/common/relay_info.go`、`relay/relay_task.go`；保留定制字段时使用独立字段，不复用官方字段表达不同语义。

- [ ] **Step 3: 处理用户、日志、充值和认证冲突**

将 Agent/CXM 所需字段和调用点暂时保留为明确的定制扩展，采用官方用户会话、访问令牌审计、充值原子性和日志投影逻辑。所有 JSON 操作走 `common.*`。

- [ ] **Step 4: 运行后端核心回归**

```bash
go test ./controller ./model ./relay/... ./router/... ./service/... -count=1
go test -race ./service/... ./model/... -count=1
```

- [ ] **Step 5: 提交后端兼容检查点**

```bash
git add controller model relay router service
git commit -m "refactor: align custom integration with official runtime"
```

### Task 5: 接入官方计费、模型修饰符和插件更新

**Files:**
- Modify: `pkg/billingexpr/**`, `setting/billing_setting/**`, `relay/helper/**`, `service/quota.go`, `service/text_quota.go`, `service/tiered_settle.go`
- Modify: `model/pricing.go`, `model/model_pricing_config.go`, `controller/ratio_sync.go`
- Modify: `plugins/**`, `relay/channel/task/**`
- Test: `pkg/billingexpr/*_test.go`, `service/tiered_settle_test.go`, `service/text_quota_test.go`, `relay/helper/*price*_test.go`

**Interfaces:**
- Consumes: 官方 `tiered_expr`、模型 canonical billing identity、缓存/Responses/tool usage 和 JS plugin usage schema。
- Produces: Agent/CXM/排行榜可读取的最终结算日志语义。

- [ ] **Step 1: 固定官方计费行为**

```bash
go test ./pkg/billingexpr/... ./service/... ./relay/helper/... -run 'Tier|Quota|Billing|Price|Usage' -count=1
```

确认 `len` 阶梯条件、预扣/结算、失败保留预扣、缓存 Token 分离、重试换组和额度饱和保护均由官方路径执行。

- [ ] **Step 2: 合并定制调用点**

排行榜只读取成功结算日志；Agent/CXM 充值、退款、订阅和套餐码不直接计算 Token 费用，不复制旧的 quota 转换逻辑。

- [ ] **Step 3: 验证模型修饰符和插件**

```bash
go test ./controller ./model ./plugins/... ./relay/channel/task/... -count=1
```

- [ ] **Step 4: 提交计费和插件检查点**

```bash
git add pkg/billingexpr setting/billing_setting relay/helper service/quota.go service/text_quota.go service/tiered_settle.go model/pricing.go model/model_pricing_config.go controller/ratio_sync.go plugins relay/channel/task
git commit -m "feat: retain official billing and plugin semantics"
```

### Task 6: 回迁 Agent 数据模型、迁移和绑定服务

**Files:**
- Modify: `model/user.go`, `model/agent_*.go`, `model/redemption.go`, `model/subscription.go`
- Create/modify: `model/agent_customer_test.go`, `service/agent_bind.go`, `service/agent_bind_test.go`
- Modify: `model/main.go` migration registration
- Test: SQLite/MySQL/PostgreSQL migration fixtures

**Interfaces:**
- Consumes: 官方 `model.User`、`AgentAccount`、`Redemption`、`UserSubscription` 和 cache APIs。
- Produces: `service.TryBindUserToAgent(userID int, agentID int) (bool, error)`；不可变的首绑语义和三数据库字段迁移。

- [ ] **Step 1: 写首绑回归测试**

覆盖未绑定、已绑定不可替换、禁用代理可保留历史归属、无效代理拒绝、并发首绑只有一个成功者。

- [ ] **Step 2: 运行失败测试**

```bash
go test ./service ./model -run 'TestTryBindUserToAgent|TestBoundAgent' -count=1
```

- [ ] **Step 3: 按官方模型结构添加字段和迁移**

使用 `bound_agent_id`、`bound_at` 的索引字段和 GORM 迁移；更新只允许 `bound_agent_id = 0`，成功写入后才清理用户缓存。

- [ ] **Step 4: 运行三数据库验证并提交**

```bash
go test ./model ./service -run 'TestTryBindUserToAgent|TestBoundAgent|Migration' -count=1
git add model service controller
git commit -m "feat: restore agent ownership on official models"
```

### Task 7: 回迁 Agent/CXM 服务、接口和审计

**Files:**
- Modify: `controller/agent.go`, `controller/agent_admin.go`, `controller/agent_customer.go`, `controller/audit.go`, `controller/user.go`, `controller/oauth.go`, `controller/redemption.go`
- Modify: `service/agent_*.go`, `service/redemption*.go`, `service/subscription*.go`
- Modify: `tools/cxm_migration/{audit,bundle,import,inplace,rollback,source,transform,types}.go`
- Modify: `router/api-router.go`, `router/web-router.go`
- Test: `controller/agent*_test.go`, `service/agent*_test.go`, `tools/cxm_migration/*_test.go`, `model/*redemption*_test.go`

**Interfaces:**
- Consumes: Task 6 的绑定服务、官方认证会话、访问令牌审计和充值/订阅事务。
- Produces: Agent 客户只读查询、积分/套餐码/订单/兑换/退款、CXM dry-run/审计/回滚投影 API。

- [ ] **Step 1: 先迁移 DTO 和权限边界**

客户 DTO 只返回用户 ID、用户名、显示名、状态、注册/登录时间、额度、订阅摘要和绑定时间；不返回密码、AccessToken、Token Key、邮箱、IP 或管理员字段。

- [ ] **Step 2: 接入官方会话和审计**

所有 Agent 请求从当前登录会话取得代理身份，禁止接受客户端传入的 `agent_user_id` 作为范围；所有积分、兑换、退款、迁移和回滚写操作写入官方审计日志。

- [ ] **Step 3: 接入注册和兑换绑定**

修改官方密码注册、OAuth 注册和兑换码成功流程，在用户/兑换事务提交后调用 `service.TryBindUserToAgent`；绑定失败记录系统错误但不改变原注册或兑换结果。

- [ ] **Step 4: 迁移 CXM 状态机**

保留现有 dry-run、批量投影、状态锁、计数校验、时间戳保护和可逆回滚；迁移脚本通过官方模型访问数据库，不使用 PostgreSQL 专属语法。

- [ ] **Step 5: 运行接口和状态测试**

```bash
go test ./controller ./service ./model -run 'Agent|CXM|Redemption|Subscription|Audit' -count=1
go test -race ./controller ./service -run 'Agent|CXM' -count=1
```

- [ ] **Step 6: 提交定制后端检查点**

```bash
git add controller service model router
git commit -m "feat: restore agent and cxm services on official mainline"
```

### Task 8: 回迁排行榜和用量统计

**Files:**
- Modify: `controller/log.go`, `service/log_info_generate.go`, `model/log.go`
- Modify: `controller/rankings.go`, `service/rankings.go`, `model/log_ranking.go`, `model/usedata_rankings.go`
- Test: `controller/log_ranking_test.go`, `model/log_ranking_test.go`
- Modify: `router/api-router.go`
- Test: ranking aggregation, pagination, sorting and log semantics tests

**Interfaces:**
- Consumes: 官方成功结算日志、模型/渠道字段、服务器端排序和新的日志投影。
- Produces: 排行榜聚合 API，包含用户、请求数、总 Token、输入/输出 Token、额度、模型和渠道分布。

- [ ] **Step 1: 固定统计语义**

只统计官方成功消费日志；明确时间窗口、用户/模型/渠道维度、分页排序和空值处理，禁止从前端分页数据重新聚合。

- [ ] **Step 2: 适配官方日志投影**

读取官方 `LogOther` 投影和权限过滤后的字段；管理员可查看审计字段，普通用户不接触 `admin_info`、密钥、请求体和上游敏感字段。

- [ ] **Step 3: 运行聚合回归**

```bash
go test ./controller ./service ./model -run 'Ranking|Usage.*Log|Log.*Quota' -count=1
```

- [ ] **Step 4: 提交排行榜检查点**

```bash
git add controller/log.go controller/rankings.go service/rankings.go model/log.go model/log_ranking.go model/usedata_rankings.go router/api-router.go
git commit -m "feat: restore usage ranking on official logs"
```

### Task 9: 回迁 `actual_base_url` 地址隔离

**Files:**
- Modify: `model/channel.go`, `controller/channel.go`, `controller/channel-billing.go`, `controller/channel-test.go`, `controller/channel_upstream_update.go`
- Modify: `relay/common/relay_info.go`, `relay/relay_task.go`, `relay/mjproxy_handler.go`, `relay/channel/**`, `controller/codex_usage.go`, `controller/ratio_sync.go`, `controller/task_video.go`, `controller/video_proxy.go`, `controller/video_proxy_gemini.go`, `service/task_polling.go`
- Modify: `service/channel_sanitize.go`, `tests/service/channel_sanitize_test.go`
- Modify: `web/src/features/channels/**`, `web/src/features/channels/components/**`
- Test: controller, relay and frontend channel permission tests

**Interfaces:**
- Consumes: 官方渠道模型、RelayKit channel metadata、认证会话和请求错误投影。
- Produces: `GetRuntimeBaseURL` 使用真实地址；展示、错误、日志和普通管理员接口使用脱敏地址；只有超管可读取/修改真实地址。

- [ ] **Step 1: 写地址权限回归**

覆盖超管读取/修改、普通管理员脱敏、非超管不能清空真实地址、渠道测试和上游错误不泄露真实地址。

- [ ] **Step 2: 接入官方渠道和 RelayKit 路径**

所有出站请求统一调用运行时 URL 方法；展示 DTO、日志 DTO、错误响应和测试结果统一调用脱敏方法；删除旧路径中直接读取 `BaseURL` 的调用。

- [ ] **Step 3: 迁移官方前端渠道编辑器**

在 `web/src/features/channels` 中加入超管可见字段、脱敏显示和更新反馈，所有文本走 i18n。

- [ ] **Step 4: 运行验证并提交**

```bash
go test ./controller ./relay/... ./service -run 'Channel|BaseURL|URL' -count=1
cd web && bun run typecheck && bun run test --run && cd ..
git add model/channel.go controller relay service/channel_sanitize.go tests/service/channel_sanitize_test.go web/src/features/channels
git commit -m "feat: restore protected runtime channel URLs"
```

### Task 10: 迁移 Agent、排行榜和渠道地址前端

**Files:**
- Create/modify: `web/src/features/agents/**`
- Create/modify: `web/src/features/usage-ranking/**`
- Modify: `web/src/features/channels/**`, `web/src/features/usage-logs/**`, `web/src/routes/**`
- Modify: `web/src/i18n/locales/{en,zh,fr,ja,ru,vi}.json`
- Test: feature tests and route tests under `web/src/**/__tests__/**`

**Interfaces:**
- Consumes: Task 7–9 的 API DTO、官方 TanStack Query/Router、官方数据表格和权限 hooks。
- Produces: 官方 `web` 根目录中的 Agent、排行榜、CXM 状态、客户日志和真实地址页面。

- [ ] **Step 1: 迁移 API 类型和查询 hooks**

先迁移请求/响应类型、分页参数、错误处理和缓存键，再迁移页面组件；删除对 `web/default` 相对路径和旧 Classic API 的引用。

- [ ] **Step 2: 迁移权限和刷新语义**

复用官方认证状态和路由保护；Agent 余额、兑换、订单、CXM 状态和排行榜刷新使用官方 query invalidation，不直接修改缓存对象。

- [ ] **Step 3: 补齐 i18n**

运行项目 i18n 同步工具并检查六种语言键集合一致：

```bash
cd web
bun run i18n:sync
bun run typecheck
cd ..
```

- [ ] **Step 4: 运行前端检查并提交**

```bash
cd web
bun run test --run
bun run build
cd ..
git add web/src
git commit -m "feat(web): restore custom features on official frontend"
```

### Task 11: 全量兼容验证、staging 演练和发布准备

**Files:**
- Modify: `docs/superpowers/evidence/2026-09-09-official-mainline-custom-baseline.md`
- Create: `docs/superpowers/evidence/2026-09-09-official-mainline-custom-validation.md`
- Modify only when required: `Dockerfile`, `docker-compose.production-staging.yml`, deployment scripts
- Test: full backend/frontend/database/production-staging checks

**Interfaces:**
- Consumes: Tasks 1–10 的所有检查点和迁移脚本。
- Produces: 可审计的验收记录、镜像 digest、数据库迁移结果、回滚命令和合并候选 commit。

- [ ] **Step 1: 执行静态和后端全量检查**

```bash
git diff --check
rg -n '<<<<<<<|=======|>>>>>>>' --glob '!*.csv' .
go test ./...
go vet ./...
```

Expected: 无冲突标记，Go 全量测试和 vet 通过。

- [ ] **Step 2: 执行前端全量检查**

```bash
cd web
bun install --frozen-lockfile
bun run typecheck
bun run test --run
bun run build
cd ..
```

- [ ] **Step 3: 执行三种数据库迁移矩阵**

对 SQLite、MySQL 5.7.8+、PostgreSQL 9.6+分别执行：空库初始化、共同基线数据升级、Agent/CXM 字段迁移、索引检查、排行榜聚合查询、回滚投影和再次启动 AutoMigrate。记录表结构、行数、索引和错误输出。

- [ ] **Step 4: 执行 staging 生产链路演练**

构建当前集成镜像并在 staging 启动；验证登录、模型列表、普通 relay、分档计费、缓存计费、Agent 兑换/退款、CXM dry-run/回滚、排行榜、渠道测试和真实地址脱敏。只使用脱敏请求和测试账户，不读取客户请求体。

- [ ] **Step 5: 验证回滚**

保存上一版本镜像 digest、数据库备份和迁移前 schema；演练应用回滚、CXM 投影回滚和数据库恢复顺序，确认回滚后官方日志、额度、Agent 绑定和审计记录仍可读取。

- [ ] **Step 6: 生成合并候选并提交验证记录**

```bash
git status --short --branch
git log --oneline --decorate --max-count=20
git show --stat --oneline HEAD
git add docs/superpowers/evidence/2026-09-09-official-mainline-custom-validation.md
git commit -m "test: validate official mainline custom integration"
```

只有验证记录完整、所有门禁通过后，才允许创建 PR；本计划不包含直接合并到 `main` 或生产部署。

## 合并完成后的审查重点

1. 官方新 `web` 路径是否仍残留 `web/default` 或 `web/classic` 的构建引用。
2. Agent/CXM 是否意外绕过官方会话、审计、额度和事务边界。
3. 排行榜是否使用官方成功结算日志，而不是预扣日志、失败日志或前端分页结果。
4. `actual_base_url` 是否在错误、日志、渠道测试和普通管理员响应中泄露。
5. 分档计费、缓存 Token、Responses、工具调用和重试换组是否仍走官方 billingexpr 结算链。
6. 三种数据库的迁移是否都可重复执行，CXM 回滚是否没有覆盖历史数据。
7. 生产镜像、数据库备份、回滚命令和未跟踪工作区资料是否保持可恢复状态。
