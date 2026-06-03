package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupModelTypeTestDB(t *testing.T) {
	t.Helper()
	oldDB := DB
	oldSQLite := common.UsingSQLite
	DB = nil
	common.UsingSQLite = true
	t.Cleanup(func() {
		DB = oldDB
		common.UsingSQLite = oldSQLite
	})
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	DB = db
	if err := DB.AutoMigrate(&Model{}); err != nil {
		t.Fatalf("migrate model: %v", err)
	}
}

func TestModelTypePersistsOnInsertAndUpdate(t *testing.T) {
	setupModelTypeTestDB(t)

	m := &Model{ModelName: "doubao-seedream-4-5-251128", ModelType: ModelTypeImage, Status: 1}
	if err := m.Insert(); err != nil {
		t.Fatalf("insert model: %v", err)
	}

	var got Model
	if err := DB.First(&got, m.Id).Error; err != nil {
		t.Fatalf("load model: %v", err)
	}
	if got.ModelType != ModelTypeImage {
		t.Fatalf("model_type after insert = %q, want %q", got.ModelType, ModelTypeImage)
	}

	got.ModelType = ModelTypeEmbedding
	if err := got.Update(); err != nil {
		t.Fatalf("update model: %v", err)
	}

	var updated Model
	if err := DB.First(&updated, m.Id).Error; err != nil {
		t.Fatalf("load updated model: %v", err)
	}
	if updated.ModelType != ModelTypeEmbedding {
		t.Fatalf("model_type after update = %q, want %q", updated.ModelType, ModelTypeEmbedding)
	}
}

func TestNormalizeModelType(t *testing.T) {
	cases := map[string]string{
		"":          ModelTypeText,
		"Text":      ModelTypeText,
		"embedding": ModelTypeEmbedding,
		"Image":     ModelTypeImage,
		"File":      ModelTypeFile,
		"Audio":     ModelTypeAudio,
		"Video":     ModelTypeVideo,
		"unknown":   ModelTypeText,
	}
	for input, want := range cases {
		if got := NormalizeModelType(input); got != want {
			t.Fatalf("NormalizeModelType(%q) = %q, want %q", input, got, want)
		}
	}
}
