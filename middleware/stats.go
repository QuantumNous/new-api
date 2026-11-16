package middleware

import (
	"sync/atomic"

	"github.com/gin-gonic/gin"
)

// HTTPStats stores HTTP statistics
type HTTPStats struct {
	activeConnections int64
}

var globalStats = &HTTPStats{}

// StatsMiddleware statistics middleware
func StatsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Increase the number of active connections
		atomic.AddInt64(&globalStats.activeConnections, 1)

		// Make sure to reduce the number of connections at the end of the request
		defer func() {
			atomic.AddInt64(&globalStats.activeConnections, -1)
		}()

		c.Next()
	}
}

// StatsInfo statistical information structure
type StatsInfo struct {
	ActiveConnections int64 `json:"active_connections"`
}

// GetStats Get statistics
func GetStats() StatsInfo {
	return StatsInfo{
		ActiveConnections: atomic.LoadInt64(&globalStats.activeConnections),
	}
}
