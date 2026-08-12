package logger

import (
	"database/sql/driver"
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"gorm.io/gorm/utils"
)

const (
	tmFmtWithMS = "2006-01-02 15:04:05.999"
	tmFmtZero   = "0000-00-00 00:00:00"
	nullStr     = "NULL"
)

func isPrintable(s string) bool {
	for _, r := range s {
		if !unicode.IsPrint(r) {
			return false
		}
	}
	return true
}

var convertibleTypes = []reflect.Type{reflect.TypeOf(time.Time{}), reflect.TypeOf(false), reflect.TypeOf([]byte{})}

var numericPlaceholderRe = regexp.MustCompile(`\$\d+\$`)

// ExplainSQL generate SQL string with given parameters, the generated SQL is expected to be used in logger, execute it might introduce a SQL injection vulnerability
func ExplainSQL(sql string, numericPlaceholder *regexp.Regexp, escaper string, avars ...interface{}) string {
	var (
		convertParams func(interface{}, int)
		vars          = make([]string, len(avars))
	)

	convertParams = func(v interface{}, idx int) {
		switch v := v.(type) {
		case bool:
			vars[idx] = strconv.FormatBool(v)
		case time.Time:
			if v.IsZero() {
				vars[idx] = escaper + tmFmtZero + escaper
			} else {
				vars[idx] = escaper + v.Format(tmFmtWithMS) + escaper
			}
		case *time.Time:
			if v != nil {
				if v.IsZero() {
					vars[idx] = escaper + tmFmtZero + escaper
				} else {
					vars[idx] = escaper + v.Format(tmFmtWithMS) + escaper
				}
			} else {
				vars[idx] = nullStr
			}
		case driver.Valuer:
			reflectValue := reflect.ValueOf(v)
			if v != nil && reflectValue.IsValid() && ((reflectValue.Kind() == reflect.Ptr && !reflectValue.IsNil()) || reflectValue.Kind() != reflect.Ptr) {
				r, _ := v.Value()
				convertParams(r, idx)
			} else {
				vars[idx] = nullStr
			}
		case fmt.Stringer:
			reflectValue := reflect.ValueOf(v)
			switch reflectValue.Kind() {
			case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
				vars[idx] = fmt.Sprintf("%d", reflectValue.Interface())
			case reflect.Float32, reflect.Float64:
				vars[idx] = fmt.Sprintf("%.6f", reflectValue.Interface())
			case reflect.Bool:
				vars[idx] = fmt.Sprintf("%t", reflectValue.Interface())
			case reflect.String:
				vars[idx] = escaper + strings.ReplaceAll(fmt.Sprintf("%v", v), escaper, "\\"+escaper) + escaper
			default:
				if v != nil && reflectValue.IsValid() && ((reflectValue.Kind() == reflect.Ptr && !reflectValue.IsNil()) || reflectValue.Kind() != reflect.Ptr) {
					vars[idx] = escaper + strings.ReplaceAll(fmt.Sprintf("%v", v), escaper, "\\"+escaper) + escaper
				} else {
					vars[idx] = nullStr
				}
			}
		case []byte:
			if s := string(v); isPrintable(s) {
				vars[idx] = escaper + strings.ReplaceAll(s, escaper, "\\"+escaper) + escaper
			} else {
				vars[idx] = escaper + "<binary>" + escaper
			}
		case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
			vars[idx] = utils.ToString(v)
		case float64, float32:
			vars[idx] = fmt.Sprintf("%.6f", v)
		case string:
			vars[idx] = escaper + strings.ReplaceAll(v, escaper, "\\"+escaper) + escaper
		default:
			rv := reflect.ValueOf(v)
			if v == nil || !rv.IsValid() || rv.Kind() == reflect.Ptr && rv.IsNil() {
				vars[idx] = nullStr
			} else if valuer, ok := v.(driver.Valuer); ok {
				v, _ = valuer.Value()
				convertParams(v, idx)
			} else if rv.Kind() == reflect.Ptr && !rv.IsZero() {
				convertParams(reflect.Indirect(rv).Interface(), idx)
			} else {
				for _, t := range convertibleTypes {
					if rv.Type().ConvertibleTo(t) {
						convertParams(rv.Convert(t).Interface(), idx)
						return
					}
				}
				vars[idx] = escaper + strings.ReplaceAll(fmt.Sprint(v), escaper, "\\"+escaper) + escaper
			}
		}
	}

	for idx, v := range avars {
		convertParams(v, idx)
	}

	if numericPlaceholder == nil {
		var idx int
		var newSQL strings.Builder

		for _, v := range []byte(sql) {
			if v == '?' {
				if len(vars) > idx {
					newSQL.WriteString(vars[idx])
					idx++
					continue
				}
			}
			newSQL.WriteByte(v)
		}

		sql = newSQL.String()
	} else {
		sql = numericPlaceholder.ReplaceAllString(sql, "$$$1$$")

		sql = numericPlaceholderRe.ReplaceAllStringFunc(sql, func(v string) string {
			num := v[1 : len(v)-1]
			n, _ := strconv.Atoi(num)

			// position var start from 1 ($1, $2)
			n -= 1
			if n >= 0 && n <= len(vars)-1 {
				return vars[n]
			}
			return v
		})
	}

	return sql
}
