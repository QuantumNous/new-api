package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupCommissionTestDB initializes an in-memory SQLite DB with the commission
// tables added by this MVP. Individual task tests extend the AutoMigrate list
// as new tables are introduced; unused tables are cheap to migrate against
// SQLite so we keep a single helper.
func setupCommissionTestDB(t *testing.T) {
	t.Helper()
	oldDB := DB
	oldType := common.MainDatabaseType()
	DB = nil
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = oldDB
		common.SetMainDatabaseType(oldType)
	})
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	require.NoError(t, DB.AutoMigrate(
		&CommissionRule{},
	))
}

func TestCommissionRule_ActiveRulesForFirstTopup(t *testing.T) {
	setupCommissionTestDB(t)

	require.NoError(t, SeedDefaultCommissionRules())

	rules, err := GetActiveCommissionRules(CommissionScopeFirstTopup)
	require.NoError(t, err)
	require.Len(t, rules, 2)

	byLevel := map[int]*CommissionRule{}
	for i := range rules {
		byLevel[rules[i].Level] = &rules[i]
	}

	require.Contains(t, byLevel, 1)
	require.Contains(t, byLevel, 2)
	require.InDelta(t, 20.0, byLevel[1].RatePercent, 0.001)
	require.InDelta(t, 5.0, byLevel[2].RatePercent, 0.001)
	require.Equal(t, 7, byLevel[1].FrozenDays)
	require.True(t, byLevel[1].Enabled)
}

func TestCommissionRule_DisabledFiltered(t *testing.T) {
	setupCommissionTestDB(t)
	require.NoError(t, SeedDefaultCommissionRules())

	require.NoError(t, DB.Model(&CommissionRule{}).
		Where("scope = ? AND level = ?", CommissionScopeFirstTopup, 2).
		Update("enabled", false).Error)

	rules, err := GetActiveCommissionRules(CommissionScopeFirstTopup)
	require.NoError(t, err)
	require.Len(t, rules, 1)
	require.Equal(t, 1, rules[0].Level)
}

func TestCommissionRule_SeedIsIdempotent(t *testing.T) {
	setupCommissionTestDB(t)

	require.NoError(t, SeedDefaultCommissionRules())
	require.NoError(t, SeedDefaultCommissionRules())

	var count int64
	require.NoError(t, DB.Model(&CommissionRule{}).Count(&count).Error)
	require.EqualValues(t, 2, count, "second seed call must not duplicate rows")
}
