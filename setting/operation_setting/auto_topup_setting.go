package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// AutoTopupSetting 自动充值定价配置（运营可调）。
//
// 自动扣款额 = quota 的成本值（按 QuotaPerUnit 换算）× SellMultiplier，
// 不低于 MinChargeCents。币种为 USD。
type AutoTopupSetting struct {
	// 售价倍率：成本$ × 倍率 = 扣款$。5 ⇒ $5/单位（≈ 8 AUD 手动价）。
	SellMultiplier int `json:"sell_multiplier"`
	// 单次自动充值的最低扣款，单位：美分。500 ⇒ $5.00。
	MinChargeCents int `json:"min_charge_cents"`
}

var autoTopupSetting = AutoTopupSetting{
	SellMultiplier: 5,
	MinChargeCents: 500,
}

func init() {
	config.GlobalConfig.Register("auto_topup_setting", &autoTopupSetting)
}

// GetAutoTopupSetting 返回自动充值定价配置。
func GetAutoTopupSetting() *AutoTopupSetting {
	return &autoTopupSetting
}

// AutoTopupSellMultiplier 返回售价倍率，非法值回落到默认 5。
func AutoTopupSellMultiplier() int64 {
	if autoTopupSetting.SellMultiplier <= 0 {
		return 5
	}
	return int64(autoTopupSetting.SellMultiplier)
}

// AutoTopupMinChargeCents 返回最低扣款（分），非法值回落到默认 500。
func AutoTopupMinChargeCents() int64 {
	if autoTopupSetting.MinChargeCents <= 0 {
		return 500
	}
	return int64(autoTopupSetting.MinChargeCents)
}
