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

func TestCalculateTextQuotaSummarySkipsEstimateForAbnormalStreamWithoutUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	streamStatus := relaycommon.NewStreamStatus()
	streamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, nil)
	relayInfo := &relaycommon.RelayInfo{
		IsStream:        true,
		StreamStatus:    streamStatus,
		OriginModelName: "gpt-test",
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 1,
			},
		},
		StartTime: time.Now(),
	}
	relayInfo.SetEstimatePromptTokens(1000)

	summary := calculateTextQuotaSummary(ctx, relayInfo, nil)

	require.Zero(t, summary.TotalTokens)
	require.Zero(t, summary.Quota)
}

func TestCalculateTextQuotaSummaryUsesEstimateForNormalStreamWithoutUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	streamStatus := relaycommon.NewStreamStatus()
	streamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)
	relayInfo := &relaycommon.RelayInfo{
		IsStream:        true,
		StreamStatus:    streamStatus,
		OriginModelName: "gpt-test",
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 1,
			},
		},
		StartTime: time.Now(),
	}
	relayInfo.SetEstimatePromptTokens(1000)

	summary := calculateTextQuotaSummary(ctx, relayInfo, nil)

	require.Equal(t, 1000, summary.TotalTokens)
	require.Equal(t, 1000, summary.Quota)
}
