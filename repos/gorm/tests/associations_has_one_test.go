package tests_test

import (
	"testing"

	. "gorm.io/gorm/utils/tests"
)

func TestHasOneAssociation(t *testing.T) {
	user := *GetUser("hasone", Config{Account: true})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	CheckUser(t, user, user)

	// Find
	var user2 User
	DB.Find(&user2, "id = ?", user.ID)
	DB.Model(&user2).Association("Account").Find(&user2.Account)
	CheckUser(t, user2, user)

	// Count
	AssertAssociationCount(t, user, "Account", 1, "")

	// Append
	account := Account{Number: "account-has-one-append"}

	if err := DB.Model(&user2).Association("Account").Append(&account); err != nil {
		t.Fatalf("Error happened when append account, got %v", err)
	}

	if account.ID == 0 {
		t.Fatalf("Account's ID should be created")
	}

	user.Account = account
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user, "Account", 1, "AfterAppend")

	// Replace
	account2 := Account{Number: "account-has-one-replace"}

	if err := DB.Model(&user2).Association("Account").Replace(&account2); err != nil {
		t.Fatalf("Error happened when append Account, got %v", err)
	}

	if account2.ID == 0 {
		t.Fatalf("account2's ID should be created")
	}

	user.Account = account2
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user2, "Account", 1, "AfterReplace")

	// Delete
	if err := DB.Model(&user2).Association("Account").Delete(&Account{}); err != nil {
		t.Fatalf("Error happened when delete account, got %v", err)
	}
	AssertAssociationCount(t, user2, "Account", 1, "after delete non-existing data")

	if err := DB.Model(&user2).Association("Account").Delete(&account2); err != nil {
		t.Fatalf("Error happened when delete Account, got %v", err)
	}
	AssertAssociationCount(t, user2, "Account", 0, "after delete")

	// Prepare Data for Clear
	account = Account{Number: "account-has-one-append"}
	if err := DB.Model(&user2).Association("Account").Append(&account); err != nil {
		t.Fatalf("Error happened when append Account, got %v", err)
	}

	AssertAssociationCount(t, user2, "Account", 1, "after prepare data")

	// Clear
	if err := DB.Model(&user2).Association("Account").Clear(); err != nil {
		t.Errorf("Error happened when clear Account, got %v", err)
	}

	AssertAssociationCount(t, user2, "Account", 0, "after clear")
}

func TestHasOneAssociationWithSelect(t *testing.T) {
	user := *GetUser("hasone", Config{Account: true})

	DB.Omit("Account.Number").Create(&user)

	AssertAssociationCount(t, user, "Account", 1, "")

	var account Account
	DB.Model(&user).Association("Account").Find(&account)
	if account.Number != "" {
		t.Errorf("account's number should not be saved")
	}
}

func TestHasOneAssociationForSlice(t *testing.T) {
	users := []User{
		*GetUser("slice-hasone-1", Config{Account: true}),
		*GetUser("slice-hasone-2", Config{Account: false}),
		*GetUser("slice-hasone-3", Config{Account: true}),
	}

	DB.Create(&users)

	// Count
	AssertAssociationCount(t, users, "Account", 2, "")

	// Find
	var accounts []Account
	if DB.Model(&users).Association("Account").Find(&accounts); len(accounts) != 2 {
		t.Errorf("accounts count should be %v, but got %v", 3, len(accounts))
	}

	// Append
	DB.Model(&users).Association("Account").Append(
		&Account{Number: "account-slice-append-1"},
		&Account{Number: "account-slice-append-2"},
		&Account{Number: "account-slice-append-3"},
	)

	AssertAssociationCount(t, users, "Account", 3, "After Append")

	// Replace -> same as append

	// Delete
	if err := DB.Model(&users).Association("Account").Delete(&users[0].Account); err != nil {
		t.Errorf("no error should happened when deleting account, but got %v", err)
	}

	AssertAssociationCount(t, users, "Account", 2, "after delete")

	// Clear
	DB.Model(&users).Association("Account").Clear()
	AssertAssociationCount(t, users, "Account", 0, "After Clear")
}

func TestPolymorphicHasOneAssociation(t *testing.T) {
	pet := Pet{Name: "hasone", Toy: Toy{Name: "toy-has-one"}}

	if err := DB.Create(&pet).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	CheckPet(t, pet, pet)

	// Find
	var pet2 Pet
	DB.Find(&pet2, "id = ?", pet.ID)
	DB.Model(&pet2).Association("Toy").Find(&pet2.Toy)
	CheckPet(t, pet2, pet)

	// Count
	AssertAssociationCount(t, pet, "Toy", 1, "")

	// Append
	toy := Toy{Name: "toy-has-one-append"}

	if err := DB.Model(&pet2).Association("Toy").Append(&toy); err != nil {
		t.Fatalf("Error happened when append toy, got %v", err)
	}

	if toy.ID == 0 {
		t.Fatalf("Toy's ID should be created")
	}

	pet.Toy = toy
	CheckPet(t, pet2, pet)

	AssertAssociationCount(t, pet, "Toy", 1, "AfterAppend")

	// Replace
	toy2 := Toy{Name: "toy-has-one-replace"}

	if err := DB.Model(&pet2).Association("Toy").Replace(&toy2); err != nil {
		t.Fatalf("Error happened when append Toy, got %v", err)
	}

	if toy2.ID == 0 {
		t.Fatalf("toy2's ID should be created")
	}

	pet.Toy = toy2
	CheckPet(t, pet2, pet)

	AssertAssociationCount(t, pet2, "Toy", 1, "AfterReplace")

	// Delete
	if err := DB.Model(&pet2).Association("Toy").Delete(&Toy{}); err != nil {
		t.Fatalf("Error happened when delete toy, got %v", err)
	}
	AssertAssociationCount(t, pet2, "Toy", 1, "after delete non-existing data")

	if err := DB.Model(&pet2).Association("Toy").Delete(&toy2); err != nil {
		t.Fatalf("Error happened when delete Toy, got %v", err)
	}
	AssertAssociationCount(t, pet2, "Toy", 0, "after delete")

	// Prepare Data for Clear
	toy = Toy{Name: "toy-has-one-append"}
	if err := DB.Model(&pet2).Association("Toy").Append(&toy); err != nil {
		t.Fatalf("Error happened when append Toy, got %v", err)
	}

	AssertAssociationCount(t, pet2, "Toy", 1, "after prepare data")

	// Clear
	if err := DB.Model(&pet2).Association("Toy").Clear(); err != nil {
		t.Errorf("Error happened when clear Toy, got %v", err)
	}

	AssertAssociationCount(t, pet2, "Toy", 0, "after clear")
}

func TestPolymorphicHasOneAssociationForSlice(t *testing.T) {
	pets := []Pet{
		{Name: "hasone-1", Toy: Toy{Name: "toy-has-one"}},
		{Name: "hasone-2", Toy: Toy{}},
		{Name: "hasone-3", Toy: Toy{Name: "toy-has-one"}},
	}

	DB.Create(&pets)

	// Count
	AssertAssociationCount(t, pets, "Toy", 2, "")

	// Find
	var toys []Toy
	if DB.Model(&pets).Association("Toy").Find(&toys); len(toys) != 2 {
		t.Errorf("toys count should be %v, but got %v", 3, len(toys))
	}

	// Append
	DB.Model(&pets).Association("Toy").Append(
		&Toy{Name: "toy-slice-append-1"},
		&Toy{Name: "toy-slice-append-2"},
		&Toy{Name: "toy-slice-append-3"},
	)

	AssertAssociationCount(t, pets, "Toy", 3, "After Append")

	// Replace -> same as append

	// Delete
	if err := DB.Model(&pets).Association("Toy").Delete(&pets[0].Toy); err != nil {
		t.Errorf("no error should happened when deleting toy, but got %v", err)
	}

	AssertAssociationCount(t, pets, "Toy", 2, "after delete")

	// Clear
	DB.Model(&pets).Association("Toy").Clear()
	AssertAssociationCount(t, pets, "Toy", 0, "After Clear")
}
