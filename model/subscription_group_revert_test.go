package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Regression tests for the subscription-expiry group-revert defect: a renewal or a
// stacked plan bought while the user is already in the upgrade group recorded an
// empty prev_user_group, and ExpireDueSubscriptions trusted only the latest-ending
// expired row, so it silently skipped the downgrade and left the user stuck in the
// upgraded group. See model/subscription.go (CreateUserSubscriptionFromPlanTx,
// ExpireDueSubscriptions, resolveOriginalUserGroupTx).

func insertSubRevertUser(t *testing.T, id int, group string) {
	t.Helper()
	user := &User{
		Id:       id,
		Username: fmt.Sprintf("subrevert_user_%d", id),
		Status:   common.UserStatusEnabled,
		Group:    group,
	}
	require.NoError(t, DB.Create(user).Error)
}

func subRevertUserGroup(t *testing.T, id int) string {
	t.Helper()
	var u User
	require.NoError(t, DB.Where("id = ?", id).First(&u).Error)
	return u.Group
}

// Core bug repro: latest-ending expired sub has an empty prev_user_group (renewal),
// but the baseline must still be recovered from the earlier sub in the chain.
func TestExpireDueSubscriptions_RevertsWhenLatestExpiredRowHasEmptyPrev(t *testing.T) {
	truncateTables(t)
	const uid = 9001
	insertSubRevertUser(t, uid, "vip")

	now := GetDBTimestamp()
	// Original upgrade recorded the real baseline "default".
	require.NoError(t, DB.Create(&UserSubscription{
		UserId: uid, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now - 20,
		UpgradeGroup: "vip", PrevUserGroup: "default",
	}).Error)
	// Renewal bought while already "vip" -> empty prev, ends later (the trigger).
	require.NoError(t, DB.Create(&UserSubscription{
		UserId: uid, PlanId: 1, Status: "active",
		StartTime: now - 50, EndTime: now - 10,
		UpgradeGroup: "vip", PrevUserGroup: "",
	}).Error)

	n, err := ExpireDueSubscriptions(100)
	require.NoError(t, err)
	assert.Equal(t, 2, n)
	assert.Equal(t, "default", subRevertUserGroup(t, uid),
		"group must revert to the original baseline even though the latest expired row had an empty prev_user_group")
}

// Fix A: a renewal made while already upgraded must inherit the original baseline
// instead of storing an empty prev_user_group.
func TestCreateUserSubscriptionFromPlanTx_RenewalInheritsPrevGroup(t *testing.T) {
	truncateTables(t)
	const uid = 9002
	insertSubRevertUser(t, uid, "default")

	plan := &SubscriptionPlan{
		Id: 50, Title: "VIP", DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
		Enabled: true, UpgradeGroup: "vip",
	}
	require.NoError(t, DB.Create(plan).Error)

	// CreateUserSubscriptionFromPlanTx accepts the global DB as its session here.
	// We intentionally do NOT wrap it in DB.Transaction: the function calls
	// GetDBTimestamp(), which queries the global DB, and the test harness pins
	// SQLite :memory: to a single connection — an outer transaction would hold that
	// connection and deadlock. The inheritance logic under test is independent of
	// transaction atomicity.
	sub1, err := CreateUserSubscriptionFromPlanTx(DB, uid, plan, "order")
	require.NoError(t, err)
	assert.Equal(t, "vip", subRevertUserGroup(t, uid))
	var reloaded1 UserSubscription
	require.NoError(t, DB.First(&reloaded1, sub1.Id).Error)
	assert.Equal(t, "default", reloaded1.PrevUserGroup)

	// Renewal while already "vip" must inherit the baseline, not store empty prev.
	sub2, err := CreateUserSubscriptionFromPlanTx(DB, uid, plan, "order")
	require.NoError(t, err)
	var reloaded2 UserSubscription
	require.NoError(t, DB.First(&reloaded2, sub2.Id).Error)
	assert.Equal(t, "default", reloaded2.PrevUserGroup,
		"renewal must inherit the original baseline, not store an empty prev_user_group")
}

// Sanity: a single, never-renewed subscription still reverts correctly.
func TestExpireDueSubscriptions_RevertsSingleSubscription(t *testing.T) {
	truncateTables(t)
	const uid = 9004
	insertSubRevertUser(t, uid, "vip")

	now := GetDBTimestamp()
	require.NoError(t, DB.Create(&UserSubscription{
		UserId: uid, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now - 10,
		UpgradeGroup: "vip", PrevUserGroup: "default",
	}).Error)

	n, err := ExpireDueSubscriptions(100)
	require.NoError(t, err)
	assert.Equal(t, 1, n)
	assert.Equal(t, "default", subRevertUserGroup(t, uid))
}

// Safety: while another upgraded subscription is still active, the group is kept.
func TestExpireDueSubscriptions_KeepsGroupWhenAnotherActiveUpgradeExists(t *testing.T) {
	truncateTables(t)
	const uid = 9005
	insertSubRevertUser(t, uid, "vip")

	now := GetDBTimestamp()
	require.NoError(t, DB.Create(&UserSubscription{
		UserId: uid, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now - 10,
		UpgradeGroup: "vip", PrevUserGroup: "default",
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		UserId: uid, PlanId: 1, Status: "active",
		StartTime: now - 50, EndTime: now + 100000,
		UpgradeGroup: "vip", PrevUserGroup: "",
	}).Error)

	n, err := ExpireDueSubscriptions(100)
	require.NoError(t, err)
	assert.Equal(t, 1, n)
	assert.Equal(t, "vip", subRevertUserGroup(t, uid),
		"group must stay upgraded while another active upgraded subscription remains")
}

// Safety: when no baseline is recoverable (user was placed into the group manually,
// every sub recorded an empty prev), do not guess — leave the group for admin
// remediation rather than forcing a downgrade.
func TestExpireDueSubscriptions_LeavesUnrecoverableManualGroupUntouched(t *testing.T) {
	truncateTables(t)
	const uid = 9006
	insertSubRevertUser(t, uid, "vip")

	now := GetDBTimestamp()
	require.NoError(t, DB.Create(&UserSubscription{
		UserId: uid, PlanId: 1, Status: "active",
		StartTime: now - 50, EndTime: now - 10,
		UpgradeGroup: "vip", PrevUserGroup: "",
	}).Error)

	n, err := ExpireDueSubscriptions(100)
	require.NoError(t, err)
	assert.Equal(t, 1, n)
	assert.Equal(t, "vip", subRevertUserGroup(t, uid))
}
