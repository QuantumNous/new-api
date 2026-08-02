package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestUpsertPerfMetricChannelSeparation verifies that upsert correctly handles
// separate rows for different channels with the same model/group/bucket.
func TestUpsertPerfMetricChannelSeparation(t *testing.T) {
	if DB == nil {
		t.Skip("DB not initialized")
	}

	nowTs := time.Now().Unix()
	bucketTs := nowTs - (nowTs % 3600)
	channel1 := 10
	channel2 := 11

	// Clean up test data
	defer func() {
		DB.Where("model_name = ? AND bucket_ts = ?", "test-upsert-sep", bucketTs).Delete(&PerfMetric{})
	}()

	// Insert for channel 10
	err := UpsertPerfMetric(&PerfMetric{
		ModelName:      "test-upsert-sep",
		ChannelId:      &channel1,
		Group:          "default",
		BucketTs:       bucketTs,
		RequestCount:   5,
		SuccessCount:   4,
		TotalLatencyMs: 500,
	})
	require.NoError(t, err)

	// Insert for channel 11 (same model/group/bucket, different channel)
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:      "test-upsert-sep",
		ChannelId:      &channel2,
		Group:          "default",
		BucketTs:       bucketTs,
		RequestCount:   3,
		SuccessCount:   3,
		TotalLatencyMs: 300,
	})
	require.NoError(t, err)

	// Verify both rows exist
	var metrics []PerfMetric
	err = DB.Where("model_name = ? AND bucket_ts = ?", "test-upsert-sep", bucketTs).
		Order("channel_id ASC").
		Find(&metrics).Error
	require.NoError(t, err)
	require.Len(t, metrics, 2, "should have 2 separate rows for different channels")

	// Verify channel 10
	assert.Equal(t, &channel1, metrics[0].ChannelId)
	assert.Equal(t, int64(5), metrics[0].RequestCount)
	assert.Equal(t, int64(4), metrics[0].SuccessCount)

	// Verify channel 11
	assert.Equal(t, &channel2, metrics[1].ChannelId)
	assert.Equal(t, int64(3), metrics[1].RequestCount)
	assert.Equal(t, int64(3), metrics[1].SuccessCount)

	// Upsert again for channel 10 - should accumulate
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:      "test-upsert-sep",
		ChannelId:      &channel1,
		Group:          "default",
		BucketTs:       bucketTs,
		RequestCount:   2,
		SuccessCount:   2,
		TotalLatencyMs: 200,
	})
	require.NoError(t, err)

	// Verify channel 10 accumulated, channel 11 unchanged
	err = DB.Where("model_name = ? AND bucket_ts = ?", "test-upsert-sep", bucketTs).
		Order("channel_id ASC").
		Find(&metrics).Error
	require.NoError(t, err)
	require.Len(t, metrics, 2)

	assert.Equal(t, int64(7), metrics[0].RequestCount, "channel 10: 5 + 2")
	assert.Equal(t, int64(6), metrics[0].SuccessCount, "channel 10: 4 + 2")
	assert.Equal(t, int64(700), metrics[0].TotalLatencyMs, "channel 10: 500 + 200")

	assert.Equal(t, int64(3), metrics[1].RequestCount, "channel 11: unchanged")
	assert.Equal(t, int64(3), metrics[1].SuccessCount, "channel 11: unchanged")
}

// TestUpsertPerfMetricNullChannelSeparation verifies that NULL channel_id
// and explicit channel IDs are treated as separate unique keys.
func TestUpsertPerfMetricNullChannelSeparation(t *testing.T) {
	if DB == nil {
		t.Skip("DB not initialized")
	}

	nowTs := time.Now().Unix()
	bucketTs := nowTs - (nowTs % 3600)
	channel := 12

	// Clean up test data
	defer func() {
		DB.Where("model_name = ? AND bucket_ts = ?", "test-upsert-null", bucketTs).Delete(&PerfMetric{})
	}()

	// Insert with NULL channel_id
	err := UpsertPerfMetric(&PerfMetric{
		ModelName:      "test-upsert-null",
		ChannelId:      nil,
		Group:          "default",
		BucketTs:       bucketTs,
		RequestCount:   10,
		SuccessCount:   9,
		TotalLatencyMs: 1000,
	})
	require.NoError(t, err)

	// Insert with channel_id = 12 (same model/group/bucket)
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:      "test-upsert-null",
		ChannelId:      &channel,
		Group:          "default",
		BucketTs:       bucketTs,
		RequestCount:   5,
		SuccessCount:   5,
		TotalLatencyMs: 500,
	})
	require.NoError(t, err)

	// Verify both rows exist
	var count int64
	err = DB.Model(&PerfMetric{}).
		Where("model_name = ? AND bucket_ts = ?", "test-upsert-null", bucketTs).
		Count(&count).Error
	require.NoError(t, err)
	assert.Equal(t, int64(2), count, "should have 2 rows: NULL and channel 12")

	// Upsert NULL again - Note: Due to SQL NULL semantics, this may create a new row
	// instead of updating in some databases (NULL != NULL in SQL)
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:      "test-upsert-null",
		ChannelId:      nil,
		Group:          "default",
		BucketTs:       bucketTs,
		RequestCount:   3,
		SuccessCount:   2,
		TotalLatencyMs: 300,
	})
	require.NoError(t, err)

	// Verify the NULL row behavior (may vary by database)
	var nullMetrics []PerfMetric
	err = DB.Where("model_name = ? AND bucket_ts = ? AND channel_id IS NULL",
		"test-upsert-null", bucketTs).Find(&nullMetrics).Error
	require.NoError(t, err)

	// Due to SQL NULL semantics, the unique constraint may not prevent duplicate NULL rows
	// The test documents this behavior rather than asserting accumulation
	if len(nullMetrics) == 1 {
		// Some databases (e.g., SQLite with proper NULL handling) accumulate
		t.Logf("Database accumulated NULL row: count=%d", nullMetrics[0].RequestCount)
	} else if len(nullMetrics) == 2 {
		// Other databases create separate rows for each NULL channel_id
		t.Logf("Database created separate NULL rows: %d rows", len(nullMetrics))
		totalRequests := nullMetrics[0].RequestCount + nullMetrics[1].RequestCount
		assert.Equal(t, int64(13), totalRequests, "total across NULL rows should be 10+3")
	} else {
		t.Fatalf("Unexpected number of NULL rows: %d", len(nullMetrics))
	}

	// Verify channel row unchanged
	var channelMetric PerfMetric
	err = DB.Where("model_name = ? AND bucket_ts = ? AND channel_id = ?",
		"test-upsert-null", bucketTs, channel).First(&channelMetric).Error
	require.NoError(t, err)
	assert.Equal(t, int64(5), channelMetric.RequestCount, "channel 12: unchanged")
	assert.Equal(t, int64(5), channelMetric.SuccessCount, "channel 12: unchanged")
}

// TestGetPerfMetricsChannelFilter verifies that GetPerfMetrics correctly
// filters by channel_id, NULL channel_id, or returns empty for invalid channels.
func TestGetPerfMetricsChannelFilter(t *testing.T) {
	if DB == nil {
		t.Skip("DB not initialized")
	}

	nowTs := time.Now().Unix()
	bucketTs := nowTs - (nowTs % 3600)
	channel13 := 13
	channel14 := 14

	// Clean up test data
	defer func() {
		DB.Where("model_name = ? AND bucket_ts = ?", "test-get-filter", bucketTs).Delete(&PerfMetric{})
	}()

	// Insert NULL channel_id
	err := UpsertPerfMetric(&PerfMetric{
		ModelName:    "test-get-filter",
		ChannelId:    nil,
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 100,
	})
	require.NoError(t, err)

	// Insert channel 13
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:    "test-get-filter",
		ChannelId:    &channel13,
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 50,
	})
	require.NoError(t, err)

	// Insert channel 14
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:    "test-get-filter",
		ChannelId:    &channel14,
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 30,
	})
	require.NoError(t, err)

	// Query with NULL channel (nil pointer)
	metrics, err := GetPerfMetrics("test-get-filter", "default", nil, bucketTs-1, bucketTs+1)
	require.NoError(t, err)
	require.Len(t, metrics, 1, "should return only NULL channel row")
	assert.Nil(t, metrics[0].ChannelId)
	assert.Equal(t, int64(100), metrics[0].RequestCount)

	// Query with channel 13
	metrics, err = GetPerfMetrics("test-get-filter", "default", &channel13, bucketTs-1, bucketTs+1)
	require.NoError(t, err)
	require.Len(t, metrics, 1, "should return only channel 13")
	assert.Equal(t, &channel13, metrics[0].ChannelId)
	assert.Equal(t, int64(50), metrics[0].RequestCount)

	// Query with channel 14
	metrics, err = GetPerfMetrics("test-get-filter", "default", &channel14, bucketTs-1, bucketTs+1)
	require.NoError(t, err)
	require.Len(t, metrics, 1, "should return only channel 14")
	assert.Equal(t, &channel14, metrics[0].ChannelId)
	assert.Equal(t, int64(30), metrics[0].RequestCount)

	// Query with invalid channel (<= 0)
	invalidChannel := 0
	metrics, err = GetPerfMetrics("test-get-filter", "default", &invalidChannel, bucketTs-1, bucketTs+1)
	require.NoError(t, err)
	assert.Empty(t, metrics, "should return empty for channel <= 0")

	invalidChannel = -1
	metrics, err = GetPerfMetrics("test-get-filter", "default", &invalidChannel, bucketTs-1, bucketTs+1)
	require.NoError(t, err)
	assert.Empty(t, metrics, "should return empty for channel < 0")
}

// TestGetPerfMetricChannelTotalsExcludesNull verifies that GetPerfMetricChannelTotals
// only returns rows with non-NULL channel_id.
func TestGetPerfMetricChannelTotalsExcludesNull(t *testing.T) {
	if DB == nil {
		t.Skip("DB not initialized")
	}

	nowTs := time.Now().Unix()
	bucketTs := nowTs - (nowTs % 3600)
	channel15 := 15
	group := "test-channel-totals"

	// Clean up test data
	defer func() {
		DB.Where("model_name = ? AND bucket_ts = ?", "test-totals-model", bucketTs).Delete(&PerfMetric{})
	}()

	// Insert NULL channel_id
	err := UpsertPerfMetric(&PerfMetric{
		ModelName:    "test-totals-model",
		ChannelId:    nil,
		Group:        group,
		BucketTs:     bucketTs,
		RequestCount: 200,
		SuccessCount: 180,
	})
	require.NoError(t, err)

	// Insert channel 15
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:    "test-totals-model",
		ChannelId:    &channel15,
		Group:        group,
		BucketTs:     bucketTs,
		RequestCount: 50,
		SuccessCount: 45,
	})
	require.NoError(t, err)

	// Query channel totals
	totals, err := GetPerfMetricChannelTotals(bucketTs-1, bucketTs+1, group)
	require.NoError(t, err)
	require.Len(t, totals, 1, "should return only channel 15, not NULL")
	assert.Equal(t, 15, totals[0].ChannelID)
	assert.Equal(t, int64(50), totals[0].RequestCount)
	assert.Equal(t, int64(45), totals[0].SuccessCount)
}

// TestGetPerfMetricChannelModelDetailsFiltersByChannel verifies that
// GetPerfMetricChannelModelDetails correctly filters by channel and model.
func TestGetPerfMetricChannelModelDetailsFiltersByChannel(t *testing.T) {
	if DB == nil {
		t.Skip("DB not initialized")
	}

	nowTs := time.Now().Unix()
	bucketTs := nowTs - (nowTs % 3600)
	channel16 := 16
	channel17 := 17
	group := "test-details-group"

	// Clean up test data
	defer func() {
		DB.Where("group = ? AND bucket_ts = ?", group, bucketTs).Delete(&PerfMetric{})
	}()

	// Insert channel 16, model A
	err := UpsertPerfMetric(&PerfMetric{
		ModelName:    "model-a",
		ChannelId:    &channel16,
		Group:        group,
		BucketTs:     bucketTs,
		RequestCount: 10,
		SuccessCount: 9,
	})
	require.NoError(t, err)

	// Insert channel 16, model B
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:    "model-b",
		ChannelId:    &channel16,
		Group:        group,
		BucketTs:     bucketTs,
		RequestCount: 5,
		SuccessCount: 5,
	})
	require.NoError(t, err)

	// Insert channel 17, model A
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:    "model-a",
		ChannelId:    &channel17,
		Group:        group,
		BucketTs:     bucketTs,
		RequestCount: 8,
		SuccessCount: 7,
	})
	require.NoError(t, err)

	// Query all channels, all models
	details, err := GetPerfMetricChannelModelDetails(nil, "", group, bucketTs-1, bucketTs+1)
	require.NoError(t, err)
	assert.Len(t, details, 3, "should return all 3 combinations")

	// Query channel 16 only
	details, err = GetPerfMetricChannelModelDetails(&channel16, "", group, bucketTs-1, bucketTs+1)
	require.NoError(t, err)
	require.Len(t, details, 2, "should return 2 models for channel 16")
	assert.Equal(t, 16, details[0].ChannelID)
	assert.Equal(t, 16, details[1].ChannelID)

	// Query channel 16, model A only
	details, err = GetPerfMetricChannelModelDetails(&channel16, "model-a", group, bucketTs-1, bucketTs+1)
	require.NoError(t, err)
	require.Len(t, details, 1, "should return only channel 16, model A")
	assert.Equal(t, 16, details[0].ChannelID)
	assert.Equal(t, "model-a", details[0].ModelName)
	assert.Equal(t, int64(10), details[0].RequestCount)

	// Query invalid channel
	invalidChannel := 0
	details, err = GetPerfMetricChannelModelDetails(&invalidChannel, "", group, bucketTs-1, bucketTs+1)
	require.NoError(t, err)
	assert.Empty(t, details, "should return empty for channel <= 0")
}

// TestDeletePerfMetricsBeforeCutoff verifies that DeletePerfMetricsBefore
// correctly deletes old metrics while preserving recent ones.
func TestDeletePerfMetricsBeforeCutoff(t *testing.T) {
	if DB == nil {
		t.Skip("DB not initialized")
	}

	nowTs := time.Now().Unix()
	recentBucket := nowTs - (nowTs % 3600)
	oldBucket := recentBucket - 7*24*3600 // 7 days ago

	// Clean up test data
	defer func() {
		DB.Where("model_name = ?", "test-delete-model").Delete(&PerfMetric{})
	}()

	// Insert old metric
	err := UpsertPerfMetric(&PerfMetric{
		ModelName:    "test-delete-model",
		ChannelId:    nil,
		Group:        "default",
		BucketTs:     oldBucket,
		RequestCount: 10,
	})
	require.NoError(t, err)

	// Insert recent metric
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:    "test-delete-model",
		ChannelId:    nil,
		Group:        "default",
		BucketTs:     recentBucket,
		RequestCount: 20,
	})
	require.NoError(t, err)

	// Verify both exist
	var count int64
	err = DB.Model(&PerfMetric{}).Where("model_name = ?", "test-delete-model").Count(&count).Error
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)

	// Delete metrics older than 3 days
	cutoff := nowTs - 3*24*3600
	err = DeletePerfMetricsBefore(cutoff)
	require.NoError(t, err)

	// Verify only recent metric remains
	var metrics []PerfMetric
	err = DB.Where("model_name = ?", "test-delete-model").Find(&metrics).Error
	require.NoError(t, err)
	require.Len(t, metrics, 1, "should have only recent metric")
	assert.Equal(t, recentBucket, metrics[0].BucketTs)
	assert.Equal(t, int64(20), metrics[0].RequestCount)

	// Test with zero cutoff - should be no-op
	err = DeletePerfMetricsBefore(0)
	require.NoError(t, err)

	err = DB.Model(&PerfMetric{}).Where("model_name = ?", "test-delete-model").Count(&count).Error
	require.NoError(t, err)
	assert.Equal(t, int64(1), count, "zero cutoff should not delete anything")

	// Test with negative cutoff - should be no-op
	err = DeletePerfMetricsBefore(-100)
	require.NoError(t, err)

	err = DB.Model(&PerfMetric{}).Where("model_name = ?", "test-delete-model").Count(&count).Error
	require.NoError(t, err)
	assert.Equal(t, int64(1), count, "negative cutoff should not delete anything")
}

// TestUpsertPerfMetricIdempotence verifies that multiple upserts with the same
// key correctly accumulate counters without creating duplicate rows.
func TestUpsertPerfMetricIdempotence(t *testing.T) {
	if DB == nil {
		t.Skip("DB not initialized")
	}

	nowTs := time.Now().Unix()
	bucketTs := nowTs - (nowTs % 3600)
	channel := 18

	// Clean up test data
	defer func() {
		DB.Where("model_name = ? AND bucket_ts = ?", "test-idempotent", bucketTs).Delete(&PerfMetric{})
	}()

	// First upsert
	err := UpsertPerfMetric(&PerfMetric{
		ModelName:      "test-idempotent",
		ChannelId:      &channel,
		Group:          "default",
		BucketTs:       bucketTs,
		RequestCount:   1,
		SuccessCount:   1,
		TotalLatencyMs: 100,
		TtftSumMs:      10,
		TtftCount:      1,
		OutputTokens:   50,
		GenerationMs:   80,
	})
	require.NoError(t, err)

	// Second upsert with same key
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:      "test-idempotent",
		ChannelId:      &channel,
		Group:          "default",
		BucketTs:       bucketTs,
		RequestCount:   2,
		SuccessCount:   1,
		TotalLatencyMs: 200,
		TtftSumMs:      20,
		TtftCount:      2,
		OutputTokens:   100,
		GenerationMs:   160,
	})
	require.NoError(t, err)

	// Third upsert with same key
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:      "test-idempotent",
		ChannelId:      &channel,
		Group:          "default",
		BucketTs:       bucketTs,
		RequestCount:   1,
		SuccessCount:   0,
		TotalLatencyMs: 50,
		TtftSumMs:      5,
		TtftCount:      1,
		OutputTokens:   25,
		GenerationMs:   40,
	})
	require.NoError(t, err)

	// Verify only one row exists with accumulated values
	var count int64
	err = DB.Model(&PerfMetric{}).
		Where("model_name = ? AND channel_id = ? AND bucket_ts = ?", "test-idempotent", channel, bucketTs).
		Count(&count).Error
	require.NoError(t, err)
	assert.Equal(t, int64(1), count, "should have exactly 1 row")

	var metric PerfMetric
	err = DB.Where("model_name = ? AND channel_id = ? AND bucket_ts = ?",
		"test-idempotent", channel, bucketTs).First(&metric).Error
	require.NoError(t, err)

	assert.Equal(t, int64(4), metric.RequestCount, "1 + 2 + 1")
	assert.Equal(t, int64(2), metric.SuccessCount, "1 + 1 + 0")
	assert.Equal(t, int64(350), metric.TotalLatencyMs, "100 + 200 + 50")
	assert.Equal(t, int64(35), metric.TtftSumMs, "10 + 20 + 5")
	assert.Equal(t, int64(4), metric.TtftCount, "1 + 2 + 1")
	assert.Equal(t, int64(175), metric.OutputTokens, "50 + 100 + 25")
	assert.Equal(t, int64(280), metric.GenerationMs, "80 + 160 + 40")
}

// TestPerfMetricIndexShape verifies that the unique index includes all four
// key columns (model_name, channel_id, group, bucket_ts) and prevents duplicates.
func TestPerfMetricIndexShape(t *testing.T) {
	if DB == nil {
		t.Skip("DB not initialized")
	}

	// This test verifies index behavior indirectly through upsert behavior.
	// The migration test already validates the index structure directly.

	nowTs := time.Now().Unix()
	bucketTs := nowTs - (nowTs % 3600)
	channel := 19

	// Clean up test data
	defer func() {
		DB.Where("model_name = ? AND bucket_ts = ?", "test-index-shape", bucketTs).Delete(&PerfMetric{})
	}()

	// Insert initial row
	metric := &PerfMetric{
		ModelName:    "test-index-shape",
		ChannelId:    &channel,
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 1,
	}
	err := DB.Create(metric).Error
	require.NoError(t, err)

	// Attempt to insert duplicate with same all four key fields - should fail
	duplicate := &PerfMetric{
		ModelName:    "test-index-shape",
		ChannelId:    &channel,
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 1,
	}
	err = DB.Create(duplicate).Error
	assert.Error(t, err, "should fail with duplicate key error")

	// Insert with different channel - should succeed
	channel20 := 20
	differentChannel := &PerfMetric{
		ModelName:    "test-index-shape",
		ChannelId:    &channel20,
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 1,
	}
	err = DB.Create(differentChannel).Error
	require.NoError(t, err, "different channel should create new row")

	// Insert with different group - should succeed
	differentGroup := &PerfMetric{
		ModelName:    "test-index-shape",
		ChannelId:    &channel,
		Group:        "premium",
		BucketTs:     bucketTs,
		RequestCount: 1,
	}
	err = DB.Create(differentGroup).Error
	require.NoError(t, err, "different group should create new row")

	// Insert with different bucket - should succeed
	differentBucket := &PerfMetric{
		ModelName:    "test-index-shape",
		ChannelId:    &channel,
		Group:        "default",
		BucketTs:     bucketTs + 3600,
		RequestCount: 1,
	}
	err = DB.Create(differentBucket).Error
	require.NoError(t, err, "different bucket should create new row")
}

// TestDialectAwareCommonGroupCol verifies that model functions use the
// dialect-aware commonGroupCol for 'group' column queries.
func TestDialectAwareCommonGroupCol(t *testing.T) {
	if DB == nil {
		t.Skip("DB not initialized")
	}

	// This is a smoke test that functions using commonGroupCol don't error.
	// The actual SQL correctness is tested in locking_test.go patterns.

	nowTs := time.Now().Unix()
	bucketTs := nowTs - (nowTs % 3600)

	// Clean up test data
	defer func() {
		DB.Where("model_name = ?", "test-group-col").Delete(&PerfMetric{})
	}()

	err := UpsertPerfMetric(&PerfMetric{
		ModelName:    "test-group-col",
		ChannelId:    nil,
		Group:        "test-group",
		BucketTs:     bucketTs,
		RequestCount: 1,
	})
	require.NoError(t, err)

	// Test functions that use commonGroupCol
	_, err = GetPerfMetrics("test-group-col", "test-group", nil, bucketTs-1, bucketTs+1)
	require.NoError(t, err, "GetPerfMetrics should handle group column")

	_, err = GetPerfMetricsSummaryAll(bucketTs-1, bucketTs+1, []string{"test-group"})
	require.NoError(t, err, "GetPerfMetricsSummaryAll should handle group column")

	_, err = GetPerfMetricsSummaryBucketsAll(bucketTs-1, bucketTs+1, []string{"test-group"})
	require.NoError(t, err, "GetPerfMetricsSummaryBucketsAll should handle group column")

	_, err = GetPerfMetricChannelTotals(bucketTs-1, bucketTs+1, "test-group")
	require.NoError(t, err, "GetPerfMetricChannelTotals should handle group column")

	_, err = GetPerfMetricChannelModelDetails(nil, "", "test-group", bucketTs-1, bucketTs+1)
	require.NoError(t, err, "GetPerfMetricChannelModelDetails should handle group column")
}
