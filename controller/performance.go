package controller

import (
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/gin-gonic/gin"
)

// PerformanceStats performance statistics
type PerformanceStats struct {
	// cache statistics
	CacheStats common.DiskCacheStats `json:"cache_stats"`
	// System memory statistics
	MemoryStats MemoryStats `json:"memory_stats"`
	// Disk cache directory information
	DiskCacheInfo DiskCacheInfo `json:"disk_cache_info"`
	// Disk space information
	DiskSpaceInfo common.DiskSpaceInfo `json:"disk_space_info"`
	// Configuration information
	Config PerformanceConfig `json:"config"`
}

// MemoryStats memory statistics
type MemoryStats struct {
	// Allocated memory (bytes)
	Alloc uint64 `json:"alloc"`
	// Total allocated memory (bytes)
	TotalAlloc uint64 `json:"total_alloc"`
	// System memory (bytes)
	Sys uint64 `json:"sys"`
	// GC times
	NumGC uint32 `json:"num_gc"`
	// Goroutine quantity
	NumGoroutine int `json:"num_goroutine"`
}

// DiskCacheInfo disk cache directory information
type DiskCacheInfo struct {
	// Cache directory path
	Path string `json:"path"`
	// Does the directory exist?
	Exists bool `json:"exists"`
	// Number of files
	FileCount int `json:"file_count"`
	// Total size (bytes)
	TotalSize int64 `json:"total_size"`
}

// PerformanceConfig performance configuration
type PerformanceConfig struct {
	// Whether to enable disk caching
	DiskCacheEnabled bool `json:"disk_cache_enabled"`
	// Disk cache threshold (MB)
	DiskCacheThresholdMB int `json:"disk_cache_threshold_mb"`
	// Maximum disk cache size (MB)
	DiskCacheMaxSizeMB int `json:"disk_cache_max_size_mb"`
	// Disk cache path
	DiskCachePath string `json:"disk_cache_path"`
	// Whether to run in a container
	IsRunningInContainer bool `json:"is_running_in_container"`

	// MonitorEnabled Whether to enable performance monitoring
	MonitorEnabled bool `json:"monitor_enabled"`
	// MonitorCPUThreshold CPU usage threshold (%)
	MonitorCPUThreshold int `json:"monitor_cpu_threshold"`
	// MonitorMemoryThreshold memory usage threshold (%)
	MonitorMemoryThreshold int `json:"monitor_memory_threshold"`
	// MonitorDiskThreshold disk usage threshold (%)
	MonitorDiskThreshold int `json:"monitor_disk_threshold"`
}

// GetPerformanceStats Get performance statistics
func GetPerformanceStats(c *gin.Context) {
	// No longer fully scan the disk every time to obtain statistics, relying on atomic counters to ensure performance
	// Only synchronize on system startup or explicit cleanup
	cacheStats := common.GetDiskCacheStats()

	// Get memory statistics
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// Get disk cache directory information
	diskCacheInfo := getDiskCacheInfo()

	// Get configuration information
	diskConfig := common.GetDiskCacheConfig()
	monitorConfig := common.GetPerformanceMonitorConfig()
	config := PerformanceConfig{
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

	// Get disk space information
	// Use cached system state to avoid frequent calls to system APIs
	systemStatus := common.GetSystemStatus()
	diskSpaceInfo := common.DiskSpaceInfo{
		UsedPercent: systemStatus.DiskUsage,
	}
	// If you need detailed information, you can get it on demand, or extend SystemStatus
	// In order to maintain interface compatibility here, we still call GetDiskSpaceInfo, but note that this may have performance overhead
	// Considering that GetPerformanceStats is a management interface with low frequency, direct calling is acceptable.
	// But for consistency, we can also consider getting some information from SystemStatus
	diskSpaceInfo = common.GetDiskSpaceInfo()

	stats := PerformanceStats{
		CacheStats: cacheStats,
		MemoryStats: MemoryStats{
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

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// ClearDiskCache clears inactive disk cache
func ClearDiskCache(c *gin.Context) {
	// Clean cache files that have not been used for more than 10 minutes
	// 10 minutes is a safe threshold to ensure that ongoing requests will not be accidentally deleted
	err := common.CleanupOldDiskCacheFiles(10 * time.Minute)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccessT(c, "Inactive disk cache cleared", nil)
}

// ResetPerformanceStats resets performance statistics
func ResetPerformanceStats(c *gin.Context) {
	common.ResetDiskCacheStats()

	common.ApiSuccessT(c, "Statistics reset", nil)
}

// ForceGC forces GC
func ForceGC(c *gin.Context) {
	runtime.GC()

	common.ApiSuccessT(c, "GC executed", nil)
}

// LogFileInfo log file information
type LogFileInfo struct {
	Name    string    `json:"name"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
}

// LogFilesResponse log file list response
type LogFilesResponse struct {
	LogDir     string        `json:"log_dir"`
	Enabled    bool          `json:"enabled"`
	FileCount  int           `json:"file_count"`
	TotalSize  int64         `json:"total_size"`
	OldestTime *time.Time    `json:"oldest_time,omitempty"`
	NewestTime *time.Time    `json:"newest_time,omitempty"`
	Files      []LogFileInfo `json:"files"`
}

// getLogFiles reads the list of log files in the log directory
func getLogFiles() ([]LogFileInfo, error) {
	if *common.LogDir == "" {
		return nil, nil
	}
	entries, err := os.ReadDir(*common.LogDir)
	if err != nil {
		return nil, err
	}
	var files []LogFileInfo
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
		files = append(files, LogFileInfo{
			Name:    name,
			Size:    info.Size(),
			ModTime: info.ModTime(),
		})
	}
	// Sort by file name in descending order (newest first)
	sort.Slice(files, func(i, j int) bool {
		return files[i].Name > files[j].Name
	})
	return files, nil
}

// GetLogFiles Gets the list of log files
func GetLogFiles(c *gin.Context) {
	if *common.LogDir == "" {
		common.ApiSuccess(c, LogFilesResponse{Enabled: false})
		return
	}
	files, err := getLogFiles()
	if err != nil {
		common.ApiError(c, err)
		return
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
	resp := LogFilesResponse{
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
	common.ApiSuccess(c, resp)
}

// CleanupLogFiles cleans up expired log files
func CleanupLogFiles(c *gin.Context) {
	mode := c.Query("mode")
	valueStr := c.Query("value")
	if mode != "by_count" && mode != "by_days" {
		common.ApiErrorMsg(c, "invalid mode, must be by_count or by_days")
		return
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil || value < 1 {
		common.ApiErrorMsg(c, "invalid value, must be a positive integer")
		return
	}
	if *common.LogDir == "" {
		common.ApiErrorMsg(c, "log directory not configured")
		return
	}

	files, err := getLogFiles()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	activeLogPath := logger.GetCurrentLogPath()
	var toDelete []LogFileInfo

	switch mode {
	case "by_count":
		// files have been sorted descending by name (newest first), keeping the first value
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

	result := gin.H{
		"deleted_count": deletedCount,
		"freed_bytes":   freedBytes,
		"failed_files":  failedFiles,
	}

	if len(failedFiles) > 0 {
		msg := common.NewMessage("Some files could not be deleted ({{failed}}/{{total}})", map[string]any{
			"failed": len(failedFiles),
			"total":  len(toDelete),
		})
		common.ApiErrorStatus(c, http.StatusOK, msg, gin.H{"data": result})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}

// getDiskCacheInfo Gets disk cache directory information
func getDiskCacheInfo() DiskCacheInfo {
	// Use a unified cache directory
	dir := common.GetDiskCacheDir()

	info := DiskCacheInfo{
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
