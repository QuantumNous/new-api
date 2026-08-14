package common

import (
	"errors"
	"sync"
	"sync/atomic"
	"time"

	"github.com/shirou/gopsutil/cpu"
	"github.com/shirou/gopsutil/mem"
	gopsutilnet "github.com/shirou/gopsutil/net"
)

const (
	systemMonitorInterval = 5 * time.Second
	networkSeriesLimit    = 12
)

// DiskSpaceInfo describes the filesystem containing the application cache.
type DiskSpaceInfo struct {
	Total       uint64  `json:"total"`
	Free        uint64  `json:"free"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
}

// NetworkThroughputSample is a valid point in the recent node throughput series.
type NetworkThroughputSample struct {
	Timestamp        int64
	TxBytesPerSecond float64
	RxBytesPerSecond float64
}

// SystemStatus is the latest container-visible resource snapshot. The legacy
// percentage fields remain the source used by overload protection.
type SystemStatus struct {
	SampledAt int64

	CPUUsage     float64
	CPUAvailable bool

	MemoryUsage     float64
	MemoryUsed      uint64
	MemoryTotal     uint64
	MemoryAvailable bool

	DiskUsage     float64
	DiskUsed      uint64
	DiskTotal     uint64
	DiskAvailable bool

	NetworkTxBytesPerSecond float64
	NetworkRxBytesPerSecond float64
	NetworkAvailable        bool
	NetworkSeries           []NetworkThroughputSample
}

type systemMetricSource struct {
	now        func() time.Time
	cpuPercent func() ([]float64, error)
	memory     func() (*mem.VirtualMemoryStat, error)
	disk       func() (DiskSpaceInfo, error)
	network    func() ([]gopsutilnet.IOCountersStat, error)
}

type networkCounter struct {
	timestamp time.Time
	txBytes   uint64
	rxBytes   uint64
}

type systemSampler struct {
	mu              sync.Mutex
	source          systemMetricSource
	previousNetwork *networkCounter
	networkSeries   []NetworkThroughputSample
}

func defaultSystemMetricSource() systemMetricSource {
	return systemMetricSource{
		now:        time.Now,
		cpuPercent: func() ([]float64, error) { return cpu.Percent(0, false) },
		memory:     mem.VirtualMemory,
		disk: func() (DiskSpaceInfo, error) {
			info := GetDiskSpaceInfo()
			if info.Total == 0 {
				return info, errors.New("disk filesystem metrics are unavailable")
			}
			return info, nil
		},
		network: func() ([]gopsutilnet.IOCountersStat, error) {
			return gopsutilnet.IOCounters(false)
		},
	}
}

func newSystemSampler(source systemMetricSource) *systemSampler {
	return &systemSampler{source: source, networkSeries: make([]NetworkThroughputSample, 0, networkSeriesLimit)}
}

func (sampler *systemSampler) sample() SystemStatus {
	sampler.mu.Lock()
	defer sampler.mu.Unlock()

	now := sampler.source.now()
	status := SystemStatus{SampledAt: now.Unix()}

	if percents, err := sampler.source.cpuPercent(); err == nil && len(percents) > 0 {
		status.CPUUsage = percents[0]
		status.CPUAvailable = true
	}

	if memory, err := sampler.source.memory(); err == nil && memory != nil && memory.Total > 0 {
		status.MemoryUsage = memory.UsedPercent
		status.MemoryUsed = memory.Used
		status.MemoryTotal = memory.Total
		status.MemoryAvailable = true
	}

	if disk, err := sampler.source.disk(); err == nil && disk.Total > 0 {
		status.DiskUsage = disk.UsedPercent
		status.DiskUsed = disk.Used
		status.DiskTotal = disk.Total
		status.DiskAvailable = true
	}

	status.NetworkTxBytesPerSecond, status.NetworkRxBytesPerSecond, status.NetworkAvailable = sampler.sampleNetwork(now)
	status.NetworkSeries = append([]NetworkThroughputSample(nil), sampler.networkSeries...)
	return status
}

func (sampler *systemSampler) sampleNetwork(now time.Time) (float64, float64, bool) {
	counters, err := sampler.source.network()
	if err != nil || len(counters) == 0 {
		return 0, 0, false
	}

	current := networkCounter{timestamp: now}
	for _, counter := range counters {
		current.txBytes += counter.BytesSent
		current.rxBytes += counter.BytesRecv
	}

	previous := sampler.previousNetwork
	sampler.previousNetwork = &current
	if previous == nil {
		return 0, 0, false
	}
	if current.txBytes < previous.txBytes || current.rxBytes < previous.rxBytes {
		sampler.networkSeries = sampler.networkSeries[:0]
		return 0, 0, false
	}

	elapsed := now.Sub(previous.timestamp).Seconds()
	if elapsed <= 0 {
		return 0, 0, false
	}

	txRate := float64(current.txBytes-previous.txBytes) / elapsed
	rxRate := float64(current.rxBytes-previous.rxBytes) / elapsed
	sampler.networkSeries = append(sampler.networkSeries, NetworkThroughputSample{
		Timestamp:        now.Unix(),
		TxBytesPerSecond: txRate,
		RxBytesPerSecond: rxRate,
	})
	if len(sampler.networkSeries) > networkSeriesLimit {
		sampler.networkSeries = append([]NetworkThroughputSample(nil), sampler.networkSeries[len(sampler.networkSeries)-networkSeriesLimit:]...)
	}
	return txRate, rxRate, true
}

var (
	latestSystemStatus   atomic.Value
	defaultSampler       = newSystemSampler(defaultSystemMetricSource())
	systemMonitorStarter sync.Once
)

func init() {
	latestSystemStatus.Store(SystemStatus{NetworkSeries: []NetworkThroughputSample{}})
}

// StartSystemMonitor starts the process-wide sampler once. Sampling is always
// active; performance-monitor configuration only controls request rejection.
func StartSystemMonitor() {
	systemMonitorStarter.Do(func() {
		updateSystemStatus()
		go func() {
			ticker := time.NewTicker(systemMonitorInterval)
			defer ticker.Stop()
			for range ticker.C {
				updateSystemStatus()
			}
		}()
	})
}

func updateSystemStatus() {
	latestSystemStatus.Store(defaultSampler.sample())
}

// GetSystemStatus returns a copy so callers cannot mutate the shared series.
func GetSystemStatus() SystemStatus {
	status := latestSystemStatus.Load().(SystemStatus)
	status.NetworkSeries = append([]NetworkThroughputSample(nil), status.NetworkSeries...)
	return status
}
