package service

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupCCSwitchModelCacheTest(t *testing.T) *gorm.DB {
	t.Helper()
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Token{}); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}
	model.DB = db
	model.LOG_DB = db

	user := &model.User{Id: 1, Username: "ccswitch-user", Password: "password", Group: "group-a", Status: 1}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	token := &model.Token{Id: 1, UserId: 1, Name: "token", Key: "key", Status: common.TokenStatusEnabled}
	if err := db.Create(token).Error; err != nil {
		t.Fatalf("failed to create token: %v", err)
	}

	originalBuilder := buildCCSwitchModelCatalogFunc
	t.Cleanup(func() {
		buildCCSwitchModelCatalogFunc = originalBuilder
		ccSwitchModelCatalog.Lock()
		ccSwitchModelCatalog.entries = nil
		ccSwitchModelCatalog.initialized = false
		ccSwitchModelCatalog.Unlock()
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func setCCSwitchModelCatalogForTest(entries []ccSwitchModelCatalogEntry, initialized bool) {
	ccSwitchModelCatalog.Lock()
	ccSwitchModelCatalog.entries = entries
	ccSwitchModelCatalog.initialized = initialized
	ccSwitchModelCatalog.Unlock()
}

func TestGetCCSwitchModelsReturnsRecentPerVendorAndSearchesAll(t *testing.T) {
	setupCCSwitchModelCacheTest(t)
	entries := []ccSwitchModelCatalogEntry{
		{CCSwitchModelOption: dto.CCSwitchModelOption{Name: "vendor-a-newest", VendorID: 1, VendorName: "Vendor A", CreatedTime: 40}, EnableGroups: []string{"group-a"}},
		{CCSwitchModelOption: dto.CCSwitchModelOption{Name: "vendor-a-newer", VendorID: 1, VendorName: "Vendor A", CreatedTime: 30}, EnableGroups: []string{"group-a"}},
		{CCSwitchModelOption: dto.CCSwitchModelOption{Name: "vendor-b-model", VendorID: 2, VendorName: "Vendor B", CreatedTime: 25}, EnableGroups: []string{"group-a"}},
		{CCSwitchModelOption: dto.CCSwitchModelOption{Name: "vendor-a-old", VendorID: 1, VendorName: "Vendor A", CreatedTime: 20}, EnableGroups: []string{"group-a"}},
		{CCSwitchModelOption: dto.CCSwitchModelOption{Name: "vendor-a-oldest-searchable", VendorID: 1, VendorName: "Vendor A", CreatedTime: 10}, EnableGroups: []string{"group-a"}},
		{CCSwitchModelOption: dto.CCSwitchModelOption{Name: "forbidden-model", VendorID: 3, VendorName: "Vendor C", CreatedTime: 50}, EnableGroups: []string{"group-b"}},
	}
	setCCSwitchModelCatalogForTest(entries, true)

	recent, err := GetCCSwitchModels(1, 1, "")
	if err != nil {
		t.Fatalf("failed to get recent models: %v", err)
	}
	if len(recent.Items) != 4 {
		t.Fatalf("expected three Vendor A models and one Vendor B model, got %+v", recent.Items)
	}
	for _, item := range recent.Items {
		if item.Name == "vendor-a-oldest-searchable" || item.Name == "forbidden-model" {
			t.Fatalf("unexpected model in recent results: %+v", item)
		}
	}

	searched, err := GetCCSwitchModels(1, 1, "OLDEST")
	if err != nil {
		t.Fatalf("failed to search models: %v", err)
	}
	if len(searched.Items) != 1 || searched.Items[0].Name != "vendor-a-oldest-searchable" {
		t.Fatalf("expected full case-insensitive search to find old model, got %+v", searched.Items)
	}
}

func TestGetCCSwitchModelsRequiresTokenOwnership(t *testing.T) {
	setupCCSwitchModelCacheTest(t)
	setCCSwitchModelCatalogForTest(nil, true)
	if _, err := GetCCSwitchModels(2, 1, ""); err == nil {
		t.Fatal("expected token ownership check to fail")
	}
}

func TestCCSwitchModelCacheFallsBackToPreviousSnapshot(t *testing.T) {
	setupCCSwitchModelCacheTest(t)
	previous := []ccSwitchModelCatalogEntry{{
		CCSwitchModelOption: dto.CCSwitchModelOption{Name: "previous-model"},
		EnableGroups:        []string{"group-a"},
	}}
	setCCSwitchModelCatalogForTest(previous, false)
	buildCCSwitchModelCatalogFunc = func() ([]ccSwitchModelCatalogEntry, error) {
		return nil, errors.New("refresh failed")
	}

	entries, err := getCCSwitchModelCatalog()
	if err != nil {
		t.Fatalf("expected previous snapshot fallback, got %v", err)
	}
	if len(entries) != 1 || entries[0].Name != "previous-model" {
		t.Fatalf("unexpected fallback entries: %+v", entries)
	}
}

func TestNextCCSwitchModelCacheRefreshUsesLocalMidnight(t *testing.T) {
	location := time.FixedZone("test-zone", 8*60*60)
	now := time.Date(2026, 6, 11, 23, 59, 30, 0, location)
	next := nextCCSwitchModelCacheRefresh(now)
	want := time.Date(2026, 6, 12, 0, 0, 0, 0, location)
	if !next.Equal(want) || next.Location() != location {
		t.Fatalf("expected local midnight %v, got %v", want, next)
	}
}
