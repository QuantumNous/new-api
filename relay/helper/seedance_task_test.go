package helper

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplySeedanceTaskPriceDirect720p(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	relaycommon.SetTaskRequest(ctx, relaycommon.TaskSubmitReq{
		Model:    "doubao-seedance-2-0-260128",
		Duration: 5,
		Metadata: map[string]any{
			"resolution": "720p",
			"content": []any{
				map[string]any{"type": "text", "text": "a sunrise"},
			},
		},
	})
	info := &relaycommon.RelayInfo{
		OriginModelName: "doubao-seedance-2-0-260128",
		UserGroup:       "default",
		UsingGroup:      "default",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeDoubaoVideo},
	}

	applied, err := ApplySeedanceTaskPrice(ctx, info)
	require.NoError(t, err)
	require.True(t, applied)
	require.NotNil(t, info.SeedanceBilling)
	assert.False(t, info.SeedanceBilling.SuperResolution)
	assert.Equal(t, "720p", info.SeedanceBilling.BillingResolution)

	expected, _, _, ok := ratio_setting.EstimateSeedanceQuota(ratio_setting.SeedanceQuoteInput{
		ModelNames:        []string{"doubao-seedance-2-0-260128"},
		BillingResolution: "720p",
		DurationSeconds:   5,
		GroupRatio:        1,
	})
	require.True(t, ok)
	assert.Equal(t, expected, info.PriceData.Quota)
}

func TestApplySeedanceTaskPriceMediaKitUsesSourceResolution(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	relaycommon.SetTaskRequest(ctx, relaycommon.TaskSubmitReq{
		Model:    "doubao-seedance-2-0-260128-se",
		Duration: 5,
		Metadata: map[string]any{
			"resolution": "720p",
			"content": []any{
				map[string]any{"type": "text", "text": "a sunrise"},
			},
		},
	})
	info := &relaycommon.RelayInfo{
		OriginModelName:       "doubao-seedance-2-0-260128-se",
		VideoOutputResolution: "1080p",
		UserGroup:             "default",
		UsingGroup:            "default",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeDoubaoVideoMediaKit,
			UpstreamModelName: "doubao-seedance-2-0-260128",
		},
	}

	applied, err := ApplySeedanceTaskPrice(ctx, info)
	require.NoError(t, err)
	require.True(t, applied)
	require.NotNil(t, info.SeedanceBilling)
	assert.True(t, info.SeedanceBilling.SuperResolution)
	assert.Equal(t, "720p", info.SeedanceBilling.BillingResolution)
	assert.Equal(t, "1080p", info.SeedanceBilling.OutputResolution)
	assert.InDelta(t, 0.04, info.SeedanceBilling.SuperResolutionRMB, 1e-9)
	assert.Greater(t, info.PriceData.Quota, 0)
}

func TestApplySeedanceTaskPriceSkipsUnknownModels(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-4o",
		UserGroup:       "default",
		UsingGroup:      "default",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenAI},
	}
	applied, err := ApplySeedanceTaskPrice(ctx, info)
	require.NoError(t, err)
	assert.False(t, applied)
}
