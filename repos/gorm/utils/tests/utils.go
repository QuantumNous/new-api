package tests

import (
	"database/sql/driver"
	"fmt"
	"go/ast"
	"reflect"
	"testing"
	"time"

	"gorm.io/gorm/utils"
)

func AssertObjEqual(t *testing.T, r, e interface{}, names ...string) {
	for _, name := range names {
		rv := reflect.Indirect(reflect.ValueOf(r))
		ev := reflect.Indirect(reflect.ValueOf(e))
		if rv.IsValid() != ev.IsValid() {
			t.Errorf("%v: expect: %+v, got %+v", utils.FileWithLineNum(), r, e)
			return
		}
		got := rv.FieldByName(name).Interface()
		expect := ev.FieldByName(name).Interface()
		t.Run(name, func(t *testing.T) {
			AssertEqual(t, got, expect)
		})
	}
}

func AssertEqual(t *testing.T, got, expect interface{}) {
	if !reflect.DeepEqual(got, expect) {
		isEqual := func() {
			if curTime, ok := got.(time.Time); ok {
				format := "2006-01-02T15:04:05Z07:00"

				if curTime.Round(time.Second).UTC().Format(format) != expect.(time.Time).Round(time.Second).UTC().Format(format) && curTime.Truncate(time.Second).UTC().Format(format) != expect.(time.Time).Truncate(time.Second).UTC().Format(format) {
					t.Errorf("%v: expect: %v, got %v after time round", utils.FileWithLineNum(), expect.(time.Time), curTime)
				}
			} else if fmt.Sprint(got) != fmt.Sprint(expect) {
				t.Errorf("%v: expect: %#v, got %#v", utils.FileWithLineNum(), expect, got)
			}
		}

		if fmt.Sprint(got) == fmt.Sprint(expect) {
			return
		}

		if reflect.Indirect(reflect.ValueOf(got)).IsValid() != reflect.Indirect(reflect.ValueOf(expect)).IsValid() {
			t.Errorf("%v: expect: %+v, got %+v", utils.FileWithLineNum(), expect, got)
			return
		}

		if valuer, ok := got.(driver.Valuer); ok {
			got, _ = valuer.Value()
		}

		if valuer, ok := expect.(driver.Valuer); ok {
			expect, _ = valuer.Value()
		}

		if got != nil {
			got = reflect.Indirect(reflect.ValueOf(got)).Interface()
		}

		if expect != nil {
			expect = reflect.Indirect(reflect.ValueOf(expect)).Interface()
		}

		if reflect.ValueOf(got).IsValid() != reflect.ValueOf(expect).IsValid() {
			t.Errorf("%v: expect: %+v, got %+v", utils.FileWithLineNum(), expect, got)
			return
		}

		if reflect.ValueOf(got).Kind() == reflect.Slice {
			if reflect.ValueOf(expect).Kind() == reflect.Slice {
				if reflect.ValueOf(got).Len() == reflect.ValueOf(expect).Len() {
					for i := 0; i < reflect.ValueOf(got).Len(); i++ {
						name := fmt.Sprintf(reflect.ValueOf(got).Type().Name()+" #%v", i)
						t.Run(name, func(t *testing.T) {
							AssertEqual(t, reflect.ValueOf(got).Index(i).Interface(), reflect.ValueOf(expect).Index(i).Interface())
						})
					}
				} else {
					name := reflect.ValueOf(got).Type().Elem().Name()
					t.Errorf("%v expects length: %v, got %v (expects: %+v, got %+v)", name, reflect.ValueOf(expect).Len(), reflect.ValueOf(got).Len(), expect, got)
				}
				return
			}
		}

		if reflect.ValueOf(got).Kind() == reflect.Struct {
			if reflect.ValueOf(expect).Kind() == reflect.Struct {
				if reflect.ValueOf(got).NumField() == reflect.ValueOf(expect).NumField() {
					exported := false
					for i := 0; i < reflect.ValueOf(got).NumField(); i++ {
						if fieldStruct := reflect.ValueOf(got).Type().Field(i); ast.IsExported(fieldStruct.Name) {
							exported = true
							field := reflect.ValueOf(got).Field(i)
							t.Run(fieldStruct.Name, func(t *testing.T) {
								AssertEqual(t, field.Interface(), reflect.ValueOf(expect).Field(i).Interface())
							})
						}
					}

					if exported {
						return
					}
				}
			}
		}

		if reflect.ValueOf(got).Type().ConvertibleTo(reflect.ValueOf(expect).Type()) {
			got = reflect.ValueOf(got).Convert(reflect.ValueOf(expect).Type()).Interface()
			isEqual()
		} else if reflect.ValueOf(expect).Type().ConvertibleTo(reflect.ValueOf(got).Type()) {
			expect = reflect.ValueOf(got).Convert(reflect.ValueOf(got).Type()).Interface()
			isEqual()
		} else {
			t.Errorf("%v: expect: %+v, got %+v", utils.FileWithLineNum(), expect, got)
			return
		}
	}
}

func Now() *time.Time {
	now := time.Now()
	return &now
}
