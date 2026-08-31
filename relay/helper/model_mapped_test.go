package helper

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestModelMappedHelperWithoutRequestUsesChannelMapping(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("model_mapping", `{"GPT-Realtime-2.1":"realtime-deployment"}`)

	info := &relaycommon.RelayInfo{
		OriginModelName: "GPT-Realtime-2.1",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "GPT-Realtime-2.1",
		},
	}

	require.NoError(t, ModelMappedHelper(ctx, info, nil))
	require.True(t, info.IsModelMapped)
	require.Equal(t, "realtime-deployment", info.UpstreamModelName)
}
