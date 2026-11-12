package perfmetrics

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClassifyRelayOutcome(t *testing.T) {
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	for _, tc := range []struct {
		name string
		ctx  context.Context
		err  *types.NewAPIError
		want Outcome
	}{
		{"success", context.Background(), nil, OutcomeSuccess},
		{"upstream bad request", context.Background(), types.InitOpenAIError("unknown", 400), OutcomeIgnored},
		{"upstream credentials returned as 400", context.Background(), types.InitOpenAIError("invalid_api_key", 400), OutcomeFailure},
		{"wrapped credentials keep their cause", context.Background(), types.NewErrorWithStatusCode(types.InitOpenAIError("invalid_api_key", 400), types.ErrorCodeInvalidRequest, 400), OutcomeFailure},
		{"upstream context limit returned as 500", context.Background(), types.InitOpenAIError("context_length_exceeded", 500), OutcomeIgnored},
		{"local rate limit", context.Background(), types.NewErrorWithStatusCode(errors.New("limited"), types.ErrorCodeInvalidRequest, 429), OutcomeIgnored},
		{"upstream rate limit", context.Background(), types.InitOpenAIError("rate_limit_exceeded", 429), OutcomeIgnored},
		{"upstream rate limit without a known code", context.Background(), types.InitOpenAIError("unknown", 429), OutcomeIgnored},
		{"upstream policy rejection as 451", context.Background(), types.InitOpenAIError("unknown", 451), OutcomeIgnored},
		{"local quota", context.Background(), types.NewError(errors.New("quota"), types.ErrorCodeInsufficientUserQuota), OutcomeIgnored},
		{"local violation fee", context.Background(), types.NewError(errors.New("csam"), types.ErrorCodeViolationFeeGrokCSAM), OutcomeIgnored},
		{"upstream quota", context.Background(), types.InitOpenAIError("insufficient_quota", 429), OutcomeFailure},
		{"upstream gateway quota", context.Background(), types.InitOpenAIError(types.ErrorCodeInsufficientUserQuota, 403), OutcomeFailure},
		{"unavailable channel", context.Background(), types.NewErrorWithStatusCode(errors.New("disabled"), types.ErrorCodeGetChannelFailed, 403), OutcomeFailure},
		{"empty upstream response", context.Background(), types.NewError(errors.New("empty"), types.ErrorCodeEmptyResponse), OutcomeFailure},
		{"network failure", context.Background(), types.NewOpenAIError(errors.New("connection refused"), types.ErrorCodeDoRequestFailed, 500), OutcomeFailure},
		{"connection closed after non-stream response", canceled, nil, OutcomeSuccess},
		{"client cancellation", canceled, types.NewOpenAIError(errors.New("context canceled"), types.ErrorCodeDoRequestFailed, 500), OutcomeIgnored},
		{"client closed after non-stream response", canceled, nil, OutcomeSuccess},
		{"client closed before upstream error", canceled, types.InitOpenAIError("server_error", 500), OutcomeIgnored},
		{"upstream deadline", context.Background(), types.NewOpenAIError(context.DeadlineExceeded, types.ErrorCodeDoRequestFailed, 504), OutcomeFailure},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, ClassifyRelayOutcome(tc.ctx, &relaycommon.RelayInfo{}, tc.err))
		})
	}
	assert.Equal(t, OutcomeIgnored, ClassifyRelayOutcome(context.Background(), &relaycommon.RelayInfo{PerformanceBusinessRejection: true}, nil))
}

func TestStreamOutcomeClassification(t *testing.T) {
	for _, tc := range []struct {
		name string
		mark func(*relaycommon.StreamStatus)
		end  relaycommon.StreamEndReason
		want Outcome
	}{
		{"completed", (*relaycommon.StreamStatus).MarkCompleted, relaycommon.StreamEndReasonEOF, OutcomeSuccess},
		{"business rejection", func(s *relaycommon.StreamStatus) { s.MarkFailed("context_length_exceeded", "", 0) }, relaycommon.StreamEndReasonEOF, OutcomeIgnored},
		{"service error", func(s *relaycommon.StreamStatus) { s.MarkFailed("server_error", "", 0) }, relaycommon.StreamEndReasonEOF, OutcomeFailure},
		{"rate limit event", func(s *relaycommon.StreamStatus) { s.MarkFailed("", "rate_limit_error", 0) }, relaycommon.StreamEndReasonEOF, OutcomeIgnored},
		{"error after completion", func(s *relaycommon.StreamStatus) { s.MarkCompleted(); s.MarkFailed("", "server_error", 0) }, relaycommon.StreamEndReasonEOF, OutcomeFailure},
		{"output limit", func(s *relaycommon.StreamStatus) { s.MarkIncomplete("max_output_tokens") }, relaycommon.StreamEndReasonEOF, OutcomeSuccess},
		{"content filter", func(s *relaycommon.StreamStatus) { s.MarkIncomplete("content_filter") }, relaycommon.StreamEndReasonEOF, OutcomeIgnored},
		{"client cancel", (*relaycommon.StreamStatus).MarkCancelled, relaycommon.StreamEndReasonEOF, OutcomeIgnored},
		{"client gone", nil, relaycommon.StreamEndReasonClientGone, OutcomeIgnored},
		{"timeout", nil, relaycommon.StreamEndReasonTimeout, OutcomeFailure},
		{"missing terminal", nil, relaycommon.StreamEndReasonEOF, OutcomeFailure},
		{"done marker without terminal", nil, relaycommon.StreamEndReasonDone, OutcomeSuccess},
	} {
		t.Run(tc.name, func(t *testing.T) {
			stream := relaycommon.NewStreamStatus()
			stream.RequireTerminal()
			if tc.mark != nil {
				tc.mark(stream)
			}
			stream.SetEndReason(tc.end, nil)
			assert.Equal(t, tc.want, ClassifyRelayOutcome(context.Background(), &relaycommon.RelayInfo{StreamStatus: stream}, nil))
		})
	}
}

func TestClientCancellationDuringUpstreamRead(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	stream := relaycommon.NewStreamStatus()
	stream.RequireTerminal()
	stream.SetEndReason(relaycommon.StreamEndReasonScannerErr, errors.New("reader closed"))
	assert.Equal(t, OutcomeIgnored, ClassifyRelayOutcome(ctx, &relaycommon.RelayInfo{StreamStatus: stream}, nil))
	assert.Equal(t, OutcomeIgnored, ClassifyRelayOutcome(ctx, &relaycommon.RelayInfo{IsStream: true}, nil))

	buffered := relaycommon.NewStreamStatus()
	buffered.RequireTerminal()
	buffered.SetEndReason(relaycommon.StreamEndReasonEOF, nil)
	assert.Equal(t, OutcomeIgnored, ClassifyRelayOutcome(ctx, &relaycommon.RelayInfo{StreamStatus: buffered}, nil))

	deadline := relaycommon.NewStreamStatus()
	deadline.SetEndReason(relaycommon.StreamEndReasonClientGone, context.DeadlineExceeded)
	assert.Equal(t, OutcomeFailure, ClassifyRelayOutcome(context.Background(), &relaycommon.RelayInfo{StreamStatus: deadline}, nil))
}

func TestPerformanceWindowIncludesCurrentHour(t *testing.T) {
	now := time.Date(2026, 9, 14, 12, 37, 0, 0, time.UTC)
	start, end := queryWindow(now, 24)
	assert.Equal(t, time.Date(2026, 9, 13, 13, 0, 0, 0, time.UTC).Unix(), start)
	assert.Equal(t, now.Unix(), end)
}

func TestHourlySuccessSeriesWeightsSmallerBuckets(t *testing.T) {
	points := recentSuccessSeries(map[int64]counters{
		3600: {requestCount: 100, successCount: 100},
		3900: {requestCount: 1},
		7200: {requestCount: 1, successCount: 1},
	})
	assert.Equal(t, []SuccessRatePoint{{Ts: 3600, SuccessRate: 99.01}, {Ts: 7200, SuccessRate: 100}}, points)
}

func TestRecentHistoryRejectsOversizedModelLists(t *testing.T) {
	_, err := QuerySummaryAll(24, nil, make([]string, 51)...)
	require.EqualError(t, err, "Invalid parameters")
}

// Terminal task sampling: success/failure counts, end-to-end latency, and
// token throughput only for successful tasks that report tokens.
func TestRecordTaskResultSamplesTerminalTasks(t *testing.T) {
	hotBuckets.Clear()
	t.Cleanup(func() { hotBuckets.Clear() })
	now := time.Now().Unix()
	RecordTaskResult(&model.Task{
		Status:     model.TaskStatusSuccess,
		Group:      "a",
		SubmitTime: now - 120,
		StartTime:  now - 100,
		FinishTime: now,
		Properties: model.Properties{OriginModelName: "video-model"},
	}, &relaycommon.TaskInfo{TotalTokens: 5000})
	RecordTaskResult(&model.Task{
		Status:     model.TaskStatusFailure,
		Group:      "a",
		SubmitTime: now - 60,
		FinishTime: now,
		Properties: model.Properties{OriginModelName: "video-model"},
	}, relaycommon.FailTaskInfo("boom"))
	RecordTaskResult(&model.Task{Status: model.TaskStatusSuccess, FinishTime: now}, nil)

	assert.Equal(t, map[bucketKey]counters{
		{model: "video-model", group: "a"}: {
			requestCount:   2,
			successCount:   1,
			totalLatencyMs: 180000,
			outputTokens:   5000,
			generationMs:   100000,
		},
	}, mergedHotBuckets())
}

// Immediate submit results: only successes are sampled, timed from relay start.
func TestRecordImmediateTaskResultSamplesSuccessOnly(t *testing.T) {
	hotBuckets.Clear()
	t.Cleanup(func() { hotBuckets.Clear() })
	info := &relaycommon.RelayInfo{OriginModelName: "image-model", UsingGroup: "a", StartTime: time.Now().Add(-2 * time.Second)}
	RecordImmediateTaskResult(info, &relaycommon.TaskInfo{Status: model.TaskStatusSuccess, TotalTokens: 4096})
	RecordImmediateTaskResult(info, relaycommon.FailTaskInfo("boom"))
	RecordImmediateTaskResult(info, &relaycommon.TaskInfo{Status: model.TaskStatusInProgress})
	RecordImmediateTaskResult(info, nil)

	merged := mergedHotBuckets()
	require.Len(t, merged, 1)
	got := merged[bucketKey{model: "image-model", group: "a"}]
	assert.GreaterOrEqual(t, got.totalLatencyMs, int64(2000))
	assert.Equal(t, counters{
		requestCount:   1,
		successCount:   1,
		totalLatencyMs: got.totalLatencyMs,
		outputTokens:   4096,
		generationMs:   got.totalLatencyMs,
	}, got)
}

func mergedHotBuckets() map[bucketKey]counters {
	merged := map[bucketKey]counters{}
	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		k.bucketTs = 0
		mergeCounters(merged, k, value.(*atomicBucket).snapshot())
		return true
	})
	return merged
}

// TEST_PERF_MYSQL_DSN / TEST_PERF_POSTGRES_DSN optionally run the aggregation
// against isolated real MySQL/PostgreSQL databases.
func TestPerformanceAggregationAndFlush(t *testing.T) {
	for _, dialect := range []struct{ name, env string }{
		{"sqlite", ""}, {"mysql", "TEST_PERF_MYSQL_DSN"}, {"postgres", "TEST_PERF_POSTGRES_DSN"},
	} {
		t.Run(dialect.name, func(t *testing.T) {
			dsn := ""
			if dialect.env != "" {
				dsn = os.Getenv(dialect.env)
				if dsn == "" {
					t.Skip("isolated test database DSN is not configured")
				}
			}
			t.Setenv("SQL_DSN", dsn)
			oldDB, oldPath, oldMaster, oldRedis := model.DB, common.SQLitePath, common.IsMasterNode, common.RedisEnabled
			oldType, oldLogType := common.MainDatabaseType(), common.LogDatabaseType()
			common.SQLitePath, common.IsMasterNode, common.RedisEnabled = filepath.Join(t.TempDir(), "perf.db"), false, false
			hotBuckets.Clear()
			t.Cleanup(func() {
				model.DB, common.SQLitePath, common.IsMasterNode, common.RedisEnabled = oldDB, oldPath, oldMaster, oldRedis
				common.SetDatabaseTypes(oldType, oldLogType)
				hotBuckets.Clear()
			})
			require.NoError(t, model.InitDB())
			db := model.DB
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			require.NoError(t, db.Migrator().DropTable(&model.PerfMetric{}))
			require.NoError(t, db.AutoMigrate(&model.PerfMetric{}))
			versionQuery := "SELECT version()"
			if dialect.name == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database version: %s", version)

			now := time.Now()
			start, _ := queryWindow(now, 24)
			hour := now.Unix() - now.Unix()%3600 - 3600
			// Historical counters remain usable without reclassification or migration.
			for _, row := range []model.PerfMetric{
				{ModelName: "test-model", Group: "a", BucketTs: hour, RequestCount: 100, SuccessCount: 100, TotalLatencyMs: 100000, TtftCount: 100, TtftSumMs: 10000, OutputTokens: 200, GenerationMs: 40000},
				{ModelName: "test-model", Group: "inactive", BucketTs: hour, RequestCount: 100},
				{ModelName: "test-model", Group: "a", BucketTs: start - 3600, RequestCount: 100},
			} {
				require.NoError(t, model.UpsertPerfMetric(&row))
			}
			groups := []string{"a", "b"}

			RecordRelayResult(context.Background(), &relaycommon.RelayInfo{OriginModelName: "test-model", UsingGroup: "b", StartTime: now}, types.InitOpenAIError("unknown", 400))
			businessRejected, err := QuerySummaryAll(24, groups)
			require.NoError(t, err)
			require.NotNil(t, businessRejected.Summary)
			assert.Equal(t, 100.0, businessRejected.Summary.SuccessRate)

			failure := &atomicBucket{}
			failure.add(Sample{LatencyMs: 2000})
			hotBuckets.Store(bucketKey{model: "test-model", group: "b", bucketTs: hour}, failure)
			before, err := Query(QueryParams{Model: "test-model", Hours: 24, AllowedGroups: groups})
			require.NoError(t, err)
			require.NotNil(t, before.Summary)
			assert.Equal(t, Summary{SuccessRate: 99.01, AvgLatencyMs: 1009, AvgTps: 5}, *before.Summary)
			assert.Equal(t, start, before.WindowStart)
			require.Len(t, before.Series, 1)
			assert.Equal(t, hour, before.Series[0].Ts)
			assert.InDelta(t, 99.01, before.Series[0].SuccessRate, 0.01)
			require.Len(t, before.Groups, 2)

			summary, err := QuerySummaryAll(24, groups)
			require.NoError(t, err)
			assert.Equal(t, before.Summary, summary.Summary)
			require.Len(t, summary.Models, 1)
			assert.Equal(t, 99.01, summary.Models[0].SuccessRate)
			assert.Equal(t, 99.01, summary.Models[0].RecentSuccessSeries[0].SuccessRate)
			encoded, err := common.Marshal(summary)
			require.NoError(t, err)
			assert.NotContains(t, string(encoded), "request_count")
			assert.NotContains(t, string(encoded), "success_count")

			flushCompletedBuckets()
			flushCompletedBuckets()
			after, err := Query(QueryParams{Model: "test-model", Hours: 24, AllowedGroups: groups})
			require.NoError(t, err)
			assert.Equal(t, before.Summary, after.Summary)
			assert.Equal(t, before.Series, after.Series)

			RecordRelayResult(context.Background(), &relaycommon.RelayInfo{OriginModelName: "test-model", UsingGroup: "a", StartTime: now}, types.InitOpenAIError("context_length_exceeded", 400))
			after, err = Query(QueryParams{Model: "test-model", Hours: 24, AllowedGroups: groups})
			require.NoError(t, err)
			assert.Equal(t, before.Summary, after.Summary)
			onlyA, err := Query(QueryParams{Model: "test-model", Group: "a", Hours: 24, AllowedGroups: groups})
			require.NoError(t, err)
			assert.Equal(t, 100.0, onlyA.Summary.SuccessRate)
			empty, err := Query(QueryParams{Model: "missing", Hours: 24, AllowedGroups: groups})
			require.NoError(t, err)
			assert.Nil(t, empty.Summary)
			assert.Empty(t, empty.Series)

			require.NoError(t, model.UpsertPerfMetric(&model.PerfMetric{ModelName: "second-model", Group: "a", BucketTs: hour, RequestCount: 1}))
			combined, err := QuerySummaryAll(24, groups)
			require.NoError(t, err)
			assert.Equal(t, 98.04, combined.Summary.SuccessRate)
			assert.Equal(t, 99.01, combined.Models[0].SuccessRate)

			t.Run("recent models are summarized over their status sample hours", func(t *testing.T) {
				for i := range 26 {
					require.NoError(t, model.UpsertPerfMetric(&model.PerfMetric{
						ModelName: "history-model", Group: "a", BucketTs: hour - int64(i+1)*6*3600,
						RequestCount: 1, SuccessCount: 1,
					}))
				}
				for _, row := range []model.PerfMetric{
					{ModelName: "history-model", Group: "a", BucketTs: hour + 60, RequestCount: 100, SuccessCount: 100},
					{ModelName: "history-model", Group: "inactive", BucketTs: hour + 120, RequestCount: 100},
					{ModelName: "history-model", Group: "a", BucketTs: hour + 2*3600, RequestCount: 1},
					{ModelName: "history-idle", Group: "a", BucketTs: hour - 3*24*3600, RequestCount: 1},
					{ModelName: "history-hidden", Group: "inactive", BucketTs: hour - 3*24*3600, RequestCount: 1},
				} {
					require.NoError(t, model.UpsertPerfMetric(&row))
				}
				require.NoError(t, db.Create(&model.PerfMetric{ModelName: "history-model", Group: "a", BucketTs: hour - 3600}).Error)
				hotFailure := &atomicBucket{}
				hotFailure.add(Sample{})
				hotBuckets.Store(bucketKey{model: "history-model", group: "b", bucketTs: hour + 120}, hotFailure)
				hotSuccess := &atomicBucket{}
				hotSuccess.add(Sample{Success: true})
				hotBuckets.Store(bucketKey{model: "history-hot", group: "a", bucketTs: hour}, hotSuccess)
				hiddenFailure := &atomicBucket{}
				hiddenFailure.add(Sample{})
				hotBuckets.Store(bucketKey{model: "history-hidden", group: "inactive", bucketTs: hour}, hiddenFailure)

				window, err := QuerySummaryAll(24, groups)
				require.NoError(t, err)
				history, err := QuerySummaryAll(24, groups, "history-model", "history-idle", "history-hidden", "history-hot", "missing")
				require.NoError(t, err)
				assert.Equal(t, window.WindowStart, history.WindowStart)
				summaries := lo.KeyBy(history.Models, func(m ModelSummary) string { return m.ModelName })
				assert.Equal(t, int64(124), summaries["history-model"].RequestCount)
				assert.Equal(t, 99.19, summaries["history-model"].SuccessRate)
				assert.Equal(t, int64(1), summaries["history-idle"].RequestCount)
				assert.Equal(t, 0.0, summaries["history-idle"].SuccessRate)
				assert.NotContains(t, summaries, "history-hidden")
				points := history.RecentSuccessSeries["history-model"]
				require.Len(t, points, 24)
				expected := make([]SuccessRatePoint, 0, 24)
				for i := 23; i > 0; i-- {
					expected = append(expected, SuccessRatePoint{Ts: hour - int64(i)*6*3600, SuccessRate: 100})
				}
				expected = append(expected, SuccessRatePoint{Ts: hour, SuccessRate: 99.01})
				assert.Equal(t, expected, points)
				assert.Equal(t, []SuccessRatePoint{{Ts: hour - 3*24*3600, SuccessRate: 0}}, history.RecentSuccessSeries["history-idle"])
				assert.Equal(t, []SuccessRatePoint{{Ts: hour, SuccessRate: 100}}, history.RecentSuccessSeries["history-hot"])
				assert.Empty(t, history.RecentSuccessSeries["history-hidden"])
				assert.Empty(t, history.RecentSuccessSeries["missing"])

				denied, err := QuerySummaryAll(24, []string{}, "history-model", "history-hidden")
				require.NoError(t, err)
				assert.Empty(t, denied.RecentSuccessSeries)
				flushCompletedBuckets()
				persisted, err := QuerySummaryAll(24, groups, "history-model", "history-hot")
				require.NoError(t, err)
				assert.Equal(t, points, persisted.RecentSuccessSeries["history-model"])
				assert.Equal(t, history.RecentSuccessSeries["history-hot"], persisted.RecentSuccessSeries["history-hot"])
			})

			t.Run("recent history stops at the 7 day boundary even with fewer than 24 samples", func(t *testing.T) {
				historyStart, _ := queryWindow(now, 7*24)
				for _, row := range []model.PerfMetric{
					{ModelName: "history-boundary", Group: "a", BucketTs: historyStart, RequestCount: 1, SuccessCount: 1},
					{ModelName: "history-boundary", Group: "a", BucketTs: historyStart - 3600, RequestCount: 1},
					{ModelName: "history-expired", Group: "a", BucketTs: historyStart - 3600, RequestCount: 1},
				} {
					require.NoError(t, model.UpsertPerfMetric(&row))
				}
				hotExpired := &atomicBucket{}
				hotExpired.add(Sample{Success: true})
				hotBuckets.Store(bucketKey{model: "history-hot-expired", group: "a", bucketTs: historyStart - 3600}, hotExpired)
				hotBoundary := &atomicBucket{}
				hotBoundary.add(Sample{Success: true})
				hotBuckets.Store(bucketKey{model: "history-hot-boundary", group: "a", bucketTs: historyStart}, hotBoundary)

				history, err := QuerySummaryAll(24, groups, "history-boundary", "history-expired", "history-hot-expired", "history-hot-boundary")
				require.NoError(t, err)
				assert.Equal(t, []SuccessRatePoint{{Ts: historyStart, SuccessRate: 100}}, history.RecentSuccessSeries["history-boundary"])
				assert.Equal(t, []SuccessRatePoint{{Ts: historyStart, SuccessRate: 100}}, history.RecentSuccessSeries["history-hot-boundary"])
				assert.Empty(t, history.RecentSuccessSeries["history-expired"])
				assert.Empty(t, history.RecentSuccessSeries["history-hot-expired"])
			})
		})
	}
}

func recordLiveSamples(at time.Time, group string, modelName string, successes int, failures int) {
	for i := range successes + failures {
		recordLive(Sample{Group: group, Model: modelName, Success: i < successes}, at)
	}
}

func TestLiveSuccessRatesAroundUsageLogs(t *testing.T) {
	oldRedis := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = oldRedis
		liveMinutes.Clear()
	})
	now := time.Unix(1_800_000_000, 0)
	logAt := now.Add(-10 * time.Minute)
	recordLiveSamples(logAt.Add(-2*time.Minute), "pro", "gpt", 6, 1)
	recordLiveSamples(logAt, "pro", "gpt", 2, 1)
	recordLiveSamples(logAt.Add(3*time.Minute), "pro", "gpt", 0, 50)
	recordLiveSamples(logAt, "pro", "rare", 1, 1)
	recordLiveSamples(logAt, "hidden", "gpt", 5, 0)
	recordLiveSamples(now.Add(-25*time.Hour), "pro", "gpt", 5, 0)

	result := QueryLiveSuccessRates(now, []LiveComparePoint{
		{CreatedAt: logAt.Unix(), Group: "pro", ModelName: "gpt"},
		{CreatedAt: logAt.Unix(), Group: "pro", ModelName: "rare"},
		{CreatedAt: logAt.Unix(), Group: "hidden", ModelName: "gpt"},
		{CreatedAt: now.Add(-25 * time.Hour).Unix(), Group: "pro", ModelName: "gpt"},
		{CreatedAt: now.Add(time.Hour).Unix(), Group: "pro", ModelName: "gpt"},
	}, map[string]string{"pro": ""})

	assert.Equal(t, 5, result.WindowMinutes)
	rates := result.SuccessRates
	require.Len(t, rates, 5)
	require.NotNil(t, rates[0], "minutes within two of the log count, the burst three minutes later does not")
	assert.Equal(t, 80.0, *rates[0])
	assert.Nil(t, rates[1], "fewer than the minimum samples")
	assert.Nil(t, rates[2], "group the viewer cannot use")
	assert.Nil(t, rates[3], "older than retention")
	assert.Nil(t, rates[4], "in the future")
}

func TestLiveStatusReportsUsableGroupsWithTraffic(t *testing.T) {
	oldRedis := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = oldRedis
		liveMinutes.Clear()
	})
	now := time.Unix(1_800_000_030, 0)
	recordLiveSamples(now, "pro", "gpt", 3, 1)
	recordLiveSamples(now.Add(-30*time.Minute), "pro", "gpt", 0, 4)
	recordLiveSamples(now.Add(-30*time.Minute), "pro", "claude", 1, 0)
	recordLiveSamples(now.Add(-61*time.Minute), "pro", "gpt", 0, 9)
	recordLiveSamples(now, "hidden", "gpt", 5, 0)

	require.NoError(t, setting.UpdateGroupVendorByJSONString(`{"pro":"openai"}`))
	t.Cleanup(func() { _ = setting.UpdateGroupVendorByJSONString("") })

	result := QueryLiveStatus(now, map[string]string{"pro": "Pro group", "idle": ""})

	assert.Equal(t, liveMinuteStart(now.Unix()), result.WindowEnd)
	assert.Equal(t, result.WindowEnd-59*60, result.WindowStart)
	require.Len(t, result.Groups, 1, "groups without traffic and groups the viewer cannot use are left out")
	group := result.Groups[0]
	assert.Equal(t, "pro", group.Group)
	assert.Equal(t, "Pro group", group.Description)
	assert.Equal(t, "openai", group.Vendor)
	require.NotNil(t, group.ShortSuccessRate)
	assert.Equal(t, 75.0, *group.ShortSuccessRate)
	require.NotNil(t, group.WindowSuccessRate)
	assert.Equal(t, 44.44, *group.WindowSuccessRate)

	require.Len(t, group.Models, 2)
	claude, gpt := group.Models[0], group.Models[1]
	assert.Equal(t, "claude", claude.ModelName)
	require.NotNil(t, claude.WindowSuccessRate, "a single successful request still reads as working")
	assert.Equal(t, 100.0, *claude.WindowSuccessRate)
	assert.Nil(t, claude.ShortSuccessRate, "no requests in the short window")
	assert.Equal(t, []LiveMinutePoint{{Ts: liveMinuteStart(now.Add(-30 * time.Minute).Unix()), SuccessRate: 100}}, claude.Minutes)
	assert.Equal(t, "gpt", gpt.ModelName)
	require.NotNil(t, gpt.WindowSuccessRate)
	assert.Equal(t, 37.5, *gpt.WindowSuccessRate)
	require.Len(t, gpt.Minutes, 2)
	assert.Less(t, gpt.Minutes[0].Ts, gpt.Minutes[1].Ts)
	assert.Equal(t, 0.0, gpt.Minutes[0].SuccessRate)
}

// useLiveMiniRedis points the live metrics at a fresh in-memory Redis and
// resets every piece of live state when the test ends.
func useLiveMiniRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	oldEnabled, oldClient := common.RedisEnabled, common.RDB
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	common.RedisEnabled, common.RDB = true, client
	t.Cleanup(func() {
		_ = client.Close()
		common.RedisEnabled, common.RDB = oldEnabled, oldClient
		liveMinutes.Clear()
		liveCacheMu.Lock()
		clear(liveCache)
		liveCacheMu.Unlock()
		liveStatusFetchFailedAt = time.Time{}
	})
	return server
}

func setLiveRedisCounts(server *miniredis.Miniredis, minuteTs int64, group string, modelName string, requests int, successes int) {
	requestKey, successKey := liveRedisKeys(minuteTs)
	field := group + liveRedisFieldSep + modelName
	server.HSet(requestKey, field, strconv.Itoa(requests))
	server.HSet(successKey, field, strconv.Itoa(successes))
}

func TestLiveRedisFlushSendsEachCountOnce(t *testing.T) {
	server := useLiveMiniRedis(t)
	now := time.Unix(1_800_000_030, 0)
	requestKey, successKey := liveRedisKeys(liveMinuteStart(now.Unix()))
	field := "pro" + liveRedisFieldSep + "gpt"

	recordLiveSamples(now, "pro", "gpt", 3, 1)
	flushLiveRedis(now)
	flushLiveRedis(now)
	assert.Equal(t, "4", server.HGet(requestKey, field), "a second flush with nothing new adds nothing")
	assert.Equal(t, "3", server.HGet(successKey, field))
	assert.Positive(t, server.TTL(requestKey))
	assert.Positive(t, server.TTL(successKey))

	server.Close()
	recordLiveSamples(now, "pro", "gpt", 1, 1)
	flushLiveRedis(now)
	require.NoError(t, server.Restart())
	assert.Equal(t, "4", server.HGet(requestKey, field), "a failed flush adds nothing")
	flushLiveRedis(now.Add(liveFlushInterval))
	assert.Equal(t, "6", server.HGet(requestKey, field), "counts held back by the failure are sent once Redis is back")
	assert.Equal(t, "4", server.HGet(successKey, field))

	old := now.Add(-liveFlushHorizon - 2*time.Minute)
	recordLiveSamples(old, "pro", "gpt", 1, 0)
	flushLiveRedis(now)
	oldKey, _ := liveRedisKeys(liveMinuteStart(old.Unix()))
	assert.False(t, server.Exists(oldKey), "minutes past the flush horizon are not sent")
}

func TestLiveStatusReusesRedisMinutesUntilTheyCanChange(t *testing.T) {
	server := useLiveMiniRedis(t)
	now := time.Unix(1_800_000_030, 0)
	current := liveMinuteStart(now.Unix())
	settled := current - 30*liveBucketSeconds
	groups := map[string]string{"pro": ""}
	setLiveRedisCounts(server, settled, "pro", "gpt", 4, 0)
	setLiveRedisCounts(server, current, "pro", "gpt", 4, 4)

	first := QueryLiveStatus(now, groups)
	require.Len(t, first.Groups, 1)
	require.NotNil(t, first.Groups[0].WindowSuccessRate)
	assert.Equal(t, 50.0, *first.Groups[0].WindowSuccessRate)

	commands := server.CommandCount()
	again := QueryLiveStatus(now.Add(5*time.Second), groups)
	assert.Equal(t, commands, server.CommandCount(), "a reload within the cache TTL does not read Redis")
	assert.Equal(t, first.Groups, again.Groups)

	setLiveRedisCounts(server, settled, "pro", "gpt", 4, 4)
	setLiveRedisCounts(server, current, "pro", "gpt", 8, 4)
	later := QueryLiveStatus(now.Add(liveCacheTTL+time.Second), groups)
	require.Len(t, later.Groups, 1)
	require.NotNil(t, later.Groups[0].WindowSuccessRate)
	// The settled minute keeps 0 of 4 from the first read; the current minute
	// is read again and now holds 4 of 8.
	assert.Equal(t, 33.33, *later.Groups[0].WindowSuccessRate)
	require.NotNil(t, later.Groups[0].ShortSuccessRate)
	assert.Equal(t, 50.0, *later.Groups[0].ShortSuccessRate)
}

func TestLiveSuccessRatesReadFlushedCountsFromRedis(t *testing.T) {
	useLiveMiniRedis(t)
	now := time.Unix(1_800_000_000, 0)
	logAt := now.Add(-5 * time.Minute)
	recordLiveSamples(logAt.Add(-2*time.Minute), "pro", "gpt", 6, 1)
	recordLiveSamples(logAt, "pro", "gpt", 2, 1)
	recordLiveSamples(logAt, "pro", "claude", 9, 0)
	flushLiveRedis(now)
	liveMinutes.Clear()

	result := QueryLiveSuccessRates(now, []LiveComparePoint{
		{CreatedAt: logAt.Unix(), Group: "pro", ModelName: "gpt"},
		{CreatedAt: logAt.Unix(), Group: "pro", ModelName: "missing"},
	}, map[string]string{"pro": ""})

	require.Len(t, result.SuccessRates, 2)
	require.NotNil(t, result.SuccessRates[0], "only Redis holds the counts now")
	assert.Equal(t, 80.0, *result.SuccessRates[0])
	assert.Nil(t, result.SuccessRates[1])
}

func TestLiveSuccessRatesStopAtTheMinuteBudget(t *testing.T) {
	oldRedis := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = oldRedis
		liveMinutes.Clear()
	})
	now := time.Unix(1_800_000_000, 0)
	// Each point reads its own five minutes, so 30 points use the whole budget.
	points := make([]LiveComparePoint, 0, 31)
	for i := range 31 {
		at := now.Add(-time.Duration(i*10+5) * time.Minute)
		recordLiveSamples(at, "pro", "gpt", 3, 0)
		points = append(points, LiveComparePoint{CreatedAt: at.Unix(), Group: "pro", ModelName: "gpt"})
	}

	rates := QueryLiveSuccessRates(now, points, map[string]string{"pro": ""}).SuccessRates

	require.Len(t, rates, 31)
	for i := range 30 {
		require.NotNil(t, rates[i])
		assert.Equal(t, 100.0, *rates[i])
	}
	assert.Nil(t, rates[30], "a point past the minute budget gets no rate")
}

func TestPruneLiveMinutesDropsExpiredMinutes(t *testing.T) {
	t.Cleanup(func() { liveMinutes.Clear() })
	now := time.Unix(1_800_000_000, 0)
	recordLiveSamples(now.Add(-liveRetention-time.Minute), "pro", "gpt", 1, 0)
	recordLiveSamples(now.Add(-time.Hour), "pro", "gpt", 1, 0)

	pruneLiveMinutes(now)

	_, expiredKept := liveMinutes.Load(liveMinuteStart(now.Add(-liveRetention - time.Minute).Unix()))
	_, recentKept := liveMinutes.Load(liveMinuteStart(now.Add(-time.Hour).Unix()))
	assert.False(t, expiredKept)
	assert.True(t, recentKept)
}
