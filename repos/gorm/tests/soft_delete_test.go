package tests_test

import (
	"database/sql"
	"encoding/json"
	"errors"
	"regexp"
	"testing"

	"github.com/jinzhu/now"
	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

func TestSoftDelete(t *testing.T) {
	user := *GetUser("SoftDelete", Config{})
	DB.Save(&user)

	var count int64
	var age uint

	if DB.Model(&User{}).Where("name = ?", user.Name).Count(&count).Error != nil || count != 1 {
		t.Errorf("Count soft deleted record, expects: %v, got: %v", 1, count)
	}

	if DB.Model(&User{}).Select("age").Where("name = ?", user.Name).Scan(&age).Error != nil || age != user.Age {
		t.Errorf("Age soft deleted record, expects: %v, got: %v", 0, age)
	}

	if err := DB.Delete(&user).Error; err != nil {
		t.Fatalf("No error should happen when soft delete user, but got %v", err)
	}

	if sql.NullTime(user.DeletedAt).Time.IsZero() {
		t.Fatalf("user's deleted at is zero")
	}

	sql := DB.Session(&gorm.Session{DryRun: true}).Delete(&user).Statement.SQL.String()
	if !regexp.MustCompile(`UPDATE .users. SET .deleted_at.=.* WHERE .users.\..id. = .* AND .users.\..deleted_at. IS NULL`).MatchString(sql) {
		t.Fatalf("invalid sql generated, got %v", sql)
	}

	sql = DB.Session(&gorm.Session{DryRun: true}).Table("user u").Select("name").Find(&User{}).Statement.SQL.String()
	if !regexp.MustCompile(`SELECT .name. FROM user u WHERE .u.\..deleted_at. IS NULL`).MatchString(sql) {
		t.Errorf("Table with escape character, got %v", sql)
	}

	if DB.First(&User{}, "name = ?", user.Name).Error == nil {
		t.Errorf("Can't find a soft deleted record")
	}

	count = 0
	if DB.Model(&User{}).Where("name = ?", user.Name).Count(&count).Error != nil || count != 0 {
		t.Errorf("Count soft deleted record, expects: %v, got: %v", 0, count)
	}

	age = 0
	if DB.Model(&User{}).Select("age").Where("name = ?", user.Name).Scan(&age).Error != nil || age != 0 {
		t.Errorf("Age soft deleted record, expects: %v, got: %v", 0, age)
	}

	if err := DB.Unscoped().First(&User{}, "name = ?", user.Name).Error; err != nil {
		t.Errorf("Should find soft deleted record with Unscoped, but got err %s", err)
	}

	count = 0
	if DB.Unscoped().Model(&User{}).Where("name = ?", user.Name).Count(&count).Error != nil || count != 1 {
		t.Errorf("Count soft deleted record, expects: %v, count: %v", 1, count)
	}

	age = 0
	if DB.Unscoped().Model(&User{}).Select("age").Where("name = ?", user.Name).Scan(&age).Error != nil || age != user.Age {
		t.Errorf("Age soft deleted record, expects: %v, got: %v", 0, age)
	}

	DB.Unscoped().Delete(&user)
	if err := DB.Unscoped().First(&User{}, "name = ?", user.Name).Error; !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Errorf("Can't find permanently deleted record")
	}
}

func TestDeletedAtUnMarshal(t *testing.T) {
	expected := &gorm.Model{}
	b, _ := json.Marshal(expected)

	result := &gorm.Model{}
	_ = json.Unmarshal(b, result)
	if result.DeletedAt != expected.DeletedAt {
		t.Errorf("Failed, result.DeletedAt: %v is not same as expected.DeletedAt: %v", result.DeletedAt, expected.DeletedAt)
	}
}

func TestDeletedAtOneOr(t *testing.T) {
	actualSQL := DB.ToSQL(func(tx *gorm.DB) *gorm.DB {
		return tx.Or("id = ?", 1).Find(&User{})
	})

	if !regexp.MustCompile(` WHERE id = 1 AND .users.\..deleted_at. IS NULL`).MatchString(actualSQL) {
		t.Fatalf("invalid sql generated, got %v", actualSQL)
	}
}

func TestSoftDeleteZeroValue(t *testing.T) {
	type SoftDeleteBook struct {
		ID        uint
		Name      string
		Pages     uint
		DeletedAt gorm.DeletedAt `gorm:"zeroValue:'1970-01-01 00:00:01'"`
	}
	DB.Migrator().DropTable(&SoftDeleteBook{})
	if err := DB.AutoMigrate(&SoftDeleteBook{}); err != nil {
		t.Fatalf("failed to auto migrate soft delete table")
	}

	book := SoftDeleteBook{Name: "jinzhu", Pages: 10}
	DB.Save(&book)

	var count int64
	if DB.Model(&SoftDeleteBook{}).Where("name = ?", book.Name).Count(&count).Error != nil || count != 1 {
		t.Errorf("Count soft deleted record, expects: %v, got: %v", 1, count)
	}

	var pages uint
	if DB.Model(&SoftDeleteBook{}).Select("pages").Where("name = ?", book.Name).Scan(&pages).Error != nil || pages != book.Pages {
		t.Errorf("Pages soft deleted record, expects: %v, got: %v", 0, pages)
	}

	if err := DB.Delete(&book).Error; err != nil {
		t.Fatalf("No error should happen when soft delete user, but got %v", err)
	}

	zeroTime, _ := now.Parse("1970-01-01 00:00:01")
	if book.DeletedAt.Time.Equal(zeroTime) {
		t.Errorf("book's deleted at should not be zero, DeletedAt: %v", book.DeletedAt)
	}

	if DB.First(&SoftDeleteBook{}, "name = ?", book.Name).Error == nil {
		t.Errorf("Can't find a soft deleted record")
	}

	count = 0
	if DB.Model(&SoftDeleteBook{}).Where("name = ?", book.Name).Count(&count).Error != nil || count != 0 {
		t.Errorf("Count soft deleted record, expects: %v, got: %v", 0, count)
	}

	pages = 0
	if err := DB.Model(&SoftDeleteBook{}).Select("pages").Where("name = ?", book.Name).Scan(&pages).Error; err != nil || pages != 0 {
		t.Fatalf("Age soft deleted record, expects: %v, got: %v, err %v", 0, pages, err)
	}

	if err := DB.Unscoped().First(&SoftDeleteBook{}, "name = ?", book.Name).Error; err != nil {
		t.Errorf("Should find soft deleted record with Unscoped, but got err %s", err)
	}

	count = 0
	if DB.Unscoped().Model(&SoftDeleteBook{}).Where("name = ?", book.Name).Count(&count).Error != nil || count != 1 {
		t.Errorf("Count soft deleted record, expects: %v, count: %v", 1, count)
	}

	pages = 0
	if DB.Unscoped().Model(&SoftDeleteBook{}).Select("pages").Where("name = ?", book.Name).Scan(&pages).Error != nil || pages != book.Pages {
		t.Errorf("Age soft deleted record, expects: %v, got: %v", 0, pages)
	}

	DB.Unscoped().Delete(&book)
	if err := DB.Unscoped().First(&SoftDeleteBook{}, "name = ?", book.Name).Error; !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Errorf("Can't find permanently deleted record")
	}
}
