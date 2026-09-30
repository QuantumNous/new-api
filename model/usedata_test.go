package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestLogQuotaDataMergesCacheColumns verifies that per-request quota-data
// writes sharing the same hourly aggregation key accumulate the token and
// cache columns in the in-memory cache that SaveQuotaDataCache later flushes.
func TestLogQuotaDataMergesCacheColumns(t *testing.T) {
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	createdAt := int64(1767225600) // full hour
	base := QuotaDataLogParams{
		UserID:              7,
		Username:            "alice",
		ModelName:           "gpt-test",
		Quota:               10,
		CreatedAt:           createdAt,
		TokenUsed:           100,
		UseGroup:            "default",
		TokenID:             1,
		ChannelID:           2,
		NodeName:            "node-1",
		PromptTokens:        80,
		CacheTokens:         60,
		CacheCreationTokens: 5,
	}
	LogQuotaData(base)

	second := base
	second.Quota = 20
	second.TokenUsed = 50
	second.PromptTokens = 40
	second.CacheTokens = 30
	second.CacheCreationTokens = 0
	// 3599 seconds later still lands in the same hourly bucket.
	second.CreatedAt = createdAt + 3599
	LogQuotaData(second)

	// A request with no cache read is a miss: it still bumps Count and the
	// token columns but must not bump the cache hit count.
	miss := base
	miss.Quota = 5
	miss.TokenUsed = 20
	miss.PromptTokens = 10
	miss.CacheTokens = 0
	miss.CacheCreationTokens = 0
	miss.CreatedAt = createdAt + 1800
	LogQuotaData(miss)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	require.Len(t, CacheQuotaData, 1)

	var merged *QuotaData
	for _, entry := range CacheQuotaData {
		merged = entry
	}
	require.NotNil(t, merged)
	assert.Equal(t, 3, merged.Count)
	assert.Equal(t, 35, merged.Quota)
	assert.Equal(t, 170, merged.TokenUsed)
	assert.Equal(t, 130, merged.PromptTokens)
	assert.Equal(t, 90, merged.CacheTokens)
	assert.Equal(t, 5, merged.CacheCreationTokens)
	assert.Equal(t, 2, merged.CacheHitCount, "only requests that read cached input tokens count as cache hits")
}

// TestLogQuotaDataSeparatesDistinctHours verifies cache columns do not bleed
// across different hourly buckets.
func TestLogQuotaDataSeparatesDistinctHours(t *testing.T) {
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	LogQuotaData(QuotaDataLogParams{
		UserID:              7,
		Username:            "alice",
		ModelName:           "gpt-test",
		Quota:               1,
		CreatedAt:           1767225600,
		TokenUsed:           10,
		PromptTokens:        10,
		CacheTokens:         4,
		CacheCreationTokens: 2,
	})
	LogQuotaData(QuotaDataLogParams{
		UserID:              7,
		Username:            "alice",
		ModelName:           "gpt-test",
		Quota:               2,
		CreatedAt:           1767225600 + 3600,
		TokenUsed:           20,
		PromptTokens:        20,
		CacheTokens:         8,
		CacheCreationTokens: 6,
	})

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	require.Len(t, CacheQuotaData, 2)

	totalCache, totalCreation := 0, 0
	for _, entry := range CacheQuotaData {
		totalCache += entry.CacheTokens
		totalCreation += entry.CacheCreationTokens
	}
	assert.Equal(t, 12, totalCache)
	assert.Equal(t, 8, totalCreation)
}

// TestGetQuotaDataGroupByChannelFiltersByUsername verifies the channel
// aggregation honors the dashboard's username filter: an empty username
// aggregates every user's rows, while a specific username only aggregates
// that user's rows within the same channel and hour bucket.
func TestGetQuotaDataGroupByChannelFiltersByUsername(t *testing.T) {
	channelID := 977201
	// A full hour far from other tests' buckets, so the assertions below
	// only ever observe rows this test creates.
	createdAt := int64(1893456000)
	seed := []QuotaData{
		{UserID: 7, Username: "alice", ModelName: "gpt-test", CreatedAt: createdAt, ChannelID: channelID, Count: 1, Quota: 10, TokenUsed: 100, PromptTokens: 80, CacheTokens: 60, CacheCreationTokens: 5},
		{UserID: 8, Username: "bob", ModelName: "gpt-test", CreatedAt: createdAt, ChannelID: channelID, Count: 1, Quota: 20, TokenUsed: 50, PromptTokens: 40, CacheTokens: 30, CacheCreationTokens: 0},
	}
	for i := range seed {
		require.NoError(t, DB.Create(&seed[i]).Error)
	}
	// Remove exactly this test's rows so repeated runs (go test -count=2)
	// never observe leftovers from a previous run's assertions.
	t.Cleanup(func() {
		DB.Where("channel_id = ? AND created_at = ?", channelID, createdAt).Delete(&QuotaData{})
	})

	findRow := func(rows []*ChannelQuotaData) *ChannelQuotaData {
		for _, row := range rows {
			if row.ChannelID == channelID {
				return row
			}
		}
		return nil
	}

	allRows, err := GetQuotaDataGroupByChannel(createdAt-1, createdAt+1, "")
	require.NoError(t, err)
	all := findRow(allRows)
	require.NotNil(t, all, "an empty username must aggregate every user's rows")
	assert.Equal(t, 2, all.Count)
	assert.Equal(t, 120, all.PromptTokens)
	assert.Equal(t, 90, all.CacheTokens)

	aliceRows, err := GetQuotaDataGroupByChannel(createdAt-1, createdAt+1, "alice")
	require.NoError(t, err)
	alice := findRow(aliceRows)
	require.NotNil(t, alice, "the filtered aggregation must return the matching user's rows")
	assert.Equal(t, 1, alice.Count)
	assert.Equal(t, 80, alice.PromptTokens)
	assert.Equal(t, 60, alice.CacheTokens)
}

// TestGetQuotaDataGroupByUserAggregatesCacheColumns verifies the user
// aggregation carries the cache columns (the cache rate chart's user
// dimension) and honors the dashboard's username filter.
func TestGetQuotaDataGroupByUserAggregatesCacheColumns(t *testing.T) {
	// A full hour far from other tests' buckets.
	createdAt := int64(1893691200)
	seed := []QuotaData{
		{UserID: 7, Username: "alice", ModelName: "gpt-test", CreatedAt: createdAt, Count: 1, Quota: 10, TokenUsed: 100, PromptTokens: 80, CacheTokens: 60, CacheCreationTokens: 5, CacheHitCount: 1},
		{UserID: 8, Username: "bob", ModelName: "gpt-test", CreatedAt: createdAt, Count: 2, Quota: 20, TokenUsed: 50, PromptTokens: 40, CacheTokens: 30, CacheCreationTokens: 0, CacheHitCount: 0},
	}
	for i := range seed {
		require.NoError(t, DB.Create(&seed[i]).Error)
	}
	t.Cleanup(func() {
		DB.Where("created_at = ?", createdAt).Delete(&QuotaData{})
	})

	findRow := func(rows []*QuotaData, username string) *QuotaData {
		for _, row := range rows {
			if row.Username == username {
				return row
			}
		}
		return nil
	}

	allRows, err := GetQuotaDataGroupByUser(createdAt-1, createdAt+1, "")
	require.NoError(t, err)
	alice := findRow(allRows, "alice")
	require.NotNil(t, alice)
	assert.Equal(t, 1, alice.Count)
	assert.Equal(t, 80, alice.PromptTokens)
	assert.Equal(t, 60, alice.CacheTokens)
	assert.Equal(t, 5, alice.CacheCreationTokens)
	assert.Equal(t, 1, alice.CacheHitCount)
	bob := findRow(allRows, "bob")
	require.NotNil(t, bob)
	assert.Equal(t, 40, bob.PromptTokens)
	assert.Equal(t, 30, bob.CacheTokens)
	assert.Zero(t, bob.CacheCreationTokens)

	filtered, err := GetQuotaDataGroupByUser(createdAt-1, createdAt+1, "alice")
	require.NoError(t, err)
	require.NotNil(t, findRow(filtered, "alice"))
	assert.Nil(t, findRow(filtered, "bob"), "the username filter must drop other users' rows")
}

// TestGetQuotaDataGroupByGroupAggregatesByUseGroup verifies the group
// aggregation for the cache rate chart's group dimension: rows from different
// users and models in the same group and hour are summed, and the username /
// userId filters scope the aggregation (admin filter vs. regular-user self).
func TestGetQuotaDataGroupByGroupAggregatesByUseGroup(t *testing.T) {
	// A full hour far from other tests' buckets.
	createdAt := int64(1893753600)
	seed := []QuotaData{
		{UserID: 7, Username: "alice", ModelName: "gpt-test", CreatedAt: createdAt, UseGroup: "vip", Count: 1, Quota: 10, TokenUsed: 100, PromptTokens: 80, CacheTokens: 60, CacheCreationTokens: 5, CacheHitCount: 1},
		{UserID: 8, Username: "bob", ModelName: "claude-test", CreatedAt: createdAt, UseGroup: "vip", Count: 2, Quota: 20, TokenUsed: 50, PromptTokens: 40, CacheTokens: 30, CacheCreationTokens: 4, CacheHitCount: 1},
		{UserID: 7, Username: "alice", ModelName: "gpt-test", CreatedAt: createdAt, UseGroup: "default", Count: 3, Quota: 30, TokenUsed: 60, PromptTokens: 60, CacheTokens: 10, CacheCreationTokens: 0, CacheHitCount: 0},
	}
	for i := range seed {
		require.NoError(t, DB.Create(&seed[i]).Error)
	}
	t.Cleanup(func() {
		DB.Where("created_at = ?", createdAt).Delete(&QuotaData{})
	})

	findRow := func(rows []*QuotaData, useGroup string) *QuotaData {
		for _, row := range rows {
			if row.UseGroup == useGroup {
				return row
			}
		}
		return nil
	}

	allRows, err := GetQuotaDataGroupByGroup(createdAt-1, createdAt+1, "", 0)
	require.NoError(t, err)
	vip := findRow(allRows, "vip")
	require.NotNil(t, vip, "rows from different users and models in one group must aggregate into a single bucket")
	assert.Equal(t, 3, vip.Count)
	assert.Equal(t, 120, vip.PromptTokens)
	assert.Equal(t, 90, vip.CacheTokens)
	assert.Equal(t, 9, vip.CacheCreationTokens)
	assert.Equal(t, 2, vip.CacheHitCount)
	def := findRow(allRows, "default")
	require.NotNil(t, def)
	assert.Equal(t, 3, def.Count)

	// Admin's username filter only aggregates that user's rows.
	aliceRows, err := GetQuotaDataGroupByGroup(createdAt-1, createdAt+1, "alice", 0)
	require.NoError(t, err)
	aliceVip := findRow(aliceRows, "vip")
	require.NotNil(t, aliceVip)
	assert.Equal(t, 1, aliceVip.Count)
	assert.Equal(t, 80, aliceVip.PromptTokens)
	require.NotNil(t, findRow(aliceRows, "default"))

	// Regular-user self scope only aggregates that user's own rows.
	selfRows, err := GetQuotaDataGroupByGroup(createdAt-1, createdAt+1, "", 8)
	require.NoError(t, err)
	require.Len(t, selfRows, 1, "bob only has rows in the vip group")
	assert.Equal(t, "vip", selfRows[0].UseGroup)
	assert.Equal(t, 2, selfRows[0].Count)
}

// TestGetQuotaDataCacheTimeseriesByModelAggregatesBuckets verifies the
// model-square cache trend endpoint's aggregation: hourly buckets are scoped
// to the requested model and time window, same-bucket rows are summed, and
// other models' rows never leak in.
func TestGetQuotaDataCacheTimeseriesByModelAggregatesBuckets(t *testing.T) {
	// Full hours far from other tests' buckets.
	hourA := int64(1893528000)
	hourB := hourA + 3600
	modelName := "cache-stats-model"
	seed := []QuotaData{
		{UserID: 7, Username: "alice", ModelName: modelName, CreatedAt: hourA, Count: 2, Quota: 10, TokenUsed: 100, PromptTokens: 80, CacheTokens: 60, CacheCreationTokens: 5, CacheHitCount: 1},
		{UserID: 8, Username: "bob", ModelName: modelName, CreatedAt: hourB, Count: 3, Quota: 20, TokenUsed: 50, PromptTokens: 40, CacheTokens: 0, CacheCreationTokens: 4, CacheHitCount: 0},
		// Same model and hour as another seed row: must be summed into one bucket.
		{UserID: 10, Username: "dave", ModelName: modelName, CreatedAt: hourB, Count: 4, Quota: 30, TokenUsed: 60, PromptTokens: 60, CacheTokens: 10, CacheCreationTokens: 6, CacheHitCount: 2},
		// Another model in the same window must not be aggregated.
		{UserID: 9, Username: "carol", ModelName: "other-model", CreatedAt: hourA, Count: 5, Quota: 99, TokenUsed: 999, PromptTokens: 500, CacheTokens: 400, CacheCreationTokens: 50, CacheHitCount: 5},
	}
	for i := range seed {
		require.NoError(t, DB.Create(&seed[i]).Error)
	}
	t.Cleanup(func() {
		DB.Where("created_at IN ?", []int64{hourA, hourB}).Delete(&QuotaData{})
	})

	rows, err := GetQuotaDataCacheTimeseriesByModel(modelName, hourA-1, hourB+1)
	require.NoError(t, err)
	require.Len(t, rows, 2, "one row per hourly bucket, ordered by time")
	assert.Equal(t, hourA, rows[0].CreatedAt)
	assert.Equal(t, 2, rows[0].Count)
	assert.Equal(t, 80, rows[0].PromptTokens)
	assert.Equal(t, 60, rows[0].CacheTokens)
	assert.Equal(t, hourB, rows[1].CreatedAt)
	assert.Equal(t, 7, rows[1].Count, "same-bucket rows must be summed")
	assert.Equal(t, 100, rows[1].PromptTokens)
	assert.Equal(t, 10, rows[1].CacheTokens)
	assert.Equal(t, 10, rows[1].CacheCreationTokens)
	assert.Equal(t, 2, rows[1].CacheHitCount)

	// A window excluding the second hour drops that hour's bucket entirely.
	partial, err := GetQuotaDataCacheTimeseriesByModel(modelName, hourA-1, hourA)
	require.NoError(t, err)
	require.Len(t, partial, 1)
	assert.Equal(t, hourA, partial[0].CreatedAt)
	assert.Equal(t, 2, partial[0].Count)

	// A model with no usage in the window yields an empty series, not an error.
	empty, err := GetQuotaDataCacheTimeseriesByModel("no-such-model", hourA-1, hourB+1)
	require.NoError(t, err)
	assert.Empty(t, empty)
}
