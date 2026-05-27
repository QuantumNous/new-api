package model

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type legacyQuotaUser struct {
	Id         int `gorm:"primaryKey"`
	Username   string
	Password   string
	Status     int
	Role       int
	Quota      int `gorm:"type:int;default:0"`
	UsedQuota  int `gorm:"column:used_quota;type:int;default:0"`
	AffQuota   int `gorm:"column:aff_quota;type:int;default:0"`
	AffHistory int `gorm:"column:aff_history;type:int;default:0"`
}

func (legacyQuotaUser) TableName() string { return "users" }

type bigintQuotaUser struct {
	Id         int `gorm:"primaryKey"`
	Username   string
	Password   string
	Status     int
	Role       int
	Quota      int64 `gorm:"type:bigint;default:0"`
	UsedQuota  int64 `gorm:"column:used_quota;type:bigint;default:0"`
	AffQuota   int64 `gorm:"column:aff_quota;type:bigint;default:0"`
	AffHistory int64 `gorm:"column:aff_history;type:bigint;default:0"`
}

func (bigintQuotaUser) TableName() string { return "users" }

func sqliteColumnTypeForQuotaTest(t *testing.T, tableName string, columnName string) string {
	t.Helper()
	var rows []struct {
		Name string `gorm:"column:name"`
		Type string `gorm:"column:type"`
	}
	require.NoError(t, DB.Raw(fmt.Sprintf("PRAGMA table_info(`%s`)", tableName)).Scan(&rows).Error)
	for _, row := range rows {
		if row.Name == columnName {
			return strings.ToLower(row.Type)
		}
	}
	t.Fatalf("column %s.%s not found", tableName, columnName)
	return ""
}

func TestQuotaColumnsUseBigint(t *testing.T) {
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "used_quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "aff_quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "aff_history"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "tokens", "remain_quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "tokens", "used_quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "logs", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "redemptions", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "quota_data", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "tasks", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "midjourneys", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "checkins", "quota_awarded"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "channels", "used_quota"))
}

func TestUserQuotaStoresAboveInt32(t *testing.T) {
	truncateTables(t)

	const largeQuota int64 = 3_000_000_000
	user := &User{
		Id:       61001,
		Username: "large_quota_user",
		Status:   1,
		Quota:    largeQuota,
	}
	require.NoError(t, DB.Create(user).Error)

	got, err := GetUserQuota(user.Id, true)
	require.NoError(t, err)
	require.Equal(t, largeQuota, got)

	require.NoError(t, IncreaseUserQuota(user.Id, largeQuota, true))
	got, err = GetUserQuota(user.Id, true)
	require.NoError(t, err)
	require.Equal(t, largeQuota*2, got)
}

func TestMigrateColumnToBigintNoopOnSQLite(t *testing.T) {
	require.NoError(t, migrateColumnToBigint(DB, currentDatabaseType(), "users", "quota"))
}

func TestSQLiteAutoMigrateUpgradesQuotaColumnsFromIntToBigint(t *testing.T) {
	dbPath := t.TempDir() + "/quota-migration.db"

	legacyDB, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, legacyDB.AutoMigrate(&legacyQuotaUser{}))

	sqlDB, err := legacyDB.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())

	newDB, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	require.NoError(t, err)
	oldDB := DB
	oldSQLite := common.UsingSQLite
	DB = newDB
	common.UsingSQLite = true
	t.Cleanup(func() {
		DB = oldDB
		common.UsingSQLite = oldSQLite
		sqlDB, err := newDB.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
		_ = os.Remove(dbPath)
	})

	require.NoError(t, newDB.AutoMigrate(&bigintQuotaUser{}))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "used_quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "aff_quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "aff_history"))
}
