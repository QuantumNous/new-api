package service

import (
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionMigrationServiceTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalUsingMySQL := common.UsingMySQL

	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.UsingMySQL = originalUsingMySQL
		require.NoError(t, sqlDB.Close())
	})

	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Log{},
		&model.SubscriptionPlan{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
		&model.SubscriptionProviderBinding{},
		&model.UserSubscriptionContract{},
		&model.SubscriptionChangeIntent{},
	))
}

func insertMigrationUser(t *testing.T, id int, quota int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:       id,
		Username: "migration_user_" + t.Name() + "_" + strconv.Itoa(id),
		Status:   common.UserStatusEnabled,
		Quota:    quota,
		Group:    "plg",
		AffCode:  "migration_aff_" + t.Name() + "_" + strconv.Itoa(id),
	}).Error)
}

func insertMigrationPlan(t *testing.T, id int, rank int, price float64, total int64) model.SubscriptionPlan {
	t.Helper()
	plan := model.SubscriptionPlan{
		Id:              id,
		Title:           "Migration Plan",
		PriceAmount:     price,
		Currency:        "USD",
		DurationUnit:    model.SubscriptionDurationMonth,
		DurationValue:   1,
		Enabled:         true,
		TierRank:        &rank,
		AllowBalancePay: common.GetPointer(true),
		TotalAmount:     total,
	}
	require.NoError(t, model.DB.Create(&plan).Error)
	return plan
}

func insertMigrationBinding(t *testing.T, userID int, planID int, providerSubscriptionID string, periodEnd int64) model.SubscriptionProviderBinding {
	t.Helper()
	binding := model.SubscriptionProviderBinding{
		UserId:                 userID,
		PlanId:                 planID,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: providerSubscriptionID,
		ProviderStatus:         "active",
		CurrentPeriodStart:     periodEnd - 3600,
		CurrentPeriodEnd:       periodEnd,
	}
	require.NoError(t, model.DB.Create(&binding).Error)
	return binding
}

func insertMigrationEntitlement(t *testing.T, userID int, planID int, bindingID int64, paymentMode string, accessEnd int64) model.UserSubscription {
	t.Helper()
	sub := model.UserSubscription{
		UserId:            userID,
		PlanId:            planID,
		ProviderBindingId: bindingID,
		AmountTotal:       1000,
		StartTime:         accessEnd - 3600,
		EndTime:           accessEnd,
		AccessEndTime:     accessEnd,
		Status:            model.SubscriptionEntitlementStatusActive,
		Source:            "order",
		PaymentMode:       paymentMode,
	}
	require.NoError(t, model.DB.Create(&sub).Error)
	return sub
}

func TestAuditLegacySubscriptionsBackfillsUniqueRecurring(t *testing.T) {
	setupSubscriptionMigrationServiceTestDB(t)
	insertMigrationUser(t, 8101, 0)
	insertMigrationPlan(t, 8201, 1, 1, 1000)
	now := common.GetTimestamp()
	binding := insertMigrationBinding(t, 8101, 8201, "sub_unique", now+3600)
	entitlement := insertMigrationEntitlement(t, 8101, 8201, binding.Id, model.SubscriptionPaymentModeStripeRecurring, now+3600)

	report, err := AuditLegacySubscriptions()

	require.NoError(t, err)
	require.Equal(t, 1, report.Count(SubscriptionMigrationClassificationOneVerifiedRecurring))
	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contract, "user_id = ?", 8101).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, contract.Status)
	require.Equal(t, model.SubscriptionPaymentModeStripeRecurring, contract.PaymentMode)
	require.Equal(t, 8201, contract.CurrentPlanId)
	require.Equal(t, entitlement.Id, contract.CurrentEntitlementId)
	require.Equal(t, binding.Id, contract.CurrentProviderBindingId)
	var migratedEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&migratedEntitlement, entitlement.Id).Error)
	require.Equal(t, contract.Id, migratedEntitlement.ContractId)
	require.NotNil(t, migratedEntitlement.CurrentSlot)
	require.Equal(t, 1, *migratedEntitlement.CurrentSlot)
	var migratedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&migratedBinding, binding.Id).Error)
	require.Equal(t, contract.Id, migratedBinding.ContractId)

	secondAudit, err := AuditLegacySubscriptionForUser(8101)
	require.NoError(t, err)
	require.Equal(t, SubscriptionMigrationClassificationNoActive, secondAudit.Classification)
	require.False(t, secondAudit.Backfilled)
	var contractCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("user_id = ?", 8101).Count(&contractCount).Error)
	require.Equal(t, int64(1), contractCount)
}

func TestAuditLegacySubscriptionsQuarantinesMultipleRecurringBindings(t *testing.T) {
	setupSubscriptionMigrationServiceTestDB(t)
	insertMigrationUser(t, 8102, 5000)
	insertMigrationPlan(t, 8202, 1, 1, 1000)
	insertMigrationPlan(t, 8203, 2, 2, 2000)
	now := common.GetTimestamp()
	first := insertMigrationBinding(t, 8102, 8202, "sub_first", now+3600)
	second := insertMigrationBinding(t, 8102, 8203, "sub_second", now+7200)
	insertMigrationEntitlement(t, 8102, 8202, first.Id, model.SubscriptionPaymentModeStripeRecurring, now+3600)
	insertMigrationEntitlement(t, 8102, 8203, second.Id, model.SubscriptionPaymentModeStripeRecurring, now+7200)

	report, err := AuditLegacySubscriptions()

	require.NoError(t, err)
	require.Equal(t, 1, report.Count(SubscriptionMigrationClassificationMultipleRecurringBindings))
	var contractCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("user_id = ?", 8102).Count(&contractCount).Error)
	require.Zero(t, contractCount)
}

func TestAuditLegacySubscriptionForUserDoesNotLetEmptyContractHideMultipleRecurringBindings(t *testing.T) {
	setupSubscriptionMigrationServiceTestDB(t)
	insertMigrationUser(t, 8103, 5000)
	insertMigrationPlan(t, 8204, 1, 1, 1000)
	insertMigrationPlan(t, 8205, 2, 2, 2000)
	now := common.GetTimestamp()
	first := insertMigrationBinding(t, 8103, 8204, "sub_empty_contract_first", now+3600)
	second := insertMigrationBinding(t, 8103, 8205, "sub_empty_contract_second", now+7200)
	insertMigrationEntitlement(t, 8103, 8204, first.Id, model.SubscriptionPaymentModeStripeRecurring, now+3600)
	insertMigrationEntitlement(t, 8103, 8205, second.Id, model.SubscriptionPaymentModeStripeRecurring, now+7200)
	require.NoError(t, model.DB.Create(&model.UserSubscriptionContract{
		UserId:      8103,
		Status:      model.SubscriptionContractStatusEnded,
		PaymentMode: model.SubscriptionPaymentModeExternalOnePeriod,
	}).Error)

	result, err := AuditLegacySubscriptionForUser(8103)

	require.NoError(t, err)
	require.Equal(t, SubscriptionMigrationClassificationMultipleRecurringBindings, result.Classification)
	require.False(t, result.Backfilled)
	var contractCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("user_id = ?", 8103).Count(&contractCount).Error)
	require.Equal(t, int64(1), contractCount)
}

func TestChangeSubscriptionPlanBlocksMigrationConflictBeforeAnySideEffects(t *testing.T) {
	setupSubscriptionMigrationServiceTestDB(t)
	insertMigrationUser(t, 8104, 5000)
	insertMigrationPlan(t, 8206, 1, 1, 1000)
	insertMigrationPlan(t, 8207, 2, 2, 2000)
	now := common.GetTimestamp()
	first := insertMigrationBinding(t, 8104, 8206, "sub_service_gate_first", now+3600)
	second := insertMigrationBinding(t, 8104, 8207, "sub_service_gate_second", now+7200)
	insertMigrationEntitlement(t, 8104, 8206, first.Id, model.SubscriptionPaymentModeStripeRecurring, now+3600)
	insertMigrationEntitlement(t, 8104, 8207, second.Id, model.SubscriptionPaymentModeStripeRecurring, now+7200)
	originalGate := common.SubscriptionSingleContractEnabled
	originalQuotaPerUnit := common.QuotaPerUnit
	common.SubscriptionSingleContractEnabled = true
	common.QuotaPerUnit = 100
	t.Cleanup(func() {
		common.SubscriptionSingleContractEnabled = originalGate
		common.QuotaPerUnit = originalQuotaPerUnit
	})

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      8104,
		PlanID:      8207,
		PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
		RequestID:   "service-migration-conflict",
	})

	require.Nil(t, result)
	require.ErrorIs(t, err, ErrSubscriptionMigrationRequiresAdmin)
	var contractCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("user_id = ?", 8104).Count(&contractCount).Error)
	require.Zero(t, contractCount)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 8104).Count(&intentCount).Error)
	require.Zero(t, intentCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 8104).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 8104).Error)
	require.Equal(t, 5000, user.Quota)
}

func TestChangeSubscriptionPlanGateDisabledPreservesLegacyBehavior(t *testing.T) {
	setupSubscriptionMigrationServiceTestDB(t)
	insertMigrationUser(t, 8105, 5000)
	insertMigrationPlan(t, 8208, 1, 1, 1000)
	insertMigrationPlan(t, 8209, 2, 2, 2000)
	now := common.GetTimestamp()
	first := insertMigrationBinding(t, 8105, 8208, "sub_service_gate_disabled_first", now+3600)
	second := insertMigrationBinding(t, 8105, 8209, "sub_service_gate_disabled_second", now+7200)
	insertMigrationEntitlement(t, 8105, 8208, first.Id, model.SubscriptionPaymentModeStripeRecurring, now+3600)
	insertMigrationEntitlement(t, 8105, 8209, second.Id, model.SubscriptionPaymentModeStripeRecurring, now+7200)
	originalGate := common.SubscriptionSingleContractEnabled
	originalQuotaPerUnit := common.QuotaPerUnit
	common.SubscriptionSingleContractEnabled = false
	common.QuotaPerUnit = 100
	t.Cleanup(func() {
		common.SubscriptionSingleContractEnabled = originalGate
		common.QuotaPerUnit = originalQuotaPerUnit
	})

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      8105,
		PlanID:      8209,
		PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod,
		RequestID:   "service-migration-gate-disabled",
	})

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, ChangePlanStatusApplied, result.Status)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 8105).Error)
	require.Equal(t, 4800, user.Quota)
}

func TestMigrationGateDoesNotChangeExactBindingCancellation(t *testing.T) {
	setupSubscriptionMigrationServiceTestDB(t)
	insertMigrationUser(t, 8106, 0)
	insertMigrationPlan(t, 8210, 1, 1, 1000)
	now := common.GetTimestamp()
	untouched := insertMigrationBinding(t, 8106, 8210, "sub_cancel_untouched", now+3600)
	target := insertMigrationBinding(t, 8106, 8210, "sub_cancel_target", now+7200)
	require.NoError(t, model.DB.Model(&target).Update("provider_schedule_id", "sched_legacy_exact").Error)
	target.ProviderScheduleId = "sched_legacy_exact"
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	originalRelease := stripeReleaseSubscriptionSchedule
	originalGate := common.SubscriptionSingleContractEnabled
	common.SubscriptionSingleContractEnabled = true
	t.Cleanup(func() {
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
		stripeReleaseSubscriptionSchedule = originalRelease
		common.SubscriptionSingleContractEnabled = originalGate
	})
	stripeReleaseSubscriptionSchedule = func(scheduleID string, idempotencyKey string) error {
		t.Fatal("legacy exact-binding cancellation must not coordinate an unowned schedule")
		return nil
	}
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, target.ProviderSubscriptionId, providerSubscriptionID)
		require.True(t, cancelAtPeriodEnd)
		require.Contains(t, idempotencyKey, "binding_"+strconv.FormatInt(target.Id, 10)+"_cancel_")
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     target.CurrentPeriodStart,
			CurrentPeriodEnd:       target.CurrentPeriodEnd,
		}, nil
	}

	updated, err := CancelStripeRecurringSubscription(8106, target.Id)

	require.NoError(t, err)
	require.Equal(t, target.Id, updated.Id)
	require.True(t, updated.CancelAtPeriodEnd)
	var untouchedAfter model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&untouchedAfter, untouched.Id).Error)
	require.False(t, untouchedAfter.CancelAtPeriodEnd)
}

func TestAuditLegacySubscriptionsClassifiesLegacyShapes(t *testing.T) {
	setupSubscriptionMigrationServiceTestDB(t)
	now := common.GetTimestamp()
	insertMigrationUser(t, 8110, 0)
	insertMigrationPlan(t, 8210, 1, 1, 1000)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId:        8110,
		PlanId:        8210,
		AmountTotal:   1000,
		StartTime:     now - 7200,
		EndTime:       now - 3600,
		AccessEndTime: now - 3600,
		Status:        model.SubscriptionEntitlementStatusActive,
	}).Error)

	insertMigrationUser(t, 8111, 0)
	insertMigrationPlan(t, 8211, 2, 1, 1000)
	insertMigrationEntitlement(t, 8111, 8211, 0, model.SubscriptionPaymentModeBalanceOnePeriod, now+3600)

	insertMigrationUser(t, 8112, 0)
	insertMigrationPlan(t, 8212, 3, 1, 1000)
	insertMigrationEntitlement(t, 8112, 8212, 999999, model.SubscriptionPaymentModeStripeRecurring, now+3600)

	insertMigrationUser(t, 8113, 0)
	insertMigrationPlan(t, 8213, 4, 1, 1000)
	ambiguous := insertMigrationEntitlement(t, 8113, 8213, 0, model.SubscriptionPaymentModeBalanceOnePeriod, now+3600)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("id = ?", ambiguous.Id).
		Updates(map[string]interface{}{"upgrade_group": "vip", "prev_user_group": ""}).Error)

	insertMigrationUser(t, 8114, 0)
	insertMigrationPlan(t, 8214, 5, 1, 1000)
	insertMigrationPlan(t, 8215, 6, 1, 1000)
	insertMigrationEntitlement(t, 8114, 8214, 0, model.SubscriptionPaymentModeBalanceOnePeriod, now+3600)
	insertMigrationEntitlement(t, 8114, 8215, 0, model.SubscriptionPaymentModeBalanceOnePeriod, now+7200)

	report, err := AuditLegacySubscriptions()

	require.NoError(t, err)
	require.Equal(t, 1, report.Count(SubscriptionMigrationClassificationNoActive))
	require.Equal(t, 1, report.Count(SubscriptionMigrationClassificationOneOnePeriodEntitlement))
	require.Equal(t, 1, report.Count(SubscriptionMigrationClassificationMissingBinding))
	require.Equal(t, 1, report.Count(SubscriptionMigrationClassificationGroupAmbiguity))
	require.Equal(t, 1, report.Count(SubscriptionMigrationClassificationMultipleActiveEntitlements))
}
