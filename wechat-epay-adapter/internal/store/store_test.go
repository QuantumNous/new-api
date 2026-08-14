package store

import (
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/utils/tests"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, Migrate(db))
	return New(db)
}

func testOrder(id string) PaymentOrder {
	return PaymentOrder{
		ID:                 id,
		OutTradeNo:         "USR1NO" + id,
		GatewayTradeNo:     "GATEWAY" + id,
		RequestFingerprint: "fingerprint-" + id,
		EpayPID:            "10001",
		PaymentType:        "wxpay",
		Subject:            "TUC100",
		AmountText:         "1.00",
		AmountFen:          100,
		NotifyURL:          "https://api.example.com/api/user/epay/notify",
		CashierTokenHash:   "token-" + id,
		Status:             order.StatusCreating,
		ExpiresAt:          time.Now().Add(15 * time.Minute),
		Version:            1,
	}
}

func TestMigrateCreatesRequiredIndexes(t *testing.T) {
	store := newTestStore(t)
	migrator := store.DB().Migrator()
	assert.True(t, migrator.HasIndex(&PaymentOrder{}, "idx_payment_orders_status_expires_at"))
	assert.True(t, migrator.HasIndex(&PaymentOrder{}, "idx_payment_orders_status_updated_at"))
	assert.True(t, migrator.HasIndex(&NotificationTask{}, "idx_notification_tasks_state_next_attempt_at"))
	assert.True(t, migrator.HasIndex(&NotificationTask{}, "idx_notification_tasks_state_lease_until"))
}

func TestPaymentOrderUniqueFieldsRejectDuplicates(t *testing.T) {
	store := newTestStore(t)
	first := testOrder("one")
	require.NoError(t, store.DB().Create(&first).Error)

	duplicate := testOrder("two")
	duplicate.OutTradeNo = first.OutTradeNo
	err := store.DB().Create(&duplicate).Error
	require.Error(t, err)

	var count int64
	require.NoError(t, store.DB().Model(&PaymentOrder{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestTransactionRollsBackAllPaymentWrites(t *testing.T) {
	store := newTestStore(t)
	err := store.Transaction(func(tx *Store) error {
		payment := testOrder("rollback")
		if err := tx.DB().Create(&payment).Error; err != nil {
			return err
		}
		return errors.New("force rollback")
	})
	require.EqualError(t, err, "force rollback")

	var count int64
	require.NoError(t, store.DB().Model(&PaymentOrder{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestLockForUpdateSkipsSQLiteAndLocksSupportedDialects(t *testing.T) {
	sqliteDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{DryRun: true})
	require.NoError(t, err)
	assert.Empty(t, lockForUpdate(sqliteDB).Statement.Clauses["FOR"])

	dummyDB, err := gorm.Open(tests.DummyDialector{}, &gorm.Config{DryRun: true})
	require.NoError(t, err)
	statement := lockForUpdate(dummyDB).Where("id = ?", "order-1").Find(&PaymentOrder{}).Statement
	assert.Contains(t, statement.SQL.String(), "FOR UPDATE")
}
