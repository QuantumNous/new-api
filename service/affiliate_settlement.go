package service

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/model"
)

const affiliateSettlementBatchSize = 500

type affiliateSettlementHandler struct{}

type affiliateSettlementResult struct {
	ReleasedCommissions int `json:"released_commissions"`
	GeneratedStatements int `json:"generated_statements"`
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
		released, err := model.ReleaseDueAffiliateCommissions(time.Now().Unix(), affiliateSettlementBatchSize)
		if err != nil {
			failSystemTask(task, runnerID, err)
			return
		}
		result.ReleasedCommissions += released
		if released < affiliateSettlementBatchSize {
			break
		}
	}
	generated, err := model.GeneratePreviousMonthAffiliateStatements(time.Now())
	if err != nil {
		failSystemTask(task, runnerID, err)
		return
	}
	result.GeneratedStatements = generated
	if err := model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, result, ""); err != nil {
		logSystemTaskLockError(ctx, task, err)
	}
}

func init() {
	RegisterSystemTaskHandler(affiliateSettlementHandler{})
}
