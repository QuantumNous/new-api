package perfmetrics

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestChannelSeparationInHotBuckets verifies that channel-specific samples
// create separate hot bucket entries and do not interfere with each other.
func TestChannelSeparationInHotBuckets(t *testing.T) {
	resetHotBuckets()
	// Perf metrics are enabled by default

	now := time.Now().Unix()
	bucket := bucketStart(now)

	// Record samples for the same model/group but different channels
	Record(Sample{
		Model:     "gpt-4",
		Group:     "default",
		Channel:   5,
		LatencyMs: 100,
		Success:   true,
	})

	Record(Sample{
		Model:     "gpt-4",
		Group:     "default",
		Channel:   6,
		LatencyMs: 200,
		Success:   false,
	})

	// Record another sample for channel 5
	Record(Sample{
		Model:     "gpt-4",
		Group:     "default",
		Channel:   5,
		LatencyMs: 150,
		Success:   true,
	})

	// Verify separation: channel 5 should have 2 requests, channel 6 should have 1
	var ch5Bucket, ch6Bucket *atomicBucket
	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.model == "gpt-4" && k.group == "default" && k.bucketTs == bucket {
			if k.channel == 5 {
				ch5Bucket = value.(*atomicBucket)
			} else if k.channel == 6 {
				ch6Bucket = value.(*atomicBucket)
			}
		}
		return true
	})

	require.NotNil(t, ch5Bucket, "channel 5 bucket should exist")
	require.NotNil(t, ch6Bucket, "channel 6 bucket should exist")

	ch5Snap := ch5Bucket.snapshot()
	assert.Equal(t, int64(2), ch5Snap.requestCount, "channel 5 should have 2 requests")
	assert.Equal(t, int64(2), ch5Snap.successCount, "channel 5 should have 2 successes")
	assert.Equal(t, int64(250), ch5Snap.totalLatencyMs, "channel 5 total latency: 100 + 150")

	ch6Snap := ch6Bucket.snapshot()
	assert.Equal(t, int64(1), ch6Snap.requestCount, "channel 6 should have 1 request")
	assert.Equal(t, int64(0), ch6Snap.successCount, "channel 6 should have 0 successes")
	assert.Equal(t, int64(200), ch6Snap.totalLatencyMs, "channel 6 total latency: 200")
}

// TestFlushUpsertIdempotence verifies that flushing the same bucket multiple
// times accumulates correctly in the database without creating duplicates.
func TestFlushUpsertIdempotence(t *testing.T) {
	db := model.DB
	if db == nil {
		t.Skip("database not initialized for test")
	}

	// Set database type for dialect-aware helpers
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)

	resetHotBuckets()
	// Perf metrics are enabled by default

	now := time.Now().Unix()
	bucket := bucketStart(now)
	channel := 7

	// Clean up test data
	defer func() {
		db.Where("model_name = ? AND bucket_ts = ?", "test-flush-model", bucket).Delete(&model.PerfMetric{})
	}()

	// Record initial sample
	Record(Sample{
		Model:     "test-flush-model",
		Group:     "default",
		Channel:   channel,
		LatencyMs: 100,
		Success:   true,
	})

	// Manually flush the bucket
	key := bucketKey{
		model:    "test-flush-model",
		channel:  channel,
		group:    "default",
		bucketTs: bucket,
	}
	value, ok := hotBuckets.Load(key)
	require.True(t, ok, "bucket should exist")

	bucket1 := value.(*atomicBucket)
	drained1 := bucket1.drain()
	require.Equal(t, int64(1), drained1.requestCount)

	err := model.UpsertPerfMetric(&model.PerfMetric{
		ModelName:      key.model,
		ChannelId:      &channel,
		Group:          key.group,
		BucketTs:       key.bucketTs,
		RequestCount:   drained1.requestCount,
		SuccessCount:   drained1.successCount,
		TotalLatencyMs: drained1.totalLatencyMs,
	})
	require.NoError(t, err)

	// Record another sample to the same bucket
	Record(Sample{
		Model:     "test-flush-model",
		Group:     "default",
		Channel:   channel,
		LatencyMs: 200,
		Success:   true,
	})

	// Flush again
	value, ok = hotBuckets.Load(key)
	require.True(t, ok, "bucket should exist again after new record")

	bucket2 := value.(*atomicBucket)
	drained2 := bucket2.drain()
	require.Equal(t, int64(1), drained2.requestCount)

	err = model.UpsertPerfMetric(&model.PerfMetric{
		ModelName:      key.model,
		ChannelId:      &channel,
		Group:          key.group,
		BucketTs:       key.bucketTs,
		RequestCount:   drained2.requestCount,
		SuccessCount:   drained2.successCount,
		TotalLatencyMs: drained2.totalLatencyMs,
	})
	require.NoError(t, err)

	// Verify database has accumulated both flushes
	var metric model.PerfMetric
	err = db.Where("model_name = ? AND channel_id = ? AND bucket_ts = ?",
		"test-flush-model", channel, bucket).First(&metric).Error
	require.NoError(t, err)
	assert.Equal(t, int64(2), metric.RequestCount, "should accumulate 1 + 1")
	assert.Equal(t, int64(2), metric.SuccessCount)
	assert.Equal(t, int64(300), metric.TotalLatencyMs, "should accumulate 100 + 200")
}

// TestRedisDisabledBehavior verifies that the pipeline works correctly when
// Redis is disabled and only uses hot buckets.
func TestRedisDisabledBehavior(t *testing.T) {
	if model.DB == nil {
		t.Skip("database not initialized for test")
	}

	resetHotBuckets()
	// Perf metrics are enabled by default

	// Ensure Redis is disabled
	origRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	defer func() { common.RedisEnabled = origRedisEnabled }()

	now := time.Now().Unix()
	bucket := bucketStart(now)

	// Record samples
	Record(Sample{
		Model:        "test-no-redis",
		Group:        "default",
		Channel:      8,
		LatencyMs:    300,
		Success:      true,
		OutputTokens: 50,
		GenerationMs: 200,
	})

	Record(Sample{
		Model:        "test-no-redis",
		Group:        "default",
		Channel:      8,
		LatencyMs:    400,
		Success:      false,
		OutputTokens: 60,
		GenerationMs: 250,
	})

	// Verify hot bucket contains data
	key := bucketKey{
		model:    "test-no-redis",
		channel:  8,
		group:    "default",
		bucketTs: bucket,
	}
	value, ok := hotBuckets.Load(key)
	require.True(t, ok, "bucket should exist in hot buckets")

	snap := value.(*atomicBucket).snapshot()
	assert.Equal(t, int64(2), snap.requestCount)
	assert.Equal(t, int64(1), snap.successCount)
	assert.Equal(t, int64(700), snap.totalLatencyMs, "300 + 400")
	assert.Equal(t, int64(110), snap.outputTokens, "50 + 60")
	assert.Equal(t, int64(450), snap.generationMs, "200 + 250")

	// Query should return the data from hot buckets
	channelID := 8
	result, err := Query(QueryParams{
		Model:     "test-no-redis",
		ChannelID: &channelID,
		Hours:     1,
	})
	require.NoError(t, err)
	require.Len(t, result.Groups, 1)

	group := result.Groups[0]
	assert.Equal(t, 8, group.ChannelID)
	assert.Equal(t, float64(50), group.SuccessRate, "1/2 * 100 = 50%")
	assert.Equal(t, int64(350), group.AvgLatencyMs, "700 / 2")
}

// TestZeroRequestHandling verifies that zero-request samples and buckets
// are handled correctly and do not cause database operations or errors.
func TestZeroRequestHandling(t *testing.T) {
	db := model.DB
	if db == nil {
		t.Skip("database not initialized for test")
	}

	resetHotBuckets()
	// Perf metrics are enabled by default

	now := time.Now().Unix()
	bucket := bucketStart(now)

	// Clean up test data
	defer func() {
		db.Where("model_name = ? AND bucket_ts = ?", "test-zero-model", bucket).Delete(&model.PerfMetric{})
	}()

	// Create a bucket with zero requests (shouldn't happen normally, but test the guard)
	err := model.UpsertPerfMetric(&model.PerfMetric{
		ModelName:    "test-zero-model",
		ChannelId:    nil,
		Group:        "default",
		BucketTs:     bucket,
		RequestCount: 0,
	})
	require.NoError(t, err, "UpsertPerfMetric should handle zero-request gracefully")

	// Verify no row was created
	var count int64
	err = db.Model(&model.PerfMetric{}).
		Where("model_name = ? AND bucket_ts = ?", "test-zero-model", bucket).
		Count(&count).Error
	require.NoError(t, err)
	assert.Equal(t, int64(0), count, "zero-request metric should not be persisted")

	// Record actual sample
	Record(Sample{
		Model:     "test-zero-model",
		Group:     "default",
		Channel:   0,
		LatencyMs: 100,
		Success:   true,
	})

	// Verify hot bucket exists
	key := bucketKey{
		model:    "test-zero-model",
		channel:  0,
		group:    "default",
		bucketTs: bucket,
	}
	value, ok := hotBuckets.Load(key)
	require.True(t, ok)
	snap := value.(*atomicBucket).snapshot()
	assert.Equal(t, int64(1), snap.requestCount)
}

// TestRecordWithChannelZeroCreatesBaseKey verifies that samples with channel=0
// only create the base (channel=0) bucket key, not an additional channel-specific key.
func TestRecordWithChannelZeroCreatesBaseKey(t *testing.T) {
	resetHotBuckets()
	// Perf metrics are enabled by default

	now := time.Now().Unix()
	bucket := bucketStart(now)

	Record(Sample{
		Model:     "test-base-only",
		Group:     "default",
		Channel:   0,
		LatencyMs: 100,
		Success:   true,
	})

	// Count how many buckets were created for this model
	bucketCount := 0
	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.model == "test-base-only" && k.bucketTs == bucket {
			bucketCount++
			assert.Equal(t, 0, k.channel, "should only have base bucket with channel=0")
		}
		return true
	})

	assert.Equal(t, 1, bucketCount, "should have exactly 1 bucket (base only)")
}

// TestRecordWithPositiveChannelCreatesBothKeys verifies that samples with
// a positive channel ID create both the base bucket and channel-specific bucket.
func TestRecordWithPositiveChannelCreatesBothKeys(t *testing.T) {
	resetHotBuckets()
	// Perf metrics are enabled by default

	now := time.Now().Unix()
	bucket := bucketStart(now)

	Record(Sample{
		Model:     "test-dual-bucket",
		Group:     "default",
		Channel:   9,
		LatencyMs: 100,
		Success:   true,
	})

	// Collect all buckets for this model
	buckets := make(map[int]counters)
	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.model == "test-dual-bucket" && k.bucketTs == bucket {
			buckets[k.channel] = value.(*atomicBucket).snapshot()
		}
		return true
	})

	require.Len(t, buckets, 2, "should have 2 buckets: base (0) and channel (9)")

	// Verify base bucket (channel=0)
	baseSnap, ok := buckets[0]
	require.True(t, ok, "base bucket should exist")
	assert.Equal(t, int64(1), baseSnap.requestCount)
	assert.Equal(t, int64(1), baseSnap.successCount)

	// Verify channel-specific bucket (channel=9)
	channelSnap, ok := buckets[9]
	require.True(t, ok, "channel bucket should exist")
	assert.Equal(t, int64(1), channelSnap.requestCount)
	assert.Equal(t, int64(1), channelSnap.successCount)
}

// TestAtomicBucketAddCounters verifies the addCounters method correctly
// accumulates counters back into an atomic bucket (used for retry on flush failure).
func TestAtomicBucketAddCounters(t *testing.T) {
	bucket := &atomicBucket{}

	// Add initial sample
	bucket.add(Sample{
		LatencyMs:    100,
		Success:      true,
		HasTtft:      true,
		TtftMs:       20,
		OutputTokens: 50,
		GenerationMs: 80,
	})

	snap1 := bucket.snapshot()
	assert.Equal(t, int64(1), snap1.requestCount)
	assert.Equal(t, int64(100), snap1.totalLatencyMs)

	// Add counters from a flush retry
	bucket.addCounters(counters{
		requestCount:   3,
		successCount:   2,
		totalLatencyMs: 300,
		ttftSumMs:      60,
		ttftCount:      3,
		outputTokens:   150,
		generationMs:   240,
	})

	snap2 := bucket.snapshot()
	assert.Equal(t, int64(4), snap2.requestCount, "1 + 3")
	assert.Equal(t, int64(3), snap2.successCount, "1 + 2")
	assert.Equal(t, int64(400), snap2.totalLatencyMs, "100 + 300")
	assert.Equal(t, int64(80), snap2.ttftSumMs, "20 + 60")
	assert.Equal(t, int64(4), snap2.ttftCount, "1 + 3")
	assert.Equal(t, int64(200), snap2.outputTokens, "50 + 150")
	assert.Equal(t, int64(320), snap2.generationMs, "80 + 240")
}

// TestBucketStartRoundingToConfiguredInterval verifies that bucketStart
// correctly rounds timestamps to the configured bucket interval.
func TestBucketStartRoundingToConfiguredInterval(t *testing.T) {
	origBucketSeconds := perf_metrics_setting.GetBucketSeconds()
	defer func() {
		// Note: Cannot restore setting in tests as BucketTime is read-only via config
		_ = origBucketSeconds
	}()

	// Test with 1-hour buckets (3600 seconds) - this is the default "hour" setting
	ts := int64(1672531200) // 2023-01-01 00:00:00 UTC
	assert.Equal(t, int64(1672531200), bucketStart(ts))
	assert.Equal(t, int64(1672531200), bucketStart(ts+1800)) // +30 minutes
	assert.Equal(t, int64(1672531200), bucketStart(ts+3599)) // +59:59
	assert.Equal(t, int64(1672534800), bucketStart(ts+3600)) // +1 hour

	// Note: Cannot test 5-minute buckets as BucketTime setting is read-only in tests
	// The setting would need to be configured via environment/config file
}
