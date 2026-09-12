package migrator

import (
	"database/sql"
	"reflect"
)

// ColumnType column type implements ColumnType interface
type ColumnType struct {
	SQLColumnType      *sql.ColumnType
	NameValue          sql.NullString
	DataTypeValue      sql.NullString
	ColumnTypeValue    sql.NullString
	PrimaryKeyValue    sql.NullBool
	UniqueValue        sql.NullBool
	AutoIncrementValue sql.NullBool
	LengthValue        sql.NullInt64
	DecimalSizeValue   sql.NullInt64
	ScaleValue         sql.NullInt64
	NullableValue      sql.NullBool
	ScanTypeValue      reflect.Type
	CommentValue       sql.NullString
	DefaultValueValue  sql.NullString
}

// Name returns the name or alias of the column.
func (ct ColumnType) Name() string {
	if ct.NameValue.Valid {
		return ct.NameValue.String
	}
	return ct.SQLColumnType.Name()
}

// DatabaseTypeName returns the database system name of the column type. If an empty
// string is returned, then the driver type name is not supported.
// Consult your driver documentation for a list of driver data types. Length specifiers
// are not included.
// Common type names include "VARCHAR", "TEXT", "NVARCHAR", "DECIMAL", "BOOL",
// "INT", and "BIGINT".
func (ct ColumnType) DatabaseTypeName() string {
	if ct.DataTypeValue.Valid {
		return ct.DataTypeValue.String
	}
	return ct.SQLColumnType.DatabaseTypeName()
}

// ColumnType returns the database type of the column. like `varchar(16)`
func (ct ColumnType) ColumnType() (columnType string, ok bool) {
	return ct.ColumnTypeValue.String, ct.ColumnTypeValue.Valid
}

// PrimaryKey returns the column is primary key or not.
func (ct ColumnType) PrimaryKey() (isPrimaryKey bool, ok bool) {
	return ct.PrimaryKeyValue.Bool, ct.PrimaryKeyValue.Valid
}

// AutoIncrement returns the column is auto increment or not.
func (ct ColumnType) AutoIncrement() (isAutoIncrement bool, ok bool) {
	return ct.AutoIncrementValue.Bool, ct.AutoIncrementValue.Valid
}

// Length returns the column type length for variable length column types
func (ct ColumnType) Length() (length int64, ok bool) {
	if ct.LengthValue.Valid {
		return ct.LengthValue.Int64, true
	}
	return ct.SQLColumnType.Length()
}

// DecimalSize returns the scale and precision of a decimal type.
func (ct ColumnType) DecimalSize() (precision int64, scale int64, ok bool) {
	if ct.DecimalSizeValue.Valid {
		return ct.DecimalSizeValue.Int64, ct.ScaleValue.Int64, true
	}
	return ct.SQLColumnType.DecimalSize()
}

// Nullable reports whether the column may be null.
func (ct ColumnType) Nullable() (nullable bool, ok bool) {
	if ct.NullableValue.Valid {
		return ct.NullableValue.Bool, true
	}
	return ct.SQLColumnType.Nullable()
}

// Unique reports whether the column may be unique.
func (ct ColumnType) Unique() (unique bool, ok bool) {
	return ct.UniqueValue.Bool, ct.UniqueValue.Valid
}

// ScanType returns a Go type suitable for scanning into using Rows.Scan.
func (ct ColumnType) ScanType() reflect.Type {
	if ct.ScanTypeValue != nil {
		return ct.ScanTypeValue
	}
	return ct.SQLColumnType.ScanType()
}

// Comment returns the comment of current column.
func (ct ColumnType) Comment() (value string, ok bool) {
	return ct.CommentValue.String, ct.CommentValue.Valid
}

// DefaultValue returns the default value of current column.
func (ct ColumnType) DefaultValue() (value string, ok bool) {
	return ct.DefaultValueValue.String, ct.DefaultValueValue.Valid
}
