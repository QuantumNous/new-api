package gorm

import (
	"reflect"

	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
)

// Migrator returns migrator
func (db *DB) Migrator() Migrator {
	tx := db.getInstance()

	// apply scopes to migrator
	for len(tx.Statement.scopes) > 0 {
		tx = tx.executeScopes()
	}

	return tx.Dialector.Migrator(tx.Session(&Session{}))
}

// AutoMigrate run auto migration for given models
func (db *DB) AutoMigrate(dst ...interface{}) error {
	return db.Migrator().AutoMigrate(dst...)
}

// ViewOption view option
type ViewOption struct {
	Replace     bool   // If true, exec `CREATE`. If false, exec `CREATE OR REPLACE`
	CheckOption string // optional. e.g. `WITH [ CASCADED | LOCAL ] CHECK OPTION`
	Query       *DB    // required subquery.
}

// ColumnType column type interface
type ColumnType interface {
	Name() string
	DatabaseTypeName() string                 // varchar
	ColumnType() (columnType string, ok bool) // varchar(64)
	PrimaryKey() (isPrimaryKey bool, ok bool)
	AutoIncrement() (isAutoIncrement bool, ok bool)
	Length() (length int64, ok bool)
	DecimalSize() (precision int64, scale int64, ok bool)
	Nullable() (nullable bool, ok bool)
	Unique() (unique bool, ok bool)
	ScanType() reflect.Type
	Comment() (value string, ok bool)
	DefaultValue() (value string, ok bool)
}

type Index interface {
	Table() string
	Name() string
	Columns() []string
	PrimaryKey() (isPrimaryKey bool, ok bool)
	Unique() (unique bool, ok bool)
	Option() string
}

// TableType table type interface
type TableType interface {
	Schema() string
	Name() string
	Type() string
	Comment() (comment string, ok bool)
}

// Migrator migrator interface
type Migrator interface {
	// AutoMigrate
	AutoMigrate(dst ...interface{}) error

	// Database
	CurrentDatabase() string
	FullDataTypeOf(*schema.Field) clause.Expr
	GetTypeAliases(databaseTypeName string) []string

	// Tables
	CreateTable(dst ...interface{}) error
	DropTable(dst ...interface{}) error
	HasTable(dst interface{}) bool
	RenameTable(oldName, newName interface{}) error
	GetTables() (tableList []string, err error)
	TableType(dst interface{}) (TableType, error)

	// Columns
	AddColumn(dst interface{}, field string) error
	DropColumn(dst interface{}, field string) error
	AlterColumn(dst interface{}, field string) error
	MigrateColumn(dst interface{}, field *schema.Field, columnType ColumnType) error
	HasColumn(dst interface{}, field string) bool
	RenameColumn(dst interface{}, oldName, field string) error
	ColumnTypes(dst interface{}) ([]ColumnType, error)

	// Views
	CreateView(name string, option ViewOption) error
	DropView(name string) error

	// Constraints
	CreateConstraint(dst interface{}, name string) error
	DropConstraint(dst interface{}, name string) error
	HasConstraint(dst interface{}, name string) bool

	// Indexes
	CreateIndex(dst interface{}, name string) error
	DropIndex(dst interface{}, name string) error
	HasIndex(dst interface{}, name string) bool
	RenameIndex(dst interface{}, oldName, newName string) error
	GetIndexes(dst interface{}) ([]Index, error)
}
