package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMigrateSubscriptionPlanCurrencyToCNY(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Title:         "Legacy USD Plan",
		PriceAmount:   10,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationDay,
		DurationValue: 1,
		Enabled:       true,
	}
	require.NoError(t, DB.Create(plan).Error)

	require.NoError(t, migrateSubscriptionPlanCurrencyToCNY())

	var updated SubscriptionPlan
	require.NoError(t, DB.First(&updated, plan.Id).Error)
	require.Equal(t, SubscriptionCurrencyCNY, updated.Currency)
	require.Equal(t, float64(10), updated.PriceAmount)
}
