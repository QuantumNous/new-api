package model

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

func optionsRevision(t *testing.T) int64 {
	t.Helper()
	revisions, err := GetLatestSyncRevisions()
	require.NoError(t, err)
	return revisions[SyncTopicOptions]
}

// The old words become one global request-filter instance after the saved
// ones, enabled when both old switches were on; the old options go, and a
// second start changes nothing.
func TestMigrateSensitiveWords(t *testing.T) {
	keep := `{"id":"rp_keep","name":"Keep","plugin":"request-redact","enabled":true,"global":true,"groups":[],"models":[],"config":{"replacement":"[X]"}}`
	tests := map[string]struct {
		options   map[string]string
		language  string
		instances []string
		enabled   bool
		name      string
	}{
		"both switches on": {
			options:   map[string]string{"CheckSensitiveEnabled": "true", "CheckSensitiveOnPromptEnabled": "true", "StopOnSensitiveEnabled": "false", "SensitiveWords": " Bad \n\nworse\r\n", "StreamCacheQueueLength": "3", request_plugin_setting.InstancesOption: "[" + keep + "]"},
			instances: []string{keep},
			enabled:   true,
			name:      "Sensitive words",
		},
		"one switch on, no saved instances, English": {
			options:  map[string]string{"CheckSensitiveEnabled": "true", "SensitiveWords": "Bad\nworse"},
			language: "en",
			name:     "Sensitive words",
		},
		"Chinese by region": {
			options:  map[string]string{"CheckSensitiveOnPromptEnabled": "true", "SensitiveWords": "Bad\nworse"},
			language: "zh-TW",
			name:     "Sensitive words",
		},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			db := useFrontendOptionMigrationDB(t)
			require.NoError(t, db.AutoMigrate(&SystemTask{}))
			previousLanguage := common.DefaultLanguage
			common.DefaultLanguage = tc.language
			t.Cleanup(func() { common.DefaultLanguage = previousLanguage })
			for key, value := range tc.options {
				require.NoError(t, db.Create(&Option{Key: key, Value: value}).Error)
			}

			require.NoError(t, MigrateSensitiveWords())
			for _, key := range retiredSensitiveOptionKeys {
				requireOptionMissing(t, db, key)
			}
			saved := requireOptionValue(t, db, request_plugin_setting.InstancesOption)
			instances := gjson.Parse(saved).Array()
			require.Len(t, instances, len(tc.instances)+1)
			for index, instance := range tc.instances {
				assert.JSONEq(t, instance, instances[index].Raw)
			}
			migrated := instances[len(tc.instances)]
			assert.Regexp(t, `^rp_[a-z2-7]{8}$`, migrated.Get("id").Str)
			withoutID, err := sjson.Delete(migrated.Raw, "id")
			require.NoError(t, err)
			assert.JSONEq(t, `{"name":"`+tc.name+`","plugin":"request-filter","enabled":`+map[bool]string{true: "true", false: "false"}[tc.enabled]+`,
				"global":true,"groups":[],"models":[],
				"config":{"rules":[],"keywords":"Bad\nworse","keywordsCaseSensitive":false,"message":"","replies":false}}`, withoutID)
			revision := optionsRevision(t)
			assert.NotZero(t, revision, "the other nodes reload the options")

			require.NoError(t, MigrateSensitiveWords())
			assert.Equal(t, saved, requireOptionValue(t, db, request_plugin_setting.InstancesOption))
			assert.Equal(t, revision, optionsRevision(t))
		})
	}
}

func TestMigrateSensitiveWordsWithoutWords(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	require.NoError(t, db.AutoMigrate(&SystemTask{}))

	// Nothing to move: no write, no reload.
	require.NoError(t, MigrateSensitiveWords())
	assert.Zero(t, optionsRevision(t))

	// Switches without words leave no instance behind.
	require.NoError(t, db.Create(&[]Option{{Key: "CheckSensitiveEnabled", Value: "true"}, {Key: "SensitiveWords", Value: " \n "}}).Error)
	require.NoError(t, MigrateSensitiveWords())
	requireOptionMissing(t, db, "CheckSensitiveEnabled")
	requireOptionMissing(t, db, "SensitiveWords")
	requireOptionMissing(t, db, request_plugin_setting.InstancesOption)

	// An instance list it cannot read keeps everything as it was.
	require.NoError(t, db.Create(&[]Option{{Key: "SensitiveWords", Value: "bad"}, {Key: request_plugin_setting.InstancesOption, Value: "{"}}).Error)
	require.Error(t, MigrateSensitiveWords())
	assert.Equal(t, "bad", requireOptionValue(t, db, "SensitiveWords"))
	assert.Equal(t, "{", requireOptionValue(t, db, request_plugin_setting.InstancesOption))
}

// Orbit changes only the default display label. Verify the existing migration
// keeps keywords, saved instances, and idempotency on every supported engine.
func TestOrbitEnglishMigrationAcrossDatabases(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			dsn := "local"
			if dialect == "mysql" {
				dsn = os.Getenv("TEST_MYSQL_DSN")
			}
			if dialect == "postgres" {
				dsn = os.Getenv("TEST_POSTGRES_DSN")
			}
			if dsn == "" {
				t.Skip("test database DSN is not configured")
			}
			previousDB, previousType, previousPath := DB, common.MainDatabaseType(), common.SQLitePath
			previousLanguage := common.DefaultLanguage
			common.SQLitePath = filepath.Join(t.TempDir(), "orbit.db")
			t.Setenv("ORBIT_TEST_DSN", dsn)
			db, kind, err := chooseDB("ORBIT_TEST_DSN", false)
			require.NoError(t, err)
			DB = db
			common.SetMainDatabaseType(common.DatabaseType(kind))
			common.DefaultLanguage = "zh-CN"
			initCol()
			t.Cleanup(func() {
				_ = db.Migrator().DropTable(&Option{}, &SystemTask{})
				connection, _ := db.DB()
				if connection != nil {
					_ = connection.Close()
				}
				DB, common.SQLitePath, common.DefaultLanguage = previousDB, previousPath, previousLanguage
				common.SetMainDatabaseType(previousType)
				initCol()
			})
			var version string
			query := "SELECT VERSION()"
			if dialect == "sqlite" {
				query = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(query).Scan(&version).Error)
			t.Logf("database: %s %s", dialect, version)
			require.NoError(t, db.AutoMigrate(&Option{}, &SystemTask{}))
			require.NoError(t, db.AutoMigrate(&Option{}, &SystemTask{}))
			existing := `[{"id":"rp_existing","name":"Existing policy","plugin":"request-filter","enabled":false,"global":true,"groups":[],"models":[],"config":{"keywords":"Keep existing"}}]`
			require.NoError(t, db.Create(&Option{Key: request_plugin_setting.InstancesOption, Value: existing}).Error)
			require.NoError(t, db.Create(&Option{Key: "SensitiveWords", Value: "Preserve this keyword"}).Error)
			require.NoError(t, db.Create(&Option{Key: "CheckSensitiveEnabled", Value: "true"}).Error)
			require.NoError(t, db.Create(&Option{Key: "CheckSensitiveOnPromptEnabled", Value: "true"}).Error)
			require.NoError(t, MigrateSensitiveWords())
			before := requireOptionValue(t, db, request_plugin_setting.InstancesOption)
			result := gjson.Parse(before)
			require.Len(t, result.Array(), 2)
			assert.Equal(t, "Existing policy", result.Get("0.name").String())
			assert.Equal(t, "Keep existing", result.Get("0.config.keywords").String())
			assert.Equal(t, "Sensitive words", result.Get("1.name").String())
			assert.Equal(t, "Preserve this keyword", result.Get("1.config.keywords").String())
			assert.True(t, result.Get("1.enabled").Bool())
			requireOptionMissing(t, db, "SensitiveWords")
			require.NoError(t, MigrateSensitiveWords())
			assert.Equal(t, before, requireOptionValue(t, db, request_plugin_setting.InstancesOption))
		})
	}
}
