package openai

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestPreConsumeUsageAccumulatesTurns protects the relay-to-billing handoff:
// each reservation must receive session totals rather than the latest turn alone.
func TestPreConsumeUsageAccumulatesTurns(t *testing.T) {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		OriginModelName: "realtime-handoff-probe",
		PriceData: hosttypes.PriceData{
			ModelRatio:     1,
			GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
	}
	// The nil billing session isolates usage handoff; service settlement tests
	// exercise funding and token reservations against the accounting database.
	total := &dto.RealtimeUsage{}
	first := &dto.RealtimeUsage{
		TotalTokens:        155,
		InputTokens:        110,
		OutputTokens:       45,
		InputTokenDetails:  dto.InputTokenDetails{TextTokens: 100, AudioTokens: 10, CachedTokens: 7},
		OutputTokenDetails: dto.OutputTokenDetails{TextTokens: 40, AudioTokens: 5},
	}
	require.NoError(t, preConsumeUsage(ctx, info, first, total))
	assert.Equal(t, 155, info.RealtimeCommittedQuota)

	second := &dto.RealtimeUsage{
		TotalTokens:        30,
		InputTokens:        20,
		OutputTokens:       10,
		InputTokenDetails:  dto.InputTokenDetails{TextTokens: 20, CachedTokens: 3},
		OutputTokenDetails: dto.OutputTokenDetails{TextTokens: 10},
	}
	require.NoError(t, preConsumeUsage(ctx, info, second, total))
	assert.Equal(t, 185, info.RealtimeCommittedQuota)
	assert.Equal(t, &dto.RealtimeUsage{
		TotalTokens:        185,
		InputTokens:        130,
		OutputTokens:       55,
		InputTokenDetails:  dto.InputTokenDetails{TextTokens: 120, AudioTokens: 10, CachedTokens: 10},
		OutputTokenDetails: dto.OutputTokenDetails{TextTokens: 50, AudioTokens: 5},
	}, total)
}
