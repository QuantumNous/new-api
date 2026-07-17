package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/utils/tests"
)

// visibilitySQL runs the scope through a DryRun query and returns the generated
// WHERE clause. The scope only builds predicates; DryRun keeps this deterministic
// and table-schema-free.
func visibilitySQL(t *testing.T, apply func(*gorm.DB) *gorm.DB) string {
	t.Helper()
	db, err := gorm.Open(tests.DummyDialector{}, &gorm.Config{DryRun: true})
	require.NoError(t, err)
	query := apply(db.Table("logs"))
	var rows []Log
	require.NoError(t, query.Find(&rows).Error)
	return query.Statement.SQL.String()
}

func TestLogVisibilityScopeEmptyMatchesNothing(t *testing.T) {
	scope := LogVisibilityScope{}
	sql := visibilitySQL(t, func(tx *gorm.DB) *gorm.DB {
		return scope.Apply(tx, "logs.")
	})
	assert.Contains(t, sql, "1 = 0")
}

func TestLogVisibilityScopeOwnedChannelsAndSelf(t *testing.T) {
	// No channel.read_all, no user.read: own logs + own channels only.
	scope := LogVisibilityScope{
		UserID:     5,
		ChannelIDs: []int{10, 11},
	}
	sql := visibilitySQL(t, func(tx *gorm.DB) *gorm.DB {
		return scope.Apply(tx, "logs.")
	})
	assert.Contains(t, sql, "logs.user_id = ?")
	assert.Contains(t, sql, "logs.channel_id IN (?,?)")
	assert.Contains(t, sql, " OR ")
}

func TestLogVisibilityScopeAllChannelsExcludesZeroChannel(t *testing.T) {
	// channel.read_all uses <> 0 so historical channel_id=0 logs are channel-related
	// and only surfaced when user.read also applies.
	scope := LogVisibilityScope{
		UserID:                      5,
		AllChannels:                 true,
		IncludeOtherUsersNonChannel: true,
	}
	sql := visibilitySQL(t, func(tx *gorm.DB) *gorm.DB {
		return scope.Apply(tx, "logs.")
	})
	assert.Contains(t, sql, "logs.channel_id <> 0")
	assert.Contains(t, sql, "logs.channel_id = 0")
}
