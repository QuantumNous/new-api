package service

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/model"
)

const affiliateSettlementBatchSize = 500

type affiliateSettlementHandler struct{}

type affiliateSettlementResult struct {
	ReleasedRewards     int `json:"released_rewards"`
	ReleasedCashRewards int `json:"released_cash_rewards"`
}

func (affiliateSettlementHandler) Type() string {
	return model.SystemTaskTypeAffiliateSettle
}

func (affiliateSettlementHandler) Enabled() bool {
	return true
}

func (affiliateSettlementHandler) Interval() time.Duration {
	return time.Hour
}

func (affiliateSettlementHandler) NewPayload() any {
	return nil
}

func (affiliateSettlementHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	result := affiliateSettlementResult{}
	for {
		select {
		case <-ctx.Done():
			failSystemTask(task, runnerID, ctx.Err())
			return
		default:
		}
		released, err := model.ReleaseDueAffiliateRewards(time.Now().Unix(), affiliateSettlementBatchSize)
		if err != nil {
			failSystemTask(task, runnerID, err)
			return
		}
		result.ReleasedRewards += released
		if released < affiliateSettlementBatchSize {
			break
		}
	}
	for {
		select {
		case <-ctx.Done():
			failSystemTask(task, runnerID, ctx.Err())
			return
		default:
		}
		released, err := model.ReleaseDueAffiliateCashRewards(time.Now().Unix(), affiliateSettlementBatchSize)
		if err != nil {
			failSystemTask(task, runnerID, err)
			return
		}
		result.ReleasedCashRewards += released
		if released < affiliateSettlementBatchSize {
			break
		}
	}
	if err := model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, result, ""); err != nil {
		logSystemTaskLockError(ctx, task, err)
	}
}

func init() {
	RegisterSystemTaskHandler(affiliateSettlementHandler{})
}
