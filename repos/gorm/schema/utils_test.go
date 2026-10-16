package schema

import (
	"reflect"
	"testing"
)

func TestRemoveSettingFromTag(t *testing.T) {
	tags := map[string]string{
		`gorm:"before:value;column:db;after:value" other:"before:value;column:db;after:value"`:  `gorm:"before:value;after:value" other:"before:value;column:db;after:value"`,
		`gorm:"before:value;column:db;" other:"before:value;column:db;after:value"`:             `gorm:"before:value;" other:"before:value;column:db;after:value"`,
		`gorm:"before:value;column:db" other:"before:value;column:db;after:value"`:              `gorm:"before:value;" other:"before:value;column:db;after:value"`,
		`gorm:"column:db" other:"before:value;column:db;after:value"`:                           `gorm:"" other:"before:value;column:db;after:value"`,
		`gorm:"before:value;column:db ;after:value" other:"before:value;column:db;after:value"`: `gorm:"before:value;after:value" other:"before:value;column:db;after:value"`,
		`gorm:"before:value;column:db; after:value" other:"before:value;column:db;after:value"`: `gorm:"before:value; after:value" other:"before:value;column:db;after:value"`,
		`gorm:"before:value;column; after:value" other:"before:value;column:db;after:value"`:    `gorm:"before:value; after:value" other:"before:value;column:db;after:value"`,
	}

	for k, v := range tags {
		if string(removeSettingFromTag(reflect.StructTag(k), "column")) != v {
			t.Errorf("%v after removeSettingFromTag should equal %v, but got %v", k, v, removeSettingFromTag(reflect.StructTag(k), "column"))
		}
	}
}
