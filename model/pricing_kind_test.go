package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupPricingKindTestDB(t *testing.T) {
	t.Helper()
	oldDB := DB
	oldDBType := common.MainDatabaseType()
	DB = nil
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = oldDB
		common.SetMainDatabaseType(oldDBType)
	})
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	DB = db
	if err := DB.AutoMigrate(&Model{}, &Option{}); err != nil {
		t.Fatalf("migrate model: %v", err)
	}
}

func TestPricingKindPersistsOnInsertAndUpdate(t *testing.T) {
	setupPricingKindTestDB(t)

	// Insert a model with pricing_kind = "image-gen"
	m := &Model{
		ModelName:   "test-image-model",
		ModelType:   ModelTypeImage,
		PricingKind: constant.PricingKindImageGen,
		Status:      1,
	}
	if err := m.Insert(); err != nil {
		t.Fatalf("insert model: %v", err)
	}

	// Verify after insert
	var got Model
	if err := DB.First(&got, m.Id).Error; err != nil {
		t.Fatalf("load model: %v", err)
	}
	if got.PricingKind != constant.PricingKindImageGen {
		t.Fatalf("pricing_kind after insert = %q, want %q", got.PricingKind, constant.PricingKindImageGen)
	}
	if got.ModelType != ModelTypeImage {
		t.Fatalf("model_type after insert = %q, want %q", got.ModelType, ModelTypeImage)
	}

	// Change to another kind and update
	got.PricingKind = constant.PricingKindVideoGen
	if err := got.Update(); err != nil {
		t.Fatalf("update model: %v", err)
	}

	// Verify after update
	var updated Model
	if err := DB.First(&updated, m.Id).Error; err != nil {
		t.Fatalf("load updated model: %v", err)
	}
	if updated.PricingKind != constant.PricingKindVideoGen {
		t.Fatalf("pricing_kind after update = %q, want %q", updated.PricingKind, constant.PricingKindVideoGen)
	}
	if updated.ModelType != ModelTypeImage {
		t.Fatalf("model_type after update = %q, want %q", updated.ModelType, ModelTypeImage)
	}
}

func TestPricingKindUpdateViaModelObjectDirectly(t *testing.T) {
	setupPricingKindTestDB(t)

	// Simulate the exact controller flow: ShouldBindJSON loads JSON into Model,
	// then calls m.Update().
	m := &Model{
		Id:          0, // will be set by Insert
		ModelName:   "seedream-test",
		ModelType:   "",
		PricingKind: "",
		Status:      1,
	}
	m.ModelType = NormalizeModelType(m.ModelType)
	m.PricingKind = constant.NormalizePricingKind(m.PricingKind)
	if err := m.Insert(); err != nil {
		t.Fatalf("insert model: %v", err)
	}

	// Simulate edit: user changes model_type="image", pricing_kind="image-gen"
	m2 := &Model{
		Id:          m.Id,
		ModelName:   "seedream-test",
		ModelType:   "image",     // simulate what ShouldBindJSON would set
		PricingKind: "image-gen", // simulate what ShouldBindJSON would set
		Status:      1,
	}
	if err := m2.Update(); err != nil {
		t.Fatalf("update model: %v", err)
	}

	// Verify after update
	var got Model
	if err := DB.First(&got, m.Id).Error; err != nil {
		t.Fatalf("load model: %v", err)
	}
	if got.ModelType != ModelTypeImage {
		t.Fatalf("model_type = %q, want %q", got.ModelType, ModelTypeImage)
	}
	if got.PricingKind != constant.PricingKindImageGen {
		t.Fatalf("pricing_kind = %q, want %q", got.PricingKind, constant.PricingKindImageGen)
	}
}
