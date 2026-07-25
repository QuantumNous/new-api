package model

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func setupSubscriptionEntitlementTestDB(t *testing.T) {
	t.Helper()
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionContractTestDB(t)
}

func createEntitlementTestPlan(t *testing.T, id int, total int64, upgradeGroup string) SubscriptionPlan {
	t.Helper()
	plan := SubscriptionPlan{
		Id:            id,
		Title:         "Entitlement Plan",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   total,
		UpgradeGroup:  upgradeGroup,
	}
	require.NoError(t, DB.Create(&plan).Error)
	return plan
}

func createEntitlementTestUser(t *testing.T, id int, group string) {
	t.Helper()
	insertUserForSubscriptionRecurringTest(t, id)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", id).Update("group", group).Error)
}

func currentSlotPtr() *int {
	slot := 1
	return &slot
}

func grantInput(contractId int64, userId int, planId int, key string, start int64, end int64) GrantEntitlementInput {
	return GrantEntitlementInput{
		ContractId:           contractId,
		UserId:               userId,
		PlanId:               planId,
		ProviderBindingId:    9001,
		GrantKey:             key,
		PaymentMode:          SubscriptionPaymentModeStripeRecurring,
		AmountTotal:          1234,
		PeriodStart:          start,
		PeriodEnd:            end,
		EndReasonForPrevious: SubscriptionEntitlementEndReasonRenewed,
		Source:               "stripe",
	}
}

func TestGrantEntitlementInputRejectsNegativeWindowLimits(t *testing.T) {
	tests := []struct {
		name      string
		setWindow func(*GrantEntitlementInput, *int64)
		wantError string
	}{
		{
			name: "five hour window",
			setWindow: func(input *GrantEntitlementInput, value *int64) {
				input.Window5hAmount = value
			},
			wantError: "window 5h amount must be >= 0",
		},
		{
			name: "weekly window",
			setWindow: func(input *GrantEntitlementInput, value *int64) {
				input.WindowWeekAmount = value
			},
			wantError: "window week amount must be >= 0",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := grantInput(1, 1, 1, "stripe:negative-window", 100, 200)
			negative := int64(-1)
			test.setWindow(&input, &negative)

			require.EqualError(t, input.validate(), test.wantError)
		})
	}
}

func TestRotateCurrentEntitlementArchivesOldAndCreatesSingleCurrent(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9101, "plg")
	createEntitlementTestPlan(t, 9201, 111, "")
	createEntitlementTestPlan(t, 9202, 222, "")

	oldGrant := "stripe:old"
	old := UserSubscription{
		UserId:        9101,
		PlanId:        9201,
		ContractId:    9301,
		GrantKey:      &oldGrant,
		CurrentSlot:   currentSlotPtr(),
		AmountTotal:   111,
		AmountUsed:    77,
		StartTime:     100,
		EndTime:       200,
		AccessEndTime: 200,
		Status:        "active",
		Source:        "stripe",
	}
	require.NoError(t, DB.Create(&old).Error)
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                   9301,
		UserId:               9101,
		Status:               SubscriptionContractStatusActive,
		PaymentMode:          SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:        9201,
		CurrentEntitlementId: old.Id,
		CurrentPeriodStart:   100,
		CurrentPeriodEnd:     200,
	}).Error)

	result, err := RotateCurrentEntitlement(grantInput(9301, 9101, 9202, "stripe:new", 200, 300))
	require.NoError(t, err)
	require.True(t, result.Applied)
	require.NotNil(t, result.Entitlement)
	require.NotEqual(t, old.Id, result.Entitlement.Id)
	require.Equal(t, int64(1234), result.Entitlement.AmountTotal)
	require.Zero(t, result.Entitlement.AmountUsed)
	require.Equal(t, int64(300), result.Entitlement.AccessEndTime)
	require.NotNil(t, result.Entitlement.CurrentSlot)
	require.Equal(t, 1, *result.Entitlement.CurrentSlot)

	var archived UserSubscription
	require.NoError(t, DB.First(&archived, "id = ?", old.Id).Error)
	require.Nil(t, archived.CurrentSlot)
	require.Equal(t, "historical", archived.Status)
	require.Equal(t, SubscriptionEntitlementEndReasonRenewed, archived.EndReason)

	var contract UserSubscriptionContract
	require.NoError(t, DB.First(&contract, "id = ?", int64(9301)).Error)
	require.Equal(t, result.Entitlement.Id, contract.CurrentEntitlementId)
	require.Equal(t, 9202, contract.CurrentPlanId)
	require.Equal(t, int64(9001), contract.CurrentProviderBindingId)
	require.Equal(t, int64(200), contract.CurrentPeriodStart)
	require.Equal(t, int64(300), contract.CurrentPeriodEnd)
	require.Equal(t, SubscriptionContractStatusActive, contract.Status)
	require.Equal(t, SubscriptionPaymentModeStripeRecurring, contract.PaymentMode)
	require.Equal(t, SubscriptionRenewalSourceProvider, contract.RenewalSource)
	require.Equal(t, SubscriptionRenewalStatusEnabled, contract.RenewalStatus)

	var currentCount int64
	require.NoError(t, DB.Model(&UserSubscription{}).
		Where("contract_id = ? AND current_slot = ?", int64(9301), 1).
		Count(&currentCount).Error)
	require.EqualValues(t, 1, currentCount)
}

func TestSubscriptionEntitlementGrantIdempotentAndConflict(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9111, "plg")
	createEntitlementTestUser(t, 9112, "plg")
	createEntitlementTestPlan(t, 9211, 100, "")
	createEntitlementTestPlan(t, 9212, 100, "")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:          9311,
		UserId:      9111,
		Status:      SubscriptionContractStatusActive,
		PaymentMode: SubscriptionPaymentModeStripeRecurring,
	}).Error)

	input := grantInput(9311, 9111, 9211, "stripe:idempotent", 100, 200)
	first, err := RotateCurrentEntitlement(input)
	require.NoError(t, err)
	require.True(t, first.Applied)

	second, err := RotateCurrentEntitlement(input)
	require.NoError(t, err)
	require.False(t, second.Applied)
	require.Equal(t, first.Entitlement.Id, second.Entitlement.Id)

	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", first.Entitlement.Id).
		Update("access_end_time", input.PeriodEnd+100).Error)
	graceReplay, err := RotateCurrentEntitlement(input)
	require.NoError(t, err)
	require.False(t, graceReplay.Applied)
	require.Equal(t, first.Entitlement.Id, graceReplay.Entitlement.Id)

	conflict := grantInput(9311, 9111, 9212, "stripe:idempotent", 200, 300)
	_, err = RotateCurrentEntitlement(conflict)
	require.ErrorIs(t, err, ErrSubscriptionEntitlementGrantConflict)

	amountConflict := input
	amountConflict.AmountTotal = input.AmountTotal + 1
	_, err = RotateCurrentEntitlement(amountConflict)
	require.ErrorIs(t, err, ErrSubscriptionEntitlementGrantConflict)

	periodConflict := input
	periodConflict.PeriodEnd = input.PeriodEnd + 10
	_, err = RotateCurrentEntitlement(periodConflict)
	require.ErrorIs(t, err, ErrSubscriptionEntitlementGrantConflict)

	sourceConflict := input
	sourceConflict.Source = "manual"
	_, err = RotateCurrentEntitlement(sourceConflict)
	require.ErrorIs(t, err, ErrSubscriptionEntitlementGrantConflict)

	paymentModeConflict := input
	paymentModeConflict.PaymentMode = SubscriptionPaymentModeBalanceOnePeriod
	_, err = RotateCurrentEntitlement(paymentModeConflict)
	require.ErrorIs(t, err, ErrSubscriptionEntitlementGrantConflict)
}

func TestSubscriptionEntitlementGrantSnapshotMismatchConflicts(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9118, "plg")
	createEntitlementTestPlan(t, 9218, 100, "snap-a")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:          9318,
		UserId:      9118,
		Status:      SubscriptionContractStatusActive,
		PaymentMode: SubscriptionPaymentModeStripeRecurring,
	}).Error)
	window5h := int64(125)
	windowWeek := int64(900)
	group := "snap-a"
	input := grantInput(9318, 9118, 9218, "stripe:snapshot-conflict", 100, 200)
	input.Window5hAmount = &window5h
	input.WindowWeekAmount = &windowWeek
	input.UpgradeGroup = &group

	first, err := RotateCurrentEntitlement(input)
	require.NoError(t, err)
	require.True(t, first.Applied)

	windowConflict := input
	otherWindow := int64(126)
	windowConflict.Window5hAmount = &otherWindow
	_, err = RotateCurrentEntitlement(windowConflict)
	require.ErrorIs(t, err, ErrSubscriptionEntitlementGrantConflict)

	groupConflict := input
	otherGroup := "snap-b"
	groupConflict.UpgradeGroup = &otherGroup
	_, err = RotateCurrentEntitlement(groupConflict)
	require.ErrorIs(t, err, ErrSubscriptionEntitlementGrantConflict)
}

func TestSubscriptionEntitlementGrantEmptyUpgradeGroupReplayConflictsWithNonEmptyInput(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9120, "plg")
	createEntitlementTestPlan(t, 9220, 100, "")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:          9320,
		UserId:      9120,
		Status:      SubscriptionContractStatusActive,
		PaymentMode: SubscriptionPaymentModeStripeRecurring,
	}).Error)
	emptyGroup := ""
	input := grantInput(9320, 9120, 9220, "stripe:empty-group-conflict", 100, 200)
	input.UpgradeGroup = &emptyGroup
	first, err := RotateCurrentEntitlement(input)
	require.NoError(t, err)
	require.True(t, first.Applied)
	require.Empty(t, first.Entitlement.UpgradeGroup)

	groupConflict := input
	nonEmptyGroup := "vip"
	groupConflict.UpgradeGroup = &nonEmptyGroup
	_, err = RotateCurrentEntitlement(groupConflict)

	require.ErrorIs(t, err, ErrSubscriptionEntitlementGrantConflict)
}

func TestSubscriptionEntitlementGrantLegacyNilWindowReplayStillMatches(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9119, "plg")
	plan := createEntitlementTestPlan(t, 9219, 100, "")
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"window_5h_amount":   int64(125),
		"window_week_amount": int64(900),
	}).Error)
	InvalidateSubscriptionPlanCache(plan.Id)
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:          9319,
		UserId:      9119,
		Status:      SubscriptionContractStatusActive,
		PaymentMode: SubscriptionPaymentModeStripeRecurring,
	}).Error)
	input := grantInput(9319, 9119, plan.Id, "stripe:legacy-window-replay", 100, 200)

	first, err := RotateCurrentEntitlement(input)
	require.NoError(t, err)
	require.True(t, first.Applied)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", first.Entitlement.Id).Updates(map[string]interface{}{
		"window_5h_amount":   nil,
		"window_week_amount": nil,
	}).Error)

	replay, err := RotateCurrentEntitlement(input)

	require.NoError(t, err)
	require.False(t, replay.Applied)
	require.Equal(t, first.Entitlement.Id, replay.Entitlement.Id)
}

func TestRotateCurrentEntitlementSnapshotsPlanWindowLimits(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9113, "plg")
	plan := createEntitlementTestPlan(t, 9213, 1000, "")
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"window_5h_amount":   int64(125),
		"window_week_amount": int64(900),
	}).Error)
	InvalidateSubscriptionPlanCache(plan.Id)
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:          9313,
		UserId:      9113,
		Status:      SubscriptionContractStatusEnded,
		PaymentMode: SubscriptionPaymentModeExternalOnePeriod,
	}).Error)

	grant, err := RotateCurrentEntitlement(grantInput(9313, 9113, plan.Id, "stripe:window-snapshot", 100, 200))
	require.NoError(t, err)
	require.True(t, grant.Applied)
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"window_5h_amount":   int64(999),
		"window_week_amount": int64(888),
	}).Error)
	InvalidateSubscriptionPlanCache(plan.Id)

	info, err := GetSubscriptionWindowInfoBySubId(grant.Entitlement.Id)

	require.NoError(t, err)
	require.Equal(t, int64(125), info.Window5hAmount)
	require.Equal(t, int64(900), info.WindowWeekAmount)
}

func TestRotateCurrentEntitlementPreservesExplicitZeroWindowLimits(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9116, "plg")
	plan := createEntitlementTestPlan(t, 9216, 1000, "")
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"window_5h_amount":   int64(125),
		"window_week_amount": int64(900),
	}).Error)
	InvalidateSubscriptionPlanCache(plan.Id)
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:          9316,
		UserId:      9116,
		Status:      SubscriptionContractStatusEnded,
		PaymentMode: SubscriptionPaymentModeExternalOnePeriod,
	}).Error)
	zero := int64(0)
	input := grantInput(9316, 9116, plan.Id, "stripe:window-zero-snapshot", 100, 200)
	input.Window5hAmount = &zero
	input.WindowWeekAmount = &zero

	grant, err := RotateCurrentEntitlement(input)

	require.NoError(t, err)
	require.NotNil(t, grant.Entitlement.Window5hAmount)
	require.NotNil(t, grant.Entitlement.WindowWeekAmount)
	require.Zero(t, *grant.Entitlement.Window5hAmount)
	require.Zero(t, *grant.Entitlement.WindowWeekAmount)
	info, err := GetSubscriptionWindowInfoBySubId(grant.Entitlement.Id)
	require.NoError(t, err)
	require.Zero(t, info.Window5hAmount)
	require.Zero(t, info.WindowWeekAmount)
}

func TestSubscriptionWindowInfoLegacyEntitlementFallsBackToLivePlan(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9117, "plg")
	plan := createEntitlementTestPlan(t, 9217, 1000, "")
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"window_5h_amount":   int64(75),
		"window_week_amount": int64(525),
	}).Error)
	InvalidateSubscriptionPlanCache(plan.Id)
	legacy := UserSubscription{
		UserId:        9117,
		PlanId:        plan.Id,
		AmountTotal:   1000,
		StartTime:     100,
		EndTime:       200,
		AccessEndTime: 200,
		Status:        SubscriptionEntitlementStatusActive,
		Source:        "order",
	}
	require.NoError(t, DB.Create(&legacy).Error)

	info, err := GetSubscriptionWindowInfoBySubId(legacy.Id)

	require.NoError(t, err)
	require.Equal(t, int64(75), info.Window5hAmount)
	require.Equal(t, int64(525), info.WindowWeekAmount)
}

func TestRotateCurrentEntitlementUsesExplicitUpgradeGroupSnapshot(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9114, "plg")
	plan := createEntitlementTestPlan(t, 9214, 1000, "edited_group")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:          9314,
		UserId:      9114,
		Status:      SubscriptionContractStatusEnded,
		PaymentMode: SubscriptionPaymentModeExternalOnePeriod,
	}).Error)
	snapshotGroup := "snapshot_group"
	input := grantInput(9314, 9114, plan.Id, "stripe:group-snapshot", 100, 200)
	input.UpgradeGroup = &snapshotGroup

	grant, err := RotateCurrentEntitlement(input)

	require.NoError(t, err)
	require.Equal(t, snapshotGroup, grant.Entitlement.UpgradeGroup)
	var user User
	require.NoError(t, DB.First(&user, "id = ?", 9114).Error)
	require.Equal(t, snapshotGroup, user.Group)
}

func TestCreateUserSubscriptionFromPlanSnapshotsWindowLimits(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9115, "plg")
	plan := createEntitlementTestPlan(t, 9215, 1000, "")
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"window_5h_amount":   int64(75),
		"window_week_amount": int64(525),
	}).Error)
	require.NoError(t, DB.First(&plan, "id = ?", plan.Id).Error)

	sub, err := CreateUserSubscriptionFromPlanTx(DB, 9115, &plan, "order")
	require.NoError(t, err)
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"window_5h_amount":   int64(975),
		"window_week_amount": int64(925),
	}).Error)
	InvalidateSubscriptionPlanCache(plan.Id)

	info, err := GetSubscriptionWindowInfoBySubId(sub.Id)

	require.NoError(t, err)
	require.Equal(t, int64(75), info.Window5hAmount)
	require.Equal(t, int64(525), info.WindowWeekAmount)
}

func TestSubscriptionPreConsumeContractCurrentEntitlement(t *testing.T) {
	t.Run("contract current wins over richer legacy row", func(t *testing.T) {
		setupSubscriptionEntitlementTestDB(t)
		createEntitlementTestUser(t, 9121, "plg")
		createEntitlementTestPlan(t, 9221, 100, "")
		createEntitlementTestPlan(t, 9222, 1000, "")
		now := GetDBTimestamp()
		require.NoError(t, DB.Create(&UserSubscription{
			UserId:        9121,
			PlanId:        9222,
			AmountTotal:   1000,
			AmountUsed:    0,
			StartTime:     now - 100,
			EndTime:       now + 500,
			AccessEndTime: now + 500,
			Status:        "active",
		}).Error)
		current := UserSubscription{
			UserId:        9121,
			PlanId:        9221,
			ContractId:    9321,
			CurrentSlot:   currentSlotPtr(),
			AmountTotal:   100,
			AmountUsed:    0,
			StartTime:     now - 100,
			EndTime:       now + 300,
			AccessEndTime: now + 300,
			Status:        "active",
		}
		require.NoError(t, DB.Create(&current).Error)
		require.NoError(t, DB.Create(&UserSubscriptionContract{
			Id:                   9321,
			UserId:               9121,
			Status:               SubscriptionContractStatusActive,
			CurrentEntitlementId: current.Id,
			CurrentPlanId:        9221,
		}).Error)

		res, err := PreConsumeUserSubscription("contract-current", 9121, "gpt-test", 0, 80)
		require.NoError(t, err)
		require.Equal(t, current.Id, res.UserSubscriptionId)
	})

	t.Run("contract missing pointer does not fallback", func(t *testing.T) {
		setupSubscriptionEntitlementTestDB(t)
		createEntitlementTestUser(t, 9122, "plg")
		createEntitlementTestPlan(t, 9223, 1000, "")
		require.NoError(t, DB.Create(&UserSubscription{
			UserId:        9122,
			PlanId:        9223,
			AmountTotal:   1000,
			StartTime:     100,
			EndTime:       500,
			AccessEndTime: 500,
			Status:        "active",
		}).Error)
		require.NoError(t, DB.Create(&UserSubscriptionContract{
			Id:                   9322,
			UserId:               9122,
			Status:               SubscriptionContractStatusActive,
			CurrentEntitlementId: 999999,
			CurrentPlanId:        9223,
		}).Error)

		_, err := PreConsumeUserSubscription("bad-pointer", 9122, "gpt-test", 0, 1)
		require.Error(t, err)
		active, activeErr := HasActiveUserSubscription(9122)
		require.NoError(t, activeErr)
		require.False(t, active)
	})

	t.Run("no contract preserves legacy scan", func(t *testing.T) {
		setupSubscriptionEntitlementTestDB(t)
		createEntitlementTestUser(t, 9123, "plg")
		createEntitlementTestPlan(t, 9224, 1000, "")
		now := GetDBTimestamp()
		legacy := UserSubscription{
			UserId:        9123,
			PlanId:        9224,
			AmountTotal:   1000,
			AmountUsed:    0,
			StartTime:     now - 100,
			EndTime:       now + 500,
			AccessEndTime: 0,
			Status:        "active",
		}
		require.NoError(t, DB.Create(&legacy).Error)

		res, err := PreConsumeUserSubscription("legacy-fallback", 9123, "gpt-test", 0, 10)
		require.NoError(t, err)
		require.Equal(t, legacy.Id, res.UserSubscriptionId)
	})

	t.Run("access end time controls contract usability and quota does not scan fallback", func(t *testing.T) {
		setupSubscriptionEntitlementTestDB(t)
		createEntitlementTestUser(t, 9124, "plg")
		createEntitlementTestPlan(t, 9225, 20, "")
		createEntitlementTestPlan(t, 9226, 1000, "")
		now := GetDBTimestamp()
		current := UserSubscription{
			UserId:        9124,
			PlanId:        9225,
			ContractId:    9324,
			CurrentSlot:   currentSlotPtr(),
			AmountTotal:   20,
			AmountUsed:    5,
			StartTime:     now - 200,
			EndTime:       now - 10,
			AccessEndTime: now + 200,
			Status:        "active",
		}
		require.NoError(t, DB.Create(&current).Error)
		require.NoError(t, DB.Create(&UserSubscription{
			UserId:        9124,
			PlanId:        9226,
			AmountTotal:   1000,
			AmountUsed:    0,
			StartTime:     now - 200,
			EndTime:       now + 200,
			AccessEndTime: now + 200,
			Status:        "active",
		}).Error)
		require.NoError(t, DB.Create(&UserSubscriptionContract{
			Id:                   9324,
			UserId:               9124,
			Status:               SubscriptionContractStatusGrace,
			CurrentEntitlementId: current.Id,
			CurrentPlanId:        9225,
		}).Error)

		res, err := PreConsumeUserSubscription("grace-access", 9124, "gpt-test", 0, 10)
		require.NoError(t, err)
		require.Equal(t, current.Id, res.UserSubscriptionId)

		_, err = PreConsumeUserSubscription("no-stack-on-insufficient", 9124, "gpt-test", 0, 999)
		require.Error(t, err)
	})

	t.Run("grace does not reset amount used when reset is due", func(t *testing.T) {
		setupSubscriptionEntitlementTestDB(t)
		createEntitlementTestUser(t, 9125, "plg")
		plan := createEntitlementTestPlan(t, 9227, 100, "")
		require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
			"quota_reset_period":         SubscriptionResetCustom,
			"quota_reset_custom_seconds": int64(10),
		}).Error)
		now := GetDBTimestamp()
		current := UserSubscription{
			UserId:        9125,
			PlanId:        9227,
			ContractId:    9325,
			CurrentSlot:   currentSlotPtr(),
			AmountTotal:   100,
			AmountUsed:    90,
			StartTime:     now - 100,
			EndTime:       now + 100,
			AccessEndTime: now + 100,
			LastResetTime: now - 100,
			NextResetTime: now - 90,
			Status:        "active",
		}
		require.NoError(t, DB.Create(&current).Error)
		require.NoError(t, DB.Create(&UserSubscriptionContract{
			Id:                   9325,
			UserId:               9125,
			Status:               SubscriptionContractStatusGrace,
			CurrentEntitlementId: current.Id,
			CurrentPlanId:        9227,
		}).Error)

		res, err := PreConsumeUserSubscription("grace-no-reset", 9125, "gpt-test", 0, 5)
		require.NoError(t, err)
		require.Equal(t, current.Id, res.UserSubscriptionId)

		var after UserSubscription
		require.NoError(t, DB.First(&after, "id = ?", current.Id).Error)
		require.EqualValues(t, 95, after.AmountUsed)
		require.EqualValues(t, now-90, after.NextResetTime)
	})
}

func TestSubscriptionPreConsumeIdempotencyStaysBoundAcrossRotation(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9131, "plg")
	createEntitlementTestPlan(t, 9231, 1000, "")
	createEntitlementTestPlan(t, 9232, 1000, "")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:          9331,
		UserId:      9131,
		Status:      SubscriptionContractStatusActive,
		PaymentMode: SubscriptionPaymentModeStripeRecurring,
	}).Error)
	now := GetDBTimestamp()
	first, err := RotateCurrentEntitlement(grantInput(9331, 9131, 9231, "stripe:first", now-100, now+200))
	require.NoError(t, err)

	pre, err := PreConsumeUserSubscription("before-rotation", 9131, "gpt-test", 0, 100)
	require.NoError(t, err)
	require.Equal(t, first.Entitlement.Id, pre.UserSubscriptionId)

	second, err := RotateCurrentEntitlement(grantInput(9331, 9131, 9232, "stripe:second", now+200, now+500))
	require.NoError(t, err)
	require.NotEqual(t, first.Entitlement.Id, second.Entitlement.Id)

	again, err := PreConsumeUserSubscription("before-rotation", 9131, "gpt-test", 0, 100)
	require.NoError(t, err)
	require.Equal(t, first.Entitlement.Id, again.UserSubscriptionId)

	require.NoError(t, PostConsumeUserSubscriptionDelta(first.Entitlement.Id, 25))
	require.NoError(t, RefundSubscriptionPreConsume("before-rotation"))

	var old UserSubscription
	require.NoError(t, DB.First(&old, "id = ?", first.Entitlement.Id).Error)
	require.EqualValues(t, 25, old.AmountUsed)
	var current UserSubscription
	require.NoError(t, DB.First(&current, "id = ?", second.Entitlement.Id).Error)
	require.Zero(t, current.AmountUsed)
}

func TestHasActiveUserSubscriptionFollowsContractRules(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9141, "plg")
	createEntitlementTestPlan(t, 9241, 100, "")
	now := GetDBTimestamp()
	current := UserSubscription{
		UserId:        9141,
		PlanId:        9241,
		ContractId:    9341,
		CurrentSlot:   currentSlotPtr(),
		AmountTotal:   100,
		EndTime:       now - 10,
		AccessEndTime: now + 100,
		Status:        "active",
	}
	require.NoError(t, DB.Create(&current).Error)
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                   9341,
		UserId:               9141,
		Status:               SubscriptionContractStatusNeedsAttention,
		CurrentEntitlementId: current.Id,
		CurrentPlanId:        9241,
	}).Error)

	active, err := HasActiveUserSubscription(9141)
	require.NoError(t, err)
	require.True(t, active)

	require.NoError(t, DB.Model(&UserSubscriptionContract{}).Where("id = ?", int64(9341)).
		Update("status", SubscriptionContractStatusEnded).Error)
	active, err = HasActiveUserSubscription(9141)
	require.NoError(t, err)
	require.False(t, active)
}

func TestResetDueSubscriptionsSkipsGraceCurrentEntitlement(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9142, "plg")
	plan := createEntitlementTestPlan(t, 9242, 100, "")
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"quota_reset_period":         SubscriptionResetCustom,
		"quota_reset_custom_seconds": int64(10),
	}).Error)
	now := GetDBTimestamp()
	current := UserSubscription{
		UserId:        9142,
		PlanId:        9242,
		ContractId:    9342,
		CurrentSlot:   currentSlotPtr(),
		AmountTotal:   100,
		AmountUsed:    90,
		StartTime:     now - 100,
		EndTime:       now + 100,
		AccessEndTime: now + 100,
		LastResetTime: now - 100,
		NextResetTime: now - 90,
		Status:        "active",
	}
	require.NoError(t, DB.Create(&current).Error)
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                   9342,
		UserId:               9142,
		Status:               SubscriptionContractStatusGrace,
		CurrentEntitlementId: current.Id,
		CurrentPlanId:        9242,
	}).Error)

	reset, err := ResetDueSubscriptions(10)
	require.NoError(t, err)
	require.Zero(t, reset)

	var after UserSubscription
	require.NoError(t, DB.First(&after, "id = ?", current.Id).Error)
	require.EqualValues(t, 90, after.AmountUsed)
	require.EqualValues(t, now-90, after.NextResetTime)
}

func TestRotateCurrentEntitlementGroupCaptureAndSwitch(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9151, "plg")
	createEntitlementTestPlan(t, 9251, 100, "")
	createEntitlementTestPlan(t, 9252, 100, "vip")
	createEntitlementTestPlan(t, 9253, 100, "enterprise")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:          9351,
		UserId:      9151,
		Status:      SubscriptionContractStatusActive,
		PaymentMode: SubscriptionPaymentModeStripeRecurring,
	}).Error)

	_, err := RotateCurrentEntitlement(grantInput(9351, 9151, 9251, "stripe:empty-group", 100, 200))
	require.NoError(t, err)
	var user User
	require.NoError(t, DB.First(&user, "id = ?", 9151).Error)
	require.Equal(t, "plg", user.Group)
	var contract UserSubscriptionContract
	require.NoError(t, DB.First(&contract, "id = ?", int64(9351)).Error)
	require.Empty(t, contract.BaseUserGroup)

	_, err = RotateCurrentEntitlement(grantInput(9351, 9151, 9252, "stripe:vip", 200, 300))
	require.NoError(t, err)
	require.NoError(t, DB.First(&user, "id = ?", 9151).Error)
	require.Equal(t, "vip", user.Group)
	require.NoError(t, DB.First(&contract, "id = ?", int64(9351)).Error)
	require.Equal(t, "plg", contract.BaseUserGroup)

	_, err = RotateCurrentEntitlement(grantInput(9351, 9151, 9253, "stripe:enterprise", 300, 400))
	require.NoError(t, err)
	require.NoError(t, DB.First(&user, "id = ?", 9151).Error)
	require.Equal(t, "enterprise", user.Group)
	require.NoError(t, DB.First(&contract, "id = ?", int64(9351)).Error)
	require.Equal(t, "plg", contract.BaseUserGroup)
}

func TestRotateCurrentEntitlementHistoricalGrantReplayDoesNotBecomeCurrent(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	createEntitlementTestUser(t, 9161, "plg")
	createEntitlementTestPlan(t, 9261, 100, "")
	createEntitlementTestPlan(t, 9262, 100, "")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:          9361,
		UserId:      9161,
		Status:      SubscriptionContractStatusActive,
		PaymentMode: SubscriptionPaymentModeStripeRecurring,
	}).Error)
	first, err := RotateCurrentEntitlement(grantInput(9361, 9161, 9261, "stripe:historical", 100, 200))
	require.NoError(t, err)
	second, err := RotateCurrentEntitlement(grantInput(9361, 9161, 9262, "stripe:new-current", 200, 300))
	require.NoError(t, err)

	replayed, err := RotateCurrentEntitlement(grantInput(9361, 9161, 9261, "stripe:historical", 100, 200))
	require.NoError(t, err)
	require.False(t, replayed.Applied)
	require.Equal(t, first.Entitlement.Id, replayed.Entitlement.Id)
	var contract UserSubscriptionContract
	require.NoError(t, DB.First(&contract, "id = ?", int64(9361)).Error)
	require.Equal(t, second.Entitlement.Id, contract.CurrentEntitlementId)
}

func TestRotateCurrentEntitlementConflictErrorIdentity(t *testing.T) {
	require.True(t, errors.Is(ErrSubscriptionEntitlementGrantConflict, ErrSubscriptionEntitlementGrantConflict))
}
