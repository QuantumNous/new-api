package tests_test

import (
	"fmt"
	"testing"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func TestWithSingleConnection(t *testing.T) {
	expectedName := "test"
	var actualName string

	setSQL, getSQL := getSetSQL(DB.Dialector.Name())
	if len(setSQL) == 0 || len(getSQL) == 0 {
		return
	}

	err := DB.Connection(func(tx *gorm.DB) error {
		if err := tx.Exec(setSQL, expectedName).Error; err != nil {
			return err
		}

		if err := tx.Raw(getSQL).Scan(&actualName).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		t.Errorf(fmt.Sprintf("WithSingleConnection should work, but got err %v", err))
	}

	if actualName != expectedName {
		t.Errorf("WithSingleConnection() method should get correct value, expect: %v, got %v", expectedName, actualName)
	}
}

func getSetSQL(driverName string) (string, string) {
	switch driverName {
	case mysql.Dialector{}.Name():
		return "SET @testName := ?", "SELECT @testName"
	default:
		return "", ""
	}
}
