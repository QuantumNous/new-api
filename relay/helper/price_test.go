package helper

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestModelPriceHelperUsesBuiltInImageUnitPrice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-3.1-flash-image",
		UsingGroup:      "default",
	}

	priceData, err := ModelPriceHelper(ctx, info, 1, &types.TokenCountMeta{
		ImageUnitPrice: 0.101,
	})

	require.NoError(t, err)
	require.True(t, priceData.UsePrice)
	require.Equal(t, 0.101, priceData.ModelPrice)
	require.Equal(t, int(0.101*common.QuotaPerUnit), priceData.QuotaToPreConsume)
}

func TestModelPriceHelperBuiltInImageUnitPriceSkipsImageRatio(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-image-2",
		UsingGroup:      "default",
	}

	priceData, err := ModelPriceHelper(ctx, info, 1, &types.TokenCountMeta{
		ImageUnitPrice:  0.10704,
		ImagePriceRatio: 16,
	})

	require.NoError(t, err)
	require.True(t, priceData.UsePrice)
	require.Equal(t, 0.10704, priceData.ModelPrice)
	require.Equal(t, int(0.10704*common.QuotaPerUnit), priceData.QuotaToPreConsume)
}
