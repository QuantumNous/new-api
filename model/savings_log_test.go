package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSavingsLogTestDB(t *testing.T) {
	t.Helper()
	previousDB := LOG_DB
	previousType := common.LogDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		LOG_DB = previousDB
		common.SetLogDatabaseType(previousType)
	})
}

func TestGetSavingsLifetimeLogBatchUsesRelationalIDKeyset(t *testing.T) {
	setupSavingsLogTestDB(t)
	logs := []Log{
		{Id: 1, Type: LogTypeConsume, RequestId: "req-1", CreatedAt: 100},
		{Id: 2, Type: LogTypeManage, RequestId: "req-ignore", CreatedAt: 101},
		{Id: 3, Type: LogTypeConsume, RequestId: "req-3", CreatedAt: 102},
		{Id: 4, Type: LogTypeConsume, RequestId: "req-4", CreatedAt: 103},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	target, total, err := GetSavingsLifetimeLogBoundary()
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
	assert.Equal(t, 4, target.ID)

	first, err := GetSavingsLifetimeLogBatch(SavingsLifetimeLogCursor{}, target, 2)
	require.NoError(t, err)
	require.Len(t, first, 2)
	assert.Equal(t, []int{1, 3}, []int{first[0].Id, first[1].Id})
	second, err := GetSavingsLifetimeLogBatch(
		SavingsLifetimeLogCursor{ID: first[1].Id},
		target,
		2,
	)
	require.NoError(t, err)
	require.Len(t, second, 1)
	assert.Equal(t, 4, second[0].Id)
}

func TestGetSavingsLifetimeLogBatchUsesClickHouseCompositeKeyset(t *testing.T) {
	setupSavingsLogTestDB(t)
	common.SetLogDatabaseType(common.DatabaseTypeClickHouse)
	logs := []Log{
		{Id: 1, Type: LogTypeConsume, RequestId: "req-a", CreatedAt: 100},
		{Id: 2, Type: LogTypeConsume, RequestId: "req-b", CreatedAt: 100},
		{Id: 3, Type: LogTypeConsume, RequestId: "req-c", CreatedAt: 100},
		{Id: 4, Type: LogTypeConsume, RequestId: "req-a", CreatedAt: 101},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)
	target := SavingsLifetimeLogCursor{CreatedAt: 101, RequestID: "req-a"}

	first, err := GetSavingsLifetimeLogBatch(SavingsLifetimeLogCursor{}, target, 2)
	require.NoError(t, err)
	require.Len(t, first, 2)
	assert.Equal(t, []string{"req-a", "req-b"}, []string{first[0].RequestId, first[1].RequestId})
	second, err := GetSavingsLifetimeLogBatch(
		SavingsLifetimeLogCursor{CreatedAt: first[1].CreatedAt, RequestID: first[1].RequestId},
		target,
		3,
	)
	require.NoError(t, err)
	require.Len(t, second, 2)
	assert.Equal(t, []string{"req-c", "req-a"}, []string{second[0].RequestId, second[1].RequestId})
}

func TestCountSavingsLifetimeClickHouseCursorAmbiguityReportsSplitTie(t *testing.T) {
	setupSavingsLogTestDB(t)
	common.SetLogDatabaseType(common.DatabaseTypeClickHouse)
	logs := []Log{
		{Id: 1, Type: LogTypeConsume, RequestId: "same", CreatedAt: 100},
		{Id: 2, Type: LogTypeConsume, RequestId: "same", CreatedAt: 100},
		{Id: 3, Type: LogTypeConsume, RequestId: "same", CreatedAt: 100},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)
	rows, err := GetSavingsLifetimeLogBatch(
		SavingsLifetimeLogCursor{},
		SavingsLifetimeLogCursor{CreatedAt: 100, RequestID: "same"},
		2,
	)
	require.NoError(t, err)

	ambiguous, err := CountSavingsLifetimeClickHouseCursorAmbiguity(rows)

	require.NoError(t, err)
	assert.Equal(t, int64(1), ambiguous)
}

func TestGetRecentSavingsLifetimeLogBatchAppliesLookbackAndCursor(t *testing.T) {
	setupSavingsLogTestDB(t)
	logs := []Log{
		{Id: 1, Type: LogTypeConsume, RequestId: "old", CreatedAt: 99},
		{Id: 2, Type: LogTypeConsume, RequestId: "first", CreatedAt: 100},
		{Id: 3, Type: LogTypeConsume, RequestId: "second", CreatedAt: 101},
		{Id: 4, Type: LogTypeConsume, RequestId: "beyond-target", CreatedAt: 102},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	rows, err := GetRecentSavingsLifetimeLogBatch(
		100,
		SavingsLifetimeLogCursor{ID: 2},
		SavingsLifetimeLogCursor{ID: 3},
		10,
	)

	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "second", rows[0].RequestId)
}
