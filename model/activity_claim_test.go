package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func useActivityClaimTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := DB
	previousType := common.MainDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &ActivityClaim{}))
	DB = db
	common.RedisEnabled = false
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = previousDB
		common.RedisEnabled = previousRedisEnabled
		common.SetMainDatabaseType(previousType)
	})
	return db
}

func TestClaimActivityRewardIsAtomicAndIdempotent(t *testing.T) {
	db := useActivityClaimTestDB(t)
	user := User{Username: "activity-user", Password: "password", AffCode: "activity-aff", Quota: 100}
	require.NoError(t, db.Create(&user).Error)

	require.NoError(t, ClaimActivityReward(user.Id, "newcomer-v1", 25))
	require.Error(t, ClaimActivityReward(user.Id, "newcomer-v1", 25))

	require.NoError(t, db.First(&user, user.Id).Error)
	assert.Equal(t, 125, user.Quota)
	var claimCount int64
	require.NoError(t, db.Model(&ActivityClaim{}).Where("user_id = ?", user.Id).Count(&claimCount).Error)
	assert.Equal(t, int64(1), claimCount)

	err := ClaimActivityReward(user.Id+1000, "missing-user", 25)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	require.NoError(t, db.Model(&ActivityClaim{}).Where("activity_key = ?", "missing-user").Count(&claimCount).Error)
	assert.Zero(t, claimCount)
}
