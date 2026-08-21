package relay

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	hailuov2 "github.com/QuantumNous/new-api/relay/channel/task/hailuo_v2"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetTaskAdaptorSelectsMiniMaxVideoV2(t *testing.T) {
	adaptor := GetTaskAdaptor(constant.TaskPlatformMiniMaxV2)

	require.IsType(t, &hailuov2.TaskAdaptor{}, adaptor)
}

func TestGetTaskPlatformForModelSeparatesMiniMaxVideoVersions(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("channel_type", constant.ChannelTypeMiniMax)

	require.Equal(t, string(constant.TaskPlatformMiniMaxV2), string(GetTaskPlatformForModel(c, hailuov2.ModelName)))
	require.Equal(t, "35", string(GetTaskPlatformForModel(c, "MiniMax-Hailuo-2.3")))
}
