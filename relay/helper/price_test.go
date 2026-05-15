package helper

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestModelPriceHelperTieredUsesPreloadedRequestInput(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"tiered-test-model":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"tiered-test-model":"param(\"stream\") == true ? tier(\"stream\", p * 3) : tier(\"base\", p * 2)"}`,
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/channel/test/1", nil)
	req.Body = nil
	req.ContentLength = 0
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req
	ctx.Set("group", "default")

	info := &relaycommon.RelayInfo{
		OriginModelName: "tiered-test-model",
		UserGroup:       "default",
		UsingGroup:      "default",
		RequestHeaders:  map[string]string{"Content-Type": "application/json"},
		BillingRequestInput: &billingexpr.RequestInput{
			Headers: map[string]string{"Content-Type": "application/json"},
			Body:    []byte(`{"stream":true}`),
		},
	}

	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	require.Equal(t, 1500, priceData.QuotaToPreConsume)
	require.NotNil(t, info.TieredBillingSnapshot)
	require.Equal(t, "stream", info.TieredBillingSnapshot.EstimatedTier)
	require.Equal(t, billing_setting.BillingModeTieredExpr, info.TieredBillingSnapshot.BillingMode)
	require.Equal(t, common.QuotaPerUnit, info.TieredBillingSnapshot.QuotaPerUnit)
}

func TestCalculateVideoSecondsBilling(t *testing.T) {
	trace, err := calculateVideoSecondsBilling(relaycommon.TaskSubmitReq{
		Duration: 5,
		Width:    1280,
		Height:   720,
		FPS:      30,
	}, billing_setting.VideoPriceConfig{
		BaseFPS: 24,
		Prices: map[string]float64{
			"720p":  1,
			"1080p": 2,
		},
	})
	require.NoError(t, err)
	require.Equal(t, "720p", trace.Resolution)
	require.Equal(t, 5.0, trace.Duration)
	require.Equal(t, 30.0/24.0, trace.FPSMultiplier)
	require.Equal(t, 6.25, trace.TotalPrice)
}

func TestModelPriceHelperVideoSecondsDoesNotExposeBillableRatios(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"video-test-model":"video_seconds"}`,
		"billing_setting.video_price":  `{"video-test-model":{"base_fps":24,"prices":{"720p":1}}}`,
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Model:    "video-test-model",
		Prompt:   "astronaut walking on the moon",
		Duration: 5,
		Width:    1280,
		Height:   720,
	})

	priceData, err := modelPriceHelperVideoSeconds(ctx, &relaycommon.RelayInfo{
		OriginModelName: "video-test-model",
	}, types.GroupRatioInfo{GroupRatio: 1})
	require.NoError(t, err)
	require.Equal(t, billingexpr.QuotaRound(5*common.QuotaPerUnit), priceData.Quota)
	require.Equal(t, 5.0, priceData.ModelPrice)
	require.Empty(t, priceData.OtherRatios)
}
