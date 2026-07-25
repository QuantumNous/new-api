package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestEmailVerificationClearedWithEmailBinding(t *testing.T) {
	originalDB := DB
	originalRedisEnabled := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		DB = originalDB
		common.RedisEnabled = originalRedisEnabled
	})
	require.NoError(t, DB.AutoMigrate(&User{}))

	user := User{
		Username:        "verified-email-user",
		Password:        "hashed-password",
		Email:           "verified@example.com",
		EmailVerifiedAt: 123456,
	}
	require.NoError(t, DB.Create(&user).Error)

	require.NoError(t, user.ClearBinding("email"))
	require.Empty(t, user.Email)
	require.Zero(t, user.EmailVerifiedAt)

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Empty(t, stored.Email)
	require.Zero(t, stored.EmailVerifiedAt)
}
