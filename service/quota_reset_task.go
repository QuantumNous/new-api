package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

const quotaResetTickInterval = 1 * time.Minute

var (
	quotaResetTaskOnce    sync.Once
	quotaResetTaskRunning atomic.Bool
	lastTick              time.Time
)

func StartQuotaResetTask() {
	quotaResetTaskOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		lastTick = time.Now()
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("quota reset task started: tick=%s", quotaResetTickInterval))
			ticker := time.NewTicker(quotaResetTickInterval)
			defer ticker.Stop()
			for range ticker.C {
				quotaResetTick()
			}
		})
	})
}

func quotaResetTick() {
	if !quotaResetTaskRunning.CompareAndSwap(false, true) {
		return
	}
	defer quotaResetTaskRunning.Store(false)

	now := time.Now()
	periods := crossedQuotaResetPeriods(lastTick, now)
	if len(periods) > 0 {
		if _, err := RunQuotaResetPass(periods, QuotaResetTriggerScheduled); err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("quota reset task failed: %v", err))
		}
	}
	lastTick = now
}

func crossedQuotaResetPeriods(from, to time.Time) []string {
	result := []string{}
	if !to.After(from) {
		return result
	}

	loc := from.Location()
	midnight := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, loc)
	if !midnight.After(from) {
		midnight = midnight.AddDate(0, 0, 1)
	}

	seen := make(map[string]bool, 3)
	add := func(period string) {
		if !seen[period] {
			seen[period] = true
			result = append(result, period)
		}
	}

	for !midnight.After(to) {
		add(operation_setting.QuotaResetPeriodDaily)
		if midnight.Weekday() == time.Monday {
			add(operation_setting.QuotaResetPeriodWeekly)
		}
		if midnight.Day() == 1 {
			add(operation_setting.QuotaResetPeriodMonthly)
		}
		midnight = midnight.AddDate(0, 0, 1)
	}
	return result
}
