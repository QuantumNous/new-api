package model

import (
	"fmt"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelAccessDB(t *testing.T) (*gorm.DB, *atomic.Int64) {
	t.Helper()
	originalDB := DB
	originalGroupCol := commonGroupCol
	originalSQLite := common.UsingSQLite
	originalMySQL := common.UsingMySQL
	originalPostgreSQL := common.UsingPostgreSQL

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	commonGroupCol = "`group`"
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}, &Model{}, &Vendor{}, &ModelAvailabilityState{}))

	var queryCount atomic.Int64
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("model_access_test:count", func(*gorm.DB) {
		queryCount.Add(1)
	}))
	require.NoError(t, db.Callback().Row().Before("gorm:row").Register("model_access_test:count_row", func(*gorm.DB) {
		queryCount.Add(1)
	}))

	t.Cleanup(func() {
		DB = originalDB
		commonGroupCol = originalGroupCol
		common.UsingSQLite = originalSQLite
		common.UsingMySQL = originalMySQL
		common.UsingPostgreSQL = originalPostgreSQL
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
	return db, &queryCount
}

func TestGetModelAccessRowsForGroupsNormalizesAndFilters(t *testing.T) {
	db, queryCount := setupModelAccessDB(t)
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&[]Channel{
		{Id: 1, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Key: "enabled", Models: "allowed,disabled-ability", Group: "default", Priority: &priority, Weight: &weight},
		{Id: 2, Type: constant.ChannelTypeAnthropic, Status: common.ChannelStatusManuallyDisabled, Key: "disabled", Models: "disabled-channel", Group: "default", Priority: &priority, Weight: &weight},
	}).Error)
	require.NoError(t, db.Create(&[]Ability{
		{Group: "default", Model: "allowed", ChannelId: 1, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "default", Model: "disabled-ability", ChannelId: 1, Enabled: false, Priority: &priority, Weight: weight},
		{Group: "default", Model: "disabled-channel", ChannelId: 2, Enabled: true, Priority: &priority, Weight: weight},
	}).Error)

	queryCount.Store(0)
	rows, err := GetModelAccessRowsForGroups([]string{" default ", "default", "", "missing"})
	require.NoError(t, err)
	require.Equal(t, []ModelAccessRow{{GroupName: "default", Model: "allowed", ChannelType: constant.ChannelTypeOpenAI}}, rows)
	require.Equal(t, int64(1), queryCount.Load())

	queryCount.Store(0)
	rows, err = GetModelAccessRowsForGroups([]string{" ", ""})
	require.NoError(t, err)
	require.Empty(t, rows)
	require.Zero(t, queryCount.Load(), "empty normalized input must not hit the database")
}

func TestGetPublicModelMetadataMapUsesPublicVendorAndNilFallback(t *testing.T) {
	db, _ := setupModelAccessDB(t)
	vendor := Vendor{Name: "Public Vendor", Icon: "public", Status: 1}
	require.NoError(t, db.Create(&vendor).Error)
	require.NoError(t, db.Create(&[]Model{
		{ModelName: "exact-model", Description: "Exact model introduction", VendorID: vendor.Id, Status: 1, NameRule: NameRuleExact},
		{ModelName: "prefix-", Description: "Model family introduction", VendorID: vendor.Id, Status: 1, NameRule: NameRulePrefix},
	}).Error)

	metadata, err := GetPublicModelMetadataMap([]string{"exact-model", "prefix-child", "missing"})
	require.NoError(t, err)
	require.Equal(t, "Public Vendor", metadata["exact-model"].Vendor.Name)
	require.Equal(t, "Exact model introduction", metadata["exact-model"].Description)
	require.Equal(t, "Public Vendor", metadata["prefix-child"].Vendor.Name)
	require.Equal(t, "Model family introduction", metadata["prefix-child"].Description)
	_, exists := metadata["missing"]
	require.False(t, exists)
}

func TestMatchPublicModelMetadataRuleSkipsBlankPatterns(t *testing.T) {
	tests := []struct {
		name    string
		rule    int
		pattern string
	}{
		{name: "prefix", rule: NameRulePrefix, pattern: "target"},
		{name: "suffix", rule: NameRuleSuffix, pattern: "model"},
		{name: "contains", rule: NameRuleContains, pattern: "get-mo"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matched, ok := matchPublicModelMetadataRule("target-model", map[int][]Model{
				tt.rule: {
					{ModelName: "   ", NameRule: tt.rule, VendorID: 1},
					{ModelName: tt.pattern, NameRule: tt.rule, VendorID: 2},
				},
			})
			require.True(t, ok)
			require.Equal(t, 2, matched.VendorID)
		})
	}
}

func TestGetPublicModelMetadataMapPrefersExactMatchOverRule(t *testing.T) {
	db, _ := setupModelAccessDB(t)
	exactVendor := Vendor{Name: "Exact Vendor", Icon: "exact", Status: 1}
	ruleVendor := Vendor{Name: "Rule Vendor", Icon: "rule", Status: 1}
	require.NoError(t, db.Create(&exactVendor).Error)
	require.NoError(t, db.Create(&ruleVendor).Error)
	require.NoError(t, db.Create(&[]Model{
		{ModelName: "exact-model", VendorID: exactVendor.Id, Status: 1, NameRule: NameRuleExact},
		{ModelName: "exact-", VendorID: ruleVendor.Id, Status: 1, NameRule: NameRulePrefix},
	}).Error)

	metadata, err := GetPublicModelMetadataMap([]string{"exact-model"})
	require.NoError(t, err)
	require.Equal(t, "Exact Vendor", metadata["exact-model"].Vendor.Name)
}
