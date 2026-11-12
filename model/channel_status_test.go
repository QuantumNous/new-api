package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relaykit/dto"
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
	stale.SetOtherInfo(map[string]any{
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

func TestAutoDisableKeepsManualDisable(t *testing.T) {
	for _, cacheEnabled := range []bool{false, true} {
		for _, tc := range []struct {
			name          string
			multiKey      bool
			initialStatus int
			wantChanged   bool
			wantStatus    int
		}{
			{name: "single key manual disable is kept", initialStatus: common.ChannelStatusManuallyDisabled, wantStatus: common.ChannelStatusManuallyDisabled},
			{name: "multi key manual disable is kept", multiKey: true, initialStatus: common.ChannelStatusManuallyDisabled, wantStatus: common.ChannelStatusManuallyDisabled},
			{name: "single key enabled is auto disabled", initialStatus: common.ChannelStatusEnabled, wantChanged: true, wantStatus: common.ChannelStatusAutoDisabled},
			{name: "multi key enabled is auto disabled", multiKey: true, initialStatus: common.ChannelStatusEnabled, wantChanged: true, wantStatus: common.ChannelStatusAutoDisabled},
		} {
			t.Run(fmt.Sprintf("cache=%t/%s", cacheEnabled, tc.name), func(t *testing.T) {
				setupChannelStatusTest(t)
				common.MemoryCacheEnabled = cacheEnabled

				channel := Channel{Name: t.Name(), Key: "key-a", Status: tc.initialStatus, Models: "test-model", Group: "default"}
				usingKey := "key-a"
				if tc.multiKey {
					// key-b already failed, so a failure on key-a disables every key.
					channel.Key = "key-a\nkey-b"
					channel.ChannelInfo = ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyStatusList: map[int]int{1: common.ChannelStatusAutoDisabled}}
				}
				channel.SetOtherInfo(map[string]any{"status_reason": "manual operation", "status_time": int64(1234)})
				require.NoError(t, channel.Insert())
				InitChannelCache()

				changed := UpdateChannelStatus(channel.Id, usingKey, common.ChannelStatusAutoDisabled, "provider rejected key")
				assert.Equal(t, tc.wantChanged, changed)

				stored, err := GetChannelById(channel.Id, true)
				require.NoError(t, err)
				assert.Equal(t, tc.wantStatus, stored.Status)
				if !tc.wantChanged {
					assert.Equal(t, "manual operation", stored.GetOtherInfo()["status_reason"])
					assert.Equal(t, float64(1234), stored.GetOtherInfo()["status_time"])
					assert.Equal(t, channel.ChannelInfo.MultiKeyStatusList, stored.ChannelInfo.MultiKeyStatusList)
				}
				var abilities []Ability
				require.NoError(t, DB.Where("channel_id = ?", channel.Id).Find(&abilities).Error)
				require.NotEmpty(t, abilities)
				for _, ability := range abilities {
					assert.False(t, ability.Enabled)
				}
				if cacheEnabled {
					cached, err := CacheGetChannel(channel.Id)
					require.NoError(t, err)
					assert.Equal(t, tc.wantStatus, cached.Status)
					assert.Equal(t, stored.ChannelInfo.MultiKeyStatusList, cached.ChannelInfo.MultiKeyStatusList)
				}
			})
		}
	}
}

// A status set by hand reaches every node at once through the channels topic.
// An automatic change, made for the key a request or a channel test used, is
// left to the periodic channel sync and bumps nothing.
func TestUpdateChannelStatusBumpsChannelsOnlyForChangesByHand(t *testing.T) {
	for _, cacheEnabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cacheEnabled), func(t *testing.T) {
			setupChannelStatusTest(t)
			common.MemoryCacheEnabled = cacheEnabled
			require.NoError(t, DB.AutoMigrate(&SystemSyncTopic{}))
			t.Cleanup(func() { require.NoError(t, DB.Migrator().DropTable(&SystemSyncTopic{})) })
			revision := func() string {
				var row SystemSyncTopic
				require.NoError(t, DB.Where("topic = ?", SyncTopicChannels).Limit(1).Find(&row).Error)
				return row.Revision
			}
			single := Channel{Name: "status-single", Key: "key-a", Status: common.ChannelStatusEnabled, Models: "status-model", Group: "default"}
			multi := Channel{Name: "status-multi", Key: "key-a\nkey-b", Status: common.ChannelStatusEnabled, Models: "status-model", Group: "default",
				ChannelInfo: ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyMode: constant.MultiKeyModePolling}}
			require.NoError(t, single.Insert())
			require.NoError(t, multi.Insert())
			InitChannelCache()

			for _, step := range []struct {
				name     string
				id       int
				usingKey string
				status   int
				bump     bool
			}{
				{name: "a request disables a key", id: multi.Id, usingKey: "key-a", status: common.ChannelStatusAutoDisabled},
				{name: "a request disables a single-key channel", id: single.Id, usingKey: "key-a", status: common.ChannelStatusAutoDisabled},
				{name: "a test re-enables the channel", id: single.Id, usingKey: "key-a", status: common.ChannelStatusEnabled},
				{name: "an admin disables a channel", id: single.Id, status: common.ChannelStatusManuallyDisabled, bump: true},
				{name: "an admin disables it again", id: single.Id, status: common.ChannelStatusManuallyDisabled},
				{name: "an admin enables a channel", id: single.Id, status: common.ChannelStatusEnabled, bump: true},
				{name: "an admin disables a multi-key channel", id: multi.Id, status: common.ChannelStatusManuallyDisabled, bump: true},
			} {
				before := revision()
				changed := UpdateChannelStatus(step.id, step.usingKey, step.status, step.name)
				assert.Equal(t, step.bump || step.usingKey != "", changed, step.name)
				assert.Equal(t, step.bump, before != revision(), step.name)
			}
		})
	}
}

// The master runs a plugin's scheduled hook when a key is disabled
// automatically, so a follower's automatic disable of such a key bumps the
// channels topic; the master's own, or one for a plugin without the hook,
// does not.
func TestAutoDisableOfAScheduledPluginKeyBumpsChannelsOnFollowers(t *testing.T) {
	setupChannelStatusTest(t)
	require.NoError(t, DB.AutoMigrate(&SystemSyncTopic{}))
	t.Cleanup(func() { require.NoError(t, DB.Migrator().DropTable(&SystemSyncTopic{})) })
	master := common.IsMasterNode
	t.Cleanup(func() { common.IsMasterNode = master })
	for key, hooks := range map[string]string{
		"status-scheduled": `export function scheduled() { return {next: 3600}; }`,
		"status-plain":     "",
	} {
		_, err := jsplugin.DefaultRegistry.Register(`export const meta = {apiVersion: 1, key: "`+key+`", name: "Status", version: "1.0.0", author: {name: "Test"}, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};`+hooks, jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })
	}
	revision := func() string {
		var row SystemSyncTopic
		require.NoError(t, DB.Where("topic = ?", SyncTopicChannels).Limit(1).Find(&row).Error)
		return row.Revision
	}

	for _, tc := range []struct {
		plugin string
		master bool
		bump   bool
	}{
		{plugin: "status-scheduled", bump: true},
		{plugin: "status-scheduled", master: true},
		{plugin: "status-plain"},
	} {
		t.Run(fmt.Sprintf("%s/master=%t", tc.plugin, tc.master), func(t *testing.T) {
			common.IsMasterNode = tc.master
			channel := Channel{Type: constant.ChannelTypeTaskPlugin, Name: t.Name(), Key: "key-a", Status: common.ChannelStatusEnabled, Models: "status-model", Group: "default"}
			channel.SetSetting(dto.ChannelSettings{TaskPluginKey: tc.plugin})
			require.NoError(t, channel.Insert())

			before := revision()
			require.True(t, UpdateChannelStatus(channel.Id, "key-a", common.ChannelStatusAutoDisabled, "quota"))
			assert.Equal(t, tc.bump, before != revision())
		})
	}
}
