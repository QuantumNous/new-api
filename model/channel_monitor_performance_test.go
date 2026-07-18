package model

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetChannelMonitorPerformanceMetricsUsesUsageLogTimingRules(t *testing.T) {
	originalLogDB := LOG_DB
	originalLogDatabaseType := common.LogDatabaseType()
	t.Cleanup(func() {
		LOG_DB = originalLogDB
		common.SetLogDatabaseType(originalLogDatabaseType)
	})

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "performance.db")), &gorm.Config{})
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
		{ChannelId: 1, ModelName: "model-a", CreatedAt: 101, Type: LogTypeConsume, IsStream: true, CompletionTokens: 100, UseTime: 10, Other: `{"frt":1000}`},
		{ChannelId: 1, ModelName: "model-a", CreatedAt: 102, Type: LogTypeConsume, IsStream: true, CompletionTokens: 90, UseTime: 3, Other: `{"frt":3000}`},
		{ChannelId: 1, ModelName: "model-b", CreatedAt: 103, Type: LogTypeConsume, IsStream: true, Other: `{"frt":500}`},
		{ChannelId: 2, ModelName: "model-a", CreatedAt: 104, Type: LogTypeConsume, IsStream: true, CompletionTokens: 40, UseTime: 2, Other: "not-json"},
		{ChannelId: 1, ModelName: "non-stream", CreatedAt: 105, Type: LogTypeConsume, CompletionTokens: 100, UseTime: 1, Other: `{"frt":100}`},
		{ChannelId: 1, ModelName: "error-log", CreatedAt: 106, Type: LogTypeError, IsStream: true, CompletionTokens: 100, UseTime: 1, Other: `{"frt":100}`},
		{ChannelId: 1, ModelName: "too-old", CreatedAt: 99, Type: LogTypeConsume, IsStream: true, CompletionTokens: 100, UseTime: 1, Other: `{"frt":100}`},
		{ChannelId: 0, ModelName: "no-channel", CreatedAt: 107, Type: LogTypeConsume, IsStream: true, CompletionTokens: 100, UseTime: 1, Other: `{"frt":100}`},
		{ChannelId: 1, ModelName: "", CreatedAt: 108, Type: LogTypeConsume, IsStream: true, CompletionTokens: 100, UseTime: 1, Other: `{"frt":100}`},
	}
	require.NoError(t, db.Create(&logs).Error)

	metrics, err := GetChannelMonitorPerformanceMetrics(context.Background(), 100)
	require.NoError(t, err)
	require.Len(t, metrics, 3)

	assert.Equal(t, "model-a", metrics[0].ModelName)
	assert.Equal(t, 1, metrics[0].ChannelId)
	assert.Equal(t, 2, metrics[0].SampleCount)
	assert.Equal(t, 2, metrics[0].FirstTokenSampleCount)
	assert.Equal(t, 2, metrics[0].TPSSampleCount)
	require.NotNil(t, metrics[0].AverageFirstTokenMs)
	assert.InDelta(t, 2000, *metrics[0].AverageFirstTokenMs, 0.001)
	require.NotNil(t, metrics[0].AverageTPS)
	assert.InDelta(t, 20, *metrics[0].AverageTPS, 0.001)
	require.NotNil(t, metrics[0].LatestFirstTokenMs)
	assert.InDelta(t, 3000, *metrics[0].LatestFirstTokenMs, 0.001)
	require.NotNil(t, metrics[0].LatestTPS)
	assert.InDelta(t, 30, *metrics[0].LatestTPS, 0.001)
	assert.Equal(t, int64(102), metrics[0].LastUsedTime)

	assert.Equal(t, "model-a", metrics[1].ModelName)
	assert.Equal(t, 2, metrics[1].ChannelId)
	assert.Nil(t, metrics[1].AverageFirstTokenMs)
	require.NotNil(t, metrics[1].AverageTPS)
	assert.InDelta(t, 20, *metrics[1].AverageTPS, 0.001)

	assert.Equal(t, "model-b", metrics[2].ModelName)
	assert.Equal(t, 1, metrics[2].ChannelId)
	assert.Equal(t, 1, metrics[2].FirstTokenSampleCount)
	assert.Equal(t, 0, metrics[2].TPSSampleCount)
	require.NotNil(t, metrics[2].AverageFirstTokenMs)
	assert.InDelta(t, 500, *metrics[2].AverageFirstTokenMs, 0.001)
	assert.Nil(t, metrics[2].AverageTPS)
}

func TestGetChannelMonitorStabilityMetricsCountsSuccessesAndRetryFailures(t *testing.T) {
	originalLogDB := LOG_DB
	originalLogDatabaseType := common.LogDatabaseType()
	t.Cleanup(func() {
		LOG_DB = originalLogDB
		common.SetLogDatabaseType(originalLogDatabaseType)
	})

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "stability.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&Log{}))
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)

	logs := make([]*Log, 0, 18)
	for range 8 {
		logs = append(logs, &Log{ChannelId: 1, ModelName: "model-a", CreatedAt: 101, Type: LogTypeConsume})
	}
	logs = append(logs,
		&Log{ChannelId: 1, ModelName: "model-a", CreatedAt: 102, Type: LogTypeError},
		&Log{ChannelId: 1, ModelName: "model-a", CreatedAt: 103, Type: LogTypeError, IsRetryAttempt: true},
	)
	for range 2 {
		logs = append(logs, &Log{ChannelId: 2, ModelName: "model-a", CreatedAt: 104, Type: LogTypeConsume})
	}
	for range 3 {
		logs = append(logs, &Log{ChannelId: 2, ModelName: "model-a", CreatedAt: 105, Type: LogTypeError})
	}
	logs = append(logs,
		&Log{ChannelId: 1, ModelName: "model-a", CreatedAt: 99, Type: LogTypeError},
		&Log{ChannelId: 1, ModelName: "model-a", CreatedAt: 106, Type: LogTypeManage},
		&Log{ChannelId: 0, ModelName: "model-a", CreatedAt: 107, Type: LogTypeError},
	)
	require.NoError(t, db.Create(&logs).Error)

	metrics, err := GetChannelMonitorStabilityMetrics(context.Background(), 100)
	require.NoError(t, err)
	require.Len(t, metrics, 2)

	assert.Equal(t, 1, metrics[0].ChannelId)
	assert.Equal(t, int64(8), metrics[0].SuccessCount)
	assert.Equal(t, int64(2), metrics[0].FailureCount)
	assert.Equal(t, int64(10), metrics[0].SampleCount)
	assert.InDelta(t, 0.8, metrics[0].SuccessRate, 0.0001)

	assert.Equal(t, 2, metrics[1].ChannelId)
	assert.Equal(t, int64(2), metrics[1].SuccessCount)
	assert.Equal(t, int64(3), metrics[1].FailureCount)
	assert.Equal(t, int64(5), metrics[1].SampleCount)
	assert.InDelta(t, 0.4, metrics[1].SuccessRate, 0.0001)
}
