package model

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetSelfLogStatScopesConsumeLogsByUserAndDay(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	previousLogDB := LOG_DB
	LOG_DB = db
	t.Cleanup(func() { LOG_DB = previousLogDB })

	now := time.Date(2026, time.August, 7, 15, 30, 0, 0, time.FixedZone("UTC+8", 8*60*60))
	logs := []Log{
		{Username: "alice", Type: LogTypeConsume, Quota: 100, CreatedAt: now.Add(-time.Hour).Unix()},
		{Username: "alice", Type: LogTypeConsume, Quota: 250, CreatedAt: now.Add(-24 * time.Hour).Unix()},
		{Username: "alice", Type: LogTypeManage, Quota: 999, CreatedAt: now.Add(-time.Hour).Unix()},
		{Username: "bob", Type: LogTypeConsume, Quota: 500, CreatedAt: now.Add(-time.Hour).Unix()},
	}
	require.NoError(t, db.Create(&logs).Error)

	stat, err := GetSelfLogStat("alice", now)
	require.NoError(t, err)
	assert.Equal(t, int64(2), stat.TotalRequests)
	assert.Equal(t, int64(350), stat.TotalQuota)
	assert.Equal(t, int64(1), stat.TodayRequests)
	assert.Equal(t, int64(100), stat.TodayQuota)
}
