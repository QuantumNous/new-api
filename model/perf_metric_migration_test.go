package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPerfMetricChannelIdMigration(t *testing.T) {
	// Setup in-memory SQLite database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// Set database type for dialect-aware helpers
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)

	// Store original DB and restore after test
	origDB := DB
	DB = db
	defer func() { DB = origDB }()

	// Create the old schema (without channel_id)
	type OldPerfMetric struct {
		Id             int    `gorm:"primaryKey"`
		ModelName      string `gorm:"size:128;uniqueIndex:idx_perf_model_group_bucket,priority:1"`
		Group          string `gorm:"column:group;size:64;uniqueIndex:idx_perf_model_group_bucket,priority:2"`
		BucketTs       int64  `gorm:"uniqueIndex:idx_perf_model_group_bucket,priority:3;index:idx_perf_bucket_ts"`
		RequestCount   int64  `gorm:"default:0"`
		SuccessCount   int64  `gorm:"default:0"`
		TotalLatencyMs int64  `gorm:"default:0"`
		TtftSumMs      int64  `gorm:"default:0"`
		TtftCount      int64  `gorm:"default:0"`
		OutputTokens   int64  `gorm:"default:0"`
		GenerationMs   int64  `gorm:"default:0"`
	}

	oldMetric := OldPerfMetric{}
	err = db.Table("perf_metrics").AutoMigrate(&oldMetric)
	require.NoError(t, err)

	// Insert legacy data (no channel_id)
	err = db.Table("perf_metrics").Create(map[string]interface{}{
		"model_name":       "gpt-4",
		"group":            "default",
		"bucket_ts":        1000,
		"request_count":    10,
		"success_count":    9,
		"total_latency_ms": 5000,
	}).Error
	require.NoError(t, err)

	// Run migration
	err = migratePerfMetricAddChannelId()
	require.NoError(t, err)

	// Verify column was added
	assert.True(t, db.Migrator().HasColumn(&PerfMetric{}, "channel_id"))

	// Run AutoMigrate to create new index
	err = db.AutoMigrate(&PerfMetric{})
	require.NoError(t, err)

	// Verify legacy row still exists and has NULL channel_id
	var legacyMetric PerfMetric
	err = db.Where("model_name = ? AND bucket_ts = ?", "gpt-4", int64(1000)).First(&legacyMetric).Error
	require.NoError(t, err)
	assert.Nil(t, legacyMetric.ChannelId)
	assert.Equal(t, int64(10), legacyMetric.RequestCount)

	// Test new unique constraint allows different channels for same model/group/bucket
	channelId1 := 1
	channelId2 := 2

	metric1 := &PerfMetric{
		ModelName:    "gpt-4",
		ChannelId:    &channelId1,
		Group:        "default",
		BucketTs:     2000,
		RequestCount: 5,
		SuccessCount: 5,
	}
	err = db.Create(metric1).Error
	require.NoError(t, err)

	metric2 := &PerfMetric{
		ModelName:    "gpt-4",
		ChannelId:    &channelId2,
		Group:        "default",
		BucketTs:     2000,
		RequestCount: 3,
		SuccessCount: 3,
	}
	err = db.Create(metric2).Error
	require.NoError(t, err, "Should allow two different channels for same model/group/bucket")

	// Verify both records exist
	var count int64
	err = db.Model(&PerfMetric{}).Where("model_name = ? AND bucket_ts = ?", "gpt-4", int64(2000)).Count(&count).Error
	require.NoError(t, err)
	assert.Equal(t, int64(2), count, "Should have 2 records for different channels")

	// Test upsert with new schema
	err = UpsertPerfMetric(&PerfMetric{
		ModelName:    "gpt-4",
		ChannelId:    &channelId1,
		Group:        "default",
		BucketTs:     2000,
		RequestCount: 2,
		SuccessCount: 2,
	})
	require.NoError(t, err)

	// Verify upsert accumulated correctly
	var updated PerfMetric
	err = db.Where("model_name = ? AND channel_id = ? AND bucket_ts = ?", "gpt-4", channelId1, int64(2000)).First(&updated).Error
	require.NoError(t, err)
	assert.Equal(t, int64(7), updated.RequestCount, "Should accumulate from 5 + 2")
	assert.Equal(t, int64(7), updated.SuccessCount)
}
