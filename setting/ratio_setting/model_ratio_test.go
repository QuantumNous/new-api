package ratio_setting_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestGemini3ModelRatios(t *testing.T) {
	ratio_setting.InitRatioSettings()

	tests := []struct {
		model              string
		expectedModelRatio float64
		expectedCompRatio  float64
	}{
		{
			model:              "gemini-3.1-flash-lite",
			expectedModelRatio: 0.125,
			expectedCompRatio:  6.0,
		},
		{
			model:              "gemini-3.5-flash-lite",
			expectedModelRatio: 0.15,
			expectedCompRatio:  2.5 / 0.3,
		},
		{
			model:              "gemini-3.6",
			expectedModelRatio: 0.75,
			expectedCompRatio:  5.0,
		},
		{
			model:              "gemini-3.6-flash",
			expectedModelRatio: 0.75,
			expectedCompRatio:  5.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			ratio, ok, _ := ratio_setting.GetModelRatio(tt.model)
			require.True(t, ok, "model ratio for %s should exist", tt.model)
			assert.InDelta(t, tt.expectedModelRatio, ratio, 0.0001, "model ratio mismatch for %s", tt.model)

			compRatio := ratio_setting.GetCompletionRatio(tt.model)
			assert.InDelta(t, tt.expectedCompRatio, compRatio, 0.0001, "completion ratio mismatch for %s", tt.model)
		})
	}
}
