package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	inviteSubscriptionRewardReconciliationTickInterval = 15 * time.Minute
	inviteSubscriptionRewardReconciliationBatchSize    = 100
	inviteSubscriptionRewardReconciliationMaxRounds    = 10
	inviteSubscriptionRewardReconciliationRetryBatch   = 25
	inviteSubscriptionRewardReconciliationCursorKey    = "invite_subscription_reward_reconciliation_cursor"
	inviteSubscriptionRewardReconciliationRetryKey     = "invite_subscription_reward_reconciliation_retry_cursor"
)

var errInviteSubscriptionRewardReconciliationCursorAdvanced = errors.New("invite subscription reward reconciliation cursor advanced")

type inviteSubscriptionRewardReconciliationCursor struct {
	CompleteTime int64  `json:"complete_time"`
	ID           int    `json:"id"`
	Revision     int64  `json:"revision"`
	raw          string `json:"-"`
}

var (
	inviteSubscriptionRewardReconciliationOnce    sync.Once
	inviteSubscriptionRewardReconciliationRunning atomic.Bool
	inviteSubscriptionRewardReconciler            = model.ReconcileMissedInviteSubscriptionRewardsWithCursor
)

func StartInviteSubscriptionRewardReconciliationTask() {
	inviteSubscriptionRewardReconciliationOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("invite subscription reward reconciliation task started: tick=%s", inviteSubscriptionRewardReconciliationTickInterval))
			ticker := time.NewTicker(inviteSubscriptionRewardReconciliationTickInterval)
			defer ticker.Stop()

			runInviteSubscriptionRewardReconciliationOnceLogged()
			for range ticker.C {
				runInviteSubscriptionRewardReconciliationOnceLogged()
			}
		})
	})
}

func runInviteSubscriptionRewardReconciliationOnceLogged() {
	count, err := RunInviteSubscriptionRewardReconciliationOnce()
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("invite subscription reward reconciliation failed after %d order(s): %v", count, err))
		return
	}
	if common.DebugEnabled && count > 0 {
		logger.LogDebug(context.Background(), "invite subscription reward reconciliation processed_count=%d", count)
	}
}

func RunInviteSubscriptionRewardReconciliationOnce() (int, error) {
	if !common.IsMasterNode {
		return 0, nil
	}
	if !inviteSubscriptionRewardReconciliationRunning.CompareAndSwap(false, true) {
		return 0, nil
	}
	defer inviteSubscriptionRewardReconciliationRunning.Store(false)

	processed := 0
	cursor, err := loadInviteSubscriptionRewardReconciliationCursor()
	if err != nil {
		return processed, err
	}
	for round := 0; round < inviteSubscriptionRewardReconciliationMaxRounds; round++ {
		count, scanned, nextCursor, err := inviteSubscriptionRewardReconciler(0, inviteSubscriptionRewardReconciliationBatchSize, model.InviteSubscriptionRewardReconciliationCursor{
			CompleteTime: cursor.CompleteTime,
			ID:           cursor.ID,
		})
		processed += count
		if err != nil {
			return processed, err
		}
		if scanned > 0 {
			cursor, err = checkpointInviteSubscriptionRewardReconciliationCursor(cursor, nextCursor)
			if errors.Is(err, errInviteSubscriptionRewardReconciliationCursorAdvanced) {
				return processed, nil
			}
			if err != nil {
				return processed, err
			}
		}
		if scanned < inviteSubscriptionRewardReconciliationBatchSize {
			if cursor.CompleteTime > 0 || cursor.ID > 0 {
				cursor, err = checkpointInviteSubscriptionRewardReconciliationCursor(cursor, model.InviteSubscriptionRewardReconciliationCursor{})
				if errors.Is(err, errInviteSubscriptionRewardReconciliationCursorAdvanced) {
					return processed, nil
				}
				if err != nil {
					return processed, err
				}
			}
			break
		}
	}
	retried, err := runInviteSubscriptionRewardReconciliationRetryLane()
	return processed + retried, err
}

func loadInviteSubscriptionRewardReconciliationCursor() (inviteSubscriptionRewardReconciliationCursor, error) {
	return loadInviteSubscriptionRewardReconciliationCursorByKey(inviteSubscriptionRewardReconciliationCursorKey)
}

func loadInviteSubscriptionRewardReconciliationRetryCursor() (inviteSubscriptionRewardReconciliationCursor, error) {
	return loadInviteSubscriptionRewardReconciliationCursorByKey(inviteSubscriptionRewardReconciliationRetryKey)
}

func loadInviteSubscriptionRewardReconciliationCursorByKey(key string) (inviteSubscriptionRewardReconciliationCursor, error) {
	if !stripeReconciliationTableAvailable(&model.Option{}) {
		return inviteSubscriptionRewardReconciliationCursor{}, nil
	}
	initial, err := inviteSubscriptionRewardReconciliationCursorJSON(inviteSubscriptionRewardReconciliationCursor{})
	if err != nil {
		return inviteSubscriptionRewardReconciliationCursor{}, err
	}
	if err := model.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&model.Option{
		Key:   key,
		Value: initial,
	}).Error; err != nil {
		return inviteSubscriptionRewardReconciliationCursor{}, err
	}
	var option model.Option
	err = model.DB.Where("key = ?", key).First(&option).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return inviteSubscriptionRewardReconciliationCursor{}, nil
	}
	if err != nil {
		return inviteSubscriptionRewardReconciliationCursor{}, err
	}
	cursor, err := parseInviteSubscriptionRewardReconciliationCursor(option.Value)
	if err != nil {
		return inviteSubscriptionRewardReconciliationCursor{}, err
	}
	cursor.raw = option.Value
	return cursor, nil
}

func checkpointInviteSubscriptionRewardReconciliationCursor(cursor inviteSubscriptionRewardReconciliationCursor, next model.InviteSubscriptionRewardReconciliationCursor) (inviteSubscriptionRewardReconciliationCursor, error) {
	return checkpointInviteSubscriptionRewardReconciliationCursorByKey(inviteSubscriptionRewardReconciliationCursorKey, cursor, next)
}

func checkpointInviteSubscriptionRewardReconciliationRetryCursor(cursor inviteSubscriptionRewardReconciliationCursor, next model.InviteSubscriptionRewardReconciliationCursor) (inviteSubscriptionRewardReconciliationCursor, error) {
	return checkpointInviteSubscriptionRewardReconciliationCursorByKey(inviteSubscriptionRewardReconciliationRetryKey, cursor, next)
}

func checkpointInviteSubscriptionRewardReconciliationCursorByKey(key string, cursor inviteSubscriptionRewardReconciliationCursor, next model.InviteSubscriptionRewardReconciliationCursor) (inviteSubscriptionRewardReconciliationCursor, error) {
	if next.CompleteTime < 0 {
		next.CompleteTime = 0
	}
	if next.ID < 0 {
		next.ID = 0
	}
	if !stripeReconciliationTableAvailable(&model.Option{}) {
		cursor.CompleteTime = next.CompleteTime
		cursor.ID = next.ID
		return cursor, nil
	}
	updated := inviteSubscriptionRewardReconciliationCursor{
		CompleteTime: next.CompleteTime,
		ID:           next.ID,
		Revision:     cursor.Revision + 1,
	}
	value, err := inviteSubscriptionRewardReconciliationCursorJSON(updated)
	if err != nil {
		return cursor, err
	}
	result := model.DB.Model(&model.Option{}).
		Where("key = ? AND value = ?", key, cursor.raw).
		Update("value", value)
	if result.Error != nil {
		return cursor, result.Error
	}
	if result.RowsAffected == 0 {
		return cursor, errInviteSubscriptionRewardReconciliationCursorAdvanced
	}
	updated.raw = value
	return updated, nil
}

func runInviteSubscriptionRewardReconciliationRetryLane() (int, error) {
	if !stripeReconciliationTableAvailable(&model.Option{}) {
		return 0, nil
	}
	cursor, err := loadInviteSubscriptionRewardReconciliationRetryCursor()
	if err != nil {
		return 0, err
	}
	count, scanned, nextCursor, err := inviteSubscriptionRewardReconciler(0, inviteSubscriptionRewardReconciliationRetryBatch, model.InviteSubscriptionRewardReconciliationCursor{
		CompleteTime: cursor.CompleteTime,
		ID:           cursor.ID,
	})
	if err != nil {
		return count, err
	}
	if scanned > 0 {
		cursor, err = checkpointInviteSubscriptionRewardReconciliationRetryCursor(cursor, nextCursor)
		if errors.Is(err, errInviteSubscriptionRewardReconciliationCursorAdvanced) {
			return count, nil
		}
		if err != nil {
			return count, err
		}
	}
	if scanned < inviteSubscriptionRewardReconciliationRetryBatch && (cursor.CompleteTime > 0 || cursor.ID > 0) {
		_, err = checkpointInviteSubscriptionRewardReconciliationRetryCursor(cursor, model.InviteSubscriptionRewardReconciliationCursor{})
		if errors.Is(err, errInviteSubscriptionRewardReconciliationCursorAdvanced) {
			return count, nil
		}
		if err != nil {
			return count, err
		}
	}
	return count, nil
}

func parseInviteSubscriptionRewardReconciliationCursor(raw string) (inviteSubscriptionRewardReconciliationCursor, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return inviteSubscriptionRewardReconciliationCursor{}, nil
	}
	var cursor inviteSubscriptionRewardReconciliationCursor
	if err := common.Unmarshal([]byte(raw), &cursor); err == nil {
		if cursor.CompleteTime < 0 {
			cursor.CompleteTime = 0
		}
		if cursor.ID < 0 {
			cursor.ID = 0
		}
		if cursor.Revision < 0 {
			cursor.Revision = 0
		}
		return cursor, nil
	}
	id, err := strconv.Atoi(raw)
	if err != nil {
		return inviteSubscriptionRewardReconciliationCursor{}, nil
	}
	if id < 0 {
		id = 0
	}
	return inviteSubscriptionRewardReconciliationCursor{ID: id}, nil
}

func inviteSubscriptionRewardReconciliationCursorJSON(cursor inviteSubscriptionRewardReconciliationCursor) (string, error) {
	if cursor.CompleteTime < 0 {
		cursor.CompleteTime = 0
	}
	if cursor.ID < 0 {
		cursor.ID = 0
	}
	if cursor.Revision < 0 {
		cursor.Revision = 0
	}
	data, err := common.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
