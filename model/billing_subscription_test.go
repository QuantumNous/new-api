package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestBillingSubscription_CreateAndFindByProviderSubscriptionID(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Title:                  "Pro Auto Renew",
		PriceAmount:            19.99,
		Currency:               "USD",
		DurationUnit:           SubscriptionDurationMonth,
		DurationValue:          1,
		TotalAmount:            500000,
		BillingMode:            "auto_renew",
		StripeRecurringPriceId: "price_recurring_pro",
		Enabled:                true,
	}
	require.NoError(t, DB.Create(plan).Error)

	sub := &BillingSubscription{
		UserId:                 101,
		PlanId:                 plan.Id,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_123",
		ProviderCustomerId:     "cus_123",
		ProviderPriceId:        "price_recurring_pro",
		Status:                 "active",
		CurrentPeriodStart:     1761955200,
		CurrentPeriodEnd:       1764547200,
	}
	require.NoError(t, DB.Create(sub).Error)

	got, err := GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_123")
	require.NoError(t, err)
	require.Equal(t, sub.UserId, got.UserId)
	require.Equal(t, "active", got.Status)
}

func TestHasNonEndedAutoRenewContract_ReturnsTrueForCancelAtPeriodEndCurrentCycle(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&BillingSubscription{
		UserId:                 200,
		PlanId:                 1,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_guard_1",
		Status:                 "active",
		CancelAtPeriodEnd:      true,
		CurrentPeriodEnd:       common.GetTimestamp() + 3600,
	}).Error)

	ok, err := HasNonEndedAutoRenewContract(200)
	require.NoError(t, err)
	require.True(t, ok)
}

func TestCreateRecurringCycleSubscriptionFromInvoice_IsIdempotent(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Title:                  "Recurring Invoice Plan",
		PriceAmount:            19.99,
		Currency:               "USD",
		DurationUnit:           SubscriptionDurationMonth,
		DurationValue:          1,
		TotalAmount:            500000,
		BillingMode:            SubscriptionBillingModeAutoRenew,
		StripeRecurringPriceId: "price_recurring_invoice",
		Enabled:                true,
	}
	require.NoError(t, DB.Create(plan).Error)

	contract := &BillingSubscription{
		UserId:                 501,
		PlanId:                 plan.Id,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_cycle_1",
		Status:                 "active",
	}
	require.NoError(t, DB.Create(contract).Error)

	require.NoError(t, CreateRecurringCycleSubscriptionFromInvoice(contract.Id, "in_123", 1761955200, 1764547200))
	require.NoError(t, CreateRecurringCycleSubscriptionFromInvoice(contract.Id, "in_123", 1761955200, 1764547200))

	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("provider_invoice_id = ?", "in_123").Count(&count).Error)
	require.Equal(t, int64(1), count)
}

func TestFulfillRecurringInvoice_CreatesOnePaidAttemptAndSubscription(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&RecurringChargeAttempt{}))
	truncateTables(t)

	plan := &SubscriptionPlan{
		Title:                  "Recurring Attempt Plan",
		PriceAmount:            19.99,
		Currency:               "USD",
		DurationUnit:           SubscriptionDurationMonth,
		DurationValue:          1,
		TotalAmount:            500000,
		BillingMode:            SubscriptionBillingModeAutoRenew,
		StripeRecurringPriceId: "price_recurring_attempt",
		Enabled:                true,
	}
	require.NoError(t, DB.Create(plan).Error)

	contract := &BillingSubscription{
		UserId:                 601,
		PlanId:                 plan.Id,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_attempt_1",
		Status:                 "active",
	}
	require.NoError(t, DB.Create(contract).Error)

	input := &RecurringChargeAttempt{
		BillingSubscriptionId: contract.Id,
		Provider:              "stripe",
		ProviderInvoiceId:     "in_attempt_1",
		PeriodStart:           1761955200,
		PeriodEnd:             1764547200,
		Amount:                1999,
		Currency:              "usd",
		ProviderPayload:       `{"status":"paid"}`,
	}
	require.NoError(t, FulfillRecurringInvoice(input))
	require.NoError(t, FulfillRecurringInvoice(input))

	var attempts []RecurringChargeAttempt
	require.NoError(t, DB.Where("provider = ? AND provider_invoice_id = ?", "stripe", "in_attempt_1").Find(&attempts).Error)
	require.Len(t, attempts, 1)
	require.Equal(t, "paid", attempts[0].Status)

	var subscriptions []UserSubscription
	require.NoError(t, DB.Where("billing_subscription_id = ? AND provider_invoice_id = ?", contract.Id, "in_attempt_1").Find(&subscriptions).Error)
	require.Len(t, subscriptions, 1)
}

func TestCreatePendingStripeAutoRenewSignup_BlocksSecondAttempt(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&BillingSubscription{}))
	truncateTables(t)
	require.NoError(t, DB.Create(&User{
		Id:       701,
		Username: "pending-signup-user",
		Status:   common.UserStatusEnabled,
	}).Error)

	first, err := CreatePendingStripeAutoRenewSignup(701, 801, "signup_ref_1")
	require.NoError(t, err)
	require.Equal(t, "pending_signup", first.Status)
	require.Equal(t, "signup_ref_1", first.SignupReference)

	_, err = CreatePendingStripeAutoRenewSignup(701, 802, "signup_ref_2")
	require.Error(t, err)
}

func TestRecurringExternalIDsHaveDatabaseUniqueConstraints(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&BillingSubscription{}, &UserSubscription{}))
	truncateTables(t)

	require.NoError(t, DB.Create(&BillingSubscription{UserId: 901, PlanId: 1, Provider: "stripe", ProviderSubscriptionId: "sub_unique_1", SignupReference: "signup_unique_1", Status: "active"}).Error)
	require.Error(t, DB.Create(&BillingSubscription{UserId: 902, PlanId: 1, Provider: "stripe", ProviderSubscriptionId: "sub_unique_1", SignupReference: "signup_unique_2", Status: "active"}).Error)
	require.Error(t, DB.Create(&BillingSubscription{UserId: 903, PlanId: 1, Provider: "stripe", ProviderSubscriptionId: "sub_unique_3", SignupReference: "signup_unique_1", Status: "active"}).Error)

	require.NoError(t, DB.Create(&UserSubscription{UserId: 901, PlanId: 1, ProviderInvoiceId: "in_unique_1"}).Error)
	require.Error(t, DB.Create(&UserSubscription{UserId: 902, PlanId: 1, ProviderInvoiceId: "in_unique_1"}).Error)
}
