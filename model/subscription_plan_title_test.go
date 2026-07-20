package model

import (
	"fmt"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionPlanTitleTestDB(t *testing.T) {
	t.Helper()
	oldDB := DB
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&SubscriptionPlan{}, &UserSubscription{}, &SubscriptionPreConsumeRecord{}))
	DB = db
	t.Cleanup(func() {
		DB = oldDB
	})
}

func TestPreConsumeUserSubscriptionByPlanTitleUsesMatchingPlan(t *testing.T) {
	setupSubscriptionPlanTitleTestDB(t)

	trialPlan := &SubscriptionPlan{Id: 1101, Title: "APIMaster $50 GPT Trial", TotalAmount: 100}
	paidPlan := &SubscriptionPlan{Id: 1102, Title: "Regular Paid Plan", TotalAmount: 100}
	require.NoError(t, DB.Create(trialPlan).Error)
	require.NoError(t, DB.Create(paidPlan).Error)

	require.NoError(t, DB.Create(&UserSubscription{
		Id:          2101,
		UserId:      301,
		PlanId:      paidPlan.Id,
		AmountTotal: 100,
		AmountUsed:  0,
		StartTime:   1,
		EndTime:     4102444800,
		Status:      "active",
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		Id:          2102,
		UserId:      301,
		PlanId:      trialPlan.Id,
		AmountTotal: 80,
		AmountUsed:  0,
		StartTime:   1,
		EndTime:     4102444800,
		Status:      "active",
	}).Error)

	res, err := PreConsumeUserSubscriptionByPlanTitle("req-trial-1", 301, "gpt-5", 0, 20, "APIMaster $50 GPT Trial")
	require.NoError(t, err)
	require.Equal(t, 2102, res.UserSubscriptionId)
	require.EqualValues(t, 20, res.PreConsumed)

	var paidSub UserSubscription
	var trialSub UserSubscription
	require.NoError(t, DB.First(&paidSub, 2101).Error)
	require.NoError(t, DB.First(&trialSub, 2102).Error)
	require.EqualValues(t, 0, paidSub.AmountUsed)
	require.EqualValues(t, 20, trialSub.AmountUsed)
}

func TestPreConsumeUserSubscriptionByPlanTitleRejectsMissingPlan(t *testing.T) {
	setupSubscriptionPlanTitleTestDB(t)

	paidPlan := &SubscriptionPlan{Id: 1201, Title: "Regular Paid Plan", TotalAmount: 100}
	require.NoError(t, DB.Create(paidPlan).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		Id:          2201,
		UserId:      302,
		PlanId:      paidPlan.Id,
		AmountTotal: 100,
		AmountUsed:  0,
		StartTime:   1,
		EndTime:     4102444800,
		Status:      "active",
	}).Error)

	_, err := PreConsumeUserSubscriptionByPlanTitle("req-trial-2", 302, "gpt-5", 0, 20, "APIMaster $50 GPT Trial")
	require.Error(t, err)
	require.Contains(t, err.Error(), "no active subscription")
}
