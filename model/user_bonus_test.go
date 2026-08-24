package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/alicebob/miniredis/v2"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
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
	originalRDB := common.RDB
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
		common.RDB = originalRDB
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

func TestNewUserBonusCanonicalizesEquivalentRegistrationIPs(t *testing.T) {
	setupNewUserBonusModelTest(t)

	first := createRegistrationIPBonusUser(t, "ip_canonical_first", "::ffff:203.0.113.8")
	second := createRegistrationIPBonusUser(t, "ip_canonical_second", "203.0.113.8")
	third := createRegistrationIPBonusUser(t, "ip_canonical_third", " 203.0.113.8 ")

	require.Equal(t, 777, first.Quota)
	require.True(t, first.NewUserBonusGiven)
	require.Equal(t, "203.0.113.8", first.RegistrationIP)

	require.Equal(t, 777, second.Quota)
	require.True(t, second.NewUserBonusGiven)

	require.Zero(t, third.Quota)
	require.False(t, third.NewUserBonusGiven)

	var claims int64
	require.NoError(t, DB.Model(&NewUserBonusClaim{}).Where("registration_ip = ?", "203.0.113.8").Count(&claims).Error)
	require.EqualValues(t, 2, claims)
}

func TestNewUserBonusRegistrationIPLimitExpiresAfterSevenDays(t *testing.T) {
	setupNewUserBonusModelTest(t)

	first := createRegistrationIPBonusUser(t, "ip_week_first", "203.0.113.10")
	second := createRegistrationIPBonusUser(t, "ip_week_second", "203.0.113.10")
	third := createRegistrationIPBonusUser(t, "ip_week_third", "203.0.113.10")

	require.Equal(t, 777, first.Quota)
	require.Equal(t, 777, second.Quota)
	require.Zero(t, third.Quota)

	expiredAt := common.GetTimestamp() - int64(7*24*60*60) - 1
	require.NoError(t, DB.Model(&NewUserBonusClaim{}).
		Where("registration_ip = ?", "203.0.113.10").
		Update("created_at", expiredAt).Error)

	fourth := createRegistrationIPBonusUser(t, "ip_week_fourth", "203.0.113.10")
	fifth := createRegistrationIPBonusUser(t, "ip_week_fifth", "203.0.113.10")
	sixth := createRegistrationIPBonusUser(t, "ip_week_sixth", "203.0.113.10")

	require.Equal(t, 777, fourth.Quota)
	require.True(t, fourth.NewUserBonusGiven)
	require.Equal(t, 777, fifth.Quota)
	require.True(t, fifth.NewUserBonusGiven)
	require.Zero(t, sixth.Quota)
	require.False(t, sixth.NewUserBonusGiven)

	var claims int64
	require.NoError(t, DB.Model(&NewUserBonusClaim{}).Where("registration_ip = ?", "203.0.113.10").Count(&claims).Error)
	require.EqualValues(t, 2, claims)
}

func TestNewUserBonusRegistrationIPLimitUsesRedisWindowWhenEnabled(t *testing.T) {
	setupNewUserBonusModelTest(t)

	mr := miniredis.RunT(t)
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	t.Cleanup(func() {
		require.NoError(t, common.RDB.Close())
	})

	first := createRegistrationIPBonusUser(t, "ip_redis_first", "203.0.113.11")
	second := createRegistrationIPBonusUser(t, "ip_redis_second", "203.0.113.11")
	third := createRegistrationIPBonusUser(t, "ip_redis_third", "203.0.113.11")

	require.Equal(t, 777, first.Quota)
	require.Equal(t, 777, second.Quota)
	require.Zero(t, third.Quota)

	mr.FastForward(7*24*time.Hour + time.Second)

	fourth := createRegistrationIPBonusUser(t, "ip_redis_fourth", "203.0.113.11")
	fifth := createRegistrationIPBonusUser(t, "ip_redis_fifth", "203.0.113.11")
	sixth := createRegistrationIPBonusUser(t, "ip_redis_sixth", "203.0.113.11")

	require.Equal(t, 777, fourth.Quota)
	require.True(t, fourth.NewUserBonusGiven)
	require.Equal(t, 777, fifth.Quota)
	require.True(t, fifth.NewUserBonusGiven)
	require.Zero(t, sixth.Quota)
	require.False(t, sixth.NewUserBonusGiven)
}

func TestNewUserBonusWithoutRegistrationIPDoesNotGrantSignupBonus(t *testing.T) {
	setupNewUserBonusModelTest(t)

	user := &User{Username: "missing_ip_bonus_user", Password: "password123", Role: common.RoleCommonUser}
	require.NoError(t, user.Insert(0))
	require.NoError(t, DB.First(user, "username = ?", user.Username).Error)

	require.Zero(t, user.Quota)
	require.False(t, user.NewUserBonusGiven)
	require.Empty(t, user.RegistrationIP)
}
