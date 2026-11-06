package migrator

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

var regFullDataType = regexp.MustCompile(`\D*(\d+)\D?`)

// Migrator m struct
type Migrator struct {
	Config
}

// Config schema config
type Config struct {
	CreateIndexAfterCreateTable bool
	DB                          *gorm.DB
	gorm.Dialector
}

type printSQLLogger struct {
	logger.Interface
}

func (l *printSQLLogger) Trace(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {
	sql, _ := fc()
	fmt.Println(sql + ";")
	l.Interface.Trace(ctx, begin, fc, err)
}

// GormDataTypeInterface gorm data type interface
type GormDataTypeInterface interface {
	GormDBDataType(*gorm.DB, *schema.Field) string
}

// RunWithValue run migration with statement value
func (m Migrator) RunWithValue(value interface{}, fc func(*gorm.Statement) error) error {
	stmt := &gorm.Statement{DB: m.DB}
	if m.DB.Statement != nil {
		stmt.Table = m.DB.Statement.Table
		stmt.TableExpr = m.DB.Statement.TableExpr
	}

	if table, ok := value.(string); ok {
		stmt.Table = table
	} else if err := stmt.ParseWithSpecialTableName(value, stmt.Table); err != nil {
		return err
	}

	return fc(stmt)
}

// DataTypeOf return field's db data type
func (m Migrator) DataTypeOf(field *schema.Field) string {
	fieldValue := reflect.New(field.IndirectFieldType)
	if dataTyper, ok := fieldValue.Interface().(GormDataTypeInterface); ok {
		if dataType := dataTyper.GormDBDataType(m.DB, field); dataType != "" {
			return dataType
		}
	}

	return m.Dialector.DataTypeOf(field)
}

// FullDataTypeOf returns field's db full data type
func (m Migrator) FullDataTypeOf(field *schema.Field) (expr clause.Expr) {
	expr.SQL = m.DataTypeOf(field)

	if field.NotNull {
		expr.SQL += " NOT NULL"
	}

	if field.Unique {
		expr.SQL += " UNIQUE"
	}

	if field.HasDefaultValue && (field.DefaultValueInterface != nil || field.DefaultValue != "") {
		if field.DefaultValueInterface != nil {
			defaultStmt := &gorm.Statement{Vars: []interface{}{field.DefaultValueInterface}}
			m.Dialector.BindVarTo(defaultStmt, defaultStmt, field.DefaultValueInterface)
			expr.SQL += " DEFAULT " + m.Dialector.Explain(defaultStmt.SQL.String(), field.DefaultValueInterface)
		} else if field.DefaultValue != "(-)" {
			expr.SQL += " DEFAULT " + field.DefaultValue
		}
	}

	return
}

// AutoMigrate auto migrate values
func (m Migrator) AutoMigrate(values ...interface{}) error {
	for _, value := range m.ReorderModels(values, true) {
		queryTx := m.DB.Session(&gorm.Session{})
		execTx := queryTx
		if m.DB.DryRun {
			queryTx.DryRun = false
			execTx = m.DB.Session(&gorm.Session{Logger: &printSQLLogger{Interface: m.DB.Logger}})
		}
		if !queryTx.Migrator().HasTable(value) {
			if err := execTx.Migrator().CreateTable(value); err != nil {
				return err
			}
		} else {
			if err := m.RunWithValue(value, func(stmt *gorm.Statement) error {
				columnTypes, err := queryTx.Migrator().ColumnTypes(value)
				if err != nil {
					return err
				}
				var (
					parseIndexes          = stmt.Schema.ParseIndexes()
					parseCheckConstraints = stmt.Schema.ParseCheckConstraints()
				)
				for _, dbName := range stmt.Schema.DBNames {
					var foundColumn gorm.ColumnType

					for _, columnType := range columnTypes {
						if columnType.Name() == dbName {
							foundColumn = columnType
							break
						}
					}

					if foundColumn == nil {
						// not found, add column
						if err = execTx.Migrator().AddColumn(value, dbName); err != nil {
							return err
						}
					} else {
						// found, smartly migrate
						field := stmt.Schema.FieldsByDBName[dbName]
						if err = execTx.Migrator().MigrateColumn(value, field, foundColumn); err != nil {
							return err
						}
					}
				}

				if !m.DB.DisableForeignKeyConstraintWhenMigrating && !m.DB.IgnoreRelationshipsWhenMigrating {
					for _, rel := range stmt.Schema.Relationships.Relations {
						if rel.Field.IgnoreMigration {
							continue
						}
						if constraint := rel.ParseConstraint(); constraint != nil &&
							constraint.Schema == stmt.Schema && !queryTx.Migrator().HasConstraint(value, constraint.Name) {
							if err := execTx.Migrator().CreateConstraint(value, constraint.Name); err != nil {
								return err
							}
						}
					}
				}

				for _, chk := range parseCheckConstraints {
					if !queryTx.Migrator().HasConstraint(value, chk.Name) {
						if err := execTx.Migrator().CreateConstraint(value, chk.Name); err != nil {
							return err
						}
					}
				}

				for _, idx := range parseIndexes {
					if !queryTx.Migrator().HasIndex(value, idx.Name) {
						if err := execTx.Migrator().CreateIndex(value, idx.Name); err != nil {
							return err
						}
					}
				}

				return nil
			}); err != nil {
				return err
			}
		}
	}

	return nil
}

// GetTables returns tables
func (m Migrator) GetTables() (tableList []string, err error) {
	err = m.DB.Raw("SELECT TABLE_NAME FROM information_schema.tables where TABLE_SCHEMA=?", m.CurrentDatabase()).
		Scan(&tableList).Error
	return
}

// CreateTable create table in database for values
func (m Migrator) CreateTable(values ...interface{}) error {
	for _, value := range m.ReorderModels(values, false) {
		tx := m.DB.Session(&gorm.Session{})
		if err := m.RunWithValue(value, func(stmt *gorm.Statement) (err error) {
			var (
				createTableSQL          = "CREATE TABLE ? ("
				values                  = []interface{}{m.CurrentTable(stmt)}
				hasPrimaryKeyInDataType bool
			)

			for _, dbName := range stmt.Schema.DBNames {
				field := stmt.Schema.FieldsByDBName[dbName]
				if !field.IgnoreMigration {
					createTableSQL += "? ?"
					hasPrimaryKeyInDataType = hasPrimaryKeyInDataType || strings.Contains(strings.ToUpper(string(field.DataType)), "PRIMARY KEY")
					values = append(values, clause.Column{Name: dbName}, m.DB.Migrator().FullDataTypeOf(field))
					createTableSQL += ","
				}
			}

			if !hasPrimaryKeyInDataType && len(stmt.Schema.PrimaryFields) > 0 {
				createTableSQL += "PRIMARY KEY ?,"
				primaryKeys := make([]interface{}, 0, len(stmt.Schema.PrimaryFields))
				for _, field := range stmt.Schema.PrimaryFields {
					primaryKeys = append(primaryKeys, clause.Column{Name: field.DBName})
				}

				values = append(values, primaryKeys)
			}

			for _, idx := range stmt.Schema.ParseIndexes() {
				if m.CreateIndexAfterCreateTable {
					defer func(value interface{}, name string) {
						if err == nil {
							err = tx.Migrator().CreateIndex(value, name)
						}
					}(value, idx.Name)
				} else {
					if idx.Class != "" {
						createTableSQL += idx.Class + " "
					}
					createTableSQL += "INDEX ? ?"

					if idx.Comment != "" {
						createTableSQL += fmt.Sprintf(" COMMENT '%s'", idx.Comment)
					}

					if idx.Option != "" {
						createTableSQL += " " + idx.Option
					}

					createTableSQL += ","
					values = append(values, clause.Column{Name: idx.Name}, tx.Migrator().(BuildIndexOptionsInterface).BuildIndexOptions(idx.Fields, stmt))
				}
			}

			if !m.DB.DisableForeignKeyConstraintWhenMigrating && !m.DB.IgnoreRelationshipsWhenMigrating {
				for _, rel := range stmt.Schema.Relationships.Relations {
					if rel.Field.IgnoreMigration {
						continue
					}
					if constraint := rel.ParseConstraint(); constraint != nil {
						if constraint.Schema == stmt.Schema {
							sql, vars := buildConstraint(constraint)
							createTableSQL += sql + ","
							values = append(values, vars...)
						}
					}
				}
			}

			for _, chk := range stmt.Schema.ParseCheckConstraints() {
				createTableSQL += "CONSTRAINT ? CHECK (?),"
				values = append(values, clause.Column{Name: chk.Name}, clause.Expr{SQL: chk.Constraint})
			}

			createTableSQL = strings.TrimSuffix(createTableSQL, ",")

			createTableSQL += ")"

			if tableOption, ok := m.DB.Get("gorm:table_options"); ok {
				createTableSQL += fmt.Sprint(tableOption)
			}

			err = tx.Exec(createTableSQL, values...).Error
			return err
		}); err != nil {
			return err
		}
	}
	return nil
}

// DropTable drop table for values
func (m Migrator) DropTable(values ...interface{}) error {
	values = m.ReorderModels(values, false)
	for i := len(values) - 1; i >= 0; i-- {
		tx := m.DB.Session(&gorm.Session{})
		if err := m.RunWithValue(values[i], func(stmt *gorm.Statement) error {
			return tx.Exec("DROP TABLE IF EXISTS ?", m.CurrentTable(stmt)).Error
		}); err != nil {
			return err
		}
	}
	return nil
}

// HasTable returns table exists or not for value, value could be a struct or string
func (m Migrator) HasTable(value interface{}) bool {
	var count int64

	m.RunWithValue(value, func(stmt *gorm.Statement) error {
		currentDatabase := m.DB.Migrator().CurrentDatabase()
		return m.DB.Raw("SELECT count(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ? AND table_type = ?", currentDatabase, stmt.Table, "BASE TABLE").Row().Scan(&count)
	})

	return count > 0
}

// RenameTable rename table from oldName to newName
func (m Migrator) RenameTable(oldName, newName interface{}) error {
	var oldTable, newTable interface{}
	if v, ok := oldName.(string); ok {
		oldTable = clause.Table{Name: v}
	} else {
		stmt := &gorm.Statement{DB: m.DB}
		if err := stmt.Parse(oldName); err == nil {
			oldTable = m.CurrentTable(stmt)
		} else {
			return err
		}
	}

	if v, ok := newName.(string); ok {
		newTable = clause.Table{Name: v}
	} else {
		stmt := &gorm.Statement{DB: m.DB}
		if err := stmt.Parse(newName); err == nil {
			newTable = m.CurrentTable(stmt)
		} else {
			return err
		}
	}

	return m.DB.Exec("ALTER TABLE ? RENAME TO ?", oldTable, newTable).Error
}

// AddColumn create `name` column for value
func (m Migrator) AddColumn(value interface{}, name string) error {
	return m.RunWithValue(value, func(stmt *gorm.Statement) error {
		// avoid using the same name field
		f := stmt.Schema.LookUpField(name)
		if f == nil {
			return fmt.Errorf("failed to look up field with name: %s", name)
		}

		if !f.IgnoreMigration {
			return m.DB.Exec(
				"ALTER TABLE ? ADD ? ?",
				m.CurrentTable(stmt), clause.Column{Name: f.DBName}, m.DB.Migrator().FullDataTypeOf(f),
			).Error
		}

		return nil
	})
}

// DropColumn drop value's `name` column
func (m Migrator) DropColumn(value interface{}, name string) error {
	return m.RunWithValue(value, func(stmt *gorm.Statement) error {
		if field := stmt.Schema.LookUpField(name); field != nil {
			name = field.DBName
		}

		return m.DB.Exec(
			"ALTER TABLE ? DROP COLUMN ?", m.CurrentTable(stmt), clause.Column{Name: name},
		).Error
	})
}

// AlterColumn alter value's `field` column' type based on schema definition
func (m Migrator) AlterColumn(value interface{}, field string) error {
	return m.RunWithValue(value, func(stmt *gorm.Statement) error {
		if field := stmt.Schema.LookUpField(field); field != nil {
			fileType := m.FullDataTypeOf(field)
			return m.DB.Exec(
				"ALTER TABLE ? ALTER COLUMN ? TYPE ?",
				m.CurrentTable(stmt), clause.Column{Name: field.DBName}, fileType,
			).Error

		}
		return fmt.Errorf("failed to look up field with name: %s", field)
	})
}

// HasColumn check has column `field` for value or not
func (m Migrator) HasColumn(value interface{}, field string) bool {
	var count int64
	m.RunWithValue(value, func(stmt *gorm.Statement) error {
		currentDatabase := m.DB.Migrator().CurrentDatabase()
		name := field
		if field := stmt.Schema.LookUpField(field); field != nil {
			name = field.DBName
		}

		return m.DB.Raw(
			"SELECT count(*) FROM INFORMATION_SCHEMA.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?",
			currentDatabase, stmt.Table, name,
		).Row().Scan(&count)
	})

	return count > 0
}

// RenameColumn rename value's field name from oldName to newName
func (m Migrator) RenameColumn(value interface{}, oldName, newName string) error {
	return m.RunWithValue(value, func(stmt *gorm.Statement) error {
		if field := stmt.Schema.LookUpField(oldName); field != nil {
			oldName = field.DBName
		}

		if field := stmt.Schema.LookUpField(newName); field != nil {
			newName = field.DBName
		}

		return m.DB.Exec(
			"ALTER TABLE ? RENAME COLUMN ? TO ?",
			m.CurrentTable(stmt), clause.Column{Name: oldName}, clause.Column{Name: newName},
		).Error
	})
}

// MigrateColumn migrate column
func (m Migrator) MigrateColumn(value interface{}, field *schema.Field, columnType gorm.ColumnType) error {
	// found, smart migrate
	fullDataType := strings.TrimSpace(strings.ToLower(m.DB.Migrator().FullDataTypeOf(field).SQL))
	realDataType := strings.ToLower(columnType.DatabaseTypeName())

	var (
		alterColumn bool
		isSameType  = fullDataType == realDataType
	)

	if !field.PrimaryKey {
		// check type
		if !strings.HasPrefix(fullDataType, realDataType) {
			// check type aliases
			aliases := m.DB.Migrator().GetTypeAliases(realDataType)
			for _, alias := range aliases {
				if strings.HasPrefix(fullDataType, alias) {
					isSameType = true
					break
				}
			}

			if !isSameType {
				alterColumn = true
			}
		}
	}

	if !isSameType {
		// check size
		if length, ok := columnType.Length(); length != int64(field.Size) {
			if length > 0 && field.Size > 0 {
				alterColumn = true
			} else {
				// has size in data type and not equal
				// Since the following code is frequently called in the for loop, reg optimization is needed here
				matches2 := regFullDataType.FindAllStringSubmatch(fullDataType, -1)
				if !field.PrimaryKey &&
					(len(matches2) == 1 && matches2[0][1] != fmt.Sprint(length) && ok) {
					alterColumn = true
				}
			}
		}

		// check precision
		if precision, _, ok := columnType.DecimalSize(); ok && int64(field.Precision) != precision {
			if regexp.MustCompile(fmt.Sprintf("[^0-9]%d[^0-9]", field.Precision)).MatchString(m.DataTypeOf(field)) {
				alterColumn = true
			}
		}
	}

	// check nullable
	if nullable, ok := columnType.Nullable(); ok && nullable == field.NotNull {
		// not primary key & database is nullable
		if !field.PrimaryKey && nullable {
			alterColumn = true
		}
	}

	// check unique
	if unique, ok := columnType.Unique(); ok && unique != field.Unique {
		// not primary key
		if !field.PrimaryKey {
			alterColumn = true
		}
	}

	// check default value
	if !field.PrimaryKey {
		currentDefaultNotNull := field.HasDefaultValue && (field.DefaultValueInterface != nil || !strings.EqualFold(field.DefaultValue, "NULL"))
		dv, dvNotNull := columnType.DefaultValue()
		if dvNotNull && !currentDefaultNotNull {
			// default value -> null
			alterColumn = true
		} else if !dvNotNull && currentDefaultNotNull {
			// null -> default value
			alterColumn = true
		} else if (field.GORMDataType != schema.Time && dv != field.DefaultValue) ||
			(field.GORMDataType == schema.Time && !strings.EqualFold(strings.TrimSuffix(dv, "()"), strings.TrimSuffix(field.DefaultValue, "()"))) {
			// default value not equal
			// not both null
			if currentDefaultNotNull || dvNotNull {
				alterColumn = true
			}
		}
	}

	// check comment
	if comment, ok := columnType.Comment(); ok && comment != field.Comment {
		// not primary key
		if !field.PrimaryKey {
			alterColumn = true
		}
	}

	if alterColumn && !field.IgnoreMigration {
		return m.DB.Migrator().AlterColumn(value, field.DBName)
	}

	return nil
}

// ColumnTypes return columnTypes []gorm.ColumnType and execErr error
func (m Migrator) ColumnTypes(value interface{}) ([]gorm.ColumnType, error) {
	columnTypes := make([]gorm.ColumnType, 0)
	execErr := m.RunWithValue(value, func(stmt *gorm.Statement) (err error) {
		rows, err := m.DB.Session(&gorm.Session{}).Table(stmt.Table).Limit(1).Rows()
		if err != nil {
			return err
		}

		defer func() {
			err = rows.Close()
		}()

		var rawColumnTypes []*sql.ColumnType
		rawColumnTypes, err = rows.ColumnTypes()
		if err != nil {
			return err
		}

		for _, c := range rawColumnTypes {
			columnTypes = append(columnTypes, ColumnType{SQLColumnType: c})
		}

		return
	})

	return columnTypes, execErr
}

// CreateView create view from Query in gorm.ViewOption.
// Query in gorm.ViewOption is a [subquery]
//
//	// CREATE VIEW `user_view` AS SELECT * FROM `users` WHERE age > 20
//	q := DB.Model(&User{}).Where("age > ?", 20)
//	DB.Debug().Migrator().CreateView("user_view", gorm.ViewOption{Query: q})
//
//	// CREATE OR REPLACE VIEW `users_view` AS SELECT * FROM `users` WITH CHECK OPTION
//	q := DB.Model(&User{})
//	DB.Debug().Migrator().CreateView("user_view", gorm.ViewOption{Query: q, Replace: true, CheckOption: "WITH CHECK OPTION"})
//
// [subquery]: https://gorm.io/docs/advanced_query.html#SubQuery
func (m Migrator) CreateView(name string, option gorm.ViewOption) error {
	if option.Query == nil {
		return gorm.ErrSubQueryRequired
	}

	sql := new(strings.Builder)
	sql.WriteString("CREATE ")
	if option.Replace {
		sql.WriteString("OR REPLACE ")
	}
	sql.WriteString("VIEW ")
	m.QuoteTo(sql, name)
	sql.WriteString(" AS ")

	m.DB.Statement.AddVar(sql, option.Query)

	if option.CheckOption != "" {
		sql.WriteString(" ")
		sql.WriteString(option.CheckOption)
	}
	return m.DB.Exec(m.Explain(sql.String(), m.DB.Statement.Vars...)).Error
}

// DropView drop view
func (m Migrator) DropView(name string) error {
	return m.DB.Exec("DROP VIEW IF EXISTS ?", clause.Table{Name: name}).Error
}

func buildConstraint(constraint *schema.Constraint) (sql string, results []interface{}) {
	sql = "CONSTRAINT ? FOREIGN KEY ? REFERENCES ??"
	if constraint.OnDelete != "" {
		sql += " ON DELETE " + constraint.OnDelete
	}

	if constraint.OnUpdate != "" {
		sql += " ON UPDATE " + constraint.OnUpdate
	}

	var foreignKeys, references []interface{}
	for _, field := range constraint.ForeignKeys {
		foreignKeys = append(foreignKeys, clause.Column{Name: field.DBName})
	}

	for _, field := range constraint.References {
		references = append(references, clause.Column{Name: field.DBName})
	}
	results = append(results, clause.Table{Name: constraint.Name}, foreignKeys, clause.Table{Name: constraint.ReferenceSchema.Table}, references)
	return
}

// GuessConstraintAndTable guess statement's constraint and it's table based on name
func (m Migrator) GuessConstraintAndTable(stmt *gorm.Statement, name string) (_ *schema.Constraint, _ *schema.Check, table string) {
	if stmt.Schema == nil {
		return nil, nil, stmt.Table
	}

	checkConstraints := stmt.Schema.ParseCheckConstraints()
	if chk, ok := checkConstraints[name]; ok {
		return nil, &chk, stmt.Table
	}

	getTable := func(rel *schema.Relationship) string {
		switch rel.Type {
		case schema.HasOne, schema.HasMany:
			return rel.FieldSchema.Table
		case schema.Many2Many:
			return rel.JoinTable.Table
		}
		return stmt.Table
	}

	for _, rel := range stmt.Schema.Relationships.Relations {
		if constraint := rel.ParseConstraint(); constraint != nil && constraint.Name == name {
			return constraint, nil, getTable(rel)
		}
	}

	if field := stmt.Schema.LookUpField(name); field != nil {
		for k := range checkConstraints {
			if checkConstraints[k].Field == field {
				v := checkConstraints[k]
				return nil, &v, stmt.Table
			}
		}

		for _, rel := range stmt.Schema.Relationships.Relations {
			if constraint := rel.ParseConstraint(); constraint != nil && rel.Field == field {
				return constraint, nil, getTable(rel)
			}
		}
	}

	return nil, nil, stmt.Schema.Table
}

// CreateConstraint create constraint
func (m Migrator) CreateConstraint(value interface{}, name string) error {
	return m.RunWithValue(value, func(stmt *gorm.Statement) error {
		constraint, chk, table := m.GuessConstraintAndTable(stmt, name)
		if chk != nil {
			return m.DB.Exec(
				"ALTER TABLE ? ADD CONSTRAINT ? CHECK (?)",
				m.CurrentTable(stmt), clause.Column{Name: chk.Name}, clause.Expr{SQL: chk.Constraint},
			).Error
		}

		if constraint != nil {
			vars := []interface{}{clause.Table{Name: table}}
			if stmt.TableExpr != nil {
				vars[0] = stmt.TableExpr
			}
			sql, values := buildConstraint(constraint)
			return m.DB.Exec("ALTER TABLE ? ADD "+sql, append(vars, values...)...).Error
		}

		return nil
	})
}

// DropConstraint drop constraint
func (m Migrator) DropConstraint(value interface{}, name string) error {
	return m.RunWithValue(value, func(stmt *gorm.Statement) error {
		constraint, chk, table := m.GuessConstraintAndTable(stmt, name)
		if constraint != nil {
			name = constraint.Name
		} else if chk != nil {
			name = chk.Name
		}
		return m.DB.Exec("ALTER TABLE ? DROP CONSTRAINT ?", clause.Table{Name: table}, clause.Column{Name: name}).Error
	})
}

// HasConstraint check has constraint or not
func (m Migrator) HasConstraint(value interface{}, name string) bool {
	var count int64
	m.RunWithValue(value, func(stmt *gorm.Statement) error {
		currentDatabase := m.DB.Migrator().CurrentDatabase()
		constraint, chk, table := m.GuessConstraintAndTable(stmt, name)
		if constraint != nil {
			name = constraint.Name
		} else if chk != nil {
			name = chk.Name
		}

		return m.DB.Raw(
			"SELECT count(*) FROM INFORMATION_SCHEMA.table_constraints WHERE constraint_schema = ? AND table_name = ? AND constraint_name = ?",
			currentDatabase, table, name,
		).Row().Scan(&count)
	})

	return count > 0
}

// BuildIndexOptions build index options
func (m Migrator) BuildIndexOptions(opts []schema.IndexOption, stmt *gorm.Statement) (results []interface{}) {
	for _, opt := range opts {
		str := stmt.Quote(opt.DBName)
		if opt.Expression != "" {
			str = opt.Expression
		} else if opt.Length > 0 {
			str += fmt.Sprintf("(%d)", opt.Length)
		}

		if opt.Collate != "" {
			str += " COLLATE " + opt.Collate
		}

		if opt.Sort != "" {
			str += " " + opt.Sort
		}
		results = append(results, clause.Expr{SQL: str})
	}
	return
}

// BuildIndexOptionsInterface build index options interface
type BuildIndexOptionsInterface interface {
	BuildIndexOptions([]schema.IndexOption, *gorm.Statement) []interface{}
}

// CreateIndex create index `name`
func (m Migrator) CreateIndex(value interface{}, name string) error {
	return m.RunWithValue(value, func(stmt *gorm.Statement) error {
		if idx := stmt.Schema.LookIndex(name); idx != nil {
			opts := m.DB.Migrator().(BuildIndexOptionsInterface).BuildIndexOptions(idx.Fields, stmt)
			values := []interface{}{clause.Column{Name: idx.Name}, m.CurrentTable(stmt), opts}

			createIndexSQL := "CREATE "
			if idx.Class != "" {
				createIndexSQL += idx.Class + " "
			}
			createIndexSQL += "INDEX ? ON ??"

			if idx.Type != "" {
				createIndexSQL += " USING " + idx.Type
			}

			if idx.Comment != "" {
				createIndexSQL += fmt.Sprintf(" COMMENT '%s'", idx.Comment)
			}

			if idx.Option != "" {
				createIndexSQL += " " + idx.Option
			}

			return m.DB.Exec(createIndexSQL, values...).Error
		}

		return fmt.Errorf("failed to create index with name %s", name)
	})
}

// DropIndex drop index `name`
func (m Migrator) DropIndex(value interface{}, name string) error {
	return m.RunWithValue(value, func(stmt *gorm.Statement) error {
		if idx := stmt.Schema.LookIndex(name); idx != nil {
			name = idx.Name
		}

		return m.DB.Exec("DROP INDEX ? ON ?", clause.Column{Name: name}, m.CurrentTable(stmt)).Error
	})
}

// HasIndex check has index `name` or not
func (m Migrator) HasIndex(value interface{}, name string) bool {
	var count int64
	m.RunWithValue(value, func(stmt *gorm.Statement) error {
		currentDatabase := m.DB.Migrator().CurrentDatabase()
		if idx := stmt.Schema.LookIndex(name); idx != nil {
			name = idx.Name
		}

		return m.DB.Raw(
			"SELECT count(*) FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?",
			currentDatabase, stmt.Table, name,
		).Row().Scan(&count)
	})

	return count > 0
}

// RenameIndex rename index from oldName to newName
func (m Migrator) RenameIndex(value interface{}, oldName, newName string) error {
	return m.RunWithValue(value, func(stmt *gorm.Statement) error {
		return m.DB.Exec(
			"ALTER TABLE ? RENAME INDEX ? TO ?",
			m.CurrentTable(stmt), clause.Column{Name: oldName}, clause.Column{Name: newName},
		).Error
	})
}

// CurrentDatabase returns current database name
func (m Migrator) CurrentDatabase() (name string) {
	m.DB.Raw("SELECT DATABASE()").Row().Scan(&name)
	return
}

// ReorderModels reorder models according to constraint dependencies
func (m Migrator) ReorderModels(values []interface{}, autoAdd bool) (results []interface{}) {
	type Dependency struct {
		*gorm.Statement
		Depends []*schema.Schema
	}

	var (
		modelNames, orderedModelNames []string
		orderedModelNamesMap          = map[string]bool{}
		parsedSchemas                 = map[*schema.Schema]bool{}
		valuesMap                     = map[string]Dependency{}
		insertIntoOrderedList         func(name string)
		parseDependence               func(value interface{}, addToList bool)
	)

	parseDependence = func(value interface{}, addToList bool) {
		dep := Dependency{
			Statement: &gorm.Statement{DB: m.DB, Dest: value},
		}
		beDependedOn := map[*schema.Schema]bool{}
		// support for special table name
		if err := dep.ParseWithSpecialTableName(value, m.DB.Statement.Table); err != nil {
			m.DB.Logger.Error(context.Background(), "failed to parse value %#v, got error %v", value, err)
		}
		if _, ok := parsedSchemas[dep.Statement.Schema]; ok {
			return
		}
		parsedSchemas[dep.Statement.Schema] = true

		if !m.DB.IgnoreRelationshipsWhenMigrating {
			for _, rel := range dep.Schema.Relationships.Relations {
				if rel.Field.IgnoreMigration {
					continue
				}
				if c := rel.ParseConstraint(); c != nil && c.Schema == dep.Statement.Schema && c.Schema != c.ReferenceSchema {
					dep.Depends = append(dep.Depends, c.ReferenceSchema)
				}

				if rel.Type == schema.HasOne || rel.Type == schema.HasMany {
					beDependedOn[rel.FieldSchema] = true
				}

				if rel.JoinTable != nil {
					// append join value
					defer func(rel *schema.Relationship, joinValue interface{}) {
						if !beDependedOn[rel.FieldSchema] {
							dep.Depends = append(dep.Depends, rel.FieldSchema)
						} else {
							fieldValue := reflect.New(rel.FieldSchema.ModelType).Interface()
							parseDependence(fieldValue, autoAdd)
						}
						parseDependence(joinValue, autoAdd)
					}(rel, reflect.New(rel.JoinTable.ModelType).Interface())
				}
			}
		}

		valuesMap[dep.Schema.Table] = dep

		if addToList {
			modelNames = append(modelNames, dep.Schema.Table)
		}
	}

	insertIntoOrderedList = func(name string) {
		if _, ok := orderedModelNamesMap[name]; ok {
			return // avoid loop
		}
		orderedModelNamesMap[name] = true

		if autoAdd {
			dep := valuesMap[name]
			for _, d := range dep.Depends {
				if _, ok := valuesMap[d.Table]; ok {
					insertIntoOrderedList(d.Table)
				} else {
					parseDependence(reflect.New(d.ModelType).Interface(), autoAdd)
					insertIntoOrderedList(d.Table)
				}
			}
		}

		orderedModelNames = append(orderedModelNames, name)
	}

	for _, value := range values {
		if v, ok := value.(string); ok {
			results = append(results, v)
		} else {
			parseDependence(value, true)
		}
	}

	for _, name := range modelNames {
		insertIntoOrderedList(name)
	}

	for _, name := range orderedModelNames {
		results = append(results, valuesMap[name].Statement.Dest)
	}
	return
}

// CurrentTable returns current statement's table expression
func (m Migrator) CurrentTable(stmt *gorm.Statement) interface{} {
	if stmt.TableExpr != nil {
		return *stmt.TableExpr
	}
	return clause.Table{Name: stmt.Table}
}

// GetIndexes return Indexes []gorm.Index and execErr error
func (m Migrator) GetIndexes(dst interface{}) ([]gorm.Index, error) {
	return nil, errors.New("not support")
}

// GetTypeAliases return database type aliases
func (m Migrator) GetTypeAliases(databaseTypeName string) []string {
	return nil
}

// TableType return tableType gorm.TableType and execErr error
func (m Migrator) TableType(dst interface{}) (gorm.TableType, error) {
	return nil, errors.New("not support")
}
