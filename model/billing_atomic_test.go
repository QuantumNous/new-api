package model

import (
	"fmt"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAtomicBillingTestDB(t *testing.T) {
	t.Helper()
	oldDB := DB
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &Token{}))
	DB = db
	t.Cleanup(func() { DB = oldDB })
}

func TestRefundWalletAndTokenQuotaAtomicSuccess(t *testing.T) {
	setupAtomicBillingTestDB(t)
	require.NoError(t, DB.Create(&User{Id: 1, Username: "atomic-user", Quota: 100}).Error)
	require.NoError(t, DB.Create(&Token{Id: 2, UserId: 1, Key: "atomic-key", RemainQuota: -40, UsedQuota: 40}).Error)

	require.NoError(t, RefundWalletAndTokenQuota(1, 40, 2, "atomic-key", 40, false))

	var user User
	var token Token
	require.NoError(t, DB.First(&user, 1).Error)
	require.NoError(t, DB.First(&token, 2).Error)
	require.Equal(t, 140, user.Quota)
	require.Equal(t, 0, token.RemainQuota)
	require.Equal(t, 0, token.UsedQuota)
}

func TestRefundWalletAndTokenQuotaRollsBackWhenTokenMissing(t *testing.T) {
	setupAtomicBillingTestDB(t)
	require.NoError(t, DB.Create(&User{Id: 1, Username: "rollback-user", Quota: 100}).Error)

	err := RefundWalletAndTokenQuota(1, 40, 999, "missing-key", 40, false)
	require.Error(t, err)

	var user User
	require.NoError(t, DB.First(&user, 1).Error)
	require.Equal(t, 100, user.Quota, "wallet refund must roll back when token refund fails")
}

func TestAdjustWalletAndTokenQuotaRejectsConcurrentOverspend(t *testing.T) {
	setupAtomicBillingTestDB(t)
	require.NoError(t, DB.Create(&User{Id: 1, Username: "limited-user", Quota: 30}).Error)
	require.NoError(t, DB.Create(&Token{Id: 2, UserId: 1, Key: "limited-key", RemainQuota: 100, UsedQuota: 0}).Error)

	err := AdjustWalletAndTokenQuota(1, -40, 2, "limited-key", -40, false)
	require.Error(t, err)

	var user User
	var token Token
	require.NoError(t, DB.First(&user, 1).Error)
	require.NoError(t, DB.First(&token, 2).Error)
	require.Equal(t, 30, user.Quota)
	require.Equal(t, 100, token.RemainQuota)
	require.Equal(t, 0, token.UsedQuota)
}
