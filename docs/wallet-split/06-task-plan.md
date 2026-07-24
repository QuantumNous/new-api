# 双钱包拆分 — 任务计划

> 文档编号:WALLET-SPLIT-PLAN-01
> 关联:`01-requirements.md`、`02-technical-design.md`、`03-test-plan.md`、`05-test-cases.md`
> 原则:增量开发(每步可编译可测)、可追溯(引用 REQ 编号)、实现与测试成对

## 时间估算总览

| Phase | 内容 | 任务数 | 预计 |
|-------|------|--------|------|
| Phase 1 | 数据模型 + 迁移 + 钱包核心读写 | 8 | ~9h |
| Phase 2 | 扣费/退款接入 + 缓存/Lua + 过期回收 | 7 | ~10h |
| Phase 3 | 业务线改造(签到/充值赠送/兑换码/管理员调额) | 10 | ~12h |
| Phase 4 | 前端(展示/配置/兑换码/调额) | 8 | ~14h |
| Phase 5 | 集成测试 + 三库验证 + 对账 | 5 | ~8h |
| 合计 | | 38 | ~53h |

## 依赖关系

```
Phase 1(模型+wallet.go)──┬──> Phase 2(扣费/缓存/过期)──┐
                          └──> Phase 3(业务线)───────────┼──> Phase 4(前端)──> Phase 5(集成)
                                                          
Phase 3 依赖 Phase 1 的入账函数;Phase 3 的兑换码限领依赖 Phase 1 的 claim 表。
Phase 2 与 Phase 3 可部分并行(不同文件),但集成测试(Phase 5)须两者都完成。
```

---

## Phase 1:数据库和模型层(~9h)

- [ ] **1.1 扩展 User 模型 + 迁移**(30min)
  - `model/user.go`:新增 `FreeQuota int` 字段(见技术文档 2.1.1);`model/main.go` 确认 AutoMigrate 生成 ADD COLUMN(三库)。
  - _Requirements: REQ-3.1.1, REQ-3.1.2, NFR-1_

- [ ] **1.2 新建 FreeQuotaLedger 模型**(30min)
  - `model/free_quota_ledger.go`:struct + 复合索引 `idx_fql_user_expire` + 哨兵常量 `FreeQuotaNeverExpire=9999999999`;`model/main.go` 注册 AutoMigrate。
  - _Requirements: REQ-3.1.3, REQ-3.3.1_

- [ ] **1.3 新建 RedemptionClaim 模型**(30min)
  - `model/redemption_claim.go`:struct + `idx_rc_key_user`/`idx_rc_tag_user` 索引;注册 AutoMigrate。
  - _Requirements: REQ-3.6.6_

- [ ] **1.4 扩展 Redemption 模型字段**(30min)
  - `model/redemption.go`:加 `Tag/MaxUses/UsedCount/ValidDays`;更新 `Insert`/`Update` 的 `Select(...)` 白名单(`redemption.go:308,320`)。
  - _Requirements: REQ-3.6.1~3.6.3_

- [ ] **1.5 实现 model/wallet.go 入账函数**(2h)
  - `AddRechargeQuota(tx, userId, amount, remark)`、`AddFreeQuota(tx, userId, amount, source, refId, expiredTime)`;含 DB + Redis 标量 + ZSet 同步(NFR-3)。
  - _Requirements: REQ-3.1.3, REQ-3.1.4, NFR-3_

- [ ] **1.6 实现 model/wallet.go 读取函数**(1h)
  - `GetUserTotalQuota(id, fromDB)`、`GetUserWallets(id)`、`ListFreeQuotaLedgers(userId)`;扩展 `user_cache.go` 的 FreeQuota hash 字段。
  - _Requirements: REQ-3.1.1, REQ-7.1, REQ-7.2_

- [ ] **1.7 [测试] wallet.go 入账/读取单测**(1.5h)
  - **Property 1: 总额不变式** INV-1 `quota + free_quota == 总额`
  - **Property 2: 冗余汇总一致** INV-2 `free_quota == SUM(active remaining)`
  - 覆盖 TC-A01(迁移)、TC-A02(总额一致)
  - **Validates: REQ-3.1, INV-1, INV-2**

- [ ] **1.8 [测试] Redemption/Claim 模型迁移三库验证**(1.5h)
  - 三库 AutoMigrate 成功;字段默认值正确;索引生效。
  - **Validates: NFR-1**

---

## Phase 2:扣费/退款/缓存/过期(~10h)

- [ ] **2.1 实现 ConsumeQuota 三级扣减(DB 回退版)**(2h)
  - `model/wallet.go`:三级算法(会过期免费→充值→不过期免费),返回 `(fromFree []LedgerDeduct, fromRecharge int)`;先纯 DB 事务实现(SELECT ORDER BY FOR UPDATE 两段)。
  - _Requirements: REQ-3.2.1, REQ-3.2.2, NFR-5_

- [ ] **2.2 实现 Redis Lua 三级扣减 + ZSet**(2h)
  - `common/limiter/lua/` 加脚本;ZSet `free_ledger:%d`、hash `free_ledger_rem:%d`;`RedisEnabled` 分支切换 Lua/DB。
  - _Requirements: NFR-2, NFR-5_

- [ ] **2.3 实现过期回收 RecycleExpiredFreeQuota + ConsumeFreeQuotaOnly**(1h)
  - 惰性回收(单用户);`ConsumeFreeQuotaOnly`(管理员减免费钱包用)。
  - _Requirements: REQ-3.3.2, REQ-3.3.3, REQ-3.7.2_

- [ ] **2.4 实现 RefundQuota 原路返回**(1h)
  - `model/wallet.go`:按 `(fromFree 明细, fromRecharge)` 复原;已过期明细退款转充值钱包(见技术文档第 4 节)。
  - _Requirements: REQ-3.2.4_

- [ ] **2.5 接入 FundingSource / billing session**(1.5h)
  - `service/funding_source.go` WalletFunding 的 PreConsume/Settle/Refund 改调 wallet.go;`billing_session.go` 记录 `preFromFree/preFromRecharge`;`service/quota.go:PostConsumeQuota` 钱包分支改调 ConsumeQuota。
  - _Requirements: REQ-3.2.1, REQ-3.2.4_

- [ ] **2.6 过期回收后台任务**(1h)
  - `service/free_quota_expire_task.go`(仿 `StartSubscriptionQuotaResetTask`);`main.go` 注册;写系统日志(REQ-3.3.4)。
  - _Requirements: REQ-3.3.3, REQ-3.3.4_

- [ ] **2.7 [测试] 扣减/退款/过期单测**(1.5h)
  - **Property 3: 三级顺序** 会过期→充值→不过期,充值先于不过期免费
  - **Property 4: 退款可复原** INV-5
  - 覆盖 TC-B01~B07、TC-C01~C03、TC-G01~G03
  - **Validates: REQ-3.2, REQ-3.3, INV-3, INV-5**

---

## Phase 3:业务线改造(~12h)

- [ ] **3.1 签到额度改造**(1h)
  - `setting/operation_setting/checkin_setting.go` 加 `ValidDays`(默认7);`model/checkin.go` 两条路径(事务 `:105`/SQLite `:134`)改调 `AddFreeQuota`。
  - _Requirements: REQ-3.4.1, REQ-3.4.2_

- [ ] **3.2 签到文案改造**(30min)
  - `controller/checkin.go:136` 响应文案追加有效期提醒。
  - _Requirements: REQ-3.4.3_

- [ ] **3.3 [测试] 签到单测**(1h)
  - 覆盖 TC-D01~D03(进免费钱包、7天过期、SQLite 一致)
  - **Validates: REQ-3.4**

- [ ] **3.4 充值赠送配置**(1h)
  - `setting/operation_setting/payment_setting.go` 加 `GiftEnabled/GiftRules[]/GiftValidDays`;`CalcTopupGift(amount)` 按档位。
  - _Requirements: REQ-3.5.1, REQ-3.5.3_

- [ ] **3.5 充值赠送发放(全渠道)**(2h)
  - `model/topup.go` 5 处 Recharge*;易支付 `controller/topup.go:435`;本金改 `AddRechargeQuota`,赠送 `AddFreeQuota`。
  - _Requirements: REQ-3.5.2, REQ-3.5.4_

- [ ] **3.6 [测试] 充值赠送单测**(1h)
  - 覆盖 TC-E01~E04(本金/赠送拆分、未达档位、全渠道、缓存一致)
  - **Validates: REQ-3.5**

- [ ] **3.7 兑换码生成改造(自定义key/tag/max_uses/valid_days)**(1.5h)
  - `controller/redemption.go` `AddRedemption`:custom_key 唯一校验、tag/max_uses/valid_days 入参。
  - _Requirements: REQ-3.6.1~3.6.3_

- [ ] **3.8 兑换码核销 + 限领改造**(2h)
  - `model/redemption.go` `Redeem`:计数模型、限领校验(key/tag)、valid_days 决定钱包、写 claim;`DeleteRedemption`/按 tag 删级联清 claim。
  - _Requirements: REQ-3.6.3~3.6.6_

- [ ] **3.9 管理员调额改造**(1.5h)
  - `controller/user.go` `ManageRequest` 加 `Wallet/ValidDays`;`add_quota` 按钱包分流(add/subtract/override);日志区分钱包。
  - _Requirements: REQ-3.7.1~3.7.4_

- [ ] **3.10 [测试] 兑换码 + 调额单测**(1.5h)
  - 覆盖 TC-F01~F08、管理员调额免费/充值分流、override 语义
  - **Validates: REQ-3.6, REQ-3.7**

---

## Phase 4:前端(~14h)

- [ ] **4.1 用户额度拆分展示 + 免费明细列表**(3h)
  - 用户中心额度组件:充值/免费/总额三值 + 免费明细列表(来源/剩余/过期倒计时)。
  - _Requirements: REQ-7.1, REQ-7.2, REQ-7.3_

- [ ] **4.2 签到前端文案 + i18n**(1h)
  - `CheckinCalendar.jsx:246` toast;`SettingsCheckin.jsx` 有效期配置;各 `locales/*.json`。
  - _Requirements: REQ-3.4.3_

- [ ] **4.3 充值页赠送展示 + 后台赠送配置**(2.5h)
  - `RechargeCard.jsx` 展示"充X送Y";`SettingsGeneralPayment.jsx` 配置赠送规则;i18n。
  - _Requirements: REQ-3.5.1, REQ-3.5.3_

- [ ] **4.4 兑换码管理页改造**(3h)
  - `EditRedemptionModal.jsx`/`RedemptionsActions.jsx`:自定义key/tag/max_uses/valid_days;`RedemptionsColumnDefs.jsx` 加"已用/上限""标签"列;i18n。
  - _Requirements: REQ-3.6.1~3.6.5_

- [ ] **4.5 管理员调额弹窗改造**(2h)
  - `EditUserModal.jsx`:目标钱包下拉,选免费钱包时显示有效期输入;i18n。
  - _Requirements: REQ-3.7.5_

- [ ] **4.6 [验证] 前端 build + 控制台检查**(1h)
  - `bun run build` 无错;Chrome DevTools 控制台无红字;iPhone SE 布局。
  - **Validates: 前端质量门禁**

- [ ] **4.7 [验证] i18n lint**(30min)
  - `bun run i18n:lint`;新增 key 各语言无缺漏(至少 zh/en)。
  - **Validates: i18n 完整性**

- [ ] **4.8 Checkpoint - 前端联调**(1h)
  - 起本地环境走 Showcase 1~7 前端流程。

---

## Phase 5:集成测试 + 三库 + 对账(~8h)

- [ ] **5.1 完整链路集成测试**(2h)
  - 充值(本金+赠送)→ 三级消费 → 退款 → 过期回收,断言 INV-1~5。
  - **Validates: 全需求端到端**

- [ ] **5.2 并发测试**(2h)
  - 覆盖 TC-H01(并发扣费无双花)、TC-H02(并发限领只成功一次)。
  - **Validates: NFR-5**

- [ ] **5.3 兼容矩阵测试**(2h)
  - TC-H03(Batch 开关)、TC-H04(Redis 开关)、TC-H05(三库);关键组合见测试方案第4节。
  - **Validates: NFR-1, NFR-4**

- [ ] **5.4 对账任务**(1h)
  - 校验 `free_quota == SUM(active remaining)`、`quota>=0`;作为运维兜底(可选加定时对账)。
  - **Validates: INV-2, NFR-3**

- [ ] **5.5 Showcase 全量走查 + 交付确认**(1h)
  - 按 `04-showcase.md` 8 项逐条验收,填签署清单。

---

## 关键里程碑

| 里程碑 | 标志 | 累计 |
|--------|------|------|
| M1 数据层就绪 | Phase 1 完成,wallet.go 单测绿 | ~9h |
| M2 扣费引擎就绪 | Phase 2 完成,三级扣减+退款+过期单测绿 | ~19h |
| M3 业务打通 | Phase 3 完成,三条业务线单测绿 | ~31h |
| M4 前端就绪 | Phase 4 完成,build 无错、联调通过 | ~45h |
| M5 交付 | Phase 5 完成,三库+并发+Showcase 全绿 | ~53h |

## 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 热路径 Lua 扣减性能不达标 | 计费延迟 | 先 DB 版跑通(2.1),Lua(2.2)压测对比;不达标退回明细直写+索引优化 |
| 三库 tag 唯一性差异 | 限领失效 | 不用 DB 唯一索引,事务内 FOR UPDATE 校验(SQLite 全局串行) |
| 加额度写路径遗漏 | 钱包不一致 | 收口到 wallet.go;对账任务(5.4)兜底发现遗漏 |
| 缓存与 DB 偏差 | 余额错乱 | Lua 原子 + 对账;修复原有事务不刷缓存隐患 |

## 验收标准

### 功能验收
- [ ] 三条业务线正确入账;三级扣费顺序正确;过期回收生效;调额可选钱包
- [ ] 兑换码 自定义key/多次核销/每人限领/标签限领 全部正确

### 测试验收
- [ ] 单元测试覆盖率 ≥ 80%(wallet.go、Redeem);通过率 ≥ 95%
- [ ] 所有 Property 测试、INV-1~5 断言通过
- [ ] 三库 × Batch × Redis 关键组合集成测试全绿

### 性能验收
- [ ] 扣费热路径 P99 延迟无明显退化(与改造前对比)
