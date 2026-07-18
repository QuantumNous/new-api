package relay

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
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
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type imageHandlerRoundTripFunc func(*http.Request) (*http.Response, error)

func (fn imageHandlerRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func setupImageHelperAsyncTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Token{},
		&model.UserSubscription{},
		&model.Task{},
		&model.TaskWebhook{},
		&model.ImageBillingReservation{},
		&model.ImageInputCleanup{},
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
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "test-input-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")
	t.Setenv("CRYPTO_SECRET", "test-crypto-secret")
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "true")
}

func decryptStoredImageHandlerCheckpoint(t *testing.T, checkpoint json.RawMessage) []byte {
	t.Helper()
	plaintext, err := model.DecryptImageTaskArtifactCheckpoint(checkpoint)
	require.NoError(t, err)
	return plaintext
}

func TestValidateAsyncImageProviderCapabilitiesRejectsUnsupportedCombinations(t *testing.T) {
	two := uint(2)
	fourImages := json.RawMessage(`[
		"https://example.com/1.png", "https://example.com/2.png",
		"https://example.com/3.png", "https://example.com/4.png"
	]`)
	tests := []struct {
		name    string
		info    *relaycommon.RelayInfo
		request *dto.ImageRequest
		message string
	}{
		{
			name: "imagen reference input",
			info: &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
				ApiType: constant.APITypeGemini, UpstreamModelName: "imagen-4.0-generate-001",
			}},
			request: &dto.ImageRequest{Model: "imagen-4.0-generate-001", Images: json.RawMessage(`["https://example.com/reference.png"]`)},
			message: "Imagen models do not support",
		},
		{
			name: "replicate reference input",
			info: &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
				ApiType: constant.APITypeReplicate, UpstreamModelName: "black-forest-labs/flux",
			}},
			request: &dto.ImageRequest{Model: "black-forest-labs/flux", Images: json.RawMessage(`["https://example.com/reference.png"]`)},
			message: "does not support unified image inputs",
		},
		{
			name: "siliconflow too many reference inputs",
			info: &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
				ApiType: constant.APITypeSiliconFlow, UpstreamModelName: "image-model",
			}},
			request: &dto.ImageRequest{Model: "image-model", Images: fourImages},
			message: "at most 3",
		},
		{
			name: "jimeng batch count",
			info: &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
				ApiType: constant.APITypeJimeng, UpstreamModelName: "jimeng_high_aes_general_v21_L",
			}},
			request: &dto.ImageRequest{Model: "jimeng_high_aes_general_v21_L", N: &two},
			message: "supports only n=1",
		},
		{
			name: "gemini output format",
			info: &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
				ApiType: constant.APITypeGemini, UpstreamModelName: "gemini-3.1-flash-image",
			}},
			request: &dto.ImageRequest{Model: "gemini-3.1-flash-image", OutputFormat: json.RawMessage(`"jpeg"`)},
			message: "use png",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateAsyncImageProviderCapabilities(nil, test.info, test.request)
			require.Error(t, err)
			assert.Contains(t, err.Error(), test.message)
		})
	}
}

func TestImageHelperRejectsUnsupportedReplicateEditInputsBeforeTaskSubmission(t *testing.T) {
	for _, test := range []struct {
		name    string
		request *dto.ImageRequest
		message string
	}{
		{
			name: "multiple images",
			request: &dto.ImageRequest{
				Model:  "black-forest-labs/flux-kontext-pro",
				Prompt: "edit both images",
				Images: json.RawMessage(`["https://example.com/one.png","https://example.com/two.png"]`),
			},
			message: "only one input image",
		},
		{
			name: "mask",
			request: &dto.ImageRequest{
				Model:  "black-forest-labs/flux-kontext-pro",
				Prompt: "edit inside the mask",
				Images: json.RawMessage(`["https://example.com/one.png"]`),
				Mask:   json.RawMessage(`"https://example.com/mask.png"`),
			},
			message: "do not support masks",
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			setupImageHelperAsyncTestDB(t)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", nil)
			common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeReplicate)
			common.SetContextKey(c, constant.ContextKeyOriginalModel, test.request.Model)
			common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
			common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{})

			apiErr := ImageHelper(c, &relaycommon.RelayInfo{
				RequestId:       "replicate-rejected-" + test.name,
				UserId:          1,
				OriginModelName: test.request.Model,
				RelayMode:       relayconstant.RelayModeImagesEdits,
				RequestURLPath:  "/v1/images/edits",
				Request:         test.request,
				PriceData:       types.PriceData{QuotaToPreConsume: 100},
			})

			require.NotNil(t, apiErr)
			assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
			assert.Contains(t, apiErr.Error(), test.message)
			var taskCount int64
			require.NoError(t, model.DB.Model(&model.Task{}).Count(&taskCount).Error)
			assert.Zero(t, taskCount, "unsupported Replicate edit inputs must fail before task creation and quota reservation")
		})
	}
}

func TestImageHelperRejectsParamOverrideForAsyncImageEdits(t *testing.T) {
	setupImageHelperAsyncTestDB(t)
	request := &dto.ImageRequest{
		Model:  "openai-compatible-image-edit",
		Prompt: "restyle",
		Images: json.RawMessage(`["https://example.com/reference.png"]`),
	}
	info := &relaycommon.RelayInfo{
		UserId:          1,
		RelayMode:       relayconstant.RelayModeImagesEdits,
		OriginModelName: request.Model,
		Request:         request,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType:           constant.APITypeOpenAI,
			ChannelType:       constant.ChannelTypeOpenAI,
			UpstreamModelName: request.Model,
			ParamOverride:     map[string]any{"quality": "high"},
		},
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", nil)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{"quality": "high"})
	common.SetContextKey(c, constant.ContextKeyOriginalModel, request.Model)

	apiErr := ImageHelper(c, info)

	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeChannelParamOverrideInvalid, apiErr.GetErrorCode())
	assert.Contains(t, apiErr.Error(), "parameter override is not supported")
}

func TestImageEditAliasesSubmitMultipartAsDurableAsyncTasks(t *testing.T) {
	for _, testCase := range []struct {
		name             string
		path             string
		withMask         bool
		expectedExecutor string
	}{
		{name: "canonical without mask", path: "/v1/images/edits", expectedExecutor: image_stream.AsyncImageExecutorResponses},
		{name: "alias without mask", path: "/v1/edits", expectedExecutor: image_stream.AsyncImageExecutorResponses},
		{name: "canonical with mask", path: "/v1/images/edits", withMask: true, expectedExecutor: image_stream.AsyncImageExecutorAdaptor},
		{name: "alias with mask", path: "/v1/edits", withMask: true, expectedExecutor: image_stream.AsyncImageExecutorAdaptor},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			setupImageHelperAsyncTestDB(t)

			var upstreamCalls atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				upstreamCalls.Add(1)
				w.WriteHeader(http.StatusInternalServerError)
			}))
			defer upstream.Close()

			previousTransport := http.DefaultClient.Transport
			http.DefaultClient.Transport = imageHandlerRoundTripFunc(func(request *http.Request) (*http.Response, error) {
				require.Equal(t, http.MethodPut, request.Method)
				require.Contains(t, request.URL.Host, ".r2.cloudflarestorage.com")
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     make(http.Header),
					Body:       io.NopCloser(strings.NewReader("")),
					Request:    request,
				}, nil
			})
			t.Cleanup(func() { http.DefaultClient.Transport = previousTransport })

			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			require.NoError(t, writer.WriteField("model", "gpt-image-1"))
			require.NoError(t, writer.WriteField("prompt", "turn the subject blue"))
			require.NoError(t, writer.WriteField("async", "false"))
			part, err := writer.CreateFormFile("image", "source.png")
			require.NoError(t, err)
			_, err = part.Write([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x01, 0x02})
			require.NoError(t, err)
			if testCase.withMask {
				maskPart, createErr := writer.CreateFormFile("mask", "mask.png")
				require.NoError(t, createErr)
				_, createErr = maskPart.Write([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x03, 0x04})
				require.NoError(t, createErr)
			}
			require.NoError(t, writer.Close())

			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, testCase.path, &body)
			c.Request.Header.Set("Content-Type", writer.FormDataContentType())
			t.Cleanup(func() { common.CleanupBodyStorage(c) })
			request, err := relayhelper.GetAndValidOpenAIImageRequest(c, relayconstant.Path2RelayMode(testCase.path))
			require.NoError(t, err)
			if c.Request.MultipartForm != nil {
				defer c.Request.MultipartForm.RemoveAll()
			}

			info := &relaycommon.RelayInfo{
				RequestId:       "edit-" + strings.ReplaceAll(testCase.path, "/", "-") + "-" + testCase.name,
				StartTime:       time.Now(),
				UserId:          41,
				UsingGroup:      "default",
				OriginModelName: request.Model,
				RequestURLPath:  testCase.path,
				RelayMode:       relayconstant.Path2RelayMode(testCase.path),
				RelayFormat:     types.RelayFormatOpenAIImage,
				Request:         request,
				PriceData: types.PriceData{FreeModel: true, GroupRatioInfo: types.GroupRatioInfo{
					GroupRatio: 1,
				}},
			}
			common.SetContextKey(c, constant.ContextKeyChannelId, 91)
			common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
			common.SetContextKey(c, constant.ContextKeyChannelCreateTime, int64(1700000200))
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
			common.SetContextKey(c, constant.ContextKeyChannelKey, "edit-upstream-key")
			common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
			common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{})
			common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{})
			common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{})
			common.SetContextKey(c, constant.ContextKeyOriginalModel, request.Model)

			apiErr := ImageHelper(c, info)

			require.Nil(t, apiErr)
			assert.Equal(t, http.StatusAccepted, recorder.Code)
			assert.Zero(t, upstreamCalls.Load())
			assert.True(t, c.GetBool(image_stream.ContextKeyAsyncImageSubmitted))
			var task model.Task
			require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
			assert.Equal(t, "/v1/images/generations/"+task.TaskID, recorder.Header().Get("Location"))
			var checkpoint struct {
				Executor        string                                  `json:"executor"`
				RelayMode       int                                     `json:"relay_mode"`
				InputObjectKeys []string                                `json:"input_object_keys"`
				MaskObjectKey   string                                  `json:"mask_object_key"`
				PreparedRequest *image_stream.PreparedAsyncImageRequest `json:"prepared_request"`
			}
			require.NoError(t, common.Unmarshal(decryptStoredImageHandlerCheckpoint(t, task.CheckpointData), &checkpoint))
			assert.Equal(t, testCase.expectedExecutor, checkpoint.Executor)
			assert.Equal(t, relayconstant.RelayModeImagesEdits, checkpoint.RelayMode)
			require.Len(t, checkpoint.InputObjectKeys, 1)
			if testCase.withMask {
				assert.NotEmpty(t, checkpoint.MaskObjectKey)
				require.NotNil(t, checkpoint.PreparedRequest)
				assert.Equal(t, "/v1/images/edits", checkpoint.PreparedRequest.RequestURLPath)
			} else {
				assert.Empty(t, checkpoint.MaskObjectKey)
				assert.Nil(t, checkpoint.PreparedRequest)
			}
			assert.NotContains(t, string(task.CheckpointData), "turn the subject blue")
		})
	}
}

func TestImageHelperUsesAdaptorForGPTBatchWhenParamOverrideDisablesResponsesExecutor(t *testing.T) {
	setupImageHelperAsyncTestDB(t)
	two := uint(2)
	request := &dto.ImageRequest{Model: "gpt-image-2", Prompt: "two observatories", N: &two}
	info := &relaycommon.RelayInfo{
		RequestId:       "request-gpt-image-param-override-batch",
		StartTime:       time.Now(),
		UserId:          31,
		UsingGroup:      "default",
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		RelayFormat:     types.RelayFormatOpenAIImage,
		Request:         request,
		PriceData: types.PriceData{FreeModel: true, GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio: 1,
		}},
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, constant.ContextKeyChannelId, 81)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, int64(1700000008))
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://openai.example.com")
	common.SetContextKey(c, constant.ContextKeyChannelKey, "openai-param-override-key")
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{})
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{"seed": 99})
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{})
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
	require.NoError(t, common.Unmarshal(decryptStoredImageHandlerCheckpoint(t, task.CheckpointData), &checkpoint))
	assert.Equal(t, image_stream.AsyncImageExecutorAdaptor, checkpoint.Executor)
	require.NotNil(t, checkpoint.PreparedRequest)
	var providerBody map[string]any
	require.NoError(t, common.Unmarshal(checkpoint.PreparedRequest.Body, &providerBody))
	assert.Equal(t, float64(2), providerBody["n"])
}

func TestImageHelperRejectsGPTBatchAfterModelMapping(t *testing.T) {
	setupImageHelperAsyncTestDB(t)
	two := uint(2)
	request := &dto.ImageRequest{Model: "gpt-image-2", Prompt: "two observatories", N: &two}
	info := &relaycommon.RelayInfo{
		RequestId:       "request-gpt-image-mapped-batch",
		StartTime:       time.Now(),
		UserId:          32,
		UsingGroup:      "default",
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		RelayFormat:     types.RelayFormatOpenAIImage,
		Request:         request,
		PriceData: types.PriceData{FreeModel: true, GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio: 1,
		}},
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("model_mapping", `{"gpt-image-2":"vendor-image-v2"}`)
	common.SetContextKey(c, constant.ContextKeyChannelId, 82)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, int64(1700000009))
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://openai.example.com")
	common.SetContextKey(c, constant.ContextKeyChannelKey, "openai-mapped-model-key")
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{})
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{})
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{})
	common.SetContextKey(c, constant.ContextKeyOriginalModel, request.Model)

	apiErr := ImageHelper(c, info)

	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Contains(t, apiErr.Error(), "supports only n=1")
	assert.Equal(t, "gpt-image-2", info.OriginModelName)
	assert.Equal(t, "vendor-image-v2", info.UpstreamModelName)
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
	require.NoError(t, common.Unmarshal(decryptStoredImageHandlerCheckpoint(t, task.CheckpointData), &checkpoint))
	assert.Equal(t, 6, checkpoint.Version)
	assert.Equal(t, image_stream.AsyncImageExecutorAdaptor, checkpoint.Executor)
	require.NotNil(t, checkpoint.PreparedRequest)
	assert.Equal(t, constant.APITypeSiliconFlow, checkpoint.PreparedRequest.APIType)
	assert.Equal(t, constant.ChannelTypeSiliconFlow, checkpoint.PreparedRequest.ChannelType)
	assert.Equal(t, int64(1700000000), checkpoint.PreparedRequest.ChannelCreateTime)
	assert.True(t, checkpoint.PreparedRequest.ConfigurationStored)
	assert.Empty(t, checkpoint.PreparedRequest.ParamOverride)
	assert.JSONEq(t, `"fog"`, string(checkpoint.RequestExtra["negative_prompt"]))

	var preparedBody map[string]any
	require.NoError(t, common.Unmarshal(checkpoint.PreparedRequest.Body, &preparedBody))
	assert.Equal(t, request.Model, preparedBody["model"])
	assert.Equal(t, request.Prompt, preparedBody["prompt"])
	assert.Equal(t, "fog", preparedBody["negative_prompt"])
	assert.Equal(t, float64(2), preparedBody["batch_size"])
	assert.NotContains(t, preparedBody, "seed")
	assert.NotContains(t, string(task.CheckpointData), `"seed":99`)
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
					UpstreamPath: upstream.URL + "/hooks/path-bearer-secret/images/{model}",
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
	require.NoError(t, common.Unmarshal(decryptStoredImageHandlerCheckpoint(t, task.CheckpointData), &checkpoint))
	assert.Equal(t, image_stream.AsyncImageExecutorAdaptor, checkpoint.Executor)
	require.NotNil(t, checkpoint.PreparedRequest)
	assert.Equal(t, constant.APITypeAdvancedCustom, checkpoint.PreparedRequest.APIType)
	assert.Equal(t, constant.ChannelTypeAdvancedCustom, checkpoint.PreparedRequest.ChannelType)
	assert.NotEmpty(t, checkpoint.PreparedRequest.AdvancedRouteHash)
	assert.Nil(t, checkpoint.PreparedRequest.AdvancedRoute)
	assert.NotContains(t, string(task.CheckpointData), "path-bearer-secret")
}

func TestImageHelperUsesResponsesExecutorForUnifiedGPTEvenWithPassThrough(t *testing.T) {
	setupImageHelperAsyncTestDB(t)

	request := &dto.ImageRequest{}
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"gpt-image-2",
		"input":{"prompt":"a brass telescope under the stars","aspect_ratio":"16:9","resolution":"2K"}
	}`), request))
	require.True(t, request.HasUnifiedImageInput())

	info := &relaycommon.RelayInfo{
		RequestId:       "request-unified-gpt-pass-through",
		StartTime:       time.Now(),
		UserId:          21,
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
	common.SetContextKey(c, constant.ContextKeyChannelId, 76)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, int64(1700000004))
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://openai.example.com")
	common.SetContextKey(c, constant.ContextKeyChannelKey, "openai-pass-through-key")
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: true})
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{})
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{})
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{})
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
	require.NoError(t, common.Unmarshal(decryptStoredImageHandlerCheckpoint(t, task.CheckpointData), &checkpoint))
	assert.Equal(t, image_stream.AsyncImageExecutorResponses, checkpoint.Executor)
	assert.Nil(t, checkpoint.PreparedRequest)
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
	require.NoError(t, common.Unmarshal(decryptStoredImageHandlerCheckpoint(t, task.CheckpointData), &checkpoint))
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

func TestPrepareAsyncImageAdaptorRequestDoesNotPersistRawImagePassThrough(t *testing.T) {
	request := &dto.ImageRequest{
		Model:  "image-model",
		Prompt: "restyle this image",
		Images: json.RawMessage(`["https://cdn.example.com/images/stored.png"]`),
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			ChannelBaseUrl:    "https://openai.example.com",
			ApiType:           constant.APITypeOpenAI,
			ApiKey:            "test-key",
			UpstreamModelName: request.Model,
			ChannelSetting: dto.ChannelSettings{
				PassThroughBodyEnabled: true,
			},
		},
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{
		"model":"image-model",
		"prompt":"restyle this image",
		"images":["data:image/png;base64,raw-client-payload"]
	}`))
	c.Request.Header.Set("Content-Type", "application/json")

	prepared, apiErr := prepareAsyncImageAdaptorRequest(c, info, request, false)

	require.Nil(t, apiErr)
	require.NotNil(t, prepared)
	assert.NotContains(t, string(prepared.Body), "raw-client-payload")
	assert.Contains(t, string(prepared.Body), "https://cdn.example.com/images/stored.png")
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
		RequestURLPath:  "/v1/images/generations?api_key=query-secret#fragment",
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
	c.Request.Header.Set("Cf-Access-Jwt-Assertion", "infrastructure-secret")

	prepared, apiErr := prepareAsyncImageAdaptorRequest(c, info, request, true)

	require.Nil(t, apiErr)
	require.NotNil(t, prepared)
	assert.Equal(t, constant.APITypeSiliconFlow, prepared.APIType)
	assert.Equal(t, constant.ChannelTypeSiliconFlow, prepared.ChannelType)
	assert.Equal(t, int64(1700000001), prepared.ChannelCreateTime)
	assert.Equal(t, "/v1/images/generations", prepared.RequestURLPath)
	assert.Equal(t, "application/json", prepared.ContentType)
	assert.Equal(t, "trace-123", prepared.ClientHeaders["X-Trace-Id"])
	assert.NotContains(t, prepared.ClientHeaders, "Authorization")
	assert.NotContains(t, prepared.ClientHeaders, "Cf-Access-Jwt-Assertion")
	preparedJSON, err := common.Marshal(prepared)
	require.NoError(t, err)
	assert.NotContains(t, string(preparedJSON), "query-secret")
	assert.Equal(t, 4500, info.PriceData.QuotaToPreConsume)

	var body map[string]any
	require.NoError(t, common.Unmarshal(prepared.Body, &body))
	assert.Equal(t, request.Model, body["model"])
	assert.Equal(t, request.Prompt, body["prompt"])
	assert.Equal(t, "rain", body["negative_prompt"])
	assert.Equal(t, float64(2), body["batch_size"])
	assert.Equal(t, float64(7), body["seed"])
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
	_, apiErr = prepareAsyncImageAdaptorRequest(c, &invalidInfo, request, true)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Contains(t, apiErr.Error(), "batch_size must be an integer between 1")

	pricingDriftInfo := *info
	pricingDriftMeta := *info.ChannelMeta
	pricingDriftMeta.ParamOverride = map[string]any{"size": "2048x2048"}
	pricingDriftInfo.ChannelMeta = &pricingDriftMeta
	_, apiErr = prepareAsyncImageAdaptorRequest(c, &pricingDriftInfo, request, true)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Contains(t, apiErr.Error(), "cannot change model, size")
}

func TestPrepareAsyncImageAdaptorRequestPricesPassThroughAfterOverride(t *testing.T) {
	request := &dto.ImageRequest{Model: "openai-compatible-image", Prompt: "a red kite"}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		PriceData: types.PriceData{
			UsePrice:   true,
			ModelPrice: 0.002,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 1,
			},
		},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			ChannelBaseUrl:    "https://openai.example.com",
			ApiType:           constant.APITypeOpenAI,
			ApiKey:            "test-key",
			UpstreamModelName: request.Model,
			ParamOverride:     map[string]any{"n": 3},
			ChannelSetting:    dto.ChannelSettings{PassThroughBodyEnabled: true},
		},
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{"model":"openai-compatible-image","prompt":"a red kite","n":1}`))
	c.Request.Header.Set("Content-Type", "application/json")

	prepared, apiErr := prepareAsyncImageAdaptorRequest(c, info, request, true)

	require.Nil(t, apiErr)
	require.NotNil(t, prepared)
	assert.Equal(t, 3000, info.PriceData.QuotaToPreConsume)
	assert.Equal(t, 3.0, info.PriceData.OtherRatios()["n"])
	assert.True(t, prepared.ExecutionOverrideStored)
	assert.NotEmpty(t, prepared.ExecutionOverrideHash)
	var persisted map[string]any
	require.NoError(t, common.Unmarshal(prepared.Body, &persisted))
	assert.Equal(t, float64(1), persisted["n"])
}

func TestValidateAsyncImagePricingFieldsRejectsPromptExtendDrift(t *testing.T) {
	err := validateAsyncImagePricingFieldsUnchanged(
		[]byte(`{"parameters":{"prompt_extend":false}}`),
		[]byte(`{"parameters":{"prompt_extend":true}}`),
	)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot change model, size")
}

func TestPrepareAsyncImageAdaptorRequestPreservesUnifiedOpenAIExtra(t *testing.T) {
	request := &dto.ImageRequest{
		Model:  "openai-compatible-image",
		Prompt: "a red kite",
		Extra: map[string]json.RawMessage{
			"seed":            json.RawMessage(`7`),
			"negative_prompt": json.RawMessage(`"rain"`),
		},
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			ChannelBaseUrl:    "https://openai.example.com",
			ApiType:           constant.APITypeOpenAI,
			ApiKey:            "test-key",
			UpstreamModelName: request.Model,
		},
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Request.Header.Set("Content-Type", "application/json")

	prepared, apiErr := prepareAsyncImageAdaptorRequest(c, info, request, false)

	require.Nil(t, apiErr)
	require.NotNil(t, prepared)
	var body map[string]any
	require.NoError(t, common.Unmarshal(prepared.Body, &body))
	assert.Equal(t, float64(7), body["seed"])
	assert.Equal(t, "rain", body["negative_prompt"])
}

func TestPrepareAsyncImageAdaptorRequestDefersNativeGeminiReferenceImages(t *testing.T) {
	request := &dto.ImageRequest{
		Model:  "nano-banana-2",
		Prompt: "turn this into a poster",
		Images: json.RawMessage(`["https://cdn.example.com/images/input.png"]`),
		Extra: map[string]json.RawMessage{
			"aspect_ratio": json.RawMessage(`"16:9"`),
			"resolution":   json.RawMessage(`"2K"`),
		},
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeGemini,
			ChannelId:         92,
			ChannelBaseUrl:    "https://generativelanguage.googleapis.com",
			ApiType:           constant.APITypeGemini,
			ApiKey:            "test-key",
			ChannelCreateTime: 1700000002,
			UpstreamModelName: request.Model,
		},
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Request.Header.Set("Content-Type", "application/json")

	prepared, apiErr := prepareAsyncImageAdaptorRequest(c, info, request, true)

	require.Nil(t, apiErr)
	require.NotNil(t, prepared)
	assert.True(t, prepared.DeferConversion)
	assert.Empty(t, prepared.Body)
	assert.Equal(t, constant.APITypeGemini, prepared.APIType)
	assert.Equal(t, constant.ChannelTypeGemini, prepared.ChannelType)

	encoded, err := common.Marshal(prepared)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "inlineData")
	assert.NotContains(t, string(encoded), "base64")
}
