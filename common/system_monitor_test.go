package common

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPerformanceMonitorToggleResetsCachedStateAndBandwidthBaseline(t *testing.T) {
	original := GetPerformanceMonitorConfig()
	t.Cleanup(func() {
		SetPerformanceMonitorConfig(original)
		resetSystemMonitorState()
	})

	SetPerformanceMonitorConfig(PerformanceMonitorConfig{
		Enabled:         true,
		CPUThreshold:    original.CPUThreshold,
		MemoryThreshold: original.MemoryThreshold,
		DiskThreshold:   original.DiskThreshold,
	})
	latestSystemStatus.Store(SystemStatus{CPUUsage: 42, CPUAvailable: true})
	latestNetworkBandwidth.Store(NetworkBandwidth{Available: true, UpMbps: 1, DownMbps: 2})
	start := time.Unix(100, 0)
	require.False(t, sampleNetworkBandwidthCounters(start, 100, 200).Available)
	require.True(t, sampleNetworkBandwidthCounters(start.Add(time.Second), 200, 400).Available)

	SetPerformanceMonitorConfig(PerformanceMonitorConfig{
		Enabled:         false,
		CPUThreshold:    original.CPUThreshold,
		MemoryThreshold: original.MemoryThreshold,
		DiskThreshold:   original.DiskThreshold,
	})

	status := GetSystemStatus()
	assert.False(t, status.CPUAvailable)
	assert.False(t, status.Network.Available)
	require.False(t, sampleNetworkBandwidthCounters(start.Add(2*time.Second), 300, 600).Available)

	SetPerformanceMonitorConfig(PerformanceMonitorConfig{
		Enabled:         true,
		CPUThreshold:    original.CPUThreshold,
		MemoryThreshold: original.MemoryThreshold,
		DiskThreshold:   original.DiskThreshold,
	})
	status = GetSystemStatus()
	assert.False(t, status.CPUAvailable)
	assert.False(t, status.Network.Available)
	require.False(t, sampleNetworkBandwidthCounters(start.Add(3*time.Second), 400, 800).Available)
}
