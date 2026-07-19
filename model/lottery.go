package model

import (
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// LotteryDraw 用户抽奖记录（每用户每天一条）
type LotteryDraw struct {
	Id         int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId     int    `json:"user_id" gorm:"not null;uniqueIndex:idx_lottery_user_date"`
	DrawDate   string `json:"draw_date" gorm:"type:varchar(10);not null;uniqueIndex:idx_lottery_user_date"`
	BetQuota   int    `json:"bet_quota" gorm:"not null;default:0"`
	PrizeName  string `json:"prize_name" gorm:"type:varchar(128);not null"`
	PrizeIndex int    `json:"prize_index" gorm:"not null"`
	QuotaDelta int    `json:"quota_delta" gorm:"not null"`
	IsThanks   bool   `json:"is_thanks" gorm:"default:false"`
	IsPity     bool   `json:"is_pity" gorm:"default:false"`
	IsThursday bool   `json:"is_thursday" gorm:"default:false"`
	ClientIP   string `json:"client_ip" gorm:"type:varchar(64);index"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint"`
}

func (LotteryDraw) TableName() string {
	return "lottery_draws"
}

// LotteryDailyPool 每日奖池
type LotteryDailyPool struct {
	PoolDate       string `json:"pool_date" gorm:"primaryKey;type:varchar(10)"`
	TotalQuota     int    `json:"total_quota" gorm:"not null"`
	RemainingQuota int    `json:"remaining_quota" gorm:"not null"`
	UpdatedAt      int64  `json:"updated_at" gorm:"bigint"`
}

func (LotteryDailyPool) TableName() string {
	return "lottery_daily_pools"
}

// LotteryUserState 用户保底状态
type LotteryUserState struct {
	UserId       int `json:"user_id" gorm:"primaryKey"`
	ThanksStreak int `json:"thanks_streak" gorm:"not null;default:0"`
}

func (LotteryUserState) TableName() string {
	return "lottery_user_states"
}

// LotteryResult 抽奖结果（对外）
type LotteryResult struct {
	Draw          *LotteryDraw `json:"draw"`
	RemainingPool int          `json:"remaining_pool"`
}

var (
	lotteryNowFunc  = time.Now
	lotteryRandIntn = rand.Intn
)

func lotteryToday() string {
	return lotteryNowFunc().Format("2006-01-02")
}

func lotteryIsThursday() bool {
	return lotteryNowFunc().Weekday() == time.Thursday
}

// GetUserLotteryState 获取用户抽奖状态（供 GET API）
func GetUserLotteryState(userId int) (map[string]interface{}, error) {
	setting := operation_setting.GetLotterySetting()
	if !setting.Enabled {
		return nil, errors.New("抽奖功能未启用")
	}
	if err := operation_setting.ValidateLotterySetting(setting); err != nil {
		return nil, fmt.Errorf("抽奖配置无效: %w", err)
	}

	today := lotteryToday()
	isThursday := lotteryIsThursday()
	effectivePoolUSD := operation_setting.EffectiveDailyPoolUSD(setting.DailyPoolUSD, isThursday)
	effectivePoolQuota := operation_setting.UsdToQuota(effectivePoolUSD)

	if _, err := ensureLotteryDailyPool(today, effectivePoolQuota); err != nil {
		return nil, err
	}

	var todayDraw *LotteryDraw
	var draw LotteryDraw
	err := DB.Where("user_id = ? AND draw_date = ?", userId, today).First(&draw).Error
	if err == nil {
		todayDraw = &draw
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	streak, _ := getLotteryThanksStreak(userId)
	userQuota, _ := GetUserQuota(userId, false)

	freePrizes := make([]map[string]interface{}, 0, len(setting.FreePrizes))
	for _, p := range setting.FreePrizes {
		usd := operation_setting.EffectiveFreeUSD(p.Usd, isThursday)
		freePrizes = append(freePrizes, map[string]interface{}{
			"name":      p.Name,
			"usd":       usd,
			"weight":    p.Weight,
			"is_thanks": p.IsThanks,
		})
	}
	betPrizes := make([]map[string]interface{}, 0, len(setting.BetPrizes))
	for _, p := range setting.BetPrizes {
		betPrizes = append(betPrizes, map[string]interface{}{
			"name":       p.Name,
			"multiplier": p.Multiplier,
			"weight":     p.Weight,
			"is_thanks":  p.IsThanks,
		})
	}

	todayDrawView := interface{}(nil)
	if todayDraw != nil {
		todayDrawView = map[string]interface{}{
			"prize_name":  todayDraw.PrizeName,
			"prize_index": todayDraw.PrizeIndex,
			"quota_delta": todayDraw.QuotaDelta,
			"usd_delta":   operation_setting.QuotaToUsd(todayDraw.QuotaDelta),
			"bet_quota":   todayDraw.BetQuota,
			"bet_usd":     operation_setting.QuotaToUsd(todayDraw.BetQuota),
			"is_thanks":   todayDraw.IsThanks,
			"is_pity":     todayDraw.IsPity,
			"is_thursday": todayDraw.IsThursday,
			"draw_date":   todayDraw.DrawDate,
		}
	}

	// 管理员不限制每日次数，方便自测
	canDraw := todayDraw == nil || IsAdmin(userId)

	// 用户侧只返回展示奖池，不暴露真实限额与剩余
	displayPoolUSD := operation_setting.ResolvedDisplayDailyPoolUSD(setting)
	effectiveDisplayPoolUSD := operation_setting.EffectiveDailyPoolUSD(displayPoolUSD, isThursday)

	return map[string]interface{}{
		"enabled":                          true,
		"can_draw":                         canDraw,
		"is_crazy_thursday":                isThursday,
		"display_daily_pool_usd":           displayPoolUSD,
		"effective_display_daily_pool_usd": effectiveDisplayPoolUSD,
		"min_bet_usd":                      setting.MinBetUSD,
		"max_bet_usd":                      setting.MaxBetUSD,
		"user_quota":                       userQuota,
		"user_usd":                         operation_setting.QuotaToUsd(userQuota),
		"quota_per_unit":                   common.QuotaPerUnit,
		"thanks_streak":                    streak,
		"pity_threshold":                   2,
		"free_prizes":                      freePrizes,
		"bet_prizes":                       betPrizes,
		"today_draw":                       todayDrawView,
	}, nil
}

// UserLotteryDraw 执行抽奖；betUSD 为投入美元，0 表示免费模式
func UserLotteryDraw(userId int, betUSD float64, clientIP string) (*LotteryResult, error) {
	setting := operation_setting.GetLotterySetting()
	if !setting.Enabled {
		return nil, errors.New("抽奖功能未启用")
	}
	if err := operation_setting.ValidateLotterySetting(setting); err != nil {
		return nil, fmt.Errorf("抽奖配置无效: %w", err)
	}
	if betUSD < 0 {
		return nil, errors.New("投入金额无效")
	}

	today := lotteryToday()
	isThursday := lotteryIsThursday()
	isAdmin := IsAdmin(userId)

	var existing int64
	if err := DB.Model(&LotteryDraw{}).Where("user_id = ? AND draw_date = ?", userId, today).Count(&existing).Error; err != nil {
		return nil, err
	}
	if existing > 0 {
		if !isAdmin {
			return nil, errors.New("今日已抽奖")
		}
		// 管理员可重复抽：删除当日旧记录，避免唯一索引冲突
		if err := DB.Where("user_id = ? AND draw_date = ?", userId, today).Delete(&LotteryDraw{}).Error; err != nil {
			return nil, err
		}
	}

	if !isAdmin && setting.MaxDrawsPerIPPerDay > 0 && clientIP != "" {
		var ipCount int64
		if err := DB.Model(&LotteryDraw{}).
			Where("client_ip = ? AND draw_date = ?", clientIP, today).
			Count(&ipCount).Error; err != nil {
			return nil, err
		}
		if int(ipCount) >= setting.MaxDrawsPerIPPerDay {
			return nil, errors.New("当前网络今日抽奖次数已达上限")
		}
	}

	userQuota, err := GetUserQuota(userId, true)
	if err != nil {
		return nil, err
	}
	userUSD := operation_setting.QuotaToUsd(userQuota)

	betQuota := 0
	if betUSD > 0 {
		if betUSD < setting.MinBetUSD || betUSD > setting.MaxBetUSD {
			return nil, errors.New("投入金额超出允许范围")
		}
		if betUSD > userUSD+1e-9 {
			return nil, errors.New("投入金额不能超过当前余额")
		}
		betQuota = operation_setting.UsdToQuota(betUSD)
		if betQuota > userQuota {
			return nil, errors.New("投入金额不能超过当前余额")
		}
	}

	streak, err := getLotteryThanksStreak(userId)
	if err != nil {
		return nil, err
	}
	forcePity := streak >= 2

	prizeIndex, prize, quotaDelta, isThanks, isPity := pickLotteryPrize(setting, betQuota, isThursday, forcePity)

	effectivePoolQuota := operation_setting.EffectiveDailyPoolQuota(setting.DailyPoolUSD, isThursday)

	// 奖池不足时降级
	prizeIndex, prize, quotaDelta, isThanks, isPity = adjustPrizeForPool(setting, betQuota, isThursday, prizeIndex, prize, quotaDelta, isThanks, isPity, effectivePoolQuota)

	// 负额度时确保余额足够（投入模式）
	if userQuota+quotaDelta < 0 {
		return nil, errors.New("余额不足，无法承担本次惩罚结果")
	}

	draw := &LotteryDraw{
		UserId:     userId,
		DrawDate:   today,
		BetQuota:   betQuota,
		PrizeName:  prize.Name,
		PrizeIndex: prizeIndex,
		QuotaDelta: quotaDelta,
		IsThanks:   isThanks,
		IsPity:     isPity,
		IsThursday: isThursday,
		ClientIP:   clientIP,
		CreatedAt:  lotteryNowFunc().Unix(),
	}

	var remaining int
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		remaining, err = userLotteryWithoutTransaction(draw, userId, quotaDelta, effectivePoolQuota, isThanks)
	} else {
		remaining, err = userLotteryWithTransaction(draw, userId, quotaDelta, effectivePoolQuota, isThanks)
	}
	if err != nil {
		return nil, err
	}

	return &LotteryResult{Draw: draw, RemainingPool: remaining}, nil
}

func pickLotteryPrize(
	setting *operation_setting.LotterySetting,
	betQuota int,
	isThursday bool,
	forcePity bool,
) (index int, prize operation_setting.LotteryPrize, delta int, isThanks bool, isPity bool) {
	prizes := setting.FreePrizes
	betMode := betQuota > 0
	if betMode {
		prizes = setting.BetPrizes
	}

	if forcePity {
		idx, p, ok := smallestPositivePrize(prizes, betMode)
		if ok {
			delta = computePrizeDelta(p, betQuota, isThursday, betMode)
			return idx, p, delta, false, true
		}
	}

	index = weightedPick(prizes)
	prize = prizes[index]
	isThanks = prize.IsThanks
	delta = computePrizeDelta(prize, betQuota, isThursday, betMode)
	return index, prize, delta, isThanks, false
}

func computePrizeDelta(prize operation_setting.LotteryPrize, betQuota int, isThursday bool, betMode bool) int {
	if betMode {
		return operation_setting.RoundBetDelta(betQuota, prize.Multiplier)
	}
	return operation_setting.EffectiveFreeQuota(prize.Usd, isThursday)
}

func smallestPositivePrize(prizes []operation_setting.LotteryPrize, betMode bool) (int, operation_setting.LotteryPrize, bool) {
	bestIdx := -1
	var best operation_setting.LotteryPrize
	for i, p := range prizes {
		if betMode {
			if p.Multiplier <= 0 {
				continue
			}
			if bestIdx < 0 || p.Multiplier < best.Multiplier {
				bestIdx = i
				best = p
			}
			continue
		}
		if p.Usd <= 0 {
			continue
		}
		if bestIdx < 0 || p.Usd < best.Usd {
			bestIdx = i
			best = p
		}
	}
	if bestIdx < 0 {
		return 0, operation_setting.LotteryPrize{}, false
	}
	return bestIdx, best, true
}

func weightedPick(prizes []operation_setting.LotteryPrize) int {
	total := 0
	for _, p := range prizes {
		total += p.Weight
	}
	if total <= 0 {
		return 0
	}
	r := lotteryRandIntn(total)
	cum := 0
	for i, p := range prizes {
		cum += p.Weight
		if r < cum {
			return i
		}
	}
	return len(prizes) - 1
}

func adjustPrizeForPool(
	setting *operation_setting.LotterySetting,
	betQuota int,
	isThursday bool,
	index int,
	prize operation_setting.LotteryPrize,
	delta int,
	isThanks bool,
	isPity bool,
	poolTotalHint int,
) (int, operation_setting.LotteryPrize, int, bool, bool) {
	_ = poolTotalHint
	if delta <= 0 {
		return index, prize, delta, isThanks, isPity
	}

	today := lotteryToday()
	pool, err := ensureLotteryDailyPool(today, operation_setting.EffectiveDailyPoolQuota(setting.DailyPoolUSD, isThursday))
	if err != nil {
		return index, prize, delta, isThanks, isPity
	}
	if pool.RemainingQuota >= delta {
		return index, prize, delta, isThanks, isPity
	}

	betMode := betQuota > 0
	prizes := setting.FreePrizes
	if betMode {
		prizes = setting.BetPrizes
	}

	// 找奖池能覆盖的最大正奖
	bestIdx := -1
	var best operation_setting.LotteryPrize
	bestDelta := 0
	for i, p := range prizes {
		d := computePrizeDelta(p, betQuota, isThursday, betMode)
		if d <= 0 || d > pool.RemainingQuota {
			continue
		}
		if bestIdx < 0 || d > bestDelta {
			bestIdx = i
			best = p
			bestDelta = d
		}
	}
	if bestIdx >= 0 {
		return bestIdx, best, bestDelta, false, isPity
	}

	// 强制谢谢惠顾；若本是保底则保留 isPity，以便 streak 不清零
	for i, p := range prizes {
		if p.IsThanks {
			return i, p, 0, true, isPity
		}
	}
	return 0, prizes[0], 0, true, isPity
}

func ensureLotteryDailyPool(date string, total int) (*LotteryDailyPool, error) {
	var pool LotteryDailyPool
	err := DB.Where("pool_date = ?", date).First(&pool).Error
	if err == nil {
		return &pool, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	pool = LotteryDailyPool{
		PoolDate:       date,
		TotalQuota:     total,
		RemainingQuota: total,
		UpdatedAt:      lotteryNowFunc().Unix(),
	}
	if err := DB.Create(&pool).Error; err != nil {
		// 并发创建时再读一次
		var again LotteryDailyPool
		if e := DB.Where("pool_date = ?", date).First(&again).Error; e == nil {
			return &again, nil
		}
		return nil, err
	}
	return &pool, nil
}

func getLotteryThanksStreak(userId int) (int, error) {
	var state LotteryUserState
	err := DB.Where("user_id = ?", userId).First(&state).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return state.ThanksStreak, nil
}

func userLotteryWithTransaction(draw *LotteryDraw, userId, quotaDelta, effectivePool int, isThanks bool) (int, error) {
	remaining := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		today := draw.DrawDate
		var pool LotteryDailyPool
		if err := lockForUpdate(tx).Where("pool_date = ?", today).First(&pool).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				pool = LotteryDailyPool{
					PoolDate:       today,
					TotalQuota:     effectivePool,
					RemainingQuota: effectivePool,
					UpdatedAt:      lotteryNowFunc().Unix(),
				}
				if err := tx.Create(&pool).Error; err != nil {
					return errors.New("初始化奖池失败")
				}
				if err := lockForUpdate(tx).Where("pool_date = ?", today).First(&pool).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		}

		// 再次按锁后剩余调整（并发）
		if quotaDelta > 0 && pool.RemainingQuota < quotaDelta {
			return errors.New("奖池不足，请稍后重试")
		}

		if err := tx.Create(draw).Error; err != nil {
			return errors.New("抽奖失败，请稍后重试")
		}

		var user User
		if err := lockForUpdate(tx).Where("id = ?", userId).First(&user).Error; err != nil {
			return errors.New("用户不存在")
		}
		if user.Quota+quotaDelta < 0 {
			return errors.New("余额不足，无法承担本次结果")
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", quotaDelta)).Error; err != nil {
			return errors.New("更新额度失败")
		}

		newRemaining := pool.RemainingQuota
		if quotaDelta > 0 {
			newRemaining -= quotaDelta
		} else if quotaDelta < 0 {
			newRemaining += -quotaDelta
		}
		if err := tx.Model(&LotteryDailyPool{}).Where("pool_date = ?", today).Updates(map[string]interface{}{
			"remaining_quota": newRemaining,
			"updated_at":      lotteryNowFunc().Unix(),
		}).Error; err != nil {
			return errors.New("更新奖池失败")
		}
		remaining = newRemaining

		return applyThanksStreakTx(tx, userId, draw)
	})
	if err != nil {
		return 0, err
	}
	if quotaDelta != 0 {
		go func() {
			_ = cacheIncrUserQuota(userId, int64(quotaDelta))
		}()
	}
	return remaining, nil
}

func userLotteryWithoutTransaction(draw *LotteryDraw, userId, quotaDelta, effectivePool int, isThanks bool) (int, error) {
	_ = isThanks
	today := draw.DrawDate
	pool, err := ensureLotteryDailyPool(today, effectivePool)
	if err != nil {
		return 0, err
	}
	if quotaDelta > 0 && pool.RemainingQuota < quotaDelta {
		return 0, errors.New("奖池不足，请稍后重试")
	}

	if err := DB.Create(draw).Error; err != nil {
		return 0, errors.New("抽奖失败，请稍后重试")
	}

	if quotaDelta > 0 {
		if err := IncreaseUserQuota(userId, quotaDelta, true); err != nil {
			DB.Delete(draw)
			return 0, errors.New("更新额度失败")
		}
	} else if quotaDelta < 0 {
		if err := DecreaseUserQuota(userId, -quotaDelta, true); err != nil {
			DB.Delete(draw)
			return 0, errors.New("更新额度失败")
		}
	}

	newRemaining := pool.RemainingQuota
	if quotaDelta > 0 {
		newRemaining -= quotaDelta
	} else if quotaDelta < 0 {
		newRemaining += -quotaDelta
	}
	if err := DB.Model(&LotteryDailyPool{}).Where("pool_date = ?", today).Updates(map[string]interface{}{
		"remaining_quota": newRemaining,
		"updated_at":      lotteryNowFunc().Unix(),
	}).Error; err != nil {
		return 0, errors.New("更新奖池失败")
	}

	_ = applyThanksStreakTx(DB, userId, draw)
	return newRemaining, nil
}

// applyThanksStreakTx 更新保底计数：谢谢惠顾递增；中奖清零；保底因奖池发 0 时保持
func applyThanksStreakTx(tx *gorm.DB, userId int, draw *LotteryDraw) error {
	if draw.IsPity && draw.QuotaDelta == 0 {
		return nil
	}

	var state LotteryUserState
	err := tx.Where("user_id = ?", userId).First(&state).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		state = LotteryUserState{UserId: userId, ThanksStreak: 0}
		if draw.IsThanks {
			state.ThanksStreak = 1
		}
		return tx.Create(&state).Error
	}
	if err != nil {
		return err
	}
	if draw.IsThanks {
		state.ThanksStreak++
	} else {
		state.ThanksStreak = 0
	}
	return tx.Save(&state).Error
}
