package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelHealthQueryTest(t *testing.T) {
	t.Helper()

	originalDB := DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&PerfMetric{}))
	DB = db
	t.Cleanup(func() { DB = originalDB })
}

func createModelHealthMetric(t *testing.T, metric PerfMetric) {
	t.Helper()
	require.NoError(t, DB.Create(&metric).Error)
}

func TestGetModelHealthSummariesSumsCountersAndObservedBounds(t *testing.T) {
	setupModelHealthQueryTest(t)
	createModelHealthMetric(t, PerfMetric{ModelName: "weighted", Group: "a", BucketTs: 100, RequestCount: 1, SuccessCount: 1, TotalLatencyMs: 1000, TtftSumMs: 10, TtftCount: 1, OutputTokens: 10, GenerationMs: 1000})
	createModelHealthMetric(t, PerfMetric{ModelName: "weighted", Group: "b", BucketTs: 200, RequestCount: 99, SuccessCount: 49, TotalLatencyMs: 99000, TtftSumMs: 9900, TtftCount: 99, OutputTokens: 990, GenerationMs: 99000})

	rows, err := GetModelHealthSummaries(100, 300)

	require.NoError(t, err)
	require.Equal(t, []ModelHealthAggregate{{
		ModelName: "weighted", RequestCount: 100, SuccessCount: 50,
		TotalLatencyMs: 100000, TtftSumMs: 9910, TtftCount: 100,
		OutputTokens: 1000, GenerationMs: 100000,
		FirstBucketTs: 100, LastBucketTs: 200,
	}}, rows)
}

func TestGetModelHealthSummariesUsesInclusiveStartAndExclusiveCutoff(t *testing.T) {
	setupModelHealthQueryTest(t)
	createModelHealthMetric(t, PerfMetric{ModelName: "before", Group: "default", BucketTs: 99, RequestCount: 1})
	createModelHealthMetric(t, PerfMetric{ModelName: "included", Group: "default", BucketTs: 100, RequestCount: 1})
	createModelHealthMetric(t, PerfMetric{ModelName: "excluded", Group: "default", BucketTs: 200, RequestCount: 1})

	rows, err := GetModelHealthSummaries(100, 200)

	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "included", rows[0].ModelName)
}

func TestGetModelHealthDetailAggregatesAvoidBucketGroupFanout(t *testing.T) {
	setupModelHealthQueryTest(t)
	createModelHealthMetric(t, PerfMetric{ModelName: "detail", Group: "a", BucketTs: 100, RequestCount: 2, SuccessCount: 1, TotalLatencyMs: 200, TtftSumMs: 20, TtftCount: 1, OutputTokens: 10, GenerationMs: 100})
	createModelHealthMetric(t, PerfMetric{ModelName: "detail", Group: "b", BucketTs: 100, RequestCount: 3, SuccessCount: 3, TotalLatencyMs: 900, TtftSumMs: 60, TtftCount: 2, OutputTokens: 30, GenerationMs: 300})
	createModelHealthMetric(t, PerfMetric{ModelName: "detail", Group: "a", BucketTs: 160, RequestCount: 5, SuccessCount: 4, TotalLatencyMs: 1500, TtftSumMs: 120, TtftCount: 3, OutputTokens: 50, GenerationMs: 500})
	createModelHealthMetric(t, PerfMetric{ModelName: "detail", Group: "b", BucketTs: 160, RequestCount: 7, SuccessCount: 6, TotalLatencyMs: 2800, TtftSumMs: 200, TtftCount: 4, OutputTokens: 70, GenerationMs: 700})
	createModelHealthMetric(t, PerfMetric{ModelName: "detail", Group: "excluded", BucketTs: 220, RequestCount: 100, SuccessCount: 100})
	createModelHealthMetric(t, PerfMetric{ModelName: "other", Group: "a", BucketTs: 100, RequestCount: 100, SuccessCount: 0})

	series, err := GetModelHealthSeries("detail", 100, 220)

	require.NoError(t, err)
	require.Equal(t, []ModelHealthAggregate{
		{BucketTs: 100, RequestCount: 5, SuccessCount: 4, TotalLatencyMs: 1100, TtftSumMs: 80, TtftCount: 3, OutputTokens: 40, GenerationMs: 400},
		{BucketTs: 160, RequestCount: 12, SuccessCount: 10, TotalLatencyMs: 4300, TtftSumMs: 320, TtftCount: 7, OutputTokens: 120, GenerationMs: 1200},
	}, series)

	groups, err := GetModelHealthGroups("detail", 100, 220)

	require.NoError(t, err)
	require.Equal(t, []ModelHealthAggregate{
		{GroupName: "a", RequestCount: 7, SuccessCount: 5, TotalLatencyMs: 1700, TtftSumMs: 140, TtftCount: 4, OutputTokens: 60, GenerationMs: 600},
		{GroupName: "b", RequestCount: 10, SuccessCount: 9, TotalLatencyMs: 3700, TtftSumMs: 260, TtftCount: 6, OutputTokens: 100, GenerationMs: 1000},
	}, groups)
}
