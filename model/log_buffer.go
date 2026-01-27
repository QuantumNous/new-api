package model

import (
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	// Default flush interval in seconds
	DefaultLogFlushInterval = 1
	// Initial buffer capacity (grows as needed)
	DefaultLogBufferCapacity = 10000
)

var (
	// Unbounded buffer for async log writes
	logBuffer     []*Log
	logBufferLock sync.Mutex

	// Shutdown signal
	logBufferShutdown chan struct{}
	logBufferOnce     sync.Once

	// Configuration
	logFlushInterval int
	asyncLogEnabled  bool
)

// InitLogBuffer initializes the async log buffer system
// Should be called from main.go after DB is initialized
func InitLogBuffer() {
	logBufferOnce.Do(func() {
		logFlushInterval = common.GetEnvOrDefault("LOG_FLUSH_INTERVAL", DefaultLogFlushInterval)

		logBuffer = make([]*Log, 0, DefaultLogBufferCapacity)
		logBufferShutdown = make(chan struct{})
		asyncLogEnabled = true

		common.SysLog("async log buffer enabled: flush interval " +
			strconv.Itoa(logFlushInterval) + "s")

		// Start the background flush worker
		gopool.Go(func() {
			logFlushWorker()
		})
	})
}

// IsAsyncLogEnabled returns whether async logging is enabled
func IsAsyncLogEnabled() bool {
	return asyncLogEnabled
}

// AddLogAsync adds a log entry to the buffer for async processing
// Always succeeds - buffer is unbounded
func AddLogAsync(log *Log) bool {
	if !IsAsyncLogEnabled() {
		return false
	}

	logBufferLock.Lock()
	logBuffer = append(logBuffer, log)
	logBufferLock.Unlock()

	return true
}

// logFlushWorker is the background worker that flushes logs to DB
func logFlushWorker() {
	ticker := time.NewTicker(time.Duration(logFlushInterval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-logBufferShutdown:
			// Graceful shutdown - flush remaining logs
			flushAllLogs("shutdown")
			return

		case <-ticker.C:
			flushAllLogs("")
		}
	}
}

// flushAllLogs drains the buffer and writes all logs to DB
func flushAllLogs(reason string) {
	// Swap buffer atomically
	logBufferLock.Lock()
	if len(logBuffer) == 0 {
		logBufferLock.Unlock()
		return
	}
	toFlush := logBuffer
	logBuffer = make([]*Log, 0, cap(toFlush))
	logBufferLock.Unlock()

	count := len(toFlush)
	if reason != "" {
		common.SysLog("log buffer " + reason + ", flushing " + strconv.Itoa(count) + " logs...")
	}

	flushLogBatch(toFlush)

	if common.DebugEnabled {
		common.SysLog("flushed " + strconv.Itoa(count) + " logs to database")
	}
}

// flushLogBatch writes a batch of logs to the database
func flushLogBatch(batch []*Log) {
	if len(batch) == 0 {
		return
	}

	err := LOG_DB.CreateInBatches(batch, len(batch)).Error
	if err != nil {
		common.SysError("failed to flush log batch: " + err.Error())
		// On error, try one by one
		for _, log := range batch {
			if insertErr := LOG_DB.Create(log).Error; insertErr != nil {
				common.SysError("failed to insert log: " + insertErr.Error())
			}
		}
	}
}

// ShutdownLogBuffer gracefully shuts down the log buffer
func ShutdownLogBuffer() {
	if !IsAsyncLogEnabled() {
		return
	}
	close(logBufferShutdown)
	// Give worker time to flush
	time.Sleep(2 * time.Second)
}

// GetLogBufferStats returns current buffer statistics
func GetLogBufferStats() map[string]interface{} {
	if !IsAsyncLogEnabled() {
		return map[string]interface{}{
			"enabled": false,
		}
	}

	logBufferLock.Lock()
	buffered := len(logBuffer)
	logBufferLock.Unlock()

	return map[string]interface{}{
		"enabled":        true,
		"buffered":       buffered,
		"flush_interval": logFlushInterval,
	}
}
