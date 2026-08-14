package model

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
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

func TestGetHomeRequestMetricsUsesRollingWindowAndConsumeLogsOnly(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	previousLogDB := LOG_DB
	previousLogType := common.LogDatabaseType()
	previousEnabled := common.LogConsumeEnabled
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	common.LogConsumeEnabled = true
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		common.SetLogDatabaseType(previousLogType)
		common.LogConsumeEnabled = previousEnabled
	})

	now := time.Date(2026, time.August, 7, 15, 30, 0, 0, time.UTC)
	windowStart := now.Add(-24 * time.Hour)
	currentHour := now.Truncate(time.Hour)
	logs := []Log{
		{Type: LogTypeConsume, CreatedAt: windowStart.Unix()},
		{Type: LogTypeConsume, CreatedAt: windowStart.Add(time.Second).Unix()},
		{Type: LogTypeConsume, CreatedAt: currentHour.Add(-23 * time.Hour).Unix()},
		{Type: LogTypeConsume, CreatedAt: currentHour.Add(-22 * time.Hour).Unix()},
		{Type: LogTypeSystem, CreatedAt: currentHour.Add(-22 * time.Hour).Unix()},
		{Type: LogTypeConsume, CreatedAt: currentHour.Unix()},
		{Type: LogTypeConsume, CreatedAt: now.Unix()},
	}
	require.NoError(t, db.Create(&logs).Error)

	metrics, err := GetHomeRequestMetrics(now)
	require.NoError(t, err)
	require.True(t, metrics.Available)
	require.NotNil(t, metrics.Requests24h)
	assert.Equal(t, int64(5), *metrics.Requests24h)
	assert.Len(t, metrics.HourlyRequests, 24)
	assert.Equal(t, int64(2), metrics.HourlyRequests[0])
	assert.Equal(t, int64(1), metrics.HourlyRequests[1])
	assert.Equal(t, int64(2), metrics.HourlyRequests[23])
	total := int64(0)
	for _, count := range metrics.HourlyRequests {
		total += count
	}
	assert.Equal(t, int64(5), total)
	assert.Equal(t, now.Unix(), metrics.GeneratedAt)
}

func TestGetHomeRequestMetricsReportsDisabledLogging(t *testing.T) {
	previous := common.LogConsumeEnabled
	common.LogConsumeEnabled = false
	t.Cleanup(func() { common.LogConsumeEnabled = previous })

	metrics, err := GetHomeRequestMetrics(time.Unix(1234, 0))
	require.NoError(t, err)
	assert.False(t, metrics.Available)
	assert.Nil(t, metrics.Requests24h)
	assert.Equal(t, make([]int64, 24), metrics.HourlyRequests)
	assert.Equal(t, int64(1234), metrics.GeneratedAt)
}

func TestGetHomeRequestMetricsReturnsDatabaseErrors(t *testing.T) {
	previousLogDB := LOG_DB
	previousEnabled := common.LogConsumeEnabled
	LOG_DB = nil
	common.LogConsumeEnabled = true
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		common.LogConsumeEnabled = previousEnabled
	})

	metrics, err := GetHomeRequestMetrics(time.Unix(1234, 0))
	require.Error(t, err)
	assert.True(t, metrics.Available)
	assert.Nil(t, metrics.Requests24h)
	assert.Equal(t, make([]int64, 24), metrics.HourlyRequests)
}

func TestGetHomeRequestMetricsHonorsCanceledContext(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	previousLogDB := LOG_DB
	previousLogType := common.LogDatabaseType()
	previousEnabled := common.LogConsumeEnabled
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	common.LogConsumeEnabled = true
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		common.SetLogDatabaseType(previousLogType)
		common.LogConsumeEnabled = previousEnabled
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = GetHomeRequestMetricsWithContext(ctx, time.Unix(1234, 0))
	require.ErrorIs(t, err, context.Canceled)
}

func TestGetAPISuccessRate24hUsesGlobalConsumeAndErrorLogs(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	previousLogDB := LOG_DB
	previousEnabled := common.LogConsumeEnabled
	LOG_DB = db
	common.LogConsumeEnabled = true
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		common.LogConsumeEnabled = previousEnabled
	})

	now := time.Date(2026, time.August, 14, 12, 0, 0, 0, time.UTC)
	logs := []Log{
		{Type: LogTypeConsume, CreatedAt: now.Add(-23 * time.Hour).Unix()},
		{Type: LogTypeConsume, CreatedAt: now.Add(-2 * time.Hour).Unix()},
		{Type: LogTypeConsume, CreatedAt: now.Add(-time.Hour).Unix()},
		{Type: LogTypeConsume, CreatedAt: now.Add(-time.Minute).Unix()},
		{Type: LogTypeConsume, CreatedAt: now.Unix()},
		{Type: LogTypeError, CreatedAt: now.Add(-30 * time.Minute).Unix()},
		{Type: LogTypeConsume, CreatedAt: now.Add(-24 * time.Hour).Unix()},
		{Type: LogTypeSystem, CreatedAt: now.Add(-time.Minute).Unix()},
	}
	require.NoError(t, db.Create(&logs).Error)

	rate, err := GetAPISuccessRate24hWithContext(context.Background(), now)
	require.NoError(t, err)
	require.NotNil(t, rate)
	assert.InDelta(t, 83.3, *rate, 0.001)
}

func TestGetAPISuccessRate24hReturnsNilForEmptyWindow(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	previousLogDB := LOG_DB
	previousEnabled := common.LogConsumeEnabled
	LOG_DB = db
	common.LogConsumeEnabled = true
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		common.LogConsumeEnabled = previousEnabled
	})

	rate, err := GetAPISuccessRate24hWithContext(context.Background(), time.Now())
	require.NoError(t, err)
	assert.Nil(t, rate)
}

func TestGetAPISuccessRate24hReturnsLogDatabaseError(t *testing.T) {
	previousLogDB := LOG_DB
	previousEnabled := common.LogConsumeEnabled
	LOG_DB = nil
	common.LogConsumeEnabled = true
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		common.LogConsumeEnabled = previousEnabled
	})

	rate, err := GetAPISuccessRate24hWithContext(context.Background(), time.Now())
	require.Error(t, err)
	assert.Nil(t, rate)
}
