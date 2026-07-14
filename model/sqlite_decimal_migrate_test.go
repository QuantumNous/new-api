package model

import (
	"fmt"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestSQLiteDecimalMoneyTablesSurviveRemigrate(t *testing.T) {
	prevDB, prevLog := DB, LOG_DB
	prevSQLite, prevMySQL, prevPG := common.UsingSQLite, common.UsingMySQL, common.UsingPostgreSQL
	prevRedis := common.RedisEnabled
	t.Cleanup(func() {
		DB, LOG_DB = prevDB, prevLog
		common.UsingSQLite, common.UsingMySQL, common.UsingPostgreSQL = prevSQLite, prevMySQL, prevPG
		common.RedisEnabled = prevRedis
	})

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := filepath.Join(t.TempDir(), "decimal_money.db")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })

	DB = db
	LOG_DB = db

	// First migration (create).
	require.NoError(t, ensureDecimalMoneyTablesSQLite())
	require.NoError(t, ensureSubscriptionPlanTableSQLite())
	require.NoError(t, DB.AutoMigrate(&BillingSubscription{}, &RecurringChargeAttempt{}))

	// Seed a row so rewrite paths would risk data loss if AutoMigrate ran.
	require.NoError(t, DB.Create(&TopUp{
		UserId: 1, Amount: 100, Money: 1.5, TradeNo: "t1", Status: "pending",
		DisplayAmount: 1.5, DisplayCurrency: "USD",
	}).Error)

	// Second migration (restart): must not fail with unbalanced brackets.
	require.NoError(t, ensureDecimalMoneyTablesSQLite())
	require.NoError(t, ensureSubscriptionPlanTableSQLite())
	require.NoError(t, DB.AutoMigrate(&BillingSubscription{}, &RecurringChargeAttempt{}))

	var n int64
	require.NoError(t, DB.Model(&TopUp{}).Where("trade_no = ?", "t1").Count(&n).Error)
	require.EqualValues(t, 1, n)

	// Ensure alipay_enabled column is present on plans.
	require.NoError(t, ensureSubscriptionPlanTableSQLite())
	var cols []struct {
		Name string `gorm:"column:name"`
	}
	require.NoError(t, DB.Raw("PRAGMA table_info(`subscription_plans`)").Scan(&cols).Error)
	found := false
	for _, c := range cols {
		if c.Name == "alipay_enabled" {
			found = true
			break
		}
	}
	require.True(t, found, fmt.Sprintf("cols=%v", cols))
}
