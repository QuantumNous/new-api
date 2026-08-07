package perfmetrics

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestVideoResultMetricsExportArchiveRedirectAndRetryCounters(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	resetVideoResultMetricsWithCleanup(t)

	RecordVideoResultArchive("techmobi", "success", 123, 2*time.Second)
	RecordVideoResultRedirect("techmobi", "success")
	RecordVideoResultRedirect("techmobi", "signing-or-other")
	RecordVideoResultArchiveRetry("techmobi", "archive_failure")

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, text, `newapi_video_result_archive_total{channel="techmobi",outcome="success"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_video_result_archive_bytes_total{channel="techmobi"} 123`)
	requirePrometheusSampleLine(t, text, `newapi_video_result_redirect_total{channel="techmobi",outcome="success"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_video_result_redirect_total{channel="techmobi",outcome="signing-or-other"} 1`)
	require.NotContains(t, text, `outcome="error"`)
	requirePrometheusSampleLine(t, text, `newapi_video_result_archive_retry_total{channel="techmobi",reason="archive_failure"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_video_result_archive_duration_seconds_count{channel="techmobi"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_video_result_archive_duration_seconds_sum{channel="techmobi"} 2`)
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
}

func TestVideoResultMetricsCountsBytesOnlyForSuccessfulArchives(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	resetVideoResultMetricsWithCleanup(t)

	RecordVideoResultArchive("techmobi", "failure", 123, time.Second)
	RecordVideoResultArchive("techmobi", "reuse", 456, time.Second)

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	requirePrometheusSampleLine(t, text, `newapi_video_result_archive_total{channel="techmobi",outcome="failure"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_video_result_archive_total{channel="techmobi",outcome="reuse"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_video_result_archive_bytes_total{channel="techmobi"} 0`)
}

func TestVideoResultMetricsRejectDynamicLabels(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	resetVideoResultMetricsWithCleanup(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "1")

	RecordVideoResultArchive("storage-bucket/video-results/task_1.mp4", "success", 123, time.Second)
	RecordVideoResultArchive("techmobi", "task_123", 456, time.Second)
	RecordVideoResultRedirect("https://storage.example/object", "success")
	RecordVideoResultRedirect("techmobi", "https://signed.example/object")
	RecordVideoResultArchiveRetry("techmobi", "task_123")

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.NotContains(t, text, "newapi_video_result_")
	requirePrometheusSampleLine(t, text, "newapi_perf_metrics_series 0")
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
}

func TestVideoResultMetricsHistogramBudgetAndResetBehavior(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	resetVideoResultMetricsWithCleanup(t)
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "1")

	RecordVideoResultArchive("techmobi", "success", 100, 250*time.Millisecond)
	text, err := BuildPrometheusText(context.Background())
	require.Error(t, err)
	require.Empty(t, text)

	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "0")
	text, err = BuildPrometheusText(context.Background())
	require.NoError(t, err)
	for _, upperBound := range videoResultArchiveDurationBucketsSeconds {
		want := int64(0)
		if upperBound >= 0.25 {
			want = 1
		}
		requirePrometheusSampleLine(t, text, fmt.Sprintf(
			`newapi_video_result_archive_duration_seconds_bucket{channel="techmobi",le="%s"} %d`,
			formatPrometheusFloat(upperBound),
			want,
		))
	}
	requirePrometheusSampleLine(t, text, `newapi_video_result_archive_duration_seconds_bucket{channel="techmobi",le="+Inf"} 1`)
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)

	resetVideoResultMetricsForTest()
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "1")
	text, err = BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.NotContains(t, text, "newapi_video_result_")
	requirePrometheusSampleLine(t, text, "newapi_perf_metrics_series 0")
}

func TestVideoResultMetricsUseOnlyClosedLabelValues(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	resetVideoResultMetricsWithCleanup(t)

	for _, outcome := range videoResultArchiveOutcomes {
		RecordVideoResultArchive("techmobi", outcome, 1, time.Millisecond)
	}
	for _, outcome := range videoResultRedirectOutcomes {
		RecordVideoResultRedirect("techmobi", outcome)
	}
	for _, reason := range videoResultArchiveRetryReasons {
		RecordVideoResultArchiveRetry("techmobi", reason)
	}

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	for _, line := range prometheusSampleLines(text) {
		if !strings.HasPrefix(line, "newapi_video_result_") {
			continue
		}
		require.Contains(t, line, `channel="techmobi"`)
		require.NotContains(t, line, "task_")
		require.NotContains(t, line, "video-results/")
		require.NotContains(t, line, "http")
	}
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
}

func TestVideoResultMetricDimensionsFollowFixedLabelTables(t *testing.T) {
	require.Len(t, videoResultChannels, videoResultChannelCount)
	require.Len(t, videoResultArchiveOutcomes, videoResultArchiveOutcomeCount)
	require.Len(t, videoResultArchiveDurationBucketsSeconds, videoResultArchiveDurationBucketCount)
	require.Len(t, videoResultRedirectOutcomes, videoResultRedirectOutcomeCount)
	require.Len(t, videoResultArchiveRetryReasons, videoResultArchiveRetryReasonCount)
}

func resetVideoResultMetricsWithCleanup(t *testing.T) {
	t.Helper()
	resetVideoResultMetricsForTest()
	t.Cleanup(resetVideoResultMetricsForTest)
}
