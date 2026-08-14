package common

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/shirou/gopsutil/mem"
	gopsutilnet "github.com/shirou/gopsutil/net"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSystemSamplerFirstNetworkSampleAndRate(t *testing.T) {
	now := time.Unix(1_786_700_000, 0)
	txBytes := uint64(1_000)
	rxBytes := uint64(2_000)
	sampler := newSystemSampler(systemMetricSource{
		now:        func() time.Time { return now },
		cpuPercent: func() ([]float64, error) { return []float64{34.2}, nil },
		memory: func() (*mem.VirtualMemoryStat, error) {
			return &mem.VirtualMemoryStat{Used: 5_583_457_484, Total: 17_179_869_184, UsedPercent: 32.5}, nil
		},
		disk: func() (DiskSpaceInfo, error) {
			return DiskSpaceInfo{Used: 234_075_717_632, Total: 549_755_813_888, UsedPercent: 42.6}, nil
		},
		network: func() ([]gopsutilnet.IOCountersStat, error) {
			return []gopsutilnet.IOCountersStat{{BytesSent: txBytes, BytesRecv: rxBytes}}, nil
		},
	})

	first := sampler.sample()
	assert.Equal(t, now.Unix(), first.SampledAt)
	assert.True(t, first.CPUAvailable)
	assert.True(t, first.MemoryAvailable)
	assert.True(t, first.DiskAvailable)
	assert.False(t, first.NetworkAvailable)
	assert.Empty(t, first.NetworkSeries)

	now = now.Add(5 * time.Second)
	txBytes += 5_000
	rxBytes += 10_000
	second := sampler.sample()
	require.True(t, second.NetworkAvailable)
	assert.InDelta(t, 1_000, second.NetworkTxBytesPerSecond, 0.001)
	assert.InDelta(t, 2_000, second.NetworkRxBytesPerSecond, 0.001)
	require.Len(t, second.NetworkSeries, 1)
	assert.Equal(t, now.Unix(), second.NetworkSeries[0].Timestamp)
}

func TestSystemSamplerResetsNetworkSeriesOnCounterRollback(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	counter := gopsutilnet.IOCountersStat{BytesSent: 100, BytesRecv: 200}
	sampler := newSystemSampler(systemMetricSource{
		now:        func() time.Time { return now },
		cpuPercent: func() ([]float64, error) { return nil, errors.New("unavailable") },
		memory:     func() (*mem.VirtualMemoryStat, error) { return nil, errors.New("unavailable") },
		disk:       func() (DiskSpaceInfo, error) { return DiskSpaceInfo{}, errors.New("unavailable") },
		network: func() ([]gopsutilnet.IOCountersStat, error) {
			return []gopsutilnet.IOCountersStat{counter}, nil
		},
	})

	sampler.sample()
	now = now.Add(5 * time.Second)
	counter.BytesSent = 200
	counter.BytesRecv = 400
	require.True(t, sampler.sample().NetworkAvailable)

	now = now.Add(5 * time.Second)
	counter.BytesSent = 10
	counter.BytesRecv = 20
	rolledBack := sampler.sample()
	assert.False(t, rolledBack.NetworkAvailable)
	assert.Empty(t, rolledBack.NetworkSeries)

	now = now.Add(5 * time.Second)
	counter.BytesSent = 60
	counter.BytesRecv = 120
	recovered := sampler.sample()
	require.True(t, recovered.NetworkAvailable)
	assert.InDelta(t, 10, recovered.NetworkTxBytesPerSecond, 0.001)
	assert.InDelta(t, 20, recovered.NetworkRxBytesPerSecond, 0.001)
}

func TestSystemSamplerKeepsIndependentFailuresNullable(t *testing.T) {
	sampler := newSystemSampler(systemMetricSource{
		now:        func() time.Time { return time.Unix(1_700_000_000, 0) },
		cpuPercent: func() ([]float64, error) { return nil, errors.New("cpu failed") },
		memory: func() (*mem.VirtualMemoryStat, error) {
			return &mem.VirtualMemoryStat{Used: 25, Total: 100, UsedPercent: 25}, nil
		},
		disk: func() (DiskSpaceInfo, error) { return DiskSpaceInfo{}, errors.New("disk failed") },
		network: func() ([]gopsutilnet.IOCountersStat, error) {
			return nil, errors.New("network failed")
		},
	})

	status := sampler.sample()
	assert.False(t, status.CPUAvailable)
	assert.True(t, status.MemoryAvailable)
	assert.Equal(t, uint64(25), status.MemoryUsed)
	assert.False(t, status.DiskAvailable)
	assert.False(t, status.NetworkAvailable)
}

func TestSystemSamplerLimitsNetworkSeriesToTwelvePoints(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	counter := gopsutilnet.IOCountersStat{}
	sampler := newSystemSampler(systemMetricSource{
		now:        func() time.Time { return now },
		cpuPercent: func() ([]float64, error) { return nil, errors.New("unavailable") },
		memory:     func() (*mem.VirtualMemoryStat, error) { return nil, errors.New("unavailable") },
		disk:       func() (DiskSpaceInfo, error) { return DiskSpaceInfo{}, errors.New("unavailable") },
		network: func() ([]gopsutilnet.IOCountersStat, error) {
			return []gopsutilnet.IOCountersStat{counter}, nil
		},
	})

	sampler.sample()
	for range networkSeriesLimit + 1 {
		now = now.Add(5 * time.Second)
		counter.BytesSent += 5
		counter.BytesRecv += 10
		sampler.sample()
	}
	status := sampler.sample()
	require.Len(t, status.NetworkSeries, networkSeriesLimit)
	assert.Equal(t, now.Add(-55*time.Second).Unix(), status.NetworkSeries[0].Timestamp)
}

func TestGetSystemStatusSupportsConcurrentReaders(t *testing.T) {
	previous := GetSystemStatus()
	t.Cleanup(func() { latestSystemStatus.Store(previous) })
	latestSystemStatus.Store(SystemStatus{
		SampledAt:     123,
		NetworkSeries: []NetworkThroughputSample{{Timestamp: 123, TxBytesPerSecond: 1}},
	})

	start := make(chan struct{})
	results := make(chan SystemStatus, 8)
	var readers sync.WaitGroup
	for range 8 {
		readers.Add(1)
		go func() {
			defer readers.Done()
			<-start
			results <- GetSystemStatus()
		}()
	}
	close(start)
	readers.Wait()
	close(results)

	for status := range results {
		assert.Equal(t, int64(123), status.SampledAt)
		require.Len(t, status.NetworkSeries, 1)
		status.NetworkSeries[0].Timestamp = 999
	}
	assert.Equal(t, int64(123), GetSystemStatus().NetworkSeries[0].Timestamp)
}
