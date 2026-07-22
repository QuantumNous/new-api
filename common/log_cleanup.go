package common

import (
	"fmt"
	"time"
)

// LogCleanupFn is called periodically by the background cleanup goroutine
// when LogRetentionDays > 0. The model package registers the actual
// implementation that has access to LOG_DB and cross-DB delete logic.
// Returns the number of deleted rows, or an error.
var LogCleanupFn func(cutoffUnix int64) (deleted int64, err error)

// CleanupOldDbLogs invokes the registered LogCleanupFn with the current
// cutoff timestamp based on LogRetentionDays.
func CleanupOldDbLogs() {
	if LogRetentionDays <= 0 {
		return
	}
	if LogCleanupFn == nil {
		return
	}

	cutoff := time.Now().AddDate(0, 0, -LogRetentionDays).Unix()

	deleted, err := LogCleanupFn(cutoff)
	if err != nil {
		SysError(fmt.Sprintf("db log cleanup error: %v", err))
		return
	}
	if deleted > 0 {
		SysLog(fmt.Sprintf("db log cleanup: removed %d log records older than %s",
			deleted,
			time.Unix(cutoff, 0).Format(time.RFC3339)))
	}
}

// StartDbLogCleanup launches a background goroutine that periodically
// cleans up old database log records. The interval is 1 hour.
// Call once on startup after model.InitLogDB().
func StartDbLogCleanup() {
	go func() {
		// Wait a few minutes on first startup to let everything initialize.
		time.Sleep(5 * time.Minute)
		for {
			CleanupOldDbLogs()
			time.Sleep(1 * time.Hour)
		}
	}()
}
