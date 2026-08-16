package model

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelStatusTest(t *testing.T) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.Exec("DELETE FROM abilities").Error)
	require.NoError(t, DB.Exec("DELETE FROM channels").Error)

	memoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		common.MemoryCacheEnabled = memoryCacheEnabled
	})
}

func TestUpdateChannelStatusPersistsMultiKeyState(t *testing.T) {
	setupChannelStatusTest(t)

	channel := Channel{
		Name:   "multi-key-status",
		Key:    "key-a\nkey-b",
		Status: common.ChannelStatusEnabled,
		ChannelInfo: ChannelInfo{
			IsMultiKey:           true,
			MultiKeySize:         2,
			MultiKeyMode:         constant.MultiKeyModePolling,
			MultiKeyPollingIndex: 1,
		},
	}
	require.NoError(t, DB.Create(&channel).Error)

	changed := UpdateChannelStatus(channel.Id, "key-a", common.ChannelStatusAutoDisabled, "provider rejected key")
	require.True(t, changed)

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored.ChannelInfo.MultiKeyStatusList[0])
	assert.Equal(t, "provider rejected key", stored.ChannelInfo.MultiKeyDisabledReason[0])
	assert.NotZero(t, stored.ChannelInfo.MultiKeyDisabledTime[0])
	assert.Equal(t, 1, stored.ChannelInfo.MultiKeyPollingIndex)
}

func TestGetNextEnabledKeySkipsBlankEntries(t *testing.T) {
	channel := Channel{
		Id:     991,
		Key:    "   \nvalid-but-disabled",
		Status: common.ChannelStatusEnabled,
		ChannelInfo: ChannelInfo{
			IsMultiKey:         true,
			MultiKeySize:       2,
			MultiKeyStatusList: map[int]int{1: common.ChannelStatusManuallyDisabled},
		},
	}

	key, _, apiErr := channel.GetNextEnabledKey()
	require.NotNil(t, apiErr)
	assert.Empty(t, key)
}

func TestInitChannelCacheExcludesMultiKeyChannelWithoutUsableKey(t *testing.T) {
	setupChannelStatusTest(t)
	common.MemoryCacheEnabled = true

	channel := Channel{
		Name:   "blank-multi-key",
		Key:    "   \n\t",
		Status: common.ChannelStatusEnabled,
		Models: "cache-model",
		Group:  "default",
		ChannelInfo: ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
		},
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "cache-model", ChannelId: channel.Id, Enabled: true,
	}).Error)

	InitChannelCache()
	selected, err := GetRandomSatisfiedChannel("default", "cache-model", 0, "")
	require.NoError(t, err)
	assert.Nil(t, selected)
}

func TestInitChannelCacheDoesNotOverwriteConcurrentIncrementalUpdate(t *testing.T) {
	setupChannelStatusTest(t)
	common.MemoryCacheEnabled = true

	channel := Channel{
		Name:   "concurrent-cache-refresh",
		Key:    "key",
		Status: common.ChannelStatusEnabled,
		Models: "cache-model",
		Group:  "default",
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "cache-model", ChannelId: channel.Id, Enabled: true,
	}).Error)
	InitChannelCache()

	snapshotRead := make(chan struct{})
	releaseSnapshot := make(chan struct{})
	var releaseOnce sync.Once
	t.Cleanup(func() { releaseOnce.Do(func() { close(releaseSnapshot) }) })
	var intercepted atomic.Bool
	const callbackName = "test:block_stale_channel_cache_refresh"
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "channels" && intercepted.CompareAndSwap(false, true) {
			close(snapshotRead)
			<-releaseSnapshot
		}
	}))
	t.Cleanup(func() { _ = DB.Callback().Query().Remove(callbackName) })

	refreshDone := make(chan struct{})
	go func() {
		InitChannelCache()
		close(refreshDone)
	}()

	select {
	case <-snapshotRead:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out waiting for the full cache refresh snapshot")
	}

	require.True(t, UpdateChannelStatus(
		channel.Id, "", common.ChannelStatusAutoDisabled, "provider rejected channel",
	))

	releaseOnce.Do(func() { close(releaseSnapshot) })
	select {
	case <-refreshDone:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out waiting for the full cache refresh retry")
	}

	cached, err := CacheGetChannel(channel.Id)
	require.NoError(t, err)
	assert.Equal(t, common.ChannelStatusAutoDisabled, cached.Status)
	selected, err := GetRandomSatisfiedChannel("default", "cache-model", 0, "")
	require.NoError(t, err)
	assert.Nil(t, selected)
}

func TestUpdateChannelStatusRestoresEnabledChannelToRoutingCache(t *testing.T) {
	setupChannelStatusTest(t)
	common.MemoryCacheEnabled = true

	channel := Channel{
		Name:   "recover-cache-route",
		Key:    "key",
		Status: common.ChannelStatusAutoDisabled,
		Models: "cache-model",
		Group:  "default",
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "cache-model", ChannelId: channel.Id, Enabled: false,
	}).Error)
	InitChannelCache()

	require.True(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "recovered"))
	selected, err := GetRandomSatisfiedChannel("default", "cache-model", 0, "")
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, channel.Id, selected.Id)
}

func TestUpdateChannelStatusDoesNotEnableMultiKeyChannelWithoutUsableKey(t *testing.T) {
	setupChannelStatusTest(t)

	channel := Channel{
		Name:   "no-usable-key",
		Key:    "key-a\n   ",
		Status: common.ChannelStatusAutoDisabled,
		Models: "gpt-4",
		Group:  "default",
		ChannelInfo: ChannelInfo{
			IsMultiKey:         true,
			MultiKeySize:       2,
			MultiKeyStatusList: map[int]int{0: common.ChannelStatusAutoDisabled},
		},
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: false,
	}).Error)

	assert.False(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "manual operation"))

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status)
	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.False(t, ability.Enabled)
}

func TestUpdateChannelStatusPreservesManualDisableDuringMultiKeyHealthChanges(t *testing.T) {
	setupChannelStatusTest(t)

	channel := Channel{
		Name:   "manual-disable-multi-key",
		Key:    "key-a\nkey-b",
		Status: common.ChannelStatusManuallyDisabled,
		Models: "gpt-4",
		Group:  "default",
		ChannelInfo: ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
		},
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: false,
	}).Error)

	require.True(t, UpdateChannelStatus(
		channel.Id, "key-a", common.ChannelStatusAutoDisabled, "provider rejected key",
	))
	require.True(t, UpdateChannelStatus(
		channel.Id, "key-b", common.ChannelStatusAutoDisabled, "provider rejected key",
	))
	require.True(t, UpdateChannelStatus(
		channel.Id, "key-a", common.ChannelStatusEnabled, "recovered",
	))

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, stored.Status)
	assert.NotContains(t, stored.ChannelInfo.MultiKeyStatusList, 0)
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored.ChannelInfo.MultiKeyStatusList[1])
	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.False(t, ability.Enabled)
}

func TestUpdateChannelStatusIgnoresHealthResultForMissingLegacyMultiKey(t *testing.T) {
	setupChannelStatusTest(t)

	channel := Channel{
		Name:   "manual-disable-empty-multi-key",
		Status: common.ChannelStatusManuallyDisabled,
		Models: "gpt-4",
		Group:  "default",
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
		},
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: false,
	}).Error)

	assert.False(t, UpdateChannelStatus(
		channel.Id, "deleted-key", common.ChannelStatusAutoDisabled, "late health result",
	))
	assert.False(t, UpdateChannelStatus(
		channel.Id, "deleted-key", common.ChannelStatusEnabled, "late recovery",
	))

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, stored.Status)
}

func TestUpdateChannelStatusDoesNotEnableEmptyLegacyMultiKey(t *testing.T) {
	setupChannelStatusTest(t)

	channel := Channel{
		Name:   "empty-legacy-multi-key",
		Status: common.ChannelStatusAutoDisabled,
		Models: "gpt-4",
		Group:  "default",
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
		},
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: false,
	}).Error)

	assert.False(t, UpdateChannelStatus(
		channel.Id, "", common.ChannelStatusEnabled, "manual operation",
	))

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status)
	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.False(t, ability.Enabled)
}

func TestReplaceMultiKeyKeysDropsUnusableEntriesAndRemapsState(t *testing.T) {
	channel := Channel{
		Key: "key-a\nkey-b",
		ChannelInfo: ChannelInfo{
			IsMultiKey:             true,
			MultiKeySize:           2,
			MultiKeyStatusList:     map[int]int{1: common.ChannelStatusAutoDisabled},
			MultiKeyDisabledReason: map[int]string{1: "rejected"},
			MultiKeyDisabledTime:   map[int]int64{1: 123},
		},
	}

	channel.ReplaceMultiKeyKeys("  \nkey-b\n\"\"\nkey-c")
	channel.normalizeMultiKeyAvailability()

	assert.Equal(t, "key-b\nkey-c", channel.Key)
	assert.Equal(t, 2, channel.ChannelInfo.MultiKeySize)
	assert.Equal(t, common.ChannelStatusAutoDisabled, channel.ChannelInfo.MultiKeyStatusList[0])
	assert.Equal(t, "rejected", channel.ChannelInfo.MultiKeyDisabledReason[0])
	assert.Equal(t, int64(123), channel.ChannelInfo.MultiKeyDisabledTime[0])
}

func TestUpdateChannelStatusOnlyRecoversAvailabilityAutoDisable(t *testing.T) {
	setupChannelStatusTest(t)

	channel := Channel{
		Name:   "unrelated-auto-disable",
		Key:    "key-a\nkey-b",
		Status: common.ChannelStatusAutoDisabled,
		Models: "gpt-4",
		Group:  "default",
		ChannelInfo: ChannelInfo{
			IsMultiKey:         true,
			MultiKeySize:       2,
			MultiKeyStatusList: map[int]int{0: common.ChannelStatusAutoDisabled, 1: common.ChannelStatusAutoDisabled},
		},
	}
	channel.SetOtherInfo(map[string]interface{}{"status_reason": "provider unavailable"})
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: false,
	}).Error)

	require.True(t, UpdateChannelStatus(channel.Id, "key-a", common.ChannelStatusEnabled, "recovered"))

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status)
	assert.Equal(t, "provider unavailable", stored.GetOtherInfo()["status_reason"])
	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.False(t, ability.Enabled)
}

func TestUpdateChannelAtomicallyKeepsPersistedIdentity(t *testing.T) {
	setupChannelStatusTest(t)

	channel := Channel{
		Name:   "atomic-identity",
		Key:    "key",
		Status: common.ChannelStatusEnabled,
		Models: "gpt-4",
		Group:  "default",
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: true,
	}).Error)

	updated, err := UpdateChannelAtomically(channel.Id, func(current *Channel) error {
		current.Id = channel.Id + 1000
		current.Name = "updated"
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, channel.Id, updated.Id)

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	assert.Equal(t, "updated", stored.Name)
	var abilities []Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).Find(&abilities).Error)
	require.Len(t, abilities, 1)
	assert.Equal(t, channel.Id, abilities[0].ChannelId)
}

func TestDeleteDisabledChannelPreservesEnabledChannelsAndAbilities(t *testing.T) {
	setupChannelStatusTest(t)

	disabled := Channel{Name: "disabled", Status: common.ChannelStatusAutoDisabled}
	enabled := Channel{Name: "enabled", Status: common.ChannelStatusEnabled}
	require.NoError(t, DB.Create(&disabled).Error)
	require.NoError(t, DB.Create(&enabled).Error)
	require.NoError(t, DB.Create(&[]Ability{
		{Group: "default", Model: "disabled-model", ChannelId: disabled.Id, Enabled: false},
		{Group: "default", Model: "enabled-model", ChannelId: enabled.Id, Enabled: true},
	}).Error)

	deleted, err := DeleteDisabledChannel()
	require.NoError(t, err)
	assert.Equal(t, int64(1), deleted)
	assert.ErrorIs(t, DB.First(&Channel{}, disabled.Id).Error, gorm.ErrRecordNotFound)
	require.NoError(t, DB.First(&Channel{}, enabled.Id).Error)
	assert.ErrorIs(t, DB.Where("channel_id = ?", disabled.Id).First(&Ability{}).Error, gorm.ErrRecordNotFound)
	require.NoError(t, DB.Where("channel_id = ?", enabled.Id).First(&Ability{}).Error)
}

func TestSaveStatusStateFromSingleKeySnapshotPreservesUnownedColumns(t *testing.T) {
	setupChannelStatusTest(t)

	channel := Channel{
		Name:        "single-key-status",
		Key:         "original-key",
		Status:      common.ChannelStatusEnabled,
		Models:      "original-model",
		Group:       "default",
		UsedQuota:   100,
		ChannelInfo: ChannelInfo{},
	}
	require.NoError(t, DB.Create(&channel).Error)

	stale, err := GetChannelById(channel.Id, true)
	require.NoError(t, err)

	concurrentChannelInfo := ChannelInfo{
		IsMultiKey:           true,
		MultiKeySize:         2,
		MultiKeyMode:         constant.MultiKeyModePolling,
		MultiKeyPollingIndex: 1,
	}
	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", channel.Id).Updates(map[string]any{
		"key":          "rotated-key",
		"used_quota":   gorm.Expr("used_quota + ?", 250),
		"models":       "concurrent-model",
		"channel_info": concurrentChannelInfo,
	}).Error)

	stale.Status = common.ChannelStatusManuallyDisabled
	stale.SetOtherInfo(map[string]interface{}{
		"status_reason": "manual operation",
		"status_time":   int64(1234),
	})
	require.NoError(t, stale.saveStatusState())

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, stored.Status)
	assert.Equal(t, "rotated-key", stored.Key)
	assert.Equal(t, int64(350), stored.UsedQuota)
	assert.Equal(t, "concurrent-model", stored.Models)
	assert.Equal(t, concurrentChannelInfo, stored.ChannelInfo)

	otherInfo := stored.GetOtherInfo()
	assert.Equal(t, "manual operation", otherInfo["status_reason"])
	assert.Equal(t, float64(1234), otherInfo["status_time"])
}
