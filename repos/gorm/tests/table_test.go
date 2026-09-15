package tests_test

import (
	"regexp"
	"testing"

	"gorm.io/gorm"
	"gorm.io/gorm/schema"
	"gorm.io/gorm/utils/tests"
	. "gorm.io/gorm/utils/tests"
)

type UserWithTable struct {
	gorm.Model
	Name string
}

func (UserWithTable) TableName() string {
	return "gorm.user"
}

func TestTable(t *testing.T) {
	dryDB := DB.Session(&gorm.Session{DryRun: true})

	r := dryDB.Table("`user`").Find(&User{}).Statement
	if !regexp.MustCompile("SELECT \\* FROM `user`").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Table("user as u").Select("name").Find(&User{}).Statement
	if !regexp.MustCompile("SELECT .name. FROM user as u WHERE .u.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Table("`people`").Table("`user`").Find(&User{}).Statement
	if !regexp.MustCompile("SELECT \\* FROM `user`").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Table("people as p").Table("user as u").Find(&User{}).Statement
	if !regexp.MustCompile("SELECT \\* FROM user as u WHERE .u.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Table("people as p").Table("user").Find(&User{}).Statement
	if !regexp.MustCompile("SELECT \\* FROM .user. WHERE .user.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Table("gorm.people").Table("user").Find(&User{}).Statement
	if !regexp.MustCompile("SELECT \\* FROM .user. WHERE .user.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Table("gorm.user").Select("name").Find(&User{}).Statement
	if !regexp.MustCompile("SELECT .name. FROM .gorm.\\..user. WHERE .user.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Select("name").Find(&UserWithTable{}).Statement
	if !regexp.MustCompile("SELECT .name. FROM .gorm.\\..user. WHERE .user.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Create(&UserWithTable{}).Statement
	if DB.Dialector.Name() != "sqlite" {
		if !regexp.MustCompile(`INSERT INTO .gorm.\..user. (.*name.*) VALUES (.*)`).MatchString(r.Statement.SQL.String()) {
			t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
		}
	} else {
		if !regexp.MustCompile(`INSERT INTO .user. (.*name.*) VALUES (.*)`).MatchString(r.Statement.SQL.String()) {
			t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
		}
	}

	r = dryDB.Table("(?) as u", DB.Model(&User{}).Select("name")).Find(&User{}).Statement
	if !regexp.MustCompile("SELECT \\* FROM \\(SELECT .name. FROM .users. WHERE .users.\\..deleted_at. IS NULL\\) as u WHERE .u.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Table("(?) as u, (?) as p", DB.Model(&User{}).Select("name"), DB.Model(&Pet{}).Select("name")).Find(&User{}).Statement
	if !regexp.MustCompile("SELECT \\* FROM \\(SELECT .name. FROM .users. WHERE .users.\\..deleted_at. IS NULL\\) as u, \\(SELECT .name. FROM .pets. WHERE .pets.\\..deleted_at. IS NULL\\) as p WHERE .u.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Where("name = ?", 1).Table("(?) as u, (?) as p", DB.Model(&User{}).Select("name").Where("name = ?", 2), DB.Model(&Pet{}).Where("name = ?", 4).Select("name")).Where("name = ?", 3).Find(&User{}).Statement
	if !regexp.MustCompile("SELECT \\* FROM \\(SELECT .name. FROM .users. WHERE name = .+ AND .users.\\..deleted_at. IS NULL\\) as u, \\(SELECT .name. FROM .pets. WHERE name = .+ AND .pets.\\..deleted_at. IS NULL\\) as p WHERE name = .+ AND name = .+ AND .u.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	AssertEqual(t, r.Statement.Vars, []interface{}{2, 4, 1, 3})
}

func TestTableWithAllFields(t *testing.T) {
	dryDB := DB.Session(&gorm.Session{DryRun: true, QueryFields: true})
	userQuery := "SELECT .*user.*id.*user.*created_at.*user.*updated_at.*user.*deleted_at.*user.*name.*user.*age" +
		".*user.*birthday.*user.*company_id.*user.*manager_id.*user.*active.* "

	r := dryDB.Table("`user`").Find(&User{}).Statement
	if !regexp.MustCompile(userQuery + "FROM `user`").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Table("user as u").Select("name").Find(&User{}).Statement
	if !regexp.MustCompile("SELECT .name. FROM user as u WHERE .u.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Table("gorm.user").Select("name").Find(&User{}).Statement
	if !regexp.MustCompile("SELECT .name. FROM .gorm.\\..user. WHERE .user.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Select("name").Find(&UserWithTable{}).Statement
	if !regexp.MustCompile("SELECT .name. FROM .gorm.\\..user. WHERE .user.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Create(&UserWithTable{}).Statement
	if DB.Dialector.Name() != "sqlite" {
		if !regexp.MustCompile(`INSERT INTO .gorm.\..user. (.*name.*) VALUES (.*)`).MatchString(r.Statement.SQL.String()) {
			t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
		}
	} else {
		if !regexp.MustCompile(`INSERT INTO .user. (.*name.*) VALUES (.*)`).MatchString(r.Statement.SQL.String()) {
			t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
		}
	}

	userQueryCharacter := "SELECT .*u.*id.*u.*created_at.*u.*updated_at.*u.*deleted_at.*u.*name.*u.*age.*u.*birthday" +
		".*u.*company_id.*u.*manager_id.*u.*active.* "

	r = dryDB.Table("(?) as u", DB.Model(&User{}).Select("name")).Find(&User{}).Statement
	if !regexp.MustCompile(userQueryCharacter + "FROM \\(SELECT .name. FROM .users. WHERE .users.\\..deleted_at. IS NULL\\) as u WHERE .u.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Table("(?) as u, (?) as p", DB.Model(&User{}).Select("name"), DB.Model(&Pet{}).Select("name")).Find(&User{}).Statement
	if !regexp.MustCompile(userQueryCharacter + "FROM \\(SELECT .name. FROM .users. WHERE .users.\\..deleted_at. IS NULL\\) as u, \\(SELECT .name. FROM .pets. WHERE .pets.\\..deleted_at. IS NULL\\) as p WHERE .u.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	r = dryDB.Where("name = ?", 1).Table("(?) as u, (?) as p", DB.Model(&User{}).Select("name").Where("name = ?", 2), DB.Model(&Pet{}).Where("name = ?", 4).Select("name")).Where("name = ?", 3).Find(&User{}).Statement
	if !regexp.MustCompile(userQueryCharacter + "FROM \\(SELECT .name. FROM .users. WHERE name = .+ AND .users.\\..deleted_at. IS NULL\\) as u, \\(SELECT .name. FROM .pets. WHERE name = .+ AND .pets.\\..deleted_at. IS NULL\\) as p WHERE name = .+ AND name = .+ AND .u.\\..deleted_at. IS NULL").MatchString(r.Statement.SQL.String()) {
		t.Errorf("Table with escape character, got %v", r.Statement.SQL.String())
	}

	AssertEqual(t, r.Statement.Vars, []interface{}{2, 4, 1, 3})
}

type UserWithTableNamer struct {
	gorm.Model
	Name string
}

func (UserWithTableNamer) TableName(namer schema.Namer) string {
	return namer.TableName("user")
}

func TestTableWithNamer(t *testing.T) {
	db, _ := gorm.Open(tests.DummyDialector{}, &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix: "t_",
		},
	})

	sql := db.ToSQL(func(tx *gorm.DB) *gorm.DB {
		return tx.Model(&UserWithTableNamer{}).Find(&UserWithTableNamer{})
	})

	if !regexp.MustCompile("SELECT \\* FROM `t_users`").MatchString(sql) {
		t.Errorf("Table with namer, got %v", sql)
	}
}
