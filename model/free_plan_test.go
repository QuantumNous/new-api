package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupFreePlanTest(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/freeplan.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &SubscriptionPlan{}, &UserSubscription{}, &FreePlanGrant{}, &Log{}))
	originalDB, originalLogDB := DB, LOG_DB
	DB = db
	LOG_DB = db
	t.Cleanup(func() {
		DB = originalDB
		LOG_DB = originalLogDB
	})
}

func TestEnsureFreePlanSeedIdempotent(t *testing.T) {
	setupFreePlanTest(t)

	p1, err := EnsureFreePlanSeed()
	require.NoError(t, err)
	require.NotNil(t, p1)
	require.Equal(t, FreePlanTitle, p1.Title)
	require.False(t, p1.Enabled)
	require.Equal(t, 1, p1.MaxPurchasePerUser)
	require.Equal(t, SubscriptionResetNever, p1.QuotaResetPeriod)
	require.EqualValues(t, 500000, p1.TotalAmount) // $1 等值

	p2, err := EnsureFreePlanSeed()
	require.NoError(t, err)
	require.Equal(t, p1.Id, p2.Id)

	var count int64
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Count(&count).Error)
	require.EqualValues(t, 1, count)
}

func TestGrantFreePlanToUserIdempotent(t *testing.T) {
	setupFreePlanTest(t)
	require.NoError(t, DB.Create(&User{Username: "u1", Password: "x", Group: "default"}).Error)
	var user User
	require.NoError(t, DB.Where("username = ?", "u1").First(&user).Error)

	require.NoError(t, GrantFreePlanToUser(user.Id))
	// 重复发放：幂等成功，不新增订阅
	require.NoError(t, GrantFreePlanToUser(user.Id))

	var subs []UserSubscription
	require.NoError(t, DB.Where("user_id = ?", user.Id).Find(&subs).Error)
	require.Len(t, subs, 1)
	require.Equal(t, "free", subs[0].Source)
	require.Equal(t, "active", subs[0].Status)
	require.EqualValues(t, 500000, subs[0].AmountTotal)
	require.EqualValues(t, 0, subs[0].NextResetTime) // never reset（一次性）
	require.Greater(t, subs[0].EndTime, subs[0].StartTime)
}

func TestFinalizeUserCreationGrantsFreePlanWhenEnabled(t *testing.T) {
	setupFreePlanTest(t)
	original := setting.FreePlanOnSignupEnabled
	t.Cleanup(func() { setting.FreePlanOnSignupEnabled = original })

	require.NoError(t, DB.Create(&User{Username: "u2", Password: "x", Group: "default"}).Error)
	var user User
	require.NoError(t, DB.Where("username = ?", "u2").First(&user).Error)

	// 开关关闭：不发放
	setting.FreePlanOnSignupEnabled = false
	user.FinalizeOAuthUserCreation(0)
	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", user.Id).Count(&count).Error)
	require.EqualValues(t, 0, count)

	// 开关打开：发放一份，重复调用不加发
	setting.FreePlanOnSignupEnabled = true
	user.FinalizeOAuthUserCreation(0)
	user.FinalizeOAuthUserCreation(0)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", user.Id).Count(&count).Error)
	require.EqualValues(t, 1, count)
}
