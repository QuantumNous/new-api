package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedQuotaAdjustmentUser(t *testing.T, id int, quota int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:       id,
		Username: "quota_adjust_user",
		Quota:    quota,
		Status:   common.UserStatusEnabled,
	}).Error)
}

func seedQuotaAdjustmentToken(t *testing.T, id int, userId int, key string, remainQuota int, unlimited bool) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.Token{
		Id:             id,
		UserId:         userId,
		Key:            key,
		Name:           "quota_adjust_token",
		Status:         common.TokenStatusEnabled,
		RemainQuota:    remainQuota,
		UnlimitedQuota: unlimited,
	}).Error)
}

func TestPreConsumeTokenQuotaPropagatesPersistedUnlimitedToken(t *testing.T) {
	truncate(t)

	seedQuotaAdjustmentUser(t, 5101, 1000)
	seedQuotaAdjustmentToken(t, 5101, 5101, "preconsume-unlimited", 0, true)
	relayInfo := &relaycommon.RelayInfo{
		UserId:  5101,
		TokenId: 5101,
	}

	require.NoError(t, PreConsumeTokenQuota(relayInfo, 50))

	assert.True(t, relayInfo.TokenUnlimited)
	assert.Equal(t, -50, getTokenRemainQuota(t, 5101))
	assert.Equal(t, 50, getTokenUsedQuota(t, 5101))
}

func TestPostConsumeQuotaUsesPersistedUnlimitedToken(t *testing.T) {
	truncate(t)

	seedQuotaAdjustmentUser(t, 5102, 1000)
	seedQuotaAdjustmentToken(t, 5102, 5102, "postconsume-unlimited", 0, true)
	relayInfo := &relaycommon.RelayInfo{
		UserId:  5102,
		TokenId: 5102,
	}

	require.NoError(t, PostConsumeQuota(relayInfo, 50, 0, false))

	assert.True(t, relayInfo.TokenUnlimited)
	assert.Equal(t, 950, getUserQuota(t, 5102))
	assert.Equal(t, -50, getTokenRemainQuota(t, 5102))
	assert.Equal(t, 50, getTokenUsedQuota(t, 5102))
}

func TestBillingSessionSettleUsesPersistedUnlimitedToken(t *testing.T) {
	truncate(t)

	seedQuotaAdjustmentUser(t, 5103, 1000)
	seedQuotaAdjustmentToken(t, 5103, 5103, "settle-unlimited", 0, true)
	relayInfo := &relaycommon.RelayInfo{
		UserId:  5103,
		TokenId: 5103,
	}
	session := &BillingSession{
		relayInfo: relayInfo,
		funding:   &WalletFunding{userId: 5103},
	}

	require.NoError(t, session.Settle(50))

	assert.True(t, relayInfo.TokenUnlimited)
	assert.Equal(t, 950, getUserQuota(t, 5103))
	assert.Equal(t, -50, getTokenRemainQuota(t, 5103))
	assert.Equal(t, 50, getTokenUsedQuota(t, 5103))
}

func TestNormalizeRelayTokenKeyStripsPublicPrefix(t *testing.T) {
	assert.Equal(t, "settle-unlimited", normalizeRelayTokenKey("sk-settle-unlimited"))
	assert.Equal(t, "plain-token-key", normalizeRelayTokenKey("plain-token-key"))
	assert.Empty(t, normalizeRelayTokenKey(""))
}
