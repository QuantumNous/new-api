package channelflowmetrics

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupMetricDB(t *testing.T) {
	t.Helper()
	oldDB := model.DB
	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChannelFlowMetricMinute{}))
	model.DB = db
	common.RedisEnabled = false
	common.RDB = nil
	hotBuckets = sync.Map{}
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
		model.DB = oldDB
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
		hotBuckets = sync.Map{}
	})
}

func TestQueryFillsEmptyMinuteBuckets(t *testing.T) {
	setupMetricDB(t)

	result, err := Query(QueryParams{PoolKey: "flow_pool_empty_test", Hours: 1})
	require.NoError(t, err)
	require.Len(t, result.Points, 60)
	require.Equal(t, "flow_pool_empty_test", result.PoolKey)
	for _, point := range result.Points {
		require.Zero(t, point.RunningMax)
		require.Zero(t, point.QueuedMax)
		require.Zero(t, point.AcquiredCount)
	}
	require.Zero(t, result.Totals.AcquiredCount)
	require.Zero(t, result.Totals.RejectedCount)
}

func TestFlushCompletedBucketsUpsertsAndDeletesHotBucket(t *testing.T) {
	setupMetricDB(t)

	bucketTs := bucketStart(time.Now().Add(-2 * time.Minute).Unix())
	key := bucketKey{
		poolKey:   "flow_pool_metric_test",
		channelID: 11,
		model:     "gpt-test",
		bucketTs:  bucketTs,
	}
	bucket := &atomicBucket{}
	bucket.add(Sample{EventType: model.ChannelFlowEventAcquired, Running: 1, Queued: 2, WaitMs: 15})
	bucket.add(Sample{EventType: model.ChannelFlowEventSucceeded, Running: -1, Queued: -1})
	bucket.add(Sample{EventType: model.ChannelFlowEventReleased, Running: -1, Queued: -1, ProcessMs: 100})
	hotBuckets.Store(key, bucket)

	flushCompletedBuckets()

	_, ok := hotBuckets.Load(key)
	require.False(t, ok, "flushed completed bucket should be removed from hot memory")

	rows, err := model.GetChannelFlowMetricMinutes(key.poolKey, bucketTs, bucketTs)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, int64(1), rows[0].SampleCount)
	require.Equal(t, int64(1), rows[0].RunningSum)
	require.Equal(t, 1.0, rows[0].RunningAvg)
	require.Equal(t, int64(2), rows[0].QueuedSum)
	require.Equal(t, 2.0, rows[0].QueuedAvg)
	require.Equal(t, 1, rows[0].AcquiredCount)
	require.Equal(t, 1, rows[0].SucceededCount)
	require.Equal(t, 1, rows[0].ReleasedCount)
	require.Equal(t, int64(15), rows[0].WaitMsAvg)
	require.Equal(t, int64(100), rows[0].ProcessMsAvg)

	nextBucket := &atomicBucket{}
	nextBucket.add(Sample{EventType: model.ChannelFlowEventAcquired, Running: 3, Queued: 0, WaitMs: 45})
	nextBucket.add(Sample{EventType: model.ChannelFlowEventFailed, Running: -1, Queued: -1})
	hotBuckets.Store(key, nextBucket)

	flushCompletedBuckets()

	rows, err = model.GetChannelFlowMetricMinutes(key.poolKey, bucketTs, bucketTs)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, int64(2), rows[0].SampleCount)
	require.Equal(t, int64(4), rows[0].RunningSum)
	require.Equal(t, 2.0, rows[0].RunningAvg)
	require.Equal(t, 3, rows[0].RunningMax)
	require.Equal(t, int64(2), rows[0].QueuedSum)
	require.Equal(t, 1.0, rows[0].QueuedAvg)
	require.Equal(t, 2, rows[0].AcquiredCount)
	require.Equal(t, 1, rows[0].SucceededCount)
	require.Equal(t, 1, rows[0].FailedCount)
	require.Equal(t, int64(30), rows[0].WaitMsAvg)
	require.Equal(t, int64(45), rows[0].WaitMsMax)
}

func TestCleanupExpiredMetricsKeepsRetentionWindow(t *testing.T) {
	setupMetricDB(t)

	poolKey := "flow_pool_cleanup_test"
	oldTs := bucketStart(time.Now().Add(-9 * 24 * time.Hour).Unix())
	recentTs := bucketStart(time.Now().Add(-time.Hour).Unix())
	require.NoError(t, model.UpsertChannelFlowMetricMinute(&model.ChannelFlowMetricMinute{
		BucketTs:      oldTs,
		PoolKey:       poolKey,
		ChannelId:     1,
		Model:         "gpt-old",
		SampleCount:   1,
		RunningSum:    1,
		AcquiredCount: 1,
	}))
	require.NoError(t, model.UpsertChannelFlowMetricMinute(&model.ChannelFlowMetricMinute{
		BucketTs:      recentTs,
		PoolKey:       poolKey,
		ChannelId:     1,
		Model:         "gpt-recent",
		SampleCount:   1,
		RunningSum:    1,
		AcquiredCount: 1,
	}))

	cleanupExpiredMetrics()

	rows, err := model.GetChannelFlowMetricMinutes(poolKey, oldTs, recentTs)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, recentTs, rows[0].BucketTs)
}
