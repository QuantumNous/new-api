package model

import (
	"fmt"
	"os"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/clickhouse"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestClientRecognition(t *testing.T) {
	for _, tc := range []struct{ ua, key string }{
		{"Codex Desktop/0.155.0-alpha.9 (Windows 10.0.26200; x86_64) unknown (Codex Desktop; 26.915.31029)", "codex:desktop"},
		{"codex_cli_rs/0.1.0", "codex:cli"}, {"codex_vscode/1.2.3", "codex:vscode"}, {"codex_exec/1.0", "codex:exec"},
		{"codex_sdk_ts/1.0", "codex:sdk"}, {"codex-acp/1.0", "codex:acp"},
		{"claude-cli/2.0", "claude_code:cli"}, {"pi/1.0", "pi:cli"}, {"opencode/1.0", "opencode:cli"},
		{"ZCode/1.0", "zcode:versioned"}, {"ZCode/unknown", "zcode:unknown"},
		{"deepseek-harness/1.0", "dsh:cli"}, {"Go-http-client/2.0", "newapi:go"},
		{"OpenClaw/1.0", "openclaw:app"}, {"CherryStudio/1.0", "cherry_studio:desktop"},
		{"OpenAI/Python 1.0", "openai_sdk:python"}, {"OpenAI/JS 1.0", "openai_sdk:javascript"},
		{"node", "node:runtime"}, {"Bun/1.0", "bun:runtime"}, {"python-httpx/1.0", "python:httpx"},
		{"Mozilla/5.0 (Windows NT 10.0)", "browser:browser"}, {"curl/8.0", "curl:cli"},
	} {
		t.Run(tc.ua, func(t *testing.T) { assert.Equal(t, tc.key, common.IdentifyClient(tc.ua).ClientKey) })
	}
	for _, ua := range []string{"my codex app", "gpt-5-codex", "x Codex Desktop/1.0", "\nCodex Desktop/1.0", "ZCode/foo", "codex_cli_rs/1.0evil"} {
		assert.Equal(t, "unknown", common.IdentifyClient(ua).Family)
	}
	assert.Equal(t, common.IdentifyClient("Codex Desktop/1.0").ClientKey, common.IdentifyClient("Codex Desktop/2.0").ClientKey)
	assert.NotEqual(t, common.IdentifyClient("ZCode/1.0").ClientKey, common.IdentifyClient("ZCode/unknown").ClientKey)
	assert.Equal(t, "inferred", common.IdentifyClient("Go-http-client/2.0").Confidence)
	long := strings.Repeat("界", 1000)
	first, second := common.IdentifyClient(long+"a"), common.IdentifyClient(long+"b")
	assert.NotEqual(t, first.ClientKey, second.ClientKey)
	assert.LessOrEqual(t, len(first.UserAgent), 2048)
	assert.True(t, first.Truncated)
	assert.True(t, utf8.ValidString(first.UserAgent))
	assert.Equal(t, "abc", common.IdentifyClient("a\x00b\nc\u202e").UserAgent)
}

func TestClientLogDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres", "clickhouse"} {
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
			case "clickhouse":
				if os.Getenv("TEST_CLICKHOUSE_DSN") == "" {
					t.Skip("TEST_CLICKHOUSE_DSN not configured")
				}
				driver = clickhouse.Open(os.Getenv("TEST_CLICKHOUSE_DSN"))
			case "postgres":
				if os.Getenv("TEST_POSTGRES_DSN") == "" {
					t.Skip("TEST_POSTGRES_DSN not configured")
				}
				driver = postgres.Open(os.Getenv("TEST_POSTGRES_DSN"))
			}
			db, err := gorm.Open(driver, &gorm.Config{})
			require.NoError(t, err)
			previousDB, previousLogDB := DB, LOG_DB
			previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
			DB, LOG_DB = db, db
			kind := common.DatabaseType(dialect)
			if dialect == "postgres" {
				kind = common.DatabaseTypePostgreSQL
			}
			common.SetDatabaseTypes(kind, kind)
			if dialect == "clickhouse" {
				common.SetMainDatabaseType(common.DatabaseTypeSQLite)
			}
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(&Log{}))
				require.NoError(t, sqlDB.Close())
				DB, LOG_DB = previousDB, previousLogDB
				common.SetDatabaseTypes(previousMain, previousLog)
			})
			// Fresh initialization and a legacy log survive repeated migrations.
			if dialect == "clickhouse" {
				require.NoError(t, migrateClickHouseLogDB())
			} else {
				require.NoError(t, db.AutoMigrate(&Log{}))
			}
			require.NoError(t, db.Migrator().DropColumn(&Log{}, "client_family"))
			require.NoError(t, db.Omit("ClientFamily").Create(&Log{UserId: 41, CreatedAt: 1, Type: LogTypeConsume, Other: "{}", RequestId: "legacy"}).Error)
			for range 2 {
				if dialect == "clickhouse" {
					require.NoError(t, migrateClickHouseLogDB())
				} else {
					require.NoError(t, db.AutoMigrate(&Log{}))
				}
			}
			identity := common.IdentifyClient("Codex Desktop/1.0")
			unknown := common.IdentifyClient("custom-tool/1.0")
			for i := range 3 {
				require.NoError(t, createLog(&Log{UserId: 41, Type: LogTypeConsume, CreatedAt: int64(i + 2), Quota: 5, ClientFamily: "codex", Other: AttachClientLog(nil, &identity).JSONString()}))
			}
			require.NoError(t, createLog(&Log{UserId: 42, Type: LogTypeConsume, ClientFamily: "codex", Other: AttachClientLog(nil, &unknown).JSONString()}))
			require.NoError(t, createLog(&Log{UserId: 42, Other: "{}"}))
			require.NoError(t, createLog(&Log{UserId: 42, Type: LogTypeConsume, Quota: 99, ClientFamily: "curl"}))
			stats, err := SumUsedQuota(0, 0, 0, "", "", "", 0, "", "codex")
			require.NoError(t, err)
			assert.Equal(t, 15, stats.Quota)
			logs, total, err := GetUserLogs(41, 0, 0, 0, "", "", 1, 1, "", "", "", "codex")
			require.NoError(t, err)
			assert.EqualValues(t, 3, total)
			require.Len(t, logs, 1)
			assert.Contains(t, logs[0].Other, "Codex Desktop/1.0")
			assert.NotContains(t, logs[0].Other, "custom-tool")
			logs, total, err = GetUserLogs(41, 0, 0, 0, "", "", 0, 10, "", "", "", "unrecorded")
			require.NoError(t, err)
			assert.EqualValues(t, 1, total)
			require.Len(t, logs, 1)
			assert.NotContains(t, logs[0].Other, "client")
			var version string
			query := "SELECT version()"
			if dialect == "sqlite" {
				query = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(query).Scan(&version).Error)
			t.Log(fmt.Sprintf("%s: %s", dialect, version))
		})
	}
}
