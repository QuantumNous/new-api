package service

import (
	"net/http/httptest"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGenerateTextOtherInfoOmitsInvalidFirstResponseLatency(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)

	startTime := time.Unix(1_700_000_000, 0)
	relayInfo := &relaycommon.RelayInfo{
		StartTime:   startTime,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}

	other := GenerateTextOtherInfo(ctx, relayInfo, 1, 1, 1, 0, 0, -1, -1)
	_, exists := other["frt"]
	require.False(t, exists)
}

func TestGenerateTextOtherInfoIncludesValidFirstResponseLatency(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)

	startTime := time.Unix(1_700_000_000, 0)
	relayInfo := &relaycommon.RelayInfo{
		StartTime:         startTime,
		FirstResponseTime: startTime.Add(1500 * time.Millisecond),
		ChannelMeta:       &relaycommon.ChannelMeta{},
	}

	other := GenerateTextOtherInfo(ctx, relayInfo, 1, 1, 1, 0, 0, -1, -1)
	require.Equal(t, 1500.0, other["frt"])
}
