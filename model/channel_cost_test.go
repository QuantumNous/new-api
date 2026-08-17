package model

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

func TestCalculateChannelCost(t *testing.T) {
	tests := []struct {
		name       string
		settings   *dto.ChannelCostSettings
		quota      int
		groupRatio float64
		want       float64
	}{
		{"nil settings", nil, 1000, 1, 0},
		{"disabled", &dto.ChannelCostSettings{Enabled: false}, 1000, 1, 0},
		{"discount normal", &dto.ChannelCostSettings{Enabled: true, Mode: dto.ChannelCostModeDiscount, Discount: 0.5}, 1000, 2, 250},
		{"discount groupRatio zero", &dto.ChannelCostSettings{Enabled: true, Mode: dto.ChannelCostModeDiscount, Discount: 0.5}, 1000, 0, 0},
		{"discount ratio one", &dto.ChannelCostSettings{Enabled: true, Mode: dto.ChannelCostModeDiscount, Discount: 1}, 500000, 1, 500000},
		{"fixed normal", &dto.ChannelCostSettings{Enabled: true, Mode: dto.ChannelCostModeFixed, FixedPrice: 0.001}, 1000, 1, 0.001 * common.QuotaPerUnit},
		{"fixed zero price", &dto.ChannelCostSettings{Enabled: true, Mode: dto.ChannelCostModeFixed, FixedPrice: 0}, 1000, 1, 0},
		{"unknown mode", &dto.ChannelCostSettings{Enabled: true, Mode: "percent", Discount: 0.5}, 1000, 1, 0},
		// 用户场景：quota=19，分组倍率 0.2，渠道折扣 0.1 → 成本应为 9.5（不丢精度）
		{"discount fractional keeps precision", &dto.ChannelCostSettings{Enabled: true, Mode: dto.ChannelCostModeDiscount, Discount: 0.1}, 19, 0.2, 9.5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CalculateChannelCost(tt.settings, tt.quota, tt.groupRatio); math.Abs(got-tt.want) > 1e-9 {
				t.Fatalf("CalculateChannelCost() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCalculateModelCost(t *testing.T) {
	tests := []struct {
		name       string
		mc         dto.ChannelModelCost
		discount   float64
		prompt     int
		completion int
		other      map[string]interface{}
		want       float64
	}{
		{"per-call price", dto.ChannelModelCost{ModelPrice: 0.001}, 1, 0, 0, nil, 0.001 * common.QuotaPerUnit},
		{"per-call price with discount", dto.ChannelModelCost{ModelPrice: 0.001}, 0.5, 0, 0, nil, 0.001 * 0.5 * common.QuotaPerUnit},
		{"basic ratio", dto.ChannelModelCost{ModelRatio: 1, CompletionRatio: 2}, 1, 1000, 100, nil, 1200},
		{"ratio with discount", dto.ChannelModelCost{ModelRatio: 1, CompletionRatio: 2}, 0.5, 1000, 100, nil, 600},
		{"cache read", dto.ChannelModelCost{ModelRatio: 1, CompletionRatio: 1, CacheRatio: 0.5}, 1, 1000, 0,
			map[string]interface{}{"cache_tokens": 200, "cache_ratio": 0.5}, 900},
		{"image", dto.ChannelModelCost{ModelRatio: 1, CompletionRatio: 1, ImageRatio: 1.5}, 1, 1000, 0,
			map[string]interface{}{"image_output": 100, "image_ratio": 1.5}, 1050},
		{"claude cache not subtracted", dto.ChannelModelCost{ModelRatio: 1, CompletionRatio: 1, CacheRatio: 0.5}, 1, 1000, 0,
			map[string]interface{}{"usage_semantic": "anthropic", "cache_tokens": 200, "cache_ratio": 0.5}, 1100},
		{"audio", dto.ChannelModelCost{ModelRatio: 1, CompletionRatio: 1, AudioRatio: 2, AudioCompletionRatio: 3}, 1, 1000, 0,
			map[string]interface{}{"audio_input": 100, "audio_output": 50, "audio_ratio": 2, "audio_completion_ratio": 3}, 1350},
		{"zero cost returns zero", dto.ChannelModelCost{ModelRatio: 1, CompletionRatio: 1}, 1, 0, 0, nil, 0},
		{"fractional keeps precision", dto.ChannelModelCost{ModelRatio: 1, CompletionRatio: 1}, 0.5, 19, 0, nil, 9.5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CalculateModelCost(tt.mc, tt.discount, tt.prompt, tt.completion, tt.other); math.Abs(got-tt.want) > 1e-9 {
				t.Fatalf("CalculateModelCost() = %v, want %v", got, tt.want)
			}
		})
	}
}
