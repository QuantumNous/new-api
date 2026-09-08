package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAgentAccountTest(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.AgentAccount{}, &model.AgentCreditLog{}))
	require.NoError(t, model.DB.Exec("DELETE FROM agent_credit_logs").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM agent_accounts").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM users").Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Exec("DELETE FROM agent_credit_logs").Error)
		require.NoError(t, model.DB.Exec("DELETE FROM agent_accounts").Error)
		require.NoError(t, model.DB.Exec("DELETE FROM users").Error)
	})
}

func createAgentTestUser(t *testing.T, id int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:       id,
		Username: fmt.Sprintf("agent-user-%d", id),
		AffCode:  fmt.Sprintf("aff-%d", id),
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
	}).Error)
}

func TestEnableAgentIsIdempotentAndUsesDefaultLimit(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 10)

	account, err := EnableAgent(10)
	require.NoError(t, err)
	assert.Equal(t, model.AgentAccountStatusActive, account.Status)
	assert.Equal(t, model.DefaultAgentDailyCodeLimit, account.DailyCodeLimit)
	assert.Zero(t, account.Balance)

	again, err := EnableAgent(10)
	require.NoError(t, err)
	assert.Equal(t, account.Id, again.Id)
	assert.Equal(t, account.Version, again.Version)

	var count int64
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", 10).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestDisableAgentPreservesBalanceAndCanBeRepeated(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 11)
	account, err := EnableAgent(11)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("id = ?", account.Id).Update("balance", 12345).Error)

	disabled, err := DisableAgent(11)
	require.NoError(t, err)
	assert.Equal(t, model.AgentAccountStatusDisabled, disabled.Status)
	assert.Equal(t, int64(12345), disabled.Balance)

	again, err := DisableAgent(11)
	require.NoError(t, err)
	assert.Equal(t, disabled.Version, again.Version)
	assert.Equal(t, int64(12345), again.Balance)
}

func TestUpdateAgentDailyLimitRequiresActiveAgent(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 17)
	account, err := EnableAgent(17)
	require.NoError(t, err)

	updated, err := UpdateAgentDailyLimit(17, 350)
	require.NoError(t, err)
	assert.Equal(t, 350, updated.DailyCodeLimit)
	assert.Equal(t, account.Version+1, updated.Version)

	_, err = DisableAgent(17)
	require.NoError(t, err)
	_, err = UpdateAgentDailyLimit(17, 400)
	assert.ErrorIs(t, err, ErrAgentAccountDisabled)
}

func TestAdjustAgentCreditCreatesExactImmutableLedger(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 12)
	_, err := EnableAgent(12)
	require.NoError(t, err)

	credit, err := AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID:    12,
		OperatorUserID: 1,
		Amount:         100000,
		Direction:      AgentCreditDirectionCredit,
		Reason:         "offline payment",
		IdempotencyKey: "credit-1",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(100000), credit.Account.Balance)
	assert.Equal(t, int64(0), credit.Log.BalanceBefore)
	assert.Equal(t, int64(100000), credit.Log.BalanceAfter)
	assert.Equal(t, int64(100000), credit.Log.Delta)

	debit, err := AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID:    12,
		OperatorUserID: 1,
		Amount:         25025,
		Direction:      AgentCreditDirectionDebit,
		Reason:         "manual correction",
		IdempotencyKey: "debit-1",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(74975), debit.Account.Balance)
	assert.Equal(t, int64(-25025), debit.Log.Delta)
	assert.Equal(t, int64(100000), debit.Log.BalanceBefore)
	assert.Equal(t, int64(74975), debit.Log.BalanceAfter)

	var logs []model.AgentCreditLog
	require.NoError(t, model.DB.Order("id asc").Find(&logs).Error)
	require.Len(t, logs, 2)
	assert.Equal(t, int64(0), logs[0].BalanceBefore)
	assert.Equal(t, logs[0].BalanceAfter, logs[1].BalanceBefore)
}

func TestAdjustAgentCreditAdvancesAccountUpdatedAt(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 119)
	account, err := EnableAgent(119)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("id = ?", account.Id).
		UpdateColumn("updated_at", int64(1)).Error)

	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 119, OperatorUserID: 1, Amount: 1000,
		Direction: AgentCreditDirectionCredit, Reason: "timestamp advance",
		IdempotencyKey: "timestamp-advance",
	})
	require.NoError(t, err)
	var stored model.AgentAccount
	require.NoError(t, model.DB.First(&stored, account.Id).Error)
	assert.Greater(t, stored.UpdatedAt, int64(1))
}

func TestAdjustAgentCreditRejectsLedgerMismatchWithoutMutation(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 120)
	_, err := EnableAgent(120)
	require.NoError(t, err)
	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 120, OperatorUserID: 1, Amount: 1000,
		Direction: AgentCreditDirectionCredit, Reason: "seed", IdempotencyKey: "seed-mismatch",
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", 120).
		UpdateColumn("balance", int64(1001)).Error)
	var before model.AgentAccount
	require.NoError(t, model.DB.Where("user_id = ?", 120).First(&before).Error)

	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 120, OperatorUserID: 1, Amount: 100,
		Direction: AgentCreditDirectionCredit, Reason: "must reject", IdempotencyKey: "reject-mismatch",
	})
	assert.ErrorIs(t, err, ErrAgentLedgerMismatch)
	var after model.AgentAccount
	require.NoError(t, model.DB.Where("user_id = ?", 120).First(&after).Error)
	assert.Equal(t, before, after)
	var logs int64
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Where("agent_user_id = ?", 120).Count(&logs).Error)
	assert.Equal(t, int64(1), logs)
}

func TestAdjustAgentCreditHotGuardUsesLatestLedgerEntry(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 121)
	_, err := EnableAgent(121)
	require.NoError(t, err)
	for index, amount := range []int64{1000, 500} {
		_, err = AdjustAgentCredit(AgentCreditAdjustment{
			AgentUserID: 121, OperatorUserID: 1, Amount: amount,
			Direction: AgentCreditDirectionCredit, Reason: "seed ledger",
			IdempotencyKey: fmt.Sprintf("tail-seed-%d", index),
		})
		require.NoError(t, err)
	}
	var first model.AgentCreditLog
	require.NoError(t, model.DB.Where("agent_user_id = ?", 121).Order("id ASC").First(&first).Error)
	require.NoError(t, model.DB.Exec("UPDATE agent_credit_logs SET balance_before = ? WHERE id = ?", 1, first.Id).Error)

	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 121, OperatorUserID: 1, Amount: 250,
		Direction: AgentCreditDirectionCredit, Reason: "tail-only guard",
		IdempotencyKey: "tail-only-guard",
	})
	require.NoError(t, err)
	account, err := GetAgentAccount(121)
	require.NoError(t, err)
	assert.Equal(t, int64(1750), account.Balance)
	reconciliation, err := ReconcileAgentAccount(121)
	require.NoError(t, err)
	assert.False(t, reconciliation.Matches)
	assert.False(t, reconciliation.LedgerContinuous)
}

func TestAdjustAgentCreditRejectsCorruptedLatestLedgerEntry(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 122)
	_, err := EnableAgent(122)
	require.NoError(t, err)
	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 122, OperatorUserID: 1, Amount: 1000,
		Direction: AgentCreditDirectionCredit, Reason: "seed ledger",
		IdempotencyKey: "tail-corruption-seed",
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Exec(
		"UPDATE agent_credit_logs SET balance_after = ? WHERE agent_user_id = ?", 999, 122,
	).Error)

	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 122, OperatorUserID: 1, Amount: 100,
		Direction: AgentCreditDirectionCredit, Reason: "must reject corrupt tail",
		IdempotencyKey: "tail-corruption-reject",
	})
	assert.ErrorIs(t, err, ErrAgentLedgerMismatch)
	account, getErr := GetAgentAccount(122)
	require.NoError(t, getErr)
	assert.Equal(t, int64(1000), account.Balance)
}

func TestAdjustAgentCreditRejectsNonzeroBalanceWithoutLedger(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 123)
	account, err := EnableAgent(123)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("id = ?", account.Id).
		UpdateColumn("balance", int64(1)).Error)

	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 123, OperatorUserID: 1, Amount: 100,
		Direction: AgentCreditDirectionCredit, Reason: "must reject missing tail",
		IdempotencyKey: "missing-tail-reject",
	})
	assert.ErrorIs(t, err, ErrAgentLedgerMismatch)
}

func TestAdjustAgentCreditRejectsInvalidInputAndRollsBackInsufficientDebit(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 13)
	_, err := EnableAgent(13)
	require.NoError(t, err)

	base := AgentCreditAdjustment{
		AgentUserID: 13, OperatorUserID: 1, Amount: 100,
		Direction: AgentCreditDirectionCredit, Reason: "fund", IdempotencyKey: "valid",
	}
	tests := []struct {
		name string
		edit func(*AgentCreditAdjustment)
	}{
		{name: "reason required", edit: func(input *AgentCreditAdjustment) { input.Reason = " " }},
		{name: "idempotency required", edit: func(input *AgentCreditAdjustment) { input.IdempotencyKey = "" }},
		{name: "positive amount required", edit: func(input *AgentCreditAdjustment) { input.Amount = 0 }},
		{name: "valid direction required", edit: func(input *AgentCreditAdjustment) { input.Direction = "set" }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			input := base
			tt.edit(&input)
			_, err := AdjustAgentCredit(input)
			assert.Error(t, err)
		})
	}

	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 13, OperatorUserID: 1, Amount: 1,
		Direction: AgentCreditDirectionDebit, Reason: "cannot debit", IdempotencyKey: "insufficient",
	})
	require.ErrorIs(t, err, ErrAgentInsufficientBalance)

	account, err := GetAgentAccount(13)
	require.NoError(t, err)
	assert.Zero(t, account.Balance)
	var count int64
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestAdjustAgentCreditIsIdempotentAndRejectsKeyReuseWithDifferentPayload(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 14)
	_, err := EnableAgent(14)
	require.NoError(t, err)

	input := AgentCreditAdjustment{
		AgentUserID: 14, OperatorUserID: 1, Amount: 1234,
		Direction: AgentCreditDirectionCredit, Reason: "fund", IdempotencyKey: "duplicate-key",
	}
	first, err := AdjustAgentCredit(input)
	require.NoError(t, err)
	second, err := AdjustAgentCredit(input)
	require.NoError(t, err)
	assert.Equal(t, first.Log.Id, second.Log.Id)
	assert.Equal(t, first.Log.BalanceAfter, second.Account.Balance)

	input.Amount++
	_, err = AdjustAgentCredit(input)
	assert.ErrorIs(t, err, ErrAgentIdempotencyConflict)

	input.Amount--
	input.Direction = AgentCreditDirectionDebit
	_, err = AdjustAgentCredit(input)
	assert.ErrorIs(t, err, ErrAgentIdempotencyConflict)

	input.Direction = AgentCreditDirectionCredit
	input.Reason = "different reason"
	_, err = AdjustAgentCredit(input)
	assert.ErrorIs(t, err, ErrAgentIdempotencyConflict)

	account, err := GetAgentAccount(14)
	require.NoError(t, err)
	assert.Equal(t, int64(1234), account.Balance)
	var count int64
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestAdjustAgentCreditRequiresActiveAccount(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 18)
	_, err := EnableAgent(18)
	require.NoError(t, err)
	_, err = DisableAgent(18)
	require.NoError(t, err)

	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 18, OperatorUserID: 1, Amount: 100,
		Direction: AgentCreditDirectionCredit, Reason: "fund", IdempotencyKey: "disabled",
	})
	assert.ErrorIs(t, err, ErrAgentAccountDisabled)

	account, err := GetAgentAccount(18)
	require.NoError(t, err)
	assert.Zero(t, account.Balance)
	var count int64
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestAdjustAgentCreditRejectsOverflow(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 15)
	account, err := EnableAgent(15)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("id = ?", account.Id).Update("balance", int64(math.MaxInt64)).Error)

	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 15, OperatorUserID: 1, Amount: 1,
		Direction: AgentCreditDirectionCredit, Reason: "overflow", IdempotencyKey: "overflow",
	})
	assert.ErrorIs(t, err, ErrAgentBalanceOverflow)
}

func TestAdjustAgentCreditRetriesOneStaleVersionConflict(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 16)
	_, err := EnableAgent(16)
	require.NoError(t, err)

	var injected atomic.Bool
	callbackName := "test:agent_account_stale_version"
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "agent_accounts" || injected.Swap(true) {
			return
		}
		query := strings.ToLower(tx.Statement.SQL.String())
		if !strings.Contains(query, "version") {
			return
		}
		_, callbackErr := tx.Statement.ConnPool.ExecContext(context.Background(),
			"UPDATE agent_accounts SET version = version + 1 WHERE user_id = ?", 16)
		if callbackErr != nil {
			tx.AddError(callbackErr)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})

	result, err := AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 16, OperatorUserID: 1, Amount: 500,
		Direction: AgentCreditDirectionCredit, Reason: "retry", IdempotencyKey: "retry-once",
	})
	require.NoError(t, err)
	assert.True(t, injected.Load())
	assert.Equal(t, int64(500), result.Account.Balance)
	account, getErr := GetAgentAccount(16)
	require.NoError(t, getErr)
	assert.Equal(t, int64(1), account.Version)
}

func TestAdjustAgentCreditRollsBackBalanceWhenLedgerInsertFails(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 20)
	_, err := EnableAgent(20)
	require.NoError(t, err)

	callbackName := "test:agent_credit_log_create_failure"
	require.NoError(t, model.DB.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "agent_credit_logs" {
			tx.AddError(errors.New("injected ledger failure"))
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Create().Remove(callbackName))
	})

	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 20, OperatorUserID: 1, Amount: 500,
		Direction: AgentCreditDirectionCredit, Reason: "rollback", IdempotencyKey: "rollback",
	})
	require.Error(t, err)

	account, getErr := GetAgentAccount(20)
	require.NoError(t, getErr)
	assert.Zero(t, account.Balance)
	assert.Zero(t, account.Version)
	var count int64
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestAgentAdminQueriesReturnOwnedAccountsAndLedger(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 21)
	createAgentTestUser(t, 22)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 21).Updates(map[string]interface{}{
		"username": "alpha-agent", "display_name": "Alpha",
	}).Error)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 22).Updates(map[string]interface{}{
		"username": "beta-agent", "display_name": "Beta",
	}).Error)
	_, err := EnableAgent(21)
	require.NoError(t, err)
	_, err = EnableAgent(22)
	require.NoError(t, err)
	_, err = DisableAgent(22)
	require.NoError(t, err)
	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 21, OperatorUserID: 1, Amount: 500,
		Direction: AgentCreditDirectionCredit, Reason: "fund", IdempotencyKey: "query",
	})
	require.NoError(t, err)

	records, total, err := ListAdminAgentAccounts("alpha", model.AgentAccountStatusActive, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, records, 1)
	assert.Equal(t, 21, records[0].Account.UserId)
	assert.Equal(t, "alpha-agent", records[0].Username)
	assert.Equal(t, int64(500), records[0].Account.Balance)

	logs, total, err := ListAdminAgentCreditLogs(21, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, logs, 1)
	assert.Equal(t, int64(500), logs[0].Delta)

	otherLogs, otherTotal, err := ListAdminAgentCreditLogs(22, 0, 10)
	require.NoError(t, err)
	assert.Zero(t, otherTotal)
	assert.Empty(t, otherLogs)
}

func TestAdjustAgentCreditReplayReturnsStableHistoricalResultWithoutChangingCurrentAccount(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 23)
	_, err := EnableAgent(23)
	require.NoError(t, err)

	adjustmentA := AgentCreditAdjustment{
		AgentUserID: 23, OperatorUserID: 1, Amount: 1000,
		Direction: AgentCreditDirectionCredit, Reason: "first", IdempotencyKey: "stable-a",
	}
	first, err := AdjustAgentCredit(adjustmentA)
	require.NoError(t, err)
	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 23, OperatorUserID: 1, Amount: 500,
		Direction: AgentCreditDirectionCredit, Reason: "second", IdempotencyKey: "stable-b",
	})
	require.NoError(t, err)
	_, err = UpdateAgentDailyLimit(23, 350)
	require.NoError(t, err)
	_, err = DisableAgent(23)
	require.NoError(t, err)

	replayed, err := AdjustAgentCredit(adjustmentA)
	require.NoError(t, err)
	assert.Equal(t, first, replayed)

	current, err := GetAgentAccount(23)
	require.NoError(t, err)
	assert.Equal(t, int64(1500), current.Balance)
	assert.Equal(t, 350, current.DailyCodeLimit)
	assert.Equal(t, model.AgentAccountStatusDisabled, current.Status)
	var count int64
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Count(&count).Error)
	assert.Equal(t, int64(2), count)
}

func TestAgentLifecycleReturnsPersistedVersionAndTimestamps(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 24)
	account, err := EnableAgent(24)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("id = ?", account.Id).Update("updated_at", 1).Error)

	disabled, err := DisableAgent(24)
	require.NoError(t, err)
	var stored model.AgentAccount
	require.NoError(t, model.DB.First(&stored, account.Id).Error)
	assert.Equal(t, stored, *disabled)
	assert.Greater(t, disabled.UpdatedAt, int64(1))

	reenabled, err := EnableAgent(24)
	require.NoError(t, err)
	require.NoError(t, model.DB.First(&stored, account.Id).Error)
	assert.Equal(t, stored, *reenabled)
}

func TestListAdminAgentCreditLogsRejectsMissingAgent(t *testing.T) {
	setupAgentAccountTest(t)

	_, _, err := ListAdminAgentCreditLogs(999, 0, 10)
	assert.ErrorIs(t, err, ErrAgentAccountNotFound)
}

func TestAdjustAgentCreditStopsAfterThreeVersionConflicts(t *testing.T) {
	setupAgentAccountTest(t)
	createAgentTestUser(t, 25)
	_, err := EnableAgent(25)
	require.NoError(t, err)

	var conflicts atomic.Int32
	callbackName := "test:agent_account_three_stale_versions"
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		updates, ok := tx.Statement.Dest.(map[string]interface{})
		if tx.Statement.Table != "agent_accounts" || !ok {
			return
		}
		if _, updatingBalance := updates["balance"]; !updatingBalance {
			return
		}
		conflicts.Add(1)
		_, callbackErr := tx.Statement.ConnPool.ExecContext(context.Background(),
			"UPDATE agent_accounts SET version = version + 1 WHERE user_id = ?", 25)
		if callbackErr != nil {
			tx.AddError(callbackErr)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})

	_, err = AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: 25, OperatorUserID: 1, Amount: 500,
		Direction: AgentCreditDirectionCredit, Reason: "retry", IdempotencyKey: "retry-three",
	})
	assert.ErrorIs(t, err, ErrAgentAccountConflict)
	assert.Equal(t, int32(agentAccountMutationMaxAttempts), conflicts.Load())

	account, getErr := GetAgentAccount(25)
	require.NoError(t, getErr)
	assert.Zero(t, account.Balance)
	assert.Zero(t, account.Version)
}

func TestEnableAgentReturnsConcurrentWinnerAfterCreateConflict(t *testing.T) {
	originalDB := model.DB
	dsn := "file:" + t.TempDir() + "/agent-enable.db?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	winnerDB, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	t.Cleanup(func() {
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
		winnerSQLDB, winnerErr := winnerDB.DB()
		if winnerErr == nil {
			require.NoError(t, winnerSQLDB.Close())
		}
	})
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.AgentAccount{}))
	model.DB = db
	t.Cleanup(func() { model.DB = originalDB })
	require.NoError(t, model.DB.Create(&model.User{
		Id: 26, Username: "concurrent-agent", AffCode: "aff-26",
		Status: common.UserStatusEnabled, Role: common.RoleCommonUser,
	}).Error)

	var inserted atomic.Bool
	callbackName := "test:agent_enable_concurrent_winner"
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "agent_accounts" || inserted.Swap(true) {
			return
		}
		winner := model.AgentAccount{
			UserId: 26, Status: model.AgentAccountStatusActive,
			DailyCodeLimit: model.DefaultAgentDailyCodeLimit,
		}
		if createErr := winnerDB.Create(&winner).Error; createErr != nil {
			tx.AddError(createErr)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, db.Callback().Create().Remove(callbackName))
	})

	account, err := EnableAgent(26)
	require.NoError(t, err)
	assert.True(t, inserted.Load())
	assert.Equal(t, 26, account.UserId)
	assert.Equal(t, model.AgentAccountStatusActive, account.Status)
	var count int64
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", 26).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}
