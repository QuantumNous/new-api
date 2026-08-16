package controller

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupMultiKeyControllerTest(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.Channel{}, &model.Ability{}, &model.User{}, &model.Log{}, &model.Option{}, &model.Model{},
	))

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalRedisEnabled := common.RedisEnabled
	originalAutomaticDisable := common.AutomaticDisableModelEnabled
	originalAutomaticEnable := common.AutomaticEnableModelEnabled
	model.DB = db
	model.LOG_DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.MemoryCacheEnabled = false
	common.RedisEnabled = false
	common.AutomaticDisableModelEnabled = false
	common.AutomaticEnableModelEnabled = false
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.RedisEnabled = originalRedisEnabled
		common.AutomaticDisableModelEnabled = originalAutomaticDisable
		common.AutomaticEnableModelEnabled = originalAutomaticEnable
	})
	return db
}

func TestUpdateChannelAppliesOnlyExplicitMutableFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMultiKeyControllerTest(t)
	channel := model.Channel{
		Name:      "before",
		Key:       "key-a\nkey-b",
		Status:    common.ChannelStatusManuallyDisabled,
		Models:    "gpt-4",
		Group:     "default",
		UsedQuota: 42,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:             true,
			MultiKeySize:           2,
			MultiKeyStatusList:     map[int]int{1: common.ChannelStatusAutoDisabled},
			MultiKeyDisabledReason: map[int]string{1: "rejected"},
			MultiKeyPollingIndex:   1,
		},
	}
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: false,
	}).Error)

	body, err := common.Marshal(map[string]any{
		"id":         channel.Id,
		"name":       "after",
		"used_quota": 9999,
		"channel_info": map[string]any{
			"is_multi_key":          true,
			"multi_key_status_list": map[string]int{},
		},
	})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/channel/", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleRootUser)

	UpdateChannel(ctx)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, response.Message)

	var stored model.Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.Equal(t, "after", stored.Name)
	assert.Equal(t, int64(42), stored.UsedQuota)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, stored.Status)
	assert.Equal(t, channel.ChannelInfo, stored.ChannelInfo)
	var ability model.Ability
	require.NoError(t, db.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.False(t, ability.Enabled)
}

func TestUpdateChannelNormalizesMultiKeyReplacement(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMultiKeyControllerTest(t)
	channel := model.Channel{
		Name:   "replace-keys",
		Key:    "key-a\nkey-b",
		Status: common.ChannelStatusEnabled,
		Models: "gpt-4",
		Group:  "default",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:             true,
			MultiKeySize:           2,
			MultiKeyStatusList:     map[int]int{1: common.ChannelStatusAutoDisabled},
			MultiKeyDisabledReason: map[int]string{1: "rejected"},
		},
	}
	require.NoError(t, db.Create(&channel).Error)

	body, err := common.Marshal(map[string]any{
		"id":       channel.Id,
		"key":      "  \nkey-b\n\"\"\nkey-c",
		"key_mode": "replace",
	})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/channel/", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleRootUser)

	UpdateChannel(ctx)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, response.Message)

	var stored model.Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.Equal(t, "key-b\nkey-c", stored.Key)
	assert.Equal(t, 2, stored.ChannelInfo.MultiKeySize)
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored.ChannelInfo.MultiKeyStatusList[0])
	assert.Equal(t, "rejected", stored.ChannelInfo.MultiKeyDisabledReason[0])
}

func TestUpdateChannelRejectsEmptyMultiKeyReplacement(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name string
		key  string
	}{
		{name: "blank lines", key: "  \n\t"},
		{name: "legacy empty JSON string", key: `""`},
		{name: "empty JSON array entry", key: `[""]`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			db := setupMultiKeyControllerTest(t)
			channel := model.Channel{
				Name:   test.name,
				Key:    "key-a",
				Status: common.ChannelStatusEnabled,
				Models: "gpt-4",
				Group:  "default",
				ChannelInfo: model.ChannelInfo{
					IsMultiKey:   true,
					MultiKeySize: 1,
				},
			}
			require.NoError(t, db.Create(&channel).Error)

			body, err := common.Marshal(map[string]any{
				"id":       channel.Id,
				"key":      test.key,
				"key_mode": "replace",
			})
			require.NoError(t, err)
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPut, "/api/channel/", bytes.NewReader(body))
			ctx.Request.Header.Set("Content-Type", "application/json")
			ctx.Set("id", 1)
			ctx.Set("role", common.RoleRootUser)

			UpdateChannel(ctx)

			var response struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.False(t, response.Success)
			assert.Contains(t, response.Message, "cannot be empty")

			var stored model.Channel
			require.NoError(t, db.First(&stored, channel.Id).Error)
			assert.Equal(t, "key-a", stored.Key)
		})
	}
}

func TestUpdateChannelStatusReturnsFailureForMissingChannel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMultiKeyControllerTest(t)
	body, err := common.Marshal(ChannelStatusRequest{Status: common.ChannelStatusManuallyDisabled})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = []gin.Param{{Key: "id", Value: "99999"}}
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/99999/status", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateChannelStatus(ctx)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.NotEmpty(t, response.Message)
}

func TestUpdateChannelStatusReturnsFailureWhenAbilityUpdateRollsBack(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMultiKeyControllerTest(t)
	channel := model.Channel{
		Name:   "status-rollback",
		Key:    "key",
		Status: common.ChannelStatusEnabled,
		Models: "gpt-4",
		Group:  "default",
	}
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: true,
	}).Error)

	const callbackName = "test:fail_channel_status_ability_update"
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "abilities" {
			tx.AddError(errors.New("forced ability update failure"))
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Update().Remove(callbackName) })

	body, err := common.Marshal(ChannelStatusRequest{Status: common.ChannelStatusManuallyDisabled})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = []gin.Param{{Key: "id", Value: strconv.Itoa(channel.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/status", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateChannelStatus(ctx)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "forced ability update failure")

	var stored model.Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
	var ability model.Ability
	require.NoError(t, db.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.True(t, ability.Enabled)
}

func TestUpdateChannelStatusRejectsEnablingMultiKeyWithoutUsableCredential(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMultiKeyControllerTest(t)
	channel := model.Channel{
		Name:   "no-usable-key",
		Key:    "  \n\t",
		Status: common.ChannelStatusAutoDisabled,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
		},
	}
	require.NoError(t, db.Create(&channel).Error)

	body, err := common.Marshal(ChannelStatusRequest{Status: common.ChannelStatusEnabled})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = []gin.Param{{Key: "id", Value: strconv.Itoa(channel.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/status", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateChannelStatus(ctx)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "no usable key")
}

func TestBatchUpdateChannelStatusReportsFailedIDs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMultiKeyControllerTest(t)
	channel := model.Channel{
		Name:   "batch-status",
		Key:    "key",
		Status: common.ChannelStatusEnabled,
		Models: "gpt-4",
		Group:  "default",
	}
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: true,
	}).Error)
	missingID := channel.Id + 9999
	body, err := common.Marshal(ChannelStatusBatchRequest{
		Ids:    []int{channel.Id, missingID},
		Status: common.ChannelStatusManuallyDisabled,
	})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/status/batch", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	BatchUpdateChannelStatus(ctx)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Data    struct {
			Changed   int   `json:"changed"`
			FailedIDs []int `json:"failed_ids"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Equal(t, 1, response.Data.Changed)
	assert.Equal(t, []int{missingID}, response.Data.FailedIDs)

	var stored model.Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, stored.Status)
}

func TestManageMultiKeysDoesNotRecoverUnrelatedAutoDisable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMultiKeyControllerTest(t)
	channel := model.Channel{
		Name:   "unrelated-auto-disable",
		Key:    "key-a\nkey-b",
		Status: common.ChannelStatusAutoDisabled,
		Models: "gpt-4",
		Group:  "default",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:         true,
			MultiKeySize:       2,
			MultiKeyStatusList: map[int]int{0: common.ChannelStatusAutoDisabled, 1: common.ChannelStatusAutoDisabled},
		},
	}
	channel.SetOtherInfo(map[string]interface{}{"status_reason": "provider unavailable"})
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: false,
	}).Error)

	body, err := common.Marshal(MultiKeyManageRequest{
		ChannelId: channel.Id,
		Action:    "enable_key",
		KeyIndex:  common.GetPointer(0),
	})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/multi-key", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleRootUser)

	ManageMultiKeys(ctx)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, response.Message)

	var stored model.Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status)
	assert.NotContains(t, stored.ChannelInfo.MultiKeyStatusList, 0)
	var ability model.Ability
	require.NoError(t, db.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.False(t, ability.Enabled)
}

func TestManageMultiKeysRejectsDeletingAllUsableKeys(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name       string
		action     string
		keyIndex   *int
		statusList map[int]int
	}{
		{
			name:     "delete last usable key",
			action:   "delete_key",
			keyIndex: common.GetPointer(0),
		},
		{
			name:       "delete disabled keys leaves only blank entries",
			action:     "delete_disabled_keys",
			statusList: map[int]int{0: common.ChannelStatusAutoDisabled},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			db := setupMultiKeyControllerTest(t)
			channel := model.Channel{
				Name:   test.name,
				Key:    "only-usable-key\n   ",
				Status: common.ChannelStatusEnabled,
				ChannelInfo: model.ChannelInfo{
					IsMultiKey:         true,
					MultiKeySize:       2,
					MultiKeyStatusList: test.statusList,
				},
			}
			require.NoError(t, db.Create(&channel).Error)

			body, err := common.Marshal(MultiKeyManageRequest{
				ChannelId: channel.Id,
				Action:    test.action,
				KeyIndex:  test.keyIndex,
			})
			require.NoError(t, err)
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/multi-key", bytes.NewReader(body))
			ctx.Request.Header.Set("Content-Type", "application/json")
			ctx.Set("id", 1)
			ctx.Set("role", common.RoleRootUser)

			ManageMultiKeys(ctx)

			var response struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.False(t, response.Success)
			assert.Contains(t, response.Message, "不能删除")

			var persisted model.Channel
			require.NoError(t, db.First(&persisted, channel.Id).Error)
			assert.Equal(t, channel.Key, persisted.Key)
		})
	}
}
