package common

import (
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
	CPUUsage      float64
	MemoryUsage   float64
	DiskUsage     float64
	CPUQuotaCores float64
	SampledAt     time.Time
	// 过载判定带连续性要求：单一采样尖峰不再直接熔断，需连续多次超阈值。
	CPUOverloaded    bool
	MemoryOverloaded bool
	DiskOverloaded   bool
}

var latestSystemStatus atomic.Value

const (
	systemMonitorInterval = 5 * time.Second
	// 连续 3 次采样（约 15 秒）仍高于阈值才判定过载，
	// 任一采样回落到阈值以下即恢复，避免瞬时尖峰打满重试。
	overloadConsecutiveSamples = 3
	// 采样超过该时长未刷新（监控未运行或被阻塞）时，哨兵不据此熔断。
	SystemStatusMaxAge = 30 * time.Second
)

func init() {
	latestSystemStatus.Store(SystemStatus{})
}

// StartSystemMonitor 启动系统监控
func StartSystemMonitor() {
	go func() {
		usage := NewContainerUsage()
		cpuStreak, memoryStreak, diskStreak := 0, 0, 0
		for {
			config := GetPerformanceMonitorConfig()
			if !config.Enabled {
				cpuStreak, memoryStreak, diskStreak = 0, 0, 0
				latestSystemStatus.Store(SystemStatus{SampledAt: time.Now()})
				time.Sleep(systemMonitorInterval)
				continue
			}

			status, cpuOver, memoryOver, diskOver := collectSystemStatus(usage, config)
			cpuStreak = nextOverloadStreak(cpuStreak, cpuOver)
			memoryStreak = nextOverloadStreak(memoryStreak, memoryOver)
			diskStreak = nextOverloadStreak(diskStreak, diskOver)
			status.CPUOverloaded = cpuStreak >= overloadConsecutiveSamples
			status.MemoryOverloaded = memoryStreak >= overloadConsecutiveSamples
			status.DiskOverloaded = diskStreak >= overloadConsecutiveSamples
			latestSystemStatus.Store(status)

			time.Sleep(systemMonitorInterval)
		}
	}()
}

func nextOverloadStreak(streak int, over bool) int {
	if !over {
		return 0
	}
	return streak + 1
}

func collectSystemStatus(usage *ContainerUsage, config PerformanceMonitorConfig) (
	status SystemStatus, cpuOver bool, memoryOver bool, diskOver bool,
) {
	now := time.Now()
	status.SampledAt = now

	// CPU / 内存优先按容器 cgroup 配额计算；容器口径不可用时回退宿主机口径，
	// 保持对未限制资源或被挂载为宿主 cgroup 的环境的兼容。
	if quota, ok := usage.CPULimitCores(); ok {
		status.CPUQuotaCores = quota
	}
	if saturation, ok := usage.CPUSaturation(now); ok {
		status.CPUUsage = saturation
	} else if percents, err := cpu.Percent(0, false); err == nil && len(percents) > 0 {
		status.CPUUsage = percents[0]
	}
	if containerMemory, ok := usage.MemoryUsage(); ok {
		status.MemoryUsage = containerMemory
	} else if memInfo, err := mem.VirtualMemory(); err == nil {
		status.MemoryUsage = memInfo.UsedPercent
	}

	diskInfo := GetDiskSpaceInfo()
	if diskInfo.Total > 0 {
		status.DiskUsage = diskInfo.UsedPercent
	}

	cpuOver = config.CPUThreshold > 0 && int(status.CPUUsage) > config.CPUThreshold
	memoryOver = config.MemoryThreshold > 0 && int(status.MemoryUsage) > config.MemoryThreshold
	diskOver = config.DiskThreshold > 0 && int(status.DiskUsage) > config.DiskThreshold
	return status, cpuOver, memoryOver, diskOver
}

// GetSystemStatus 获取当前系统状态
func GetSystemStatus() SystemStatus {
	return latestSystemStatus.Load().(SystemStatus)
}

// SetSystemStatus 覆盖当前系统状态；系统监控与测试使用。
func SetSystemStatus(status SystemStatus) {
	latestSystemStatus.Store(status)
}

// IsSystemStatusFresh 判断采样是否足够新，过期状态不参与过载熔断。
func IsSystemStatusFresh(status SystemStatus) bool {
	if status.SampledAt.IsZero() {
		return false
	}
	return time.Since(status.SampledAt) <= SystemStatusMaxAge
}
