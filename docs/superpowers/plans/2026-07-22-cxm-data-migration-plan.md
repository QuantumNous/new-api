# cxm Agent Data Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不写入源服务器的前提下，把源代理 `cxm` 及其客户、套餐、积分、兑换码、订阅和调用日志迁移到本地 Docker PostgreSQL，并完成可回滚的端到端业务验收。

**Architecture:** 创建一次性、可审计的 Go 迁移工具 `tools/cxm_migration`。`export` 通过本地 SSH 隧道在源 PostgreSQL 的 `REPEATABLE READ READ ONLY` 事务中生成受限迁移包；`validate` 只做冲突与数量检查；`import` 在本地目标库的单一事务中通过当前项目模型写入转换后的数据。迁移工具不改变应用运行时业务代码，验收通过 HTTP API 和数据库对账完成。

**Tech Stack:** Go 1.25、GORM v2、PostgreSQL、Docker Compose、SSH 本地端口转发、当前项目 `model`/`common` 类型、Testify `require`/`assert`。

## Global Constraints

- 源服务器只允许通过指定 SSH 私钥读取；不得执行源库 `INSERT`、`UPDATE`、`DELETE`、DDL、重启或写临时文件。
- 目标只允许是本地 `newapi-custom` Docker PostgreSQL；生产服务器不在本计划范围内。
- 迁移包、备份、真实密码、Access Token 和兑换码原文不得进入 Git、终端日志或最终答复。
- 目标导入前必须使用 `pg_dump` 备份；导入失败优先事务回滚，提交后验收失败使用备份恢复。
- JSON 编解码使用 `common.Marshal`/`common.Unmarshal`，不在业务代码直接调用 `encoding/json` 的 marshal/unmarshal。
- 目标数据库写入优先使用 GORM；只有 PostgreSQL sequence 修正使用受控、带方言检查的 SQL。
- 用户 ID、用户名、Access Token、邮箱、兑换码、计划 ID、日志 ID 任一冲突都必须阻断，不自动改写身份映射。
- 保留项目受保护的 `new-api` 和 `QuantumNous` 标识，不修改无关的未跟踪 CSV 文件。
- 每个任务结束后执行计划中列出的测试/检查，再提交独立 commit。

---

## 文件结构与职责

### 新建文件

- `tools/cxm_migration/main.go`：CLI 参数、`export`/`validate`/`import`/`report` 子命令路由；不包含业务映射细节。
- `tools/cxm_migration/types.go`：源表 DTO、迁移包 envelope、manifest、转换后的中间结构和审计报告类型。
- `tools/cxm_migration/source.go`：只读源 PostgreSQL 查询；每个查询接收同一个事务句柄，禁止写操作。
- `tools/cxm_migration/bundle.go`：使用 `common.Marshal`/`common.Unmarshal` 写入/读取受限 JSON 包和 SHA-256 manifest。
- `tools/cxm_migration/transform.go`：旧 `Package`/`Offer`/`UserPackage`/`QuotaGrant`/`Redemption`/`AgentCreditLog` 到目标模型的纯函数转换。
- `tools/cxm_migration/import.go`：目标 GORM 事务、冲突预检、插入顺序、sequence 修正和回滚错误包装。
- `tools/cxm_migration/audit.go`：逐表计数、额度守恒、余额守恒、外键和导入后报告；输出不含秘密。
- `tools/cxm_migration/transform_test.go`：固定源样本的计划、订单、退款手续费、额度拆分和状态映射测试。
- `tools/cxm_migration/README.md`：本地执行说明、环境变量名、停止条件和清理临时文件说明，不写入真实值。

### 不修改的现有文件

- `model/agent_account.go`、`model/agent_order.go`、`model/redemption.go`、`model/subscription.go`、`service/agent_customer.go`：迁移工具复用这些模型和目标业务语义，不改运行时逻辑，除非验收明确发现客户“剩余额度”展示口径错误。
- `dev/docker-compose.custom-dev.yml`：不暴露 PostgreSQL 端口、不改变现有本地数据卷。

---

## Task 1: 建立迁移工具骨架与源快照读取

**Files:**
- Create: `tools/cxm_migration/main.go`
- Create: `tools/cxm_migration/types.go`
- Create: `tools/cxm_migration/source.go`
- Create: `tools/cxm_migration/bundle.go`
- Create: `tools/cxm_migration/README.md`
- Test: `tools/cxm_migration/transform_test.go`（先放最小可编译 fixture 类型）

**Interfaces:**
- Consumes: `--source-dsn`, `--bundle`, `--agent-id`, `--customer-ids`；源 DSN 只通过环境变量或进程参数注入，不写入文件。
- Produces: `MigrationBundle`，其中包含 agent、customers、packages、offers、redemptions、credit logs、user packages、quota grants、logs、auth rows 和 manifest。

- [ ] **Step 1: 定义迁移包和源 DTO**

在 `types.go` 中定义源旧模型的最小字段集，不复制无关列。每个 DTO 的字段名称与源表实际列一致，时间使用 `int64`，金额使用 `int64`，秘密字段使用 `string` 但只进入受限包。定义 `MigrationBundle`，包含版本、agent、客户、积分、套餐/报价、兑换码、用户套餐、额度授予、日志、认证行和 manifest。

- [ ] **Step 2: 实现只读源查询**

`source.go` 使用 `gorm.Open(postgres.Open(sourceDSN), ...)` 建立源连接；在一个事务中执行 `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`。查询顺序固定为 agent 用户 → 客户用户 → agent credit → credit logs → 包/报价 → 代理兑换码 → 客户 `user_packages` → `quota_grants` → 客户 logs → 用户级 auth rows。所有查询通过 `Where("id IN ?", ids)` 或已解析的关系 ID 限定，日志按客户 ID 分批读取，禁止一次性加载不受控日志量。源表为空时返回空切片而不是错误。

- [ ] **Step 3: 实现 bundle 写入与哈希**

`bundle.go` 创建目标目录后以 `0600` 打开新文件，使用 `common.Marshal` 序列化 bundle；写完执行 `Sync`、关闭文件并计算 SHA-256。写入前拒绝已有同名 bundle，防止覆盖旧快照。`validate` 使用 `common.Unmarshal`，校验版本、agent ID、集合哈希和数量。

- [ ] **Step 4: 编译和最小 CLI 测试**

```bash
go test ./tools/cxm_migration -run TestBundle -count=1
go run ./tools/cxm_migration --help
```

预期：测试 PASS；帮助只列出 `export`、`validate`、`import`、`report`，不显示任何秘密默认值。

- [ ] **Step 5: Commit**

```bash
git add tools/cxm_migration
git commit -m "feat: add cxm migration snapshot tool"
```

## Task 2: 实现纯函数转换、冲突预检和审计规则

**Files:**
- Create: `tools/cxm_migration/transform.go`
- Modify: `tools/cxm_migration/types.go`
- Modify: `tools/cxm_migration/main.go`
- Create: `tools/cxm_migration/transform_test.go`

**Interfaces:**
- Consumes: `MigrationBundle` 和目标数据库的只读冲突摘要。
- Produces: `TransformedBundle`、`IDMap`、`AuditReport`；任何不一致返回错误而不产生部分结果。

- [ ] **Step 1: 写转换失败测试**

在 `transform_test.go` 覆盖固定输入：

```go
func TestFixedRefundFeeToBPS(t *testing.T) {
    require.Equal(t, 250, fixedFeeToBPS(80000, 2000))
    require.Equal(t, 714, fixedFeeToBPS(7000, 500))
}

func TestQuotaSplitPreservesSourceTotal(t *testing.T) {
    split, err := splitCustomerQuota(1000, 700, 200)
    require.NoError(t, err)
    assert.Equal(t, int64(100), split.WalletRemaining)
    assert.Equal(t, int64(700), split.SubscriptionRemaining)
    assert.Equal(t, int64(800), split.WalletRemaining+split.SubscriptionRemaining)
}
```

另外测试 package 8/11 映射、used/refunded 状态、合成订单批次、负数/溢出金额和重复 business key 必须返回错误。

- [ ] **Step 2: 实现套餐、报价和快照转换**

只接受 `ProductType == "subscription"` 的源包 ID `8、9、10、11`。将 `QuotaUSD * quotaPerUnit` 转成 `TotalAmount`，使用 `common.QuotaFromDecimal` 或项目已有额度转换辅助函数，禁止裸 `int` 转换。目标 `SubscriptionEntitlementSnapshot` 由目标模型构造函数生成；`AllowWalletOverflow` 使用源值，否则为目标默认行为。套餐 ID 只有在目标冲突预检通过后才保留。

- [ ] **Step 3: 实现历史订单和兑换码转换**

按 `(package_id, created_time)` 将源兑换码分组到对应 purchase credit log；订单号为 `legacy-cxm-agent-credit-<source_log_id>`，幂等键为 `legacy-cxm:<source_log_id>`。`UnitPrice = abs(delta)/quantity`，若不能整除则阻断。兑换码 type=2 映射到 `common.RedemptionCodeTypeSubscription`，填入 agent、order、plan 和 JSON 快照；Quota 固定为 0。Ultra 五枚退款码重建为订单 `refunded`、`RefundedCount=5`、`RefundedAmount=390000`。

- [ ] **Step 4: 实现客户订阅与额度拆分**

按旧 `user_package.id` 匹配 `quota_grants.source_type='user_package'` 和 `source_id`，计算 `AmountTotal`、`AmountUsed`、active/expired 状态。用户目标 `quota` 只写非订阅活跃 grant 剩余量；`used_quota` 原样复制。对每个客户检查：

```text
target.wallet_remaining + target.active_subscription_remaining == source.users.quota
```

不能识别的 grant source、pending 套餐和没有可映射计划的记录都阻断导入，而不是静默丢弃。

- [ ] **Step 5: 实现账本、用户和日志转换**

旧 credit event 映射为目标 `admin_credit`、`admin_debit`、`purchase`、`refund`。为 purchase/refund 填入目标 order/redemption ID；业务键使用 `legacy-cxm:<source_log_id>`，退款追加 `:refund:<redemption_id>` 仅在目标唯一索引要求时使用。复制用户字段和同构 auth rows；logs 按客户 ID 全量保留，目标独有字段使用零值/默认值。

- [ ] **Step 6: 实现目标冲突摘要**

在 `main.go` 的 `validate` 中使用目标只读连接检查用户 ID、用户名、Access Token、邮箱、plan ID、redemption ID/key、log ID、order no/idempotency key。任何“同键但不同内容”返回带表名和键值的阻断错误；相同业务键且内容一致只报告为可幂等重试。

- [ ] **Step 7: 运行转换测试并提交**

```bash
go test ./tools/cxm_migration -run 'Test(FixedRefundFeeToBPS|QuotaSplit|Transform)' -count=1
git diff --check
git add tools/cxm_migration
git commit -m "feat: transform cxm legacy data into current agent model"
```

预期：所有固定 fixture PASS，`git diff --check` 无输出。

## Task 3: 实现本地事务导入、备份和 sequence 修正

**Files:**
- Create: `tools/cxm_migration/import.go`
- Create: `tools/cxm_migration/audit.go`
- Modify: `tools/cxm_migration/main.go`
- Modify: `tools/cxm_migration/types.go`

**Interfaces:**
- Consumes: 经过 `validate` 的 `TransformedBundle`、目标 PostgreSQL DSN、导入 marker。
- Produces: 单事务写入结果和不含秘密的 `AuditReport`；错误时目标事务完全回滚。

- [ ] **Step 1: 编写导入前备份命令和停止检查**

在运行导入前执行并记录：

```bash
BACKUP_DIR="$(mktemp -d /tmp/cxm-local-backup.XXXXXX)"
chmod 700 "$BACKUP_DIR"
docker exec newapi-custom-pg pg_dump -U root -d new-api -Fc > "$BACKUP_DIR/new-api-before.dump"
shasum -a 256 "$BACKUP_DIR/new-api-before.dump" > "$BACKUP_DIR/new-api-before.dump.sha256"
```

确认 compose backend、PostgreSQL、Redis healthy，记录镜像 digest、当前 Git commit 和源 bundle SHA-256。备份路径只进入本地审计报告，不进入 Git。

- [ ] **Step 2: 按依赖顺序实现目标事务**

`import.go` 使用目标 GORM PostgreSQL 连接，并在 `Transaction` 中按以下顺序 `Create`：users（含 agent 与客户，显式源 ID）→ AgentAccount → SubscriptionPlan 与 AgentPlanOffer → UserSubscription 历史记录 → AgentPurchaseOrder → Redemption → AgentCreditLog → quota grants（若目标模型存在对应可迁移字段）→ logs → 同构用户认证关联表。每一步前执行冲突检查；每一步失败返回带步骤名的错误。GORM hook 不允许被绕过；账本日志写入需满足 immutability hook。导入 marker 使用固定 migration ID，重复执行只允许在 manifest、业务键和内容全部一致时返回 already applied。

- [ ] **Step 3: 修正 PostgreSQL sequence**

仅当目标连接方言为 PostgreSQL 时，针对显式写入主键的表执行受控 `setval`。表名和列名必须来自代码中的白名单，不能拼接用户输入；若表不存在 sequence，记录为 skipped 而不是失败。禁止在 SQLite/MySQL 路径执行 PostgreSQL SQL。

- [ ] **Step 4: 实现导入后对账**

`audit.go` 逐项核对：用户/客户数、日志数、兑换码状态分布、126 个历史订单、137 条积分流水、agent balance、余额流水和、每客户额度守恒、所有外键和唯一键。报告只输出数量、ID、金额和状态，不输出秘密字段。

- [ ] **Step 5: 事务测试和提交**

```bash
go test ./tools/cxm_migration -run 'Test(Import|Audit)' -count=1
go test ./model ./service -run 'TestAgent|TestSubscription' -count=1
git diff --check
git add tools/cxm_migration
git commit -m "feat: import cxm migration bundle transactionally"
```

预期：导入错误 fixture 时目标计数不变；合法 fixture 在临时 PostgreSQL/SQLite 兼容测试数据库中完成对账。

## Task 4: 执行源快照、目标预检和本地导入

**Files:**
- Modify: `tools/cxm_migration/README.md`（仅补充实际执行参数格式，不写秘密）
- Create outside Git: `/tmp/cxm-migration-<timestamp>/bundle.json`
- Create outside Git: `/tmp/cxm-local-backup-<timestamp>/new-api-before.dump`

**Interfaces:**
- Consumes: 用户提供的 SSH 私钥目录内 `id_rsa.pem`、源服务器只读连接、运行中的本地 Docker stack。
- Produces: 本地已导入数据和审计报告；源服务器无写操作记录。

- [ ] **Step 1: 创建 SSH 本地隧道**

使用实际私钥文件但不回显敏感内容：

```bash
ssh -i /Users/luodashuaige/Documents/DMIT-E2cyqVbdXa-id_rsa/id_rsa.pem \
  -o IdentitiesOnly=yes -o BatchMode=yes \
  -N -L 15432:127.0.0.1:5432 root@154.17.4.137
```

隧道只转发源 PostgreSQL；执行过程中不在远端写文件。另一个终端从源容器环境变量读取 DSN 到内存变量，改写 host/port 为 `127.0.0.1:15432` 后传给 `export`，不保存或打印完整 DSN。

- [ ] **Step 2: 导出并验证 bundle**

```bash
go run ./tools/cxm_migration export \
  --source-dsn "$SOURCE_DSN_VIA_TUNNEL" \
  --agent-id 315 \
  --bundle "/tmp/cxm-migration-<timestamp>/bundle.json"
go run ./tools/cxm_migration validate \
  --bundle "/tmp/cxm-migration-<timestamp>/bundle.json" \
  --target-dsn "$LOCAL_TARGET_DSN"
```

预期 manifest 与盘点值一致：13 个客户、188,431 条 logs、570 个兑换码、126 个 purchase orders、137 条 credit logs；冲突检查为零。

- [ ] **Step 3: 备份并导入目标库**

目标 PostgreSQL 未暴露宿主端口，因此在 backend 容器的 `/build` 挂载中运行工具，目标 DSN 使用 compose 内部地址 `postgresql://root:<local-password>@postgres:5432/new-api`；密码只从当前 compose 环境变量取得，不写入命令日志。执行 `import` 后立即运行 `report`，失败时不重启应用、不继续验收。

- [ ] **Step 4: 重启并重复对账**

```bash
docker compose -f dev/docker-compose.custom-dev.yml restart backend
docker compose -f dev/docker-compose.custom-dev.yml ps
go run ./tools/cxm_migration report --target-dsn "$LOCAL_TARGET_DSN" --bundle "$BUNDLE"
```

预期重启后所有数量、余额、额度和外键对账仍通过。任何缓存导致的旧结果都必须在重启后重新请求确认。

- [ ] **Step 5: Commit only code/docs**

迁移包、备份和报告保持在 `/tmp` 或受限本地目录；只提交工具代码/README，不提交数据文件。

## Task 5: 自动化本地端到端验收

**Files:**
- Create outside Git: `/tmp/cxm-migration-<timestamp>/e2e-report.json`
- Modify only if needed after observed semantic failure: `service/agent_customer.go` and corresponding test

**Interfaces:**
- Consumes: 已导入本地数据库、`cxm` 临时 token、目标后端 `http://localhost:3100`。
- Produces: 不含秘密的 E2E 报告和 token 恢复证明。

- [ ] **Step 1: 保存并临时替换 cxm token**

用目标数据库事务读取 `users.id=315` 的 `access_token` 原值，生成 32 字符随机 token 写入本地；原值进入内存和受限恢复文件，不进入日志。所有代理 API 请求同时带 `Authorization: Bearer <temporary-token>` 和 `New-Api-User: 315`。

- [ ] **Step 2: 验证客户和日志读取**

调用代理 overview、promotion、customers、customer logs、offers、orders、redemptions、credit logs 接口。断言：客户 13 个、日志 188,431 条、客户绑定 ID 均为 315、历史订单 126 个、兑换码 565 used + 5 refunded、余额与账本相等。响应中不得出现密码、Access Token、IP 或管理员字段。

- [ ] **Step 3: 验证购买和分发**

以 plan 8、quantity 1、唯一 idempotency key 购买；断言返回订单和一个新码，余额减少 7,000，账本增加一条 `purchase`，每日计数从 0 变 1。重复同一幂等键，断言不会重复扣款或生成第二枚码。

- [ ] **Step 4: 验证新客户兑换与首绑**

创建本地专用测试用户和已知认证信息，兑换刚购买的新码；断言码变为 used、产生正确 `UserSubscription`、测试用户 `bound_agent_id=315`、客户列表变为 14。再次用同一测试用户兑换另一代理码（如果可用）时断言原绑定不变；本次不要消耗历史重要客户的 570 枚旧码。

- [ ] **Step 5: 验证历史退款码不可用**

选择一个已退款 Ultra 码执行查询/兑换，断言状态为 refunded 且兑换失败；订单退款数量和金额保持 5 / 390,000。

- [ ] **Step 6: 重启后重复关键流程读取**

重启 backend，重新请求 overview/customers/logs/orders/inventory/credit logs；只读验证结果必须与重启前一致。执行 `go test ./service -run TestAgent` 和前端已有构建检查，不在验收中修改生产配置。

- [ ] **Step 7: 恢复 token 和最终审计**

在失败清理路径中将 `users.id=315.access_token` 恢复为原始值（当前为 NULL），提交后查询确认为 NULL；删除临时 token、临时测试用户的敏感认证文件，但保留不含秘密的统计报告和本地数据库备份。若验收失败，先恢复 token，再按备份回滚本地数据库。

## Task 6: 迁移完成前验证与交付

**Files:**
- Modify: `docs/superpowers/plans/2026-07-22-cxm-data-migration-plan.md`（勾选实际完成步骤和结果）
- Create outside Git: `/tmp/cxm-migration-<timestamp>/final-report.md`

- [ ] **Step 1: 运行最终验证清单**

```bash
git diff --check
git status --short
go test ./tools/cxm_migration ./model ./service -count=1
docker compose -f dev/docker-compose.custom-dev.yml ps
```

同时检查：源 SSH 会话已关闭；本地 `cxm` token 已恢复；本地 backup SHA-256 可复核；迁移包和真实认证材料未被 Git 跟踪。

- [ ] **Step 2: 生成不含秘密的交付报告**

报告包括源/目标计数、ID 映射摘要、余额和额度对账、E2E 断言、重启结果、备份路径和回滚说明。禁止包含密码、Access Token、完整兑换码、完整 DSN 或私钥内容。

- [ ] **Step 3: Commit implementation and plan status**

```bash
git add tools/cxm_migration docs/superpowers/plans/2026-07-22-cxm-data-migration-plan.md
git commit -m "feat: validate cxm local migration workflow"
```

只在所有验证命令有实际输出且通过后宣称本地验收完成；生产迁移仍需另行审批和新的生产备份计划。
