package helper

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestModelPriceHelperAllowsTierOnlyPricing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	require.NoError(t, ratio_setting.UpdateModelTierPricingByJSONString(`{
  "tier-only-gemini-3.1-pro-preview": {
    "enabled": true,
    "basis": "prompt_tokens",
    "tiers": [
      {
        "min_tokens": 0,
        "max_tokens": 200000,
        "input_price": 2,
        "completion_price": 12,
        "cache_read_price": 0.2
      },
      {
        "min_tokens": 200000,
        "input_price": 4,
        "completion_price": 18,
        "cache_read_price": 0.4
      }
    ]
  }
}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelTierPricingByJSONString("{}"))
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		OriginModelName: "tier-only-gemini-3.1-pro-preview",
		UsingGroup:      "default",
		UserGroup:       "default",
	}

	priceData, err := ModelPriceHelper(ctx, info, 250000, &types.TokenCountMeta{})
	require.NoError(t, err)
	require.False(t, priceData.UsePrice)
	require.Equal(t, 2.0, priceData.ModelRatio)
	require.Equal(t, 4.5, priceData.CompletionRatio)
	require.Equal(t, 0.1, priceData.CacheRatio)
	require.NotNil(t, priceData.TierPricing)
	require.Equal(t, 1, priceData.TierPricing.TierIndex)
	require.Equal(t, 250000, priceData.TierPricing.BasisValue)
}
