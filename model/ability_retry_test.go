package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetChannelWithExclusionsSelectsHighestRemainingPriority(t *testing.T) {
	require.NoError(t, DB.Exec("DELETE FROM abilities").Error)
	require.NoError(t, DB.Exec("DELETE FROM channels").Error)

	highPriority := int64(100)
	lowPriority := int64(50)
	channels := []Channel{
		{Id: 101, Name: "cheap", Status: common.ChannelStatusEnabled},
		{Id: 102, Name: "stable", Status: common.ChannelStatusEnabled},
	}
	require.NoError(t, DB.Create(&channels).Error)
	require.NoError(t, DB.Create(&[]Ability{
		{Group: "default", Model: "test-model", ChannelId: 101, Enabled: true, Priority: &highPriority, Weight: 100},
		{Group: "default", Model: "test-model", ChannelId: 102, Enabled: true, Priority: &lowPriority, Weight: 100},
	}).Error)

	channel, err := GetChannelWithExclusions(
		"default",
		"test-model",
		0,
		"",
		map[int]struct{}{101: {}},
	)

	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 102, channel.Id)

	channel, err = GetChannelWithExclusions(
		"default",
		"test-model",
		1,
		"",
		map[int]struct{}{101: {}},
	)

	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 102, channel.Id)
}
