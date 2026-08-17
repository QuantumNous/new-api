package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetOperationLogsFiltersAuditTypesAndLiteralKeyword(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	previousLogDB := LOG_DB
	previousLogType := common.LogDatabaseType()
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		common.SetLogDatabaseType(previousLogType)
	})

	logs := []Log{
		{Type: LogTypeManage, Username: "admin", Content: "Updated user", Ip: "10.0.0.1", Other: `{"op":{"action":"user.update"}}`, CreatedAt: 100},
		{Type: LogTypeSystem, Username: "member", Content: "Granted 100% reward", Other: `{"op":{"action":"user.checkin"}}`, CreatedAt: 200},
		{Type: LogTypeLogin, Username: "viewer", Content: "Logged in", Other: `{"op":{"action":"login"}}`, CreatedAt: 300},
		{Type: LogTypeConsume, Username: "member", Content: "Request completed", CreatedAt: 400},
	}
	require.NoError(t, db.Create(&logs).Error)

	items, total, err := GetOperationLogs(nil, "", 0, 0, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
	require.Len(t, items, 3)
	assert.Equal(t, []int{LogTypeLogin, LogTypeSystem, LogTypeManage}, []int{items[0].Type, items[1].Type, items[2].Type})

	items, total, err = GetOperationLogs([]int{LogTypeSystem}, "100%", 0, 0, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, "member", items[0].Username)

	items, total, err = GetOperationLogs(nil, "user_", 0, 0, 0, 10)
	require.NoError(t, err)
	assert.Zero(t, total)
	assert.Empty(t, items)

	items, total, err = GetOperationLogs(nil, "member", 150, 250, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, LogTypeSystem, items[0].Type)
}
