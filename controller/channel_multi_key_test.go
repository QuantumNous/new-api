package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupMultiKeyChannelTest opens an isolated SQLite or configured test database
// and creates a root user for channel management requests.
func setupMultiKeyChannelTest(t *testing.T) *model.User {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	previousMaster, previousCache, previousRedis, previousSQLite := common.IsMasterNode, common.MemoryCacheEnabled, common.RedisEnabled, common.SQLitePath
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousType, previousLogType)
		common.IsMasterNode, common.MemoryCacheEnabled, common.RedisEnabled, common.SQLitePath = previousMaster, previousCache, previousRedis, previousSQLite
	})
	t.Setenv("SQL_DSN", os.Getenv("TEST_CHANNEL_SQL_DSN"))
	t.Setenv("LOG_SQL_DSN", "")
	common.IsMasterNode, common.MemoryCacheEnabled, common.RedisEnabled = false, false, false
	common.SQLitePath = filepath.Join(t.TempDir(), "channel.db")
	require.NoError(t, model.InitDB())
	database := model.DB
	sqlDB, err := database.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	model.LOG_DB = database
	common.SetLogDatabaseType(common.MainDatabaseType())
	require.NoError(t, database.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.User{}, &model.Log{}, &model.AuditLog{}))
	root := &model.User{Username: "multi-key-review-root", Role: common.RoleRootUser, Status: common.UserStatusEnabled}
	require.NoError(t, database.Create(root).Error)
	t.Cleanup(func() { require.NoError(t, database.Unscoped().Delete(root).Error) })
	versionQuery := "SELECT VERSION()"
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		versionQuery = "SELECT sqlite_version()"
	}
	var version string
	require.NoError(t, database.Raw(versionQuery).Scan(&version).Error)
	t.Logf("database=%s version=%s", common.MainDatabaseType(), version)
	return root
}

// TestMultiKeyEnableRestoresOnlyExhaustedChannels checks that enabling keys
// restores exhausted channels without overriding a later manual disable.
func TestMultiKeyEnableRestoresOnlyExhaustedChannels(t *testing.T) {
	root := setupMultiKeyChannelTest(t)
	database := model.DB
	for _, cacheEnabled := range []bool{false, true} {
		for _, action := range []string{"enable_key", "enable_all_keys"} {
			for _, tc := range []struct {
				name           string
				initialStatus  int
				manualOverride string
				wantStatus     int
			}{
				{name: "key exhaustion restores", initialStatus: common.ChannelStatusEnabled, wantStatus: common.ChannelStatusEnabled},
				{name: "manual disable is preserved", initialStatus: common.ChannelStatusManuallyDisabled, wantStatus: common.ChannelStatusManuallyDisabled},
				{name: "manual disable after exhaustion is preserved", initialStatus: common.ChannelStatusEnabled, manualOverride: "status", wantStatus: common.ChannelStatusManuallyDisabled},
				{name: "tag disable after exhaustion is preserved", initialStatus: common.ChannelStatusEnabled, manualOverride: "tag", wantStatus: common.ChannelStatusManuallyDisabled},
			} {
				t.Run(fmt.Sprintf("cache=%t/%s/%s", cacheEnabled, action, tc.name), func(t *testing.T) {
					common.MemoryCacheEnabled = cacheEnabled
					tag := t.Name()
					channel := &model.Channel{Name: t.Name(), Type: 1, Key: "key-one\nkey-two", Status: tc.initialStatus, Models: "test-model", Group: "default", Tag: &tag,
						ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyStatusList: map[int]int{1: common.ChannelStatusManuallyDisabled}},
					}
					require.NoError(t, channel.Insert())
					t.Cleanup(func() {
						require.NoError(t, channel.Delete())
						model.InitChannelCache()
					})
					for _, operation := range []string{"disable_key", action} {
						if operation == action {
							if tc.manualOverride == "status" {
								model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusManuallyDisabled, "manual operation")
							} else if tc.manualOverride == "tag" {
								require.NoError(t, model.DisableChannelByTag(tag))
							}
						}
						payload, err := common.Marshal(MultiKeyManageRequest{ChannelId: channel.Id, Action: operation, KeyIndex: common.GetPointer(0)})
						require.NoError(t, err)
						recorder := httptest.NewRecorder()
						c, _ := gin.CreateTestContext(recorder)
						c.Set("id", root.Id)
						c.Set("role", common.RoleRootUser)
						c.Request = httptest.NewRequest(http.MethodPost, "/api/channel/multi_key", bytes.NewReader(payload))
						c.Request.Header.Set("Content-Type", "application/json")
						ManageMultiKeys(c)
						var result struct {
							Success bool `json:"success"`
						}
						require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
						require.True(t, result.Success, recorder.Body.String())
					}
					loaded, err := model.GetChannelById(channel.Id, true)
					require.NoError(t, err)
					assert.Equal(t, tc.wantStatus, loaded.Status)
					assert.NotContains(t, loaded.ChannelInfo.MultiKeyStatusList, 0)
					assert.NotContains(t, loaded.ChannelInfo.MultiKeyDisabledReason, 0)
					assert.NotContains(t, loaded.ChannelInfo.MultiKeyDisabledTime, 0)
					var ability model.Ability
					require.NoError(t, database.Where("channel_id = ?", channel.Id).First(&ability).Error)
					assert.Equal(t, tc.wantStatus == common.ChannelStatusEnabled, ability.Enabled)
				})
			}
		}
	}
}

// TestUpdateChannelMultiKeyState verifies replacement, routing, and preserved
// disable state through the update handler with and without the memory cache.
func TestUpdateChannelMultiKeyState(t *testing.T) {
	root := setupMultiKeyChannelTest(t)
	const oldKeys = "old-key-one\nold-key-two\nold-key-three"
	const newKeys = "new-key-one\nnew-key-two\nnew-key-three"
	for _, cacheEnabled := range []bool{false, true} {
		for _, tc := range []struct {
			name           string
			request        map[string]any
			wantKeys       string
			wantSelectable []string
			clearState     bool
			initialStatus  int
			statusReason   string
			exhaustKeys    bool
			wantStatus     int
			wantInfo       map[string]any
			denied         bool
		}{
			{
				name: "replace same count", request: map[string]any{"key_mode": "replace", "key": newKeys},
				wantKeys: newKeys, wantSelectable: strings.Split(newKeys, "\n"), clearState: true,
			},
			{
				name: "replace fewer keys", request: map[string]any{"key_mode": "replace", "key": "new-key-one"},
				wantKeys: "new-key-one", wantSelectable: []string{"new-key-one"}, clearState: true,
			},
			{
				name: "append preserves disabled keys", request: map[string]any{"key_mode": "append", "key": "new-key-one\nnew-key-two"},
				wantKeys: oldKeys + "\nnew-key-one\nnew-key-two", wantSelectable: []string{"old-key-three", "new-key-one", "new-key-two"},
			},
			{
				name: "replace with empty key", request: map[string]any{"key_mode": "replace", "key": ""},
				wantKeys: oldKeys, wantSelectable: []string{"old-key-three"},
			},
			{
				name: "replace without key", request: map[string]any{"key_mode": "replace"},
				wantKeys: oldKeys, wantSelectable: []string{"old-key-three"},
			},
			{
				name: "mode change preserves state", request: map[string]any{"multi_key_mode": string(constant.MultiKeyModeRandom)},
				wantKeys: oldKeys, wantSelectable: []string{"old-key-three"},
			},
			{
				name: "replace preserves channel manual disable", request: map[string]any{"key_mode": "replace", "key": newKeys},
				wantKeys: newKeys, clearState: true, initialStatus: common.ChannelStatusManuallyDisabled, statusReason: "manual operation",
			},
			{
				name: "replace restores manually exhausted channel", request: map[string]any{"key_mode": "replace", "key": newKeys, "other_info": "{}"},
				wantKeys: newKeys, wantSelectable: strings.Split(newKeys, "\n"), clearState: true,
				initialStatus: common.ChannelStatusManuallyDisabled, statusReason: model.ChannelStatusReasonAllKeysDisabled,
				exhaustKeys: true, wantStatus: common.ChannelStatusEnabled,
			},
			{
				name: "replace restores automatically exhausted channel", request: map[string]any{"key_mode": "replace", "key": "new-key-one"},
				wantKeys: "new-key-one", wantSelectable: []string{"new-key-one"}, clearState: true,
				initialStatus: common.ChannelStatusAutoDisabled, statusReason: model.ChannelStatusReasonAllKeysDisabled,
				exhaustKeys: true, wantStatus: common.ChannelStatusEnabled,
			},
			{
				name: "replacement merges unrelated metadata", request: map[string]any{"key_mode": "replace", "key": newKeys, "other_info": `{"unrelated":"changed","new_field":false,"status_reason":"client reason","status_time":999999999999}`},
				wantKeys: newKeys, wantSelectable: strings.Split(newKeys, "\n"), clearState: true,
				initialStatus: common.ChannelStatusManuallyDisabled, statusReason: model.ChannelStatusReasonAllKeysDisabled,
				exhaustKeys: true, wantStatus: common.ChannelStatusEnabled,
				wantInfo: map[string]any{"unrelated": "changed", "new_field": false, "omitted": "retained", "status_reason": ""},
			},
			{
				name: "replace preserves unrelated automatic disable", request: map[string]any{"key_mode": "replace", "key": newKeys},
				wantKeys: newKeys, clearState: true, initialStatus: common.ChannelStatusAutoDisabled, statusReason: "upstream unavailable",
			},
			{
				name: "replacement cannot claim channel exhaustion", request: map[string]any{"key_mode": "replace", "key": newKeys, "other_info": `{"status_reason":"All keys are disabled"}`},
				wantKeys: newKeys, clearState: true, initialStatus: common.ChannelStatusManuallyDisabled, statusReason: "manual operation",
			},
			{
				name: "empty replacement preserves exhaustion", request: map[string]any{"key_mode": "replace", "key": ""},
				wantKeys: oldKeys, initialStatus: common.ChannelStatusManuallyDisabled,
				statusReason: model.ChannelStatusReasonAllKeysDisabled, exhaustKeys: true,
			},
			{
				name: "empty array replacement preserves exhaustion", request: map[string]any{"key_mode": "replace", "key": "[]"},
				wantKeys: "[]", clearState: true, initialStatus: common.ChannelStatusManuallyDisabled,
				statusReason: model.ChannelStatusReasonAllKeysDisabled, exhaustKeys: true,
			},
			{
				name: "newline replacement preserves exhaustion", request: map[string]any{"key_mode": "replace", "key": "\n"},
				wantKeys: "\n", clearState: true, initialStatus: common.ChannelStatusManuallyDisabled,
				statusReason: model.ChannelStatusReasonAllKeysDisabled, exhaustKeys: true,
			},
			{
				name: "whitespace replacement preserves exhaustion", request: map[string]any{"key_mode": "replace", "key": " \t\r\n "},
				wantKeys: " \t\r\n ", clearState: true, initialStatus: common.ChannelStatusAutoDisabled,
				statusReason: model.ChannelStatusReasonAllKeysDisabled, exhaustKeys: true,
			},
			{
				name: "append preserves channel exhaustion", request: map[string]any{"key_mode": "append", "key": "new-key-one"},
				wantKeys: oldKeys + "\nnew-key-one", initialStatus: common.ChannelStatusManuallyDisabled,
				statusReason: model.ChannelStatusReasonAllKeysDisabled, exhaustKeys: true,
			},
			{
				name: "unauthorized replacement preserves exhaustion", request: map[string]any{"key_mode": "replace", "key": newKeys},
				wantKeys: oldKeys, initialStatus: common.ChannelStatusManuallyDisabled,
				statusReason: model.ChannelStatusReasonAllKeysDisabled, exhaustKeys: true, denied: true,
			},
			{
				name: "unauthorized replacement preserves state", request: map[string]any{"key_mode": "replace", "key": newKeys},
				wantKeys: oldKeys, wantSelectable: []string{"old-key-three"}, denied: true,
			},
		} {
			t.Run(fmt.Sprintf("cache=%t/%s", cacheEnabled, tc.name), func(t *testing.T) {
				common.MemoryCacheEnabled = cacheEnabled
				channel := &model.Channel{
					Name: t.Name(), Type: constant.ChannelTypeOpenAI, Key: oldKeys,
					Status: common.ChannelStatusEnabled, Models: "test-model", Group: "default",
					ChannelInfo: model.ChannelInfo{
						IsMultiKey: true, MultiKeySize: 3, MultiKeyMode: constant.MultiKeyModePolling, MultiKeyPollingIndex: 1,
						MultiKeyStatusList:     map[int]int{0: common.ChannelStatusManuallyDisabled, 1: common.ChannelStatusAutoDisabled},
						MultiKeyDisabledReason: map[int]string{0: "manual operation", 1: "upstream unavailable"},
						MultiKeyDisabledTime:   map[int]int64{0: 100, 1: 200},
					},
				}
				if tc.initialStatus != 0 {
					channel.Status = tc.initialStatus
				}
				if tc.exhaustKeys {
					channel.ChannelInfo.MultiKeyStatusList[2] = common.ChannelStatusManuallyDisabled
					channel.ChannelInfo.MultiKeyDisabledReason[2] = "manual operation"
					channel.ChannelInfo.MultiKeyDisabledTime[2] = 300
				}
				channel.SetOtherInfo(map[string]any{"status_reason": tc.statusReason, "status_time": 100, "unrelated": "preserved", "omitted": "retained"})
				wantStatus := channel.Status
				if tc.wantStatus != 0 {
					wantStatus = tc.wantStatus
				}
				require.NoError(t, channel.Insert())
				model.InitChannelCache()
				t.Cleanup(func() {
					require.NoError(t, channel.Delete())
					model.InitChannelCache()
				})

				request := map[string]any{"id": channel.Id, "type": channel.Type, "name": channel.Name, "models": channel.Models, "group": channel.Group}
				for key, value := range tc.request {
					request[key] = value
				}
				payload, err := common.Marshal(request)
				require.NoError(t, err)
				recorder := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(recorder)
				c.Set("id", root.Id)
				c.Set("role", common.RoleRootUser)
				if tc.denied {
					c.Set("role", common.RoleCommonUser)
				}
				requestID := common.NewRequestId()
				t.Cleanup(func() {
					require.NoError(t, model.LOG_DB.Where("request_id = ?", requestID).Delete(&model.AuditLog{}).Error)
				})
				c.Set(common.RequestIdKey, requestID)
				c.Request = httptest.NewRequest(http.MethodPut, "/api/channel", bytes.NewReader(payload))
				c.Request.Header.Set("Content-Type", "application/json")
				updateStarted := common.GetTimestamp()
				UpdateChannel(c)
				var result struct {
					Success bool `json:"success"`
				}
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
				require.Equal(t, !tc.denied, result.Success, recorder.Body.String())

				loaded, err := model.GetChannelById(channel.Id, true)
				require.NoError(t, err)
				cached, err := model.CacheGetChannel(channel.Id)
				require.NoError(t, err)
				wantMode := constant.MultiKeyModePolling
				if mode, ok := tc.request["multi_key_mode"].(string); ok {
					wantMode = constant.MultiKeyMode(mode)
				}
				wantOtherInfo := channel.GetOtherInfo()
				if supplied, ok := tc.request["other_info"].(string); ok && !tc.denied && wantStatus == channel.Status {
					wantOtherInfo = nil
					require.NoError(t, common.UnmarshalJsonStr(supplied, &wantOtherInfo))
				}
				if tc.wantInfo != nil {
					wantOtherInfo = tc.wantInfo
				}
				for _, actual := range []*model.Channel{loaded, cached} {
					assert.Equal(t, tc.wantKeys, actual.Key)
					assert.Equal(t, wantStatus, actual.Status)
					otherInfo := actual.GetOtherInfo()
					if wantStatus != channel.Status {
						assert.GreaterOrEqual(t, otherInfo["status_time"], float64(updateStarted))
						assert.LessOrEqual(t, otherInfo["status_time"], float64(common.GetTimestamp()))
						wantOtherInfo["status_reason"] = ""
						wantOtherInfo["status_time"] = otherInfo["status_time"]
					}
					assert.Equal(t, wantOtherInfo, otherInfo)
					assert.True(t, actual.ChannelInfo.IsMultiKey)
					if tc.wantKeys != "[]" {
						assert.Equal(t, len(strings.Split(strings.Trim(tc.wantKeys, "\n"), "\n")), actual.ChannelInfo.MultiKeySize)
					}
					assert.Equal(t, wantMode, actual.ChannelInfo.MultiKeyMode)
					assert.Equal(t, 1, actual.ChannelInfo.MultiKeyPollingIndex)
					if tc.clearState {
						assert.Empty(t, actual.ChannelInfo.MultiKeyStatusList)
						assert.Empty(t, actual.ChannelInfo.MultiKeyDisabledReason)
						assert.Empty(t, actual.ChannelInfo.MultiKeyDisabledTime)
					} else {
						assert.Equal(t, channel.ChannelInfo.MultiKeyStatusList, actual.ChannelInfo.MultiKeyStatusList)
						assert.Equal(t, channel.ChannelInfo.MultiKeyDisabledReason, actual.ChannelInfo.MultiKeyDisabledReason)
						assert.Equal(t, channel.ChannelInfo.MultiKeyDisabledTime, actual.ChannelInfo.MultiKeyDisabledTime)
					}
				}
				var ability model.Ability
				require.NoError(t, model.DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
				assert.Equal(t, wantStatus == common.ChannelStatusEnabled, ability.Enabled)
				routed, err := model.GetRandomSatisfiedChannel(channel.Group, channel.Models, 0, nil)
				require.NoError(t, err)
				if wantStatus == common.ChannelStatusEnabled {
					require.NotNil(t, routed, "updated channel must be available for routing")
					assert.Equal(t, channel.Id, routed.Id)
				} else {
					assert.Nil(t, routed, "disabled channel must stay excluded from routing")
				}

				var selected []string
				for range len(tc.wantSelectable) {
					active, err := model.GetRandomSatisfiedChannel(channel.Group, channel.Models, 0, nil)
					require.NoError(t, err)
					require.NotNil(t, active)
					key, _, apiErr := active.GetNextEnabledKey()
					require.Nil(t, apiErr)
					selected = append(selected, key)
				}
				assert.ElementsMatch(t, tc.wantSelectable, selected)

				var audits []model.AuditLog
				require.NoError(t, model.LOG_DB.Where("request_id = ? AND action = ?", requestID, "channel.update").Find(&audits).Error)
				if tc.denied {
					assert.Empty(t, audits)
				} else {
					require.Len(t, audits, 1)
				}
				encodedAudit, err := common.Marshal(audits)
				require.NoError(t, err)
				for key := range strings.SplitSeq(oldKeys+"\n"+newKeys, "\n") {
					assert.NotContains(t, recorder.Body.String(), key)
					assert.NotContains(t, string(encodedAudit), key)
				}
			})
		}
	}
}
