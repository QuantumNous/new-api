package callbacks

import (
	"reflect"
	"sort"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ConvertMapToValuesForCreate convert map to values
func ConvertMapToValuesForCreate(stmt *gorm.Statement, mapValue map[string]interface{}) (values clause.Values) {
	values.Columns = make([]clause.Column, 0, len(mapValue))
	selectColumns, restricted := stmt.SelectAndOmitColumns(true, false)

	keys := make([]string, 0, len(mapValue))
	for k := range mapValue {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		value := mapValue[k]
		if stmt.Schema != nil {
			if field := stmt.Schema.LookUpField(k); field != nil {
				k = field.DBName
			}
		}

		if v, ok := selectColumns[k]; (ok && v) || (!ok && !restricted) {
			values.Columns = append(values.Columns, clause.Column{Name: k})
			if len(values.Values) == 0 {
				values.Values = [][]interface{}{{}}
			}

			values.Values[0] = append(values.Values[0], value)
		}
	}
	return
}

// ConvertSliceOfMapToValuesForCreate convert slice of map to values
func ConvertSliceOfMapToValuesForCreate(stmt *gorm.Statement, mapValues []map[string]interface{}) (values clause.Values) {
	columns := make([]string, 0, len(mapValues))

	// when the length of mapValues is zero,return directly here
	// no need to call stmt.SelectAndOmitColumns method
	if len(mapValues) == 0 {
		stmt.AddError(gorm.ErrEmptySlice)
		return
	}

	var (
		result                    = make(map[string][]interface{}, len(mapValues))
		selectColumns, restricted = stmt.SelectAndOmitColumns(true, false)
	)

	for idx, mapValue := range mapValues {
		for k, v := range mapValue {
			if stmt.Schema != nil {
				if field := stmt.Schema.LookUpField(k); field != nil {
					k = field.DBName
				}
			}

			if _, ok := result[k]; !ok {
				if v, ok := selectColumns[k]; (ok && v) || (!ok && !restricted) {
					result[k] = make([]interface{}, len(mapValues))
					columns = append(columns, k)
				} else {
					continue
				}
			}

			result[k][idx] = v
		}
	}

	sort.Strings(columns)
	values.Values = make([][]interface{}, len(mapValues))
	values.Columns = make([]clause.Column, len(columns))
	for idx, column := range columns {
		values.Columns[idx] = clause.Column{Name: column}

		for i, v := range result[column] {
			if len(values.Values[i]) == 0 {
				values.Values[i] = make([]interface{}, len(columns))
			}

			values.Values[i][idx] = v
		}
	}
	return
}

func hasReturning(tx *gorm.DB, supportReturning bool) (bool, gorm.ScanMode) {
	if supportReturning {
		if c, ok := tx.Statement.Clauses["RETURNING"]; ok {
			returning, _ := c.Expression.(clause.Returning)
			if len(returning.Columns) == 0 || (len(returning.Columns) == 1 && returning.Columns[0].Name == "*") {
				return true, 0
			}
			return true, gorm.ScanUpdate
		}
	}
	return false, 0
}

func checkMissingWhereConditions(db *gorm.DB) {
	if !db.AllowGlobalUpdate && db.Error == nil {
		where, withCondition := db.Statement.Clauses["WHERE"]
		if withCondition {
			if _, withSoftDelete := db.Statement.Clauses["soft_delete_enabled"]; withSoftDelete {
				whereClause, _ := where.Expression.(clause.Where)
				withCondition = len(whereClause.Exprs) > 1
			}
		}
		if !withCondition {
			db.AddError(gorm.ErrMissingWhereClause)
		}
		return
	}
}

type visitMap = map[reflect.Value]bool

// Check if circular values, return true if loaded
func loadOrStoreVisitMap(visitMap *visitMap, v reflect.Value) (loaded bool) {
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}

	switch v.Kind() {
	case reflect.Slice, reflect.Array:
		loaded = true
		for i := 0; i < v.Len(); i++ {
			if !loadOrStoreVisitMap(visitMap, v.Index(i)) {
				loaded = false
			}
		}
	case reflect.Struct, reflect.Interface:
		if v.CanAddr() {
			p := v.Addr()
			if _, ok := (*visitMap)[p]; ok {
				return true
			}
			(*visitMap)[p] = true
		}
	}

	return
}
