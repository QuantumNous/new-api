package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func withLogTestDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	previousDB := DB
	previousLogDB := LOG_DB
	previousType := common.LogDatabaseType()
	DB = db
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = previousDB
		LOG_DB = previousLogDB
		common.SetLogDatabaseType(previousType)
	})
	return db
}

func TestLogCursorPaginationDoesNotSkipTimestampTies(t *testing.T) {
	db := withLogTestDatabase(t)
	logs := []*Log{
		{Id: 1, CreatedAt: 100, RequestId: "request-1"},
		{Id: 2, CreatedAt: 100, RequestId: "request-2"},
		{Id: 3, CreatedAt: 99, RequestId: "request-3"},
		{Id: 4, CreatedAt: 98, RequestId: "request-4"},
	}
	require.NoError(t, db.Create(&logs).Error)

	first, cursor, hasMore, err := GetAllLogsByCursor(LogQuery{}, "", 2, 0)
	require.NoError(t, err)
	require.True(t, hasMore)
	require.NotEmpty(t, cursor)
	require.Equal(t, []int{2, 1}, []int{first[0].Id, first[1].Id})

	second, nextCursor, hasMore, err := GetAllLogsByCursor(LogQuery{}, cursor, 2, 2)
	require.NoError(t, err)
	require.False(t, hasMore)
	require.Empty(t, nextCursor)
	require.Equal(t, []int{3, 4}, []int{second[0].Id, second[1].Id})
}

func TestLogCursorRejectsMalformedValues(t *testing.T) {
	withLogTestDatabase(t)
	_, _, _, err := GetAllLogsByCursor(LogQuery{}, "not-base64", 20, 0)
	require.ErrorIs(t, err, ErrInvalidLogCursor)
}

func TestCreateLogCopiesTraceIdFromLegacyOtherField(t *testing.T) {
	withLogTestDatabase(t)
	log := &Log{
		CreatedAt: 100,
		Other:     common.MapToJsonStr(map[string]interface{}{"trace_id": "trace-123"}),
	}
	require.NoError(t, createLog(log))
	require.Equal(t, "trace-123", log.TraceId)

	logs, err := GetLogsByTraceId("trace-123", 10)
	require.NoError(t, err)
	require.Len(t, logs, 1)
	require.Equal(t, log.Id, logs[0].Id)
}

func TestLogCursorQueriesHaveSQLiteIndexPlans(t *testing.T) {
	db := withLogTestDatabase(t)
	type planRow struct {
		Detail string `gorm:"column:detail"`
	}
	var cursorPlan []planRow
	require.NoError(t, db.Raw(
		"EXPLAIN QUERY PLAN SELECT * FROM logs WHERE created_at < ? OR (created_at = ? AND id < ?) ORDER BY created_at DESC, id DESC LIMIT 101",
		100,
		100,
		10,
	).Scan(&cursorPlan).Error)
	cursorDetails := make([]string, 0, len(cursorPlan))
	for _, row := range cursorPlan {
		cursorDetails = append(cursorDetails, row.Detail)
	}
	require.Contains(t, strings.Join(cursorDetails, "\n"), "idx_created_at_id")

	var tracePlan []planRow
	require.NoError(t, db.Raw(
		"EXPLAIN QUERY PLAN SELECT * FROM logs WHERE trace_id = ? ORDER BY created_at ASC, id ASC LIMIT 200",
		"trace-123",
	).Scan(&tracePlan).Error)
	traceDetails := make([]string, 0, len(tracePlan))
	for _, row := range tracePlan {
		traceDetails = append(traceDetails, row.Detail)
	}
	require.Contains(t, strings.Join(traceDetails, "\n"), "idx_logs_trace")
}
