# 双钱包拆分 — 测试方案

> 文档编号:WALLET-SPLIT-TEST-PLAN-01
> 关联:`01-requirements.md`、`02-technical-design.md`

## 1. 测试目标

验证双钱包拆分后:资金来源可区分、免费额度按过期正确扣减与回收、`quota + free_quota` 始终等于旧口径总额、三条业务线(签到/充值赠送/兑换码)正确入账,且在三种数据库、BatchUpdate 开关、Redis 开关、并发场景下均正确。

## 2. 测试分层(金字塔)

| 层 | 占比 | 工具 | 范围 |
|----|------|------|------|
| 单元测试 | 60% | Go test | `model/wallet.go` 扣减/回收算法、`Redeem` 计数与限领、赠送额计算、过期判定 |
| 集成测试 | 30% | Go test + DB | 完整入账→扣费→退款→过期链路;三库 × Redis 开关 × Batch 开关 |
| E2E | 10% | Chrome DevTools + Playwright | 签到/充值/兑换码前端流程、双钱包展示、文案 |

## 3. 核心不变式(每个测试后断言)

- **INV-1** `user.Quota + user.FreeQuota == 旧口径总可用额度`
- **INV-2** `user.FreeQuota == SUM(free_quota_ledger.remaining WHERE status=active AND expired_time>now)`
- **INV-3** 余额永不为负;免费明细 `remaining` ∈ [0, amount]
- **INV-4** Redis 缓存值 == DB 值(最终一致,回填后)
- **INV-5** 退款后钱包状态可复原(原路返回,免费明细已过期则转充值钱包)

## 4. 测试维度矩阵

| 维度 | 取值 |
|------|------|
| 数据库 | SQLite / MySQL / PostgreSQL |
| Redis | 启用 / 禁用 |
| BatchUpdate | 开 / 关 |
| 扣费来源组合 | 纯充值 / 会过期免费足够 / 会过期免费不足溢出充值 / 扣到不过期免费 / 全空 |
| 免费明细状态 | 单条 / 多条不同过期时间 / 含已过期 / 全过期 |

关键组合(不做全笛卡尔,按风险抽样):
- SQLite × Redis禁用 × Batch关(最小依赖基线)
- PG × Redis启用 × Batch开(生产典型)
- MySQL × Redis启用 × Batch关

## 5. 单元测试点(Go test)

### 5.1 扣减算法 `ConsumeQuota`(三级优先级)
- 会过期免费明细多条,验证严格按 `expired_time` 升序扣减
- 三级顺序:会过期免费 → 充值钱包 → 不过期免费(哨兵值 `FreeQuotaNeverExpire`);验证充值排在不过期免费之前
- 会过期免费不足时溢出到充值;充值再不足才动不过期免费;返回值 `(fromFree, fromRecharge)` 正确
- 免费全空时全走充值;仅有不过期免费时正确扣减
- 总额不足时返回错误,不产生部分扣减(原子性)

### 5.2 过期回收 `RecycleExpiredFreeQuota`
- 过期明细 `remaining` 从 `FreeQuota` 精确扣除,状态置 `expired`
- 已耗尽(remaining=0)的过期明细不重复回收
- 未过期明细不受影响

### 5.3 兑换码 `Redeem`
- `max_uses` 计数:兑换 N 次后置 Used,第 N+1 次拒绝
- 同码同用户第二次拒绝(REQ-3.6.4)
- 同 tag 同用户领第二个码拒绝(REQ-3.6.5)
- 不同用户可各领(不互相限制)
- `valid_days>0` → 进免费钱包带过期明细;`=0` → 进充值钱包

### 5.4 充值赠送 `CalcTopupGift`
- 命中最高满足档位;未达最低档位赠送 0;边界值(恰好等于档位阈值)

### 5.5 签到额度
- 发放进免费钱包,过期时间 = now + ValidDays*86400

## 6. 集成测试点(Go test + DB)

- **完整链路**:充值(本金+赠送)→ 消费(三级顺序:会过期免费→充值→不过期免费)→ 部分退款(原路返回)→ 免费明细过期回收 → 断言全部不变式
- **并发**:N goroutine 同时扣同一用户,断言无双花、无负余额、INV-1/INV-2 成立(复用 `subscription_concurrency_test.go` 模式)
- **限领并发**:同一用户并发兑换同批次多个码,只成功一次
- **缓存一致性**:充值/兑换后立即读 `GetUserTotalQuota`,Redis 与 DB 一致
- **迁移**:模拟存量用户(仅 quota 有值),迁移后 free_quota=0,总额不变

## 7. E2E 测试点(前端)

- 签到成功 toast 含"有效期 N 天"提醒;签到后免费钱包余额增加
- 充值页展示赠送规则;充值成功后充值/免费钱包分别正确增加
- 兑换码管理页:创建自定义 key / 设 tag / max_uses / valid_days;重复兑换报错
- 用户中心额度展示区分充值钱包 / 免费钱包 / 总额
- 控制台无红字报错;iPhone SE 模式布局正常

## 8. 运行命令

```bash
# 单元 + 集成(默认 SQLite)
go test -v ./model/... ./service/... -run 'Wallet|FreeQuota|Redeem|TopupGift|Checkin' -count=1

# 指定 MySQL / PG(通过环境变量切库,复用现有 test 基建)
SQL_DSN='...' go test -v ./model/... -run TestWallet -count=1

# 前端类型/构建校验
cd web && bun run build
```

## 9. Bug 管理

按 CLAUDE.md 规范,P0(负余额/双花/数据丢失)立即修;P1(核心链路错)24h;P2(文案/样式)记录评估。每个 Bug 关联测试用例编号(见 `05-test-cases.md`)。

## 10. 质量门禁

- [ ] 单元测试通过率 ≥ 95%,覆盖率 ≥ 80%(model/wallet.go、Redeem)
- [ ] 三库 × 关键组合集成测试全绿
- [ ] 所有核心不变式(INV-1~5)断言通过
- [ ] 并发测试无双花/负余额
- [ ] 前端 build 无错、控制台无红字
- [ ] P0/P1 Bug 全部修复
