package perfmetrics

import (
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelHealthServiceTest(t *testing.T, setting perf_metrics_setting.PerfMetricsSetting) {
	t.Helper()

	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PerfMetric{}))
	model.DB = db

	settingPointer := config.GlobalConfig.Get("perf_metrics_setting").(*perf_metrics_setting.PerfMetricsSetting)
	originalSetting := *settingPointer
	*settingPointer = setting
	clearModelHealthHotBuckets()

	t.Cleanup(func() {
		clearModelHealthHotBuckets()
		*settingPointer = originalSetting
		model.DB = originalDB
	})
}

func clearModelHealthHotBuckets() {
	hotBuckets.Range(func(key, _ any) bool {
		hotBuckets.Delete(key)
		return true
	})
}

func createPersistedModelHealthMetric(t *testing.T, metric model.PerfMetric) {
	t.Helper()
	require.NoError(t, model.DB.Create(&metric).Error)
}

func TestModelHealthDataCutoffIsFlushSafeForHourlyBuckets(t *testing.T) {
	require.Equal(t, int64(39600), ModelHealthDataCutoff(40000, 3600, 5))
}

func TestModelHealthDataCutoffIsFlushSafeForFiveMinuteBuckets(t *testing.T) {
	require.Equal(t, int64(9600), ModelHealthDataCutoff(10000, 300, 5))
}

func TestModelHealthDataCutoffIsFlushSafeForMinuteBuckets(t *testing.T) {
	require.Equal(t, int64(9840), ModelHealthDataCutoff(10000, 60, 1))
}

func TestValidateModelHealthHoursAcceptsSupportedWindows(t *testing.T) {
	for _, hours := range []int{24, 168, 720} {
		t.Run(strconv.Itoa(hours), func(t *testing.T) {
			require.NoError(t, ValidateModelHealthHours(hours))
		})
	}
}

func TestValidateModelHealthHoursRejectsUnsupportedWindows(t *testing.T) {
	for _, hours := range []int{-1, 0, 1, 23, 25, 167, 169, 719, 721} {
		t.Run(strconv.Itoa(hours), func(t *testing.T) {
			require.Error(t, ValidateModelHealthHours(hours))
		})
	}
}

func TestClassifyModelHealthReturnsInsufficientBelowTwentyRequests(t *testing.T) {
	require.Equal(t, ModelHealthState("insufficient"), ClassifyModelHealth(19, 100))
}

func TestClassifyModelHealthAppliesPolicyAtTwentyRequests(t *testing.T) {
	require.Equal(t, ModelHealthState("healthy"), ClassifyModelHealth(20, 100))
}

func TestClassifyModelHealthTreatsExactlyNinetyNinePointNineAsHealthy(t *testing.T) {
	require.Equal(t, ModelHealthState("healthy"), ClassifyModelHealth(1000, 99.9))
}

func TestClassifyModelHealthTreatsBelowNinetyNinePointNineAsWatch(t *testing.T) {
	require.Equal(t, ModelHealthState("watch"), ClassifyModelHealth(1000, 99.899999))
}

func TestClassifyModelHealthTreatsExactlyNinetyNineAsWatch(t *testing.T) {
	require.Equal(t, ModelHealthState("watch"), ClassifyModelHealth(100, 99.0))
}

func TestClassifyModelHealthTreatsBelowNinetyNineAsDegraded(t *testing.T) {
	require.Equal(t, ModelHealthState("degraded"), ClassifyModelHealth(100, 98.999999))
}

func TestCalculateModelHealthMetricsUsesSummedCounters(t *testing.T) {
	metrics := calculateModelHealthMetrics(model.ModelHealthAggregate{
		RequestCount: 100, SuccessCount: 50, TotalLatencyMs: 100000,
		TtftSumMs: 9910, TtftCount: 100, OutputTokens: 1000, GenerationMs: 100000,
	})

	require.Equal(t, 50.0, metrics.successRate)
	require.Equal(t, 1000.0, metrics.avgLatencyMs)
	require.NotNil(t, metrics.avgTtftMs)
	require.Equal(t, 99.1, *metrics.avgTtftMs)
	require.NotNil(t, metrics.avgTps)
	require.Equal(t, 10.0, *metrics.avgTps)
}

func TestCalculateModelHealthMetricsKeepsMissingTtftNull(t *testing.T) {
	metrics := calculateModelHealthMetrics(model.ModelHealthAggregate{RequestCount: 20})

	require.Nil(t, metrics.avgTtftMs)
}

func TestCalculateModelHealthMetricsKeepsMissingTpsNull(t *testing.T) {
	metrics := calculateModelHealthMetrics(model.ModelHealthAggregate{RequestCount: 20, OutputTokens: 100})

	require.Nil(t, metrics.avgTps)
}

func TestGetModelHealthOverviewUsesCounterWeightedFleetMetrics(t *testing.T) {
	setting := perf_metrics_setting.PerfMetricsSetting{Enabled: true, FlushInterval: 5, BucketTime: "hour", RetentionDays: 30}
	setupModelHealthServiceTest(t, setting)
	cutoff := ModelHealthDataCutoff(time.Now().Unix(), 3600, 5)
	firstBucket := cutoff - 7200
	lastBucket := cutoff - 3600
	createPersistedModelHealthMetric(t, model.PerfMetric{ModelName: "small", Group: "default", BucketTs: firstBucket, RequestCount: 1, SuccessCount: 1, TotalLatencyMs: 1000})
	createPersistedModelHealthMetric(t, model.PerfMetric{ModelName: "large", Group: "default", BucketTs: lastBucket, RequestCount: 99, SuccessCount: 49, TotalLatencyMs: 99000})

	overview, err := GetModelHealthOverview(24)

	require.NoError(t, err)
	require.Equal(t, int64(100), overview.Fleet.RequestCount)
	require.Equal(t, int64(50), overview.Fleet.SuccessCount)
	require.Equal(t, 50.0, overview.Fleet.SuccessRate)
	require.Equal(t, &firstBucket, overview.FirstObservedAt)
	require.Equal(t, &lastBucket, overview.LastObservedAt)
}

func TestGetModelHealthOverviewReportsDisabledCollectionAndRetentionMetadata(t *testing.T) {
	setting := perf_metrics_setting.PerfMetricsSetting{Enabled: false, FlushInterval: 5, BucketTime: "5min", RetentionDays: 7}
	setupModelHealthServiceTest(t, setting)

	overview, err := GetModelHealthOverview(168)

	require.NoError(t, err)
	require.False(t, overview.CollectionEnabled)
	require.Equal(t, 7, overview.RetentionDays)
	require.Equal(t, 168, overview.RequestedHours)
	require.Equal(t, int64(300), overview.BucketSeconds)
	require.Nil(t, overview.FirstObservedAt)
	require.Nil(t, overview.LastObservedAt)
}

func TestGetModelHealthOverviewReportsBestEffortDataQualityCaveats(t *testing.T) {
	setupModelHealthServiceTest(t, perf_metrics_setting.PerfMetricsSetting{Enabled: true, FlushInterval: 5, BucketTime: "hour"})

	overview, err := GetModelHealthOverview(24)

	require.NoError(t, err)
	require.Equal(t, ModelHealthDataQualityMode, overview.DataQuality.Mode)
	require.False(t, overview.DataQuality.CompletenessGuaranteed)
	require.Len(t, overview.DataQuality.Caveats, 2)
	require.Equal(t, ModelHealthCaveatClientDisconnects, overview.DataQuality.Caveats[0].Code)
	require.Equal(t, ModelHealthCaveatUnflushedNodeData, overview.DataQuality.Caveats[1].Code)
}

func TestGetModelHealthOverviewIgnoresProcessLocalHotBuckets(t *testing.T) {
	setupModelHealthServiceTest(t, perf_metrics_setting.PerfMetricsSetting{Enabled: true, FlushInterval: 5, BucketTime: "hour"})
	cutoff := ModelHealthDataCutoff(time.Now().Unix(), 3600, 5)
	bucketTs := cutoff - 3600
	createPersistedModelHealthMetric(t, model.PerfMetric{ModelName: "shared-db", Group: "default", BucketTs: bucketTs, RequestCount: 20, SuccessCount: 20})
	hotBucket := &atomicBucket{}
	for range 100 {
		hotBucket.add(Sample{Model: "shared-db", Group: "default", Success: false})
	}
	hotBuckets.Store(bucketKey{model: "shared-db", group: "default", bucketTs: bucketTs}, hotBucket)

	overview, err := GetModelHealthOverview(24)

	require.NoError(t, err)
	require.Len(t, overview.Models, 1)
	require.Equal(t, int64(20), overview.Models[0].RequestCount)
	require.Equal(t, 100.0, overview.Models[0].SuccessRate)
}

func TestGetModelHealthDetailWeightsSeriesAcrossGroupsByCounters(t *testing.T) {
	setupModelHealthServiceTest(t, perf_metrics_setting.PerfMetricsSetting{Enabled: true, FlushInterval: 5, BucketTime: "hour"})
	cutoff := ModelHealthDataCutoff(time.Now().Unix(), 3600, 5)
	bucketTs := cutoff - 3600
	createPersistedModelHealthMetric(t, model.PerfMetric{ModelName: "weighted-detail", Group: "small", BucketTs: bucketTs, RequestCount: 1, SuccessCount: 1, TotalLatencyMs: 1000})
	createPersistedModelHealthMetric(t, model.PerfMetric{ModelName: "weighted-detail", Group: "large", BucketTs: bucketTs, RequestCount: 99, SuccessCount: 49, TotalLatencyMs: 99000})

	detail, err := GetModelHealthDetail("weighted-detail", 24)

	require.NoError(t, err)
	require.Len(t, detail.Series, 1)
	require.Equal(t, int64(100), detail.Series[0].RequestCount)
	require.Equal(t, 50.0, detail.Series[0].SuccessRate)
	require.Equal(t, 1000.0, detail.Series[0].AvgLatencyMs)
	require.Len(t, detail.Groups, 2)
}

func TestRollupModelHealthSeriesBounds720HourMinuteWindow(t *testing.T) {
	const (
		windowSeconds = int64(720 * 3600)
		bucketSeconds = int64(60)
		windowStart   = int64(10140)
	)
	rows := make([]model.ModelHealthAggregate, 0, windowSeconds/bucketSeconds)
	for ts := windowStart; ts < windowStart+windowSeconds; ts += bucketSeconds {
		rows = append(rows, model.ModelHealthAggregate{
			BucketTs: ts, RequestCount: 2, SuccessCount: 1, TotalLatencyMs: 200,
			TtftSumMs: 30, TtftCount: 1, OutputTokens: 40, GenerationMs: 2000,
		})
	}

	rolled := rollupModelHealthSeries(rows, windowStart, windowSeconds, bucketSeconds)

	require.Len(t, rows, 43200)
	require.Len(t, rolled, int(maxDetailSeriesPoints))
	require.Equal(t, int64(3600), modelHealthDetailRollupSeconds(windowSeconds, bucketSeconds))
	var total model.ModelHealthAggregate
	for i, row := range rolled {
		require.Equal(t, windowStart+int64(i)*3600, row.BucketTs)
		require.Equal(t, int64(120), row.RequestCount)
		require.Equal(t, int64(60), row.SuccessCount)
		addModelHealthCounters(&total, row)
		metrics := calculateModelHealthMetrics(row)
		require.Equal(t, 50.0, metrics.successRate)
		require.Equal(t, 100.0, metrics.avgLatencyMs)
		require.NotNil(t, metrics.avgTtftMs)
		require.Equal(t, 30.0, *metrics.avgTtftMs)
		require.NotNil(t, metrics.avgTps)
		require.Equal(t, 20.0, *metrics.avgTps)
	}
	require.Equal(t, int64(86400), total.RequestCount)
	require.Equal(t, int64(43200), total.SuccessCount)
	require.Equal(t, int64(8640000), total.TotalLatencyMs)
	require.Equal(t, int64(1296000), total.TtftSumMs)
	require.Equal(t, int64(43200), total.TtftCount)
	require.Equal(t, int64(1728000), total.OutputTokens)
	require.Equal(t, int64(86400000), total.GenerationMs)
}

func TestRollupModelHealthSeriesPreservesNullMetricSemantics(t *testing.T) {
	rows := []model.ModelHealthAggregate{
		{BucketTs: 120, RequestCount: 10, SuccessCount: 10, TotalLatencyMs: 1000, OutputTokens: 100},
		{BucketTs: 180, RequestCount: 10, SuccessCount: 9, TotalLatencyMs: 3000, TtftSumMs: 200},
	}

	rolled := rollupModelHealthSeries(rows, 120, 24*3600, 60)

	require.Len(t, rolled, 1)
	for _, row := range rolled {
		metrics := calculateModelHealthMetrics(row)
		require.Nil(t, metrics.avgTtftMs)
		require.Nil(t, metrics.avgTps)
	}
}

func TestModelHealthDetailRollupSecondsForSupportedMinuteWindows(t *testing.T) {
	require.Equal(t, int64(120), modelHealthDetailRollupSeconds(24*3600, 60))
	require.Equal(t, int64(840), modelHealthDetailRollupSeconds(168*3600, 60))
	require.Equal(t, int64(3600), modelHealthDetailRollupSeconds(720*3600, 60))
}

func TestRollupModelHealthSeriesSortsSparseUnorderedInput(t *testing.T) {
	rows := []model.ModelHealthAggregate{
		{BucketTs: 600, RequestCount: 3},
		{BucketTs: 120, RequestCount: 1},
		{BucketTs: 360, RequestCount: 2},
	}

	rolled := rollupModelHealthSeries(rows, 120, 24*3600, 60)

	require.Equal(t, []model.ModelHealthAggregate{
		{BucketTs: 120, RequestCount: 1},
		{BucketTs: 360, RequestCount: 2},
		{BucketTs: 600, RequestCount: 3},
	}, rolled)
}
