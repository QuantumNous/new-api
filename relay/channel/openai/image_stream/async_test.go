package image_stream

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
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

func TestAsyncImageOutputLeaseIsIdempotentAndContextAware(t *testing.T) {
	previousSemaphore := asyncImageOutputMaterializationSemaphore
	asyncImageOutputMaterializationSemaphore = make(chan struct{}, 1)
	t.Cleanup(func() { asyncImageOutputMaterializationSemaphore = previousSemaphore })

	first := &asyncImageOutputLease{}
	require.NoError(t, first.acquire(context.Background()))
	require.NoError(t, first.acquire(context.Background()))
	assert.Len(t, asyncImageOutputMaterializationSemaphore, 1)

	blockedCtx, cancel := context.WithCancel(context.Background())
	cancel()
	second := &asyncImageOutputLease{}
	require.ErrorIs(t, second.acquire(blockedCtx), context.Canceled)
	assert.False(t, second.held)

	first.release()
	first.release()
	assert.Empty(t, asyncImageOutputMaterializationSemaphore)
	require.NoError(t, second.acquire(context.Background()))
	second.release()
	assert.Empty(t, asyncImageOutputMaterializationSemaphore)
}

func TestAsyncImagePersistedArtifactLoadHoldsOutputLeaseAndReleasesOnCancellation(t *testing.T) {
	previousSemaphore := asyncImageOutputMaterializationSemaphore
	asyncImageOutputMaterializationSemaphore = make(chan struct{}, 1)
	t.Cleanup(func() { asyncImageOutputMaterializationSemaphore = previousSemaphore })

	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 1}
	artifact, err := common.Marshal(genericImageArtifact{
		Response: &dto.ImageResponse{Data: []dto.ImageData{{B64Json: base64.StdEncoding.EncodeToString(png)}}},
	})
	require.NoError(t, err)
	payloadData, err := common.Marshal(asyncImageTaskPayload{
		Version:        asyncImagePayloadVersion,
		Executor:       AsyncImageExecutorAdaptor,
		ArtifactStored: true,
		Request:        &dto.ImageRequest{Model: "image-model", Prompt: "draw"},
	})
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	previousLoad := loadAsyncImageTaskArtifact
	loadAsyncImageTaskArtifact = func(taskID string) ([]byte, error) {
		assert.Equal(t, "task_output_lease", taskID)
		assert.Len(t, asyncImageOutputMaterializationSemaphore, 1, "the lease must be held before loading a large SQL artifact")
		cancel()
		return artifact, nil
	}
	t.Cleanup(func() { loadAsyncImageTaskArtifact = previousLoad })

	completed, executeErr := executeAsyncImageTask(ctx, &model.Task{
		TaskID:   "task_output_lease",
		Status:   model.TaskStatusInProgress,
		Data:     payloadData,
		Progress: "70%",
	})

	assert.False(t, completed)
	require.ErrorIs(t, executeErr, context.Canceled)
	assert.Empty(t, asyncImageOutputMaterializationSemaphore, "every return path must release the output lease")
}

func TestAsyncImageResponsesPersistedArtifactLoadHoldsOutputLeaseAndReleasesOnCancellation(t *testing.T) {
	previousSemaphore := asyncImageOutputMaterializationSemaphore
	asyncImageOutputMaterializationSemaphore = make(chan struct{}, 1)
	t.Cleanup(func() { asyncImageOutputMaterializationSemaphore = previousSemaphore })

	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 2}
	artifact, err := common.Marshal(UpstreamResponse{
		Output: []UpstreamItem{{
			Type:         "image_generation_call",
			Result:       base64.StdEncoding.EncodeToString(png),
			OutputFormat: "png",
		}},
	})
	require.NoError(t, err)
	payloadData, err := common.Marshal(asyncImageTaskPayload{
		Version:        asyncImagePayloadVersion,
		Executor:       AsyncImageExecutorResponses,
		ArtifactStored: true,
		Request:        &dto.ImageRequest{Model: "gpt-image-1", Prompt: "draw"},
	})
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	previousLoad := loadAsyncImageTaskArtifact
	loadAsyncImageTaskArtifact = func(taskID string) ([]byte, error) {
		assert.Equal(t, "task_responses_output_lease", taskID)
		assert.Len(t, asyncImageOutputMaterializationSemaphore, 1, "the lease must be held before loading a Responses SQL artifact")
		cancel()
		return artifact, nil
	}
	t.Cleanup(func() { loadAsyncImageTaskArtifact = previousLoad })

	completed, executeErr := executeAsyncImageTask(ctx, &model.Task{
		TaskID:   "task_responses_output_lease",
		Status:   model.TaskStatusInProgress,
		Data:     payloadData,
		Progress: "70%",
	})

	assert.False(t, completed)
	require.ErrorIs(t, executeErr, context.Canceled)
	assert.Empty(t, asyncImageOutputMaterializationSemaphore, "Responses cancellation must release the output lease")
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
		&model.ImageInputCleanup{},
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
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "test-input-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")
	t.Setenv("CRYPTO_SECRET", "test-crypto-secret")
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "true")
}

func decodeStoredAsyncImagePayload(t *testing.T, checkpoint json.RawMessage) asyncImageTaskPayload {
	t.Helper()
	plaintext, err := model.DecryptImageTaskArtifactCheckpoint(checkpoint)
	require.NoError(t, err)
	var payload asyncImageTaskPayload
	require.NoError(t, common.Unmarshal(plaintext, &payload))
	return payload
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
		UserSetting: dto.UserSetting{
			BillingPreference:     "wallet_only",
			QuotaWarningThreshold: -1,
		},
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

	apiErr := SubmitAsyncImage(c, info, info.Request.(*dto.ImageRequest), nil)
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
	payload := decodeStoredAsyncImagePayload(t, task.CheckpointData)
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

func TestSubmitAsyncImageEncryptsPromptAndBillingRequestSnapshotAtRest(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	user, token := seedAsyncImageSubmitIdentity(t)
	info := newAsyncImageSubmitRelayInfo(user, token, 120)
	request := info.Request.(*dto.ImageRequest)
	request.Prompt = "checkpoint-prompt-secret"
	request.User = json.RawMessage(`"request-user-secret"`)
	billingBody := []byte(`{"model":"gpt-image-2","prompt":"checkpoint-prompt-secret","user":"billing-user-secret"}`)
	info.BillingRequestInput = &billingexpr.RequestInput{
		Headers: map[string]string{"X-Trace-Id": "billing-trace-secret"},
		Body:    billingBody,
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	apiErr := SubmitAsyncImage(c, info, request, nil)
	require.Nil(t, apiErr)

	var rawCheckpoint, rawPrivateData []byte
	row := model.DB.Raw("SELECT checkpoint_data, private_data FROM tasks WHERE platform = ?", constant.TaskPlatformOpenAIImage).Row()
	require.NoError(t, row.Scan(&rawCheckpoint, &rawPrivateData))
	for _, secret := range []string{
		"checkpoint-prompt-secret",
		"request-user-secret",
		"billing-user-secret",
		"billing-trace-secret",
		base64.StdEncoding.EncodeToString(billingBody),
	} {
		assert.NotContains(t, string(rawCheckpoint), secret)
		assert.NotContains(t, string(rawPrivateData), secret)
	}

	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	payload := decodeStoredAsyncImagePayload(t, task.CheckpointData)
	require.NotNil(t, payload.Request)
	assert.Equal(t, request.Prompt, payload.Request.Prompt)
	assert.JSONEq(t, string(request.User), string(payload.Request.User))

	require.NotNil(t, task.PrivateData.BillingContext)
	assert.Nil(t, task.PrivateData.BillingContext.BillingRequestInput)
	assert.NotEmpty(t, task.PrivateData.BillingContext.EncryptedBillingRequestInput)
	restoredBillingInput, err := task.PrivateData.BillingContext.ResolveBillingRequestInput()
	require.NoError(t, err)
	require.NotNil(t, restoredBillingInput)
	assert.Equal(t, billingBody, restoredBillingInput.Body)
	assert.Equal(t, "billing-trace-secret", restoredBillingInput.Headers["X-Trace-Id"])
}

func TestSubmitAsyncImageDoesNotPersistStagedMaskSourceInBillingSnapshot(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	user, token := seedAsyncImageSubmitIdentity(t)
	info := newAsyncImageSubmitRelayInfo(user, token, 120)
	info.RelayMode = relayconstant.RelayModeImagesEdits
	request := info.Request.(*dto.ImageRequest)
	request.Images = json.RawMessage(`["data:image/png;base64,cHJpdmF0ZS1pbWFnZQ=="]`)
	request.Image = json.RawMessage(`"data:image/png;base64,cHJpdmF0ZS1pbWFnZQ=="`)
	request.Mask = json.RawMessage(`"data:image/png;base64,cHJpdmF0ZS1tYXNr"`)
	info.BillingRequestInput = &billingexpr.RequestInput{Body: []byte(`{
		"model":"gpt-image-2",
		"prompt":"edit",
		"images":["data:image/png;base64,cHJpdmF0ZS1pbWFnZQ=="],
		"mask":"data:image/png;base64,cHJpdmF0ZS1tYXNr",
		"input":{
			"image_input":["data:image/png;base64,cHJpdmF0ZS1pbWFnZQ=="],
			"mask":"data:image/png;base64,bmVzdGVkLXByaXZhdGUtbWFzaw=="
		}
	}`)}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", nil)

	apiErr := SubmitAsyncImage(
		c,
		info,
		request,
		&PreparedAsyncImageInputs{ObjectKeys: []string{"inputs/source.png"}, MaskObjectKey: "inputs/mask.png"},
		&PreparedAsyncImageRequest{ConfigurationStored: true, RelayMode: relayconstant.RelayModeImagesEdits},
	)
	require.Nil(t, apiErr)

	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	restoredBillingInput, err := task.PrivateData.BillingContext.ResolveBillingRequestInput()
	require.NoError(t, err)
	require.NotNil(t, restoredBillingInput)
	assert.NotContains(t, string(restoredBillingInput.Body), "cHJpdmF0ZS1pbWFnZQ==")
	assert.NotContains(t, string(restoredBillingInput.Body), "cHJpdmF0ZS1tYXNr")
	assert.NotContains(t, string(restoredBillingInput.Body), "bmVzdGVkLXByaXZhdGUtbWFzaw==")

	var fields map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(restoredBillingInput.Body, &fields))
	assert.JSONEq(t, `"r2-input"`, string(fields["mask"]))
	var nestedInput map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(fields["input"], &nestedInput))
	assert.JSONEq(t, `"r2-input"`, string(nestedInput["mask"]))
}

func TestRunAsyncImageWorkContinuesPastUnrecoverableStaleReservation(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	staleAt := time.Now().Add(-2 * asyncImageReservationStaleAfter).Unix()
	task := &model.Task{
		TaskID:     "task_poison_stale_reservation",
		Platform:   constant.TaskPlatformOpenAIImage,
		UserId:     999999,
		Status:     model.TaskStatusReserving,
		Progress:   "0%",
		SubmitTime: staleAt,
		CreatedAt:  staleAt,
		UpdatedAt:  staleAt,
	}
	require.NoError(t, model.DB.Create(task).Error)
	require.NoError(t, model.DB.Create(&model.ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         task.UserId,
		ExpectedQuota:  1,
		WalletReserved: 1,
		FundingSource:  "wallet",
		Status:         model.ImageBillingReservationPreparing,
		CreatedAt:      staleAt,
		UpdatedAt:      staleAt,
	}).Error)

	result, err := runAsyncImageWork(context.Background())

	require.NoError(t, err)
	assert.Zero(t, result.Completed)
	var stored model.ImageBillingReservation
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	assert.Equal(t, model.ImageBillingReservationPreparing, stored.Status)
}

func TestSubmitAsyncImageReservesQuotaBeforeStoringInputs(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	user, token := seedAsyncImageSubmitIdentity(t)
	info := newAsyncImageSubmitRelayInfo(user, token, 120)
	request := info.Request.(*dto.ImageRequest)
	request.Images = json.RawMessage(`["https://source.example.com/reference.png"]`)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	originalStore := storeAsyncImageSources
	t.Cleanup(func() { storeAsyncImageSources = originalStore })
	storeObserved := false
	storeAsyncImageSources = func(_ context.Context, response *dto.ImageResponse) (*storedAsyncImageSources, error) {
		storeObserved = true
		require.Len(t, response.Data, 1)
		assert.Equal(t, "https://source.example.com/reference.png", response.Data[0].Url)

		var reservingTask model.Task
		require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&reservingTask).Error)
		assert.Equal(t, model.TaskStatus(model.TaskStatusReserving), reservingTask.Status)
		assert.Empty(t, reservingTask.CheckpointData)
		reservation, err := model.GetImageBillingReservation(reservingTask.TaskID)
		require.NoError(t, err)
		assert.Equal(t, model.ImageBillingReservationPreparing, reservation.Status)
		assert.Equal(t, 120, reservation.WalletReserved)
		assert.Equal(t, 120, reservation.TokenReserved)
		require.NoError(t, model.DB.First(user, user.Id).Error)
		assert.Equal(t, 880, user.Quota)
		require.NoError(t, model.DB.First(token, token.Id).Error)
		assert.Equal(t, 880, token.RemainQuota)

		return &storedAsyncImageSources{
			URLs:       []string{"https://private.example.com/input.png?X-Amz-Signature=temporary-secret"},
			ObjectKeys: []string{"inputs/reference.png"},
		}, nil
	}

	apiErr := SubmitAsyncImage(c, info, request, nil)

	require.Nil(t, apiErr)
	assert.True(t, storeObserved)
	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusNotStart), task.Status)
	assert.NotContains(t, string(task.CheckpointData), "temporary-secret")
	payload := decodeStoredAsyncImagePayload(t, task.CheckpointData)
	assert.Equal(t, []string{"inputs/reference.png"}, payload.InputObjectKeys)
	var cleanup model.ImageInputCleanup
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&cleanup).Error)
	assert.Equal(t, model.ImageInputCleanupWaiting, cleanup.Status)
	assert.False(t, model.HasDueImageInputCleanups(common.GetTimestamp()))
}

func TestSubmitAsyncImageInputStorageFailureRefundsDurableReservation(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	user, token := seedAsyncImageSubmitIdentity(t)
	info := newAsyncImageSubmitRelayInfo(user, token, 120)
	request := info.Request.(*dto.ImageRequest)
	request.Images = json.RawMessage(`["https://source.example.com/reference.png"]`)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	originalStore := storeAsyncImageSources
	t.Cleanup(func() { storeAsyncImageSources = originalStore })
	storeAsyncImageSources = func(_ context.Context, _ *dto.ImageResponse) (*storedAsyncImageSources, error) {
		return nil, errors.New("input storage unavailable")
	}

	apiErr := SubmitAsyncImage(c, info, request, nil)

	require.NotNil(t, apiErr)
	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusFailure), task.Status)
	reservation, err := model.GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.ImageBillingReservationRefunded, reservation.Status)
	require.NoError(t, model.DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, model.DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
	applied, err := model.RefundImageBillingReservation(task.TaskID, "duplicate refund")
	require.NoError(t, err)
	assert.False(t, applied)
}

func TestSubmitAsyncImageInsufficientQuotaTerminalizesPreparedTask(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	user, token := seedAsyncImageSubmitIdentity(t)
	info := newAsyncImageSubmitRelayInfo(user, token, 1200)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	apiErr := SubmitAsyncImage(c, info, info.Request.(*dto.ImageRequest), nil)
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

	apiErr := SubmitAsyncImage(c, info, info.Request.(*dto.ImageRequest), nil, &PreparedAsyncImageRequest{
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
		ChannelSetting: &dto.ChannelSettings{
			Proxy:                "http://proxy-user:proxy-secret@proxy.example.com",
			SystemPrompt:         "operator-system-prompt-secret",
			SystemPromptOverride: true,
		},
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
	payload := decodeStoredAsyncImagePayload(t, task.CheckpointData)
	require.NotNil(t, payload.PreparedRequest)
	assert.Empty(t, payload.PreparedRequest.ChannelBaseURL)
	assert.Empty(t, payload.PreparedRequest.HeadersOverride)
	require.NotNil(t, payload.PreparedRequest.ChannelSetting)
	assert.Empty(t, payload.PreparedRequest.ChannelSetting.Proxy)
	assert.Empty(t, payload.PreparedRequest.ChannelSetting.SystemPrompt)
	assert.False(t, payload.PreparedRequest.ChannelSetting.SystemPromptOverride)
	require.NotNil(t, payload.PreparedRequest.ChannelOtherSettings)
	assert.Nil(t, payload.PreparedRequest.ChannelOtherSettings.AdvancedCustom)
	assert.Nil(t, payload.PreparedRequest.AdvancedRoute)
	assert.NotEmpty(t, payload.PreparedRequest.AdvancedRouteHash)

	checkpoint := string(task.CheckpointData)
	assert.NotContains(t, checkpoint, "base-secret")
	assert.NotContains(t, checkpoint, "header-secret")
	assert.NotContains(t, checkpoint, "proxy-secret")
	assert.NotContains(t, checkpoint, "operator-system-prompt-secret")
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
	genericImageExecutorRegistry.executor = func(_ context.Context, request *GenericImageExecutionRequest) (*GenericImageExecutionResult, *types.NewAPIError) {
		if request.BeforeProviderCall != nil {
			require.NoError(t, request.BeforeProviderCall())
		}
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
	assert.NotContains(t, string(persisted.CheckpointData), providerServer.URL)
	checkpointData, err := model.DecryptImageTaskArtifactCheckpoint(persisted.CheckpointData)
	require.NoError(t, err)
	var persistedPayload asyncImageTaskPayload
	require.NoError(t, common.Unmarshal(checkpointData, &persistedPayload))
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

func TestAsyncImageAdaptorCheckpointFailureNeverCallsProviderTwice(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.ImageTaskArtifactChunk{}, &model.Log{}))

	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = previousMemoryCacheEnabled })

	baseURL := "https://upstream.example.com"
	channel := &model.Channel{
		Type:        constant.ChannelTypeOpenAI,
		Key:         "upstream-key",
		Status:      common.ChannelStatusEnabled,
		Name:        "checkpoint failure test",
		CreatedTime: 1700000010,
		BaseURL:     &baseURL,
		Models:      "dall-e-3",
		Group:       "default",
	}
	require.NoError(t, model.DB.Create(channel).Error)
	user := &model.User{Username: "checkpoint-failure-user", Quota: 0, Status: common.UserStatusEnabled, Group: "default"}
	require.NoError(t, model.DB.Create(user).Error)

	payload := asyncImageTaskPayload{
		Version:  asyncImagePayloadVersion,
		Executor: AsyncImageExecutorAdaptor,
		Request:  &dto.ImageRequest{Model: "dall-e-3", Prompt: "checkpoint once"},
		PreparedRequest: &PreparedAsyncImageRequest{
			Body:              []byte(`{"model":"dall-e-3","prompt":"checkpoint once"}`),
			ContentType:       "application/json",
			RequestURLPath:    "/v1/images/generations",
			ChannelBaseURL:    baseURL,
			APIType:           constant.APITypeOpenAI,
			ChannelType:       constant.ChannelTypeOpenAI,
			ChannelCreateTime: channel.CreatedTime,
		},
	}
	task := &model.Task{
		TaskID:    "task_checkpoint_failure_once",
		Platform:  constant.TaskPlatformOpenAIImage,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Quota:     0,
		Status:    model.TaskStatusInProgress,
		Attempt:   1,
		Progress:  "10%",
		Properties: model.Properties{
			OriginModelName:   "dall-e-3",
			UpstreamModelName: "dall-e-3",
		},
		PrivateData: model.TaskPrivateData{
			ChannelKeyHash: common.GenerateHMAC(channel.Key),
			BillingContext: &model.TaskBillingContext{PerCallBilling: true},
		},
	}
	task.SetCheckpointData(payload)
	require.NoError(t, model.DB.Create(task).Error)

	var providerCalls atomic.Int32
	genericImageExecutorRegistry.Lock()
	previousExecutor := genericImageExecutorRegistry.executor
	genericImageExecutorRegistry.executor = func(_ context.Context, request *GenericImageExecutionRequest) (*GenericImageExecutionResult, *types.NewAPIError) {
		if request.BeforeProviderCall != nil {
			require.NoError(t, request.BeforeProviderCall())
		}
		providerCalls.Add(1)
		providerResponse := &GenericImageUpstreamResponse{
			StatusCode: http.StatusOK,
			Body:       json.RawMessage(`{"created":1,"data":[{"b64_json":"iVBORw0KGgo="}]}`),
		}
		if err := request.Checkpoint(providerResponse); err != nil {
			return nil, types.NewError(fmt.Errorf("%w: %w", ErrGenericImageCheckpoint, err), types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
		}
		return nil, types.NewError(errors.New("checkpoint unexpectedly succeeded"), types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}
	genericImageExecutorRegistry.Unlock()
	t.Cleanup(func() {
		genericImageExecutorRegistry.Lock()
		genericImageExecutorRegistry.executor = previousExecutor
		genericImageExecutorRegistry.Unlock()
	})

	previousPersist := persistAsyncImageTaskArtifact
	persistAsyncImageTaskArtifact = func(_ *model.Task, _ []byte, _ []byte, _ string) (bool, error) {
		return false, errors.New("injected checkpoint persistence failure")
	}
	t.Cleanup(func() { persistAsyncImageTaskArtifact = previousPersist })

	previousLogDB := model.LOG_DB
	model.LOG_DB = model.DB
	t.Cleanup(func() { model.LOG_DB = previousLogDB })

	completed, err := executeAsyncImageTask(context.Background(), task)
	require.NoError(t, err)
	assert.False(t, completed)
	assert.Equal(t, int32(1), providerCalls.Load())

	var stored model.Task
	require.NoError(t, model.DB.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusFailure), stored.Status)
	assert.Contains(t, stored.FailReason, "ambiguous")

	// Neither stale-claim recovery nor another worker pass may reopen provider
	// submission after the failed post-response checkpoint.
	require.NoError(t, model.RequeueStaleInProgressImageTasks(time.Now().Unix(), time.Now().Unix()))
	_, err = recoverCheckpointPendingImageTasks(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int32(1), providerCalls.Load())
}

func TestAsyncImageResponsesCheckpointFailureNeverCallsProviderTwice(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.ImageTaskArtifactChunk{}, &model.Log{}))

	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = previousMemoryCacheEnabled })

	imageResult := base64.StdEncoding.EncodeToString([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x01})
	var providerCalls atomic.Int32
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		providerCalls.Add(1)
		w.Header().Set("Content-Type", "text/event-stream")
		_, writeErr := fmt.Fprintf(w,
			"data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"image_generation_call\",\"result\":%q}}\n\n"+
				"data: {\"type\":\"response.completed\",\"response\":{\"model\":\"gpt-image-1\",\"usage\":{\"input_tokens\":1,\"output_tokens\":1}}}\n\n",
			imageResult,
		)
		require.NoError(t, writeErr)
	}))
	defer provider.Close()

	baseURL := provider.URL
	channel := &model.Channel{
		Type:        constant.ChannelTypeOpenAI,
		Key:         "responses-key",
		Status:      common.ChannelStatusEnabled,
		Name:        "responses checkpoint failure test",
		CreatedTime: 1700000020,
		BaseURL:     &baseURL,
		Models:      "gpt-image-1",
		Group:       "default",
	}
	require.NoError(t, model.DB.Create(channel).Error)
	user := &model.User{Username: "responses-checkpoint-failure-user", Quota: 0, Status: common.UserStatusEnabled, Group: "default"}
	require.NoError(t, model.DB.Create(user).Error)
	payload := asyncImageTaskPayload{
		Version:           asyncImagePayloadVersion,
		Executor:          AsyncImageExecutorResponses,
		RelayMode:         relayconstant.RelayModeImagesGenerations,
		Request:           &dto.ImageRequest{Model: "gpt-image-1", Prompt: "checkpoint once"},
		ChannelType:       channel.Type,
		ChannelCreateTime: channel.CreatedTime,
	}
	task := &model.Task{
		TaskID:    "task_responses_checkpoint_failure_once",
		Platform:  constant.TaskPlatformOpenAIImage,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Quota:     0,
		Status:    model.TaskStatusInProgress,
		Attempt:   1,
		Progress:  "10%",
		Properties: model.Properties{
			OriginModelName:   "gpt-image-1",
			UpstreamModelName: "gpt-image-1",
		},
		PrivateData: model.TaskPrivateData{
			ChannelKeyHash: common.GenerateHMAC(channel.Key),
			BillingContext: &model.TaskBillingContext{PerCallBilling: true},
		},
	}
	task.SetCheckpointData(payload)
	require.NoError(t, model.DB.Create(task).Error)

	previousPersist := persistAsyncImageTaskArtifact
	persistAsyncImageTaskArtifact = func(_ *model.Task, _ []byte, _ []byte, _ string) (bool, error) {
		return false, errors.New("injected Responses checkpoint persistence failure")
	}
	t.Cleanup(func() { persistAsyncImageTaskArtifact = previousPersist })

	previousLogDB := model.LOG_DB
	model.LOG_DB = model.DB
	t.Cleanup(func() { model.LOG_DB = previousLogDB })

	completed, err := executeAsyncImageTask(context.Background(), task)
	require.NoError(t, err)
	assert.False(t, completed)
	assert.Equal(t, int32(1), providerCalls.Load())

	var stored model.Task
	require.NoError(t, model.DB.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusFailure), stored.Status)
	assert.Contains(t, stored.FailReason, "ambiguous")

	// A later recovery pass cannot reopen the terminal task or contact upstream.
	persistAsyncImageTaskArtifact = previousPersist
	_, err = recoverCheckpointPendingImageTasks(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int32(1), providerCalls.Load())
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
	config.PublicBase = "https://account.r2.cloudflarestorage.com"
	assert.False(t, config.Enabled(), "the S3 API endpoint is not a public delivery URL")
	config.PublicBase = "https://cdn.example.com"
	assert.False(t, config.InputEnabled())
	config.InputBucket = "private-inputs"
	assert.True(t, config.InputEnabled())
	config.InputBucket = config.Bucket
	assert.False(t, config.InputEnabled())
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

func TestR2PutInputImageReturnsFiniteSignedPrivateURL(t *testing.T) {
	raw := append([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, []byte("reference")...)
	var putPaths []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		assert.Equal(t, http.MethodPut, request.Method)
		putPaths = append(putPaths, request.URL.Path)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	config := R2Config{
		AccessKeyID:     "access-key",
		SecretAccessKey: "secret-key",
		AccountID:       "account",
		Bucket:          "images",
		InputBucket:     "private-inputs",
		PublicBase:      "https://public.example.com",
		Endpoint:        server.URL,
	}
	signedURL, key, format, err := config.PutInputImageDeduped(context.Background(), raw, "png")
	require.NoError(t, err)
	assert.Regexp(t, `^inputs/[0-9a-f]{32}/`+sha256HexBytes(raw)+`\.png$`, key)
	assert.Equal(t, "png", format)
	assert.NotContains(t, signedURL, config.PublicBase)

	parsed, err := url.Parse(signedURL)
	require.NoError(t, err)
	assert.Equal(t, "/private-inputs/"+key, parsed.Path)
	assert.Equal(t, fmt.Sprint(int64(asyncImageInputURLTTL/time.Second)), parsed.Query().Get("X-Amz-Expires"))
	assert.Greater(t, asyncImageInputURLTTL, 5*time.Minute)
	assert.LessOrEqual(t, asyncImageInputURLTTL, 10*time.Minute)
	assert.NotEmpty(t, parsed.Query().Get("X-Amz-Credential"))
	assert.NotEmpty(t, parsed.Query().Get("X-Amz-Signature"))

	_, secondKey, _, err := config.PutInputImageDeduped(context.Background(), raw, "png")
	require.NoError(t, err)
	assert.NotEqual(t, key, secondKey)
	assert.Equal(t, []string{"/private-inputs/" + key, "/private-inputs/" + secondKey}, putPaths)
}

func TestHydrateAsyncImageInputObjectsCreatesFreshSignedURLs(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "access-key")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "secret-key")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "account")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "images")
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "private-inputs")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")
	original := &dto.ImageRequest{Model: "nano-banana-2", Prompt: "edit"}

	hydrated, err := hydrateAsyncImageInputObjects(context.Background(), original, []string{"inputs/reference.png"})

	require.NoError(t, err)
	urls, err := hydrated.ImageInputURLs()
	require.NoError(t, err)
	require.Len(t, urls, 1)
	parsed, err := url.Parse(urls[0])
	require.NoError(t, err)
	assert.Equal(t, "/private-inputs/inputs/reference.png", parsed.Path)
	assert.NotEmpty(t, parsed.Query().Get("X-Amz-Signature"))
	assert.Empty(t, original.Images)
}

func TestSubmitAsyncImagePersistsInputKeysInsteadOfSignedURLs(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	user, token := seedAsyncImageSubmitIdentity(t)
	info := newAsyncImageSubmitRelayInfo(user, token, 120)
	request := info.Request.(*dto.ImageRequest)
	signedURL := "https://account.r2.cloudflarestorage.com/private-inputs/inputs/reference.png?X-Amz-Signature=temporary-secret"
	request.Images = json.RawMessage(`["` + signedURL + `"]`)
	request.Image = json.RawMessage(`"` + signedURL + `"`)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	apiErr := SubmitAsyncImage(c, info, request, &PreparedAsyncImageInputs{ObjectKeys: []string{"inputs/reference.png"}})

	require.Nil(t, apiErr)
	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	assert.NotContains(t, string(task.CheckpointData), "temporary-secret")
	payload := decodeStoredAsyncImagePayload(t, task.CheckpointData)
	assert.Equal(t, []string{"inputs/reference.png"}, payload.InputObjectKeys)
	assert.Empty(t, payload.Request.Images)
	assert.Empty(t, payload.Request.Image)
	var cleanup model.ImageInputCleanup
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&cleanup).Error)
	assert.Equal(t, model.ImageInputCleanupWaiting, cleanup.Status)
}

func TestValidateAsyncImageRequestSupportsAllAsyncImageDelivery(t *testing.T) {
	zero := uint(0)
	tooMany := uint(dto.MaxImageN + 1)
	stream := true
	longPrompt := strings.Repeat("p", dto.MaxUnifiedImagePromptLength+1)
	tests := []struct {
		name    string
		request *dto.ImageRequest
		message string
	}{
		{name: "missing prompt", request: &dto.ImageRequest{}, message: "prompt is required"},
		{name: "streaming", request: &dto.ImageRequest{Prompt: "cat", Stream: &stream}, message: "stream=true"},
		{name: "zero images", request: &dto.ImageRequest{Prompt: "cat", N: &zero}, message: "between 1"},
		{name: "too many images", request: &dto.ImageRequest{Prompt: "cat", N: &tooMany}, message: "between 1"},
		{name: "prompt too long", request: &dto.ImageRequest{Prompt: longPrompt}, message: "prompt is too long"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateAsyncImageRequest(test.request)
			require.Error(t, err)
			assert.Contains(t, err.Error(), test.message)
		})
	}
	assert.NoError(t, validateAsyncImageRequest(&dto.ImageRequest{Prompt: "cat"}))
	assert.NoError(t, validateAsyncImageRequest(&dto.ImageRequest{Prompt: strings.Repeat("图", dto.MaxUnifiedImagePromptLength)}))
	assert.ErrorContains(t, validateAsyncImageRequest(&dto.ImageRequest{Prompt: strings.Repeat("图", dto.MaxUnifiedImagePromptLength+1)}), "prompt is too long")
	two := uint(2)
	assert.NoError(t, validateAsyncImageRequest(&dto.ImageRequest{Prompt: "cat", N: &two, ResponseFormat: "b64_json"}))
}

func TestValidateAsyncImageModelInputEnforcesProviderContracts(t *testing.T) {
	require.ErrorContains(t,
		validateAsyncImageModelInput("gpt-image-2-image-to-image", "gpt-image-2", &dto.ImageRequest{Prompt: "edit"}),
		"input_urls is required",
	)

	images := make([]string, 15)
	for index := range images {
		images[index] = fmt.Sprintf("https://example.com/%d.png", index)
	}
	encoded, err := common.Marshal(images)
	require.NoError(t, err)
	require.ErrorContains(t,
		validateAsyncImageModelInput("nano-banana-2", "gemini-3.1-flash-image-preview", &dto.ImageRequest{
			Prompt: "compose",
			Images: encoded,
		}),
		"at most 14",
	)

	require.NoError(t, validateAsyncImageModelInput(
		"gpt-image-2-image-to-image",
		"gpt-image-2",
		&dto.ImageRequest{Prompt: "edit", Images: json.RawMessage(`["https://example.com/source.png"]`)},
	))
	require.ErrorContains(t,
		validateAsyncImageModelInput("public-alias", "mapped-model", &dto.ImageRequest{
			Model:  "gpt-image-2-image-to-image",
			Prompt: "edit",
		}),
		"input_urls is required",
	)
}

func TestValidateAsyncImageSubmissionRejectsProviderNativeInput(t *testing.T) {
	request := &dto.ImageRequest{
		Model:  "qwen-image-edit-plus",
		Prompt: "restyle the source",
		Extra: map[string]json.RawMessage{
			"input": json.RawMessage(`{
				"messages":[{"role":"user","content":[{"image":"data:image/png;base64,secret"}]}]
			}`),
		},
	}

	err := ValidateAsyncImageSubmission(request.Model, request.Model, request)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "use input.prompt and input.image_input")
}

func TestValidateAsyncImageSubmissionBoundsAndSanitizesExtensionFields(t *testing.T) {
	t.Run("oversized", func(t *testing.T) {
		request := &dto.ImageRequest{
			Model:  "image-model",
			Prompt: "draw",
			Extra: map[string]json.RawMessage{
				"payload": json.RawMessage(`"` + strings.Repeat("x", maxAsyncImageRequestExtensionBytes) + `"`),
			},
		}

		err := ValidateAsyncImageSubmission(request.Model, request.Model, request)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "extension fields exceed")
	})

	t.Run("sensitive key", func(t *testing.T) {
		request := &dto.ImageRequest{
			Model:  "image-model",
			Prompt: "draw",
			Extra: map[string]json.RawMessage{
				"provider_secret": json.RawMessage(`"do-not-store"`),
			},
		}

		err := ValidateAsyncImageSubmission(request.Model, request.Model, request)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "credentials or secrets")
	})

	t.Run("nested sensitive key", func(t *testing.T) {
		request := &dto.ImageRequest{
			Model:       "image-model",
			Prompt:      "draw",
			ExtraFields: json.RawMessage(`{"provider":{"api_key":"do-not-store"}}`),
		}

		err := ValidateAsyncImageSubmission(request.Model, request.Model, request)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "credentials or secrets")
	})

	for _, key := range []string{"apiSecret", "secretKey", "bearerToken"} {
		t.Run("camel case sensitive key "+key, func(t *testing.T) {
			request := &dto.ImageRequest{
				Model:  "image-model",
				Prompt: "draw",
				Extra: map[string]json.RawMessage{
					key: json.RawMessage(`"do-not-store"`),
				},
			}

			err := ValidateAsyncImageSubmission(request.Model, request.Model, request)

			require.Error(t, err)
			assert.Contains(t, err.Error(), "credentials or secrets")
		})
	}

	for _, key := range []string{"imageURL", "inputImageURL", "referenceImageURL", "imageURI"} {
		t.Run("acronym image key "+key, func(t *testing.T) {
			request := &dto.ImageRequest{
				Model:  "image-model",
				Prompt: "draw",
				Extra: map[string]json.RawMessage{
					key: json.RawMessage(`"opaque-provider-value"`),
				},
			}

			err := ValidateAsyncImageSubmission(request.Model, request.Model, request)

			require.Error(t, err)
			assert.Contains(t, err.Error(), "use input.image_input")
		})
	}

	t.Run("unknown extension URL", func(t *testing.T) {
		request := &dto.ImageRequest{
			Model:  "image-model",
			Prompt: "draw",
			Extra: map[string]json.RawMessage{
				"photo": json.RawMessage(`"https://example.com/private-reference.png?token=secret"`),
			},
		}

		err := ValidateAsyncImageSubmission(request.Model, request.Model, request)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "use input.image_input")
	})

	pngBase64 := base64.StdEncoding.EncodeToString([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'})
	for _, tt := range []struct {
		name  string
		value string
	}{
		{name: "protocol relative URL", value: "//source.example.com/reference.png"},
		{name: "ftp URL", value: "ftp://source.example.com/reference.png"},
		{name: "object storage URI", value: "s3://private-bucket/reference.png"},
		{name: "raw image base64", value: pngBase64},
	} {
		t.Run(tt.name, func(t *testing.T) {
			encoded, marshalErr := common.Marshal(tt.value)
			require.NoError(t, marshalErr)
			request := &dto.ImageRequest{
				Model:  "image-model",
				Prompt: "draw",
				Extra: map[string]json.RawMessage{
					"photo": encoded,
				},
			}

			err := ValidateAsyncImageSubmission(request.Model, request.Model, request)

			require.Error(t, err)
			assert.Contains(t, err.Error(), "use input.image_input")
		})
	}

	t.Run("provider image alias", func(t *testing.T) {
		request := &dto.ImageRequest{
			Model:       "black-forest-labs/flux",
			Prompt:      "restyle",
			ExtraFields: json.RawMessage(`{"image_prompt":"data:image/png;base64,c2VjcmV0"}`),
		}

		err := ValidateAsyncImageSubmission(request.Model, request.Model, request)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "use input.image_input")
	})

	t.Run("nested unified image alias", func(t *testing.T) {
		var request dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{
			"model":"image-model",
			"input":{"prompt":"restyle","reference_image":"https://example.com/source.png"}
		}`), &request))

		err := ValidateAsyncImageSubmission(request.Model, request.Model, &request)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "use input.image_input")
	})

	t.Run("mask extension", func(t *testing.T) {
		request := &dto.ImageRequest{
			Model:  "image-model",
			Prompt: "edit",
			Mask:   json.RawMessage(`"data:image/png;base64,bWFzaw=="`),
		}

		err := ValidateAsyncImageSubmission(request.Model, request.Model, request)

		require.NoError(t, err)
	})

	t.Run("ordinary provider options", func(t *testing.T) {
		request := &dto.ImageRequest{
			Model:       "image-model",
			Prompt:      "draw",
			ExtraFields: json.RawMessage(`{"seed":123,"guidance_scale":7.5}`),
			Extra: map[string]json.RawMessage{
				"negative_prompt": json.RawMessage(`"rain"`),
			},
		}

		assert.NoError(t, ValidateAsyncImageSubmission(request.Model, request.Model, request))
	})
}

func TestValidateAsyncImageSubmissionUsesMappedGPTModelConstraints(t *testing.T) {
	request := &dto.ImageRequest{
		Model:  "gpt-image-2",
		Prompt: "draw",
		Size:   "1440x1440",
	}
	require.NoError(t, ValidateAsyncImageSubmission("gpt-image-1", "gpt-image-2", request))

	request.Model = "gpt-image-1"
	err := ValidateAsyncImageSubmission("gpt-image-2", "gpt-image-1", request)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not supported")
}

func TestValidateAsyncImageSubmissionBoundsGeminiThreeReferenceImages(t *testing.T) {
	urls := make([]string, 15)
	for index := range urls {
		urls[index] = fmt.Sprintf("https://example.com/reference-%d.png", index)
	}
	encoded, err := common.Marshal(urls)
	require.NoError(t, err)

	for _, model := range []string{
		"nano-banana-2",
		"gemini-3-pro-image",
		"models/gemini-3.1-flash-image",
	} {
		request := &dto.ImageRequest{Model: model, Prompt: "edit", Images: json.RawMessage(encoded)}
		err := ValidateAsyncImageSubmission(model, model, request)
		require.Error(t, err, model)
		assert.Contains(t, err.Error(), "at most 14", model)
	}
}

func TestEncodeAsyncImageTaskPayloadBoundsCheckpoint(t *testing.T) {
	_, err := encodeAsyncImageTaskPayload(asyncImageTaskPayload{
		Request: &dto.ImageRequest{Model: "image-model", Prompt: "draw"},
		PreparedRequest: &PreparedAsyncImageRequest{
			Body: bytes.Repeat([]byte("x"), maxAsyncImageCheckpointBytes),
		},
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "task payload exceeds")
}

func TestShouldRunAsyncForEveryImageGeneration(t *testing.T) {
	assert.True(t, ShouldRunAsync("gpt-image-2", nil))
	assert.True(t, ShouldRunAsync("dall-e-3", nil))

	enabled := true
	disabled := false
	assert.True(t, ShouldRunAsync("mapped-image-alias", &enabled))
	assert.True(t, ShouldRunAsync("gpt-image-2", &disabled))
}

func TestValidateAsyncImageDeliveryRequiresStableCryptoSecret(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	t.Setenv("CRYPTO_SECRET", "")
	t.Setenv("SESSION_SECRET", "session-secret-is-not-an-async-image-key")

	apiErr := ValidateAsyncImageDelivery(&dto.ImageRequest{Model: "gpt-image-2", Prompt: "cat"})

	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusServiceUnavailable, apiErr.StatusCode)
	assert.Contains(t, apiErr.Error(), "stable CRYPTO_SECRET")
}

func TestValidateAsyncImageDeliveryRejectsPlaintextWrites(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")

	apiErr := ValidateAsyncImageDelivery(&dto.ImageRequest{Model: "gpt-image-2", Prompt: "cat"})

	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusServiceUnavailable, apiErr.StatusCode)
	assert.Contains(t, apiErr.Error(), "ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED=true")
}

func TestValidateAsyncImageDeliveryAllowsEncryptedWritesWithDedicatedSecret(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)

	apiErr := ValidateAsyncImageDelivery(&dto.ImageRequest{Model: "gpt-image-2", Prompt: "cat"})

	require.Nil(t, apiErr)
}

func TestSanitizeAsyncImageClientHeadersUsesExplicitAllowlist(t *testing.T) {
	headers := http.Header{
		"X-Trace-Id":              []string{"trace-123"},
		"Traceparent":             []string{"00-abc-def-01"},
		"Cf-Access-Jwt-Assertion": []string{"infrastructure-secret"},
		"X-Ssl-Client-Cert":       []string{"client-certificate"},
		"Authorization":           []string{"Bearer client-secret"},
	}

	sanitized := SanitizeAsyncImageClientHeaders(headers)

	assert.Equal(t, "trace-123", sanitized["X-Trace-Id"])
	assert.Equal(t, "00-abc-def-01", sanitized["Traceparent"])
	assert.NotContains(t, sanitized, "Cf-Access-Jwt-Assertion")
	assert.NotContains(t, sanitized, "X-Ssl-Client-Cert")
	assert.NotContains(t, sanitized, "Authorization")
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

func TestAsyncImageMultipartIdempotencyConflictsWhenImageChanges(t *testing.T) {
	buildContext := func(t *testing.T, imageBytes []byte) *gin.Context {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.SetBoundary("stable-idempotency-boundary"))
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		require.NoError(t, writer.WriteField("prompt", "restyle"))
		part, err := writer.CreateFormFile("image", "source.png")
		require.NoError(t, err)
		_, err = part.Write(imageBytes)
		require.NoError(t, err)
		require.NoError(t, writer.Close())

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		c.Request.Header.Set("Idempotency-Key", "same-edit-key")
		return c
	}

	request := &dto.ImageRequest{Model: "gpt-image-1", Prompt: "restyle"}
	firstContext := buildContext(t, []byte("first-image"))
	defer common.CleanupBodyStorage(firstContext)
	_, firstHash, err := asyncImageIdempotency(firstContext, request)
	require.NoError(t, err)

	secondContext := buildContext(t, []byte("second-image"))
	defer common.CleanupBodyStorage(secondContext)
	_, secondHash, err := asyncImageIdempotency(secondContext, request)
	require.NoError(t, err)
	require.NotEqual(t, firstHash, secondHash)

	task := &model.Task{Status: model.TaskStatusNotStart, PrivateData: model.TaskPrivateData{ClientRequestHash: firstHash}}
	apiErr := writeReplayedAsyncImageTask(secondContext, task, secondHash)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusConflict, apiErr.StatusCode)
	assert.Contains(t, apiErr.Error(), "different request")
}

func TestAsyncImageMultipartIdempotencyIgnoresBoundaryHeadersAndPartOrder(t *testing.T) {
	buildContext := func(t *testing.T, boundary, filename string, fileFirst bool) *gin.Context {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.SetBoundary(boundary))
		writeFile := func() {
			part, err := writer.CreateFormFile("image", filename)
			require.NoError(t, err)
			_, err = part.Write([]byte("same-image-bytes"))
			require.NoError(t, err)
		}
		if fileFirst {
			writeFile()
		}
		require.NoError(t, writer.WriteField("prompt", "restyle"))
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		if !fileFirst {
			writeFile()
		}
		require.NoError(t, writer.Close())

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		c.Request.Header.Set("Idempotency-Key", "same-edit-key")
		t.Cleanup(func() { common.CleanupBodyStorage(c) })
		return c
	}

	request := &dto.ImageRequest{Model: "gpt-image-1", Prompt: "restyle"}
	first := buildContext(t, "first-boundary", "first-name.png", false)
	_, firstHash, err := asyncImageIdempotency(first, request)
	require.NoError(t, err)

	second := buildContext(t, "second-boundary", "renamed-input.webp", true)
	_, secondHash, err := asyncImageIdempotency(second, request)
	require.NoError(t, err)

	assert.Equal(t, firstHash, secondHash)
}

func TestAsyncImageMultipartIdempotencyPreservesRepeatedImageOrder(t *testing.T) {
	buildContext := func(t *testing.T, images ...string) *gin.Context {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		require.NoError(t, writer.WriteField("prompt", "combine"))
		for index, image := range images {
			part, err := writer.CreateFormFile("image[]", fmt.Sprintf("source-%d.png", index))
			require.NoError(t, err)
			_, err = part.Write([]byte(image))
			require.NoError(t, err)
		}
		require.NoError(t, writer.Close())

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		c.Request.Header.Set("Idempotency-Key", "ordered-edit")
		t.Cleanup(func() { common.CleanupBodyStorage(c) })
		return c
	}

	request := &dto.ImageRequest{Model: "gpt-image-1", Prompt: "combine"}
	first := buildContext(t, "foreground", "background")
	_, firstHash, err := asyncImageIdempotency(first, request)
	require.NoError(t, err)

	second := buildContext(t, "background", "foreground")
	_, secondHash, err := asyncImageIdempotency(second, request)
	require.NoError(t, err)

	assert.NotEqual(t, firstHash, secondHash)
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

	for _, test := range []struct {
		model   string
		quality string
	}{
		{model: "dall-e"},
		{model: "dall-e-2"},
		{model: "dall-e-3", quality: "standard"},
	} {
		t.Run(test.model, func(t *testing.T) {
			base := &dto.ImageRequest{Model: test.model, Prompt: "cat"}
			_, baseHash, err := asyncImageIdempotency(c, base)
			require.NoError(t, err)
			explicit := &dto.ImageRequest{
				Model:   test.model,
				Prompt:  "cat",
				N:       &one,
				Size:    "1024x1024",
				Quality: test.quality,
			}
			_, explicitHash, err := asyncImageIdempotency(c, explicit)
			require.NoError(t, err)
			assert.Equal(t, baseHash, explicitHash)
		})
	}
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
	var deliveryURLs []string
	var deliverySecrets []string
	attempt := 0
	sendAsyncImageWebhook = func(_ context.Context, webhookURL string, secret string, deliveryID string, _ any) error {
		deliveryIDs = append(deliveryIDs, deliveryID)
		deliveryURLs = append(deliveryURLs, webhookURL)
		deliverySecrets = append(deliverySecrets, secret)
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
	assert.Equal(t, []string{"https://example.com/hook", "https://example.com/hook"}, deliveryURLs)
	assert.Equal(t, []string{"webhook-secret", "webhook-secret"}, deliverySecrets)
	require.NoError(t, model.DB.First(hook, hook.ID).Error)
	assert.Equal(t, model.TaskWebhookStatusDelivered, hook.Status)
}

func TestDeliverDueImageWebhooksQuarantinesUnreadableCredentialsPerRow(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	now := common.GetTimestamp()
	badTask := &model.Task{
		TaskID:     "task_webhook_bad_credentials",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     model.TaskStatusSuccess,
		SubmitTime: now,
	}
	goodTask := &model.Task{
		TaskID:     "task_webhook_good_credentials",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     model.TaskStatusSuccess,
		SubmitTime: now,
	}
	require.NoError(t, model.DB.Create(badTask).Error)
	require.NoError(t, model.DB.Create(goodTask).Error)
	badHook := &model.TaskWebhook{TaskID: badTask.TaskID, URL: "https://bad.example.com/hook", Secret: "bad-secret"}
	goodHook := &model.TaskWebhook{TaskID: goodTask.TaskID, URL: "https://good.example.com/hook", Secret: "good-secret"}
	require.NoError(t, model.DB.Create(badHook).Error)
	require.NoError(t, model.DB.Create(goodHook).Error)
	require.NoError(t, model.DB.Model(&model.TaskWebhook{}).Where("id = ?", badHook.ID).Update("url", "enc:v1:not-base64").Error)

	previousSender := sendAsyncImageWebhook
	var calls atomic.Int32
	sendAsyncImageWebhook = func(_ context.Context, webhookURL string, secret string, _ string, _ any) error {
		calls.Add(1)
		assert.Equal(t, "https://good.example.com/hook", webhookURL)
		assert.Equal(t, "good-secret", secret)
		return nil
	}
	t.Cleanup(func() { sendAsyncImageWebhook = previousSender })

	delivered, retried, err := deliverDueImageWebhooks(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, delivered)
	assert.Zero(t, retried)
	assert.Equal(t, int32(1), calls.Load())
	require.NoError(t, model.DB.First(badHook, badHook.ID).Error)
	assert.Equal(t, model.TaskWebhookStatusFailed, badHook.Status)
	assert.Equal(t, "webhook credentials decryption failed", badHook.LastError)
	require.NoError(t, model.DB.First(goodHook, goodHook.ID).Error)
	assert.Equal(t, model.TaskWebhookStatusDelivered, goodHook.Status)
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

func TestLoadAsyncImageChannelRejectsExecutionOverrideDrift(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}))
	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = previousMemoryCacheEnabled })

	baseURL := "https://images.example.com"
	paramOverride := `{"n":2}`
	headerOverride := `{"X-Provider-Option":"submitted"}`
	channel := &model.Channel{
		Type:           constant.ChannelTypeOpenAI,
		Key:            "submitted-key",
		Status:         common.ChannelStatusEnabled,
		CreatedTime:    1700000200,
		BaseURL:        &baseURL,
		ParamOverride:  &paramOverride,
		HeaderOverride: &headerOverride,
	}
	require.NoError(t, model.DB.Create(channel).Error)
	fingerprint, err := AsyncImageExecutionOverrideFingerprint(channel.GetParamOverride(), channel.GetHeaderOverride())
	require.NoError(t, err)
	task := &model.Task{
		ChannelId: channel.Id,
		PrivateData: model.TaskPrivateData{
			ChannelKeyHash: common.GenerateHMAC(channel.Key),
		},
	}
	prepared := &PreparedAsyncImageRequest{
		APIType:                 constant.APITypeOpenAI,
		ChannelType:             channel.Type,
		ChannelCreateTime:       channel.CreatedTime,
		ChannelBaseURL:          baseURL,
		ExecutionOverrideHash:   fingerprint,
		ExecutionOverrideStored: true,
	}

	_, _, err = loadAsyncImageChannel(task, prepared, false)
	require.NoError(t, err)

	changedOverride := `{"n":3}`
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("param_override", changedOverride).Error)
	_, _, err = loadAsyncImageChannel(task, prepared, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "overrides changed")
}

func TestLoadAsyncImageChannelRejectsAdvancedRouteDriftWithoutPersistingTarget(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}))
	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = previousMemoryCacheEnabled })

	baseURL := "https://images.example.com"
	route := dto.AdvancedCustomRoute{
		IncomingPath: "/v1/images/generations",
		UpstreamPath: "https://provider.example.com/hooks/path-secret/images/{model}",
		Converter:    "none",
		Auth: &dto.AdvancedCustomRouteAuth{
			Type:  dto.AdvancedCustomAuthTypeHeader,
			Name:  "X-Provider-Key",
			Value: "header-secret",
		},
	}
	settings, err := common.Marshal(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{route}}})
	require.NoError(t, err)
	channel := &model.Channel{
		Type:          constant.ChannelTypeAdvancedCustom,
		Key:           "submitted-key",
		Status:        common.ChannelStatusEnabled,
		CreatedTime:   1700000300,
		BaseURL:       &baseURL,
		OtherSettings: string(settings),
	}
	require.NoError(t, model.DB.Create(channel).Error)
	routeHash, err := AsyncImageAdvancedRouteFingerprint(route)
	require.NoError(t, err)
	task := &model.Task{
		ChannelId:   channel.Id,
		Properties:  model.Properties{OriginModelName: "image-alias"},
		PrivateData: model.TaskPrivateData{ChannelKeyHash: common.GenerateHMAC(channel.Key)},
	}
	prepared := &PreparedAsyncImageRequest{
		APIType:                 constant.APITypeAdvancedCustom,
		ChannelType:             channel.Type,
		ChannelCreateTime:       channel.CreatedTime,
		RequestURLPath:          "/v1/images/generations",
		AdvancedRouteHash:       routeHash,
		ExecutionOverrideHash:   common.GenerateHMAC(`{}`),
		ExecutionOverrideStored: false,
	}

	_, _, err = loadAsyncImageChannel(task, prepared, false)
	require.NoError(t, err)
	encoded, err := common.Marshal(prepared)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "path-secret")
	assert.NotContains(t, string(encoded), "header-secret")

	route.UpstreamPath = "https://provider.example.com/hooks/rotated/images/{model}"
	changedSettings, err := common.Marshal(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{route}}})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("settings", string(changedSettings)).Error)
	_, _, err = loadAsyncImageChannel(task, prepared, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "route changed")
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
	assert.Equal(t, channel.GetParamOverride(), info.ChannelMeta.ParamOverride)
	assert.Empty(t, info.ChannelMeta.ChannelSetting.Proxy)
	assert.True(t, info.ChannelMeta.ChannelOtherSettings.DisableTaskPollingSleep)
	assert.NotContains(t, info.ChannelMeta.HeadersOverride, "X-Submitted")
	assert.Equal(t, "changed", info.ChannelMeta.HeadersOverride["X-Current"])
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

func TestGenericAsyncImageRelayInfoUsesCurrentFingerprintValidatedAdvancedRoute(t *testing.T) {
	currentRoute := dto.AdvancedCustomRoute{
		IncomingPath: "/v1/images/generations",
		UpstreamPath: "https://changed.example.com/images",
		Converter:    "none",
	}
	currentSettings, err := common.Marshal(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{currentRoute},
	}})
	require.NoError(t, err)
	routeHash, err := AsyncImageAdvancedRouteFingerprint(currentRoute)
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
		APIType:           constant.APITypeAdvancedCustom,
		ContentType:       "application/json",
		RequestURLPath:    "/v1/images/generations",
		AdvancedRouteHash: routeHash,
	}

	info := genericAsyncImageRelayInfo(task, channel, "upstream-key", prepared)

	assert.Equal(t, "https://changed.example.com", info.ChannelMeta.ChannelBaseUrl)
	require.NotNil(t, info.ChannelMeta.ChannelOtherSettings.AdvancedCustom)
	route, ok := info.ChannelMeta.ChannelOtherSettings.AdvancedCustom.MatchPathForModel("/v1/images/generations", "image-alias")
	require.True(t, ok)
	assert.Equal(t, currentRoute.UpstreamPath, route.UpstreamPath)
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
	assert.Equal(t, relayconstant.RelayModeImagesGenerations, payload.RelayMode)

	editCheckpoint, err := common.Marshal(asyncImageTaskPayload{
		RelayMode: relayconstant.RelayModeImagesEdits,
		Request:   &dto.ImageRequest{Model: "gpt-image-1", Prompt: "edit prompt"},
		PreparedRequest: &PreparedAsyncImageRequest{
			RelayMode:      relayconstant.RelayModeImagesEdits,
			RequestURLPath: "/v1/images/edits",
		},
	})
	require.NoError(t, err)
	editPayload, err := decodeAsyncImageTaskPayload(editCheckpoint)
	require.NoError(t, err)
	assert.Equal(t, relayconstant.RelayModeImagesEdits, editPayload.RelayMode)
	require.NotNil(t, editPayload.PreparedRequest)
	assert.Equal(t, relayconstant.RelayModeImagesEdits, editPayload.PreparedRequest.RelayMode)

	legacy, err := common.Marshal(&dto.ImageRequest{Model: "gpt-image-2", Prompt: "legacy prompt"})
	require.NoError(t, err)
	payload, err = decodeAsyncImageTaskPayload(legacy)
	require.NoError(t, err)
	require.NotNil(t, payload.Request)
	assert.Equal(t, "legacy prompt", payload.Request.Prompt)
	assert.Nil(t, payload.Upstream)
	assert.Equal(t, relayconstant.RelayModeImagesGenerations, payload.RelayMode)
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
		{name: "gemini native", body: `{"generationConfig":{"candidateCount":6}}`, wantCount: 6, wantFound: true},
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

	encoded, err := common.Marshal(asyncImageTaskPayload{Request: persistedAsyncImageRequest(request, nil)})
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
  "callBackUrl":"https://example.com/legacy-hook",
  "webhook_url":"https://example.com/hook",
  "webhook_secret":"do-not-persist",
  "parameters":{"seed":123},
  "input":{
    "prompt":"cat",
    "async":false,
    "callBackUrl":"https://example.com/nested-hook",
    "webhook_url":"https://example.com/nested-webhook",
    "webhook_secret":"nested-secret",
    "resolution":"2K"
  }
}`)

	sanitized, err := sanitizeAsyncBillingRequestBody(body)
	require.NoError(t, err)
	assert.NotContains(t, string(sanitized), "do-not-persist")

	var fields map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(sanitized, &fields))
	assert.NotContains(t, fields, "async")
	assert.NotContains(t, fields, "callBackUrl")
	assert.NotContains(t, fields, "webhook_url")
	assert.NotContains(t, fields, "webhook_secret")
	assert.Contains(t, fields, "prompt")
	assert.Contains(t, fields, "quality")
	assert.Contains(t, fields, "parameters")
	var input map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(fields["input"], &input))
	assert.NotContains(t, input, "async")
	assert.NotContains(t, input, "callBackUrl")
	assert.NotContains(t, input, "webhook_url")
	assert.NotContains(t, input, "webhook_secret")
	assert.Contains(t, input, "prompt")
	assert.Contains(t, input, "resolution")
}

func TestSanitizeAsyncBillingRequestBodyReplacesOriginalImageSources(t *testing.T) {
	body := []byte(`{
		"prompt":"edit",
		"images":["https://source.example.com/image.png?signature=secret"],
		"input":{
			"prompt":"edit",
			"input_urls":["data:image/png;base64,private-image"]
		}
	}`)
	stored := &dto.ImageRequest{
		Images: json.RawMessage(`["https://cdn.example.com/images/stored.png"]`),
		Image:  json.RawMessage(`"https://cdn.example.com/images/stored.png"`),
	}

	sanitized, err := sanitizeAsyncBillingRequestBody(body, stored)
	require.NoError(t, err)
	assert.NotContains(t, string(sanitized), "signature=secret")
	assert.NotContains(t, string(sanitized), "private-image")
	assert.Contains(t, string(sanitized), "https://cdn.example.com/images/stored.png")

	var fields map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(sanitized, &fields))
	assert.JSONEq(t, string(stored.Images), string(fields["images"]))
	var input map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(fields["input"], &input))
	assert.JSONEq(t, string(stored.Images), string(input["input_urls"]))
}

func TestSanitizeAsyncBillingRequestBodyForTaskDoesNotPersistSignedInputURLs(t *testing.T) {
	body := []byte(`{
		"prompt":"edit",
		"images":["https://source.example.com/image.png?signature=secret"],
		"input":{"input_urls":["https://private-inputs.example/inputs/hash.png?X-Amz-Signature=secret"]}
	}`)
	stored := &dto.ImageRequest{
		Images: json.RawMessage(`[
			"https://account.r2.cloudflarestorage.com/private-inputs/inputs/hash.png?X-Amz-Signature=temporary"
		]`),
		Image: json.RawMessage(`"https://account.r2.cloudflarestorage.com/private-inputs/inputs/hash.png?X-Amz-Signature=temporary"`),
	}

	sanitized, err := sanitizeAsyncBillingRequestBodyForTask(body, stored, []string{"inputs/hash.png"}, "")

	require.NoError(t, err)
	assert.NotContains(t, string(sanitized), "X-Amz-Signature")
	assert.NotContains(t, string(sanitized), "signature=secret")
	assert.Contains(t, string(sanitized), "r2-input")
	var fields map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(sanitized, &fields))
	assert.JSONEq(t, `["r2-input"]`, string(fields["images"]))
}

func TestSanitizeAsyncBillingRequestBodyForTaskReplacesStagedMasks(t *testing.T) {
	body := []byte(`{
		"mask":"data:image/png;base64,top-level-private-mask",
		"input":{"mask":"data:image/png;base64,nested-private-mask"}
	}`)

	sanitized, err := sanitizeAsyncBillingRequestBodyForTask(body, &dto.ImageRequest{}, nil, "inputs/mask.png")

	require.NoError(t, err)
	assert.NotContains(t, string(sanitized), "top-level-private-mask")
	assert.NotContains(t, string(sanitized), "nested-private-mask")
	var fields map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(sanitized, &fields))
	assert.JSONEq(t, `"r2-input"`, string(fields["mask"]))
	var input map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(fields["input"], &input))
	assert.JSONEq(t, `"r2-input"`, string(input["mask"]))
}

func TestSanitizeAsyncBillingRequestBodyRejectsMalformedJSON(t *testing.T) {
	_, err := sanitizeAsyncBillingRequestBody([]byte(`{"webhook_secret":`))
	require.Error(t, err)
}
