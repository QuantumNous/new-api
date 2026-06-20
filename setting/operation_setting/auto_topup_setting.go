package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// AutoTopupSetting 自动充值定价配置（运营可调）。
//
// 自动扣款额 = quota 的成本值（按 QuotaPerUnit 换算）× SellMultiplier，
// 不低于 MinChargeCents。币种为 USD。
type AutoTopupSetting struct {
	// 售价倍率：成本$ × 倍率 = 扣款$。5 ⇒ $5/单位（≈ 8 AUD 手动价）。
	SellMultiplier int `json:"sell_multiplier"`
	// 单次自动充值（Stripe/USD）的最低扣款，单位：美分。500 ⇒ $5.00。
	MinChargeCents int `json:"min_charge_cents"`
	// Airwallex 免密自动扣款总开关，默认关。打开前需真卡验证整条链路。
	AirwallexEnabled bool `json:"airwallex_enabled"`
	// Airwallex 自动充值最低扣款，单位：AUD 分。500 ⇒ A$5.00。
	// AUD 与 USD 不等值，不可复用 MinChargeCents。
	MinChargeAUDCents int `json:"min_charge_aud_cents"`
}

var autoTopupSetting = AutoTopupSetting{
	SellMultiplier:    5,
	MinChargeCents:    500,
	AirwallexEnabled:  false,
	MinChargeAUDCents: 500,
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

// AutoTopupMinChargeCents 返回 Stripe/USD 最低扣款（分），非法值回落到默认 500。
func AutoTopupMinChargeCents() int64 {
	if autoTopupSetting.MinChargeCents <= 0 {
		return 500
	}
	return int64(autoTopupSetting.MinChargeCents)
}

// AutoTopupAirwallexEnabled 返回 Airwallex 免密自动扣款总开关。
func AutoTopupAirwallexEnabled() bool {
	return autoTopupSetting.AirwallexEnabled
}

// AutoTopupMinChargeAUDCents 返回 Airwallex 最低扣款（AUD 分），非法值回落到默认 500。
func AutoTopupMinChargeAUDCents() int64 {
	if autoTopupSetting.MinChargeAUDCents <= 0 {
		return 500
	}
	return int64(autoTopupSetting.MinChargeAUDCents)
}
