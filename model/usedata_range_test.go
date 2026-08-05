package model

import (
	"context"
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
func seedQuotaDataAcrossSegments(t *testing.T, userId int, username string, quotaPerRow int) (start, boundary, end int64) {
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
	require.Len(t, common.SplitDashboardRange(start, end), 2)

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
	var totalQuota int
	for _, row := range rows {
		seen[row.CreatedAt]++
		totalQuota += row.Quota
	}
	for createdAt, count := range seen {
		assert.Equal(t, 1, count, "bucket %d must not be duplicated across segments", createdAt)
	}
	assert.Equal(t, 500, totalQuota)
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

	var quota, count, tokens int
	for _, row := range rows {
		quota += row.Quota
		count += row.Count
		tokens += row.TokenUsed
	}

	var direct struct {
		Quota     int
		Count     int
		TokenUsed int
	}
	require.NoError(t, DB.Table("quota_data").
		Select("coalesce(sum(quota),0) quota, coalesce(sum(count),0) count, coalesce(sum(token_used),0) token_used").
		Where("created_at >= ? and created_at <= ?", start, end).
		Scan(&direct).Error)

	assert.Equal(t, direct.Quota, quota)
	assert.Equal(t, direct.Count, count)
	assert.Equal(t, direct.TokenUsed, tokens)
	assert.Equal(t, 2000, quota)
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

	byUser := map[string]int{}
	for _, row := range rows {
		byUser[row.Username] += row.Quota
	}
	assert.Equal(t, 500, byUser["owner"])
	assert.Equal(t, 1500, byUser["second"])
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
