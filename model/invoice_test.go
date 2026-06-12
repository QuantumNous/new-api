package model

import (
	"errors"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInvoiceTestDB(t *testing.T) {
	t.Helper()

	originalDB := DB
	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)

	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	require.NoError(t, db.AutoMigrate(&UserInvoiceProfile{}, &PaymentInvoice{}))
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		require.NoError(t, sqlDB.Close())
	})
}

func createPaymentInvoiceForTest(t *testing.T, tradeNo string) {
	t.Helper()

	require.NoError(t, CreatePaymentInvoiceSnapshot(&PaymentInvoice{
		TradeNo:         tradeNo,
		UserId:          1001,
		OrderType:       PaymentOrderTypeTopUp,
		PaymentProvider: "stripe",
		InvoiceProfileFields: InvoiceProfileFields{
			CompanyName:  "Acme",
			BillingEmail: "billing@example.com",
		},
	}))
}

func TestSaveUserInvoiceProfileInsertAndUpdatePreservesIdentity(t *testing.T) {
	setupInvoiceTestDB(t)

	profile := &UserInvoiceProfile{
		UserId: 42,
		InvoiceProfileFields: InvoiceProfileFields{
			CompanyName:  "  Acme Inc  ",
			BillingEmail: " billing@example.com ",
		},
	}
	require.NoError(t, SaveUserInvoiceProfile(profile))
	require.NotZero(t, profile.Id)
	require.NotZero(t, profile.CreatedAt)

	insertedId := profile.Id
	insertedCreatedAt := profile.CreatedAt

	updatedProfile := &UserInvoiceProfile{
		Id:        insertedId + 1000,
		UserId:    42,
		CreatedAt: insertedCreatedAt + 1000,
		InvoiceProfileFields: InvoiceProfileFields{
			CompanyName:  "  Updated Acme  ",
			BillingEmail: " updated@example.com ",
			Country:      " US ",
		},
	}
	require.NoError(t, SaveUserInvoiceProfile(updatedProfile))

	var profiles []UserInvoiceProfile
	require.NoError(t, DB.Where("user_id = ?", 42).Find(&profiles).Error)
	require.Len(t, profiles, 1)
	require.Equal(t, insertedId, profiles[0].Id)
	require.Equal(t, insertedCreatedAt, profiles[0].CreatedAt)
	require.Equal(t, "Updated Acme", profiles[0].CompanyName)
	require.Equal(t, "updated@example.com", profiles[0].BillingEmail)
	require.Equal(t, "US", profiles[0].Country)
}

func TestUpdatePaymentInvoiceStatusReturnsNotFoundWhenNoRowsAffected(t *testing.T) {
	setupInvoiceTestDB(t)

	err := UpdatePaymentInvoiceStatus("missing-trade-no", PaymentInvoiceStatusPaid)

	require.True(t, errors.Is(err, ErrPaymentInvoiceNotFound))
}

func TestUpdatePaymentInvoiceStripeSessionReturnsNotFoundWhenNoRowsAffected(t *testing.T) {
	setupInvoiceTestDB(t)

	err := UpdatePaymentInvoiceStripeSession("missing-trade-no", "cus_missing", "cs_missing")

	require.True(t, errors.Is(err, ErrPaymentInvoiceNotFound))
}

func TestUpdatePaymentInvoiceStripeInvoiceReturnsNotFoundWhenNoRowsAffected(t *testing.T) {
	setupInvoiceTestDB(t)

	err := UpdatePaymentInvoiceStripeInvoice("missing-trade-no", StripeInvoiceUpdate{
		StripeInvoiceId: "in_missing",
		InvoiceStatus:   PaymentInvoiceStatusPaid,
	})

	require.True(t, errors.Is(err, ErrPaymentInvoiceNotFound))
}

func TestUpdatePaymentInvoiceProfileReturnsNotFoundWhenNoRowsAffected(t *testing.T) {
	setupInvoiceTestDB(t)

	err := UpdatePaymentInvoiceProfile("missing-trade-no", InvoiceProfileFields{
		CompanyName: "Acme",
	}, PaymentInvoiceStatusPending)

	require.True(t, errors.Is(err, ErrPaymentInvoiceNotFound))
}

func TestUpdatePaymentInvoiceProfileUpdatesExistingInvoice(t *testing.T) {
	setupInvoiceTestDB(t)
	createPaymentInvoiceForTest(t, "trade-profile-update")

	require.NoError(t, UpdatePaymentInvoiceProfile("trade-profile-update", InvoiceProfileFields{
		CompanyName:  " Updated Co ",
		BillingEmail: " updated@example.com ",
		Country:      " US ",
		AddressLine1: " 1 Main St ",
	}, PaymentInvoiceStatusPending))

	invoice, err := GetPaymentInvoiceByTradeNo("trade-profile-update")
	require.NoError(t, err)
	require.True(t, invoice.InvoiceRequested)
	require.Equal(t, "Updated Co", invoice.CompanyName)
	require.Equal(t, "updated@example.com", invoice.BillingEmail)
	require.Equal(t, "US", invoice.Country)
	require.Equal(t, "1 Main St", invoice.AddressLine1)
	require.Equal(t, PaymentInvoiceStatusPending, invoice.InvoiceStatus)
}

func TestUpdatePaymentInvoiceStripeInvoiceUpdatesExistingInvoice(t *testing.T) {
	setupInvoiceTestDB(t)
	createPaymentInvoiceForTest(t, "trade-update")

	require.NoError(t, UpdatePaymentInvoiceStripeInvoice("trade-update", StripeInvoiceUpdate{
		StripeCustomerId:        " cus_123 ",
		StripeCheckoutSessionId: " cs_123 ",
		StripeInvoiceId:         " in_123 ",
		StripeInvoiceNumber:     " INV-123 ",
		StripeInvoiceUrl:        " https://example.com/invoice ",
		StripeInvoicePdf:        " https://example.com/invoice.pdf ",
		InvoiceStatus:           " paid ",
	}))

	invoice, err := GetPaymentInvoiceByTradeNo("trade-update")
	require.NoError(t, err)
	require.Equal(t, "cus_123", invoice.StripeCustomerId)
	require.Equal(t, "cs_123", invoice.StripeCheckoutSessionId)
	require.Equal(t, "in_123", invoice.StripeInvoiceId)
	require.Equal(t, "INV-123", invoice.StripeInvoiceNumber)
	require.Equal(t, "https://example.com/invoice", invoice.StripeInvoiceUrl)
	require.Equal(t, "https://example.com/invoice.pdf", invoice.StripeInvoicePdf)
	require.Equal(t, PaymentInvoiceStatusPaid, invoice.InvoiceStatus)
}
