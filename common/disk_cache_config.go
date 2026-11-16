package common

import (
	"sync"
	"sync/atomic"
)

// DiskCacheConfig disk cache configuration (updated by performance_setting package)
type DiskCacheConfig struct {
	// Enabled Whether to enable disk cache
	Enabled bool
	// ThresholdMB The request body size threshold that triggers disk caching (MB)
	ThresholdMB int
	// MaxSizeMB Maximum total size of disk cache (MB)
	MaxSizeMB int
	// Path disk cache directory
	Path string
}

// Global disk cache configuration
var diskCacheConfig = DiskCacheConfig{
	Enabled:     false,
	ThresholdMB: 10,
	MaxSizeMB:   1024,
	Path:        "",
}
var diskCacheConfigMu sync.RWMutex

// GetDiskCacheConfig Gets the disk cache configuration
func GetDiskCacheConfig() DiskCacheConfig {
	diskCacheConfigMu.RLock()
	defer diskCacheConfigMu.RUnlock()
	return diskCacheConfig
}

// SetDiskCacheConfig sets the disk cache configuration
func SetDiskCacheConfig(config DiskCacheConfig) {
	diskCacheConfigMu.Lock()
	defer diskCacheConfigMu.Unlock()
	diskCacheConfig = config
}

// IsDiskCacheEnabled Whether to enable disk cache
func IsDiskCacheEnabled() bool {
	diskCacheConfigMu.RLock()
	defer diskCacheConfigMu.RUnlock()
	return diskCacheConfig.Enabled
}

// GetDiskCacheThresholdBytes Gets the disk cache threshold (bytes)
func GetDiskCacheThresholdBytes() int64 {
	diskCacheConfigMu.RLock()
	defer diskCacheConfigMu.RUnlock()
	return int64(diskCacheConfig.ThresholdMB) << 20
}

// GetDiskCacheMaxSizeBytes Gets the maximum disk cache size (bytes)
func GetDiskCacheMaxSizeBytes() int64 {
	diskCacheConfigMu.RLock()
	defer diskCacheConfigMu.RUnlock()
	return int64(diskCacheConfig.MaxSizeMB) << 20
}

// GetDiskCachePath Gets the disk cache directory
func GetDiskCachePath() string {
	diskCacheConfigMu.RLock()
	defer diskCacheConfigMu.RUnlock()
	return diskCacheConfig.Path
}

// DiskCacheStats disk cache statistics
type DiskCacheStats struct {
	// Number of currently active disk cache files
	ActiveDiskFiles int64 `json:"active_disk_files"`
	// Current total disk cache size (bytes)
	CurrentDiskUsageBytes int64 `json:"current_disk_usage_bytes"`
	// The current number of memory caches
	ActiveMemoryBuffers int64 `json:"active_memory_buffers"`
	// Total current memory cache size (bytes)
	CurrentMemoryUsageBytes int64 `json:"current_memory_usage_bytes"`
	// Disk cache hits
	DiskCacheHits int64 `json:"disk_cache_hits"`
	// Number of memory cache hits
	MemoryCacheHits int64 `json:"memory_cache_hits"`
	// Disk cache maximum limit (bytes)
	DiskCacheMaxBytes int64 `json:"disk_cache_max_bytes"`
	// Disk cache threshold (bytes)
	DiskCacheThresholdBytes int64 `json:"disk_cache_threshold_bytes"`
}

var diskCacheStats DiskCacheStats

// GetDiskCacheStats Get cache statistics
func GetDiskCacheStats() DiskCacheStats {
	stats := DiskCacheStats{
		ActiveDiskFiles:         atomic.LoadInt64(&diskCacheStats.ActiveDiskFiles),
		CurrentDiskUsageBytes:   atomic.LoadInt64(&diskCacheStats.CurrentDiskUsageBytes),
		ActiveMemoryBuffers:     atomic.LoadInt64(&diskCacheStats.ActiveMemoryBuffers),
		CurrentMemoryUsageBytes: atomic.LoadInt64(&diskCacheStats.CurrentMemoryUsageBytes),
		DiskCacheHits:           atomic.LoadInt64(&diskCacheStats.DiskCacheHits),
		MemoryCacheHits:         atomic.LoadInt64(&diskCacheStats.MemoryCacheHits),
		DiskCacheMaxBytes:       GetDiskCacheMaxSizeBytes(),
		DiskCacheThresholdBytes: GetDiskCacheThresholdBytes(),
	}
	return stats
}

// IncrementDiskFiles increases disk file count
func IncrementDiskFiles(size int64) {
	atomic.AddInt64(&diskCacheStats.ActiveDiskFiles, 1)
	atomic.AddInt64(&diskCacheStats.CurrentDiskUsageBytes, size)
}

// DecrementDiskFiles Decrement disk file count
func DecrementDiskFiles(size int64) {
	if atomic.AddInt64(&diskCacheStats.ActiveDiskFiles, -1) < 0 {
		atomic.StoreInt64(&diskCacheStats.ActiveDiskFiles, 0)
	}
	if atomic.AddInt64(&diskCacheStats.CurrentDiskUsageBytes, -size) < 0 {
		atomic.StoreInt64(&diskCacheStats.CurrentDiskUsageBytes, 0)
	}
}

// IncrementMemoryBuffers increases the memory buffer count
func IncrementMemoryBuffers(size int64) {
	atomic.AddInt64(&diskCacheStats.ActiveMemoryBuffers, 1)
	atomic.AddInt64(&diskCacheStats.CurrentMemoryUsageBytes, size)
}

// DecrementMemoryBuffers Decrement memory buffer count
func DecrementMemoryBuffers(size int64) {
	atomic.AddInt64(&diskCacheStats.ActiveMemoryBuffers, -1)
	atomic.AddInt64(&diskCacheStats.CurrentMemoryUsageBytes, -size)
}

// IncrementDiskCacheHits increases the number of disk cache hits
func IncrementDiskCacheHits() {
	atomic.AddInt64(&diskCacheStats.DiskCacheHits, 1)
}

// IncrementMemoryCacheHits increases the number of memory cache hits
func IncrementMemoryCacheHits() {
	atomic.AddInt64(&diskCacheStats.MemoryCacheHits, 1)
}

// ResetDiskCacheStats resets hit statistics (does not reset current usage)
func ResetDiskCacheStats() {
	atomic.StoreInt64(&diskCacheStats.DiskCacheHits, 0)
	atomic.StoreInt64(&diskCacheStats.MemoryCacheHits, 0)
}

// ResetDiskCacheUsage resets disk cache usage statistics (used after clearing the cache)
func ResetDiskCacheUsage() {
	atomic.StoreInt64(&diskCacheStats.ActiveDiskFiles, 0)
	atomic.StoreInt64(&diskCacheStats.CurrentDiskUsageBytes, 0)
}

// SyncDiskCacheStats synchronizes statistics from actual disk status
// Used to correct situations where statistics are inconsistent with reality
func SyncDiskCacheStats() {
	fileCount, totalSize, err := GetDiskCacheInfo()
	if err != nil {
		return
	}
	atomic.StoreInt64(&diskCacheStats.ActiveDiskFiles, int64(fileCount))
	atomic.StoreInt64(&diskCacheStats.CurrentDiskUsageBytes, totalSize)
}

// IsDiskCacheAvailable checks whether a new disk cache can be created
func IsDiskCacheAvailable(requestSize int64) bool {
	if !IsDiskCacheEnabled() {
		return false
	}
	maxBytes := GetDiskCacheMaxSizeBytes()
	currentUsage := atomic.LoadInt64(&diskCacheStats.CurrentDiskUsageBytes)
	return currentUsage+requestSize <= maxBytes
}
