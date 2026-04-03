package metrics

import (
	"os"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// RelayMetricsEnabled controls whether relay metrics are recorded.
// Set METRICS_RELAY_ENABLED=true to enable. Default is false.
var RelayMetricsEnabled = os.Getenv("METRICS_RELAY_ENABLED") == "true"

var (
	RelayFirstTokenDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "newapi_relay_first_token_duration_seconds",
			Help:    "Time from relay request start to first token received in streaming responses.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"model", "channel"},
	)
	RelayRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "newapi_relay_requests_total",
			Help: "Total number of relay requests by model, channel, and status.",
		},
		[]string{"model", "channel", "status"},
	)
	RelayRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "newapi_relay_request_duration_seconds",
			Help:    "End-to-end relay request duration by model and channel.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"model", "channel"},
	)
	RelayTokensInputTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "newapi_relay_tokens_input_total",
			Help: "Total number of relay input tokens by model and channel.",
		},
		[]string{"model", "channel"},
	)
	RelayTokensOutputTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "newapi_relay_tokens_output_total",
			Help: "Total number of relay output tokens by model and channel.",
		},
		[]string{"model", "channel"},
	)
)

func RecordRelayRequest(model string, channelID int, statusCode int) {
	if !RelayMetricsEnabled {
		return
	}
	RelayRequestsTotal.WithLabelValues(model, relayChannelLabel(channelID), strconv.Itoa(statusCode)).Inc()
}

func ObserveRelayRequestDuration(model string, channelID int, start time.Time) {
	if !RelayMetricsEnabled || start.IsZero() {
		return
	}
	RelayRequestDuration.WithLabelValues(model, relayChannelLabel(channelID)).Observe(time.Since(start).Seconds())
}

func AddRelayInputTokens(model string, channelID int, tokens int) {
	if !RelayMetricsEnabled || tokens <= 0 {
		return
	}
	RelayTokensInputTotal.WithLabelValues(model, relayChannelLabel(channelID)).Add(float64(tokens))
}

func AddRelayOutputTokens(model string, channelID int, tokens int) {
	if !RelayMetricsEnabled || tokens <= 0 {
		return
	}
	RelayTokensOutputTotal.WithLabelValues(model, relayChannelLabel(channelID)).Add(float64(tokens))
}

func relayChannelLabel(channelID int) string {
	if channelID <= 0 {
		return ""
	}
	return strconv.Itoa(channelID)
}
