package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestPostTextConsumeQuotaAccruesShadowCostAtGroupRatioZero pins the accrual
// to the function that actually settles token-based traffic
// (PostTextConsumeQuota, service/text_quota.go), not to PostConsumeQuota
// (unreachable once a BillingSession exists) and not to relayInfo.Usage
// (nil for every non-Claude relay format, so reading it panics).
//
// GroupRatio is pinned to 0 here on purpose: that is JINN's real Free/Plus
// shape. The billed quota this request produces is therefore 0 and useless
// as a meter — ShadowCost must still record what it would have cost.
func TestPostTextConsumeQuotaAccruesShadowCostAtGroupRatioZero(t *testing.T) {
	gin.SetMode(gin.TestMode)
	truncate(t)

	userId := 4001
	seedUser(t, userId, 0)

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)

	relayInfo := &relaycommon.RelayInfo{
		UserId:                  userId,
		RelayFormat:             types.RelayFormatOpenAI,
		FinalRequestRelayFormat: types.RelayFormatOpenAI,
		OriginModelName:         "gpt-4o-mini",
		StartTime:               time.Now(),
		// ChannelMeta is embedded as *ChannelMeta on RelayInfo and is only
		// populated by InitChannelMeta() in production. Reading a promoted
		// field (e.g. relayInfo.ChannelId, which PostTextConsumeQuota does)
		// through a nil embedded pointer panics, so the fixture must set it
		// explicitly.
		ChannelMeta: &relaycommon.ChannelMeta{},
		PriceData: types.PriceData{
			ModelRatio:      2, // non-zero: the price this tier would pay if metered
			CompletionRatio: 1,
			CacheRatio:      1,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 0, // JINN Free/Plus: real billed quota is always 0
			},
		},
	}

	usage := &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 50,
		TotalTokens:      150,
	}

	cycleStart, _ := UsageCycle(CycleMonth, nil, time.Now())
	beforeCost, _, _, err := model.GetUsage(userId, CycleMonth, cycleStart)
	require.NoError(t, err)
	require.Equal(t, int64(0), beforeCost, "precondition: nothing accrued yet")

	PostTextConsumeQuota(ctx, relayInfo, usage, nil)

	afterCost, afterRequests, _, err := model.GetUsage(userId, CycleMonth, cycleStart)
	require.NoError(t, err)
	require.Greater(t, afterCost, int64(0), "shadow cost should have accrued even though GroupRatio is 0")
	require.Equal(t, 1, afterRequests, "exactly one request should have been recorded")

	// (100 fresh prompt tokens + 50 completion tokens * completionRatio 1) * modelRatio 2 = 300
	require.Equal(t, int64(300), afterCost)
}

// TestPostTextConsumeQuotaDoesNotAccrueWithoutUsage pins the nil-usage guard:
// PostTextConsumeQuota already treats usage == nil as a real case ("上游无
// 计费信息"), and the accrual must not invent a cost when there is nothing
// to accrue from.
func TestPostTextConsumeQuotaDoesNotAccrueWithoutUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	truncate(t)

	userId := 4002
	seedUser(t, userId, 0)

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)

	relayInfo := &relaycommon.RelayInfo{
		UserId:                  userId,
		RelayFormat:             types.RelayFormatOpenAI,
		FinalRequestRelayFormat: types.RelayFormatOpenAI,
		OriginModelName:         "gpt-4o-mini",
		StartTime:               time.Now(),
		ChannelMeta:             &relaycommon.ChannelMeta{},
		PriceData: types.PriceData{
			ModelRatio:      2,
			CompletionRatio: 1,
			CacheRatio:      1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 0},
		},
	}

	PostTextConsumeQuota(ctx, relayInfo, nil, nil)

	cycleStart, _ := UsageCycle(CycleMonth, nil, time.Now())
	afterCost, afterRequests, _, err := model.GetUsage(userId, CycleMonth, cycleStart)
	require.NoError(t, err)
	require.Equal(t, int64(0), afterCost)
	require.Equal(t, 0, afterRequests)
}
