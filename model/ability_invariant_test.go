package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFixAbilityRebuildsAbilitiesFromChannels(t *testing.T) {
	truncateTables(t)

	priority := int64(7)

	// Seed a stale ability that FixAbility must remove.
	require.NoError(t, DB.Create(&Ability{
		Group:     "stale-group",
		Model:     "stale-model",
		ChannelId: 999,
		Enabled:   true,
	}).Error)

	// Seed channels that FixAbility should convert into abilities.
	require.NoError(t, DB.Create(&Channel{
		Id:       1,
		Type:     1,
		Key:      "key-1",
		Status:   common.ChannelStatusEnabled,
		Name:     "channel-enabled",
		Group:    "default,vip",
		Models:   "gpt-4o,gpt-4.1",
		Priority: &priority,
	}).Error)

	require.NoError(t, DB.Create(&Channel{
		Id:     2,
		Type:   1,
		Key:    "key-2",
		Status: common.ChannelStatusManuallyDisabled,
		Name:   "channel-disabled",
		Group:  "default",
		Models: "claude-3-5-sonnet",
	}).Error)

	successCount, failCount, err := FixAbility()
	require.NoError(t, err)
	assert.Equal(t, 2, successCount)
	assert.Equal(t, 0, failCount)

	// Stale row must be gone.
	var staleCount int64
	require.NoError(t, DB.Model(&Ability{}).
		Where(&Ability{Group: "stale-group", Model: "stale-model"}).
		Count(&staleCount).Error)
	assert.Equal(t, int64(0), staleCount, "stale ability must be cleared by FixAbility")

	// Channel 1 (enabled, 2 groups x 2 models = 4 abilities) must be rebuilt.
	var ch1Count int64
	require.NoError(t, DB.Model(&Ability{}).Where("channel_id = ?", 1).Count(&ch1Count).Error)
	assert.Equal(t, int64(4), ch1Count, "enabled channel must produce group x model ability rows")

	// Channel 1 abilities must be enabled.
	var ch1Enabled int64
	require.NoError(t, DB.Model(&Ability{}).
		Where("channel_id = ? AND enabled = ?", 1, true).Count(&ch1Enabled).Error)
	assert.Equal(t, int64(4), ch1Enabled)

	// Channel 2 (disabled, 1 group x 1 model = 1 ability) must be rebuilt but disabled.
	var ch2Count int64
	require.NoError(t, DB.Model(&Ability{}).Where("channel_id = ?", 2).Count(&ch2Count).Error)
	assert.Equal(t, int64(1), ch2Count, "disabled channel must still produce an ability row")

	var ch2Enabled int64
	require.NoError(t, DB.Model(&Ability{}).
		Where("channel_id = ? AND enabled = ?", 2, false).Count(&ch2Enabled).Error)
	assert.Equal(t, int64(1), ch2Enabled, "disabled channel ability must have enabled=false")
}
