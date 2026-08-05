package model

import (
	"database/sql"
	"database/sql/driver"
	"errors"
	"regexp"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	mysqldriver "gorm.io/driver/mysql"
	postgresdriver "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// legacyQuotaData is the pre-int64 shape of the production quota_data table.
// It exists only so the migration guard can prove that widening the Go field
// types to int64 does not change the generated DDL: GORM already sized these
// columns as 64-bit integers.
type legacyQuotaData struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
}

func (legacyQuotaData) TableName() string { return "quota_data" }

func sqliteTableDDL(t *testing.T, migrate func(db *gorm.DB) error) string {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, migrate(db))

	var ddl string
	require.NoError(t, db.Raw(
		"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'quota_data'",
	).Scan(&ddl).Error)
	return ddl
}

// TestQuotaDataSchemaIsUnchangedByInt64Columns is the migration guard for the
// int64 widening. quota_data is an existing production table, so the change is
// only safe if AutoMigrate produces byte-identical DDL.
func TestQuotaDataSchemaIsUnchangedByInt64Columns(t *testing.T) {
	legacyDDL := sqliteTableDDL(t, func(db *gorm.DB) error {
		return db.AutoMigrate(&legacyQuotaData{})
	})
	currentDDL := sqliteTableDDL(t, func(db *gorm.DB) error {
		return db.AutoMigrate(&QuotaData{})
	})

	require.NotEmpty(t, legacyDDL)
	assert.Equal(t, legacyDDL, currentDDL,
		"widening QuotaData counters to int64 must not change the generated schema")
	for _, column := range []string{"token_used", "count", "quota"} {
		assert.Contains(t, currentDDL, column)
	}
}

// offlineDriverName is a database/sql driver registered by this test file only.
// It never opens a socket: Open returns a stub connection whose Prepare/Begin
// always fail. Combined with gorm's DryRun and DisableAutomaticPing this makes
// the dialect SQL assertions provably offline — no MySQL or PostgreSQL server
// is contacted and no DSN from the environment is read.
const offlineDriverName = "aibuff-dashboard-offline"

type offlineDriver struct{}

type offlineConn struct{}

var errOfflineDriver = errors.New("offline dialect test driver must never execute a statement")

func (offlineDriver) Open(string) (driver.Conn, error) { return offlineConn{}, nil }

func (offlineConn) Prepare(string) (driver.Stmt, error) { return nil, errOfflineDriver }
func (offlineConn) Close() error                        { return nil }
func (offlineConn) Begin() (driver.Tx, error)           { return nil, errOfflineDriver }

func init() { sql.Register(offlineDriverName, offlineDriver{}) }

func openOfflineDB(t *testing.T) *sql.DB {
	t.Helper()
	// sql.Open is lazy: no connection is established here, and DryRun means no
	// statement is ever executed against it.
	conn, err := sql.Open(offlineDriverName, "")
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

// dryRunSQL renders the SQL a dialect would send, without opening a connection.
func dryRunSQL(t *testing.T, dialector gorm.Dialector, build func(db *gorm.DB) *gorm.DB) string {
	t.Helper()
	db, err := gorm.Open(dialector, &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
	})
	require.NoError(t, err)
	statement := build(db.Session(&gorm.Session{DryRun: true})).Statement
	return db.Dialector.Explain(statement.SQL.String(), statement.Vars...)
}

func mysqlDryRunDialector(t *testing.T) gorm.Dialector {
	return mysqldriver.New(mysqldriver.Config{
		DriverName:                offlineDriverName,
		Conn:                      openOfflineDB(t),
		SkipInitializeWithVersion: true,
	})
}

func postgresDryRunDialector(t *testing.T) gorm.Dialector {
	return postgresdriver.New(postgresdriver.Config{
		DriverName:           offlineDriverName,
		Conn:                 openOfflineDB(t),
		WithoutReturning:     true,
		PreferSimpleProtocol: true,
	})
}

// TestQuotaDataSegmentedSQLIsBoundedOnEveryDialect renders the real segmented
// query for SQLite, MySQL and PostgreSQL and asserts the range predicate and the
// row cap survive on all three. It replaces a live three-database run, which is
// not available here; see the NEEDS_INFO note in the handoff.
func TestQuotaDataSegmentedSQLIsBoundedOnEveryDialect(t *testing.T) {
	const start int64 = 1782835242
	const end int64 = 1785899265

	segments, err := common.SplitDashboardRange(start, end)
	require.NoError(t, err)
	require.Len(t, segments, 2)

	dialects := map[string]gorm.Dialector{
		"sqlite":   sqlite.Open(":memory:"),
		"mysql":    mysqlDryRunDialector(t),
		"postgres": postgresDryRunDialector(t),
	}

	for name, dialector := range dialects {
		t.Run(name, func(t *testing.T) {
			for i, segment := range segments {
				sql := dryRunSQL(t, dialector, func(db *gorm.DB) *gorm.DB {
					var rows []*QuotaData
					return db.Table("quota_data").
						Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, created_at").
						Group("model_name, created_at").
						Where("created_at >= ? and created_at <= ?", segment.Start, segment.End).
						Limit(maxQuotaDataRows + 1).
						Find(&rows)
				})

				lowered := strings.ToLower(sql)
				assert.Contains(t, lowered, "created_at >=", "segment %d must keep a lower bound", i)
				assert.Contains(t, lowered, "created_at <=", "segment %d must keep an upper bound", i)
				assert.Contains(t, lowered, "limit", "segment %d must keep the row cap", i)
				assert.Contains(t, sql, "200001")
				// Every rendered segment stays within the per-statement bound.
				assert.LessOrEqual(t, segment.End-segment.Start, common.DashboardMaxSegmentSeconds)
			}
		})
	}
}

// TestLogUsageAnalysisPeriodSQLIsIntegerOnEveryDialect pins the Asia/Shanghai
// bucket expression per dialect. The offset is a constant UTC+8 (no DST), and
// each dialect must use integer division so period_bucket scans into int64.
func TestLogUsageAnalysisPeriodSQLIsIntegerOnEveryDialect(t *testing.T) {
	const hourStep int64 = 3600
	const dayStep int64 = 24 * 60 * 60

	cases := []struct {
		dialect  string
		contains string
	}{
		{dialect: "sqlite", contains: "AS INTEGER"},
		{dialect: "mysql", contains: " DIV "},
		{dialect: "postgres", contains: "AS BIGINT"},
	}
	offsetPattern := regexp.MustCompile(`\+ 28800\b`)

	for _, test := range cases {
		t.Run(test.dialect, func(t *testing.T) {
			for _, step := range []int64{hourStep, dayStep} {
				expression := logUsageAnalysisPeriodExpression(test.dialect, common.DashboardBucketOffsetSeconds, step)
				assert.Contains(t, expression, test.contains)
				assert.NotContains(t, expression, "FLOOR",
					"floating point truncation would break the int64 scan contract")
				assert.Regexp(t, offsetPattern, expression,
					"the Asia/Shanghai offset must be the fixed 28800 seconds")
				assert.Contains(t, expression, "- 28800")
			}
		})
	}
}

// The SQL bucket expression and the Go mirror used by tests must agree, so a
// cross-month or segment-boundary assertion in Go describes the real grouping.
func TestGoBucketMirrorMatchesSQLBucketsAcrossMonthBoundary(t *testing.T) {
	truncateTables(t)
	initCol()

	// 2026-07-31 23:30:00 and 2026-08-01 00:30:00 Asia/Shanghai straddle both a
	// natural month boundary and a CST day boundary.
	const julyLateNight int64 = 1785511800
	const augustEarly int64 = 1785515400

	logs := []Log{
		{UserId: 1, CreatedAt: julyLateNight, Type: LogTypeConsume, ModelName: "cross-month", Quota: 7},
		{UserId: 1, CreatedAt: augustEarly, Type: LogTypeConsume, ModelName: "cross-month", Quota: 11},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	for _, granularity := range []struct {
		name string
		step int64
	}{{name: "hour", step: 3600}, {name: "day", step: 24 * 60 * 60}} {
		t.Run(granularity.name, func(t *testing.T) {
			rows, err := GetLogUsageAnalysis(LogUsageAnalysisFilter{
				LogUsageSummaryFilter: LogUsageSummaryFilter{
					UserId: 1, StartTimestamp: julyLateNight - 1, EndTimestamp: augustEarly + 1,
				},
				Granularity: granularity.name,
				Dimensions:  []string{"period", "model_name"},
			})
			require.NoError(t, err)
			require.Len(t, rows, 2, "the two sides of the month boundary are distinct buckets")
			julyBucket, ok := common.DashboardBucketStart(julyLateNight, granularity.step)
			require.True(t, ok)
			augustBucket, ok := common.DashboardBucketStart(augustEarly, granularity.step)
			require.True(t, ok)
			assert.Equal(t, julyBucket, rows[0].Period)
			assert.Equal(t, augustBucket, rows[1].Period)
			assert.EqualValues(t, 7, rows[0].Quota)
			assert.EqualValues(t, 11, rows[1].Quota)
		})
	}
}
