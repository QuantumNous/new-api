package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// SetupTestDBForCommissionTests initializes an in-memory SQLite DB with every
// table the commission subsystem's tests need across packages. Exported so
// tests in service/commission and controller can call it. Never invoke from
// production code — it swaps the package-level DB pointer.
func SetupTestDBForCommissionTests(t *testing.T) {
	t.Helper()
	oldDB := DB
	oldLog := LOG_DB
	oldType := common.MainDatabaseType()
	oldRedis := common.RedisEnabled
	DB = nil
	LOG_DB = nil
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	t.Cleanup(func() {
		DB = oldDB
		LOG_DB = oldLog
		common.SetMainDatabaseType(oldType)
		common.RedisEnabled = oldRedis
	})
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	LOG_DB = db // share so RecordLog can write into the same in-memory DB
	require.NoError(t, DB.AutoMigrate(
		&User{}, &TopUp{}, &Log{},
		&CommissionRule{}, &CommissionRecord{}, &CommissionRedemption{},
		&UserCommissionStats{}, &UserReferralPath{},
	))
}
