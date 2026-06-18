package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/require"
)

func TestBuildChannelMonitorOverallSummaryDegradesOnFailedOrUnknown(t *testing.T) {
	items := []channelMonitorUserMonitorStatus{
		{PrimaryStatus: service.MonitorStatusOperational},
		{PrimaryStatus: service.MonitorStatusFailed},
		{PrimaryStatus: "unknown"},
	}

	summary := buildChannelMonitorOverallSummary(items)

	require.Equal(t, 3, summary.MonitoredCount)
	require.Equal(t, 1, summary.OperationalCount)
	require.Equal(t, 1, summary.FailedCount)
	require.Equal(t, 1, summary.UnknownCount)
	require.Equal(t, service.MonitorStatusDegraded, summary.OverallState)
}

func TestBuildChannelMonitorOverallSummaryOperationalWhenAllOperational(t *testing.T) {
	items := []channelMonitorUserMonitorStatus{
		{PrimaryStatus: service.MonitorStatusOperational},
		{PrimaryStatus: service.MonitorStatusOperational},
	}

	summary := buildChannelMonitorOverallSummary(items)

	require.Equal(t, 2, summary.MonitoredCount)
	require.Equal(t, 2, summary.OperationalCount)
	require.Equal(t, service.MonitorStatusOperational, summary.OverallState)
}
