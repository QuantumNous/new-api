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

func TestGetCCSwitchModelOptionsForUserUsesSnapshotAndUserGroups(t *testing.T) {
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

	items, err := GetCCSwitchModelOptionsForUser(1)
	if err != nil {
		t.Fatalf("failed to get model options: %v", err)
	}
	if len(items) != 5 {
		t.Fatalf("expected all group-a models from the cached snapshot, got %+v", items)
	}
	for _, item := range items {
		if item.Name == "forbidden-model" {
			t.Fatalf("unexpected forbidden model in results: %+v", item)
		}
	}
}

func TestGetCCSwitchModelOptionsForUserRequiresUser(t *testing.T) {
	setupCCSwitchModelCacheTest(t)
	setCCSwitchModelCatalogForTest(nil, true)
	if _, err := GetCCSwitchModelOptionsForUser(2); err == nil {
		t.Fatal("expected missing user to fail")
	}
}

func TestSortCCSwitchModelCatalogGroupsByVendorAndCreatedTime(t *testing.T) {
	entries := []ccSwitchModelCatalogEntry{
		{CCSwitchModelOption: dto.CCSwitchModelOption{Name: "vendor-a-older", VendorName: "Vendor A", CreatedTime: 30}},
		{CCSwitchModelOption: dto.CCSwitchModelOption{Name: "vendor-c-model", VendorName: "Vendor C", CreatedTime: 20}},
		{CCSwitchModelOption: dto.CCSwitchModelOption{Name: "vendor-a-newer", VendorName: "Vendor A", CreatedTime: 40}},
		{CCSwitchModelOption: dto.CCSwitchModelOption{Name: "vendor-b-model", VendorName: "Vendor B", CreatedTime: 50}},
	}
	sortCCSwitchModelCatalog(entries)
	got := []string{entries[0].Name, entries[1].Name, entries[2].Name, entries[3].Name}
	want := []string{"vendor-b-model", "vendor-a-newer", "vendor-a-older", "vendor-c-model"}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("expected sorted order %+v, got %+v", want, got)
		}
	}
}

func TestSelectDefaultCCSwitchModelPrefersOpenAIAndAnthropic(t *testing.T) {
	items := []dto.CCSwitchModelOption{
		{Name: "vendor-newest", VendorName: "Vendor", CreatedTime: 99},
		{Name: "claude-latest", VendorName: "Anthropic", CreatedTime: 20},
		{Name: "gpt-latest", VendorName: "OpenAI", CreatedTime: 20},
	}
	if got := selectDefaultCCSwitchModel(items); got != "gpt-latest" {
		t.Fatalf("expected OpenAI tie-breaker, got %q", got)
	}

	items = []dto.CCSwitchModelOption{
		{Name: "vendor-old", VendorName: "Vendor A", CreatedTime: 10},
		{Name: "vendor-new", VendorName: "Vendor B", CreatedTime: 30},
	}
	if got := selectDefaultCCSwitchModel(items); got != "vendor-new" {
		t.Fatalf("expected latest non-preferred model, got %q", got)
	}

	if got := selectDefaultCCSwitchModel(nil); got != CCSwitchDefaultModel {
		t.Fatalf("expected fallback default model, got %q", got)
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

func TestNextCCSwitchModelCacheRefreshUsesLocalTopOfHour(t *testing.T) {
	location := time.FixedZone("test-zone", 8*60*60)
	now := time.Date(2026, 6, 11, 14, 23, 30, 0, location)
	next := nextCCSwitchModelCacheRefresh(now)
	want := time.Date(2026, 6, 11, 15, 0, 0, 0, location)
	if !next.Equal(want) || next.Location() != location {
		t.Fatalf("expected local top of hour %v, got %v", want, next)
	}
}
