package tests_test

import (
	"database/sql"
	"fmt"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	. "gorm.io/gorm/utils/tests"
)

func TestFind(t *testing.T) {
	users := []User{
		*GetUser("find", Config{}),
		*GetUser("find", Config{}),
		*GetUser("find", Config{}),
	}

	if err := DB.Create(&users).Error; err != nil {
		t.Fatalf("errors happened when create users: %v", err)
	}

	t.Run("First", func(t *testing.T) {
		var first User
		if err := DB.Where("name = ?", "find").First(&first).Error; err != nil {
			t.Errorf("errors happened when query first: %v", err)
		} else {
			CheckUser(t, first, users[0])
		}
	})

	t.Run("Last", func(t *testing.T) {
		var last User
		if err := DB.Where("name = ?", "find").Last(&last).Error; err != nil {
			t.Errorf("errors happened when query last: %v", err)
		} else {
			CheckUser(t, last, users[2])
		}
	})

	var all []User
	if err := DB.Where("name = ?", "find").Find(&all).Error; err != nil || len(all) != 3 {
		t.Errorf("errors happened when query find: %v, length: %v", err, len(all))
	} else {
		for idx, user := range users {
			t.Run("FindAll#"+strconv.Itoa(idx+1), func(t *testing.T) {
				CheckUser(t, all[idx], user)
			})
		}
	}

	t.Run("FirstMap", func(t *testing.T) {
		first := map[string]interface{}{}
		if err := DB.Model(&User{}).Where("name = ?", "find").First(first).Error; err != nil {
			t.Errorf("errors happened when query first: %v", err)
		} else {
			for _, name := range []string{"Name", "Age", "Birthday"} {
				t.Run(name, func(t *testing.T) {
					dbName := DB.NamingStrategy.ColumnName("", name)

					switch name {
					case "Name":
						if _, ok := first[dbName].(string); !ok {
							t.Errorf("invalid data type for %v, got %#v", dbName, first[dbName])
						}
					case "Age":
						if _, ok := first[dbName].(uint); !ok {
							t.Errorf("invalid data type for %v, got %#v", dbName, first[dbName])
						}
					case "Birthday":
						if _, ok := first[dbName].(*time.Time); !ok {
							t.Errorf("invalid data type for %v, got %#v", dbName, first[dbName])
						}
					}

					reflectValue := reflect.Indirect(reflect.ValueOf(users[0]))
					AssertEqual(t, first[dbName], reflectValue.FieldByName(name).Interface())
				})
			}
		}
	})

	t.Run("FirstMapWithTable", func(t *testing.T) {
		first := map[string]interface{}{}
		if err := DB.Table("users").Where("name = ?", "find").Find(first).Error; err != nil {
			t.Errorf("errors happened when query first: %v", err)
		} else {
			for _, name := range []string{"Name", "Age", "Birthday"} {
				t.Run(name, func(t *testing.T) {
					dbName := DB.NamingStrategy.ColumnName("", name)
					resultType := reflect.ValueOf(first[dbName]).Type().Name()

					switch name {
					case "Name":
						if !strings.Contains(resultType, "string") {
							t.Errorf("invalid data type for %v, got %v %#v", dbName, resultType, first[dbName])
						}
					case "Age":
						if !strings.Contains(resultType, "int") {
							t.Errorf("invalid data type for %v, got %v %#v", dbName, resultType, first[dbName])
						}
					case "Birthday":
						if !strings.Contains(resultType, "Time") && !(DB.Dialector.Name() == "sqlite" && strings.Contains(resultType, "string")) {
							t.Errorf("invalid data type for %v, got %v %#v", dbName, resultType, first[dbName])
						}
					}

					reflectValue := reflect.Indirect(reflect.ValueOf(users[0]))
					AssertEqual(t, first[dbName], reflectValue.FieldByName(name).Interface())
				})
			}
		}
	})

	t.Run("FirstPtrMap", func(t *testing.T) {
		first := map[string]interface{}{}
		if err := DB.Model(&User{}).Where("name = ?", "find").First(&first).Error; err != nil {
			t.Errorf("errors happened when query first: %v", err)
		} else {
			for _, name := range []string{"Name", "Age", "Birthday"} {
				t.Run(name, func(t *testing.T) {
					dbName := DB.NamingStrategy.ColumnName("", name)
					reflectValue := reflect.Indirect(reflect.ValueOf(users[0]))
					AssertEqual(t, first[dbName], reflectValue.FieldByName(name).Interface())
				})
			}
		}
	})

	t.Run("FirstSliceOfMap", func(t *testing.T) {
		allMap := []map[string]interface{}{}
		if err := DB.Model(&User{}).Where("name = ?", "find").Find(&allMap).Error; err != nil {
			t.Errorf("errors happened when query find: %v", err)
		} else {
			for idx, user := range users {
				t.Run("FindAllMap#"+strconv.Itoa(idx+1), func(t *testing.T) {
					for _, name := range []string{"Name", "Age", "Birthday"} {
						t.Run(name, func(t *testing.T) {
							dbName := DB.NamingStrategy.ColumnName("", name)

							switch name {
							case "Name":
								if _, ok := allMap[idx][dbName].(string); !ok {
									t.Errorf("invalid data type for %v, got %#v", dbName, allMap[idx][dbName])
								}
							case "Age":
								if _, ok := allMap[idx][dbName].(uint); !ok {
									t.Errorf("invalid data type for %v, got %#v", dbName, allMap[idx][dbName])
								}
							case "Birthday":
								if _, ok := allMap[idx][dbName].(*time.Time); !ok {
									t.Errorf("invalid data type for %v, got %#v", dbName, allMap[idx][dbName])
								}
							}

							reflectValue := reflect.Indirect(reflect.ValueOf(user))
							AssertEqual(t, allMap[idx][dbName], reflectValue.FieldByName(name).Interface())
						})
					}
				})
			}
		}
	})

	t.Run("FindSliceOfMapWithTable", func(t *testing.T) {
		allMap := []map[string]interface{}{}
		if err := DB.Table("users").Where("name = ?", "find").Find(&allMap).Error; err != nil {
			t.Errorf("errors happened when query find: %v", err)
		} else {
			for idx, user := range users {
				t.Run("FindAllMap#"+strconv.Itoa(idx+1), func(t *testing.T) {
					for _, name := range []string{"Name", "Age", "Birthday"} {
						t.Run(name, func(t *testing.T) {
							dbName := DB.NamingStrategy.ColumnName("", name)
							resultType := reflect.ValueOf(allMap[idx][dbName]).Type().Name()

							switch name {
							case "Name":
								if !strings.Contains(resultType, "string") {
									t.Errorf("invalid data type for %v, got %v %#v", dbName, resultType, allMap[idx][dbName])
								}
							case "Age":
								if !strings.Contains(resultType, "int") {
									t.Errorf("invalid data type for %v, got %v %#v", dbName, resultType, allMap[idx][dbName])
								}
							case "Birthday":
								if !strings.Contains(resultType, "Time") && !(DB.Dialector.Name() == "sqlite" && strings.Contains(resultType, "string")) {
									t.Errorf("invalid data type for %v, got %v %#v", dbName, resultType, allMap[idx][dbName])
								}
							}

							reflectValue := reflect.Indirect(reflect.ValueOf(user))
							AssertEqual(t, allMap[idx][dbName], reflectValue.FieldByName(name).Interface())
						})
					}
				})
			}
		}
	})

	var models []User
	if err := DB.Where("name in (?)", []string{"find"}).Find(&models).Error; err != nil || len(models) != 3 {
		t.Errorf("errors happened when query find with in clause: %v, length: %v", err, len(models))
	} else {
		for idx, user := range users {
			t.Run("FindWithInClause#"+strconv.Itoa(idx+1), func(t *testing.T) {
				CheckUser(t, models[idx], user)
			})
		}
	}

	// test array
	var models2 [3]User
	if err := DB.Where("name in (?)", []string{"find"}).Find(&models2).Error; err != nil {
		t.Errorf("errors happened when query find with in clause: %v, length: %v", err, len(models2))
	} else {
		for idx, user := range users {
			t.Run("FindWithInClause#"+strconv.Itoa(idx+1), func(t *testing.T) {
				CheckUser(t, models2[idx], user)
			})
		}
	}

	// test smaller array
	var models3 [2]User
	if err := DB.Where("name in (?)", []string{"find"}).Find(&models3).Error; err != nil {
		t.Errorf("errors happened when query find with in clause: %v, length: %v", err, len(models3))
	} else {
		for idx, user := range users[:2] {
			t.Run("FindWithInClause#"+strconv.Itoa(idx+1), func(t *testing.T) {
				CheckUser(t, models3[idx], user)
			})
		}
	}

	var none []User
	if err := DB.Where("name in (?)", []string{}).Find(&none).Error; err != nil || len(none) != 0 {
		t.Errorf("errors happened when query find with in clause and zero length parameter: %v, length: %v", err, len(none))
	}
}

func TestQueryWithAssociation(t *testing.T) {
	user := *GetUser("query_with_association", Config{Account: true, Pets: 2, Toys: 1, Company: true, Manager: true, Team: 2, Languages: 1, Friends: 3})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create user: %v", err)
	}

	user.CreatedAt = time.Time{}
	user.UpdatedAt = time.Time{}
	if err := DB.Where(&user).First(&User{}).Error; err != nil {
		t.Errorf("search with struct with association should returns no error, but got %v", err)
	}

	if err := DB.Where(user).First(&User{}).Error; err != nil {
		t.Errorf("search with struct with association should returns no error, but got %v", err)
	}
}

func TestFindInBatches(t *testing.T) {
	users := []User{
		*GetUser("find_in_batches", Config{}),
		*GetUser("find_in_batches", Config{}),
		*GetUser("find_in_batches", Config{}),
		*GetUser("find_in_batches", Config{}),
		*GetUser("find_in_batches", Config{}),
		*GetUser("find_in_batches", Config{}),
	}

	DB.Create(&users)

	var (
		results    []User
		totalBatch int
	)

	if result := DB.Table("users as u").Where("name = ?", users[0].Name).FindInBatches(&results, 2, func(tx *gorm.DB, batch int) error {
		totalBatch += batch

		if tx.RowsAffected != 2 {
			t.Errorf("Incorrect affected rows, expects: 2, got %v", tx.RowsAffected)
		}

		if len(results) != 2 {
			t.Errorf("Incorrect users length, expects: 2, got %v", len(results))
		}

		for idx := range results {
			results[idx].Name = results[idx].Name + "_new"
		}

		if err := tx.Save(results).Error; err != nil {
			t.Fatalf("failed to save users, got error %v", err)
		}

		return nil
	}); result.Error != nil || result.RowsAffected != 6 {
		t.Errorf("Failed to batch find, got error %v, rows affected: %v", result.Error, result.RowsAffected)
	}

	if totalBatch != 6 {
		t.Errorf("incorrect total batch, expects: %v, got %v", 6, totalBatch)
	}

	var count int64
	DB.Model(&User{}).Where("name = ?", "find_in_batches_new").Count(&count)
	if count != 6 {
		t.Errorf("incorrect count after update, expects: %v, got %v", 6, count)
	}
}

func TestFindInBatchesWithOffsetLimit(t *testing.T) {
	users := []User{
		*GetUser("find_in_batches_with_offset_limit", Config{}),
		*GetUser("find_in_batches_with_offset_limit", Config{}),
		*GetUser("find_in_batches_with_offset_limit", Config{}),
		*GetUser("find_in_batches_with_offset_limit", Config{}),
		*GetUser("find_in_batches_with_offset_limit", Config{}),
		*GetUser("find_in_batches_with_offset_limit", Config{}),
		*GetUser("find_in_batches_with_offset_limit", Config{}),
		*GetUser("find_in_batches_with_offset_limit", Config{}),
		*GetUser("find_in_batches_with_offset_limit", Config{}),
		*GetUser("find_in_batches_with_offset_limit", Config{}),
	}

	DB.Create(&users)

	var (
		sub, results []User
		lastBatch    int
	)

	// offset limit
	if result := DB.Offset(3).Limit(5).Where("name = ?", users[0].Name).FindInBatches(&sub, 2, func(tx *gorm.DB, batch int) error {
		results = append(results, sub...)
		lastBatch = batch
		return nil
	}); result.Error != nil || result.RowsAffected != 5 {
		t.Errorf("Failed to batch find, got error %v, rows affected: %v", result.Error, result.RowsAffected)
	}
	if lastBatch != 3 {
		t.Fatalf("incorrect last batch, expected: %v, got: %v", 3, lastBatch)
	}

	targetUsers := users[3:8]
	for i := 0; i < len(targetUsers); i++ {
		AssertEqual(t, results[i], targetUsers[i])
	}

	var sub1 []User
	// limit < batchSize
	if result := DB.Limit(5).Where("name = ?", users[0].Name).FindInBatches(&sub1, 10, func(tx *gorm.DB, batch int) error {
		return nil
	}); result.Error != nil || result.RowsAffected != 5 {
		t.Errorf("Failed to batch find, got error %v, rows affected: %v", result.Error, result.RowsAffected)
	}

	var sub2 []User
	// only offset
	if result := DB.Offset(3).Where("name = ?", users[0].Name).FindInBatches(&sub2, 2, func(tx *gorm.DB, batch int) error {
		return nil
	}); result.Error != nil || result.RowsAffected != 7 {
		t.Errorf("Failed to batch find, got error %v, rows affected: %v", result.Error, result.RowsAffected)
	}

	var sub3 []User
	if result := DB.Limit(4).Where("name = ?", users[0].Name).FindInBatches(&sub3, 2, func(tx *gorm.DB, batch int) error {
		return nil
	}); result.Error != nil || result.RowsAffected != 4 {
		t.Errorf("Failed to batch find, got error %v, rows affected: %v", result.Error, result.RowsAffected)
	}
}

func TestFindInBatchesWithError(t *testing.T) {
	if name := DB.Dialector.Name(); name == "sqlserver" {
		t.Skip("skip sqlserver due to it will raise data race for invalid sql")
	}

	users := []User{
		*GetUser("find_in_batches_with_error", Config{}),
		*GetUser("find_in_batches_with_error", Config{}),
		*GetUser("find_in_batches_with_error", Config{}),
		*GetUser("find_in_batches_with_error", Config{}),
		*GetUser("find_in_batches_with_error", Config{}),
		*GetUser("find_in_batches_with_error", Config{}),
	}

	DB.Create(&users)

	var (
		results    []User
		totalBatch int
	)

	if result := DB.Table("wrong_table").Where("name = ?", users[0].Name).FindInBatches(&results, 2, func(tx *gorm.DB, batch int) error {
		totalBatch += batch
		return nil
	}); result.Error == nil || result.RowsAffected > 0 {
		t.Fatal("expected errors to have occurred, but nothing happened")
	}
	if totalBatch != 0 {
		t.Fatalf("incorrect total batch, expected: %v, got: %v", 0, totalBatch)
	}

	if result := DB.Omit("id").Where("name = ?", users[0].Name).FindInBatches(&results, 2, func(tx *gorm.DB, batch int) error {
		totalBatch += batch
		return nil
	}); result.Error != gorm.ErrPrimaryKeyRequired {
		t.Fatal("expected errors to have occurred, but nothing happened")
	}
}

func TestFillSmallerStruct(t *testing.T) {
	user := User{Name: "SmallerUser", Age: 100}
	DB.Save(&user)
	type SimpleUser struct {
		ID        int64
		Name      string
		UpdatedAt time.Time
		CreatedAt time.Time
	}

	var simpleUser SimpleUser
	if err := DB.Table("users").Where("name = ?", user.Name).First(&simpleUser).Error; err != nil {
		t.Fatalf("Failed to query smaller user, got error %v", err)
	}

	AssertObjEqual(t, user, simpleUser, "Name", "ID", "UpdatedAt", "CreatedAt")

	var simpleUser2 SimpleUser
	if err := DB.Model(&User{}).Select("id").First(&simpleUser2, user.ID).Error; err != nil {
		t.Fatalf("Failed to query smaller user, got error %v", err)
	}

	AssertObjEqual(t, user, simpleUser2, "ID")

	var simpleUsers []SimpleUser
	if err := DB.Model(&User{}).Select("id").Find(&simpleUsers, user.ID).Error; err != nil || len(simpleUsers) != 1 {
		t.Fatalf("Failed to query smaller user, got error %v", err)
	}

	AssertObjEqual(t, user, simpleUsers[0], "ID")

	result := DB.Session(&gorm.Session{DryRun: true}).Model(&User{}).Find(&simpleUsers, user.ID)

	if !regexp.MustCompile("SELECT .*id.*name.*updated_at.*created_at.* FROM .*users").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("SQL should include selected names, but got %v", result.Statement.SQL.String())
	}

	result = DB.Session(&gorm.Session{DryRun: true}).Model(&User{}).Find(&User{}, user.ID)

	if regexp.MustCompile("SELECT .*name.* FROM .*users").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("SQL should not include selected names, but got %v", result.Statement.SQL.String())
	}

	result = DB.Session(&gorm.Session{DryRun: true}).Model(&User{}).Find(&[]User{}, user.ID)

	if regexp.MustCompile("SELECT .*name.* FROM .*users").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("SQL should not include selected names, but got %v", result.Statement.SQL.String())
	}

	result = DB.Session(&gorm.Session{DryRun: true}).Model(&User{}).Find(&[]*User{}, user.ID)

	if regexp.MustCompile("SELECT .*name.* FROM .*users").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("SQL should not include selected names, but got %v", result.Statement.SQL.String())
	}
}

func TestFillSmallerStructWithAllFields(t *testing.T) {
	user := User{Name: "SmallerUser", Age: 100}
	DB.Save(&user)
	type SimpleUser struct {
		ID        int64
		Name      string
		UpdatedAt time.Time
		CreatedAt time.Time
	}
	var simpleUsers []SimpleUser
	dryDB := DB.Session(&gorm.Session{DryRun: true, QueryFields: true})

	result := dryDB.Model(&User{}).Find(&simpleUsers, user.ID)
	if !regexp.MustCompile("SELECT .users.*id.*users.*name.*users.*updated_at.*users.*created_at.* FROM .*users").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("SQL should include selected names, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Model(&User{}).Find(&User{}, user.ID)
	if regexp.MustCompile("SELECT \\* FROM .*users").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("SQL should not include a * wildcard, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Model(&User{}).Find(&[]User{}, user.ID)
	if regexp.MustCompile("SELECT \\* FROM .*users").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("SQL should not include a * wildcard, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Model(&User{}).Find(&[]*User{}, user.ID)
	if regexp.MustCompile("SELECT \\* FROM .*users").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("SQL should not include a * wildcard, but got %v", result.Statement.SQL.String())
	}
}

func TestNot(t *testing.T) {
	dryDB := DB.Session(&gorm.Session{DryRun: true})

	result := dryDB.Not(map[string]interface{}{"name": "jinzhu"}).Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*name.* <> .+").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Where("name = ?", "jinzhu1").Not("name = ?", "jinzhu2").Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*name.* = .+ AND NOT.*name.* = .+").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Where(map[string]interface{}{"name": []string{"jinzhu", "jinzhu 2"}}).Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*name.* IN \\(.+,.+\\)").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Not("name = ?", "jinzhu").Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE NOT.*name.* = .+").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Not(map[string]interface{}{"name": []string{}}).Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*name.* IS NOT NULL").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Not(map[string]interface{}{"name": []string{"jinzhu", "jinzhu 2"}}).Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*name.* NOT IN \\(.+,.+\\)").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Not([]int64{1, 2}).First(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*id.* NOT IN \\(.+,.+\\)").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Not([]int64{}).First(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .users.\\..deleted_at. IS NULL ORDER BY").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Not(User{Name: "jinzhu", Age: 18}).First(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*users.*..*name.* <> .+ AND .*users.*..*age.* <> .+").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}
}

func TestNotWithAllFields(t *testing.T) {
	dryDB := DB.Session(&gorm.Session{DryRun: true, QueryFields: true})
	userQuery := "SELECT .*users.*id.*users.*created_at.*users.*updated_at.*users.*deleted_at.*users.*name" +
		".*users.*age.*users.*birthday.*users.*company_id.*users.*manager_id.*users.*active.* FROM .*users.* "

	result := dryDB.Not(map[string]interface{}{"users.name": "jinzhu"}).Find(&User{})

	if !regexp.MustCompile(userQuery + "WHERE .*users.*name.* <> .+").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Where("users.name = ?", "jinzhu1").Not("users.name = ?", "jinzhu2").Find(&User{})
	if !regexp.MustCompile(userQuery + "WHERE .*users.*name.* = .+ AND NOT .*users.*name.* = .+").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Where(map[string]interface{}{"users.name": []string{"jinzhu", "jinzhu 2"}}).Find(&User{})
	if !regexp.MustCompile(userQuery + "WHERE .*users.*name.* IN \\(.+,.+\\)").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Not("users.name = ?", "jinzhu").Find(&User{})
	if !regexp.MustCompile(userQuery + "WHERE NOT .*users.*name.* = .+").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Not(map[string]interface{}{"users.name": []string{"jinzhu", "jinzhu 2"}}).Find(&User{})
	if !regexp.MustCompile(userQuery + "WHERE .*users.*name.* NOT IN \\(.+,.+\\)").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Not([]int64{1, 2}).First(&User{})
	if !regexp.MustCompile(userQuery + "WHERE .*users.*id.* NOT IN \\(.+,.+\\)").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Not([]int64{}).First(&User{})
	if !regexp.MustCompile(userQuery + "WHERE .users.\\..deleted_at. IS NULL ORDER BY").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Not(User{Name: "jinzhu", Age: 18}).First(&User{})
	if !regexp.MustCompile(userQuery + "WHERE .*users.*..*name.* <> .+ AND .*users.*..*age.* <> .+").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build NOT condition, but got %v", result.Statement.SQL.String())
	}
}

func TestOr(t *testing.T) {
	dryDB := DB.Session(&gorm.Session{DryRun: true})

	var count int64
	result := dryDB.Model(&User{}).Or("role = ?", "admin").Count(&count)
	if !regexp.MustCompile("SELECT count\\(\\*\\) FROM .*users.* WHERE role = .+ AND .*users.*\\..*deleted_at.* IS NULL").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build OR condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Where("role = ?", "admin").Where(DB.Or("role = ?", "super_admin")).Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*role.* = .+ AND .*role.* = .+").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build OR condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Where("role = ?", "admin").Where(DB.Or("role = ?", "super_admin").Or("role = ?", "admin")).Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*role.* = .+ AND (.*role.* = .+ OR .*role.* = .+)").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build OR condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Where("role = ?", "admin").Or("role = ?", "super_admin").Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*role.* = .+ OR .*role.* = .+").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build OR condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Where("name = ?", "jinzhu").Or(User{Name: "jinzhu 2", Age: 18}).Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*name.* = .+ OR \\(.*name.* AND .*age.*\\)").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build OR condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Where("name = ?", "jinzhu").Or(map[string]interface{}{"name": "jinzhu 2", "age": 18}).Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* WHERE .*name.* = .+ OR \\(.*age.* AND .*name.*\\)").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build OR condition, but got %v", result.Statement.SQL.String())
	}
}

func TestOrWithAllFields(t *testing.T) {
	dryDB := DB.Session(&gorm.Session{DryRun: true, QueryFields: true})
	userQuery := "SELECT .*users.*id.*users.*created_at.*users.*updated_at.*users.*deleted_at.*users.*name" +
		".*users.*age.*users.*birthday.*users.*company_id.*users.*manager_id.*users.*active.* FROM .*users.* "

	result := dryDB.Where("role = ?", "admin").Or("role = ?", "super_admin").Find(&User{})
	if !regexp.MustCompile(userQuery + "WHERE .*role.* = .+ OR .*role.* = .+").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build OR condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Where("users.name = ?", "jinzhu").Or(User{Name: "jinzhu 2", Age: 18}).Find(&User{})
	if !regexp.MustCompile(userQuery + "WHERE .*users.*name.* = .+ OR \\(.*users.*name.* AND .*users.*age.*\\)").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build OR condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Where("users.name = ?", "jinzhu").Or(map[string]interface{}{"name": "jinzhu 2", "age": 18}).Find(&User{})
	if !regexp.MustCompile(userQuery + "WHERE .*users.*name.* = .+ OR \\(.*age.* AND .*name.*\\)").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build OR condition, but got %v", result.Statement.SQL.String())
	}
}

func TestPluck(t *testing.T) {
	users := []*User{
		GetUser("pluck-user1", Config{}),
		GetUser("pluck-user2", Config{}),
		GetUser("pluck-user3", Config{}),
	}

	DB.Create(&users)

	var names []string
	if err := DB.Model(User{}).Where("name like ?", "pluck-user%").Order("name").Pluck("name", &names).Error; err != nil {
		t.Errorf("got error when pluck name: %v", err)
	}

	var names2 []string
	if err := DB.Model(User{}).Where("name like ?", "pluck-user%").Order("name desc").Pluck("name", &names2).Error; err != nil {
		t.Errorf("got error when pluck name: %v", err)
	}

	sort.Slice(names2, func(i, j int) bool { return names2[i] < names2[j] })
	AssertEqual(t, names, names2)

	var ids []int
	if err := DB.Model(User{}).Where("name like ?", "pluck-user%").Pluck("id", &ids).Error; err != nil {
		t.Errorf("got error when pluck id: %v", err)
	}

	for idx, name := range names {
		if name != users[idx].Name {
			t.Errorf("Unexpected result on pluck name, got %+v", names)
		}
	}

	for idx, id := range ids {
		if int(id) != int(users[idx].ID) {
			t.Errorf("Unexpected result on pluck id, got %+v", ids)
		}
	}

	var times []time.Time
	if err := DB.Model(User{}).Where("name like ?", "pluck-user%").Pluck("created_at", &times).Error; err != nil {
		t.Errorf("got error when pluck time: %v", err)
	}

	for idx, tv := range times {
		AssertEqual(t, tv, users[idx].CreatedAt)
	}

	var ptrtimes []*time.Time
	if err := DB.Model(User{}).Where("name like ?", "pluck-user%").Pluck("created_at", &ptrtimes).Error; err != nil {
		t.Errorf("got error when pluck time: %v", err)
	}

	for idx, tv := range ptrtimes {
		AssertEqual(t, tv, users[idx].CreatedAt)
	}

	var nulltimes []sql.NullTime
	if err := DB.Model(User{}).Where("name like ?", "pluck-user%").Pluck("created_at", &nulltimes).Error; err != nil {
		t.Errorf("got error when pluck time: %v", err)
	}

	for idx, tv := range nulltimes {
		AssertEqual(t, tv.Time, users[idx].CreatedAt)
	}
}

func TestSelect(t *testing.T) {
	user := User{Name: "SelectUser1"}
	DB.Save(&user)

	var result User
	DB.Where("name = ?", user.Name).Select("name").Find(&result)
	if result.ID != 0 {
		t.Errorf("Should not have ID because only selected name, %+v", result.ID)
	}

	if user.Name != result.Name {
		t.Errorf("Should have user Name when selected it")
	}

	var result2 User
	DB.Where("name = ?", user.Name).Select("name as name").Find(&result2)
	if result2.ID != 0 {
		t.Errorf("Should not have ID because only selected name, %+v", result2.ID)
	}

	if user.Name != result2.Name {
		t.Errorf("Should have user Name when selected it")
	}

	dryDB := DB.Session(&gorm.Session{DryRun: true})
	r := dryDB.Select("name", "age").Find(&User{})
	if !regexp.MustCompile("SELECT .*name.*,.*age.* FROM .*users.*").MatchString(r.Statement.SQL.String()) {
		t.Fatalf("Build Select with strings, but got %v", r.Statement.SQL.String())
	}

	r = dryDB.Select([]string{"name", "age"}).Find(&User{})
	if !regexp.MustCompile("SELECT .*name.*,.*age.* FROM .*users.*").MatchString(r.Statement.SQL.String()) {
		t.Fatalf("Build Select with slice, but got %v", r.Statement.SQL.String())
	}

	// SELECT COALESCE(age,'42') FROM users;
	r = dryDB.Table("users").Select("COALESCE(age,?)", 42).Find(&User{})
	if !regexp.MustCompile(`SELECT COALESCE\(age,.*\) FROM .*users.*`).MatchString(r.Statement.SQL.String()) {
		t.Fatalf("Build Select with func, but got %v", r.Statement.SQL.String())
	}

	// named arguments
	r = dryDB.Table("users").Select("COALESCE(age, @default)", sql.Named("default", 42)).Find(&User{})
	if !regexp.MustCompile(`SELECT COALESCE\(age,.*\) FROM .*users.*`).MatchString(r.Statement.SQL.String()) {
		t.Fatalf("Build Select with func, but got %v", r.Statement.SQL.String())
	}

	if _, err := DB.Table("users").Select("COALESCE(age,?)", "42").Rows(); err != nil {
		t.Fatalf("Failed, got error: %v", err)
	}

	r = dryDB.Select("u.*").Table("users as u").First(&User{}, user.ID)
	if !regexp.MustCompile(`SELECT u\.\* FROM .*users.*`).MatchString(r.Statement.SQL.String()) {
		t.Fatalf("Build Select with u.*, but got %v", r.Statement.SQL.String())
	}

	r = dryDB.Select("count(*)").Select("u.*").Table("users as u").First(&User{}, user.ID)
	if !regexp.MustCompile(`SELECT u\.\* FROM .*users.*`).MatchString(r.Statement.SQL.String()) {
		t.Fatalf("Build Select with u.*, but got %v", r.Statement.SQL.String())
	}
}

func TestOmit(t *testing.T) {
	user := User{Name: "OmitUser1", Age: 20}
	DB.Save(&user)

	var result User
	DB.Where("name = ?", user.Name).Omit("name").Find(&result)
	if result.ID == 0 {
		t.Errorf("Should not have ID because only selected name, %+v", result.ID)
	}

	if result.Name != "" || result.Age != 20 {
		t.Errorf("User Name should be omitted, got %v, Age should be ok, got %v", result.Name, result.Age)
	}
}

func TestOmitWithAllFields(t *testing.T) {
	user := User{Name: "OmitUser1", Age: 20}
	DB.Save(&user)

	var userResult User
	DB.Session(&gorm.Session{QueryFields: true}).Where("users.name = ?", user.Name).Omit("name").Find(&userResult)
	if userResult.ID == 0 {
		t.Errorf("Should not have ID because only selected name, %+v", userResult.ID)
	}

	if userResult.Name != "" || userResult.Age != 20 {
		t.Errorf("User Name should be omitted, got %v, Age should be ok, got %v", userResult.Name, userResult.Age)
	}

	dryDB := DB.Session(&gorm.Session{DryRun: true, QueryFields: true})
	userQuery := "SELECT .*users.*id.*users.*created_at.*users.*updated_at.*users.*deleted_at.*users.*birthday" +
		".*users.*company_id.*users.*manager_id.*users.*active.* FROM .*users.* "

	result := dryDB.Omit("name, age").Find(&User{})
	if !regexp.MustCompile(userQuery).MatchString(result.Statement.SQL.String()) {
		t.Fatalf("SQL must include table name and selected fields, got %v", result.Statement.SQL.String())
	}
}

func TestPluckWithSelect(t *testing.T) {
	users := []User{
		{Name: "pluck_with_select_1", Age: 25},
		{Name: "pluck_with_select_2", Age: 26},
	}

	DB.Create(&users)

	var userAges []int
	err := DB.Model(&User{}).Where("name like ?", "pluck_with_select%").Select("age + 1 as user_age").Pluck("user_age", &userAges).Error
	if err != nil {
		t.Fatalf("got error when pluck user_age: %v", err)
	}

	sort.Ints(userAges)

	AssertEqual(t, userAges, []int{26, 27})
}

func TestSelectWithVariables(t *testing.T) {
	DB.Save(&User{Name: "select_with_variables"})

	rows, _ := DB.Table("users").Where("name = ?", "select_with_variables").Select("? as fake", gorm.Expr("name")).Rows()

	if !rows.Next() {
		t.Errorf("Should have returned at least one row")
	} else {
		columns, _ := rows.Columns()
		AssertEqual(t, columns, []string{"fake"})
	}

	rows.Close()
}

func TestSelectWithArrayInput(t *testing.T) {
	DB.Save(&User{Name: "select_with_array", Age: 42})

	var user User
	DB.Select([]string{"name", "age"}).Where("age = 42 AND name = ?", "select_with_array").First(&user)

	if user.Name != "select_with_array" || user.Age != 42 {
		t.Errorf("Should have selected both age and name")
	}
}

func TestCustomizedTypePrimaryKey(t *testing.T) {
	type ID uint
	type CustomizedTypePrimaryKey struct {
		ID   ID
		Name string
	}

	DB.Migrator().DropTable(&CustomizedTypePrimaryKey{})
	if err := DB.AutoMigrate(&CustomizedTypePrimaryKey{}); err != nil {
		t.Fatalf("failed to migrate, got error %v", err)
	}

	p1 := CustomizedTypePrimaryKey{Name: "p1"}
	p2 := CustomizedTypePrimaryKey{Name: "p2"}
	p3 := CustomizedTypePrimaryKey{Name: "p3"}
	DB.Create(&p1)
	DB.Create(&p2)
	DB.Create(&p3)

	var p CustomizedTypePrimaryKey

	if err := DB.First(&p, p2.ID).Error; err != nil {
		t.Errorf("No error should returns, but got %v", err)
	}

	AssertEqual(t, p, p2)

	if err := DB.First(&p, "id = ?", p2.ID).Error; err != nil {
		t.Errorf("No error should happen when querying with customized type for primary key, got err %v", err)
	}

	AssertEqual(t, p, p2)
}

func TestStringPrimaryKeyForNumericValueStartingWithZero(t *testing.T) {
	type AddressByZipCode struct {
		ZipCode string `gorm:"primary_key"`
		Address string
	}

	DB.Migrator().DropTable(&AddressByZipCode{})
	if err := DB.AutoMigrate(&AddressByZipCode{}); err != nil {
		t.Fatalf("failed to migrate, got error %v", err)
	}

	address := AddressByZipCode{ZipCode: "00501", Address: "Holtsville"}
	DB.Create(&address)

	var result AddressByZipCode
	DB.First(&result, "00501")

	AssertEqual(t, result, address)
}

func TestSearchWithEmptyChain(t *testing.T) {
	user := User{Name: "search_with_empty_chain", Age: 1}
	DB.Create(&user)

	var result User
	if DB.Where("").Where("").First(&result).Error != nil {
		t.Errorf("Should not raise any error if searching with empty strings")
	}

	result = User{}
	if DB.Where(&User{}).Where("name = ?", user.Name).First(&result).Error != nil {
		t.Errorf("Should not raise any error if searching with empty struct")
	}

	result = User{}
	if DB.Where(map[string]interface{}{}).Where("name = ?", user.Name).First(&result).Error != nil {
		t.Errorf("Should not raise any error if searching with empty map")
	}
}

func TestOrder(t *testing.T) {
	dryDB := DB.Session(&gorm.Session{DryRun: true})

	result := dryDB.Order("").Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* IS NULL$").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build Order condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Order(nil).Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* IS NULL$").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build Order condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Order("age desc, name").Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* ORDER BY age desc, name").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build Order condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Order("age desc").Order("name").Find(&User{})
	if !regexp.MustCompile("SELECT \\* FROM .*users.* ORDER BY age desc,name").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build Order condition, but got %v", result.Statement.SQL.String())
	}

	stmt := dryDB.Clauses(clause.OrderBy{
		Expression: clause.Expr{SQL: "FIELD(id,?)", Vars: []interface{}{[]int{1, 2, 3}}, WithoutParentheses: true},
	}).Find(&User{}).Statement

	explainedSQL := dryDB.Dialector.Explain(stmt.SQL.String(), stmt.Vars...)
	if !regexp.MustCompile("SELECT \\* FROM .*users.* ORDER BY FIELD\\(id,1,2,3\\)").MatchString(explainedSQL) {
		t.Fatalf("Build Order condition, but got %v", explainedSQL)
	}
}

func TestOrderWithAllFields(t *testing.T) {
	dryDB := DB.Session(&gorm.Session{DryRun: true, QueryFields: true})
	userQuery := "SELECT .*users.*id.*users.*created_at.*users.*updated_at.*users.*deleted_at.*users.*name.*users.*age" +
		".*users.*birthday.*users.*company_id.*users.*manager_id.*users.*active.* FROM .*users.* "

	result := dryDB.Order("users.age desc, users.name").Find(&User{})
	if !regexp.MustCompile(userQuery + "users.age desc, users.name").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build Order condition, but got %v", result.Statement.SQL.String())
	}

	result = dryDB.Order("users.age desc").Order("users.name").Find(&User{})
	if !regexp.MustCompile(userQuery + "ORDER BY users.age desc,users.name").MatchString(result.Statement.SQL.String()) {
		t.Fatalf("Build Order condition, but got %v", result.Statement.SQL.String())
	}

	stmt := dryDB.Clauses(clause.OrderBy{
		Expression: clause.Expr{SQL: "FIELD(id,?)", Vars: []interface{}{[]int{1, 2, 3}}, WithoutParentheses: true},
	}).Find(&User{}).Statement

	explainedSQL := dryDB.Dialector.Explain(stmt.SQL.String(), stmt.Vars...)
	if !regexp.MustCompile(userQuery + "ORDER BY FIELD\\(id,1,2,3\\)").MatchString(explainedSQL) {
		t.Fatalf("Build Order condition, but got %v", explainedSQL)
	}
}

func TestLimit(t *testing.T) {
	users := []User{
		{Name: "LimitUser1", Age: 1},
		{Name: "LimitUser2", Age: 10},
		{Name: "LimitUser3", Age: 20},
		{Name: "LimitUser4", Age: 10},
		{Name: "LimitUser5", Age: 20},
		{Name: "LimitUser6", Age: 20},
	}

	DB.Create(&users)

	var users1, users2, users3 []User
	DB.Order("age desc").Limit(3).Find(&users1).Limit(5).Find(&users2).Limit(-1).Find(&users3)

	if len(users1) != 3 || len(users2) != 5 || len(users3) <= 5 {
		t.Errorf("Limit should works, users1 %v users2 %v users3 %v", len(users1), len(users2), len(users3))
	}
}

func TestOffset(t *testing.T) {
	for i := 0; i < 20; i++ {
		DB.Save(&User{Name: fmt.Sprintf("OffsetUser%v", i)})
	}
	var users1, users2, users3, users4 []User

	DB.Limit(100).Where("name like ?", "OffsetUser%").Order("age desc").Find(&users1).Offset(3).Find(&users2).Offset(5).Find(&users3).Offset(-1).Find(&users4)

	if (len(users1) != len(users4)) || (len(users1)-len(users2) != 3) || (len(users1)-len(users3) != 5) {
		t.Errorf("Offset should work")
	}

	DB.Where("name like ?", "OffsetUser%").Order("age desc").Find(&users1).Offset(3).Find(&users2).Offset(5).Find(&users3).Offset(-1).Find(&users4)

	if (len(users1) != len(users4)) || (len(users1)-len(users2) != 3) || (len(users1)-len(users3) != 5) {
		t.Errorf("Offset should work without limit.")
	}
}

func TestSearchWithMap(t *testing.T) {
	users := []User{
		*GetUser("map_search_user1", Config{}),
		*GetUser("map_search_user2", Config{}),
		*GetUser("map_search_user3", Config{}),
		*GetUser("map_search_user4", Config{Company: true}),
	}

	DB.Create(&users)

	var user User
	DB.First(&user, map[string]interface{}{"name": users[0].Name})
	CheckUser(t, user, users[0])

	user = User{}
	DB.Where(map[string]interface{}{"name": users[1].Name}).First(&user)
	CheckUser(t, user, users[1])

	var results []User
	DB.Where(map[string]interface{}{"name": users[2].Name}).Find(&results)
	if len(results) != 1 {
		t.Fatalf("Search all records with inline map")
	}

	CheckUser(t, results[0], users[2])

	var results2 []User
	DB.Find(&results2, map[string]interface{}{"name": users[3].Name, "company_id": nil})
	if len(results2) != 0 {
		t.Errorf("Search all records with inline map containing null value finding 0 records")
	}

	DB.Find(&results2, map[string]interface{}{"name": users[0].Name, "company_id": nil})
	if len(results2) != 1 {
		t.Errorf("Search all records with inline map containing null value finding 1 record")
	}

	DB.Find(&results2, map[string]interface{}{"name": users[3].Name, "company_id": users[3].CompanyID})
	if len(results2) != 1 {
		t.Errorf("Search all records with inline multiple value map")
	}
}

func TestSearchWithStruct(t *testing.T) {
	dryRunDB := DB.Session(&gorm.Session{DryRun: true})

	result := dryRunDB.Where(User{Name: "jinzhu"}).Find(&User{})
	if !regexp.MustCompile(`WHERE .users.\..name. = .{1,3} AND .users.\..deleted_at. IS NULL`).MatchString(result.Statement.SQL.String()) {
		t.Errorf("invalid query SQL, got %v", result.Statement.SQL.String())
	}

	result = dryRunDB.Where(User{Name: "jinzhu", Age: 18}).Find(&User{})
	if !regexp.MustCompile(`WHERE .users.\..name. = .{1,3} AND .users.\..age. = .{1,3} AND .users.\..deleted_at. IS NULL`).MatchString(result.Statement.SQL.String()) {
		t.Errorf("invalid query SQL, got %v", result.Statement.SQL.String())
	}

	result = dryRunDB.Where(User{Name: "jinzhu"}, "name", "Age").Find(&User{})
	if !regexp.MustCompile(`WHERE .users.\..name. = .{1,3} AND .users.\..age. = .{1,3} AND .users.\..deleted_at. IS NULL`).MatchString(result.Statement.SQL.String()) {
		t.Errorf("invalid query SQL, got %v", result.Statement.SQL.String())
	}

	result = dryRunDB.Where(User{Name: "jinzhu"}, "age").Find(&User{})
	if !regexp.MustCompile(`WHERE .users.\..age. = .{1,3} AND .users.\..deleted_at. IS NULL`).MatchString(result.Statement.SQL.String()) {
		t.Errorf("invalid query SQL, got %v", result.Statement.SQL.String())
	}
}

func TestSubQuery(t *testing.T) {
	users := []User{
		{Name: "subquery_1", Age: 10},
		{Name: "subquery_2", Age: 20},
		{Name: "subquery_3", Age: 30},
		{Name: "subquery_4", Age: 40},
	}

	DB.Create(&users)

	if err := DB.Select("*").Where("name IN (?)", DB.Select("name").Table("users").Where("name LIKE ?", "subquery_%")).Find(&users).Error; err != nil {
		t.Fatalf("got error: %v", err)
	}

	if len(users) != 4 {
		t.Errorf("Four users should be found, instead found %d", len(users))
	}

	DB.Select("*").Where("name LIKE ?", "subquery%").Where("age >= (?)", DB.
		Select("AVG(age)").Table("users").Where("name LIKE ?", "subquery%")).Find(&users)

	if len(users) != 2 {
		t.Errorf("Two users should be found, instead found %d", len(users))
	}
}

func TestSubQueryWithRaw(t *testing.T) {
	users := []User{
		{Name: "subquery_raw_1", Age: 10},
		{Name: "subquery_raw_2", Age: 20},
		{Name: "subquery_raw_3", Age: 30},
		{Name: "subquery_raw_4", Age: 40},
	}
	DB.Create(&users)

	var count int64
	err := DB.Raw("select count(*) from (?) tmp where 1 = ? AND name IN (?)", DB.Raw("select name from users where age >= ? and name in (?)", 10, []string{"subquery_raw_1", "subquery_raw_2", "subquery_raw_3"}), 1, DB.Raw("select name from users where age >= ? and name in (?)", 20, []string{"subquery_raw_1", "subquery_raw_2", "subquery_raw_3"})).Scan(&count).Error
	if err != nil {
		t.Errorf("Expected to get no errors, but got %v", err)
	}

	if count != 2 {
		t.Errorf("Row count must be 2, instead got %d", count)
	}

	err = DB.Raw("select count(*) from (?) tmp",
		DB.Table("users").
			Select("name").
			Where("age >= ? and name in (?)", 20, []string{"subquery_raw_1", "subquery_raw_3"}).
			Group("name"),
	).Count(&count).Error

	if err != nil {
		t.Errorf("Expected to get no errors, but got %v", err)
	}

	if count != 1 {
		t.Errorf("Row count must be 1, instead got %d", count)
	}

	err = DB.Raw("select count(*) from (?) tmp",
		DB.Table("users").
			Select("name").
			Where("name LIKE ?", "subquery_raw%").
			Not("age <= ?", 10).Not("name IN (?)", []string{"subquery_raw_1", "subquery_raw_3"}).
			Group("name"),
	).Count(&count).Error

	if err != nil {
		t.Errorf("Expected to get no errors, but got %v", err)
	}

	if count != 2 {
		t.Errorf("Row count must be 2, instead got %d", count)
	}
}

func TestSubQueryWithHaving(t *testing.T) {
	users := []User{
		{Name: "subquery_having_1", Age: 10},
		{Name: "subquery_having_2", Age: 20},
		{Name: "subquery_having_3", Age: 30},
		{Name: "subquery_having_4", Age: 40},
	}
	DB.Create(&users)

	var results []User
	DB.Select("AVG(age) as avgage").Where("name LIKE ?", "subquery_having%").Group("name").Having("AVG(age) > (?)", DB.
		Select("AVG(age)").Where("name LIKE ?", "subquery_having%").Table("users")).Find(&results)

	if len(results) != 2 {
		t.Errorf("Two user group should be found, instead found %d", len(results))
	}
}

func TestScanNullValue(t *testing.T) {
	user := GetUser("scan_null_value", Config{})
	DB.Create(&user)

	if err := DB.Model(&user).Update("age", nil).Error; err != nil {
		t.Fatalf("failed to update column age for struct, got error %v", err)
	}

	var result User
	if err := DB.First(&result, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("failed to query struct data with null age, got error %v", err)
	}

	AssertEqual(t, result, user)

	users := []User{
		*GetUser("scan_null_value_for_slice_1", Config{}),
		*GetUser("scan_null_value_for_slice_2", Config{}),
		*GetUser("scan_null_value_for_slice_3", Config{}),
	}
	DB.Create(&users)

	if err := DB.Model(&users[0]).Update("age", nil).Error; err != nil {
		t.Fatalf("failed to update column age for struct, got error %v", err)
	}

	var results []User
	if err := DB.Find(&results, "name like ?", "scan_null_value_for_slice%").Error; err != nil {
		t.Fatalf("failed to query slice data with null age, got error %v", err)
	}
}

func TestQueryWithTableAndConditions(t *testing.T) {
	result := DB.Session(&gorm.Session{DryRun: true}).Table("user").Find(&User{}, User{Name: "jinzhu"})

	if !regexp.MustCompile(`SELECT \* FROM .user. WHERE .user.\..name. = .+ AND .user.\..deleted_at. IS NULL`).MatchString(result.Statement.SQL.String()) {
		t.Errorf("invalid query SQL, got %v", result.Statement.SQL.String())
	}
}

func TestQueryWithTableAndConditionsAndAllFields(t *testing.T) {
	result := DB.Session(&gorm.Session{DryRun: true, QueryFields: true}).Table("user").Find(&User{}, User{Name: "jinzhu"})
	userQuery := "SELECT .*user.*id.*user.*created_at.*user.*updated_at.*user.*deleted_at.*user.*name.*user.*age" +
		".*user.*birthday.*user.*company_id.*user.*manager_id.*user.*active.* FROM .user. "

	if !regexp.MustCompile(userQuery + `WHERE .user.\..name. = .+ AND .user.\..deleted_at. IS NULL`).MatchString(result.Statement.SQL.String()) {
		t.Errorf("invalid query SQL, got %v", result.Statement.SQL.String())
	}
}

type DoubleInt64 struct {
	data int64
}

func (t *DoubleInt64) Scan(val interface{}) error {
	switch v := val.(type) {
	case int64:
		t.data = v * 2
		return nil
	default:
		return fmt.Errorf("DoubleInt64 cant not scan with:%v", v)
	}
}

// https://github.com/go-gorm/gorm/issues/5091
func TestQueryScannerWithSingleColumn(t *testing.T) {
	user := User{Name: "scanner_raw_1", Age: 10}
	DB.Create(&user)

	var result1 DoubleInt64
	if err := DB.Model(&User{}).Where("name LIKE ?", "scanner_raw_%").Limit(1).Pluck(
		"age", &result1).Error; err != nil {
		t.Errorf("Failed, got error: %v", err)
	}

	AssertEqual(t, result1.data, 20)

	var result2 DoubleInt64
	if err := DB.Model(&User{}).Where("name LIKE ?", "scanner_raw_%").Limit(1).Select(
		"age").Scan(&result2).Error; err != nil {
		t.Errorf("Failed, got error: %v", err)
	}

	AssertEqual(t, result2.data, 20)
}

func TestQueryResetNullValue(t *testing.T) {
	type QueryResetItem struct {
		ID   string `gorm:"type:varchar(5)"`
		Name string
	}

	type QueryResetNullValue struct {
		ID      int
		Name    string     `gorm:"default:NULL"`
		Flag    bool       `gorm:"default:NULL"`
		Number1 int64      `gorm:"default:NULL"`
		Number2 uint64     `gorm:"default:NULL"`
		Number3 float64    `gorm:"default:NULL"`
		Now     *time.Time `gorm:"defalut:NULL"`
		Item1Id string
		Item1   *QueryResetItem `gorm:"references:ID"`
		Item2Id string
		Item2   *QueryResetItem `gorm:"references:ID"`
	}

	DB.Migrator().DropTable(&QueryResetNullValue{}, &QueryResetItem{})
	DB.AutoMigrate(&QueryResetNullValue{}, &QueryResetItem{})

	now := time.Now()
	q1 := QueryResetNullValue{
		Name:    "name",
		Flag:    true,
		Number1: 100,
		Number2: 200,
		Number3: 300.1,
		Now:     &now,
		Item1: &QueryResetItem{
			ID:   "u_1_1",
			Name: "item_1_1",
		},
		Item2: &QueryResetItem{
			ID:   "u_1_2",
			Name: "item_1_2",
		},
	}

	q2 := QueryResetNullValue{
		Item1: &QueryResetItem{
			ID:   "u_2_1",
			Name: "item_2_1",
		},
		Item2: &QueryResetItem{
			ID:   "u_2_2",
			Name: "item_2_2",
		},
	}

	var err error
	err = DB.Create(&q1).Error
	if err != nil {
		t.Errorf("failed to create:%v", err)
	}

	err = DB.Create(&q2).Error
	if err != nil {
		t.Errorf("failed to create:%v", err)
	}

	var qs []QueryResetNullValue
	err = DB.Joins("Item1").Joins("Item2").Find(&qs).Error
	if err != nil {
		t.Errorf("failed to find:%v", err)
	}

	if len(qs) != 2 {
		t.Fatalf("find count not equal:%d", len(qs))
	}

	AssertEqual(t, q1, qs[0])
	AssertEqual(t, q2, qs[1])
}

func TestQueryError(t *testing.T) {
	type P struct{}
	var p1 P
	err := DB.Take(&p1, 1).Error
	AssertEqual(t, err, gorm.ErrModelAccessibleFieldsRequired)

	var p2 interface{}

	err = DB.Table("ps").Clauses(clause.Eq{Column: clause.Column{
		Table: clause.CurrentTable, Name: clause.PrimaryKey,
	}, Value: 1}).Scan(&p2).Error
	AssertEqual(t, err, gorm.ErrModelValueRequired)
}
