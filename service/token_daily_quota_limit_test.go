package service

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func resetTokenDailyQuotaState() {
	tokenDailyQuotaMemoryStore = sync.Map{}
}

func TestBillingSessionDailyQuotaLimitUsesTokenScope(t *testing.T) {
	truncate(t)
	resetTokenDailyQuotaState()

	const dailyLimit = 1000

	require.NoError(t, reserveTokenDailyQuota(201, dailyLimit, 600))
	err := reserveTokenDailyQuota(201, dailyLimit, 500)
	require.Error(t, err)
	require.Contains(t, err.Error(), "每日消费限额")

	require.NoError(t, reserveTokenDailyQuota(202, dailyLimit, 500))
}

func TestPostConsumeQuotaDailyLimitReleasesOnRefund(t *testing.T) {
	truncate(t)
	resetTokenDailyQuotaState()
	common.RedisEnabled = false

	seedUser(t, 102, 10000)
	seedToken(t, 203, 102, "sk-token-daily-3", 10000)

	info := &relaycommon.RelayInfo{
		UserId:              102,
		TokenId:             203,
		TokenKey:            "sk-token-daily-3",
		TokenDailyQuotaLimit: 1000,
	}

	require.NoError(t, PostConsumeQuota(info, 700, 0, false))

	err := PostConsumeQuota(info, 400, 0, false)
	require.Error(t, err)

	require.NoError(t, PostConsumeQuota(info, -700, 0, false))
	require.NoError(t, PostConsumeQuota(info, 400, 0, false))
}
