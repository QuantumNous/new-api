package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupNewUserBonusModelTest(t *testing.T) {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled
	originalQuotaForNewUser := common.QuotaForNewUser

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/new_user_bonus.db"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	common.QuotaForNewUser = 777

	require.NoError(t, db.AutoMigrate(&User{}, &Log{}, &NewUserBonusClaim{}))

	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
		common.QuotaForNewUser = originalQuotaForNewUser
	})
}

func createRegistrationIPBonusUser(t *testing.T, username string, registrationIP string) *User {
	t.Helper()

	user := &User{Username: username, Password: "password123", Role: common.RoleCommonUser}
	require.NoError(t, user.InsertWithRegistrationIP(0, registrationIP))
	require.NoError(t, DB.First(user, "username = ?", username).Error)
	return user
}

func TestNewUserBonusLimitedToFirstTwoUsersPerRegistrationIP(t *testing.T) {
	setupNewUserBonusModelTest(t)

	first := createRegistrationIPBonusUser(t, "ip_bonus_first", "203.0.113.8")
	second := createRegistrationIPBonusUser(t, "ip_bonus_second", "203.0.113.8")
	third := createRegistrationIPBonusUser(t, "ip_bonus_third", "203.0.113.8")
	otherIP := createRegistrationIPBonusUser(t, "ip_bonus_other", "203.0.113.9")

	require.Equal(t, 777, first.Quota)
	require.True(t, first.NewUserBonusGiven)
	require.Equal(t, "203.0.113.8", first.RegistrationIP)

	require.Equal(t, 777, second.Quota)
	require.True(t, second.NewUserBonusGiven)

	require.Zero(t, third.Quota)
	require.False(t, third.NewUserBonusGiven)
	require.Equal(t, "203.0.113.8", third.RegistrationIP)

	require.Equal(t, 777, otherIP.Quota)
	require.True(t, otherIP.NewUserBonusGiven)

	var claims int64
	require.NoError(t, DB.Model(&NewUserBonusClaim{}).Where("registration_ip = ?", "203.0.113.8").Count(&claims).Error)
	require.EqualValues(t, 2, claims)
}

func TestNewUserBonusWithoutRegistrationIPKeepsLegacyGrant(t *testing.T) {
	setupNewUserBonusModelTest(t)

	user := &User{Username: "legacy_bonus_user", Password: "password123", Role: common.RoleCommonUser}
	require.NoError(t, user.Insert(0))
	require.NoError(t, DB.First(user, "username = ?", user.Username).Error)

	require.Equal(t, 777, user.Quota)
	require.True(t, user.NewUserBonusGiven)
	require.Empty(t, user.RegistrationIP)
}
