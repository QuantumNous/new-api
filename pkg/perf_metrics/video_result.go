package perfmetrics

import (
	"math"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

const (
	videoResultChannelCount               = 1
	videoResultArchiveOutcomeCount        = 3
	videoResultArchiveDurationBucketCount = 13
	videoResultRedirectOutcomeCount       = 4
	videoResultArchiveRetryReasonCount    = 1
)

var (
	videoResultChannels                      = [videoResultChannelCount]string{"techmobi"}
	videoResultArchiveOutcomes               = [videoResultArchiveOutcomeCount]string{"success", "failure", "reuse"}
	videoResultRedirectOutcomes              = [videoResultRedirectOutcomeCount]string{"success", "expired", "unavailable", "signing-or-other"}
	videoResultArchiveRetryReasons           = [videoResultArchiveRetryReasonCount]string{"archive_failure"}
	videoResultArchiveDurationBucketsSeconds = [videoResultArchiveDurationBucketCount]float64{0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 900, 1800}
)

type videoResultMetricSnapshot struct {
	archiveTotal           [videoResultChannelCount][videoResultArchiveOutcomeCount]int64
	archiveBytes           [videoResultChannelCount]int64
	archiveDurationBuckets [videoResultChannelCount][videoResultArchiveDurationBucketCount]int64
	archiveDurationSum     [videoResultChannelCount]float64
	archiveDurationCount   [videoResultChannelCount]int64
	redirectTotal          [videoResultChannelCount][videoResultRedirectOutcomeCount]int64
	archiveRetryTotal      [videoResultChannelCount][videoResultArchiveRetryReasonCount]int64
}

var (
	videoResultMetricsInitialized     atomic.Bool
	videoResultArchiveTotal           [videoResultChannelCount][videoResultArchiveOutcomeCount]atomic.Int64
	videoResultArchiveBytes           [videoResultChannelCount]atomic.Int64
	videoResultArchiveDurationBuckets [videoResultChannelCount][videoResultArchiveDurationBucketCount]atomic.Int64
	videoResultArchiveDurationSumBits [videoResultChannelCount]atomic.Uint64
	videoResultArchiveDurationCount   [videoResultChannelCount]atomic.Int64
	videoResultRedirectTotal          [videoResultChannelCount][videoResultRedirectOutcomeCount]atomic.Int64
	videoResultArchiveRetryTotal      [videoResultChannelCount][videoResultArchiveRetryReasonCount]atomic.Int64
)

func RecordVideoResultArchive(channel, outcome string, bytes int64, duration time.Duration) {
	channelIndex := fixedLabelIndex(videoResultChannels[:], channel)
	outcomeIndex := fixedLabelIndex(videoResultArchiveOutcomes[:], outcome)
	if channelIndex < 0 || outcomeIndex < 0 {
		return
	}
	if bytes < 0 {
		bytes = 0
	}
	durationSeconds := duration.Seconds()
	if durationSeconds < 0 {
		durationSeconds = 0
	}
	videoResultMetricsInitialized.Store(true)
	videoResultArchiveTotal[channelIndex][outcomeIndex].Add(1)
	if bytes > 0 && videoResultArchiveOutcomes[outcomeIndex] == "success" {
		videoResultArchiveBytes[channelIndex].Add(bytes)
	}
	for i, upperBound := range videoResultArchiveDurationBucketsSeconds {
		if durationSeconds <= upperBound {
			videoResultArchiveDurationBuckets[channelIndex][i].Add(1)
		}
	}
	addAtomicFloat64(&videoResultArchiveDurationSumBits[channelIndex], durationSeconds)
	videoResultArchiveDurationCount[channelIndex].Add(1)
}

func RecordVideoResultRedirect(channel, outcome string) {
	channelIndex := fixedLabelIndex(videoResultChannels[:], channel)
	outcomeIndex := fixedLabelIndex(videoResultRedirectOutcomes[:], outcome)
	if channelIndex < 0 || outcomeIndex < 0 {
		return
	}
	videoResultMetricsInitialized.Store(true)
	videoResultRedirectTotal[channelIndex][outcomeIndex].Add(1)
}

func RecordVideoResultArchiveRetry(channel, reason string) {
	channelIndex := fixedLabelIndex(videoResultChannels[:], channel)
	reasonIndex := fixedLabelIndex(videoResultArchiveRetryReasons[:], reason)
	if channelIndex < 0 || reasonIndex < 0 {
		return
	}
	videoResultMetricsInitialized.Store(true)
	videoResultArchiveRetryTotal[channelIndex][reasonIndex].Add(1)
}

func snapshotVideoResultMetrics() (videoResultMetricSnapshot, bool) {
	var snapshot videoResultMetricSnapshot
	initialized := videoResultMetricsInitialized.Load()
	for i := range videoResultChannels {
		for j := range videoResultArchiveOutcomes {
			snapshot.archiveTotal[i][j] = videoResultArchiveTotal[i][j].Load()
		}
		snapshot.archiveBytes[i] = videoResultArchiveBytes[i].Load()
		for j := range videoResultArchiveDurationBucketsSeconds {
			snapshot.archiveDurationBuckets[i][j] = videoResultArchiveDurationBuckets[i][j].Load()
		}
		snapshot.archiveDurationSum[i] = loadAtomicFloat64(&videoResultArchiveDurationSumBits[i])
		snapshot.archiveDurationCount[i] = videoResultArchiveDurationCount[i].Load()
		for j := range videoResultRedirectOutcomes {
			snapshot.redirectTotal[i][j] = videoResultRedirectTotal[i][j].Load()
		}
		for j := range videoResultArchiveRetryReasons {
			snapshot.archiveRetryTotal[i][j] = videoResultArchiveRetryTotal[i][j].Load()
		}
	}
	return snapshot, initialized
}

func videoResultMetricSeriesCount(enabled bool) int {
	if !enabled {
		return 0
	}
	return len(videoResultChannels)*len(videoResultArchiveOutcomes) +
		len(videoResultChannels) +
		len(videoResultChannels)*(len(videoResultArchiveDurationBucketsSeconds)+3) +
		len(videoResultChannels)*len(videoResultRedirectOutcomes) +
		len(videoResultChannels)*len(videoResultArchiveRetryReasons)
}

func writeVideoResultMetrics(b *strings.Builder, snapshot videoResultMetricSnapshot, enabled bool) {
	if !enabled {
		return
	}
	b.WriteString("# HELP newapi_video_result_archive_total Total video result archival attempts by channel and outcome.\n")
	b.WriteString("# TYPE newapi_video_result_archive_total counter\n")
	for i, channel := range videoResultChannels {
		for j, outcome := range videoResultArchiveOutcomes {
			b.WriteString(`newapi_video_result_archive_total{channel="`)
			b.WriteString(channel)
			b.WriteString(`",outcome="`)
			b.WriteString(outcome)
			b.WriteString(`"} `)
			b.WriteString(strconv.FormatInt(snapshot.archiveTotal[i][j], 10))
			b.WriteByte('\n')
		}
	}

	b.WriteString("# HELP newapi_video_result_archive_bytes_total Total bytes newly archived for video results by channel.\n")
	b.WriteString("# TYPE newapi_video_result_archive_bytes_total counter\n")
	for i, channel := range videoResultChannels {
		b.WriteString(`newapi_video_result_archive_bytes_total{channel="`)
		b.WriteString(channel)
		b.WriteString(`"} `)
		b.WriteString(strconv.FormatInt(snapshot.archiveBytes[i], 10))
		b.WriteByte('\n')
	}

	b.WriteString("# HELP newapi_video_result_archive_duration_seconds Video result archival duration by channel.\n")
	b.WriteString("# TYPE newapi_video_result_archive_duration_seconds histogram\n")
	for i, channel := range videoResultChannels {
		for j, upperBound := range videoResultArchiveDurationBucketsSeconds {
			b.WriteString(`newapi_video_result_archive_duration_seconds_bucket{channel="`)
			b.WriteString(channel)
			b.WriteString(`",le="`)
			b.WriteString(formatPrometheusFloat(upperBound))
			b.WriteString(`"} `)
			b.WriteString(strconv.FormatInt(snapshot.archiveDurationBuckets[i][j], 10))
			b.WriteByte('\n')
		}
		b.WriteString(`newapi_video_result_archive_duration_seconds_bucket{channel="`)
		b.WriteString(channel)
		b.WriteString(`",le="+Inf"} `)
		b.WriteString(strconv.FormatInt(snapshot.archiveDurationCount[i], 10))
		b.WriteByte('\n')
		b.WriteString(`newapi_video_result_archive_duration_seconds_sum{channel="`)
		b.WriteString(channel)
		b.WriteString(`"} `)
		b.WriteString(formatPrometheusFloat(snapshot.archiveDurationSum[i]))
		b.WriteByte('\n')
		b.WriteString(`newapi_video_result_archive_duration_seconds_count{channel="`)
		b.WriteString(channel)
		b.WriteString(`"} `)
		b.WriteString(strconv.FormatInt(snapshot.archiveDurationCount[i], 10))
		b.WriteByte('\n')
	}

	b.WriteString("# HELP newapi_video_result_redirect_total Total archived video result redirects by channel and outcome.\n")
	b.WriteString("# TYPE newapi_video_result_redirect_total counter\n")
	for i, channel := range videoResultChannels {
		for j, outcome := range videoResultRedirectOutcomes {
			b.WriteString(`newapi_video_result_redirect_total{channel="`)
			b.WriteString(channel)
			b.WriteString(`",outcome="`)
			b.WriteString(outcome)
			b.WriteString(`"} `)
			b.WriteString(strconv.FormatInt(snapshot.redirectTotal[i][j], 10))
			b.WriteByte('\n')
		}
	}

	b.WriteString("# HELP newapi_video_result_archive_retry_total Total video result archival retries by channel and reason.\n")
	b.WriteString("# TYPE newapi_video_result_archive_retry_total counter\n")
	for i, channel := range videoResultChannels {
		for j, reason := range videoResultArchiveRetryReasons {
			b.WriteString(`newapi_video_result_archive_retry_total{channel="`)
			b.WriteString(channel)
			b.WriteString(`",reason="`)
			b.WriteString(reason)
			b.WriteString(`"} `)
			b.WriteString(strconv.FormatInt(snapshot.archiveRetryTotal[i][j], 10))
			b.WriteByte('\n')
		}
	}
}

func ResetVideoResultMetricsForTest() {
	resetVideoResultMetricsForTest()
}

func resetVideoResultMetricsForTest() {
	videoResultMetricsInitialized.Store(false)
	for i := range videoResultArchiveTotal {
		for j := range videoResultArchiveTotal[i] {
			videoResultArchiveTotal[i][j].Store(0)
		}
		videoResultArchiveBytes[i].Store(0)
		for j := range videoResultArchiveDurationBuckets[i] {
			videoResultArchiveDurationBuckets[i][j].Store(0)
		}
		videoResultArchiveDurationSumBits[i].Store(0)
		videoResultArchiveDurationCount[i].Store(0)
		for j := range videoResultRedirectTotal[i] {
			videoResultRedirectTotal[i][j].Store(0)
		}
		for j := range videoResultArchiveRetryTotal[i] {
			videoResultArchiveRetryTotal[i][j].Store(0)
		}
	}
}

func addAtomicFloat64(bits *atomic.Uint64, delta float64) {
	for {
		oldBits := bits.Load()
		next := math.Float64bits(math.Float64frombits(oldBits) + delta)
		if bits.CompareAndSwap(oldBits, next) {
			return
		}
	}
}

func loadAtomicFloat64(bits *atomic.Uint64) float64 {
	return math.Float64frombits(bits.Load())
}
