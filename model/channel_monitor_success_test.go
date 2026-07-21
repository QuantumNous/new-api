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

func TestGetChannelMonitorSuccessMetricsDistinguishesActualAndFinalResults(t *testing.T) {
	originalLogDB := LOG_DB
	originalLogDatabaseType := common.LogDatabaseType()
	t.Cleanup(func() {
		LOG_DB = originalLogDB
		common.SetLogDatabaseType(originalLogDatabaseType)
		initCol()
	})

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "channel-success.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&Log{}))
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	initCol()

	logs := []*Log{
		{ChannelId: 1, ModelName: "model-a", Group: "vip", CreatedAt: 101, Type: LogTypeConsume},
		{ChannelId: 1, ModelName: "model-a", Group: "vip", CreatedAt: 102, Type: LogTypeConsume},
		{ChannelId: 1, ModelName: "model-a", Group: "vip", CreatedAt: 103, Type: LogTypeError, IsRetryAttempt: true, Content: "status_code=503, upstream unavailable", Other: `{"status_code":503,"error_type":"upstream_error","error_code":"bad_response_status_code"}`},
		{ChannelId: 1, ModelName: "model-a", Group: "vip", CreatedAt: 104, Type: LogTypeError, Content: "status_code=429, rate limited", Other: `{"status_code":"429","error_type":"rate_limit","error_code":"rate_limit_exceeded"}`},
		{ChannelId: 2, ModelName: "model-b", Group: "vip", CreatedAt: 105, Type: LogTypeError, IsRetryAttempt: true, Content: "status_code=503, another upstream failure", Other: `{"error_type":"upstream_error","error_code":"bad_response_status_code"}`},
		{ChannelId: 2, ModelName: "model-b", Group: "standard", CreatedAt: 106, Type: LogTypeConsume},
		{ChannelId: 1, ModelName: "model-a", Group: "vip", CreatedAt: 99, Type: LogTypeError},
		{ChannelId: 0, ModelName: "model-a", Group: "vip", CreatedAt: 107, Type: LogTypeError},
		{ChannelId: 1, ModelName: "model-a", Group: "vip", CreatedAt: 108, Type: LogTypeManage},
	}
	require.NoError(t, db.Create(&logs).Error)

	channelMetrics, groupMetrics, err := GetChannelMonitorSuccessMetrics(context.Background(), 100)
	require.NoError(t, err)
	require.Len(t, channelMetrics, 2)

	assert.Equal(t, 1, channelMetrics[0].ChannelId)
	assert.Equal(t, "model-a", channelMetrics[0].ModelName)
	assert.Equal(t, int64(2), channelMetrics[0].ActualSuccessCount)
	assert.Equal(t, int64(2), channelMetrics[0].ActualFailureCount)
	assert.Equal(t, int64(4), channelMetrics[0].ActualSampleCount)
	assert.InDelta(t, 0.5, channelMetrics[0].ActualSuccessRate, 0.0001)
	assert.Equal(t, int64(2), channelMetrics[0].FinalSuccessCount)
	assert.Equal(t, int64(1), channelMetrics[0].FinalFailureCount)
	assert.Equal(t, int64(3), channelMetrics[0].FinalSampleCount)
	assert.InDelta(t, 2.0/3.0, channelMetrics[0].FinalSuccessRate, 0.0001)

	assert.Equal(t, 2, channelMetrics[1].ChannelId)
	assert.Equal(t, "model-b", channelMetrics[1].ModelName)
	assert.Equal(t, int64(1), channelMetrics[1].ActualSuccessCount)
	assert.Equal(t, int64(1), channelMetrics[1].ActualFailureCount)
	assert.InDelta(t, 0.5, channelMetrics[1].ActualSuccessRate, 0.0001)
	assert.Equal(t, int64(1), channelMetrics[1].FinalSuccessCount)
	assert.Zero(t, channelMetrics[1].FinalFailureCount)
	assert.InDelta(t, 1, channelMetrics[1].FinalSuccessRate, 0.0001)

	require.Len(t, groupMetrics, 2)
	assert.Equal(t, "standard", groupMetrics[0].Group)
	assert.Equal(t, int64(1), groupMetrics[0].ActualSampleCount)
	assert.InDelta(t, 1, groupMetrics[0].ActualSuccessRate, 0.0001)
	assert.InDelta(t, 1, groupMetrics[0].FinalSuccessRate, 0.0001)

	assert.Equal(t, "vip", groupMetrics[1].Group)
	assert.Equal(t, int64(2), groupMetrics[1].ActualSuccessCount)
	assert.Equal(t, int64(3), groupMetrics[1].ActualFailureCount)
	assert.Equal(t, int64(5), groupMetrics[1].ActualSampleCount)
	assert.InDelta(t, 0.4, groupMetrics[1].ActualSuccessRate, 0.0001)
	assert.Equal(t, int64(2), groupMetrics[1].FinalSuccessCount)
	assert.Equal(t, int64(1), groupMetrics[1].FinalFailureCount)
	assert.Equal(t, int64(3), groupMetrics[1].FinalSampleCount)
	assert.InDelta(t, 2.0/3.0, groupMetrics[1].FinalSuccessRate, 0.0001)

	channelDetail, err := GetChannelMonitorSuccessDetail(context.Background(), 100, ChannelMonitorSuccessFilter{
		ChannelId: 1,
		ModelName: "model-a",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(2), channelDetail.Summary.ActualSuccessCount)
	assert.Equal(t, int64(2), channelDetail.Summary.ActualFailureCount)
	assert.Equal(t, int64(1), channelDetail.Summary.FinalFailureCount)
	require.Len(t, channelDetail.ChannelItems, 1)
	require.Len(t, channelDetail.FailureCategories, 2)
	assert.Equal(t, 429, channelDetail.FailureCategories[0].StatusCode)
	assert.Equal(t, "rate_limit_exceeded", channelDetail.FailureCategories[0].ErrorCode)
	assert.Equal(t, int64(1), channelDetail.FailureCategories[0].ActualCount)
	assert.Equal(t, int64(1), channelDetail.FailureCategories[0].FinalCount)
	assert.Equal(t, 503, channelDetail.FailureCategories[1].StatusCode)
	assert.Equal(t, int64(1), channelDetail.FailureCategories[1].ActualCount)
	assert.Zero(t, channelDetail.FailureCategories[1].FinalCount)

	groupDetail, err := GetChannelMonitorSuccessDetail(context.Background(), 100, ChannelMonitorSuccessFilter{Group: "vip"})
	require.NoError(t, err)
	assert.Equal(t, int64(5), groupDetail.Summary.ActualSampleCount)
	assert.Equal(t, int64(3), groupDetail.Summary.FinalSampleCount)
	require.Len(t, groupDetail.ChannelItems, 2)
	assert.Equal(t, 1, groupDetail.ChannelItems[0].ChannelId)
	assert.Equal(t, int64(4), groupDetail.ChannelItems[0].ActualSampleCount)
	assert.Equal(t, 2, groupDetail.ChannelItems[1].ChannelId)
	assert.Equal(t, int64(1), groupDetail.ChannelItems[1].ActualFailureCount)
	assert.Zero(t, groupDetail.ChannelItems[1].FinalSampleCount)
	assert.Empty(t, groupDetail.FailureCategories)

	require.NoError(t, db.Create(&Log{
		ChannelId:      1,
		ModelName:      "model-a",
		Group:          "vip",
		CreatedAt:      110,
		Type:           LogTypeError,
		IsRetryAttempt: true,
		Content:        "status_code=503, second unavailable response",
		Other:          `{"status_code":503,"error_type":"upstream_error","error_code":"bad_response_status_code"}`,
	}).Error)
	mergedDetail, err := GetChannelMonitorSuccessDetail(context.Background(), 100, ChannelMonitorSuccessFilter{
		ChannelId: 1,
		ModelName: "model-a",
	})
	require.NoError(t, err)
	require.Len(t, mergedDetail.FailureCategories, 2)
	assert.Equal(t, 503, mergedDetail.FailureCategories[0].StatusCode)
	assert.Equal(t, int64(2), mergedDetail.FailureCategories[0].ActualCount)
	assert.Zero(t, mergedDetail.FailureCategories[0].FinalCount)
	assert.Equal(t, int64(110), mergedDetail.FailureCategories[0].LastOccurred)
	assert.Contains(t, mergedDetail.FailureCategories[0].SampleContent, "second unavailable")
}
