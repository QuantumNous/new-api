package model

import (
	"errors"
	"maps"
	"os"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
)

func setupTestOptionDB(t *testing.T, driver gorm.Dialector) *gorm.DB {
	t.Helper()
	previousDB := DB
	previousType := common.MainDatabaseType()
	previousRegistry := jsplugin.DefaultRegistry
	previousTaskPluginEnabled := constant.TaskPluginEnabled
	jsplugin.DefaultRegistry = jsplugin.NewRegistry()
	t.Cleanup(func() {
		jsplugin.DefaultRegistry = previousRegistry
		constant.TaskPluginEnabled = previousTaskPluginEnabled
	})
	common.OptionMapRWMutex.Lock()
	previousOptions := maps.Clone(common.OptionMap)
	previousCurrency := common.DisplayInCurrencyEnabled
	previousGeneral := *operation_setting.GetGeneralSetting()
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.DisplayInCurrencyEnabled = previousCurrency
		*operation_setting.GetGeneralSetting() = previousGeneral
		common.OptionMapRWMutex.Unlock()
		DB = previousDB
		common.SetMainDatabaseType(previousType)
		initCol()
	})
	db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "quota_display_test_"}})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() {
		assert.NoError(t, db.Migrator().DropTable(&Option{}, &SystemTask{}))
		assert.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&Option{}, &SystemTask{}))
	DB = db
	common.SetMainDatabaseType(common.DatabaseType(driver.Name()))
	initCol()
	return db
}

// #8217: updating general_setting.quota_display_type to CNY must not be overwritten
// by DisplayInCurrencyEnabled (which defaults to true).
func TestQuotaDisplayTypeNotOverwrittenByDisplayInCurrency(t *testing.T) {
	setupTestOptionDB(t, sqlite.Open(":memory:"))
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

func TestQuotaDisplayTypeDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
			case "mysql":
				if os.Getenv("TEST_MYSQL_DSN") == "" {
					t.Skip("TEST_MYSQL_DSN not configured")
				}
				driver = mysql.Open(os.Getenv("TEST_MYSQL_DSN"))
			case "postgres":
				if os.Getenv("TEST_POSTGRES_DSN") == "" {
					t.Skip("TEST_POSTGRES_DSN not configured")
				}
				driver = postgres.Open(os.Getenv("TEST_POSTGRES_DSN"))
			}
			db := setupTestOptionDB(t, driver)
			query := "SELECT version()"
			if dialect == "sqlite" {
				query = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, db.Raw(query).Scan(&version).Error)
			t.Logf("database version: %s", version)
			// A fresh database has no legacy row to update yet.
			require.NoError(t, UpdateOption("general_setting.quota_display_type", "CNY"))
			for _, enabled := range []string{"true", "false", "true"} {
				require.NoError(t, UpdateOption("DisplayInCurrencyEnabled", enabled))
				before := operation_setting.GetQuotaDisplayType()
				require.NoError(t, LoadOptionsFromDatabase())
				assert.Equal(t, before, operation_setting.GetQuotaDisplayType(), "legacy updates survive reload")
			}
			// Existing inconsistent rows must load correctly in either DB order,
			// without writing back from the reload handler.
			for _, descending := range []bool{false, true} {
				require.NoError(t, db.Save(&Option{Key: "general_setting.quota_display_type", Value: "CNY"}).Error)
				require.NoError(t, db.Save(&Option{Key: "DisplayInCurrencyEnabled", Value: "false"}).Error)
				require.NoError(t, db.Callback().Query().Before("gorm:query").Register("quota_load_order", func(tx *gorm.DB) {
					if tx.Statement.Table == "quota_display_test_options" {
						tx.Statement.AddClause(clause.OrderBy{Columns: []clause.OrderByColumn{{Column: clause.Column{Name: "key"}, Desc: descending}}})
					}
				}))
				require.NoError(t, LoadOptionsFromDatabase())
				require.NoError(t, db.Callback().Query().Remove("quota_load_order"))
				assert.Equal(t, "CNY", operation_setting.GetQuotaDisplayType())
				assert.True(t, common.DisplayInCurrencyEnabled)
				assert.Equal(t, "true", common.OptionMap["DisplayInCurrencyEnabled"])
				var legacy Option
				require.NoError(t, db.Where(&Option{Key: "DisplayInCurrencyEnabled"}).First(&legacy).Error)
				assert.Equal(t, "false", legacy.Value, "reload must not write to the database")
			}
			for _, bulk := range []bool{false, true} {
				for _, display := range []string{"CNY", "CUSTOM", "USD", "TOKENS"} {
					t.Run(display+"/bulk="+strconv.FormatBool(bulk), func(t *testing.T) {
						const key = "general_setting.quota_display_type"
						currency := display != "TOKENS"
						require.NoError(t, UpdateOption("DisplayInCurrencyEnabled", strconv.FormatBool(!currency)))
						if bulk {
							values := map[string]string{key: display, "DisplayInCurrencyEnabled": strconv.FormatBool(!currency)}
							original := maps.Clone(values)
							require.NoError(t, UpdateOptionsBulk(values))
							assert.Equal(t, original, values, "do not mutate the caller's input")
						} else {
							require.NoError(t, UpdateOption(key, display))
						}
						var legacy, modern Option
						require.NoError(t, db.Where(&Option{Key: "DisplayInCurrencyEnabled"}).First(&legacy).Error)
						require.NoError(t, db.Where(&Option{Key: key}).First(&modern).Error)
						assert.Equal(t, strconv.FormatBool(currency), legacy.Value)
						for _, rows := range [][]Option{{legacy, modern}, {modern, legacy}} {
							for _, row := range rows {
								require.NoError(t, updateOptionMap(row.Key, row.Value))
							}
							assert.Equal(t, display, operation_setting.GetQuotaDisplayType())
							assert.Equal(t, currency, common.DisplayInCurrencyEnabled)
						}
						require.NoError(t, LoadOptionsFromDatabase())
						InitOptionMap()
						assert.Equal(t, display, operation_setting.GetQuotaDisplayType())
						assert.Equal(t, strconv.FormatBool(currency), common.OptionMap["DisplayInCurrencyEnabled"])
					})
				}
			}
			// Reject the second save to prove both rows roll back together.
			require.NoError(t, UpdateOption("general_setting.quota_display_type", "TOKENS"))
			writes := 0
			require.NoError(t, db.Callback().Update().Before("gorm:update").Register("quota_save_failure", func(tx *gorm.DB) {
				if tx.Statement.Table == "quota_display_test_options" {
					writes++
					if writes == 2 {
						tx.AddError(errors.New("injected second save failure"))
					}
				}
			}))
			assert.Error(t, UpdateOption("general_setting.quota_display_type", "CNY"))
			require.NoError(t, db.Callback().Update().Remove("quota_save_failure"))
			assert.Equal(t, "TOKENS", operation_setting.GetQuotaDisplayType())
			var stored Option
			require.NoError(t, db.Where(&Option{Key: "general_setting.quota_display_type"}).First(&stored).Error)
			assert.Equal(t, "TOKENS", stored.Value)
			var legacy Option
			require.NoError(t, db.Where(&Option{Key: "DisplayInCurrencyEnabled"}).First(&legacy).Error)
			assert.Equal(t, "false", legacy.Value)
			assert.False(t, common.DisplayInCurrencyEnabled)
			assert.Equal(t, "false", common.OptionMap["DisplayInCurrencyEnabled"])
		})
	}
}
