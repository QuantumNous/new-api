package model

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetSelfLogStatScopesConsumeLogsByUserAndDay(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	previousLogDB := LOG_DB
	LOG_DB = db
	t.Cleanup(func() { LOG_DB = previousLogDB })

	now := time.Date(2026, time.August, 7, 15, 30, 0, 0, time.FixedZone("UTC+8", 8*60*60))
	logs := []Log{
		{UserId: 7, Username: "alice-old", Type: LogTypeConsume, Quota: 100, CreatedAt: now.Add(-time.Hour).Unix()},
		{UserId: 7, Username: "alice", Type: LogTypeConsume, Quota: 250, CreatedAt: now.Add(-24 * time.Hour).Unix()},
		{UserId: 7, Username: "alice", Type: LogTypeManage, Quota: 999, CreatedAt: now.Add(-time.Hour).Unix()},
		{UserId: 8, Username: "alice", Type: LogTypeConsume, Quota: 500, CreatedAt: now.Add(-time.Hour).Unix()},
	}
	require.NoError(t, db.Create(&logs).Error)

	stat, err := GetSelfLogStat(7, now)
	require.NoError(t, err)
	assert.Equal(t, int64(2), stat.TotalRequests)
	assert.Equal(t, int64(350), stat.TotalQuota)
	assert.Equal(t, int64(1), stat.TodayRequests)
	assert.Equal(t, int64(100), stat.TodayQuota)
}

func TestSumUsedQuotaForUserScopesFilteredAndRateStatsByUserId(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	previousLogDB := LOG_DB
	LOG_DB = db
	t.Cleanup(func() { LOG_DB = previousLogDB })

	now := time.Now()
	logs := []Log{
		{UserId: 7, Username: "alice-old", Type: LogTypeConsume, Quota: 100, PromptTokens: 10, CompletionTokens: 5, CreatedAt: now.Add(-10 * time.Second).Unix()},
		{UserId: 7, Username: "alice", Type: LogTypeConsume, Quota: 250, PromptTokens: 20, CompletionTokens: 10, CreatedAt: now.Add(-2 * time.Minute).Unix()},
		{UserId: 8, Username: "alice", Type: LogTypeConsume, Quota: 500, PromptTokens: 50, CompletionTokens: 25, CreatedAt: now.Add(-10 * time.Second).Unix()},
	}
	require.NoError(t, db.Create(&logs).Error)

	stat, err := SumUsedQuotaForUser(7, LogTypeUnknown, 0, 0, "", "", 0, "")
	require.NoError(t, err)
	assert.Equal(t, 350, stat.Quota)
	assert.Equal(t, 1, stat.Rpm)
	assert.Equal(t, 15, stat.Tpm)
}
