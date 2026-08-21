package model

import (
	"context"
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestStreamLogsForExportAppliesListFiltersAndPreventsPartialLimits(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	originalLogDB := LOG_DB
	originalLogDatabaseType := common.LogDatabaseType()
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		LOG_DB = originalLogDB
		common.SetLogDatabaseType(originalLogDatabaseType)
	})

	logs := []Log{
		{
			UserId: 7, CreatedAt: 200, Type: LogTypeConsume, Username: "root", TokenName: "prod",
			ModelName: "gpt-4", ChannelId: 9, Group: "vip", RequestId: "req-1", UpstreamRequestId: "up-1",
		},
		{
			UserId: 7, CreatedAt: 201, Type: LogTypeConsume, Username: "root", TokenName: "prod",
			ModelName: "gpt-4o", ChannelId: 9, Group: "vip", RequestId: "req-2", UpstreamRequestId: "up-2",
		},
		{UserId: 8, CreatedAt: 202, Type: LogTypeError, Username: "other", ModelName: "gpt-4"},
	}
	require.NoError(t, db.Create(&logs).Error)

	var exported []*Log
	total, err := StreamLogsForExport(context.Background(), LogQueryFilter{
		UserId:            7,
		LogType:           LogTypeConsume,
		StartTimestamp:    200,
		EndTimestamp:      200,
		ModelName:         "gpt-4",
		ModelNameMode:     logModelNameModeExact,
		Username:          "root",
		TokenName:         "prod",
		Channel:           9,
		Group:             "vip",
		RequestId:         "req-1",
		UpstreamRequestId: "up-1",
	}, 10, func(log *Log) error {
		exported = append(exported, log)
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, exported, 1)
	assert.Equal(t, "req-1", exported[0].RequestId)

	visited := 0
	total, err = StreamLogsForExport(context.Background(), LogQueryFilter{}, 1, func(log *Log) error {
		visited++
		return nil
	})
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrLogExportLimitExceeded))
	assert.Equal(t, int64(3), total)
	assert.Zero(t, visited, "an oversized export must fail before emitting rows")
}
