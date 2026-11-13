package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupTestOptionDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := DB
	previousType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}, &SystemTask{}))
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = previousDB
		common.SetMainDatabaseType(previousType)
	})
	return db
}

// #8217: updating general_setting.quota_display_type to CNY must not be overwritten
// by DisplayInCurrencyEnabled (which defaults to true).
func TestQuotaDisplayTypeNotOverwrittenByDisplayInCurrency(t *testing.T) {
	setupTestOptionDB(t)
	InitOptionMap()

	// 1. Updating both keys simultaneously (as the web settings form does)
	err := UpdateOptionsBulk(map[string]string{
		"general_setting.quota_display_type": "CNY",
		"DisplayInCurrencyEnabled":           "true",
	})
	require.NoError(t, err)
	require.Equal(t, "CNY", operation_setting.GetQuotaDisplayType(), "Bulk update must preserve CNY")

	// 2. LoadOptionsFromDatabase / InitOptionMap (simulating container restart)
	// Both keys exist in DB; DisplayInCurrencyEnabled must not overwrite quota_display_type.
	InitOptionMap()
	require.Equal(t, "CNY", operation_setting.GetQuotaDisplayType(), "Startup init must preserve CNY")

	// 3. Setting DisplayInCurrencyEnabled to false switches to TOKENS
	err = UpdateOption("DisplayInCurrencyEnabled", "false")
	require.NoError(t, err)
	require.Equal(t, "TOKENS", operation_setting.GetQuotaDisplayType())

	// 4. Setting DisplayInCurrencyEnabled back to true switches to USD from TOKENS
	err = UpdateOption("DisplayInCurrencyEnabled", "true")
	require.NoError(t, err)
	require.Equal(t, "USD", operation_setting.GetQuotaDisplayType())
}
