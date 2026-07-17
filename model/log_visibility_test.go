package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUserLogQueriesHideRetryAttempts(t *testing.T) {
	originalLogDB := LOG_DB
	originalLogDatabaseType := common.LogDatabaseType()
	t.Cleanup(func() {
		LOG_DB = originalLogDB
		common.SetLogDatabaseType(originalLogDatabaseType)
	})

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "logs.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&Log{}))
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)

	logs := []*Log{
		{
			UserId:         1,
			CreatedAt:      1,
			Type:           LogTypeError,
			Content:        "status_code=503, temporary upstream failure",
			TokenId:        7,
			RequestId:      "request-retried-successfully",
			Other:          `{"status_code":503}`,
			IsRetryAttempt: true,
		},
		{
			UserId:    1,
			CreatedAt: 2,
			Type:      LogTypeConsume,
			Content:   "final success",
			TokenId:   7,
			RequestId: "request-retried-successfully",
			Other:     `{}`,
		},
		{
			UserId:         1,
			CreatedAt:      3,
			Type:           LogTypeError,
			Content:        "status_code=502, retryable upstream failure",
			TokenId:        7,
			RequestId:      "request-final-failure",
			Other:          `{"status_code":502}`,
			IsRetryAttempt: true,
		},
		{
			UserId:    1,
			CreatedAt: 4,
			Type:      LogTypeError,
			Content:   "status_code=500, final upstream failure",
			TokenId:   7,
			RequestId: "request-final-failure",
			Other:     `{"status_code":500}`,
		},
	}
	require.NoError(t, db.Create(&logs).Error)

	userLogs, total, err := GetUserLogs(1, LogTypeUnknown, 0, 0, "", "", 0, 10, "", "", "")
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, userLogs, 2)
	assert.ElementsMatch(t,
		[]string{"request-retried-successfully", "request-final-failure"},
		[]string{userLogs[0].RequestId, userLogs[1].RequestId},
	)
	for _, log := range userLogs {
		assert.NotContains(t, log.Content, "temporary upstream failure")
	}

	userErrorLogs, errorTotal, err := GetUserLogs(1, LogTypeError, 0, 0, "", "", 0, 10, "", "", "")
	require.NoError(t, err)
	assert.Equal(t, int64(1), errorTotal)
	require.Len(t, userErrorLogs, 1)
	assert.Equal(t, "request-final-failure", userErrorLogs[0].RequestId)

	tokenLogs, err := GetLogByTokenId(7)
	require.NoError(t, err)
	assert.Len(t, tokenLogs, 2)

	adminLogs, adminTotal, err := GetAllLogs(LogTypeUnknown, 0, 0, "", "", "", 0, 10, 0, "", "", "")
	require.NoError(t, err)
	assert.Equal(t, int64(4), adminTotal)
	require.Len(t, adminLogs, 4)
	retryAttemptCount := 0
	for _, log := range adminLogs {
		if log.IsRetryAttempt {
			retryAttemptCount++
		}
	}
	assert.Equal(t, 2, retryAttemptCount)
	assert.Contains(t, adminLogs[3].Content, "temporary upstream failure")
}

func TestClickHouseRetryAttemptColumn(t *testing.T) {
	assert.Contains(t, clickHouseLogCreateTableSQL(0), "is_retry_attempt UInt8 DEFAULT 0")
	assert.Equal(t, "ALTER TABLE logs ADD COLUMN IF NOT EXISTS is_retry_attempt UInt8 DEFAULT 0", clickHouseLogRetryAttemptColumnSQL)
}
