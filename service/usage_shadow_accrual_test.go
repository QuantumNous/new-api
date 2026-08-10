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

// TestAccrualAndReadShareTheBillingAnchoredCycle pins the property that broke
// twice in this feature's history: the writer and the reader must resolve the
// same cycle. Now that a paying tier anchors its cycle to its billing date
// rather than the calendar month, a caller that forgets to pass the anchor
// would write to one row and read from another — the counter would look empty
// while usage accrued invisibly beside it.
func TestAccrualAndReadShareTheBillingAnchoredCycle(t *testing.T) {
	gin.SetMode(gin.TestMode)
	truncate(t)

	userId := 4003
	seedUser(t, userId, 0)

	// A Plus-shaped row: paying, no metered pool, billed on the 8th.
	anchor := time.Now().AddDate(0, 0, -3)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId: userId, PlanId: 1,
		AmountTotal: 0, AmountUsed: 0,
		StartTime: anchor.Unix(), EndTime: anchor.AddDate(0, 1, 0).Unix(),
		Status: "active", Source: "order",
	}).Error)

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
			ModelRatio: 2, CompletionRatio: 1, CacheRatio: 1,
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 0},
		},
	}
	usage := &dto.Usage{PromptTokens: 100, CompletionTokens: 50, TotalTokens: 150}

	PostTextConsumeQuota(ctx, relayInfo, usage, nil)

	// Read the way the gate and the portal endpoint do: through the anchor.
	anchoredStart, _ := UsageCycle(CycleMonth, CycleSubscriptionFor(userId), time.Now())
	cost, requests, _, err := model.GetUsage(userId, CycleMonth, anchoredStart)
	require.NoError(t, err)
	require.Equal(t, int64(300), cost, "the reader must find what the writer accrued")
	require.Equal(t, 1, requests)

	// And prove the anchor genuinely moved the cycle off the calendar month —
	// otherwise this test would pass even if the anchor were being ignored.
	calendarStart, _ := UsageCycle(CycleMonth, nil, time.Now())
	require.NotEqual(t, calendarStart, anchoredStart, "a mid-month billing date must not resolve to the 1st")
	calendarCost, _, _, err := model.GetUsage(userId, CycleMonth, calendarStart)
	require.NoError(t, err)
	require.Equal(t, int64(0), calendarCost, "nothing should have landed in the calendar-month row")
}
