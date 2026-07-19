package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostConsumeQuotaDurableKeepsBothLegsRecoverable(t *testing.T) {
	truncate(t)
	const userID, tokenID, channelID = 30, 30, 30
	const initQuota, charge, tokenRemain = 20000, 3000, 9000
	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-post-consume-durable", tokenRemain)
	seedChannel(t, channelID)

	previousRedisEnabled, previousRDB := common.RedisEnabled, common.RDB
	t.Cleanup(func() {
		common.RedisEnabled = previousRedisEnabled
		common.RDB = previousRDB
	})
	common.RedisEnabled = true
	common.RDB = nil

	info := &relaycommon.RelayInfo{
		RequestId:     "post-consume-durable-test",
		UserId:        userID,
		TokenId:       tokenID,
		BillingSource: BillingSourceWallet,
		UserQuota:     initQuota,
	}
	// TokenKey is only needed once the durable worker can obtain the token row;
	// the worker resolves it from TokenID, so this remains intentionally empty.
	require.NoError(t, PostConsumeQuotaDurable(info, charge, 0, false, model.BillingAdjustmentPhasePostConsume))

	var pending []model.BillingAdjustmentOutbox
	require.NoError(t, model.DB.Order("id ASC").Find(&pending).Error)
	require.Len(t, pending, 2)
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID))

	common.RedisEnabled = false
	require.NoError(t, model.DB.Model(&model.BillingAdjustmentOutbox{}).Where("next_attempt_at > ?", 0).Update("next_attempt_at", 0).Error)
	processed, failed, err := model.DrainDueBillingAdjustmentOutbox(10)
	require.NoError(t, err)
	assert.Equal(t, 2, processed)
	assert.Equal(t, 0, failed)
	assert.Equal(t, initQuota-charge, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-charge, getTokenRemainQuota(t, tokenID))

	// A replay of the same request/phase is idempotent and must not charge twice.
	require.NoError(t, PostConsumeQuotaDurable(info, charge, 0, false, model.BillingAdjustmentPhasePostConsume))
	assert.Equal(t, initQuota-charge, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-charge, getTokenRemainQuota(t, tokenID))
}

func TestRealtimePostConsumeUsesDistinctChildIdentities(t *testing.T) {
	truncate(t)
	const userID, tokenID = 31, 31
	const initQuota, charge, tokenRemain = 20000, 1000, 9000
	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-realtime-child-id", tokenRemain)

	info := &relaycommon.RelayInfo{
		RequestId:     "realtime-parent-request",
		UserId:        userID,
		TokenId:       tokenID,
		BillingSource: BillingSourceWallet,
	}
	require.NoError(t, postConsumeQuotaDurable(info, charge, 0, false, model.BillingAdjustmentPhasePostConsume, info.RequestId+":realtime:1"))
	require.NoError(t, postConsumeQuotaDurable(info, charge, 0, false, model.BillingAdjustmentPhasePostConsume, info.RequestId+":realtime:2"))

	assert.Equal(t, initQuota-2*charge, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-2*charge, getTokenRemainQuota(t, tokenID))
	var outboxCount int64
	require.NoError(t, model.DB.Model(&model.BillingAdjustmentOutbox{}).Count(&outboxCount).Error)
	assert.Equal(t, int64(4), outboxCount)

	// Replaying one response.done charge reuses its child identity and is safe.
	require.NoError(t, postConsumeQuotaDurable(info, charge, 0, false, model.BillingAdjustmentPhasePostConsume, info.RequestId+":realtime:1"))
	assert.Equal(t, initQuota-2*charge, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-2*charge, getTokenRemainQuota(t, tokenID))
}

func TestPreWssConsumeQuotaAllocatesOneDurableIdentityPerUsageCharge(t *testing.T) {
	truncate(t)
	const userID, tokenID = 32, 32
	const initQuota, tokenRemain = 100000, 100000
	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "realtime-prewss", tokenRemain)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		RequestId:       "realtime-sequence-test",
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        "sk-realtime-prewss",
		OriginModelName: "gpt-4o-realtime-preview",
		UsingGroup:      "default",
		UserGroup:       "default",
	}
	usage := &dto.RealtimeUsage{
		TotalTokens: 100,
		InputTokens: 100,
		InputTokenDetails: dto.InputTokenDetails{
			TextTokens: 100,
		},
	}

	require.NoError(t, PreWssConsumeQuota(ctx, info, usage))
	require.NoError(t, PreWssConsumeQuota(ctx, info, usage))
	assert.Equal(t, int64(2), info.RealtimeBillingSequence)

	var walletRows []model.BillingAdjustmentOutbox
	require.NoError(t, model.DB.Where("leg = ?", model.BillingAdjustmentLegWallet).Order("id ASC").Find(&walletRows).Error)
	require.Len(t, walletRows, 2)
	assert.NotEqual(t, walletRows[0].RequestID, walletRows[1].RequestID)
	assert.Equal(t, "realtime-sequence-test:realtime:1", walletRows[0].RequestID)
	assert.Equal(t, "realtime-sequence-test:realtime:2", walletRows[1].RequestID)
	assert.Less(t, getUserQuota(t, userID), initQuota)
	assert.Less(t, getTokenRemainQuota(t, tokenID), tokenRemain)
}
