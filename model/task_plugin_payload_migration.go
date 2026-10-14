package model

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"strings"
	"time"

	mysqlDriver "github.com/go-sql-driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

const taskPluginPayloadMigrationLockName = "new_api_task_plugin_payload_v1"

var (
	errMySQLTaskPluginPayloadSchemaInspection = errors.New(
		"inspect MySQL task plugin payload schema",
	)
	errMySQLTaskPluginPayloadCapabilityInspection = errors.New(
		"inspect MySQL task plugin migration capability",
	)
	errMySQLTaskPluginPayloadMetadataVisibilityRequired = errors.New(
		"MySQL task plugin migration requires global table metadata visibility",
	)
	errMySQLTaskPluginPayloadAlterRequired = errors.New(
		"MySQL task plugin migration requires ALTER capability",
	)
)

type mysqlTaskPluginPayloadColumn struct {
	Name                 string         `gorm:"column:column_name"`
	DataType             string         `gorm:"column:data_type"`
	ColumnType           string         `gorm:"column:column_type"`
	Nullable             string         `gorm:"column:is_nullable"`
	DefaultValue         sql.NullString `gorm:"column:column_default"`
	Extra                string         `gorm:"column:extra"`
	Comment              string         `gorm:"column:column_comment"`
	CharacterSet         sql.NullString `gorm:"column:character_set_name"`
	Collation            sql.NullString `gorm:"column:collation_name"`
	GenerationExpression string         `gorm:"column:generation_expression"`
}

type mysqlTaskPluginPayloadSchema struct {
	Exists  bool
	Columns map[string]mysqlTaskPluginPayloadColumn
}

func migrateTaskPluginPayloadColumns(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("migrate task plugin payload columns: database is nil")
	}
	if db.Dialector.Name() != "mysql" {
		return nil
	}
	return withMySQLTaskPluginPayloadLock(db, func(locked *gorm.DB) error {
		for range 3 {
			schema, err := inspectMySQLTaskPluginPayloadSchema(locked)
			if err != nil {
				return err
			}
			if !schema.Exists || schema.taskPluginPayloadColumnToWiden() == "" {
				return nil
			}
			if capabilityErr := validateMySQLTaskPluginPayloadMigrationCapability(locked); capabilityErr != nil {
				return capabilityErr
			}
			schema, err = inspectMySQLTaskPluginPayloadSchema(locked)
			if err != nil {
				return err
			}
			columnName := schema.taskPluginPayloadColumnToWiden()
			if !schema.Exists || columnName == "" {
				return nil
			}
			column := schema.Columns[columnName]
			if err := alterMySQLTaskPluginPayloadColumn(locked, column); err != nil {
				return err
			}
		}
		return fmt.Errorf("MySQL task plugin payload schema did not converge")
	})
}

func withMySQLTaskPluginPayloadLock(
	db *gorm.DB,
	fn func(*gorm.DB) error,
) (resultErr error) {
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("lock MySQL task plugin payload migration")
	}
	ctx := db.Statement.Context
	if ctx == nil {
		ctx = context.Background()
	}
	conn, err := sqlDB.Conn(ctx)
	if err != nil {
		return fmt.Errorf("lock MySQL task plugin payload migration")
	}
	acquired := false
	discard := false
	defer func() {
		if acquired {
			cleanupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			var released sql.NullInt64
			if releaseErr := conn.QueryRowContext(
				cleanupCtx,
				"SELECT RELEASE_LOCK(?)",
				taskPluginPayloadMigrationLockName,
			).Scan(&released); releaseErr != nil || !released.Valid || released.Int64 != 1 {
				discard = true
				resultErr = errors.Join(
					resultErr,
					errors.New("release MySQL task plugin payload migration lock"),
				)
			}
		}
		if discard {
			_ = conn.Raw(func(any) error { return driver.ErrBadConn })
		}
		_ = conn.Close()
	}()

	var lockResult sql.NullInt64
	if err := conn.QueryRowContext(
		ctx,
		"SELECT GET_LOCK(?, 60)",
		taskPluginPayloadMigrationLockName,
	).Scan(&lockResult); err != nil {
		discard = true
		return fmt.Errorf("lock MySQL task plugin payload migration")
	}
	if !lockResult.Valid || lockResult.Int64 != 1 {
		return fmt.Errorf("lock MySQL task plugin payload migration: timeout")
	}
	acquired = true
	locked := db.Session(&gorm.Session{Context: ctx, NewDB: true})
	locked.Statement.ConnPool = conn
	return fn(locked)
}

func inspectMySQLTaskPluginPayloadSchema(
	db *gorm.DB,
) (mysqlTaskPluginPayloadSchema, error) {
	exists, err := mysqlTaskPluginPayloadTableExists(db)
	if err != nil {
		return mysqlTaskPluginPayloadSchema{}, err
	}
	if !exists {
		return mysqlTaskPluginPayloadSchema{}, nil
	}
	var tables []struct {
		TableType string `gorm:"column:table_type"`
	}
	if err := db.Raw(`
SELECT table_type
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'task_plugins'`).Scan(&tables).Error; err != nil {
		return mysqlTaskPluginPayloadSchema{}, errMySQLTaskPluginPayloadSchemaInspection
	}
	if len(tables) == 0 {
		return mysqlTaskPluginPayloadSchema{}, nil
	}
	if len(tables) != 1 || !strings.EqualFold(tables[0].TableType, "BASE TABLE") {
		return mysqlTaskPluginPayloadSchema{},
			fmt.Errorf("unsupported MySQL task plugin payload schema")
	}

	var columns []mysqlTaskPluginPayloadColumn
	if err := db.Raw(`
SELECT column_name, data_type, column_type, is_nullable, column_default,
       extra, column_comment, character_set_name, collation_name,
       generation_expression
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'task_plugins'
  AND column_name IN ('source', 'icon')
ORDER BY ordinal_position`).Scan(&columns).Error; err != nil {
		return mysqlTaskPluginPayloadSchema{}, errMySQLTaskPluginPayloadSchemaInspection
	}
	if len(columns) != 2 {
		return mysqlTaskPluginPayloadSchema{},
			fmt.Errorf("unsupported MySQL task plugin payload schema")
	}
	schema := mysqlTaskPluginPayloadSchema{
		Exists:  true,
		Columns: make(map[string]mysqlTaskPluginPayloadColumn, len(columns)),
	}
	for _, column := range columns {
		if column.Name != "source" && column.Name != "icon" {
			return mysqlTaskPluginPayloadSchema{},
				fmt.Errorf("unsupported MySQL task plugin payload schema")
		}
		if _, duplicate := schema.Columns[column.Name]; duplicate {
			return mysqlTaskPluginPayloadSchema{},
				fmt.Errorf("unsupported MySQL task plugin payload schema")
		}
		dataType := strings.ToLower(strings.TrimSpace(column.DataType))
		columnType := strings.ToLower(strings.Join(strings.Fields(column.ColumnType), ""))
		typeAllowed := dataType == "text" || dataType == "mediumtext" || dataType == "longtext"
		nullabilityAllowed := column.Name == "source" && column.Nullable == "NO" ||
			column.Name == "icon" && column.Nullable == "YES"
		if !typeAllowed || columnType != dataType ||
			!nullabilityAllowed ||
			column.DefaultValue.Valid ||
			column.Extra != "" ||
			column.Comment != "" ||
			column.GenerationExpression != "" ||
			!column.CharacterSet.Valid || !optionSafeIdent(column.CharacterSet.String) ||
			!column.Collation.Valid || !optionSafeIdent(column.Collation.String) {
			return mysqlTaskPluginPayloadSchema{},
				fmt.Errorf("unsupported MySQL task plugin payload schema")
		}
		column.DataType = dataType
		column.ColumnType = columnType
		schema.Columns[column.Name] = column
	}
	if _, ok := schema.Columns["source"]; !ok {
		return mysqlTaskPluginPayloadSchema{},
			fmt.Errorf("unsupported MySQL task plugin payload schema")
	}
	if _, ok := schema.Columns["icon"]; !ok {
		return mysqlTaskPluginPayloadSchema{},
			fmt.Errorf("unsupported MySQL task plugin payload schema")
	}
	return schema, nil
}

func mysqlTaskPluginPayloadTableExists(db *gorm.DB) (bool, error) {
	rows, err := db.Raw("SELECT 1 FROM `task_plugins` LIMIT 0").Rows()
	if err != nil {
		var mysqlErr *mysqlDriver.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1146 {
			return false, nil
		}
		return false, errMySQLTaskPluginPayloadSchemaInspection
	}
	if err := rows.Close(); err != nil {
		return false, errMySQLTaskPluginPayloadSchemaInspection
	}
	return true, nil
}

func (schema mysqlTaskPluginPayloadSchema) taskPluginPayloadColumnToWiden() string {
	for _, name := range []string{"source", "icon"} {
		if column, ok := schema.Columns[name]; ok && column.DataType != "longtext" {
			return name
		}
	}
	return ""
}

func validateMySQLTaskPluginPayloadMigrationCapability(db *gorm.DB) error {
	if err := validateMySQLGlobalTableMetadataVisibility(db); err != nil {
		if errors.Is(err, errMySQLGlobalMetadataVisibilityRequired) {
			return errMySQLTaskPluginPayloadMetadataVisibilityRequired
		}
		return errMySQLTaskPluginPayloadCapabilityInspection
	}
	var capability struct {
		HasAlterPrivilege bool `gorm:"column:has_alter_privilege"`
	}
	if err := db.Raw(`
SELECT EXISTS (
  SELECT 1
  FROM information_schema.user_privileges
  WHERE grantee = CONCAT(
    QUOTE(LEFT(
      CURRENT_USER(),
      LENGTH(CURRENT_USER()) - LENGTH(SUBSTRING_INDEX(CURRENT_USER(), '@', -1)) - 1
    )),
    '@',
    QUOTE(SUBSTRING_INDEX(CURRENT_USER(), '@', -1))
  )
    AND privilege_type = 'ALTER'
  UNION ALL
  SELECT 1
  FROM information_schema.schema_privileges
  WHERE grantee = CONCAT(
    QUOTE(LEFT(
      CURRENT_USER(),
      LENGTH(CURRENT_USER()) - LENGTH(SUBSTRING_INDEX(CURRENT_USER(), '@', -1)) - 1
    )),
    '@',
    QUOTE(SUBSTRING_INDEX(CURRENT_USER(), '@', -1))
  )
    AND table_schema = DATABASE()
    AND privilege_type = 'ALTER'
  UNION ALL
  SELECT 1
  FROM information_schema.table_privileges
  WHERE grantee = CONCAT(
    QUOTE(LEFT(
      CURRENT_USER(),
      LENGTH(CURRENT_USER()) - LENGTH(SUBSTRING_INDEX(CURRENT_USER(), '@', -1)) - 1
    )),
    '@',
    QUOTE(SUBSTRING_INDEX(CURRENT_USER(), '@', -1))
  )
    AND table_schema = DATABASE()
    AND table_name = 'task_plugins'
    AND privilege_type = 'ALTER'
) AS has_alter_privilege`).Scan(&capability).Error; err != nil {
		return errMySQLTaskPluginPayloadCapabilityInspection
	}
	if !capability.HasAlterPrivilege {
		return errMySQLTaskPluginPayloadAlterRequired
	}
	return nil
}

func alterMySQLTaskPluginPayloadColumn(
	db *gorm.DB,
	column mysqlTaskPluginPayloadColumn,
) error {
	nullability := " NULL"
	if column.Nullable == "NO" {
		nullability = " NOT NULL"
	}
	statement := "ALTER TABLE `task_plugins` MODIFY COLUMN " +
		quoteMySQLIdent(column.Name) +
		" LONGTEXT CHARACTER SET " + quoteMySQLIdent(column.CharacterSet.String) +
		" COLLATE " + quoteMySQLIdent(column.Collation.String) +
		nullability
	if err := db.Exec(statement).Error; err != nil {
		return fmt.Errorf("alter MySQL task plugin payload column %s", column.Name)
	}
	return nil
}

func guardMySQLTaskPluginPayloadAutoMigrate(
	field *schema.Field,
	column gorm.ColumnType,
) (bool, error) {
	if field == nil || field.Schema == nil || field.Schema.Table != "task_plugins" ||
		field.DBName != "source" && field.DBName != "icon" {
		return false, nil
	}
	nullable, nullableKnown := column.Nullable()
	_, hasDefault := column.DefaultValue()
	comment, commentKnown := column.Comment()
	expectedNullable := field.DBName == "icon"
	if strings.EqualFold(column.DatabaseTypeName(), "longtext") &&
		column.Name() == field.DBName &&
		nullableKnown && nullable == expectedNullable &&
		!hasDefault &&
		(!commentKnown || comment == "") {
		return true, nil
	}
	return true, fmt.Errorf(
		"task_plugins.%s requires guarded migration before AutoMigrate",
		field.DBName,
	)
}
