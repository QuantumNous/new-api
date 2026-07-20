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

func TestPreConsumeUserSubscriptionExcludingPlanTitleSkipsTrialPlan(t *testing.T) {
	setupSubscriptionPlanTitleTestDB(t)

	trialPlan := &SubscriptionPlan{Id: 1301, Title: "APIMaster $50 GPT Trial", TotalAmount: 100}
	paidPlan := &SubscriptionPlan{Id: 1302, Title: "Regular Paid Plan", TotalAmount: 100}
	require.NoError(t, DB.Create(trialPlan).Error)
	require.NoError(t, DB.Create(paidPlan).Error)

	require.NoError(t, DB.Create(&UserSubscription{
		Id:          2301,
		UserId:      303,
		PlanId:      trialPlan.Id,
		AmountTotal: 100,
		AmountUsed:  0,
		StartTime:   1,
		EndTime:     4102444800,
		Status:      "active",
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		Id:          2302,
		UserId:      303,
		PlanId:      paidPlan.Id,
		AmountTotal: 100,
		AmountUsed:  0,
		StartTime:   1,
		EndTime:     4102444800,
		Status:      "active",
	}).Error)

	res, err := PreConsumeUserSubscriptionExcludingPlanTitle("req-paid-1", 303, "gpt-5", 0, 20, "APIMaster $50 GPT Trial")
	require.NoError(t, err)
	require.Equal(t, 2302, res.UserSubscriptionId)
	require.EqualValues(t, 20, res.PreConsumed)

	var trialSub UserSubscription
	var paidSub UserSubscription
	require.NoError(t, DB.First(&trialSub, 2301).Error)
	require.NoError(t, DB.First(&paidSub, 2302).Error)
	require.EqualValues(t, 0, trialSub.AmountUsed)
	require.EqualValues(t, 20, paidSub.AmountUsed)
}

func TestHasActiveUserSubscriptionExcludingPlanTitleIgnoresTrialOnly(t *testing.T) {
	setupSubscriptionPlanTitleTestDB(t)

	trialPlan := &SubscriptionPlan{Id: 1401, Title: "APIMaster $50 GPT Trial", TotalAmount: 100}
	require.NoError(t, DB.Create(trialPlan).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		Id:          2401,
		UserId:      304,
		PlanId:      trialPlan.Id,
		AmountTotal: 100,
		AmountUsed:  0,
		StartTime:   1,
		EndTime:     4102444800,
		Status:      "active",
	}).Error)

	hasSub, err := HasActiveUserSubscriptionExcludingPlanTitle(304, "APIMaster $50 GPT Trial")
	require.NoError(t, err)
	require.False(t, hasSub)
}

func TestGPTTrialPlanMatcherSurvivesEditableMarketingTitle(t *testing.T) {
	setupSubscriptionPlanTitleTestDB(t)

	trialPlan := &SubscriptionPlan{
		Id:          1501,
		Title:       "Summer launch credit",
		PlanType:    SubscriptionPlanTypeGPTTrial,
		TotalAmount: 100,
	}
	paidPlan := &SubscriptionPlan{Id: 1502, Title: "Paid subscription", TotalAmount: 100}
	require.NoError(t, DB.Create(trialPlan).Error)
	require.NoError(t, DB.Create(paidPlan).Error)

	require.NoError(t, DB.Create(&UserSubscription{
		Id: 2501, UserId: 305, PlanId: trialPlan.Id, AmountTotal: 100,
		StartTime: 1, EndTime: 4102444800, Status: "active",
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		Id: 2502, UserId: 305, PlanId: paidPlan.Id, AmountTotal: 100,
		StartTime: 1, EndTime: 4102444800, Status: "active",
	}).Error)

	trialResult, err := PreConsumeUserSubscriptionByPlanMatcher(
		"req-gpt-trial", 305, "gpt-5", 0, 20, IsGPTTrialSubscriptionPlan,
	)
	require.NoError(t, err)
	require.Equal(t, 2501, trialResult.UserSubscriptionId)

	paidResult, err := PreConsumeUserSubscriptionExcludingPlanMatcher(
		"req-paid-subscription", 305, "gpt-5", 0, 20, IsGPTTrialSubscriptionPlan,
	)
	require.NoError(t, err)
	require.Equal(t, 2502, paidResult.UserSubscriptionId)

	var trialSub, paidSub UserSubscription
	require.NoError(t, DB.First(&trialSub, 2501).Error)
	require.NoError(t, DB.First(&paidSub, 2502).Error)
	require.EqualValues(t, 20, trialSub.AmountUsed)
	require.EqualValues(t, 20, paidSub.AmountUsed)
}

func TestGetActiveGPTTrialPlanBackfillsCurrentCampaign(t *testing.T) {
	setupSubscriptionPlanTitleTestDB(t)

	legacyPlan := &SubscriptionPlan{
		Id: 1601, Title: "APIMaster $20 GPT Trial", TotalAmount: 100,
	}
	require.NoError(t, DB.Create(legacyPlan).Error)

	plan, err := GetActiveGPTTrialPlan()
	require.NoError(t, err)
	require.Equal(t, legacyPlan.Id, plan.Id)
	require.Equal(t, SubscriptionPlanTypeGPTTrial, plan.PlanType)

	var stored SubscriptionPlan
	require.NoError(t, DB.First(&stored, legacyPlan.Id).Error)
	require.Equal(t, SubscriptionPlanTypeGPTTrial, stored.PlanType)
}
