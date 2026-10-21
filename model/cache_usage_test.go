package model

import (
	"context"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestCacheTokensFromLog(t *testing.T) {
	for _, tc := range []struct {
		name   string
		prompt int64
		other  string
		input  float64
		read   float64
		known  bool
	}{
		{"OpenAI includes cached input", 1000, `{"cache_tokens":950}`, 1000, 950, true},
		{"zero hits is a measured zero", 1000, `{"cache_tokens":0}`, 1000, 0, true},
		{"Claude adds reads and writes", 10, `{"claude":true,"cache_tokens":950,"cache_creation_tokens":40}`, 1000, 950, true},
		{"explicit semantic adds cache-only input", 0, `{"usage_semantic":"anthropic","cache_tokens":950,"cache_write_tokens":50}`, 1000, 950, true},
		{"TTL breakdown is not counted twice", 10, `{"claude":true,"cache_tokens":950,"cache_creation_tokens":40,"cache_creation_tokens_5m":30,"cache_creation_tokens_1h":10,"cache_write_tokens":40}`, 1000, 950, true},
		{"split writes without total", 10, `{"claude":true,"cache_tokens":950,"cache_creation_tokens_5m":30,"cache_creation_tokens_1h":10}`, 1000, 950, true},
		{"OpenAI overlapping cache writes", 1000, `{"cache_tokens":950,"cache_write_tokens":500}`, 1000, 950, true},
		{"explicit total has priority", 100, `{"input_tokens_total":1000,"cache_tokens":950}`, 1000, 950, true},
		{"unknown cache telemetry", 1000, `{}`, 0, 0, false},
		{"non-token usage", 0, `{}`, 0, 0, true},
		{"malformed metadata", 1000, `{`, 0, 0, false},
		{"malformed cache-only usage", 0, `{`, 0, 0, false},
		{"estimated usage", 1000, `{"cache_tokens":0,"admin_info":{"usage_billing_path":"billing-usage-openai-estimated"}}`, 0, 0, false},
		{"locally counted usage", 1000, `{"cache_tokens":0,"admin_info":{"local_count_tokens":true}}`, 0, 0, false},
		{"invalid negative tokens", 1000, `{"cache_tokens":-1}`, 0, 0, false},
		{"invalid cache exceeds input", 100, `{"cache_tokens":950}`, 0, 0, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input, read, known := cacheTokensFromLog(tc.prompt, tc.other)
			assert.Equal(t, tc.known, known)
			if known {
				assert.Equal(t, tc.input, input)
				assert.Equal(t, tc.read, read)
			}
		})
	}
}

func TestCacheHitRateDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
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
			db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "cache_usage_test_"}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			oldDB, oldType := LOG_DB, common.LogDatabaseType()
			LOG_DB = db
			common.SetLogDatabaseType(common.DatabaseType(dialect))
			initCol()
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(&Log{}))
				LOG_DB = oldDB
				common.SetLogDatabaseType(oldType)
				initCol()
				require.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.AutoMigrate(&Log{}))
			var version string
			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database: %s %s", dialect, version)
			logs := []Log{
				{UserId: 1, ModelName: "model-a", Group: "default", CreatedAt: 1000, Type: LogTypeConsume, PromptTokens: 1000, CompletionTokens: 9000, Other: `{"cache_tokens":950}`},
				{UserId: 1, ModelName: "model-a", Group: "default", CreatedAt: 1100, Type: LogTypeConsume, PromptTokens: 100, Other: `{"cache_tokens":0}`},
				{UserId: 2, ModelName: "model-a", Group: "vip", CreatedAt: 1200, Type: LogTypeConsume, PromptTokens: 10, Other: `{"claude":true,"cache_tokens":950,"cache_write_tokens":40}`},
				{UserId: 1, ModelName: "model-b", Group: "default", CreatedAt: 1300, Type: LogTypeConsume, PromptTokens: 100, Other: `{"cache_tokens":0}`},
				{UserId: 1, ModelName: "model-a", Group: "default", CreatedAt: 800, Type: LogTypeConsume, PromptTokens: 10000, Other: `{"cache_tokens":0}`},
				{UserId: 1, ModelName: "model-a", Group: "default", CreatedAt: 2100, Type: LogTypeConsume, PromptTokens: 10000, Other: `{"cache_tokens":0}`},
				{UserId: 1, ModelName: "model-a", Group: "default", CreatedAt: 1400, Type: LogTypeError, PromptTokens: 10000, Other: `{"cache_tokens":0}`},
				{UserId: 3, ModelName: "unknown", Group: "default", CreatedAt: 1500, Type: LogTypeConsume, PromptTokens: 100, Other: `{}`},
				{UserId: 3, ModelName: "known", Group: "default", CreatedAt: 1600, Type: LogTypeConsume, PromptTokens: 1000, Other: `{"cache_tokens":950}`},
			}
			require.NoError(t, db.Create(&logs).Error)
			for _, tc := range []struct {
				name   string
				userID int
				model  string
				group  string
				groups []string
				want   *float64
			}{
				{"current user excludes other users and errors", 1, "", "", nil, new(950.0 / 1200 * 100)},
				{"model weights input tokens across groups", 0, "model-a", "", []string{"default", "vip"}, new(1900.0 / 2100 * 100)},
				{"model excludes unavailable groups", 0, "model-a", "", []string{"default"}, new(950.0 / 1100 * 100)},
				{"specific group", 0, "model-a", "vip", []string{"default", "vip"}, new(95.0)},
				{"empty allowed groups exposes nothing", 0, "model-a", "", []string{}, nil},
				{"no data remains unknown", 4, "", "", nil, nil},
				{"measured zero hits", 1, "model-b", "", nil, new(0.0)},
				{"missing upstream telemetry remains unknown", 3, "", "", nil, nil},
			} {
				t.Run(tc.name, func(t *testing.T) {
					rate, err := GetCacheHitRate(context.Background(), CacheUsageFilter{UserID: tc.userID, ModelName: tc.model, Group: tc.group, AllowedGroups: tc.groups, StartTimestamp: 900, EndTimestamp: 2000})
					require.NoError(t, err)
					if tc.want == nil {
						assert.Nil(t, rate)
						return
					}
					require.NotNil(t, rate)
					assert.InDelta(t, *tc.want, *rate, 0.000001)
				})
			}
			rate, err := GetCacheHitRate(context.Background(), CacheUsageFilter{StartTimestamp: 900, EndTimestamp: 2000})
			assert.Error(t, err)
			assert.Nil(t, rate)
		})
	}
}
