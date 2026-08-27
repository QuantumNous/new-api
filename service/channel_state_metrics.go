package service

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const channelStateMetricName = "new_api_channel_state"

type channelStateCollector struct {
	desc  *prometheus.Desc
	query func() ([]model.ChannelStateSnapshot, error)
}

func newChannelStateCollector(query func() ([]model.ChannelStateSnapshot, error)) *channelStateCollector {
	return &channelStateCollector{
		desc: prometheus.NewDesc(
			channelStateMetricName,
			"Current persisted state of an AI channel (1 = current state).",
			[]string{"channel_id", "channel_type", "state"},
			nil,
		),
		query: query,
	}
}

func (collector *channelStateCollector) Describe(metrics chan<- *prometheus.Desc) {
	metrics <- collector.desc
}

func (collector *channelStateCollector) Collect(metrics chan<- prometheus.Metric) {
	snapshots, err := collector.query()
	if err != nil {
		common.SysError(fmt.Sprintf("failed to collect channel state metrics: %v", err))
		metrics <- prometheus.NewInvalidMetric(collector.desc, errors.New("channel state snapshot unavailable"))
		return
	}
	for _, snapshot := range snapshots {
		metrics <- prometheus.MustNewConstMetric(
			collector.desc,
			prometheus.GaugeValue,
			1,
			strconv.Itoa(snapshot.ID),
			strconv.Itoa(snapshot.Type),
			channelStateLabel(snapshot.Status),
		)
	}
}

func channelStateLabel(status int) string {
	switch status {
	case common.ChannelStatusEnabled:
		return "enabled"
	case common.ChannelStatusManuallyDisabled:
		return "manually_disabled"
	case common.ChannelStatusAutoDisabled:
		return "auto_disabled"
	default:
		return "unknown"
	}
}

func NewChannelStateMetricsHandler() http.Handler {
	return newChannelStateMetricsHandler(model.ListChannelStateSnapshots)
}

func newChannelStateMetricsHandler(query func() ([]model.ChannelStateSnapshot, error)) http.Handler {
	registry := prometheus.NewRegistry()
	registry.MustRegister(newChannelStateCollector(query))
	return promhttp.HandlerFor(registry, promhttp.HandlerOpts{
		ErrorHandling: promhttp.HTTPErrorOnError,
	})
}
