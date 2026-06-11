package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetAllLogsFiltersUsernameByKeyword(t *testing.T) {
	truncateTables(t)

	require.NoError(t, LOG_DB.Create(&Log{UserId: 1, Username: "alice-prod", Type: LogTypeConsume, CreatedAt: 100, ModelName: "gpt-4o"}).Error)
	require.NoError(t, LOG_DB.Create(&Log{UserId: 2, Username: "bob-prod", Type: LogTypeConsume, CreatedAt: 100, ModelName: "gpt-4o"}).Error)

	logs, total, err := GetAllLogs(LogTypeUnknown, 0, 0, "", "alice", "", 0, 20, 0, "", "", "")
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, logs, 1)
	require.Equal(t, "alice-prod", logs[0].Username)
}
