package migrator

import (
	"database/sql"
)

// TableType table type implements TableType interface
type TableType struct {
	SchemaValue  string
	NameValue    string
	TypeValue    string
	CommentValue sql.NullString
}

// Schema returns the schema of the table.
func (ct TableType) Schema() string {
	return ct.SchemaValue
}

// Name returns the name of the table.
func (ct TableType) Name() string {
	return ct.NameValue
}

// Type returns the type of the table.
func (ct TableType) Type() string {
	return ct.TypeValue
}

// Comment returns the comment of current table.
func (ct TableType) Comment() (comment string, ok bool) {
	return ct.CommentValue.String, ct.CommentValue.Valid
}
