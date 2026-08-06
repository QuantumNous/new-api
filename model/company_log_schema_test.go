package model

import (
	"os"
	"sort"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

var companyLogSecondaryIndexes = map[string][]string{
	"idx_logs_company_created_id":          {"created_at", "id"},
	"idx_logs_company_type_created_id":     {"type", "created_at", "id"},
	"idx_logs_company_model_created_id":    {"model_name", "created_at", "id"},
	"idx_logs_company_token_created_id":    {"token_name", "created_at", "id"},
	"idx_logs_company_channel_created_id":  {"channel_id", "created_at", "id"},
	"idx_logs_company_request_id":          {"request_id"},
	"idx_logs_company_upstream_request_id": {"upstream_request_id"},
}

var companyLogVarchar191Columns = map[string]struct{}{
	"username":   {},
	"token_name": {},
	"model_name": {},
	"group":      {},
	"ip":         {},
}

func TestCompanyLogSchemaMatchesLogPersistedFields(t *testing.T) {
	logSchema := parseCompanyLogTestSchema(t, &Log{})
	companySchema := parseCompanyLogTestSchema(t, &CompanyLogSchema{})

	require.Equal(t, "logs_company", companySchema.Table)
	logPersistedColumns := make([]string, 0, len(logSchema.DBNames)-1)
	for _, column := range logSchema.DBNames {
		if column != "channel_name" {
			logPersistedColumns = append(logPersistedColumns, column)
		}
	}
	require.Equal(t, logPersistedColumns, companySchema.DBNames)
	for _, column := range logPersistedColumns {
		logField := logSchema.FieldsByDBName[column]
		companyField := companySchema.FieldsByDBName[column]
		require.NotNil(t, companyField, column)
		if _, isVarchar191 := companyLogVarchar191Columns[column]; isVarchar191 {
			require.Equal(t, schema.DataType("varchar(191)"), companyField.DataType, column)
			require.Equal(t, "varchar(191)", companyField.TagSettings["TYPE"], column)
		} else {
			require.Equal(t, logField.DataType, companyField.DataType, column)
			require.Equal(t, logField.Size, companyField.Size, column)
		}
		require.Equal(t, logField.GORMDataType, companyField.GORMDataType, column)
		require.Equal(t, logField.PrimaryKey, companyField.PrimaryKey, column)
		require.Equal(t, logField.AutoIncrement, companyField.AutoIncrement, column)
		require.Equal(t, logField.NotNull, companyField.NotNull, column)
		require.Equal(t, logField.HasDefaultValue, companyField.HasDefaultValue, column)
		require.Equal(t, logField.DefaultValue, companyField.DefaultValue, column)
		require.Equal(t, logField.IgnoreMigration, companyField.IgnoreMigration, column)
	}
}

func TestCompanyLogSchemaDeclaresExactlySevenSecondaryIndexes(t *testing.T) {
	parsed := parseCompanyLogTestSchema(t, &CompanyLogSchema{})
	indexes := parsed.ParseIndexes()
	require.Len(t, indexes, 7)

	actual := make(map[string][]string, len(indexes))
	for _, index := range indexes {
		columns := make([]string, 0, len(index.Fields))
		for _, field := range index.Fields {
			columns = append(columns, field.DBName)
		}
		actual[index.Name] = columns
	}
	require.Equal(t, companyLogSecondaryIndexes, actual)
}

func TestCompanyLogSchemaMainDatabaseMigrationIsFreshAndIdempotent(t *testing.T) {
	db := openCompanyLogSQLiteDB(t, "main")
	restoreCompanyLogMainDB(t, db)

	require.False(t, db.Migrator().HasTable(&CompanyLogSchema{}))
	require.NoError(t, migrateDB())
	assertCompanyLogMigratedSchema(t, db)
	require.NoError(t, db.AutoMigrate(&CompanyLogSchema{}))
	assertCompanyLogMigratedSchema(t, db)
}

func TestCompanyLogSchemaLogDatabaseMigrationAcrossDialects(t *testing.T) {
	tests := []struct {
		name string
		open func(*testing.T) *gorm.DB
	}{
		{name: "sqlite", open: func(t *testing.T) *gorm.DB { return openCompanyLogSQLiteDB(t, "log") }},
		{name: "mysql", open: func(t *testing.T) *gorm.DB { return openCompanyLogExternalDB(t, "mysql") }},
		{name: "postgres", open: func(t *testing.T) *gorm.DB { return openCompanyLogExternalDB(t, "postgres") }},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			db := test.open(t)
			restoreCompanyLogDB(t, &LOG_DB, db)

			require.False(t, db.Migrator().HasTable(&CompanyLogSchema{}))
			require.NoError(t, migrateLOGDB())
			assertCompanyLogMigratedSchema(t, db)
			require.NoError(t, migrateLOGDB())
			assertCompanyLogMigratedSchema(t, db)
		})
	}
}

func parseCompanyLogTestSchema(t *testing.T, value any) *schema.Schema {
	t.Helper()
	parsed, err := schema.Parse(value, &sync.Map{}, schema.NamingStrategy{})
	require.NoError(t, err)
	return parsed
}

func assertCompanyLogMigratedSchema(t *testing.T, db *gorm.DB) {
	t.Helper()
	require.True(t, db.Migrator().HasTable(&CompanyLogSchema{}))

	columnTypes, err := db.Migrator().ColumnTypes(&CompanyLogSchema{})
	require.NoError(t, err)
	actualColumns := make([]string, 0, len(columnTypes))
	for _, columnType := range columnTypes {
		actualColumns = append(actualColumns, columnType.Name())
	}
	sort.Strings(actualColumns)
	expectedColumns := append([]string(nil), parseCompanyLogTestSchema(t, &CompanyLogSchema{}).DBNames...)
	sort.Strings(expectedColumns)
	require.Equal(t, expectedColumns, actualColumns)

	require.Equal(t, companyLogSecondaryIndexes, companyLogPhysicalSecondaryIndexes(t, db))
}

func companyLogPhysicalSecondaryIndexes(t *testing.T, db *gorm.DB) map[string][]string {
	t.Helper()
	type indexRow struct {
		IndexName   string
		ColumnName  string
		ColumnOrder int
	}
	var rows []indexRow
	var err error
	switch db.Dialector.Name() {
	case "sqlite":
		err = db.Raw("SELECT indexes.name AS index_name, columns.name AS column_name, columns.seqno + 1 AS column_order FROM pragma_index_list(?) AS indexes JOIN pragma_index_info(indexes.name) AS columns WHERE indexes.origin <> 'pk' ORDER BY indexes.name, columns.seqno", "logs_company").Scan(&rows).Error
	case "mysql":
		err = db.Raw("SELECT index_name AS index_name, column_name AS column_name, seq_in_index AS column_order FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name <> 'PRIMARY' ORDER BY index_name, seq_in_index", "logs_company").Scan(&rows).Error
	case "postgres":
		err = db.Raw("SELECT index_class.relname AS index_name, column_meta.attname AS column_name, index_column.ordinality AS column_order FROM pg_class AS table_class JOIN pg_namespace AS namespace ON namespace.oid = table_class.relnamespace JOIN pg_index AS index_meta ON index_meta.indrelid = table_class.oid JOIN pg_class AS index_class ON index_class.oid = index_meta.indexrelid JOIN LATERAL unnest(index_meta.indkey) WITH ORDINALITY AS index_column(attnum, ordinality) ON TRUE JOIN pg_attribute AS column_meta ON column_meta.attrelid = table_class.oid AND column_meta.attnum = index_column.attnum WHERE namespace.nspname = CURRENT_SCHEMA() AND table_class.relname = ? AND NOT index_meta.indisprimary ORDER BY index_class.relname, index_column.ordinality", "logs_company").Scan(&rows).Error
	default:
		t.Fatalf("unsupported company log test dialect %q", db.Dialector.Name())
	}
	require.NoError(t, err)
	indexes := make(map[string][]string)
	for _, row := range rows {
		require.Equal(t, len(indexes[row.IndexName])+1, row.ColumnOrder, row.IndexName)
		indexes[row.IndexName] = append(indexes[row.IndexName], row.ColumnName)
	}
	return indexes
}

func openCompanyLogSQLiteDB(t *testing.T, suffix string) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/company-log-"+suffix+".db"), &gorm.Config{})
	require.NoError(t, err)
	closeCompanyLogTestDB(t, db)
	return db
}

func openCompanyLogExternalDB(t *testing.T, dialect string) *gorm.DB {
	t.Helper()

	var (
		db  *gorm.DB
		err error
	)
	switch dialect {
	case "mysql":
		dsn := strings.TrimSpace(os.Getenv("TEST_MYSQL_DSN"))
		if dsn == "" {
			t.Skip("set TEST_MYSQL_DSN to run the MySQL company log migration test")
		}
		db, err = gorm.Open(mysql.Open(ensureMySQLDSNDefaults(dsn)), &gorm.Config{})
	case "postgres":
		dsn := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN"))
		if dsn == "" {
			t.Skip("set TEST_POSTGRES_DSN to run the PostgreSQL company log migration test")
		}
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		t.Fatalf("unsupported company log test dialect %q", dialect)
	}
	require.NoError(t, err)
	closeCompanyLogTestDB(t, db)

	models := []any{&Log{}, &CompanyLogSchema{}, &LogRequestSample{}, &TaskAcceptedAccountingLogLedger{}}
	for _, model := range models {
		if db.Migrator().HasTable(model) {
			t.Fatalf("refusing to alter existing %s table %s", dialect, modelTableName(t, model))
		}
	}
	t.Cleanup(func() {
		_ = db.Migrator().DropTable(models...)
	})
	return db
}

func modelTableName(t *testing.T, value any) string {
	t.Helper()
	return parseCompanyLogTestSchema(t, value).Table
}

func closeCompanyLogTestDB(t *testing.T, db *gorm.DB) {
	t.Helper()
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
}

func restoreCompanyLogDB(t *testing.T, target **gorm.DB, db *gorm.DB) {
	t.Helper()
	original := *target
	*target = db
	t.Cleanup(func() { *target = original })
}

func restoreCompanyLogMainDB(t *testing.T, db *gorm.DB) {
	t.Helper()
	restoreCompanyLogDB(t, &DB, db)
	originalSQLite := common.UsingSQLite
	originalMySQL := common.UsingMySQL
	originalPostgreSQL := common.UsingPostgreSQL
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	t.Cleanup(func() {
		common.UsingSQLite = originalSQLite
		common.UsingMySQL = originalMySQL
		common.UsingPostgreSQL = originalPostgreSQL
	})
}
