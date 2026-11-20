package tests_test

import (
	"database/sql"
	"errors"
	"testing"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

func TestNamedArg(t *testing.T) {
	type NamedUser struct {
		gorm.Model
		Name1 string
		Name2 string
		Name3 string
	}

	DB.Migrator().DropTable(&NamedUser{})
	DB.AutoMigrate(&NamedUser{})

	namedUser := NamedUser{Name1: "jinzhu1", Name2: "jinzhu2", Name3: "jinzhu3"}
	DB.Create(&namedUser)

	var result NamedUser
	DB.First(&result, "name1 = @name OR name2 = @name OR name3 = @name", sql.Named("name", "jinzhu2"))

	AssertEqual(t, result, namedUser)

	var result2 NamedUser
	DB.Where("name1 = @name OR name2 = @name OR name3 = @name", sql.Named("name", "jinzhu2")).First(&result2)

	AssertEqual(t, result2, namedUser)

	var result3 NamedUser
	DB.Where("name1 = @name OR name2 = @name OR name3 = @name", map[string]interface{}{"name": "jinzhu2"}).First(&result3)

	AssertEqual(t, result3, namedUser)

	var result4 NamedUser
	if err := DB.Raw("SELECT * FROM named_users WHERE name1 = @name OR name2 = @name2 OR name3 = @name", sql.Named("name", "jinzhu-none"), sql.Named("name2", "jinzhu2")).Find(&result4).Error; err != nil {
		t.Errorf("failed to update with named arg")
	}

	AssertEqual(t, result4, namedUser)

	if err := DB.Exec("UPDATE named_users SET name1 = @name, name2 = @name2, name3 = @name", sql.Named("name", "jinzhu-new"), sql.Named("name2", "jinzhu-new2")).Error; err != nil {
		t.Errorf("failed to update with named arg")
	}

	namedUser.Name1 = "jinzhu-new"
	namedUser.Name2 = "jinzhu-new2"
	namedUser.Name3 = "jinzhu-new"

	var result5 NamedUser
	if err := DB.Raw("SELECT * FROM named_users WHERE (name1 = @name AND name3 = @name) AND name2 = @name2", map[string]interface{}{"name": "jinzhu-new", "name2": "jinzhu-new2"}).Find(&result5).Error; err != nil {
		t.Errorf("failed to update with named arg")
	}

	AssertEqual(t, result5, namedUser)

	var result6 NamedUser
	if err := DB.Raw(`SELECT * FROM named_users WHERE (name1 = @name
	AND name3 = @name) AND name2 = @name2`, map[string]interface{}{"name": "jinzhu-new", "name2": "jinzhu-new2"}).Find(&result6).Error; err != nil {
		t.Errorf("failed to update with named arg")
	}

	AssertEqual(t, result6, namedUser)

	var result7 NamedUser
	if err := DB.Where("name1 = @name OR name2 = @name", sql.Named("name", "jinzhu-new")).Where("name3 = 'jinzhu-new3'").First(&result7).Error; err == nil || !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Errorf("should return record not found error, but got %v", err)
	}

	DB.Delete(&namedUser)

	var result8 NamedUser
	if err := DB.Where("name1 = @name OR name2 = @name", map[string]interface{}{"name": "jinzhu-new"}).First(&result8).Error; err == nil || !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Errorf("should return record not found error, but got %v", err)
	}
}
