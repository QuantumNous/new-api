package performance_setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// PerformanceSetting performance setting configuration
type PerformanceSetting struct {
	// DiskCacheEnabled Whether to enable disk cache (disk for memory)
	DiskCacheEnabled bool `json:"disk_cache_enabled"`
	// DiskCacheThresholdMB The request body size threshold that triggers disk caching (MB)
	DiskCacheThresholdMB int `json:"disk_cache_threshold_mb"`
	// DiskCacheMaxSizeMB Maximum total size of disk cache (MB)
	DiskCacheMaxSizeMB int `json:"disk_cache_max_size_mb"`
	// DiskCachePath disk cache directory
	DiskCachePath string `json:"disk_cache_path"`

	// MonitorEnabled Whether to enable performance monitoring
	MonitorEnabled bool `json:"monitor_enabled"`
	// MonitorCPUThreshold CPU usage threshold (%)
	MonitorCPUThreshold int `json:"monitor_cpu_threshold"`
	// MonitorMemoryThreshold memory usage threshold (%)
	MonitorMemoryThreshold int `json:"monitor_memory_threshold"`
	// MonitorDiskThreshold disk usage threshold (%)
	MonitorDiskThreshold int `json:"monitor_disk_threshold"`
}

// Default configuration
var performanceSetting = PerformanceSetting{
	DiskCacheEnabled:     false,
	DiskCacheThresholdMB: 10,   // More than 10MB uses disk cache
	DiskCacheMaxSizeMB:   1024, // Maximum 1GB disk cache
	DiskCachePath:        "",   // Empty means using the system temporary directory

	MonitorEnabled:         true,
	MonitorCPUThreshold:    90,
	MonitorMemoryThreshold: 90,
	MonitorDiskThreshold:   95,
}

func init() {
	// Register to the global configuration manager
	config.GlobalConfig.Register("performance_setting", &performanceSetting)
	// Synchronize initial configuration to common package
	syncToCommon()
}

// syncToCommon synchronizes configuration to common package
func syncToCommon() {
	common.SetDiskCacheConfig(common.DiskCacheConfig{
		Enabled:     performanceSetting.DiskCacheEnabled,
		ThresholdMB: performanceSetting.DiskCacheThresholdMB,
		MaxSizeMB:   performanceSetting.DiskCacheMaxSizeMB,
		Path:        performanceSetting.DiskCachePath,
	})

	common.SetPerformanceMonitorConfig(common.PerformanceMonitorConfig{
		Enabled:         performanceSetting.MonitorEnabled,
		CPUThreshold:    performanceSetting.MonitorCPUThreshold,
		MemoryThreshold: performanceSetting.MonitorMemoryThreshold,
		DiskThreshold:   performanceSetting.MonitorDiskThreshold,
	})
}

// GetPerformanceSetting Gets performance settings
func GetPerformanceSetting() *PerformanceSetting {
	return &performanceSetting
}

// UpdateAndSync updates the configuration and synchronizes it to the common package
// After the configuration is loaded from the database, this function needs to be called to synchronize
func UpdateAndSync() {
	syncToCommon()
}

// GetCacheStats Get cache statistics (proxy to common package)
func GetCacheStats() common.DiskCacheStats {
	return common.GetDiskCacheStats()
}

// ResetStats reset statistics
func ResetStats() {
	common.ResetDiskCacheStats()
}
