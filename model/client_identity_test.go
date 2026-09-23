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
		{"codex-tui/0.155.1 (Mac OS 26.5.2; arm64) Apple_Terminal/470.2 (codex-tui; 0.155.1)", "codex:tui"},
		{"codex_sdk_ts/1.0", "codex:sdk"}, {"codex-acp/1.0", "codex:acp"},
		{"claude-cli/2.0", "claude_code:cli"}, {"claude-cli/diagnostic", "claude_code:diagnostic"}, {"pi/1.0", "pi:cli"}, {"opencode/1.0", "opencode:cli"},
		{"ZCode/1.0", "zcode:versioned"}, {"ZCode/unknown", "zcode:unknown"},
		{"deepseek-harness/1.0", "dsh:cli"}, {"Go-http-client/2.0", "go:http"},
		{"OpenClaw/1.0", "openclaw:app"}, {"CherryStudio/1.0", "cherry_studio:desktop"},
		{"CLI/2.63.2 CodeBuddy/2.63.2", "workbuddy:cli"}, {"CLI/2.63.2 WorkBuddy/2.63.2", "workbuddy:cli"},
		{"WorkBuddy/1.0", "workbuddy:app"}, {"AsyncOpenAI/Python 2.24.0", "openai_sdk:python"}, {"OpenAI/Python 1.0", "openai_sdk:python"}, {"OpenAI/JS 1.0", "openai_sdk:javascript"},
		{"tender-agent-base/0.144.3 (Debian 12.0.0; x86_64) xterm (tender-agent-base; 0.1.0)", "tender:agent-base"},
		{"mimocode/desktop-bdfe497 ai-sdk/provider-utils/4.0.23 runtime/node.js/24", "mimocode:desktop"},
		{"node", "node:runtime"}, {"python", "python:runtime"}, {"hertz", "hertz:http"}, {"hertz/0.10.3", "hertz:http"}, {"Bun/1.0", "bun:runtime"}, {"python-httpx/1.0", "python:httpx"}, {"python/3.12", "python:runtime"}, {"urllib3/2.2.2", "python:urllib3"},
		{"Mozilla/5.0 (Windows NT 10.0)", "browser:browser"}, {"curl/8.0", "curl:cli"},
	} {
		t.Run(tc.ua, func(t *testing.T) { assert.Equal(t, tc.key, common.IdentifyClient(tc.ua).ClientKey) })
	}
	for _, ua := range []string{"my codex app", "gpt-5-codex", "\nCodex Desktop/1.0", "Codex\x00 Desktop/1.0", "(Codex Desktop/1.0)", "Codex DesktopEvil/1.0"} {
		assert.Equal(t, "unknown", common.IdentifyClient(ua).Family)
	}
	assert.Equal(t, common.IdentifyClient("Codex Desktop/1.0").ClientKey, common.IdentifyClient("Codex Desktop/2.0").ClientKey)
	assert.NotEqual(t, common.IdentifyClient("ZCode/1.0").ClientKey, common.IdentifyClient("ZCode/unknown").ClientKey)
	assert.Equal(t, "Go HTTP", common.IdentifyClient("Go-http-client/2.0").DisplayName)
	mimo := common.IdentifyClient("mimocode/desktop-bdfe497 ai-sdk/provider-utils/4.0.23 runtime/node.js/24")
	assert.Equal(t, "MiMo Code Desktop", mimo.DisplayName)
	assert.Equal(t, "bdfe497", mimo.Version)
	long := strings.Repeat("界", 1000)
	first, second := common.IdentifyClient(long+"a"), common.IdentifyClient(long+"b")
	assert.NotEqual(t, first.ClientKey, second.ClientKey)
	assert.LessOrEqual(t, len(first.UserAgent), 2048)
	assert.True(t, first.Truncated)
	assert.True(t, utf8.ValidString(first.UserAgent))
	assert.Equal(t, "abc", common.IdentifyClient("a\x00b\nc\u202e").UserAgent)
}

func TestGenericClientRecognition(t *testing.T) {
	for _, tc := range []struct{ ua, key, version string }{
		{"changzheng", "changzheng:app", ""},
		{"changzheng/1.0", "changzheng:app", "1.0"},
		{"greyfield", "greyfield:app", ""},
		{"greyfield/unknown", "greyfield:app", "unknown"},
		{"taffyOfficial", "taffyofficial:app", ""},
		{"taffyOfficial/1.0 OpenAI/Python 2.24.0", "taffyofficial:app", "1.0"},
		{"codex_cli_rs", "codex:cli", ""},
		{"codex_cli_rs/", "codex:cli", ""},
		{"codex_cli_rs/unknown", "codex:cli", "unknown"},
		{"codex_cli_rs/bdfe497", "codex:cli", "bdfe497"},
		{"codex_cli_rs/v1.2.3", "codex:cli", "v1.2.3"},
		{"claude-cli/diagnostic (Windows)", "claude_code:diagnostic", ""},
		{"OpenAI/Python 2.24.0 WorkBuddy/next", "workbuddy:app", "next"},
		{"WorkBuddy/next claude-cli/diagnostic", "workbuddy:app", "next"},
		{"python-httpx/0.28.1 OpenAI/Python 2.24.0", "openai_sdk:python", "2.24.0"},
		{"Mozilla/5.0 (WorkBuddy/1.0)", "browser:browser", "5.0"},
		{"CLI/unknown CodeBuddy/dev", "workbuddy:cli", "dev"},
		{"mimocode/desktop-unknown", "mimocode:desktop", "unknown"},
	} {
		t.Run(tc.ua, func(t *testing.T) {
			client := common.IdentifyClient(tc.ua)
			assert.Equal(t, tc.key, client.ClientKey)
			assert.Equal(t, tc.version, client.Version)
		})
	}
	first := common.IdentifyClient("MyTool/1.2 OpenAI/Python 2.24.0")
	second := common.IdentifyClient("MyTool/2.0")
	assert.Equal(t, "MyTool", first.DisplayName)
	assert.Equal(t, "1.2", first.Version)
	assert.Equal(t, "unknown", first.Family)
	assert.Equal(t, "unverified", first.Confidence)
	assert.Equal(t, first.ClientKey, second.ClientKey)
	assert.NotEqual(t, first.ClientKey, common.IdentifyClient("OtherTool/1.2").ClientKey)
	assert.Equal(t, "Python HTTPX", common.IdentifyClient("python-httpx/0.28.1").DisplayName)
	assert.Equal(t, "unknown", common.IdentifyClient("MyTool/"+strings.Repeat("a", 129)).Confidence)
	families := make(map[string]string)
	for _, option := range common.RecognizedClientFamilies() {
		assert.NotContains(t, families, option.Value)
		families[option.Value] = option.Label
	}
	assert.Equal(t, "Go HTTP", families["go"])
	assert.Equal(t, "NewAPI (legacy)", families["newapi"])
	for _, family := range []string{"workbuddy", "mimocode", "hertz", "tender", "changzheng", "greyfield", "taffyofficial"} {
		assert.Contains(t, families, family)
	}
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
