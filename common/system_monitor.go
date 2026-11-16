package common

import (
	"fmt"
	"sync/atomic"
	"time"

	"github.com/shirou/gopsutil/cpu"
	"github.com/shirou/gopsutil/mem"
)

// DiskSpaceInfo disk space information
type DiskSpaceInfo struct {
	// Total space (bytes)
	Total uint64 `json:"total"`
	// Free space (bytes)
	Free uint64 `json:"free"`
	// Used space (bytes)
	Used uint64 `json:"used"`
	// Use percentage
	UsedPercent float64 `json:"used_percent"`
}

// SystemStatus system status information
type SystemStatus struct {
	CPUUsage    float64
	MemoryUsage float64
	DiskUsage   float64
	SampledAt   time.Time
	// Overload judgment with continuity requirements: a single sampling peak is no longer directly fused, but must exceed the threshold multiple times in a row.
	CPUOverloaded    bool
	MemoryOverloaded bool
	DiskOverloaded   bool
}

// SystemOverload is the overload used by Sentinel to reject requests. The Error text contains the current value and the effective threshold.
type SystemOverload struct {
	Code      string
	Resource  string
	Usage     float64
	Threshold int
}

func (o *SystemOverload) Error() string {
	return fmt.Sprintf("system %s overloaded (current: %.1f%%, threshold: %d%%)", o.Resource, o.Usage, o.Threshold)
}

var latestSystemStatus atomic.Value

const (
	systemMonitorInterval = 5 * time.Second
	// Overload will be determined only when 3 consecutive samples (about 15 seconds) are still higher than the threshold.
	// It will be restored when any sampling falls below the threshold to avoid retrying when the instantaneous spike is full.
	overloadConsecutiveSamples = 3
	// When the sampling exceeds this time and is not refreshed (monitoring is not running or is blocked), the sentinel will not be blown accordingly.
	systemStatusMaxAge = 30 * time.Second
)

func init() {
	latestSystemStatus.Store(SystemStatus{})
}

// StartSystemMonitor starts system monitoring
func StartSystemMonitor() {
	go func() {
		usage := newContainerUsage()
		var detector overloadDetector
		for {
			config := GetPerformanceMonitorConfig()
			if !config.Enabled {
				detector = overloadDetector{}
				latestSystemStatus.Store(SystemStatus{SampledAt: time.Now()})
				time.Sleep(systemMonitorInterval)
				continue
			}

			status := collectSystemStatus(usage)
			detector.mark(&status, config)
			latestSystemStatus.Store(status)

			time.Sleep(systemMonitorInterval)
		}
	}()
}

// overloadDetector accumulates the number of consecutive samples exceeding the threshold for each resource: consecutive overloadConsecutiveSamples times
// It will be marked as overload, and any drop will be immediately cleared and accumulated again.
type overloadDetector struct {
	cpuSamples    int
	memorySamples int
	diskSamples   int
}

func (d *overloadDetector) mark(status *SystemStatus, config PerformanceMonitorConfig) {
	status.CPUOverloaded = countOverloadSample(&d.cpuSamples, exceedsThreshold(status.CPUUsage, config.CPUThreshold))
	status.MemoryOverloaded = countOverloadSample(&d.memorySamples, exceedsThreshold(status.MemoryUsage, config.MemoryThreshold))
	status.DiskOverloaded = countOverloadSample(&d.diskSamples, exceedsThreshold(status.DiskUsage, config.DiskThreshold))
}

func countOverloadSample(samples *int, over bool) bool {
	if !over {
		*samples = 0
		return false
	}
	*samples = min(*samples+1, overloadConsecutiveSamples)
	return *samples == overloadConsecutiveSamples
}

// exceedsThreshold determines whether the sampling value exceeds the threshold; threshold <= 0 means not to check this item.
func exceedsThreshold(usage float64, threshold int) bool {
	return threshold > 0 && int(usage) > threshold
}

func collectSystemStatus(usage *containerUsage) SystemStatus {
	now := time.Now()
	status := SystemStatus{SampledAt: now}

	// CPU/memory is calculated based on the container cgroup quota first; when the container caliber is unavailable, it falls back to the host caliber.
	// Maintain compatibility with environments that have unrestricted resources or are mounted as hosting cgroups.
	if saturation, ok := usage.cpuSaturation(now); ok {
		status.CPUUsage = saturation
	} else if percents, err := cpu.Percent(0, false); err == nil && len(percents) > 0 {
		status.CPUUsage = percents[0]
	}
	if containerMemory, ok := usage.memoryUsage(); ok {
		status.MemoryUsage = containerMemory
	} else if memInfo, err := mem.VirtualMemory(); err == nil {
		status.MemoryUsage = memInfo.UsedPercent
	}

	diskInfo := GetDiskSpaceInfo()
	if diskInfo.Total > 0 {
		status.DiskUsage = diskInfo.UsedPercent
	}
	return status
}

// GetSystemStatus gets the current system status
func GetSystemStatus() SystemStatus {
	return latestSystemStatus.Load().(SystemStatus)
}

// CheckSystemOverload Returns the overload that the sentinel should circuit against. Monitoring is off, sampling is missing or has exceeded
// Returns nil when systemStatusMaxAge is set. The overload flag is derived from continuous sampling, and the threshold is reviewed according to the current configuration.
// When running, turn off or increase the threshold and release immediately without waiting for the next sampling.
func CheckSystemOverload(status SystemStatus, config PerformanceMonitorConfig, now time.Time) *SystemOverload {
	if !config.Enabled || status.SampledAt.IsZero() || now.Sub(status.SampledAt) > systemStatusMaxAge {
		return nil
	}
	if status.CPUOverloaded && exceedsThreshold(status.CPUUsage, config.CPUThreshold) {
		return &SystemOverload{Code: "system_cpu_overloaded", Resource: "cpu", Usage: status.CPUUsage, Threshold: config.CPUThreshold}
	}
	if status.MemoryOverloaded && exceedsThreshold(status.MemoryUsage, config.MemoryThreshold) {
		return &SystemOverload{Code: "system_memory_overloaded", Resource: "memory", Usage: status.MemoryUsage, Threshold: config.MemoryThreshold}
	}
	if status.DiskOverloaded && exceedsThreshold(status.DiskUsage, config.DiskThreshold) {
		return &SystemOverload{Code: "system_disk_overloaded", Resource: "disk", Usage: status.DiskUsage, Threshold: config.DiskThreshold}
	}
	return nil
}
