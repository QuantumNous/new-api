package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type safetyRecordingBillingSettler struct {
	preConsumed int
	settledWith []int
}

func (s *safetyRecordingBillingSettler) Settle(actualQuota int) error {
	s.settledWith = append(s.settledWith, actualQuota)
	return nil
}

func (s *safetyRecordingBillingSettler) Refund(*gin.Context) {}

func (s *safetyRecordingBillingSettler) NeedsRefund() bool { return len(s.settledWith) == 0 }

func (s *safetyRecordingBillingSettler) GetPreConsumedQuota() int { return s.preConsumed }

func (s *safetyRecordingBillingSettler) Reserve(targetQuota int) error {
	if targetQuota > s.preConsumed {
		s.preConsumed = targetQuota
	}
	return nil
}

func tieredCalculationFailureRelayInfo(settler *safetyRecordingBillingSettler) *relaycommon.RelayInfo {
	const invalidExpr = `invalid expr!!!`
	return &relaycommon.RelayInfo{
		OriginModelName:       "ordinary-model",
		FinalPreConsumedQuota: settler.preConsumed,
		Billing:               settler,
		ChannelMeta:           &relaycommon.ChannelMeta{},
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:              "tiered_expr",
			ExprString:               invalidExpr,
			ExprHash:                 billingexpr.ExprHashString(invalidExpr),
			GroupRatio:               1,
			QuotaPerUnit:             500_000,
			EstimatedQuotaAfterGroup: settler.preConsumed,
		},
		StartTime: time.Now(),
	}
}

func TestPostTextConsumeQuotaImageAutoTieredFailureLeavesReservationPending(t *testing.T) {
	truncate(t)
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	const (
		userID    = 92001
		channelID = 92002
		reserved  = 400_000
	)
	seedUser(t, userID, 1_000_000)
	seedChannel(t, channelID)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"used_quota":    37,
		"request_count": 5,
	}).Error)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channelID).Update("used_quota", 41).Error)

	plan, err := (types.ImageRoutingConfig{
		Version:     1,
		Revision:    7,
		Enabled:     true,
		PublicModel: "image-auto",
		PublicGroup: "imageauto",
		MaxN:        1,
		Routes: []types.ImageRoutingRoute{{
			ID:            "enterprise",
			ChannelID:     channelID,
			Priority:      1,
			Enabled:       true,
			BillingMode:   types.ImageRoutingBillingMetered,
			UpstreamModel: "gpt-image-2",
			BillingModel:  "gpt-image-2",
			BillingGroup:  "enterprise",
			ReserveQuotaByQuality: map[string]int{
				"low": reserved,
			},
			MissingUsageQuotaByQuality: map[string]int{
				"low": 100_000,
			},
		}},
	}).BuildPlan("low", 1)
	require.NoError(t, err)
	state := relaycommon.NewImageRoutingState(plan)
	require.NoError(t, state.ActivateRoute(0))

	settler := &safetyRecordingBillingSettler{preConsumed: reserved}
	relayInfo := tieredCalculationFailureRelayInfo(settler)
	relayInfo.OriginModelName = "image-auto"
	relayInfo.UserId = userID
	relayInfo.ImageRouting = state
	relayInfo.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: channelID}

	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = oldMemoryCacheEnabled })

	outcome := PostTextConsumeQuota(ctx, relayInfo, &dto.Usage{
		PromptTokens: 100,
		TotalTokens:  100,
	}, nil)

	assert.Empty(t, settler.settledWith, "the reserved funds must remain unsettled for reconciliation")
	assert.Equal(t, "settlement_pending", outcome.SettlementStatus)
	assert.Error(t, outcome.SettlementErr)
	assert.Zero(t, outcome.ActualQuota, "a failed calculation must not present the reserve as actual usage")
	assert.NotEqual(t, outcome.ReservedQuota, outcome.ActualQuota)

	var user model.User
	require.NoError(t, model.DB.First(&user, userID).Error)
	assert.Equal(t, 37, user.UsedQuota)
	assert.Equal(t, 5, user.RequestCount)

	var channel model.Channel
	require.NoError(t, model.DB.First(&channel, channelID).Error)
	assert.Equal(t, int64(41), channel.UsedQuota)
	require.Eventually(t, func() bool {
		return model.DB.First(&channel, channelID).Error == nil && channel.Status == common.ChannelStatusAutoDisabled
	}, time.Second, 10*time.Millisecond, "a metered image-auto route with uncomputable billing must be isolated")
}

func TestPostTextConsumeQuotaImageAutoMissingUsageFallbackSkipsTieredCalculation(t *testing.T) {
	truncate(t)
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	const (
		userID        = 92003
		channelID     = 92004
		reserved      = 400_000
		fallbackQuota = 100_000
	)
	seedUser(t, userID, 1_000_000)
	seedChannel(t, channelID)

	plan, err := (types.ImageRoutingConfig{
		Version:     1,
		Revision:    8,
		Enabled:     true,
		PublicModel: "image-auto",
		PublicGroup: "imageauto",
		MaxN:        1,
		Routes: []types.ImageRoutingRoute{{
			ID:            "enterprise",
			ChannelID:     channelID,
			Priority:      1,
			Enabled:       true,
			BillingMode:   types.ImageRoutingBillingMetered,
			UpstreamModel: "gpt-image-2",
			BillingModel:  "gpt-image-2",
			BillingGroup:  "enterprise",
			ReserveQuotaByQuality: map[string]int{
				"low": reserved,
			},
			MissingUsageQuotaByQuality: map[string]int{
				"low": fallbackQuota,
			},
		}},
	}).BuildPlan("low", 1)
	require.NoError(t, err)
	state := relaycommon.NewImageRoutingState(plan)
	require.NoError(t, state.ActivateRoute(0))

	settler := &safetyRecordingBillingSettler{preConsumed: reserved}
	relayInfo := tieredCalculationFailureRelayInfo(settler)
	relayInfo.OriginModelName = "image-auto"
	relayInfo.UserId = userID
	relayInfo.ImageRouting = state
	relayInfo.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: channelID}
	const negativeExpr = `tier("base", p - 1)`
	relayInfo.TieredBillingSnapshot.ExprString = negativeExpr
	relayInfo.TieredBillingSnapshot.ExprHash = billingexpr.ExprHashString(negativeExpr)

	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = oldMemoryCacheEnabled })

	emptyUsage := &dto.Usage{}
	require.NoError(t, FinalizeImageRoutingSettlement(relayInfo, emptyUsage))
	require.True(t, state.MissingUsageFallback)
	require.Equal(t, fallbackQuota, state.FinalQuotaOverride)

	outcome := PostTextConsumeQuota(ctx, relayInfo, emptyUsage, nil)

	assert.Equal(t, []int{fallbackQuota}, settler.settledWith)
	assert.Equal(t, "settled", outcome.SettlementStatus)
	assert.NoError(t, outcome.SettlementErr)
	assert.Equal(t, fallbackQuota, outcome.ActualQuota)
	var channel model.Channel
	require.Never(t, func() bool {
		return model.DB.First(&channel, channelID).Error == nil && channel.Status == common.ChannelStatusAutoDisabled
	}, 100*time.Millisecond, 10*time.Millisecond, "a configured missing-usage fallback must not isolate the metered route")
	require.Equal(t, common.ChannelStatusEnabled, channel.Status)
}

func TestPostTextConsumeQuotaOrdinaryTieredFailureKeepsLegacyFallback(t *testing.T) {
	truncate(t)
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	settler := &safetyRecordingBillingSettler{preConsumed: 321}
	relayInfo := tieredCalculationFailureRelayInfo(settler)
	outcome := PostTextConsumeQuota(ctx, relayInfo, &dto.Usage{
		PromptTokens: 100,
		TotalTokens:  100,
	}, nil)

	require.Equal(t, []int{321}, settler.settledWith)
	require.Equal(t, "settled", outcome.SettlementStatus)
	require.Equal(t, 321, outcome.ActualQuota)
}
