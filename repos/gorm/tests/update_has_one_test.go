package tests_test

import (
	"database/sql"
	"testing"
	"time"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

func TestUpdateHasOne(t *testing.T) {
	user := *GetUser("update-has-one", Config{})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	user.Account = Account{Number: "account-has-one-association"}

	if err := DB.Save(&user).Error; err != nil {
		t.Fatalf("errors happened when update: %v", err)
	}

	var user2 User
	DB.Preload("Account").Find(&user2, "id = ?", user.ID)
	CheckUser(t, user2, user)

	user.Account.Number += "new"
	if err := DB.Save(&user).Error; err != nil {
		t.Fatalf("errors happened when update: %v", err)
	}

	var user3 User
	DB.Preload("Account").Find(&user3, "id = ?", user.ID)

	CheckUser(t, user2, user3)
	lastUpdatedAt := user2.Account.UpdatedAt
	time.Sleep(time.Second)

	if err := DB.Session(&gorm.Session{FullSaveAssociations: true}).Save(&user).Error; err != nil {
		t.Fatalf("errors happened when update: %v", err)
	}

	var user4 User
	DB.Preload("Account").Find(&user4, "id = ?", user.ID)

	if lastUpdatedAt.Format(time.RFC3339) == user4.Account.UpdatedAt.Format(time.RFC3339) {
		t.Fatalf("updated at should be updated, but not, old: %v, new %v", lastUpdatedAt.Format(time.RFC3339), user3.Account.UpdatedAt.Format(time.RFC3339))
	} else {
		user.Account.UpdatedAt = user4.Account.UpdatedAt
		CheckUser(t, user4, user)
	}

	t.Run("Polymorphic", func(t *testing.T) {
		pet := Pet{Name: "create"}

		if err := DB.Create(&pet).Error; err != nil {
			t.Fatalf("errors happened when create: %v", err)
		}

		pet.Toy = Toy{Name: "Update-HasOneAssociation-Polymorphic"}

		if err := DB.Save(&pet).Error; err != nil {
			t.Fatalf("errors happened when create: %v", err)
		}

		var pet2 Pet
		DB.Preload("Toy").Find(&pet2, "id = ?", pet.ID)
		CheckPet(t, pet2, pet)

		pet.Toy.Name += "new"
		if err := DB.Save(&pet).Error; err != nil {
			t.Fatalf("errors happened when update: %v", err)
		}

		var pet3 Pet
		DB.Preload("Toy").Find(&pet3, "id = ?", pet.ID)
		CheckPet(t, pet2, pet3)

		if err := DB.Session(&gorm.Session{FullSaveAssociations: true}).Save(&pet).Error; err != nil {
			t.Fatalf("errors happened when update: %v", err)
		}

		var pet4 Pet
		DB.Preload("Toy").Find(&pet4, "id = ?", pet.ID)
		CheckPet(t, pet4, pet)
	})

	t.Run("Restriction", func(t *testing.T) {
		type CustomizeAccount struct {
			gorm.Model
			UserID  sql.NullInt64
			Number  string `gorm:"<-:create"`
			Number2 string
		}

		type CustomizeUser struct {
			gorm.Model
			Name    string
			Account CustomizeAccount `gorm:"foreignkey:UserID"`
		}

		DB.Migrator().DropTable(&CustomizeUser{})
		DB.Migrator().DropTable(&CustomizeAccount{})

		if err := DB.AutoMigrate(&CustomizeUser{}); err != nil {
			t.Fatalf("failed to migrate, got error: %v", err)
		}
		if err := DB.AutoMigrate(&CustomizeAccount{}); err != nil {
			t.Fatalf("failed to migrate, got error: %v", err)
		}

		number := "number-has-one-associations"
		cusUser := CustomizeUser{
			Name: "update-has-one-associations",
			Account: CustomizeAccount{
				Number:  number,
				Number2: number,
			},
		}

		if err := DB.Create(&cusUser).Error; err != nil {
			t.Fatalf("errors happened when create: %v", err)
		}
		cusUser.Account.Number += "-update"
		cusUser.Account.Number2 += "-update"
		if err := DB.Session(&gorm.Session{FullSaveAssociations: true}).Updates(&cusUser).Error; err != nil {
			t.Fatalf("errors happened when create: %v", err)
		}

		var account2 CustomizeAccount
		DB.Find(&account2, "user_id = ?", cusUser.ID)
		AssertEqual(t, account2.Number, number)
		AssertEqual(t, account2.Number2, cusUser.Account.Number2)
	})
}
