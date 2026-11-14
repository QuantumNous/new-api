package tests_test

import (
	"testing"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

func TestHasManyAssociation(t *testing.T) {
	user := *GetUser("hasmany", Config{Pets: 2})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	CheckUser(t, user, user)

	// Find
	var user2 User
	DB.Find(&user2, "id = ?", user.ID)
	DB.Model(&user2).Association("Pets").Find(&user2.Pets)
	CheckUser(t, user2, user)

	var pets []Pet
	DB.Model(&user).Where("name = ?", user.Pets[0].Name).Association("Pets").Find(&pets)

	if len(pets) != 1 {
		t.Fatalf("should only find one pets, but got %v", len(pets))
	}

	CheckPet(t, pets[0], *user.Pets[0])

	if count := DB.Model(&user).Where("name = ?", user.Pets[1].Name).Association("Pets").Count(); count != 1 {
		t.Fatalf("should only find one pets, but got %v", count)
	}

	if count := DB.Model(&user).Where("name = ?", "not found").Association("Pets").Count(); count != 0 {
		t.Fatalf("should only find no pet with invalid conditions, but got %v", count)
	}

	// Count
	AssertAssociationCount(t, user, "Pets", 2, "")

	// Append
	pet := Pet{Name: "pet-has-many-append"}

	if err := DB.Model(&user2).Association("Pets").Append(&pet); err != nil {
		t.Fatalf("Error happened when append account, got %v", err)
	}

	if pet.ID == 0 {
		t.Fatalf("Pet's ID should be created")
	}

	user.Pets = append(user.Pets, &pet)
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user, "Pets", 3, "AfterAppend")

	pets2 := []Pet{{Name: "pet-has-many-append-1-1"}, {Name: "pet-has-many-append-1-1"}}

	if err := DB.Model(&user2).Association("Pets").Append(&pets2); err != nil {
		t.Fatalf("Error happened when append pet, got %v", err)
	}

	for _, pet := range pets2 {
		pet := pet
		if pet.ID == 0 {
			t.Fatalf("Pet's ID should be created")
		}

		user.Pets = append(user.Pets, &pet)
	}

	CheckUser(t, user2, user)

	AssertAssociationCount(t, user, "Pets", 5, "AfterAppendSlice")

	// Replace
	pet2 := Pet{Name: "pet-has-many-replace"}

	if err := DB.Model(&user2).Association("Pets").Replace(&pet2); err != nil {
		t.Fatalf("Error happened when append pet, got %v", err)
	}

	if pet2.ID == 0 {
		t.Fatalf("pet2's ID should be created")
	}

	user.Pets = []*Pet{&pet2}
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user2, "Pets", 1, "AfterReplace")

	// Delete
	if err := DB.Model(&user2).Association("Pets").Delete(&Pet{}); err != nil {
		t.Fatalf("Error happened when delete pet, got %v", err)
	}
	AssertAssociationCount(t, user2, "Pets", 1, "after delete non-existing data")

	if err := DB.Model(&user2).Association("Pets").Delete(&pet2); err != nil {
		t.Fatalf("Error happened when delete Pets, got %v", err)
	}
	AssertAssociationCount(t, user2, "Pets", 0, "after delete")

	// Prepare Data for Clear
	if err := DB.Model(&user2).Association("Pets").Append(&pet); err != nil {
		t.Fatalf("Error happened when append Pets, got %v", err)
	}

	AssertAssociationCount(t, user2, "Pets", 1, "after prepare data")

	// Clear
	if err := DB.Model(&user2).Association("Pets").Clear(); err != nil {
		t.Errorf("Error happened when clear Pets, got %v", err)
	}

	AssertAssociationCount(t, user2, "Pets", 0, "after clear")
}

func TestSingleTableHasManyAssociation(t *testing.T) {
	user := *GetUser("hasmany", Config{Team: 2})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	CheckUser(t, user, user)

	// Find
	var user2 User
	DB.Find(&user2, "id = ?", user.ID)
	DB.Model(&user2).Association("Team").Find(&user2.Team)
	CheckUser(t, user2, user)

	// Count
	AssertAssociationCount(t, user, "Team", 2, "")

	// Append
	team := *GetUser("team", Config{})

	if err := DB.Model(&user2).Association("Team").Append(&team); err != nil {
		t.Fatalf("Error happened when append account, got %v", err)
	}

	if team.ID == 0 {
		t.Fatalf("Team's ID should be created")
	}

	user.Team = append(user.Team, team)
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user, "Team", 3, "AfterAppend")

	teams := []User{*GetUser("team-append-1", Config{}), *GetUser("team-append-2", Config{})}

	if err := DB.Model(&user2).Association("Team").Append(&teams); err != nil {
		t.Fatalf("Error happened when append team, got %v", err)
	}

	for _, team := range teams {
		team := team
		if team.ID == 0 {
			t.Fatalf("Team's ID should be created")
		}

		user.Team = append(user.Team, team)
	}

	CheckUser(t, user2, user)

	AssertAssociationCount(t, user, "Team", 5, "AfterAppendSlice")

	// Replace
	team2 := *GetUser("team-replace", Config{})

	if err := DB.Model(&user2).Association("Team").Replace(&team2); err != nil {
		t.Fatalf("Error happened when append team, got %v", err)
	}

	if team2.ID == 0 {
		t.Fatalf("team2's ID should be created")
	}

	user.Team = []User{team2}
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user2, "Team", 1, "AfterReplace")

	// Delete
	if err := DB.Model(&user2).Association("Team").Delete(&User{}); err != nil {
		t.Fatalf("Error happened when delete team, got %v", err)
	}
	AssertAssociationCount(t, user2, "Team", 1, "after delete non-existing data")

	if err := DB.Model(&user2).Association("Team").Delete(&team2); err != nil {
		t.Fatalf("Error happened when delete Team, got %v", err)
	}
	AssertAssociationCount(t, user2, "Team", 0, "after delete")

	// Prepare Data for Clear
	if err := DB.Model(&user2).Association("Team").Append(&team); err != nil {
		t.Fatalf("Error happened when append Team, got %v", err)
	}

	AssertAssociationCount(t, user2, "Team", 1, "after prepare data")

	// Clear
	if err := DB.Model(&user2).Association("Team").Clear(); err != nil {
		t.Errorf("Error happened when clear Team, got %v", err)
	}

	AssertAssociationCount(t, user2, "Team", 0, "after clear")
}

func TestHasManyAssociationForSlice(t *testing.T) {
	users := []User{
		*GetUser("slice-hasmany-1", Config{Pets: 2}),
		*GetUser("slice-hasmany-2", Config{Pets: 0}),
		*GetUser("slice-hasmany-3", Config{Pets: 4}),
	}

	DB.Create(&users)

	// Count
	AssertAssociationCount(t, users, "Pets", 6, "")

	// Find
	var pets []Pet
	if DB.Model(&users).Association("Pets").Find(&pets); len(pets) != 6 {
		t.Errorf("pets count should be %v, but got %v", 6, len(pets))
	}

	// Append
	DB.Model(&users).Association("Pets").Append(
		&Pet{Name: "pet-slice-append-1"},
		[]*Pet{{Name: "pet-slice-append-2-1"}, {Name: "pet-slice-append-2-2"}},
		&Pet{Name: "pet-slice-append-3"},
	)

	AssertAssociationCount(t, users, "Pets", 10, "After Append")

	// Replace -> same as append
	DB.Model(&users).Association("Pets").Replace(
		[]*Pet{{Name: "pet-slice-replace-1-1"}, {Name: "pet-slice-replace-1-2"}},
		[]*Pet{{Name: "pet-slice-replace-2-1"}, {Name: "pet-slice-replace-2-2"}},
		&Pet{Name: "pet-slice-replace-3"},
	)

	AssertAssociationCount(t, users, "Pets", 5, "After Append")

	// Delete
	if err := DB.Model(&users).Association("Pets").Delete(&users[2].Pets); err != nil {
		t.Errorf("no error should happened when deleting pet, but got %v", err)
	}

	AssertAssociationCount(t, users, "Pets", 4, "after delete")

	if err := DB.Model(&users).Association("Pets").Delete(users[0].Pets[0], users[1].Pets[1]); err != nil {
		t.Errorf("no error should happened when deleting pet, but got %v", err)
	}

	AssertAssociationCount(t, users, "Pets", 2, "after delete")

	// Clear
	DB.Model(&users).Association("Pets").Clear()
	AssertAssociationCount(t, users, "Pets", 0, "After Clear")
}

func TestSingleTableHasManyAssociationForSlice(t *testing.T) {
	users := []User{
		*GetUser("slice-hasmany-1", Config{Team: 2}),
		*GetUser("slice-hasmany-2", Config{Team: 0}),
		*GetUser("slice-hasmany-3", Config{Team: 4}),
	}

	if err := DB.Create(&users).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	// Count
	AssertAssociationCount(t, users, "Team", 6, "")

	// Find
	var teams []User
	if DB.Model(&users).Association("Team").Find(&teams); len(teams) != 6 {
		t.Errorf("teams count should be %v, but got %v", 6, len(teams))
	}

	// Append
	DB.Model(&users).Association("Team").Append(
		&User{Name: "pet-slice-append-1"},
		[]*User{{Name: "pet-slice-append-2-1"}, {Name: "pet-slice-append-2-2"}},
		&User{Name: "pet-slice-append-3"},
	)

	AssertAssociationCount(t, users, "Team", 10, "After Append")

	// Replace -> same as append
	DB.Model(&users).Association("Team").Replace(
		[]*User{{Name: "pet-slice-replace-1-1"}, {Name: "pet-slice-replace-1-2"}},
		[]*User{{Name: "pet-slice-replace-2-1"}, {Name: "pet-slice-replace-2-2"}},
		&User{Name: "pet-slice-replace-3"},
	)

	AssertAssociationCount(t, users, "Team", 5, "After Append")

	// Delete
	if err := DB.Model(&users).Association("Team").Delete(&users[2].Team); err != nil {
		t.Errorf("no error should happened when deleting pet, but got %v", err)
	}

	AssertAssociationCount(t, users, "Team", 4, "after delete")

	if err := DB.Model(&users).Association("Team").Delete(users[0].Team[0], users[1].Team[1]); err != nil {
		t.Errorf("no error should happened when deleting pet, but got %v", err)
	}

	AssertAssociationCount(t, users, "Team", 2, "after delete")

	// Clear
	DB.Model(&users).Association("Team").Clear()
	AssertAssociationCount(t, users, "Team", 0, "After Clear")
}

func TestPolymorphicHasManyAssociation(t *testing.T) {
	user := *GetUser("hasmany", Config{Toys: 2})

	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("errors happened when create: %v", err)
	}

	CheckUser(t, user, user)

	// Find
	var user2 User
	DB.Find(&user2, "id = ?", user.ID)
	DB.Model(&user2).Association("Toys").Find(&user2.Toys)
	CheckUser(t, user2, user)

	// Count
	AssertAssociationCount(t, user, "Toys", 2, "")

	// Append
	toy := Toy{Name: "toy-has-many-append"}

	if err := DB.Model(&user2).Association("Toys").Append(&toy); err != nil {
		t.Fatalf("Error happened when append account, got %v", err)
	}

	if toy.ID == 0 {
		t.Fatalf("Toy's ID should be created")
	}

	user.Toys = append(user.Toys, toy)
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user, "Toys", 3, "AfterAppend")

	toys := []Toy{{Name: "toy-has-many-append-1-1"}, {Name: "toy-has-many-append-1-1"}}

	if err := DB.Model(&user2).Association("Toys").Append(&toys); err != nil {
		t.Fatalf("Error happened when append toy, got %v", err)
	}

	for _, toy := range toys {
		toy := toy
		if toy.ID == 0 {
			t.Fatalf("Toy's ID should be created")
		}

		user.Toys = append(user.Toys, toy)
	}

	CheckUser(t, user2, user)

	AssertAssociationCount(t, user, "Toys", 5, "AfterAppendSlice")

	// Replace
	toy2 := Toy{Name: "toy-has-many-replace"}

	if err := DB.Model(&user2).Association("Toys").Replace(&toy2); err != nil {
		t.Fatalf("Error happened when append toy, got %v", err)
	}

	if toy2.ID == 0 {
		t.Fatalf("toy2's ID should be created")
	}

	user.Toys = []Toy{toy2}
	CheckUser(t, user2, user)

	AssertAssociationCount(t, user2, "Toys", 1, "AfterReplace")

	// Delete
	if err := DB.Model(&user2).Association("Toys").Delete(&Toy{}); err != nil {
		t.Fatalf("Error happened when delete toy, got %v", err)
	}
	AssertAssociationCount(t, user2, "Toys", 1, "after delete non-existing data")

	if err := DB.Model(&user2).Association("Toys").Delete(&toy2); err != nil {
		t.Fatalf("Error happened when delete Toys, got %v", err)
	}
	AssertAssociationCount(t, user2, "Toys", 0, "after delete")

	// Prepare Data for Clear
	if err := DB.Model(&user2).Association("Toys").Append(&toy); err != nil {
		t.Fatalf("Error happened when append Toys, got %v", err)
	}

	AssertAssociationCount(t, user2, "Toys", 1, "after prepare data")

	// Clear
	if err := DB.Model(&user2).Association("Toys").Clear(); err != nil {
		t.Errorf("Error happened when clear Toys, got %v", err)
	}

	AssertAssociationCount(t, user2, "Toys", 0, "after clear")
}

func TestPolymorphicHasManyAssociationForSlice(t *testing.T) {
	users := []User{
		*GetUser("slice-hasmany-1", Config{Toys: 2}),
		*GetUser("slice-hasmany-2", Config{Toys: 0}),
		*GetUser("slice-hasmany-3", Config{Toys: 4}),
	}

	DB.Create(&users)

	// Count
	AssertAssociationCount(t, users, "Toys", 6, "")

	// Find
	var toys []Toy
	if DB.Model(&users).Association("Toys").Find(&toys); len(toys) != 6 {
		t.Errorf("toys count should be %v, but got %v", 6, len(toys))
	}

	// Append
	DB.Model(&users).Association("Toys").Append(
		&Toy{Name: "toy-slice-append-1"},
		[]Toy{{Name: "toy-slice-append-2-1"}, {Name: "toy-slice-append-2-2"}},
		&Toy{Name: "toy-slice-append-3"},
	)

	AssertAssociationCount(t, users, "Toys", 10, "After Append")

	// Replace -> same as append
	DB.Model(&users).Association("Toys").Replace(
		[]*Toy{{Name: "toy-slice-replace-1-1"}, {Name: "toy-slice-replace-1-2"}},
		[]*Toy{{Name: "toy-slice-replace-2-1"}, {Name: "toy-slice-replace-2-2"}},
		&Toy{Name: "toy-slice-replace-3"},
	)

	AssertAssociationCount(t, users, "Toys", 5, "After Append")

	// Delete
	if err := DB.Model(&users).Association("Toys").Delete(&users[2].Toys); err != nil {
		t.Errorf("no error should happened when deleting toy, but got %v", err)
	}

	AssertAssociationCount(t, users, "Toys", 4, "after delete")

	if err := DB.Model(&users).Association("Toys").Delete(users[0].Toys[0], users[1].Toys[1]); err != nil {
		t.Errorf("no error should happened when deleting toy, but got %v", err)
	}

	AssertAssociationCount(t, users, "Toys", 2, "after delete")

	// Clear
	DB.Model(&users).Association("Toys").Clear()
	AssertAssociationCount(t, users, "Toys", 0, "After Clear")
}

func TestHasManyAssociationUnscoped(t *testing.T) {
	type ItemContent struct {
		gorm.Model
		ItemID       uint   `gorm:"not null"`
		Name         string `gorm:"not null;type:varchar(50)"`
		LanguageCode string `gorm:"not null;type:varchar(2)"`
	}
	type Item struct {
		gorm.Model
		Logo     string        `gorm:"not null;type:varchar(50)"`
		Contents []ItemContent `gorm:"foreignKey:ItemID"`
	}

	tx := DB.Session(&gorm.Session{})
	tx.Migrator().DropTable(&ItemContent{}, &Item{})
	tx.AutoMigrate(&ItemContent{}, &Item{})

	item := Item{
		Logo: "logo",
		Contents: []ItemContent{
			{Name: "name", LanguageCode: "en"},
			{Name: "ar name", LanguageCode: "ar"},
		},
	}
	if err := tx.Create(&item).Error; err != nil {
		t.Fatalf("failed to create items, got error: %v", err)
	}

	// test Replace
	if err := tx.Model(&item).Association("Contents").Unscoped().Replace([]ItemContent{
		{Name: "updated name", LanguageCode: "en"},
		{Name: "ar updated name", LanguageCode: "ar"},
		{Name: "le nom", LanguageCode: "fr"},
	}); err != nil {
		t.Errorf("failed to replace item content, got error: %v", err)
	}

	if count := tx.Model(&item).Association("Contents").Count(); count != 3 {
		t.Errorf("expected %d contents, got %d", 3, count)
	}

	var contents []ItemContent
	if err := tx.Find(&contents).Error; err != nil {
		t.Errorf("failed to find contents, got error: %v", err)
	}
	if len(contents) != 3 {
		t.Errorf("expected %d contents, got %d", 3, len(contents))
	}

	// test delete
	if err := tx.Model(&item).Association("Contents").Unscoped().Delete(&contents[0]); err != nil {
		t.Errorf("failed to delete Contents, got error: %v", err)
	}
	if count := tx.Model(&item).Association("Contents").Count(); count != 2 {
		t.Errorf("expected %d contents, got %d", 2, count)
	}

	// test clear
	if err := tx.Model(&item).Association("Contents").Unscoped().Clear(); err != nil {
		t.Errorf("failed to clear contents association, got error: %v", err)
	}
	if count := tx.Model(&item).Association("Contents").Count(); count != 0 {
		t.Errorf("expected %d contents, got %d", 0, count)
	}

	if err := tx.Find(&contents).Error; err != nil {
		t.Errorf("failed to find contents, got error: %v", err)
	}
	if len(contents) != 0 {
		t.Errorf("expected %d contents, got %d", 0, len(contents))
	}
}
