package service

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type agentRefundFixture struct {
	agentID int
	otherID int
	orders  []model.AgentPurchaseOrder
	codes   []model.Redemption
}

func setupAgentRefundTest(t *testing.T) agentRefundFixture {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalEnabled := operation_setting.GetAgentSetting().Enabled
	dsn := "file:" + filepath.Join(t.TempDir(), "agent-refund.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(8)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Log{}, &model.UserSubscription{}, &model.AgentAccount{}, &model.AgentCreditLog{},
		&model.AgentPurchaseOrder{}, &model.AgentRefundRequest{}, &model.Redemption{},
	))
	model.DB, model.LOG_DB = db, db
	common.RedisEnabled = false
	operation_setting.GetAgentSetting().Enabled = true
	t.Cleanup(func() {
		model.DB, model.LOG_DB = originalDB, originalLogDB
		common.RedisEnabled = originalRedisEnabled
		operation_setting.GetAgentSetting().Enabled = originalEnabled
		require.NoError(t, sqlDB.Close())
	})

	const agentID = 901
	const otherID = 902
	for _, userID := range []int{agentID, otherID} {
		require.NoError(t, db.Create(&model.User{
			Id: userID, Username: fmt.Sprintf("refund-agent-%d", userID),
			AffCode: fmt.Sprintf("refund-aff-%d", userID), Status: common.UserStatusEnabled,
		}).Error)
		require.NoError(t, db.Create(&model.AgentAccount{
			UserId: userID, Status: model.AgentAccountStatusActive,
		}).Error)
		_, err := AdjustAgentCredit(AgentCreditAdjustment{
			AgentUserID: userID, OperatorUserID: 1, Amount: 1000,
			Direction: AgentCreditDirectionCredit, Reason: "test fixture funding",
			IdempotencyKey: fmt.Sprintf("refund-fixture-funding-%d", userID),
		})
		require.NoError(t, err)
	}

	now := time.Now().Unix()
	snapshotOne, err := model.EncodeSubscriptionEntitlementSnapshot(model.SubscriptionEntitlementSnapshot{
		Version: model.SubscriptionEntitlementVersion1, PlanId: 11, PlanTitle: "Plan One",
		DurationUnit: model.SubscriptionDurationCustom, CustomSeconds: 3600,
		QuotaResetPeriod: model.SubscriptionResetNever,
	})
	require.NoError(t, err)
	snapshotTwo, err := model.EncodeSubscriptionEntitlementSnapshot(model.SubscriptionEntitlementSnapshot{
		Version: model.SubscriptionEntitlementVersion1, PlanId: 12, PlanTitle: "Plan Two",
		DurationUnit: model.SubscriptionDurationCustom, CustomSeconds: 3600,
		QuotaResetPeriod: model.SubscriptionResetNever,
	})
	require.NoError(t, err)
	snapshotOther, err := model.EncodeSubscriptionEntitlementSnapshot(model.SubscriptionEntitlementSnapshot{
		Version: model.SubscriptionEntitlementVersion1, PlanId: 13, PlanTitle: "Other",
		DurationUnit: model.SubscriptionDurationCustom, CustomSeconds: 3600,
		QuotaResetPeriod: model.SubscriptionResetNever,
	})
	require.NoError(t, err)
	orders := []model.AgentPurchaseOrder{
		{OrderNo: "refund-order-one", AgentUserId: agentID, PlanId: 11, PlanTitle: "Plan One", Quantity: 2, UnitPrice: 6000, TotalPrice: 12000, CodeValidDays: 365, RefundFeeBps: 500, EntitlementSnapshot: snapshotOne, IdempotencyKey: "refund-order-one-key", Status: model.AgentPurchaseOrderStatusCompleted},
		{OrderNo: "refund-order-two", AgentUserId: agentID, PlanId: 12, PlanTitle: "Plan Two", Quantity: 1, UnitPrice: 10001, TotalPrice: 10001, CodeValidDays: 365, RefundFeeBps: 333, EntitlementSnapshot: snapshotTwo, IdempotencyKey: "refund-order-two-key", Status: model.AgentPurchaseOrderStatusCompleted},
		{OrderNo: "refund-order-other", AgentUserId: otherID, PlanId: 13, PlanTitle: "Other", Quantity: 1, UnitPrice: 7000, TotalPrice: 7000, CodeValidDays: 365, RefundFeeBps: 0, EntitlementSnapshot: snapshotOther, IdempotencyKey: "refund-order-other-key", Status: model.AgentPurchaseOrderStatusCompleted},
	}
	require.NoError(t, db.Create(&orders).Error)
	codes := []model.Redemption{
		{UserId: agentID, AgentUserId: agentID, AgentOrderId: orders[0].Id, SubscriptionPlanId: orders[0].PlanId, Type: common.RedemptionCodeTypeSubscription, Key: "refund-code-one", Name: orders[0].PlanTitle, Status: common.RedemptionCodeStatusEnabled, ExpiredTime: now + 3600},
		{UserId: agentID, AgentUserId: agentID, AgentOrderId: orders[0].Id, SubscriptionPlanId: orders[0].PlanId, Type: common.RedemptionCodeTypeSubscription, Key: "refund-code-two", Name: orders[0].PlanTitle, Status: common.RedemptionCodeStatusEnabled, ExpiredTime: now + 3600},
		{UserId: agentID, AgentUserId: agentID, AgentOrderId: orders[1].Id, SubscriptionPlanId: orders[1].PlanId, Type: common.RedemptionCodeTypeSubscription, Key: "refund-code-three", Name: orders[1].PlanTitle, Status: common.RedemptionCodeStatusEnabled, ExpiredTime: now + 3600},
		{UserId: otherID, AgentUserId: otherID, AgentOrderId: orders[2].Id, SubscriptionPlanId: orders[2].PlanId, Type: common.RedemptionCodeTypeSubscription, Key: "refund-code-other", Name: orders[2].PlanTitle, Status: common.RedemptionCodeStatusEnabled, ExpiredTime: now + 3600},
	}
	require.NoError(t, db.Create(&codes).Error)
	return agentRefundFixture{agentID: agentID, otherID: otherID, orders: orders, codes: codes}
}

func TestRefundAgentCodesAcrossOrdersUsesSnapshotsAndSequentialLedger(t *testing.T) {
	fixture := setupAgentRefundTest(t)

	result, err := RefundAgentCodes(AgentRefundInput{
		AgentUserID:    fixture.agentID,
		RedemptionIDs:  []int{fixture.codes[2].Id, fixture.codes[0].Id},
		IdempotencyKey: "refund-across-orders", RequestedBy: fixture.agentID,
	})
	require.NoError(t, err)
	assert.Equal(t, []int{fixture.codes[0].Id, fixture.codes[2].Id}, result.RedemptionIDs)
	assert.Equal(t, int64(633), result.Fee)
	assert.Equal(t, int64(15368), result.Refunded)
	assert.Equal(t, int64(16368), result.BalanceAfter)

	var account model.AgentAccount
	require.NoError(t, model.DB.Where("user_id = ?", fixture.agentID).First(&account).Error)
	assert.Equal(t, int64(16368), account.Balance)
	assert.Equal(t, int64(2), account.Version)

	var logs []model.AgentCreditLog
	require.NoError(t, model.DB.Where("event_type = ?", model.AgentCreditEventRefund).Order("id ASC").Find(&logs).Error)
	require.Len(t, logs, 2)
	assert.Equal(t, "refund:"+fmt.Sprint(fixture.codes[0].Id), logs[0].BusinessKey)
	assert.Equal(t, int64(1000), logs[0].BalanceBefore)
	assert.Equal(t, int64(5700), logs[0].Delta)
	assert.Equal(t, int64(6700), logs[0].BalanceAfter)
	assert.Equal(t, "refund:"+fmt.Sprint(fixture.codes[2].Id), logs[1].BusinessKey)
	assert.Equal(t, logs[0].BalanceAfter, logs[1].BalanceBefore)
	assert.Equal(t, int64(9668), logs[1].Delta)
	assert.Equal(t, result.BalanceAfter, logs[1].BalanceAfter)

	var orderOne, orderTwo model.AgentPurchaseOrder
	require.NoError(t, model.DB.First(&orderOne, fixture.orders[0].Id).Error)
	require.NoError(t, model.DB.First(&orderTwo, fixture.orders[1].Id).Error)
	assert.Equal(t, 1, orderOne.RefundedCount)
	assert.Equal(t, int64(5700), orderOne.RefundedAmount)
	assert.Equal(t, model.AgentPurchaseOrderStatusPartiallyRefunded, orderOne.Status)
	assert.Equal(t, 1, orderTwo.RefundedCount)
	assert.Equal(t, int64(9668), orderTwo.RefundedAmount)
	assert.Equal(t, model.AgentPurchaseOrderStatusRefunded, orderTwo.Status)
}

func TestRefundAgentCodesSupportsHundredPercentFeeWithoutBalanceWrite(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).Where("id = ?", fixture.orders[0].Id).
		Update("refund_fee_bps", 10000).Error)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", fixture.agentID).
		UpdateColumn("updated_at", int64(1)).Error)
	var balanceWrites atomic.Int32
	var accountWrites atomic.Int32
	callbackName := "test:refund-zero-balance-write"
	require.NoError(t, model.DB.Callback().Update().After("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "agent_accounts" {
			accountWrites.Add(1)
			if strings.Contains(strings.ToLower(tx.Statement.SQL.String()), "balance") {
				balanceWrites.Add(1)
			}
		}
	}))
	t.Cleanup(func() { require.NoError(t, model.DB.Callback().Update().Remove(callbackName)) })

	result, err := RefundAgentCodes(AgentRefundInput{
		AgentUserID: fixture.agentID, RedemptionIDs: []int{fixture.codes[0].Id},
		IdempotencyKey: "full-fee", RequestedBy: fixture.agentID,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(6000), result.Fee)
	assert.Zero(t, result.Refunded)
	assert.Equal(t, int64(1000), result.BalanceAfter)
	assert.Equal(t, int32(1), accountWrites.Load(), "the version guard is the only required account write")
	assert.Zero(t, balanceWrites.Load(), "zero refund must rely on the successful version guard, not a no-op balance update")
	var account model.AgentAccount
	require.NoError(t, model.DB.Where("user_id = ?", fixture.agentID).First(&account).Error)
	assert.Greater(t, account.UpdatedAt, int64(1))
	var ledger model.AgentCreditLog
	require.NoError(t, model.DB.Where("event_type = ? AND redemption_id = ?", model.AgentCreditEventRefund, fixture.codes[0].Id).First(&ledger).Error)
	assert.Zero(t, ledger.Delta)
	assert.Equal(t, ledger.BalanceBefore, ledger.BalanceAfter)
	var code model.Redemption
	require.NoError(t, model.DB.First(&code, fixture.codes[0].Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusRefunded, code.Status)
	var order model.AgentPurchaseOrder
	require.NoError(t, model.DB.First(&order, fixture.orders[0].Id).Error)
	assert.Equal(t, 1, order.RefundedCount)
	assert.Zero(t, order.RefundedAmount)
	assert.Equal(t, model.AgentPurchaseOrderStatusPartiallyRefunded, order.Status)
	var request model.AgentRefundRequest
	require.NoError(t, model.DB.Where("agent_user_id = ? AND idempotency_key = ?", fixture.agentID, "full-fee").First(&request).Error)
	assert.Equal(t, int64(6000), request.FeeTotal)
	assert.Zero(t, request.RefundTotal)
	assert.Equal(t, int64(1000), request.BalanceAfter)
}

func TestRefundAgentCodesRejectsLedgerMismatchWithoutMutation(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", fixture.agentID).
		UpdateColumn("balance", int64(1001)).Error)
	var before model.AgentAccount
	require.NoError(t, model.DB.Where("user_id = ?", fixture.agentID).First(&before).Error)

	_, err := RefundAgentCodes(AgentRefundInput{
		AgentUserID: fixture.agentID, RedemptionIDs: []int{fixture.codes[0].Id},
		IdempotencyKey: "refund-mismatch", RequestedBy: fixture.agentID,
	})
	assert.ErrorIs(t, err, ErrAgentLedgerMismatch)
	var after model.AgentAccount
	require.NoError(t, model.DB.Where("user_id = ?", fixture.agentID).First(&after).Error)
	assert.Equal(t, before, after)
	var code model.Redemption
	require.NoError(t, model.DB.First(&code, fixture.codes[0].Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, code.Status)
	var requests, refunds int64
	require.NoError(t, model.DB.Model(&model.AgentRefundRequest{}).Count(&requests).Error)
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Where("event_type = ?", model.AgentCreditEventRefund).Count(&refunds).Error)
	assert.Zero(t, requests)
	assert.Zero(t, refunds)
}

func TestRefundAgentCodesRejectsEmptyKeyOrMismatchedName(t *testing.T) {
	tests := []struct {
		name  string
		field string
		value interface{}
	}{
		{name: "empty key", field: "key", value: ""},
		{name: "mismatched name", field: "name", value: "tampered plan"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fixture := setupAgentRefundTest(t)
			require.NoError(t, model.DB.Model(&model.Redemption{}).Where("id = ?", fixture.codes[0].Id).
				Update(test.field, test.value).Error)
			var before model.AgentAccount
			require.NoError(t, model.DB.Where("user_id = ?", fixture.agentID).First(&before).Error)
			_, err := RefundAgentCodes(AgentRefundInput{
				AgentUserID: fixture.agentID, RedemptionIDs: []int{fixture.codes[0].Id},
				IdempotencyKey: "code-integrity", RequestedBy: fixture.agentID,
			})
			assert.ErrorIs(t, err, ErrAgentRefundUnavailable)
			var after model.AgentAccount
			require.NoError(t, model.DB.Where("user_id = ?", fixture.agentID).First(&after).Error)
			assert.Equal(t, before, after)
			var requests, refunds int64
			require.NoError(t, model.DB.Model(&model.AgentRefundRequest{}).Count(&requests).Error)
			require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Where("event_type = ?", model.AgentCreditEventRefund).Count(&refunds).Error)
			assert.Zero(t, requests)
			assert.Zero(t, refunds)
		})
	}
}

func TestRefundAgentCodesConditionalCASRejectsConcurrentCodeTampering(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	code := fixture.codes[0]
	var injected atomic.Bool
	callbackName := "test:refund-code-integrity-cas"
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "redemptions" || injected.Swap(true) {
			return
		}
		if _, err := tx.Statement.ConnPool.ExecContext(tx.Statement.Context,
			"UPDATE redemptions SET name = ? WHERE id = ?", "concurrent tamper", code.Id); err != nil {
			tx.AddError(err)
		}
	}))
	t.Cleanup(func() { require.NoError(t, model.DB.Callback().Update().Remove(callbackName)) })

	var before model.AgentAccount
	require.NoError(t, model.DB.Where("user_id = ?", fixture.agentID).First(&before).Error)
	_, err := RefundAgentCodes(AgentRefundInput{
		AgentUserID: fixture.agentID, RedemptionIDs: []int{code.Id},
		IdempotencyKey: "concurrent-code-tamper", RequestedBy: fixture.agentID,
	})
	assert.ErrorIs(t, err, ErrAgentRefundUnavailable)
	assert.True(t, injected.Load())
	var after model.AgentAccount
	require.NoError(t, model.DB.Where("user_id = ?", fixture.agentID).First(&after).Error)
	assert.Equal(t, before, after)
	var persisted model.Redemption
	require.NoError(t, model.DB.First(&persisted, code.Id).Error)
	assert.Equal(t, code.Name, persisted.Name, "the injected tamper must roll back with the failed refund")
	assert.Equal(t, common.RedemptionCodeStatusEnabled, persisted.Status)
	var requests, refunds int64
	require.NoError(t, model.DB.Model(&model.AgentRefundRequest{}).Count(&requests).Error)
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Where("event_type = ?", model.AgentCreditEventRefund).Count(&refunds).Error)
	assert.Zero(t, requests)
	assert.Zero(t, refunds)
}

func TestAgentRefundCodeCASQuotesReservedKeyForMySQL(t *testing.T) {
	db, err := gorm.Open(mysql.New(mysql.Config{
		DSN:                       "gorm:gorm@tcp(localhost:9910)/gorm?charset=utf8&parseTime=True&loc=Local",
		SkipInitializeWithVersion: true,
	}), &gorm.Config{DryRun: true, DisableAutomaticPing: true, SkipDefaultTransaction: true})
	require.NoError(t, err)

	code := model.Redemption{
		Id: 1, UserId: 2, AgentUserId: 2, AgentOrderId: 3, SubscriptionPlanId: 4,
		Type: common.RedemptionCodeTypeSubscription, Key: "package-code", Name: "Plan",
		Status: common.RedemptionCodeStatusEnabled, ExpiredTime: 200,
	}
	statement := agentRefundCodeCAS(db, code, 100).Statement
	require.NoError(t, statement.Error)

	sql := statement.SQL.String()
	assert.Contains(t, sql, "`key` = ?")
	for _, column := range []string{
		"`id`", "`type`", "`user_id`", "`agent_user_id`", "`agent_order_id`",
		"`subscription_plan_id`", "`name`", "`status`", "`used_user_id`", "`redeemed_time`",
	} {
		assert.Contains(t, sql, column+" = ?")
	}
	assert.Contains(t, sql, "expired_time > ?")
}

func TestRefundAgentCodesIdempotencyResolvesBeforeCurrentState(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	input := AgentRefundInput{
		AgentUserID: fixture.agentID, RedemptionIDs: []int{fixture.codes[2].Id, fixture.codes[0].Id},
		IdempotencyKey: "stable-refund", RequestedBy: fixture.agentID,
	}
	first, err := RefundAgentCodes(input)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", fixture.agentID).
		Updates(map[string]interface{}{"status": model.AgentAccountStatusDisabled, "balance": int64(99999)}).Error)
	operation_setting.GetAgentSetting().Enabled = false

	replayInput := input
	replayInput.RedemptionIDs = []int{fixture.codes[0].Id, fixture.codes[2].Id}
	replayed, err := RefundAgentCodes(replayInput)
	require.NoError(t, err)
	assert.Equal(t, first, replayed)
	_, err = RefundAgentCodes(AgentRefundInput{
		AgentUserID: fixture.agentID, RedemptionIDs: []int{fixture.codes[1].Id},
		IdempotencyKey: input.IdempotencyKey, RequestedBy: fixture.agentID,
	})
	assert.ErrorIs(t, err, ErrAgentIdempotencyConflict)
}

func TestRefundAgentCodesRejectsInvalidOrMixedBatchesWithoutPartialChanges(t *testing.T) {
	tests := []struct {
		name string
		edit func(t *testing.T, fixture agentRefundFixture)
		ids  func(agentRefundFixture) []int
		want error
	}{
		{name: "duplicate IDs", ids: func(f agentRefundFixture) []int { return []int{f.codes[0].Id, f.codes[0].Id} }, want: ErrAgentRefundInvalidRequest},
		{name: "other owner", ids: func(f agentRefundFixture) []int { return []int{f.codes[0].Id, f.codes[3].Id} }, want: ErrAgentRefundUnavailable},
		{name: "expired", edit: func(t *testing.T, f agentRefundFixture) {
			require.NoError(t, model.DB.Model(&model.Redemption{}).Where("id = ?", f.codes[1].Id).Update("expired_time", time.Now().Unix()).Error)
		}, ids: func(f agentRefundFixture) []int { return []int{f.codes[0].Id, f.codes[1].Id} }, want: ErrAgentRefundUnavailable},
		{name: "used", edit: func(t *testing.T, f agentRefundFixture) {
			require.NoError(t, model.DB.Model(&model.Redemption{}).Where("id = ?", f.codes[1].Id).Update("status", common.RedemptionCodeStatusUsed).Error)
		}, ids: func(f agentRefundFixture) []int { return []int{f.codes[0].Id, f.codes[1].Id} }, want: ErrAgentRefundUnavailable},
		{name: "refunded", edit: func(t *testing.T, f agentRefundFixture) {
			require.NoError(t, model.DB.Model(&model.Redemption{}).Where("id = ?", f.codes[1].Id).Update("status", common.RedemptionCodeStatusRefunded).Error)
		}, ids: func(f agentRefundFixture) []int { return []int{f.codes[0].Id, f.codes[1].Id} }, want: ErrAgentRefundUnavailable},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fixture := setupAgentRefundTest(t)
			if test.edit != nil {
				test.edit(t, fixture)
			}
			before := int64(0)
			require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", fixture.agentID).Pluck("balance", &before).Error)
			_, err := RefundAgentCodes(AgentRefundInput{
				AgentUserID: fixture.agentID, RedemptionIDs: test.ids(fixture),
				IdempotencyKey: "invalid-batch", RequestedBy: fixture.agentID,
			})
			assert.ErrorIs(t, err, test.want)
			var after int64
			require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", fixture.agentID).Pluck("balance", &after).Error)
			assert.Equal(t, before, after)
			var enabled int64
			require.NoError(t, model.DB.Model(&model.Redemption{}).Where("id = ? AND status = ?", fixture.codes[0].Id, common.RedemptionCodeStatusEnabled).Count(&enabled).Error)
			assert.Equal(t, int64(1), enabled)
			var requestCount, logCount int64
			require.NoError(t, model.DB.Model(&model.AgentRefundRequest{}).Count(&requestCount).Error)
			require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Where("event_type = ?", model.AgentCreditEventRefund).Count(&logCount).Error)
			assert.Zero(t, requestCount)
			assert.Zero(t, logCount)
		})
	}
}

func TestRefundAgentCodesValidatesRequestBoundsBeforeDatabaseWork(t *testing.T) {
	tooMany := make([]int, AgentRefundMaxCodes+1)
	for index := range tooMany {
		tooMany[index] = index + 1
	}
	tests := []AgentRefundInput{
		{AgentUserID: 1, RedemptionIDs: nil, IdempotencyKey: "empty", RequestedBy: 1},
		{AgentUserID: 1, RedemptionIDs: tooMany, IdempotencyKey: "large", RequestedBy: 1},
		{AgentUserID: 1, RedemptionIDs: []int{0}, IdempotencyKey: "zero", RequestedBy: 1},
		{AgentUserID: 0, RedemptionIDs: []int{1}, IdempotencyKey: "agent", RequestedBy: 1},
		{AgentUserID: 1, RedemptionIDs: []int{1}, IdempotencyKey: "", RequestedBy: 1},
		{AgentUserID: 1, RedemptionIDs: []int{1}, IdempotencyKey: "operator", RequestedBy: 0},
	}
	for _, input := range tests {
		_, err := RefundAgentCodes(input)
		assert.ErrorIs(t, err, ErrAgentRefundInvalidRequest)
	}
}

func TestRefundAgentCodesRejectsInconsistentOrderSnapshotAndRollsBack(t *testing.T) {
	tests := []struct {
		name string
		edit map[string]interface{}
	}{
		{name: "malformed entitlement", edit: map[string]interface{}{"entitlement_snapshot": `{}`}},
		{name: "total price mismatch", edit: map[string]interface{}{"total_price": int64(11999)}},
		{name: "completed order has refunds", edit: map[string]interface{}{"refunded_count": 1, "refunded_amount": int64(5700)}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fixture := setupAgentRefundTest(t)
			require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).
				Where("id = ?", fixture.orders[0].Id).Updates(test.edit).Error)
			_, err := RefundAgentCodes(AgentRefundInput{
				AgentUserID: fixture.agentID, RedemptionIDs: []int{fixture.codes[0].Id},
				IdempotencyKey: "inconsistent-order", RequestedBy: fixture.agentID,
			})
			assert.ErrorIs(t, err, ErrAgentRefundUnavailable)
			var account model.AgentAccount
			require.NoError(t, model.DB.Where("user_id = ?", fixture.agentID).First(&account).Error)
			assert.Equal(t, int64(1000), account.Balance)
			assert.Equal(t, int64(1), account.Version)
			var code model.Redemption
			require.NoError(t, model.DB.First(&code, fixture.codes[0].Id).Error)
			assert.Equal(t, common.RedemptionCodeStatusEnabled, code.Status)
		})
	}
}

func TestRefundAgentCodesDisabledSelfRejectedButRootAllowed(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", fixture.agentID).
		Update("status", model.AgentAccountStatusDisabled).Error)

	_, err := RefundAgentCodes(AgentRefundInput{
		AgentUserID: fixture.agentID, RedemptionIDs: []int{fixture.codes[0].Id},
		IdempotencyKey: "disabled-self", RequestedBy: fixture.agentID,
	})
	assert.ErrorIs(t, err, ErrAgentAccountDisabled)
	operation_setting.GetAgentSetting().Enabled = false

	result, err := RefundAgentCodes(AgentRefundInput{
		AgentUserID: fixture.agentID, RedemptionIDs: []int{fixture.codes[0].Id},
		IdempotencyKey: "root-refund", RequestedBy: 1, RootOverride: true,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(5700), result.Refunded)
}

func TestRefundAgentCodesRollsBackWhenLedgerInsertFails(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	code := fixture.codes[0]
	callbackName := "test:refund-ledger-create-failure"
	require.NoError(t, model.DB.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "agent_credit_logs" {
			tx.AddError(errors.New("injected refund ledger failure"))
		}
	}))
	t.Cleanup(func() { require.NoError(t, model.DB.Callback().Create().Remove(callbackName)) })

	_, err := RefundAgentCodes(AgentRefundInput{
		AgentUserID: fixture.agentID, RedemptionIDs: []int{code.Id},
		IdempotencyKey: "ledger-failure", RequestedBy: fixture.agentID,
	})
	assert.ErrorContains(t, err, "injected refund ledger failure")
	var persisted model.Redemption
	require.NoError(t, model.DB.First(&persisted, code.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, persisted.Status)
	var account model.AgentAccount
	require.NoError(t, model.DB.Where("user_id = ?", fixture.agentID).First(&account).Error)
	assert.Equal(t, int64(1000), account.Balance)
	assert.Equal(t, int64(1), account.Version)
	var requests int64
	require.NoError(t, model.DB.Model(&model.AgentRefundRequest{}).Count(&requests).Error)
	assert.Zero(t, requests)
	var order model.AgentPurchaseOrder
	require.NoError(t, model.DB.First(&order, fixture.orders[0].Id).Error)
	assert.Zero(t, order.RefundedCount)
	assert.Zero(t, order.RefundedAmount)
}

func TestReconcileAgentAccountReportsMismatchWithoutRepair(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	result, err := ReconcileAgentAccount(fixture.agentID)
	require.NoError(t, err)
	assert.True(t, result.Matches)
	assert.True(t, result.LedgerContinuous)
	assert.Equal(t, int64(1000), result.Balance)
	assert.Equal(t, int64(1000), result.LedgerSum)
	assert.Zero(t, result.Difference)

	require.NoError(t, model.DB.Exec("UPDATE agent_credit_logs SET balance_before = ? WHERE agent_user_id = ?", 1, fixture.agentID).Error)
	result, err = ReconcileAgentAccount(fixture.agentID)
	require.NoError(t, err)
	assert.False(t, result.Matches)
	assert.False(t, result.LedgerContinuous)
	assert.Zero(t, result.Difference)
	require.NoError(t, model.DB.Exec("UPDATE agent_credit_logs SET balance_before = ? WHERE agent_user_id = ?", 0, fixture.agentID).Error)

	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", fixture.agentID).Update("balance", int64(1200)).Error)
	result, err = ReconcileAgentAccount(fixture.agentID)
	require.NoError(t, err)
	assert.False(t, result.Matches)
	assert.Equal(t, int64(200), result.Difference)
	var persisted int64
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", fixture.agentID).Pluck("balance", &persisted).Error)
	assert.Equal(t, int64(1200), persisted, "reconciliation must never repair the account")
}

func TestReconcileAgentAccountRetriesConcurrentFinancialCommitWithoutFalseMismatch(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	firstReadComplete := make(chan struct{})
	releaseFirstRead := make(chan struct{})
	var accountReads atomic.Int32
	callbackName := "test:reconciliation-concurrent-commit"
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "agent_accounts" || accountReads.Add(1) != 1 {
			return
		}
		close(firstReadComplete)
		<-releaseFirstRead
	}))
	t.Cleanup(func() { require.NoError(t, model.DB.Callback().Query().Remove(callbackName)) })

	resultCh := make(chan *AgentReconciliation, 1)
	errCh := make(chan error, 1)
	go func() {
		result, err := ReconcileAgentAccount(fixture.agentID)
		resultCh <- result
		errCh <- err
	}()
	<-firstReadComplete
	_, err := AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: fixture.agentID, OperatorUserID: 1, Amount: 500,
		Direction: AgentCreditDirectionCredit, Reason: "concurrent funding",
		IdempotencyKey: "reconciliation-concurrent-funding",
	})
	require.NoError(t, err)
	close(releaseFirstRead)

	result := <-resultCh
	require.NoError(t, <-errCh)
	require.NotNil(t, result)
	assert.True(t, result.Matches)
	assert.True(t, result.LedgerContinuous)
	assert.Equal(t, int64(1500), result.Balance)
	assert.Equal(t, int64(1500), result.LedgerSum)
	assert.Equal(t, int64(2), result.LedgerCount)
	assert.GreaterOrEqual(t, accountReads.Load(), int32(4), "one retry requires two account reads per attempt")
}

func TestReconcileAgentAccountStopsAfterBoundedUnstableSnapshots(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	var reads atomic.Int32
	callbackName := "test:reconciliation-bounded-retries"
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "agent_accounts" {
			return
		}
		reads.Add(1)
		if _, err := tx.Statement.ConnPool.ExecContext(tx.Statement.Context,
			"UPDATE agent_accounts SET version = version + 1 WHERE user_id = ?", fixture.agentID); err != nil {
			tx.AddError(err)
		}
	}))
	t.Cleanup(func() { require.NoError(t, model.DB.Callback().Query().Remove(callbackName)) })

	_, err := ReconcileAgentAccount(fixture.agentID)
	assert.ErrorIs(t, err, ErrAgentReconciliationUnstable)
	assert.Equal(t, int32(agentReconciliationMaxAttempts*2), reads.Load())
}

func TestRefundAndRedeemSameCodeHaveExactlyOneWinner(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	code := fixture.codes[0]
	start := make(chan struct{})
	var wait sync.WaitGroup
	wait.Add(2)
	var refundResult *AgentRefundResult
	var refundErr error
	var redemptionResult *RedemptionResult
	var redemptionErr error
	go func() {
		defer wait.Done()
		<-start
		refundResult, refundErr = RefundAgentCodes(AgentRefundInput{
			AgentUserID: fixture.agentID, RedemptionIDs: []int{code.Id},
			IdempotencyKey: "refund-versus-redeem", RequestedBy: fixture.agentID,
		})
	}()
	go func() {
		defer wait.Done()
		<-start
		redemptionResult, redemptionErr = RedeemCode(fixture.otherID, code.Key)
	}()
	close(start)
	wait.Wait()

	winners := 0
	if refundErr == nil {
		winners++
		require.NotNil(t, refundResult)
	}
	if redemptionErr == nil {
		winners++
		require.NotNil(t, redemptionResult)
	}
	assert.Equal(t, 1, winners, "refund=%v redemption=%v", refundErr, redemptionErr)
	var persisted model.Redemption
	require.NoError(t, model.DB.First(&persisted, code.Id).Error)
	if refundErr == nil {
		assert.Equal(t, common.RedemptionCodeStatusRefunded, persisted.Status)
		var subscriptions int64
		require.NoError(t, model.DB.Model(&model.UserSubscription{}).Count(&subscriptions).Error)
		assert.Zero(t, subscriptions)
	} else {
		assert.Equal(t, common.RedemptionCodeStatusUsed, persisted.Status)
		var refundLogs int64
		require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).
			Where("event_type = ?", model.AgentCreditEventRefund).Count(&refundLogs).Error)
		assert.Zero(t, refundLogs)
	}
}

func TestConcurrentRefundsOfSameCodeHaveExactlyOneWinner(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	code := fixture.codes[0]
	start := make(chan struct{})
	errorsByRequest := make([]error, 2)
	var wait sync.WaitGroup
	for index := range errorsByRequest {
		wait.Add(1)
		go func(index int) {
			defer wait.Done()
			<-start
			_, errorsByRequest[index] = RefundAgentCodes(AgentRefundInput{
				AgentUserID: fixture.agentID, RedemptionIDs: []int{code.Id},
				IdempotencyKey: fmt.Sprintf("concurrent-refund-%d", index), RequestedBy: fixture.agentID,
			})
		}(index)
	}
	close(start)
	wait.Wait()

	successes := 0
	for _, err := range errorsByRequest {
		if err == nil {
			successes++
		}
	}
	assert.Equal(t, 1, successes, errorsByRequest)
	var requests, logs int64
	require.NoError(t, model.DB.Model(&model.AgentRefundRequest{}).Count(&requests).Error)
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).
		Where("event_type = ?", model.AgentCreditEventRefund).Count(&logs).Error)
	assert.Equal(t, int64(1), requests)
	assert.Equal(t, int64(1), logs)
}

func TestConcurrentSameIdempotentRefundReturnsOneStableResult(t *testing.T) {
	fixture := setupAgentRefundTest(t)
	input := AgentRefundInput{
		AgentUserID: fixture.agentID, RedemptionIDs: []int{fixture.codes[0].Id},
		IdempotencyKey: "concurrent-same-refund", RequestedBy: fixture.agentID,
	}
	start := make(chan struct{})
	results := make([]*AgentRefundResult, 2)
	errorsByRequest := make([]error, 2)
	var wait sync.WaitGroup
	for index := range results {
		wait.Add(1)
		go func(index int) {
			defer wait.Done()
			<-start
			results[index], errorsByRequest[index] = RefundAgentCodes(input)
		}(index)
	}
	close(start)
	wait.Wait()

	require.NoError(t, errorsByRequest[0])
	require.NoError(t, errorsByRequest[1])
	assert.Equal(t, results[0], results[1])
	var requests, logs int64
	require.NoError(t, model.DB.Model(&model.AgentRefundRequest{}).Count(&requests).Error)
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).
		Where("event_type = ?", model.AgentCreditEventRefund).Count(&logs).Error)
	assert.Equal(t, int64(1), requests)
	assert.Equal(t, int64(1), logs)
}
