package schema_test

import (
	"reflect"
	"sync"
	"testing"

	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

type UserWithCallback struct{}

func (UserWithCallback) BeforeSave(*gorm.DB) error {
	return nil
}

func (UserWithCallback) AfterCreate(*gorm.DB) error {
	return nil
}

func TestCallback(t *testing.T) {
	user, err := schema.Parse(&UserWithCallback{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse user with callback, got error %v", err)
	}

	for _, str := range []string{"BeforeSave", "AfterCreate"} {
		if !reflect.Indirect(reflect.ValueOf(user)).FieldByName(str).Interface().(bool) {
			t.Errorf("%v should be true", str)
		}
	}

	for _, str := range []string{"BeforeCreate", "BeforeUpdate", "AfterUpdate", "AfterSave", "BeforeDelete", "AfterDelete", "AfterFind"} {
		if reflect.Indirect(reflect.ValueOf(user)).FieldByName(str).Interface().(bool) {
			t.Errorf("%v should be false", str)
		}
	}
}
