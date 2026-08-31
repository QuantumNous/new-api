package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGetPerfMetricsSummaryAll_MixedLegacyAndChannelRows verifies that
// model-level aggregation sums across both legacy (NULL channel_id) and
// new channel-specific rows without exposing channel_id in the result.
func TestGetPerfMetricsSummaryAll_MixedLegacyAndChannelRows(t *testing.T) {
	if DB == nil {
		t.Skip("DB not initialized")
	}

	nowTs := time.Now().Unix()
	bucketTs := nowTs - (nowTs % 3600)
	group := "test-group"

	// Clean up test data
	defer func() {
		DB.Where("model_name LIKE ?", "test-agg-model-%").Delete(&PerfMetric{})
	}()

	// Insert legacy row (NULL channel_id)
	legacyMetric := &PerfMetric{
		ModelName:      "test-agg-model-1",
		ChannelId:      nil,
		Group:          group,
		BucketTs:       bucketTs,
		RequestCount:   100,
		SuccessCount:   90,
		TotalLatencyMs: 5000,
		OutputTokens:   1000,
		GenerationMs:   2000,
	}
	err := UpsertPerfMetric(legacyMetric)
	require.NoError(t, err)

	// Insert channel-specific rows for the same model
	channel5 := 5
	channel6 := 6
	channel5Metric := &PerfMetric{
		ModelName:      "test-agg-model-1",
		ChannelId:      &channel5,
		Group:          group,
		BucketTs:       bucketTs,
		RequestCount:   50,
		SuccessCount:   45,
		TotalLatencyMs: 2500,
		OutputTokens:   500,
		GenerationMs:   1000,
	}
	err = UpsertPerfMetric(channel5Metric)
	require.NoError(t, err)

	channel6Metric := &PerfMetric{
		ModelName:      "test-agg-model-1",
		ChannelId:      &channel6,
		Group:          group,
		BucketTs:       bucketTs,
		RequestCount:   30,
		SuccessCount:   25,
		TotalLatencyMs: 1500,
		OutputTokens:   300,
		GenerationMs:   600,
	}
	err = UpsertPerfMetric(channel6Metric)
	require.NoError(t, err)

	// Query model-level summary (should aggregate all three rows)
	summaries, err := GetPerfMetricsSummaryAll(bucketTs-1, bucketTs+1, []string{group})
	require.NoError(t, err)
	require.Len(t, summaries, 1, "should return exactly one row for the model")

	summary := summaries[0]
	assert.Equal(t, "test-agg-model-1", summary.ModelName)
	assert.Equal(t, int64(180), summary.RequestCount, "100 + 50 + 30")
	assert.Equal(t, int64(160), summary.SuccessCount, "90 + 45 + 25")
	assert.Equal(t, int64(9000), summary.TotalLatencyMs, "5000 + 2500 + 1500")
	assert.Equal(t, int64(1800), summary.OutputTokens, "1000 + 500 + 300")
	assert.Equal(t, int64(3600), summary.GenerationMs, "2000 + 1000 + 600")
}

// TestGetPerfMetricsSummaryBucketsAll_MixedLegacyAndChannelRows verifies that
// model-level bucket aggregation sums across both legacy and channel rows.
func TestGetPerfMetricsSummaryBucketsAll_MixedLegacyAndChannelRows(t *testing.T) {
	if DB == nil {
		t.Skip("DB not initialized")
	}

	nowTs := time.Now().Unix()
	bucketTs := nowTs - (nowTs % 3600)
	group := "test-bucket-group"

	// Clean up test data
	defer func() {
		DB.Where("model_name LIKE ?", "test-bucket-model-%").Delete(&PerfMetric{})
	}()

	// Insert legacy row (NULL channel_id)
	legacyMetric := &PerfMetric{
		ModelName:      "test-bucket-model-1",
		ChannelId:      nil,
		Group:          group,
		BucketTs:       bucketTs,
		RequestCount:   200,
		SuccessCount:   180,
		TotalLatencyMs: 10000,
		OutputTokens:   2000,
		GenerationMs:   4000,
	}
	err := UpsertPerfMetric(legacyMetric)
	require.NoError(t, err)

	// Insert channel-specific rows
	channel7 := 7
	channel7Metric := &PerfMetric{
		ModelName:      "test-bucket-model-1",
		ChannelId:      &channel7,
		Group:          group,
		BucketTs:       bucketTs,
		RequestCount:   80,
		SuccessCount:   75,
		TotalLatencyMs: 4000,
		OutputTokens:   800,
		GenerationMs:   1600,
	}
	err = UpsertPerfMetric(channel7Metric)
	require.NoError(t, err)

	// Query model-level bucket summary
	summaries, err := GetPerfMetricsSummaryBucketsAll(bucketTs-1, bucketTs+1, []string{group})
	require.NoError(t, err)
	require.Len(t, summaries, 1, "should return exactly one bucket for the model")

	summary := summaries[0]
	assert.Equal(t, "test-bucket-model-1", summary.ModelName)
	assert.Equal(t, bucketTs, summary.BucketTs)
	assert.Equal(t, int64(280), summary.RequestCount, "200 + 80")
	assert.Equal(t, int64(255), summary.SuccessCount, "180 + 75")
	assert.Equal(t, int64(14000), summary.TotalLatencyMs, "10000 + 4000")
	assert.Equal(t, int64(2800), summary.OutputTokens, "2000 + 800")
	assert.Equal(t, int64(5600), summary.GenerationMs, "4000 + 1600")
}
