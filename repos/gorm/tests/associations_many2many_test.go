package tests_test

import (
	"fmt"
	"sync"
	"testing"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	. "gorm.io/gorm/utils/tests"
)

func TestMany2ManyAssociation(t *testing.T) {
	user := *GetUser("many2many", Config{Languages: 2})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	CheckUser(t, user, user)

	// Find
	var user2 User
	DB.Find(&user2, "id = ?", user.ID)
	DB.Model(&user2).Association("Languages").Find(&user2.Languages)

	CheckUser(t, user2, user)

	// Count
	AssertAssociationCount(t, user, "Languages", 2, "")

	// Append
	language := Language{Code: "language-many2many-append", Name: "language-many2many-append"}
	DB.Create(&language)

	if err := DB.Model(&user2).Association("Languages").Append(&language); err != nil {
		t.Fatalf("Error happened when append account, got %v", err)
	}

	user.Languages = append(user.Languages, language)
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user, "Languages", 3, "AfterAppend")

	languages := []Language{
		{Code: "language-many2many-append-1-1", Name: "language-many2many-append-1-1"},
		{Code: "language-many2many-append-2-1", Name: "language-many2many-append-2-1"},
	}
	DB.Create(&languages)

	if err := DB.Model(&user2).Association("Languages").Append(&languages); err != nil {
		t.Fatalf("Error happened when append language, got %v", err)
	}

	user.Languages = append(user.Languages, languages...)

	CheckUser(t, user2, user)

	AssertAssociationCount(t, user, "Languages", 5, "AfterAppendSlice")

	// Replace
	language2 := Language{Code: "language-many2many-replace", Name: "language-many2many-replace"}
	DB.Create(&language2)

	if err := DB.Model(&user2).Association("Languages").Replace(&language2); err != nil {
		t.Fatalf("Error happened when append language, got %v", err)
	}

	user.Languages = []Language{language2}
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user2, "Languages", 1, "AfterReplace")

	// Delete
	if err := DB.Model(&user2).Association("Languages").Delete(&Language{}); err != nil {
		t.Fatalf("Error happened when delete language, got %v", err)
	}
	AssertAssociationCount(t, user2, "Languages", 1, "after delete non-existing data")

	if err := DB.Model(&user2).Association("Languages").Delete(&language2); err != nil {
		t.Fatalf("Error happened when delete Languages, got %v", err)
	}
	AssertAssociationCount(t, user2, "Languages", 0, "after delete")

	// Prepare Data for Clear
	if err := DB.Model(&user2).Association("Languages").Append(&language); err != nil {
		t.Fatalf("Error happened when append Languages, got %v", err)
	}

	AssertAssociationCount(t, user2, "Languages", 1, "after prepare data")

	// Clear
	if err := DB.Model(&user2).Association("Languages").Clear(); err != nil {
		t.Errorf("Error happened when clear Languages, got %v", err)
	}

	AssertAssociationCount(t, user2, "Languages", 0, "after clear")
}

func TestMany2ManyOmitAssociations(t *testing.T) {
	tidbSkip(t, "not support the foreign key feature")

	user := *GetUser("many2many_omit_associations", Config{Languages: 2})

	if err := DB.Omit("Languages.*").Create(&user).Error; err == nil {
		t.Fatalf("should raise error when create users without languages reference")
	}

	if err := DB.Create(&user.Languages).Error; err != nil {
		t.Fatalf("no error should happen when create languages, but got %v", err)
	}

	if err := DB.Omit("Languages.*").Create(&user).Error; err != nil {
		t.Fatalf("no error should happen when create user when languages exists, but got %v", err)
	}

	// Find
	var languages []Language
	if DB.Model(&user).Association("Languages").Find(&languages); len(languages) != 2 {
		t.Errorf("languages count should be %v, but got %v", 2, len(languages))
	}

	newLang := Language{Code: "omitmany2many", Name: "omitmany2many"}
	if err := DB.Model(&user).Omit("Languages.*").Association("Languages").Replace(&newLang); err == nil {
		t.Errorf("should failed to insert languages due to constraint failed, error: %v", err)
	}
}

func TestMany2ManyAssociationForSlice(t *testing.T) {
	users := []User{
		*GetUser("slice-many2many-1", Config{Languages: 2}),
		*GetUser("slice-many2many-2", Config{Languages: 0}),
		*GetUser("slice-many2many-3", Config{Languages: 4}),
	}

	DB.Create(&users)

	// Count
	AssertAssociationCount(t, users, "Languages", 6, "")

	// Find
	var languages []Language
	if DB.Model(&users).Association("Languages").Find(&languages); len(languages) != 6 {
		t.Errorf("languages count should be %v, but got %v", 6, len(languages))
	}

	// Append
	languages1 := []Language{
		{Code: "language-many2many-append-1", Name: "language-many2many-append-1"},
	}
	languages2 := []Language{}
	languages3 := []Language{
		{Code: "language-many2many-append-3-1", Name: "language-many2many-append-3-1"},
		{Code: "language-many2many-append-3-2", Name: "language-many2many-append-3-2"},
	}
	DB.Create(&languages1)
	DB.Create(&languages3)

	DB.Model(&users).Association("Languages").Append(&languages1, &languages2, &languages3)

	AssertAssociationCount(t, users, "Languages", 9, "After Append")

	languages2_1 := []*Language{
		{Code: "language-slice-replace-1-1", Name: "language-slice-replace-1-1"},
		{Code: "language-slice-replace-1-2", Name: "language-slice-replace-1-2"},
	}
	languages2_2 := []*Language{
		{Code: "language-slice-replace-2-1", Name: "language-slice-replace-2-1"},
		{Code: "language-slice-replace-2-2", Name: "language-slice-replace-2-2"},
	}
	languages2_3 := &Language{Code: "language-slice-replace-3", Name: "language-slice-replace-3"}
	DB.Create(&languages2_1)
	DB.Create(&languages2_2)
	DB.Create(&languages2_3)

	// Replace
	DB.Model(&users).Association("Languages").Replace(&languages2_1, &languages2_2, languages2_3)

	AssertAssociationCount(t, users, "Languages", 5, "After Replace")

	// Delete
	if err := DB.Model(&users).Association("Languages").Delete(&users[2].Languages); err != nil {
		t.Errorf("no error should happened when deleting language, but got %v", err)
	}

	AssertAssociationCount(t, users, "Languages", 4, "after delete")

	if err := DB.Model(&users).Association("Languages").Delete(users[0].Languages[0], users[1].Languages[1]); err != nil {
		t.Errorf("no error should happened when deleting language, but got %v", err)
	}

	AssertAssociationCount(t, users, "Languages", 2, "after delete")

	// Clear
	DB.Model(&users).Association("Languages").Clear()
	AssertAssociationCount(t, users, "Languages", 0, "After Clear")
}

func TestSingleTableMany2ManyAssociation(t *testing.T) {
	user := *GetUser("many2many", Config{Friends: 2})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	CheckUser(t, user, user)

	// Find
	var user2 User
	DB.Find(&user2, "id = ?", user.ID)
	DB.Model(&user2).Association("Friends").Find(&user2.Friends)

	CheckUser(t, user2, user)

	// Count
	AssertAssociationCount(t, user, "Friends", 2, "")

	// Append
	friend := *GetUser("friend", Config{})

	if err := DB.Model(&user2).Association("Friends").Append(&friend); err != nil {
		t.Fatalf("Error happened when append account, got %v", err)
	}

	user.Friends = append(user.Friends, &friend)
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user, "Friends", 3, "AfterAppend")

	friends := []*User{GetUser("friend-append-1", Config{}), GetUser("friend-append-2", Config{})}

	if err := DB.Model(&user2).Association("Friends").Append(&friends); err != nil {
		t.Fatalf("Error happened when append friend, got %v", err)
	}

	user.Friends = append(user.Friends, friends...)

	CheckUser(t, user2, user)

	AssertAssociationCount(t, user, "Friends", 5, "AfterAppendSlice")

	// Replace
	friend2 := *GetUser("friend-replace-2", Config{})

	if err := DB.Model(&user2).Association("Friends").Replace(&friend2); err != nil {
		t.Fatalf("Error happened when append friend, got %v", err)
	}

	user.Friends = []*User{&friend2}
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user2, "Friends", 1, "AfterReplace")

	// Delete
	if err := DB.Model(&user2).Association("Friends").Delete(&User{}); err != nil {
		t.Fatalf("Error happened when delete friend, got %v", err)
	}
	AssertAssociationCount(t, user2, "Friends", 1, "after delete non-existing data")

	if err := DB.Model(&user2).Association("Friends").Delete(&friend2); err != nil {
		t.Fatalf("Error happened when delete Friends, got %v", err)
	}
	AssertAssociationCount(t, user2, "Friends", 0, "after delete")

	// Prepare Data for Clear
	if err := DB.Model(&user2).Association("Friends").Append(&friend); err != nil {
		t.Fatalf("Error happened when append Friends, got %v", err)
	}

	AssertAssociationCount(t, user2, "Friends", 1, "after prepare data")

	// Clear
	if err := DB.Model(&user2).Association("Friends").Clear(); err != nil {
		t.Errorf("Error happened when clear Friends, got %v", err)
	}

	AssertAssociationCount(t, user2, "Friends", 0, "after clear")
}

func TestSingleTableMany2ManyAssociationForSlice(t *testing.T) {
	users := []User{
		*GetUser("slice-many2many-1", Config{Team: 2}),
		*GetUser("slice-many2many-2", Config{Team: 0}),
		*GetUser("slice-many2many-3", Config{Team: 4}),
	}

	DB.Create(&users)

	// Count
	AssertAssociationCount(t, users, "Team", 6, "")

	// Find
	var teams []User
	if DB.Model(&users).Association("Team").Find(&teams); len(teams) != 6 {
		t.Errorf("teams count should be %v, but got %v", 6, len(teams))
	}

	// Append
	teams1 := []User{*GetUser("friend-append-1", Config{})}
	teams2 := []User{}
	teams3 := []*User{GetUser("friend-append-3-1", Config{}), GetUser("friend-append-3-2", Config{})}

	DB.Model(&users).Association("Team").Append(&teams1, &teams2, &teams3)

	AssertAssociationCount(t, users, "Team", 9, "After Append")

	teams2_1 := []User{*GetUser("friend-replace-1", Config{}), *GetUser("friend-replace-2", Config{})}
	teams2_2 := []User{*GetUser("friend-replace-2-1", Config{}), *GetUser("friend-replace-2-2", Config{})}
	teams2_3 := GetUser("friend-replace-3-1", Config{})

	// Replace
	DB.Model(&users).Association("Team").Replace(&teams2_1, &teams2_2, teams2_3)

	AssertAssociationCount(t, users, "Team", 5, "After Replace")

	// Delete
	if err := DB.Model(&users).Association("Team").Delete(&users[2].Team); err != nil {
		t.Errorf("no error should happened when deleting team, but got %v", err)
	}

	AssertAssociationCount(t, users, "Team", 4, "after delete")

	if err := DB.Model(&users).Association("Team").Delete(users[0].Team[0], users[1].Team[1]); err != nil {
		t.Errorf("no error should happened when deleting team, but got %v", err)
	}

	AssertAssociationCount(t, users, "Team", 2, "after delete")

	// Clear
	DB.Model(&users).Association("Team").Clear()
	AssertAssociationCount(t, users, "Team", 0, "After Clear")
}

func TestDuplicateMany2ManyAssociation(t *testing.T) {
	user1 := User{Name: "TestDuplicateMany2ManyAssociation-1", Languages: []Language{
		{Code: "TestDuplicateMany2ManyAssociation-language-1"},
		{Code: "TestDuplicateMany2ManyAssociation-language-2"},
	}}

	user2 := User{Name: "TestDuplicateMany2ManyAssociation-1", Languages: []Language{
		{Code: "TestDuplicateMany2ManyAssociation-language-1"},
		{Code: "TestDuplicateMany2ManyAssociation-language-3"},
	}}
	users := []*User{&user1, &user2}
	var err error
	err = DB.Session(&gorm.Session{FullSaveAssociations: true}).Save(users).Error
	AssertEqual(t, nil, err)

	var findUser1 User
	err = DB.Preload("Languages").Where("id = ?", user1.ID).First(&findUser1).Error
	AssertEqual(t, nil, err)
	AssertEqual(t, user1, findUser1)

	var findUser2 User
	err = DB.Preload("Languages").Where("id = ?", user2.ID).First(&findUser2).Error
	AssertEqual(t, nil, err)
	AssertEqual(t, user2, findUser2)
}

func TestConcurrentMany2ManyAssociation(t *testing.T) {
	db, err := OpenTestConnection(&gorm.Config{})
	if err != nil {
		t.Fatalf("open test connection failed, err: %+v", err)
	}

	count := 3

	var languages []Language
	for i := 0; i < count; i++ {
		language := Language{Code: fmt.Sprintf("consurrent %d", i)}
		db.Create(&language)
		languages = append(languages, language)
	}

	user := User{}
	db.Create(&user)
	db.Preload("Languages").FirstOrCreate(&user)

	var wg sync.WaitGroup
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func(user User, language Language) {
			err := db.Model(&user).Association("Languages").Append(&language)
			AssertEqual(t, err, nil)

			wg.Done()
		}(user, languages[i])
	}
	wg.Wait()

	var find User
	err = db.Preload(clause.Associations).Where("id = ?", user.ID).First(&find).Error
	AssertEqual(t, err, nil)
	AssertAssociationCount(t, find, "Languages", int64(count), "after concurrent append")
}

func TestMany2ManyDuplicateBelongsToAssociation(t *testing.T) {
	user1 := User{Name: "TestMany2ManyDuplicateBelongsToAssociation-1", Friends: []*User{
		{Name: "TestMany2ManyDuplicateBelongsToAssociation-friend-1", Company: Company{
			ID:   1,
			Name: "Test-company-1",
		}},
	}}

	user2 := User{Name: "TestMany2ManyDuplicateBelongsToAssociation-2", Friends: []*User{
		{Name: "TestMany2ManyDuplicateBelongsToAssociation-friend-2", Company: Company{
			ID:   1,
			Name: "Test-company-1",
		}},
	}}
	users := []*User{&user1, &user2}
	var err error
	err = DB.Session(&gorm.Session{FullSaveAssociations: true}).Save(users).Error
	AssertEqual(t, nil, err)

	var findUser1 User
	err = DB.Preload("Friends.Company").Where("id = ?", user1.ID).First(&findUser1).Error
	AssertEqual(t, nil, err)
	AssertEqual(t, user1, findUser1)

	var findUser2 User
	err = DB.Preload("Friends.Company").Where("id = ?", user2.ID).First(&findUser2).Error
	AssertEqual(t, nil, err)
	AssertEqual(t, user2, findUser2)
}
