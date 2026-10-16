package tests_test

import (
	"encoding/json"
	"regexp"
	"sort"
	"strconv"
	"sync"
	"testing"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	. "gorm.io/gorm/utils/tests"
)

func TestPreloadWithAssociations(t *testing.T) {
	user := *GetUser("preload_with_associations", Config{
		Account:   true,
		Pets:      2,
		Toys:      3,
		Company:   true,
		Manager:   true,
		Team:      4,
		Languages: 3,
		Friends:   1,
	})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	CheckUser(t, user, user)

	var user2 User
	DB.Preload(clause.Associations).Find(&user2, "id = ?", user.ID)
	CheckUser(t, user2, user)

	user3 := *GetUser("preload_with_associations_new", Config{
		Account:   true,
		Pets:      2,
		Toys:      3,
		Company:   true,
		Manager:   true,
		Team:      4,
		Languages: 3,
		Friends:   1,
	})

	DB.Preload(clause.Associations).Find(&user3, "id = ?", user.ID)
	CheckUser(t, user3, user)
}

func TestNestedPreload(t *testing.T) {
	user := *GetUser("nested_preload", Config{Pets: 2})

	for idx, pet := range user.Pets {
		pet.Toy = Toy{Name: "toy_nested_preload_" + strconv.Itoa(idx+1)}
	}

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	var user2 User
	DB.Preload("Pets.Toy").Find(&user2, "id = ?", user.ID)
	CheckUser(t, user2, user)

	var user3 User
	DB.Preload(clause.Associations+"."+clause.Associations).Find(&user3, "id = ?", user.ID)
	CheckUser(t, user3, user)

	var user4 *User
	DB.Preload("Pets.Toy").Find(&user4, "id = ?", user.ID)
	CheckUser(t, *user4, user)
}

func TestNestedPreloadForSlice(t *testing.T) {
	users := []User{
		*GetUser("slice_nested_preload_1", Config{Pets: 2}),
		*GetUser("slice_nested_preload_2", Config{Pets: 0}),
		*GetUser("slice_nested_preload_3", Config{Pets: 3}),
	}

	for _, user := range users {
		for idx, pet := range user.Pets {
			pet.Toy = Toy{Name: user.Name + "_toy_nested_preload_" + strconv.Itoa(idx+1)}
		}
	}

	if err := DB.Create(&users).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	var userIDs []uint
	for _, user := range users {
		userIDs = append(userIDs, user.ID)
	}

	var users2 []User
	DB.Preload("Pets.Toy").Find(&users2, "id IN ?", userIDs)

	for idx, user := range users2 {
		CheckUser(t, user, users[idx])
	}
}

func TestPreloadWithConds(t *testing.T) {
	users := []User{
		*GetUser("slice_nested_preload_1", Config{Account: true}),
		*GetUser("slice_nested_preload_2", Config{Account: false}),
		*GetUser("slice_nested_preload_3", Config{Account: true}),
	}

	if err := DB.Create(&users).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	var userIDs []uint
	for _, user := range users {
		userIDs = append(userIDs, user.ID)
	}

	var users2 []User
	DB.Preload("Account", clause.Eq{Column: "number", Value: users[0].Account.Number}).Find(&users2, "id IN ?", userIDs)
	sort.Slice(users2, func(i, j int) bool {
		return users2[i].ID < users2[j].ID
	})

	for idx, user := range users2[1:2] {
		if user.Account.Number != "" {
			t.Errorf("No account should found for user %v but got %v", idx+2, user.Account.Number)
		}
	}

	CheckUser(t, users2[0], users[0])

	var users3 []User
	if err := DB.Preload("Account", func(tx *gorm.DB) *gorm.DB {
		return tx.Table("accounts AS a").Select("a.*")
	}).Find(&users3, "id IN ?", userIDs).Error; err != nil {
		t.Errorf("failed to query, got error %v", err)
	}
	sort.Slice(users3, func(i, j int) bool {
		return users2[i].ID < users2[j].ID
	})

	for i, u := range users3 {
		CheckUser(t, u, users[i])
	}

	var user4 User
	DB.Delete(&users3[0].Account)

	if err := DB.Preload(clause.Associations).Take(&user4, "id = ?", users3[0].ID).Error; err != nil || user4.Account.ID != 0 {
		t.Errorf("failed to query, got error %v, account: %#v", err, user4.Account)
	}

	if err := DB.Preload(clause.Associations, func(tx *gorm.DB) *gorm.DB {
		return tx.Unscoped()
	}).Take(&user4, "id = ?", users3[0].ID).Error; err != nil || user4.Account.ID == 0 {
		t.Errorf("failed to query, got error %v, account: %#v", err, user4.Account)
	}
}

func TestNestedPreloadWithConds(t *testing.T) {
	users := []User{
		*GetUser("slice_nested_preload_1", Config{Pets: 2}),
		*GetUser("slice_nested_preload_2", Config{Pets: 0}),
		*GetUser("slice_nested_preload_3", Config{Pets: 3}),
	}

	for _, user := range users {
		for idx, pet := range user.Pets {
			pet.Toy = Toy{Name: user.Name + "_toy_nested_preload_" + strconv.Itoa(idx+1)}
		}
	}

	if err := DB.Create(&users).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	var userIDs []uint
	for _, user := range users {
		userIDs = append(userIDs, user.ID)
	}

	var users2 []User
	DB.Preload("Pets.Toy", "name like ?", `%preload_3`).Find(&users2, "id IN ?", userIDs)

	for idx, user := range users2[0:2] {
		for _, pet := range user.Pets {
			if pet.Toy.Name != "" {
				t.Errorf("No toy should for user %v's pet %v but got %v", idx+1, pet.Name, pet.Toy.Name)
			}
		}
	}

	if len(users2[2].Pets) != 3 {
		t.Errorf("Invalid pet toys found for user 3 got %v", len(users2[2].Pets))
	} else {
		sort.Slice(users2[2].Pets, func(i, j int) bool {
			return users2[2].Pets[i].ID < users2[2].Pets[j].ID
		})

		for _, pet := range users2[2].Pets[0:2] {
			if pet.Toy.Name != "" {
				t.Errorf("No toy should for user %v's pet %v but got %v", 3, pet.Name, pet.Toy.Name)
			}
		}

		CheckPet(t, *users2[2].Pets[2], *users[2].Pets[2])
	}
}

func TestPreloadEmptyData(t *testing.T) {
	user := *GetUser("user_without_associations", Config{})
	DB.Create(&user)

	DB.Preload("Team").Preload("Languages").Preload("Friends").First(&user, "name = ?", user.Name)

	if r, err := json.Marshal(&user); err != nil {
		t.Errorf("failed to marshal users, got error %v", err)
	} else if !regexp.MustCompile(`"Team":\[\],"Languages":\[\],"Friends":\[\]`).MatchString(string(r)) {
		t.Errorf("json marshal is not empty slice, got %v", string(r))
	}

	var results []User
	DB.Preload("Team").Preload("Languages").Preload("Friends").Find(&results, "name = ?", user.Name)

	if r, err := json.Marshal(&results); err != nil {
		t.Errorf("failed to marshal users, got error %v", err)
	} else if !regexp.MustCompile(`"Team":\[\],"Languages":\[\],"Friends":\[\]`).MatchString(string(r)) {
		t.Errorf("json marshal is not empty slice, got %v", string(r))
	}
}

func TestPreloadGoroutine(t *testing.T) {
	var wg sync.WaitGroup

	wg.Add(10)
	for i := 0; i < 10; i++ {
		go func() {
			defer wg.Done()
			var user2 []User
			tx := DB.Where("id = ?", 1).Session(&gorm.Session{})

			if err := tx.Preload("Team").Find(&user2).Error; err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
}

func TestPreloadWithDiffModel(t *testing.T) {
	user := *GetUser("preload_with_diff_model", Config{Account: true})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	var result struct {
		Something string
		User
	}

	DB.Model(User{}).Preload("Account", clause.Eq{Column: "number", Value: user.Account.Number}).Select(
		"users.*, 'yo' as something").First(&result, "name = ?", user.Name)

	CheckUser(t, user, result.User)
}

func TestNestedPreloadWithUnscoped(t *testing.T) {
	user := *GetUser("nested_preload", Config{Pets: 1})
	pet := user.Pets[0]
	pet.Toy = Toy{Name: "toy_nested_preload_" + strconv.Itoa(1)}
	pet.Toy = Toy{Name: "toy_nested_preload_" + strconv.Itoa(2)}

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	var user2 User
	DB.Preload("Pets.Toy").Find(&user2, "id = ?", user.ID)
	CheckUser(t, user2, user)

	DB.Delete(&pet)

	var user3 User
	DB.Preload(clause.Associations+"."+clause.Associations).Find(&user3, "id = ?", user.ID)
	if len(user3.Pets) != 0 {
		t.Fatalf("User.Pet[0] was deleted and should not exist.")
	}

	var user4 *User
	DB.Preload("Pets.Toy").Find(&user4, "id = ?", user.ID)
	if len(user4.Pets) != 0 {
		t.Fatalf("User.Pet[0] was deleted and should not exist.")
	}

	var user5 User
	DB.Unscoped().Preload(clause.Associations+"."+clause.Associations).Find(&user5, "id = ?", user.ID)
	CheckUserUnscoped(t, user5, user)

	var user6 *User
	DB.Unscoped().Preload("Pets.Toy").Find(&user6, "id = ?", user.ID)
	CheckUserUnscoped(t, *user6, user)
}

func TestEmbedPreload(t *testing.T) {
	type Country struct {
		ID   int `gorm:"primaryKey"`
		Name string
	}
	type EmbeddedAddress struct {
		ID        int
		Name      string
		CountryID *int
		Country   *Country
	}
	type NestedAddress struct {
		EmbeddedAddress
	}
	type Org struct {
		ID              int
		PostalAddress   EmbeddedAddress `gorm:"embedded;embeddedPrefix:postal_address_"`
		VisitingAddress EmbeddedAddress `gorm:"embedded;embeddedPrefix:visiting_address_"`
		AddressID       *int
		Address         *EmbeddedAddress
		NestedAddress   NestedAddress `gorm:"embedded;embeddedPrefix:nested_address_"`
	}

	DB.Migrator().DropTable(&Org{}, &EmbeddedAddress{}, &Country{})
	DB.AutoMigrate(&Org{}, &EmbeddedAddress{}, &Country{})

	org := Org{
		PostalAddress:   EmbeddedAddress{Name: "a1", Country: &Country{Name: "c1"}},
		VisitingAddress: EmbeddedAddress{Name: "a2", Country: &Country{Name: "c2"}},
		Address:         &EmbeddedAddress{Name: "a3", Country: &Country{Name: "c3"}},
		NestedAddress: NestedAddress{
			EmbeddedAddress: EmbeddedAddress{Name: "a4", Country: &Country{Name: "c4"}},
		},
	}
	if err := DB.Create(&org).Error; err != nil {
		t.Errorf("failed to create org, got err: %v", err)
	}

	tests := []struct {
		name     string
		preloads map[string][]interface{}
		expect   Org
	}{
		{
			name:     "address country",
			preloads: map[string][]interface{}{"Address.Country": {}},
			expect: Org{
				ID: org.ID,
				PostalAddress: EmbeddedAddress{
					ID:        org.PostalAddress.ID,
					Name:      org.PostalAddress.Name,
					CountryID: org.PostalAddress.CountryID,
					Country:   nil,
				},
				VisitingAddress: EmbeddedAddress{
					ID:        org.VisitingAddress.ID,
					Name:      org.VisitingAddress.Name,
					CountryID: org.VisitingAddress.CountryID,
					Country:   nil,
				},
				AddressID: org.AddressID,
				Address:   org.Address,
				NestedAddress: NestedAddress{EmbeddedAddress{
					ID:        org.NestedAddress.ID,
					Name:      org.NestedAddress.Name,
					CountryID: org.NestedAddress.CountryID,
					Country:   nil,
				}},
			},
		}, {
			name:     "postal address country",
			preloads: map[string][]interface{}{"PostalAddress.Country": {}},
			expect: Org{
				ID:            org.ID,
				PostalAddress: org.PostalAddress,
				VisitingAddress: EmbeddedAddress{
					ID:        org.VisitingAddress.ID,
					Name:      org.VisitingAddress.Name,
					CountryID: org.VisitingAddress.CountryID,
					Country:   nil,
				},
				AddressID: org.AddressID,
				Address:   nil,
				NestedAddress: NestedAddress{EmbeddedAddress{
					ID:        org.NestedAddress.ID,
					Name:      org.NestedAddress.Name,
					CountryID: org.NestedAddress.CountryID,
					Country:   nil,
				}},
			},
		}, {
			name:     "nested address country",
			preloads: map[string][]interface{}{"NestedAddress.EmbeddedAddress.Country": {}},
			expect: Org{
				ID: org.ID,
				PostalAddress: EmbeddedAddress{
					ID:        org.PostalAddress.ID,
					Name:      org.PostalAddress.Name,
					CountryID: org.PostalAddress.CountryID,
					Country:   nil,
				},
				VisitingAddress: EmbeddedAddress{
					ID:        org.VisitingAddress.ID,
					Name:      org.VisitingAddress.Name,
					CountryID: org.VisitingAddress.CountryID,
					Country:   nil,
				},
				AddressID:     org.AddressID,
				Address:       nil,
				NestedAddress: org.NestedAddress,
			},
		}, {
			name: "associations",
			preloads: map[string][]interface{}{
				clause.Associations: {},
				// clause.Associations won’t preload nested associations
				"Address.Country": {},
			},
			expect: org,
		},
	}

	DB = DB.Debug()
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual := Org{}
			tx := DB.Where("id = ?", org.ID).Session(&gorm.Session{})
			for name, args := range test.preloads {
				tx = tx.Preload(name, args...)
			}
			if err := tx.Find(&actual).Error; err != nil {
				t.Errorf("failed to find org, got err: %v", err)
			}
			AssertEqual(t, actual, test.expect)
		})
	}
}
