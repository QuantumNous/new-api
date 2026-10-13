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

func TestRawQuotaFromGroupRatio(t *testing.T) {
	// A caller who never computed a group ratio (task-billing paths that bill
	// a fixed Quota directly) must report unknown, not "no discount applied".
	require.Equal(t, 0, rawQuotaFromGroupRatio(500, 0))
	require.Equal(t, 0, rawQuotaFromGroupRatio(500, -1))

	// Ratio 1.0 (no discount/markup): raw quota equals paid quota.
	require.Equal(t, 100, rawQuotaFromGroupRatio(100, 1))

	// A 0.5 group ratio means the caller paid half price: raw quota is double.
	require.Equal(t, 200, rawQuotaFromGroupRatio(100, 0.5))

	// A markup group (ratio > 1) still derives correctly, rounding to the
	// nearest int rather than truncating.
	require.Equal(t, 80, rawQuotaFromGroupRatio(100, 1.25))
}

func TestLogQuotaDataAccumulatesRawQuota(t *testing.T) {
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	base := QuotaDataLogParams{
		UserID:     8,
		Username:   "discount-user",
		ModelName:  "claude-sonnet",
		Quota:      50,
		CreatedAt:  1_780_000_000,
		GroupRatio: 0.5, // paid half price: raw quota should be 100
	}
	LogQuotaData(base)

	second := base
	second.CreatedAt += 10 // still the same hour bucket
	second.Quota = 30
	second.GroupRatio = 1 // no discount this time: raw quota should be 30
	LogQuotaData(second)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	require.Len(t, CacheQuotaData, 1)

	for _, cached := range CacheQuotaData {
		require.Equal(t, 2, cached.Count)
		require.Equal(t, 80, cached.Quota)
		require.Equal(t, 130, cached.RawQuota)
	}
}

func TestRawQuotaUnknownWhenGroupRatioMissing(t *testing.T) {
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	// A billing path that never records a group ratio (e.g. a fixed-price task
	// log) must leave RawQuota at 0 — "unknown", not "free" or "no discount".
	LogQuotaData(QuotaDataLogParams{
		UserID:    9,
		Username:  "no-ratio-user",
		ModelName: "mj-fast",
		Quota:     40,
		CreatedAt: 1_780_000_000,
	})

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	require.Len(t, CacheQuotaData, 1)
	for _, cached := range CacheQuotaData {
		require.Equal(t, 40, cached.Quota)
		require.Equal(t, 0, cached.RawQuota)
	}
}

func TestLogQuotaDataAccumulatesChargeUSDMicros(t *testing.T) {
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	base := QuotaDataLogParams{
		UserID:          10,
		Username:        "usd-user",
		ModelName:       "claude-sonnet",
		Quota:           6310,
		CreatedAt:       1_780_000_000,
		ChargeUSDMicros: 1875, // $0.001875, matching the billing path's own snapshot
	}
	LogQuotaData(base)

	second := base
	second.CreatedAt += 10 // still the same hour bucket
	second.Quota = 3000
	second.ChargeUSDMicros = 900
	LogQuotaData(second)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	require.Len(t, CacheQuotaData, 1)
	for _, cached := range CacheQuotaData {
		require.Equal(t, 2, cached.Count)
		require.Equal(t, int64(2775), cached.ChargeUSDMicros)
	}
}

