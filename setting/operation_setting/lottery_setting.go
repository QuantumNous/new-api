package operation_setting

import (
	"encoding/json"
	"errors"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// LotteryPrize 抽奖奖项配置（金额单位：美元 USD）
type LotteryPrize struct {
	Name       string  `json:"name"`
	Usd        float64 `json:"usd"`             // 免费模式奖励美元金额
	Quota      int     `json:"quota,omitempty"` // 已废弃：旧额度字段，加载时自动换算为 usd
	Multiplier float64 `json:"multiplier"`      // 投入模式倍率，范围 [-1, 2]
	Weight     int     `json:"weight"`
	IsThanks   bool    `json:"is_thanks"`
}

// LotterySetting 老虎机抽奖配置（金额单位：美元 USD）
type LotterySetting struct {
	Enabled bool `json:"enabled"`
	// DailyPoolUSD 实际每日支出上限（真实结算用，不对用户展示）
	DailyPoolUSD float64 `json:"daily_pool_usd"`
	// DisplayDailyPoolUSD 用户可见的展示奖池；<=0 时回退为 DailyPoolUSD
	DisplayDailyPoolUSD float64 `json:"display_daily_pool_usd"`
	MinBetUSD           float64 `json:"min_bet_usd"`
	MaxBetUSD           float64 `json:"max_bet_usd"`
	MaxDrawsPerIPPerDay int     `json:"max_draws_per_ip_per_day"` // 0=不限制
	FreePrizes          []LotteryPrize `json:"free_prizes"`
	BetPrizes           []LotteryPrize `json:"bet_prizes"`
}

var lotterySetting = LotterySetting{
	Enabled:             false,
	DailyPoolUSD:        100,  // 实际限额 $100 / day
	DisplayDailyPoolUSD: 8888, // 展示给用户的每日奖池
	MinBetUSD:           0.01, // $0.01
	MaxBetUSD:           10,   // $10
	MaxDrawsPerIPPerDay: 3,
	FreePrizes: []LotteryPrize{
		{Name: "谢谢惠顾", Usd: 0, Weight: 28, IsThanks: true},
		{Name: "安慰奖", Usd: 0.01, Weight: 18},
		{Name: "小奖", Usd: 0.05, Weight: 15},
		{Name: "普通奖", Usd: 0.2, Weight: 12},
		{Name: "中奖", Usd: 0.5, Weight: 10},
		{Name: "大奖", Usd: 1, Weight: 7},
		{Name: "超级大奖", Usd: 2, Weight: 5},
		{Name: "传说奖", Usd: 5, Weight: 3},
		{Name: "头奖", Usd: 20, Weight: 2},
	},
	BetPrizes: []LotteryPrize{
		{Name: "血本无归", Multiplier: -1, Weight: 12},
		{Name: "大亏", Multiplier: -0.5, Weight: 12},
		{Name: "小亏", Multiplier: -0.2, Weight: 14},
		{Name: "谢谢惠顾", Multiplier: 0, Weight: 18, IsThanks: true},
		{Name: "回本碎银", Multiplier: 0.2, Weight: 14},
		{Name: "小赚", Multiplier: 0.5, Weight: 12},
		{Name: "翻倍", Multiplier: 1, Weight: 8},
		{Name: "大赚", Multiplier: 1.5, Weight: 6},
		{Name: "暴击", Multiplier: 2, Weight: 4},
	},
}

func init() {
	config.GlobalConfig.Register("lottery_setting", &lotterySetting)
}

// GetLotterySetting 获取抽奖配置
func GetLotterySetting() *LotterySetting {
	normalizeLotterySetting(&lotterySetting)
	return &lotterySetting
}

// normalizeLotterySetting 兼容旧版额度字段 / 旧 option key 语义
func normalizeLotterySetting(s *LotterySetting) {
	if s == nil {
		return
	}
	for i := range s.FreePrizes {
		if s.FreePrizes[i].Usd == 0 && s.FreePrizes[i].Quota > 0 {
			s.FreePrizes[i].Usd = QuotaToUsd(s.FreePrizes[i].Quota)
			s.FreePrizes[i].Quota = 0
		}
	}
}

// IsLotteryEnabled 是否启用抽奖
func IsLotteryEnabled() bool {
	return lotterySetting.Enabled
}

// UsdToQuota 美元转系统额度（默认 500000 额度 = $1）
func UsdToQuota(usd float64) int {
	if usd == 0 {
		return 0
	}
	return int(math.Round(usd * common.QuotaPerUnit))
}

// QuotaToUsd 系统额度转美元
func QuotaToUsd(quota int) float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	return float64(quota) / common.QuotaPerUnit
}

// ValidateLotterySetting 校验配置合法性
func ValidateLotterySetting(s *LotterySetting) error {
	if s == nil {
		return errors.New("lottery setting is nil")
	}
	if s.DailyPoolUSD < 0 {
		return errors.New("daily_pool_usd must be >= 0")
	}
	if s.DisplayDailyPoolUSD < 0 {
		return errors.New("display_daily_pool_usd must be >= 0")
	}
	if s.MinBetUSD < 0 || s.MaxBetUSD < 0 {
		return errors.New("bet usd must be >= 0")
	}
	if s.MinBetUSD > s.MaxBetUSD {
		return errors.New("min_bet_usd must be <= max_bet_usd")
	}
	if s.MaxDrawsPerIPPerDay < 0 {
		return errors.New("max_draws_per_ip_per_day must be >= 0")
	}
	if err := validatePrizeList(s.FreePrizes, false); err != nil {
		return err
	}
	if err := validatePrizeList(s.BetPrizes, true); err != nil {
		return err
	}
	return nil
}

func validatePrizeList(prizes []LotteryPrize, betMode bool) error {
	if len(prizes) == 0 {
		return errors.New("prize list cannot be empty")
	}
	totalWeight := 0
	for _, p := range prizes {
		if p.Name == "" {
			return errors.New("prize name cannot be empty")
		}
		if p.Weight <= 0 {
			return errors.New("prize weight must be > 0")
		}
		if betMode {
			if p.Multiplier < -1 || p.Multiplier > 2 {
				return errors.New("bet prize multiplier must be in [-1, 2]")
			}
		} else if p.Usd < 0 {
			return errors.New("free prize usd must be >= 0")
		}
		totalWeight += p.Weight
	}
	if totalWeight <= 0 {
		return errors.New("total prize weight must be > 0")
	}
	return nil
}

// EffectiveFreeUSD 计算免费奖项当天有效美元（周四翻倍）
func EffectiveFreeUSD(usd float64, isThursday bool) float64 {
	if usd <= 0 {
		return 0
	}
	if isThursday {
		return usd * 2
	}
	return usd
}

// EffectiveDailyPoolUSD 计算当日有效奖池（美元）
func EffectiveDailyPoolUSD(base float64, isThursday bool) float64 {
	if base < 0 {
		base = 0
	}
	if isThursday {
		return base * 2
	}
	return base
}

// ResolvedDisplayDailyPoolUSD 用户可见展示奖池基数（未含周四翻倍）
func ResolvedDisplayDailyPoolUSD(s *LotterySetting) float64 {
	if s == nil {
		return 0
	}
	if s.DisplayDailyPoolUSD > 0 {
		return s.DisplayDailyPoolUSD
	}
	return s.DailyPoolUSD
}

// EffectiveFreeQuota 免费奖项当天有效额度
func EffectiveFreeQuota(usd float64, isThursday bool) int {
	return UsdToQuota(EffectiveFreeUSD(usd, isThursday))
}

// EffectiveDailyPoolQuota 当日有效奖池额度
func EffectiveDailyPoolQuota(baseUSD float64, isThursday bool) int {
	return UsdToQuota(EffectiveDailyPoolUSD(baseUSD, isThursday))
}

// RoundBetDelta 按倍率计算净额度变化（bet 为额度）
func RoundBetDelta(betQuota int, multiplier float64) int {
	if betQuota <= 0 {
		return 0
	}
	return int(math.Round(float64(betQuota) * multiplier))
}

// LotteryPrizesJSON 序列化奖项
func LotteryPrizesJSON(prizes []LotteryPrize) string {
	b, err := json.Marshal(prizes)
	if err != nil {
		return "[]"
	}
	return string(b)
}
