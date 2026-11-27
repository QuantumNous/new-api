package model

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSubscriptionGroupTransitionsPreserveAuthVersionAndSessions(t *testing.T) {
	truncateTables(t)
	useUserCacheMiniRedis(t)
	now := time.Now().Unix()
	user := User{
		Username:    "subscription-auth-user",
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, CreateUserSession(&UserSession{
		SID:             "subscription-auth-session",
		UserID:          user.Id,
		Version:         1,
		UserAuthVersion: 1,
		Status:          UserSessionStatusActive,
		RefreshHash:     "refresh-hash",
		LoginMethod:     "password",
		LastActiveAt:    now,
		ExpiresAt:       now + 3600,
	}))
	require.NoError(t, populateUserCache(user))
	plan := &SubscriptionPlan{
		Title:         "Upgraded",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   100,
		UpgradeGroup:  "pro",
		Enabled:       true,
	}
	require.NoError(t, DB.Create(plan).Error)

	subscription, err := CreateUserSubscriptionFromPlanTx(DB, user.Id, plan, "test")
	require.NoError(t, err)
	require.Equal(t, "default", subscription.PrevUserGroup)
	require.NoError(t, RefreshUserGroupCache(user.Id))

	var updated User
	require.NoError(t, DB.First(&updated, user.Id).Error)
	assert.Equal(t, "pro", updated.Group)
	assert.EqualValues(t, 1, updated.AuthVersion)
	var session UserSession
	require.NoError(t, DB.First(&session, "sid = ?", "subscription-auth-session").Error)
	assert.Equal(t, UserSessionStatusActive, session.Status)
	cached, err := GetUserCache(user.Id)
	require.NoError(t, err)
	assert.Equal(t, "pro", cached.Group)
	assert.EqualValues(t, 1, cached.AuthVersion)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		target, err := downgradeUserGroupForSubscriptionTx(tx, subscription, now+1)
		assert.Equal(t, "default", target)
		return err
	}))
	require.NoError(t, RefreshUserGroupCache(user.Id))
	require.NoError(t, DB.First(&updated, user.Id).Error)
	assert.Equal(t, "default", updated.Group)
	assert.EqualValues(t, 1, updated.AuthVersion)
	require.NoError(t, DB.First(&session, "sid = ?", "subscription-auth-session").Error)
	assert.Equal(t, UserSessionStatusActive, session.Status)
	cached, err = GetUserCache(user.Id)
	require.NoError(t, err)
	assert.Equal(t, "default", cached.Group)
}

func TestSubscriptionGroupCacheRefreshFailureDoesNotChangeCommittedResult(t *testing.T) {
	previousDB, previousLogDB := DB, LOG_DB
	previousMainDatabaseType, previousLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	DB, LOG_DB = db, db
	require.NoError(t, db.AutoMigrate(&User{}, &SubscriptionPlan{}, &UserSubscription{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		_ = sqlDB.Close()
	})

	user := User{
		Username:    "subscription-cache-failure",
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(&user).Error)
	plan := &SubscriptionPlan{
		Title:         "Cache failure plan",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   100,
		UpgradeGroup:  "pro",
		Enabled:       true,
	}
	require.NoError(t, DB.Create(plan).Error)
	InvalidateSubscriptionPlanCache(plan.Id)

	oldRedisEnabled, oldRDB := common.RedisEnabled, common.RDB
	common.RedisEnabled = true
	common.RDB = redis.NewClient(&redis.Options{
		Dialer: func(context.Context, string, string) (net.Conn, error) {
			return nil, errors.New("forced redis failure")
		},
		MaxRetries: -1,
	})
	t.Cleanup(func() {
		_ = common.RDB.Close()
		common.RedisEnabled, common.RDB = oldRedisEnabled, oldRDB
	})

	message, err := AdminBindSubscription(user.Id, plan.Id, "test")
	require.NoError(t, err)
	require.NotNil(t, message)
	assert.Equal(t, "pro", message.Params["group"])

	var updated User
	require.NoError(t, DB.First(&updated, user.Id).Error)
	assert.Equal(t, "pro", updated.Group)
	assert.EqualValues(t, 1, updated.AuthVersion)
	var subscription UserSubscription
	require.NoError(t, DB.Where("user_id = ?", user.Id).First(&subscription).Error)
	assert.Equal(t, "active", subscription.Status)
}

func TestSubscriptionDecisionCacheExpiresAndReloadsBothDecisions(t *testing.T) {
	truncateTables(t)
	redisServer := useUserCacheMiniRedis(t)
	const userID = 5301

	hasActive, err := HasActiveUserSubscription(userID)
	require.NoError(t, err)
	assert.False(t, hasActive)
	allowWallet, err := UserActiveSubscriptionsAllowWalletOverflow(userID)
	require.NoError(t, err)
	assert.True(t, allowWallet)

	require.NoError(t, DB.Create(&UserSubscription{
		UserId: userID, PlanId: 1, Status: "active", EndTime: GetDBTimestamp() + 3600,
		AllowWalletOverflow: false,
	}).Error)
	hasActive, err = HasActiveUserSubscription(userID)
	require.NoError(t, err)
	assert.False(t, hasActive)
	allowWallet, err = UserActiveSubscriptionsAllowWalletOverflow(userID)
	require.NoError(t, err)
	assert.True(t, allowWallet)

	redisServer.FastForward(3 * time.Second)
	hasActive, err = HasActiveUserSubscription(userID)
	require.NoError(t, err)
	assert.True(t, hasActive)
	allowWallet, err = UserActiveSubscriptionsAllowWalletOverflow(userID)
	require.NoError(t, err)
	assert.False(t, allowWallet)
}

func useSubscriptionDecisionTestDB(t *testing.T) {
	t.Helper()
	previousDB, previousLogDB := DB, LOG_DB
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &SubscriptionPlan{}, &UserSubscription{}, &SubscriptionOrder{}, &TopUp{}, &Log{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)
	DB, LOG_DB = db, db
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		_ = sqlDB.Close()
	})
}

func TestSubscriptionDecisionCacheTracksAdminChangesAndMultipleSubscriptions(t *testing.T) {
	useSubscriptionDecisionTestDB(t)
	useUserCacheMiniRedis(t)
	user := User{Username: "subscription-decision-admin", Group: "default", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	strict := false
	strictPlan := SubscriptionPlan{Title: "Strict", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, Enabled: true, AllowWalletOverflow: &strict}
	require.NoError(t, DB.Create(&strictPlan).Error)
	flexible := true
	flexiblePlan := SubscriptionPlan{Title: "Flexible", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, Enabled: true, AllowWalletOverflow: &flexible}
	require.NoError(t, DB.Create(&flexiblePlan).Error)
	InvalidateSubscriptionPlanCache(strictPlan.Id)
	InvalidateSubscriptionPlanCache(flexiblePlan.Id)

	hasActive, err := HasActiveUserSubscription(user.Id)
	require.NoError(t, err)
	assert.False(t, hasActive)
	_, err = AdminBindSubscription(user.Id, flexiblePlan.Id, "test")
	require.NoError(t, err)
	hasActive, err = HasActiveUserSubscription(user.Id)
	require.NoError(t, err)
	assert.True(t, hasActive)
	allowWallet, err := UserActiveSubscriptionsAllowWalletOverflow(user.Id)
	require.NoError(t, err)
	assert.True(t, allowWallet)

	_, err = AdminBindSubscription(user.Id, strictPlan.Id, "test")
	require.NoError(t, err)
	allowWallet, err = UserActiveSubscriptionsAllowWalletOverflow(user.Id)
	require.NoError(t, err)
	assert.False(t, allowWallet)
	var strictSub UserSubscription
	require.NoError(t, DB.Where("user_id = ? AND plan_id = ?", user.Id, strictPlan.Id).First(&strictSub).Error)
	_, err = AdminInvalidateUserSubscription(strictSub.Id)
	require.NoError(t, err)
	allowWallet, err = UserActiveSubscriptionsAllowWalletOverflow(user.Id)
	require.NoError(t, err)
	assert.True(t, allowWallet)
	var flexibleSub UserSubscription
	require.NoError(t, DB.Where("user_id = ? AND plan_id = ?", user.Id, flexiblePlan.Id).First(&flexibleSub).Error)
	_, err = AdminDeleteUserSubscription(flexibleSub.Id)
	require.NoError(t, err)
	hasActive, err = HasActiveUserSubscription(user.Id)
	require.NoError(t, err)
	assert.False(t, hasActive)
}

func TestSubscriptionDecisionCacheFallsBackOnRedisFailure(t *testing.T) {
	truncateTables(t)
	useUserCacheMiniRedis(t)
	const userID = 5302
	require.NoError(t, DB.Create(&UserSubscription{
		UserId: userID, PlanId: 1, Status: "active", EndTime: GetDBTimestamp() + 3600,
		AllowWalletOverflow: false,
	}).Error)
	for _, cached := range []string{
		"invalid", "{}", `{"has_active":true}`, `{"allow_wallet_overflow":false}`,
		`{"has_active":false,"allow_wallet_overflow":false}`,
	} {
		t.Run(cached, func(t *testing.T) {
			require.NoError(t, common.RedisSet(subscriptionDecisionCacheKey(userID), cached, time.Minute))
			hasActive, err := HasActiveUserSubscription(userID)
			require.NoError(t, err)
			assert.True(t, hasActive)
			allowWallet, err := UserActiveSubscriptionsAllowWalletOverflow(userID)
			require.NoError(t, err)
			assert.False(t, allowWallet)
		})
	}

	require.NoError(t, common.RedisDelKey(subscriptionDecisionCacheKey(userID)))
	require.NoError(t, common.RDB.Close())
	allowWallet, err := UserActiveSubscriptionsAllowWalletOverflow(userID)
	require.NoError(t, err)
	assert.False(t, allowWallet)
}

func TestSubscriptionDecisionCacheDatabaseErrorDoesNotPopulateRedis(t *testing.T) {
	redisServer := useUserCacheMiniRedis(t)
	oldDB := DB
	t.Cleanup(func() { DB = oldDB })
	brokenDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := brokenDB.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	DB = brokenDB

	_, err = HasActiveUserSubscription(5303)
	require.Error(t, err)
	assert.False(t, redisServer.Exists(subscriptionDecisionCacheKey(5303)))
}

func TestSubscriptionDecisionCacheTTLIsBoundedByEarliestEndTime(t *testing.T) {
	truncateTables(t)
	redisServer := useUserCacheMiniRedis(t)
	common.SyncFrequency = 60
	const userID = 5304
	now := common.GetTimestamp()
	require.NoError(t, DB.Create(&UserSubscription{
		UserId: userID, PlanId: 1, Status: "active", EndTime: now + 5,
		AllowWalletOverflow: false,
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		UserId: userID, PlanId: 2, Status: "active", EndTime: now + 3600,
		AllowWalletOverflow: true,
	}).Error)
	hasActive, err := HasActiveUserSubscription(userID)
	require.NoError(t, err)
	assert.True(t, hasActive)
	assert.LessOrEqual(t, redisServer.TTL(subscriptionDecisionCacheKey(userID)), 5*time.Second)
	assert.Positive(t, redisServer.TTL(subscriptionDecisionCacheKey(userID)))
	allowWallet, err := UserActiveSubscriptionsAllowWalletOverflow(userID)
	require.NoError(t, err)
	assert.False(t, allowWallet)
	require.NoError(t, DB.Model(&UserSubscription{}).
		Where("user_id = ? AND plan_id = ?", userID, 1).
		Update("end_time", now-1).Error)
	redisServer.FastForward(6 * time.Second)
	allowWallet, err = UserActiveSubscriptionsAllowWalletOverflow(userID)
	require.NoError(t, err)
	assert.True(t, allowWallet)
}

func TestSubscriptionDecisionCacheConcurrentReaders(t *testing.T) {
	truncateTables(t)
	useUserCacheMiniRedis(t)
	const activeUserID, inactiveUserID = 5305, 5306
	require.NoError(t, DB.Create(&UserSubscription{
		UserId: activeUserID, PlanId: 1, Status: "active", EndTime: common.GetTimestamp() + 3600,
		AllowWalletOverflow: false,
	}).Error)
	var queries atomic.Int64
	const callback = "test:subscription_decision_queries"
	require.NoError(t, DB.Callback().Query().Before("gorm:query").Register(callback, func(tx *gorm.DB) {
		if tx.Statement.Table == "user_subscriptions" {
			queries.Add(1)
		}
	}))
	t.Cleanup(func() { _ = DB.Callback().Query().Remove(callback) })

	var workers sync.WaitGroup
	start := make(chan struct{})
	for range 8 {
		for _, userID := range []int{activeUserID, inactiveUserID} {
			workers.Go(func() {
				<-start
				hasActive, err := HasActiveUserSubscription(userID)
				assert.NoError(t, err)
				assert.Equal(t, userID == activeUserID, hasActive)
				allowWallet, err := UserActiveSubscriptionsAllowWalletOverflow(userID)
				assert.NoError(t, err)
				assert.Equal(t, userID == inactiveUserID, allowWallet)
			})
		}
	}
	close(start)
	workers.Wait()
	assert.EqualValues(t, 2, queries.Load(), "concurrent readers should share one database load per user")
}

func TestSubscriptionDecisionCacheInvalidatesCommittedPurchasesAndExpiry(t *testing.T) {
	for _, operation := range []string{"payment", "balance", "expiry"} {
		t.Run(operation, func(t *testing.T) {
			useSubscriptionDecisionTestDB(t)
			useUserCacheMiniRedis(t)
			user := User{Username: "subscription-decision-" + operation, Group: "default", Status: common.UserStatusEnabled}
			require.NoError(t, DB.Create(&user).Error)
			strict := false
			plan := SubscriptionPlan{
				Title: "Strict", DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
				Enabled: true, AllowWalletOverflow: &strict,
			}
			require.NoError(t, DB.Create(&plan).Error)
			InvalidateSubscriptionPlanCache(plan.Id)
			if operation == "expiry" {
				_, err := AdminBindSubscription(user.Id, plan.Id, "test")
				require.NoError(t, err)
			}
			hasActive, err := HasActiveUserSubscription(user.Id)
			require.NoError(t, err)
			assert.Equal(t, operation == "expiry", hasActive)

			switch operation {
			case "payment":
				order := SubscriptionOrder{
					UserId: user.Id, PlanId: plan.Id, TradeNo: "subscription-cache-payment",
					PaymentMethod: PaymentProviderStripe, PaymentProvider: PaymentProviderStripe,
					Status: common.TopUpStatusPending,
				}
				require.NoError(t, order.Insert())
				require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, "", PaymentProviderStripe, ""))
				require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, "", PaymentProviderStripe, ""))
				var count int64
				require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", user.Id).Count(&count).Error)
				assert.EqualValues(t, 1, count, "repeated payment completion must remain idempotent")
			case "balance":
				require.NoError(t, PurchaseSubscriptionWithBalance(user.Id, plan.Id))
			case "expiry":
				require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", user.Id).
					Update("end_time", common.GetTimestamp()-1).Error)
				expired, err := ExpireDueSubscriptions(10)
				require.NoError(t, err)
				assert.Equal(t, 1, expired)
			}
			hasActive, err = HasActiveUserSubscription(user.Id)
			require.NoError(t, err)
			assert.Equal(t, operation != "expiry", hasActive)
			allowWallet, err := UserActiveSubscriptionsAllowWalletOverflow(user.Id)
			require.NoError(t, err)
			assert.Equal(t, operation == "expiry", allowWallet)
		})
	}
}

func TestSubscriptionDecisionCacheInvalidationFailureKeepsCommittedSubscription(t *testing.T) {
	useSubscriptionDecisionTestDB(t)
	server := useUserCacheMiniRedis(t)
	user := User{Username: "subscription-decision-invalidation-failure", Group: "default", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	plan := SubscriptionPlan{Title: "Cache failure", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, Enabled: true}
	require.NoError(t, DB.Create(&plan).Error)
	InvalidateSubscriptionPlanCache(plan.Id)
	hasActive, err := HasActiveUserSubscription(user.Id)
	require.NoError(t, err)
	assert.False(t, hasActive)

	server.SetError("forced redis failure")
	_, err = AdminBindSubscription(user.Id, plan.Id, "test")
	require.NoError(t, err)
	var subscription UserSubscription
	require.NoError(t, DB.Where("user_id = ?", user.Id).First(&subscription).Error)
	assert.Equal(t, "active", subscription.Status)
	server.SetError("")
	hasActive, err = HasActiveUserSubscription(user.Id)
	require.NoError(t, err)
	assert.False(t, hasActive, "a failed invalidation may retain the cached decision until its TTL")
	server.FastForward(3 * time.Second)
	hasActive, err = HasActiveUserSubscription(user.Id)
	require.NoError(t, err)
	assert.True(t, hasActive)
}
