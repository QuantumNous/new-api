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

// The two upstream families store prompt_tokens differently, and getting this
// wrong halves (or doubles) the reported cache hit rate:
//   - OpenAI style (DeepSeek included): prompt_tokens already contains the
//     cache hits, so it *is* the total input;
//   - Claude style: prompt_tokens is only the miss, hits live in cache_tokens.
func TestSumUsageByModelAndChannelTokenSemantics(t *testing.T) {
	db := setupUsageStatTestDB(t)
	require.NoError(t, db.Exec(`INSERT INTO channels (id, name) VALUES (1, 'chan-one')`).Error)

	// OpenAI style: prompt 1000 already includes the 300 cached tokens.
	insertUsageStatLog(t, db, 100, LogTypeConsume, "openai-model", 1, 1000, 10, 1000, `{"cache_tokens":300}`)
	// OpenAI style with a split cache write; split larger than the total column.
	insertUsageStatLog(t, db, 250, LogTypeConsume, "openai-model", 1, 200, 5, 500,
		`{"cache_tokens":100,"cache_creation_tokens":50,"cache_creation_tokens_5m":20,"cache_creation_tokens_1h":25}`)
	// Claude style: prompt is only the miss, hits and writes are separate.
	insertUsageStatLog(t, db, 300, LogTypeConsume, "claude-model", 9, 50, 0, 200,
		`{"usage_semantic":"anthropic","cache_tokens":500,"cache_creation_tokens":20}`)
	// Legacy rows only carry the claude boolean instead of usage_semantic.
	insertUsageStatLog(t, db, 320, LogTypeConsume, "claude-legacy", 9, 100, 1, 100,
		`{"claude":true,"cache_tokens":900}`)
	// Non-consume logs must be ignored even though they carry cache tokens.
	insertUsageStatLog(t, db, 350, LogTypeTopup, "openai-model", 1, 999, 999, 9999, `{"cache_tokens":9999}`)

	result, err := SumUsageByModelAndChannel(0, 0, "", 0, "")
	require.NoError(t, err)

	byModel := map[string]UsageStatItem{}
	for _, item := range result.ByModel {
		byModel[item.ModelName] = item
	}

	openai := byModel["openai-model"]
	assert.Equal(t, int64(2), openai.Count)
	// prompt is already the total input for this family.
	assert.Equal(t, int64(1200), openai.InputTokens)
	assert.Equal(t, int64(800), openai.MissTokens)
	assert.Equal(t, int64(400), openai.CacheTokens)
	assert.Equal(t, int64(50), openai.CacheCreationTokens)
	assert.InDelta(t, 400.0/1200.0, openai.CacheHitRate, 1e-9)

	claude := byModel["claude-model"]
	assert.Equal(t, int64(50), claude.PromptTokens)
	// 50 miss + 500 hits + 20 writes
	assert.Equal(t, int64(570), claude.InputTokens)
	// Uncached input is everything the cache did not serve: miss + writes.
	assert.Equal(t, int64(70), claude.MissTokens)
	assert.InDelta(t, 500.0/570.0, claude.CacheHitRate, 1e-9)

	legacy := byModel["claude-legacy"]
	assert.Equal(t, int64(1000), legacy.InputTokens)
	assert.Equal(t, int64(100), legacy.MissTokens)
	assert.InDelta(t, 0.9, legacy.CacheHitRate, 1e-9)

	// Totals fold every consumed log in range.
	assert.Equal(t, int64(4), result.Totals.Count)
	assert.Equal(t, int64(2770), result.Totals.InputTokens)
	assert.Equal(t, int64(970), result.Totals.MissTokens)
	assert.InDelta(t, 1800.0/2770.0, result.Totals.CacheHitRate, 1e-9)

	// Per-channel rows mirror the per-model totals for the same channel.
	byChannel := map[int]UsageStatItem{}
	for _, item := range result.ByChannel {
		byChannel[item.ChannelId] = item
	}
	assert.Equal(t, "chan-one", byChannel[1].ChannelName)
	assert.Equal(t, int64(1200), byChannel[1].InputTokens)
	// Channel 9 has no channels row (deleted) and both Claude semantics rows.
	assert.Equal(t, "channel-9", byChannel[9].ChannelName)
	assert.Equal(t, int64(1570), byChannel[9].InputTokens)

	// A bounded range keeps only logs inside it.
	ranged, err := SumUsageByModelAndChannel(200, 400, "", 0, "")
	require.NoError(t, err)
	assert.Equal(t, int64(3), ranged.Totals.Count)
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
	// Without a semantic flag the row is OpenAI style: input == prompt.
	assert.Equal(t, int64(30), result.Totals.InputTokens)
	assert.InDelta(t, 0.0, result.Totals.CacheHitRate, 1e-9)
}
