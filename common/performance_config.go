package common

import "sync/atomic"

// PerformanceMonitorConfig performance monitoring configuration
type PerformanceMonitorConfig struct {
	Enabled         bool
	CPUThreshold    int
	MemoryThreshold int
	DiskThreshold   int
}

var performanceMonitorConfig atomic.Value

func init() {
	// Initialize default configuration
	performanceMonitorConfig.Store(PerformanceMonitorConfig{
		Enabled:         true,
		CPUThreshold:    90,
		MemoryThreshold: 90,
		DiskThreshold:   90,
	})
}

// GetPerformanceMonitorConfig Gets performance monitoring configuration
func GetPerformanceMonitorConfig() PerformanceMonitorConfig {
	return performanceMonitorConfig.Load().(PerformanceMonitorConfig)
}

// SetPerformanceMonitorConfig sets performance monitoring configuration
func SetPerformanceMonitorConfig(config PerformanceMonitorConfig) {
	performanceMonitorConfig.Store(config)
}
