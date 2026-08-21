package gorm

import (
	"database/sql"
	"database/sql/driver"
	"reflect"
	"time"

	"gorm.io/gorm/schema"
	"gorm.io/gorm/utils"
)

// prepareValues prepare values slice
func prepareValues(values []interface{}, db *DB, columnTypes []*sql.ColumnType, columns []string) {
	if db.Statement.Schema != nil {
		for idx, name := range columns {
			if field := db.Statement.Schema.LookUpField(name); field != nil {
				values[idx] = reflect.New(reflect.PtrTo(field.FieldType)).Interface()
				continue
			}
			values[idx] = new(interface{})
		}
	} else if len(columnTypes) > 0 {
		for idx, columnType := range columnTypes {
			if columnType.ScanType() != nil {
				values[idx] = reflect.New(reflect.PtrTo(columnType.ScanType())).Interface()
			} else {
				values[idx] = new(interface{})
			}
		}
	} else {
		for idx := range columns {
			values[idx] = new(interface{})
		}
	}
}

func scanIntoMap(mapValue map[string]interface{}, values []interface{}, columns []string) {
	for idx, column := range columns {
		if reflectValue := reflect.Indirect(reflect.Indirect(reflect.ValueOf(values[idx]))); reflectValue.IsValid() {
			mapValue[column] = reflectValue.Interface()
			if valuer, ok := mapValue[column].(driver.Valuer); ok {
				mapValue[column], _ = valuer.Value()
			} else if b, ok := mapValue[column].(sql.RawBytes); ok {
				mapValue[column] = string(b)
			}
		} else {
			mapValue[column] = nil
		}
	}
}

func (db *DB) scanIntoStruct(rows Rows, reflectValue reflect.Value, values []interface{}, fields []*schema.Field, joinFields [][]*schema.Field) {
	for idx, field := range fields {
		if field != nil {
			values[idx] = field.NewValuePool.Get()
		} else if len(fields) == 1 {
			if reflectValue.CanAddr() {
				values[idx] = reflectValue.Addr().Interface()
			} else {
				values[idx] = reflectValue.Interface()
			}
		}
	}

	db.RowsAffected++
	db.AddError(rows.Scan(values...))
	joinedNestedSchemaMap := make(map[string]interface{})
	for idx, field := range fields {
		if field == nil {
			continue
		}

		if len(joinFields) == 0 || len(joinFields[idx]) == 0 {
			db.AddError(field.Set(db.Statement.Context, reflectValue, values[idx]))
		} else { // joinFields count is larger than 2 when using join
			var isNilPtrValue bool
			var relValue reflect.Value
			// does not contain raw dbname
			nestedJoinSchemas := joinFields[idx][:len(joinFields[idx])-1]
			// current reflect value
			currentReflectValue := reflectValue
			fullRels := make([]string, 0, len(nestedJoinSchemas))
			for _, joinSchema := range nestedJoinSchemas {
				fullRels = append(fullRels, joinSchema.Name)
				relValue = joinSchema.ReflectValueOf(db.Statement.Context, currentReflectValue)
				if relValue.Kind() == reflect.Ptr {
					fullRelsName := utils.JoinNestedRelationNames(fullRels)
					// same nested structure
					if _, ok := joinedNestedSchemaMap[fullRelsName]; !ok {
						if value := reflect.ValueOf(values[idx]).Elem(); value.Kind() == reflect.Ptr && value.IsNil() {
							isNilPtrValue = true
							break
						}

						relValue.Set(reflect.New(relValue.Type().Elem()))
						joinedNestedSchemaMap[fullRelsName] = nil
					}
				}
				currentReflectValue = relValue
			}

			if !isNilPtrValue { // ignore if value is nil
				f := joinFields[idx][len(joinFields[idx])-1]
				db.AddError(f.Set(db.Statement.Context, relValue, values[idx]))
			}
		}

		// release data to pool
		field.NewValuePool.Put(values[idx])
	}
}

// ScanMode scan data mode
type ScanMode uint8

// scan modes
const (
	ScanInitialized         ScanMode = 1 << 0 // 1
	ScanUpdate              ScanMode = 1 << 1 // 2
	ScanOnConflictDoNothing ScanMode = 1 << 2 // 4
)

// Scan scan rows into db statement
func Scan(rows Rows, db *DB, mode ScanMode) {
	var (
		columns, _          = rows.Columns()
		values              = make([]interface{}, len(columns))
		initialized         = mode&ScanInitialized != 0
		update              = mode&ScanUpdate != 0
		onConflictDonothing = mode&ScanOnConflictDoNothing != 0
	)

	db.RowsAffected = 0

	switch dest := db.Statement.Dest.(type) {
	case map[string]interface{}, *map[string]interface{}:
		if initialized || rows.Next() {
			columnTypes, _ := rows.ColumnTypes()
			prepareValues(values, db, columnTypes, columns)

			db.RowsAffected++
			db.AddError(rows.Scan(values...))

			mapValue, ok := dest.(map[string]interface{})
			if !ok {
				if v, ok := dest.(*map[string]interface{}); ok {
					if *v == nil {
						*v = map[string]interface{}{}
					}
					mapValue = *v
				}
			}
			scanIntoMap(mapValue, values, columns)
		}
	case *[]map[string]interface{}:
		columnTypes, _ := rows.ColumnTypes()
		for initialized || rows.Next() {
			prepareValues(values, db, columnTypes, columns)

			initialized = false
			db.RowsAffected++
			db.AddError(rows.Scan(values...))

			mapValue := map[string]interface{}{}
			scanIntoMap(mapValue, values, columns)
			*dest = append(*dest, mapValue)
		}
	case *int, *int8, *int16, *int32, *int64,
		*uint, *uint8, *uint16, *uint32, *uint64, *uintptr,
		*float32, *float64,
		*bool, *string, *time.Time,
		*sql.NullInt32, *sql.NullInt64, *sql.NullFloat64,
		*sql.NullBool, *sql.NullString, *sql.NullTime:
		for initialized || rows.Next() {
			initialized = false
			db.RowsAffected++
			db.AddError(rows.Scan(dest))
		}
	default:
		var (
			fields       = make([]*schema.Field, len(columns))
			joinFields   [][]*schema.Field
			sch          = db.Statement.Schema
			reflectValue = db.Statement.ReflectValue
		)

		if reflectValue.Kind() == reflect.Interface {
			reflectValue = reflectValue.Elem()
		}

		reflectValueType := reflectValue.Type()
		switch reflectValueType.Kind() {
		case reflect.Array, reflect.Slice:
			reflectValueType = reflectValueType.Elem()
		}
		isPtr := reflectValueType.Kind() == reflect.Ptr
		if isPtr {
			reflectValueType = reflectValueType.Elem()
		}

		if sch != nil {
			if reflectValueType != sch.ModelType && reflectValueType.Kind() == reflect.Struct {
				sch, _ = schema.Parse(db.Statement.Dest, db.cacheStore, db.NamingStrategy)
			}

			if len(columns) == 1 {
				// Is Pluck
				if _, ok := reflect.New(reflectValueType).Interface().(sql.Scanner); (reflectValueType != sch.ModelType && ok) || // is scanner
					reflectValueType.Kind() != reflect.Struct || // is not struct
					sch.ModelType.ConvertibleTo(schema.TimeReflectType) { // is time
					sch = nil
				}
			}

			// Not Pluck
			if sch != nil {
				matchedFieldCount := make(map[string]int, len(columns))
				for idx, column := range columns {
					if field := sch.LookUpField(column); field != nil && field.Readable {
						fields[idx] = field
						if count, ok := matchedFieldCount[column]; ok {
							// handle duplicate fields
							for _, selectField := range sch.Fields {
								if selectField.DBName == column && selectField.Readable {
									if count == 0 {
										matchedFieldCount[column]++
										fields[idx] = selectField
										break
									}
									count--
								}
							}
						} else {
							matchedFieldCount[column] = 1
						}
					} else if names := utils.SplitNestedRelationName(column); len(names) > 1 { // has nested relation
						if rel, ok := sch.Relationships.Relations[names[0]]; ok {
							subNameCount := len(names)
							// nested relation fields
							relFields := make([]*schema.Field, 0, subNameCount-1)
							relFields = append(relFields, rel.Field)
							for _, name := range names[1 : subNameCount-1] {
								rel = rel.FieldSchema.Relationships.Relations[name]
								relFields = append(relFields, rel.Field)
							}
							// lastest name is raw dbname
							dbName := names[subNameCount-1]
							if field := rel.FieldSchema.LookUpField(dbName); field != nil && field.Readable {
								fields[idx] = field

								if len(joinFields) == 0 {
									joinFields = make([][]*schema.Field, len(columns))
								}
								relFields = append(relFields, field)
								joinFields[idx] = relFields
								continue
							}
						}
						values[idx] = &sql.RawBytes{}
					} else {
						values[idx] = &sql.RawBytes{}
					}
				}
			}
		}

		switch reflectValue.Kind() {
		case reflect.Slice, reflect.Array:
			var (
				elem        reflect.Value
				isArrayKind = reflectValue.Kind() == reflect.Array
			)

			if !update || reflectValue.Len() == 0 {
				update = false
				// if the slice cap is externally initialized, the externally initialized slice is directly used here
				if reflectValue.Cap() == 0 {
					db.Statement.ReflectValue.Set(reflect.MakeSlice(reflectValue.Type(), 0, 20))
				} else if !isArrayKind {
					reflectValue.SetLen(0)
					db.Statement.ReflectValue.Set(reflectValue)
				}
			}

			for initialized || rows.Next() {
			BEGIN:
				initialized = false

				if update {
					if int(db.RowsAffected) >= reflectValue.Len() {
						return
					}
					elem = reflectValue.Index(int(db.RowsAffected))
					if onConflictDonothing {
						for _, field := range fields {
							if _, ok := field.ValueOf(db.Statement.Context, elem); !ok {
								db.RowsAffected++
								goto BEGIN
							}
						}
					}
				} else {
					elem = reflect.New(reflectValueType)
				}

				db.scanIntoStruct(rows, elem, values, fields, joinFields)

				if !update {
					if !isPtr {
						elem = elem.Elem()
					}
					if isArrayKind {
						if reflectValue.Len() >= int(db.RowsAffected) {
							reflectValue.Index(int(db.RowsAffected - 1)).Set(elem)
						}
					} else {
						reflectValue = reflect.Append(reflectValue, elem)
					}
				}
			}

			if !update {
				db.Statement.ReflectValue.Set(reflectValue)
			}
		case reflect.Struct, reflect.Ptr:
			if initialized || rows.Next() {
				db.scanIntoStruct(rows, reflectValue, values, fields, joinFields)
			}
		default:
			db.AddError(rows.Scan(dest))
		}
	}

	if err := rows.Err(); err != nil && err != db.Error {
		db.AddError(err)
	}

	if db.RowsAffected == 0 && db.Statement.RaiseErrorOnNotFound && db.Error == nil {
		db.AddError(ErrRecordNotFound)
	}
}
