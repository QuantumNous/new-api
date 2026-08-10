package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestRenameChannelGroupUpdatesChannelsAndAbilities(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Exec("DELETE FROM abilities").Error)
	require.NoError(t, DB.Exec("DELETE FROM channels").Error)

	channels := []Channel{
		{
			Id:     101,
			Name:   "multi",
			Group:  "default,vip",
			Models: "gpt-4o",
			Status: common.ChannelStatusEnabled,
			Key:    "key-1",
		},
		{
			Id:     102,
			Name:   "single",
			Group:  "vip",
			Models: "gpt-4o",
			Status: common.ChannelStatusEnabled,
			Key:    "key-2",
		},
		{
			Id:     103,
			Name:   "other",
			Group:  "default",
			Models: "gpt-4o",
			Status: common.ChannelStatusEnabled,
			Key:    "key-3",
		},
	}
	for i := range channels {
		require.NoError(t, DB.Create(&channels[i]).Error)
	}

	updated, err := RenameChannelGroup("vip", "pro")
	require.NoError(t, err)
	require.Equal(t, int64(2), updated)

	var multi, single, other Channel
	require.NoError(t, DB.First(&multi, "id = ?", 101).Error)
	require.NoError(t, DB.First(&single, "id = ?", 102).Error)
	require.NoError(t, DB.First(&other, "id = ?", 103).Error)
	require.Equal(t, "default,pro", multi.Group)
	require.Equal(t, "pro", single.Group)
	require.Equal(t, "default", other.Group)

	var abilityCount int64
	require.NoError(t, DB.Model(&Ability{}).Where(commonGroupCol+" = ?", "vip").Count(&abilityCount).Error)
	require.Zero(t, abilityCount)
	require.NoError(t, DB.Model(&Ability{}).Where(commonGroupCol+" = ?", "pro").Count(&abilityCount).Error)
	require.Equal(t, int64(2), abilityCount)
}

func TestRenameChannelGroupNoopForSameName(t *testing.T) {
	truncateTables(t)
	updated, err := RenameChannelGroup("vip", "vip")
	require.NoError(t, err)
	require.Zero(t, updated)
}
