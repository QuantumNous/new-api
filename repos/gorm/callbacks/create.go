package callbacks

import (
	"fmt"
	"reflect"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
	"gorm.io/gorm/utils"
)

// BeforeCreate before create hooks
func BeforeCreate(db *gorm.DB) {
	if db.Error == nil && db.Statement.Schema != nil && !db.Statement.SkipHooks && (db.Statement.Schema.BeforeSave || db.Statement.Schema.BeforeCreate) {
		callMethod(db, func(value interface{}, tx *gorm.DB) (called bool) {
			if db.Statement.Schema.BeforeSave {
				if i, ok := value.(BeforeSaveInterface); ok {
					called = true
					db.AddError(i.BeforeSave(tx))
				}
			}

			if db.Statement.Schema.BeforeCreate {
				if i, ok := value.(BeforeCreateInterface); ok {
					called = true
					db.AddError(i.BeforeCreate(tx))
				}
			}
			return called
		})
	}
}

// Create create hook
func Create(config *Config) func(db *gorm.DB) {
	supportReturning := utils.Contains(config.CreateClauses, "RETURNING")

	return func(db *gorm.DB) {
		if db.Error != nil {
			return
		}

		if db.Statement.Schema != nil {
			if !db.Statement.Unscoped {
				for _, c := range db.Statement.Schema.CreateClauses {
					db.Statement.AddClause(c)
				}
			}

			if supportReturning && len(db.Statement.Schema.FieldsWithDefaultDBValue) > 0 {
				if _, ok := db.Statement.Clauses["RETURNING"]; !ok {
					fromColumns := make([]clause.Column, 0, len(db.Statement.Schema.FieldsWithDefaultDBValue))
					for _, field := range db.Statement.Schema.FieldsWithDefaultDBValue {
						fromColumns = append(fromColumns, clause.Column{Name: field.DBName})
					}
					db.Statement.AddClause(clause.Returning{Columns: fromColumns})
				}
			}
		}

		if db.Statement.SQL.Len() == 0 {
			db.Statement.SQL.Grow(180)
			db.Statement.AddClauseIfNotExists(clause.Insert{})
			db.Statement.AddClause(ConvertToCreateValues(db.Statement))

			db.Statement.Build(db.Statement.BuildClauses...)
		}

		isDryRun := !db.DryRun && db.Error == nil
		if !isDryRun {
			return
		}

		ok, mode := hasReturning(db, supportReturning)
		if ok {
			if c, ok := db.Statement.Clauses["ON CONFLICT"]; ok {
				if onConflict, _ := c.Expression.(clause.OnConflict); onConflict.DoNothing {
					mode |= gorm.ScanOnConflictDoNothing
				}
			}

			rows, err := db.Statement.ConnPool.QueryContext(
				db.Statement.Context, db.Statement.SQL.String(), db.Statement.Vars...,
			)
			if db.AddError(err) == nil {
				defer func() {
					db.AddError(rows.Close())
				}()
				gorm.Scan(rows, db, mode)
			}

			return
		}

		result, err := db.Statement.ConnPool.ExecContext(
			db.Statement.Context, db.Statement.SQL.String(), db.Statement.Vars...,
		)
		if err != nil {
			db.AddError(err)
			return
		}

		db.RowsAffected, _ = result.RowsAffected()
		if db.RowsAffected != 0 && db.Statement.Schema != nil &&
			db.Statement.Schema.PrioritizedPrimaryField != nil &&
			db.Statement.Schema.PrioritizedPrimaryField.HasDefaultValue {
			insertID, err := result.LastInsertId()
			insertOk := err == nil && insertID > 0
			if !insertOk {
				db.AddError(err)
				return
			}

			switch db.Statement.ReflectValue.Kind() {
			case reflect.Slice, reflect.Array:
				if config.LastInsertIDReversed {
					for i := db.Statement.ReflectValue.Len() - 1; i >= 0; i-- {
						rv := db.Statement.ReflectValue.Index(i)
						if reflect.Indirect(rv).Kind() != reflect.Struct {
							break
						}

						_, isZero := db.Statement.Schema.PrioritizedPrimaryField.ValueOf(db.Statement.Context, rv)
						if isZero {
							db.AddError(db.Statement.Schema.PrioritizedPrimaryField.Set(db.Statement.Context, rv, insertID))
							insertID -= db.Statement.Schema.PrioritizedPrimaryField.AutoIncrementIncrement
						}
					}
				} else {
					for i := 0; i < db.Statement.ReflectValue.Len(); i++ {
						rv := db.Statement.ReflectValue.Index(i)
						if reflect.Indirect(rv).Kind() != reflect.Struct {
							break
						}

						if _, isZero := db.Statement.Schema.PrioritizedPrimaryField.ValueOf(db.Statement.Context, rv); isZero {
							db.AddError(db.Statement.Schema.PrioritizedPrimaryField.Set(db.Statement.Context, rv, insertID))
							insertID += db.Statement.Schema.PrioritizedPrimaryField.AutoIncrementIncrement
						}
					}
				}
			case reflect.Struct:
				_, isZero := db.Statement.Schema.PrioritizedPrimaryField.ValueOf(db.Statement.Context, db.Statement.ReflectValue)
				if isZero {
					db.AddError(db.Statement.Schema.PrioritizedPrimaryField.Set(db.Statement.Context, db.Statement.ReflectValue, insertID))
				}
			}
		}
	}
}

// AfterCreate after create hooks
func AfterCreate(db *gorm.DB) {
	if db.Error == nil && db.Statement.Schema != nil && !db.Statement.SkipHooks && (db.Statement.Schema.AfterSave || db.Statement.Schema.AfterCreate) {
		callMethod(db, func(value interface{}, tx *gorm.DB) (called bool) {
			if db.Statement.Schema.AfterCreate {
				if i, ok := value.(AfterCreateInterface); ok {
					called = true
					db.AddError(i.AfterCreate(tx))
				}
			}

			if db.Statement.Schema.AfterSave {
				if i, ok := value.(AfterSaveInterface); ok {
					called = true
					db.AddError(i.AfterSave(tx))
				}
			}
			return called
		})
	}
}

// ConvertToCreateValues convert to create values
func ConvertToCreateValues(stmt *gorm.Statement) (values clause.Values) {
	curTime := stmt.DB.NowFunc()

	switch value := stmt.Dest.(type) {
	case map[string]interface{}:
		values = ConvertMapToValuesForCreate(stmt, value)
	case *map[string]interface{}:
		values = ConvertMapToValuesForCreate(stmt, *value)
	case []map[string]interface{}:
		values = ConvertSliceOfMapToValuesForCreate(stmt, value)
	case *[]map[string]interface{}:
		values = ConvertSliceOfMapToValuesForCreate(stmt, *value)
	default:
		var (
			selectColumns, restricted = stmt.SelectAndOmitColumns(true, false)
			_, updateTrackTime        = stmt.Get("gorm:update_track_time")
			isZero                    bool
		)
		stmt.Settings.Delete("gorm:update_track_time")

		values = clause.Values{Columns: make([]clause.Column, 0, len(stmt.Schema.DBNames))}

		for _, db := range stmt.Schema.DBNames {
			if field := stmt.Schema.FieldsByDBName[db]; !field.HasDefaultValue || field.DefaultValueInterface != nil {
				if v, ok := selectColumns[db]; (ok && v) || (!ok && (!restricted || field.AutoCreateTime > 0 || field.AutoUpdateTime > 0)) {
					values.Columns = append(values.Columns, clause.Column{Name: db})
				}
			}
		}

		switch stmt.ReflectValue.Kind() {
		case reflect.Slice, reflect.Array:
			rValLen := stmt.ReflectValue.Len()
			if rValLen == 0 {
				stmt.AddError(gorm.ErrEmptySlice)
				return
			}

			stmt.SQL.Grow(rValLen * 18)
			stmt.Vars = make([]interface{}, 0, rValLen*len(values.Columns))
			values.Values = make([][]interface{}, rValLen)

			defaultValueFieldsHavingValue := map[*schema.Field][]interface{}{}
			for i := 0; i < rValLen; i++ {
				rv := reflect.Indirect(stmt.ReflectValue.Index(i))
				if !rv.IsValid() {
					stmt.AddError(fmt.Errorf("slice data #%v is invalid: %w", i, gorm.ErrInvalidData))
					return
				}

				values.Values[i] = make([]interface{}, len(values.Columns))
				for idx, column := range values.Columns {
					field := stmt.Schema.FieldsByDBName[column.Name]
					if values.Values[i][idx], isZero = field.ValueOf(stmt.Context, rv); isZero {
						if field.DefaultValueInterface != nil {
							values.Values[i][idx] = field.DefaultValueInterface
							stmt.AddError(field.Set(stmt.Context, rv, field.DefaultValueInterface))
						} else if field.AutoCreateTime > 0 || field.AutoUpdateTime > 0 {
							stmt.AddError(field.Set(stmt.Context, rv, curTime))
							values.Values[i][idx], _ = field.ValueOf(stmt.Context, rv)
						}
					} else if field.AutoUpdateTime > 0 && updateTrackTime {
						stmt.AddError(field.Set(stmt.Context, rv, curTime))
						values.Values[i][idx], _ = field.ValueOf(stmt.Context, rv)
					}
				}

				for _, field := range stmt.Schema.FieldsWithDefaultDBValue {
					if v, ok := selectColumns[field.DBName]; (ok && v) || (!ok && !restricted) {
						if rvOfvalue, isZero := field.ValueOf(stmt.Context, rv); !isZero {
							if len(defaultValueFieldsHavingValue[field]) == 0 {
								defaultValueFieldsHavingValue[field] = make([]interface{}, rValLen)
							}
							defaultValueFieldsHavingValue[field][i] = rvOfvalue
						}
					}
				}
			}

			for field, vs := range defaultValueFieldsHavingValue {
				values.Columns = append(values.Columns, clause.Column{Name: field.DBName})
				for idx := range values.Values {
					if vs[idx] == nil {
						values.Values[idx] = append(values.Values[idx], stmt.Dialector.DefaultValueOf(field))
					} else {
						values.Values[idx] = append(values.Values[idx], vs[idx])
					}
				}
			}
		case reflect.Struct:
			values.Values = [][]interface{}{make([]interface{}, len(values.Columns))}
			for idx, column := range values.Columns {
				field := stmt.Schema.FieldsByDBName[column.Name]
				if values.Values[0][idx], isZero = field.ValueOf(stmt.Context, stmt.ReflectValue); isZero {
					if field.DefaultValueInterface != nil {
						values.Values[0][idx] = field.DefaultValueInterface
						stmt.AddError(field.Set(stmt.Context, stmt.ReflectValue, field.DefaultValueInterface))
					} else if field.AutoCreateTime > 0 || field.AutoUpdateTime > 0 {
						stmt.AddError(field.Set(stmt.Context, stmt.ReflectValue, curTime))
						values.Values[0][idx], _ = field.ValueOf(stmt.Context, stmt.ReflectValue)
					}
				} else if field.AutoUpdateTime > 0 && updateTrackTime {
					stmt.AddError(field.Set(stmt.Context, stmt.ReflectValue, curTime))
					values.Values[0][idx], _ = field.ValueOf(stmt.Context, stmt.ReflectValue)
				}
			}

			for _, field := range stmt.Schema.FieldsWithDefaultDBValue {
				if v, ok := selectColumns[field.DBName]; (ok && v) || (!ok && !restricted) {
					if rvOfvalue, isZero := field.ValueOf(stmt.Context, stmt.ReflectValue); !isZero {
						values.Columns = append(values.Columns, clause.Column{Name: field.DBName})
						values.Values[0] = append(values.Values[0], rvOfvalue)
					}
				}
			}
		default:
			stmt.AddError(gorm.ErrInvalidData)
		}
	}

	if c, ok := stmt.Clauses["ON CONFLICT"]; ok {
		if onConflict, _ := c.Expression.(clause.OnConflict); onConflict.UpdateAll {
			if stmt.Schema != nil && len(values.Columns) >= 1 {
				selectColumns, restricted := stmt.SelectAndOmitColumns(true, true)

				columns := make([]string, 0, len(values.Columns)-1)
				for _, column := range values.Columns {
					if field := stmt.Schema.LookUpField(column.Name); field != nil {
						if v, ok := selectColumns[field.DBName]; (ok && v) || (!ok && !restricted) {
							if !field.PrimaryKey && (!field.HasDefaultValue || field.DefaultValueInterface != nil ||
								strings.EqualFold(field.DefaultValue, "NULL")) && field.AutoCreateTime == 0 {
								if field.AutoUpdateTime > 0 {
									assignment := clause.Assignment{Column: clause.Column{Name: field.DBName}, Value: curTime}
									switch field.AutoUpdateTime {
									case schema.UnixNanosecond:
										assignment.Value = curTime.UnixNano()
									case schema.UnixMillisecond:
										assignment.Value = curTime.UnixNano() / 1e6
									case schema.UnixSecond:
										assignment.Value = curTime.Unix()
									}

									onConflict.DoUpdates = append(onConflict.DoUpdates, assignment)
								} else {
									columns = append(columns, column.Name)
								}
							}
						}
					}
				}

				onConflict.DoUpdates = append(onConflict.DoUpdates, clause.AssignmentColumns(columns)...)
				if len(onConflict.DoUpdates) == 0 {
					onConflict.DoNothing = true
				}

				// use primary fields as default OnConflict columns
				if len(onConflict.Columns) == 0 {
					for _, field := range stmt.Schema.PrimaryFields {
						onConflict.Columns = append(onConflict.Columns, clause.Column{Name: field.DBName})
					}
				}
				stmt.AddClause(onConflict)
			}
		}
	}

	return values
}
