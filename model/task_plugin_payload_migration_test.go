package model

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"os"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	gormMySQL "gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

type taskPluginPayloadTestColumn struct {
	dataType             string
	columnType           string
	nullable             string
	defaultValue         driver.Value
	extra                string
	comment              string
	characterSet         driver.Value
	collation            driver.Value
	generationExpression string
}

type taskPluginPayloadTestEvent struct {
	connection int64
	kind       string
	column     string
}

type taskPluginPayloadTestDatabase struct {
	mu                    sync.Mutex
	advisoryLock          sync.Mutex
	nextConnection        atomic.Int64
	tableExists           bool
	tableType             string
	columns               map[string]taskPluginPayloadTestColumn
	globalMetadataVisible bool
	alterAllowed          bool
	failColumnInspection  error
	failCapabilityInspect error
	afterAlter            func(*taskPluginPayloadTestDatabase, string)
	firstAlterStarted     chan struct{}
	continueFirstAlter    chan struct{}
	secondLockAttempted   chan struct{}
	lockAttempts          int
	owner                 int64
	events                []taskPluginPayloadTestEvent
	unsafeConnection      bool
}

type taskPluginPayloadTestDriver struct {
	database *taskPluginPayloadTestDatabase
}

type taskPluginPayloadTestConn struct {
	database *taskPluginPayloadTestDatabase
	id       int64
	heldLock bool
}

type taskPluginPayloadTestRows struct {
	columns []string
	values  [][]driver.Value
	index   int
}

type taskPluginPayloadTestColumnType struct {
	name     string
	dataType string
	nullable bool
}

type taskPluginPayloadAlterHookLogger struct {
	logger.Interface
	once sync.Once
	hook func()
}

var taskPluginPayloadTestDriverSequence atomic.Uint64

func (column taskPluginPayloadTestColumnType) Name() string { return column.name }
func (column taskPluginPayloadTestColumnType) DatabaseTypeName() string {
	return column.dataType
}
func (taskPluginPayloadTestColumnType) ColumnType() (string, bool)  { return "", false }
func (taskPluginPayloadTestColumnType) PrimaryKey() (bool, bool)    { return false, false }
func (taskPluginPayloadTestColumnType) AutoIncrement() (bool, bool) { return false, false }
func (taskPluginPayloadTestColumnType) Length() (int64, bool)       { return 0, false }
func (taskPluginPayloadTestColumnType) DecimalSize() (int64, int64, bool) {
	return 0, 0, false
}
func (column taskPluginPayloadTestColumnType) Nullable() (bool, bool) {
	return column.nullable, true
}
func (taskPluginPayloadTestColumnType) Unique() (bool, bool)         { return false, false }
func (taskPluginPayloadTestColumnType) ScanType() reflect.Type       { return reflect.TypeFor[string]() }
func (taskPluginPayloadTestColumnType) Comment() (string, bool)      { return "", false }
func (taskPluginPayloadTestColumnType) DefaultValue() (string, bool) { return "", false }

func (hook *taskPluginPayloadAlterHookLogger) Trace(
	ctx context.Context,
	begin time.Time,
	sql func() (string, int64),
	err error,
) {
	statement, _ := sql()
	hook.Interface.Trace(ctx, begin, sql, err)
	if strings.Contains(
		strings.ToUpper(statement),
		"ALTER TABLE `TASK_PLUGINS` MODIFY COLUMN `SOURCE`",
	) {
		hook.once.Do(hook.hook)
	}
}

func newTaskPluginPayloadTestDatabase(sourceType, iconType string) *taskPluginPayloadTestDatabase {
	column := func(columnType, nullable string) taskPluginPayloadTestColumn {
		return taskPluginPayloadTestColumn{
			dataType:     columnType,
			columnType:   columnType,
			nullable:     nullable,
			characterSet: "utf8mb4",
			collation:    "utf8mb4_unicode_ci",
		}
	}
	return &taskPluginPayloadTestDatabase{
		tableExists:           true,
		tableType:             "BASE TABLE",
		globalMetadataVisible: true,
		alterAllowed:          true,
		columns: map[string]taskPluginPayloadTestColumn{
			"source": column(sourceType, "NO"),
			"icon":   column(iconType, "YES"),
		},
	}
}

func openTaskPluginPayloadTestDB(
	t *testing.T,
	database *taskPluginPayloadTestDatabase,
) *gorm.DB {
	t.Helper()
	driverName := fmt.Sprintf(
		"task-plugin-payload-migration-%d",
		taskPluginPayloadTestDriverSequence.Add(1),
	)
	sql.Register(driverName, &taskPluginPayloadTestDriver{database: database})
	sqlDB, err := sql.Open(driverName, "")
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(8)
	t.Cleanup(func() { assert.NoError(t, sqlDB.Close()) })
	db, err := gorm.Open(gormMySQL.New(gormMySQL.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{
		DisableAutomaticPing: true,
		Logger:               logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	return db
}

func (testDriver *taskPluginPayloadTestDriver) Open(string) (driver.Conn, error) {
	return &taskPluginPayloadTestConn{
		database: testDriver.database,
		id:       testDriver.database.nextConnection.Add(1),
	}, nil
}

func (*taskPluginPayloadTestConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("prepare is not supported")
}

func (conn *taskPluginPayloadTestConn) Close() error {
	if conn.heldLock {
		conn.database.mu.Lock()
		conn.database.owner = 0
		conn.database.mu.Unlock()
		conn.database.advisoryLock.Unlock()
		conn.heldLock = false
	}
	return nil
}

func (*taskPluginPayloadTestConn) Begin() (driver.Tx, error) {
	return nil, errors.New("transactions are not supported")
}

func (conn *taskPluginPayloadTestConn) QueryContext(
	_ context.Context,
	query string,
	_ []driver.NamedValue,
) (driver.Rows, error) {
	normalized := strings.ToUpper(strings.Join(strings.Fields(query), " "))
	switch {
	case strings.HasPrefix(normalized, "SELECT GET_LOCK("):
		conn.database.mu.Lock()
		conn.database.lockAttempts++
		lockAttempts := conn.database.lockAttempts
		secondAttempted := conn.database.secondLockAttempted
		conn.database.mu.Unlock()
		if lockAttempts == 2 && secondAttempted != nil {
			close(secondAttempted)
		}
		conn.database.advisoryLock.Lock()
		conn.heldLock = true
		conn.database.mu.Lock()
		conn.database.owner = conn.id
		conn.database.events = append(conn.database.events, taskPluginPayloadTestEvent{
			connection: conn.id,
			kind:       "lock",
		})
		conn.database.mu.Unlock()
		return &taskPluginPayloadTestRows{
			columns: []string{"get_lock"},
			values:  [][]driver.Value{{int64(1)}},
		}, nil
	case strings.HasPrefix(normalized, "SELECT RELEASE_LOCK("):
		conn.database.mu.Lock()
		held := conn.heldLock && conn.database.owner == conn.id
		conn.database.events = append(conn.database.events, taskPluginPayloadTestEvent{
			connection: conn.id,
			kind:       "unlock",
		})
		if held {
			conn.database.owner = 0
			conn.heldLock = false
		}
		conn.database.mu.Unlock()
		if held {
			conn.database.advisoryLock.Unlock()
		}
		result := int64(0)
		if held {
			result = 1
		}
		return &taskPluginPayloadTestRows{
			columns: []string{"release_lock"},
			values:  [][]driver.Value{{result}},
		}, nil
	case normalized == "SELECT 1 FROM `TASK_PLUGINS` LIMIT 0":
		conn.database.mu.Lock()
		defer conn.database.mu.Unlock()
		if !conn.database.tableExists {
			return nil, &mysqlDriver.MySQLError{Number: 1146, Message: "table does not exist"}
		}
		return &taskPluginPayloadTestRows{
			columns: []string{"1"},
		}, nil
	case strings.Contains(normalized, "FROM INFORMATION_SCHEMA.TABLES") &&
		strings.Contains(normalized, "TASK_PLUGINS"):
		conn.database.mu.Lock()
		defer conn.database.mu.Unlock()
		values := [][]driver.Value(nil)
		if conn.database.tableExists {
			values = [][]driver.Value{{conn.database.tableType}}
		}
		return &taskPluginPayloadTestRows{
			columns: []string{"table_type"},
			values:  values,
		}, nil
	case strings.Contains(normalized, "FROM INFORMATION_SCHEMA.COLUMNS") &&
		strings.Contains(normalized, "TASK_PLUGINS"):
		conn.database.mu.Lock()
		defer conn.database.mu.Unlock()
		if conn.database.failColumnInspection != nil {
			return nil, conn.database.failColumnInspection
		}
		values := make([][]driver.Value, 0, 2)
		for _, name := range []string{"source", "icon"} {
			column, ok := conn.database.columns[name]
			if !ok {
				continue
			}
			values = append(values, []driver.Value{
				name,
				column.dataType,
				column.columnType,
				column.nullable,
				column.defaultValue,
				column.extra,
				column.comment,
				column.characterSet,
				column.collation,
				column.generationExpression,
			})
		}
		return &taskPluginPayloadTestRows{
			columns: []string{
				"column_name",
				"data_type",
				"column_type",
				"is_nullable",
				"column_default",
				"extra",
				"column_comment",
				"character_set_name",
				"collation_name",
				"generation_expression",
			},
			values: values,
		}, nil
	case strings.Contains(normalized, "AS HAS_ALTER_PRIVILEGE"):
		conn.database.mu.Lock()
		defer conn.database.mu.Unlock()
		if conn.database.failCapabilityInspect != nil {
			return nil, conn.database.failCapabilityInspect
		}
		value := int64(0)
		if conn.database.alterAllowed {
			value = 1
		}
		conn.database.events = append(conn.database.events, taskPluginPayloadTestEvent{
			connection: conn.id,
			kind:       "alter-capability",
		})
		return &taskPluginPayloadTestRows{
			columns: []string{"has_alter_privilege"},
			values:  [][]driver.Value{{value}},
		}, nil
	case strings.Contains(normalized, "AS HAS_GLOBAL_PRIVILEGE"):
		conn.database.mu.Lock()
		defer conn.database.mu.Unlock()
		if conn.database.failCapabilityInspect != nil {
			return nil, conn.database.failCapabilityInspect
		}
		value := int64(0)
		if conn.database.globalMetadataVisible {
			value = 1
		}
		conn.database.events = append(conn.database.events, taskPluginPayloadTestEvent{
			connection: conn.id,
			kind:       "metadata-capability",
		})
		return &taskPluginPayloadTestRows{
			columns: []string{"has_global_privilege"},
			values:  [][]driver.Value{{value}},
		}, nil
	case strings.HasPrefix(normalized, "SHOW GRANTS FOR CURRENT_USER"):
		conn.database.mu.Lock()
		defer conn.database.mu.Unlock()
		if conn.database.failCapabilityInspect != nil {
			return nil, conn.database.failCapabilityInspect
		}
		grant := "GRANT USAGE ON *.* TO 'migration'@'%'"
		if conn.database.globalMetadataVisible {
			grant = "GRANT SELECT ON *.* TO 'migration'@'%'"
		}
		return &taskPluginPayloadTestRows{
			columns: []string{"Grants for migration@%"},
			values:  [][]driver.Value{{grant}},
		}, nil
	default:
		return nil, fmt.Errorf("unexpected task plugin migration query: %s", normalized)
	}
}

func (conn *taskPluginPayloadTestConn) ExecContext(
	_ context.Context,
	query string,
	_ []driver.NamedValue,
) (driver.Result, error) {
	normalized := strings.ToUpper(strings.Join(strings.Fields(query), " "))
	if !strings.HasPrefix(normalized, "ALTER TABLE `TASK_PLUGINS` MODIFY COLUMN ") {
		return nil, fmt.Errorf("unexpected task plugin migration exec: %s", normalized)
	}
	var columnName string
	switch {
	case strings.Contains(normalized, "MODIFY COLUMN `SOURCE` LONGTEXT"):
		columnName = "source"
	case strings.Contains(normalized, "MODIFY COLUMN `ICON` LONGTEXT"):
		columnName = "icon"
	default:
		return nil, fmt.Errorf("unexpected task plugin payload ALTER: %s", normalized)
	}

	conn.database.mu.Lock()
	firstAlter := true
	for _, event := range conn.database.events {
		if event.kind == "alter" {
			firstAlter = false
			break
		}
	}
	firstStarted := conn.database.firstAlterStarted
	continueFirst := conn.database.continueFirstAlter
	conn.database.mu.Unlock()
	if firstAlter && firstStarted != nil {
		close(firstStarted)
		<-continueFirst
	}

	conn.database.mu.Lock()
	if conn.database.owner != conn.id || !conn.heldLock {
		conn.database.unsafeConnection = true
	}
	column := conn.database.columns[columnName]
	column.dataType = "longtext"
	column.columnType = "longtext"
	conn.database.columns[columnName] = column
	conn.database.events = append(conn.database.events, taskPluginPayloadTestEvent{
		connection: conn.id,
		kind:       "alter",
		column:     columnName,
	})
	afterAlter := conn.database.afterAlter
	conn.database.mu.Unlock()
	if afterAlter != nil {
		afterAlter(conn.database, columnName)
	}
	return driver.RowsAffected(0), nil
}

func (rows *taskPluginPayloadTestRows) Columns() []string {
	return rows.columns
}

func (*taskPluginPayloadTestRows) Close() error {
	return nil
}

func (rows *taskPluginPayloadTestRows) Next(destination []driver.Value) error {
	if rows.index == len(rows.values) {
		return io.EOF
	}
	copy(destination, rows.values[rows.index])
	rows.index++
	return nil
}

func (database *taskPluginPayloadTestDatabase) alterColumns() []string {
	database.mu.Lock()
	defer database.mu.Unlock()
	columns := make([]string, 0, len(database.events))
	for _, event := range database.events {
		if event.kind == "alter" {
			columns = append(columns, event.column)
		}
	}
	return columns
}

func (database *taskPluginPayloadTestDatabase) columnType(name string) string {
	database.mu.Lock()
	defer database.mu.Unlock()
	return database.columns[name].dataType
}

func TestTaskPluginPayloadMigrationSQLiteUsesFreshTextSchemaWithoutWidening(t *testing.T) {
	recorder := &migrationSQLRecorder{}
	db, err := gorm.Open(
		sqlite.Open(t.TempDir()+"/task-plugin-payload.sqlite"),
		&gorm.Config{Logger: recorder},
	)
	require.NoError(t, err)

	require.NoError(t, migrateTaskPluginPayloadColumns(db))
	require.NoError(t, db.AutoMigrate(&TaskPlugin{}))

	columns, err := db.Migrator().ColumnTypes(&TaskPlugin{})
	require.NoError(t, err)
	types := make(map[string]string, len(columns))
	for _, column := range columns {
		types[column.Name()] = strings.ToLower(column.DatabaseTypeName())
	}
	assert.Equal(t, "text", types["source"])
	assert.Equal(t, "text", types["icon"])
	for _, statement := range recorder.schemaMutations() {
		assert.NotContains(t, strings.ToUpper(statement), "MODIFY COLUMN")
	}
}

func TestTaskPluginPayloadMigrationMySQLAbsentTableUsesNormalCreationPath(t *testing.T) {
	database := newTaskPluginPayloadTestDatabase("text", "text")
	database.tableExists = false
	db := openTaskPluginPayloadTestDB(t, database)

	require.NoError(t, migrateTaskPluginPayloadColumns(db))

	assert.Empty(t, database.alterColumns())
}

func TestTaskPluginPayloadMigrationMySQLWidensKnownLegacyTypes(t *testing.T) {
	database := newTaskPluginPayloadTestDatabase("text", "mediumtext")
	db := openTaskPluginPayloadTestDB(t, database)

	require.NoError(t, migrateTaskPluginPayloadColumns(db))

	assert.Equal(t, "longtext", database.columnType("source"))
	assert.Equal(t, "longtext", database.columnType("icon"))
	assert.Equal(t, []string{"source", "icon"}, database.alterColumns())
	assert.False(t, database.unsafeConnection)
	assert.Equal(t, []taskPluginPayloadTestEvent{
		{connection: 1, kind: "lock"},
		{connection: 1, kind: "metadata-capability"},
		{connection: 1, kind: "alter-capability"},
		{connection: 1, kind: "alter", column: "source"},
		{connection: 1, kind: "metadata-capability"},
		{connection: 1, kind: "alter-capability"},
		{connection: 1, kind: "alter", column: "icon"},
		{connection: 1, kind: "unlock"},
	}, database.events)
}

func TestTaskPluginPayloadMigrationMySQLTerminalSchemaIsMutationFree(t *testing.T) {
	database := newTaskPluginPayloadTestDatabase("longtext", "longtext")
	database.globalMetadataVisible = false
	database.alterAllowed = false
	database.failCapabilityInspect = errors.New("terminal schema must not inspect mutation capability")
	db := openTaskPluginPayloadTestDB(t, database)

	require.NoError(t, migrateTaskPluginPayloadColumns(db))

	assert.Empty(t, database.alterColumns())
}

func TestTaskPluginPayloadMigrationMySQLFailsClosed(t *testing.T) {
	t.Run("unsupported column type", func(t *testing.T) {
		database := newTaskPluginPayloadTestDatabase("varchar", "text")
		db := openTaskPluginPayloadTestDB(t, database)

		err := migrateTaskPluginPayloadColumns(db)

		require.ErrorContains(t, err, "unsupported")
		assert.Empty(t, database.alterColumns())
		assert.Equal(t, "varchar", database.columnType("source"))
		assert.Equal(t, "text", database.columnType("icon"))
	})

	t.Run("unsupported icon type", func(t *testing.T) {
		database := newTaskPluginPayloadTestDatabase("text", "varchar")
		db := openTaskPluginPayloadTestDB(t, database)

		err := migrateTaskPluginPayloadColumns(db)

		require.ErrorContains(t, err, "unsupported")
		assert.Empty(t, database.alterColumns())
		assert.Equal(t, "text", database.columnType("source"))
		assert.Equal(t, "varchar", database.columnType("icon"))
	})

	t.Run("unexpected nullability", func(t *testing.T) {
		database := newTaskPluginPayloadTestDatabase("text", "text")
		database.mu.Lock()
		source := database.columns["source"]
		source.nullable = "YES"
		database.columns["source"] = source
		database.mu.Unlock()
		db := openTaskPluginPayloadTestDB(t, database)

		err := migrateTaskPluginPayloadColumns(db)

		require.ErrorContains(t, err, "unsupported")
		assert.Empty(t, database.alterColumns())
	})

	t.Run("inspection error is sanitized", func(t *testing.T) {
		database := newTaskPluginPayloadTestDatabase("text", "text")
		privateDetail := "mysql://migration-user:private-password@database/task_plugins"
		database.failColumnInspection = errors.New(privateDetail)
		db := openTaskPluginPayloadTestDB(t, database)

		err := migrateTaskPluginPayloadColumns(db)

		require.ErrorContains(t, err, "inspect MySQL task plugin payload schema")
		assert.NotContains(t, err.Error(), privateDetail)
		assert.NotContains(t, err.Error(), "private-password")
		assert.Empty(t, database.alterColumns())
	})

	t.Run("capability error is sanitized", func(t *testing.T) {
		database := newTaskPluginPayloadTestDatabase("text", "text")
		privateDetail := "migration-user:private-password"
		database.failCapabilityInspect = errors.New(privateDetail)
		db := openTaskPluginPayloadTestDB(t, database)

		err := migrateTaskPluginPayloadColumns(db)

		require.ErrorContains(t, err, "inspect MySQL task plugin migration capability")
		assert.NotContains(t, err.Error(), privateDetail)
		assert.NotContains(t, err.Error(), "private-password")
		assert.Empty(t, database.alterColumns())
	})
}

func TestTaskPluginPayloadMigrationMySQLRevalidatesBeforeEachAlter(t *testing.T) {
	t.Run("capability loss", func(t *testing.T) {
		database := newTaskPluginPayloadTestDatabase("text", "text")
		database.afterAlter = func(database *taskPluginPayloadTestDatabase, column string) {
			if column != "source" {
				return
			}
			database.mu.Lock()
			database.alterAllowed = false
			database.mu.Unlock()
		}
		db := openTaskPluginPayloadTestDB(t, database)

		err := migrateTaskPluginPayloadColumns(db)

		require.ErrorContains(t, err, "ALTER capability")
		assert.Equal(t, []string{"source"}, database.alterColumns())
		assert.Equal(t, "longtext", database.columnType("source"))
		assert.Equal(t, "text", database.columnType("icon"))
	})

	t.Run("schema change", func(t *testing.T) {
		database := newTaskPluginPayloadTestDatabase("text", "text")
		database.afterAlter = func(database *taskPluginPayloadTestDatabase, column string) {
			if column != "source" {
				return
			}
			database.mu.Lock()
			icon := database.columns["icon"]
			icon.dataType = "varchar"
			icon.columnType = "varchar(191)"
			database.columns["icon"] = icon
			database.mu.Unlock()
		}
		db := openTaskPluginPayloadTestDB(t, database)

		err := migrateTaskPluginPayloadColumns(db)

		require.ErrorContains(t, err, "unsupported")
		assert.Equal(t, []string{"source"}, database.alterColumns())
		assert.Equal(t, "longtext", database.columnType("source"))
		assert.Equal(t, "varchar", database.columnType("icon"))
	})
}

func TestTaskPluginPayloadMigrationMySQLConcurrentStartsSerialize(t *testing.T) {
	database := newTaskPluginPayloadTestDatabase("text", "text")
	database.firstAlterStarted = make(chan struct{})
	database.continueFirstAlter = make(chan struct{})
	database.secondLockAttempted = make(chan struct{})
	db := openTaskPluginPayloadTestDB(t, database)

	results := make(chan error, 2)
	go func() {
		results <- migrateTaskPluginPayloadColumns(db.Session(&gorm.Session{NewDB: true}))
	}()
	<-database.firstAlterStarted
	go func() {
		results <- migrateTaskPluginPayloadColumns(db.Session(&gorm.Session{NewDB: true}))
	}()
	<-database.secondLockAttempted
	close(database.continueFirstAlter)

	require.NoError(t, <-results)
	require.NoError(t, <-results)
	assert.Equal(t, []string{"source", "icon"}, database.alterColumns())
	assert.Equal(t, "longtext", database.columnType("source"))
	assert.Equal(t, "longtext", database.columnType("icon"))
	assert.False(t, database.unsafeConnection)
}

func TestMySQLAutoMigrateCannotBypassTaskPluginPayloadGuard(t *testing.T) {
	modelSchema, err := schema.Parse(
		&TaskPlugin{},
		&sync.Map{},
		schema.NamingStrategy{},
	)
	require.NoError(t, err)

	for _, test := range []struct {
		name      string
		fieldName string
		dataType  string
		nullable  bool
		handled   bool
		wantError string
	}{
		{
			name:      "source legacy text",
			fieldName: "Source", dataType: "text", handled: true,
			wantError: "guarded migration",
		},
		{
			name:      "icon legacy mediumtext",
			fieldName: "Icon", dataType: "mediumtext", handled: true,
			wantError: "guarded migration",
		},
		{
			name:      "source terminal longtext",
			fieldName: "Source", dataType: "longtext", handled: true,
		},
		{
			name:      "icon terminal longtext",
			fieldName: "Icon", dataType: "longtext", nullable: true, handled: true,
		},
		{
			name:      "source terminal type with nullable drift",
			fieldName: "Source", dataType: "longtext", nullable: true, handled: true,
			wantError: "guarded migration",
		},
		{
			name:      "unrelated remark",
			fieldName: "Remark", dataType: "text", handled: false,
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			field := modelSchema.LookUpField(test.fieldName)
			require.NotNil(t, field)
			handled, err := guardMySQLTaskPluginPayloadAutoMigrate(
				field,
				taskPluginPayloadTestColumnType{
					name:     field.DBName,
					dataType: test.dataType,
					nullable: test.nullable,
				},
			)

			assert.Equal(t, test.handled, handled)
			if test.wantError == "" {
				require.NoError(t, err)
			} else {
				require.ErrorContains(t, err, test.wantError)
			}
		})
	}
}

func TestTaskPluginPayloadMigrationConfiguredFreshSchema(t *testing.T) {
	db := openAppCredentialTestDB(t)
	recorder := &migrationSQLRecorder{}
	migrationDB := db.Session(&gorm.Session{Logger: recorder, NewDB: true})

	require.NoError(t, migrateTaskPluginPayloadColumns(migrationDB))
	require.NoError(t, migrationDB.AutoMigrate(&TaskPlugin{}))

	columns, err := db.Migrator().ColumnTypes(&TaskPlugin{})
	require.NoError(t, err)
	types := make(map[string]string, len(columns))
	for _, column := range columns {
		types[column.Name()] = strings.ToLower(column.DatabaseTypeName())
	}
	expectedType := "text"
	if db.Dialector.Name() == "mysql" {
		expectedType = "longtext"
	}
	assert.Equal(t, expectedType, types["source"])
	assert.Equal(t, expectedType, types["icon"])

	largeSource := LongText(strings.Repeat("s", 70_000))
	largeIcon := LongText(strings.Repeat("i", 70_000))
	plugin := TaskPlugin{
		Key:        "fresh-payload",
		APIVersion: 1,
		Version:    "1.0.0",
		Source:     largeSource,
		SourceHash: strings.Repeat("a", 64),
		Icon:       largeIcon,
		Enabled:    true,
		Active:     true,
		CreatedAt:  1,
	}
	require.NoError(t, db.Create(&plugin).Error)
	var saved TaskPlugin
	require.NoError(t, db.First(&saved, plugin.Id).Error)
	assert.Equal(t, largeSource, saved.Source)
	assert.Equal(t, largeIcon, saved.Icon)

	recorder.reset()
	require.NoError(t, migrateTaskPluginPayloadColumns(migrationDB))
	require.NoError(t, migrationDB.AutoMigrate(&TaskPlugin{}))
	assert.Empty(t, recorder.schemaMutations())
	for _, statement := range recorder.statements {
		assert.NotContains(t, strings.ToUpper(statement), "MODIFY COLUMN")
	}
}

func createLegacyMySQLTaskPluginPayloadTable(t *testing.T, db *gorm.DB, sourceType, iconType string) {
	t.Helper()
	require.Contains(t, []string{"text", "mediumtext", "longtext", "varchar(191)"}, sourceType)
	require.Contains(t, []string{"text", "mediumtext", "longtext"}, iconType)
	require.NoError(t, db.Exec(
		"CREATE TABLE `task_plugins` ("+
			"`id` bigint NOT NULL AUTO_INCREMENT,"+
			"`key` varchar(128) NOT NULL,"+
			"`api_version` bigint NOT NULL,"+
			"`version` varchar(64) NOT NULL,"+
			"`source` "+sourceType+" NOT NULL,"+
			"`source_hash` varchar(64) NOT NULL,"+
			"`icon` "+iconType+" NULL,"+
			"`enabled` boolean NOT NULL,"+
			"`active` boolean NOT NULL,"+
			"`created_at` bigint NOT NULL,"+
			"`remark` text NULL,"+
			"PRIMARY KEY (`id`),"+
			"UNIQUE KEY `uk_task_plugin_key_version` (`key`,`version`),"+
			"KEY `idx_task_plugins_active` (`active`)"+
			") ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
	).Error)
	require.NoError(t, db.Exec(
		"INSERT INTO `task_plugins` ("+
			"`key`,`api_version`,`version`,`source`,`source_hash`,`icon`,"+
			"`enabled`,`active`,`created_at`,`remark`"+
			") VALUES (?,?,?,?,?,?,?,?,?,?)",
		"legacy-payload",
		1,
		"1.0.0",
		"preserved-source",
		strings.Repeat("b", 64),
		"preserved-icon",
		true,
		true,
		1,
		"preserved-remark",
	).Error)
}

func mysqlTaskPluginPayloadColumnType(t *testing.T, db *gorm.DB, column string) string {
	t.Helper()
	var columnType string
	require.NoError(t, db.Raw(`
SELECT data_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'task_plugins'
  AND column_name = ?`, column).Scan(&columnType).Error)
	return strings.ToLower(columnType)
}

func assertLegacyMySQLTaskPluginPayloadData(t *testing.T, db *gorm.DB) {
	t.Helper()
	var saved TaskPlugin
	require.NoError(t, db.Where("`key` = ?", "legacy-payload").First(&saved).Error)
	assert.Equal(t, LongText("preserved-source"), saved.Source)
	assert.Equal(t, LongText("preserved-icon"), saved.Icon)
	assert.Equal(t, "preserved-remark", saved.Remark)
}

func TestTaskPluginPayloadMigrationConfiguredMySQL57(t *testing.T) {
	if os.Getenv("APP_PLUGIN_TEST_DIALECT") != "mysql" {
		t.Skip("requires configured MySQL 5.7 harness")
	}

	t.Run("legacy upgrade and idempotence", func(t *testing.T) {
		db := openAppCredentialTestDB(t)
		createLegacyMySQLTaskPluginPayloadTable(t, db, "text", "text")
		recorder := &migrationSQLRecorder{}
		migrationDB := db.Session(&gorm.Session{Logger: recorder, NewDB: true})

		require.NoError(t, migrateTaskPluginPayloadColumns(migrationDB))

		assert.Equal(t, "longtext", mysqlTaskPluginPayloadColumnType(t, db, "source"))
		assert.Equal(t, "longtext", mysqlTaskPluginPayloadColumnType(t, db, "icon"))
		assertLegacyMySQLTaskPluginPayloadData(t, db)
		require.Len(t, recorder.schemaMutations(), 2)

		recorder.reset()
		require.NoError(t, migrateTaskPluginPayloadColumns(migrationDB))
		assert.Empty(t, recorder.schemaMutations())
		assertLegacyMySQLTaskPluginPayloadData(t, db)
	})

	t.Run("unsupported type fails before DDL", func(t *testing.T) {
		db := openAppCredentialTestDB(t)
		createLegacyMySQLTaskPluginPayloadTable(t, db, "varchar(191)", "text")
		recorder := &migrationSQLRecorder{}

		err := migrateTaskPluginPayloadColumns(
			db.Session(&gorm.Session{Logger: recorder, NewDB: true}),
		)

		require.ErrorContains(t, err, "unsupported")
		assert.Empty(t, recorder.schemaMutations())
		assert.Equal(t, "varchar", mysqlTaskPluginPayloadColumnType(t, db, "source"))
		assert.Equal(t, "text", mysqlTaskPluginPayloadColumnType(t, db, "icon"))
		assertLegacyMySQLTaskPluginPayloadData(t, db)
	})

	t.Run("metadata capability failure is sanitized and mutation free", func(t *testing.T) {
		admin := openAppCredentialTestDB(t)
		createLegacyMySQLTaskPluginPayloadTable(t, admin, "text", "text")
		account := newMySQLOptionMigrationAccount(t, admin)
		restricted := account.open(t)
		recorder := &migrationSQLRecorder{}

		err := migrateTaskPluginPayloadColumns(
			restricted.Session(&gorm.Session{Logger: recorder, NewDB: true}),
		)

		require.ErrorIs(t, err, errMySQLTaskPluginPayloadMetadataVisibilityRequired)
		assert.NotContains(t, err.Error(), account.name)
		assert.NotContains(t, err.Error(), account.password)
		assert.Empty(t, recorder.schemaMutations())
		assert.Equal(t, "text", mysqlTaskPluginPayloadColumnType(t, admin, "source"))
		assert.Equal(t, "text", mysqlTaskPluginPayloadColumnType(t, admin, "icon"))
		assertLegacyMySQLTaskPluginPayloadData(t, admin)
	})

	t.Run("capability loss blocks second alter", func(t *testing.T) {
		admin := openAppCredentialTestDB(t)
		createLegacyMySQLTaskPluginPayloadTable(t, admin, "text", "text")
		account := newMySQLOptionMigrationAccount(t, admin)
		account.grantGlobal(t, "SELECT")
		restricted := account.open(t)
		var hookErr error
		hookLogger := &taskPluginPayloadAlterHookLogger{
			Interface: logger.Default.LogMode(logger.Silent),
			hook: func() {
				hookErr = admin.Exec(
					"REVOKE ALTER ON " + quoteMySQLIdent(account.database) +
						".* FROM '" + account.name + "'@'%'",
				).Error
			},
		}

		err := migrateTaskPluginPayloadColumns(
			restricted.Session(&gorm.Session{Logger: hookLogger, NewDB: true}),
		)

		require.NoError(t, hookErr)
		require.ErrorIs(t, err, errMySQLTaskPluginPayloadAlterRequired)
		assert.Equal(t, "longtext", mysqlTaskPluginPayloadColumnType(t, admin, "source"))
		assert.Equal(t, "text", mysqlTaskPluginPayloadColumnType(t, admin, "icon"))
		assertLegacyMySQLTaskPluginPayloadData(t, admin)
	})

	t.Run("concurrent starts converge without duplicate alters", func(t *testing.T) {
		db := openAppCredentialTestDB(t)
		createLegacyMySQLTaskPluginPayloadTable(t, db, "text", "text")
		recorder := &migrationSQLRecorder{}
		migrationDB := db.Session(&gorm.Session{Logger: recorder, NewDB: true})
		start := make(chan struct{})
		results := make(chan error, 4)
		for range 4 {
			go func() {
				<-start
				results <- migrateTaskPluginPayloadColumns(
					migrationDB.Session(&gorm.Session{NewDB: true}),
				)
			}()
		}
		close(start)
		for range 4 {
			require.NoError(t, <-results)
		}

		mutations := recorder.schemaMutations()
		require.Len(t, mutations, 2)
		assert.Equal(t, "longtext", mysqlTaskPluginPayloadColumnType(t, db, "source"))
		assert.Equal(t, "longtext", mysqlTaskPluginPayloadColumnType(t, db, "icon"))
		assertLegacyMySQLTaskPluginPayloadData(t, db)
	})
}
