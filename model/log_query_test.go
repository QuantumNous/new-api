package model

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	sqlmysql "github.com/go-sql-driver/mysql"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/clickhouse"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

// newLogQueryDatabase creates an isolated database on a loopback test server.
// The supplied DSNs identify the server; each test owns its database.
func newLogQueryDatabase(t *testing.T, kind string) *gorm.DB {
	t.Helper()
	if kind == "sqlite" {
		db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "logs.db")), newGormConfig(true))
		require.NoError(t, err)
		pool, err := db.DB()
		require.NoError(t, err)
		t.Cleanup(func() { assert.NoError(t, pool.Close()) })
		return db
	}
	env := "TEST_" + strings.ToUpper(kind) + "_DSN"
	dsn := os.Getenv(env)
	if dsn == "" {
		t.Skip(env + " is not configured")
	}
	name := fmt.Sprintf("newapi_log_query_%d", time.Now().UnixNano())
	var driver gorm.Dialector
	var isolatedDSN string
	if kind == "mysql" {
		config, err := sqlmysql.ParseDSN(dsn)
		require.NoError(t, err)
		host, _, err := net.SplitHostPort(config.Addr)
		require.NoError(t, err)
		require.True(t, net.ParseIP(host).IsLoopback())
		driver = mysql.Open(dsn)
		config.DBName = name
		isolatedDSN = config.FormatDSN()
	} else {
		parsed, err := url.Parse(dsn)
		require.NoError(t, err)
		require.True(t, net.ParseIP(parsed.Hostname()).IsLoopback())
		parsed.Path = "/" + name
		isolatedDSN = parsed.String()
		if kind == "clickhouse" {
			driver = clickhouse.Open(dsn)
		} else {
			driver = postgres.Open(dsn)
		}
	}
	admin, err := gorm.Open(driver, &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	createSQL := "CREATE DATABASE ?"
	if kind == "mysql" {
		createSQL += " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
	}
	require.NoError(t, admin.Exec(createSQL, clause.Table{Name: name}).Error)
	t.Setenv("LOG_QUERY_TEST_DSN", isolatedDSN)
	db, _, err := chooseDB("LOG_QUERY_TEST_DSN", true)
	require.NoError(t, err)
	pool, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		assert.NoError(t, pool.Close())
		assert.NoError(t, admin.Exec("DROP DATABASE ?", clause.Table{Name: name}).Error)
		adminPool, err := admin.DB()
		if assert.NoError(t, err) {
			assert.NoError(t, adminPool.Close())
		}
	})
	return db
}

// useLogQueryDatabase installs separate primary/log test databases and restores
// the package's database and cache settings after the test.
func useLogQueryDatabase(t *testing.T, db *gorm.DB, kind string) {
	t.Helper()
	previousDB, previousLogDB := DB, LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousMemory, previousRedis := common.MemoryCacheEnabled, common.RedisEnabled
	mainDB, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "main.db")), newGormConfig(true))
	require.NoError(t, err)
	require.NoError(t, mainDB.AutoMigrate(&Channel{}))
	require.NoError(t, mainDB.Create(&Channel{Id: 9, Name: "primary"}).Error)
	DB, LOG_DB = mainDB, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseType(kind))
	common.MemoryCacheEnabled, common.RedisEnabled = false, false
	initCol()
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		common.MemoryCacheEnabled, common.RedisEnabled = previousMemory, previousRedis
		initCol()
		pool, err := mainDB.DB()
		if assert.NoError(t, err) {
			assert.NoError(t, pool.Close())
		}
	})
}

type logQueryRecorder struct {
	logger.Interface
	counts int
}

// Trace counts SQL count statements so pagination tests detect redundant counts
// regardless of whether the aggregate uses *, 1, or a column expression.
func (r *logQueryRecorder) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	sql, _ := fc()
	if strings.Contains(strings.ToUpper(sql), "COUNT(") {
		r.counts++
	}
	r.Interface.Trace(ctx, begin, fc, err)
}

// TestUsageLogPaginationDatabaseMatrix checks exact totals, row order, display
// IDs and omitted redundant counts across supported log databases.
func TestUsageLogPaginationDatabaseMatrix(t *testing.T) {
	for _, kind := range []string{"sqlite", "mysql", "postgres", "clickhouse"} {
		t.Run(kind, func(t *testing.T) {
			db := newLogQueryDatabase(t, kind)
			useLogQueryDatabase(t, db, kind)
			versionSQL := "SELECT version()"
			if kind == "sqlite" {
				versionSQL = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, db.Raw(versionSQL).Scan(&version).Error)
			t.Logf("usage-log database: %s %s", kind, version)
			for range 2 {
				require.NoError(t, migrateLOGDB())
			}
			for _, entry := range []Log{
				{UserId: 1, Username: "alice", CreatedAt: 100, ModelName: "model-a", RequestId: "r1", ChannelId: 9, Other: `{"admin_info":{"private":true}}`},
				{UserId: 1, Username: "alice", CreatedAt: 300, ModelName: "model-a", RequestId: "r2"},
				{UserId: 2, Username: "bob", CreatedAt: 300, ModelName: "model-b", RequestId: "r3"},
				{UserId: 1, Username: "alice", CreatedAt: 200, ModelName: "model-a", RequestId: "r4"},
				{UserId: 1, Username: "alice", CreatedAt: 300, ModelName: "model-a", RequestId: "r5"},
				{UserId: 1, Username: "alice", CreatedAt: 50, ModelName: "model-a", RequestId: "r6"},
			} {
				require.NoError(t, createLog(&entry))
			}
			for _, tc := range []struct {
				name         string
				filter       LogFilter
				user, offset int
				size         int
				requests     []string
				total        int64
				counts       int
			}{
				{"first full page", LogFilter{}, 0, 0, 2, []string{"r5", "r3"}, 6, 1},
				{"negative admin offset", LogFilter{}, 0, -3, 2, []string{"r5", "r3"}, 6, 1},
				{"middle full page", LogFilter{}, 0, 2, 2, []string{"r2", "r4"}, 6, 1},
				{"partial last page", LogFilter{}, 0, 4, 3, []string{"r1", "r6"}, 6, 0},
				{"beyond last page", LogFilter{}, 0, 8, 2, []string{}, 6, 1},
				{"empty first page", LogFilter{ModelName: "absent"}, 0, 0, 2, []string{}, 0, 0},
				{"sparse exact search", LogFilter{RequestId: "r1"}, 0, 0, 10, []string{"r1"}, 1, 0},
				{"mixed filters", LogFilter{StartTimestamp: 100, EndTimestamp: 250, Username: "alice", ModelName: "model-%", Channel: 9}, 0, 0, 10, []string{"r1"}, 1, 0},
				{"user full page", LogFilter{StartTimestamp: 100}, 1, 0, 3, []string{"r5", "r4", "r2"}, 4, 1},
				{"negative user offset", LogFilter{StartTimestamp: 100}, 1, -3, 3, []string{"r5", "r4", "r2"}, 4, 1},
				{"user last page", LogFilter{StartTimestamp: 100}, 1, 3, 3, []string{"r1"}, 4, 0},
				{"user beyond last page", LogFilter{StartTimestamp: 100}, 1, 10, 3, []string{}, 4, 1},
			} {
				t.Run(tc.name, func(t *testing.T) {
					recorder := &logQueryRecorder{Interface: logger.Default.LogMode(logger.Silent)}
					LOG_DB = db.Session(&gorm.Session{Logger: recorder})
					var entries []*Log
					var total int64
					var err error
					if tc.user == 0 {
						entries, total, err = GetAllLogs(tc.filter, tc.offset, tc.size)
					} else {
						entries, total, err = GetUserLogs(tc.user, tc.filter, tc.offset, tc.size)
					}
					require.NoError(t, err)
					assert.Equal(t, tc.total, total)
					requests := make([]string, len(entries))
					for i, entry := range entries {
						requests[i] = entry.RequestId
						if tc.user != 0 {
							assert.Equal(t, max(tc.offset, 0)+i+1, entry.Id)
							assert.NotContains(t, entry.Other, "admin_info")
						} else if kind == "clickhouse" {
							assert.Equal(t, max(tc.offset, 0)+i+1, entry.Id)
						}
						if tc.user == 0 && entry.ChannelId == 9 {
							assert.Equal(t, "primary", entry.ChannelName)
						}
					}
					if kind == "clickhouse" && (tc.name == "user full page" || tc.name == "negative user offset") {
						assert.Equal(t, []string{"r5", "r2", "r4"}, requests)
					} else {
						assert.Equal(t, tc.requests, requests)
					}
					assert.Equal(t, tc.counts, recorder.counts, "only query an exact count when the page cannot establish the total")
				})
			}
		})
	}
}

// TestUsageLogStatisticsTimeWindowsDatabaseMatrix keeps historical quota filters
// separate from the current RPM/TPM window across supported log databases.
func TestUsageLogStatisticsTimeWindowsDatabaseMatrix(t *testing.T) {
	for _, kind := range []string{"sqlite", "mysql", "postgres", "clickhouse"} {
		t.Run(kind, func(t *testing.T) {
			db := newLogQueryDatabase(t, kind)
			useLogQueryDatabase(t, db, kind)
			require.NoError(t, migrateLOGDB())
			now := time.Now().Unix()
			for _, entry := range []Log{
				{CreatedAt: now - 300, Type: LogTypeConsume, ModelName: "model-a", Username: "alice", Quota: 7, PromptTokens: 11, CompletionTokens: 3},
				{CreatedAt: now - 1, Type: LogTypeConsume, ModelName: "model-a", Username: "alice", Quota: 13, PromptTokens: 17, CompletionTokens: 5},
				{CreatedAt: now - 1, Type: LogTypeConsume, ModelName: "model-b", Username: "bob", Quota: 19, PromptTokens: 23, CompletionTokens: 7},
				{CreatedAt: now - 1, Type: LogTypeError, ModelName: "model-a", Username: "alice", Quota: 29, PromptTokens: 31, CompletionTokens: 11},
			} {
				require.NoError(t, createLog(&entry))
			}
			for _, tc := range []struct {
				name, model string
				end         int64
				want        Stat
			}{
				{"historical quota and current rate", "model-a", now - 120, Stat{Quota: 7, Rpm: 1, Tpm: 22}},
				{"all quota excludes errors", "model-a", now, Stat{Quota: 20, Rpm: 1, Tpm: 22}},
				{"empty history keeps current rate", "model-b", now - 120, Stat{Quota: 0, Rpm: 1, Tpm: 30}},
			} {
				t.Run(tc.name, func(t *testing.T) {
					stat, err := SumUsedQuota(LogTypeUnknown, now-3600, tc.end, tc.model, "", "", 0, "")
					require.NoError(t, err)
					assert.Equal(t, tc.want, stat)
				})
			}
		})
	}
}

// logQueryIndexColumns reads declared index-key order, using relation-scoped
// catalog metadata for PostgreSQL.
func logQueryIndexColumns(t *testing.T, db *gorm.DB) map[string][]string {
	t.Helper()
	indexes, err := db.Migrator().GetIndexes(&Log{})
	require.NoError(t, err)
	columns := make(map[string][]string, len(indexes))
	for _, index := range indexes {
		columns[index.Name()] = index.Columns()
	}
	if db.Dialector.Name() == "postgres" {
		var ordered []struct{ IndexName, ColumnName string }
		require.NoError(t, db.Raw(`SELECT index_relation.relname AS index_name, attribute.attname AS column_name
FROM pg_catalog.pg_index AS index_meta
JOIN pg_catalog.pg_class AS index_relation ON index_relation.oid = index_meta.indexrelid
CROSS JOIN LATERAL unnest(index_meta.indkey) WITH ORDINALITY AS index_column(attnum, ordinal_position)
JOIN pg_catalog.pg_attribute AS attribute
  ON attribute.attrelid = index_meta.indrelid AND attribute.attnum = index_column.attnum
WHERE index_meta.indrelid = to_regclass(?)
ORDER BY index_relation.relname, index_column.ordinal_position`, "logs").Scan(&ordered).Error)
		clear(columns)
		for _, column := range ordered {
			columns[column.IndexName] = append(columns[column.IndexName], column.ColumnName)
		}
	}
	return columns
}

// TestUsageLogLegacyIndexMigrationDatabaseMatrix verifies that repeated primary
// and separate log migrations repair index order while preserving stored data.
func TestUsageLogLegacyIndexMigrationDatabaseMatrix(t *testing.T) {
	for _, kind := range []string{"sqlite", "mysql", "postgres"} {
		for _, storage := range []string{"primary", "separate"} {
			t.Run(kind+"/"+storage, func(t *testing.T) {
				db := newLogQueryDatabase(t, kind)
				useLogQueryDatabase(t, db, kind)
				if storage == "primary" {
					DB = db
					common.SetMainDatabaseType(common.DatabaseType(kind))
					initCol()
				}
				require.NoError(t, db.AutoMigrate(&Log{}))
				require.NoError(t, db.Migrator().DropIndex(&Log{}, "idx_created_at_id"))
				require.NoError(t, db.Exec("CREATE INDEX ? ON ? (?, ?)", clause.Column{Name: "idx_created_at_id"}, clause.Table{Name: "logs"}, clause.Column{Name: "id"}, clause.Column{Name: "created_at"}).Error)
				require.NoError(t, db.Exec("CREATE UNIQUE INDEX ? ON ? (?, ?)", clause.Column{Name: "fixture_request_unique"}, clause.Table{Name: "logs"}, clause.Column{Name: "request_id"}, clause.Column{Name: "username"}).Error)
				entry := Log{CreatedAt: 100, RequestId: "preserved", Quota: 17, Other: `{"preserved":true}`}
				require.NoError(t, createLog(&entry))
				originalIndexes := logQueryIndexColumns(t, db)
				for range 2 {
					if storage == "primary" {
						require.NoError(t, migrateDB())
					} else {
						require.NoError(t, migrateLOGDB())
					}
					indexes := logQueryIndexColumns(t, db)
					for _, column := range []string{"model_name", "channel_id", "username", "user_id"} {
						found := false
						for _, columns := range indexes {
							if len(columns) >= 2 && columns[0] == column && columns[1] == "created_at" {
								found = true
								break
							}
						}
						assert.True(t, found, "%s time-range searches need a matching composite index", column)
					}
					assert.Equal(t, []string{"created_at", "id"}, indexes["idx_created_at_id"])
					for name, columns := range originalIndexes {
						if name != "idx_created_at_id" {
							assert.Equal(t, columns, indexes[name], "unrelated indexes must remain unchanged")
						}
					}
					var stored Log
					require.NoError(t, db.Where("request_id = ?", entry.RequestId).First(&stored).Error)
					assert.Equal(t, entry, stored)
				}
				assert.Error(t, db.Create(&Log{RequestId: entry.RequestId}).Error, "upgrades must preserve existing uniqueness guarantees")
			})
		}
	}
}

// TestUsageLogTimeIndexPreservesPostgresSchemas protects the active schema's
// unique index from conflicting index names in other PostgreSQL schemas.
func TestUsageLogTimeIndexPreservesPostgresSchemas(t *testing.T) {
	db := newLogQueryDatabase(t, "postgres")
	useLogQueryDatabase(t, db, "postgres")
	// Create the shadow relation first, reproducing the driver's unscoped
	// metadata query returning this nonunique index before the active one.
	require.NoError(t, db.Exec("CREATE SCHEMA shadow").Error)
	require.NoError(t, db.Exec("CREATE TABLE shadow.logs (id BIGINT, created_at BIGINT)").Error)
	require.NoError(t, db.Exec("CREATE INDEX idx_created_at_id ON shadow.logs (id, created_at)").Error)
	require.NoError(t, db.AutoMigrate(&Log{}))
	require.NoError(t, db.Migrator().DropIndex(&Log{}, "idx_created_at_id"))
	require.NoError(t, db.Exec("CREATE UNIQUE INDEX idx_created_at_id ON logs (id, created_at)").Error)
	for range 2 {
		require.NoError(t, migrateLogTimeIndex(db))
		var unique bool
		require.NoError(t, db.Raw("SELECT indisunique FROM pg_catalog.pg_index WHERE indrelid = to_regclass(?) AND indexrelid = to_regclass(?)", "logs", "idx_created_at_id").Scan(&unique).Error)
		assert.True(t, unique, "the active schema's unique index must not be replaced using metadata from another schema")
	}
}
