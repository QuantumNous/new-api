package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// createOverdueOrphanSubscription soft-deletes a user while leaving an overdue
// active subscription behind, which is reachable because deleting a user never
// removes its user_subscriptions rows.
func createOverdueOrphanSubscription(t *testing.T, userId int, suffix string) UserSubscription {
	t.Helper()
	user := User{
		Id: userId, Username: "subscription-orphan-" + suffix,
		AffCode: "subscription-orphan-aff-" + suffix,
		Status:  common.UserStatusEnabled, Group: "pro",
	}
	require.NoError(t, DB.Create(&user).Error)
	sub := UserSubscription{
		UserId: user.Id, PlanId: 1, Status: "active", StartTime: time.Now().Unix() - 100,
		EndTime: time.Now().Unix() - 1, UpgradeGroup: "pro", PrevUserGroup: "starter",
	}
	require.NoError(t, DB.Create(&sub).Error)
	require.NoError(t, DB.Delete(&User{}, user.Id).Error)
	var remaining int64
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Count(&remaining).Error)
	require.Zero(t, remaining)
	return sub
}

func TestExpireDueSubscriptionsSkipsUsersWithMissingUserRow(t *testing.T) {
	db, healthyUser, healthySub := setupSubscriptionLockOrderTest(t)
	require.NoError(t, db.Model(&healthySub).Update("end_time", time.Now().Unix()-1).Error)
	// A lower id makes the orphan sort first, so the healthy user is only
	// reached if the skip does not abort the batch.
	orphanSub := createOverdueOrphanSubscription(t, healthyUser.Id-1, "expire")

	count, err := ExpireDueSubscriptions(10)
	require.NoError(t, err)
	assert.Equal(t, 1, count)

	var reloadedHealthy UserSubscription
	require.NoError(t, db.First(&reloadedHealthy, healthySub.Id).Error)
	assert.Equal(t, "expired", reloadedHealthy.Status)
	var reloadedUser User
	require.NoError(t, db.First(&reloadedUser, healthyUser.Id).Error)
	assert.Equal(t, "starter", reloadedUser.Group)

	var reloadedOrphan UserSubscription
	require.NoError(t, db.First(&reloadedOrphan, orphanSub.Id).Error)
	assert.Equal(t, "active", reloadedOrphan.Status)
}

func TestAdminSubscriptionMutationsSucceedWhenUserRowIsMissing(t *testing.T) {
	t.Run("invalidate", func(t *testing.T) {
		db, healthyUser, _ := setupSubscriptionLockOrderTest(t)
		orphanSub := createOverdueOrphanSubscription(t, healthyUser.Id-1, "invalidate")

		message, err := AdminInvalidateUserSubscription(orphanSub.Id)
		require.NoError(t, err)
		assert.Empty(t, message)

		var reloaded UserSubscription
		require.NoError(t, db.First(&reloaded, orphanSub.Id).Error)
		assert.Equal(t, "cancelled", reloaded.Status)
	})

	t.Run("delete", func(t *testing.T) {
		db, healthyUser, _ := setupSubscriptionLockOrderTest(t)
		orphanSub := createOverdueOrphanSubscription(t, healthyUser.Id-1, "delete")

		message, err := AdminDeleteUserSubscription(orphanSub.Id)
		require.NoError(t, err)
		assert.Empty(t, message)

		var remaining int64
		require.NoError(t, db.Model(&UserSubscription{}).Where("id = ?", orphanSub.Id).Count(&remaining).Error)
		assert.Zero(t, remaining)
	})
}
