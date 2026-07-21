package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func resetChannelMonitorGroupMembershipTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&Channel{}, &Ability{}))
	for _, value := range []interface{}{&Ability{}, &Channel{}} {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(value).Error)
	}
	t.Cleanup(func() {
		for _, value := range []interface{}{&Ability{}, &Channel{}} {
			require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(value).Error)
		}
	})
}

func TestReplaceChannelMonitorGroupMembersUpdatesChannelsAndAbilities(t *testing.T) {
	resetChannelMonitorGroupMembershipTables(t)

	channels := []Channel{
		{Id: 101, Name: "add-member", Key: "secret", Status: common.ChannelStatusEnabled, Group: "default", Models: "model-a"},
		{Id: 102, Name: "remove-member", Key: "secret", Status: common.ChannelStatusEnabled, Group: "vip,backup", Models: "model-b"},
		{Id: 103, Name: "keep-member", Key: "secret", Status: common.ChannelStatusEnabled, Group: "vip", Models: "model-c"},
	}
	require.NoError(t, DB.Create(&channels).Error)
	for i := range channels {
		require.NoError(t, channels[i].AddAbilities(nil))
	}

	result, err := ReplaceChannelMonitorGroupMembers("vip", []int{103, 101, 101})
	require.NoError(t, err)
	assert.Equal(t, []int{101, 103}, result.ChannelIds)
	assert.Equal(t, []int{101}, result.AddedChannelIds)
	assert.Equal(t, []int{102}, result.RemovedChannelIds)

	var storedChannels []Channel
	require.NoError(t, DB.Order("id ASC").Find(&storedChannels).Error)
	require.Len(t, storedChannels, 3)
	assert.Equal(t, "default,vip", storedChannels[0].Group)
	assert.Equal(t, "backup", storedChannels[1].Group)
	assert.Equal(t, "vip", storedChannels[2].Group)

	var addedAbilities []Ability
	require.NoError(t, DB.Where("channel_id = ?", 101).Order(commonGroupCol+" ASC").Find(&addedAbilities).Error)
	require.Len(t, addedAbilities, 2)
	assert.Equal(t, "default", addedAbilities[0].Group)
	assert.Equal(t, "vip", addedAbilities[1].Group)

	var removedAbilities []Ability
	require.NoError(t, DB.Where("channel_id = ?", 102).Find(&removedAbilities).Error)
	require.Len(t, removedAbilities, 1)
	assert.Equal(t, "backup", removedAbilities[0].Group)
}

func TestReplaceChannelMonitorGroupMembersRollsBackWhenRemovalWouldLeaveNoGroup(t *testing.T) {
	resetChannelMonitorGroupMembershipTables(t)

	channels := []Channel{
		{Id: 201, Name: "would-add", Key: "secret", Status: common.ChannelStatusEnabled, Group: "default", Models: "model-a"},
		{Id: 202, Name: "only-vip", Key: "secret", Status: common.ChannelStatusEnabled, Group: "vip", Models: "model-b"},
	}
	require.NoError(t, DB.Create(&channels).Error)
	for i := range channels {
		require.NoError(t, channels[i].AddAbilities(nil))
	}

	_, err := ReplaceChannelMonitorGroupMembers("vip", []int{201})
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrChannelMonitorGroupMembershipRequired))

	var storedChannels []Channel
	require.NoError(t, DB.Order("id ASC").Find(&storedChannels).Error)
	require.Len(t, storedChannels, 2)
	assert.Equal(t, "default", storedChannels[0].Group)
	assert.Equal(t, "vip", storedChannels[1].Group)

	var abilities []Ability
	require.NoError(t, DB.Order("channel_id ASC").Find(&abilities).Error)
	require.Len(t, abilities, 2)
	assert.Equal(t, 201, abilities[0].ChannelId)
	assert.Equal(t, "default", abilities[0].Group)
	assert.Equal(t, 202, abilities[1].ChannelId)
	assert.Equal(t, "vip", abilities[1].Group)
}
