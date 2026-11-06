package tests_test

import (
	"testing"
	"time"

	"gorm.io/gorm"
)

func TestDefaultValue(t *testing.T) {
	type Harumph struct {
		gorm.Model
		Email   string    `gorm:"not null;index:,unique"`
		Name    string    `gorm:"notNull;default:foo"`
		Name2   string    `gorm:"size:233;not null;default:'foo'"`
		Name3   string    `gorm:"size:233;notNull;default:''"`
		Age     int       `gorm:"default:18"`
		Created time.Time `gorm:"default:2000-01-02"`
		Enabled bool      `gorm:"default:true"`
	}

	DB.Migrator().DropTable(&Harumph{})

	if err := DB.AutoMigrate(&Harumph{}); err != nil {
		t.Fatalf("Failed to migrate with default value, got error: %v", err)
	}

	harumph := Harumph{Email: "hello@gorm.io"}
	if err := DB.Create(&harumph).Error; err != nil {
		t.Fatalf("Failed to create data with default value, got error: %v", err)
	} else if harumph.Name != "foo" || harumph.Name2 != "foo" || harumph.Name3 != "" || harumph.Age != 18 || !harumph.Enabled || harumph.Created.Format("20060102") != "20000102" {
		t.Fatalf("Failed to create data with default value, got: %+v", harumph)
	}

	var result Harumph
	if err := DB.First(&result, "email = ?", "hello@gorm.io").Error; err != nil {
		t.Fatalf("Failed to find created data, got error: %v", err)
	} else if result.Name != "foo" || result.Name2 != "foo" || result.Name3 != "" || result.Age != 18 || !result.Enabled || result.Created.Format("20060102") != "20000102" {
		t.Fatalf("Failed to find created data with default data, got %+v", result)
	}
}
