package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPricingCreateCacheRatioJSONContract(t *testing.T) {
	t.Run("configured ratio is serialized", func(t *testing.T) {
		ratio := 0.75
		payload, err := json.Marshal(Pricing{
			ModelName:        "gpt-cache-contract",
			CreateCacheRatio: &ratio,
		})
		require.NoError(t, err)

		var response map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(payload, &response))
		require.JSONEq(t, "0.75", string(response["create_cache_ratio"]))
	})

	t.Run("missing ratio is omitted", func(t *testing.T) {
		payload, err := json.Marshal(Pricing{ModelName: "gpt-cache-contract"})
		require.NoError(t, err)

		var response map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(payload, &response))
		_, exists := response["create_cache_ratio"]
		require.False(t, exists)
	})
}
