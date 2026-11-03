package billing

import "github.com/QuantumNous/new-api/internal/settings"

type QuotaSetting struct {
	EnableFreeModelPreConsume bool    `json:"enable_free_model_pre_consume"` // 是否对免费模型启用预消耗
	EmptyResponseMultiplier   float64 `json:"empty_response_multiplier"`     // 空响应扣费倍率（0-1），0 表示全额豁免
	// TruncatedResponseMultiplier 上游断流时输出侧费用的扣费倍率（0-1）。
	// 输入/prompt 始终全额扣费（上游真实消耗），只有断流后已产出的 completion
	// 部分按此倍率折减；按次计费与表达式计费没有输入输出拆分，按总额折减。
	TruncatedResponseMultiplier float64 `json:"truncated_response_multiplier"`
}

// 默认配置
var quotaSetting = QuotaSetting{
	EnableFreeModelPreConsume:   true,
	EmptyResponseMultiplier:     0.1,
	TruncatedResponseMultiplier: 0.3,
}

func init() {
	// 注册到全局配置管理器
	settings.GlobalConfig.Register("quota_setting", &quotaSetting)
}

func GetQuotaSetting() *QuotaSetting {
	return &quotaSetting
}
