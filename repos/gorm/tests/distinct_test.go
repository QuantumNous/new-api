package tests_test

import (
	"regexp"
	"testing"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

func TestDistinct(t *testing.T) {
	users := []User{
		*GetUser("distinct", Config{}),
		*GetUser("distinct", Config{}),
		*GetUser("distinct", Config{}),
		*GetUser("distinct-2", Config{}),
		*GetUser("distinct-3", Config{}),
	}
	users[0].Age = 20

	if err := DB.Create(&users).Error; err != nil {
		t.Fatalf("errors happened when create users: %v", err)
	}

	var names []string
	DB.Table("users").Where("name like ?", "distinct%").Order("name").Pluck("name", &names)
	AssertEqual(t, names, []string{"distinct", "distinct", "distinct", "distinct-2", "distinct-3"})

	var names1 []string
	DB.Model(&User{}).Where("name like ?", "distinct%").Distinct().Order("name").Pluck("Name", &names1)

	AssertEqual(t, names1, []string{"distinct", "distinct-2", "distinct-3"})

	var names2 []string
	DB.Scopes(func(db *gorm.DB) *gorm.DB {
		return db.Table("users")
	}).Where("name like ?", "distinct%").Order("name").Pluck("name", &names2)
	AssertEqual(t, names2, []string{"distinct", "distinct", "distinct", "distinct-2", "distinct-3"})

	var results []User
	if err := DB.Distinct("name", "age").Where("name like ?", "distinct%").Order("name, age desc").Find(&results).Error; err != nil {
		t.Errorf("failed to query users, got error: %v", err)
	}

	expects := []User{
		{Name: "distinct", Age: 20},
		{Name: "distinct", Age: 18},
		{Name: "distinct-2", Age: 18},
		{Name: "distinct-3", Age: 18},
	}

	if len(results) != 4 {
		t.Fatalf("invalid results length found, expects: %v, got %v", len(expects), len(results))
	}

	for idx, expect := range expects {
		AssertObjEqual(t, results[idx], expect, "Name", "Age")
	}

	var count int64
	if err := DB.Model(&User{}).Where("name like ?", "distinct%").Count(&count).Error; err != nil || count != 5 {
		t.Errorf("failed to query users count, got error: %v, count: %v", err, count)
	}

	if err := DB.Model(&User{}).Distinct("name").Where("name like ?", "distinct%").Count(&count).Error; err != nil || count != 3 {
		t.Errorf("failed to query users count, got error: %v, count %v", err, count)
	}

	dryDB := DB.Session(&gorm.Session{DryRun: true})
	r := dryDB.Distinct("u.id, u.*").Table("user_speaks as s").Joins("inner join users as u on u.id = s.user_id").Where("s.language_code ='US' or s.language_code ='ES'").Find(&User{})
	if !regexp.MustCompile(`SELECT DISTINCT u\.id, u\.\* FROM user_speaks as s inner join users as u`).MatchString(r.Statement.SQL.String()) {
		t.Fatalf("Build Distinct with u.*, but got %v", r.Statement.SQL.String())
	}
}
