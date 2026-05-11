package controller

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v81"
	"gorm.io/gorm"
)

func setupStripeTopUpTestDB(t *testing.T) {
	t.Helper()

	oldDB := model.DB
	oldLogDB := model.LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingMySQL := common.UsingMySQL
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldRedisEnabled := common.RedisEnabled

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Log{},
		&model.TopUp{},
		&model.SubscriptionPlan{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
	))

	t.Cleanup(func() {
		model.DB = oldDB
		model.LOG_DB = oldLogDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingMySQL = oldUsingMySQL
		common.UsingPostgreSQL = oldUsingPostgreSQL
		common.RedisEnabled = oldRedisEnabled
		require.NoError(t, sqlDB.Close())
	})
}

func stripeCheckoutSessionEvent(tradeNo string) stripe.Event {
	return stripe.Event{
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{
			Object: map[string]interface{}{
				"customer":            "cus_guard",
				"client_reference_id": tradeNo,
				"status":              "complete",
				"payment_status":      "paid",
			},
		},
	}
}

func TestStripeSessionCompletedReturnsErrorWhenLocalRechargeFails(t *testing.T) {
	setupStripeTopUpTestDB(t)

	tradeNo := "stripe-local-failure-guard"
	topUp := &model.TopUp{
		UserId:          10001,
		Amount:          2,
		Money:           9.99,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		CreateTime:      common.GetTimestamp(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())

	err := sessionCompleted(context.Background(), stripeCheckoutSessionEvent(tradeNo), "127.0.0.1")
	require.Error(t, err)

	reloaded := model.GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusPending, reloaded.Status)
}
