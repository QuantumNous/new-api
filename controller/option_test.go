package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/stretchr/testify/require"
)

func TestBuildCompletionRatioMetaValueIncludesTierOnlyModels(t *testing.T) {
	metaJSON := buildCompletionRatioMetaValue(map[string]string{
		"ModelTierPricing": `{
  "gpt-5": {
    "enabled": true,
    "basis": "prompt_tokens",
    "tiers": [
      {
        "min_tokens": 0,
        "input_price": 2,
        "completion_price": 16
      }
    ]
  }
}`,
	})

	meta := make(map[string]ratio_setting.CompletionRatioInfo)
	require.NoError(t, common.UnmarshalJsonStr(metaJSON, &meta))

	info, ok := meta["gpt-5"]
	require.True(t, ok)
	require.True(t, info.Locked)
	require.Equal(t, 8.0, info.Ratio)
}
