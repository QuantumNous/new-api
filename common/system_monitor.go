package common

import (
	"fmt"
	"sync/atomic"
	"time"

	"github.com/shirou/gopsutil/cpu"
	"github.com/shirou/gopsutil/mem"
)

// DiskSpaceInfo 磁盘空间信息
type DiskSpaceInfo struct {
	// 总空间（字节）
	Total uint64 `json:"total"`
	// 可用空间（字节）
	Free uint64 `json:"free"`
	// 已用空间（字节）
	Used uint64 `json:"used"`
	// 使用百分比
	UsedPercent float64 `json:"used_percent"`
}

// SystemStatus 系统状态信息
type SystemStatus struct {
	CPUUsage    float64
	MemoryUsage float64
	DiskUsage   float64
	SampledAt   time.Time
	// 过载判定带连续性要求：单一采样尖峰不再直接熔断，需连续多次超阈值。
	CPUOverloaded    bool
	MemoryOverloaded bool
	DiskOverloaded   bool
}

// SystemOverload 是哨兵据以拒绝请求的过载项，Error 文本带当前值与生效阈值。
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
	// 连续 3 次采样（约 15 秒）仍高于阈值才判定过载，
	// 任一采样回落到阈值以下即恢复，避免瞬时尖峰打满重试。
	overloadConsecutiveSamples = 3
	// 采样超过该时长未刷新（监控未运行或被阻塞）时，哨兵不据此熔断。
	systemStatusMaxAge = 30 * time.Second
)

func init() {
	latestSystemStatus.Store(SystemStatus{})
}

// StartSystemMonitor 启动系统监控
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

// overloadDetector 为每项资源累计连续超阈值的采样次数：连续 overloadConsecutiveSamples 次
// 才标记过载，任一次回落立即清零并重新累计。
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

// exceedsThreshold 判断采样值是否超过阈值；阈值 <= 0 表示不检查该项。
func exceedsThreshold(usage float64, threshold int) bool {
	return threshold > 0 && int(usage) > threshold
}

func collectSystemStatus(usage *containerUsage) SystemStatus {
	now := time.Now()
	status := SystemStatus{SampledAt: now}

	// CPU / 内存优先按容器 cgroup 配额计算；容器口径不可用时回退宿主机口径，
	// 保持对未限制资源或被挂载为宿主 cgroup 的环境的兼容。
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

// GetSystemStatus 获取当前系统状态
func GetSystemStatus() SystemStatus {
	return latestSystemStatus.Load().(SystemStatus)
}

// CheckSystemOverload 返回哨兵应据以熔断的过载项。监控关闭、采样缺失或已超过
// systemStatusMaxAge 时返回 nil。过载标记来自连续采样，阈值按当前配置复核，
// 运行时关闭或调高阈值后立即放行，不必等待下一次采样。
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
