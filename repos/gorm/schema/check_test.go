package schema_test

import (
	"reflect"
	"sync"
	"testing"

	"gorm.io/gorm/schema"
)

type UserCheck struct {
	Name  string `gorm:"check:name_checker,name <> 'jinzhu'"`
	Name2 string `gorm:"check:name <> 'jinzhu'"`
	Name3 string `gorm:"check:,name <> 'jinzhu'"`
}

func TestParseCheck(t *testing.T) {
	user, err := schema.Parse(&UserCheck{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse user check, got error %v", err)
	}

	results := map[string]schema.Check{
		"name_checker": {
			Name:       "name_checker",
			Constraint: "name <> 'jinzhu'",
		},
		"chk_user_checks_name2": {
			Name:       "chk_user_checks_name2",
			Constraint: "name <> 'jinzhu'",
		},
		"chk_user_checks_name3": {
			Name:       "chk_user_checks_name3",
			Constraint: "name <> 'jinzhu'",
		},
	}

	checks := user.ParseCheckConstraints()

	for k, result := range results {
		v, ok := checks[k]
		if !ok {
			t.Errorf("Failed to found check %v from parsed checks %+v", k, checks)
		}

		for _, name := range []string{"Name", "Constraint"} {
			if reflect.ValueOf(result).FieldByName(name).Interface() != reflect.ValueOf(v).FieldByName(name).Interface() {
				t.Errorf(
					"check %v %v should equal, expects %v, got %v",
					k, name, reflect.ValueOf(result).FieldByName(name).Interface(), reflect.ValueOf(v).FieldByName(name).Interface(),
				)
			}
		}
	}
}
