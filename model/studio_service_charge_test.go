package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupStudioServiceChargeTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	priorDB := DB
	priorRedisEnabled := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		DB = priorDB
		common.RedisEnabled = priorRedisEnabled
	})
	require.NoError(t, DB.AutoMigrate(&User{}, &Token{}, &StudioServiceCharge{}))
	return db
}

func TestStudioServiceChargeClaimIsIdempotent(t *testing.T) {
	setupStudioServiceChargeTestDB(t)

	first, created, err := ClaimStudioServiceCharge(7, "job-1", "id-photo", 123)
	require.NoError(t, err)
	assert.True(t, created)
	require.NoError(t, CompleteStudioServiceCharge(first.Id, 2.7))

	second, created, err := ClaimStudioServiceCharge(7, "job-1", "id-photo", 123)
	require.NoError(t, err)
	assert.False(t, created)
	assert.Equal(t, StudioServiceChargeDone, second.Status)
	assert.Equal(t, 2.7, second.ChargedPts)

	_, created, err = ClaimStudioServiceCharge(8, "job-1", "id-photo", 123)
	require.NoError(t, err)
	assert.True(t, created, "job IDs are isolated per user")
}

func TestChargeStudioServiceFeeWithoutTokenIsAtomicAndIdempotent(t *testing.T) {
	db := setupStudioServiceChargeTestDB(t)
	require.NoError(t, db.Create(&User{Id: 21, Username: "managed-user", Password: "password", Quota: 1000}).Error)

	charge, charged, err := ChargeStudioServiceFee(21, 0, "job-managed", "id-photo", 300, 2.7)
	require.NoError(t, err)
	assert.True(t, charged)
	assert.Equal(t, StudioServiceChargeDone, charge.Status)

	var user User
	require.NoError(t, db.First(&user, 21).Error)
	assert.Equal(t, 700, user.Quota)

	replayed, charged, err := ChargeStudioServiceFee(21, 0, "job-managed", "id-photo", 300, 2.7)
	require.NoError(t, err)
	assert.False(t, charged)
	assert.Equal(t, charge.Id, replayed.Id)
	require.NoError(t, db.First(&user, 21).Error)
	assert.Equal(t, 700, user.Quota)
}

func TestChargeStudioServiceFeeWithTokenUpdatesWalletAndTokenTogether(t *testing.T) {
	db := setupStudioServiceChargeTestDB(t)
	require.NoError(t, db.Create(&User{Id: 22, Username: "key-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&Token{Id: 32, UserId: 22, Key: "service-token", RemainQuota: 1000}).Error)

	_, charged, err := ChargeStudioServiceFee(22, 32, "job-key", "id-photo", 300, 2.7)
	require.NoError(t, err)
	assert.True(t, charged)

	var user User
	var token Token
	require.NoError(t, db.First(&user, 22).Error)
	require.NoError(t, db.First(&token, 32).Error)
	assert.Equal(t, 700, user.Quota)
	assert.Equal(t, 700, token.RemainQuota)
	assert.Equal(t, 300, token.UsedQuota)
}

func TestChargeStudioServiceFeeRejectsInsufficientWalletWithoutPartialWrites(t *testing.T) {
	db := setupStudioServiceChargeTestDB(t)
	require.NoError(t, db.Create(&User{Id: 23, Username: "low-user", Password: "password", Quota: 100}).Error)

	_, charged, err := ChargeStudioServiceFee(23, 0, "job-low", "id-photo", 300, 2.7)
	require.ErrorIs(t, err, ErrStudioServiceChargeInsufficientWallet)
	assert.False(t, charged)

	var user User
	require.NoError(t, db.First(&user, 23).Error)
	assert.Equal(t, 100, user.Quota)
	var count int64
	require.NoError(t, db.Model(&StudioServiceCharge{}).Where("user_id = ?", 23).Count(&count).Error)
	assert.Zero(t, count)
}
