package tests_test

import (
	"testing"

	"gorm.io/driver/mysql"

	"gorm.io/gorm"
)

func TestOpen(t *testing.T) {
	dsn := "gorm:gorm@tcp(localhost:9910)/gorm?loc=Asia%2FHongKong" // invalid loc
	_, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err == nil {
		t.Fatalf("should returns error but got nil")
	}
}

func TestReturningWithNullToZeroValues(t *testing.T) {
	dialect := DB.Dialector.Name()
	switch dialect {
	case "mysql", "sqlserver":
		// these dialects do not support the "returning" clause
		return
	default:
		// This user struct will leverage the existing users table, but override
		// the Name field to default to null.
		type user struct {
			gorm.Model
			Name string `gorm:"default:null"`
		}
		u1 := user{}

		if results := DB.Create(&u1); results.Error != nil {
			t.Fatalf("errors happened on create: %v", results.Error)
		} else if results.RowsAffected != 1 {
			t.Fatalf("rows affected expects: %v, got %v", 1, results.RowsAffected)
		} else if u1.ID == 0 {
			t.Fatalf("ID expects : not equal 0, got %v", u1.ID)
		}

		got := user{}
		results := DB.First(&got, "id = ?", u1.ID)
		if results.Error != nil {
			t.Fatalf("errors happened on first: %v", results.Error)
		} else if results.RowsAffected != 1 {
			t.Fatalf("rows affected expects: %v, got %v", 1, results.RowsAffected)
		} else if got.ID != u1.ID {
			t.Fatalf("first expects: %v, got %v", u1, got)
		}

		results = DB.Select("id, name").Find(&got)
		if results.Error != nil {
			t.Fatalf("errors happened on first: %v", results.Error)
		} else if results.RowsAffected != 1 {
			t.Fatalf("rows affected expects: %v, got %v", 1, results.RowsAffected)
		} else if got.ID != u1.ID {
			t.Fatalf("select expects: %v, got %v", u1, got)
		}

		u1.Name = "jinzhu"
		if results := DB.Save(&u1); results.Error != nil {
			t.Fatalf("errors happened on update: %v", results.Error)
		} else if results.RowsAffected != 1 {
			t.Fatalf("rows affected expects: %v, got %v", 1, results.RowsAffected)
		}

		u1 = user{} // important to reinitialize this before creating it again
		u2 := user{}
		db := DB.Session(&gorm.Session{CreateBatchSize: 10})

		if results := db.Create([]*user{&u1, &u2}); results.Error != nil {
			t.Fatalf("errors happened on create: %v", results.Error)
		} else if results.RowsAffected != 2 {
			t.Fatalf("rows affected expects: %v, got %v", 1, results.RowsAffected)
		} else if u1.ID == 0 {
			t.Fatalf("ID expects : not equal 0, got %v", u1.ID)
		} else if u2.ID == 0 {
			t.Fatalf("ID expects : not equal 0, got %v", u2.ID)
		}

		var gotUsers []user
		results = DB.Where("id in (?, ?)", u1.ID, u2.ID).Order("id asc").Select("id, name").Find(&gotUsers)
		if results.Error != nil {
			t.Fatalf("errors happened on first: %v", results.Error)
		} else if results.RowsAffected != 2 {
			t.Fatalf("rows affected expects: %v, got %v", 2, results.RowsAffected)
		} else if gotUsers[0].ID != u1.ID {
			t.Fatalf("select expects: %v, got %v", u1.ID, gotUsers[0].ID)
		} else if gotUsers[1].ID != u2.ID {
			t.Fatalf("select expects: %v, got %v", u2.ID, gotUsers[1].ID)
		}

		u1.Name = "Jinzhu"
		u2.Name = "Zhang"
		if results := DB.Save([]*user{&u1, &u2}); results.Error != nil {
			t.Fatalf("errors happened on update: %v", results.Error)
		} else if results.RowsAffected != 2 {
			t.Fatalf("rows affected expects: %v, got %v", 1, results.RowsAffected)
		}

	}
}
