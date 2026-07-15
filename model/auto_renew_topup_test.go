package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupAutoRenewTopUpTestDB(t *testing.T) {
	t.Helper()
	prevDB, prevLog := DB, LOG_DB
	t.Cleanup(func() {
		DB, LOG_DB = prevDB, prevLog
	})
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	dsn := filepath.Join(t.TempDir(), "auto_renew_topup.db")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&TopUp{}, &BillingSubscription{}, &SubscriptionPlan{}, &UserSubscription{}, &RecurringChargeAttempt{}))
	DB = db
	LOG_DB = db
}

func TestEnsurePendingAutoRenewTopUp_CreatesPendingBill(t *testing.T) {
	setupAutoRenewTopUpTestDB(t)

	snapshot := PaymentSnapshot{
		DisplayAmount: 19.99, DisplayCurrency: "USD",
		SettlementAmount: 19.99, SettlementCurrency: "USD", ExchangeRateSnapshot: 1,
	}
	require.NoError(t, EnsurePendingAutoRenewTopUp(7, "sub-signup-abc", 19.99, snapshot, PaymentMethodStripe, PaymentProviderStripe))

	top := GetTopUpByTradeNo("sub-signup-abc")
	require.NotNil(t, top)
	require.Equal(t, 7, top.UserId)
	require.Equal(t, common.TopUpStatusPending, top.Status)
	require.Equal(t, 19.99, top.Money)
	require.Equal(t, PaymentMethodStripe, top.PaymentMethod)

	// Reuse same trade no keeps one pending row.
	require.NoError(t, EnsurePendingAutoRenewTopUp(7, "sub-signup-abc", 19.99, snapshot, PaymentMethodStripe, PaymentProviderStripe))
	var n int64
	require.NoError(t, DB.Model(&TopUp{}).Where("trade_no = ?", "sub-signup-abc").Count(&n).Error)
	require.EqualValues(t, 1, n)

	require.NoError(t, CompletePendingAutoRenewTopUp("sub-signup-abc"))
	top = GetTopUpByTradeNo("sub-signup-abc")
	require.Equal(t, common.TopUpStatusSuccess, top.Status)
	require.Greater(t, top.CompleteTime, int64(0))
}

func TestExpirePendingAutoRenewTopUp_OnlyPending(t *testing.T) {
	setupAutoRenewTopUpTestDB(t)
	snapshot := PaymentSnapshot{DisplayAmount: 9, DisplayCurrency: "USD", SettlementAmount: 9, SettlementCurrency: "USD", ExchangeRateSnapshot: 1}
	require.NoError(t, EnsurePendingAutoRenewTopUp(1, "sub-signup-exp", 9, snapshot, PaymentMethodStripe, PaymentProviderStripe))
	require.NoError(t, ExpirePendingAutoRenewTopUp("sub-signup-exp"))
	top := GetTopUpByTradeNo("sub-signup-exp")
	require.Equal(t, common.TopUpStatusExpired, top.Status)
}
