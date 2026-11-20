package gorm

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"

	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
	"gorm.io/gorm/utils"
)

// Statement statement
type Statement struct {
	*DB
	TableExpr            *clause.Expr
	Table                string
	Model                interface{}
	Unscoped             bool
	Dest                 interface{}
	ReflectValue         reflect.Value
	Clauses              map[string]clause.Clause
	BuildClauses         []string
	Distinct             bool
	Selects              []string // selected columns
	Omits                []string // omit columns
	Joins                []join
	Preloads             map[string][]interface{}
	Settings             sync.Map
	ConnPool             ConnPool
	Schema               *schema.Schema
	Context              context.Context
	RaiseErrorOnNotFound bool
	SkipHooks            bool
	SQL                  strings.Builder
	Vars                 []interface{}
	CurDestIndex         int
	attrs                []interface{}
	assigns              []interface{}
	scopes               []func(*DB) *DB
}

type join struct {
	Name     string
	Conds    []interface{}
	On       *clause.Where
	Selects  []string
	Omits    []string
	JoinType clause.JoinType
}

// StatementModifier statement modifier interface
type StatementModifier interface {
	ModifyStatement(*Statement)
}

// WriteString write string
func (stmt *Statement) WriteString(str string) (int, error) {
	return stmt.SQL.WriteString(str)
}

// WriteByte write byte
func (stmt *Statement) WriteByte(c byte) error {
	return stmt.SQL.WriteByte(c)
}

// WriteQuoted write quoted value
func (stmt *Statement) WriteQuoted(value interface{}) {
	stmt.QuoteTo(&stmt.SQL, value)
}

// QuoteTo write quoted value to writer
func (stmt *Statement) QuoteTo(writer clause.Writer, field interface{}) {
	write := func(raw bool, str string) {
		if raw {
			writer.WriteString(str)
		} else {
			stmt.DB.Dialector.QuoteTo(writer, str)
		}
	}

	switch v := field.(type) {
	case clause.Table:
		if v.Name == clause.CurrentTable {
			if stmt.TableExpr != nil {
				stmt.TableExpr.Build(stmt)
			} else {
				write(v.Raw, stmt.Table)
			}
		} else {
			write(v.Raw, v.Name)
		}

		if v.Alias != "" {
			writer.WriteByte(' ')
			write(v.Raw, v.Alias)
		}
	case clause.Column:
		if v.Table != "" {
			if v.Table == clause.CurrentTable {
				write(v.Raw, stmt.Table)
			} else {
				write(v.Raw, v.Table)
			}
			writer.WriteByte('.')
		}

		if v.Name == clause.PrimaryKey {
			if stmt.Schema == nil {
				stmt.DB.AddError(ErrModelValueRequired)
			} else if stmt.Schema.PrioritizedPrimaryField != nil {
				write(v.Raw, stmt.Schema.PrioritizedPrimaryField.DBName)
			} else if len(stmt.Schema.DBNames) > 0 {
				write(v.Raw, stmt.Schema.DBNames[0])
			} else {
				stmt.DB.AddError(ErrModelAccessibleFieldsRequired) //nolint:typecheck,errcheck
			}
		} else {
			write(v.Raw, v.Name)
		}

		if v.Alias != "" {
			writer.WriteString(" AS ")
			write(v.Raw, v.Alias)
		}
	case []clause.Column:
		writer.WriteByte('(')
		for idx, d := range v {
			if idx > 0 {
				writer.WriteByte(',')
			}
			stmt.QuoteTo(writer, d)
		}
		writer.WriteByte(')')
	case clause.Expr:
		v.Build(stmt)
	case string:
		stmt.DB.Dialector.QuoteTo(writer, v)
	case []string:
		writer.WriteByte('(')
		for idx, d := range v {
			if idx > 0 {
				writer.WriteByte(',')
			}
			stmt.DB.Dialector.QuoteTo(writer, d)
		}
		writer.WriteByte(')')
	default:
		stmt.DB.Dialector.QuoteTo(writer, fmt.Sprint(field))
	}
}

// Quote returns quoted value
func (stmt *Statement) Quote(field interface{}) string {
	var builder strings.Builder
	stmt.QuoteTo(&builder, field)
	return builder.String()
}

// AddVar add var
func (stmt *Statement) AddVar(writer clause.Writer, vars ...interface{}) {
	for idx, v := range vars {
		if idx > 0 {
			writer.WriteByte(',')
		}

		switch v := v.(type) {
		case sql.NamedArg:
			stmt.Vars = append(stmt.Vars, v.Value)
		case clause.Column, clause.Table:
			stmt.QuoteTo(writer, v)
		case Valuer:
			reflectValue := reflect.ValueOf(v)
			if reflectValue.Kind() == reflect.Ptr && reflectValue.IsNil() {
				stmt.AddVar(writer, nil)
			} else {
				stmt.AddVar(writer, v.GormValue(stmt.Context, stmt.DB))
			}
		case clause.Interface:
			c := clause.Clause{Name: v.Name()}
			v.MergeClause(&c)
			c.Build(stmt)
		case clause.Expression:
			v.Build(stmt)
		case driver.Valuer:
			stmt.Vars = append(stmt.Vars, v)
			stmt.DB.Dialector.BindVarTo(writer, stmt, v)
		case []byte:
			stmt.Vars = append(stmt.Vars, v)
			stmt.DB.Dialector.BindVarTo(writer, stmt, v)
		case []interface{}:
			if len(v) > 0 {
				writer.WriteByte('(')
				stmt.AddVar(writer, v...)
				writer.WriteByte(')')
			} else {
				writer.WriteString("(NULL)")
			}
		case *DB:
			subdb := v.Session(&Session{Logger: logger.Discard, DryRun: true}).getInstance()
			if v.Statement.SQL.Len() > 0 {
				var (
					vars = subdb.Statement.Vars
					sql  = v.Statement.SQL.String()
				)

				subdb.Statement.Vars = make([]interface{}, 0, len(vars))
				for _, vv := range vars {
					subdb.Statement.Vars = append(subdb.Statement.Vars, vv)
					bindvar := strings.Builder{}
					v.Dialector.BindVarTo(&bindvar, subdb.Statement, vv)
					sql = strings.Replace(sql, bindvar.String(), "?", 1)
				}

				subdb.Statement.SQL.Reset()
				subdb.Statement.Vars = stmt.Vars
				if strings.Contains(sql, "@") {
					clause.NamedExpr{SQL: sql, Vars: vars}.Build(subdb.Statement)
				} else {
					clause.Expr{SQL: sql, Vars: vars}.Build(subdb.Statement)
				}
			} else {
				subdb.Statement.Vars = append(stmt.Vars, subdb.Statement.Vars...)
				subdb.callbacks.Query().Execute(subdb)
			}

			writer.WriteString(subdb.Statement.SQL.String())
			stmt.Vars = subdb.Statement.Vars
		default:
			switch rv := reflect.ValueOf(v); rv.Kind() {
			case reflect.Slice, reflect.Array:
				if rv.Len() == 0 {
					writer.WriteString("(NULL)")
				} else if rv.Type().Elem() == reflect.TypeOf(uint8(0)) {
					stmt.Vars = append(stmt.Vars, v)
					stmt.DB.Dialector.BindVarTo(writer, stmt, v)
				} else {
					writer.WriteByte('(')
					for i := 0; i < rv.Len(); i++ {
						if i > 0 {
							writer.WriteByte(',')
						}
						stmt.AddVar(writer, rv.Index(i).Interface())
					}
					writer.WriteByte(')')
				}
			default:
				stmt.Vars = append(stmt.Vars, v)
				stmt.DB.Dialector.BindVarTo(writer, stmt, v)
			}
		}
	}
}

// AddClause add clause
func (stmt *Statement) AddClause(v clause.Interface) {
	if optimizer, ok := v.(StatementModifier); ok {
		optimizer.ModifyStatement(stmt)
	} else {
		name := v.Name()
		c := stmt.Clauses[name]
		c.Name = name
		v.MergeClause(&c)
		stmt.Clauses[name] = c
	}
}

// AddClauseIfNotExists add clause if not exists
func (stmt *Statement) AddClauseIfNotExists(v clause.Interface) {
	if c, ok := stmt.Clauses[v.Name()]; !ok || c.Expression == nil {
		stmt.AddClause(v)
	}
}

// BuildCondition build condition
func (stmt *Statement) BuildCondition(query interface{}, args ...interface{}) []clause.Expression {
	if s, ok := query.(string); ok {
		// if it is a number, then treats it as primary key
		if _, err := strconv.Atoi(s); err != nil {
			if s == "" && len(args) == 0 {
				return nil
			}

			if len(args) == 0 || (len(args) > 0 && strings.Contains(s, "?")) {
				// looks like a where condition
				return []clause.Expression{clause.Expr{SQL: s, Vars: args}}
			}

			if len(args) > 0 && strings.Contains(s, "@") {
				// looks like a named query
				return []clause.Expression{clause.NamedExpr{SQL: s, Vars: args}}
			}

			if strings.Contains(strings.TrimSpace(s), " ") {
				// looks like a where condition
				return []clause.Expression{clause.Expr{SQL: s, Vars: args}}
			}

			if len(args) == 1 {
				return []clause.Expression{clause.Eq{Column: s, Value: args[0]}}
			}
		}
	}

	conds := make([]clause.Expression, 0, 4)
	args = append([]interface{}{query}, args...)
	for idx, arg := range args {
		if arg == nil {
			continue
		}
		if valuer, ok := arg.(driver.Valuer); ok {
			arg, _ = valuer.Value()
		}

		switch v := arg.(type) {
		case clause.Expression:
			conds = append(conds, v)
		case *DB:
			v.executeScopes()

			if cs, ok := v.Statement.Clauses["WHERE"]; ok && cs.Expression != nil {
				if where, ok := cs.Expression.(clause.Where); ok {
					if len(where.Exprs) == 1 {
						if orConds, ok := where.Exprs[0].(clause.OrConditions); ok {
							where.Exprs[0] = clause.AndConditions(orConds)
						}
					}
					conds = append(conds, clause.And(where.Exprs...))
				} else {
					conds = append(conds, cs.Expression)
				}
				if v.Statement == stmt {
					cs.Expression = nil
					stmt.Statement.Clauses["WHERE"] = cs
				}
			}
		case map[interface{}]interface{}:
			for i, j := range v {
				conds = append(conds, clause.Eq{Column: i, Value: j})
			}
		case map[string]string:
			keys := make([]string, 0, len(v))
			for i := range v {
				keys = append(keys, i)
			}
			sort.Strings(keys)

			for _, key := range keys {
				conds = append(conds, clause.Eq{Column: key, Value: v[key]})
			}
		case map[string]interface{}:
			keys := make([]string, 0, len(v))
			for i := range v {
				keys = append(keys, i)
			}
			sort.Strings(keys)

			for _, key := range keys {
				reflectValue := reflect.Indirect(reflect.ValueOf(v[key]))
				switch reflectValue.Kind() {
				case reflect.Slice, reflect.Array:
					if _, ok := v[key].(driver.Valuer); ok {
						conds = append(conds, clause.Eq{Column: key, Value: v[key]})
					} else if _, ok := v[key].(Valuer); ok {
						conds = append(conds, clause.Eq{Column: key, Value: v[key]})
					} else {
						// optimize reflect value length
						valueLen := reflectValue.Len()
						values := make([]interface{}, valueLen)
						for i := 0; i < valueLen; i++ {
							values[i] = reflectValue.Index(i).Interface()
						}

						conds = append(conds, clause.IN{Column: key, Values: values})
					}
				default:
					conds = append(conds, clause.Eq{Column: key, Value: v[key]})
				}
			}
		default:
			reflectValue := reflect.Indirect(reflect.ValueOf(arg))
			for reflectValue.Kind() == reflect.Ptr {
				reflectValue = reflectValue.Elem()
			}

			if s, err := schema.Parse(arg, stmt.DB.cacheStore, stmt.DB.NamingStrategy); err == nil {
				selectedColumns := map[string]bool{}
				if idx == 0 {
					for _, v := range args[1:] {
						if vs, ok := v.(string); ok {
							selectedColumns[vs] = true
						}
					}
				}
				restricted := len(selectedColumns) != 0

				switch reflectValue.Kind() {
				case reflect.Struct:
					for _, field := range s.Fields {
						selected := selectedColumns[field.DBName] || selectedColumns[field.Name]
						if selected || (!restricted && field.Readable) {
							if v, isZero := field.ValueOf(stmt.Context, reflectValue); !isZero || selected {
								if field.DBName != "" {
									conds = append(conds, clause.Eq{Column: clause.Column{Table: clause.CurrentTable, Name: field.DBName}, Value: v})
								} else if field.DataType != "" {
									conds = append(conds, clause.Eq{Column: clause.Column{Table: clause.CurrentTable, Name: field.Name}, Value: v})
								}
							}
						}
					}
				case reflect.Slice, reflect.Array:
					for i := 0; i < reflectValue.Len(); i++ {
						for _, field := range s.Fields {
							selected := selectedColumns[field.DBName] || selectedColumns[field.Name]
							if selected || (!restricted && field.Readable) {
								if v, isZero := field.ValueOf(stmt.Context, reflectValue.Index(i)); !isZero || selected {
									if field.DBName != "" {
										conds = append(conds, clause.Eq{Column: clause.Column{Table: clause.CurrentTable, Name: field.DBName}, Value: v})
									} else if field.DataType != "" {
										conds = append(conds, clause.Eq{Column: clause.Column{Table: clause.CurrentTable, Name: field.Name}, Value: v})
									}
								}
							}
						}
					}
				}

				if restricted {
					break
				}
			} else if !reflectValue.IsValid() {
				stmt.AddError(ErrInvalidData)
			} else if len(conds) == 0 {
				if len(args) == 1 {
					switch reflectValue.Kind() {
					case reflect.Slice, reflect.Array:
						// optimize reflect value length
						valueLen := reflectValue.Len()
						values := make([]interface{}, valueLen)
						for i := 0; i < valueLen; i++ {
							values[i] = reflectValue.Index(i).Interface()
						}

						if len(values) > 0 {
							conds = append(conds, clause.IN{Column: clause.PrimaryColumn, Values: values})
						}
						return conds
					}
				}

				conds = append(conds, clause.IN{Column: clause.PrimaryColumn, Values: args})
			}
		}
	}

	return conds
}

// Build build sql with clauses names
func (stmt *Statement) Build(clauses ...string) {
	var firstClauseWritten bool

	for _, name := range clauses {
		if c, ok := stmt.Clauses[name]; ok {
			if firstClauseWritten {
				stmt.WriteByte(' ')
			}

			firstClauseWritten = true
			if b, ok := stmt.DB.ClauseBuilders[name]; ok {
				b(c, stmt)
			} else {
				c.Build(stmt)
			}
		}
	}
}

func (stmt *Statement) Parse(value interface{}) (err error) {
	return stmt.ParseWithSpecialTableName(value, "")
}

func (stmt *Statement) ParseWithSpecialTableName(value interface{}, specialTableName string) (err error) {
	if stmt.Schema, err = schema.ParseWithSpecialTableName(value, stmt.DB.cacheStore, stmt.DB.NamingStrategy, specialTableName); err == nil && stmt.Table == "" {
		if tables := strings.Split(stmt.Schema.Table, "."); len(tables) == 2 {
			stmt.TableExpr = &clause.Expr{SQL: stmt.Quote(stmt.Schema.Table)}
			stmt.Table = tables[1]
			return
		}

		stmt.Table = stmt.Schema.Table
	}
	return err
}

func (stmt *Statement) clone() *Statement {
	newStmt := &Statement{
		TableExpr:            stmt.TableExpr,
		Table:                stmt.Table,
		Model:                stmt.Model,
		Unscoped:             stmt.Unscoped,
		Dest:                 stmt.Dest,
		ReflectValue:         stmt.ReflectValue,
		Clauses:              map[string]clause.Clause{},
		Distinct:             stmt.Distinct,
		Selects:              stmt.Selects,
		Omits:                stmt.Omits,
		Preloads:             map[string][]interface{}{},
		ConnPool:             stmt.ConnPool,
		Schema:               stmt.Schema,
		Context:              stmt.Context,
		RaiseErrorOnNotFound: stmt.RaiseErrorOnNotFound,
		SkipHooks:            stmt.SkipHooks,
	}

	if stmt.SQL.Len() > 0 {
		newStmt.SQL.WriteString(stmt.SQL.String())
		newStmt.Vars = make([]interface{}, 0, len(stmt.Vars))
		newStmt.Vars = append(newStmt.Vars, stmt.Vars...)
	}

	for k, c := range stmt.Clauses {
		newStmt.Clauses[k] = c
	}

	for k, p := range stmt.Preloads {
		newStmt.Preloads[k] = p
	}

	if len(stmt.Joins) > 0 {
		newStmt.Joins = make([]join, len(stmt.Joins))
		copy(newStmt.Joins, stmt.Joins)
	}

	if len(stmt.scopes) > 0 {
		newStmt.scopes = make([]func(*DB) *DB, len(stmt.scopes))
		copy(newStmt.scopes, stmt.scopes)
	}

	stmt.Settings.Range(func(k, v interface{}) bool {
		newStmt.Settings.Store(k, v)
		return true
	})

	return newStmt
}

// SetColumn set column's value
//
//	stmt.SetColumn("Name", "jinzhu") // Hooks Method
//	stmt.SetColumn("Name", "jinzhu", true) // Callbacks Method
func (stmt *Statement) SetColumn(name string, value interface{}, fromCallbacks ...bool) {
	if v, ok := stmt.Dest.(map[string]interface{}); ok {
		v[name] = value
	} else if v, ok := stmt.Dest.([]map[string]interface{}); ok {
		for _, m := range v {
			m[name] = value
		}
	} else if stmt.Schema != nil {
		if field := stmt.Schema.LookUpField(name); field != nil {
			destValue := reflect.ValueOf(stmt.Dest)
			for destValue.Kind() == reflect.Ptr {
				destValue = destValue.Elem()
			}

			if stmt.ReflectValue != destValue {
				if !destValue.CanAddr() {
					destValueCanAddr := reflect.New(destValue.Type())
					destValueCanAddr.Elem().Set(destValue)
					stmt.Dest = destValueCanAddr.Interface()
					destValue = destValueCanAddr.Elem()
				}

				switch destValue.Kind() {
				case reflect.Struct:
					stmt.AddError(field.Set(stmt.Context, destValue, value))
				default:
					stmt.AddError(ErrInvalidData)
				}
			}

			switch stmt.ReflectValue.Kind() {
			case reflect.Slice, reflect.Array:
				if len(fromCallbacks) > 0 {
					for i := 0; i < stmt.ReflectValue.Len(); i++ {
						stmt.AddError(field.Set(stmt.Context, stmt.ReflectValue.Index(i), value))
					}
				} else {
					stmt.AddError(field.Set(stmt.Context, stmt.ReflectValue.Index(stmt.CurDestIndex), value))
				}
			case reflect.Struct:
				if !stmt.ReflectValue.CanAddr() {
					stmt.AddError(ErrInvalidValue)
					return
				}

				stmt.AddError(field.Set(stmt.Context, stmt.ReflectValue, value))
			}
		} else {
			stmt.AddError(ErrInvalidField)
		}
	} else {
		stmt.AddError(ErrInvalidField)
	}
}

// Changed check model changed or not when updating
func (stmt *Statement) Changed(fields ...string) bool {
	modelValue := stmt.ReflectValue
	switch modelValue.Kind() {
	case reflect.Slice, reflect.Array:
		modelValue = stmt.ReflectValue.Index(stmt.CurDestIndex)
	}

	selectColumns, restricted := stmt.SelectAndOmitColumns(false, true)
	changed := func(field *schema.Field) bool {
		fieldValue, _ := field.ValueOf(stmt.Context, modelValue)
		if v, ok := selectColumns[field.DBName]; (ok && v) || (!ok && !restricted) {
			if mv, mok := stmt.Dest.(map[string]interface{}); mok {
				if fv, ok := mv[field.Name]; ok {
					return !utils.AssertEqual(fv, fieldValue)
				} else if fv, ok := mv[field.DBName]; ok {
					return !utils.AssertEqual(fv, fieldValue)
				}
			} else {
				destValue := reflect.ValueOf(stmt.Dest)
				for destValue.Kind() == reflect.Ptr {
					destValue = destValue.Elem()
				}

				changedValue, zero := field.ValueOf(stmt.Context, destValue)
				if v {
					return !utils.AssertEqual(changedValue, fieldValue)
				}
				return !zero && !utils.AssertEqual(changedValue, fieldValue)
			}
		}
		return false
	}

	if len(fields) == 0 {
		for _, field := range stmt.Schema.FieldsByDBName {
			if changed(field) {
				return true
			}
		}
	} else {
		for _, name := range fields {
			if field := stmt.Schema.LookUpField(name); field != nil {
				if changed(field) {
					return true
				}
			}
		}
	}

	return false
}

var nameMatcher = regexp.MustCompile(`^(?:\W?(\w+?)\W?\.)?\W?(\w+?)\W?$`)

// SelectAndOmitColumns get select and omit columns, select -> true, omit -> false
func (stmt *Statement) SelectAndOmitColumns(requireCreate, requireUpdate bool) (map[string]bool, bool) {
	results := map[string]bool{}
	notRestricted := false

	processColumn := func(column string, result bool) {
		if stmt.Schema == nil {
			results[column] = result
		} else if column == "*" {
			notRestricted = result
			for _, dbName := range stmt.Schema.DBNames {
				results[dbName] = result
			}
		} else if column == clause.Associations {
			for _, rel := range stmt.Schema.Relationships.Relations {
				results[rel.Name] = result
			}
		} else if field := stmt.Schema.LookUpField(column); field != nil && field.DBName != "" {
			results[field.DBName] = result
		} else if matches := nameMatcher.FindStringSubmatch(column); len(matches) == 3 && (matches[1] == stmt.Table || matches[1] == "") {
			if matches[2] == "*" {
				for _, dbName := range stmt.Schema.DBNames {
					results[dbName] = result
				}
			} else {
				results[matches[2]] = result
			}
		} else {
			results[column] = result
		}
	}

	// select columns
	for _, column := range stmt.Selects {
		processColumn(column, true)
	}

	// omit columns
	for _, column := range stmt.Omits {
		processColumn(column, false)
	}

	if stmt.Schema != nil {
		for _, field := range stmt.Schema.FieldsByName {
			name := field.DBName
			if name == "" {
				name = field.Name
			}

			if requireCreate && !field.Creatable {
				results[name] = false
			} else if requireUpdate && !field.Updatable {
				results[name] = false
			}
		}
	}

	return results, !notRestricted && len(stmt.Selects) > 0
}
