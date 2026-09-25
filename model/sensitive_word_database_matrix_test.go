package model

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/clickhouse"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// legacySensitiveWordRC40User represents a legacy users table. The matrix
// uses it to prove that adding the counter and whitelist columns does not
// require a pre-existing sensitive-word schema.
type legacySensitiveWordRC40User struct {
	Id        int    `gorm:"primaryKey;column:id"`
	Username  string `gorm:"type:varchar(64);uniqueIndex"`
	Password  string `gorm:"type:varchar(256)"`
	Role      int    `gorm:"not null"`
	Status    int    `gorm:"not null"`
	Group     string `gorm:"type:varchar(32);not null"`
	Quota     int    `gorm:"not null;default:0"`
	UsedQuota int    `gorm:"not null;default:0"`
	AffCode   string `gorm:"type:varchar(32);not null"`
}

func (legacySensitiveWordRC40User) TableName() string { return "users" }

func sensitiveWordMatrixIsLoopback(host string) bool {
	host = strings.TrimSpace(host)
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// openSensitiveWordMatrixDB creates a short-lived database whose name is not
// derived from user input. The external DSN is accepted only on loopback so a
// test invocation cannot create or drop a remote database by accident.
func openSensitiveWordMatrixDB(t *testing.T, dialect, dsn string) *gorm.DB {
	t.Helper()
	if dialect == "sqlite" {
		db, err := gorm.Open(sqlite.Open(t.TempDir()+"/sensitive-word.db"), &gorm.Config{})
		require.NoError(t, err)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
		return db
	}

	name := fmt.Sprintf("newapi_sensitive_word_%d", time.Now().UnixNano())
	var (
		adminDialector gorm.Dialector
		testDialector  gorm.Dialector
		dropSQL        string
	)
	switch dialect {
	case "mysql":
		config, err := mysqlDriver.ParseDSN(dsn)
		require.NoError(t, err)
		require.Equal(t, "tcp", config.Net)
		host, _, err := net.SplitHostPort(config.Addr)
		require.NoError(t, err)
		require.True(t, sensitiveWordMatrixIsLoopback(host), "test database must be loopback")
		adminDialector = mysql.Open(config.FormatDSN())
		config.DBName = name
		testDialector = mysql.Open(config.FormatDSN())
		dropSQL = "DROP DATABASE `" + name + "`"
	case "postgres":
		parsed, err := url.Parse(dsn)
		require.NoError(t, err)
		require.True(t, sensitiveWordMatrixIsLoopback(parsed.Hostname()), "test database must be loopback")
		adminDialector = postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
		parsed.Path = "/" + name
		testDialector = postgres.New(postgres.Config{DSN: parsed.String(), PreferSimpleProtocol: true})
		dropSQL = "DROP DATABASE " + name + " WITH (FORCE)"
	default:
		t.Fatalf("unsupported sensitive-word matrix dialect %q", dialect)
	}

	admin, err := gorm.Open(adminDialector, &gorm.Config{})
	require.NoError(t, err)
	createSQL := "CREATE DATABASE " + name
	if dialect == "mysql" {
		createSQL += " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
	}
	require.NoError(t, admin.Exec(createSQL).Error)
	testDB, err := gorm.Open(testDialector, &gorm.Config{})
	require.NoError(t, err)
	testSQLDB, err := testDB.DB()
	require.NoError(t, err)
	adminSQLDB, err := admin.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, testSQLDB.Close())
		require.NoError(t, admin.Exec(dropSQL).Error)
		require.NoError(t, adminSQLDB.Close())
	})
	return testDB
}

// openSensitiveWordClickHouseMatrixDB isolates the log-database verification
// from any configured service log store. As with the relational matrix, the
// supplied endpoint must be local because this helper creates and drops a DB.
func openSensitiveWordClickHouseMatrixDB(t *testing.T, dsn string) *gorm.DB {
	t.Helper()
	parsed, err := url.Parse(dsn)
	require.NoError(t, err)
	require.True(t, sensitiveWordMatrixIsLoopback(parsed.Hostname()), "test database must be loopback")

	name := fmt.Sprintf("newapi_sensitive_word_log_%d", time.Now().UnixNano())
	admin, err := gorm.Open(clickhouse.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, admin.Exec("CREATE DATABASE "+name).Error)

	parsed.Path = "/" + name
	testDB, err := gorm.Open(clickhouse.Open(parsed.String()), &gorm.Config{})
	require.NoError(t, err)
	testSQLDB, err := testDB.DB()
	require.NoError(t, err)
	adminSQLDB, err := admin.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, testSQLDB.Close())
		require.NoError(t, admin.Exec("DROP DATABASE "+name+" SYNC").Error)
		require.NoError(t, adminSQLDB.Close())
	})
	return testDB
}

func withSensitiveWordMatrixDB(t *testing.T, db *gorm.DB, dialect common.DatabaseType) {
	t.Helper()
	previousDB, previousLogDB := DB, LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousUnavailable := sensitiveWordRuntimeUnavailable.Load()
	DB, LOG_DB = db, db
	common.SetDatabaseTypes(dialect, dialect)
	initCol()
	setSensitiveWordRuntimeUnavailable(false)
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		initCol()
		setSensitiveWordRuntimeUnavailable(previousUnavailable)
	})
}

func migrateSensitiveWordCurrentSchema(t *testing.T, db *gorm.DB) {
	t.Helper()
	require.NoError(t, db.AutoMigrate(
		&Option{}, &User{}, &UserSession{}, &Log{},
		&SensitiveWordRule{}, &SensitiveWordRuleWord{}, &SensitiveWordRuleGroup{},
		&SensitiveWordPolicy{}, &SensitiveWordAuditEvent{},
	))
}

func requireSensitiveWordPromptColumn(t *testing.T, db *gorm.DB, dialect string) {
	t.Helper()
	columns, err := db.Migrator().ColumnTypes(&SensitiveWordAuditEvent{})
	require.NoError(t, err)
	for _, column := range columns {
		if !strings.EqualFold(column.Name(), "full_prompt") {
			continue
		}
		dataType := strings.ToLower(column.DatabaseTypeName())
		if dialect == "mysql" {
			require.Contains(t, dataType, "mediumtext")
		} else {
			require.Contains(t, dataType, "text")
		}
		return
	}
	t.Fatalf("full_prompt column not found")
}

func TestSensitiveWordDatabaseMigrationMatrix(t *testing.T) {
	cases := []struct {
		name    string
		dialect common.DatabaseType
		dsn     string
	}{
		{name: "sqlite", dialect: common.DatabaseTypeSQLite},
		{name: "mysql", dialect: common.DatabaseTypeMySQL, dsn: os.Getenv("TEST_SENSITIVE_WORD_MYSQL_DSN")},
		{name: "postgres", dialect: common.DatabaseTypePostgreSQL, dsn: os.Getenv("TEST_SENSITIVE_WORD_POSTGRES_DSN")},
	}
	for _, database := range cases {
		database := database
		t.Run(database.name, func(t *testing.T) {
			if database.dialect != common.DatabaseTypeSQLite && strings.TrimSpace(database.dsn) == "" {
				t.Skip("set a dedicated TEST_SENSITIVE_WORD_" + strings.ToUpper(database.name) + "_DSN to run this matrix")
			}

			t.Run("fresh", func(t *testing.T) {
				db := openSensitiveWordMatrixDB(t, database.name, database.dsn)
				withSensitiveWordMatrixDB(t, db, database.dialect)
				migrateSensitiveWordCurrentSchema(t, db)
				require.NoError(t, MigrateSensitiveWordData())
				require.NoError(t, MigrateSensitiveWordData())
				policy := GetSensitiveWordPolicy()
				require.True(t, policy.Enabled)
				require.True(t, policy.CheckPrompt)
				require.Equal(t, SensitiveWordBanThreshold, policy.BanThreshold)
				require.Equal(t, 180, policy.FullPromptRetentionDays)
				require.Equal(t, SensitiveWordMaxPromptRunes, policy.MaxPromptRunes)
				requireSensitiveWordPromptColumn(t, db, database.name)
			})

			t.Run("rc40_upgrade", func(t *testing.T) {
				db := openSensitiveWordMatrixDB(t, database.name, database.dsn)
				withSensitiveWordMatrixDB(t, db, database.dialect)
				require.NoError(t, db.AutoMigrate(&Option{}, &legacySensitiveWordRC40User{}))
				require.NoError(t, db.Create(&legacySensitiveWordRC40User{
					Id: 1, Username: "rc40-user", Password: "unused", Role: common.RoleCommonUser,
					Status: common.UserStatusEnabled, Group: "default", AffCode: "rc40-aff",
				}).Error)
				migrateSensitiveWordCurrentSchema(t, db)
				require.NoError(t, MigrateSensitiveWordData())
				require.NoError(t, MigrateSensitiveWordData())
				require.True(t, db.Migrator().HasColumn(&User{}, "sensitive_word_violation_count"))
				require.True(t, db.Migrator().HasColumn(&User{}, "sensitive_word_whitelist"))
				var user User
				require.NoError(t, db.First(&user, 1).Error)
				require.Zero(t, user.SensitiveWordViolationCount)
				require.False(t, user.SensitiveWordWhitelist)
			})

			t.Run("legacy_sensitive_word_upgrade", func(t *testing.T) {
				db := openSensitiveWordMatrixDB(t, database.name, database.dsn)
				withSensitiveWordMatrixDB(t, db, database.dialect)
				require.NoError(t, db.AutoMigrate(
					&Option{}, &legacySensitiveWordRC40User{}, &legacySensitiveWordV1Rule{},
					&legacySensitiveWordV1Audit{},
				))
				require.NoError(t, db.Create(&legacySensitiveWordRC40User{
					Id: 1, Username: "sensitive-word-user", Password: "unused", Role: common.RoleCommonUser,
					Status: common.UserStatusEnabled, Group: "default", AffCode: "sensitive-word-aff",
				}).Error)
				legacyRule := legacySensitiveWordV1Rule{
					Word: "initial-sensitive-word-marker", Scope: SensitiveWordScopeGlobal, Enabled: true,
					CreatedBy: 1, Version: 1, CreatedAt: time.Now(), UpdatedAt: time.Now(),
				}
				require.NoError(t, db.Create(&legacyRule).Error)
				require.NoError(t, db.Create(&legacySensitiveWordV1Audit{
					RequestID: "initial-sensitive-word-audit", UserID: 1, FullPrompt: "retained sensitive-word evidence",
					MatchedRuleIDs: "[1]", MatchedWords: `["initial-sensitive-word-marker"]`, MatchedSnippets: "[]",
					CreatedAt: time.Now(),
				}).Error)
				legacyConfig, err := common.Marshal(map[string]any{
					"enabled": true, "audit_enabled": true, "block_message": "legacy policy",
					"ban_threshold": 9, "full_prompt_retention_days": 30,
					"max_prompt_runes": 4096, "rule_version": 2,
				})
				require.NoError(t, err)
				require.NoError(t, db.Create(&Option{Key: "SensitiveWordConfig", Value: string(legacyConfig)}).Error)
				require.NoError(t, db.Create(&Option{Key: "SensitiveWords", Value: "initial-sensitive-word-option"}).Error)

				migrateSensitiveWordCurrentSchema(t, db)
				require.NoError(t, MigrateSensitiveWordData())
				require.NoError(t, MigrateSensitiveWordData())
				policy := GetSensitiveWordPolicy()
				require.True(t, policy.CheckPrompt, "missing legacy check_prompt keeps the secure default")
				require.Equal(t, 9, policy.BanThreshold)
				detail, err := GetSensitiveWordRuleDetail(legacyRule.ID)
				require.NoError(t, err)
				require.Equal(t, SensitiveWordModeBlock, detail.Mode)
				require.Equal(t, []string{"initial-sensitive-word-marker"}, detail.Words)
				rules, err := ListSensitiveWordRules()
				require.NoError(t, err)
				require.Len(t, rules, 2, "the legacy option must remain alongside an old global rule")
				var user User
				require.NoError(t, db.First(&user, 1).Error)
				require.False(t, user.SensitiveWordWhitelist)
				var audit SensitiveWordAuditEvent
				require.NoError(t, db.Where("request_id = ?", "initial-sensitive-word-audit").First(&audit).Error)
				require.Equal(t, SensitiveWordAuditPrompt("retained sensitive-word evidence"), audit.FullPrompt)
				var marker Option
				require.NoError(t, db.Where(&Option{Key: sensitiveWordMigrationKey}).First(&marker).Error)
				require.Equal(t, sensitiveWordMigrationValue, marker.Value)
				requireSensitiveWordPromptColumn(t, db, database.name)
			})
		})
	}
}

func TestSensitiveWordClickHouseLogMatrix(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("TEST_SENSITIVE_WORD_CLICKHOUSE_DSN"))
	if dsn == "" {
		t.Skip("set a dedicated TEST_SENSITIVE_WORD_CLICKHOUSE_DSN to run this matrix")
	}

	db := openSensitiveWordClickHouseMatrixDB(t, dsn)
	previousLogDB := LOG_DB
	previousLogType := common.LogDatabaseType()
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeClickHouse)
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		common.SetLogDatabaseType(previousLogType)
	})
	require.NoError(t, db.Exec(clickHouseLogCreateTableSQL(0)).Error)

	other := NewLogOther()
	require.True(t, other.SetPublic("action", SensitiveWordLogAction))
	require.True(t, other.SetAdmin("keyword_filter", map[string]any{
		"audit_id":      42,
		"matched_words": []string{"retained-for-admin"},
	}))
	log := &Log{
		UserId:    7,
		Username:  "matrix-user",
		CreatedAt: common.GetTimestamp(),
		Type:      LogTypeSensitiveWordBlock,
		Content:   "sensitive words detected",
		RequestId: "sensitive-word-clickhouse-matrix",
		Other:     other.JSONString(),
	}
	require.NoError(t, createLog(log))

	var logs []*Log
	require.NoError(t, db.Where("request_id = ?", log.RequestId).Find(&logs).Error)
	require.Len(t, logs, 1)
	require.Equal(t, LogTypeSensitiveWordBlock, logs[0].Type)

	adminLog := *logs[0]
	FormatAdminLogs([]*Log{&adminLog})
	require.Contains(t, adminLog.Other, "keyword_filter")
	require.Contains(t, adminLog.Other, "retained-for-admin")

	userLog := *logs[0]
	formatUserLogs([]*Log{&userLog}, 0)
	require.NotContains(t, userLog.Other, "keyword_filter")
	require.NotContains(t, userLog.Other, "retained-for-admin")
	require.Contains(t, userLog.Other, SensitiveWordLogAction)
}
