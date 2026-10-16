package tests_test

import (
	"testing"

	. "gorm.io/gorm/utils/tests"
)

func TestExceptionsWithInvalidSql(t *testing.T) {
	if name := DB.Dialector.Name(); name == "sqlserver" {
		t.Skip("skip sqlserver due to it will raise data race for invalid sql")
	}

	var columns []string
	if DB.Where("sdsd.zaaa = ?", "sd;;;aa").Pluck("aaa", &columns).Error == nil {
		t.Errorf("Should got error with invalid SQL")
	}

	if DB.Model(&User{}).Where("sdsd.zaaa = ?", "sd;;;aa").Pluck("aaa", &columns).Error == nil {
		t.Errorf("Should got error with invalid SQL")
	}

	if DB.Where("sdsd.zaaa = ?", "sd;;;aa").Find(&User{}).Error == nil {
		t.Errorf("Should got error with invalid SQL")
	}

	var count1, count2 int64
	DB.Model(&User{}).Count(&count1)
	if count1 <= 0 {
		t.Errorf("Should find some users")
	}

	if DB.Where("name = ?", "jinzhu; delete * from users").First(&User{}).Error == nil {
		t.Errorf("Should got error with invalid SQL")
	}

	DB.Model(&User{}).Count(&count2)
	if count1 != count2 {
		t.Errorf("No user should not be deleted by invalid SQL")
	}
}

func TestSetAndGet(t *testing.T) {
	if value, ok := DB.Set("hello", "world").Get("hello"); !ok {
		t.Errorf("Should be able to get setting after set")
	} else if value.(string) != "world" {
		t.Errorf("Set value should not be changed")
	}

	if _, ok := DB.Get("non_existing"); ok {
		t.Errorf("Get non existing key should return error")
	}
}
