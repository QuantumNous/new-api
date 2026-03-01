package controller

import (
	"os"
	"runtime"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/go-fuego/fuego"
)

// GetPerformanceStats 获取性能统计信息
func GetPerformanceStats(c fuego.ContextNoBody) (*dto.Response[dto.PerformanceStats], error) {
	// 不再每次获取统计都全量扫描磁盘，依赖原子计数器保证性能
	// 仅在系统启动或显式清理时同步
	cacheStats := common.GetDiskCacheStats()

	// 获取内存统计
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// 获取磁盘缓存目录信息
	diskCacheInfo := getDiskCacheInfo()

	// 获取配置信息
	diskConfig := common.GetDiskCacheConfig()
	monitorConfig := common.GetPerformanceMonitorConfig()
	config := dto.PerformanceConfig{
		DiskCacheEnabled:       diskConfig.Enabled,
		DiskCacheThresholdMB:   diskConfig.ThresholdMB,
		DiskCacheMaxSizeMB:     diskConfig.MaxSizeMB,
		DiskCachePath:          diskConfig.Path,
		IsRunningInContainer:   common.IsRunningInContainer(),
		MonitorEnabled:         monitorConfig.Enabled,
		MonitorCPUThreshold:    monitorConfig.CPUThreshold,
		MonitorMemoryThreshold: monitorConfig.MemoryThreshold,
		MonitorDiskThreshold:   monitorConfig.DiskThreshold,
	}

	// 获取磁盘空间信息
	// 使用缓存的系统状态，避免频繁调用系统 API
	systemStatus := common.GetSystemStatus()
	diskSpaceInfo := common.DiskSpaceInfo{
		UsedPercent: systemStatus.DiskUsage,
	}
	// 如果需要详细信息，可以按需获取，或者扩展 SystemStatus
	// 这里为了保持接口兼容性，我们仍然调用 GetDiskSpaceInfo，但注意这可能会有性能开销
	// 考虑到 GetPerformanceStats 是管理接口，频率较低，直接调用是可以接受的
	// 但为了一致性，我们也可以考虑从 SystemStatus 中获取部分信息
	diskSpaceInfo = common.GetDiskSpaceInfo()

	stats := dto.PerformanceStats{
		CacheStats: cacheStats,
		MemoryStats: dto.MemoryStats{
			Alloc:        memStats.Alloc,
			TotalAlloc:   memStats.TotalAlloc,
			Sys:          memStats.Sys,
			NumGC:        memStats.NumGC,
			NumGoroutine: runtime.NumGoroutine(),
		},
		DiskCacheInfo: diskCacheInfo,
		DiskSpaceInfo: diskSpaceInfo,
		Config:        config,
	}

	return dto.Ok(stats)
}

// ClearDiskCache 清理不活跃的磁盘缓存
func ClearDiskCache(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	// 清理超过 10 分钟未使用的缓存文件
	// 10 分钟是一个安全的阈值，确保正在进行的请求不会被误删
	err := common.CleanupOldDiskCacheFiles(10 * time.Minute)
	if err != nil {
		return dto.FailMsg(err.Error())
	}

	return dto.Msg("不活跃的磁盘缓存已清理")
}

// ResetPerformanceStats 重置性能统计
func ResetPerformanceStats(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	common.ResetDiskCacheStats()

	return dto.Msg("统计信息已重置")
}

// ForceGC 强制执行 GC
func ForceGC(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	runtime.GC()

	return dto.Msg("GC 已执行")
}

// getDiskCacheInfo 获取磁盘缓存目录信息
func getDiskCacheInfo() dto.DiskCacheInfo {
	// 使用统一的缓存目录
	dir := common.GetDiskCacheDir()

	info := dto.DiskCacheInfo{
		Path:   dir,
		Exists: false,
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return info
	}

	info.Exists = true
	info.FileCount = 0
	info.TotalSize = 0

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info.FileCount++
		if fileInfo, err := entry.Info(); err == nil {
			info.TotalSize += fileInfo.Size()
		}
	}

	return info
}
