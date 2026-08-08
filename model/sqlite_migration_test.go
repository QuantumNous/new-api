package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSQLiteMigrateDBCanRunTwiceOnSameDatabase(t *testing.T) {
	originalDB := DB
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled
	t.Cleanup(func() {
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
	})

	dbPath := filepath.Join(t.TempDir(), "startup.db") + "?_pragma=busy_timeout(5000)"
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	sqlDB.SetMaxOpenConns(1)

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	require.NoError(t, migrateDB())
	require.NoError(t, migrateDB())

	require.True(t, db.Migrator().HasTable(&StripeBonusClaim{}))
	require.True(t, db.Migrator().HasIndex(&StripeBonusClaim{}, "idx_stripe_bonus_claims_card_fingerprint"))
	require.True(t, db.Migrator().HasTable(&TopUpBonusClaim{}))
	require.True(t, db.Migrator().HasIndex(&TopUpBonusClaim{}, "idx_topup_bonus_user_tier_seq"))
}
