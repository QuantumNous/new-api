package ratio_setting

import "testing"

func TestGPT56DefaultRatios(t *testing.T) {
	tests := []struct {
		model string
		input float64
	}{
		{model: "gpt-5.6", input: 2.5},
		{model: "gpt-5.6-sol", input: 2.5},
		{model: "gpt-5.6-terra", input: 1.25},
		{model: "gpt-5.6-luna", input: 0.5},
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			if got := defaultModelRatio[tt.model]; got != tt.input {
				t.Fatalf("input ratio = %v, want %v", got, tt.input)
			}
			if got := defaultCacheRatio[tt.model]; got != 0.1 {
				t.Fatalf("cache ratio = %v, want 0.1", got)
			}
			if got := defaultCreateCacheRatio[tt.model]; got != 1.25 {
				t.Fatalf("create cache ratio = %v, want 1.25", got)
			}
			if got, _ := getHardcodedCompletionModelRatio(tt.model); got != 6 {
				t.Fatalf("completion ratio = %v, want 6", got)
			}
		})
	}
}
