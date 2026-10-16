package tests_test

import (
	"os"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"

	. "gorm.io/gorm/utils/tests"
)

type Config struct {
	Account   bool
	Pets      int
	Toys      int
	Company   bool
	Manager   bool
	Team      int
	Languages int
	Friends   int
	NamedPet  bool
}

func GetUser(name string, config Config) *User {
	var (
		birthday = time.Now().Round(time.Second)
		user     = User{
			Name:     name,
			Age:      18,
			Birthday: &birthday,
		}
	)

	if config.Account {
		user.Account = Account{Number: name + "_account"}
	}

	for i := 0; i < config.Pets; i++ {
		user.Pets = append(user.Pets, &Pet{Name: name + "_pet_" + strconv.Itoa(i+1)})
	}

	for i := 0; i < config.Toys; i++ {
		user.Toys = append(user.Toys, Toy{Name: name + "_toy_" + strconv.Itoa(i+1)})
	}

	if config.Company {
		user.Company = Company{Name: "company-" + name}
	}

	if config.Manager {
		user.Manager = GetUser(name+"_manager", Config{})
	}

	for i := 0; i < config.Team; i++ {
		user.Team = append(user.Team, *GetUser(name+"_team_"+strconv.Itoa(i+1), Config{}))
	}

	for i := 0; i < config.Languages; i++ {
		name := name + "_locale_" + strconv.Itoa(i+1)
		language := Language{Code: name, Name: name}
		user.Languages = append(user.Languages, language)
	}

	for i := 0; i < config.Friends; i++ {
		user.Friends = append(user.Friends, GetUser(name+"_friend_"+strconv.Itoa(i+1), Config{}))
	}

	if config.NamedPet {
		user.NamedPet = &Pet{Name: name + "_namepet"}
	}

	return &user
}

func CheckPetUnscoped(t *testing.T, pet Pet, expect Pet) {
	doCheckPet(t, pet, expect, true)
}

func CheckPet(t *testing.T, pet Pet, expect Pet) {
	doCheckPet(t, pet, expect, false)
}

func doCheckPet(t *testing.T, pet Pet, expect Pet, unscoped bool) {
	if pet.ID != 0 {
		var newPet Pet
		if err := db(unscoped).Where("id = ?", pet.ID).First(&newPet).Error; err != nil {
			t.Fatalf("errors happened when query: %v", err)
		} else {
			AssertObjEqual(t, newPet, pet, "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "UserID", "Name")
			AssertObjEqual(t, newPet, expect, "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "UserID", "Name")
		}
	}

	AssertObjEqual(t, pet, expect, "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "UserID", "Name")

	AssertObjEqual(t, pet.Toy, expect.Toy, "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "Name", "OwnerID", "OwnerType")

	if expect.Toy.Name != "" && expect.Toy.OwnerType != "pets" {
		t.Errorf("toys's OwnerType, expect: %v, got %v", "pets", expect.Toy.OwnerType)
	}
}

func CheckUserUnscoped(t *testing.T, user User, expect User) {
	doCheckUser(t, user, expect, true)
}

func CheckUser(t *testing.T, user User, expect User) {
	doCheckUser(t, user, expect, false)
}

func doCheckUser(t *testing.T, user User, expect User, unscoped bool) {
	if user.ID != 0 {
		var newUser User
		if err := db(unscoped).Where("id = ?", user.ID).First(&newUser).Error; err != nil {
			t.Fatalf("errors happened when query: %v", err)
		} else {
			AssertObjEqual(t, newUser, user, "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "Name", "Age", "Birthday", "CompanyID", "ManagerID", "Active")
		}
	}

	AssertObjEqual(t, user, expect, "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "Name", "Age", "Birthday", "CompanyID", "ManagerID", "Active")

	t.Run("Account", func(t *testing.T) {
		AssertObjEqual(t, user.Account, expect.Account, "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "UserID", "Number")

		if user.Account.Number != "" {
			if !user.Account.UserID.Valid {
				t.Errorf("Account's foreign key should be saved")
			} else {
				var account Account
				db(unscoped).First(&account, "user_id = ?", user.ID)
				AssertObjEqual(t, account, user.Account, "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "UserID", "Number")
			}
		}
	})

	t.Run("Pets", func(t *testing.T) {
		if len(user.Pets) != len(expect.Pets) {
			t.Fatalf("pets should equal, expect: %v, got %v", len(expect.Pets), len(user.Pets))
		}

		sort.Slice(user.Pets, func(i, j int) bool {
			return user.Pets[i].ID > user.Pets[j].ID
		})

		sort.Slice(expect.Pets, func(i, j int) bool {
			return expect.Pets[i].ID > expect.Pets[j].ID
		})

		for idx, pet := range user.Pets {
			if pet == nil || expect.Pets[idx] == nil {
				t.Errorf("pets#%v should equal, expect: %v, got %v", idx, expect.Pets[idx], pet)
			} else {
				doCheckPet(t, *pet, *expect.Pets[idx], unscoped)
			}
		}
	})

	t.Run("Toys", func(t *testing.T) {
		if len(user.Toys) != len(expect.Toys) {
			t.Fatalf("toys should equal, expect: %v, got %v", len(expect.Toys), len(user.Toys))
		}

		sort.Slice(user.Toys, func(i, j int) bool {
			return user.Toys[i].ID > user.Toys[j].ID
		})

		sort.Slice(expect.Toys, func(i, j int) bool {
			return expect.Toys[i].ID > expect.Toys[j].ID
		})

		for idx, toy := range user.Toys {
			if toy.OwnerType != "users" {
				t.Errorf("toys's OwnerType, expect: %v, got %v", "users", toy.OwnerType)
			}

			AssertObjEqual(t, toy, expect.Toys[idx], "ID", "CreatedAt", "UpdatedAt", "Name", "OwnerID", "OwnerType")
		}
	})

	t.Run("Company", func(t *testing.T) {
		AssertObjEqual(t, user.Company, expect.Company, "ID", "Name")
	})

	t.Run("Manager", func(t *testing.T) {
		if user.Manager != nil {
			if user.ManagerID == nil {
				t.Errorf("Manager's foreign key should be saved")
			} else {
				var manager User
				db(unscoped).First(&manager, "id = ?", *user.ManagerID)
				AssertObjEqual(t, manager, user.Manager, "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "Name", "Age", "Birthday", "CompanyID", "ManagerID", "Active")
				AssertObjEqual(t, manager, expect.Manager, "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "Name", "Age", "Birthday", "CompanyID", "ManagerID", "Active")
			}
		} else if user.ManagerID != nil {
			t.Errorf("Manager should not be created for zero value, got: %+v", user.ManagerID)
		}
	})

	t.Run("Team", func(t *testing.T) {
		if len(user.Team) != len(expect.Team) {
			t.Fatalf("Team should equal, expect: %v, got %v", len(expect.Team), len(user.Team))
		}

		sort.Slice(user.Team, func(i, j int) bool {
			return user.Team[i].ID > user.Team[j].ID
		})

		sort.Slice(expect.Team, func(i, j int) bool {
			return expect.Team[i].ID > expect.Team[j].ID
		})

		for idx, team := range user.Team {
			AssertObjEqual(t, team, expect.Team[idx], "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "Name", "Age", "Birthday", "CompanyID", "ManagerID", "Active")
		}
	})

	t.Run("Languages", func(t *testing.T) {
		if len(user.Languages) != len(expect.Languages) {
			t.Fatalf("Languages should equal, expect: %v, got %v", len(expect.Languages), len(user.Languages))
		}

		sort.Slice(user.Languages, func(i, j int) bool {
			return strings.Compare(user.Languages[i].Code, user.Languages[j].Code) > 0
		})

		sort.Slice(expect.Languages, func(i, j int) bool {
			return strings.Compare(expect.Languages[i].Code, expect.Languages[j].Code) > 0
		})
		for idx, language := range user.Languages {
			AssertObjEqual(t, language, expect.Languages[idx], "Code", "Name")
		}
	})

	t.Run("Friends", func(t *testing.T) {
		if len(user.Friends) != len(expect.Friends) {
			t.Fatalf("Friends should equal, expect: %v, got %v", len(expect.Friends), len(user.Friends))
		}

		sort.Slice(user.Friends, func(i, j int) bool {
			return user.Friends[i].ID > user.Friends[j].ID
		})

		sort.Slice(expect.Friends, func(i, j int) bool {
			return expect.Friends[i].ID > expect.Friends[j].ID
		})

		for idx, friend := range user.Friends {
			AssertObjEqual(t, friend, expect.Friends[idx], "ID", "CreatedAt", "UpdatedAt", "DeletedAt", "Name", "Age", "Birthday", "CompanyID", "ManagerID", "Active")
		}
	})
}

func tidbSkip(t *testing.T, reason string) {
	if isTiDB() {
		t.Skipf("This test case skipped, because of TiDB '%s'", reason)
	}
}

func isTiDB() bool {
	return os.Getenv("GORM_DIALECT") == "tidb"
}

func db(unscoped bool) *gorm.DB {
	if unscoped {
		return DB.Unscoped()
	} else {
		return DB
	}
}
