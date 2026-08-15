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
	assert.False(t, sampleNetworkBandwidthAt(start).Available)

	ObserveApplicationTraffic(1_250_000, 6_250_000)
	got := sampleNetworkBandwidthAt(start.Add(5 * time.Second))
	assert.True(t, got.Available)
	assert.Equal(t, float64(2), got.UpMbps)
	assert.Equal(t, float64(10), got.DownMbps)
	assert.Len(t, got.UpSeries, 1)
	assert.Len(t, got.DownSeries, 1)

	zero := sampleNetworkBandwidthAt(start.Add(10 * time.Second))
	assert.True(t, zero.Available)
	assert.Zero(t, zero.UpMbps)
	assert.Zero(t, zero.DownMbps)
}

func TestSampleNetworkBandwidthResetsAfterCounterRollback(t *testing.T) {
	resetApplicationTrafficForTest()
	t.Cleanup(resetApplicationTrafficForTest)

	start := time.Unix(200, 0)
	sampleNetworkBandwidthAt(start)
	ObserveApplicationTraffic(100, 200)
	require.True(t, sampleNetworkBandwidthAt(start.Add(time.Second)).Available)

	applicationTraffic.requestBytes.Store(0)
	applicationTraffic.responseBytes.Store(0)
	assert.False(t, sampleNetworkBandwidthAt(start.Add(2*time.Second)).Available)
}

func TestObserveApplicationTrafficIgnoresNegativeBytes(t *testing.T) {
	resetApplicationTrafficForTest()
	t.Cleanup(resetApplicationTrafficForTest)

	ObserveApplicationTraffic(-1, -2)
	start := time.Unix(300, 0)
	sampleNetworkBandwidthAt(start)
	got := sampleNetworkBandwidthAt(start.Add(time.Second))
	assert.True(t, got.Available)
	assert.Zero(t, got.UpMbps)
	assert.Zero(t, got.DownMbps)
}
