package perfmetrics

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func resetPerfMetricsStateForTest(t *testing.T) {
	t.Helper()
	hotBuckets = sync.Map{}
	prometheusPendingBuckets = sync.Map{}
	prometheusChannelBuckets = sync.Map{}
	prometheusChannelModelBuckets = sync.Map{}
	prometheusModelPerformanceBuckets = sync.Map{}
	prometheusRecallTranslationBuckets = sync.Map{}
	prometheusRecallTranslationDurationBuckets = sync.Map{}
	prometheusModelAdmissionMu = sync.Mutex{}
	prometheusModelDroppedSamples = prometheusModelDropCounters{}
	resetBytePlusRealPersonMetricsForTest()
}

func TestRecordRelaySampleCapturesSuccessfulModelLatencyAndTTFT(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	now := time.Now()
	startedAt := now.Add(-2 * time.Second)
	streamStatus := relaycommon.NewStreamStatus()
	streamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)
	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName:   "gpt-5",
		StartTime:         startedAt,
		FirstResponseTime: startedAt.Add(250 * time.Millisecond),
		IsStream:          true,
		StreamStatus:      streamStatus,
		ChannelMeta:       &relaycommon.ChannelMeta{ChannelId: 42},
	}, true, 12, nil)

	snapshots := snapshotPrometheusModelPerformances(time.Now())
	require.Len(t, snapshots, 1)
	snapshot := snapshots[0]
	require.Equal(t, "gpt-5", snapshot.model)
	require.EqualValues(t, 1, snapshot.latencyCount)
	require.InDelta(t, 2, snapshot.latencySumSeconds, 0.1)
	require.EqualValues(t, 1, snapshot.streamSuccess)
	require.EqualValues(t, 1, snapshot.ttftCount)
	require.InDelta(t, 0.25, snapshot.ttftSumSeconds, 0.01)
	require.Empty(t, snapshot.errors)
}

func TestRecordRelaySampleNormalizesAbnormalStreamOutcomes(t *testing.T) {
	tests := []struct {
		name          string
		endReason     relaycommon.StreamEndReason
		recordError   bool
		errorCategory string
	}{
		{
			name:          "client gone",
			endReason:     relaycommon.StreamEndReasonClientGone,
			errorCategory: "client_cancel",
		},
		{
			name:          "stream timeout",
			endReason:     relaycommon.StreamEndReasonTimeout,
			errorCategory: "timeout",
		},
		{
			name:          "first response timeout",
			endReason:     relaycommon.StreamEndReasonFirstResponseTimeout,
			errorCategory: "timeout",
		},
		{
			name:          "soft stream error",
			endReason:     relaycommon.StreamEndReasonDone,
			recordError:   true,
			errorCategory: "other",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resetPerfMetricsStateForTest(t)

			startedAt := time.Now().Add(-2 * time.Second)
			streamStatus := relaycommon.NewStreamStatus()
			streamStatus.SetEndReason(tt.endReason, nil)
			if tt.recordError {
				streamStatus.RecordError("upstream sent a malformed event")
			}
			RecordRelaySample(&relaycommon.RelayInfo{
				OriginModelName:   "gpt-5",
				StartTime:         startedAt,
				FirstResponseTime: startedAt.Add(250 * time.Millisecond),
				IsStream:          true,
				StreamStatus:      streamStatus,
				ChannelMeta:       &relaycommon.ChannelMeta{ChannelId: 42},
			}, true, 12, nil)

			snapshots := snapshotPrometheusModelPerformances(time.Now())
			require.Len(t, snapshots, 1)
			snapshot := snapshots[0]
			require.Equal(t, "gpt-5", snapshot.model)
			require.Equal(t, map[string]int64{tt.errorCategory: 1}, snapshot.errors)
			require.EqualValues(t, 0, snapshot.latencyCount)
			require.Zero(t, snapshot.latencySumSeconds)
			require.EqualValues(t, 0, snapshot.ttftCount)
			require.Zero(t, snapshot.ttftSumSeconds)
			require.EqualValues(t, 0, snapshot.streamSuccess)

			text, err := BuildPrometheusText(context.Background())
			require.NoError(t, err)
			require.Equal(t, []string{
				"newapi_perf_metrics_series 7",
				`newapi_model_requests_total{model="gpt-5",status="error"} 1`,
				fmt.Sprintf(`newapi_model_errors_total{model="gpt-5",error_category="%s"} 1`, tt.errorCategory),
				"newapi_model_histogram_active_models 1",
				`newapi_model_histogram_dropped_samples_total{reason="model_limit"} 0`,
				`newapi_model_histogram_dropped_samples_total{reason="invalid_latency"} 0`,
				`newapi_model_histogram_dropped_samples_total{reason="invalid_ttft"} 0`,
				`newapi_model_histogram_dropped_samples_total{reason="series_limit"} 0`,
			}, prometheusSampleLines(text))
		})
	}
}

func TestRecordRelaySampleKeepsFinalFailureOutOfLatency(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName: "gpt-5",
		StartTime:       time.Now().Add(-time.Second),
		IsStream:        true,
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 42},
	}, false, 0, types.NewErrorWithStatusCode(
		context.DeadlineExceeded,
		types.ErrorCodeDoRequestFailed,
		http.StatusGatewayTimeout,
	))

	snapshots := snapshotPrometheusModelPerformances(time.Now())
	require.Len(t, snapshots, 1)
	snapshot := snapshots[0]
	require.Equal(t, map[string]int64{"timeout": 1}, snapshot.errors)
	require.EqualValues(t, 0, snapshot.latencyCount)
	require.Zero(t, snapshot.latencySumSeconds)
	require.EqualValues(t, 0, snapshot.ttftCount)
	require.Zero(t, snapshot.ttftSumSeconds)
	require.EqualValues(t, 0, snapshot.streamSuccess)
}

func TestRecordRelaySampleCountsStreamWithoutFirstToken(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName:   "gpt-5",
		StartTime:         time.Now().Add(-2 * time.Second),
		FirstResponseTime: time.Time{},
		IsStream:          true,
		ChannelMeta:       &relaycommon.ChannelMeta{ChannelId: 42},
	}, true, 0, nil)

	snapshots := snapshotPrometheusModelPerformances(time.Now())
	require.Len(t, snapshots, 1)
	require.EqualValues(t, 1, snapshots[0].latencyCount)
	require.EqualValues(t, 1, snapshots[0].streamSuccess)
	require.EqualValues(t, 0, snapshots[0].ttftCount)
	require.Zero(t, snapshots[0].ttftSumSeconds)
	require.Empty(t, snapshots[0].errors)
	require.EqualValues(t, 0, prometheusModelDroppedSamples.snapshot()[modelDropInvalidTTFT])
}

func TestRecordRelaySampleCountsLegacySentinelAsMissingFirstToken(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	startedAt := time.Now().Add(-2 * time.Second)
	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName:   "gpt-5",
		StartTime:         startedAt,
		FirstResponseTime: startedAt.Add(-time.Second),
		IsStream:          true,
		ChannelMeta:       &relaycommon.ChannelMeta{ChannelId: 42},
	}, true, 0, nil)

	snapshots := snapshotPrometheusModelPerformances(time.Now())
	require.Len(t, snapshots, 1)
	require.EqualValues(t, 1, snapshots[0].latencyCount)
	require.EqualValues(t, 1, snapshots[0].streamSuccess)
	require.EqualValues(t, 0, snapshots[0].ttftCount)
	require.Zero(t, snapshots[0].ttftSumSeconds)
	require.Empty(t, snapshots[0].errors)
	require.EqualValues(t, 0, prometheusModelDroppedSamples.snapshot()[modelDropInvalidTTFT])
}

func TestRecordRelaySampleRejectsInvalidTimestamps(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	now := time.Now()
	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName:   "gpt-5",
		StartTime:         now.Add(time.Minute),
		FirstResponseTime: now.Add(-time.Minute),
		IsStream:          true,
		ChannelMeta:       &relaycommon.ChannelMeta{ChannelId: 42},
	}, true, 0, nil)

	snapshots := snapshotPrometheusModelPerformances(time.Now())
	require.Len(t, snapshots, 1)
	require.EqualValues(t, 0, snapshots[0].latencyCount)
	require.Zero(t, snapshots[0].latencySumSeconds)
	require.EqualValues(t, 0, snapshots[0].ttftCount)
	require.Zero(t, snapshots[0].ttftSumSeconds)
	require.EqualValues(t, 1, snapshots[0].streamSuccess)
	require.Empty(t, snapshots[0].errors)
	dropped := prometheusModelDroppedSamples.snapshot()
	require.EqualValues(t, 1, dropped[modelDropInvalidLatency])
	require.EqualValues(t, 1, dropped[modelDropInvalidTTFT])
}

func TestRecordRelaySampleClassifiesNilFinalFailureAsOther(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName: "gpt-5",
		StartTime:       time.Now().Add(-time.Second),
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 42},
	}, false, 0, nil)

	snapshots := snapshotPrometheusModelPerformances(time.Now())
	require.Len(t, snapshots, 1)
	require.EqualValues(t, 1, snapshots[0].errors["other"])
	require.NotContains(t, snapshots[0].errors, "none")
}

func TestRecordRelaySampleEnforcesConfigurableActiveModelLimit(t *testing.T) {
	t.Run("rejects next active model", func(t *testing.T) {
		resetPerfMetricsStateForTest(t)
		t.Setenv(prometheusMaxModelHistogramModelsEnv, "1")

		RecordRelaySample(&relaycommon.RelayInfo{OriginModelName: "gpt-5", StartTime: time.Now().Add(-time.Second), ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 42}}, true, 0, nil)
		RecordRelaySample(&relaycommon.RelayInfo{OriginModelName: "gpt-5-mini", StartTime: time.Now().Add(-time.Second), ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 42}}, true, 0, nil)

		snapshots := snapshotPrometheusModelPerformances(time.Now())
		require.Len(t, snapshots, 1)
		require.Equal(t, "gpt-5", snapshots[0].model)
		require.EqualValues(t, 1, prometheusModelDroppedSamples.snapshot()[modelDropModelLimit])
	})

	t.Run("non-positive limit disables cap", func(t *testing.T) {
		resetPerfMetricsStateForTest(t)
		t.Setenv(prometheusMaxModelHistogramModelsEnv, "0")

		RecordRelaySample(&relaycommon.RelayInfo{OriginModelName: "gpt-5", StartTime: time.Now().Add(-time.Second), ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 42}}, true, 0, nil)
		RecordRelaySample(&relaycommon.RelayInfo{OriginModelName: "gpt-5-mini", StartTime: time.Now().Add(-time.Second), ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 42}}, true, 0, nil)

		require.Len(t, snapshotPrometheusModelPerformances(time.Now()), 2)
		require.EqualValues(t, 0, prometheusModelDroppedSamples.snapshot()[modelDropModelLimit])
	})
}

func TestPrometheusModelAdmissionHonorsCapConcurrently(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxModelHistogramModelsEnv, "3")

	const attempts = 64
	start := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(attempts)
	for i := 0; i < attempts; i++ {
		go func(modelIndex int) {
			defer wg.Done()
			<-start
			RecordRelaySample(&relaycommon.RelayInfo{
				OriginModelName: fmt.Sprintf("model-%d", modelIndex),
				StartTime:       time.Now().Add(-time.Second),
				ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 42},
			}, true, 0, nil)
		}(i)
	}

	close(start)
	wg.Wait()

	snapshots := snapshotPrometheusModelPerformances(time.Now())
	require.LessOrEqual(t, len(snapshots), 3)
	var admittedSamples int64
	for _, snapshot := range snapshots {
		admittedSamples += snapshot.latencyCount
	}
	droppedSamples := prometheusModelDroppedSamples.snapshot()[modelDropModelLimit]
	require.EqualValues(t, attempts, admittedSamples+droppedSamples)
}

func TestPrometheusModelMutationRetriesAfterConcurrentRetirement(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	now := time.Now()
	retiredBucket := newPrometheusModelPerformanceBucket(now)
	retiredBucket.mu.Lock()
	retiredBucket.retired = true
	retiredBucket.mu.Unlock()

	loadCount := 0
	var replacementBucket *prometheusModelPerformanceBucket
	latencySeconds := 0.5
	mutatePrometheusModelPerformanceWithLoader(
		"gpt-5",
		now,
		func(model string, loadTime time.Time) (*prometheusModelPerformanceBucket, bool) {
			loadCount++
			if loadCount == 1 {
				prometheusModelPerformanceBuckets.Store(model, retiredBucket)
				return retiredBucket, true
			}
			bucket, admitted := loadOrCreatePrometheusModelBucket(model, loadTime)
			replacementBucket = bucket
			return bucket, admitted
		},
		func(bucket *prometheusModelPerformanceBucket) bool {
			return bucket.addSuccess(now, &latencySeconds, false, nil)
		},
	)

	require.Equal(t, 2, loadCount)
	require.NotNil(t, replacementBucket)
	require.NotSame(t, retiredBucket, replacementBucket)
	replacementSnapshot, ok := replacementBucket.snapshot("gpt-5")
	require.True(t, ok)
	require.EqualValues(t, 1, replacementSnapshot.latencyCount)
	require.InDelta(t, latencySeconds, replacementSnapshot.latencySumSeconds, 0.001)
	retiredBucket.mu.Lock()
	require.EqualValues(t, 0, retiredBucket.latencyCount)
	retiredBucket.mu.Unlock()
}

func TestPrometheusModelIdleRetirementAllowsReplacement(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxModelHistogramModelsEnv, "1")

	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName: "stale-model",
		StartTime:       time.Now().Add(-time.Second),
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 42},
	}, true, 0, nil)
	value, ok := prometheusModelPerformanceBuckets.Load("stale-model")
	require.True(t, ok)
	staleBucket := value.(*prometheusModelPerformanceBucket)
	staleBucket.mu.Lock()
	staleBucket.lastUpdatedAt = time.Now().Add(-prometheusModelIdleRetention - time.Minute).UnixNano()
	staleBucket.mu.Unlock()

	require.Empty(t, snapshotPrometheusModelPerformances(time.Now()))
	_, ok = prometheusModelPerformanceBuckets.Load("stale-model")
	require.False(t, ok)

	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName: "replacement-model",
		StartTime:       time.Now().Add(-time.Second),
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 42},
	}, true, 0, nil)
	snapshots := snapshotPrometheusModelPerformances(time.Now())
	require.Len(t, snapshots, 1)
	require.Equal(t, "replacement-model", snapshots[0].model)
	require.EqualValues(t, 0, prometheusModelDroppedSamples.snapshot()[modelDropModelLimit])
}

func TestPrometheusModelAdmissionRejectsFiftyFirstActiveModel(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxModelHistogramModelsEnv, fmt.Sprintf("%d", defaultPrometheusMaxModelHistogramModels))

	for i := 0; i < defaultPrometheusMaxModelHistogramModels+1; i++ {
		RecordRelaySample(&relaycommon.RelayInfo{
			OriginModelName: fmt.Sprintf("model-%02d", i),
			StartTime:       time.Now().Add(-time.Second),
			ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 42},
		}, true, 0, nil)
	}

	require.Len(t, snapshotPrometheusModelPerformances(time.Now()), defaultPrometheusMaxModelHistogramModels)
	require.EqualValues(t, 1, prometheusModelDroppedSamples.snapshot()[modelDropModelLimit])
}

func TestPrometheusModelAdmissionRecordsOneThousandConcurrentSamples(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	const records = 1000
	startedAt := time.Now().Add(-time.Second)
	start := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(records)
	for i := 0; i < records; i++ {
		go func() {
			defer wg.Done()
			<-start
			RecordRelaySample(&relaycommon.RelayInfo{
				OriginModelName: "gpt-5",
				StartTime:       startedAt,
				ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 42},
			}, true, 0, nil)
		}()
	}

	close(start)
	wg.Wait()

	snapshots := snapshotPrometheusModelPerformances(time.Now())
	require.Len(t, snapshots, 1)
	require.EqualValues(t, records, snapshots[0].latencyCount)
	require.EqualValues(t, 0, prometheusModelDroppedSamples.snapshot()[modelDropModelLimit])
}

func TestPrometheusModelSeriesBudgetPreservesBaseMetrics(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "29")

	startedAt := time.Now().Add(-1500 * time.Millisecond)
	info := &relaycommon.RelayInfo{
		OriginModelName:   "gpt-5",
		StartTime:         startedAt,
		FirstResponseTime: startedAt.Add(250 * time.Millisecond),
		IsStream:          true,
		ChannelMeta:       &relaycommon.ChannelMeta{ChannelId: 42},
	}
	RecordRelaySample(info, true, 12, nil)
	RecordChannelAttempt(info, 42, "primary", startedAt, nil)
	RecordChannelTokens(info, 120, 30)

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, text, `newapi_model_requests_total{model="gpt-5",status="success"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_channel_info{channel_id="42",channel_name="primary"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_channel_model_attempts_total{channel_id="42",model="gpt-5",status="success"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_channel_model_input_tokens_total{channel_id="42",model="gpt-5"} 120`)
	requirePrometheusSampleLine(t, text, `newapi_channel_model_output_tokens_total{channel_id="42",model="gpt-5"} 30`)
	require.NotContains(t, text, `newapi_model_request_duration_seconds_bucket{model="gpt-5"`)
	requirePrometheusSampleLine(t, text, `newapi_model_histogram_dropped_samples_total{reason="series_limit"} 2`)
	requirePrometheusSampleLine(t, text, "newapi_perf_metrics_series 29")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
}

func TestPrometheusModelSeriesBudgetKeepsCompleteTTFTCoverageGroups(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "38")

	recordSuccessfulPrometheusModelStreamForTest("older-model")
	recordSuccessfulPrometheusModelStreamForTest("newer-model")
	setPrometheusModelLastUpdatedForTest(t, "older-model", time.Now().Add(-time.Minute))
	setPrometheusModelLastUpdatedForTest(t, "newer-model", time.Now())

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, text, `newapi_model_request_duration_seconds_count{model="newer-model"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_model_ttft_seconds_count{model="newer-model"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_model_stream_success_total{model="newer-model"} 1`)
	require.NotContains(t, text, `newapi_model_request_duration_seconds_count{model="older-model"}`)
	require.NotContains(t, text, `newapi_model_ttft_seconds_count{model="older-model"}`)
	require.NotContains(t, text, `newapi_model_stream_success_total{model="older-model"}`)
	requirePrometheusSampleLine(t, text, `newapi_model_histogram_dropped_samples_total{reason="series_limit"} 2`)
	requirePrometheusSampleLine(t, text, "newapi_perf_metrics_series 38")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
}

func TestSelectPrometheusModelSnapshotsStopsAtFirstGroupThatExceedsBudget(t *testing.T) {
	now := time.Now()
	latencySeconds := 1.5
	newestBucket := newPrometheusModelPerformanceBucket(now)
	require.True(t, newestBucket.addSuccess(now, &latencySeconds, false, nil))
	newestSnapshot, ok := newestBucket.snapshot("newest-latency-model")
	require.True(t, ok)
	require.Equal(t, 16, newestSnapshot.seriesCount())

	olderBucket := newPrometheusModelPerformanceBucket(now.Add(-time.Minute))
	require.True(t, olderBucket.addError(now.Add(-time.Minute), "other"))
	olderSnapshot, ok := olderBucket.snapshot("older-error-model")
	require.True(t, ok)
	require.Equal(t, 1, olderSnapshot.seriesCount())

	selected, dropped := selectPrometheusModelSnapshots(
		[]prometheusModelPerformanceSnapshot{newestSnapshot, olderSnapshot},
		15,
	)
	require.Empty(t, selected)
	require.EqualValues(t, 1, dropped)
}

func TestPrometheusModelSeriesBudgetNeverBackfillsOlderSmallGroups(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "20")

	now := time.Now()
	latencySeconds := 1.5
	newestBucket := newPrometheusModelPerformanceBucket(now)
	require.True(t, newestBucket.addSuccess(now, &latencySeconds, false, nil))
	prometheusModelPerformanceBuckets.Store("newest-latency-model", newestBucket)

	olderBucket := newPrometheusModelPerformanceBucket(now.Add(-time.Minute))
	require.True(t, olderBucket.addError(now.Add(-time.Minute), "other"))
	prometheusModelPerformanceBuckets.Store("older-error-model", olderBucket)

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.NotContains(t, text, "newapi_model_request_duration_seconds")
	require.NotContains(t, text, `newapi_model_errors_total{model="older-error-model"`)
	requirePrometheusSampleLine(t, text, "newapi_model_histogram_active_models 2")
	requirePrometheusSampleLine(t, text, `newapi_model_histogram_dropped_samples_total{reason="series_limit"} 1`)
	requirePrometheusSampleLine(t, text, "newapi_perf_metrics_series 5")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
}

func TestRecordRelaySampleProductionCallSitesAreSynchronous(t *testing.T) {
	productionFiles := []string{
		filepath.Join("..", "..", "controller", "relay.go"),
		filepath.Join("..", "..", "service", "quota.go"),
		filepath.Join("..", "..", "service", "text_quota.go"),
	}
	asyncCall := regexp.MustCompile(`(?s)gopool\.Go\(func\(\) \{.{0,256}perfmetrics\.RecordRelaySample\(`)
	totalCalls := 0
	for _, path := range productionFiles {
		source, err := os.ReadFile(path)
		require.NoError(t, err, path)
		totalCalls += strings.Count(string(source), "perfmetrics.RecordRelaySample(")
		require.False(t, asyncCall.Match(source), "%s wraps RecordRelaySample in gopool.Go", path)
	}
	require.Equal(t, 3, totalCalls)
}

func TestPrometheusModelSeriesLimitCountsOmittedObservationsOnce(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "6")

	recordSuccessfulPrometheusModelStreamForTest("gpt-5")

	firstText, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, firstText, `newapi_model_histogram_dropped_samples_total{reason="series_limit"} 2`)
	require.EqualValues(t, 2, prometheusModelDroppedSamples.snapshot()[modelDropSeriesLimit])

	secondText, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, secondText, `newapi_model_histogram_dropped_samples_total{reason="series_limit"} 2`)
	require.EqualValues(t, 2, prometheusModelDroppedSamples.snapshot()[modelDropSeriesLimit])
}

func TestPrometheusModelSeriesLimitCountsOnlyNewObservationsAfterExport(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "37")

	recordSuccessfulPrometheusModelStreamForTest("gpt-5")
	firstText, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, firstText, `newapi_model_request_duration_seconds_count{model="gpt-5"} 1`)
	requirePrometheusSampleLine(t, firstText, `newapi_model_histogram_dropped_samples_total{reason="series_limit"} 0`)

	recordSuccessfulPrometheusModelStreamForTest("gpt-5")
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "6")
	secondText, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.NotContains(t, secondText, "newapi_model_request_duration_seconds")
	requirePrometheusSampleLine(t, secondText, `newapi_model_histogram_dropped_samples_total{reason="series_limit"} 2`)
	require.EqualValues(t, 2, prometheusModelDroppedSamples.snapshot()[modelDropSeriesLimit])
}

func TestPrometheusModelSeriesWatermarkUsesExportedSnapshotCounts(t *testing.T) {
	now := time.Now()
	bucket := newPrometheusModelPerformanceBucket(now)
	latencySeconds := 1.5
	ttftSeconds := 0.25
	require.True(t, bucket.addSuccess(now, &latencySeconds, true, &ttftSeconds))
	exportedSnapshot, ok := bucket.snapshot("gpt-5")
	require.True(t, ok)

	require.True(t, bucket.addSuccess(now.Add(time.Second), &latencySeconds, true, &ttftSeconds))
	omittedSnapshot, ok := bucket.snapshot("gpt-5")
	require.True(t, ok)
	selected, dropped := selectPrometheusModelSnapshots(
		[]prometheusModelPerformanceSnapshot{exportedSnapshot},
		exportedSnapshot.seriesCount(),
	)
	require.Len(t, selected, 1)
	require.Zero(t, dropped)
	selected, dropped = selectPrometheusModelSnapshots([]prometheusModelPerformanceSnapshot{omittedSnapshot}, 0)
	require.Empty(t, selected)
	require.EqualValues(t, 2, dropped)
}

func TestPrometheusModelSeriesWatermarkDoesNotRegressForLateSnapshot(t *testing.T) {
	now := time.Now()
	bucket := newPrometheusModelPerformanceBucket(now)
	latencySeconds := 1.5
	ttftSeconds := 0.25
	require.True(t, bucket.addSuccess(now, &latencySeconds, true, &ttftSeconds))
	olderSnapshot, ok := bucket.snapshot("gpt-5")
	require.True(t, ok)
	require.True(t, bucket.addSuccess(now.Add(time.Second), &latencySeconds, true, &ttftSeconds))
	newerSnapshot, ok := bucket.snapshot("gpt-5")
	require.True(t, ok)

	selected, dropped := selectPrometheusModelSnapshots(
		[]prometheusModelPerformanceSnapshot{newerSnapshot},
		newerSnapshot.seriesCount(),
	)
	require.Len(t, selected, 1)
	require.Zero(t, dropped)
	selected, dropped = selectPrometheusModelSnapshots(
		[]prometheusModelPerformanceSnapshot{olderSnapshot},
		olderSnapshot.seriesCount(),
	)
	require.Len(t, selected, 1)
	require.Zero(t, dropped)
	selected, dropped = selectPrometheusModelSnapshots([]prometheusModelPerformanceSnapshot{newerSnapshot}, 0)
	require.Empty(t, selected)
	require.Zero(t, dropped)

	require.True(t, bucket.addSuccess(now.Add(2*time.Second), &latencySeconds, true, &ttftSeconds))
	latestSnapshot, ok := bucket.snapshot("gpt-5")
	require.True(t, ok)
	selected, dropped = selectPrometheusModelSnapshots([]prometheusModelPerformanceSnapshot{latestSnapshot}, 0)
	require.Empty(t, selected)
	require.EqualValues(t, 2, dropped)
}

func TestPrometheusModelSeriesLimitUsesOmittedSnapshotCounts(t *testing.T) {
	now := time.Now()
	bucket := newPrometheusModelPerformanceBucket(now)
	latencySeconds := 1.5
	ttftSeconds := 0.25
	require.True(t, bucket.addSuccess(now, &latencySeconds, true, &ttftSeconds))
	olderSnapshot, ok := bucket.snapshot("gpt-5")
	require.True(t, ok)
	require.True(t, bucket.addSuccess(now.Add(time.Second), &latencySeconds, true, &ttftSeconds))
	newerSnapshot, ok := bucket.snapshot("gpt-5")
	require.True(t, ok)

	selected, dropped := selectPrometheusModelSnapshots([]prometheusModelPerformanceSnapshot{olderSnapshot}, 0)
	require.Empty(t, selected)
	require.EqualValues(t, 2, dropped)
	selected, dropped = selectPrometheusModelSnapshots([]prometheusModelPerformanceSnapshot{newerSnapshot}, 0)
	require.Empty(t, selected)
	require.EqualValues(t, 2, dropped)
	selected, dropped = selectPrometheusModelSnapshots([]prometheusModelPerformanceSnapshot{olderSnapshot}, 0)
	require.Empty(t, selected)
	require.Zero(t, dropped)
}

func TestPrometheusModelSeriesLimitCalculatesHistogramDeltasIndependently(t *testing.T) {
	bucket := newPrometheusModelPerformanceBucket(time.Now())
	bucket.mu.Lock()
	bucket.latencyCount = 2
	bucket.ttftCount = 1
	bucket.mu.Unlock()
	latencySnapshot := prometheusModelPerformanceSnapshot{
		model:        "gpt-5",
		latencyCount: 2,
		bucket:       bucket,
	}
	crossedSnapshot := prometheusModelPerformanceSnapshot{
		model:        "gpt-5",
		latencyCount: 1,
		ttftCount:    1,
		bucket:       bucket,
	}

	selected, dropped := selectPrometheusModelSnapshots([]prometheusModelPerformanceSnapshot{latencySnapshot}, 0)
	require.Empty(t, selected)
	require.EqualValues(t, 2, dropped)
	selected, dropped = selectPrometheusModelSnapshots([]prometheusModelPerformanceSnapshot{crossedSnapshot}, 0)
	require.Empty(t, selected)
	require.EqualValues(t, 1, dropped)
}

func TestPrometheusModelBudgetFitsFiftyWorstCaseGroups(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "2005")

	errorCategories := []string{
		"auth",
		"bad_response",
		"client_cancel",
		"network",
		"other",
		"rate_limit",
		"timeout",
		"upstream_4xx",
		"upstream_5xx",
	}
	now := time.Now()
	latencySeconds := 1.5
	ttftSeconds := 0.25
	for i := 0; i < defaultPrometheusMaxModelHistogramModels; i++ {
		bucket := newPrometheusModelPerformanceBucket(now)
		require.True(t, bucket.addSuccess(now, &latencySeconds, true, &ttftSeconds))
		for _, category := range errorCategories {
			require.True(t, bucket.addError(now, category))
		}
		prometheusModelPerformanceBuckets.Store(fmt.Sprintf("model-%02d", i), bucket)
	}

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Equal(t, 2000, countPrometheusModelPerformanceSeries(text))
	requirePrometheusSampleLine(t, text, "newapi_perf_metrics_series 2005")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
}

func TestPrometheusModelBudgetOmitsHealthWhenItDoesNotFit(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "4")

	recordSuccessfulPrometheusModelStreamForTest("gpt-5")

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, text, `newapi_model_requests_total{model="gpt-5",status="success"} 1`)
	require.NotContains(t, text, "newapi_model_request_duration_seconds")
	require.NotContains(t, text, "newapi_model_ttft_seconds")
	require.NotContains(t, text, "newapi_model_stream_success_total")
	require.NotContains(t, text, "newapi_model_histogram_active_models")
	require.NotContains(t, text, "newapi_model_histogram_dropped_samples_total")
	requirePrometheusSampleLine(t, text, "newapi_perf_metrics_series 1")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
}

func TestPrometheusModelBudgetAccountsHealthOmittedSnapshotsOnce(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "4")
	recordSuccessfulPrometheusModelStreamForTest("gpt-5")

	firstLowCapText, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.NotContains(t, firstLowCapText, "newapi_model_histogram_dropped_samples_total")
	require.EqualValues(t, 2, prometheusModelDroppedSamples.snapshot()[modelDropSeriesLimit])
	requirePrometheusSampleLine(t, firstLowCapText, "newapi_perf_metrics_series 1")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, firstLowCapText)

	secondLowCapText, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.NotContains(t, secondLowCapText, "newapi_model_histogram_dropped_samples_total")
	require.EqualValues(t, 2, prometheusModelDroppedSamples.snapshot()[modelDropSeriesLimit])
	requirePrometheusSampleLine(t, secondLowCapText, "newapi_perf_metrics_series 1")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, secondLowCapText)

	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "37")
	highCapText, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, highCapText, `newapi_model_request_duration_seconds_count{model="gpt-5"} 1`)
	requirePrometheusSampleLine(t, highCapText, `newapi_model_ttft_seconds_count{model="gpt-5"} 1`)
	requirePrometheusSampleLine(t, highCapText, `newapi_model_histogram_dropped_samples_total{reason="series_limit"} 2`)
	requirePrometheusSampleLine(t, highCapText, "newapi_perf_metrics_series 37")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, highCapText)
}

func TestPrometheusModelDropCountersUseFixedReasons(t *testing.T) {
	var counters prometheusModelDropCounters
	require.Equal(t, []string{modelDropModelLimit, modelDropInvalidLatency, modelDropInvalidTTFT, modelDropSeriesLimit}, modelDropReasons)

	counters.add(modelDropModelLimit, 0)
	counters.add(modelDropInvalidLatency, -1)
	counters.add("unknown", 10)
	require.EqualValues(t, 0, counters.snapshot()[modelDropModelLimit])
	require.EqualValues(t, 0, counters.snapshot()[modelDropInvalidLatency])
	require.NotContains(t, counters.snapshot(), "unknown")

	counters.add(modelDropSeriesLimit, 2)
	require.EqualValues(t, 2, counters.snapshot()[modelDropSeriesLimit])
}

func TestBuildPrometheusTextEmitsModelPerformance(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	startedAt := time.Now().Add(-1500 * time.Millisecond)
	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName:   "gpt-5",
		StartTime:         startedAt,
		FirstResponseTime: startedAt.Add(250 * time.Millisecond),
		IsStream:          true,
		ChannelMeta:       &relaycommon.ChannelMeta{ChannelId: 42},
	}, true, 12, nil)
	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName: "gpt-5",
		StartTime:       time.Now().Add(-time.Second),
		IsStream:        true,
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 42},
	}, false, 0, types.NewErrorWithStatusCode(
		context.DeadlineExceeded,
		types.ErrorCodeDoRequestFailed,
		http.StatusGatewayTimeout,
	))

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)

	require.Contains(t, text, "# HELP newapi_model_request_duration_seconds Successful model request duration by model.\n")
	require.Contains(t, text, "# TYPE newapi_model_request_duration_seconds histogram\n")
	for _, upperBound := range prometheusModelLatencyBucketsSeconds {
		wantCount := int64(0)
		if upperBound >= 2 {
			wantCount = 1
		}
		requirePrometheusSampleLine(t, text, fmt.Sprintf(
			`newapi_model_request_duration_seconds_bucket{model="gpt-5",le="%s"} %d`,
			formatPrometheusFloat(upperBound),
			wantCount,
		))
	}
	requirePrometheusSampleLine(t, text, `newapi_model_request_duration_seconds_bucket{model="gpt-5",le="+Inf"} 1`)
	require.InDelta(t, 1.5, prometheusSampleValue(t, text, `newapi_model_request_duration_seconds_sum{model="gpt-5"}`), 0.1)
	requirePrometheusSampleLine(t, text, `newapi_model_request_duration_seconds_count{model="gpt-5"} 1`)

	require.Contains(t, text, "# HELP newapi_model_ttft_seconds Time to first token for successful streaming model requests.\n")
	require.Contains(t, text, "# TYPE newapi_model_ttft_seconds histogram\n")
	for _, upperBound := range prometheusModelTTFTBucketsSeconds {
		wantCount := int64(0)
		if upperBound >= 0.25 {
			wantCount = 1
		}
		requirePrometheusSampleLine(t, text, fmt.Sprintf(
			`newapi_model_ttft_seconds_bucket{model="gpt-5",le="%s"} %d`,
			formatPrometheusFloat(upperBound),
			wantCount,
		))
	}
	requirePrometheusSampleLine(t, text, `newapi_model_ttft_seconds_bucket{model="gpt-5",le="+Inf"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_model_ttft_seconds_sum{model="gpt-5"} 0.25`)
	requirePrometheusSampleLine(t, text, `newapi_model_ttft_seconds_count{model="gpt-5"} 1`)

	require.Contains(t, text, "# HELP newapi_model_stream_success_total Total successful streaming model requests.\n")
	require.Contains(t, text, "# TYPE newapi_model_stream_success_total counter\n")
	requirePrometheusSampleLine(t, text, `newapi_model_stream_success_total{model="gpt-5"} 1`)
	require.Contains(t, text, "# HELP newapi_model_errors_total Total final model request failures by error category.\n")
	require.Contains(t, text, "# TYPE newapi_model_errors_total counter\n")
	requirePrometheusSampleLine(t, text, `newapi_model_errors_total{model="gpt-5",error_category="timeout"} 1`)

	require.Contains(t, text, "# HELP newapi_model_histogram_active_models Number of active model performance metric groups.\n")
	require.Contains(t, text, "# TYPE newapi_model_histogram_active_models gauge\n")
	requirePrometheusSampleLine(t, text, "newapi_model_histogram_active_models 1")
	require.Contains(t, text, "# HELP newapi_model_histogram_dropped_samples_total Total model histogram observations dropped before export.\n")
	require.Contains(t, text, "# TYPE newapi_model_histogram_dropped_samples_total counter\n")
	for _, reason := range modelDropReasons {
		requirePrometheusSampleLine(t, text, fmt.Sprintf(
			`newapi_model_histogram_dropped_samples_total{reason="%s"} 0`,
			reason,
		))
	}
	requirePrometheusSampleLine(t, text, "newapi_perf_metrics_series 39")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
}

func TestBuildPrometheusTextEscapesModelPerformanceLabels(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	model := "gpt\"5\\mini\nv2"
	startedAt := time.Now().Add(-1500 * time.Millisecond)
	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName:   model,
		StartTime:         startedAt,
		FirstResponseTime: startedAt.Add(250 * time.Millisecond),
		IsStream:          true,
		ChannelMeta:       &relaycommon.ChannelMeta{ChannelId: 42},
	}, true, 12, nil)

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, text, `newapi_model_request_duration_seconds_bucket{model="gpt\"5\\mini\nv2",le="2"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_model_ttft_seconds_count{model="gpt\"5\\mini\nv2"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_model_stream_success_total{model="gpt\"5\\mini\nv2"} 1`)
}

func TestBuildPrometheusTextOrdersModelMetricsBeforeChannelMetrics(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	startedAt := time.Now().Add(-1500 * time.Millisecond)
	info := &relaycommon.RelayInfo{
		OriginModelName:   "gpt-5",
		StartTime:         startedAt,
		FirstResponseTime: startedAt.Add(250 * time.Millisecond),
		IsStream:          true,
		ChannelMeta:       &relaycommon.ChannelMeta{ChannelId: 42},
	}
	RecordRelaySample(info, true, 12, nil)
	RecordChannelAttempt(info, 42, "primary", startedAt, nil)

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requestIndex := strings.Index(text, "# HELP newapi_model_requests_total")
	modelPerformanceIndex := strings.Index(text, "# HELP newapi_model_request_duration_seconds")
	modelHealthIndex := strings.Index(text, "# HELP newapi_model_histogram_active_models")
	channelIndex := strings.Index(text, "# HELP newapi_channel_info")
	require.GreaterOrEqual(t, requestIndex, 0)
	require.Greater(t, modelPerformanceIndex, requestIndex)
	require.Greater(t, modelHealthIndex, modelPerformanceIndex)
	require.Greater(t, channelIndex, modelHealthIndex)
}

func TestBuildPrometheusTextEmitsChannelHealthMetrics(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	successStartedAt := time.Now().Add(-1500 * time.Millisecond)
	successInfo := &relaycommon.RelayInfo{
		OriginModelName:   "gpt-5",
		StartTime:         successStartedAt,
		FirstResponseTime: successStartedAt.Add(250 * time.Millisecond),
		IsStream:          true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 42,
		},
	}
	RecordChannelAttempt(successInfo, 42, "primary\"east", successStartedAt, nil)
	RecordChannelTokens(successInfo, 120, 30)

	failureStartedAt := time.Now().Add(-4 * time.Second)
	failureInfo := &relaycommon.RelayInfo{
		OriginModelName: "gpt-5",
		StartTime:       failureStartedAt,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 42,
		},
	}
	RecordChannelAttempt(
		failureInfo,
		42,
		"primary\"east",
		failureStartedAt,
		types.NewErrorWithStatusCode(
			context.DeadlineExceeded,
			types.ErrorCodeDoRequestFailed,
			http.StatusGatewayTimeout,
		),
	)

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)

	require.Contains(t, text, `newapi_channel_info{channel_id="42",channel_name="primary\"east"} 1`)
	require.Contains(t, text, `newapi_channel_attempts_total{channel_id="42",status="success",error_category="none"} 1`)
	require.Contains(t, text, `newapi_channel_attempts_total{channel_id="42",status="error",error_category="timeout"} 1`)
	require.Contains(t, text, `newapi_channel_request_duration_seconds_bucket{channel_id="42",le="2"} 1`)
	require.Contains(t, text, `newapi_channel_request_duration_seconds_bucket{channel_id="42",le="5"} 2`)
	require.Contains(t, text, `newapi_channel_request_duration_seconds_bucket{channel_id="42",le="+Inf"} 2`)
	require.Contains(t, text, `newapi_channel_request_duration_seconds_count{channel_id="42"} 2`)
	require.Contains(t, text, `newapi_channel_ttft_seconds_sum{channel_id="42"} 0.25`)
	require.Contains(t, text, `newapi_channel_ttft_seconds_count{channel_id="42"} 1`)
	require.Contains(t, text, `newapi_channel_model_attempts_total{channel_id="42",model="gpt-5",status="success"} 1`)
	require.Contains(t, text, `newapi_channel_model_attempts_total{channel_id="42",model="gpt-5",status="error"} 1`)
	require.Contains(t, text, `newapi_channel_model_input_tokens_total{channel_id="42",model="gpt-5"} 120`)
	require.Contains(t, text, `newapi_channel_model_output_tokens_total{channel_id="42",model="gpt-5"} 30`)

	for _, line := range strings.Split(text, "\n") {
		if !strings.HasPrefix(line, "newapi_channel_") || strings.HasPrefix(line, "newapi_channel_info{") {
			continue
		}
		require.NotContains(t, line, "channel_name", line)
	}
}

func TestRecordChannelMetricsRejectsAbnormalStreamSuccess(t *testing.T) {
	tests := []struct {
		name         string
		endReason    relaycommon.StreamEndReason
		wantStatus   string
		wantCategory string
	}{
		{
			name:         "client disconnect",
			endReason:    relaycommon.StreamEndReasonClientGone,
			wantStatus:   "client_cancel",
			wantCategory: "client_cancel",
		},
		{
			name:         "stream timeout",
			endReason:    relaycommon.StreamEndReasonTimeout,
			wantStatus:   "error",
			wantCategory: "timeout",
		},
		{
			name:         "first response timeout",
			endReason:    relaycommon.StreamEndReasonFirstResponseTimeout,
			wantStatus:   "error",
			wantCategory: "timeout",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resetPerfMetricsStateForTest(t)

			startedAt := time.Now().Add(-time.Second)
			streamStatus := relaycommon.NewStreamStatus()
			streamStatus.SetEndReason(tt.endReason, nil)
			info := &relaycommon.RelayInfo{
				OriginModelName: "gpt-5",
				StartTime:       startedAt,
				IsStream:        true,
				StreamStatus:    streamStatus,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelId: 42,
				},
			}

			RecordChannelAttempt(info, 42, "primary", startedAt, nil)
			RecordChannelTokens(info, 120, 30)

			text, err := BuildPrometheusText(context.Background())
			require.NoError(t, err)
			require.Contains(t, text, `newapi_channel_attempts_total{channel_id="42",status="`+tt.wantStatus+`",error_category="`+tt.wantCategory+`"} 1`)
			require.NotContains(t, text, `newapi_channel_attempts_total{channel_id="42",status="success"`)
			require.NotContains(t, text, `newapi_channel_model_attempts_total{channel_id="42",model="gpt-5",status="success"}`)
			require.NotContains(t, text, `newapi_channel_model_input_tokens_total{channel_id="42",model="gpt-5"}`)
			require.NotContains(t, text, `newapi_channel_model_output_tokens_total{channel_id="42",model="gpt-5"}`)
		})
	}
}

func TestClassifyChannelError(t *testing.T) {
	tests := []struct {
		name         string
		err          *types.NewAPIError
		wantStatus   string
		wantCategory string
	}{
		{
			name:         "client cancel",
			err:          types.NewError(context.Canceled, types.ErrorCodeDoRequestFailed),
			wantStatus:   "client_cancel",
			wantCategory: "client_cancel",
		},
		{
			name:         "timeout",
			err:          types.NewError(context.DeadlineExceeded, types.ErrorCodeDoRequestFailed),
			wantStatus:   "error",
			wantCategory: "timeout",
		},
		{
			name:         "rate limit",
			err:          types.NewErrorWithStatusCode(errors.New("limited"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
			wantStatus:   "error",
			wantCategory: "rate_limit",
		},
		{
			name:         "auth",
			err:          types.NewErrorWithStatusCode(errors.New("denied"), types.ErrorCodeBadResponseStatusCode, http.StatusUnauthorized),
			wantStatus:   "error",
			wantCategory: "auth",
		},
		{
			name:         "bad response",
			err:          types.NewError(errors.New("invalid body"), types.ErrorCodeBadResponseBody),
			wantStatus:   "error",
			wantCategory: "bad_response",
		},
		{
			name:         "network",
			err:          types.NewError(errors.New("dial failed"), types.ErrorCodeDoRequestFailed),
			wantStatus:   "error",
			wantCategory: "network",
		},
		{
			name:         "upstream 4xx",
			err:          types.NewErrorWithStatusCode(errors.New("teapot"), types.ErrorCodeBadResponseStatusCode, http.StatusTeapot),
			wantStatus:   "error",
			wantCategory: "upstream_4xx",
		},
		{
			name:         "upstream 5xx",
			err:          types.NewErrorWithStatusCode(errors.New("unavailable"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable),
			wantStatus:   "error",
			wantCategory: "upstream_5xx",
		},
		{
			name:         "other",
			err:          types.NewErrorWithStatusCode(errors.New("unknown"), types.ErrorCode("unknown"), 0),
			wantStatus:   "error",
			wantCategory: "other",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, category := classifyChannelError(tt.err)
			require.Equal(t, tt.wantStatus, status)
			require.Equal(t, tt.wantCategory, category)
		})
	}
}

func TestPrometheusMetricsAreKeptInLocalProcessMemory(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	Record(Sample{
		Model:     "gpt-5",
		Group:     "default",
		ChannelID: 7,
		LatencyMs: 1200,
		Success:   true,
	})

	require.Equal(t, 1, syncMapLen(&prometheusPendingBuckets))
}

func TestBuildPrometheusTextIgnoresZeroPendingBucketUntilAdded(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "1")

	zeroKey := prometheusSeriesKey{model: "pending-model", status: "success"}
	zeroBucket := &prometheusLockedBucket{}
	prometheusPendingBuckets.Store(zeroKey, zeroBucket)

	zeroText, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.NotContains(t, zeroText, "newapi_model_requests_total{")
	requirePrometheusSampleLine(t, zeroText, "newapi_perf_metrics_series 0")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, zeroText)
	_, exists := prometheusPendingBuckets.Load(zeroKey)
	require.True(t, exists)

	Record(Sample{Model: "active-model", Success: true})
	activeText, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, activeText, `newapi_model_requests_total{model="active-model",status="success"} 1`)
	require.NotContains(t, activeText, `newapi_model_requests_total{model="pending-model"`)
	requirePrometheusSampleLine(t, activeText, "newapi_perf_metrics_series 1")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, activeText)

	require.True(t, zeroBucket.add(Sample{Model: "pending-model", Success: true}))
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "2")
	addedText, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, addedText, `newapi_model_requests_total{model="active-model",status="success"} 1`)
	requirePrometheusSampleLine(t, addedText, `newapi_model_requests_total{model="pending-model",status="success"} 1`)
	requirePrometheusSampleLine(t, addedText, "newapi_perf_metrics_series 2")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, addedText)
}

func TestBuildPrometheusTextEmitsModelStatusRequestCountersOnly(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	Record(Sample{
		Model:     "gpt-5",
		Group:     "default",
		ChannelID: 7,
		LatencyMs: 1200,
		Success:   true,
	})
	Record(Sample{
		Model:     "gpt-5",
		Group:     "default",
		ChannelID: 8,
		LatencyMs: 3200,
		Success:   true,
	})
	Record(Sample{
		Model:     "gpt-5",
		Group:     "default",
		ChannelID: 9,
		LatencyMs: 4500,
		Success:   false,
	})

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)

	require.NotContains(t, text, "newapi_model_request_duration_seconds")
	require.NotContains(t, text, "channel_id")
	require.Contains(t, text, "# HELP newapi_perf_metrics_series Number of application metric series exposed by this endpoint.")
	requirePrometheusSampleLine(t, text, "newapi_perf_metrics_series 7")
	requirePrometheusSampleLine(t, text, `newapi_model_requests_total{model="gpt-5",status="success"} 2`)
	requirePrometheusSampleLine(t, text, `newapi_model_requests_total{model="gpt-5",status="error"} 1`)
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
	require.NotContains(t, text, "newapi_perf_metrics_redis_available")
}

func TestRecordRelaySampleUsesModelStatusLabels(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName: "gpt-5",
		UsingGroup:      "default",
		StartTime:       time.Now().Add(-1200 * time.Millisecond),
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 42,
		},
	}, true, 0, nil)

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)

	requirePrometheusSampleLine(t, text, `newapi_model_requests_total{model="gpt-5",status="success"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_model_request_duration_seconds_count{model="gpt-5"} 1`)
	require.NotContains(t, text, "channel_id")
}

func TestBuildPrometheusTextEscapesLabelValues(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	Record(Sample{
		Model:     "gpt\"5\\mini\nv2",
		Group:     "default",
		ChannelID: 9,
		LatencyMs: 100,
		Success:   true,
	})

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Contains(t, text, `model="gpt\"5\\mini\nv2"`)
}

func TestPrometheusCountersIsZeroChecksCount(t *testing.T) {
	counter := prometheusCounters{}
	require.True(t, counter.isZero())

	counter.count = 1
	require.False(t, counter.isZero())
}

func TestPrometheusModelStatusCoalescesChannelIDs(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	Record(Sample{
		Model:     "gpt-5",
		Group:     "default",
		ChannelID: 7,
		LatencyMs: 100,
		Success:   true,
	})
	Record(Sample{
		Model:     "gpt-5",
		Group:     "default",
		ChannelID: 8,
		LatencyMs: 100,
		Success:   true,
	})

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Contains(t, text, `newapi_model_requests_total{model="gpt-5",status="success"} 2`)
	require.NotContains(t, text, "channel_id")
}

func TestPrometheusSeriesScanLimitFailsClosed(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "1")

	Record(Sample{
		Model:     "gpt-5",
		Group:     "default",
		ChannelID: 7,
		LatencyMs: 100,
		Success:   true,
	})
	Record(Sample{
		Model:     "gpt-5-mini",
		Group:     "default",
		ChannelID: 8,
		LatencyMs: 100,
		Success:   true,
	})

	text, err := BuildPrometheusText(context.Background())
	require.Error(t, err)
	require.Empty(t, text)
}

func TestBuildPrometheusTextPrunesIdleLocalSeries(t *testing.T) {
	resetPerfMetricsStateForTest(t)

	staleKey := prometheusSeriesKey{model: "stale-model", status: "success"}
	staleBucket := &prometheusLockedBucket{}
	staleBucket.add(Sample{
		Model:     "stale-model",
		ChannelID: 7,
		LatencyMs: 100,
		Success:   true,
	})
	staleBucket.mu.Lock()
	staleBucket.lastUpdatedAt = time.Now().Add(-prometheusSeriesIdleRetention - time.Minute).UnixNano()
	staleBucket.mu.Unlock()
	prometheusPendingBuckets.Store(staleKey, staleBucket)

	Record(Sample{
		Model:     "active-model",
		Group:     "default",
		ChannelID: 8,
		LatencyMs: 200,
		Success:   true,
	})

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Contains(t, text, `newapi_model_requests_total{model="active-model",status="success"} 1`)
	require.NotContains(t, text, "stale-model")

	_, exists := prometheusPendingBuckets.Load(staleKey)
	require.False(t, exists)
}

func recordSuccessfulPrometheusModelStreamForTest(model string) {
	startedAt := time.Now().Add(-1500 * time.Millisecond)
	RecordRelaySample(&relaycommon.RelayInfo{
		OriginModelName:   model,
		StartTime:         startedAt,
		FirstResponseTime: startedAt.Add(250 * time.Millisecond),
		IsStream:          true,
		ChannelMeta:       &relaycommon.ChannelMeta{ChannelId: 42},
	}, true, 12, nil)
}

func setPrometheusModelLastUpdatedForTest(t *testing.T, model string, updatedAt time.Time) {
	t.Helper()
	value, ok := prometheusModelPerformanceBuckets.Load(model)
	require.True(t, ok)
	bucket := value.(*prometheusModelPerformanceBucket)
	bucket.mu.Lock()
	bucket.lastUpdatedAt = updatedAt.UnixNano()
	bucket.mu.Unlock()
}

func prometheusSampleLines(text string) []string {
	lines := make([]string, 0)
	for _, line := range strings.Split(text, "\n") {
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		lines = append(lines, line)
	}
	return lines
}

func requirePrometheusSampleLine(t *testing.T, text string, want string) {
	t.Helper()
	require.Contains(t, prometheusSampleLines(text), want)
}

func prometheusSampleValue(t *testing.T, text string, metric string) float64 {
	t.Helper()
	prefix := metric + " "
	matchingValues := make([]string, 0, 1)
	for _, line := range prometheusSampleLines(text) {
		if strings.HasPrefix(line, prefix) {
			matchingValues = append(matchingValues, strings.TrimPrefix(line, prefix))
		}
	}
	require.Len(t, matchingValues, 1, metric)
	value, err := strconv.ParseFloat(matchingValues[0], 64)
	require.NoError(t, err, metric)
	return value
}

func requirePrometheusSeriesGaugeMatchesRenderedSamples(t *testing.T, text string) {
	t.Helper()
	lines := prometheusSampleLines(text)
	renderedSeries := 0
	for _, line := range lines {
		if strings.HasPrefix(line, "newapi_perf_metrics_series ") {
			continue
		}
		renderedSeries++
	}
	require.EqualValues(t, renderedSeries, prometheusSampleValue(t, text, "newapi_perf_metrics_series"))
}

func countPrometheusModelPerformanceSeries(text string) int {
	count := 0
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(line, "newapi_model_request_duration_seconds") ||
			strings.HasPrefix(line, "newapi_model_ttft_seconds") ||
			strings.HasPrefix(line, "newapi_model_stream_success_total") ||
			strings.HasPrefix(line, "newapi_model_errors_total") {
			count++
		}
	}
	return count
}

func syncMapLen(m *sync.Map) int {
	count := 0
	m.Range(func(_, _ any) bool {
		count++
		return true
	})
	return count
}
