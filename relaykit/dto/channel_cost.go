package dto

import (
	"fmt"
	"strings"
)

// ChannelCostMode 渠道调用成本计算模式。
type ChannelCostMode string

const (
	// ChannelCostModeDiscount 折扣模式：对模型原始定价乘系数（不含分组倍率）。
	ChannelCostModeDiscount ChannelCostMode = "discount"
	// ChannelCostModeFixed 固定价格模式：每次调用固定成本。
	ChannelCostModeFixed ChannelCostMode = "fixed"
)

// ChannelCostSettings 渠道调用成本配置（渠道级，作用于该渠道全部模型）。
// ModelPrices 为该渠道独立的"模型成本价格表"（per model，复用模型 ratio 体系），
// 由运营者从该渠道上游同步（仅该渠道已添加的模型），用于精确计算每模型成本。
type ChannelCostSettings struct {
	Enabled     bool                        `json:"enabled"`     // 是否启用成本核算
	Mode        ChannelCostMode             `json:"mode"`        // 计算模式
	Discount    float64                     `json:"discount"`    // 折扣系数（对模型成本价，不含分组倍率），默认 1
	FixedPrice  float64                     `json:"fixed_price"` // 固定价格（美元/次）
	ModelPrices map[string]ChannelModelCost `json:"model_prices,omitempty"` // 模型成本价格表
}

// ChannelModelCost 单个模型在该渠道的成本价（复用模型 ratio 体系，与上游定价同步返回格式一致）。
type ChannelModelCost struct {
	ModelRatio           float64 `json:"model_ratio"`                      // 按量计费的模型倍率
	ModelPrice           float64 `json:"model_price"`                      // 按次/按图计费的模型价格（>0 时按次）
	CompletionRatio      float64 `json:"completion_ratio"`                 // 补全倍率
	CacheRatio           float64 `json:"cache_ratio,omitempty"`            // 缓存读取倍率
	CreateCacheRatio     float64 `json:"create_cache_ratio,omitempty"`     // 缓存写入倍率
	ImageRatio           float64 `json:"image_ratio,omitempty"`            // 图像倍率
	AudioRatio           float64 `json:"audio_ratio,omitempty"`            // 音频倍率
	AudioCompletionRatio float64 `json:"audio_completion_ratio,omitempty"` // 音频补全倍率
}

// Validate 校验成本配置。未启用时忽略其余字段。
func (s *ChannelCostSettings) Validate() error {
	if s == nil || !s.Enabled {
		return nil
	}
	switch strings.TrimSpace(string(s.Mode)) {
	case string(ChannelCostModeDiscount):
		if s.Discount <= 0 {
			return fmt.Errorf("折扣系数必须大于 0")
		}
		if s.Discount > 100 {
			return fmt.Errorf("折扣系数过大（>100）")
		}
		for model, mc := range s.ModelPrices {
			if strings.TrimSpace(model) == "" {
				return fmt.Errorf("成本价格表存在空模型名")
			}
			if mc.ModelPrice > 0 && mc.ModelRatio > 0 {
				return fmt.Errorf("模型 %s 的 model_price 与 model_ratio 不能同时配置", model)
			}
			if mc.ModelPrice <= 0 && mc.ModelRatio <= 0 {
				return fmt.Errorf("模型 %s 的成本价格未配置（model_price 或 model_ratio 至少其一）", model)
			}
			if mc.CompletionRatio < 0 || mc.CacheRatio < 0 || mc.CreateCacheRatio < 0 ||
				mc.ImageRatio < 0 || mc.AudioRatio < 0 || mc.AudioCompletionRatio < 0 {
				return fmt.Errorf("模型 %s 的倍率不能为负数", model)
			}
		}
	case string(ChannelCostModeFixed):
		if s.FixedPrice < 0 {
			return fmt.Errorf("固定价格不能为负数")
		}
	default:
		return fmt.Errorf("无效的成本计算模式: %s", s.Mode)
	}
	return nil
}
