package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupOptionFixture(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&Option{}))
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMapRWMutex.Unlock()
}

func readOptionValue(t *testing.T, key string) string {
	t.Helper()
	var option Option
	require.NoError(t, DB.First(&option, Option{Key: key}).Error)
	return option.Value
}

// Regression test for #5933: GroupRatio (legacy option) and
// group_ratio_setting.group_ratio (ConfigManager option) deserialize into the
// same shared in-memory map but were persisted as independent rows. A drifted
// ConfigManager row silently overwrote frontend edits on the next options
// sync. Updating either key must persist both rows.
func TestUpdateOptionSyncsGroupRatioAliasRows(t *testing.T) {
	setupOptionFixture(t)

	// Seed a drifted ConfigManager row that lacks the group about to be
	// added — the bug's precondition observed in production databases.
	stale := Option{Key: "group_ratio_setting.group_ratio"}
	DB.FirstOrCreate(&stale, Option{Key: "group_ratio_setting.group_ratio"})
	stale.Value = `{"default":1}`
	require.NoError(t, DB.Save(&stale).Error)

	require.NoError(t, UpdateOption("GroupRatio", `{"default":1,"TestGroup":2}`))

	assert.JSONEq(t, `{"default":1,"TestGroup":2}`, readOptionValue(t, "GroupRatio"))
	assert.JSONEq(t, `{"default":1,"TestGroup":2}`, readOptionValue(t, "group_ratio_setting.group_ratio"))

	// The periodic option sync reloads the shared map from every row; the
	// group added through the legacy key must survive it regardless of row
	// processing order.
	loadOptionsFromDatabase()
	assert.True(t, ratio_setting.ContainsGroupRatio("TestGroup"))
	assert.Equal(t, float64(2), ratio_setting.GetGroupRatio("TestGroup"))
}

func TestUpdateOptionSyncsLegacyRowWhenConfigKeyUpdated(t *testing.T) {
	setupOptionFixture(t)

	require.NoError(t, UpdateOption("group_ratio_setting.group_group_ratio", `{"vip":{"default":0.8}}`))

	assert.JSONEq(t, `{"vip":{"default":0.8}}`, readOptionValue(t, "GroupGroupRatio"))
	assert.JSONEq(t, `{"vip":{"default":0.8}}`, readOptionValue(t, "group_ratio_setting.group_group_ratio"))

	ratio, ok := ratio_setting.GetGroupGroupRatio("vip", "default")
	require.True(t, ok)
	assert.Equal(t, 0.8, ratio)
}
