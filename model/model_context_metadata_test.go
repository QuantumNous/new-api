package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelMetadataTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := DB
	dsn := fmt.Sprintf(
		"file:%s?mode=memory&cache=shared",
		strings.ReplaceAll(t.Name(), "/", "_"),
	)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	t.Cleanup(func() {
		DB = previousDB
		sqlDB, openErr := db.DB()
		if openErr == nil {
			_ = sqlDB.Close()
		}
	})
	DB = db
	require.NoError(t, db.AutoMigrate(&Model{}))
	return db
}

func TestSetupModelMetadataTestDBRestoresPreviousDB(t *testing.T) {
	previousDB := DB

	t.Run("isolated database", func(t *testing.T) {
		isolatedDB := setupModelMetadataTestDB(t)
		require.Same(t, isolatedDB, DB)
	})

	require.Same(t, previousDB, DB)
	require.NoError(t, DB.Exec("SELECT 1").Error)
}

func TestModelUpdatePersistsAndClearsTokenLimits(t *testing.T) {
	db := setupModelMetadataTestDB(t)
	entry := &Model{
		ModelName:       "example-model",
		Status:          1,
		ContextWindow:   262144,
		MaxOutputTokens: 32768,
	}
	require.NoError(t, entry.Insert())

	entry.ContextWindow = 0
	entry.MaxOutputTokens = 0
	require.NoError(t, entry.Update())

	var stored Model
	require.NoError(t, db.First(&stored, entry.Id).Error)
	assert.Zero(t, stored.ContextWindow)
	assert.Zero(t, stored.MaxOutputTokens)
}

func TestModelTokenLimits(t *testing.T) {
	t.Run("resolves enabled rules with exact precedence", func(t *testing.T) {
		setupModelMetadataTestDB(t)
		require.NoError(t, DB.Create(&[]Model{
			{ModelName: "kimi-k2.7-code", NameRule: NameRuleExact, Status: 1, ContextWindow: 262144},
			{ModelName: "kimi-", NameRule: NameRulePrefix, Status: 1, ContextWindow: 200000},
			{ModelName: "k2.7", NameRule: NameRuleContains, Status: 1, ContextWindow: 131072},
			{ModelName: "-code", NameRule: NameRuleSuffix, Status: 1, ContextWindow: 65536},
		}).Error)

		limits, err := GetModelTokenLimits([]string{"kimi-k2.7-code", "kimi-other"})
		require.NoError(t, err)
		assert.Equal(t, int64(262144), limits["kimi-k2.7-code"].ContextWindow)
		assert.Equal(t, int64(200000), limits["kimi-other"].ContextWindow)
	})

	t.Run("selects the longest matching pattern", func(t *testing.T) {
		setupModelMetadataTestDB(t)
		require.NoError(t, DB.Create(&[]Model{
			{ModelName: "model-", NameRule: NameRulePrefix, Status: 1, ContextWindow: 65536},
			{ModelName: "model-long-", NameRule: NameRulePrefix, Status: 1, ContextWindow: 131072},
		}).Error)

		limits, err := GetModelTokenLimits([]string{"model-long-name"})
		require.NoError(t, err)
		assert.Equal(t, int64(131072), limits["model-long-name"].ContextWindow)
	})

	t.Run("ignores disabled exact entries", func(t *testing.T) {
		setupModelMetadataTestDB(t)
		disabledExact := &Model{ModelName: "disabled-exact", NameRule: NameRuleExact, Status: 0, ContextWindow: 262144}
		require.NoError(t, disabledExact.Insert())
		require.NoError(t, DB.Create(&Model{
			ModelName: "disabled-", NameRule: NameRulePrefix, Status: 1, ContextWindow: 65536,
		}).Error)
		var storedDisabledExact Model
		require.NoError(t, DB.Where("model_name = ?", "disabled-exact").First(&storedDisabledExact).Error)
		require.Zero(t, storedDisabledExact.Status)

		limits, err := GetModelTokenLimits([]string{"disabled-exact"})
		require.NoError(t, err)
		assert.Equal(t, int64(65536), limits["disabled-exact"].ContextWindow)
	})

	t.Run("normalizes duplicate inputs", func(t *testing.T) {
		setupModelMetadataTestDB(t)
		require.NoError(t, DB.Create(&Model{
			ModelName:       "duplicate-model",
			NameRule:        NameRuleExact,
			Status:          1,
			MaxOutputTokens: 8192,
		}).Error)

		limits, err := GetModelTokenLimits([]string{" duplicate-model ", "duplicate-model", "duplicate-model"})
		require.NoError(t, err)
		assert.Equal(t, map[string]ModelTokenLimits{
			"duplicate-model": {MaxOutputTokens: 8192},
		}, limits)
	})

	t.Run("considers prefix contains and suffix rules by pattern length then id", func(t *testing.T) {
		setupModelMetadataTestDB(t)
		require.NoError(t, DB.Create(&[]Model{
			{ModelName: "model-", NameRule: NameRulePrefix, Status: 1, ContextWindow: 65536},
			{ModelName: "long-name", NameRule: NameRuleContains, Status: 1, ContextWindow: 131072},
			{ModelName: "-name", NameRule: NameRuleSuffix, Status: 1, ContextWindow: 98304},
			{ModelName: "entry-", NameRule: NameRulePrefix, Status: 1, ContextWindow: 24576},
			{ModelName: "-value", NameRule: NameRuleSuffix, Status: 1, ContextWindow: 49152},
		}).Error)

		limits, err := GetModelTokenLimits([]string{"model-long-name", "entry-value", "other-value"})
		require.NoError(t, err)
		assert.Equal(t, int64(131072), limits["model-long-name"].ContextWindow)
		assert.Equal(t, int64(24576), limits["entry-value"].ContextWindow)
		assert.Equal(t, int64(49152), limits["other-value"].ContextWindow)
	})

	t.Run("returns no entry when all limits are zero", func(t *testing.T) {
		setupModelMetadataTestDB(t)
		require.NoError(t, DB.Create(&Model{
			ModelName: "unlimited-model",
			NameRule:  NameRuleExact,
			Status:    1,
		}).Error)

		limits, err := GetModelTokenLimits([]string{"unlimited-model"})
		require.NoError(t, err)
		assert.Empty(t, limits)
	})

	t.Run("returns an empty map for an empty request", func(t *testing.T) {
		setupModelMetadataTestDB(t)

		limits, err := GetModelTokenLimits(nil)
		require.NoError(t, err)
		assert.Empty(t, limits)
	})
}
