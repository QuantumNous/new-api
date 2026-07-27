package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type listModelsResponse struct {
	Success bool               `json:"success"`
	Data    []dto.OpenAIModels `json:"data"`
	Object  string             `json:"object"`
}

type userModelsResponse struct {
	Success bool     `json:"success"`
	Data    []string `json:"data"`
}

type anthropicModelsResponse struct {
	Data    []dto.AnthropicModel `json:"data"`
	FirstID *string              `json:"first_id"`
	HasMore bool                 `json:"has_more"`
	LastID  *string              `json:"last_id"`
}

func setupModelListControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	initModelListColumnNames(t)

	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Channel{}, &model.Ability{}, &model.Model{}, &model.Vendor{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func initModelListColumnNames(t *testing.T) {
	t.Helper()

	originalIsMasterNode := common.IsMasterNode
	originalSQLitePath := common.SQLitePath
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalSQLDSN, hadSQLDSN := os.LookupEnv("SQL_DSN")
	defer func() {
		common.IsMasterNode = originalIsMasterNode
		common.SQLitePath = originalSQLitePath
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		if hadSQLDSN {
			require.NoError(t, os.Setenv("SQL_DSN", originalSQLDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
	}()

	common.IsMasterNode = false
	common.SQLitePath = fmt.Sprintf("file:%s_init?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	require.NoError(t, os.Setenv("SQL_DSN", "local"))

	require.NoError(t, model.InitDB())
	if model.DB != nil {
		sqlDB, err := model.DB.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	}
}

func withTieredBillingConfig(t *testing.T, modes map[string]string, exprs map[string]string) {
	t.Helper()

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		if strings.HasPrefix(key, "billing_setting.") {
			saved[key] = value
		}
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
		model.InvalidatePricingCache()
	})

	modeBytes, err := common.Marshal(modes)
	require.NoError(t, err)
	exprBytes, err := common.Marshal(exprs)
	require.NoError(t, err)

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": string(modeBytes),
		"billing_setting.billing_expr": string(exprBytes),
	}))
	model.InvalidatePricingCache()
}

func withSelfUseModeDisabled(t *testing.T) {
	t.Helper()

	original := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() {
		operation_setting.SelfUseModeEnabled = original
	})
}

func withSelfUseModeEnabled(t *testing.T) {
	t.Helper()

	original := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = true
	t.Cleanup(func() {
		operation_setting.SelfUseModeEnabled = original
	})
}

func decodeListModelsPayload(t *testing.T, recorder *httptest.ResponseRecorder) listModelsResponse {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload listModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, "list", payload.Object)
	return payload
}

func decodeListModelsResponse(t *testing.T, recorder *httptest.ResponseRecorder) map[string]struct{} {
	t.Helper()

	payload := decodeListModelsPayload(t, recorder)
	ids := make(map[string]struct{}, len(payload.Data))
	for _, item := range payload.Data {
		ids[item.Id] = struct{}{}
	}
	return ids
}

func TestListModelsReturnsEmptyAnthropicPage(t *testing.T) {
	withSelfUseModeEnabled(t)
	setupModelListControllerTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")

	ListModels(ctx, constant.ChannelTypeAnthropic)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload anthropicModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	assert.Empty(t, payload.Data)
	assert.Nil(t, payload.FirstID)
	assert.False(t, payload.HasMore)
	assert.Nil(t, payload.LastID)
}

func pricingByModelName(pricings []model.Pricing) map[string]model.Pricing {
	byName := make(map[string]model.Pricing, len(pricings))
	for _, pricing := range pricings {
		byName[pricing.ModelName] = pricing
	}
	return byName
}

func decodeUserModelsResponse(t *testing.T, recorder *httptest.ResponseRecorder) []string {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload userModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	return payload.Data
}

func TestGetUserModelsFiltersByRequestedGroup(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       1002,
		Username: "playground-model-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "zz-default-only-model", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "zz-disabled-model", ChannelId: 1, Enabled: false},
	}).Error)

	defaultRecorder := httptest.NewRecorder()
	defaultContext, _ := gin.CreateTestContext(defaultRecorder)
	defaultContext.Request = httptest.NewRequest(http.MethodGet, "/api/user/models?group=default", nil)
	defaultContext.Set("id", 1002)

	GetUserModels(defaultContext)

	defaultModels := decodeUserModelsResponse(t, defaultRecorder)
	require.ElementsMatch(t, []string{"zz-default-only-model"}, defaultModels)

	vipRecorder := httptest.NewRecorder()
	vipContext, _ := gin.CreateTestContext(vipRecorder)
	vipContext.Request = httptest.NewRequest(http.MethodGet, "/api/user/models?group=vip", nil)
	vipContext.Set("id", 1002)

	GetUserModels(vipContext)

	require.Empty(t, decodeUserModelsResponse(t, vipRecorder))
}

func TestListModelsIncludesTieredBillingModel(t *testing.T) {
	withSelfUseModeDisabled(t)
	withTieredBillingConfig(t, map[string]string{
		"zz-tiered-visible-model":      "tiered_expr",
		"zz-tiered-empty-expr-model":   "tiered_expr",
		"zz-tiered-missing-expr-model": "tiered_expr",
	}, map[string]string{
		"zz-tiered-visible-model":    `tier("base", p * 1 + c * 2)`,
		"zz-tiered-empty-expr-model": "   ",
	})

	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       1001,
		Username: "model-list-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "zz-tiered-visible-model", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "zz-tiered-empty-expr-model", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "zz-tiered-missing-expr-model", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "zz-unpriced-model", ChannelId: 1, Enabled: true},
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	ctx.Set("id", 1001)

	ListModels(ctx, constant.ChannelTypeOpenAI)

	ids := decodeListModelsResponse(t, recorder)
	require.Contains(t, ids, "zz-tiered-visible-model")
	require.NotContains(t, ids, "zz-tiered-empty-expr-model")
	require.NotContains(t, ids, "zz-tiered-missing-expr-model")
	require.NotContains(t, ids, "zz-unpriced-model")

	pricingByName := pricingByModelName(model.GetPricing())
	visiblePricing, ok := pricingByName["zz-tiered-visible-model"]
	require.True(t, ok)
	require.Equal(t, "tiered_expr", visiblePricing.BillingMode)
	require.NotEmpty(t, visiblePricing.BillingExpr)

	emptyExprPricing, ok := pricingByName["zz-tiered-empty-expr-model"]
	require.True(t, ok)
	require.Empty(t, emptyExprPricing.BillingMode)
	require.Empty(t, emptyExprPricing.BillingExpr)

	missingExprPricing, ok := pricingByName["zz-tiered-missing-expr-model"]
	require.True(t, ok)
	require.Empty(t, missingExprPricing.BillingMode)
	require.Empty(t, missingExprPricing.BillingExpr)
}

func TestListModelsUsesAdvancedCustomEndpointTypesFromPricingCache(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		model.InvalidatePricingCache()
	})

	require.NoError(t, db.Create(&model.User{
		Id:       1003,
		Username: "advanced-custom-model-list-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)

	channel := &model.Channel{
		Id:     701,
		Type:   constant.ChannelTypeAdvancedCustom,
		Key:    "advanced-custom-key",
		Status: common.ChannelStatusEnabled,
		Name:   "advanced-custom-channel",
		Group:  "default",
		Models: "gemini-3.5-flash",
	}
	channel.SetOtherSettings(dto.ChannelOtherSettings{
		AdvancedCustom: &dto.AdvancedCustomConfig{
			Routes: []dto.AdvancedCustomRoute{
				{
					IncomingPath: "/v1/chat/completions",
					UpstreamPath: "/v1/chat/completions",
				},
				{
					IncomingPath: "/v1/responses",
					UpstreamPath: "/v1beta/models/{model}:generateContent",
					Converter:    "openai_responses_to_gemini_generate_content",
					Models:       []string{"re:^gemini-"},
				},
			},
		},
	})
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "gemini-3.5-flash",
		ChannelId: 701,
		Enabled:   true,
	}).Error)

	model.InitChannelCache()
	model.GetPricing()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	ctx.Set("id", 1003)

	ListModels(ctx, constant.ChannelTypeOpenAI)

	payload := decodeListModelsPayload(t, recorder)
	require.Len(t, payload.Data, 1)
	require.Equal(t, "gemini-3.5-flash", payload.Data[0].Id)
	require.Equal(t, []constant.EndpointType{
		constant.EndpointTypeOpenAI,
		constant.EndpointTypeOpenAIResponse,
	}, payload.Data[0].SupportedEndpointTypes)
}

func TestListModelsScopesEndpointTypesToOwnerGroups(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)

	originalAutoGroups := setting.AutoGroups2JsonString()
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["vip","default"]`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
		model.InvalidatePricingCache()
	})

	const modelName = "zz-group-scoped-endpoint-model"
	require.NoError(t, db.Create(&[]model.Channel{
		{
			Id:     801,
			Type:   constant.ChannelTypeAnthropic,
			Name:   "default-anthropic-channel",
			Status: common.ChannelStatusEnabled,
		},
		{
			Id:     802,
			Type:   constant.ChannelTypeJina,
			Name:   "vip-jina-channel",
			Status: common.ChannelStatusEnabled,
		},
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: modelName, ChannelId: 801, Enabled: true},
		{Group: "vip", Model: modelName, ChannelId: 802, Enabled: true},
	}).Error)

	model.InvalidatePricingCache()
	model.GetPricing()

	defaultRecorder := httptest.NewRecorder()
	defaultContext, _ := gin.CreateTestContext(defaultRecorder)
	defaultContext.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(defaultContext, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(defaultContext, constant.ContextKeyTokenGroup, "default")

	ListModels(defaultContext, constant.ChannelTypeOpenAI)

	defaultPayload := decodeListModelsPayload(t, defaultRecorder)
	require.Len(t, defaultPayload.Data, 1)
	require.Equal(t, modelName, defaultPayload.Data[0].Id)
	require.Equal(t, []constant.EndpointType{
		constant.EndpointTypeAnthropic,
		constant.EndpointTypeOpenAI,
	}, defaultPayload.Data[0].SupportedEndpointTypes)

	autoRecorder := httptest.NewRecorder()
	autoContext, _ := gin.CreateTestContext(autoRecorder)
	autoContext.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(autoContext, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(autoContext, constant.ContextKeyTokenGroup, "auto")

	ListModels(autoContext, constant.ChannelTypeOpenAI)

	autoPayload := decodeListModelsPayload(t, autoRecorder)
	require.Len(t, autoPayload.Data, 1)
	require.Equal(t, modelName, autoPayload.Data[0].Id)
	require.Equal(t, []constant.EndpointType{
		constant.EndpointTypeJinaRerank,
		constant.EndpointTypeAnthropic,
		constant.EndpointTypeOpenAI,
	}, autoPayload.Data[0].SupportedEndpointTypes)
}

func TestListModelsUsesOrderedTokenCandidatesForUnionAndOwner(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)

	const (
		sharedModel     = "a-shared-candidate-model"
		firstOnlyModel  = "z-first-candidate-model"
		secondOnlyModel = "b-second-candidate-model"
	)
	require.NoError(t, db.Create(&[]model.Channel{
		{Id: 811, Type: constant.ChannelTypeOpenAI, Name: "first-openai", Status: common.ChannelStatusEnabled},
		{Id: 812, Type: constant.ChannelTypeCodex, Name: "first-codex", Status: common.ChannelStatusEnabled},
		{Id: 813, Type: constant.ChannelTypeOpenAI, Name: "second-openai", Status: common.ChannelStatusEnabled},
	}).Error)
	lowPriority := int64(1)
	highPriority := int64(2)
	fallbackPriority := int64(100)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "claude-low", Model: sharedModel, ChannelId: 811, Enabled: true, Priority: &lowPriority},
		{Group: "claude-low", Model: sharedModel, ChannelId: 812, Enabled: true, Priority: &highPriority},
		{Group: "claude-low", Model: firstOnlyModel, ChannelId: 812, Enabled: true, Priority: &highPriority},
		{Group: "openai-low", Model: sharedModel, ChannelId: 813, Enabled: true, Priority: &fallbackPriority},
		{Group: "openai-low", Model: secondOnlyModel, ChannelId: 813, Enabled: true, Priority: &fallbackPriority},
	}).Error)

	model.InvalidatePricingCache()

	firstRecorder := httptest.NewRecorder()
	firstContext, _ := gin.CreateTestContext(firstRecorder)
	firstContext.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(firstContext, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(firstContext, constant.ContextKeyTokenGroup, "auto")
	common.SetContextKey(firstContext, constant.ContextKeyTokenGroupCandidates, []string{"claude-low", "openai-low"})

	ListModels(firstContext, constant.ChannelTypeOpenAI)

	firstPayload := decodeListModelsPayload(t, firstRecorder)
	require.Equal(t, []string{sharedModel, firstOnlyModel, secondOnlyModel}, lo.Map(firstPayload.Data, func(item dto.OpenAIModels, _ int) string {
		return item.Id
	}))
	require.Equal(t, "codex", firstPayload.Data[0].OwnedBy)
	require.Equal(t, "codex", firstPayload.Data[1].OwnedBy)
	require.Equal(t, "openai", firstPayload.Data[2].OwnedBy)

	secondRecorder := httptest.NewRecorder()
	secondContext, _ := gin.CreateTestContext(secondRecorder)
	secondContext.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(secondContext, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(secondContext, constant.ContextKeyTokenGroup, "auto")
	common.SetContextKey(secondContext, constant.ContextKeyTokenGroupCandidates, []string{"openai-low", "claude-low"})

	ListModels(secondContext, constant.ChannelTypeOpenAI)

	secondPayload := decodeListModelsPayload(t, secondRecorder)
	require.Equal(t, []string{sharedModel, secondOnlyModel, firstOnlyModel}, lo.Map(secondPayload.Data, func(item dto.OpenAIModels, _ int) string {
		return item.Id
	}))
	require.Equal(t, "openai", secondPayload.Data[0].OwnedBy)
}

func TestListModelsOrdersEnabledModelsForEveryGroupMode(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)

	originalAutoGroups := setting.AutoGroups2JsonString()
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["default"]`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
	})

	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "zz-order-z-model", ChannelId: 821, Enabled: true},
		{Group: "default", Model: "zz-order-a-model", ChannelId: 821, Enabled: true},
		{Group: "default", Model: "zz-order-shared-model", ChannelId: 821, Enabled: true},
		{Group: "vip", Model: "zz-order-y-model", ChannelId: 822, Enabled: true},
		{Group: "vip", Model: "zz-order-b-model", ChannelId: 822, Enabled: true},
		{Group: "vip", Model: "zz-order-shared-model", ChannelId: 822, Enabled: true},
	}).Error)

	tests := []struct {
		name       string
		tokenGroup string
		candidates []string
		expected   []string
	}{
		{
			name:       "fixed group",
			tokenGroup: "default",
			expected: []string{
				"zz-order-a-model",
				"zz-order-shared-model",
				"zz-order-z-model",
			},
		},
		{
			name:       "system auto",
			tokenGroup: "auto",
			expected: []string{
				"zz-order-a-model",
				"zz-order-shared-model",
				"zz-order-z-model",
			},
		},
		{
			name:       "ordered candidates",
			tokenGroup: "auto",
			candidates: []string{"vip", "default"},
			expected: []string{
				"zz-order-b-model",
				"zz-order-shared-model",
				"zz-order-y-model",
				"zz-order-a-model",
				"zz-order-z-model",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
			common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
			common.SetContextKey(ctx, constant.ContextKeyTokenGroup, tt.tokenGroup)
			common.SetContextKey(ctx, constant.ContextKeyTokenGroupCandidates, tt.candidates)

			ListModels(ctx, constant.ChannelTypeOpenAI)

			payload := decodeListModelsPayload(t, recorder)
			require.Equal(t, tt.expected, lo.Map(payload.Data, func(item dto.OpenAIModels, _ int) string {
				return item.Id
			}))
		})
	}
}

func TestListModelsIntersectsTokenModelLimitsWithCandidateGroups(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)

	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "first", Model: "zz-limit-a-shared-model", ChannelId: 831, Enabled: true},
		{Group: "first", Model: "zz-limit-z-first-model", ChannelId: 831, Enabled: true},
		{Group: "first", Model: "zz-limit-m-not-allowed-model", ChannelId: 831, Enabled: true},
		{Group: "first", Model: "zz-limit-disabled-model", ChannelId: 831, Enabled: false},
		{Group: "second", Model: "zz-limit-a-shared-model", ChannelId: 832, Enabled: true},
		{Group: "second", Model: "zz-limit-b-second-model", ChannelId: 832, Enabled: true},
		{Group: "foreign", Model: "zz-limit-foreign-model", ChannelId: 833, Enabled: true},
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "auto")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroupCandidates, []string{"first", "second"})
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{
		"zz-limit-a-shared-model": true,
		"zz-limit-z-first-model":  true,
		"zz-limit-b-second-model": true,
		"zz-limit-disabled-model": true,
		"zz-limit-foreign-model":  true,
		"zz-limit-missing-model":  true,
	})

	ListModels(ctx, constant.ChannelTypeOpenAI)

	payload := decodeListModelsPayload(t, recorder)
	require.Equal(t, []string{
		"zz-limit-a-shared-model",
		"zz-limit-z-first-model",
		"zz-limit-b-second-model",
	}, lo.Map(payload.Data, func(item dto.OpenAIModels, _ int) string {
		return item.Id
	}))
}

func TestListModelsAdvertisesCodexResponseEndpoints(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)

	const (
		responsesModel = "zz-codex-responses-model"
		compactModel   = "zz-codex-responses-model-openai-compact"
	)
	require.NoError(t, db.Create(&model.Channel{
		Id:     803,
		Type:   constant.ChannelTypeCodex,
		Name:   "codex-channel",
		Status: common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: responsesModel, ChannelId: 803, Enabled: true},
		{Group: "default", Model: compactModel, ChannelId: 803, Enabled: true},
	}).Error)

	model.InvalidatePricingCache()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")

	ListModels(ctx, constant.ChannelTypeOpenAI)

	payload := decodeListModelsPayload(t, recorder)
	require.Len(t, payload.Data, 2)
	modelsByID := make(map[string]dto.OpenAIModels, len(payload.Data))
	for _, item := range payload.Data {
		modelsByID[item.Id] = item
	}
	require.Equal(t,
		[]constant.EndpointType{constant.EndpointTypeOpenAIResponse},
		modelsByID[responsesModel].SupportedEndpointTypes,
	)
	require.Equal(t,
		[]constant.EndpointType{constant.EndpointTypeOpenAIResponseCompact},
		modelsByID[compactModel].SupportedEndpointTypes,
	)
}

func TestListModelsTokenLimitIncludesTieredBillingModel(t *testing.T) {
	withSelfUseModeDisabled(t)
	withTieredBillingConfig(t, map[string]string{
		"zz-token-tiered-visible-model":      "tiered_expr",
		"zz-token-tiered-empty-expr-model":   "tiered_expr",
		"zz-token-tiered-missing-expr-model": "tiered_expr",
	}, map[string]string{
		"zz-token-tiered-visible-model":    `tier("base", p * 1 + c * 2)`,
		"zz-token-tiered-empty-expr-model": "",
	})
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "zz-token-tiered-visible-model", ChannelId: 841, Enabled: true},
		{Group: "default", Model: "zz-token-tiered-empty-expr-model", ChannelId: 841, Enabled: true},
		{Group: "default", Model: "zz-token-tiered-missing-expr-model", ChannelId: 841, Enabled: true},
		{Group: "default", Model: "zz-token-unpriced-model", ChannelId: 841, Enabled: true},
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{
		"zz-token-tiered-visible-model":      true,
		"zz-token-tiered-empty-expr-model":   true,
		"zz-token-tiered-missing-expr-model": true,
		"zz-token-unpriced-model":            true,
	})

	ListModels(ctx, constant.ChannelTypeOpenAI)

	ids := decodeListModelsResponse(t, recorder)
	require.Contains(t, ids, "zz-token-tiered-visible-model")
	require.NotContains(t, ids, "zz-token-tiered-empty-expr-model")
	require.NotContains(t, ids, "zz-token-tiered-missing-expr-model")
	require.NotContains(t, ids, "zz-token-unpriced-model")
}

func TestCheckUpdatePasswordRequiresCurrentPassword(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	hashedPassword, err := common.Password2Hash("CurrentPassword123")
	require.NoError(t, err)
	user := &model.User{
		Username: "password-user",
		Password: hashedPassword,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(user).Error)

	updatePassword, err := checkUpdatePassword("", "", user.Id)
	require.NoError(t, err)
	assert.False(t, updatePassword)

	updatePassword, err = checkUpdatePassword("", "NewPassword123", user.Id)
	require.Error(t, err)
	assert.False(t, updatePassword)
	assert.ErrorIs(t, err, errOriginalPasswordFail)

	updatePassword, err = checkUpdatePassword("CurrentPassword123", "NewPassword123", user.Id)
	require.NoError(t, err)
	assert.True(t, updatePassword)
}

func TestCheckUpdatePasswordRejectsHistoricalEmptyPassword(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	user := &model.User{
		Username: "legacy-passwordless-user",
		Password: "",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(user).Error)

	updatePassword, err := checkUpdatePassword("", "NewPassword123", user.Id)
	require.Error(t, err)
	assert.False(t, updatePassword)
	assert.ErrorIs(t, err, errUserPasswordUnset)
}

func TestSetupLoginDoesNotTouchPasswordWhenPasswordFieldOmitted(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))

	hashedPassword, err := common.Password2Hash("CurrentPassword123")
	require.NoError(t, err)
	user := &model.User{
		Username: "twofa-user",
		Password: hashedPassword,
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, db.Create(user).Error)

	router := gin.New()
	store := cookie.NewStore([]byte("test-session-secret"))
	router.Use(sessions.Sessions("session", store))
	router.GET("/", func(c *gin.Context) {
		setupLogin(&model.User{
			Id:       user.Id,
			Username: user.Username,
			Role:     user.Role,
			Status:   user.Status,
			Group:    user.Group,
		}, c)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	var stored model.User
	require.NoError(t, db.First(&stored, user.Id).Error)
	assert.Equal(t, hashedPassword, stored.Password)
}
