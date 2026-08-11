package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/savings_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	savingsLifetimeCompensationInterval   = time.Minute
	savingsLifetimeCompensationLookback   = 7 * 24 * time.Hour
	savingsLifetimeCompensationMaxBatches = 5
)

var (
	savingsLifetimeWorkerOnce         sync.Once
	savingsLifetimeWakeup             = make(chan struct{}, 1)
	savingsLifetimeAggregateMu        sync.Mutex
	savingsLifetimeCompensationCursor model.SavingsLifetimeLogCursor
)

func StartSavingsLifetimeAggregator() {
	savingsLifetimeWorkerOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ticker := time.NewTicker(15 * time.Second)
			defer ticker.Stop()
			compensationTicker := time.NewTicker(savingsLifetimeCompensationInterval)
			defer compensationTicker.Stop()
			for {
				runCompensation := false
				select {
				case <-ticker.C:
				case <-savingsLifetimeWakeup:
				case <-compensationTicker.C:
					runCompensation = true
				}
				if !savings_setting.LifetimeEnabled() {
					continue
				}
				if runCompensation {
					if err := compensateSavingsLifetimeEvents(); err != nil {
						logger.LogWarn(context.Background(), fmt.Sprintf("savings lifetime compensation failed: %v", err))
					}
				}
				for {
					processed, err := aggregateSavingsLifetimePending(savings_setting.LifetimeBackfillBatchSize())
					if err != nil {
						logger.LogWarn(context.Background(), fmt.Sprintf("savings lifetime aggregation failed: %v", err))
						break
					}
					if processed == 0 {
						break
					}
				}
			}
		})
	})
}

func compensateSavingsLifetimeEvents() error {
	target, _, err := model.GetSavingsLifetimeLogBoundary()
	if err != nil {
		return err
	}
	if target.ID == 0 && target.CreatedAt == 0 && target.RequestID == "" {
		return nil
	}
	batchSize := savings_setting.LifetimeBackfillBatchSize()
	startTimestamp := common.GetTimestamp() - int64(savingsLifetimeCompensationLookback.Seconds())
	for range savingsLifetimeCompensationMaxBatches {
		rows, err := model.GetRecentSavingsLifetimeLogBatch(
			startTimestamp,
			savingsLifetimeCompensationCursor,
			target,
			batchSize,
		)
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			break
		}
		ambiguousCount, err := model.CountSavingsLifetimeClickHouseCursorAmbiguity(rows)
		if err != nil {
			return err
		}
		if ambiguousCount > 0 {
			logger.LogWarn(context.Background(), fmt.Sprintf("savings lifetime compensation skipped %d ambiguous ClickHouse rows at cursor (%d, %q)", ambiguousCount, rows[len(rows)-1].CreatedAt, rows[len(rows)-1].RequestId))
		}
		events := make([]model.SavingsLifetimeEvent, 0, len(rows))
		for i := range rows {
			log := model.Log{
				Id:               rows[i].Id,
				RequestId:        rows[i].RequestId,
				UserId:           rows[i].UserId,
				CreatedAt:        rows[i].CreatedAt,
				ModelName:        rows[i].ModelName,
				PromptTokens:     rows[i].PromptTokens,
				CompletionTokens: rows[i].CompletionTokens,
				Quota:            rows[i].Quota,
				Other:            rows[i].Other,
			}
			if event, ok := buildSavingsLifetimeEvent(&log); ok {
				events = append(events, event)
			}
		}
		if err := model.CreateSavingsLifetimeEvents(events); err != nil {
			return err
		}
		last := rows[len(rows)-1]
		savingsLifetimeCompensationCursor = model.SavingsLifetimeLogCursor{
			ID:        last.Id,
			CreatedAt: last.CreatedAt,
			RequestID: last.RequestId,
		}
		if len(rows) < batchSize {
			break
		}
	}
	notifySavingsLifetimeAggregator()
	return nil
}

func aggregateSavingsLifetimePending(limit int) (int, error) {
	savingsLifetimeAggregateMu.Lock()
	defer savingsLifetimeAggregateMu.Unlock()
	return model.AggregatePendingSavingsLifetimeEvents(limit)
}

func notifySavingsLifetimeAggregator() {
	select {
	case savingsLifetimeWakeup <- struct{}{}:
	default:
	}
}
