package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// 额度展示类型
const (
	QuotaDisplayTypeUSD    = "USD"
	QuotaDisplayTypeCNY    = "CNY"
	QuotaDisplayTypeTokens = "TOKENS"
	QuotaDisplayTypeCustom = "CUSTOM"
)

// CustomCurrency 自定义货币
type CustomCurrency struct {
	Code         string  `json:"code"`          // 自定义代码，如 EUR
	Symbol       string  `json:"symbol"`        // 符号，如 €
	ExchangeRate float64 `json:"exchange_rate"` // 1 USD = X 该货币
}

type GeneralSetting struct {
	DocsLink            string `json:"docs_link"`
	PingIntervalEnabled bool   `json:"ping_interval_enabled"`
	PingIntervalSeconds int    `json:"ping_interval_seconds"`
	// 当前站点额度展示类型：USD / CNY / TOKENS / CUSTOM / 自定义货币 code（作为默认货币）
	QuotaDisplayType string `json:"quota_display_type"`
	// 启用的货币列表，如 ["USD","CNY","TOKENS","EUR"]，用户可从中选择偏好
	EnabledCurrencies []string `json:"enabled_currencies"`
	// 自定义货币符号，用于 CUSTOM 展示类型（旧字段，向后兼容）
	CustomCurrencySymbol string `json:"custom_currency_symbol"`
	// 自定义货币与美元汇率（1 USD = X Custom）（旧字段，向后兼容）
	CustomCurrencyExchangeRate float64 `json:"custom_currency_exchange_rate"`
	// 自定义货币列表
	CustomCurrencies []CustomCurrency `json:"custom_currencies"`
	// 兑换码功能开关，默认 true
	RedemptionEnabled bool `json:"redemption_enabled"`
	// 允许显示兑换码的分组白名单，空数组表示所有分组可见
	RedemptionAllowedGroups []string `json:"redemption_allowed_groups"`
}

// 默认配置
var generalSetting = GeneralSetting{
	DocsLink:                   "https://docs.newapi.pro",
	PingIntervalEnabled:        false,
	PingIntervalSeconds:        60,
	QuotaDisplayType:           QuotaDisplayTypeUSD,
	EnabledCurrencies:          []string{QuotaDisplayTypeUSD},
	CustomCurrencySymbol:       "¤",
	CustomCurrencyExchangeRate: 1.0,
	CustomCurrencies:           []CustomCurrency{},
	RedemptionEnabled:          true,
	RedemptionAllowedGroups:    []string{},
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("general_setting", &generalSetting)
}

func GetGeneralSetting() *GeneralSetting {
	return &generalSetting
}

// IsCurrencyDisplay 是否以货币形式展示（非 TOKENS 即为货币）
func IsCurrencyDisplay() bool {
	return generalSetting.QuotaDisplayType != QuotaDisplayTypeTokens
}

// IsCNYDisplay 是否以人民币展示
func IsCNYDisplay() bool {
	return generalSetting.QuotaDisplayType == QuotaDisplayTypeCNY
}

// GetQuotaDisplayType 返回额度展示类型
func GetQuotaDisplayType() string {
	return generalSetting.QuotaDisplayType
}

// GetEnabledCurrencies 返回启用的货币列表，若为空则回退到 [QuotaDisplayType]
func GetEnabledCurrencies() []string {
	if len(generalSetting.EnabledCurrencies) > 0 {
		return generalSetting.EnabledCurrencies
	}
	return []string{generalSetting.QuotaDisplayType}
}

// findCustomCurrency 在自定义货币列表中查找指定 code 的货币
func findCustomCurrency(code string) *CustomCurrency {
	for i := range generalSetting.CustomCurrencies {
		if generalSetting.CustomCurrencies[i].Code == code {
			return &generalSetting.CustomCurrencies[i]
		}
	}
	return nil
}

// GetCurrencySymbol 返回当前展示类型对应符号
func GetCurrencySymbol() string {
	switch generalSetting.QuotaDisplayType {
	case QuotaDisplayTypeUSD:
		return "$"
	case QuotaDisplayTypeCNY:
		return "¥"
	case QuotaDisplayTypeCustom:
		if generalSetting.CustomCurrencySymbol != "" {
			return generalSetting.CustomCurrencySymbol
		}
		return "¤"
	case QuotaDisplayTypeTokens:
		return ""
	default:
		// 尝试从自定义货币列表中查找
		if c := findCustomCurrency(generalSetting.QuotaDisplayType); c != nil {
			return c.Symbol
		}
		return ""
	}
}

// GetUsdToCurrencyRate 返回 1 USD = X <currency> 的 X（TOKENS 不适用）
func GetUsdToCurrencyRate(usdToCny float64) float64 {
	switch generalSetting.QuotaDisplayType {
	case QuotaDisplayTypeUSD:
		return 1
	case QuotaDisplayTypeCNY:
		return usdToCny
	case QuotaDisplayTypeCustom:
		if generalSetting.CustomCurrencyExchangeRate > 0 {
			return generalSetting.CustomCurrencyExchangeRate
		}
		return 1
	default:
		// 尝试从自定义货币列表中查找
		if c := findCustomCurrency(generalSetting.QuotaDisplayType); c != nil && c.ExchangeRate > 0 {
			return c.ExchangeRate
		}
		return 1
	}
}
