package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
)

func TestChannelVisibleToCallerRootAlways(t *testing.T) {
	assert.True(t, channelVisibleToCaller("svip", common.RoleRootUser, "default"))
}

func TestChannelVisibleToCallerRestrictedMatch(t *testing.T) {
	configureVisibleGroupsForChannelTest(t) // 可见 {default, vip}
	assert.True(t, channelVisibleToCaller("vip,svip", common.RoleAdminUser, "default"))
}

func TestChannelVisibleToCallerRestrictedNoMatch(t *testing.T) {
	configureVisibleGroupsForChannelTest(t)
	assert.False(t, channelVisibleToCaller("svip", common.RoleAdminUser, "default"))
}
