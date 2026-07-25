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
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type listModelsResponse struct {
	Success bool               `json:"success"`
	Data    []dto.OpenAIModels `json:"data"`
	Object  string             `json:"object"`
}

type availableModelsResponse struct {
	Success bool               `json:"success"`
	Data    []dto.OpenAIModels `json:"data"`
	Object  string             `json:"object"`
}

func setupModelListControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	initModelListColumnNames(t)

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.NewUserBonusClaim{},
		&model.RegistrationDomainState{},
		&model.RegistrationDomainBlock{},
		&model.RegistrationDomainBlockUser{},
		&model.Channel{},
		&model.Ability{},
		&model.Model{},
		&model.Vendor{},
		&model.ModelAvailabilityState{},
	))

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
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
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalSQLDSN, hadSQLDSN := os.LookupEnv("SQL_DSN")
	defer func() {
		common.IsMasterNode = originalIsMasterNode
		common.SQLitePath = originalSQLitePath
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		if hadSQLDSN {
			require.NoError(t, os.Setenv("SQL_DSN", originalSQLDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
	}()

	common.IsMasterNode = false
	common.SQLitePath = fmt.Sprintf("file:%s_init?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	common.UsingSQLite = false
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
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

func withModelListBillingConfig(t *testing.T) {
	t.Helper()

	originalRatios := ratio_setting.ModelRatio2JSONString()
	originalPrices := ratio_setting.ModelPrice2JSONString()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"ratio-visible-model":1}`))
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalRatios))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(originalPrices))
		model.InvalidatePricingCache()
	})
	withTieredBillingConfig(t, map[string]string{
		"tiered-visible-model": "tiered_expr",
		"tiered-empty-model":   "tiered_expr",
	}, map[string]string{
		"tiered-visible-model": `tier("base", p + c)`,
		"tiered-empty-model":   "   ",
	})
}

func decodeListModelsResponse(t *testing.T, recorder *httptest.ResponseRecorder) map[string]struct{} {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload listModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, "list", payload.Object)

	ids := make(map[string]struct{}, len(payload.Data))
	for _, item := range payload.Data {
		ids[item.Id] = struct{}{}
	}
	return ids
}

func decodeAvailableModelsResponse(t *testing.T, recorder *httptest.ResponseRecorder) map[string]struct{} {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload availableModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, "list", payload.Object)

	ids := make(map[string]struct{}, len(payload.Data))
	for _, item := range payload.Data {
		ids[item.Id] = struct{}{}
	}
	return ids
}

func pricingByModelName(pricings []model.Pricing) map[string]model.Pricing {
	byName := make(map[string]model.Pricing, len(pricings))
	for _, pricing := range pricings {
		byName[pricing.ModelName] = pricing
	}
	return byName
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
	setupModelListControllerTestDB(t)

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

func TestAvailableModelsFiltersTokenLimitsByUsableGroupChannels(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id:       91001,
		Type:     constant.ChannelTypeOpenAI,
		Status:   common.ChannelStatusEnabled,
		Models:   "gpt-5.5",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}).Error)
	require.NoError(t, db.Create(&model.Channel{
		Id:       91002,
		Type:     constant.ChannelTypeOpenAI,
		Status:   common.ChannelStatusManuallyDisabled,
		Models:   "seedance2",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "gpt-5.5", ChannelId: 91001, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "default", Model: "seedance2", ChannelId: 91002, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "other", Model: "gpt-5", ChannelId: 91001, Enabled: true, Priority: &priority, Weight: weight},
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/available_models", nil)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{
		"gpt-5.5":   true,
		"seedance2": true,
		"gpt-5":     true,
	})

	AvailableModels(ctx)

	ids := decodeAvailableModelsResponse(t, recorder)
	require.Contains(t, ids, "gpt-5.5")
	require.NotContains(t, ids, "seedance2")
	require.NotContains(t, ids, "gpt-5")
}

func withModelListGroupSettings(t *testing.T, usableGroups map[string]string, autoGroups []string) {
	t.Helper()

	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalAutoGroups := setting.AutoGroups2JsonString()
	replacementUsableGroups, err := common.Marshal(usableGroups)
	require.NoError(t, err)
	replacementAutoGroups, err := common.Marshal(autoGroups)
	require.NoError(t, err)
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(string(replacementUsableGroups)))
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(string(replacementAutoGroups)))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
	})
}

func createAvailableModelFixture(t *testing.T, db *gorm.DB, channelID int, status int, groupModels map[string][]string) {
	t.Helper()

	priority := int64(0)
	weight := uint(100)
	modelNames := make([]string, 0)
	abilities := make([]model.Ability, 0)
	for group, models := range groupModels {
		for _, modelName := range models {
			modelNames = append(modelNames, modelName)
			abilities = append(abilities, model.Ability{
				Group: group, Model: modelName, ChannelId: channelID, Enabled: true,
				Priority: &priority, Weight: weight,
			})
		}
	}
	require.NoError(t, db.Create(&model.Channel{
		Id: channelID, Type: constant.ChannelTypeOpenAI, Status: status,
		Models: strings.Join(modelNames, ","), Group: "contract-test",
		Priority: &priority, Weight: &weight,
	}).Error)
	require.NoError(t, db.Create(&abilities).Error)
}

func requestAvailableModelIDs(t *testing.T, configureContext func(*gin.Context)) []string {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/available_models", nil)
	configureContext(ctx)
	AvailableModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload availableModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, "list", payload.Object)
	ids := make([]string, 0, len(payload.Data))
	for _, item := range payload.Data {
		ids = append(ids, item.Id)
	}
	return ids
}

func requestAvailableModels(t *testing.T, configureContext func(*gin.Context)) []dto.OpenAIModels {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/available_models", nil)
	configureContext(ctx)
	AvailableModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload availableModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, "list", payload.Object)
	return payload.Data
}

func requestDeclarativeModelResponse(t *testing.T, modelType int) map[string]any {
	t.Helper()

	originalSelfUseMode := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = true
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = originalSelfUseMode })
	setupModelListControllerTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{"contract-only-model": true})
	ListModels(ctx, modelType)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	return payload
}

func requireExactJSONKeys(t *testing.T, value map[string]any, keys ...string) {
	t.Helper()

	require.Len(t, value, len(keys))
	for _, key := range keys {
		require.Contains(t, value, key)
	}
}

func TestListModelsKeepsDeclarativeTokenModelsWithoutUsableChannels(t *testing.T) {
	payload := requestDeclarativeModelResponse(t, constant.ChannelTypeOpenAI)
	data, ok := payload["data"].([]any)
	require.True(t, ok)
	require.Len(t, data, 1)
	modelData, ok := data[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "contract-only-model", modelData["id"])
}

func TestListModelsKeepsOpenAIResponseShape(t *testing.T) {
	payload := requestDeclarativeModelResponse(t, constant.ChannelTypeOpenAI)
	requireExactJSONKeys(t, payload, "success", "data", "object")
	require.IsType(t, true, payload["success"])
	require.IsType(t, "", payload["object"])
	data := payload["data"].([]any)
	modelData := data[0].(map[string]any)
	requireExactJSONKeys(t, modelData, "id", "object", "created", "owned_by", "supported_endpoint_types")
	require.IsType(t, "", modelData["id"])
	require.IsType(t, "", modelData["object"])
	require.IsType(t, float64(0), modelData["created"])
	require.IsType(t, "", modelData["owned_by"])
	require.IsType(t, []any{}, modelData["supported_endpoint_types"])
}

func TestListModelsKeepsAnthropicResponseShape(t *testing.T) {
	payload := requestDeclarativeModelResponse(t, constant.ChannelTypeAnthropic)
	requireExactJSONKeys(t, payload, "data", "first_id", "has_more", "last_id")
	require.IsType(t, "", payload["first_id"])
	require.IsType(t, false, payload["has_more"])
	require.IsType(t, "", payload["last_id"])
	data := payload["data"].([]any)
	modelData := data[0].(map[string]any)
	requireExactJSONKeys(t, modelData, "id", "created_at", "display_name", "type")
	require.IsType(t, "", modelData["id"])
	require.IsType(t, "", modelData["created_at"])
	require.IsType(t, "", modelData["display_name"])
	require.IsType(t, "", modelData["type"])
}

func TestListModelsKeepsGeminiResponseShape(t *testing.T) {
	payload := requestDeclarativeModelResponse(t, constant.ChannelTypeGemini)
	requireExactJSONKeys(t, payload, "models", "nextPageToken")
	require.Nil(t, payload["nextPageToken"])
	data := payload["models"].([]any)
	modelData := data[0].(map[string]any)
	requireExactJSONKeys(t, modelData,
		"name", "baseModelId", "version", "displayName", "description",
		"inputTokenLimit", "outputTokenLimit", "supportedGenerationMethods",
		"thinking", "temperature", "maxTemperature", "topP", "topK",
	)
	require.IsType(t, "", modelData["name"])
	require.IsType(t, "", modelData["displayName"])
	for _, key := range []string{
		"baseModelId", "version", "description", "inputTokenLimit", "outputTokenLimit",
		"supportedGenerationMethods", "thinking", "temperature", "maxTemperature", "topP", "topK",
	} {
		require.Nil(t, modelData[key])
	}
}

func TestListModelsWithoutWhitelistKeepsDeclarativeModelFromDisabledChannel(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 91999, common.ChannelStatusManuallyDisabled, map[string][]string{
		"default": {"disabled-channel-declarative-model"},
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, false)
	ListModels(ctx, constant.ChannelTypeOpenAI)

	ids := decodeListModelsResponse(t, recorder)
	require.Contains(t, ids, "disabled-channel-declarative-model")
}

func TestAvailableModelsUsesOrdinaryTokenGroup(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92001, common.ChannelStatusEnabled, map[string][]string{
		"default": {"default-model"},
		"vip":     {"vip-model"},
	})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "vip")
	})

	require.Equal(t, []string{"vip-model"}, ids)
}

func TestAvailableModelsClassifiesVideoEndpointModels(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id: 92011, Type: constant.ChannelTypeBlockRunSeedance, Status: common.ChannelStatusEnabled,
		Models: "seedance-2.0", Group: "default", Priority: &priority, Weight: &weight,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "seedance-2.0", ChannelId: 92011,
		Enabled: true, Priority: &priority, Weight: weight,
	}).Error)

	models := requestAvailableModels(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	})

	require.Len(t, models, 1)
	require.Equal(t, "seedance-2.0", models[0].Id)
	require.Equal(t, "video", models[0].Type)
	require.Contains(t, models[0].SupportedEndpointTypes, constant.EndpointTypeOpenAIVideo)
}

func TestAvailableModelTypeInference(t *testing.T) {
	require.Equal(t, "video", availableModelType("plain-name", []constant.EndpointType{constant.EndpointTypeOpenAIVideo}))
	require.Equal(t, "image", availableModelType("gpt-image-2", []constant.EndpointType{constant.EndpointTypeOpenAI}))
	require.Equal(t, "audio", availableModelType("gemini-2.5-flash-tts", []constant.EndpointType{constant.EndpointTypeOpenAI}))
	require.Equal(t, "audio", availableModelType("eleven_multilingual_v2", []constant.EndpointType{constant.EndpointTypeOpenAI}))
	require.Equal(t, "audio", availableModelType("eleven_sound_v1", []constant.EndpointType{constant.EndpointTypeOpenAI}))
	require.Equal(t, "audio", availableModelType("eleven_music_v1", []constant.EndpointType{constant.EndpointTypeOpenAI}))
	require.Equal(t, "text", availableModelType("gpt-5.5", []constant.EndpointType{constant.EndpointTypeOpenAI}))
}

func TestAvailableModelsUsesAutoGroupUnion(t *testing.T) {
	withSelfUseModeEnabled(t)
	withModelListGroupSettings(t, map[string]string{"default": "Default", "vip": "VIP", "auto": "Auto"}, []string{"default", "vip"})
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92002, common.ChannelStatusEnabled, map[string][]string{
		"default": {"shared-model", "default-model"},
		"vip":     {"shared-model", "vip-model"},
	})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "auto")
	})

	require.Equal(t, []string{"default-model", "shared-model", "vip-model"}, ids)
}

func TestAvailableModelsUsesPLGAccountGroup(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92003, common.ChannelStatusEnabled, map[string][]string{
		"plg":     {"plg-model"},
		"default": {"default-model"},
	})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "plg")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "plg")
	})

	require.Equal(t, []string{"plg-model"}, ids)
}

func TestAvailableModelsExcludesModelsWithOnlyDisabledChannels(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92004, common.ChannelStatusEnabled, map[string][]string{"default": {"enabled-model"}})
	createAvailableModelFixture(t, db, 92005, common.ChannelStatusManuallyDisabled, map[string][]string{"default": {"disabled-model"}})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	})

	require.Equal(t, []string{"enabled-model"}, ids)
}

func TestAvailableModelsIntersectsEnabledNonEmptyTokenWhitelist(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92006, common.ChannelStatusEnabled, map[string][]string{"default": {"allowed-model", "scope-only-model"}})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{"allowed-model": true, "outside-scope": true})
	})

	require.Equal(t, []string{"allowed-model"}, ids)
}

func TestAvailableModelsReturnsEmptyWhenTokenWhitelistEnabledAndEmpty(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92007, common.ChannelStatusEnabled, map[string][]string{"default": {"scope-model"}})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{})
	})

	require.Empty(t, ids)
}

func TestAvailableModelsMatchesWhitelistUsingDistributorNormalization(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92009, common.ChannelStatusEnabled, map[string][]string{
		"default": {"gpt-4-gizmo-customer-model"},
	})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{"gpt-4-gizmo-*": true})
	})

	require.Equal(t, []string{"gpt-4-gizmo-customer-model"}, ids)
}

func TestAvailableModelsSortsModelIDsStably(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92008, common.ChannelStatusEnabled, map[string][]string{"default": {"z-model", "a-model", "m-model"}})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	})

	require.Equal(t, []string{"a-model", "m-model", "z-model"}, ids)
}

func TestAvailableModelsIncludesRatioAndValidTieredBillingModels(t *testing.T) {
	withSelfUseModeDisabled(t)
	withModelListBillingConfig(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92101, common.ChannelStatusEnabled, map[string][]string{
		"default": {"ratio-visible-model", "tiered-visible-model"},
	})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	})

	require.Equal(t, []string{"ratio-visible-model", "tiered-visible-model"}, ids)
}

func TestAvailableModelsExcludesMissingAndEmptyTieredBillingModels(t *testing.T) {
	withSelfUseModeDisabled(t)
	withModelListBillingConfig(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92102, common.ChannelStatusEnabled, map[string][]string{
		"default": {"missing-billing-model", "tiered-empty-model"},
	})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	})

	require.Empty(t, ids)
}

func TestAvailableModelsIncludesUnpricedModelInSelfUseMode(t *testing.T) {
	withSelfUseModeEnabled(t)
	withModelListBillingConfig(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92103, common.ChannelStatusEnabled, map[string][]string{
		"default": {"self-use-unpriced-model"},
	})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	})

	require.Equal(t, []string{"self-use-unpriced-model"}, ids)
}

func TestAvailableModelsIncludesUnpricedModelForUserOptIn(t *testing.T) {
	withSelfUseModeDisabled(t)
	withModelListBillingConfig(t)
	db := setupModelListControllerTestDB(t)
	settingJSON, err := common.Marshal(dto.UserSetting{AcceptUnsetRatioModel: true})
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.User{
		Id: 92104, Username: "unpriced-opt-in", Password: "password",
		Group: "default", Status: common.UserStatusEnabled, Setting: string(settingJSON),
	}).Error)
	createAvailableModelFixture(t, db, 92104, common.ChannelStatusEnabled, map[string][]string{
		"default": {"user-opt-in-unpriced-model"},
	})

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		ctx.Set("id", 92104)
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyUserSetting, dto.UserSetting{AcceptUnsetRatioModel: true})
	})

	require.Equal(t, []string{"user-opt-in-unpriced-model"}, ids)
}

func TestAvailableModelsExcludesDisabledAbility(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id: 92105, Type: constant.ChannelTypeOpenAI, Key: "contract-test-key",
		Status: common.ChannelStatusEnabled, Models: "disabled-ability-model", Group: "default",
		Priority: &priority, Weight: &weight,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "disabled-ability-model", ChannelId: 92105,
		Enabled: false, Priority: &priority, Weight: weight,
	}).Error)

	ids := requestAvailableModelIDs(t, func(ctx *gin.Context) {
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	})

	require.Empty(t, ids)
}

func requestAvailableModelOwners(t *testing.T) map[string]string {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/available_models", nil)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	AvailableModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload availableModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	owners := make(map[string]string, len(payload.Data))
	for _, item := range payload.Data {
		owners[item.Id] = item.OwnedBy
	}
	return owners
}

func TestAvailableModelsUsesPublicVendorNameAsOwner(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92106, common.ChannelStatusEnabled, map[string][]string{
		"default": {"public-vendor-model"},
	})
	vendor := model.Vendor{Name: "Public Vendor", Status: 1}
	require.NoError(t, db.Create(&vendor).Error)
	require.NoError(t, db.Create(&model.Model{
		ModelName: "public-vendor-model", VendorID: vendor.Id, Status: 1,
	}).Error)

	owners := requestAvailableModelOwners(t)
	require.Equal(t, "Public Vendor", owners["public-vendor-model"])
	require.NotContains(t, owners["public-vendor-model"], "openai")
}

func TestAvailableModelsUsesCustomOwnerWithoutPublicVendor(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 92107, common.ChannelStatusEnabled, map[string][]string{
		"default": {"custom-owner-model"},
	})

	owners := requestAvailableModelOwners(t)
	require.Equal(t, "custom", owners["custom-owner-model"])
	require.NotContains(t, owners["custom-owner-model"], "openai")
}
