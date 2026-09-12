package tests_test

import (
	"testing"

	. "gorm.io/gorm/utils/tests"
)

func TestGroupBy(t *testing.T) {
	users := []User{{
		Name:     "groupby",
		Age:      10,
		Birthday: Now(),
		Active:   true,
	}, {
		Name:     "groupby",
		Age:      20,
		Birthday: Now(),
	}, {
		Name:     "groupby",
		Age:      30,
		Birthday: Now(),
		Active:   true,
	}, {
		Name:     "groupby1",
		Age:      110,
		Birthday: Now(),
	}, {
		Name:     "groupby1",
		Age:      220,
		Birthday: Now(),
		Active:   true,
	}, {
		Name:     "groupby1",
		Age:      330,
		Birthday: Now(),
		Active:   true,
	}}

	if err := DB.Create(&users).Error; err != nil {
		t.Errorf("errors happened when create: %v", err)
	}

	var name string
	var total int
	if err := DB.Model(&User{}).Select("name, sum(age)").Where("name = ?", "groupby").Group("name").Row().Scan(&name, &total); err != nil {
		t.Errorf("no error should happen, but got %v", err)
	}

	if name != "groupby" || total != 60 {
		t.Errorf("name should be groupby, but got %v, total should be 60, but got %v", name, total)
	}

	if err := DB.Model(&User{}).Select("name, sum(age)").Where("name = ?", "groupby").Group("users.name").Row().Scan(&name, &total); err != nil {
		t.Errorf("no error should happen, but got %v", err)
	}

	if name != "groupby" || total != 60 {
		t.Errorf("name should be groupby, but got %v, total should be 60, but got %v", name, total)
	}

	if err := DB.Model(&User{}).Select("name, sum(age) as total").Where("name LIKE ?", "groupby%").Group("name").Having("name = ?", "groupby1").Row().Scan(&name, &total); err != nil {
		t.Errorf("no error should happen, but got %v", err)
	}

	if name != "groupby1" || total != 660 {
		t.Errorf("name should be groupby, but got %v, total should be 660, but got %v", name, total)
	}

	result := struct {
		Name  string
		Total int64
	}{}

	if err := DB.Model(&User{}).Select("name, sum(age) as total").Where("name LIKE ?", "groupby%").Group("name").Having("name = ?", "groupby1").Find(&result).Error; err != nil {
		t.Errorf("no error should happen, but got %v", err)
	}

	if result.Name != "groupby1" || result.Total != 660 {
		t.Errorf("name should be groupby, total should be 660, but got %+v", result)
	}

	if err := DB.Model(&User{}).Select("name, sum(age) as total").Where("name LIKE ?", "groupby%").Group("name").Having("name = ?", "groupby1").Scan(&result).Error; err != nil {
		t.Errorf("no error should happen, but got %v", err)
	}

	if result.Name != "groupby1" || result.Total != 660 {
		t.Errorf("name should be groupby, total should be 660, but got %+v", result)
	}

	var active bool
	if err := DB.Model(&User{}).Select("name, active, sum(age)").Where("name = ? and active = ?", "groupby", true).Group("name").Group("active").Row().Scan(&name, &active, &total); err != nil {
		t.Errorf("no error should happen, but got %v", err)
	}

	if name != "groupby" || active != true || total != 40 {
		t.Errorf("group by two columns, name %v, age %v, active: %v", name, total, active)
	}

	if DB.Dialector.Name() == "mysql" {
		if err := DB.Model(&User{}).Select("name, age as total").Where("name LIKE ?", "groupby%").Having("total > ?", 300).Scan(&result).Error; err != nil {
			t.Errorf("no error should happen, but got %v", err)
		}

		if result.Name != "groupby1" || result.Total != 330 {
			t.Errorf("name should be groupby, total should be 660, but got %+v", result)
		}
	}
}
