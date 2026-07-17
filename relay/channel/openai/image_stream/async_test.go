package image_stream

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type asyncImageRoundTripFunc func(*http.Request) (*http.Response, error)

func (fn asyncImageRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func setupAsyncImageSubmitTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Token{},
		&model.Task{},
		&model.TaskWebhook{},
		&model.ImageBillingReservation{},
		&model.ImageTaskBillingLogOutbox{},
		&model.ImageTaskBillingLogReceipt{},
		&model.SystemTask{},
		&model.SystemTaskLock{},
	))

	previousDB := model.DB
	previousRedisEnabled := common.RedisEnabled
	previousBatchUpdateEnabled := common.BatchUpdateEnabled
	model.DB = db
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedisEnabled
		common.BatchUpdateEnabled = previousBatchUpdateEnabled
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

func newAsyncImageSubmitRelayInfo(user *model.User, token *model.Token, quota int) *relaycommon.RelayInfo {
	request := &dto.ImageRequest{Model: "gpt-image-2", Prompt: "a lighthouse in rain"}
	return &relaycommon.RelayInfo{
		RequestId:       "request-async-image-submit",
		UserId:          user.Id,
		TokenId:         token.Id,
		TokenKey:        token.Key,
		UsingGroup:      "default",
		OriginModelName: request.Model,
		ForcePreConsume: true,
		Request:         request,
		PriceData:       types.PriceData{QuotaToPreConsume: quota},
		UserSetting:     dto.UserSetting{BillingPreference: "wallet_only"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			ChannelId:         7,
			ChannelBaseUrl:    "https://submitted.example.com",
			ApiKey:            "upstream-key",
			ChannelCreateTime: 1700000000,
			ChannelSetting:    dto.ChannelSettings{Proxy: "http://submitted-proxy.example.com"},
			UpstreamModelName: request.Model,
		},
	}
}

func seedAsyncImageSubmitIdentity(t *testing.T) (*model.User, *model.Token) {
	t.Helper()
	user := &model.User{
		Username: "async-image-submit-user",
		Password: "password",
		Quota:    1000,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, model.DB.Create(user).Error)
	token := &model.Token{
		UserId:      user.Id,
		Key:         "async-image-submit-token",
		Name:        "async image submit token",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 1000,
	}
	require.NoError(t, model.DB.Create(token).Error)
	return user, token
}

func TestSubmitAsyncImageActivatesOnlyAfterDurableBillingReservation(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	user, token := seedAsyncImageSubmitIdentity(t)
	info := newAsyncImageSubmitRelayInfo(user, token, 120)
	info.ChannelMeta.ChannelType = constant.ChannelTypeGemini
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	apiErr := SubmitAsyncImage(c, info, info.Request.(*dto.ImageRequest))
	require.Nil(t, apiErr)
	assert.Equal(t, http.StatusAccepted, recorder.Code)
	assert.Equal(t, "2", recorder.Header().Get("Retry-After"))

	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusNotStart), task.Status)
	assert.Equal(t, 120, task.Quota)
	assert.Equal(t, 120, task.PrivateData.TokenPreConsumed)
	assert.Equal(t, "wallet", task.PrivateData.BillingSource)
	assert.Empty(t, task.PrivateData.Key)
	assert.Equal(t, common.GenerateHMAC(info.ApiKey), task.PrivateData.ChannelKeyHash)
	var payload asyncImageTaskPayload
	require.NoError(t, common.Unmarshal(task.CheckpointData, &payload))
	assert.Equal(t, asyncImagePayloadVersion, payload.Version)
	assert.Empty(t, payload.ChannelBaseURL)
	assert.Empty(t, payload.ChannelProxy)
	assert.Equal(t, constant.ChannelTypeGemini, payload.ChannelType)
	assert.Equal(t, int64(1700000000), payload.ChannelCreateTime)

	reservation, err := model.GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.ImageBillingReservationActive, reservation.Status)
	assert.Equal(t, 120, reservation.WalletReserved)
	assert.Equal(t, 120, reservation.TokenReserved)
	require.NoError(t, model.DB.First(user, user.Id).Error)
	assert.Equal(t, 880, user.Quota)
	require.NoError(t, model.DB.First(token, token.Id).Error)
	assert.Equal(t, 880, token.RemainQuota)
	assert.Equal(t, 120, token.UsedQuota)
}

func TestSubmitAsyncImageInsufficientQuotaTerminalizesPreparedTask(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	user, token := seedAsyncImageSubmitIdentity(t)
	info := newAsyncImageSubmitRelayInfo(user, token, 1200)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	apiErr := SubmitAsyncImage(c, info, info.Request.(*dto.ImageRequest))
	require.NotNil(t, apiErr)

	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusFailure), task.Status)
	assert.Equal(t, "100%", task.Progress)
	reservation, err := model.GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.ImageBillingReservationRefunded, reservation.Status)
	require.NoError(t, model.DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, model.DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}

func TestSubmitAsyncImageDoesNotPersistChannelEgressSecrets(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	user, token := seedAsyncImageSubmitIdentity(t)
	info := newAsyncImageSubmitRelayInfo(user, token, 120)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	apiErr := SubmitAsyncImage(c, info, info.Request.(*dto.ImageRequest), &PreparedAsyncImageRequest{
		Body:                []byte(`{"model":"gpt-image-2","prompt":"a lighthouse in rain"}`),
		ContentType:         "application/json",
		RequestURLPath:      "/v1/images/generations",
		ChannelBaseURL:      "https://base-user:base-secret@submitted.example.com",
		APIType:             constant.APITypeOpenAI,
		ChannelType:         constant.ChannelTypeOpenAI,
		ChannelCreateTime:   1700000000,
		ConfigurationStored: true,
		HeadersOverride: map[string]interface{}{
			"Authorization": "Bearer header-secret",
			"X-Trace-Mode":  "submitted",
		},
		ChannelSetting: &dto.ChannelSettings{Proxy: "http://proxy-user:proxy-secret@proxy.example.com"},
		ChannelOtherSettings: &dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{
			Routes: []dto.AdvancedCustomRoute{{IncomingPath: "/v1/images/generations", UpstreamPath: "/images"}},
		}},
		AdvancedRoute: &dto.AdvancedCustomRoute{
			IncomingPath: "/v1/images/generations",
			UpstreamPath: "/images",
			Auth: &dto.AdvancedCustomRouteAuth{
				Type:  dto.AdvancedCustomAuthTypeHeader,
				Name:  "X-Provider-Token",
				Value: "route-secret",
			},
		},
	})
	require.Nil(t, apiErr)

	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	var payload asyncImageTaskPayload
	require.NoError(t, common.Unmarshal(task.CheckpointData, &payload))
	require.NotNil(t, payload.PreparedRequest)
	assert.Empty(t, payload.PreparedRequest.ChannelBaseURL)
	assert.Equal(t, map[string]interface{}{"X-Trace-Mode": "submitted"}, payload.PreparedRequest.HeadersOverride)
	require.NotNil(t, payload.PreparedRequest.ChannelSetting)
	assert.Empty(t, payload.PreparedRequest.ChannelSetting.Proxy)
	require.NotNil(t, payload.PreparedRequest.ChannelOtherSettings)
	assert.Nil(t, payload.PreparedRequest.ChannelOtherSettings.AdvancedCustom)
	require.NotNil(t, payload.PreparedRequest.AdvancedRoute)
	assert.Nil(t, payload.PreparedRequest.AdvancedRoute.Auth)

	checkpoint := string(task.CheckpointData)
	assert.NotContains(t, checkpoint, "base-secret")
	assert.NotContains(t, checkpoint, "header-secret")
	assert.NotContains(t, checkpoint, "proxy-secret")
	assert.NotContains(t, checkpoint, "route-secret")
	privateData, err := common.Marshal(task.PrivateData)
	require.NoError(t, err)
	assert.NotContains(t, string(privateData), info.ApiKey)
}

func TestAsyncImageAdaptorRetryUsesMaterializedArtifactAfterProviderURLExpires(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.ImageTaskArtifactChunk{}))

	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = previousMemoryCacheEnabled })

	fetchSetting := system_setting.GetFetchSetting()
	previousFetchSetting := *fetchSetting
	fetchSetting.EnableSSRFProtection = false
	t.Cleanup(func() { *fetchSetting = previousFetchSetting })

	// Cancel the worker on its first R2 request. This models a process exit at the
	// crash boundary after the durable artifact commit and before R2 delivery.
	previousDefaultTransport := http.DefaultClient.Transport
	var cancelWorker context.CancelFunc
	http.DefaultClient.Transport = asyncImageRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		assert.Equal(t, http.MethodPut, request.Method)
		cancelWorker()
		return nil, errors.New("forced R2 transport failure")
	})
	t.Cleanup(func() { http.DefaultClient.Transport = previousDefaultTransport })

	imageBytes := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x01, 0x02, 0x03}
	var providerURLRequests atomic.Int32
	providerServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if providerURLRequests.Add(1) > 1 {
			w.WriteHeader(http.StatusGone)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		_, err := w.Write(imageBytes)
		require.NoError(t, err)
	}))
	defer providerServer.Close()
	previousImageSourceClient := getGenericImageSourceClient
	getGenericImageSourceClient = func() genericImageHTTPClient { return providerServer.Client() }
	t.Cleanup(func() { getGenericImageSourceClient = previousImageSourceClient })

	var executorCalls atomic.Int32
	genericImageExecutorRegistry.Lock()
	previousExecutor := genericImageExecutorRegistry.executor
	genericImageExecutorRegistry.executor = func(_ context.Context, _ *GenericImageExecutionRequest) (*GenericImageExecutionResult, *types.NewAPIError) {
		executorCalls.Add(1)
		return &GenericImageExecutionResult{
			Response: &dto.ImageResponse{
				Created: 123,
				Data: []dto.ImageData{{
					Url:           providerServer.URL + "/temporary.png",
					RevisedPrompt: "durable prompt",
				}},
			},
			Usage: &dto.Usage{PromptTokens: 1, TotalTokens: 1},
		}, nil
	}
	genericImageExecutorRegistry.Unlock()
	t.Cleanup(func() {
		genericImageExecutorRegistry.Lock()
		genericImageExecutorRegistry.executor = previousExecutor
		genericImageExecutorRegistry.Unlock()
	})

	baseURL := "https://upstream.example.com"
	channel := &model.Channel{
		Type:        constant.ChannelTypeOpenAI,
		Key:         "upstream-key",
		Status:      common.ChannelStatusEnabled,
		Name:        "async materialization test",
		CreatedTime: 1700000000,
		BaseURL:     &baseURL,
		Models:      "dall-e-3",
		Group:       "default",
	}
	require.NoError(t, model.DB.Create(channel).Error)

	payload := asyncImageTaskPayload{
		Version:  asyncImagePayloadVersion,
		Executor: AsyncImageExecutorAdaptor,
		Request:  &dto.ImageRequest{Model: "dall-e-3", Prompt: "durable output"},
		PreparedRequest: &PreparedAsyncImageRequest{
			Body:              []byte(`{"model":"dall-e-3","prompt":"durable output"}`),
			ContentType:       "application/json",
			RequestURLPath:    "/v1/images/generations",
			ChannelBaseURL:    baseURL,
			APIType:           constant.APITypeOpenAI,
			ChannelType:       constant.ChannelTypeOpenAI,
			ChannelCreateTime: channel.CreatedTime,
		},
	}
	task := &model.Task{
		TaskID:    "task_materialized_retry",
		Platform:  constant.TaskPlatformOpenAIImage,
		UserId:    1,
		ChannelId: channel.Id,
		Status:    model.TaskStatusInProgress,
		Attempt:   1,
		Progress:  "10%",
		Properties: model.Properties{
			OriginModelName:   "dall-e-3",
			UpstreamModelName: "dall-e-3",
		},
		PrivateData: model.TaskPrivateData{
			ChannelKeyHash: common.GenerateHMAC(channel.Key),
		},
	}
	task.SetCheckpointData(payload)
	require.NoError(t, model.DB.Create(task).Error)

	firstCtx, firstCancel := context.WithCancel(context.Background())
	defer firstCancel()
	cancelWorker = firstCancel
	completed, err := executeAsyncImageTask(firstCtx, task)
	require.ErrorIs(t, err, context.Canceled)
	assert.False(t, completed)
	assert.Equal(t, int32(1), executorCalls.Load())
	assert.Equal(t, int32(1), providerURLRequests.Load())

	var persisted model.Task
	require.NoError(t, model.DB.First(&persisted, task.ID).Error)
	var persistedPayload asyncImageTaskPayload
	require.NoError(t, common.Unmarshal(persisted.CheckpointData, &persistedPayload))
	assert.True(t, persistedPayload.ArtifactStored)
	assert.False(t, persistedPayload.ProviderStored)
	assert.Equal(t, "70%", persisted.Progress)

	artifactBytes, err := model.LoadImageTaskArtifact(task.TaskID)
	require.NoError(t, err)
	var artifact genericImageArtifact
	require.NoError(t, common.Unmarshal(artifactBytes, &artifact))
	require.NotNil(t, artifact.Response)
	require.Len(t, artifact.Response.Data, 1)
	assert.Empty(t, artifact.Response.Data[0].Url)
	assert.Equal(t, base64.StdEncoding.EncodeToString(imageBytes), artifact.Response.Data[0].B64Json)
	assert.Equal(t, "durable prompt", artifact.Response.Data[0].RevisedPrompt)
	assert.NotContains(t, string(artifactBytes), providerServer.URL)

	// Simulate stale-claim recovery after the worker exited. The second attempt
	// must load the materialized SQL artifact, skip both adaptor execution and the
	// now-expired provider URL, and proceed directly to the R2 phase.
	require.NoError(t, model.DB.Model(&model.Task{}).Where("id = ?", persisted.ID).Updates(map[string]any{
		"status":   model.TaskStatusNotStart,
		"progress": "70%",
	}).Error)
	require.NoError(t, model.DB.First(&persisted, task.ID).Error)
	claimed, err := model.ClaimImageTask(&persisted, common.GetTimestamp())
	require.NoError(t, err)
	require.True(t, claimed)

	secondCtx, secondCancel := context.WithCancel(context.Background())
	defer secondCancel()
	cancelWorker = secondCancel
	completed, err = executeAsyncImageTask(secondCtx, &persisted)
	require.ErrorIs(t, err, context.Canceled)
	assert.False(t, completed)
	assert.Equal(t, int32(1), executorCalls.Load())
	assert.Equal(t, int32(1), providerURLRequests.Load())
}

func TestMergeUsageDoesNotMutateUpstreamUsage(t *testing.T) {
	aggregated := &UpstreamResponse{
		Usage: &dto.Usage{
			InputTokens:  3,
			OutputTokens: 4,
			TotalTokens:  7,
		},
		ToolUsage: &UpstreamToolUsage{},
	}
	aggregated.ToolUsage.ImageGen = &struct {
		InputTokens        int `json:"input_tokens"`
		InputTokensDetails struct {
			ImageTokens int `json:"image_tokens"`
			TextTokens  int `json:"text_tokens"`
		} `json:"input_tokens_details"`
		OutputTokens        int `json:"output_tokens"`
		OutputTokensDetails struct {
			ImageTokens int `json:"image_tokens"`
			TextTokens  int `json:"text_tokens"`
		} `json:"output_tokens_details"`
		TotalTokens int `json:"total_tokens"`
	}{InputTokens: 10, OutputTokens: 20, TotalTokens: 30}
	aggregated.ToolUsage.ImageGen.InputTokensDetails.ImageTokens = 6
	aggregated.ToolUsage.ImageGen.InputTokensDetails.TextTokens = 4
	aggregated.ToolUsage.ImageGen.OutputTokensDetails.ImageTokens = 15
	aggregated.ToolUsage.ImageGen.OutputTokensDetails.TextTokens = 5

	first, err := mergeUsage(aggregated)
	require.NoError(t, err)
	second, err := mergeUsage(aggregated)
	require.NoError(t, err)

	require.NotSame(t, aggregated.Usage, first)
	assert.Equal(t, 13, first.InputTokens)
	assert.Equal(t, 24, first.OutputTokens)
	assert.Equal(t, 37, first.TotalTokens)
	assert.Equal(t, first.InputTokens, second.InputTokens)
	assert.Equal(t, first.OutputTokens, second.OutputTokens)
	assert.Equal(t, first.TotalTokens, second.TotalTokens)
	assert.Equal(t, 6, first.PromptTokensDetails.ImageTokens)
	assert.Equal(t, 4, first.PromptTokensDetails.TextTokens)
	assert.Equal(t, 15, first.CompletionTokenDetails.ImageTokens)
	assert.Equal(t, 5, first.CompletionTokenDetails.TextTokens)
	assert.Equal(t, 3, aggregated.Usage.InputTokens)
	assert.Equal(t, 4, aggregated.Usage.OutputTokens)
	assert.Equal(t, 7, aggregated.Usage.TotalTokens)
}

func TestMergeUsageMapsResponsesDetailsIntoBillingDetails(t *testing.T) {
	aggregated := &UpstreamResponse{Usage: &dto.Usage{
		InputTokens:  10,
		OutputTokens: 2,
		InputTokensDetails: &dto.InputTokenDetails{
			TextTokens:  6,
			ImageTokens: 4,
		},
		OutputTokensDetails: &dto.OutputTokenDetails{
			TextTokens:  1,
			ImageTokens: 1,
		},
	}}

	usage, err := mergeUsage(aggregated)
	require.NoError(t, err)
	assert.Equal(t, 4, usage.PromptTokensDetails.ImageTokens)
	assert.Equal(t, 6, usage.PromptTokensDetails.TextTokens)
	assert.Equal(t, 1, usage.CompletionTokenDetails.ImageTokens)
	assert.Equal(t, 1, usage.CompletionTokenDetails.TextTokens)

	task := &model.Task{PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
		ModelRatio:      1,
		CompletionRatio: 1,
		ImageRatio:      2,
		GroupRatio:      1,
		OriginModelName: "gpt-image-1",
	}}}
	quota, _, err := service.CalculateImageTaskQuota(task, usage)
	require.NoError(t, err)
	// (10 input - 4 image + 4*2 image) + 2 output = 16.
	assert.Equal(t, 16, quota)
}

func TestMergeUsageRejectsNegativeCounts(t *testing.T) {
	tests := []struct {
		name       string
		aggregated *UpstreamResponse
	}{
		{
			name: "top-level input",
			aggregated: &UpstreamResponse{Usage: &dto.Usage{
				InputTokens: -1,
			}},
		},
		{
			name: "responses image detail",
			aggregated: &UpstreamResponse{Usage: &dto.Usage{
				InputTokensDetails: &dto.InputTokenDetails{ImageTokens: -1},
			}},
		},
	}

	negativeToolUsage := &UpstreamResponse{ToolUsage: &UpstreamToolUsage{}}
	negativeToolUsage.ToolUsage.ImageGen = &struct {
		InputTokens        int `json:"input_tokens"`
		InputTokensDetails struct {
			ImageTokens int `json:"image_tokens"`
			TextTokens  int `json:"text_tokens"`
		} `json:"input_tokens_details"`
		OutputTokens        int `json:"output_tokens"`
		OutputTokensDetails struct {
			ImageTokens int `json:"image_tokens"`
			TextTokens  int `json:"text_tokens"`
		} `json:"output_tokens_details"`
		TotalTokens int `json:"total_tokens"`
	}{}
	negativeToolUsage.ToolUsage.ImageGen.OutputTokensDetails.ImageTokens = -1
	tests = append(tests, struct {
		name       string
		aggregated *UpstreamResponse
	}{name: "tool image detail", aggregated: negativeToolUsage})

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			usage, err := mergeUsage(test.aggregated)
			require.Error(t, err)
			assert.Nil(t, usage)
			assert.Contains(t, err.Error(), "cannot be negative")
		})
	}
}

func TestMergeUsageRejectsIntegerOverflow(t *testing.T) {
	aggregated := &UpstreamResponse{
		Usage:     &dto.Usage{InputTokens: int(^uint(0) >> 1)},
		ToolUsage: &UpstreamToolUsage{},
	}
	aggregated.ToolUsage.ImageGen = &struct {
		InputTokens        int `json:"input_tokens"`
		InputTokensDetails struct {
			ImageTokens int `json:"image_tokens"`
			TextTokens  int `json:"text_tokens"`
		} `json:"input_tokens_details"`
		OutputTokens        int `json:"output_tokens"`
		OutputTokensDetails struct {
			ImageTokens int `json:"image_tokens"`
			TextTokens  int `json:"text_tokens"`
		} `json:"output_tokens_details"`
		TotalTokens int `json:"total_tokens"`
	}{InputTokens: 1, TotalTokens: 1}

	usage, err := mergeUsage(aggregated)
	require.Error(t, err)
	assert.Nil(t, usage)
	assert.Contains(t, err.Error(), "overflows int")
}

func TestImageTaskResponseIncludesResultOnlyAfterCompletion(t *testing.T) {
	queued := imageTaskResponse("task_queued", "NOT_START", "0%", 10, 0, nil, "")
	assert.Equal(t, "queued", queued.Status)
	assert.Nil(t, queued.Result)
	assert.Nil(t, queued.Error)

	finalizing := imageTaskResponse("task_finalizing", "FINALIZING", "99%", 10, 0, nil, "")
	assert.Equal(t, "in_progress", finalizing.Status)
	assert.Equal(t, "99%", finalizing.Progress)

	completed := imageTaskResponse("task_done", "SUCCESS", "70%", 10, 20, []byte(`{"data":[{"url":"https://cdn.example/image.png"}]}`), "")
	assert.Equal(t, "completed", completed.Status)
	require.NotNil(t, completed.Result)
	assert.JSONEq(t, `{"data":[{"url":"https://cdn.example/image.png"}]}`, string(*completed.Result))

	failed := imageTaskResponse("task_failed", "FAILURE", "70%", 10, 20, nil, "upstream failed")
	assert.Equal(t, "failed", failed.Status)
	require.NotNil(t, failed.Error)
	assert.Equal(t, "upstream failed", failed.Error.Message)
}

func TestBuildImageTaskResponsePreservesUploadProgress(t *testing.T) {
	task := &model.Task{TaskID: "task_upload", Status: model.TaskStatusNotStart, Progress: "70%"}
	response := BuildImageTaskResponse(task)
	require.NotNil(t, response)
	assert.Equal(t, "queued", response.Status)
	assert.Equal(t, "70%", response.Progress)
}

func TestR2ConfigRequiresPublicBaseForAsyncDelivery(t *testing.T) {
	config := R2Config{
		AccessKeyID:     "access-key",
		SecretAccessKey: "secret-key",
		AccountID:       "account",
		Bucket:          "images",
	}
	assert.False(t, config.Enabled())

	config.PublicBase = "https://cdn.example.com"
	assert.True(t, config.Enabled())
}

func TestR2PutObjectUploadsBytesAndReturnsPublicURL(t *testing.T) {
	var receivedBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/images/images/hash.png", r.URL.Path)
		assert.Contains(t, r.Header.Get("Authorization"), "AWS4-HMAC-SHA256 Credential=access-key/")
		assert.Equal(t, sha256HexBytes([]byte("image-bytes")), r.Header.Get("X-Amz-Content-Sha256"))
		assert.Equal(t, "image/png", r.Header.Get("Content-Type"))
		var err error
		receivedBody, err = io.ReadAll(r.Body)
		require.NoError(t, err)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	config := R2Config{
		AccessKeyID:     "access-key",
		SecretAccessKey: "secret-key",
		AccountID:       "account",
		Bucket:          "images",
		PublicBase:      "https://cdn.example.com",
		Endpoint:        server.URL,
	}
	url, err := config.PutObject(context.Background(), "images/hash.png", "image/png", []byte("image-bytes"))

	require.NoError(t, err)
	assert.Equal(t, []byte("image-bytes"), receivedBody)
	assert.Equal(t, "https://cdn.example.com/images/hash.png", url)
}

func TestR2PutObjectRejectsS3ErrorResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, err := w.Write([]byte(`<Error><Message>invalid bucket</Message></Error>`))
		require.NoError(t, err)
	}))
	defer server.Close()

	config := R2Config{
		AccessKeyID:     "access-key",
		SecretAccessKey: "secret-key",
		AccountID:       "account",
		Bucket:          "images",
		PublicBase:      "https://cdn.example.com",
		Endpoint:        server.URL,
	}
	_, err := config.PutObject(context.Background(), "images/hash.png", "image/png", []byte("image-bytes"))
	require.Error(t, err)
	var putErr *r2PutError
	require.ErrorAs(t, err, &putErr)
	assert.True(t, putErr.Permanent())
	assert.Contains(t, err.Error(), "invalid bucket")
}

func TestValidateAsyncImageRequestSupportsAllAsyncImageDelivery(t *testing.T) {
	zero := uint(0)
	tooMany := uint(dto.MaxImageN + 1)
	stream := true
	tests := []struct {
		name    string
		request *dto.ImageRequest
		message string
	}{
		{name: "missing prompt", request: &dto.ImageRequest{}, message: "prompt is required"},
		{name: "streaming", request: &dto.ImageRequest{Prompt: "cat", Stream: &stream}, message: "stream=true"},
		{name: "zero images", request: &dto.ImageRequest{Prompt: "cat", N: &zero}, message: "between 1"},
		{name: "too many images", request: &dto.ImageRequest{Prompt: "cat", N: &tooMany}, message: "between 1"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateAsyncImageRequest(test.request)
			require.Error(t, err)
			assert.Contains(t, err.Error(), test.message)
		})
	}
	assert.NoError(t, validateAsyncImageRequest(&dto.ImageRequest{Prompt: "cat"}))
	two := uint(2)
	assert.NoError(t, validateAsyncImageRequest(&dto.ImageRequest{Prompt: "cat", N: &two, ResponseFormat: "b64_json"}))
}

func TestShouldRunAsyncForEveryImageGeneration(t *testing.T) {
	assert.True(t, ShouldRunAsync("gpt-image-2", nil))
	assert.True(t, ShouldRunAsync("dall-e-3", nil))

	enabled := true
	disabled := false
	assert.True(t, ShouldRunAsync("mapped-image-alias", &enabled))
	assert.True(t, ShouldRunAsync("gpt-image-2", &disabled))
}

func TestAsyncImageIdempotencyIncludesGatewayAndExtraFields(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Request.Header.Set("Idempotency-Key", "same-request")
	async := true
	request := &dto.ImageRequest{
		Model:         "gpt-image-2",
		Prompt:        "cat",
		Async:         &async,
		WebhookURL:    " https://example.com/hook ",
		WebhookSecret: "secret-a",
		Extra: map[string]json.RawMessage{
			"seed": json.RawMessage(`123`),
		},
	}

	id, hash, err := asyncImageIdempotency(c, request)
	require.NoError(t, err)
	require.NotNil(t, id)
	assert.NotEmpty(t, hash)

	changedSecret := *request
	changedSecret.WebhookSecret = "secret-b"
	_, secretHash, err := asyncImageIdempotency(c, &changedSecret)
	require.NoError(t, err)
	assert.NotEqual(t, hash, secretHash)

	changedExtra := *request
	changedExtra.Extra = map[string]json.RawMessage{"seed": json.RawMessage(`456`)}
	_, extraHash, err := asyncImageIdempotency(c, &changedExtra)
	require.NoError(t, err)
	assert.NotEqual(t, hash, extraHash)
}

func TestAsyncImageIdempotencyCanonicalizesImageDefaults(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Request.Header.Set("Idempotency-Key", "defaults")

	base := &dto.ImageRequest{Model: "gpt-image-1", Prompt: "cat"}
	_, baseHash, err := asyncImageIdempotency(c, base)
	require.NoError(t, err)
	one := uint(1)
	explicit := &dto.ImageRequest{Model: "gpt-image-1", Prompt: "cat", N: &one, Quality: "auto"}
	_, explicitHash, err := asyncImageIdempotency(c, explicit)
	require.NoError(t, err)
	assert.Equal(t, baseHash, explicitHash)
}

func TestAsyncImageIdempotencyIgnoresLegacyAsyncFlag(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Request.Header.Set("Idempotency-Key", "async-flag")

	base := &dto.ImageRequest{Model: "dall-e-3", Prompt: "cat"}
	_, baseHash, err := asyncImageIdempotency(c, base)
	require.NoError(t, err)

	enabled := true
	withTrue := *base
	withTrue.Async = &enabled
	_, trueHash, err := asyncImageIdempotency(c, &withTrue)
	require.NoError(t, err)

	disabled := false
	withFalse := *base
	withFalse.Async = &disabled
	_, falseHash, err := asyncImageIdempotency(c, &withFalse)
	require.NoError(t, err)

	assert.Equal(t, baseHash, trueHash)
	assert.Equal(t, baseHash, falseHash)
}

func TestAsyncImageIdempotencyReplayDoesNotAcceptReservingTask(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	task := &model.Task{
		TaskID: "task_reserving_replay",
		Status: model.TaskStatusReserving,
		PrivateData: model.TaskPrivateData{
			ClientRequestHash: "same-request-hash",
		},
	}

	apiErr := writeReplayedAsyncImageTask(c, task, "same-request-hash")
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusConflict, apiErr.StatusCode)
	assert.Contains(t, apiErr.Error(), "still being prepared")
	assert.Equal(t, "true", recorder.Header().Get("Idempotency-Replayed"))
	assert.Equal(t, "2", recorder.Header().Get("Retry-After"))
	assert.Empty(t, recorder.Header().Get("Location"))
}

func TestDeliverDueImageWebhooksFailsOrphanWithoutRetry(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	hook := &model.TaskWebhook{
		TaskID: "task_orphan_delivery",
		URL:    "https://example.com/hook",
		Secret: "discard-on-failure",
	}
	require.NoError(t, model.DB.Create(hook).Error)

	delivered, retried, err := deliverDueImageWebhooks(context.Background())
	require.NoError(t, err)
	assert.Zero(t, delivered)
	assert.Zero(t, retried)
	require.NoError(t, model.DB.First(hook, hook.ID).Error)
	assert.Equal(t, model.TaskWebhookStatusFailed, hook.Status)
	assert.Equal(t, 1, hook.Attempts)
	assert.Equal(t, "task not found", hook.LastError)
	assert.Empty(t, hook.URL)
	assert.Empty(t, hook.Secret)
}

func TestDeliverDueImageWebhooksKeepsDeliveryIDAcrossRetries(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	now := common.GetTimestamp()
	task := &model.Task{
		TaskID:     "task_webhook_delivery_id",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     model.TaskStatusSuccess,
		SubmitTime: now,
	}
	require.NoError(t, model.DB.Create(task).Error)
	hook := &model.TaskWebhook{
		TaskID: task.TaskID,
		URL:    "https://example.com/hook",
		Secret: "webhook-secret",
	}
	require.NoError(t, model.DB.Create(hook).Error)

	previousSender := sendAsyncImageWebhook
	var deliveryIDs []string
	attempt := 0
	sendAsyncImageWebhook = func(_ context.Context, _ string, _ string, deliveryID string, _ any) error {
		deliveryIDs = append(deliveryIDs, deliveryID)
		attempt++
		if attempt == 1 {
			return errors.New("temporary delivery failure")
		}
		return nil
	}
	t.Cleanup(func() { sendAsyncImageWebhook = previousSender })

	delivered, retried, err := deliverDueImageWebhooks(context.Background())
	require.NoError(t, err)
	assert.Zero(t, delivered)
	assert.Equal(t, 1, retried)
	require.Len(t, deliveryIDs, 1)

	require.NoError(t, model.DB.Model(&model.TaskWebhook{}).Where("id = ?", hook.ID).Update("next_attempt_at", now).Error)
	delivered, retried, err = deliverDueImageWebhooks(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, delivered)
	assert.Zero(t, retried)
	require.Len(t, deliveryIDs, 2)
	assert.Equal(t, task.TaskID, deliveryIDs[0])
	assert.Equal(t, deliveryIDs[0], deliveryIDs[1])
	require.NoError(t, model.DB.First(hook, hook.ID).Error)
	assert.Equal(t, model.TaskWebhookStatusDelivered, hook.Status)
}

func TestImageTaskChannelKeyKeepsSubmittedKey(t *testing.T) {
	channel := &model.Channel{Key: "key-a\nkey-b"}
	channel.ChannelInfo.IsMultiKey = true
	private := model.TaskPrivateData{
		ChannelMultiKeyIndex: 1,
		ChannelKeyHash:       common.GenerateHMAC("key-b"),
	}
	key, err := imageTaskChannelKey(channel, private)
	require.NoError(t, err)
	assert.Equal(t, "key-b", key)

	channel.Key = "key-b\nkey-a"
	key, err = imageTaskChannelKey(channel, private)
	require.NoError(t, err)
	assert.Equal(t, "key-b", key)
}

func TestLoadAsyncImageChannelAcceptsOpenAICompatibleFallbackAPITypes(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}))

	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		common.MemoryCacheEnabled = previousMemoryCacheEnabled
	})

	tests := []struct {
		name        string
		channelType int
	}{
		{name: "azure", channelType: constant.ChannelTypeAzure},
		{name: "legacy openai compatible", channelType: constant.ChannelTypeOpenAIMax},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			baseURL := "https://images.example.com"
			channel := &model.Channel{
				Type:        test.channelType,
				Key:         "submitted-key",
				Status:      common.ChannelStatusEnabled,
				CreatedTime: int64(1700000100 + index),
				BaseURL:     &baseURL,
			}
			require.NoError(t, model.DB.Create(channel).Error)

			task := &model.Task{
				ChannelId: channel.Id,
				PrivateData: model.TaskPrivateData{
					ChannelKeyHash: common.GenerateHMAC(channel.Key),
				},
			}
			prepared := &PreparedAsyncImageRequest{
				APIType:           constant.APITypeOpenAI,
				ChannelType:       channel.Type,
				ChannelCreateTime: channel.CreatedTime,
				ChannelBaseURL:    baseURL,
			}

			loaded, key, err := loadAsyncImageChannel(task, prepared, false)
			require.NoError(t, err)
			assert.Equal(t, channel.Id, loaded.Id)
			assert.Equal(t, channel.Key, key)

			incompatible := *prepared
			incompatible.APIType = constant.APITypeGemini
			_, _, err = loadAsyncImageChannel(task, &incompatible, false)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "API type changed")
		})
	}
}

func TestGenericAsyncImageRelayInfoUsesTaskIDAsProviderIdempotencyKey(t *testing.T) {
	headerOverride := `{"X-Custom":"preserved"}`
	channel := &model.Channel{
		Id:             9,
		Type:           constant.ChannelTypeSiliconFlow,
		BaseURL:        common.GetPointer("https://api.example.com"),
		HeaderOverride: &headerOverride,
	}
	task := &model.Task{
		TaskID: "task_stable_idempotency",
		Properties: model.Properties{
			OriginModelName:   "image-alias",
			UpstreamModelName: "gpt-image-1",
		},
	}
	info := genericAsyncImageRelayInfo(task, channel, "upstream-key", &PreparedAsyncImageRequest{
		APIType:     constant.APITypeSiliconFlow,
		ContentType: "application/json",
	})

	require.NotNil(t, info.ChannelMeta)
	assert.Equal(t, task.TaskID, info.ChannelMeta.HeadersOverride["Idempotency-Key"])
	assert.Equal(t, "preserved", info.ChannelMeta.HeadersOverride["X-Custom"])
}

func TestGenericAsyncImageRelayInfoUsesSubmittedChannelConfiguration(t *testing.T) {
	currentOrganization := "current-organization"
	currentHeaderOverride := `{"Authorization":"Bearer current-secret","X-Current":"changed"}`
	channel := &model.Channel{
		Id:                 11,
		Type:               constant.ChannelTypeSiliconFlow,
		Other:              "current-api-version",
		OpenAIOrganization: &currentOrganization,
		HeaderOverride:     &currentHeaderOverride,
	}
	task := &model.Task{
		TaskID: "task_configuration_snapshot",
		Properties: model.Properties{
			OriginModelName:   "image-alias",
			UpstreamModelName: "provider-image-model",
		},
	}
	channelSetting := dto.ChannelSettings{Proxy: "http://submitted-proxy.example.com"}
	channelOtherSettings := dto.ChannelOtherSettings{DisableTaskPollingSleep: true}
	prepared := &PreparedAsyncImageRequest{
		APIType:              constant.APITypeSiliconFlow,
		ContentType:          "application/json",
		ConfigurationStored:  true,
		APIVersion:           "submitted-api-version",
		Organization:         "submitted-organization",
		HeadersOverride:      map[string]interface{}{"X-Submitted": "preserved"},
		ChannelSetting:       &channelSetting,
		ChannelOtherSettings: &channelOtherSettings,
	}

	info := genericAsyncImageRelayInfo(task, channel, "upstream-key", prepared)

	require.NotNil(t, info.ChannelMeta)
	assert.Equal(t, "submitted-api-version", info.ChannelMeta.ApiVersion)
	assert.Equal(t, "submitted-organization", info.ChannelMeta.Organization)
	assert.Empty(t, info.ChannelMeta.ChannelSetting.Proxy)
	assert.True(t, info.ChannelMeta.ChannelOtherSettings.DisableTaskPollingSleep)
	assert.Equal(t, "preserved", info.ChannelMeta.HeadersOverride["X-Submitted"])
	assert.NotContains(t, info.ChannelMeta.HeadersOverride, "X-Current")
	assert.Equal(t, "Bearer current-secret", info.ChannelMeta.HeadersOverride["Authorization"])
	assert.Equal(t, task.TaskID, info.ChannelMeta.HeadersOverride["Idempotency-Key"])
	assert.NotContains(t, prepared.HeadersOverride, "Idempotency-Key")
}

func TestRetryableAsyncImageSubmissionError(t *testing.T) {
	tests := []struct {
		name      string
		apiErr    *types.NewAPIError
		retryable bool
	}{
		{
			name:      "transport failure",
			apiErr:    types.NewError(errors.New("connection reset"), types.ErrorCodeDoRequestFailed),
			retryable: true,
		},
		{
			name:      "rate limited",
			apiErr:    types.NewErrorWithStatusCode(errors.New("rate limited"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
			retryable: true,
		},
		{
			name:      "provider unavailable",
			apiErr:    types.NewErrorWithStatusCode(errors.New("unavailable"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable),
			retryable: true,
		},
		{
			name:      "invalid provider request",
			apiErr:    types.NewErrorWithStatusCode(errors.New("invalid"), types.ErrorCodeBadResponseStatusCode, http.StatusBadRequest),
			retryable: false,
		},
		{
			name:      "malformed provider response",
			apiErr:    types.NewError(errors.New("malformed"), types.ErrorCodeBadResponseBody),
			retryable: false,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.retryable, retryableAsyncImageSubmissionError(test.apiErr))
		})
	}
}

func TestGenericAsyncImageRelayInfoUsesSnapshottedAdvancedRoute(t *testing.T) {
	currentSettings, err := common.Marshal(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{{
			IncomingPath: "/v1/images/generations",
			UpstreamPath: "https://changed.example.com/images",
			Converter:    "none",
		}},
	}})
	require.NoError(t, err)
	channel := &model.Channel{
		Id:            10,
		Type:          constant.ChannelTypeAdvancedCustom,
		BaseURL:       common.GetPointer("https://changed.example.com"),
		OtherSettings: string(currentSettings),
	}
	task := &model.Task{
		TaskID: "task_advanced_snapshot",
		Properties: model.Properties{
			OriginModelName:   "image-alias",
			UpstreamModelName: "gpt-image-1",
		},
	}
	prepared := &PreparedAsyncImageRequest{
		APIType:        constant.APITypeAdvancedCustom,
		ContentType:    "application/json",
		ChannelBaseURL: "https://submitted.example.com",
		AdvancedRoute: &dto.AdvancedCustomRoute{
			IncomingPath: "/v1/images/generations",
			UpstreamPath: "https://submitted.example.com/images/{model}",
			Converter:    "none",
		},
	}

	info := genericAsyncImageRelayInfo(task, channel, "upstream-key", prepared)

	assert.Equal(t, "https://submitted.example.com", info.ChannelMeta.ChannelBaseUrl)
	require.NotNil(t, info.ChannelMeta.ChannelOtherSettings.AdvancedCustom)
	route, ok := info.ChannelMeta.ChannelOtherSettings.AdvancedCustom.MatchPathForModel("/v1/images/generations", "image-alias")
	require.True(t, ok)
	assert.Equal(t, "https://submitted.example.com/images/{model}", route.UpstreamPath)
}

func TestDecodeAsyncImageTaskPayloadRecoversCheckpointAndLegacyRequest(t *testing.T) {
	checkpoint, err := common.Marshal(asyncImageTaskPayload{
		Request:      &dto.ImageRequest{Model: "gpt-image-2", Prompt: "checkpoint prompt", Quality: "high"},
		RequestExtra: map[string]json.RawMessage{"seed": json.RawMessage(`123`)},
		Upstream: &UpstreamResponse{
			Model:  "gpt-image-2",
			Output: []UpstreamItem{{Type: "image_generation_call", Result: "persisted-result"}},
		},
	})
	require.NoError(t, err)
	payload, err := decodeAsyncImageTaskPayload(checkpoint)
	require.NoError(t, err)
	require.NotNil(t, payload.Request)
	require.NotNil(t, payload.Upstream)
	assert.Equal(t, "checkpoint prompt", payload.Request.Prompt)
	assert.Equal(t, "persisted-result", payload.Upstream.Output[0].Result)
	assert.JSONEq(t, `123`, string(payload.Request.Extra["seed"]))

	legacy, err := common.Marshal(&dto.ImageRequest{Model: "gpt-image-2", Prompt: "legacy prompt"})
	require.NoError(t, err)
	payload, err = decodeAsyncImageTaskPayload(legacy)
	require.NoError(t, err)
	require.NotNil(t, payload.Request)
	assert.Equal(t, "legacy prompt", payload.Request.Prompt)
	assert.Nil(t, payload.Upstream)
}

func TestAsyncImagePassThroughCountValidatesProviderFields(t *testing.T) {
	tests := []struct {
		name      string
		body      string
		wantCount int
		wantFound bool
		wantError string
	}{
		{name: "siliconflow", body: `{"batch_size":2}`, wantCount: 2, wantFound: true},
		{name: "openai", body: `{"n":2}`, wantCount: 2, wantFound: true},
		{name: "replicate", body: `{"input":{"num_outputs":4}}`, wantCount: 4, wantFound: true},
		{name: "ali", body: `{"parameters":{"n":3}}`, wantCount: 3, wantFound: true},
		{name: "gemini", body: `{"parameters":{"sampleCount":5}}`, wantCount: 5, wantFound: true},
		{name: "absent", body: `{"prompt":"cat"}`},
		{name: "zero", body: `{"batch_size":0}`, wantError: "between 1"},
		{name: "overflow", body: `{"input":{"num_outputs":129}}`, wantError: "between 1"},
		{name: "fraction", body: `{"parameters":{"n":1.5}}`, wantError: "between 1"},
		{name: "conflicting fields use conservative maximum", body: `{"n":1,"batch_size":2,"input":{"num_outputs":4}}`, wantCount: 4, wantFound: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			count, found, err := AsyncImagePassThroughCount([]byte(test.body))
			if test.wantError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), test.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.wantCount, count)
			assert.Equal(t, test.wantFound, found)
		})
	}
}

func TestPersistedAsyncImageRequestOmitsDeliveryFields(t *testing.T) {
	async := true
	request := &dto.ImageRequest{
		Model:         "gpt-image-2",
		Prompt:        "cat",
		Async:         &async,
		WebhookURL:    "https://example.com/hook",
		WebhookSecret: "do-not-store-with-task",
	}

	encoded, err := common.Marshal(asyncImageTaskPayload{Request: persistedAsyncImageRequest(request)})
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "do-not-store-with-task")
	assert.NotContains(t, string(encoded), "example.com/hook")
	assert.Equal(t, "do-not-store-with-task", request.WebhookSecret)
}

func TestSanitizeAsyncBillingRequestBodyRemovesDeliverySecrets(t *testing.T) {
	body := []byte(`{
  "prompt":"cat",
  "quality":"high",
  "async":true,
  "webhook_url":"https://example.com/hook",
  "webhook_secret":"do-not-persist",
  "parameters":{"seed":123}
}`)

	sanitized, err := sanitizeAsyncBillingRequestBody(body)
	require.NoError(t, err)
	assert.NotContains(t, string(sanitized), "do-not-persist")

	var fields map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(sanitized, &fields))
	assert.NotContains(t, fields, "async")
	assert.NotContains(t, fields, "webhook_url")
	assert.NotContains(t, fields, "webhook_secret")
	assert.Contains(t, fields, "prompt")
	assert.Contains(t, fields, "quality")
	assert.Contains(t, fields, "parameters")
}

func TestSanitizeAsyncBillingRequestBodyRejectsMalformedJSON(t *testing.T) {
	_, err := sanitizeAsyncBillingRequestBody([]byte(`{"webhook_secret":`))
	require.Error(t, err)
}
