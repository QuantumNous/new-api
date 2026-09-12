package tests_test

import (
	"regexp"
	"sort"
	"testing"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

func TestJoins(t *testing.T) {
	user := *GetUser("joins-1", Config{Company: true, Manager: true, Account: true, NamedPet: false})

	DB.Create(&user)

	var user2 User
	if err := DB.Joins("NamedPet").Joins("Company").Joins("Manager").Joins("Account").First(&user2, "users.name = ?", user.Name).Error; err != nil {
		t.Fatalf("Failed to load with joins, got error: %v", err)
	}

	CheckUser(t, user2, user)
}

func TestJoinsForSlice(t *testing.T) {
	users := []User{
		*GetUser("slice-joins-1", Config{Company: true, Manager: true, Account: true}),
		*GetUser("slice-joins-2", Config{Company: true, Manager: true, Account: true}),
		*GetUser("slice-joins-3", Config{Company: true, Manager: true, Account: true}),
	}

	DB.Create(&users)

	var userIDs []uint
	for _, user := range users {
		userIDs = append(userIDs, user.ID)
	}

	var users2 []User
	if err := DB.Joins("Company").Joins("Manager").Joins("Account").Find(&users2, "users.id IN ?", userIDs).Error; err != nil {
		t.Fatalf("Failed to load with joins, got error: %v", err)
	} else if len(users2) != len(users) {
		t.Fatalf("Failed to load join users, got: %v, expect: %v", len(users2), len(users))
	}

	sort.Slice(users2, func(i, j int) bool {
		return users2[i].ID > users2[j].ID
	})

	sort.Slice(users, func(i, j int) bool {
		return users[i].ID > users[j].ID
	})

	for idx, user := range users {
		CheckUser(t, user, users2[idx])
	}
}

func TestJoinConds(t *testing.T) {
	user := *GetUser("joins-conds", Config{Account: true, Pets: 3})
	DB.Save(&user)

	var users1 []User
	DB.Joins("inner join pets on pets.user_id = users.id").Where("users.name = ?", user.Name).Find(&users1)
	if len(users1) != 3 {
		t.Errorf("should find two users using left join, but got %v", len(users1))
	}

	var users2 []User
	DB.Joins("inner join pets on pets.user_id = users.id AND pets.name = ?", user.Pets[0].Name).Where("users.name = ?", user.Name).First(&users2)
	if len(users2) != 1 {
		t.Errorf("should find one users using left join with conditions, but got %v", len(users2))
	}

	var users3 []User
	DB.Joins("inner join pets on pets.user_id = users.id AND pets.name = ?", user.Pets[0].Name).Joins("join accounts on accounts.user_id = users.id AND accounts.number = ?", user.Account.Number).Where("users.name = ?", user.Name).First(&users3)
	if len(users3) != 1 {
		t.Errorf("should find one users using multiple left join conditions, but got %v", len(users3))
	}

	var users4 []User
	DB.Joins("inner join pets on pets.user_id = users.id AND pets.name = ?", user.Pets[0].Name).Joins("join accounts on accounts.user_id = users.id AND accounts.number = ?", user.Account.Number+"non-exist").Where("users.name = ?", user.Name).First(&users4)
	if len(users4) != 0 {
		t.Errorf("should find no user when searching with unexisting credit card, but got %v", len(users4))
	}

	var users5 []User
	db5 := DB.Joins("inner join pets on pets.user_id = users.id AND pets.name = ?", user.Pets[0].Name).Joins("join accounts on accounts.user_id = users.id AND accounts.number = ?", user.Account.Number).Where(User{Model: gorm.Model{ID: 1}}).Where(Account{Model: gorm.Model{ID: 1}}).Not(Pet{Model: gorm.Model{ID: 1}}).Find(&users5)
	if db5.Error != nil {
		t.Errorf("Should not raise error for join where identical fields in different tables. Error: %s", db5.Error.Error())
	}

	var users6 []User
	DB.Joins("inner join pets on pets.user_id = users.id AND pets.name = @Name", user.Pets[0]).Where("users.name = ?", user.Name).First(&users6)
	if len(users6) != 1 {
		t.Errorf("should find one users using left join with conditions, but got %v", len(users6))
	}

	dryDB := DB.Session(&gorm.Session{DryRun: true})
	stmt := dryDB.Joins("left join pets on pets.user_id = users.id AND pets.name = ?", user.Pets[0].Name).Joins("join accounts on accounts.user_id = users.id AND accounts.number = ?", user.Account.Number).Where(User{Model: gorm.Model{ID: 1}}).Where(Account{Model: gorm.Model{ID: 1}}).Not(Pet{Model: gorm.Model{ID: 1}}).Find(&users5).Statement

	if !regexp.MustCompile("SELECT .* FROM .users. left join pets.*join accounts.*").MatchString(stmt.SQL.String()) {
		t.Errorf("joins should be ordered, but got %v", stmt.SQL.String())
	}

	iv := DB.Table(`table_invoices`).Select(`seller, SUM(total) as total, SUM(paid) as paid, SUM(balance) as balance`).Group(`seller`)
	stmt = dryDB.Table(`table_employees`).Select(`id, name, iv.total, iv.paid, iv.balance`).Joins(`LEFT JOIN (?) AS iv ON iv.seller = table_employees.id`, iv).Scan(&user).Statement
	if !regexp.MustCompile("SELECT id, name, iv.total, iv.paid, iv.balance FROM .table_employees. LEFT JOIN \\(SELECT seller, SUM\\(total\\) as total, SUM\\(paid\\) as paid, SUM\\(balance\\) as balance FROM .table_invoices. GROUP BY .seller.\\) AS iv ON iv.seller = table_employees.id").MatchString(stmt.SQL.String()) {
		t.Errorf("joins should be ordered, but got %v", stmt.SQL.String())
	}
}

func TestJoinOn(t *testing.T) {
	user := *GetUser("joins-on", Config{Pets: 2})
	DB.Save(&user)

	var user1 User
	onQuery := DB.Where(&Pet{Name: "joins-on_pet_1"})

	if err := DB.Joins("NamedPet", onQuery).Where("users.name = ?", user.Name).First(&user1).Error; err != nil {
		t.Fatalf("Failed to load with joins on, got error: %v", err)
	}

	AssertEqual(t, user1.NamedPet.Name, "joins-on_pet_1")

	onQuery2 := DB.Where(&Pet{Name: "joins-on_pet_2"})
	var user2 User
	if err := DB.Joins("NamedPet", onQuery2).Where("users.name = ?", user.Name).First(&user2).Error; err != nil {
		t.Fatalf("Failed to load with joins on, got error: %v", err)
	}
	AssertEqual(t, user2.NamedPet.Name, "joins-on_pet_2")
}

func TestJoinsWithSelect(t *testing.T) {
	type result struct {
		ID    uint
		PetID uint
		Name  string
	}

	user := *GetUser("joins_with_select", Config{Pets: 2})
	DB.Save(&user)

	var results []result

	DB.Table("users").Select("users.id, pets.id as pet_id, pets.name").Joins("left join pets on pets.user_id = users.id").Where("users.name = ?", "joins_with_select").Scan(&results)

	sort.Slice(results, func(i, j int) bool {
		return results[i].PetID > results[j].PetID
	})

	sort.Slice(results, func(i, j int) bool {
		return user.Pets[i].ID > user.Pets[j].ID
	})

	if len(results) != 2 || results[0].Name != user.Pets[0].Name || results[1].Name != user.Pets[1].Name {
		t.Errorf("Should find all two pets with Join select, got %+v", results)
	}
}

func TestJoinWithOmit(t *testing.T) {
	user := *GetUser("joins_with_omit", Config{Pets: 2})
	DB.Save(&user)

	results := make([]*User, 0)

	if err := DB.Table("users").Omit("name").Where("users.name = ?", "joins_with_omit").Joins("left join pets on pets.user_id = users.id").Find(&results).Error; err != nil {
		return
	}

	if len(results) != 2 || results[0].Name != "" || results[1].Name != "" {
		t.Errorf("Should find all two pets with Join omit and should not find user's name, got %+v", results)
		return
	}
}

func TestJoinCount(t *testing.T) {
	companyA := Company{Name: "A"}
	companyB := Company{Name: "B"}
	DB.Create(&companyA)
	DB.Create(&companyB)

	user := User{Name: "kingGo", CompanyID: &companyB.ID}
	DB.Create(&user)

	query := DB.Model(&User{}).Joins("Company")
	// Bug happens when .Count is called on a query.
	// Removing the below two lines or downgrading to gorm v1.20.12 will make this test pass.
	var total int64
	query.Count(&total)

	var result User

	// Incorrectly generates a 'SELECT *' query which causes companies.id to overwrite users.id
	if err := query.First(&result, user.ID).Error; err != nil {
		t.Fatalf("Failed, got error: %v", err)
	}

	if result.ID != user.ID {
		t.Fatalf("result's id, %d, doesn't match user's id, %d", result.ID, user.ID)
	}
}

func TestJoinWithSoftDeleted(t *testing.T) {
	user := GetUser("TestJoinWithSoftDeletedUser", Config{Account: true, NamedPet: true})
	DB.Create(&user)

	var user1 User
	DB.Model(&User{}).Joins("NamedPet").Joins("Account").First(&user1, user.ID)
	if user1.NamedPet == nil || user1.Account.ID == 0 {
		t.Fatalf("joins NamedPet and Account should not empty:%v", user1)
	}

	// Account should empty
	DB.Delete(&user1.Account)

	var user2 User
	DB.Model(&User{}).Joins("NamedPet").Joins("Account").First(&user2, user.ID)
	if user2.NamedPet == nil || user2.Account.ID != 0 {
		t.Fatalf("joins Account should not empty:%v", user2)
	}

	// NamedPet should empty
	DB.Delete(&user1.NamedPet)

	var user3 User
	DB.Model(&User{}).Joins("NamedPet").Joins("Account").First(&user3, user.ID)
	if user3.NamedPet != nil || user2.Account.ID != 0 {
		t.Fatalf("joins NamedPet and Account should not empty:%v", user2)
	}
}

func TestInnerJoins(t *testing.T) {
	user := *GetUser("inner-joins-1", Config{Company: true, Manager: true, Account: true, NamedPet: false})

	DB.Create(&user)

	var user2 User
	var err error
	err = DB.InnerJoins("Company").InnerJoins("Manager").InnerJoins("Account").First(&user2, "users.name = ?", user.Name).Error
	AssertEqual(t, err, nil)
	CheckUser(t, user2, user)

	// inner join and NamedPet is nil
	err = DB.InnerJoins("NamedPet").InnerJoins("Company").InnerJoins("Manager").InnerJoins("Account").First(&user2, "users.name = ?", user.Name).Error
	AssertEqual(t, err, gorm.ErrRecordNotFound)

	// mixed inner join and left join
	var user3 User
	err = DB.Joins("NamedPet").InnerJoins("Company").InnerJoins("Manager").InnerJoins("Account").First(&user3, "users.name = ?", user.Name).Error
	AssertEqual(t, err, nil)
	CheckUser(t, user3, user)
}

func TestJoinWithSameColumnName(t *testing.T) {
	user := GetUser("TestJoinWithSameColumnName", Config{
		Languages: 1,
		Pets:      1,
	})
	DB.Create(user)
	type UserSpeak struct {
		UserID       uint
		LanguageCode string
	}
	type Result struct {
		User
		UserSpeak
		Language
		Pet
	}

	results := make([]Result, 0, 1)
	DB.Select("users.*, user_speaks.*,  languages.*, pets.*").Table("users").Joins("JOIN user_speaks ON user_speaks.user_id = users.id").
		Joins("JOIN languages ON languages.code = user_speaks.language_code").
		Joins("LEFT OUTER JOIN pets ON pets.user_id = users.id").Find(&results)

	if len(results) == 0 {
		t.Fatalf("no record find")
	} else if results[0].Pet.UserID == nil || *(results[0].Pet.UserID) != user.ID {
		t.Fatalf("wrong user id in pet")
	} else if results[0].Pet.Name != user.Pets[0].Name {
		t.Fatalf("wrong pet name")
	}
}

func TestJoinArgsWithDB(t *testing.T) {
	user := *GetUser("joins-args-db", Config{Pets: 2})
	DB.Save(&user)

	// test where
	var user1 User
	onQuery := DB.Where(&Pet{Name: "joins-args-db_pet_2"})
	if err := DB.Joins("NamedPet", onQuery).Where("users.name = ?", user.Name).First(&user1).Error; err != nil {
		t.Fatalf("Failed to load with joins on, got error: %v", err)
	}

	AssertEqual(t, user1.NamedPet.Name, "joins-args-db_pet_2")

	// test where and omit
	onQuery2 := DB.Where(&Pet{Name: "joins-args-db_pet_2"}).Omit("Name")
	var user2 User
	if err := DB.Joins("NamedPet", onQuery2).Where("users.name = ?", user.Name).First(&user2).Error; err != nil {
		t.Fatalf("Failed to load with joins on, got error: %v", err)
	}
	AssertEqual(t, user2.NamedPet.ID, user1.NamedPet.ID)
	AssertEqual(t, user2.NamedPet.Name, "")

	// test where and select
	onQuery3 := DB.Where(&Pet{Name: "joins-args-db_pet_2"}).Select("Name")
	var user3 User
	if err := DB.Joins("NamedPet", onQuery3).Where("users.name = ?", user.Name).First(&user3).Error; err != nil {
		t.Fatalf("Failed to load with joins on, got error: %v", err)
	}
	AssertEqual(t, user3.NamedPet.ID, 0)
	AssertEqual(t, user3.NamedPet.Name, "joins-args-db_pet_2")

	// test select
	onQuery4 := DB.Select("ID")
	var user4 User
	if err := DB.Joins("NamedPet", onQuery4).Where("users.name = ?", user.Name).First(&user4).Error; err != nil {
		t.Fatalf("Failed to load with joins on, got error: %v", err)
	}
	if user4.NamedPet.ID == 0 {
		t.Fatal("Pet ID can not be empty")
	}
	AssertEqual(t, user4.NamedPet.Name, "")
}

func TestNestedJoins(t *testing.T) {
	users := []User{
		{
			Name: "nested-joins-1",
			Manager: &User{
				Name: "nested-joins-manager-1",
				Company: Company{
					Name: "nested-joins-manager-company-1",
				},
				NamedPet: &Pet{
					Name: "nested-joins-manager-namepet-1",
					Toy: Toy{
						Name: "nested-joins-manager-namepet-toy-1",
					},
				},
			},
			NamedPet: &Pet{Name: "nested-joins-namepet-1", Toy: Toy{Name: "nested-joins-namepet-toy-1"}},
		},
		{
			Name:     "nested-joins-2",
			Manager:  GetUser("nested-joins-manager-2", Config{Company: true, NamedPet: true}),
			NamedPet: &Pet{Name: "nested-joins-namepet-2", Toy: Toy{Name: "nested-joins-namepet-toy-2"}},
		},
	}

	DB.Create(&users)

	var userIDs []uint
	for _, user := range users {
		userIDs = append(userIDs, user.ID)
	}

	var users2 []User
	if err := DB.
		Joins("Manager").
		Joins("Manager.Company").
		Joins("Manager.NamedPet").
		Joins("Manager.NamedPet.Toy").
		Joins("NamedPet").
		Joins("NamedPet.Toy").
		Find(&users2, "users.id IN ?", userIDs).Error; err != nil {
		t.Fatalf("Failed to load with joins, got error: %v", err)
	} else if len(users2) != len(users) {
		t.Fatalf("Failed to load join users, got: %v, expect: %v", len(users2), len(users))
	}

	sort.Slice(users2, func(i, j int) bool {
		return users2[i].ID > users2[j].ID
	})

	sort.Slice(users, func(i, j int) bool {
		return users[i].ID > users[j].ID
	})

	for idx, user := range users {
		// user
		CheckUser(t, user, users2[idx])
		if users2[idx].Manager == nil {
			t.Fatalf("Failed to load Manager")
		}
		// manager
		CheckUser(t, *user.Manager, *users2[idx].Manager)
		// user pet
		if users2[idx].NamedPet == nil {
			t.Fatalf("Failed to load NamedPet")
		}
		CheckPet(t, *user.NamedPet, *users2[idx].NamedPet)
		// manager pet
		if users2[idx].Manager.NamedPet == nil {
			t.Fatalf("Failed to load NamedPet")
		}
		CheckPet(t, *user.Manager.NamedPet, *users2[idx].Manager.NamedPet)
	}
}
