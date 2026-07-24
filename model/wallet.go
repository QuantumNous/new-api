package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// wallet.go 统一收口双钱包（充值钱包 user.Quota / 免费钱包 user.FreeQuota + 明细）的读写，
// 替代分散在 topup/redemption/commission/checkin 中的直接 SQL（gorm.Expr("quota + ?")）。
// 所有入账在同一事务内更新 DB，并异步刷新 Redis 标量缓存，消除"事务不刷缓存"的既有隐患。

// ===================== 读取 =====================

// GetUserWallets 返回用户充值钱包与免费钱包余额（Redis 优先，回退 DB）。
func GetUserWallets(id int) (recharge int, free int, err error) {
	if common.RedisEnabled {
		if cache, cErr := GetUserCache(id); cErr == nil {
			return cache.Quota, cache.FreeQuota, nil
		}
	}
	var user User
	err = DB.Model(&User{}).Where("id = ?", id).Select("quota", "free_quota").First(&user).Error
	if err != nil {
		return 0, 0, err
	}
	return user.Quota, user.FreeQuota, nil
}

// GetUserTotalQuota 返回用户总可用额度 = 充值钱包 + 免费钱包（旧口径总额，计费用）。
func GetUserTotalQuota(id int, fromDB bool) (total int, err error) {
	if !fromDB && common.RedisEnabled {
		if cache, cErr := GetUserCache(id); cErr == nil {
			return cache.Quota + cache.FreeQuota, nil
		}
	}
	var user User
	err = DB.Model(&User{}).Where("id = ?", id).Select("quota", "free_quota").First(&user).Error
	if err != nil {
		return 0, err
	}
	return user.Quota + user.FreeQuota, nil
}

// ===================== 入账 =====================

// AddRechargeQuota 向充值钱包入账。tx 非空时复用调用方事务，否则自开事务。
// 同步：DB user.quota += amount，异步刷新 Redis 标量缓存。
func AddRechargeQuota(tx *gorm.DB, userId, amount int) error {
	if amount < 0 {
		return errors.New("充值额度不能为负数")
	}
	if amount == 0 {
		return nil
	}
	run := func(db *gorm.DB) error {
		return db.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", amount)).Error
	}
	var err error
	if tx != nil {
		err = run(tx)
	} else {
		err = DB.Transaction(func(db *gorm.DB) error { return run(db) })
	}
	if err != nil {
		return err
	}
	gopool.Go(func() {
		if cErr := cacheIncrUserQuota(userId, int64(amount)); cErr != nil {
			common.SysLog("failed to incr recharge quota cache: " + cErr.Error())
		}
	})
	return nil
}

// AddFreeQuota 向免费钱包入账：写一条 active 明细 + user.free_quota += amount，异步刷缓存。
// expiredTime<=0 时视为不过期（写哨兵值 FreeQuotaNeverExpire）。tx 非空复用调用方事务。
func AddFreeQuota(tx *gorm.DB, userId, amount int, source string, refId int, expiredTime int64) error {
	if amount < 0 {
		return errors.New("免费额度不能为负数")
	}
	if amount == 0 {
		return nil
	}
	run := func(db *gorm.DB) error {
		if _, err := insertFreeQuotaLedger(db, userId, amount, source, refId, expiredTime); err != nil {
			return err
		}
		return db.Model(&User{}).Where("id = ?", userId).
			Update("free_quota", gorm.Expr("free_quota + ?", amount)).Error
	}
	var err error
	if tx != nil {
		err = run(tx)
	} else {
		err = DB.Transaction(func(db *gorm.DB) error { return run(db) })
	}
	if err != nil {
		return err
	}
	gopool.Go(func() {
		if cErr := cacheIncrFreeQuota(userId, int64(amount)); cErr != nil {
			common.SysLog("failed to incr free quota cache: " + cErr.Error())
		}
	})
	return nil
}

// ===================== 扣减 / 回收 / 退款 =====================

// LedgerDeduct 记录一次扣减命中的某条免费明细及其扣减量，供退款精确复原。
type LedgerDeduct struct {
	LedgerId    int   `json:"ledger_id"`
	ExpiredTime int64 `json:"expired_time"` // 记录当时的过期时间，退款时判断明细是否已过期
	Amount      int   `json:"amount"`
}

// ErrInsufficientQuota 总额不足（三级合计仍不够扣）。
var ErrInsufficientQuota = errors.New("用户额度不足")

// lockForUpdate 在支持行锁的库上加 FOR UPDATE；SQLite 无行锁，靠全局串行，不加。
func lockForUpdate(tx *gorm.DB) *gorm.DB {
	if common.UsingSQLite {
		return tx
	}
	return tx.Clauses(clause.Locking{Strength: "UPDATE"})
}

// RecycleExpiredFreeQuota 惰性回收单用户已过期但未回收的免费明细：
// 将其 status 置 expired，并从 user.free_quota 扣掉 remaining。返回回收总额。
// 传入 tx 复用事务；tx 为空自开事务。
func RecycleExpiredFreeQuota(tx *gorm.DB, userId int) (recycled int, err error) {
	run := func(db *gorm.DB) error {
		now := common.GetTimestamp()
		expired, e := GetExpiredActiveFreeQuotaLedgers(db, userId, now)
		if e != nil {
			return e
		}
		if len(expired) == 0 {
			return nil
		}
		total := 0
		for _, l := range expired {
			total += l.Remaining
			if e := db.Model(&FreeQuotaLedger{}).Where("id = ?", l.Id).
				Updates(map[string]interface{}{"status": FreeLedgerStatusExpired}).Error; e != nil {
				return e
			}
		}
		if total > 0 {
			if e := db.Model(&User{}).Where("id = ?", userId).
				Update("free_quota", gorm.Expr("free_quota - ?", total)).Error; e != nil {
				return e
			}
		}
		recycled = total
		return nil
	}
	if tx != nil {
		err = run(tx)
	} else {
		err = DB.Transaction(func(db *gorm.DB) error { return run(db) })
	}
	if err != nil {
		return 0, err
	}
	if recycled > 0 {
		uid, amt := userId, recycled
		gopool.Go(func() {
			if cErr := cacheDecrFreeQuota(uid, int64(amt)); cErr != nil {
				common.SysLog("failed to decr free quota cache after recycle: " + cErr.Error())
			}
		})
	}
	return recycled, nil
}

// deductFreeLedgers 在事务内从给定明细集合按序扣减，最多扣 need，返回命中明细与已扣总额。
// 调用方保证 ledgers 已按目标顺序排好（会过期升序 / 不过期创建序）。
func deductFreeLedgers(db *gorm.DB, ledgers []FreeQuotaLedger, need int) (deducts []LedgerDeduct, deducted int, err error) {
	for i := range ledgers {
		if deducted >= need {
			break
		}
		l := &ledgers[i]
		take := l.Remaining
		if take > need-deducted {
			take = need - deducted
		}
		if take <= 0 {
			continue
		}
		newRemaining := l.Remaining - take
		updates := map[string]interface{}{"remaining": newRemaining}
		if newRemaining == 0 {
			updates["status"] = FreeLedgerStatusExhausted
		}
		if err = db.Model(&FreeQuotaLedger{}).Where("id = ?", l.Id).Updates(updates).Error; err != nil {
			return nil, 0, err
		}
		deducts = append(deducts, LedgerDeduct{LedgerId: l.Id, ExpiredTime: l.ExpiredTime, Amount: take})
		deducted += take
	}
	return deducts, deducted, nil
}

// ConsumeQuotaWithOverdraft 三级扣减 amount，余额不足时对差额强制透支充值钱包
// （允许扣成负数），差额计入返回的 fromRecharge。用于"结算补扣/按次计费"等
// 实际用量已发生、必须记账的场景（保持拆分前"允许透支补扣"的语义）。
// 全程单事务：先按可用总额三级扣减，再对差额透支充值钱包。
func ConsumeQuotaWithOverdraft(userId, amount int) (fromFree []LedgerDeduct, fromRecharge int, err error) {
	if amount < 0 {
		return nil, 0, errors.New("扣减额度不能为负数")
	}
	if amount == 0 {
		return nil, 0, nil
	}
	err = DB.Transaction(func(db *gorm.DB) error {
		// 0) 惰性回收过期明细
		if _, e := RecycleExpiredFreeQuota(db, userId); e != nil {
			return e
		}
		now := common.GetTimestamp()

		var user User
		if e := lockForUpdate(db).Model(&User{}).Where("id = ?", userId).
			Select("quota", "free_quota").First(&user).Error; e != nil {
			return e
		}
		ledgers, e := GetActiveFreeQuotaLedgers(lockForUpdate(db), userId, now)
		if e != nil {
			return e
		}
		var expiring, permanent []FreeQuotaLedger
		for _, l := range ledgers {
			if l.ExpiredTime < FreeQuotaNeverExpire {
				expiring = append(expiring, l)
			} else {
				permanent = append(permanent, l)
			}
		}
		remaining := amount

		// 第一级：会过期免费
		d1, got1, e := deductFreeLedgers(db, expiring, remaining)
		if e != nil {
			return e
		}
		fromFree = append(fromFree, d1...)
		remaining -= got1

		// 第二级：充值钱包（可透支——本次会先扣到 user.Quota 为止，差额在最后透支）
		if remaining > 0 && user.Quota > 0 {
			take := user.Quota
			if take > remaining {
				take = remaining
			}
			if e := db.Model(&User{}).Where("id = ?", userId).
				Update("quota", gorm.Expr("quota - ?", take)).Error; e != nil {
				return e
			}
			fromRecharge += take
			remaining -= take
		}

		// 第三级：不过期免费
		if remaining > 0 {
			d3, got3, e := deductFreeLedgers(db, permanent, remaining)
			if e != nil {
				return e
			}
			fromFree = append(fromFree, d3...)
			remaining -= got3
		}

		// 差额透支充值钱包（扣成负数）
		if remaining > 0 {
			if e := db.Model(&User{}).Where("id = ?", userId).
				Update("quota", gorm.Expr("quota - ?", remaining)).Error; e != nil {
				return e
			}
			fromRecharge += remaining
			remaining = 0
		}

		freeDeducted := sumLedgerDeducts(fromFree)
		if freeDeducted > 0 {
			if e := db.Model(&User{}).Where("id = ?", userId).
				Update("free_quota", gorm.Expr("free_quota - ?", freeDeducted)).Error; e != nil {
				return e
			}
		}
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	freeDeducted := sumLedgerDeducts(fromFree)
	uid, fr, fd := userId, fromRecharge, freeDeducted
	gopool.Go(func() {
		if fr > 0 {
			if cErr := cacheDecrUserQuota(uid, int64(fr)); cErr != nil {
				common.SysLog("failed to decr recharge quota cache: " + cErr.Error())
			}
		}
		if fd > 0 {
			if cErr := cacheDecrFreeQuota(uid, int64(fd)); cErr != nil {
				common.SysLog("failed to decr free quota cache: " + cErr.Error())
			}
		}
	})
	return fromFree, fromRecharge, nil
}

// sumLedgerDeducts 汇总免费明细扣减量。
func sumLedgerDeducts(ds []LedgerDeduct) int {
	s := 0
	for _, d := range ds {
		s += d.Amount
	}
	return s
}

// ConsumeQuota 统一三级扣减：会过期免费（即将到期优先）→ 充值钱包 → 不过期免费（创建序）。
// 全程在单事务内完成，三级合计不足则回滚并返回 ErrInsufficientQuota（不产生部分扣减）。
// 返回 fromFree（命中的免费明细及扣减量，供退款原路复原）与 fromRecharge（充值钱包扣减量）。
func ConsumeQuota(userId, amount int) (fromFree []LedgerDeduct, fromRecharge int, err error) {
	if amount < 0 {
		return nil, 0, errors.New("扣减额度不能为负数")
	}
	if amount == 0 {
		return nil, 0, nil
	}
	err = DB.Transaction(func(db *gorm.DB) error {
		// 0) 惰性回收过期明细（复用同一事务，保证后续读取不含过期项）
		if _, e := RecycleExpiredFreeQuota(db, userId); e != nil {
			return e
		}

		now := common.GetTimestamp()
		remaining := amount

		// 锁定并读取当前用户充值钱包余额
		var user User
		if e := lockForUpdate(db).Model(&User{}).Where("id = ?", userId).
			Select("quota", "free_quota").First(&user).Error; e != nil {
			return e
		}

		// 读取全部有效免费明细（已按 expired_time asc, created_time asc 排序：会过期在前、不过期在后）
		ledgers, e := GetActiveFreeQuotaLedgers(lockForUpdate(db), userId, now)
		if e != nil {
			return e
		}
		// 按哨兵值切分：会过期 / 不过期
		var expiring, permanent []FreeQuotaLedger
		for _, l := range ledgers {
			if l.ExpiredTime < FreeQuotaNeverExpire {
				expiring = append(expiring, l)
			} else {
				permanent = append(permanent, l)
			}
		}

		// 预检：三级总额是否足够（会过期免费 + 充值 + 不过期免费）
		var freeTotal int
		for _, l := range ledgers {
			freeTotal += l.Remaining
		}
		if freeTotal+user.Quota < amount {
			return ErrInsufficientQuota
		}

		// 第一级：会过期免费
		d1, got1, e := deductFreeLedgers(db, expiring, remaining)
		if e != nil {
			return e
		}
		fromFree = append(fromFree, d1...)
		remaining -= got1

		// 第二级：充值钱包
		if remaining > 0 {
			take := user.Quota
			if take > remaining {
				take = remaining
			}
			if take > 0 {
				if e := db.Model(&User{}).Where("id = ?", userId).
					Update("quota", gorm.Expr("quota - ?", take)).Error; e != nil {
					return e
				}
				fromRecharge += take
				remaining -= take
			}
		}

		// 第三级：不过期免费
		if remaining > 0 {
			d3, got3, e := deductFreeLedgers(db, permanent, remaining)
			if e != nil {
				return e
			}
			fromFree = append(fromFree, d3...)
			remaining -= got3
		}

		if remaining > 0 {
			// 理论上预检已保证足够，此处兜底
			return ErrInsufficientQuota
		}

		// 汇总更新 free_quota
		freeDeducted := 0
		for _, d := range fromFree {
			freeDeducted += d.Amount
		}
		if freeDeducted > 0 {
			if e := db.Model(&User{}).Where("id = ?", userId).
				Update("free_quota", gorm.Expr("free_quota - ?", freeDeducted)).Error; e != nil {
				return e
			}
		}
		return nil
	})
	if err != nil {
		return nil, 0, err
	}

	// 事务成功后异步刷新标量缓存
	var freeDeducted int
	for _, d := range fromFree {
		freeDeducted += d.Amount
	}
	uid, fr, fd := userId, fromRecharge, freeDeducted
	gopool.Go(func() {
		if fr > 0 {
			if cErr := cacheDecrUserQuota(uid, int64(fr)); cErr != nil {
				common.SysLog("failed to decr recharge quota cache: " + cErr.Error())
			}
		}
		if fd > 0 {
			if cErr := cacheDecrFreeQuota(uid, int64(fd)); cErr != nil {
				common.SysLog("failed to decr free quota cache: " + cErr.Error())
			}
		}
	})
	return fromFree, fromRecharge, nil
}

// ConsumeFreeQuotaOnly 仅从免费钱包扣减（按过期升序），不溢出到充值钱包。
// 供管理员"减免费钱包额度"使用。免费不足则返回错误，不产生部分扣减。
func ConsumeFreeQuotaOnly(userId, amount int) error {
	if amount < 0 {
		return errors.New("扣减额度不能为负数")
	}
	if amount == 0 {
		return nil
	}
	var deducted int
	err := DB.Transaction(func(db *gorm.DB) error {
		if _, e := RecycleExpiredFreeQuota(db, userId); e != nil {
			return e
		}
		now := common.GetTimestamp()
		ledgers, e := GetActiveFreeQuotaLedgers(lockForUpdate(db), userId, now)
		if e != nil {
			return e
		}
		var freeTotal int
		for _, l := range ledgers {
			freeTotal += l.Remaining
		}
		if freeTotal < amount {
			return errors.New("免费钱包余额不足")
		}
		_, got, e := deductFreeLedgers(db, ledgers, amount)
		if e != nil {
			return e
		}
		deducted = got
		return db.Model(&User{}).Where("id = ?", userId).
			Update("free_quota", gorm.Expr("free_quota - ?", got)).Error
	})
	if err != nil {
		return err
	}
	uid, fd := userId, deducted
	gopool.Go(func() {
		if cErr := cacheDecrFreeQuota(uid, int64(fd)); cErr != nil {
			common.SysLog("failed to decr free quota cache: " + cErr.Error())
		}
	})
	return nil
}

// RefundQuota 按扣减记录原路退款：
//   - fromRecharge 直接退回充值钱包；
//   - fromFree 逐条恢复对应明细 remaining（不改 expired_time）；若该明细已过期，则改退到充值钱包（不复活死明细）。
func RefundQuota(userId int, fromFree []LedgerDeduct, fromRecharge int) error {
	if fromRecharge < 0 {
		return errors.New("退款额度不能为负数")
	}
	var refundFree, refundRecharge int
	err := DB.Transaction(func(db *gorm.DB) error {
		now := common.GetTimestamp()
		rechargeBack := fromRecharge

		for _, d := range fromFree {
			if d.Amount <= 0 {
				continue
			}
			// 明细已过期 → 退到充值钱包，不复活。
			// ExpiredTime<=0 视为不过期哨兵（兼容历史数据，0 等价于 FreeQuotaNeverExpire）。
			if d.ExpiredTime > 0 && d.ExpiredTime <= now {
				rechargeBack += d.Amount
				continue
			}
			// 恢复明细 remaining；若之前扣到 exhausted，需要复原为 active
			var l FreeQuotaLedger
			if e := db.Where("id = ?", d.LedgerId).First(&l).Error; e != nil {
				// 明细找不到（异常），退到充值钱包兜底
				rechargeBack += d.Amount
				continue
			}
			if l.Status == FreeLedgerStatusExpired {
				rechargeBack += d.Amount
				continue
			}
			updates := map[string]interface{}{
				"remaining": gorm.Expr("remaining + ?", d.Amount),
				"status":    FreeLedgerStatusActive,
			}
			if e := db.Model(&FreeQuotaLedger{}).Where("id = ?", d.LedgerId).Updates(updates).Error; e != nil {
				return e
			}
			refundFree += d.Amount
		}

		if refundFree > 0 {
			if e := db.Model(&User{}).Where("id = ?", userId).
				Update("free_quota", gorm.Expr("free_quota + ?", refundFree)).Error; e != nil {
				return e
			}
		}
		if rechargeBack > 0 {
			if e := db.Model(&User{}).Where("id = ?", userId).
				Update("quota", gorm.Expr("quota + ?", rechargeBack)).Error; e != nil {
				return e
			}
		}
		refundRecharge = rechargeBack
		return nil
	})
	if err != nil {
		return err
	}
	uid, rf, rr := userId, refundFree, refundRecharge
	gopool.Go(func() {
		if rf > 0 {
			if cErr := cacheIncrFreeQuota(uid, int64(rf)); cErr != nil {
				common.SysLog("failed to incr free quota cache after refund: " + cErr.Error())
			}
		}
		if rr > 0 {
			if cErr := cacheIncrUserQuota(uid, int64(rr)); cErr != nil {
				common.SysLog("failed to incr recharge quota cache after refund: " + cErr.Error())
			}
		}
	})
	return nil
}

// OverrideFreeQuota 将用户免费钱包重置为指定值：作废现有全部 active 明细（置 expired），
// 再新增一条 value 额度的明细（带指定过期时间），并把 user.free_quota 直接设为 value。
// 供管理员"覆盖免费钱包额度"使用。value=0 时仅作废现有明细并清零。
func OverrideFreeQuota(userId, value int, source string, refId int, expiredTime int64) error {
	if value < 0 {
		return errors.New("覆盖额度不能为负数")
	}
	err := DB.Transaction(func(db *gorm.DB) error {
		// 作废现有全部 active 明细
		if e := db.Model(&FreeQuotaLedger{}).
			Where("user_id = ? AND status = ?", userId, FreeLedgerStatusActive).
			Updates(map[string]interface{}{"status": FreeLedgerStatusExpired}).Error; e != nil {
			return e
		}
		// 新增指定值明细（value>0 时）
		if value > 0 {
			if _, e := insertFreeQuotaLedger(db, userId, value, source, refId, expiredTime); e != nil {
				return e
			}
		}
		// 直接把冗余列设为目标值
		return db.Model(&User{}).Where("id = ?", userId).Update("free_quota", value).Error
	})
	if err != nil {
		return err
	}
	uid, v := userId, value
	gopool.Go(func() {
		if cErr := setFreeQuotaCache(uid, int64(v)); cErr != nil {
			common.SysLog("failed to set free quota cache after override: " + cErr.Error())
		}
	})
	return nil
}

// GetUsersWithExpiredFreeQuota 返回存在"已过期但仍 active 且有剩余"免费明细的用户ID列表，
// 限 limit 个（去重）。供后台批量回收任务分批拉取。
func GetUsersWithExpiredFreeQuota(now int64, limit int) ([]int, error) {
	var userIds []int
	err := DB.Model(&FreeQuotaLedger{}).
		Where("status = ? AND remaining > 0 AND expired_time <= ?", FreeLedgerStatusActive, now).
		Distinct("user_id").
		Limit(limit).
		Pluck("user_id", &userIds).Error
	return userIds, err
}

// BatchRecycleExpiredFreeQuota 批量回收所有用户的过期免费额度。
// 分批拉取待回收用户，逐个调用 RecycleExpiredFreeQuota（单用户事务安全）。
// 返回回收的用户数与回收总额。maxUsers<=0 时不限用户数（跑到无待回收为止）。
func BatchRecycleExpiredFreeQuota(maxUsers int) (userCount int, totalRecycled int, err error) {
	const batchSize = 500
	now := common.GetTimestamp()
	for {
		if maxUsers > 0 && userCount >= maxUsers {
			break
		}
		limit := batchSize
		if maxUsers > 0 && maxUsers-userCount < limit {
			limit = maxUsers - userCount
		}
		userIds, e := GetUsersWithExpiredFreeQuota(now, limit)
		if e != nil {
			return userCount, totalRecycled, e
		}
		if len(userIds) == 0 {
			break
		}
		for _, uid := range userIds {
			recycled, rErr := RecycleExpiredFreeQuota(nil, uid)
			if rErr != nil {
				common.SysLog(fmt.Sprintf("batch recycle free quota failed for user %d: %s", uid, rErr.Error()))
				continue
			}
			userCount++
			totalRecycled += recycled
		}
		// 本批不足 batchSize，说明已扫完
		if len(userIds) < limit {
			break
		}
	}
	return userCount, totalRecycled, nil
}

// RecycleExpiredFreeQuotaLoop 免费额度过期回收后台循环任务。
// 仅 master 节点运行（调用方保证），周期性批量回收所有用户的过期免费额度，
// 保证不活跃用户的 free_quota 冗余列不会因过期明细未回收而长期虚高。
// 间隔由 env FREE_QUOTA_RECYCLE_INTERVAL 控制（秒），默认 3600（1 小时）。
func RecycleExpiredFreeQuotaLoop() {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("RecycleExpiredFreeQuotaLoop panic recovered: %v", r))
		}
	}()
	// 仅 master 节点运行，避免多实例重复回收。
	if !common.IsMasterNode {
		return
	}
	interval := common.GetEnvOrDefault("FREE_QUOTA_RECYCLE_INTERVAL", 3600)
	if interval <= 0 {
		interval = 3600
	}
	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()
	common.SysLog(fmt.Sprintf("free quota recycle loop started, interval: %d seconds", interval))
	for range ticker.C {
		userCount, recycled, err := BatchRecycleExpiredFreeQuota(0)
		if err != nil {
			common.SysError("free quota recycle failed: " + err.Error())
			continue
		}
		if userCount > 0 {
			common.SysLog(fmt.Sprintf("free quota recycle done: %d users, %d quota recycled", userCount, recycled))
		}
	}
}
