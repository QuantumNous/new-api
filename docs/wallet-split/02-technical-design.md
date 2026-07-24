# 双钱包拆分 — 技术设计文档

> 文档编号:WALLET-SPLIT-TECH-01
> 关联:`01-requirements.md`
> 适用代码库:new-api (Go 1.25 + Gin + GORM,SQLite/MySQL/PG 三库)

## 1. 现状分析(调研结论)

### 1.1 额度存储
- 单字段 `User.Quota int`(`model/user.go:39`),`UsedQuota` 只增统计(`user.go:40`)。
- 佣金 `CommissionBalance`(分,独立体系),订阅额度独立核算。

### 1.2 加额度的两类写路径(拆钱包最易遗漏点)
- **(a) 走 `IncreaseUserQuota`**(`model/user.go:850`):带异步 Redis `cacheIncrUserQuota` + 可选 BatchUpdate。管理员调额、Midjourney 退款、签到 SQLite 路径、注册/邀请、计费退款、FundingSource 退款等。
- **(b) 事务内直接 SQL `gorm.Expr("quota + ?")`**(**绕过缓存和批量器**):
  - 充值:`model/topup.go:154`(Stripe)、`:418`(补单)、`:481`(Creem)、`:565`(Waffo)、`:630`(WaffoPancake);易支付 `controller/topup.go:435`
  - 兑换码:`model/redemption.go:227`(Combo)、`:237`(余额)
  - 佣金转余额:`model/commission.go:309`
  - 签到事务路径:`model/checkin.go:105`
- **现存隐患**:(b) 类路径不刷 Redis 缓存,依赖 TTL 自然过期最终一致。本次改造顺带修复。

### 1.3 扣额度路径
- 核心函数 `DecreaseUserQuota`(`model/user.go:875`)→ `gorm.Expr("quota - ?")`。
- 计费结算 `service/quota.go:420 PostConsumeQuota` → 钱包分支 `:437 DecreaseUserQuota`。
- **FundingSource 抽象**(`service/funding_source.go:17`):`WalletFunding` / `SubscriptionFunding` / `HybridFunding`,预扣 `PreConsume`、结算 `Settle`、退款 `Refund`。**这是钱包扣减的天然抽象扩展点。**
- billing session(`service/billing_session.go`)管理预扣-结算生命周期,`Refund` 幂等。

### 1.4 缓存
- 用户缓存 key `user:%d`(hash,`model/user_cache.go:48`),字段级 `cacheIncrUserQuota`/`cacheDecrUserQuota` = `RedisHIncrBy(key,"Quota",delta)`。
- 读 `GetUserQuota`(`user.go:747`)Redis 优先回退 DB。

### 1.5 BatchUpdate
- `model/utils.go`:`batchUpdateStores` 按类型分桶,`addNewRecord` 累加,定时 flush。`BatchUpdateTypeUserQuota` case → `increaseUserQuota`。

## 2. 总体方案

### 2.1 数据模型

#### 2.1.1 User 表(扩展)
```go
// model/user.go — 在 Quota 字段附近新增
Quota     int `json:"quota" gorm:"type:int;default:0"`      // 语义收窄:充值钱包余额
FreeQuota int `json:"free_quota" gorm:"type:int;default:0"` // 新增:免费钱包余额(= 所有未过期免费明细 remaining 之和)
```
- `Quota` 保持字段名不变(避免全库改写),仅**语义**变为充值钱包。
- `FreeQuota` 是免费钱包明细 `remaining` 的**冗余汇总**,用于 O(1) 读总额,真值以明细表为准,二者由事务保证一致。
- **总额度** `TotalQuota() = Quota + FreeQuota`。

> 迁移:SQLite 用 `ALTER TABLE users ADD COLUMN free_quota`(遵循 Rule 2,禁止 ALTER COLUMN),GORM AutoMigrate 在三库均生成 ADD COLUMN。存量 `free_quota` 默认 0。

#### 2.1.2 免费钱包明细表 `free_quota_ledger`(新建)
```go
// model/free_quota_ledger.go
type FreeQuotaLedger struct {
    Id          int    `json:"id" gorm:"primaryKey"`
    UserId      int    `json:"user_id" gorm:"index:idx_fql_user_expire,priority:1;not null"`
    Source      string `json:"source" gorm:"type:varchar(32);index"` // checkin / topup_gift / redemption
    SourceRefId int    `json:"source_ref_id" gorm:"default:0"`        // 关联 topup.id / redemption.id / checkin.id
    Amount      int    `json:"amount" gorm:"not null"`                // 入账原始额度(不变)
    Remaining   int    `json:"remaining" gorm:"not null"`             // 剩余可用(扣减/过期时更新)
    ExpiredTime int64  `json:"expired_time" gorm:"index:idx_fql_user_expire,priority:2"` // 过期时间戳(秒);不过期 = 哨兵值 FreeQuotaNeverExpire
    Status      int    `json:"status" gorm:"type:int;default:1;index"`// 1=active 2=exhausted 3=expired
    CreatedTime int64  `json:"created_time"`
}
```
- **哨兵常量**:`const FreeQuotaNeverExpire int64 = 9999999999`(约公元 2286 年)。**不过期免费额度**的 `expired_time` 一律写此值,而非 0——好处是所有明细统一按 `expired_time` 存储/排序/索引,不过期项因值极大自然排到最后,无需为"不过期"单独建字段或排序分支。
- **复合索引** `idx_fql_user_expire (user_id, expired_time)`:支撑"按过期时间升序扣减"和"扫描过期"。
- 过期扫描 `WHERE expired_time < now`:哨兵值在未来,永不被误回收,无需额外条件。
- `Status`:`active`(有剩余且未过期)/`exhausted`(剩余为 0)/`expired`(过期回收)。
- 入账仅写 `active`;扣减更新 `remaining`(减到 0 转 `exhausted`);过期转 `expired` 并从 `FreeQuota` 扣掉 `remaining`。
- **消费排序**(三级优先级,REQ-3.2),用哨兵值把"会过期/不过期"一线划开:
  1. 会过期额度(`expired_time < FreeQuotaNeverExpire`)按 `expired_time ASC`;
  2. 充值钱包;
  3. 不过期额度(`expired_time == FreeQuotaNeverExpire`)按 `created_time ASC`。

#### 2.1.3 兑换码表 `redemptions`(扩展)
```go
// model/redemption.go — 新增字段
Tag           string `json:"tag" gorm:"type:varchar(64);index"`     // 批次标签,空=无批次
MaxUses       int    `json:"max_uses" gorm:"default:1"`             // 最大可兑换次数,1=一次性
UsedCount     int    `json:"used_count" gorm:"default:0"`           // 已兑换次数
ValidDays     int    `json:"valid_days" gorm:"default:0"`           // 兑换后额度有效天数,0=不过期(进充值钱包)
// Status/UsedUserId 语义调整:MaxUses>1 时 UsedUserId 不再单值,核销以 UsedCount 计数为准
```
- 核销从"`Status=Used` 一次性开关"改为"`UsedCount < MaxUses` 计数模型"。`UsedCount >= MaxUses` 时置 `Status=Used`。
- `ValidDays > 0` → 兑换额度进免费钱包(明细过期 = now + ValidDays);`= 0` → 进充值钱包(现状)。

#### 2.1.4 兑换限领记录表 `redemption_claims`(新建)
```go
// model/redemption_claim.go
type RedemptionClaim struct {
    Id            int    `json:"id" gorm:"primaryKey"`
    UserId        int    `json:"user_id" gorm:"index:idx_rc_key_user;index:idx_rc_tag_user;not null"`
    RedemptionId  int    `json:"redemption_id"`
    RedemptionKey string `json:"redemption_key" gorm:"type:varchar(64);index:idx_rc_key_user"`
    Tag           string `json:"tag" gorm:"type:varchar(64);index:idx_rc_tag_user"` // 冗余,便于按 tag 清理与查询
    ClaimedTime   int64  `json:"claimed_time"`
}
```
- **唯一约束**:`uniqueIndex idx_rc_key_user (redemption_key, user_id)`(同码一人一次);`tag` 非空时 `uniqueIndex idx_rc_tag_user (tag, user_id)`(同标签一人一次)。
  - 注意:tag 为空时不能进唯一索引(否则多个空 tag 冲突)。方案:tag 空时存 `""` 且 `idx_rc_tag_user` 用**部分/条件**处理——但三库对部分索引支持不一。**采用应用层校验 + 非唯一索引**:`idx_rc_tag_user` 为普通索引,限领唯一性在事务内 `SELECT ... FOR UPDATE` 校验,兼容三库。
- **保留到标签删除**:删除某 tag 的兑换码时,级联删除 `redemption_claims` 里该 tag 的记录(`DeleteRedemptionByTag`)。

### 2.2 钱包读写核心 API(新建 `model/wallet.go`)

统一收口所有钱包读写,替代分散的直接 SQL:

```go
// 读
func GetUserTotalQuota(id int, fromDB bool) (total int, err error)      // quota + free_quota
func GetUserWallets(id int) (recharge int, free int, err error)

// 充值钱包入账(替代各处 gorm.Expr("quota + ?"))
func AddRechargeQuota(tx *gorm.DB, userId, amount int, remark string) error

// 免费钱包入账(写明细 + 累加 free_quota + 刷缓存 + 写 ZSet)
func AddFreeQuota(tx *gorm.DB, userId, amount int, source string, refId int, expiredTime int64) error

// 统一扣减:先免费(按过期升序)后充值,返回各钱包实际扣减量(供退款原路返回)
func ConsumeQuota(userId, amount int) (fromFree int, fromRecharge int, err error)

// 仅扣免费钱包(按过期升序),不溢出到充值钱包;供管理员减免费钱包额度用
func ConsumeFreeQuotaOnly(userId, amount int) (err error)

// 退款原路返回
func RefundQuota(userId, toFree, toRecharge int, freeLedgerRestore []LedgerRestore) error

// 过期回收(单用户,惰性)
func RecycleExpiredFreeQuota(userId int) (recycled int, err error)
```

**`ConsumeQuota` 算法(核心,三级优先级)**:
1. 先 `RecycleExpiredFreeQuota(userId)` 惰性清理过期明细(仅当存在过期项)。
2. **第一级——会过期免费额度**:在事务内(或 Redis Lua)取该用户 `active` 且 `expired_time < FreeQuotaNeverExpire` 的明细,按 `expired_time ASC` 依次扣 `remaining`,累计 `fromFree`,直到扣满 `amount` 或此级耗尽。
3. **第二级——充值钱包**:仍不足则从 `quota` 扣,累计 `fromRecharge`。
4. **第三级——不过期免费额度**:仍不足则取 `expired_time == FreeQuotaNeverExpire` 的明细按 `created_time ASC` 扣,累计进 `fromFree`。
5. 三级合计仍不足 → 返回错误,回滚,不产生部分扣减。
6. 同步更新 `free_quota -= fromFree`、`quota -= fromRecharge`,刷新缓存与 ZSet。
7. 返回 `(fromFree, fromRecharge)` 供 billing session 记录,退款按此原路返回。
   - 注:`fromFree` 内部需记录扣了哪几条明细各多少(供退款精确复原),`fromRecharge` 是单一充值钱包量。

### 2.3 缓存设计(NFR-2 性能)

- **两个标量字段缓存**:扩展 `user:%d` hash,新增 `FreeQuota` 字段;`cacheIncrFreeQuota`/`cacheDecrFreeQuota` = `RedisHIncrBy(key,"FreeQuota",delta)`。`Quota` 字段仍表示充值钱包。
- **免费明细 ZSet**(热路径排序):key `free_ledger:%d`,member = ledgerId,score = `expired_time`(不过期项 score = `FreeQuotaNeverExpire`,自然排最后)。明细 `remaining` 用 hash `free_ledger_rem:%d` 存 `{ledgerId: remaining}`。
- **三级扣减的原子实现**:单个 Lua 脚本入参 `(userId, amount, now, neverExpireSentinel)`,内部依次:
  1. `ZRANGEBYSCORE free_ledger:{u} now (sentinel` 取会过期项(score < 哨兵)按升序扣;
  2. 不足则扣充值钱包标量;
  3. 仍不足则 `ZRANGEBYSCORE ... [sentinel sentinel]` 取不过期项(按插入序,用 member 或附加序保证 FIFO)扣;
  4. 全程记录每条明细扣减量与充值扣减量,原子返回。
  - Lua 保证"三级扣减 + 双标量更新"整体原子,杜绝并发双花与负余额。
- Redis 不可用(`RedisEnabled=false`)时回退纯 DB 事务:分两段 `SELECT ... WHERE expired_time < sentinel ORDER BY expired_time FOR UPDATE`(第一级)→ 扣充值 → `WHERE expired_time = sentinel ORDER BY created_time FOR UPDATE`(第三级)。SQLite 无行锁,靠 `DB` 全局串行 + 应用层保证。
- **一致性修复**:所有充值/兑换/佣金事务路径改为调用 `model/wallet.go` 的统一入账函数,函数内**同时**更新 DB、Redis 标量、ZSet,消除现有"事务不刷缓存"隐患。

### 2.4 BatchUpdate 兼容(NFR-4)

- 免费钱包**入账**始终强一致(直写 DB + 缓存),不攒批(入账频率低)。
- 免费钱包**扣减**发生在计费热路径。新增 batch 桶 `BatchUpdateTypeFreeQuota`?——**不采用**:因免费扣减涉及明细行的 `remaining` 更新(非单字段增量),无法用现有"累加一个 delta"的 batch 模型表达。改为:热路径扣减走 Redis Lua(实时),明细行 `remaining` 的 DB 落库用**独立的异步 flush**(攒批把 ZSet/hash 的变更落到 `free_quota_ledger`),或每次事务直写(视性能测试结果决定)。默认直写,压测后再优化。
- 充值钱包扣减维持现有 `BatchUpdateTypeUserQuota` 攒批不变。

## 3. 各功能改造点

### 3.1 签到(REQ-3.4)
- `setting/operation_setting/checkin_setting.go`:`CheckinSetting` 新增 `ValidDays int`(默认 7)。
- `model/checkin.go`:两条发放路径(事务 `:105` / SQLite `:134`)改为调用 `AddFreeQuota(tx, userId, awarded, "checkin", checkinId, now+ValidDays*86400)`。
- `controller/checkin.go:136`:响应文案追加"签到额度有效期 N 天,不使用会过期"。
- 前端 `CheckinCalendar.jsx:246` toast + i18n key 新增提醒文案(zh-CN 及各语言)。
- 管理端 `SettingsCheckin.jsx` 增加"有效期天数"配置项。

### 3.2 充值赠送(REQ-3.5)
- 新增配置 `setting/operation_setting/payment_setting.go`:`GiftEnabled bool`、`GiftRules []GiftRule{MinAmount int, GiftQuota int}`(按档位)、`GiftValidDays int`。
- 计算赠送:新增 `operation_setting.CalcTopupGift(amount int) (gift int)`,按最高满足档位返回赠送额。
- 各 `Recharge*` 事务(`model/topup.go` 5 处 + 易支付 `controller/topup.go`)在写 `quota + 本金` 后,追加 `AddFreeQuota(tx, userId, gift, "topup_gift", topUpId, now+GiftValidDays*86400)`(gift>0 时)。
- 本金入账改用 `AddRechargeQuota`(顺带修复缓存不刷)。
- 前端 `RechargeCard.jsx` 展示"充 X 送 Y";`SettingsGeneralPayment.jsx` 配置赠送规则。

### 3.3 兑换码(REQ-3.6)
- `model/redemption.go` 加字段(见 2.1.3),`Insert`/`Update` 的 `Select(...)` 白名单同步(`redemption.go:308,320`)。
- `controller/redemption.go` `AddRedemption`:
  - 支持 `custom_key`(单个自定义码,校验唯一 + 长度/字符集);批量仍用 UUID。
  - 支持 `tag` / `max_uses` / `valid_days` 入参。
- `model/redemption.go` `Redeem(key, userId)` 事务内改造:
  1. 锁定兑换码行,校验 `Status=Enabled`、未过期(`ExpiredTime`)。
  2. **限领校验**:查 `redemption_claims`:`(key,userId)` 已存在 → "您已兑换过该码";`tag!="" && (tag,userId)` 已存在 → "您已兑换过该批次"。
  3. 校验 `UsedCount < MaxUses`,否则"兑换次数已用尽"。
  4. 加额度:`ValidDays>0` → `AddFreeQuota(tx, userId, Quota, "redemption", id, now+ValidDays*86400)`;否则 `AddRechargeQuota`。
  5. `UsedCount++`;`UsedCount>=MaxUses` 时 `Status=Used`。写 `redemption_claims` 记录。
- 删除:`DeleteRedemption` / 按 tag 删除时级联删 `redemption_claims`(REQ-3.6.6)。
- 前端 `EditRedemptionModal.jsx` / `RedemptionsActions.jsx`:自定义 key、tag、max_uses、valid_days 输入。

### 3.4 管理员调额(REQ-3.7)
- 请求结构 `ManageRequest`(`controller/user.go:876`)新增字段:
  ```go
  Wallet    string `json:"wallet"`     // "recharge"(默认) | "free"
  ValidDays int    `json:"valid_days"` // 目标为 free 且 add/override 时必填,默认 7
  ```
- `controller/user.go` `add_quota` action(`:952`)按 `req.Wallet` 分流:
  - `wallet=="recharge"`(或空,向后兼容):
    - `add` → `AddRechargeQuota`(替代现 `IncreaseUserQuota`,顺带刷缓存);`subtract` → 充值钱包扣减;`override` → 现有 `Update("quota", value)` 逻辑不变。
  - `wallet=="free"`:
    - `add` → `AddFreeQuota(nil, userId, value, "admin", adminId, now+ValidDays*86400)`。
    - `subtract` → 复用 `model.ConsumeFreeQuotaOnly(userId, value)`(仅扣免费钱包,按过期升序;不足则报错,不溢出到充值钱包)。
    - `override` → 事务内:作废该用户全部 active 免费明细(`status=expired`、`free_quota` 清零),再 `AddFreeQuota` 一条指定值明细(带过期时间)。
- **校验**:`wallet=="free"` 且 `add`/`override` 时 `ValidDays<=0` 用默认 7 天;`subtract` 免费不足返回明确错误。
- **日志**:`RecordLogWithAdminInfo` 文案区分钱包,如 `"管理员增加用户免费钱包额度 %s,有效期 %d 天"` / `"管理员增加用户充值钱包额度 %s"`。
- 前端 `EditUserModal.jsx`(`web/src/components/table/users/modals/EditUserModal.jsx`):调额区新增"目标钱包"下拉(充值钱包/免费钱包),选免费钱包时显示"有效期(天)"输入项;i18n 补文案。

### 3.5 扣费与退款接入 FundingSource
- `service/funding_source.go` `WalletFunding`:
  - `PreConsume` / `Settle` 的扣减改调 `model.ConsumeQuota(userId, amount)`,记录 `(fromFree, fromRecharge)` 到 session。
  - `Refund` / `Settle`(delta<0)按记录原路返回:`model.RefundQuota(userId, toFree, toRecharge, restore)`。
  - 免费明细退款:恢复对应 ledger 的 `remaining`(不改 `expired_time`;若已过期则退回充值钱包,避免退到已死明细)。
- `service/billing_session.go`:session 结构新增 `preFromFree`/`preFromRecharge` 记录,供 Settle/Refund 原路。
- `service/quota.go:PostConsumeQuota` 钱包分支改调统一 `ConsumeQuota`。

### 3.6 过期回收后台任务(REQ-3.3.3)
- 新增 `service/free_quota_expire_task.go`:仿 `StartSubscriptionQuotaResetTask`,定时(如每 10 min)扫 `free_quota_ledger` 里 `status=active AND expired_time < now AND remaining > 0`,批量:置 `status=expired`、`user.free_quota -= remaining`、刷缓存/ZSet、写系统日志。
- `main.go` 注册 `service.StartFreeQuotaExpireTask()`。
- 惰性回收:`ConsumeQuota` 入口先 `RecycleExpiredFreeQuota(userId)`。

## 4. 退款原路返回的精确语义

| 扣费来源 | 退款去向 | 特殊处理 |
|----------|----------|----------|
| 免费钱包某明细 | 恢复该明细 `remaining` + `free_quota += x` | 若明细已过期(retire),改退到充值钱包 |
| 充值钱包 | `quota += x` | 直接返还 |

退款幂等性沿用 billing session 现有标志(`refunded/settled`)。

## 5. 数据库兼容清单(Rule 2)

- 新表用 GORM struct + AutoMigrate,主键交给 GORM,不用 SERIAL/AUTO_INCREMENT。
- 新字段 SQLite 走 ADD COLUMN(AutoMigrate 自动)。
- JSON 配置(赠送规则)存 `options` 表 TEXT,不用 JSONB。
- 布尔值用 GORM,不裸写;保留字 `group`/`key` 用 `commonKeyCol` 等变量。
- ZSet/Lua 仅 Redis;DB 回退路径用标准 `ORDER BY ... FOR UPDATE`(SQLite 无 FOR UPDATE,靠全局串行)。

## 6. 涉及文件清单(改动落点)

**Model**:`model/user.go`(字段+读)、`model/wallet.go`(新)、`model/free_quota_ledger.go`(新)、`model/redemption.go`(字段+Redeem)、`model/redemption_claim.go`(新)、`model/topup.go`(Recharge*)、`model/checkin.go`、`model/commission.go`、`model/user_cache.go`(FreeQuota 缓存)、`model/utils.go`(batch)、`model/main.go`(AutoMigrate 注册)。
**Service**:`service/funding_source.go`、`service/billing_session.go`、`service/quota.go`、`service/free_quota_expire_task.go`(新)、`service/commission.go`(topup gift 调用点确认)。
**Controller**:`controller/checkin.go`、`controller/topup.go`(易支付+赠送)、`controller/redemption.go`(自定义 key/tag/max_uses)、`controller/user.go`(管理员调额区分钱包)。
**Setting**:`setting/operation_setting/checkin_setting.go`、`payment_setting.go`。
**Common**:`common/constants.go`(新常量:LedgerSource、BatchUpdateType 若用)。
**Router**:`main.go`(注册过期任务)。
**前端**:`CheckinCalendar.jsx`、`SettingsCheckin.jsx`、`RechargeCard.jsx`、`SettingsGeneralPayment.jsx`、`EditRedemptionModal.jsx`、`RedemptionsActions.jsx`、`RedemptionsColumnDefs.jsx`、用户额度展示组件(拆两钱包展示)、`i18n/locales/*.json`。

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 热路径扣减引入 DB 聚合延迟 | Redis ZSet + Lua 原子扣减;DB 仅回退 |
| 缓存与 DB 明细不一致(双花/负余额) | Lua 原子操作 + 后台对账任务校验 `free_quota == SUM(remaining active)` |
| 存量数据迁移 | free_quota 默认 0,存量全算充值钱包,无追溯 |
| 兑换码计数并发超发 | `Redeem` 事务内 `FOR UPDATE` 锁行 + `UsedCount` 乐观校验 |
| 三库 tag 唯一性 | 不用 DB 唯一索引,事务内校验(兼容 SQLite) |
| 退款退到已过期明细 | 明细过期则退款转充值钱包 |

## 附:钱包归属决策表(已确认)

| 额度来源 | 归属钱包 | 是否过期 | 入账函数 |
|----------|----------|----------|----------|
| 在线充值本金 | 充值钱包 | 否 | `AddRechargeQuota` |
| 充值赠送额度 | 免费钱包 | 是(GiftValidDays) | `AddFreeQuota(source=topup_gift)` |
| 签到奖励 | 免费钱包 | 是(默认 7 天) | `AddFreeQuota(source=checkin)` |
| 免费兑换码(valid_days>0) | 免费钱包 | 是(valid_days) | `AddFreeQuota(source=redemption)` |
| 普通兑换码(valid_days=0) | 充值钱包 | 否 | `AddRechargeQuota` |
| 邀请返佣 / 注册赠送 | 充值钱包 | 否 | `AddRechargeQuota` |
| 佣金转入余额 | 充值钱包 | 否 | `AddRechargeQuota` |
| 管理员手动调额 | 充值钱包 或 免费钱包(可选) | 免费钱包按有效期 | `AddRechargeQuota` / `AddFreeQuota` / `ConsumeFreeQuotaOnly` |

> 说明:邀请返佣、注册赠送、佣金转入本期一律归充值钱包(不过期),与现状行为一致,改动最小;仅统一改走 `AddRechargeQuota` 以修复"事务不刷缓存"隐患。

## 8. 分阶段实施(概要,详见任务计划)

- **Phase 1**:数据模型 + 迁移 + `model/wallet.go` 核心读写 + 单测。
- **Phase 2**:扣费/退款接入 FundingSource + 过期回收任务 + 缓存/Lua。
- **Phase 3**:签到 / 充值赠送 / 兑换码三条业务线改造。
- **Phase 4**:前端(展示 + 配置 + 兑换码管理)。
- **Phase 5**:集成测试 + 三库验证 + 对账。
