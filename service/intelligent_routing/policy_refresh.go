package intelligent_routing

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/common"
)

func StartPolicyRefresh(ctx context.Context, control *PolicyControl, interval time.Duration) {
	if interval <= 0 {
		interval = time.Minute
	}
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		runPolicyRefresh(ctx, control, ticker.C)
	}()
}

func runPolicyRefresh(ctx context.Context, control *PolicyControl, triggers <-chan time.Time) {
	failed := false
	for {
		select {
		case <-ctx.Done():
			return
		case <-triggers:
			if err := control.RefreshSnapshot(ctx); err != nil {
				if !failed {
					common.SysError("failed to refresh intelligent routing policy snapshot: " + err.Error())
				}
				failed = true
				continue
			}
			failed = false
		}
	}
}
