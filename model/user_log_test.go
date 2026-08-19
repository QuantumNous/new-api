package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetUserLogsExcludesOperationLogTypes(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	previousDB, previousLogDB := DB, LOG_DB
	previousLogType := common.LogDatabaseType()
	DB, LOG_DB = db, db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.SetLogDatabaseType(previousLogType)
	})

	logs := make([]Log, 0, LogTypeLogin)
	for logType := LogTypeTopup; logType <= LogTypeLogin; logType++ {
		logs = append(logs, Log{
			UserId:    7,
			Type:      logType,
			ModelName: "model-" + strconv.Itoa(logType),
			Content:   "log entry",
			CreatedAt: int64(100 + logType),
		})
	}
	logs = append(logs, Log{UserId: 8, Type: LogTypeConsume, Content: "other user", CreatedAt: 200})
	require.NoError(t, db.Create(&logs).Error)

	items, total, err := GetUserLogs(7, LogTypeUnknown, 0, 0, "", "", 0, 10, "", "", "", "")
	require.NoError(t, err)
	assert.Equal(t, int64(4), total)
	require.Len(t, items, 4)
	assert.Equal(t,
		[]int{LogTypeRefund, LogTypeError, LogTypeConsume, LogTypeTopup},
		[]int{items[0].Type, items[1].Type, items[2].Type, items[3].Type},
	)

	items, total, err = GetUserLogs(7, LogTypeUnknown, 0, 0, "", "", 1, 2, "", "", "", "")
	require.NoError(t, err)
	assert.Equal(t, int64(4), total)
	require.Len(t, items, 2)
	assert.Equal(t, []int{LogTypeError, LogTypeConsume}, []int{items[0].Type, items[1].Type})

	items, total, err = GetUserLogs(7, LogTypeUnknown, 105, 105, "model-5", "", 0, 10, "", "", "", "")
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, LogTypeError, items[0].Type)

	items, total, err = GetUserLogs(7, LogTypeConsume, 0, 0, "", "", 0, 10, "", "", "", "")
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, LogTypeConsume, items[0].Type)

	for _, logType := range []int{LogTypeManage, LogTypeSystem, LogTypeLogin, 99} {
		items, total, err = GetUserLogs(7, logType, 0, 0, "", "", 0, 10, "", "", "", "")
		require.NoError(t, err)
		assert.Zero(t, total)
		assert.Empty(t, items)
	}
}
