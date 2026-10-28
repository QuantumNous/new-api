package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestAutoGroupsOptionPersistence(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(filepath.Join(t.TempDir(), "options.db"))
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				driver = postgres.Open(dsn)
			}
			db, err := gorm.Open(driver, &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			// Use a dedicated table even when a shared test database is supplied.
			db = db.Table("issue8034_options").Session(&gorm.Session{})
			require.NoError(t, db.AutoMigrate(&model.Option{}))
			t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable("issue8034_options")) })
			var version string
			if dialect == "sqlite" {
				require.NoError(t, db.Raw("select sqlite_version()").Scan(&version).Error)
			} else {
				require.NoError(t, db.Raw("select version()").Scan(&version).Error)
			}
			t.Logf("%s version: %s", dialect, version)

			oldDB := model.DB
			model.DB = db
			common.OptionMapRWMutex.Lock()
			oldOptions := common.OptionMap
			common.OptionMap = make(map[string]string)
			common.OptionMapRWMutex.Unlock()
			oldGroups := setting.AutoGroups2JsonString()
			t.Cleanup(func() {
				model.DB = oldDB
				common.OptionMapRWMutex.Lock()
				common.OptionMap = oldOptions
				common.OptionMapRWMutex.Unlock()
				require.NoError(t, setting.UpdateAutoGroupsByJsonString(oldGroups))
			})

			const original = `["vip","default","retired"]`
			require.NoError(t, model.UpdateOption("AutoGroups", original))
			for _, body := range []string{
				`{"key":"AutoGroups"}`,
				`{"key":"Issue8034Other"}`,
				`{"key":"Issue8034Other","value":null}`,
				`{"key":"AutoGroups","value":null}`,
				`{"key":"AutoGroups","value":[]}`,
				`{"key":"AutoGroups","value":{}}`,
				`{"key":"AutoGroups","value":"<nil>"}`,
				`{"key":"AutoGroups","value":"[\"vip\",1]"}`,
				`{"key":"AutoGroups","value":"null"}`,
			} {
				t.Run(body, func(t *testing.T) {
					response := httptest.NewRecorder()
					context, _ := gin.CreateTestContext(response)
					context.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(body))
					UpdateOption(context)
					var payload struct {
						Success bool   `json:"success"`
						Message string `json:"message"`
					}
					require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
					assert.False(t, payload.Success)
					assert.NotEmpty(t, payload.Message)
					var count int64
					require.NoError(t, db.Model(&model.Option{}).Where(&model.Option{Key: "Issue8034Other"}).Count(&count).Error)
					assert.Zero(t, count)
					assert.NotContains(t, common.OptionMap, "Issue8034Other")
					var stored model.Option
					require.NoError(t, db.First(&stored, model.Option{Key: "AutoGroups"}).Error)
					assert.Equal(t, original, stored.Value)
					assert.Equal(t, original, common.OptionMap["AutoGroups"])
					assert.Equal(t, []string{"vip", "default", "retired"}, setting.GetAutoGroups())
				})
			}

			for _, value := range []string{"<nil>", "", "null", `{}`, `["vip",1]`, `["vip",null]`} {
				t.Run("model rejects "+value, func(t *testing.T) {
					assert.Error(t, model.UpdateOption("AutoGroups", value))
					assert.Error(t, model.UpdateOptionsBulk(map[string]string{"AutoGroups": value, "Issue8034Other": "dirty"}))
					assert.Error(t, setting.UpdateAutoGroupsByJsonString(value))
					var stored model.Option
					require.NoError(t, db.First(&stored, model.Option{Key: "AutoGroups"}).Error)
					assert.Equal(t, original, stored.Value)
					assert.Equal(t, original, common.OptionMap["AutoGroups"])
					assert.Equal(t, []string{"vip", "default", "retired"}, setting.GetAutoGroups())
					var count int64
					require.NoError(t, db.Model(&model.Option{}).Where(&model.Option{Key: "Issue8034Other"}).Count(&count).Error)
					assert.Zero(t, count)
					assert.NotContains(t, common.OptionMap, "Issue8034Other")
				})
			}

			t.Run("database failure preserves memory", func(t *testing.T) {
				writeErr := errors.New("option write failed")
				require.NoError(t, db.Callback().Update().Before("gorm:update").Register("issue8034:fail", func(tx *gorm.DB) { tx.AddError(writeErr) }))
				t.Cleanup(func() { require.NoError(t, db.Callback().Update().Remove("issue8034:fail")) })
				assert.ErrorIs(t, model.UpdateOption("AutoGroups", `[]`), writeErr)
				assert.ErrorIs(t, model.UpdateOption("Issue8034New", "value"), writeErr)
				var count int64
				require.NoError(t, db.Model(&model.Option{}).Where(&model.Option{Key: "Issue8034New"}).Count(&count).Error)
				assert.Zero(t, count, "failed saves must roll back FirstOrCreate")
				assert.NotContains(t, common.OptionMap, "Issue8034New")
				assert.Equal(t, original, common.OptionMap["AutoGroups"])
				assert.Equal(t, []string{"vip", "default", "retired"}, setting.GetAutoGroups())
				var stored model.Option
				require.NoError(t, db.First(&stored, model.Option{Key: "AutoGroups"}).Error)
				assert.Equal(t, original, stored.Value)
			})

			for _, value := range []string{`[]`, `["default"]`, `["vip","default","retired"]`} {
				require.NoError(t, model.UpdateOption("AutoGroups", value))
				var stored model.Option
				require.NoError(t, db.First(&stored, model.Option{Key: "AutoGroups"}).Error)
				assert.Equal(t, value, stored.Value)
				assert.Equal(t, value, common.OptionMap["AutoGroups"])
				assert.JSONEq(t, value, setting.AutoGroups2JsonString())
			}
		})
	}
}
