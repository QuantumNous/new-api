package controller

import (
	"context"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// inviteRebateBackfillPayload controls one invite_rebate_backfill run.
// Scheduled runs leave Limit empty (defaults to 100). Manual triggers may set Limit.
type inviteRebateBackfillPayload struct {
	Limit int `json:"limit,omitempty"`
}

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
	minutes := common.InviteTopupRebateBackfillMinutes
	if minutes < 1 {
		minutes = 5
	}
	if minutes > 1440 {
		minutes = 1440
	}
	return time.Duration(minutes) * time.Minute
}

func (inviteRebateBackfillHandler) NewPayload() any {
	return inviteRebateBackfillPayload{Limit: 100}
}

func (inviteRebateBackfillHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	payload := inviteRebateBackfillPayload{}
	if err := task.DecodePayload(&payload); err != nil {
		// tolerate empty/legacy payload
		payload.Limit = 100
	}
	limit := payload.Limit
	if limit <= 0 {
		limit = 100
	}
	scanned, granted, err := model.BackfillMissingInviteTopupRebates(limit)
	summary := map[string]any{
		"scanned": scanned,
		"granted": granted,
		"limit":   limit,
	}
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, summary, err)
		return
	}
	if granted > 0 {
		common.SysLog(fmt.Sprintf("invite rebate backfill completed: scanned=%d granted=%d limit=%d", scanned, granted, limit))
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}
