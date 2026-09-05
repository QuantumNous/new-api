package tests_test

import (
	"testing"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

func TestUpdateMany2ManyAssociations(t *testing.T) {
	user := *GetUser("update-many2many", Config{})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	user.Languages = []Language{{Code: "zh-CN", Name: "Chinese"}, {Code: "en", Name: "English"}}
	for _, lang := range user.Languages {
		DB.Create(&lang)
	}
	user.Friends = []*User{{Name: "friend-1"}, {Name: "friend-2"}}

	if err := DB.Save(&user).Error; err != nil {
		t.Fatalf("errors happened when update: %v", err)
	}

	var user2 User
	DB.Preload("Languages").Preload("Friends").Find(&user2, "id = ?", user.ID)
	CheckUser(t, user2, user)

	for idx := range user.Friends {
		user.Friends[idx].Name += "new"
	}

	for idx := range user.Languages {
		user.Languages[idx].Name += "new"
	}

	if err := DB.Save(&user).Error; err != nil {
		t.Fatalf("errors happened when update: %v", err)
	}

	var user3 User
	DB.Preload("Languages").Preload("Friends").Find(&user3, "id = ?", user.ID)
	CheckUser(t, user2, user3)

	if err := DB.Session(&gorm.Session{FullSaveAssociations: true}).Save(&user).Error; err != nil {
		t.Fatalf("errors happened when update: %v", err)
	}

	var user4 User
	DB.Preload("Languages").Preload("Friends").Find(&user4, "id = ?", user.ID)
	CheckUser(t, user4, user)
}
