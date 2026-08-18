package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type controllerAssetMaterializer struct {
	createErr error
	called    *bool
}

func (m controllerAssetMaterializer) CreateAsset(ctx context.Context, input service.AssetMaterializeInput) (service.AssetMaterializeResult, error) {
	if m.called != nil {
		*m.called = true
	}
	if m.createErr != nil {
		return service.AssetMaterializeResult{}, m.createErr
	}
	return service.AssetMaterializeResult{
		UpstreamGroupID: "group",
		UpstreamAssetID: "upstream-" + input.Asset.PublicId,
		Status:          model.AssetStatusActive,
	}, nil
}

func (m controllerAssetMaterializer) GetAsset(ctx context.Context, input service.AssetMaterializeInput, upstreamAssetID string) (service.AssetMaterializeResult, error) {
	return service.AssetMaterializeResult{UpstreamAssetID: upstreamAssetID, Status: model.AssetStatusActive}, nil
}

func TestGetChannelReacquiresContextChannelConcurrency(t *testing.T) {
	prevDB := model.DB
	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	t.Cleanup(func() {
		model.DB = prevDB
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	model.DB = db
	common.MemoryCacheEnabled = false
	common.RDB = nil
	common.RedisEnabled = false

	channel := &model.Channel{
		Id:             909901,
		Type:           constant.ChannelTypeOpenAI,
		Key:            "sk-test",
		Status:         common.ChannelStatusEnabled,
		Name:           "limited",
		Group:          "default",
		Models:         "gpt-test",
		MaxConcurrency: 1,
	}
	require.NoError(t, model.DB.Create(channel).Error)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(c, constant.ContextKeyChannelId, channel.Id)
	common.SetContextKey(c, constant.ContextKeyChannelType, channel.Type)
	common.SetContextKey(c, constant.ContextKeyChannelName, channel.Name)
	common.SetContextKey(c, constant.ContextKeyChannelAutoBan, channel.GetAutoBan())

	ok, err := service.AcquireChannelConcurrencyForContext(c, channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, service.ReleaseChannelConcurrencyForContext(c))

	heldLease, ok, err := service.TryAcquireChannelConcurrency(context.Background(), channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, heldLease)
	t.Cleanup(func() {
		require.NoError(t, service.ReleaseChannelConcurrency(context.Background(), heldLease))
	})

	retry := 0
	selected, channelErr := getChannel(c, &relaycommon.RelayInfo{
		TokenGroup:      "default",
		OriginModelName: "gpt-test",
	}, &service.RetryParam{
		Ctx:        c,
		TokenGroup: "default",
		ModelName:  "gpt-test",
		Retry:      &retry,
	})

	require.Nil(t, selected)
	require.NotNil(t, channelErr)
	require.Equal(t, http.StatusTooManyRequests, channelErr.StatusCode)
}

func TestProcessChannelErrorMarksCooldownOnTooManyRequests(t *testing.T) {
	restoreRuntime := useControllerMemoryChannelConcurrencyForTest(t)
	defer restoreRuntime()
	prevErrorLogEnabled := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = false
	defer func() {
		constant.ErrorLogEnabled = prevErrorLogEnabled
	}()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	channelID := 909902

	processChannelError(
		c,
		*types.NewChannelError(channelID, constant.ChannelTypeOpenAI, "cooldown", false, "", false),
		types.NewOpenAIError(errors.New("upstream rate limited"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	)

	loads, err := service.GetChannelConcurrencyLoads(context.Background(), []*model.Channel{{Id: channelID, MaxConcurrency: 1}})
	require.NoError(t, err)
	require.True(t, loads[channelID].CoolingDown)
}

func TestProcessChannelErrorLogsActualChannelSnapshot(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/channel-error-log.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}, &model.CompanyLogSchema{}, &model.Option{}))

	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousErrorLogEnabled := constant.ErrorLogEnabled
	common.OptionMapRWMutex.Lock()
	previousOptionMap := common.OptionMap
	previousCompanyLogRoutingEnabled := "false"
	if value, ok := previousOptionMap[model.OptionKeyCompanyLogRoutingEnabled]; ok {
		previousCompanyLogRoutingEnabled = value
	}
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	constant.ErrorLogEnabled = true
	require.NoError(t, model.UpdateOption(model.OptionKeyCompanyLogRoutingEnabled, "true"))
	t.Cleanup(func() {
		require.NoError(t, model.UpdateOption(model.OptionKeyCompanyLogRoutingEnabled, previousCompanyLogRoutingEnabled))
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedisEnabled
		constant.ErrorLogEnabled = previousErrorLogEnabled
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set("id", 1)
	c.Set("token_id", 7)
	c.Set("token_name", "company-token")
	c.Set("original_model", "gpt-5-codex")
	c.Set("group", "default")
	c.Set("channel_id", 999)
	c.Set("channel_name", "stale-channel")
	c.Set("channel_type", constant.ChannelTypeOpenAI)

	actualChannel := types.NewChannelError(321, constant.ChannelTypeCodex, "actual-channel", false, "", false)
	processChannelError(c, *actualChannel, types.NewOpenAIError(errors.New("upstream rejected request"), types.ErrorCodeBadResponseStatusCode, http.StatusBadRequest))

	var regularCount int64
	require.NoError(t, db.Model(&model.Log{}).Count(&regularCount).Error)
	require.Zero(t, regularCount)
	var companyLog model.CompanyLogSchema
	require.NoError(t, db.Table(companyLog.TableName()).First(&companyLog).Error)
	require.Equal(t, actualChannel.ChannelId, companyLog.ChannelId)
	other, err := common.StrToMap(companyLog.Other)
	require.NoError(t, err)
	require.EqualValues(t, actualChannel.ChannelId, other["channel_id"])
	require.Equal(t, actualChannel.ChannelName, other["channel_name"])
	require.EqualValues(t, actualChannel.ChannelType, other["channel_type"])
}

func TestProcessChannelErrorMarksRedisCooldownWithCanceledRequestContext(t *testing.T) {
	mr := miniredis.RunT(t)
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	t.Cleanup(func() {
		_ = common.RDB.Close()
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
		mr.Close()
	})
	prevErrorLogEnabled := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = false
	t.Cleanup(func() {
		constant.ErrorLogEnabled = prevErrorLogEnabled
	})

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	reqCtx, cancel := context.WithCancel(context.Background())
	cancel()
	c.Request = httptest.NewRequestWithContext(reqCtx, http.MethodPost, "/v1/chat/completions", nil)
	channelID := 909905

	processChannelError(
		c,
		*types.NewChannelError(channelID, constant.ChannelTypeOpenAI, "cooldown", false, "", false),
		types.NewOpenAIError(errors.New("rate limit exceeded"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	)

	loads, err := service.GetChannelConcurrencyLoads(context.Background(), []*model.Channel{{Id: channelID, MaxConcurrency: 1}})
	require.NoError(t, err)
	require.True(t, loads[channelID].CoolingDown)
}

func TestShouldMarkChannelConcurrencyCooldownExcludesQuota429(t *testing.T) {
	require.False(t, shouldMarkChannelConcurrencyCooldown(
		types.NewOpenAIError(errors.New("insufficient_quota: quota exceeded"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	))
	require.False(t, shouldMarkChannelConcurrencyCooldown(
		types.NewOpenAIError(errors.New("账户余额不足"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	))
	require.True(t, shouldMarkChannelConcurrencyCooldown(
		types.NewOpenAIError(errors.New("rate limit exceeded"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	))
	require.True(t, shouldMarkChannelConcurrencyCooldown(
		types.NewOpenAIError(errors.New(""), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	))
}

func TestShouldMarkChannelConcurrencyCooldownRespectsTriggerSwitches(t *testing.T) {
	original := operation_setting.GetChannelConcurrencySetting()
	t.Cleanup(func() {
		operation_setting.SetChannelConcurrencySettingForTest(original)
	})

	status429 := types.NewOpenAIError(errors.New("rate limit exceeded"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests)
	keywordOnly := types.NewOpenAIError(errors.New("upstream overloaded, retry later"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)

	// Defaults: 429 triggers, keyword-only does not.
	setting := original
	setting.CooldownEnabled = true
	setting.CooldownOnStatus429 = true
	setting.CooldownOnMessageMatch = false
	operation_setting.SetChannelConcurrencySettingForTest(setting)
	require.True(t, shouldMarkChannelConcurrencyCooldown(status429))
	require.False(t, shouldMarkChannelConcurrencyCooldown(keywordOnly))

	// Keyword opt-in enables message-based cooldown for non-429 errors.
	setting.CooldownOnMessageMatch = true
	operation_setting.SetChannelConcurrencySettingForTest(setting)
	require.True(t, shouldMarkChannelConcurrencyCooldown(keywordOnly))

	// 429 trigger off: even a real 429 does not cool the channel down.
	setting.CooldownOnStatus429 = false
	setting.CooldownOnMessageMatch = false
	operation_setting.SetChannelConcurrencySettingForTest(setting)
	require.False(t, shouldMarkChannelConcurrencyCooldown(status429))

	// Master switch off overrides every trigger.
	setting.CooldownEnabled = false
	setting.CooldownOnStatus429 = true
	setting.CooldownOnMessageMatch = true
	operation_setting.SetChannelConcurrencySettingForTest(setting)
	require.False(t, shouldMarkChannelConcurrencyCooldown(status429))
	require.False(t, shouldMarkChannelConcurrencyCooldown(keywordOnly))
}

func TestGetChannelSkipsCoolingDownChannel(t *testing.T) {
	restoreRuntime := useControllerMemoryChannelConcurrencyForTest(t)
	defer restoreRuntime()
	restoreDB := useControllerChannelSelectionDBForTest(t)
	defer restoreDB()

	priority := int64(0)
	coolingWeight := uint(1_000_000)
	fallbackWeight := uint(1)
	coolingChannel := &model.Channel{
		Id:             909903,
		Type:           constant.ChannelTypeOpenAI,
		Key:            "sk-cooling",
		Status:         common.ChannelStatusEnabled,
		Name:           "cooling",
		Group:          "default",
		Models:         "gpt-cooldown",
		Priority:       &priority,
		Weight:         &coolingWeight,
		MaxConcurrency: 2,
	}
	fallbackChannel := &model.Channel{
		Id:             909904,
		Type:           constant.ChannelTypeOpenAI,
		Key:            "sk-fallback",
		Status:         common.ChannelStatusEnabled,
		Name:           "fallback",
		Group:          "default",
		Models:         "gpt-cooldown",
		Priority:       &priority,
		Weight:         &fallbackWeight,
		MaxConcurrency: 2,
	}
	require.NoError(t, model.DB.Create(coolingChannel).Error)
	require.NoError(t, coolingChannel.AddAbilities(nil))
	require.NoError(t, model.DB.Create(fallbackChannel).Error)
	require.NoError(t, fallbackChannel.AddAbilities(nil))
	model.InitChannelCache()

	require.NoError(t, service.MarkChannelConcurrencyCooldown(context.Background(), coolingChannel.Id, time.Second, "test cooldown"))

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	retry := 0
	selected, channelErr := getChannel(c, &relaycommon.RelayInfo{
		TokenGroup:      "default",
		OriginModelName: "gpt-cooldown",
		ChannelMeta:     &relaycommon.ChannelMeta{},
	}, &service.RetryParam{
		Ctx:        c,
		TokenGroup: "default",
		ModelName:  "gpt-cooldown",
		Retry:      &retry,
	})
	defer func() {
		require.NoError(t, service.ReleaseChannelConcurrencyForContext(c))
	}()

	require.Nil(t, channelErr)
	require.NotNil(t, selected)
	require.Equal(t, fallbackChannel.Id, selected.Id)
}

func TestGetChannelRetryUsesAssetRankerAndRefreshesRewriteMap(t *testing.T) {
	restoreRuntime := useControllerMemoryChannelConcurrencyForTest(t)
	defer restoreRuntime()
	restoreDB := useControllerAssetChannelSelectionDBForTest(t)
	defer restoreDB()

	lowPriority := int64(1)
	highPriority := int64(100)
	weight := uint(1)
	boundChannel := &model.Channel{
		Id:       909906,
		Type:     constant.ChannelTypeBytePlus,
		Key:      `{"api_key":"sk-bound","access_key_id":"ak","secret_access_key":"sec","project_name":"project"}`,
		Status:   common.ChannelStatusEnabled,
		Name:     "asset-bound",
		Group:    "default",
		Models:   "seedance-2.0",
		Priority: &lowPriority,
		Weight:   &weight,
	}
	ineligibleChannel := &model.Channel{
		Id:       909907,
		Type:     constant.ChannelTypeBytePlus,
		Key:      `{"api_key":"sk-ineligible","access_key_id":"ak","secret_access_key":"sec","project_name":"project"}`,
		Status:   common.ChannelStatusEnabled,
		Name:     "asset-ineligible",
		Group:    "default",
		Models:   "seedance-2.0",
		Priority: &highPriority,
		Weight:   &weight,
	}
	require.NoError(t, model.DB.Create(boundChannel).Error)
	require.NoError(t, boundChannel.AddAbilities(nil))
	require.NoError(t, model.DB.Create(ineligibleChannel).Error)
	require.NoError(t, ineligibleChannel.AddAbilities(nil))
	asset := model.Asset{
		PublicId:     "ast_1234567890abcdefABCDEF1234567890",
		UserId:       7,
		AssetType:    "Image",
		Status:       model.AssetStatusActive,
		SourceStatus: model.AssetSourceStatusUnavailable,
		CreatedAt:    100,
		UpdatedAt:    100,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       boundChannel.Id,
		UpstreamAssetId: "upstream-bound",
		Status:          model.AssetStatusActive,
		CreatedAt:       100,
		UpdatedAt:       100,
	}).Error)
	model.InitChannelCache()

	refs, apiErr := service.ResolveAssetReferences(nil, 7, &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}},
	}})
	require.Nil(t, apiErr)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(c, constant.ContextKeyAssetReferenceSet, refs)
	common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, map[string]string{"asset://" + asset.PublicId: "asset://stale"})
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, map[string]string{"asset://" + asset.PublicId: "asset://stale"})
	retry := 0
	selected, channelErr := getChannel(c, &relaycommon.RelayInfo{
		TokenGroup:      "default",
		OriginModelName: "seedance-2.0",
		ChannelMeta:     &relaycommon.ChannelMeta{},
		PriceData:       types.PriceData{},
	}, &service.RetryParam{
		Ctx:        c,
		TokenGroup: "default",
		ModelName:  "seedance-2.0",
		Retry:      &retry,
	})
	defer func() {
		require.NoError(t, service.ReleaseChannelConcurrencyForContext(c))
	}()

	require.Nil(t, channelErr)
	require.NotNil(t, selected)
	require.Equal(t, boundChannel.Id, selected.Id)
	rewriteMap, ok := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
	require.True(t, ok)
	require.Equal(t, "asset://upstream-bound", rewriteMap["asset://"+asset.PublicId])
	require.NotContains(t, rewriteMap, "asset://stale")
	legacyMap, ok := common.GetContextKeyType[map[string]string](c, constant.ContextKeyBytePlusAssetRewriteMap)
	require.True(t, ok)
	require.Equal(t, rewriteMap, legacyMap)
}

func TestGetChannelRetryMaterializationFailureClearsStaleMapAndReturnsError(t *testing.T) {
	restoreRuntime := useControllerMemoryChannelConcurrencyForTest(t)
	defer restoreRuntime()
	restoreDB := useControllerAssetChannelSelectionDBForTest(t)
	defer restoreDB()
	materializerCalled := false
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, controllerAssetMaterializer{
		createErr: errors.New("BytePlus secret signed=https://signed.example/?X-Goog-Signature=abc"),
		called:    &materializerCalled,
	})
	defer restoreMaterializer()

	priority := int64(100)
	weight := uint(1)
	channel := &model.Channel{
		Id:       909908,
		Type:     constant.ChannelTypeBytePlus,
		Key:      `{"api_key":"sk-recoverable","access_key_id":"ak","secret_access_key":"sec","project_name":"project"}`,
		Status:   common.ChannelStatusEnabled,
		Name:     "asset-recoverable",
		Group:    "default",
		Models:   "seedance-2.0",
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
	asset := model.Asset{
		PublicId:        "ast_1234567890abcdefABCDEF1234567890",
		UserId:          7,
		AssetType:       "Image",
		Status:          model.AssetStatusActive,
		SourceStatus:    model.AssetSourceStatusAvailable,
		StorageBackend:  "gcs",
		StorageBucket:   "bucket",
		ObjectKey:       "assets/ast_1234567890abcdefABCDEF1234567890",
		SourceExpiresAt: time.Now().Add(time.Hour).Unix(),
		CreatedAt:       100,
		UpdatedAt:       100,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	model.InitChannelCache()

	refs, apiErr := service.ResolveAssetReferences(nil, 7, &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}},
	}})
	require.Nil(t, apiErr)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(c, constant.ContextKeyUserId, 7)
	common.SetContextKey(c, constant.ContextKeyAssetMaterializeEnabled, true)
	common.SetContextKey(c, constant.ContextKeyAssetReferenceSet, refs)
	common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, map[string]string{"asset://" + asset.PublicId: "asset://stale"})
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, map[string]string{"asset://" + asset.PublicId: "asset://stale"})
	retry := 0
	selected, channelErr := getChannel(c, &relaycommon.RelayInfo{
		TokenGroup:      "default",
		OriginModelName: "seedance-2.0",
		ChannelMeta:     &relaycommon.ChannelMeta{},
		PriceData:       types.PriceData{},
	}, &service.RetryParam{
		Ctx:        c,
		TokenGroup: "default",
		ModelName:  "seedance-2.0",
		Retry:      &retry,
	})
	require.Nil(t, selected)
	require.NotNil(t, channelErr)
	require.True(t, materializerCalled)
	require.Equal(t, http.StatusServiceUnavailable, channelErr.StatusCode)
	require.Contains(t, channelErr.Error(), "asset channel unavailable")
	require.NotContains(t, channelErr.Error(), "BytePlus")
	require.NotContains(t, channelErr.Error(), "signed.example")
	_, ok := common.GetContextKey(c, constant.ContextKeyAssetRewriteMap)
	require.False(t, ok)
	_, ok = common.GetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap)
	require.False(t, ok)
	require.NoError(t, service.ReleaseChannelConcurrencyForContext(c), "materialization failure must release the selected channel lease")
}

func useControllerMemoryChannelConcurrencyForTest(t *testing.T) func() {
	t.Helper()
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	common.RDB = nil
	common.RedisEnabled = false
	return func() {
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
	}
}

func useControllerAssetChannelSelectionDBForTest(t *testing.T) func() {
	t.Helper()
	prevDB := model.DB
	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	prevUsingSQLite := common.UsingSQLite
	prevUsingMySQL := common.UsingMySQL
	prevUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.Asset{}, &model.AssetBinding{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	return func() {
		model.DB = prevDB
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
		common.UsingSQLite = prevUsingSQLite
		common.UsingMySQL = prevUsingMySQL
		common.UsingPostgreSQL = prevUsingPostgreSQL
	}
}

func useControllerChannelSelectionDBForTest(t *testing.T) func() {
	t.Helper()
	prevDB := model.DB
	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	prevUsingSQLite := common.UsingSQLite
	prevUsingMySQL := common.UsingMySQL
	prevUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	return func() {
		model.DB = prevDB
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
		common.UsingSQLite = prevUsingSQLite
		common.UsingMySQL = prevUsingMySQL
		common.UsingPostgreSQL = prevUsingPostgreSQL
	}
}
