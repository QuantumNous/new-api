package controller

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
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

// getLogFiles 读取日志目录中的日志文件列表
func getLogFiles() ([]dto.LogFileInfo, error) {
	if *common.LogDir == "" {
		return nil, nil
	}
	entries, err := os.ReadDir(*common.LogDir)
	if err != nil {
		return nil, err
	}
	var files []dto.LogFileInfo
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasPrefix(name, "oneapi-") || !strings.HasSuffix(name, ".log") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, dto.LogFileInfo{
			Name:    name,
			Size:    info.Size(),
			ModTime: info.ModTime(),
		})
	}
	// 按文件名降序排列（最新在前）
	sort.Slice(files, func(i, j int) bool {
		return files[i].Name > files[j].Name
	})
	return files, nil
}

// GetLogFiles 获取日志文件列表
func GetLogFiles(c fuego.ContextNoBody) (*dto.Response[dto.LogFilesResponse], error) {
	if *common.LogDir == "" {
		return dto.Ok(dto.LogFilesResponse{Enabled: false})
	}
	files, err := getLogFiles()
	if err != nil {
		return dto.Fail[dto.LogFilesResponse](err.Error())
	}
	var totalSize int64
	var oldest, newest time.Time
	for i, f := range files {
		totalSize += f.Size
		if i == 0 || f.ModTime.Before(oldest) {
			oldest = f.ModTime
		}
		if i == 0 || f.ModTime.After(newest) {
			newest = f.ModTime
		}
	}
	resp := dto.LogFilesResponse{
		LogDir:    *common.LogDir,
		Enabled:   true,
		FileCount: len(files),
		TotalSize: totalSize,
		Files:     files,
	}
	if len(files) > 0 {
		resp.OldestTime = &oldest
		resp.NewestTime = &newest
	}
	return dto.Ok(resp)
}

// CleanupLogFiles 清理过期日志文件
func CleanupLogFiles(c fuego.ContextNoBody) (*dto.Response[dto.LogCleanupResult], error) {
	mode := c.QueryParam("mode")
	valueStr := c.QueryParam("value")
	if mode != "by_count" && mode != "by_days" {
		return dto.Fail[dto.LogCleanupResult]("invalid mode, must be by_count or by_days")
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil || value < 1 {
		return dto.Fail[dto.LogCleanupResult]("invalid value, must be a positive integer")
	}
	if *common.LogDir == "" {
		return dto.Fail[dto.LogCleanupResult]("log directory not configured")
	}

	files, err := getLogFiles()
	if err != nil {
		return dto.Fail[dto.LogCleanupResult](err.Error())
	}

	activeLogPath := logger.GetCurrentLogPath()
	var toDelete []dto.LogFileInfo

	switch mode {
	case "by_count":
		// files 已按名称降序（最新在前），保留前 value 个
		for i, f := range files {
			if i < value {
				continue
			}
			fullPath := filepath.Join(*common.LogDir, f.Name)
			if fullPath == activeLogPath {
				continue
			}
			toDelete = append(toDelete, f)
		}
	case "by_days":
		cutoff := time.Now().AddDate(0, 0, -value)
		for _, f := range files {
			if f.ModTime.Before(cutoff) {
				fullPath := filepath.Join(*common.LogDir, f.Name)
				if fullPath == activeLogPath {
					continue
				}
				toDelete = append(toDelete, f)
			}
		}
	}

	var deletedCount int
	var freedBytes int64
	var failedFiles []string
	for _, f := range toDelete {
		fullPath := filepath.Join(*common.LogDir, f.Name)
		if err := os.Remove(fullPath); err != nil {
			failedFiles = append(failedFiles, f.Name)
			continue
		}
		deletedCount++
		freedBytes += f.Size
	}

	result := dto.LogCleanupResult{
		DeletedCount: deletedCount,
		FreedBytes:   freedBytes,
		FailedFiles:  failedFiles,
	}

	if len(failedFiles) > 0 {
		return &dto.Response[dto.LogCleanupResult]{
			Success: false,
			Message: fmt.Sprintf("部分文件删除失败（%d/%d）", len(failedFiles), len(toDelete)),
			Data:    result,
		}, nil
	}

	return dto.Ok(result)
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
