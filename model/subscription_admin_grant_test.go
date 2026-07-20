package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/utils/tests"
)

func seedGrantUser(t *testing.T, id int, group string) {
	t.Helper()
	// aff_code is unique, so it has to differ per seeded user.
	require.NoError(t, DB.Create(&User{
		Id:       id,
		Username: fmt.Sprintf("grant-user-%d", id),
		AffCode:  fmt.Sprintf("aff-%d", id),
		Group:    group,
	}).Error)
}

func seedGrantPlan(t *testing.T, plan *SubscriptionPlan) {
	t.Helper()
	require.NoError(t, DB.Create(plan).Error)
}

// The purchase-limit count in CreateUserSubscriptionFromPlanTx runs inside the
// transaction that locks the user row, so the row lock must be part of the
// statement that guards it.
func TestCreateUserSubscriptionLocksUserRow(t *testing.T) {
	dummyDB, err := gorm.Open(tests.DummyDialector{}, &gorm.Config{DryRun: true})
	require.NoError(t, err)
	buildSQL := func() string {
		var user User
		return lockForUpdate(dummyDB).Where("id = ?", 1).Find(&user).Statement.SQL.String()
	}

	t.Cleanup(func() {
		common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	})

	common.SetDatabaseTypes(common.DatabaseTypeMySQL, common.DatabaseTypeSQLite)
	sql := buildSQL()
	assert.Contains(t, sql, "users")
	assert.Contains(t, sql, "FOR UPDATE")
}

func TestCreateUserSubscriptionStillEnforcesPurchaseLimit(t *testing.T) {
	truncateTables(t)

	seedGrantUser(t, 101, "default")
	plan := &SubscriptionPlan{
		Id:                 9301,
		Title:              "Pro",
		PriceAmount:        10,
		DurationUnit:       SubscriptionDurationMonth,
		DurationValue:      1,
		TotalAmount:        1000,
		QuotaResetPeriod:   SubscriptionResetNever,
		MaxPurchasePerUser: 1,
	}
	seedGrantPlan(t, plan)

	// DB is passed directly instead of opening a transaction: the test harness
	// caps the pool at one connection, and GetDBTimestamp inside the callee
	// would deadlock waiting for a second one.
	_, err := CreateUserSubscriptionFromPlanTx(DB, 101, plan, "admin", 0)
	require.NoError(t, err)

	_, err = CreateUserSubscriptionFromPlanTx(DB, 101, plan, "admin", 0)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "已达到该套餐购买上限")

	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ?", 101, plan.Id).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestAdminBindSubscriptionRenewExtendsWithoutConsumingLimit(t *testing.T) {
	truncateTables(t)

	seedGrantUser(t, 101, "default")
	plan := &SubscriptionPlan{
		Id:                 9303,
		Title:              "Pro",
		PriceAmount:        10,
		DurationUnit:       SubscriptionDurationDay,
		DurationValue:      30,
		TotalAmount:        1000,
		QuotaResetPeriod:   SubscriptionResetDaily,
		MaxPurchasePerUser: 1,
	}
	seedGrantPlan(t, plan)

	created, err := CreateUserSubscriptionFromPlanTx(DB, 101, plan, "admin", 0)
	require.NoError(t, err)

	// The plan allows a single purchase, so renewing must not insert a second row.
	_, _, err = AdminBindSubscription(101, plan.Id, AdminGrantOptions{Mode: SubscriptionGrantRenew})
	require.NoError(t, err)

	var subs []UserSubscription
	require.NoError(t, DB.Where("user_id = ? AND plan_id = ?", 101, plan.Id).Find(&subs).Error)
	require.Len(t, subs, 1)
	assert.Equal(t, created.EndTime+30*24*3600, subs[0].EndTime)
	assert.Equal(t, "active", subs[0].Status)
	// A daily reset must still be scheduled inside the extended window.
	assert.Greater(t, subs[0].NextResetTime, int64(0))
	assert.Less(t, subs[0].NextResetTime, subs[0].EndTime)
}

func TestAdminBindSubscriptionRenewFallsBackToCreateWhenNoActive(t *testing.T) {
	truncateTables(t)

	seedGrantUser(t, 101, "default")
	plan := &SubscriptionPlan{
		Id:               9304,
		Title:            "Pro",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationDay,
		DurationValue:    30,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	seedGrantPlan(t, plan)

	_, effectiveMode, err := AdminBindSubscription(101, plan.Id, AdminGrantOptions{Mode: SubscriptionGrantRenew})
	require.NoError(t, err)
	// The fallback ran a create, and audit logging must see that, not "renew".
	assert.Equal(t, SubscriptionGrantCreate, effectiveMode)

	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", 101).Count(&count).Error)
	assert.Equal(t, int64(1), count)

	// An unrecognized mode is rejected instead of silently creating a row.
	_, _, err = AdminBindSubscription(101, plan.Id, AdminGrantOptions{Mode: "reneww"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "无效的授予模式")
}

func TestAdminBindSubscriptionReplaceCancelsExisting(t *testing.T) {
	truncateTables(t)

	seedGrantUser(t, 101, "default")
	plan := &SubscriptionPlan{
		Id:               9305,
		Title:            "Pro",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationDay,
		DurationValue:    30,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	seedGrantPlan(t, plan)

	old, err := CreateUserSubscriptionFromPlanTx(DB, 101, plan, "admin", 0)
	require.NoError(t, err)

	_, _, err = AdminBindSubscription(101, plan.Id, AdminGrantOptions{Mode: SubscriptionGrantReplace})
	require.NoError(t, err)

	var cancelled UserSubscription
	require.NoError(t, DB.Where("id = ?", old.Id).First(&cancelled).Error)
	assert.Equal(t, "cancelled", cancelled.Status)

	var activeCount int64
	require.NoError(t, DB.Model(&UserSubscription{}).
		Where("user_id = ? AND status = ?", 101, "active").Count(&activeCount).Error)
	assert.Equal(t, int64(1), activeCount)
}

// Replace cancels a row and inserts one, so it must not be blocked by the
// cancelled row still counting against MaxPurchasePerUser.
func TestAdminBindSubscriptionReplaceSucceedsAtPurchaseLimit(t *testing.T) {
	truncateTables(t)

	seedGrantUser(t, 101, "default")
	plan := &SubscriptionPlan{
		Id:                 9308,
		Title:              "Pro",
		PriceAmount:        10,
		DurationUnit:       SubscriptionDurationDay,
		DurationValue:      30,
		TotalAmount:        1000,
		QuotaResetPeriod:   SubscriptionResetNever,
		MaxPurchasePerUser: 1,
	}
	seedGrantPlan(t, plan)

	old, err := CreateUserSubscriptionFromPlanTx(DB, 101, plan, "admin", 0)
	require.NoError(t, err)

	_, _, err = AdminBindSubscription(101, plan.Id, AdminGrantOptions{Mode: SubscriptionGrantReplace})
	require.NoError(t, err)

	var cancelled UserSubscription
	require.NoError(t, DB.Where("id = ?", old.Id).First(&cancelled).Error)
	assert.Equal(t, "cancelled", cancelled.Status)

	var activeCount int64
	require.NoError(t, DB.Model(&UserSubscription{}).
		Where("user_id = ? AND status = ?", 101, "active").Count(&activeCount).Error)
	assert.Equal(t, int64(1), activeCount)

	// The limit itself is untouched: a plain create is still rejected.
	_, err = CreateUserSubscriptionFromPlanTx(DB, 101, plan, "admin", 0)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "已达到该套餐购买上限")
}

// Replace runs while the user is already in the upgrade group, so the new row
// must inherit the cancelled row's PrevUserGroup or expiry can never revert
// the user to their original group.
func TestAdminBindSubscriptionReplacePreservesPrevUserGroup(t *testing.T) {
	truncateTables(t)

	seedGrantUser(t, 101, "default")
	plan := &SubscriptionPlan{
		Id:               9309,
		Title:            "Pro",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationDay,
		DurationValue:    30,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
		UpgradeGroup:     "vip",
	}
	seedGrantPlan(t, plan)

	_, err := CreateUserSubscriptionFromPlanTx(DB, 101, plan, "order", 0)
	require.NoError(t, err)

	_, _, err = AdminBindSubscription(101, plan.Id, AdminGrantOptions{Mode: SubscriptionGrantReplace})
	require.NoError(t, err)

	var replacement UserSubscription
	require.NoError(t, DB.Where("user_id = ? AND status = ?", 101, "active").First(&replacement).Error)
	assert.Equal(t, "vip", replacement.UpgradeGroup)
	assert.Equal(t, "default", replacement.PrevUserGroup)

	// When the replacement expires, the user must fall back to the original group.
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", replacement.Id).
		Update("end_time", GetDBTimestamp()-60).Error)
	_, err = ExpireDueSubscriptions(10)
	require.NoError(t, err)

	var user User
	require.NoError(t, DB.Where("id = ?", 101).First(&user).Error)
	assert.Equal(t, "default", user.Group)
}

// Renewing mid-cycle must not rebase a custom-period reset schedule; the
// already-scheduled next reset stays as it is.
func TestAdminBindSubscriptionRenewKeepsCustomResetSchedule(t *testing.T) {
	truncateTables(t)

	seedGrantUser(t, 101, "default")
	plan := &SubscriptionPlan{
		Id:                      9310,
		Title:                   "Pro",
		PriceAmount:             10,
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             1000,
		QuotaResetPeriod:        SubscriptionResetCustom,
		QuotaResetCustomSeconds: 3600,
	}
	seedGrantPlan(t, plan)

	created, err := CreateUserSubscriptionFromPlanTx(DB, 101, plan, "admin", 0)
	require.NoError(t, err)
	require.Greater(t, created.NextResetTime, int64(0))

	_, _, err = AdminBindSubscription(101, plan.Id, AdminGrantOptions{Mode: SubscriptionGrantRenew})
	require.NoError(t, err)

	var sub UserSubscription
	require.NoError(t, DB.Where("id = ?", created.Id).First(&sub).Error)
	assert.Equal(t, created.NextResetTime, sub.NextResetTime)
	assert.Equal(t, created.EndTime+30*24*3600, sub.EndTime)
	assert.Equal(t, created.LastResetTime, sub.LastResetTime)
}

func TestAdminBindSubscriptionHonoursCustomEndTime(t *testing.T) {
	truncateTables(t)

	seedGrantUser(t, 101, "default")
	plan := &SubscriptionPlan{
		Id:               9306,
		Title:            "Pro",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationDay,
		DurationValue:    30,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	seedGrantPlan(t, plan)

	customEnd := GetDBTimestamp() + 7*24*3600
	_, _, err := AdminBindSubscription(101, plan.Id, AdminGrantOptions{EndTime: customEnd})
	require.NoError(t, err)

	var sub UserSubscription
	require.NoError(t, DB.Where("user_id = ?", 101).First(&sub).Error)
	assert.Equal(t, customEnd, sub.EndTime)

	// An end time already in the past is rejected rather than silently accepted.
	_, _, err = AdminBindSubscription(101, plan.Id, AdminGrantOptions{EndTime: GetDBTimestamp() - 60})
	require.Error(t, err)
}

func TestAdminBindSubscriptionBatchReportsPerUserFailures(t *testing.T) {
	truncateTables(t)

	seedGrantUser(t, 101, "default")
	seedGrantUser(t, 102, "default")
	plan := &SubscriptionPlan{
		Id:                 9307,
		Title:              "Pro",
		PriceAmount:        10,
		DurationUnit:       SubscriptionDurationDay,
		DurationValue:      30,
		TotalAmount:        1000,
		QuotaResetPeriod:   SubscriptionResetNever,
		MaxPurchasePerUser: 1,
	}
	seedGrantPlan(t, plan)

	// 101 already used its single slot; 102 is fresh; 999 does not exist.
	// Duplicated ids must be processed and counted once, not granted twice.
	_, err := CreateUserSubscriptionFromPlanTx(DB, 101, plan, "admin", 0)
	require.NoError(t, err)

	result, err := AdminBindSubscriptionBatch([]int{101, 101, 102, 102, 999}, plan.Id, AdminGrantOptions{})
	require.NoError(t, err)
	assert.Equal(t, 1, result.SuccessCount)
	assert.Equal(t, 2, result.FailedCount)
	assert.Equal(t, []int{102}, result.SucceededUsers)
	require.Len(t, result.Failed, 2)
	assert.Equal(t, 101, result.Failed[0].UserId)
	assert.Contains(t, result.Failed[0].Reason, "已达到该套餐购买上限")

	var count102 int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", 102).Count(&count102).Error)
	assert.Equal(t, int64(1), count102)
}

// The frontend result view indexes into failed unconditionally, so an
// all-success batch must serialize it as [] rather than null.
func TestAdminBindSubscriptionBatchAllSuccessKeepsFailedNonNil(t *testing.T) {
	truncateTables(t)

	seedGrantUser(t, 101, "default")
	seedGrantUser(t, 102, "default")
	plan := &SubscriptionPlan{
		Id:               9311,
		Title:            "Pro",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationDay,
		DurationValue:    30,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	seedGrantPlan(t, plan)

	result, err := AdminBindSubscriptionBatch([]int{101, 102}, plan.Id, AdminGrantOptions{})
	require.NoError(t, err)
	assert.Equal(t, 2, result.SuccessCount)
	assert.Equal(t, 0, result.FailedCount)
	require.NotNil(t, result.Failed)

	data, err := common.Marshal(result)
	require.NoError(t, err)
	assert.Contains(t, string(data), `"failed":[]`)
}

// Locking the user row also means a grant for a non-existent user now fails
// up front instead of creating an orphan subscription.
func TestCreateUserSubscriptionRejectsUnknownUser(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Id:               9302,
		Title:            "Pro",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	seedGrantPlan(t, plan)

	_, err := CreateUserSubscriptionFromPlanTx(DB, 999, plan, "admin", 0)
	require.Error(t, err)

	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Count(&count).Error)
	assert.Equal(t, int64(0), count)
}
