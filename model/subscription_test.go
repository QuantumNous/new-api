package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionTestDB(t *testing.T) func() {
	t.Helper()

	oldDB := DB
	oldLogDB := LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldUsingMySQL := common.UsingMySQL
	oldRedisEnabled := common.RedisEnabled

	testDB, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "subscription-test.db")), &gorm.Config{})
	require.NoError(t, err)

	DB = testDB
	LOG_DB = testDB
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	common.RedisEnabled = false
	initCol()

	return func() {
		DB = oldDB
		LOG_DB = oldLogDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingPostgreSQL = oldUsingPostgreSQL
		common.UsingMySQL = oldUsingMySQL
		common.RedisEnabled = oldRedisEnabled
		initCol()
	}
}

func TestEnsureSubscriptionPlanTableSQLiteAddsPurchaseLinkColumn(t *testing.T) {
	cleanup := setupSubscriptionTestDB(t)
	defer cleanup()

	require.NoError(t, DB.Exec(`CREATE TABLE subscription_plans (
		id integer primary key,
		title varchar(128) NOT NULL,
		subtitle varchar(255) DEFAULT '',
		price_amount decimal(10,6) NOT NULL,
		currency varchar(8) NOT NULL DEFAULT 'USD',
		duration_unit varchar(16) NOT NULL DEFAULT 'month',
		duration_value integer NOT NULL DEFAULT 1,
		custom_seconds bigint NOT NULL DEFAULT 0,
		enabled numeric DEFAULT 1,
		sort_order integer DEFAULT 0,
		stripe_price_id varchar(128) DEFAULT '',
		creem_product_id varchar(128) DEFAULT '',
		max_purchase_per_user integer DEFAULT 0,
		upgrade_group varchar(64) DEFAULT '',
		total_amount bigint NOT NULL DEFAULT 0,
		quota_reset_period varchar(16) DEFAULT 'never',
		quota_reset_custom_seconds bigint DEFAULT 0,
		created_at bigint,
		updated_at bigint
	)`).Error)

	require.NoError(t, ensureSubscriptionPlanTableSQLite())

	type tableColumn struct {
		Name string `gorm:"column:name"`
	}
	var cols []tableColumn
	require.NoError(t, DB.Raw("PRAGMA table_info(`subscription_plans`)").Scan(&cols).Error)

	columnNames := make([]string, 0, len(cols))
	for _, col := range cols {
		columnNames = append(columnNames, col.Name)
	}
	require.Contains(t, columnNames, "purchase_link")
}
