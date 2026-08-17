package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCopilotAbilityStaysDisabledUntilCredentialIsStored(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	DB = db
	t.Cleanup(func() { DB = originalDB })

	channel := Channel{
		Type:   constant.ChannelTypeCopilot,
		Name:   "copilot",
		Models: "claude-opus-4.8",
		Group:  "default",
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(nil))

	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	require.False(t, ability.Enabled)

	require.NoError(t, UpdateChannelKeyForType(channel.Id, constant.ChannelTypeCopilot, "gho_test"))
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	require.True(t, ability.Enabled)

	partialChannel := Channel{
		Id:     channel.Id,
		Type:   constant.ChannelTypeCopilot,
		Models: channel.Models,
		Group:  channel.Group,
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, partialChannel.UpdateAbilities(nil))
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	require.True(t, ability.Enabled)

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	require.Equal(t, "gho_test", stored.Key)
}

func TestBlankCredentialDoesNotDisableOtherChannelAbilities(t *testing.T) {
	channel := Channel{
		Type:   constant.ChannelTypeOpenAI,
		Models: "gpt-test",
		Group:  "default",
		Status: common.ChannelStatusEnabled,
	}

	abilities, err := channel.buildAbilities(nil)
	require.NoError(t, err)
	require.Len(t, abilities, 1)
	require.True(t, abilities[0].Enabled)
}
