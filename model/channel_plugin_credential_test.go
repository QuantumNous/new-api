package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateChannelLocked(t *testing.T) {
	truncateTables(t)
	originalMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = originalMemoryCache; InitChannelCache() })
	channel := Channel{Id: 950001, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Name: "locked", Key: "first", Models: "m", Group: "default"}
	require.NoError(t, channel.Insert())
	InitChannelCache()

	stored, err := UpdateChannelLocked(channel.Id, func(stored *Channel) error {
		assert.Equal(t, "first", stored.Key)
		stored.Key = "second"
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, "second", stored.Key)
	cached, err := CacheGetChannel(channel.Id)
	require.NoError(t, err)
	assert.Equal(t, "second", cached.Key, "the cache publishes the new key at once")

	failure := errors.New("update failed")
	_, err = UpdateChannelLocked(channel.Id, func(stored *Channel) error {
		stored.Key = "lost"
		return failure
	})
	assert.ErrorIs(t, err, failure)

	_, err = UpdateChannelLocked(channel.Id, func(stored *Channel) error {
		// A key write that skipped the lock lands while the update runs.
		require.NoError(t, DB.Model(&Channel{}).Where("id = ?", stored.Id).Update("key", "edited").Error)
		stored.Key = "third"
		return nil
	})
	assert.ErrorIs(t, err, ErrChannelKeyChanged)
	current, err := GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "edited", current.Key, "a lost race never overwrites the newer key")

	_, err = UpdateChannelLocked(channel.Id, func(stored *Channel) error {
		// The polling cursor moves while the status changes.
		require.NoError(t, DB.Model(&Channel{}).Where("id = ?", stored.Id).Update("channel_info", ChannelInfo{MultiKeyPollingIndex: 3}).Error)
		stored.Status = common.ChannelStatusAutoDisabled
		return nil
	})
	require.NoError(t, err)
	current, err = GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, common.ChannelStatusAutoDisabled, current.Status)
	assert.Equal(t, 3, current.ChannelInfo.MultiKeyPollingIndex, "only the changed columns are written")
	assert.Equal(t, "edited", current.Key)
	var enabled []bool
	require.NoError(t, DB.Model(&Ability{}).Where("channel_id = ?", channel.Id).Pluck("enabled", &enabled).Error)
	assert.Equal(t, []bool{false}, enabled, "a new status reaches the abilities")

	_, err = UpdateChannelLocked(999999, func(*Channel) error { return nil })
	assert.Error(t, err)
}

