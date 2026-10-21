package commission

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

// settleBatchLimit caps a single batch so a busy platform cannot have this
// task hold one huge transaction open for many seconds.
const settleBatchLimit = 500

// SettlePending settles every pending commission record whose freeze window
// has elapsed. Returns the total number settled. Safe to call from the
// scheduled system_task runner OR the admin "Settle now" button.
func SettlePending() (int, error) {
	total := 0
	for {
		batch, err := model.FetchPendingDueCommissionRecords(settleBatchLimit)
		if err != nil {
			return total, err
		}
		if len(batch) == 0 {
			return total, nil
		}
		for i := range batch {
			if err := settleOne(&batch[i]); err != nil {
				common.SysError(fmt.Sprintf("commission settle record failed: id=%d err=%v", batch[i].Id, err))
				continue
			}
			total++
		}
		if len(batch) < settleBatchLimit {
			return total, nil
		}
	}
}

// settleOne moves one record from pending to settled inside a transaction.
// The WHERE clause on the record UPDATE guarantees we don't double-settle
// something that another actor (e.g., admin void) already claimed.
func settleOne(rec *model.CommissionRecord) error {
	now := time.Now().Unix()
	return model.DB.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&model.CommissionRecord{}).
			Where("id = ? AND status = ?", rec.Id, model.CommissionStatusPending).
			Updates(map[string]any{
				"status":     model.CommissionStatusSettled,
				"settled_at": now,
				"updated_at": now,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil // someone else already handled it (admin void, retry, etc.)
		}
		if err := model.PendingToBalance(tx, rec.BeneficiaryId, rec.CommissionAmountCents); err != nil {
			return err
		}
		model.RecordLog(rec.BeneficiaryId, model.LogTypeSystem,
			common.NewMessage("Referral commission {{commission}} settled from user #{{source_user}} first top-up", map[string]any{
				"commission":  fmt.Sprintf("¥%.2f", float64(rec.CommissionAmountCents)/100.0),
				"source_user": rec.SourceUserId,
			}))
		return nil
	})
}

// SettleHandler adapts SettlePending to the system_tasks scheduler contract
// so the runner can create/claim a task row and hand it back to us. Exported
// so the service/system_task_bootstrap layer can register it without creating
// an import cycle from service/system_task.go directly to service/commission.
type SettleHandler struct{}

// NewSettleHandler returns a fresh handler value; useful for the bootstrap
// package to keep the registration site tiny.
func NewSettleHandler() SettleHandler { return SettleHandler{} }

// Type is the handler's routing key. Must match model.SystemTaskTypeCommissionSettle.
func (SettleHandler) Type() string { return model.SystemTaskTypeCommissionSettle }

// Enabled always returns true — the operator's kill-switch is at the rule
// level (commission_rules.enabled), not the scheduler.
func (SettleHandler) Enabled() bool { return true }

// Interval is the minimum time between scheduler-triggered runs.
func (SettleHandler) Interval() time.Duration { return 10 * time.Minute }

// NewPayload is required by the scheduler interface but this task carries no
// per-run payload; an empty map is fine.
func (SettleHandler) NewPayload() any { return map[string]any{} }

// Run is invoked once the task row has been claimed. It reports the number of
// records settled on success or the error message on failure.
func (SettleHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	settled, err := SettlePending()
	if err != nil {
		logger.LogError(ctx, "commission_settle task failed: "+err.Error())
		_ = model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusFailed,
			map[string]any{"error": err.Error()}, err.Error())
		return
	}
	_ = model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded,
		map[string]any{"settled": settled}, "")
}
