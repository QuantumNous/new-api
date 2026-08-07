package ratio_setting

import "testing"

func TestSeedanceGlobalDefaultRatiosMatchBytePlusOverseasPricing(t *testing.T) {
	tests := []struct {
		model string
		want  float64
	}{
		{model: "seedance-2.0", want: 3.5},
		{model: "seedance2.0-pro", want: 3.5},
		{model: "Seedance2.0-pro", want: 3.5},
		{model: "seedance-2.0-fast", want: 2.8},
		{model: "seedance-2.0-mini", want: 1.75},
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			got, ok := defaultModelRatio[tt.model]
			if !ok {
				t.Fatalf("defaultModelRatio[%q] missing", tt.model)
			}
			if got != tt.want {
				t.Fatalf("defaultModelRatio[%q] = %v, want %v", tt.model, got, tt.want)
			}
		})
	}
}
