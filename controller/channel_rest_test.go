package controller

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// openChannelControllerTestDB sets up an in-memory SQLite DB with the Channel
// table migrated. Sets the standard *Using* flags / RedisEnabled.
func openChannelControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	previousGinMode := gin.Mode()

	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.MemoryCacheEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.Channel{}, &model.Ability{}); err != nil {
		t.Fatalf("migrate channel: %v", err)
	}
	model.DB = db
	model.LOG_DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		common.RedisEnabled = previousRedisEnabled
		common.MemoryCacheEnabled = previousMemoryCacheEnabled
		gin.SetMode(previousGinMode)
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestOpenChannelControllerTestDBRestoresGlobals(t *testing.T) {
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	previousGinMode := gin.Mode()
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		common.RedisEnabled = previousRedisEnabled
		common.MemoryCacheEnabled = previousMemoryCacheEnabled
		gin.SetMode(previousGinMode)
	})

	sentinelDB := &gorm.DB{}
	sentinelLogDB := &gorm.DB{}
	model.DB = sentinelDB
	model.LOG_DB = sentinelLogDB
	common.SetDatabaseTypes(common.DatabaseTypeMySQL, common.DatabaseTypePostgreSQL)
	common.RedisEnabled = true
	common.MemoryCacheEnabled = true
	gin.SetMode(gin.ReleaseMode)

	t.Run("isolates the channel controller database", func(t *testing.T) {
		db := openChannelControllerTestDB(t)

		assert.Same(t, db, model.DB)
		assert.Same(t, db, model.LOG_DB)
		assert.Equal(t, common.DatabaseTypeSQLite, common.MainDatabaseType())
		assert.Equal(t, common.DatabaseTypeSQLite, common.LogDatabaseType())
		assert.False(t, common.RedisEnabled)
		assert.False(t, common.MemoryCacheEnabled)
		assert.Equal(t, gin.TestMode, gin.Mode())
	})

	assert.Same(t, sentinelDB, model.DB)
	assert.Same(t, sentinelLogDB, model.LOG_DB)
	assert.Equal(t, common.DatabaseTypeMySQL, common.MainDatabaseType())
	assert.Equal(t, common.DatabaseTypePostgreSQL, common.LogDatabaseType())
	assert.True(t, common.RedisEnabled)
	assert.True(t, common.MemoryCacheEnabled)
	assert.Equal(t, gin.ReleaseMode, gin.Mode())
}

func TestGetChannel_NotFound_404(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodGet, "/api/channel/9999", nil,
		gin.Params{{Key: "id", Value: "9999"}}, common.RoleAdminUser)
	GetChannel(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status got %d want 404 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "channel_not_found" {
		t.Errorf("code: got %q want channel_not_found", c)
	}
}

func TestGetChannel_BadId_400(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodGet, "/api/channel/abc", nil,
		gin.Params{{Key: "id", Value: "abc"}}, common.RoleAdminUser)
	GetChannel(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

func TestDeleteChannel_BadId_400(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodDelete, "/api/channel/xx", nil,
		gin.Params{{Key: "id", Value: "xx"}}, common.RoleAdminUser)
	DeleteChannel(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

func TestGetChannelKey_BadId_400(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/x/key", nil,
		gin.Params{{Key: "id", Value: "x"}}, common.RoleAdminUser)
	GetChannelKey(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

func TestGetChannelKey_NotFound_404(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/9999/key", nil,
		gin.Params{{Key: "id", Value: "9999"}}, common.RoleAdminUser)
	GetChannelKey(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status got %d want 404 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "channel_not_found" {
		t.Errorf("code: got %q want channel_not_found", c)
	}
}

func TestFetchUpstreamModels_BadId_400(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodGet, "/api/channel/fetch_models/x", nil,
		gin.Params{{Key: "id", Value: "x"}}, common.RoleAdminUser)
	FetchUpstreamModels(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

func TestFetchUpstreamModels_NotFound_404(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodGet, "/api/channel/fetch_models/9999", nil,
		gin.Params{{Key: "id", Value: "9999"}}, common.RoleAdminUser)
	FetchUpstreamModels(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status got %d want 404", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "channel_not_found" {
		t.Errorf("code: got %q want channel_not_found", c)
	}
}

func TestFetchModels_BadBody_400(t *testing.T) {
	openChannelControllerTestDB(t)
	// invalid body: missing required (bind error). Pass empty body — gin will
	// accept (no required tags), but downstream still proceeds. So test with
	// truly malformed: send a non-object to trigger bind error via raw bytes.
	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/fetch_models",
		"not-an-object", nil, common.RoleAdminUser)
	FetchModels(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestAddChannel_BadJson_400(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/", "not-an-object",
		nil, common.RoleAdminUser)
	AddChannel(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

func TestAddChannel_CanonicalizesModels(t *testing.T) {
	db := openChannelControllerTestDB(t)
	body := map[string]any{
		"mode": "single",
		"channel": map[string]any{
			"name":   "OpenRouter canonical",
			"type":   constant.ChannelTypeOpenRouter,
			"key":    "sk-test",
			"models": "anthropic/claude-fable-5",
			"group":  "default",
			"status": common.ChannelStatusEnabled,
		},
	}

	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/", body, nil, common.RoleRootUser)
	AddChannel(ctx)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var channel model.Channel
	require.NoError(t, db.First(&channel).Error)
	assert.Equal(t, "claude-fable-5", channel.Models)

	var mapping map[string]string
	require.NoError(t, common.UnmarshalJsonStr(channel.GetModelMapping(), &mapping))
	assert.Equal(t, map[string]string{
		"claude-fable-5": "anthropic/claude-fable-5",
	}, mapping)

	var abilities []model.Ability
	require.NoError(t, db.Where("channel_id = ?", channel.Id).Find(&abilities).Error)
	require.Len(t, abilities, 1)
	assert.Equal(t, "claude-fable-5", abilities[0].Model)
}

func TestAddChannel_RejectsCanonicalCollision(t *testing.T) {
	db := openChannelControllerTestDB(t)
	body := map[string]any{
		"mode": "single",
		"channel": map[string]any{
			"name":   "OpenRouter collision",
			"type":   constant.ChannelTypeOpenRouter,
			"key":    "sk-test",
			"models": "anthropic/claude-fable-5,openrouter/claude-fable-5",
			"group":  "default",
			"status": common.ChannelStatusEnabled,
		},
	}

	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/", body, nil, common.RoleRootUser)
	AddChannel(ctx)

	require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
	assert.Equal(t, "channel_validation_failed", decodeRestError(t, rec).Code)
	var channelCount int64
	require.NoError(t, db.Model(&model.Channel{}).Count(&channelCount).Error)
	assert.Zero(t, channelCount)
	var abilityCount int64
	require.NoError(t, db.Model(&model.Ability{}).Count(&abilityCount).Error)
	assert.Zero(t, abilityCount)
}

func seedChannelForUpdate(t *testing.T, db *gorm.DB) model.Channel {
	t.Helper()
	mapping := `{"claude-fable-5":"anthropic/claude-fable-5","manual-model":"manual/upstream-model"}`
	channel := model.Channel{
		Name:         "stored channel",
		Type:         constant.ChannelTypeOpenRouter,
		Key:          "sk-stored",
		Models:       "claude-fable-5",
		ModelMapping: &mapping,
		Group:        "default",
		Status:       common.ChannelStatusEnabled,
	}
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(db))
	return channel
}

func TestUpdateChannel_RejectsSensitivePointerChangesForChannelWriteRole(t *testing.T) {
	tests := []struct {
		name  string
		field string
		value string
	}{
		{name: "base URL", field: "base_url", value: "https://attacker.example.com"},
		{name: "header override", field: "header_override", value: `{"X-Attacker":"1"}`},
		{name: "parameter override", field: "param_override", value: `{"temperature":1}`},
		{name: "channel setting", field: "setting", value: `{"force_format":true}`},
		{name: "OpenAI organization", field: "openai_organization", value: "org-attacker"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := openChannelControllerTestDB(t)
			channel := seedChannelForUpdate(t, db)
			baseURL := "https://stored.example.com"
			headerOverride := `{"X-Stored":"1"}`
			paramOverride := `{"temperature":0.5}`
			setting := `{"force_format":false}`
			organization := "org-stored"
			channel.BaseURL = &baseURL
			channel.HeaderOverride = &headerOverride
			channel.ParamOverride = &paramOverride
			channel.Setting = &setting
			channel.OpenAIOrganization = &organization
			require.NoError(t, db.Save(&channel).Error)

			ctx, rec := newRestContext(t, http.MethodPut, "/api/channel/", map[string]any{
				"id":     channel.Id,
				tt.field: tt.value,
			}, nil, common.RoleAdminUser)

			UpdateChannel(ctx)

			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			assert.False(t, decodeRestError(t, rec).Success, rec.Body.String())
			var stored model.Channel
			require.NoError(t, db.First(&stored, channel.Id).Error)
			require.NotNil(t, stored.BaseURL)
			assert.Equal(t, baseURL, *stored.BaseURL)
			require.NotNil(t, stored.HeaderOverride)
			assert.Equal(t, headerOverride, *stored.HeaderOverride)
			require.NotNil(t, stored.ParamOverride)
			assert.Equal(t, paramOverride, *stored.ParamOverride)
			require.NotNil(t, stored.Setting)
			assert.Equal(t, setting, *stored.Setting)
			require.NotNil(t, stored.OpenAIOrganization)
			assert.Equal(t, organization, *stored.OpenAIOrganization)
		})
	}
}

func TestUpdateChannel_PreservesStoredChannelInfo(t *testing.T) {
	db := openChannelControllerTestDB(t)
	channel := seedChannelForUpdate(t, db)
	channel.Key = "sk-first\nsk-second"
	channel.ChannelInfo = model.ChannelInfo{
		IsMultiKey:             true,
		MultiKeySize:           2,
		MultiKeyStatusList:     map[int]int{0: common.ChannelStatusEnabled, 1: common.ChannelStatusAutoDisabled},
		MultiKeyDisabledReason: map[int]string{1: "stored reason"},
		MultiKeyDisabledTime:   map[int]int64{1: 1234},
		MultiKeyPollingIndex:   1,
		MultiKeyMode:           constant.MultiKeyModeRandom,
	}
	require.NoError(t, db.Save(&channel).Error)

	ctx, rec := newRestContext(t, http.MethodPut, "/api/channel/", map[string]any{
		"id": channel.Id,
		"channel_info": map[string]any{
			"is_multi_key":              false,
			"multi_key_size":            999,
			"multi_key_status_list":     map[string]int{"0": common.ChannelStatusAutoDisabled},
			"multi_key_disabled_reason": map[string]string{"0": "attacker reason"},
			"multi_key_disabled_time":   map[string]int64{"0": 9999},
			"multi_key_polling_index":   0,
			"multi_key_mode":            constant.MultiKeyModeRandom,
		},
		"multi_key_mode": constant.MultiKeyModePolling,
	}, nil, common.RoleRootUser)

	UpdateChannel(ctx)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.True(t, decodeRestError(t, rec).Success, rec.Body.String())
	var stored model.Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.True(t, stored.ChannelInfo.IsMultiKey)
	assert.Equal(t, 2, stored.ChannelInfo.MultiKeySize)
	assert.Equal(t, map[int]int{0: common.ChannelStatusEnabled, 1: common.ChannelStatusAutoDisabled}, stored.ChannelInfo.MultiKeyStatusList)
	assert.Equal(t, map[int]string{1: "stored reason"}, stored.ChannelInfo.MultiKeyDisabledReason)
	assert.Equal(t, map[int]int64{1: 1234}, stored.ChannelInfo.MultiKeyDisabledTime)
	assert.Equal(t, 1, stored.ChannelInfo.MultiKeyPollingIndex)
	assert.Equal(t, constant.MultiKeyModePolling, stored.ChannelInfo.MultiKeyMode)
}

func assertStoredChannelModelConfig(
	t *testing.T,
	db *gorm.DB,
	channelID int,
	wantType int,
	wantModels string,
	wantMapping map[string]string,
) {
	t.Helper()
	var stored model.Channel
	require.NoError(t, db.First(&stored, channelID).Error)
	assert.Equal(t, wantType, stored.Type)
	assert.Equal(t, wantModels, stored.Models)
	var mapping map[string]string
	require.NoError(t, common.UnmarshalJsonStr(stored.GetModelMapping(), &mapping))
	assert.Equal(t, wantMapping, mapping)
}

func assertStoredChannelAbilities(t *testing.T, db *gorm.DB, channelID int, wantModels ...string) {
	t.Helper()
	var abilities []model.Ability
	require.NoError(t, db.Where("channel_id = ?", channelID).Order("model").Find(&abilities).Error)
	require.Len(t, abilities, len(wantModels))
	models := make([]string, 0, len(abilities))
	for _, ability := range abilities {
		models = append(models, ability.Model)
	}
	assert.Equal(t, wantModels, models)
}

func TestUpdateChannel_PreservesModelConfig(t *testing.T) {
	tests := []struct {
		name string
		body func(channelID int) map[string]any
	}{
		{
			name: "omitted fields",
			body: func(channelID int) map[string]any {
				return map[string]any{"id": channelID, "name": "renamed"}
			},
		},
		{
			name: "null fields",
			body: func(channelID int) map[string]any {
				return map[string]any{
					"id":            channelID,
					"type":          nil,
					"models":        nil,
					"model_mapping": nil,
				}
			},
		},
		{
			name: "zero type and empty models",
			body: func(channelID int) map[string]any {
				return map[string]any{"id": channelID, "type": 0, "models": ""}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := openChannelControllerTestDB(t)
			channel := seedChannelForUpdate(t, db)
			ctx, rec := newRestContext(t, http.MethodPut, "/api/channel/", tt.body(channel.Id), nil, common.RoleRootUser)

			UpdateChannel(ctx)

			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			assertStoredChannelModelConfig(t, db, channel.Id, constant.ChannelTypeOpenRouter, "claude-fable-5", map[string]string{
				"claude-fable-5": "anthropic/claude-fable-5",
				"manual-model":   "manual/upstream-model",
			})
			assertStoredChannelAbilities(t, db, channel.Id, "claude-fable-5")
		})
	}
}

func TestUpdateChannel_CanonicalizesModels(t *testing.T) {
	db := openChannelControllerTestDB(t)
	channel := seedChannelForUpdate(t, db)
	body := map[string]any{
		"id":     channel.Id,
		"models": "anthropic/claude-fable-5,openrouter/qwen/qwen3.7-max",
	}
	ctx, rec := newRestContext(t, http.MethodPut, "/api/channel/", body, nil, common.RoleRootUser)

	UpdateChannel(ctx)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assertStoredChannelModelConfig(t, db, channel.Id, constant.ChannelTypeOpenRouter, "claude-fable-5,qwen3.7-max", map[string]string{
		"claude-fable-5": "anthropic/claude-fable-5",
		"manual-model":   "manual/upstream-model",
		"qwen3.7-max":    "openrouter/qwen/qwen3.7-max",
	})
	assertStoredChannelAbilities(t, db, channel.Id, "claude-fable-5", "qwen3.7-max")
}

func TestUpdateChannel_PatchModelConfig(t *testing.T) {
	t.Run("empty mapping clears manual baseline and rebuilds generated mappings", func(t *testing.T) {
		db := openChannelControllerTestDB(t)
		channel := seedChannelForUpdate(t, db)
		body := map[string]any{
			"id":            channel.Id,
			"models":        "anthropic/claude-fable-5",
			"model_mapping": "",
		}
		ctx, rec := newRestContext(t, http.MethodPut, "/api/channel/", body, nil, common.RoleRootUser)

		UpdateChannel(ctx)

		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		assertStoredChannelModelConfig(t, db, channel.Id, constant.ChannelTypeOpenRouter, "claude-fable-5", map[string]string{
			"claude-fable-5": "anthropic/claude-fable-5",
		})
		assertStoredChannelAbilities(t, db, channel.Id, "claude-fable-5")
	})

	t.Run("empty mapping object clears manual baseline", func(t *testing.T) {
		db := openChannelControllerTestDB(t)
		channel := seedChannelForUpdate(t, db)
		body := map[string]any{
			"id":            channel.Id,
			"models":        "anthropic/claude-fable-5",
			"model_mapping": "{}",
		}
		ctx, rec := newRestContext(t, http.MethodPut, "/api/channel/", body, nil, common.RoleRootUser)

		UpdateChannel(ctx)

		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		assertStoredChannelModelConfig(t, db, channel.Id, constant.ChannelTypeOpenRouter, "claude-fable-5", map[string]string{
			"claude-fable-5": "anthropic/claude-fable-5",
		})
	})

	t.Run("whitespace-only models are invalid", func(t *testing.T) {
		db := openChannelControllerTestDB(t)
		channel := seedChannelForUpdate(t, db)
		ctx, rec := newRestContext(t, http.MethodPut, "/api/channel/", map[string]any{
			"id":     channel.Id,
			"models": "   ",
		}, nil, common.RoleRootUser)

		UpdateChannel(ctx)

		require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
		assert.Equal(t, "channel_validation_failed", decodeRestError(t, rec).Code)
		assertStoredChannelModelConfig(t, db, channel.Id, constant.ChannelTypeOpenRouter, "claude-fable-5", map[string]string{
			"claude-fable-5": "anthropic/claude-fable-5",
			"manual-model":   "manual/upstream-model",
		})
		assertStoredChannelAbilities(t, db, channel.Id, "claude-fable-5")
	})
}
