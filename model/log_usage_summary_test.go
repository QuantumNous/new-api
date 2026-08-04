package model

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetLogUsageSummaryFiltersAndGroupsConsumption(t *testing.T) {
	truncateTables(t)
	initCol()

	logs := []Log{
		{UserId: 1, Username: "wanxin1", CreatedAt: 100, Type: LogTypeConsume, ModelName: "gpt-image-2", TokenName: "image-token", Quota: 500000, PromptTokens: 10, CompletionTokens: 20, ChannelId: 44, Group: "image&2", RequestId: "req-1"},
		{UserId: 1, Username: "wanxin1", CreatedAt: 110, Type: LogTypeConsume, ModelName: "gpt-image-2", TokenName: "image-token", Quota: 250000, PromptTokens: 5, CompletionTokens: 8, ChannelId: 44, Group: "image&2", RequestId: "req-2"},
		{UserId: 1, Username: "wanxin1", CreatedAt: 120, Type: LogTypeConsume, ModelName: "gemini-image", TokenName: "image-token", Quota: 100000, ChannelId: 35, Group: "image&2", RequestId: "req-3"},
		{UserId: 1, Username: "wanxin1", CreatedAt: 130, Type: LogTypeError, ModelName: "gpt-image-2", TokenName: "image-token", Quota: 999999, ChannelId: 44, Group: "image&2"},
		{UserId: 2, Username: "other-user", CreatedAt: 110, Type: LogTypeConsume, ModelName: "gpt-image-2", TokenName: "image-token", Quota: 900000, ChannelId: 44, Group: "image&2"},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	summary, err := GetLogUsageSummary(LogUsageSummaryFilter{
		Username:       "wanxin1",
		TokenName:      "image-token",
		StartTimestamp: 90,
		EndTimestamp:   125,
		Group:          "image&2",
	})
	require.NoError(t, err)
	require.Len(t, summary, 2)

	assert.Equal(t, "gpt-image-2", summary[0].ModelName)
	assert.EqualValues(t, 2, summary[0].RequestCount)
	assert.EqualValues(t, 15, summary[0].PromptTokens)
	assert.EqualValues(t, 28, summary[0].CompletionTokens)
	assert.EqualValues(t, 750000, summary[0].Quota)
	assert.Equal(t, "gemini-image", summary[1].ModelName)
	assert.EqualValues(t, 100000, summary[1].Quota)
}

func TestGetLogUsageSummaryRestrictsSelfByUserId(t *testing.T) {
	truncateTables(t)
	initCol()

	logs := []Log{
		{UserId: 1, Username: "same-name", CreatedAt: 100, Type: LogTypeConsume, ModelName: "model-a", Quota: 10},
		{UserId: 2, Username: "same-name", CreatedAt: 100, Type: LogTypeConsume, ModelName: "model-b", Quota: 20},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	summary, err := GetLogUsageSummary(LogUsageSummaryFilter{
		UserId:         1,
		StartTimestamp: 90,
		EndTimestamp:   110,
	})
	require.NoError(t, err)
	require.Len(t, summary, 1)
	assert.Equal(t, "model-a", summary[0].ModelName)
	assert.EqualValues(t, 10, summary[0].Quota)
}

func TestGetLogUsageAnalysisGroupsCSTSafeDimensions(t *testing.T) {
	truncateTables(t)
	initCol()

	logs := []Log{
		{UserId: 1, Username: "wanxin1", CreatedAt: 1704067200, Type: LogTypeConsume, ModelName: "model-a", TokenName: "token-a", Quota: 100, PromptTokens: 2, CompletionTokens: 3, ChannelId: 44, Group: "image"},
		{UserId: 1, Username: "wanxin1", CreatedAt: 1704070800, Type: LogTypeConsume, ModelName: "model-a", TokenName: "token-a", Quota: 200, PromptTokens: 4, CompletionTokens: 5, ChannelId: 44, Group: "image"},
		{UserId: 2, Username: "other", CreatedAt: 1704067200, Type: LogTypeConsume, ModelName: "model-b", TokenName: "token-b", Quota: 300, ChannelId: 35, Group: "chat"},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	rows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{StartTimestamp: 1704067200, EndTimestamp: 1704070800},
		Granularity:           "hour",
		Dimensions:            []string{"period", "username", "model_name", "channel", "group"},
	})
	require.NoError(t, err)
	require.Len(t, rows, 3)
	var wanxinRow *LogUsageAnalysisRow
	for i := range rows {
		if rows[i].Username == "wanxin1" {
			wanxinRow = &rows[i]
			break
		}
	}
	require.NotNil(t, wanxinRow)
	assert.Equal(t, int64(1704067200), wanxinRow.Period)
	assert.Equal(t, "model-a", wanxinRow.ModelName)
	assert.Equal(t, 44, wanxinRow.Channel)
	assert.Equal(t, "image", wanxinRow.GroupName)

	selfRows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1, StartTimestamp: 1704067200, EndTimestamp: 1704070800},
		Granularity:           "day",
		Dimensions:            []string{"period", "model_name"},
	})
	require.NoError(t, err)
	require.Len(t, selfRows, 1)
	assert.Equal(t, int64(1704038400), selfRows[0].Period)
	assert.EqualValues(t, 2, selfRows[0].RequestCount)
	assert.EqualValues(t, 300, selfRows[0].Quota)
}

func TestGetLogUsageAnalysisConservesConsumeLogTotals(t *testing.T) {
	truncateTables(t)
	initCol()

	logs := []Log{
		{UserId: 1, Username: "owner", CreatedAt: 1704067200, Type: LogTypeConsume, ModelName: "model-a", Quota: 100, PromptTokens: 2, CompletionTokens: 3},
		{UserId: 1, Username: "owner", CreatedAt: 1704070800, Type: LogTypeConsume, ModelName: "model-b", Quota: 200, PromptTokens: 4, CompletionTokens: 5},
		{UserId: 1, Username: "owner", CreatedAt: 1704074400, Type: LogTypeError, ModelName: "model-a", Quota: 900, PromptTokens: 99, CompletionTokens: 99},
		{UserId: 2, Username: "other", CreatedAt: 1704074400, Type: LogTypeConsume, ModelName: "model-c", Quota: 300, PromptTokens: 6, CompletionTokens: 7},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	rows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{
			UserId:         1,
			StartTimestamp: 1704067200,
			EndTimestamp:   1704074400,
		},
		Granularity: "hour",
		Dimensions:  []string{"period", "model_name"},
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
	).Where("user_id = ? AND type = ? AND created_at >= ? AND created_at <= ?", 1, LogTypeConsume, 1704067200, 1704074400).Scan(&direct).Error)

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
	assert.Equal(t, direct, got)
}

func TestGetLogUsageAnalysisReturnsEmptyResult(t *testing.T) {
	truncateTables(t)
	initCol()

	rows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{
			UserId:         999,
			StartTimestamp: 1704067200,
			EndTimestamp:   1704070800,
		},
		Granularity: "day",
		Dimensions:  []string{"period", "model_name"},
	})
	require.NoError(t, err)
	assert.Empty(t, rows)
}

func TestGetLogUsageAnalysisUsesCSTDayAndHourBoundaries(t *testing.T) {
	truncateTables(t)
	initCol()

	// 2024-01-01 00:00:00 Asia/Shanghai is 2023-12-31 16:00:00 UTC.
	const cstMidnight int64 = 1704038400
	logs := []Log{
		{UserId: 1, CreatedAt: cstMidnight - 1, Type: LogTypeConsume, ModelName: "boundary", Quota: 1},
		{UserId: 1, CreatedAt: cstMidnight, Type: LogTypeConsume, ModelName: "boundary", Quota: 2},
		{UserId: 1, CreatedAt: cstMidnight + 3599, Type: LogTypeConsume, ModelName: "boundary", Quota: 3},
		{UserId: 1, CreatedAt: cstMidnight + 3600, Type: LogTypeConsume, ModelName: "boundary", Quota: 4},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	dayRows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1, StartTimestamp: cstMidnight - 1, EndTimestamp: cstMidnight + 3600},
		Granularity:           "day",
		Dimensions:            []string{"period", "model_name"},
	})
	require.NoError(t, err)
	require.Len(t, dayRows, 2)
	assert.Equal(t, cstMidnight-24*60*60, dayRows[0].Period)
	assert.EqualValues(t, 1, dayRows[0].Quota)
	assert.Equal(t, cstMidnight, dayRows[1].Period)
	assert.EqualValues(t, 9, dayRows[1].Quota)

	hourRows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1, StartTimestamp: cstMidnight - 1, EndTimestamp: cstMidnight + 3600},
		Granularity:           "hour",
		Dimensions:            []string{"period", "model_name"},
	})
	require.NoError(t, err)
	require.Len(t, hourRows, 3)
	assert.Equal(t, cstMidnight-60*60, hourRows[0].Period)
	assert.EqualValues(t, 1, hourRows[0].Quota)
	assert.Equal(t, cstMidnight, hourRows[1].Period)
	assert.EqualValues(t, 5, hourRows[1].Quota)
	assert.Equal(t, cstMidnight+3600, hourRows[2].Period)
	assert.EqualValues(t, 4, hourRows[2].Quota)
}

func TestGetLogUsageAnalysisHonorsCanceledContext(t *testing.T) {
	truncateTables(t)
	initCol()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{
			StartTimestamp: 1704067200,
			EndTimestamp:   1704070800,
		},
		Granularity: "hour",
		Dimensions:  []string{"period", "model_name"},
		Context:     ctx,
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, context.Canceled)
}

func TestLogUsageAnalysisPeriodExpressionUsesIntegerDialectOperators(t *testing.T) {
	tests := []struct {
		name     string
		dialect  string
		contains string
	}{
		{name: "sqlite", dialect: "sqlite", contains: "AS INTEGER"},
		{name: "mysql", dialect: "mysql", contains: " DIV "},
		{name: "postgres", dialect: "postgres", contains: "AS BIGINT"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			expression := logUsageAnalysisPeriodExpression(test.dialect, 8*60*60, 60*60)
			assert.Contains(t, expression, test.contains)
			assert.NotContains(t, expression, "FLOOR")
		})
	}
}

func TestGetLogUsageAnalysisScansConfiguredDialectPeriodIntoInt64(t *testing.T) {
	truncateTables(t)
	initCol()

	logs := []Log{
		{UserId: 1, CreatedAt: 1704038400, Type: LogTypeConsume, ModelName: "dialect-a", Quota: 1},
		{UserId: 1, CreatedAt: 1704042000, Type: LogTypeConsume, ModelName: "dialect-b", Quota: 2},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	rows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1, StartTimestamp: 1704038400, EndTimestamp: 1704042000},
		Granularity:           "hour",
		Dimensions:            []string{"period", "model_name"},
	})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, int64(1704038400), rows[0].Period)
}

func TestGetLogUsageAnalysis5000GroupBoundaryAndHelpfulOverflow(t *testing.T) {
	truncateTables(t)
	initCol()

	logs := make([]Log, 5000)
	for i := range logs {
		logs[i] = Log{
			UserId:    1,
			CreatedAt: 1704038400,
			Type:      LogTypeConsume,
			ModelName: fmt.Sprintf("boundary-model-%05d", i),
			Quota:     1,
		}
	}
	require.NoError(t, LOG_DB.CreateInBatches(&logs, 250).Error)

	filter := LogUsageAnalysisFilter{
		LogUsageSummaryFilter: LogUsageSummaryFilter{UserId: 1},
		Granularity:           "day",
		Dimensions:            []string{"period", "model_name"},
	}
	rows, err := GetLogUsageAnalysis(filter)
	require.NoError(t, err)
	assert.Len(t, rows, 5000)

	require.NoError(t, LOG_DB.Create(&Log{
		UserId:    1,
		CreatedAt: 1704038400,
		Type:      LogTypeConsume,
		ModelName: "boundary-model-overflow",
		Quota:     1,
	}).Error)
	_, err = GetLogUsageAnalysis(filter)
	require.ErrorIs(t, err, ErrLogUsageAnalysisTooManyRows)
	assert.Contains(t, err.Error(), "超过 5000")
}
