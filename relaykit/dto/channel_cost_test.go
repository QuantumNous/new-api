package dto

import "testing"

func TestChannelCostSettingsValidate(t *testing.T) {
	tests := []struct {
		name    string
		s       ChannelCostSettings
		wantErr bool
	}{
		{"disabled ignores mode", ChannelCostSettings{Enabled: false, Mode: ""}, false},
		{"discount valid", ChannelCostSettings{Enabled: true, Mode: ChannelCostModeDiscount, Discount: 0.8}, false},
		{"discount zero invalid", ChannelCostSettings{Enabled: true, Mode: ChannelCostModeDiscount, Discount: 0}, true},
		{"discount negative invalid", ChannelCostSettings{Enabled: true, Mode: ChannelCostModeDiscount, Discount: -1}, true},
		{"fixed valid", ChannelCostSettings{Enabled: true, Mode: ChannelCostModeFixed, FixedPrice: 0.002}, false},
		{"fixed zero valid", ChannelCostSettings{Enabled: true, Mode: ChannelCostModeFixed, FixedPrice: 0}, false},
		{"fixed negative invalid", ChannelCostSettings{Enabled: true, Mode: ChannelCostModeFixed, FixedPrice: -0.1}, true},
		{"unknown mode invalid", ChannelCostSettings{Enabled: true, Mode: "percent", Discount: 0.8}, true},
		{"model_prices valid", ChannelCostSettings{
			Enabled: true, Mode: ChannelCostModeDiscount, Discount: 1,
			ModelPrices: map[string]ChannelModelCost{"gpt-4o": {ModelRatio: 1, CompletionRatio: 2}},
		}, false},
		{"model_prices both price and ratio invalid", ChannelCostSettings{
			Enabled: true, Mode: ChannelCostModeDiscount, Discount: 1,
			ModelPrices: map[string]ChannelModelCost{"gpt-4o": {ModelPrice: 0.01, ModelRatio: 1}},
		}, true},
		{"model_prices empty entry valid (fallback)", ChannelCostSettings{
			Enabled: true, Mode: ChannelCostModeDiscount, Discount: 1,
			ModelPrices: map[string]ChannelModelCost{"gpt-4o": {}},
		}, false},
		{"model_prices negative ratio invalid", ChannelCostSettings{
			Enabled: true, Mode: ChannelCostModeDiscount, Discount: 1,
			ModelPrices: map[string]ChannelModelCost{"gpt-4o": {ModelRatio: 1, CompletionRatio: -1}},
		}, true},
		{"model_prices empty name invalid", ChannelCostSettings{
			Enabled: true, Mode: ChannelCostModeDiscount, Discount: 1,
			ModelPrices: map[string]ChannelModelCost{" ": {ModelRatio: 1}},
		}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.s.Validate()
			if (err != nil) != tt.wantErr {
				t.Fatalf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
