package model

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type legacyQuotaLifecycleStateSchema struct {
	Id           int64  `json:"id" gorm:"primaryKey"`
	UserId       int    `json:"user_id" gorm:"not null;uniqueIndex:idx_quota_lifecycle_scope,priority:1;index"`
	ScopeType    string `json:"scope_type" gorm:"type:varchar(32);not null;uniqueIndex:idx_quota_lifecycle_scope,priority:2"`
	ScopeId      string `json:"scope_id" gorm:"type:varchar(128);not null;uniqueIndex:idx_quota_lifecycle_scope,priority:3"`
	Cycle        string `json:"cycle" gorm:"type:varchar(64);not null;index"`
	Balance      int64  `json:"balance" gorm:"not null;default:0"`
	Threshold    int64  `json:"threshold" gorm:"not null;default:0"`
	Source       string `json:"source" gorm:"type:varchar(64);not null"`
	SourceData   string `json:"source_data" gorm:"type:text;not null"`
	StateVersion int64  `json:"state_version" gorm:"not null;default:1"`
	CreatedAt    int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (legacyQuotaLifecycleStateSchema) TableName() string {
	return "quota_lifecycle_states"
}

func TestSQLiteQuotaLifecycleMigrationWidensLegacyCycleAndSourceColumns(t *testing.T) {
	originalDB := DB
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	t.Cleanup(func() {
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})

	dbPath := filepath.Join(t.TempDir(), "quota-lifecycle-legacy.db") + "?_pragma=busy_timeout(5000)"
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

	require.NoError(t, DB.AutoMigrate(&legacyQuotaLifecycleStateSchema{}))

	legacyCycle := strings.Repeat("c", 64)
	legacySource := strings.Repeat("s", 64)
	require.NoError(t, DB.Create(&legacyQuotaLifecycleStateSchema{
		UserId:       101,
		ScopeType:    QuotaLifecycleScopeWallet,
		ScopeId:      "101",
		Cycle:        legacyCycle,
		Balance:      123,
		Threshold:    99,
		Source:       legacySource,
		SourceData:   `{"legacy":true}`,
		StateVersion: 1,
	}).Error)

	require.Equal(t, "varchar(64)", strings.ToLower(recallSQLiteColumnType(t, "quota_lifecycle_states", "cycle")))
	require.Equal(t, "varchar(64)", strings.ToLower(recallSQLiteColumnType(t, "quota_lifecycle_states", "source")))

	require.NoError(t, migrateDBFast())
	require.Equal(t, "varchar(255)", strings.ToLower(recallSQLiteColumnType(t, "quota_lifecycle_states", "cycle")))
	require.Equal(t, "varchar(255)", strings.ToLower(recallSQLiteColumnType(t, "quota_lifecycle_states", "source")))

	require.NoError(t, migrateDBFast())

	require.Equal(t, "varchar(255)", strings.ToLower(recallSQLiteColumnType(t, "quota_lifecycle_states", "cycle")))
	require.Equal(t, "varchar(255)", strings.ToLower(recallSQLiteColumnType(t, "quota_lifecycle_states", "source")))

	var stored QuotaLifecycleState
	require.NoError(t, DB.First(&stored, "user_id = ? AND scope_type = ? AND scope_id = ?", 101, QuotaLifecycleScopeWallet, "101").Error)
	require.Equal(t, legacyCycle, stored.Cycle)
	require.Equal(t, legacySource, stored.Source)
	require.Equal(t, int64(123), stored.Balance)
	require.Equal(t, int64(99), stored.Threshold)

	longCycle := strings.Repeat("c", 200)
	longSource := strings.Repeat("s", 200)
	require.NoError(t, DB.Create(&QuotaLifecycleState{
		UserId:       102,
		ScopeType:    QuotaLifecycleScopeWallet,
		ScopeId:      "102",
		Cycle:        longCycle,
		Balance:      1,
		Threshold:    0,
		Source:       longSource,
		SourceData:   `{"legacy":false}`,
		StateVersion: 1,
	}).Error)
	var widened QuotaLifecycleState
	require.NoError(t, DB.First(&widened, "user_id = ? AND scope_type = ? AND scope_id = ?", 102, QuotaLifecycleScopeWallet, "102").Error)
	require.Equal(t, longCycle, widened.Cycle)
	require.Equal(t, longSource, widened.Source)
}
