package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAgentModels(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(
		&AgentAccount{},
		&AgentCreditLog{},
		&AgentPlanOffer{},
		&AgentPurchaseOrder{},
		&AgentRefundRequest{},
		&Redemption{},
	))
	assert.True(t, DB.Migrator().HasIndex(&AgentCreditLog{}, "idx_agent_credit_log_agent_user_id_id"))

	entities := []interface{}{
		&AgentPurchaseOrder{},
		&AgentPlanOffer{},
		&AgentAccount{},
		&Redemption{},
	}
	for _, entity := range entities {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(entity).Error)
	}
	require.NoError(t, DB.Exec("DELETE FROM agent_refund_requests").Error)
	require.NoError(t, DB.Exec("DELETE FROM agent_credit_logs").Error)
	t.Cleanup(func() {
		for _, entity := range entities {
			require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(entity).Error)
		}
		require.NoError(t, DB.Exec("DELETE FROM agent_refund_requests").Error)
		require.NoError(t, DB.Exec("DELETE FROM agent_credit_logs").Error)
	})

	account := AgentAccount{UserId: 101, Status: AgentAccountStatusActive, Balance: 10000, DailyCodeLimit: 200}
	require.NoError(t, DB.Create(&account).Error)
	assert.Error(t, DB.Create(&AgentAccount{UserId: account.UserId, Status: AgentAccountStatusActive}).Error)

	log := AgentCreditLog{
		AgentUserId:   account.UserId,
		Delta:         10000,
		BalanceBefore: 0,
		BalanceAfter:  10000,
		EventType:     AgentCreditEventAdminCredit,
		BusinessKey:   "credit-101",
	}
	require.NoError(t, DB.Create(&log).Error)
	assert.Error(t, DB.Create(&AgentCreditLog{EventType: log.EventType, BusinessKey: log.BusinessKey}).Error)

	offer := AgentPlanOffer{PlanId: 201, Enabled: true, UnitPrice: 6000, CodeValidDays: 365, RefundFeeBps: 500}
	require.NoError(t, DB.Create(&offer).Error)
	assert.Error(t, DB.Create(&AgentPlanOffer{PlanId: offer.PlanId}).Error)

	order := AgentPurchaseOrder{
		OrderNo:             "AG202607200001",
		AgentUserId:         account.UserId,
		PlanId:              offer.PlanId,
		PlanTitle:           "Starter",
		Quantity:            1,
		UnitPrice:           offer.UnitPrice,
		TotalPrice:          offer.UnitPrice,
		CodeValidDays:       offer.CodeValidDays,
		RefundFeeBps:        offer.RefundFeeBps,
		EntitlementSnapshot: "{\"version\":1}",
		IdempotencyKey:      "purchase-101",
		Status:              AgentPurchaseOrderStatusCompleted,
	}
	require.NoError(t, DB.Create(&order).Error)
	assert.Error(t, DB.Create(&AgentPurchaseOrder{OrderNo: order.OrderNo, AgentUserId: 102, IdempotencyKey: "purchase-102"}).Error)
	assert.Error(t, DB.Create(&AgentPurchaseOrder{OrderNo: "AG202607200002", AgentUserId: order.AgentUserId, IdempotencyKey: order.IdempotencyKey}).Error)

	refund := AgentRefundRequest{
		AgentUserId:           account.UserId,
		IdempotencyKey:        "refund-101",
		RequestHash:           "request-hash-101",
		RedemptionIDsSnapshot: "[1]",
		FeeTotal:              300,
		RefundTotal:           5700,
		BalanceAfter:          15700,
	}
	require.NoError(t, DB.Create(&refund).Error)
	assert.Error(t, DB.Create(&AgentRefundRequest{AgentUserId: refund.AgentUserId, IdempotencyKey: refund.IdempotencyKey}).Error)

	legacy := Redemption{Key: "00000000000000000000000000000001", Status: common.RedemptionCodeStatusEnabled}
	require.NoError(t, DB.Create(&legacy).Error)
	var loaded Redemption
	require.NoError(t, DB.First(&loaded, legacy.Id).Error)
	assert.Equal(t, common.RedemptionCodeTypeQuota, loaded.Type)
}

func TestAgentCreditLogIsImmutable(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&AgentCreditLog{}))
	require.NoError(t, DB.Exec("DELETE FROM agent_credit_logs").Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Exec("DELETE FROM agent_credit_logs").Error)
	})

	log := AgentCreditLog{
		AgentUserId:   101,
		Delta:         100,
		BalanceBefore: 0,
		BalanceAfter:  100,
		EventType:     AgentCreditEventAdminCredit,
		BusinessKey:   "immutable-credit-log",
	}
	require.NoError(t, DB.Create(&log).Error)

	err := DB.Model(&log).Update("remark", "changed").Error
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrAgentCreditLogImmutable)

	err = DB.Delete(&log).Error
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrAgentCreditLogImmutable)
}

func TestAgentRefundRequestIsImmutable(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&AgentRefundRequest{}))
	require.NoError(t, DB.Exec("DELETE FROM agent_refund_requests").Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Exec("DELETE FROM agent_refund_requests").Error)
	})

	request := AgentRefundRequest{
		AgentUserId: 101, IdempotencyKey: "immutable-refund-request",
		RequestHash: "hash", RedemptionIDsSnapshot: "[1]",
		FeeTotal: 300, RefundTotal: 5700, BalanceAfter: 5700,
	}
	require.NoError(t, DB.Create(&request).Error)

	err := DB.Model(&request).Update("refund_total", int64(1)).Error
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrAgentRefundRequestImmutable)

	err = DB.Delete(&request).Error
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrAgentRefundRequestImmutable)
}

func TestAgentMoneyFieldsAreNotSerialized(t *testing.T) {
	tests := []struct {
		name   string
		value  interface{}
		fields []string
	}{
		{
			name:   "account balance",
			value:  AgentAccount{Balance: 100},
			fields: []string{"\"balance\""},
		},
		{
			name:   "credit log amounts",
			value:  AgentCreditLog{Delta: 100, BalanceBefore: 200, BalanceAfter: 300},
			fields: []string{"\"delta\"", "\"balance_before\"", "\"balance_after\""},
		},
		{
			name:   "offer price",
			value:  AgentPlanOffer{UnitPrice: 100},
			fields: []string{"\"unit_price\""},
		},
		{
			name:   "purchase order amounts",
			value:  AgentPurchaseOrder{UnitPrice: 100, TotalPrice: 200, RefundedAmount: 300},
			fields: []string{"\"unit_price\"", "\"total_price\"", "\"refunded_amount\""},
		},
		{
			name:   "refund request amounts",
			value:  AgentRefundRequest{FeeTotal: 100, RefundTotal: 200, BalanceAfter: 300},
			fields: []string{"\"fee_total\"", "\"refund_total\"", "\"balance_after\""},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw, err := common.Marshal(tt.value)
			require.NoError(t, err)
			for _, field := range tt.fields {
				assert.NotContains(t, string(raw), field)
			}
		})
	}
}

func TestAgentModelDefaultsAreNormalizedInCode(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&AgentAccount{}, &AgentPlanOffer{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&AgentPlanOffer{}).Error)
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&AgentAccount{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&AgentPlanOffer{}).Error)
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&AgentAccount{}).Error)
	})

	account := AgentAccount{UserId: 301, Status: AgentAccountStatusActive}
	require.NoError(t, DB.Create(&account).Error)
	assert.Equal(t, DefaultAgentDailyCodeLimit, account.DailyCodeLimit)
	var storedAccount AgentAccount
	require.NoError(t, DB.First(&storedAccount, account.Id).Error)
	assert.Equal(t, DefaultAgentDailyCodeLimit, storedAccount.DailyCodeLimit)

	offer := AgentPlanOffer{PlanId: 401, Enabled: true}
	require.NoError(t, DB.Create(&offer).Error)
	assert.Equal(t, DefaultAgentCodeValidDays, offer.CodeValidDays)
	var storedOffer AgentPlanOffer
	require.NoError(t, DB.First(&storedOffer, offer.Id).Error)
	assert.Equal(t, DefaultAgentCodeValidDays, storedOffer.CodeValidDays)
}
