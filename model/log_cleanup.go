package model

import (
	"context"

	"github.com/QuantumNous/new-api/common"
)

func init() {
	common.LogCleanupFn = cleanOldDbLogs
}

// cleanOldDbLogs is the registered implementation for common.LogCleanupFn.
// It batch-deletes log records older than the cutoff timestamp, reusing the
// existing cross-DB safe DeleteOldLogBatch.
func cleanOldDbLogs(cutoffUnix int64) (int64, error) {
	ctx := context.Background()

	total, err := CountOldLog(ctx, cutoffUnix)
	if err != nil || total == 0 {
		return 0, err
	}

	const batchLimit = 2000
	var deleted int64
	for deleted < total {
		rows, err := DeleteOldLogBatch(ctx, cutoffUnix, batchLimit)
		if err != nil {
			return deleted, err
		}
		deleted += rows
		if rows == 0 {
			break
		}
	}
	return deleted, nil
}
