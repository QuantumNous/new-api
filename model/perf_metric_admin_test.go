package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPerfMetricGroupSummariesUsesHalfOpenRange(t *testing.T) {
	modelName := "admin-summary-half-open"
	t.Cleanup(func() {
		require.NoError(t, DB.Where("model_name = ?", modelName).Delete(&PerfMetric{}).Error)
	})

	rows := []PerfMetric{
		{ModelName: modelName, Group: "default", BucketTs: 100, RequestCount: 2, SuccessCount: 1, TotalLatencyMs: 400, TtftSumMs: 100, TtftCount: 1, OutputTokens: 20, GenerationMs: 1000},
		{ModelName: modelName, Group: "default", BucketTs: 200, RequestCount: 3, SuccessCount: 3, TotalLatencyMs: 600, TtftSumMs: 300, TtftCount: 2, OutputTokens: 30, GenerationMs: 1500},
		{ModelName: modelName, Group: "default", BucketTs: 300, RequestCount: 7, SuccessCount: 7, TotalLatencyMs: 700, TtftSumMs: 700, TtftCount: 7, OutputTokens: 70, GenerationMs: 3500},
	}
	require.NoError(t, DB.Create(&rows).Error)

	summaries, err := GetPerfMetricGroupSummaries(100, 300)

	require.NoError(t, err)
	require.Len(t, summaries, 1)
	assert.Equal(t, int64(5), summaries[0].RequestCount)
	assert.Equal(t, int64(4), summaries[0].SuccessCount)
	assert.Equal(t, int64(1000), summaries[0].TotalLatencyMs)
	assert.Equal(t, int64(400), summaries[0].TtftSumMs)
	assert.Equal(t, int64(3), summaries[0].TtftCount)
	assert.Equal(t, int64(50), summaries[0].OutputTokens)
	assert.Equal(t, int64(2500), summaries[0].GenerationMs)
}
