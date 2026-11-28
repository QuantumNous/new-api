package model

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// setupExternalBillingDB spins up an in-memory SQLite pair for DB (main) and
// LOG_DB (logs), creates the minimal schema, and restores globals afterwards.
// No table prefix is used so the unprefixed Table("channels")/Table("logs")
// lookups inside the model functions resolve as-is.
func setupExternalBillingDB(t *testing.T) {
	t.Helper()
	open := func() *gorm.DB {
		db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
			NamingStrategy: schema.NamingStrategy{},
		})
		require.NoError(t, err)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		// :memory: is per-connection; a single conn keeps the schema visible.
		sqlDB.SetMaxOpenConns(1)
		return db
	}
	prevDB, prevLogDB := DB, LOG_DB
	DB = open()
	LOG_DB = open()
	t.Cleanup(func() { DB, LOG_DB = prevDB, prevLogDB })

	require.NoError(t, DB.Exec(`CREATE TABLE channels (
		id integer PRIMARY KEY AUTOINCREMENT,
		tag varchar(64)
	)`).Error)
	require.NoError(t, LOG_DB.Exec(`CREATE TABLE logs (
		id integer PRIMARY KEY AUTOINCREMENT,
		user_id integer,
		username varchar(64),
		channel_id integer,
		model_name varchar(128),
		prompt_tokens integer DEFAULT 0,
		completion_tokens integer DEFAULT 0,
		quota integer DEFAULT 0,
		type integer,
		created_at integer
	)`).Error)
}

func insertExternalChannel(t *testing.T, id int, tag string) {
	t.Helper()
	require.NoError(t, DB.Exec(
		`INSERT INTO channels (id, tag) VALUES (?, ?)`, id, tag).Error)
}

func insertConsumeLog(t *testing.T, userId int, username string, channelId int,
	model string, prompt, completion, quota int64, ts int64) {
	t.Helper()
	require.NoError(t, LOG_DB.Exec(
		`INSERT INTO logs
		 (user_id, username, channel_id, model_name, prompt_tokens, completion_tokens, quota, type, created_at)
		 VALUES (?,?,?,?,?,?,?,?,?)`,
		userId, username, channelId, model, prompt, completion, quota, LogTypeConsume, ts).Error)
}

// TestSumExternalSelfStatNoUsageReturnsNil is the regression test for the
// phantom-account bug: a bare aggregate query always returns one zeroed row even
// when nothing matched, so the caller must get nil (and the handler then emits
// an empty array) rather than a row of zeros.
func TestSumExternalSelfStatNoUsageReturnsNil(t *testing.T) {
	setupExternalBillingDB(t)
	// User 42 has no consume logs at all on the external channel.
	insertExternalChannel(t, 7, "external")

	row, err := SumExternalSelfStat(0, 0, 42, "alice")
	require.NoError(t, err)
	assert.Nil(t, row, "no matching logs must yield nil, not a zeroed row")
}

// TestSumExternalSelfStatNoExternalChannelsReturnsNil covers the branch where no
// channel carries tag='external' at all.
func TestSumExternalSelfStatNoExternalChannelsReturnsNil(t *testing.T) {
	setupExternalBillingDB(t)
	insertExternalChannel(t, 8, "internal")
	insertConsumeLog(t, 42, "alice", 8, "gpt-4o", 100, 50, 5000, 1700000000)

	row, err := SumExternalSelfStat(0, 0, 42, "alice")
	require.NoError(t, err)
	assert.Nil(t, row, "no external channels must yield nil")
}

// TestSumExternalSelfStatZeroQuotaIsRealUsage guards the trap that motivated
// counting rows instead of inspecting counters: a genuine call billed at
// quota=0 (free or locally-hosted model) has all-zero counters and must NOT be
// mistaken for "no usage".
func TestSumExternalSelfStatZeroQuotaIsRealUsage(t *testing.T) {
	setupExternalBillingDB(t)
	insertExternalChannel(t, 9, "external")
	// Real consume log: tokens present but quota zero, and even tokens may be 0.
	insertConsumeLog(t, 42, "alice", 9, "local-free", 0, 0, 0, 1700000000)

	row, err := SumExternalSelfStat(0, 0, 42, "alice")
	require.NoError(t, err)
	require.NotNil(t, row, "a zero-quota call is still real usage")
	assert.Equal(t, int64(0), row.Quota)
	assert.Equal(t, int64(1), row.MatchedLogs)
	assert.Equal(t, "alice", row.Username, "username must be echoed for display")
}

// TestSumExternalSelfStatAggregates verifies the normal aggregation path and
// that the display name survives the aggregate Scan.
func TestSumExternalSelfStatAggregates(t *testing.T) {
	setupExternalBillingDB(t)
	insertExternalChannel(t, 10, "external")
	insertExternalChannel(t, 11, "external")
	insertExternalChannel(t, 12, "internal")
	insertConsumeLog(t, 42, "alice", 10, "gpt-4o", 1000, 500, 20000, 1700000000)
	insertConsumeLog(t, 42, "alice", 11, "claude-3", 200, 100, 4000, 1700000100)
	// Non-external channel and another user must both be excluded.
	insertConsumeLog(t, 42, "alice", 12, "internal-model", 9999, 9999, 99999, 1700000200)
	insertConsumeLog(t, 43, "bob", 10, "gpt-4o", 7777, 7777, 77777, 1700000300)

	row, err := SumExternalSelfStat(0, 0, 42, "alice")
	require.NoError(t, err)
	require.NotNil(t, row)
	assert.Equal(t, int64(2), row.MatchedLogs)
	assert.Equal(t, int64(1200), row.PromptTokens)
	assert.Equal(t, int64(600), row.CompletionTokens)
	assert.Equal(t, int64(1800), row.TotalTokens)
	assert.Equal(t, int64(24000), row.Quota)
	assert.Equal(t, int64(2), row.ModelCount)
	assert.Equal(t, "alice", row.Username)
}

// TestSumExternalSelfStatWrongUserIDIsEmpty ensures scoping is by user_id, not
// username: looking up a user id with no logs must not return someone else's row.
func TestSumExternalSelfStatWrongUserIDIsEmpty(t *testing.T) {
	setupExternalBillingDB(t)
	insertExternalChannel(t, 13, "external")
	insertConsumeLog(t, 43, "alice", 13, "gpt-4o", 100, 50, 500, 1700000000)

	// Same username, different id: must be empty.
	row, err := SumExternalSelfStat(0, 0, 42, "alice")
	require.NoError(t, err)
	assert.Nil(t, row)
}

// TestSumExternalSelfStatTimeWindow verifies the time bounds filter.
func TestSumExternalSelfStatTimeWindow(t *testing.T) {
	setupExternalBillingDB(t)
	insertExternalChannel(t, 14, "external")
	base := time.Now().Unix() - 1000
	insertConsumeLog(t, 42, "alice", 14, "gpt-4o", 100, 50, 1000, base)
	insertConsumeLog(t, 42, "alice", 14, "gpt-4o", 200, 100, 2000, base+500)

	row, err := SumExternalSelfStat(0, 0, 42, "alice")
	require.NoError(t, err)
	require.NotNil(t, row)
	assert.Equal(t, int64(3000), row.Quota, "all time includes both logs")

	// Window covering only the first log.
	row, err = SumExternalSelfStat(0, base+100, 42, "alice")
	require.NoError(t, err)
	require.NotNil(t, row)
	assert.Equal(t, int64(1000), row.Quota)
	assert.Equal(t, int64(1), row.MatchedLogs)

	// Window that excludes everything must be nil, not a zeroed row.
	row, err = SumExternalSelfStat(base+1000, 0, 42, "alice")
	require.NoError(t, err)
	assert.Nil(t, row, "a window with no logs must yield nil")
}

// TestSumExternalByUserAdminPathUnchanged pins the admin aggregator: it groups by
// username and keeps returning a slice (nil when there are no external channels).
func TestSumExternalByUserAdminPathUnchanged(t *testing.T) {
	setupExternalBillingDB(t)
	insertExternalChannel(t, 15, "external")
	insertConsumeLog(t, 42, "alice", 15, "gpt-4o", 100, 50, 1000, 1700000000)
	insertConsumeLog(t, 43, "bob", 15, "gpt-4o", 200, 100, 2000, 1700000000)

	rows, err := SumExternalByUser(0, 0, "")
	require.NoError(t, err)
	require.Len(t, rows, 2)

	byName := map[string]ExternalBillingRow{}
	for _, r := range rows {
		byName[r.Username] = r
	}
	assert.Equal(t, int64(1000), byName["alice"].Quota)
	assert.Equal(t, int64(2000), byName["bob"].Quota)

	// Username filter still works on the admin path.
	rows, err = SumExternalByUser(0, 0, "alice")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "alice", rows[0].Username)
}
