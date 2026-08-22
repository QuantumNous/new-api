package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// Regression test: a subscription_plans table created by a previous boot
// (raw DDL with decimal(10,6), see ensureSubscriptionPlanTableSQLite) must
// survive AutoMigrate on restart. glebarez/sqlite v1.9.0's AlterColumn
// regex-replaces the raw DDL field and its lazy `.*?(,|...)` stops at the
// comma inside decimal(10,6), leaving an orphan `6) NOT NULL` in the DDL;
// the subsequent parseDDL then fails with "invalid DDL, unbalanced brackets"
// and startup aborts. This is the root cause behind the v0.10.8 SQLite
// boot failures (#2823), which were previously worked around by excluding
// SubscriptionPlan from AutoMigrate on SQLite.
func TestSubscriptionPlanAutoMigrateOnPopulatedSQLite(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/test.db"), &gorm.Config{})
	require.NoError(t, err)

	require.NoError(t, db.Exec(`CREATE TABLE `+"`subscription_plans`"+` (
`+"`id`"+` integer,
`+"`title`"+` varchar(128) NOT NULL,
`+"`price_amount`"+` decimal(10,6) NOT NULL,
`+"`currency`"+` varchar(8) NOT NULL DEFAULT 'USD',
`+"`enabled`"+` numeric DEFAULT 1,
`+"`created_at`"+` bigint,
`+"`updated_at`"+` bigint,
PRIMARY KEY (`+"`id`"+`)
)`).Error)

	// Second boot: AutoMigrate must parse the existing DDL without error.
	require.NoError(t, db.AutoMigrate(&SubscriptionPlan{}))
	// Repeated migrations must stay stable.
	require.NoError(t, db.AutoMigrate(&SubscriptionPlan{}))
}
