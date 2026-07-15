package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type userChatModelsPayload struct {
	Success bool                       `json:"success"`
	Data    dto.UserChatModelsResponse `json:"data"`
}

type adminChatModelPayload struct {
	Success bool                   `json:"success"`
	Data    dto.AdminChatModelItem `json:"data"`
}

type batchAdminChatModelsPayload struct {
	Success bool                              `json:"success"`
	Data    dto.BatchCreateChatModelsResponse `json:"data"`
}

type thinkingLevelOptionsPayload struct {
	Success bool `json:"success"`
	Data    struct {
		Items []string `json:"items"`
		Total int      `json:"total"`
	} `json:"data"`
}

func seedChatModelChannel(t *testing.T, channelID int, group string, modelName string) {
	t.Helper()

	priority := int64(0)
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:       channelID,
		Type:     constant.ChannelTypeOpenAI,
		Key:      "test-key",
		Status:   common.ChannelStatusEnabled,
		Name:     "test-channel",
		Models:   modelName,
		Group:    group,
		Priority: &priority,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     group,
		Model:     modelName,
		ChannelId: channelID,
		Enabled:   true,
		Priority:  &priority,
	}).Error)
	model.InvalidatePricingCache()
}

func TestCreateChatModelStoresCapabilities(t *testing.T) {
	ratio_setting.InitRatioSettings()
	setupModelListControllerTestDB(t)
	seedChatModelChannel(t, 1, "default", "gpt-4o-mini")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/chat-models/", strings.NewReader(`{"model":"gpt-4o-mini","name":"Vision model","api":"openai-responses","input":["audio","text","image"],"contextWindow":128000,"contextTokens":96000,"maxTokens":16384,"reasoning":false,"thinkingLevels":["off","low","medium","high","xhigh","max"],"thinkingDefault":"medium","supportsFastMode":true}`))

	CreateChatModel(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload adminChatModelPayload
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, "openai-responses", payload.Data.Api)
	require.Equal(t, []string{"text", "image", "audio"}, payload.Data.Input)
	require.Equal(t, 128000, payload.Data.ContextWindow)
	require.Equal(t, 96000, payload.Data.ContextTokens)
	require.Equal(t, 16384, payload.Data.MaxTokens)
	require.True(t, payload.Data.Reasoning)
	require.Equal(t, []string{"off", "low", "medium", "high", "xhigh", "max"}, payload.Data.ThinkingLevels)
	require.Equal(t, "medium", payload.Data.ThinkingDefault)
	require.True(t, payload.Data.SupportsFastMode)

	stored, err := model.GetChatModelOptionByID(payload.Data.Id)
	require.NoError(t, err)
	require.Equal(t, "openai-responses", stored.ApiFormat)
	require.Equal(t, `["text","image","audio"]`, stored.InputTypes)
	require.Equal(t, 128000, stored.ContextWindow)
	require.Equal(t, 96000, stored.ContextTokens)
	require.Equal(t, 16384, stored.MaxTokens)
	require.True(t, stored.Reasoning)
	require.Equal(t, `["off","low","medium","high","xhigh","max"]`, stored.ThinkingLevels)
	require.Equal(t, "medium", stored.ThinkingDefault)
	require.True(t, stored.SupportsFastMode)
}

func TestGetUserChatModelsReturnsAutoAndFiltersUnavailableModels(t *testing.T) {
	ratio_setting.InitRatioSettings()
	setupModelListControllerTestDB(t)

	require.NoError(t, model.DB.Create(&model.User{
		Id:       2001,
		Username: "chat-model-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	seedChatModelChannel(t, 1, "default", "gpt-4o-mini")
	seedChatModelChannel(t, 2, "private", "gpt-3.5-turbo")

	require.NoError(t, model.CreateChatModelOption(&model.ChatModelOption{
		ModelName:        "gpt-4o-mini",
		DisplayName:      "GPT-4o mini",
		ApiFormat:        "openai-responses",
		InputTypes:       `["text","image","video","audio"]`,
		ContextWindow:    128000,
		ContextTokens:    96000,
		MaxTokens:        16384,
		Reasoning:        true,
		ThinkingLevels:   `["off","adaptive","max"]`,
		ThinkingDefault:  "adaptive",
		SupportsFastMode: true,
		Enabled:          true,
		IsAuto:           true,
		Sort:             1,
	}))
	require.NoError(t, model.CreateChatModelOption(&model.ChatModelOption{
		ModelName:   "gpt-3.5-turbo",
		DisplayName: "Private model",
		Enabled:     true,
		Sort:        2,
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/chat-models", nil)
	ctx.Set("id", 2001)

	GetUserChatModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload userChatModelsPayload
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, 2, payload.Data.Total)
	require.Len(t, payload.Data.Models, 2)
	require.Equal(t, "gpt-4o-mini", payload.Data.Models[0].Model)
	require.Equal(t, "Auto", payload.Data.Models[0].Name)
	require.Equal(t, 0.15, payload.Data.Models[0].Price)
	require.Equal(t, "openai-responses", payload.Data.Models[0].Api)
	require.Equal(t, []string{"text", "image", "video", "audio"}, payload.Data.Models[0].Input)
	require.Equal(t, 128000, payload.Data.Models[0].ContextWindow)
	require.Equal(t, 96000, payload.Data.Models[0].ContextTokens)
	require.Equal(t, 16384, payload.Data.Models[0].MaxTokens)
	require.True(t, payload.Data.Models[0].Reasoning)
	require.Equal(t, []string{"off", "adaptive", "max"}, payload.Data.Models[0].ThinkingLevels)
	require.Equal(t, "adaptive", payload.Data.Models[0].ThinkingDefault)
	require.True(t, payload.Data.Models[0].SupportsFastMode)
	require.Equal(t, "gpt-4o-mini", payload.Data.Models[1].Model)
	require.Equal(t, "GPT-4o mini", payload.Data.Models[1].Name)
	require.Equal(t, 0.15, payload.Data.Models[1].Price)
	require.Equal(t, payload.Data.Models[0].Input, payload.Data.Models[1].Input)
	require.Equal(t, payload.Data.Models[0].Api, payload.Data.Models[1].Api)
	require.Equal(t, payload.Data.Models[0].ContextWindow, payload.Data.Models[1].ContextWindow)
	require.Equal(t, payload.Data.Models[0].ContextTokens, payload.Data.Models[1].ContextTokens)
	require.Equal(t, payload.Data.Models[0].MaxTokens, payload.Data.Models[1].MaxTokens)
	require.Equal(t, payload.Data.Models[0].Reasoning, payload.Data.Models[1].Reasoning)
	require.Equal(t, payload.Data.Models[0].ThinkingLevels, payload.Data.Models[1].ThinkingLevels)
	require.Equal(t, payload.Data.Models[0].ThinkingDefault, payload.Data.Models[1].ThinkingDefault)
	require.Equal(t, payload.Data.Models[0].SupportsFastMode, payload.Data.Models[1].SupportsFastMode)
}

func TestUpdateChatModelSetsSingleAutoWithOptionalFields(t *testing.T) {
	ratio_setting.InitRatioSettings()
	setupModelListControllerTestDB(t)

	seedChatModelChannel(t, 1, "default", "gpt-4o-mini")
	seedChatModelChannel(t, 2, "default", "gpt-3.5-turbo")

	first := model.ChatModelOption{
		ModelName:   "gpt-4o-mini",
		DisplayName: "First",
		Enabled:     true,
		IsAuto:      true,
		Sort:        1,
	}
	require.NoError(t, model.CreateChatModelOption(&first))
	second := model.ChatModelOption{
		ModelName:   "gpt-3.5-turbo",
		DisplayName: "Second",
		Enabled:     true,
		Sort:        2,
	}
	require.NoError(t, model.CreateChatModelOption(&second))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPatch, "/api/chat-models/2", strings.NewReader(`{"is_auto":true,"name":"Auto target","api":"anthropic-messages","input":["text","image","audio"],"contextWindow":200000,"contextTokens":160000,"maxTokens":32000,"reasoning":false,"thinkingLevels":["off","adaptive","max"],"thinkingDefault":"adaptive","supportsFastMode":true}`))
	ctx.Set("id", 1)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(second.Id)}}

	UpdateChatModel(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload adminChatModelPayload
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, "gpt-3.5-turbo", payload.Data.Model)
	require.Equal(t, "Auto target", payload.Data.Name)
	require.True(t, payload.Data.IsAuto)
	require.Equal(t, "anthropic-messages", payload.Data.Api)
	require.Equal(t, []string{"text", "image", "audio"}, payload.Data.Input)
	require.Equal(t, 200000, payload.Data.ContextWindow)
	require.Equal(t, 160000, payload.Data.ContextTokens)
	require.Equal(t, 32000, payload.Data.MaxTokens)
	require.True(t, payload.Data.Reasoning)
	require.Equal(t, []string{"off", "adaptive", "max"}, payload.Data.ThinkingLevels)
	require.Equal(t, "adaptive", payload.Data.ThinkingDefault)
	require.True(t, payload.Data.SupportsFastMode)

	var options []model.ChatModelOption
	require.NoError(t, model.DB.Order("id ASC").Find(&options).Error)
	require.Len(t, options, 2)
	require.False(t, options[0].IsAuto)
	require.True(t, options[1].IsAuto)
	require.Equal(t, "gpt-4o-mini", options[0].ModelName)
	require.Equal(t, "gpt-3.5-turbo", options[1].ModelName)
	require.Equal(t, "anthropic-messages", options[1].ApiFormat)
	require.Equal(t, `["text","image","audio"]`, options[1].InputTypes)
	require.Equal(t, 200000, options[1].ContextWindow)
	require.Equal(t, 160000, options[1].ContextTokens)
	require.Equal(t, 32000, options[1].MaxTokens)
	require.True(t, options[1].Reasoning)
	require.Equal(t, `["off","adaptive","max"]`, options[1].ThinkingLevels)
	require.Equal(t, "adaptive", options[1].ThinkingDefault)
	require.True(t, options[1].SupportsFastMode)
}

func TestUpdateChatModelRejectsInvalidCapabilities(t *testing.T) {
	ratio_setting.InitRatioSettings()
	setupModelListControllerTestDB(t)
	seedChatModelChannel(t, 1, "default", "gpt-4o-mini")

	option := model.ChatModelOption{
		ModelName:   "gpt-4o-mini",
		DisplayName: "GPT-4o mini",
		Enabled:     true,
	}
	require.NoError(t, model.CreateChatModelOption(&option))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPatch, "/api/chat-models/1", strings.NewReader(`{"api":"unsupported","input":["image"],"contextWindow":4096,"contextTokens":8192,"maxTokens":8192}`))
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(option.Id)}}

	UpdateChatModel(ctx)

	var payload struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.False(t, payload.Success)

	stored, err := model.GetChatModelOptionByID(option.Id)
	require.NoError(t, err)
	require.Empty(t, stored.InputTypes)
	require.Empty(t, stored.ApiFormat)
	require.Zero(t, stored.ContextWindow)
	require.Zero(t, stored.ContextTokens)
	require.Zero(t, stored.MaxTokens)
}

func TestUpdateChatModelClearsThinkingProfileAndKeepsLegacyReasoning(t *testing.T) {
	ratio_setting.InitRatioSettings()
	setupModelListControllerTestDB(t)
	seedChatModelChannel(t, 1, "default", "gpt-4o-mini")

	option := model.ChatModelOption{
		ModelName:        "gpt-4o-mini",
		DisplayName:      "GPT-4o mini",
		ThinkingLevels:   `["off","low","high"]`,
		ThinkingDefault:  "low",
		Reasoning:        true,
		SupportsFastMode: true,
		Enabled:          true,
	}
	require.NoError(t, model.CreateChatModelOption(&option))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPatch, "/api/chat-models/1", strings.NewReader(`{"thinkingLevels":[],"reasoning":true,"supportsFastMode":false}`))
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(option.Id)}}

	UpdateChatModel(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	stored, err := model.GetChatModelOptionByID(option.Id)
	require.NoError(t, err)
	require.Empty(t, stored.ThinkingLevels)
	require.Empty(t, stored.ThinkingDefault)
	require.True(t, stored.Reasoning)
	require.False(t, stored.SupportsFastMode)
}

func TestChatModelCapabilityValidation(t *testing.T) {
	input := []string{"AUDIO", "IMAGE", "text", "video", "image"}
	normalized, err := normalizeChatModelInputTypes(&input)
	require.NoError(t, err)
	require.Equal(t, []string{"text", "image", "video", "audio"}, normalized)
	invalidInput := []string{"text", "file"}
	_, err = normalizeChatModelInputTypes(&invalidInput)
	require.Error(t, err)
	require.Equal(t, []string{"text"}, parseChatModelInputTypes(""))
	require.Equal(t, defaultChatModelAPI, parseChatModelAPI(""))
	invalidAPI := "openai-codex-responses"
	_, err = normalizeChatModelAPI(&invalidAPI)
	require.Error(t, err)
	require.Error(t, validateChatModelTokenLimits(-1, 0, 0))
	require.Error(t, validateChatModelTokenLimits(4096, 8192, 1024))
	require.Error(t, validateChatModelTokenLimits(4096, 2048, 8192))
	require.NoError(t, validateChatModelTokenLimits(128000, 96000, 16384))
	levels := []string{" OFF ", "low", "LOW", "xhigh", "max"}
	thinkingDefault := " XHIGH "
	normalizedLevels, normalizedDefault, err := normalizeChatModelThinkingProfile(&levels, &thinkingDefault)
	require.NoError(t, err)
	require.Equal(t, []string{"off", "low", "xhigh", "max"}, normalizedLevels)
	require.Equal(t, "xhigh", normalizedDefault)
	require.True(t, thinkingProfileHasReasoning(normalizedLevels))
	invalidDefault := "adaptive"
	_, _, err = normalizeChatModelThinkingProfile(&levels, &invalidDefault)
	require.Error(t, err)
	invalidLevels := []string{"off", "not valid"}
	_, _, err = normalizeChatModelThinkingProfile(&invalidLevels, nil)
	require.Error(t, err)
}

func TestListChatModelThinkingLevelsUsesConfiguredProfiles(t *testing.T) {
	setupModelListControllerTestDB(t)
	require.NoError(t, model.CreateChatModelOption(&model.ChatModelOption{
		ModelName:      "first-model",
		ThinkingLevels: `["off","low","provider-depth"]`,
	}))
	require.NoError(t, model.CreateChatModelOption(&model.ChatModelOption{
		ModelName:      "second-model",
		ThinkingLevels: `["off","xhigh","max"]`,
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/chat-models/thinking-levels", nil)

	ListChatModelThinkingLevels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload thinkingLevelOptionsPayload
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, []string{"off", "low", "provider-depth", "xhigh", "max"}, payload.Data.Items)
	require.Equal(t, len(payload.Data.Items), payload.Data.Total)
}

func TestBatchCreateChatModelsAddsDisabledOptions(t *testing.T) {
	ratio_setting.InitRatioSettings()
	setupModelListControllerTestDB(t)

	seedChatModelChannel(t, 1, "default", "gpt-4o-mini")
	seedChatModelChannel(t, 2, "default", "gpt-3.5-turbo")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/chat-models/batch", strings.NewReader(`{"models":["gpt-4o-mini","gpt-3.5-turbo","gpt-4o-mini"]}`))

	BatchCreateChatModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload batchAdminChatModelsPayload
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, 2, payload.Data.CreatedCount)
	require.Equal(t, 1, payload.Data.SkippedCount)
	require.Len(t, payload.Data.Created, 2)
	for _, item := range payload.Data.Created {
		require.Equal(t, defaultChatModelAPI, item.Api)
		require.Equal(t, []string{"text"}, item.Input)
		require.NotNil(t, item.ThinkingLevels)
		require.Empty(t, item.ThinkingLevels)
		require.False(t, item.SupportsFastMode)
	}

	var options []model.ChatModelOption
	require.NoError(t, model.DB.Order("id ASC").Find(&options).Error)
	require.Len(t, options, 2)
	for _, option := range options {
		require.False(t, option.Enabled)
		require.False(t, option.IsAuto)
		require.Nil(t, option.AutoKey)
		require.Equal(t, option.ModelName, option.DisplayName)
		require.Equal(t, defaultChatModelAPI, option.ApiFormat)
		require.Equal(t, `["text"]`, option.InputTypes)
		require.False(t, option.SupportsFastMode)
	}
}

func TestBatchCreateChatModelsRejectsTooManyModels(t *testing.T) {
	setupModelListControllerTestDB(t)

	var body strings.Builder
	body.WriteString(`{"models":[`)
	for i := 0; i <= maxBatchCreateChatModels; i++ {
		if i > 0 {
			body.WriteByte(',')
		}
		body.WriteString(`"gpt-4o-mini"`)
	}
	body.WriteString(`]}`)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/chat-models/batch", strings.NewReader(body.String()))

	BatchCreateChatModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.False(t, payload.Success)
	require.Equal(t, "模型数量不能超过 "+strconv.Itoa(maxBatchCreateChatModels)+" 个", payload.Message)

	var count int64
	require.NoError(t, model.DB.Model(&model.ChatModelOption{}).Count(&count).Error)
	require.Zero(t, count)
}
