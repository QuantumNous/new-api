package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/utils/tests"
)

func seedGrantUser(t *testing.T, id int, group string) {
	t.Helper()
	require.NoError(t, DB.Create(&User{Id: id, Username: "grant-user", Group: group}).Error)
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
	_, err := CreateUserSubscriptionFromPlanTx(DB, 101, plan, "admin")
	require.NoError(t, err)

	_, err = CreateUserSubscriptionFromPlanTx(DB, 101, plan, "admin")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "已达到该套餐购买上限")

	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ?", 101, plan.Id).Count(&count).Error)
	assert.Equal(t, int64(1), count)
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

	_, err := CreateUserSubscriptionFromPlanTx(DB, 999, plan, "admin")
	require.Error(t, err)

	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Count(&count).Error)
	assert.Equal(t, int64(0), count)
}
