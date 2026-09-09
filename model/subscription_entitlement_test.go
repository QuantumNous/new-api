package model

import (
	"errors"
	"math"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSubscriptionEntitlementVersionOneRoundTrip(t *testing.T) {
	plan := &SubscriptionPlan{
		Id:                      7101,
		Title:                   "Annual Pro",
		DurationUnit:            SubscriptionDurationYear,
		DurationValue:           1,
		CustomSeconds:           0,
		MaxPurchasePerUser:      4,
		UpgradeGroup:            "pro",
		DowngradeGroup:          "default",
		TotalAmount:             5000,
		QuotaResetPeriod:        SubscriptionResetMonthly,
		QuotaResetCustomSeconds: 0,
		AllowWalletOverflow:     nil,
	}

	snapshot, err := BuildSubscriptionEntitlementSnapshot(plan)
	require.NoError(t, err)
	assert.Equal(t, SubscriptionEntitlementVersion1, snapshot.Version)
	assert.True(t, snapshot.AllowWalletOverflow)

	raw, err := EncodeSubscriptionEntitlementSnapshot(snapshot)
	require.NoError(t, err)
	assert.JSONEq(t, `{
		"version": 1,
		"plan_id": 7101,
		"plan_title": "Annual Pro",
		"duration_unit": "year",
		"duration_value": 1,
		"custom_seconds": 0,
		"max_purchase_per_user": 4,
		"upgrade_group": "pro",
		"downgrade_group": "default",
		"total_amount": 5000,
		"quota_reset_period": "monthly",
		"quota_reset_custom_seconds": 0,
		"allow_wallet_overflow": true
	}`, raw)

	plan.DurationValue = 12
	plan.TotalAmount = 1
	plan.AllowWalletOverflow = common.GetPointer(false)

	decoded, err := DecodeSubscriptionEntitlementSnapshot(raw)
	require.NoError(t, err)
	assert.Equal(t, snapshot, decoded)
	assert.Equal(t, 1, decoded.DurationValue)
	assert.Equal(t, int64(5000), decoded.TotalAmount)
}

func TestSubscriptionEntitlementRejectsUnknownVersion(t *testing.T) {
	_, err := DecodeSubscriptionEntitlementSnapshot(`{"version":2,"plan_id":1}`)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "version")

	_, err = EncodeSubscriptionEntitlementSnapshot(SubscriptionEntitlementSnapshot{
		Version: 2,
		PlanId:  1,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "version")
}

func TestSubscriptionEntitlementVersionOneAcceptsLegacyInactiveFieldValues(t *testing.T) {
	regular := SubscriptionEntitlementSnapshot{
		Version: SubscriptionEntitlementVersion1, PlanId: 7102, PlanTitle: "Legacy Regular",
		DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
		CustomSeconds: math.MaxInt64, QuotaResetPeriod: SubscriptionResetMonthly,
		QuotaResetCustomSeconds: math.MaxInt64,
	}
	raw, err := common.Marshal(regular)
	require.NoError(t, err)
	_, err = DecodeSubscriptionEntitlementSnapshot(string(raw))
	require.NoError(t, err)

	custom := regular
	custom.PlanId = 7103
	custom.PlanTitle = "Legacy Custom"
	custom.DurationUnit = SubscriptionDurationCustom
	custom.DurationValue = 1
	custom.CustomSeconds = 3600
	custom.QuotaResetPeriod = SubscriptionResetNever
	raw, err = common.Marshal(custom)
	require.NoError(t, err)
	_, err = DecodeSubscriptionEntitlementSnapshot(string(raw))
	require.NoError(t, err)
}

func TestSubscriptionEntitlementValidationRejectsUndeliverableSnapshots(t *testing.T) {
	valid := SubscriptionEntitlementSnapshot{
		Version: SubscriptionEntitlementVersion1, PlanId: 7110, PlanTitle: "Valid",
		DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	tooManySeconds := int64(math.MaxInt64/int64(time.Second)) + 1
	tests := []struct {
		name string
		edit func(*SubscriptionEntitlementSnapshot)
	}{
		{name: "empty title", edit: func(value *SubscriptionEntitlementSnapshot) { value.PlanTitle = " " }},
		{name: "oversized title", edit: func(value *SubscriptionEntitlementSnapshot) { value.PlanTitle = strings.Repeat("a", 129) }},
		{name: "oversized upgrade group", edit: func(value *SubscriptionEntitlementSnapshot) { value.UpgradeGroup = strings.Repeat("g", 65) }},
		{name: "oversized downgrade group", edit: func(value *SubscriptionEntitlementSnapshot) { value.DowngradeGroup = strings.Repeat("g", 65) }},
		{name: "invalid duration unit", edit: func(value *SubscriptionEntitlementSnapshot) { value.DurationUnit = "fortnight" }},
		{name: "nonpositive regular duration", edit: func(value *SubscriptionEntitlementSnapshot) { value.DurationValue = 0 }},
		{name: "overflowing day duration", edit: func(value *SubscriptionEntitlementSnapshot) {
			value.DurationUnit = SubscriptionDurationDay
			value.DurationValue = int(^uint(0) >> 1)
		}},
		{name: "missing custom duration", edit: func(value *SubscriptionEntitlementSnapshot) {
			value.DurationUnit = SubscriptionDurationCustom
			value.DurationValue = 0
			value.CustomSeconds = 0
		}},
		{name: "overflowing custom duration", edit: func(value *SubscriptionEntitlementSnapshot) {
			value.DurationUnit = SubscriptionDurationCustom
			value.DurationValue = 0
			value.CustomSeconds = tooManySeconds
		}},
		{name: "negative purchase limit", edit: func(value *SubscriptionEntitlementSnapshot) { value.MaxPurchasePerUser = -1 }},
		{name: "negative total amount", edit: func(value *SubscriptionEntitlementSnapshot) { value.TotalAmount = -1 }},
		{name: "invalid reset period", edit: func(value *SubscriptionEntitlementSnapshot) { value.QuotaResetPeriod = "sometimes" }},
		{name: "missing custom reset", edit: func(value *SubscriptionEntitlementSnapshot) {
			value.QuotaResetPeriod = SubscriptionResetCustom
			value.QuotaResetCustomSeconds = 0
		}},
		{name: "overflowing custom reset", edit: func(value *SubscriptionEntitlementSnapshot) {
			value.QuotaResetPeriod = SubscriptionResetCustom
			value.QuotaResetCustomSeconds = tooManySeconds
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			snapshot := valid
			tt.edit(&snapshot)
			require.Error(t, ValidateSubscriptionEntitlementSnapshot(snapshot))
			_, err := EncodeSubscriptionEntitlementSnapshot(snapshot)
			require.Error(t, err)
			raw, err := common.Marshal(snapshot)
			require.NoError(t, err)
			_, err = DecodeSubscriptionEntitlementSnapshot(string(raw))
			require.Error(t, err)
		})
	}
}

func TestSubscriptionEntitlementRejectsInvalidUTF8SnapshotContent(t *testing.T) {
	snapshot := SubscriptionEntitlementSnapshot{
		Version: SubscriptionEntitlementVersion1, PlanId: 7110,
		PlanTitle: string([]byte{0xff}), DurationUnit: SubscriptionDurationMonth,
		DurationValue: 1, QuotaResetPeriod: SubscriptionResetNever,
	}
	require.Error(t, ValidateSubscriptionEntitlementSnapshot(snapshot))
	_, err := EncodeSubscriptionEntitlementSnapshot(snapshot)
	require.Error(t, err)

	raw := append([]byte(`{"version":1,"plan_id":7110,"plan_title":"`), 0xff)
	raw = append(raw, []byte(`","duration_unit":"month","duration_value":1,"quota_reset_period":"never"}`)...)
	_, err = DecodeSubscriptionEntitlementSnapshot(string(raw))
	require.Error(t, err)
}

func TestSubscriptionEntitlementLocksExistingUserBeforePurchaseLimitRead(t *testing.T) {
	truncateTables(t)
	user := User{Id: 7114, Username: "entitlement_lock_user", Status: common.UserStatusEnabled, Group: "starter"}
	require.NoError(t, DB.Create(&user).Error)

	userWriteCompleted := false
	const updateCallback = "test:subscription-entitlement-user-write"
	const queryCallback = "test:subscription-entitlement-limit-after-write"
	require.NoError(t, DB.Callback().Update().After("gorm:update").Register(updateCallback, func(tx *gorm.DB) {
		if tx.Statement.Table == "users" {
			userWriteCompleted = true
			// MySQL may report zero rows for id=id. The delivery path must use
			// an independent read to establish that the user exists.
			tx.RowsAffected = 0
		}
	}))
	require.NoError(t, DB.Callback().Query().Before("gorm:query").Register(queryCallback, func(tx *gorm.DB) {
		if tx.Statement.Table == "user_subscriptions" && !userWriteCompleted {
			tx.AddError(errors.New("purchase-limit read happened before user serialization write"))
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Update().Remove(updateCallback))
		require.NoError(t, DB.Callback().Query().Remove(queryCallback))
	})

	snapshot := SubscriptionEntitlementSnapshot{
		Version: SubscriptionEntitlementVersion1, PlanId: 7115, PlanTitle: "Serialized Plan",
		DurationUnit: SubscriptionDurationMonth, DurationValue: 1, MaxPurchasePerUser: 1,
		UpgradeGroup: "pro", QuotaResetPeriod: SubscriptionResetNever,
	}
	var subscription *UserSubscription
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		subscription, err = CreateUserSubscriptionFromEntitlementTx(tx, user.Id, snapshot, "agent_redemption")
		return err
	}))
	require.NotNil(t, subscription)
	assert.True(t, userWriteCompleted)
	assert.Equal(t, "starter", subscription.PrevUserGroup)
}

func TestSubscriptionEntitlementRejectsMissingUserBeforeCreatingSubscription(t *testing.T) {
	truncateTables(t)
	snapshot := SubscriptionEntitlementSnapshot{
		Version: SubscriptionEntitlementVersion1, PlanId: 7116, PlanTitle: "Missing User Plan",
		DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		_, createErr := CreateUserSubscriptionFromEntitlementTx(tx, 999999, snapshot, "agent_redemption")
		return createErr
	})
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	var subscriptions int64
	require.NoError(t, DB.Model(&UserSubscription{}).Count(&subscriptions).Error)
	assert.Zero(t, subscriptions)
}

func TestBuildSubscriptionEntitlementSnapshotRejectsInvalidEnabledPlanTerms(t *testing.T) {
	valid := SubscriptionPlan{
		Id: 7111, Title: "Valid", DurationUnit: SubscriptionDurationMonth,
		DurationValue: 1, QuotaResetPeriod: SubscriptionResetNever,
	}
	tests := []struct {
		name string
		edit func(*SubscriptionPlan)
	}{
		{name: "invalid duration", edit: func(plan *SubscriptionPlan) { plan.DurationUnit = "invalid" }},
		{name: "negative purchase limit", edit: func(plan *SubscriptionPlan) { plan.MaxPurchasePerUser = -1 }},
		{name: "negative amount", edit: func(plan *SubscriptionPlan) { plan.TotalAmount = -1 }},
		{name: "invalid reset", edit: func(plan *SubscriptionPlan) { plan.QuotaResetPeriod = "invalid" }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			plan := valid
			tt.edit(&plan)
			_, err := BuildSubscriptionEntitlementSnapshot(&plan)
			require.Error(t, err)
		})
	}
}

func TestSubscriptionEntitlementDeliveryRejectsInvalidSnapshotBeforeMutation(t *testing.T) {
	truncateTables(t)
	user := User{Id: 7112, Username: "invalid_snapshot_user", Status: common.UserStatusEnabled, Group: "starter"}
	require.NoError(t, DB.Create(&user).Error)
	snapshot := SubscriptionEntitlementSnapshot{
		Version: SubscriptionEntitlementVersion1, PlanId: 7113, PlanTitle: "Invalid Amount",
		DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
		TotalAmount: -1, QuotaResetPeriod: SubscriptionResetNever,
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
		_, createErr := CreateUserSubscriptionFromEntitlementTx(tx, user.Id, snapshot, "redemption")
		return createErr
	})
	require.Error(t, err)
	var subscriptions int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", user.Id).Count(&subscriptions).Error)
	assert.Zero(t, subscriptions)
	var reloaded User
	require.NoError(t, DB.Select("group").First(&reloaded, user.Id).Error)
	assert.Equal(t, "starter", reloaded.Group)
}

func TestSubscriptionEntitlementDeliveryUsesImmutableSnapshot(t *testing.T) {
	truncateTables(t)

	user := &User{
		Id:       7201,
		Username: "snapshot_user",
		Status:   common.UserStatusEnabled,
		Group:    "starter",
	}
	require.NoError(t, DB.Create(user).Error)

	plan := &SubscriptionPlan{
		Id:                      7202,
		Title:                   "Snapshot Plan",
		DurationUnit:            SubscriptionDurationCustom,
		CustomSeconds:           7200,
		MaxPurchasePerUser:      2,
		UpgradeGroup:            "pro",
		DowngradeGroup:          "starter",
		TotalAmount:             5000,
		QuotaResetPeriod:        SubscriptionResetCustom,
		QuotaResetCustomSeconds: 1800,
		AllowWalletOverflow:     common.GetPointer(false),
	}
	snapshot, err := BuildSubscriptionEntitlementSnapshot(plan)
	require.NoError(t, err)
	raw, err := EncodeSubscriptionEntitlementSnapshot(snapshot)
	require.NoError(t, err)

	plan.DurationUnit = SubscriptionDurationMonth
	plan.DurationValue = 12
	plan.CustomSeconds = 0
	plan.MaxPurchasePerUser = 0
	plan.UpgradeGroup = "enterprise"
	plan.DowngradeGroup = "default"
	plan.TotalAmount = 1
	plan.QuotaResetPeriod = SubscriptionResetNever
	plan.QuotaResetCustomSeconds = 0
	plan.AllowWalletOverflow = common.GetPointer(true)

	decoded, err := DecodeSubscriptionEntitlementSnapshot(raw)
	require.NoError(t, err)
	var first *UserSubscription
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		first, err = CreateUserSubscriptionFromEntitlementTx(tx, user.Id, decoded, "redemption")
		require.NoError(t, err)
		_, err = CreateUserSubscriptionFromEntitlementTx(tx, user.Id, decoded, "redemption")
		require.NoError(t, err)
		_, err = CreateUserSubscriptionFromEntitlementTx(tx, user.Id, decoded, "redemption")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "购买上限")
		return nil
	}))

	require.NotNil(t, first)
	assert.Equal(t, snapshot.PlanId, first.PlanId)
	assert.Equal(t, int64(5000), first.AmountTotal)
	assert.Zero(t, first.AmountUsed)
	assert.Equal(t, int64(7200), first.EndTime-first.StartTime)
	assert.Equal(t, first.StartTime, first.LastResetTime)
	assert.Equal(t, int64(1800), first.NextResetTime-first.StartTime)
	assert.Equal(t, "redemption", first.Source)
	assert.Equal(t, "pro", first.UpgradeGroup)
	assert.Equal(t, "starter", first.PrevUserGroup)
	assert.Equal(t, "starter", first.DowngradeGroup)
	assert.False(t, first.AllowWalletOverflow)

	var reloadedUser User
	require.NoError(t, DB.Select("group").First(&reloadedUser, user.Id).Error)
	assert.Equal(t, "pro", reloadedUser.Group)
}
