package model

import (
	"context"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	// 2024-01-01 00:00:00 Asia/Shanghai.
	analysisCstMidnight int64 = 1704038400
	analysisDay         int64 = 24 * 60 * 60
)

// analysisStraddlingRange starts at 12:00 CST so the first segment boundary
// lands in the middle of a CST day. A day bucket therefore straddles two
// segments, which is the case a naive concatenation would double-report.
func analysisStraddlingRange() (start int64, segmentBoundary int64, end int64) {
	start = analysisCstMidnight + 12*60*60
	segmentBoundary = start + common.DashboardMaxSegmentSeconds
	end = start + 35*analysisDay
	return start, segmentBoundary, end
}

func TestGetLogUsageAnalysisMergesCSTBucketAcrossSegmentBoundary(t *testing.T) {
	truncateTables(t)
	initCol()

	start, boundary, end := analysisStraddlingRange()
	segments, splitErr := common.SplitDashboardRange(start, end)
	require.NoError(t, splitErr)
	require.Len(t, segments, 2, "the 35 day range must be segmented")
	require.Equal(t, boundary, segments[0].End)

	logs := []Log{
		// Both rows fall inside the same CST day bucket but on opposite sides of
		// the segment boundary.
		{UserId: 1, CreatedAt: boundary, Type: LogTypeConsume, ModelName: "straddle", Quota: 100, PromptTokens: 1, CompletionTokens: 2},
		{UserId: 1, CreatedAt: boundary + 1, Type: LogTypeConsume, ModelName: "straddle", Quota: 200, PromptTokens: 3, CompletionTokens: 4},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	rows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1, StartTimestamp: start, EndTimestamp: end},
		Granularity:           "day",
		Dimensions:            []string{"period", "model_name"},
	})
	require.NoError(t, err)
	require.Len(t, rows, 1, "a straddling CST day bucket must be merged into one row")

	// 2024-02-01 00:00:00 Asia/Shanghai is the bucket containing both rows.
	assert.Equal(t, analysisCstMidnight+31*analysisDay, rows[0].Period)
	assert.EqualValues(t, 2, rows[0].RequestCount)
	assert.EqualValues(t, 300, rows[0].Quota)
	assert.EqualValues(t, 4, rows[0].PromptTokens)
	assert.EqualValues(t, 6, rows[0].CompletionTokens)
}

func TestGetLogUsageAnalysisConservesTotalsOverSegmentedRange(t *testing.T) {
	truncateTables(t)
	initCol()

	start, boundary, end := analysisStraddlingRange()
	logs := []Log{
		{UserId: 1, CreatedAt: start, Type: LogTypeConsume, ModelName: "model-a", Quota: 11, PromptTokens: 1, CompletionTokens: 1},
		{UserId: 1, CreatedAt: start + analysisDay, Type: LogTypeConsume, ModelName: "model-b", Quota: 22, PromptTokens: 2, CompletionTokens: 2},
		{UserId: 1, CreatedAt: boundary - 1, Type: LogTypeConsume, ModelName: "model-a", Quota: 33, PromptTokens: 3, CompletionTokens: 3},
		{UserId: 1, CreatedAt: boundary, Type: LogTypeConsume, ModelName: "model-a", Quota: 44, PromptTokens: 4, CompletionTokens: 4},
		{UserId: 1, CreatedAt: boundary + 1, Type: LogTypeConsume, ModelName: "model-a", Quota: 55, PromptTokens: 5, CompletionTokens: 5},
		{UserId: 1, CreatedAt: end, Type: LogTypeConsume, ModelName: "model-c", Quota: 66, PromptTokens: 6, CompletionTokens: 6},
		// Excluded: outside the range on both sides, and a non-consume record.
		{UserId: 1, CreatedAt: start - 1, Type: LogTypeConsume, ModelName: "model-a", Quota: 7770},
		{UserId: 1, CreatedAt: end + 1, Type: LogTypeConsume, ModelName: "model-a", Quota: 8880},
		{UserId: 1, CreatedAt: boundary, Type: LogTypeError, ModelName: "model-a", Quota: 9990},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	for _, granularity := range []string{"hour", "day"} {
		t.Run(granularity, func(t *testing.T) {
			rows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
				LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1, StartTimestamp: start, EndTimestamp: end},
				Granularity:           granularity,
				Dimensions:            []string{"period", "model_name"},
			})
			require.NoError(t, err)

			var direct struct {
				RequestCount     int64
				PromptTokens     int64
				CompletionTokens int64
				Quota            int64
			}
			require.NoError(t, LOG_DB.Table("logs").Select(
				"count(*) request_count, coalesce(sum(prompt_tokens), 0) prompt_tokens, "+
					"coalesce(sum(completion_tokens), 0) completion_tokens, coalesce(sum(quota), 0) quota",
			).Where("user_id = ? AND type = ? AND created_at >= ? AND created_at <= ?", 1, LogTypeConsume, start, end).Scan(&direct).Error)

			var got struct {
				RequestCount     int64
				PromptTokens     int64
				CompletionTokens int64
				Quota            int64
			}
			for _, row := range rows {
				got.RequestCount += row.RequestCount
				got.PromptTokens += row.PromptTokens
				got.CompletionTokens += row.CompletionTokens
				got.Quota += row.Quota
			}
			assert.Equal(t, direct, got, "segmented aggregation must conserve the log totals exactly")
			assert.EqualValues(t, 6, got.RequestCount)
			assert.EqualValues(t, 231, got.Quota)

			// Every emitted key must be unique; a duplicate means a segment result
			// leaked through without being merged.
			seen := make(map[logUsageAnalysisKey]struct{}, len(rows))
			for _, row := range rows {
				key := logUsageAnalysisRowKey(row)
				_, duplicate := seen[key]
				require.False(t, duplicate, "duplicate merge key %+v", key)
				seen[key] = struct{}{}
			}
		})
	}
}

func TestGetLogUsageAnalysisSegmentedRowsStayOrderedByPeriod(t *testing.T) {
	truncateTables(t)
	initCol()

	start, boundary, end := analysisStraddlingRange()
	logs := []Log{
		{UserId: 1, CreatedAt: end, Type: LogTypeConsume, ModelName: "late", Quota: 1},
		{UserId: 1, CreatedAt: boundary + 1, Type: LogTypeConsume, ModelName: "mid", Quota: 2},
		{UserId: 1, CreatedAt: start, Type: LogTypeConsume, ModelName: "early", Quota: 3},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	rows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1, StartTimestamp: start, EndTimestamp: end},
		Granularity:           "hour",
		Dimensions:            []string{"period", "model_name"},
	})
	require.NoError(t, err)
	require.Len(t, rows, 3)
	for i := 1; i < len(rows); i++ {
		assert.Less(t, rows[i-1].Period, rows[i].Period, "merged rows must stay ordered by period")
	}
	assert.Equal(t, "early", rows[0].ModelName)
	assert.Equal(t, "mid", rows[1].ModelName)
	assert.Equal(t, "late", rows[2].ModelName)
}

func TestGetLogUsageAnalysisSegmentedHourBucketsAreCSTAligned(t *testing.T) {
	truncateTables(t)
	initCol()

	start, boundary, end := analysisStraddlingRange()
	logs := []Log{
		{UserId: 1, CreatedAt: start, Type: LogTypeConsume, ModelName: "bucket", Quota: 1},
		{UserId: 1, CreatedAt: start + 1799, Type: LogTypeConsume, ModelName: "bucket", Quota: 1},
		{UserId: 1, CreatedAt: boundary, Type: LogTypeConsume, ModelName: "bucket", Quota: 1},
		{UserId: 1, CreatedAt: boundary + 1, Type: LogTypeConsume, ModelName: "bucket", Quota: 1},
		{UserId: 1, CreatedAt: end, Type: LogTypeConsume, ModelName: "bucket", Quota: 1},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	rows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1, StartTimestamp: start, EndTimestamp: end},
		Granularity:           "hour",
		Dimensions:            []string{"period", "model_name"},
	})
	require.NoError(t, err)

	// start, boundary and end are all whole CST hours here, so the first two
	// rows share one bucket and boundary/boundary+1 share another.
	require.Len(t, rows, 3)
	for _, row := range rows {
		assert.Zero(t, (row.Period+8*60*60)%3600, "hour buckets must align to whole Asia/Shanghai hours")
	}
	assert.EqualValues(t, 2, rows[0].RequestCount)
	assert.EqualValues(t, 2, rows[1].RequestCount)
	assert.EqualValues(t, 1, rows[2].RequestCount)

	// An hourly query over the maximum span cannot exceed the bucket cap.
	assert.LessOrEqual(t, int(common.DashboardMaxRangeSeconds/3600)+1, maxLogUsageAnalysisPeriodBuckets)
}

func TestGetLogUsageAnalysisSegmentedIsolatesOtherUsers(t *testing.T) {
	truncateTables(t)
	initCol()

	start, boundary, end := analysisStraddlingRange()
	logs := []Log{
		{UserId: 1, Username: "owner", CreatedAt: start, Type: LogTypeConsume, ModelName: "shared", Quota: 10},
		{UserId: 1, Username: "owner", CreatedAt: boundary + 1, Type: LogTypeConsume, ModelName: "shared", Quota: 20},
		{UserId: 2, Username: "intruder", CreatedAt: start, Type: LogTypeConsume, ModelName: "shared", Quota: 5000},
		{UserId: 2, Username: "intruder", CreatedAt: boundary + 1, Type: LogTypeConsume, ModelName: "shared", Quota: 6000},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	rows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1, StartTimestamp: start, EndTimestamp: end},
		Granularity:           "day",
		Dimensions:            []string{"period", "model_name"},
	})
	require.NoError(t, err)

	var total int64
	for _, row := range rows {
		total += row.Quota
	}
	assert.EqualValues(t, 30, total, "a segmented self query must never include another user's rows")
}

func TestGetLogUsageAnalysisSegmentedEnforcesMergedRowCap(t *testing.T) {
	truncateTables(t)
	initCol()

	start, boundary, end := analysisStraddlingRange()
	// Distinct model names per side of the boundary, so the merged projection is
	// the sum of both segments rather than either segment alone.
	const perSegment = maxLogUsageAnalysisRows / 2
	logs := make([]Log, 0, 2*perSegment+2)
	for i := 0; i < perSegment; i++ {
		logs = append(logs,
			Log{UserId: 1, CreatedAt: start, Type: LogTypeConsume, ModelName: fmt.Sprintf("left-%05d", i), Quota: 1},
			Log{UserId: 1, CreatedAt: boundary + 1, Type: LogTypeConsume, ModelName: fmt.Sprintf("right-%05d", i), Quota: 1},
		)
	}
	require.NoError(t, LOG_DB.CreateInBatches(&logs, 250).Error)

	filter := LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1, StartTimestamp: start, EndTimestamp: end},
		Granularity:           "day",
		Dimensions:            []string{"period", "model_name"},
	}
	rows, err := GetLogUsageAnalysis(filter)
	require.NoError(t, err)
	assert.Len(t, rows, maxLogUsageAnalysisRows, "the merged cap boundary must still succeed")

	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: 1, CreatedAt: start, Type: LogTypeConsume, ModelName: "left-overflow", Quota: 1},
		{UserId: 1, CreatedAt: boundary + 1, Type: LogTypeConsume, ModelName: "right-overflow", Quota: 1},
	}).Error)
	_, err = GetLogUsageAnalysis(filter)
	require.ErrorIs(t, err, ErrLogUsageAnalysisTooManyRows)
	assert.Contains(t, err.Error(), "超过 5000")
}

func TestGetLogUsageAnalysisSegmentedHonorsCanceledContext(t *testing.T) {
	truncateTables(t)
	initCol()

	start, _, end := analysisStraddlingRange()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1, StartTimestamp: start, EndTimestamp: end},
		Granularity:           "hour",
		Dimensions:            []string{"period", "model_name"},
		Context:               ctx,
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, context.Canceled)
}
