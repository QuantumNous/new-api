package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminDeleteSubscriptionPlanRemovesUnusedPlan(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Id:            9301,
		Title:         "Starter",
		PriceAmount:   5,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   100,
	}
	require.NoError(t, DB.Create(plan).Error)

	require.NoError(t, AdminDeleteSubscriptionPlan(plan.Id))

	var count int64
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Count(&count).Error)
	assert.Equal(t, int64(0), count)
}

func TestAdminDeleteSubscriptionPlanKeepsPlanWithExistingSubscriptions(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:            9302,
		Title:         "Pro",
		PriceAmount:   10,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   1000,
	}
	require.NoError(t, DB.Create(plan).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		Id:          9312,
		UserId:      771,
		PlanId:      plan.Id,
		AmountTotal: 1000,
		StartTime:   now - 100,
		EndTime:     now + 1000,
		Status:      "active",
	}).Error)

	err := AdminDeleteSubscriptionPlan(plan.Id)

	require.Error(t, err)
	var count int64
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestAdminDeleteSubscriptionPlanRejectsInvalidId(t *testing.T) {
	assert.Error(t, AdminDeleteSubscriptionPlan(0))
}
