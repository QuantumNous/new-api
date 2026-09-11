package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/utils/tests"
)

// lockForUpdate must emit FOR UPDATE on databases that support it and skip
// it on SQLite, where the syntax does not exist.
//
// The dummy dialector is used because SQLite drivers strip locking clauses
// from the generated SQL, which would mask what the helper itself does.
func TestLockForUpdateEmitsRowLock(t *testing.T) {
	dummyDB, err := gorm.Open(tests.DummyDialector{}, &gorm.Config{DryRun: true})
	require.NoError(t, err)
	buildSQL := func() string {
		var rows []Redemption
		return lockForUpdate(dummyDB).Where("id = ?", 1).Find(&rows).Statement.SQL.String()
	}

	t.Cleanup(func() {
		common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	})

	common.SetDatabaseTypes(common.DatabaseTypeMySQL, common.DatabaseTypeSQLite)
	assert.Contains(t, buildSQL(), "FOR UPDATE")

	common.SetDatabaseTypes(common.DatabaseTypePostgreSQL, common.DatabaseTypeSQLite)
	assert.Contains(t, buildSQL(), "FOR UPDATE")

	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	assert.NotContains(t, buildSQL(), "FOR UPDATE")
}

func TestResetUserQuotaLocksUserRowForUpdate(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}))

	user := &User{Username: "reset-quota-lock-user", Quota: 42, AffCode: "reset-quota-lock-user"}
	require.NoError(t, db.Create(user).Error)

	var sawLock bool
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("locking_test:capture", func(tx *gorm.DB) {
		if tx.Statement.Table != "users" {
			return
		}
		_, sawLock = tx.Statement.Clauses["FOR"]
	}))

	previousDB := DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		DB = previousDB
		common.SetDatabaseTypes(previousMain, previousLog)
		common.RedisEnabled = previousRedisEnabled
	})

	common.SetDatabaseTypes(common.DatabaseTypeMySQL, common.DatabaseTypeSQLite)
	oldQuota, err := ResetUserQuota(user.Id, 100)
	require.NoError(t, err)
	assert.Equal(t, 42, oldQuota)
	assert.True(t, sawLock, "resetting a user's quota must lock the row FOR UPDATE on MySQL/PostgreSQL")

	var reloaded User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Equal(t, 100, reloaded.Quota)

	sawLock = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	_, err = ResetUserQuota(user.Id, 200)
	require.NoError(t, err)
	assert.False(t, sawLock, "SQLite does not support FOR UPDATE and must not request it")
}
