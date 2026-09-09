package model

import (
	"database/sql"
	"errors"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var errSubscriptionLockOrder = errors.New("subscription mutation happened before user serialization")

func setupSubscriptionLockOrderTest(t *testing.T) (*gorm.DB, User, UserSubscription) {
	t.Helper()
	originalDB := DB
	dsn := "file:" + filepath.Join(t.TempDir(), "subscription-lock-order.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)
	require.NoError(t, db.AutoMigrate(&User{}, &UserSubscription{}))
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		require.NoError(t, sqlDB.Close())
	})
	user := User{Id: 9401, Username: "subscription-lock-order", AffCode: "subscription-lock-aff", Status: common.UserStatusEnabled, Group: "pro"}
	require.NoError(t, db.Create(&user).Error)
	sub := UserSubscription{
		UserId: user.Id, PlanId: 1, Status: "active", StartTime: time.Now().Unix() - 100,
		EndTime: time.Now().Unix() + 3600, UpgradeGroup: "pro", PrevUserGroup: "starter",
	}
	require.NoError(t, db.Create(&sub).Error)
	return db, user, sub
}

func registerSubscriptionLockOrderBarrier(t *testing.T, db *gorm.DB) {
	t.Helper()
	var userSerialized atomic.Bool
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register("test:user_before_subscription_update", func(tx *gorm.DB) {
		switch tx.Statement.Table {
		case "users":
			userSerialized.Store(true)
		case "user_subscriptions":
			if !userSerialized.Load() {
				tx.AddError(errSubscriptionLockOrder)
			}
		}
	}))
	require.NoError(t, db.Callback().Delete().Before("gorm:delete").Register("test:user_before_subscription_delete", func(tx *gorm.DB) {
		if tx.Statement.Table == "user_subscriptions" && !userSerialized.Load() {
			tx.AddError(errSubscriptionLockOrder)
		}
	}))
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("test:user_before_subscription_lock", func(tx *gorm.DB) {
		_, inTransaction := tx.Statement.ConnPool.(*sql.Tx)
		if inTransaction && tx.Statement.Table == "user_subscriptions" && !userSerialized.Load() {
			tx.AddError(errSubscriptionLockOrder)
		}
	}))
}

func TestSubscriptionGroupMutationsSerializeUserBeforeSubscription(t *testing.T) {
	t.Run("invalidate", func(t *testing.T) {
		db, _, sub := setupSubscriptionLockOrderTest(t)
		registerSubscriptionLockOrderBarrier(t, db)
		message, err := AdminInvalidateUserSubscription(sub.Id)
		require.NoError(t, err)
		assert.Contains(t, message, "starter")
	})

	t.Run("delete", func(t *testing.T) {
		db, _, sub := setupSubscriptionLockOrderTest(t)
		registerSubscriptionLockOrderBarrier(t, db)
		message, err := AdminDeleteUserSubscription(sub.Id)
		require.NoError(t, err)
		assert.Contains(t, message, "starter")
	})

	t.Run("expire", func(t *testing.T) {
		db, user, sub := setupSubscriptionLockOrderTest(t)
		require.NoError(t, db.Model(&sub).Update("end_time", time.Now().Unix()-1).Error)
		registerSubscriptionLockOrderBarrier(t, db)
		count, err := ExpireDueSubscriptions(10)
		require.NoError(t, err)
		assert.Equal(t, 1, count)
		var current User
		require.NoError(t, db.First(&current, user.Id).Error)
		assert.Equal(t, "starter", current.Group)
	})
}
