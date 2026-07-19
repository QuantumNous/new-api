package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminLogQueriesExcludeChannelTestsByDefault(t *testing.T) {
	truncateTables(t)
	now := time.Now().Unix()
	require.NoError(t, LOG_DB.Create(&[]Log{
		{CreatedAt: now, Type: LogTypeConsume, TokenName: "regular-token", Quota: 100, PromptTokens: 10},
		{CreatedAt: now, Type: LogTypeConsume, TokenName: ChannelTestLogLabel, Quota: 200, PromptTokens: 20},
	}).Error)

	logs, total, err := GetAllLogs(LogTypeUnknown, 0, 0, "", "", "", 0, 20, 0, "", "", "", false)
	require.NoError(t, err)
	require.Len(t, logs, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, "regular-token", logs[0].TokenName)

	logs, total, err = GetAllLogs(LogTypeUnknown, 0, 0, "", "", "", 0, 20, 0, "", "", "", true)
	require.NoError(t, err)
	assert.Len(t, logs, 2)
	assert.Equal(t, int64(2), total)

	stat, err := SumUsedQuota(LogTypeUnknown, 0, 0, "", "", "", 0, "", false)
	require.NoError(t, err)
	assert.Equal(t, 100, stat.Quota)
	assert.Equal(t, 1, stat.Rpm)
	assert.Equal(t, 10, stat.Tpm)

	stat, err = SumUsedQuota(LogTypeUnknown, 0, 0, "", "", "", 0, "", true)
	require.NoError(t, err)
	assert.Equal(t, 300, stat.Quota)
	assert.Equal(t, 2, stat.Rpm)
	assert.Equal(t, 30, stat.Tpm)
}
