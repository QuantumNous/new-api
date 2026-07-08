package service

import (
	"net/http/httptest"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGenerateTextOtherInfoIncludesGroupModelRatioSource(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName:   "gpt-5.5",
		StartTime:         time.Now(),
		FirstResponseTime: time.Now().Add(time.Second),
		ChannelMeta:       &relaycommon.ChannelMeta{},
		PriceData: types.PriceData{
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio:           0.3,
				GroupModelRatio:      0.3,
				HasGroupModelRatio:   true,
				GroupModelRatioGroup: "plg",
				GroupModelRatioModel: "gpt-5.5",
			},
		},
	}

	other := GenerateTextOtherInfo(ctx, relayInfo, 1, 0.3, 1, 0, 0, -1, -1)

	require.Equal(t, 0.3, other["group_ratio"])
	require.Equal(t, 0.3, other["group_model_ratio"])
	require.Equal(t, "plg", other["group_model_ratio_group"])
	require.Equal(t, "gpt-5.5", other["group_model_ratio_model"])
}

func TestGenerateMjOtherInfoIncludesGroupModelRatioSource(t *testing.T) {
	other := GenerateMjOtherInfo(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}, types.PriceData{
		ModelPrice: 0.02,
		GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio:           0.25,
			GroupModelRatio:      0.25,
			HasGroupModelRatio:   true,
			GroupModelRatioGroup: "image",
			GroupModelRatioModel: "mj-model",
		},
	})

	require.Equal(t, 0.25, other["group_ratio"])
	require.Equal(t, 0.25, other["group_model_ratio"])
	require.Equal(t, "image", other["group_model_ratio_group"])
	require.Equal(t, "mj-model", other["group_model_ratio_model"])
}
