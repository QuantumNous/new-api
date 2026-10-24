package tests_test

import (
	"context"
	"testing"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

func NameIn1And2(d *gorm.DB) *gorm.DB {
	return d.Where("name in (?)", []string{"ScopeUser1", "ScopeUser2"})
}

func NameIn2And3(d *gorm.DB) *gorm.DB {
	return d.Where("name in (?)", []string{"ScopeUser2", "ScopeUser3"})
}

func NameIn(names []string) func(d *gorm.DB) *gorm.DB {
	return func(d *gorm.DB) *gorm.DB {
		return d.Where("name in (?)", names)
	}
}

func TestScopes(t *testing.T) {
	users := []*User{
		GetUser("ScopeUser1", Config{}),
		GetUser("ScopeUser2", Config{}),
		GetUser("ScopeUser3", Config{}),
	}

	DB.Create(&users)

	var users1, users2, users3 []User
	DB.Scopes(NameIn1And2).Find(&users1)
	if len(users1) != 2 {
		t.Errorf("Should found two users's name in 1, 2, but got %v", len(users1))
	}

	DB.Scopes(NameIn1And2, NameIn2And3).Find(&users2)
	if len(users2) != 1 {
		t.Errorf("Should found one user's name is 2, but got %v", len(users2))
	}

	DB.Scopes(NameIn([]string{users[0].Name, users[2].Name})).Find(&users3)
	if len(users3) != 2 {
		t.Errorf("Should found two users's name in 1, 3, but got %v", len(users3))
	}

	db := DB.Scopes(func(tx *gorm.DB) *gorm.DB {
		return tx.Table("custom_table")
	}).Session(&gorm.Session{})

	db.AutoMigrate(&User{})
	if db.Find(&User{}).Statement.Table != "custom_table" {
		t.Errorf("failed to call Scopes")
	}

	result := DB.Scopes(NameIn1And2, func(tx *gorm.DB) *gorm.DB {
		return tx.Session(&gorm.Session{})
	}).Find(&users1)

	if result.RowsAffected != 2 {
		t.Errorf("Should found two users's name in 1, 2, but got %v", result.RowsAffected)
	}

	var maxId int64
	userTable := func(db *gorm.DB) *gorm.DB {
		return db.WithContext(context.Background()).Table("users")
	}
	if err := DB.Scopes(userTable).Select("max(id)").Scan(&maxId).Error; err != nil {
		t.Errorf("select max(id)")
	}
}

func TestComplexScopes(t *testing.T) {
	tests := []struct {
		name     string
		queryFn  func(tx *gorm.DB) *gorm.DB
		expected string
	}{
		{
			name: "depth_1",
			queryFn: func(tx *gorm.DB) *gorm.DB {
				return tx.Scopes(
					func(d *gorm.DB) *gorm.DB { return d.Where("a = 1") },
					func(d *gorm.DB) *gorm.DB { return d.Where(d.Or("b = 2").Or("c = 3")) },
				).Find(&Language{})
			},
			expected: `SELECT * FROM "languages" WHERE a = 1 AND (b = 2 OR c = 3)`,
		}, {
			name: "depth_1_pre_cond",
			queryFn: func(tx *gorm.DB) *gorm.DB {
				return tx.Where("z = 0").Scopes(
					func(d *gorm.DB) *gorm.DB { return d.Where("a = 1") },
					func(d *gorm.DB) *gorm.DB { return d.Or(d.Where("b = 2").Or("c = 3")) },
				).Find(&Language{})
			},
			expected: `SELECT * FROM "languages" WHERE z = 0 AND a = 1 OR (b = 2 OR c = 3)`,
		}, {
			name: "depth_2",
			queryFn: func(tx *gorm.DB) *gorm.DB {
				return tx.Scopes(
					func(d *gorm.DB) *gorm.DB { return d.Model(&Language{}) },
					func(d *gorm.DB) *gorm.DB {
						return d.
							Or(d.Scopes(
								func(d *gorm.DB) *gorm.DB { return d.Where("a = 1") },
								func(d *gorm.DB) *gorm.DB { return d.Where("b = 2") },
							)).
							Or("c = 3")
					},
					func(d *gorm.DB) *gorm.DB { return d.Where("d = 4") },
				).Find(&Language{})
			},
			expected: `SELECT * FROM "languages" WHERE d = 4 OR c = 3 OR (a = 1 AND b = 2)`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assertEqualSQL(t, test.expected, DB.ToSQL(test.queryFn))
		})
	}
}
