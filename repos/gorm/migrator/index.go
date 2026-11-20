package migrator

import "database/sql"

// Index implements gorm.Index interface
type Index struct {
	TableName       string
	NameValue       string
	ColumnList      []string
	PrimaryKeyValue sql.NullBool
	UniqueValue     sql.NullBool
	OptionValue     string
}

// Table return the table name of the index.
func (idx Index) Table() string {
	return idx.TableName
}

// Name return the name of the index.
func (idx Index) Name() string {
	return idx.NameValue
}

// Columns return the columns of the index
func (idx Index) Columns() []string {
	return idx.ColumnList
}

// PrimaryKey returns the index is primary key or not.
func (idx Index) PrimaryKey() (isPrimaryKey bool, ok bool) {
	return idx.PrimaryKeyValue.Bool, idx.PrimaryKeyValue.Valid
}

// Unique returns whether the index is unique or not.
func (idx Index) Unique() (unique bool, ok bool) {
	return idx.UniqueValue.Bool, idx.UniqueValue.Valid
}

// Option return the optional attribute of the index
func (idx Index) Option() string {
	return idx.OptionValue
}
