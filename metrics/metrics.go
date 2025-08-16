package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"strconv"
	"sync"
)

const (
	unknownModel = "UNKNOWN"
)

var (
	enableMetrics = false
	metricsOnce   sync.Once

	relaySuccess *prometheus.CounterVec
	relayFailure *prometheus.CounterVec
)

func InitMetrics() {
	metricsOnce.Do(doInitMetrics)
}

func doInitMetrics() {
	enableMetrics = true
	relaySuccess = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "newapi",
		Subsystem: "relay",
		Name:      "success",
		Help:      "",
	}, []string{"origin_model", "upstream_model", "group", "channel_id"})
	relayFailure = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "newapi",
		Subsystem: "relay",
		Name:      "failure",
		Help:      "",
	}, []string{"origin_model", "upstream_model", "group", "channel_id", "code"})
}

func ReportSuccess(originalModel, upstreamModel, group string, channelID int) {
	if !enableMetrics {
		return
	}
	if upstreamModel == "" {
		upstreamModel = unknownModel
	}
	relaySuccess.WithLabelValues(originalModel, upstreamModel, group, strconv.Itoa(channelID)).Inc()
}

func ReportFailure(originalModel, upstreamModel, group string, channelID int, code int) {
	if !enableMetrics {
		return
	}
	if upstreamModel == "" {
		upstreamModel = unknownModel
	}
	relayFailure.WithLabelValues(originalModel, upstreamModel, group, strconv.Itoa(channelID), strconv.Itoa(code)).Inc()
}
