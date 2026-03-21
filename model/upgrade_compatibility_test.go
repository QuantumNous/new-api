//go:build upgradeverify

package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUpgradeCompatibilityMigratesLegacySubscriptionPlanSQLite(t *testing.T) {
	withUpgradeVerifySQLiteDB(t, func(db *gorm.DB) {
		require.NoError(t, db.Exec(`
			CREATE TABLE subscription_plans (
				id integer PRIMARY KEY,
				title varchar(128) NOT NULL,
				price_amount double NOT NULL,
				currency varchar(8) NOT NULL DEFAULT 'USD',
				duration_unit varchar(16) NOT NULL DEFAULT 'month',
				duration_value integer NOT NULL DEFAULT 1,
				enabled numeric DEFAULT 1,
				sort_order integer DEFAULT 0,
				stripe_price_id varchar(128) DEFAULT '',
				created_at bigint,
				updated_at bigint
			)
		`).Error)
		require.NoError(t, db.Exec(`
			INSERT INTO subscription_plans
				(id, title, price_amount, currency, duration_unit, duration_value, enabled, sort_order, stripe_price_id, created_at, updated_at)
			VALUES
				(1, 'Legacy monthly', 9.9, 'USD', 'month', 1, 1, 5, 'stripe_legacy', 111, 222)
		`).Error)
	})

	requiredColumns := []string{
		"subtitle",
		"custom_seconds",
		"creem_product_id",
		"max_purchase_per_user",
		"upgrade_group",
		"total_amount",
		"quota_reset_period",
		"quota_reset_custom_seconds",
	}
	for _, column := range requiredColumns {
		require.Truef(t, DB.Migrator().HasColumn(&SubscriptionPlan{}, column), "expected migrated column %s", column)
	}

	var plan struct {
		Title                   string  `gorm:"column:title"`
		PriceAmount             float64 `gorm:"column:price_amount"`
		UpgradeGroup            string  `gorm:"column:upgrade_group"`
		QuotaResetPeriod        string  `gorm:"column:quota_reset_period"`
		QuotaResetCustomSeconds int64   `gorm:"column:quota_reset_custom_seconds"`
		TotalAmount             int64   `gorm:"column:total_amount"`
	}
	require.NoError(t, DB.Table("subscription_plans").Where("id = ?", 1).Take(&plan).Error)
	require.Equal(t, "Legacy monthly", plan.Title)
	require.Equal(t, 9.9, plan.PriceAmount)
	require.Equal(t, "", plan.UpgradeGroup)
	require.Equal(t, "never", plan.QuotaResetPeriod)
	require.EqualValues(t, 0, plan.QuotaResetCustomSeconds)
	require.EqualValues(t, 0, plan.TotalAmount)
}

func TestUpgradeCompatibilityBackfillsSetupForLegacyRootSQLite(t *testing.T) {
	withUpgradeVerifySQLiteDB(t, nil)

	root := User{
		Username:    "legacy-root",
		Password:    "hashed-password",
		Role:        common.RoleRootUser,
		Status:      common.UserStatusEnabled,
		DisplayName: "Legacy Root",
		Quota:       100,
	}
	require.NoError(t, DB.Create(&root).Error)
	require.NoError(t, DB.Where("1 = 1").Delete(&Setup{}).Error)

	CheckSetup()

	var setup Setup
	require.NoError(t, DB.First(&setup).Error)
	require.Equal(t, common.Version, setup.Version)
	require.NotZero(t, setup.InitializedAt)
}

func withUpgradeVerifySQLiteDB(t *testing.T, seed func(db *gorm.DB)) {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "upgrade-compat.sqlite")
	legacyDB, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	require.NoError(t, err)

	if seed != nil {
		seed(legacyDB)
	}

	sqlDB, err := legacyDB.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())

	prevDB := DB
	prevLogDB := LOG_DB
	prevSQLitePath := common.SQLitePath
	prevUsingSQLite := common.UsingSQLite
	prevUsingMySQL := common.UsingMySQL
	prevUsingPostgreSQL := common.UsingPostgreSQL
	prevIsMasterNode := common.IsMasterNode
	prevLogSqlType := common.LogSqlType

	t.Cleanup(func() {
		if LOG_DB != nil && LOG_DB != DB {
			_ = closeDB(LOG_DB)
		}
		if DB != nil {
			_ = closeDB(DB)
		}
		DB = prevDB
		LOG_DB = prevLogDB
		common.SQLitePath = prevSQLitePath
		common.UsingSQLite = prevUsingSQLite
		common.UsingMySQL = prevUsingMySQL
		common.UsingPostgreSQL = prevUsingPostgreSQL
		common.IsMasterNode = prevIsMasterNode
		common.LogSqlType = prevLogSqlType
	})

	DB = nil
	LOG_DB = nil
	common.SQLitePath = dbPath
	common.UsingSQLite = false
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.IsMasterNode = true
	common.LogSqlType = ""

	require.NoError(t, InitDB())
}
