package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeTokenStatsTimeRangeDefaultsToRecentDay(t *testing.T) {
	startTime, endTime, err := normalizeTokenStatsTimeRange(0, 0, 1_700_000_000)
	require.NoError(t, err)
	require.Equal(t, int64(1_700_000_000), endTime)
	require.Equal(t, int64(1_700_000_000-tokenStatsDefaultRangeSeconds), startTime)
}

func TestNormalizeTokenStatsTimeRangeFillsMissingBoundary(t *testing.T) {
	startTime, endTime, err := normalizeTokenStatsTimeRange(1_699_999_000, 0, 1_700_000_000)
	require.NoError(t, err)
	require.Equal(t, int64(1_699_999_000), startTime)
	require.Equal(t, int64(1_700_000_000), endTime)

	startTime, endTime, err = normalizeTokenStatsTimeRange(0, 1_700_000_000, 1_700_000_100)
	require.NoError(t, err)
	require.Equal(t, int64(1_700_000_000-tokenStatsMaxRangeSeconds), startTime)
	require.Equal(t, int64(1_700_000_000), endTime)
}

func TestNormalizeTokenStatsTimeRangeCapsRange(t *testing.T) {
	startTime, endTime, err := normalizeTokenStatsTimeRange(1_600_000_000, 1_700_000_000, 1_700_000_000)
	require.NoError(t, err)
	require.Equal(t, int64(1_700_000_000-tokenStatsMaxRangeSeconds), startTime)
	require.Equal(t, int64(1_700_000_000), endTime)
}

func TestNormalizeTokenStatsTimeRangeRejectsInvalidRange(t *testing.T) {
	_, _, err := normalizeTokenStatsTimeRange(1_700_000_001, 1_700_000_000, 1_700_000_000)
	require.Error(t, err)
}
