package tests_test

import (
	"testing"
	"time"
)

type Animal struct {
	Counter    uint64 `gorm:"primary_key:yes"`
	Name       string `gorm:"DEFAULT:'galeone'"`
	From       string // test reserved sql keyword as field name
	Age        *time.Time
	unexported string // unexported value
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func TestNonStdPrimaryKeyAndDefaultValues(t *testing.T) {
	DB.Migrator().DropTable(&Animal{})
	if err := DB.AutoMigrate(&Animal{}); err != nil {
		t.Fatalf("no error should happen when migrate but got %v", err)
	}

	animal := Animal{Name: "Ferdinand"}
	DB.Save(&animal)
	updatedAt1 := animal.UpdatedAt

	DB.Save(&animal).Update("name", "Francis")
	if updatedAt1.Format(time.RFC3339Nano) == animal.UpdatedAt.Format(time.RFC3339Nano) {
		t.Errorf("UpdatedAt should be updated")
	}

	var animals []Animal
	DB.Find(&animals)
	if count := DB.Model(Animal{}).Where("1=1").Update("CreatedAt", time.Now().Add(2*time.Hour)).RowsAffected; count != int64(len(animals)) {
		t.Error("RowsAffected should be correct when do batch update")
	}

	animal = Animal{From: "somewhere"}              // No name fields, should be filled with the default value (galeone)
	DB.Save(&animal).Update("From", "a nice place") // The name field shoul be untouched
	DB.First(&animal, animal.Counter)
	if animal.Name != "galeone" {
		t.Errorf("Name fields shouldn't be changed if untouched, but got %v", animal.Name)
	}

	// When changing a field with a default value, the change must occur
	animal.Name = "amazing horse"
	DB.Save(&animal)
	DB.First(&animal, animal.Counter)
	if animal.Name != "amazing horse" {
		t.Errorf("Update a filed with a default value should occur. But got %v\n", animal.Name)
	}

	// When changing a field with a default value with blank value
	animal.Name = ""
	DB.Save(&animal)
	DB.First(&animal, animal.Counter)
	if animal.Name != "" {
		t.Errorf("Update a filed to blank with a default value should occur. But got %v\n", animal.Name)
	}
}
