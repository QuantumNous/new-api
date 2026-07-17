package relay

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/openai/image_stream"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupImageHelperAsyncTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.Task{},
		&model.TaskWebhook{},
		&model.ImageBillingReservation{},
		&model.SystemTask{},
		&model.SystemTaskLock{},
	))

	previousDB := model.DB
	previousRedisEnabled := common.RedisEnabled
	previousBatchUpdateEnabled := common.BatchUpdateEnabled
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	model.DB = db
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedisEnabled
		common.BatchUpdateEnabled = previousBatchUpdateEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})

	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "test-access-key")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "test-secret-key")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "test-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")
}

func TestImageHelperSubmitsNonGPTImageAsAsyncWhenExplicitlyDisabled(t *testing.T) {
	setupImageHelperAsyncTestDB(t)

	var upstreamCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		upstreamCalls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer upstream.Close()

	asyncDisabled := false
	request := &dto.ImageRequest{
		Model:          "black-forest-labs/FLUX.1-schnell",
		Prompt:         "a lighthouse in rain",
		Async:          &asyncDisabled,
		ResponseFormat: "b64_json",
		Extra: map[string]json.RawMessage{
			"negative_prompt": json.RawMessage(`"fog"`),
			"batch_size":      json.RawMessage(`2`),
		},
	}
	info := &relaycommon.RelayInfo{
		RequestId:       "request-non-gpt-async-false",
		StartTime:       time.Now(),
		UserId:          17,
		UsingGroup:      "default",
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		RelayFormat:     types.RelayFormatOpenAIImage,
		Request:         request,
		PriceData: types.PriceData{
			FreeModel: true,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 1,
			},
		},
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, constant.ContextKeyChannelId, 73)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeSiliconFlow)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, int64(1700000000))
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
	common.SetContextKey(c, constant.ContextKeyChannelKey, "upstream-test-key")
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{})
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{"seed": 99})
	common.SetContextKey(c, constant.ContextKeyOriginalModel, request.Model)

	apiErr := ImageHelper(c, info)

	require.Nil(t, apiErr)
	assert.Equal(t, http.StatusAccepted, recorder.Code)
	assert.Equal(t, "2", recorder.Header().Get("Retry-After"))
	assert.NotEmpty(t, recorder.Header().Get("Location"))
	assert.True(t, c.GetBool(image_stream.ContextKeyAsyncImageSubmitted))
	assert.Zero(t, upstreamCalls.Load())
	require.NotNil(t, request.Async)
	assert.False(t, *request.Async)

	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusNotStart), task.Status)
	assert.Equal(t, 73, task.ChannelId)

	var checkpoint struct {
		Version         int                                     `json:"version"`
		Executor        string                                  `json:"executor"`
		RequestExtra    map[string]json.RawMessage              `json:"request_extra"`
		PreparedRequest *image_stream.PreparedAsyncImageRequest `json:"prepared_request"`
	}
	require.NoError(t, common.Unmarshal(task.CheckpointData, &checkpoint))
	assert.Equal(t, 4, checkpoint.Version)
	assert.Equal(t, image_stream.AsyncImageExecutorAdaptor, checkpoint.Executor)
	require.NotNil(t, checkpoint.PreparedRequest)
	assert.Equal(t, constant.APITypeSiliconFlow, checkpoint.PreparedRequest.APIType)
	assert.Equal(t, constant.ChannelTypeSiliconFlow, checkpoint.PreparedRequest.ChannelType)
	assert.Equal(t, int64(1700000000), checkpoint.PreparedRequest.ChannelCreateTime)
	assert.True(t, checkpoint.PreparedRequest.ConfigurationStored)
	assert.JSONEq(t, `"fog"`, string(checkpoint.RequestExtra["negative_prompt"]))

	var preparedBody map[string]any
	require.NoError(t, common.Unmarshal(checkpoint.PreparedRequest.Body, &preparedBody))
	assert.Equal(t, request.Model, preparedBody["model"])
	assert.Equal(t, request.Prompt, preparedBody["prompt"])
	assert.Equal(t, "fog", preparedBody["negative_prompt"])
	assert.Equal(t, float64(2), preparedBody["batch_size"])
	assert.Equal(t, float64(99), preparedBody["seed"])
	assert.NotContains(t, preparedBody, "async")
	assert.NotContains(t, preparedBody, "webhook_url")
	assert.NotContains(t, preparedBody, "webhook_secret")
}

func TestImageHelperUsesAdaptorExecutorForGPTImageOnAdvancedCustomChannel(t *testing.T) {
	setupImageHelperAsyncTestDB(t)

	var upstreamCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		upstreamCalls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer upstream.Close()

	request := &dto.ImageRequest{
		Model:  "gpt-image-1",
		Prompt: "a glass observatory above the clouds",
	}
	info := &relaycommon.RelayInfo{
		RequestId:       "request-gpt-image-advanced-custom",
		StartTime:       time.Now(),
		UserId:          19,
		UsingGroup:      "default",
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		RelayFormat:     types.RelayFormatOpenAIImage,
		Request:         request,
		PriceData: types.PriceData{
			FreeModel: true,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 1,
			},
		},
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, constant.ContextKeyChannelId, 74)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeAdvancedCustom)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, int64(1700000002))
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
	common.SetContextKey(c, constant.ContextKeyChannelKey, "advanced-custom-key")
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{
		AdvancedCustom: &dto.AdvancedCustomConfig{
			Routes: []dto.AdvancedCustomRoute{
				{
					IncomingPath: "/v1/images/generations",
					UpstreamPath: upstream.URL + "/custom/images/{model}",
					Converter:    "none",
				},
			},
		},
	})
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{})
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{})
	common.SetContextKey(c, constant.ContextKeyOriginalModel, request.Model)

	apiErr := ImageHelper(c, info)

	require.Nil(t, apiErr)
	assert.Equal(t, http.StatusAccepted, recorder.Code)
	assert.Zero(t, upstreamCalls.Load())

	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	var checkpoint struct {
		Executor        string                                  `json:"executor"`
		PreparedRequest *image_stream.PreparedAsyncImageRequest `json:"prepared_request"`
	}
	require.NoError(t, common.Unmarshal(task.CheckpointData, &checkpoint))
	assert.Equal(t, image_stream.AsyncImageExecutorAdaptor, checkpoint.Executor)
	require.NotNil(t, checkpoint.PreparedRequest)
	assert.Equal(t, constant.APITypeAdvancedCustom, checkpoint.PreparedRequest.APIType)
	assert.Equal(t, constant.ChannelTypeAdvancedCustom, checkpoint.PreparedRequest.ChannelType)
}

func TestImageHelperPersistsMappedModelInOpenAIPassThroughBody(t *testing.T) {
	setupImageHelperAsyncTestDB(t)

	asyncDisabled := false
	request := &dto.ImageRequest{
		Model:          "public-image-model",
		Prompt:         "a copper telescope",
		Async:          &asyncDisabled,
		WebhookURL:     "https://8.8.8.8/image-ready",
		WebhookSecret:  "webhook-test-secret",
		ResponseFormat: "b64_json",
	}
	info := &relaycommon.RelayInfo{
		RequestId:       "request-openai-pass-through-mapped-model",
		StartTime:       time.Now(),
		UserId:          23,
		UsingGroup:      "default",
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		RelayFormat:     types.RelayFormatOpenAIImage,
		Request:         request,
		PriceData: types.PriceData{
			FreeModel: true,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 1,
			},
		},
	}
	rawBody := `{
		"model":"public-image-model",
		"prompt":"a copper telescope",
		"response_format":"b64_json",
		"async":false,
		"webhook_url":"https://8.8.8.8/image-ready",
		"webhook_secret":"webhook-test-secret",
		"provider_option":"preserved"
	}`

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(rawBody))
	c.Request.Header.Set("Content-Type", "application/json")
	defer common.CleanupBodyStorage(c)
	common.SetContextKey(c, constant.ContextKeyChannelId, 75)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, int64(1700000003))
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://openai.example.com")
	common.SetContextKey(c, constant.ContextKeyChannelKey, "openai-pass-through-key")
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: true})
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{})
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{})
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{})
	common.SetContextKey(c, constant.ContextKeyChannelModelMapping, `{"public-image-model":"upstream-image-model"}`)
	common.SetContextKey(c, constant.ContextKeyOriginalModel, request.Model)

	apiErr := ImageHelper(c, info)

	require.Nil(t, apiErr)
	assert.Equal(t, http.StatusAccepted, recorder.Code)

	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	var checkpoint struct {
		Executor        string                                  `json:"executor"`
		PreparedRequest *image_stream.PreparedAsyncImageRequest `json:"prepared_request"`
	}
	require.NoError(t, common.Unmarshal(task.CheckpointData, &checkpoint))
	assert.Equal(t, image_stream.AsyncImageExecutorAdaptor, checkpoint.Executor)
	require.NotNil(t, checkpoint.PreparedRequest)
	assert.Equal(t, constant.APITypeOpenAI, checkpoint.PreparedRequest.APIType)

	var providerBody map[string]any
	require.NoError(t, common.Unmarshal(checkpoint.PreparedRequest.Body, &providerBody))
	assert.Equal(t, "upstream-image-model", providerBody["model"])
	assert.Equal(t, "a copper telescope", providerBody["prompt"])
	assert.Equal(t, "preserved", providerBody["provider_option"])
	assert.NotContains(t, providerBody, "async")
	assert.NotContains(t, providerBody, "webhook_url")
	assert.NotContains(t, providerBody, "webhook_secret")
}

func TestPrepareAsyncImageAdaptorRequestPreservesExtraOverrideAndRecalculatesPrice(t *testing.T) {
	asyncDisabled := false
	request := &dto.ImageRequest{
		Model:          "black-forest-labs/FLUX.1-schnell",
		Prompt:         "a red kite",
		Async:          &asyncDisabled,
		ResponseFormat: "b64_json",
		Extra: map[string]json.RawMessage{
			"negative_prompt": json.RawMessage(`"rain"`),
			"batch_size":      json.RawMessage(`2`),
			"seed":            json.RawMessage(`7`),
		},
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		PriceData: types.PriceData{
			UsePrice:   true,
			ModelPrice: 0.002,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 1.5,
			},
		},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeSiliconFlow,
			ChannelId:         91,
			ChannelBaseUrl:    "https://upstream.example.com",
			ApiType:           constant.APITypeSiliconFlow,
			ApiKey:            "test-key",
			ChannelCreateTime: 1700000001,
			UpstreamModelName: request.Model,
			ParamOverride: map[string]any{
				"seed":       99,
				"batch_size": 3,
			},
		},
	}
	info.PriceData.AddOtherRatio("n", 2)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Request.Header.Set("Content-Type", "application/json; charset=utf-8")
	c.Request.Header.Set("Authorization", "Bearer client-secret")
	c.Request.Header.Set("X-Trace-ID", "trace-123")

	prepared, apiErr := prepareAsyncImageAdaptorRequest(c, info, request)

	require.Nil(t, apiErr)
	require.NotNil(t, prepared)
	assert.Equal(t, constant.APITypeSiliconFlow, prepared.APIType)
	assert.Equal(t, constant.ChannelTypeSiliconFlow, prepared.ChannelType)
	assert.Equal(t, int64(1700000001), prepared.ChannelCreateTime)
	assert.Equal(t, "application/json", prepared.ContentType)
	assert.Equal(t, "trace-123", prepared.ClientHeaders["X-Trace-Id"])
	assert.NotContains(t, prepared.ClientHeaders, "Authorization")
	assert.Equal(t, 4500, info.PriceData.QuotaToPreConsume)

	var body map[string]any
	require.NoError(t, common.Unmarshal(prepared.Body, &body))
	assert.Equal(t, request.Model, body["model"])
	assert.Equal(t, request.Prompt, body["prompt"])
	assert.Equal(t, "rain", body["negative_prompt"])
	assert.Equal(t, float64(3), body["batch_size"])
	assert.Equal(t, float64(99), body["seed"])
	assert.NotContains(t, body, "async")
	assert.NotContains(t, body, "webhook_url")
	assert.NotContains(t, body, "webhook_secret")
	require.NotNil(t, request.Async)
	assert.False(t, *request.Async)
	assert.Equal(t, "b64_json", request.ResponseFormat)
	assert.JSONEq(t, `7`, string(request.Extra["seed"]))

	invalidInfo := *info
	invalidMeta := *info.ChannelMeta
	invalidMeta.ParamOverride = map[string]any{"batch_size": dto.MaxImageN + 1}
	invalidInfo.ChannelMeta = &invalidMeta
	_, apiErr = prepareAsyncImageAdaptorRequest(c, &invalidInfo, request)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Contains(t, apiErr.Error(), "batch_size must be an integer between 1")
}
