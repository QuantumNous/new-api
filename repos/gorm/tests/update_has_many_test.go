package tests_test

import (
	"testing"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

func TestUpdateHasManyAssociations(t *testing.T) {
	user := *GetUser("update-has-many", Config{})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	user.Pets = []*Pet{{Name: "pet1"}, {Name: "pet2"}}
	if err := DB.Save(&user).Error; err != nil {
		t.Fatalf("errors happened when update: %v", err)
	}

	var user2 User
	DB.Preload("Pets").Find(&user2, "id = ?", user.ID)
	CheckUser(t, user2, user)

	for _, pet := range user.Pets {
		pet.Name += "new"
	}

	if err := DB.Save(&user).Error; err != nil {
		t.Fatalf("errors happened when update: %v", err)
	}

	var user3 User
	DB.Preload("Pets").Find(&user3, "id = ?", user.ID)
	CheckUser(t, user2, user3)

	if err := DB.Session(&gorm.Session{FullSaveAssociations: true}).Save(&user).Error; err != nil {
		t.Fatalf("errors happened when update: %v", err)
	}

	var user4 User
	DB.Preload("Pets").Find(&user4, "id = ?", user.ID)
	CheckUser(t, user4, user)

	t.Run("Polymorphic", func(t *testing.T) {
		user := *GetUser("update-has-many", Config{})

		if err := DB.Create(&user).Error; err != nil {
			t.Fatalf("errors happened when create: %v", err)
		}

		user.Toys = []Toy{{Name: "toy1"}, {Name: "toy2"}}
		if err := DB.Save(&user).Error; err != nil {
			t.Fatalf("errors happened when update: %v", err)
		}

		var user2 User
		DB.Preload("Toys").Find(&user2, "id = ?", user.ID)
		CheckUser(t, user2, user)

		for idx := range user.Toys {
			user.Toys[idx].Name += "new"
		}

		if err := DB.Save(&user).Error; err != nil {
			t.Fatalf("errors happened when update: %v", err)
		}

		var user3 User
		DB.Preload("Toys").Find(&user3, "id = ?", user.ID)
		CheckUser(t, user2, user3)

		if err := DB.Session(&gorm.Session{FullSaveAssociations: true}).Save(&user).Error; err != nil {
			t.Fatalf("errors happened when update: %v", err)
		}

		var user4 User
		DB.Preload("Toys").Find(&user4, "id = ?", user.ID)
		CheckUser(t, user4, user)
	})
}
