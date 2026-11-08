package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A username can be reused after a hard delete, so a user's own statistics must
// be scoped by the immutable user id. The administrator-wide view may still
// filter by username.
func TestSumUsedQuotaScopesStatisticsToUserId(t *testing.T) {
	username := "reused-log-stat-username"
	now := time.Now().Unix()
	rows := []Log{
		{UserId: 9001, Username: username, Type: LogTypeConsume, Quota: 100, CreatedAt: now},
		{UserId: 9002, Username: username, Type: LogTypeConsume, Quota: 700, CreatedAt: now},
	}
	require.NoError(t, LOG_DB.Create(&rows).Error)
	t.Cleanup(func() {
		require.NoError(t, LOG_DB.Where("username = ?", username).Delete(&Log{}).Error)
	})

	stat, err := SumUsedQuota(LogTypeConsume, 0, 0, "", rows[1].UserId, "", "", 0, "")
	require.NoError(t, err)
	assert.Equal(t, 700, stat.Quota, "only the caller's own rows count")

	stat, err = SumUsedQuota(LogTypeConsume, 0, 0, "", 0, username, "", 0, "")
	require.NoError(t, err)
	assert.Equal(t, 800, stat.Quota, "the administrator view still filters by username")
}
