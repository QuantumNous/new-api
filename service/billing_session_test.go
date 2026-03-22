package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type serviceTokenPeriodQuotaState struct {
	QuotaUsedInPeriod  int   `gorm:"column:quota_used_in_period"`
	QuotaLastResetTime int64 `gorm:"column:quota_last_reset_time"`
	QuotaNextResetTime int64 `gorm:"column:quota_next_reset_time"`
}

func ensureTokenPeriodQuotaColumnsForServiceTests(t *testing.T) {
	t.Helper()

	type tableInfoRow struct {
		Name string `gorm:"column:name"`
	}

	var columns []tableInfoRow
	require.NoError(t, model.DB.Raw("PRAGMA table_info(tokens)").Scan(&columns).Error)

	existing := make(map[string]struct{}, len(columns))
	for _, column := range columns {
		existing[column.Name] = struct{}{}
	}

	statements := []struct {
		column string
		sql    string
	}{
		{column: "quota_period", sql: "ALTER TABLE tokens ADD COLUMN quota_period TEXT DEFAULT ''"},
		{column: "quota_limit", sql: "ALTER TABLE tokens ADD COLUMN quota_limit INTEGER DEFAULT 0"},
		{column: "quota_used_in_period", sql: "ALTER TABLE tokens ADD COLUMN quota_used_in_period INTEGER DEFAULT 0"},
		{column: "quota_last_reset_time", sql: "ALTER TABLE tokens ADD COLUMN quota_last_reset_time BIGINT DEFAULT 0"},
		{column: "quota_next_reset_time", sql: "ALTER TABLE tokens ADD COLUMN quota_next_reset_time BIGINT DEFAULT 0"},
	}

	for _, statement := range statements {
		if _, ok := existing[statement.column]; ok {
			continue
		}
		require.NoError(t, model.DB.Exec(statement.sql).Error)
	}
}

func setTokenPeriodQuotaStateForServiceTests(t *testing.T, tokenID int, period string, limit int, used int, lastReset int64, nextReset int64) {
	t.Helper()
	require.NoError(t, model.DB.Exec(
		"UPDATE tokens SET quota_period = ?, quota_limit = ?, quota_used_in_period = ?, quota_last_reset_time = ?, quota_next_reset_time = ? WHERE id = ?",
		period, limit, used, lastReset, nextReset, tokenID,
	).Error)
}

func getTokenPeriodQuotaStateForServiceTests(t *testing.T, tokenID int) serviceTokenPeriodQuotaState {
	t.Helper()
	var state serviceTokenPeriodQuotaState
	require.NoError(t, model.DB.Raw(
		"SELECT quota_used_in_period, quota_last_reset_time, quota_next_reset_time FROM tokens WHERE id = ?",
		tokenID,
	).Scan(&state).Error)
	return state
}

func getTokenPeriodQuotaUsedForServiceTests(t *testing.T, tokenID int) int {
	t.Helper()
	return getTokenPeriodQuotaStateForServiceTests(t, tokenID).QuotaUsedInPeriod
}

func newBillingSessionTestContext(tokenQuota int) *gin.Context {
	ctx := &gin.Context{}
	ctx.Set("token_quota", tokenQuota)
	return ctx
}

func TestBillingSessionShouldTrustDisablesBypassForPeriodQuota(t *testing.T) {
	truncate(t)
	ensureTokenPeriodQuotaColumnsForServiceTests(t)

	const userID, tokenID = 40, 40
	const requestedQuota = 600
	walletQuota := int(20 * common.QuotaPerUnit)
	remainQuota := int(20 * common.QuotaPerUnit)

	seedUser(t, userID, walletQuota)
	seedToken(t, tokenID, userID, "period-trust-token", remainQuota)

	now := time.Now().Unix()
	setTokenPeriodQuotaStateForServiceTests(t, tokenID, "daily", requestedQuota, requestedQuota, now-(2*3600), now+(2*3600))

	session := &BillingSession{
		relayInfo: &relaycommon.RelayInfo{
			UserId:         userID,
			TokenId:        tokenID,
			TokenUnlimited: false,
			UserQuota:      walletQuota,
		},
		funding: &WalletFunding{userId: userID},
	}

	trusted := session.shouldTrust(newBillingSessionTestContext(remainQuota))
	require.False(t, trusted)
	require.NotZero(t, requestedQuota)
}
