package common

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

var (
	// 流量监控相关变量
	trafficMonitorEnabled = false
	lastRequestTime       = time.Now()
	activeRequestCount    int64 // 活跃请求数
	trafficMutex          sync.RWMutex

	// 优雅退出相关变量
	shutdownChan = make(chan os.Signal, 1)
	server       *http.Server
	serverMutex  sync.Mutex
)

// TrafficMonitorConfig 流量监控配置
type TrafficMonitorConfig struct {
	Enabled         bool          // 是否启用流量监控
	GracefulTimeout time.Duration // 优雅关闭超时时间
}

// 默认配置
var defaultConfig = TrafficMonitorConfig{
	Enabled:         false,
	GracefulTimeout: 30 * time.Second, // 30秒优雅关闭超时
}

// InitTrafficMonitor 初始化流量监控
func InitTrafficMonitor(config TrafficMonitorConfig) {
	if !config.Enabled {
		SysLog("Traffic monitor disabled")
		return
	}

	trafficMonitorEnabled = true

	// 设置默认值
	if config.GracefulTimeout == 0 {
		config.GracefulTimeout = defaultConfig.GracefulTimeout
	}

	SysLog("Traffic monitor enabled")

	// 设置信号处理
	setupSignalHandler(config.GracefulTimeout)
}

// RecordRequest 记录请求开始
func RecordRequest() {
	if !trafficMonitorEnabled {
		return
	}

	trafficMutex.Lock()
	defer trafficMutex.Unlock()

	lastRequestTime = time.Now()
	atomic.AddInt64(&activeRequestCount, 1)
}

// RecordRequestEnd 记录请求结束
func RecordRequestEnd() {
	if !trafficMonitorEnabled {
		return
	}

	atomic.AddInt64(&activeRequestCount, -1)
}

// GetTrafficStats 获取流量统计
func GetTrafficStats() map[string]interface{} {
	trafficMutex.RLock()
	defer trafficMutex.RUnlock()

	return map[string]interface{}{
		"enabled":              trafficMonitorEnabled,
		"active_request_count": atomic.LoadInt64(&activeRequestCount),
		"last_request_time":    lastRequestTime,
		"idle_time":            time.Since(lastRequestTime),
	}
}

// setupSignalHandler 设置信号处理器
func setupSignalHandler(gracefulTimeout time.Duration) {
	SysLog("Setting up signal handler for SIGINT and SIGTERM")
	signal.Notify(shutdownChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		SysLog("Signal handler goroutine started, waiting for signals...")
		sig := <-shutdownChan
		SysLog(fmt.Sprintf("Received signal %v, checking traffic before shutdown", sig))

		// 检查是否有流量
		if hasRecentTraffic() {
			SysLog("Recent traffic detected, waiting for all requests to complete...")
			waitForNoTraffic(gracefulTimeout)
		} else {
			SysLog("No recent traffic detected, exiting immediately")
		}

		triggerGracefulShutdown(gracefulTimeout)
	}()
}

// hasRecentTraffic 检查是否有最近的流量
func hasRecentTraffic() bool {
	trafficMutex.RLock()
	defer trafficMutex.RUnlock()

	// 如果有活跃请求，认为有流量
	return atomic.LoadInt64(&activeRequestCount) > 0
}

// waitForNoTraffic 等待所有活跃请求完成
func waitForNoTraffic(timeout time.Duration) {
	SysLog(fmt.Sprintf("Waiting for all requests to complete (timeout: %v)...", timeout))

	startTime := time.Now()
	ticker := time.NewTicker(100 * time.Millisecond) // 每100ms检查一次
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if !hasRecentTraffic() {
				SysLog(fmt.Sprintf("All requests completed in %v", time.Since(startTime)))
				return
			}
		case <-time.After(timeout):
			SysLog(fmt.Sprintf("Timeout reached (%v), proceeding with shutdown", timeout))
			return
		}
	}
}

// triggerGracefulShutdown 触发优雅关闭
func triggerGracefulShutdown(timeout time.Duration) {
	serverMutex.Lock()
	defer serverMutex.Unlock()

	if server == nil {
		SysLog("HTTP server not set, exiting directly")
		os.Exit(0)
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	SysLog(fmt.Sprintf("Shutting down HTTP server with %v timeout", timeout))

	if err := server.Shutdown(ctx); err != nil {
		SysError(fmt.Sprintf("HTTP server shutdown error: %v", err))
	} else {
		SysLog("HTTP server shutdown completed successfully")
	}

	// 关闭 Redis 连接
	if RDB != nil {
		SysLog("Closing Redis connection")
		if err := RDB.Close(); err != nil {
			SysError(fmt.Sprintf("Redis close error: %v", err))
		} else {
			SysLog("Redis connection closed successfully")
		}
	} else {
		SysLog("No Redis connection to close")
	}

	SysLog("All cleanup completed, program will exit naturally")
}

// SetHTTPServer 设置HTTP服务器实例（用于优雅关闭）
func SetHTTPServer(srv *http.Server) {
	serverMutex.Lock()
	defer serverMutex.Unlock()
	server = srv
}

// IsTrafficMonitorEnabled 检查流量监控是否启用
func IsTrafficMonitorEnabled() bool {
	return trafficMonitorEnabled
}
