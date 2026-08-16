package common

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func resetApplicationTrafficForTest() {
	applicationTraffic.requestBytes.Store(0)
	applicationTraffic.responseBytes.Store(0)
	ResetNetworkBandwidthSampler()
}

func TestSampleNetworkBandwidthUsesApplicationTraffic(t *testing.T) {
	resetApplicationTrafficForTest()
	t.Cleanup(resetApplicationTrafficForTest)

	start := time.Unix(100, 0)
	require.False(t, sampleNetworkBandwidthCounters(start, 0, 0).Available)

	got := sampleNetworkBandwidthCounters(start.Add(5*time.Second), 1_250_000, 6_250_000)
	require.True(t, got.Available)
	assert.Equal(t, float64(2), got.UpMbps)
	assert.Equal(t, float64(10), got.DownMbps)
	assert.Len(t, got.UpSeries, 1)
	assert.Len(t, got.DownSeries, 1)

	zero := sampleNetworkBandwidthCounters(start.Add(10*time.Second), 1_250_000, 6_250_000)
	require.True(t, zero.Available)
	assert.Zero(t, zero.UpMbps)
	assert.Zero(t, zero.DownMbps)
}

func TestSampleNetworkBandwidthResetsOnRollbackAndRecovery(t *testing.T) {
	resetApplicationTrafficForTest()
	t.Cleanup(resetApplicationTrafficForTest)

	start := time.Unix(200, 0)
	require.False(t, sampleNetworkBandwidthCounters(start, 100, 200).Available)
	require.True(t, sampleNetworkBandwidthCounters(start.Add(time.Second), 200, 400).Available)
	require.False(t, sampleNetworkBandwidthCounters(start.Add(2*time.Second), 50, 100).Available)
	require.True(t, sampleNetworkBandwidthCounters(start.Add(3*time.Second), 150, 300).Available)

	ResetNetworkBandwidthSampler()
	require.False(t, sampleNetworkBandwidthCounters(start.Add(4*time.Second), 200, 400).Available)
	require.True(t, sampleNetworkBandwidthCounters(start.Add(5*time.Second), 300, 600).Available)
}

func TestSampleNetworkBandwidthRejectsInvalidElapsedTime(t *testing.T) {
	resetApplicationTrafficForTest()
	t.Cleanup(resetApplicationTrafficForTest)

	start := time.Unix(300, 0)
	require.False(t, sampleNetworkBandwidthCounters(start, 100, 200).Available)
	require.False(t, sampleNetworkBandwidthCounters(start, 200, 400).Available)
	require.True(t, sampleNetworkBandwidthCounters(start.Add(time.Second), 300, 600).Available)
}

func TestSampleNetworkBandwidthKeepsTwelveHistoryPoints(t *testing.T) {
	resetApplicationTrafficForTest()
	t.Cleanup(resetApplicationTrafficForTest)

	start := time.Unix(400, 0)
	require.False(t, sampleNetworkBandwidthCounters(start, 0, 0).Available)
	var got NetworkBandwidth
	for i := 1; i <= networkSeriesLength+2; i++ {
		got = sampleNetworkBandwidthCounters(
			start.Add(time.Duration(i)*time.Second),
			uint64(i*1000),
			uint64(i*2000),
		)
	}
	assert.Len(t, got.UpSeries, networkSeriesLength)
	assert.Len(t, got.DownSeries, networkSeriesLength)
	assert.Equal(t, bytesPerSecondToMbps(1000), got.UpSeries[len(got.UpSeries)-1])
	assert.Equal(t, bytesPerSecondToMbps(2000), got.DownSeries[len(got.DownSeries)-1])
}
