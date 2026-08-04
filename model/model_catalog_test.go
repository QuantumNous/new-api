package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestModelCatalogQueriesKeepDisabledConfigurationVisible(t *testing.T) {
	db, _ := setupModelAccessDB(t)
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&[]Channel{
		{Id: 1, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Key: "enabled", Models: " ready , shared,ready ", Group: " plg, default ", Priority: &priority, Weight: &weight},
		{Id: 2, Type: constant.ChannelTypeAnthropic, Status: common.ChannelStatusAutoDisabled, Key: "disabled", Models: "blocked", Group: "plg", Priority: &priority, Weight: &weight},
		{Id: 3, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Key: "empty", Models: "", Group: "plg", Priority: &priority, Weight: &weight},
	}).Error)
	require.NoError(t, db.Create(&[]Ability{
		{Group: "plg", Model: "ready", ChannelId: 1, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "plg", Model: "blocked", ChannelId: 2, Enabled: false, Priority: &priority, Weight: weight},
	}).Error)

	channels, err := GetModelCatalogChannels()
	require.NoError(t, err)
	require.Len(t, channels, 2)
	require.Equal(t, []string{"ready", "shared"}, channels[0].Models)
	require.Equal(t, []string{"default", "plg"}, channels[0].Groups)
	require.Equal(t, common.ChannelStatusAutoDisabled, channels[1].Status)

	abilities, err := GetModelCatalogAbilitiesForGroup(" plg ")
	require.NoError(t, err)
	require.Equal(t, []ModelCatalogAbility{
		{GroupName: "plg", Model: "blocked", ChannelID: 2, ChannelType: constant.ChannelTypeAnthropic, ChannelStatus: common.ChannelStatusAutoDisabled, Enabled: false},
		{GroupName: "plg", Model: "ready", ChannelID: 1, ChannelType: constant.ChannelTypeOpenAI, ChannelStatus: common.ChannelStatusEnabled, Enabled: true},
	}, abilities)

	empty, err := GetModelCatalogAbilitiesForGroup(" ")
	require.NoError(t, err)
	require.Empty(t, empty)
}
