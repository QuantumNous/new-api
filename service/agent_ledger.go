package service

import (
	"errors"
	"math"

	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const agentReconciliationMaxAttempts = 3

var (
	ErrAgentLedgerMismatch         = errors.New("agent ledger does not match account balance")
	ErrAgentReconciliation         = errors.New("agent reconciliation arithmetic overflow")
	ErrAgentReconciliationUnstable = errors.New("agent account changed during reconciliation")
)

type AgentReconciliation struct {
	AgentUserID      int   `json:"agent_user_id"`
	Balance          int64 `json:"-"`
	LedgerSum        int64 `json:"-"`
	Difference       int64 `json:"-"`
	LedgerCount      int64 `json:"ledger_count"`
	LedgerContinuous bool  `json:"ledger_continuous"`
	Matches          bool  `json:"matches"`
}

type agentLedgerState struct {
	Sum        int64
	Count      int64
	Continuous bool
	Matches    bool
}

func guardAgentLedgerConsistencyTx(tx *gorm.DB, account *model.AgentAccount) error {
	if tx == nil || account == nil || account.Id <= 0 || account.UserId <= 0 {
		return ErrAgentLedgerMismatch
	}
	var latest model.AgentCreditLog
	result := tx.Select("delta", "balance_before", "balance_after").
		Where("agent_user_id = ?", account.UserId).
		Order("id DESC").Limit(1).Find(&latest)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		if account.Balance == 0 {
			return nil
		}
		return ErrAgentLedgerMismatch
	}
	calculatedAfter, err := checkedAgentLedgerAdd(latest.BalanceBefore, latest.Delta)
	if err != nil || latest.BalanceBefore < 0 || latest.BalanceAfter < 0 ||
		calculatedAfter != latest.BalanceAfter || latest.BalanceAfter != account.Balance {
		return ErrAgentLedgerMismatch
	}
	return nil
}

// ReconcileAgentAccount uses two account reads around the streamed ledger
// scan. If a financial transaction commits between those reads, the changed
// account version/balance causes a bounded retry rather than a false mismatch.
func ReconcileAgentAccount(agentUserID int) (*AgentReconciliation, error) {
	if agentUserID <= 0 {
		return nil, ErrAgentAccountNotFound
	}
	for attempt := 0; attempt < agentReconciliationMaxAttempts; attempt++ {
		before, err := readAgentReconciliationAccount(model.DB, agentUserID)
		if err != nil {
			return nil, err
		}
		state, err := scanAgentLedgerState(model.DB, agentUserID, before.Balance)
		if err != nil {
			return nil, err
		}
		after, err := readAgentReconciliationAccount(model.DB, agentUserID)
		if err != nil {
			return nil, err
		}
		if before.Id != after.Id || before.Version != after.Version || before.Balance != after.Balance {
			continue
		}
		if state.Sum == math.MinInt64 {
			return nil, ErrAgentReconciliation
		}
		difference, err := checkedAgentLedgerAdd(after.Balance, -state.Sum)
		if err != nil {
			return nil, ErrAgentReconciliation
		}
		return &AgentReconciliation{
			AgentUserID: agentUserID, Balance: after.Balance, LedgerSum: state.Sum,
			Difference: difference, LedgerCount: state.Count,
			LedgerContinuous: state.Continuous, Matches: state.Matches,
		}, nil
	}
	return nil, ErrAgentReconciliationUnstable
}

func readAgentReconciliationAccount(db *gorm.DB, agentUserID int) (model.AgentAccount, error) {
	var account model.AgentAccount
	err := db.Select("id", "user_id", "balance", "version").Where("user_id = ?", agentUserID).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AgentAccount{}, ErrAgentAccountNotFound
	}
	return account, err
}

func scanAgentLedgerState(db *gorm.DB, agentUserID int, accountBalance int64) (agentLedgerState, error) {
	rows, err := db.Model(&model.AgentCreditLog{}).
		Select("delta", "balance_before", "balance_after").
		Where("agent_user_id = ?", agentUserID).Order("id ASC").Rows()
	if err != nil {
		return agentLedgerState{}, err
	}
	defer rows.Close()

	state := agentLedgerState{Continuous: true}
	expectedBefore := int64(0)
	for rows.Next() {
		var delta, balanceBefore, balanceAfter int64
		if err := rows.Scan(&delta, &balanceBefore, &balanceAfter); err != nil {
			return agentLedgerState{}, err
		}
		state.Count++
		state.Sum, err = checkedAgentLedgerAdd(state.Sum, delta)
		if err != nil {
			return agentLedgerState{}, ErrAgentReconciliation
		}
		calculatedAfter, addErr := checkedAgentLedgerAdd(balanceBefore, delta)
		if addErr != nil {
			return agentLedgerState{}, ErrAgentReconciliation
		}
		if balanceBefore != expectedBefore || calculatedAfter != balanceAfter || balanceAfter < 0 {
			state.Continuous = false
		}
		expectedBefore = balanceAfter
	}
	if err := rows.Err(); err != nil {
		return agentLedgerState{}, err
	}
	state.Matches = state.Continuous && state.Sum == accountBalance && expectedBefore == accountBalance
	return state, nil
}

func checkedAgentLedgerAdd(left int64, right int64) (int64, error) {
	if right > 0 && left > math.MaxInt64-right {
		return 0, ErrAgentReconciliation
	}
	if right < 0 && left < math.MinInt64-right {
		return 0, ErrAgentReconciliation
	}
	return left + right, nil
}
