package model

import (
	"context"
	"math"
	"reflect"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func truncateQuotaData(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.Exec("DELETE FROM quota_data").Error)
	t.Cleanup(func() { DB.Exec("DELETE FROM quota_data") })
}

// seedQuotaDataAcrossSegments writes one hourly bucket at each interesting
// position of a 35 day range: the first second, just before the segment
// boundary, exactly on it, just after it, and the last second.
func seedQuotaDataAcrossSegments(t *testing.T, userId int, username string, quotaPerRow int64) (start, boundary, end int64) {
	t.Helper()
	start = analysisCstMidnight + 12*60*60
	boundary = start + common.DashboardMaxSegmentSeconds
	end = start + 35*analysisDay
	// One row on each side of, and exactly on, the segment boundary, plus the
	// inclusive first and last second of the range.
	timestamps := []int64{start, boundary - 3600, boundary, boundary + 1, end}
	for _, createdAt := range timestamps {
		require.NoError(t, DB.Table("quota_data").Create(&QuotaData{
			UserID:    userId,
			Username:  username,
			ModelName: "model-a",
			CreatedAt: createdAt,
			Count:     1,
			Quota:     quotaPerRow,
			TokenUsed: 2,
		}).Error)
	}
	return start, boundary, end
}

func TestGetQuotaDataByUserIdCoversSegmentedRangeExactlyOnce(t *testing.T) {
	truncateQuotaData(t)

	start, _, end := seedQuotaDataAcrossSegments(t, 1, "owner", 100)
	segments, splitErr := common.SplitDashboardRange(start, end)
	require.NoError(t, splitErr)
	require.Len(t, segments, 2)

	// Rows immediately outside the range must not be returned.
	require.NoError(t, DB.Table("quota_data").Create(&QuotaData{
		UserID: 1, Username: "owner", ModelName: "model-a", CreatedAt: start - 1, Count: 1, Quota: 9999,
	}).Error)
	require.NoError(t, DB.Table("quota_data").Create(&QuotaData{
		UserID: 1, Username: "owner", ModelName: "model-a", CreatedAt: end + 1, Count: 1, Quota: 8888,
	}).Error)

	rows, err := GetQuotaDataByUserId(context.Background(), 1, start, end)
	require.NoError(t, err)
	require.Len(t, rows, 5, "every in-range bucket must be returned exactly once")

	seen := make(map[int64]int, len(rows))
	var totalQuota int64
	for _, row := range rows {
		seen[row.CreatedAt]++
		totalQuota += row.Quota
	}
	for createdAt, count := range seen {
		assert.Equal(t, 1, count, "bucket %d must not be duplicated across segments", createdAt)
	}
	assert.EqualValues(t, 500, totalQuota)
}

func TestGetQuotaDataByUserIdSegmentedIsolatesOtherUsers(t *testing.T) {
	truncateQuotaData(t)

	start, _, end := seedQuotaDataAcrossSegments(t, 1, "owner", 100)
	seedQuotaDataAcrossSegments(t, 2, "intruder", 7000)

	rows, err := GetQuotaDataByUserId(context.Background(), 1, start, end)
	require.NoError(t, err)
	for _, row := range rows {
		assert.Equal(t, 1, row.UserID)
		assert.Equal(t, "owner", row.Username)
	}
}

func TestGetAllQuotaDatesSegmentedConservesTotals(t *testing.T) {
	truncateQuotaData(t)

	start, _, end := seedQuotaDataAcrossSegments(t, 1, "owner", 100)
	seedQuotaDataAcrossSegments(t, 2, "second", 300)

	rows, err := GetAllQuotaDates(context.Background(), start, end, "")
	require.NoError(t, err)

	var quota, count, tokens int64
	for _, row := range rows {
		quota += row.Quota
		count += row.Count
		tokens += row.TokenUsed
	}

	var direct struct {
		Quota     int64
		Count     int64
		TokenUsed int64
	}
	require.NoError(t, DB.Table("quota_data").
		Select("coalesce(sum(quota),0) quota, coalesce(sum(count),0) count, coalesce(sum(token_used),0) token_used").
		Where("created_at >= ? and created_at <= ?", start, end).
		Scan(&direct).Error)

	assert.Equal(t, direct.Quota, quota)
	assert.Equal(t, direct.Count, count)
	assert.Equal(t, direct.TokenUsed, tokens)
	assert.EqualValues(t, 2000, quota)
}

func TestGetAllQuotaDatesSegmentedFiltersByUsername(t *testing.T) {
	truncateQuotaData(t)

	start, _, end := seedQuotaDataAcrossSegments(t, 1, "owner", 100)
	seedQuotaDataAcrossSegments(t, 2, "second", 300)

	rows, err := GetAllQuotaDates(context.Background(), start, end, "owner")
	require.NoError(t, err)
	require.Len(t, rows, 5)
	for _, row := range rows {
		assert.Equal(t, "owner", row.Username)
	}
}

func TestGetQuotaDataGroupByUserSegmentedConservesTotals(t *testing.T) {
	truncateQuotaData(t)

	start, _, end := seedQuotaDataAcrossSegments(t, 1, "owner", 100)
	seedQuotaDataAcrossSegments(t, 2, "second", 300)

	rows, err := GetQuotaDataGroupByUser(context.Background(), start, end)
	require.NoError(t, err)

	byUser := map[string]int64{}
	for _, row := range rows {
		byUser[row.Username] += row.Quota
	}
	assert.EqualValues(t, 500, byUser["owner"])
	assert.EqualValues(t, 1500, byUser["second"])
}

func TestQuotaDataQueriesHonorCanceledContext(t *testing.T) {
	truncateQuotaData(t)

	start, _, end := seedQuotaDataAcrossSegments(t, 1, "owner", 100)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := GetQuotaDataByUserId(ctx, 1, start, end)
	require.Error(t, err)
	assert.ErrorIs(t, err, context.Canceled)

	_, err = GetAllQuotaDates(ctx, start, end, "")
	require.Error(t, err)
	assert.ErrorIs(t, err, context.Canceled)

	_, err = GetQuotaDataGroupByUser(ctx, start, end)
	require.Error(t, err)
	assert.ErrorIs(t, err, context.Canceled)
}

func TestQuotaDataQueriesAcceptNilContext(t *testing.T) {
	truncateQuotaData(t)

	start, _, end := seedQuotaDataAcrossSegments(t, 1, "owner", 100)
	rows, err := GetQuotaDataByUserId(nil, 1, start, end)
	require.NoError(t, err)
	assert.Len(t, rows, 5)
}

// The model layer is the last place that can stop an unbounded or malformed
// scan. It must reject on its own, not rely on the HTTP handler having checked.
func TestQuotaDataQueriesRejectUnboundedAndIllegalRangesAtModelLayer(t *testing.T) {
	truncateQuotaData(t)
	start, _, _ := seedQuotaDataAcrossSegments(t, 1, "owner", 100)

	tests := []struct {
		name    string
		start   int64
		end     int64
		wantErr error
	}{
		{name: "both zero", start: 0, end: 0, wantErr: common.ErrDashboardRangeInvalid},
		{name: "missing end", start: start, end: 0, wantErr: common.ErrDashboardRangeInvalid},
		{name: "missing start", start: 0, end: start + analysisDay, wantErr: common.ErrDashboardRangeInvalid},
		{name: "negative start", start: -1, end: start, wantErr: common.ErrDashboardRangeInvalid},
		{name: "inverted", start: start, end: start - 1, wantErr: common.ErrDashboardRangeInverted},
		{name: "over ninety days", start: start, end: start + common.DashboardMaxRangeSeconds + 1, wantErr: common.ErrDashboardRangeTooLarge},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			rows, err := GetQuotaDataByUserId(context.Background(), 1, test.start, test.end)
			require.ErrorIs(t, err, test.wantErr)
			assert.Nil(t, rows)

			rows, err = GetAllQuotaDates(context.Background(), test.start, test.end, "")
			require.ErrorIs(t, err, test.wantErr)
			assert.Nil(t, rows)

			rows, err = GetAllQuotaDates(context.Background(), test.start, test.end, "owner")
			require.ErrorIs(t, err, test.wantErr)
			assert.Nil(t, rows)

			rows, err = GetQuotaDataGroupByUser(context.Background(), test.start, test.end)
			require.ErrorIs(t, err, test.wantErr)
			assert.Nil(t, rows)
		})
	}
}

// Quota, Count and TokenUsed are money/counter columns that are summed across
// the whole range and accumulated in the write cache. They must be int64 so the
// width does not depend on the build platform.
func TestQuotaDataCountersAreInt64AndSurviveLargeAccumulation(t *testing.T) {
	var row QuotaData
	rowType := reflect.TypeOf(row)
	for _, name := range []string{"Quota", "Count", "TokenUsed"} {
		field, ok := rowType.FieldByName(name)
		require.True(t, ok, "QuotaData.%s must exist", name)
		assert.Equal(t, reflect.Int64, field.Type.Kind(), "QuotaData.%s must be int64", name)
	}

	// Accumulating past the 32-bit range must stay exact end to end.
	truncateQuotaData(t)
	const huge int64 = 3_000_000_000 // > math.MaxInt32
	createdAt := analysisCstMidnight
	require.NoError(t, DB.Table("quota_data").Create(&QuotaData{
		UserID: 1, Username: "big", ModelName: "model-a", CreatedAt: createdAt,
		Count: huge, Quota: huge, TokenUsed: huge,
	}).Error)
	require.NoError(t, DB.Table("quota_data").Create(&QuotaData{
		UserID: 1, Username: "big", ModelName: "model-a", CreatedAt: createdAt + 3600,
		Count: huge, Quota: huge, TokenUsed: huge,
	}).Error)

	rows, err := GetAllQuotaDates(context.Background(), createdAt, createdAt+7200, "")
	require.NoError(t, err)
	var quota, count, tokens int64
	for _, r := range rows {
		quota += r.Quota
		count += r.Count
		tokens += r.TokenUsed
	}
	assert.Equal(t, 2*huge, quota)
	assert.Equal(t, 2*huge, count)
	assert.Equal(t, 2*huge, tokens)
	assert.Greater(t, quota, int64(math.MaxInt32))
}

// The in-process write cache accumulates before flushing; that path is int64 too.
func TestLogQuotaDataCacheAccumulatesInt64(t *testing.T) {
	CacheQuotaDataLock.Lock()
	previous := CacheQuotaData
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()
	t.Cleanup(func() {
		CacheQuotaDataLock.Lock()
		CacheQuotaData = previous
		CacheQuotaDataLock.Unlock()
	})

	const huge int64 = 2_500_000_000
	LogQuotaData(1, "big", "model-a", huge, analysisCstMidnight, huge)
	LogQuotaData(1, "big", "model-a", huge, analysisCstMidnight+59, huge)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	require.Len(t, CacheQuotaData, 1, "both writes fall in the same hourly bucket")
	for _, cached := range CacheQuotaData {
		assert.Equal(t, 2*huge, cached.Quota)
		assert.Equal(t, 2*huge, cached.TokenUsed)
		assert.EqualValues(t, 2, cached.Count)
		assert.Greater(t, cached.Quota, int64(math.MaxInt32))
	}
}
