package controller

import (
	"context"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// inviteRebateBackfillHandler periodically re-grants missing invite rebates for
// successful top-ups that have no invite_rebates ledger row (e.g. epay path
// where grant failed after user credit, or historical gaps after enabling the feature).
type inviteRebateBackfillHandler struct{}

func (inviteRebateBackfillHandler) Type() string {
	return model.SystemTaskTypeInviteRebateBackfill
}

func (inviteRebateBackfillHandler) Enabled() bool {
	return common.InviteTopupRebateEnabled
}

func (inviteRebateBackfillHandler) Interval() time.Duration {
	return 5 * time.Minute
}

func (inviteRebateBackfillHandler) NewPayload() any { return nil }

func (inviteRebateBackfillHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	scanned, granted, err := model.BackfillMissingInviteTopupRebates(100)
	summary := map[string]any{
		"scanned": scanned,
		"granted": granted,
	}
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, summary, err)
		return
	}
	if granted > 0 {
		common.SysLog(fmt.Sprintf("invite rebate backfill completed: scanned=%d granted=%d", scanned, granted))
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}
