package billing

import "github.com/QuantumNous/new-api/internal/settings"

type QuotaSetting struct {
	EnableFreeModelPreConsume bool    `json:"enable_free_model_pre_consume"` // 是否对免费模型启用预消耗
	EmptyResponseMultiplier   float64 `json:"empty_response_multiplier"`     // 空响应扣费倍率（0-1），0 表示全额豁免
}

// 默认配置
var quotaSetting = QuotaSetting{
	EnableFreeModelPreConsume: true,
	EmptyResponseMultiplier:   0.1,
}

func init() {
	// 注册到全局配置管理器
	settings.GlobalConfig.Register("quota_setting", &quotaSetting)
}

func GetQuotaSetting() *QuotaSetting {
	return &quotaSetting
}
