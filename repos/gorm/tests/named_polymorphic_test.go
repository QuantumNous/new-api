package tests_test

import (
	"testing"

	. "gorm.io/gorm/utils/tests"
)

type Hamster struct {
	Id           int
	Name         string
	PreferredToy Toy `gorm:"polymorphic:Owner;polymorphicValue:hamster_preferred"`
	OtherToy     Toy `gorm:"polymorphic:Owner;polymorphicValue:hamster_other"`
}

func TestNamedPolymorphic(t *testing.T) {
	DB.Migrator().DropTable(&Hamster{})
	DB.AutoMigrate(&Hamster{})

	hamster := Hamster{Name: "Mr. Hammond", PreferredToy: Toy{Name: "bike"}, OtherToy: Toy{Name: "treadmill"}}
	DB.Save(&hamster)

	hamster2 := Hamster{}
	DB.Preload("PreferredToy").Preload("OtherToy").Find(&hamster2, hamster.Id)

	if hamster2.PreferredToy.ID != hamster.PreferredToy.ID || hamster2.PreferredToy.Name != hamster.PreferredToy.Name {
		t.Errorf("Hamster's preferred toy failed to preload")
	}

	if hamster2.OtherToy.ID != hamster.OtherToy.ID || hamster2.OtherToy.Name != hamster.OtherToy.Name {
		t.Errorf("Hamster's other toy failed to preload")
	}

	// clear to omit Toy.ID in count
	hamster2.PreferredToy = Toy{}
	hamster2.OtherToy = Toy{}

	if DB.Model(&hamster2).Association("PreferredToy").Count() != 1 {
		t.Errorf("Hamster's preferred toy count should be 1")
	}

	if DB.Model(&hamster2).Association("OtherToy").Count() != 1 {
		t.Errorf("Hamster's other toy count should be 1")
	}

	// Query
	hamsterToy := Toy{}
	DB.Model(&hamster).Association("PreferredToy").Find(&hamsterToy)
	if hamsterToy.Name != hamster.PreferredToy.Name {
		t.Errorf("Should find has one polymorphic association")
	}

	hamsterToy = Toy{}
	DB.Model(&hamster).Association("OtherToy").Find(&hamsterToy)
	if hamsterToy.Name != hamster.OtherToy.Name {
		t.Errorf("Should find has one polymorphic association")
	}

	// Append
	DB.Model(&hamster).Association("PreferredToy").Append(&Toy{
		Name: "bike 2",
	})

	DB.Model(&hamster).Association("OtherToy").Append(&Toy{
		Name: "treadmill 2",
	})

	hamsterToy = Toy{}
	DB.Model(&hamster).Association("PreferredToy").Find(&hamsterToy)
	if hamsterToy.Name != "bike 2" {
		t.Errorf("Should update has one polymorphic association with Append")
	}

	hamsterToy = Toy{}
	DB.Model(&hamster).Association("OtherToy").Find(&hamsterToy)
	if hamsterToy.Name != "treadmill 2" {
		t.Errorf("Should update has one polymorphic association with Append")
	}

	if DB.Model(&hamster2).Association("PreferredToy").Count() != 1 {
		t.Errorf("Hamster's toys count should be 1 after Append")
	}

	if DB.Model(&hamster2).Association("OtherToy").Count() != 1 {
		t.Errorf("Hamster's toys count should be 1 after Append")
	}

	// Replace
	DB.Model(&hamster).Association("PreferredToy").Replace(&Toy{
		Name: "bike 3",
	})

	DB.Model(&hamster).Association("OtherToy").Replace(&Toy{
		Name: "treadmill 3",
	})

	hamsterToy = Toy{}
	DB.Model(&hamster).Association("PreferredToy").Find(&hamsterToy)
	if hamsterToy.Name != "bike 3" {
		t.Errorf("Should update has one polymorphic association with Replace")
	}

	hamsterToy = Toy{}
	DB.Model(&hamster).Association("OtherToy").Find(&hamsterToy)
	if hamsterToy.Name != "treadmill 3" {
		t.Errorf("Should update has one polymorphic association with Replace")
	}

	if DB.Model(&hamster2).Association("PreferredToy").Count() != 1 {
		t.Errorf("hamster's toys count should be 1 after Replace")
	}

	if DB.Model(&hamster2).Association("OtherToy").Count() != 1 {
		t.Errorf("hamster's toys count should be 1 after Replace")
	}

	// Clear
	DB.Model(&hamster).Association("PreferredToy").Append(&Toy{
		Name: "bike 2",
	})
	DB.Model(&hamster).Association("OtherToy").Append(&Toy{
		Name: "treadmill 2",
	})

	if DB.Model(&hamster).Association("PreferredToy").Count() != 1 {
		t.Errorf("Hamster's toys should be added with Append")
	}

	if DB.Model(&hamster).Association("OtherToy").Count() != 1 {
		t.Errorf("Hamster's toys should be added with Append")
	}

	DB.Model(&hamster).Association("PreferredToy").Clear()

	if DB.Model(&hamster2).Association("PreferredToy").Count() != 0 {
		t.Errorf("Hamster's preferred toy should be cleared with Clear")
	}

	if DB.Model(&hamster2).Association("OtherToy").Count() != 1 {
		t.Errorf("Hamster's other toy should be still available")
	}

	DB.Model(&hamster).Association("OtherToy").Clear()
	if DB.Model(&hamster).Association("OtherToy").Count() != 0 {
		t.Errorf("Hamster's other toy should be cleared with Clear")
	}
}
