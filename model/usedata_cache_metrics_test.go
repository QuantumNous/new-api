package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCacheCountersSkipRequestsWithoutCacheMetadata(t *testing.T) {
	// An upstream that reports no cache metadata must not enter the hit-rate
	// sample at all: counting it as cache_read=0 would drag the ratio down.
	withoutStats := RecordConsumeLogParams{
		CacheReadTokens:     0,
		InputTokensTotal:    900,
		CacheStatsAvailable: false,
	}
	require.Equal(t, 0, cacheReadTokensForQuotaData(withoutStats))
	require.Equal(t, 0, inputTokensTotalForQuotaData(withoutStats))

	// A genuine cache miss still counts: the upstream reported metadata, and
	// zero cache reads over a real denominator is a real 0% observation.
	withStatsMiss := RecordConsumeLogParams{
		CacheReadTokens:     0,
		InputTokensTotal:    900,
		CacheStatsAvailable: true,
	}
	require.Equal(t, 0, cacheReadTokensForQuotaData(withStatsMiss))
	require.Equal(t, 900, inputTokensTotalForQuotaData(withStatsMiss))

	withStatsHit := RecordConsumeLogParams{
		CacheReadTokens:     800,
		InputTokensTotal:    900,
		CacheStatsAvailable: true,
	}
	require.Equal(t, 800, cacheReadTokensForQuotaData(withStatsHit))
	require.Equal(t, 900, inputTokensTotalForQuotaData(withStatsHit))
}

func TestLogQuotaDataAccumulatesCacheCounters(t *testing.T) {
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	// Same user/model/hour bucket, written twice: the counters must sum rather
	// than overwrite so a window total stays exact across multiple flushes.
	base := QuotaDataLogParams{
		UserID:           7,
		Username:         "cache-user",
		ModelName:        "claude-sonnet",
		Quota:            10,
		CreatedAt:        1_780_000_000,
		TokenUsed:        30,
		CacheReadTokens:  800,
		InputTokensTotal: 1000,
	}
	LogQuotaData(base)

	second := base
	second.CreatedAt += 10 // still the same hour bucket
	second.CacheReadTokens = 100
	second.InputTokensTotal = 200
	LogQuotaData(second)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	require.Len(t, CacheQuotaData, 1)

	for _, cached := range CacheQuotaData {
		require.Equal(t, 2, cached.Count)
		require.Equal(t, 900, cached.CacheReadTokens)
		require.Equal(t, 1200, cached.InputTokensTotal)
	}
}

func TestQuotaDataCacheSumRoundTripsThroughDatabase(t *testing.T) {
	truncateTables(t)

	// The SUM() projections added to the dashboard queries must surface the new
	// columns, otherwise the frontend ratio is computed over zeros.
	require.NoError(t, DB.Create(&QuotaData{
		UserID:           42,
		Username:         "sum-user",
		ModelName:        "claude-opus",
		CreatedAt:        1_780_000_000,
		Count:            3,
		Quota:            99,
		TokenUsed:        300,
		CacheReadTokens:  700,
		InputTokensTotal: 1000,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:           42,
		Username:         "sum-user",
		ModelName:        "claude-opus",
		CreatedAt:        1_780_000_000,
		Count:            1,
		Quota:            11,
		TokenUsed:        100,
		CacheReadTokens:  100,
		InputTokensTotal: 200,
	}).Error)

	rows, err := GetQuotaDataByUserId(42, 1_779_999_999, 1_780_000_100, "", "")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, 800, rows[0].CacheReadTokens)
	require.Equal(t, 1200, rows[0].InputTokensTotal)
}
