package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupUsageStatTestDB wires the package-level LOG_DB/DB handles to a throwaway
// in-memory database so the aggregation can be exercised end to end.
func setupUsageStatTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Exec(`CREATE TABLE logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		created_at INTEGER,
		type INTEGER,
		model_name TEXT,
		channel_id INTEGER,
		prompt_tokens INTEGER,
		completion_tokens INTEGER,
		quota INTEGER,
		other TEXT
	)`).Error)
	require.NoError(t, db.Exec(`CREATE TABLE channels (id INTEGER PRIMARY KEY, name TEXT)`).Error)

	prevLogDB, prevDB, prevGroupCol := LOG_DB, DB, logGroupCol
	LOG_DB, DB, logGroupCol = db, db, "group"
	t.Cleanup(func() {
		LOG_DB, DB, logGroupCol = prevLogDB, prevDB, prevGroupCol
	})

	return db
}

func insertUsageStatLog(t *testing.T, db *gorm.DB, createdAt int64, logType int, modelName string, channelId int, promptTokens, completionTokens, quota int, other string) {
	t.Helper()
	require.NoError(t, db.Exec(
		`INSERT INTO logs (created_at, type, model_name, channel_id, prompt_tokens, completion_tokens, quota, other)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		createdAt, logType, modelName, channelId, promptTokens, completionTokens, quota, other,
	).Error)
}

// cacheWriteTokens must not double count: when the 5m/1h split is present the
// total column is only used when it is larger (same rule as
// service.cacheWriteTokensTotal).
func TestLogCacheUsageCacheWriteTokens(t *testing.T) {
	cases := []struct {
		name  string
		usage logCacheUsage
		want  int64
	}{
		{name: "no cache at all", usage: logCacheUsage{}, want: 0},
		{name: "total only", usage: logCacheUsage{CacheCreationTokens: 100}, want: 100},
		{
			name:  "split only",
			usage: logCacheUsage{CacheCreationTokens5m: 30, CacheCreationTokens1h: 40},
			want:  70,
		},
		{
			name:  "split larger than total",
			usage: logCacheUsage{CacheCreationTokens: 50, CacheCreationTokens5m: 30, CacheCreationTokens1h: 40},
			want:  70,
		},
		{
			name:  "total larger than split",
			usage: logCacheUsage{CacheCreationTokens: 90, CacheCreationTokens5m: 30, CacheCreationTokens1h: 40},
			want:  90,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, tc.usage.cacheWriteTokens())
		})
	}
}

func TestSumUsageByModelAndChannel(t *testing.T) {
	db := setupUsageStatTestDB(t)
	require.NoError(t, db.Exec(`INSERT INTO channels (id, name) VALUES (1, 'chan-one')`).Error)

	insertUsageStatLog(t, db, 100, LogTypeConsume, "model-a", 1, 100, 10, 1000, `{"cache_tokens":300}`)
	// Split present and larger than the total: the split wins.
	insertUsageStatLog(t, db, 250, LogTypeConsume, "model-a", 1, 0, 5, 500,
		`{"cache_tokens":0,"cache_creation_tokens":50,"cache_creation_tokens_5m":20,"cache_creation_tokens_1h":25}`)
	// Channel 9 has no channels row (deleted channel) and no cache fields at all.
	insertUsageStatLog(t, db, 300, LogTypeConsume, "model-b", 9, 50, 0, 200, "")
	// Non-consume logs must be ignored even though they carry cache tokens.
	insertUsageStatLog(t, db, 350, LogTypeTopup, "model-a", 1, 999, 999, 9999, `{"cache_tokens":9999}`)
	// Outside the filtered range used by the second part of this test.
	insertUsageStatLog(t, db, 600, LogTypeConsume, "model-c", 1, 999, 999, 9999, `{"cache_tokens":9999}`)

	result, err := SumUsageByModelAndChannel(0, 0, "", 0, "")
	require.NoError(t, err)

	// Sorted by quota descending: model-c, model-a, model-b.
	require.Len(t, result.ByModel, 3)
	assert.Equal(t, []string{"model-c", "model-a", "model-b"}, []string{
		result.ByModel[0].ModelName,
		result.ByModel[1].ModelName,
		result.ByModel[2].ModelName,
	})

	modelA := result.ByModel[1]
	assert.Equal(t, int64(2), modelA.Count)
	assert.Equal(t, int64(100), modelA.PromptTokens)
	assert.Equal(t, int64(300), modelA.CacheTokens)
	assert.Equal(t, int64(50), modelA.CacheCreationTokens)
	assert.Equal(t, int64(15), modelA.CompletionTokens)
	assert.Equal(t, int64(1500), modelA.Quota)
	// 300 / (100 + 300)
	assert.InDelta(t, 0.75, modelA.CacheHitRate, 1e-9)

	modelB := result.ByModel[2]
	assert.Equal(t, int64(1), modelB.Count)
	assert.Equal(t, int64(0), modelB.CacheTokens)
	assert.InDelta(t, 0.0, modelB.CacheHitRate, 1e-9)

	// Per-channel rows mirror the per-model totals for the same channel.
	require.Len(t, result.ByChannel, 2)
	channelOne := result.ByChannel[0]
	assert.Equal(t, 1, channelOne.ChannelId)
	assert.Equal(t, "chan-one", channelOne.ChannelName)
	assert.Equal(t, int64(3), channelOne.Count)
	assert.Equal(t, int64(1099), channelOne.PromptTokens)
	assert.Equal(t, int64(10299), channelOne.CacheTokens)
	assert.Equal(t, int64(50), channelOne.CacheCreationTokens)
	assert.Equal(t, int64(11499), channelOne.Quota)

	channelNine := result.ByChannel[1]
	assert.Equal(t, 9, channelNine.ChannelId)
	assert.Equal(t, "channel-9", channelNine.ChannelName)

	// Totals fold every consumed log in range.
	assert.Equal(t, int64(4), result.Totals.Count)
	assert.Equal(t, int64(1149), result.Totals.PromptTokens)
	assert.Equal(t, int64(10299), result.Totals.CacheTokens)
	assert.Equal(t, int64(50), result.Totals.CacheCreationTokens)
	assert.Equal(t, int64(11699), result.Totals.Quota)
	assert.InDelta(t, 10299.0/float64(1149+10299), result.Totals.CacheHitRate, 1e-9)

	// A bounded range keeps only logs inside it (and still drops non-consume rows).
	ranged, err := SumUsageByModelAndChannel(200, 400, "", 0, "")
	require.NoError(t, err)
	assert.Equal(t, int64(2), ranged.Totals.Count)
	assert.Equal(t, int64(700), ranged.Totals.Quota)

	// Filtering by model narrows both aggregations.
	filtered, err := SumUsageByModelAndChannel(0, 0, "model-b", 0, "")
	require.NoError(t, err)
	require.Len(t, filtered.ByModel, 1)
	assert.Equal(t, int64(200), filtered.Totals.Quota)
	require.Len(t, filtered.ByChannel, 1)
	assert.Equal(t, "channel-9", filtered.ByChannel[0].ChannelName)
}

// A malformed `other` payload must be treated as "no cache" instead of failing
// the whole page.
func TestSumUsageByModelAndChannelToleratesBrokenOther(t *testing.T) {
	db := setupUsageStatTestDB(t)
	insertUsageStatLog(t, db, 100, LogTypeConsume, "model-a", 1, 10, 1, 5, `{"cache_tokens":`)
	insertUsageStatLog(t, db, 200, LogTypeConsume, "model-a", 1, 20, 2, 5, `{"cache_tokens":"not-a-number"}`)

	result, err := SumUsageByModelAndChannel(0, 0, "", 0, "")
	require.NoError(t, err)
	assert.Equal(t, int64(2), result.Totals.Count)
	assert.Equal(t, int64(0), result.Totals.CacheTokens)
	assert.InDelta(t, 0.0, result.Totals.CacheHitRate, 1e-9)
}
