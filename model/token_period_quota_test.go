package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type tokenPeriodQuotaState struct {
	QuotaPeriod        string `gorm:"column:quota_period"`
	QuotaLimit         int    `gorm:"column:quota_limit"`
	QuotaUsedInPeriod  int    `gorm:"column:quota_used_in_period"`
	QuotaLastResetTime int64  `gorm:"column:quota_last_reset_time"`
	QuotaNextResetTime int64  `gorm:"column:quota_next_reset_time"`
}

func ensureTokenPeriodQuotaColumnsForModelTests(t *testing.T, db *gorm.DB) {
	t.Helper()

	type tableInfoRow struct {
		Name string `gorm:"column:name"`
	}

	var columns []tableInfoRow
	require.NoError(t, db.Raw("PRAGMA table_info(tokens)").Scan(&columns).Error)

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
		require.NoError(t, db.Exec(statement.sql).Error)
	}
}

func seedTokenForPeriodQuotaTest(t *testing.T, userID int, key string) *Token {
	t.Helper()

	token := &Token{
		UserId:         userID,
		Key:            key,
		Name:           "period-quota-token",
		Status:         common.TokenStatusEnabled,
		CreatedTime:    common.GetTimestamp(),
		AccessedTime:   common.GetTimestamp(),
		ExpiredTime:    -1,
		RemainQuota:    int(20 * common.QuotaPerUnit),
		UnlimitedQuota: false,
		Group:          "default",
	}
	require.NoError(t, DB.Create(token).Error)
	return token
}

func setTokenPeriodQuotaState(t *testing.T, tokenID int, period string, limit int, used int, lastReset int64, nextReset int64) {
	t.Helper()
	require.NoError(t, DB.Exec(
		"UPDATE tokens SET quota_period = ?, quota_limit = ?, quota_used_in_period = ?, quota_last_reset_time = ?, quota_next_reset_time = ? WHERE id = ?",
		period, limit, used, lastReset, nextReset, tokenID,
	).Error)
}

func getTokenPeriodQuotaState(t *testing.T, tokenID int) tokenPeriodQuotaState {
	t.Helper()
	var state tokenPeriodQuotaState
	require.NoError(t, DB.Raw(
		"SELECT quota_period, quota_limit, quota_used_in_period, quota_last_reset_time, quota_next_reset_time FROM tokens WHERE id = ?",
		tokenID,
	).Scan(&state).Error)
	return state
}

func TestValidateUserTokenRejectsExhaustedDailyPeriodQuota(t *testing.T) {
	truncateTables(t)
	ensureTokenPeriodQuotaColumnsForModelTests(t, DB)

	token := seedTokenForPeriodQuotaTest(t, 101, "daily-period-token")
	now := time.Now().Unix()
	setTokenPeriodQuotaState(t, token.Id, "daily", 500, 500, now-(6*3600), now+(6*3600))

	validatedToken, err := ValidateUserToken(token.Key)
	require.Error(t, err)
	require.NotNil(t, validatedToken)
}

func TestValidateUserTokenResetsExpiredMonthlyPeriodQuotaWindow(t *testing.T) {
	truncateTables(t)
	ensureTokenPeriodQuotaColumnsForModelTests(t, DB)

	token := seedTokenForPeriodQuotaTest(t, 102, "monthly-period-token")
	now := time.Now()
	lastReset := now.AddDate(0, -1, 0).Unix()
	nextReset := now.Add(-time.Hour).Unix()
	setTokenPeriodQuotaState(t, token.Id, "monthly", 800, 800, lastReset, nextReset)

	validatedToken, err := ValidateUserToken(token.Key)
	require.NoError(t, err)
	require.NotNil(t, validatedToken)

	state := getTokenPeriodQuotaState(t, token.Id)
	require.Equal(t, "monthly", state.QuotaPeriod)
	require.Equal(t, 0, state.QuotaUsedInPeriod)
	require.Greater(t, state.QuotaLastResetTime, lastReset)
	require.Greater(t, state.QuotaNextResetTime, common.GetTimestamp())
}
