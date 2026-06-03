package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIncreaseUserQuotaWithSourceCreditsPaidLedger(t *testing.T) {
	truncateTables(t)

	user := User{Username: "quota_source_credit", Quota: 10, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)

	require.NoError(t, IncreaseUserQuotaWithSource(user.Id, 250, QuotaSourcePaid, "topup", "topup-paid-1", "req-paid-1", "stripe topup"))

	var reloaded User
	require.NoError(t, DB.Select("quota").Where("id = ?", user.Id).First(&reloaded).Error)
	assert.Equal(t, 260, reloaded.Quota)
	assert.EqualValues(t, 250, quotaSourceBalanceForTest(t, user.Id, QuotaSourcePaid))

	var event UserQuotaSourceEvent
	require.NoError(t, DB.Where("user_id = ? AND source = ? AND event_type = ?", user.Id, QuotaSourcePaid, QuotaSourceEventCredit).First(&event).Error)
	assert.EqualValues(t, 250, event.Amount)
	assert.EqualValues(t, 250, event.BalanceAfter)
	assert.Equal(t, "topup", event.RelatedType)
	assert.Equal(t, "topup-paid-1", event.RelatedId)
	assert.Equal(t, "req-paid-1", event.RequestId)
}

func TestQuotaSourceLedgerConsumesUntrackedBeforePaid(t *testing.T) {
	truncateTables(t)

	user := User{Username: "quota_source_consume", Quota: 450, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, CreditUserQuotaSource(user.Id, QuotaSourcePaid, 200, "test", "paid-only", "", "paid source only"))

	segments, err := DecreaseUserQuotaWithSource(user.Id, 300, "relay_request", "req-consume-1", "req-consume-1", "wallet pre-consume")
	require.NoError(t, err)

	breakdown := SumQuotaSourceSegments(segments)
	assert.EqualValues(t, 250, breakdown.LegacyUnknown)
	assert.EqualValues(t, 50, breakdown.Paid)
	assert.EqualValues(t, 300, breakdown.Total)
	assert.EqualValues(t, 150, quotaSourceBalanceForTest(t, user.Id, QuotaSourcePaid))

	var reloaded User
	require.NoError(t, DB.Select("quota").Where("id = ?", user.Id).First(&reloaded).Error)
	assert.Equal(t, 150, reloaded.Quota)
}

func TestQuotaSourceLedgerRefundRestoresOriginalSources(t *testing.T) {
	truncateTables(t)

	user := User{Username: "quota_source_refund", Quota: 0, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, IncreaseUserQuotaWithSource(user.Id, 100, QuotaSourceGift, "test", "gift", "", "gift credit"))
	require.NoError(t, IncreaseUserQuotaWithSource(user.Id, 100, QuotaSourcePaid, "test", "paid", "", "paid credit"))

	segments, err := DecreaseUserQuotaWithSource(user.Id, 150, "relay_request", "req-refund-1", "req-refund-1", "wallet pre-consume")
	require.NoError(t, err)
	require.NoError(t, IncreaseUserQuotaFromSourceSegments(user.Id, segments, "relay_request", "req-refund-1", "req-refund-1", "wallet refund"))

	assert.EqualValues(t, 100, quotaSourceBalanceForTest(t, user.Id, QuotaSourceGift))
	assert.EqualValues(t, 100, quotaSourceBalanceForTest(t, user.Id, QuotaSourcePaid))

	var reloaded User
	require.NoError(t, DB.Select("quota").Where("id = ?", user.Id).First(&reloaded).Error)
	assert.Equal(t, 200, reloaded.Quota)
}

func TestManualCompleteTopUpCreditsPaidSourceLedger(t *testing.T) {
	truncateTables(t)

	quotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 100
	t.Cleanup(func() {
		common.QuotaPerUnit = quotaPerUnit
	})

	user := User{Username: "quota_source_topup", Quota: 0, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	topUp := TopUp{
		UserId:          user.Id,
		Amount:          3,
		Money:           3,
		TradeNo:         "manual-paid-ledger",
		PaymentMethod:   "manual",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, DB.Create(&topUp).Error)

	require.NoError(t, ManualCompleteTopUp(topUp.TradeNo, "127.0.0.1"))

	var reloaded User
	require.NoError(t, DB.Select("quota").Where("id = ?", user.Id).First(&reloaded).Error)
	assert.Equal(t, 300, reloaded.Quota)
	assert.EqualValues(t, 300, quotaSourceBalanceForTest(t, user.Id, QuotaSourcePaid))

	var event UserQuotaSourceEvent
	require.NoError(t, DB.Where("user_id = ? AND source = ? AND event_type = ?", user.Id, QuotaSourcePaid, QuotaSourceEventCredit).First(&event).Error)
	assert.EqualValues(t, 300, event.Amount)
	assert.Equal(t, "topup", event.RelatedType)
	assert.Equal(t, topUp.TradeNo, event.RelatedId)
	assert.Equal(t, topUp.TradeNo, event.RequestId)
}

func quotaSourceBalanceForTest(t *testing.T, userId int, source string) int64 {
	t.Helper()
	var balance UserQuotaSourceBalance
	require.NoError(t, DB.Where("user_id = ? AND source = ?", userId, source).First(&balance).Error)
	return balance.Balance
}
