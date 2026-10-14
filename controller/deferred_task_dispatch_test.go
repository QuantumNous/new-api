package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relaydto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const legacyDeferredDispatchStatusRunningForTest = model.TaskDispatchStatus("running")

func TestDispatchDeferredTaskRebuildsCredentialsAndSubmits(t *testing.T) {
	previousDB := model.DB
	previousMemoryCache := common.MemoryCacheEnabled
	previousRedisEnabled := common.RedisEnabled
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&model.User{}, &model.Token{}, &model.Channel{}, &model.Task{}))
	model.DB = database
	common.MemoryCacheEnabled = false
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		common.MemoryCacheEnabled = previousMemoryCache
		common.RedisEnabled = previousRedisEnabled
	})
	require.NoError(t, database.Create(&model.User{
		Id:       71,
		Username: "deferred-user",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	token := &model.Token{
		UserId:      71,
		Key:         "deferred-token",
		Status:      common.TokenStatusEnabled,
		ExpiredTime: -1,
	}
	require.NoError(t, database.Create(token).Error)

	upstreamCalls := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls++
		assert.Equal(t, "/kling/v1/videos/text2video", r.URL.Path)
		assert.Equal(t, "Bearer sk-current", r.Header.Get("Authorization"))
		body, readErr := io.ReadAll(r.Body)
		require.NoError(t, readErr)
		assert.Contains(t, string(body), `"model_name":"kling-v1"`)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"code":0,"data":{"task_id":"upstream-deferred"}}`)
	}))
	defer upstream.Close()

	channel := &model.Channel{
		Type:    constant.ChannelTypeKling,
		Name:    "deferred-kling",
		Key:     "sk-current",
		BaseURL: &upstream.URL,
		Status:  common.ChannelStatusEnabled,
		Models:  "kling-v1",
		Group:   "default",
	}
	require.NoError(t, database.Create(channel).Error)

	task := &model.Task{
		TaskID:         "task_deferred_public",
		Platform:       constant.TaskPlatform("kling"),
		UserId:         71,
		Group:          "default",
		ChannelId:      channel.Id,
		Action:         constant.TaskActionTextToVideo,
		Status:         model.TaskStatusNotStart,
		Progress:       "0%",
		Quota:          123,
		ExecutionMode:  model.TaskExecutionModeDeferred,
		DispatchStatus: model.TaskDispatchStatusRunning,
		DispatchOwner:  "runner",
		Properties: model.Properties{
			OriginModelName:   "kling-v1",
			UpstreamModelName: "kling-v1",
		},
		PrivateData: model.TaskPrivateData{
			TokenId: token.Id,
			Execution: &model.TaskExecutionSnapshot{
				TaskPlugin: &model.TaskPluginSnapshot{Key: "kling", Version: "1.0.0"},
			},
			DeferredRequest: &model.TaskDeferredRequest{
				Path:        "/v1/responses",
				Method:      http.MethodPost,
				Headers:     map[string]string{"Content-Type": "application/json"},
				RouteBody:   json.RawMessage(`{"kind":"json","value":{"model":"kling-v1"}}`),
				RequestBody: json.RawMessage(`{"model":"kling-v1","prompt":"a lighthouse","duration":5}`),
			},
			BillingContext: &model.TaskBillingContext{
				OriginModelName: "kling-v1",
				GroupRatio:      1,
				PerCallBilling:  true,
			},
		},
	}

	privateJSON, err := json.Marshal(task.PrivateData)
	require.NoError(t, err)
	assert.NotContains(t, string(privateJSON), "sk-current")
	require.NoError(t, database.Create(task).Error)

	result, taskErr := dispatchDeferredTask(context.Background(), task)
	require.Nil(t, taskErr)
	require.NotNil(t, result)
	assert.Equal(t, "upstream-deferred", result.UpstreamTaskID)
	assert.Equal(t, 123, result.Quota)
	assert.Equal(t, 1, upstreamCalls)
}

func TestDeferredCancellationImmediatelyBeforeFenceRequeuesWithoutProviderIO(t *testing.T) {
	database, user, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_cancel_before_fence",
	)
	dispatchContext, cancel := context.WithCancel(t.Context())
	var providerCalls atomic.Int32
	handler := deferredTaskDispatchHandler{
		submit: func(
			_ *gin.Context,
			_ *relaycommon.RelayInfo,
			_ constant.TaskPlatform,
			_ int,
			beforeProviderSubmit func() error,
		) (*relay.TaskSubmitResult, *dto.TaskError) {
			cancel()
			if err := beforeProviderSubmit(); err != nil {
				return nil, service.TaskErrorWrapperLocal(
					err,
					"deferred_dispatch_cancelled",
					http.StatusRequestTimeout,
				)
			}
			providerCalls.Add(1)
			return nil, service.TaskErrorWrapperLocal(
				dispatchContext.Err(),
				"deferred_dispatch_cancelled",
				http.StatusRequestTimeout,
			)
		},
	}

	runDeferredDispatcherWithContext(t, dispatchContext, "runner-cancel-before-fence", handler)

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.Zero(t, providerCalls.Load())
	assert.Equal(t, model.TaskDispatchStatusPending, stored.DispatchStatus)
	assert.Empty(t, stored.DispatchOwner)
	assert.Zero(t, stored.DispatchLockUntil)
	assert.Contains(t, stored.DispatchError, context.Canceled.Error())
	assert.Equal(t, 1, stored.DispatchAttempts)
	assert.Equal(t, task.Quota, stored.Quota)

	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, user.Quota, storedUser.Quota)
}

func TestDeferredCancellationAfterFenceBeforeDoRequeuesWithoutProviderIO(t *testing.T) {
	service.InitHttpClient()
	var providerCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		providerCalls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"code":0,"data":{"task_id":"must-not-submit"}}`)
	}))
	defer upstream.Close()

	database, user, task := setupDeferredDispatchFailureFixture(
		t,
		upstream.URL,
		"",
		"task_deferred_cancel_after_fence",
	)
	dispatchContext, cancel := context.WithCancel(t.Context())
	const callbackName = "test:cancel-deferred-after-fence"
	cancelled := false
	require.NoError(t, database.Callback().Update().After("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if cancelled || tx.Statement.Table != "tasks" {
			return
		}
		updates, ok := tx.Statement.Dest.(map[string]any)
		if !ok {
			return
		}
		status, hasStatus := updates["dispatch_status"]
		lockUntil, hasLockUntil := updates["dispatch_lock_until"]
		if hasStatus && status == model.TaskDispatchStatus("uncertain") ||
			hasLockUntil && lockUntil == int64(math.MaxInt64) {
			cancelled = true
			cancel()
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, database.Callback().Update().Remove(callbackName))
	})

	runDeferredDispatcherWithContext(t, dispatchContext, "runner-cancel-after-fence")

	require.True(t, cancelled)
	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.Zero(t, providerCalls.Load())
	assert.Equal(t, model.TaskDispatchStatusPending, stored.DispatchStatus)
	assert.Empty(t, stored.DispatchOwner)
	assert.Zero(t, stored.DispatchLockUntil)
	assert.Contains(t, stored.DispatchError, context.Canceled.Error())
	assert.Equal(t, 1, stored.DispatchAttempts)
	assert.Equal(t, task.Quota, stored.Quota)

	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, user.Quota, storedUser.Quota)
}

func TestDeferredAcceptedCompletionFailureCannotBeRedispatched(t *testing.T) {
	previousDB := model.DB
	previousMemoryCache := common.MemoryCacheEnabled
	previousRedisEnabled := common.RedisEnabled
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(
		&model.User{},
		&model.Token{},
		&model.Channel{},
		&model.Task{},
		&model.SystemTask{},
		&model.SystemTaskLock{},
	))
	model.DB = database
	common.MemoryCacheEnabled = false
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		common.MemoryCacheEnabled = previousMemoryCache
		common.RedisEnabled = previousRedisEnabled
	})

	user := &model.User{
		Id:       73,
		Username: "deferred-completion-user",
		Group:    "default",
		Status:   common.UserStatusEnabled,
		Quota:    10_000,
	}
	require.NoError(t, database.Create(user).Error)
	token := &model.Token{
		UserId:      user.Id,
		Key:         "deferred-completion-token",
		Status:      common.TokenStatusEnabled,
		ExpiredTime: -1,
	}
	require.NoError(t, database.Create(token).Error)

	var providerRequests atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		providerRequests.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"code":0,"data":{"task_id":"accepted-once"}}`)
	}))
	defer upstream.Close()

	channel := &model.Channel{
		Type:    constant.ChannelTypeKling,
		Name:    "deferred-completion-kling",
		Key:     "sk-current",
		BaseURL: &upstream.URL,
		Status:  common.ChannelStatusEnabled,
		Models:  "kling-v1",
		Group:   "default",
	}
	require.NoError(t, database.Create(channel).Error)
	task := &model.Task{
		TaskID:         "task_deferred_completion_failure",
		Platform:       constant.TaskPlatform("kling"),
		UserId:         user.Id,
		Group:          "default",
		ChannelId:      channel.Id,
		Action:         constant.TaskActionTextToVideo,
		Status:         model.TaskStatusNotStart,
		Progress:       "0%",
		Quota:          123,
		ExecutionMode:  model.TaskExecutionModeDeferred,
		DispatchStatus: model.TaskDispatchStatusPending,
		Properties: model.Properties{
			OriginModelName:   "kling-v1",
			UpstreamModelName: "kling-v1",
		},
		PrivateData: model.TaskPrivateData{
			TokenId: token.Id,
			Execution: &model.TaskExecutionSnapshot{
				TaskPlugin: &model.TaskPluginSnapshot{Key: "kling", Version: "1.0.0"},
			},
			DeferredRequest: &model.TaskDeferredRequest{
				Path:        "/v1/responses",
				Method:      http.MethodPost,
				Headers:     map[string]string{"Content-Type": "application/json"},
				RouteBody:   json.RawMessage(`{"kind":"json","value":{"model":"kling-v1"}}`),
				RequestBody: json.RawMessage(`{"model":"kling-v1","prompt":"one request","duration":5}`),
			},
			BillingContext: &model.TaskBillingContext{
				OriginModelName: "kling-v1",
				GroupRatio:      1,
				PerCallBilling:  true,
			},
		},
	}
	require.NoError(t, database.Create(task).Error)

	const completionCallback = "test:deferred-completion-failure"
	completionFailure := errors.New("injected deferred completion failure")
	require.NoError(t, database.Callback().Update().Before("gorm:update").Register(completionCallback, func(tx *gorm.DB) {
		updates, ok := tx.Statement.Dest.(map[string]any)
		if !ok {
			return
		}
		if updates["dispatch_status"] == model.TaskDispatchStatusDispatched {
			tx.AddError(completionFailure)
		}
	}))
	callbackInstalled := true
	t.Cleanup(func() {
		if callbackInstalled {
			require.NoError(t, database.Callback().Update().Remove(completionCallback))
		}
	})

	runDispatcher := func(runnerID string) {
		systemTask, createErr := model.CreateSystemTask(model.SystemTaskTypeDeferredDispatch, nil, nil)
		require.NoError(t, createErr)
		claimed, won, claimErr := model.ClaimSystemTask(
			systemTask.ID,
			model.SystemTaskTypeDeferredDispatch,
			runnerID,
			time.Now().Add(time.Minute).Unix(),
		)
		require.NoError(t, claimErr)
		require.True(t, won)
		deferredTaskDispatchHandler{}.Run(t.Context(), claimed, runnerID)
	}

	runDispatcher("runner-first")
	require.NoError(t, database.Callback().Update().Remove(completionCallback))
	callbackInstalled = false

	var afterFailure model.Task
	require.NoError(t, database.First(&afterFailure, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusUncertain, afterFailure.DispatchStatus)
	assert.Empty(t, afterFailure.PrivateData.UpstreamTaskID)
	assert.NotNil(t, afterFailure.PrivateData.DeferredRequest)
	assert.NotZero(t, afterFailure.DispatchStartedAt)

	afterOrdinaryLeaseExpiry := time.Now().Add(deferredDispatchLease + time.Second).Unix()
	assert.Zero(t, afterFailure.DispatchLockUntil)
	reclaimed, won, claimErr := model.ClaimDeferredTask(
		task.ID,
		"runner-second",
		afterOrdinaryLeaseExpiry,
		afterOrdinaryLeaseExpiry+int64(deferredDispatchLease.Seconds()),
	)
	require.NoError(t, claimErr)
	if won {
		result, taskErr := dispatchDeferredTask(t.Context(), reclaimed)
		require.Nil(t, taskErr)
		applyDeferredTaskResult(reclaimed, result)
		_, completeErr := model.CompleteDeferredTask(reclaimed, "runner-second")
		require.NoError(t, completeErr)
	}
	assert.False(t, won, "accepted provider work must remain fenced after local persistence fails")

	var afterRetryWindow model.Task
	require.NoError(t, database.First(&afterRetryWindow, task.ID).Error)
	assert.Equal(t, 1, afterRetryWindow.DispatchAttempts)
	assert.EqualValues(t, 1, providerRequests.Load())
	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, user.Quota, storedUser.Quota, "accepted provider work must not be refunded")
}

func TestDeferredTransportAmbiguityCannotBeRedispatchedOrRefunded(t *testing.T) {
	service.InitHttpClient()
	var providerRequests atomic.Int32
	var providerReceivedBody atomic.Bool
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if !assert.NoError(t, err) {
			return
		}
		if len(body) > 0 {
			providerReceivedBody.Store(true)
		}
		providerRequests.Add(1)

		hijacker, ok := w.(http.Hijacker)
		if !assert.True(t, ok) {
			return
		}
		connection, _, err := hijacker.Hijack()
		if !assert.NoError(t, err) {
			return
		}
		_ = connection.Close()
	}))
	defer upstream.Close()

	database, user, task := setupDeferredDispatchFailureFixture(t, upstream.URL, "", "task_deferred_transport_ambiguity")
	for _, runnerID := range []string{"runner-first", "runner-second", "runner-third"} {
		runDeferredDispatcher(t, runnerID)
	}

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.True(t, providerReceivedBody.Load(), "the provider must receive request bytes before the response fails")
	assert.EqualValues(t, 1, providerRequests.Load(), "an ambiguous provider write must never be repeated")
	assert.Equal(t, 1, stored.DispatchAttempts)
	assert.Equal(t, model.TaskStatus(model.TaskStatusNotStart), stored.Status)
	assert.Equal(t, model.TaskDispatchStatusUncertain, stored.DispatchStatus)
	assert.True(t, stored.RequiresOperatorResolution())
	assert.Contains(t, stored.DispatchError, "do request failed")
	assert.Equal(t, task.Quota, stored.Quota, "an ambiguous provider write must not be refunded")

	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, user.Quota, storedUser.Quota, "an ambiguous provider write must not credit the user")

	afterLeaseExpiry := time.Now().Add(deferredDispatchLease + time.Second).Unix()
	_, reclaimed, err := model.ClaimDeferredTask(
		task.ID,
		"runner-after-lease",
		afterLeaseExpiry,
		afterLeaseExpiry+int64(deferredDispatchLease.Seconds()),
	)
	require.NoError(t, err)
	assert.False(t, reclaimed, "an ambiguous provider write must remain non-reclaimable")
}

func TestRC40DeferredEmptyResponseAfterFenceCannotBeRedispatchedOrRefunded(t *testing.T) {
	database, user, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_empty_response",
	)
	var providerAttempts atomic.Int32
	handler := deferredTaskDispatchHandler{
		submit: func(
			_ *gin.Context,
			_ *relaycommon.RelayInfo,
			_ constant.TaskPlatform,
			_ int,
			beforeProviderSubmit func() error,
		) (*relay.TaskSubmitResult, *dto.TaskError) {
			require.NoError(t, beforeProviderSubmit())
			providerAttempts.Add(1)
			taskErr := service.TaskErrorWrapperLocal(
				errors.New("upstream returned an empty response"),
				"fail_to_fetch_task",
				http.StatusBadGateway,
			)
			taskErr.NoRetry = true
			return nil, taskErr
		},
	}
	for _, runnerID := range []string{"runner-first", "runner-second", "runner-third"} {
		runDeferredDispatcher(t, runnerID, handler)
	}

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.EqualValues(t, 1, providerAttempts.Load())
	assert.Equal(t, 1, stored.DispatchAttempts)
	assert.Equal(t, model.TaskStatus(model.TaskStatusNotStart), stored.Status)
	assert.Equal(t, model.TaskDispatchStatusUncertain, stored.DispatchStatus)
	assert.True(t, stored.RequiresOperatorResolution())
	assert.Equal(t, task.Quota, stored.Quota)

	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, user.Quota, storedUser.Quota)

	afterLeaseExpiry := time.Now().Add(deferredDispatchLease + time.Second).Unix()
	_, reclaimed, err := model.ClaimDeferredTask(
		task.ID,
		"runner-after-lease",
		afterLeaseExpiry,
		afterLeaseExpiry+int64(deferredDispatchLease.Seconds()),
	)
	require.NoError(t, err)
	assert.False(t, reclaimed)
}

func TestDeferredPreProviderFailureRemainsRetryableAndRefundable(t *testing.T) {
	database, user, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"://invalid-proxy",
		"task_deferred_pre_provider_failure",
	)
	for _, runnerID := range []string{"runner-first", "runner-second", "runner-third"} {
		runDeferredDispatcher(t, runnerID)
	}

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.Equal(t, deferredDispatchMaxAttempts, stored.DispatchAttempts)
	assert.Equal(t, model.TaskStatus(model.TaskStatusFailure), stored.Status)
	assert.Equal(t, model.TaskDispatchStatusFailed, stored.DispatchStatus)
	assert.Zero(t, stored.Quota, "a definite pre-provider failure remains refundable")

	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, user.Quota+task.Quota, storedUser.Quota)
}

func setupDeferredDispatchFailureFixture(t *testing.T, baseURL, proxy, taskID string) (*gorm.DB, *model.User, *model.Task) {
	t.Helper()
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousMainDatabase := common.MainDatabaseType()
	previousLogDatabase := common.LogDatabaseType()
	previousMemoryCache := common.MemoryCacheEnabled
	previousRedisEnabled := common.RedisEnabled
	previousBatchUpdate := common.BatchUpdateEnabled
	previousDataExport := common.DataExportEnabled
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(
		&model.User{},
		&model.Token{},
		&model.Channel{},
		&model.Task{},
		&model.Log{},
		&model.AuditLog{},
		&model.SystemTask{},
		&model.SystemTaskLock{},
	))
	model.DB = database
	model.LOG_DB = database
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.MemoryCacheEnabled = false
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.DataExportEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.SetDatabaseTypes(previousMainDatabase, previousLogDatabase)
		common.MemoryCacheEnabled = previousMemoryCache
		common.RedisEnabled = previousRedisEnabled
		common.BatchUpdateEnabled = previousBatchUpdate
		common.DataExportEnabled = previousDataExport
	})

	user := &model.User{
		Id:       74,
		Username: "deferred-failure-user",
		Group:    "default",
		Status:   common.UserStatusEnabled,
		Quota:    10_000,
	}
	require.NoError(t, database.Create(user).Error)
	token := &model.Token{
		UserId:         user.Id,
		Key:            "deferred-failure-token",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}
	require.NoError(t, database.Create(token).Error)
	channel := &model.Channel{
		Type:    constant.ChannelTypeKling,
		Name:    "deferred-failure-kling",
		Key:     "sk-current",
		BaseURL: &baseURL,
		Status:  common.ChannelStatusEnabled,
		Models:  "kling-v1",
		Group:   "default",
	}
	if proxy != "" {
		channel.SetSetting(relaydto.ChannelSettings{Proxy: proxy})
	}
	require.NoError(t, database.Create(channel).Error)
	task := &model.Task{
		TaskID:         taskID,
		Platform:       constant.TaskPlatform("kling"),
		UserId:         user.Id,
		Group:          "default",
		ChannelId:      channel.Id,
		Action:         constant.TaskActionTextToVideo,
		Status:         model.TaskStatusNotStart,
		Progress:       "0%",
		Quota:          123,
		ExecutionMode:  model.TaskExecutionModeDeferred,
		DispatchStatus: model.TaskDispatchStatusPending,
		Properties: model.Properties{
			OriginModelName:   "kling-v1",
			UpstreamModelName: "kling-v1",
		},
		PrivateData: model.TaskPrivateData{
			TokenId: token.Id,
			Execution: &model.TaskExecutionSnapshot{
				TaskPlugin: &model.TaskPluginSnapshot{Key: "kling", Version: "1.0.0"},
			},
			DeferredRequest: &model.TaskDeferredRequest{
				Path:        "/v1/responses",
				Method:      http.MethodPost,
				Headers:     map[string]string{"Content-Type": "application/json"},
				RouteBody:   json.RawMessage(`{"kind":"json","value":{"model":"kling-v1"}}`),
				RequestBody: json.RawMessage(`{"model":"kling-v1","prompt":"one request","duration":5}`),
			},
			BillingContext: &model.TaskBillingContext{
				OriginModelName: "kling-v1",
				GroupRatio:      1,
				PerCallBilling:  true,
			},
		},
	}
	require.NoError(t, database.Create(task).Error)
	return database, user, task
}

func runDeferredDispatcher(t *testing.T, runnerID string, handlers ...deferredTaskDispatchHandler) {
	t.Helper()
	runDeferredDispatcherWithContext(t, t.Context(), runnerID, handlers...)
}

func runDeferredDispatcherWithContext(
	t *testing.T,
	ctx context.Context,
	runnerID string,
	handlers ...deferredTaskDispatchHandler,
) {
	t.Helper()
	handler := deferredTaskDispatchHandler{}
	if len(handlers) > 0 {
		handler = handlers[0]
	}
	systemTask, err := model.CreateSystemTask(model.SystemTaskTypeDeferredDispatch, nil, nil)
	require.NoError(t, err)
	claimed, won, err := model.ClaimSystemTask(
		systemTask.ID,
		model.SystemTaskTypeDeferredDispatch,
		runnerID,
		time.Now().Add(time.Minute).Unix(),
	)
	require.NoError(t, err)
	require.True(t, won)
	handler.Run(ctx, claimed, runnerID)
}

func TestDeferredDispatchSummaryReportsUnresolvedUncertainTasks(t *testing.T) {
	database, _, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_uncertain_summary",
	)
	handler := deferredTaskDispatchHandler{
		submit: func(
			_ *gin.Context,
			_ *relaycommon.RelayInfo,
			_ constant.TaskPlatform,
			_ int,
			beforeProviderSubmit func() error,
		) (*relay.TaskSubmitResult, *dto.TaskError) {
			require.NoError(t, beforeProviderSubmit())
			return nil, service.TaskErrorWrapper(
				errors.New("provider write outcome unknown"),
				"do_request_failed",
				http.StatusBadGateway,
			)
		},
	}
	systemTask, err := model.CreateSystemTask(model.SystemTaskTypeDeferredDispatch, nil, nil)
	require.NoError(t, err)
	claimed, won, err := model.ClaimSystemTask(
		systemTask.ID,
		model.SystemTaskTypeDeferredDispatch,
		"runner-summary",
		time.Now().Add(time.Minute).Unix(),
	)
	require.NoError(t, err)
	require.True(t, won)

	handler.Run(t.Context(), claimed, "runner-summary")

	var storedTask model.Task
	require.NoError(t, database.First(&storedTask, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusUncertain, storedTask.DispatchStatus)
	assert.Equal(t, 1, storedTask.DispatchAttempts)
	assert.Contains(t, storedTask.DispatchError, "provider write outcome unknown")

	var storedSystemTask model.SystemTask
	require.NoError(t, database.First(&storedSystemTask, systemTask.ID).Error)
	var summary deferredTaskDispatchSummary
	require.NoError(t, common.UnmarshalJsonStr(storedSystemTask.Result, &summary))
	assert.Equal(t, 1, summary.Uncertain)
}

func TestDeferredDispatchWarningOnlyRunAfterRestart(t *testing.T) {
	database, _, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_uncertain_restart",
	)
	require.NoError(t, database.Model(&model.Task{}).Where("id = ?", task.ID).Updates(map[string]any{
		"dispatch_status":     model.TaskDispatchStatusUncertain,
		"dispatch_owner":      "runner-before-crash/task",
		"dispatch_lock_until": 0,
		"dispatch_started_at": 123,
		"dispatch_attempts":   1,
		"dispatch_error":      "provider outcome unknown",
	}).Error)
	now := common.GetTimestamp()
	legacyExpired := &model.Task{
		TaskID:            "task_deferred_legacy_expired_restart",
		Status:            model.TaskStatusNotStart,
		Progress:          "0%",
		ExecutionMode:     model.TaskExecutionModeDeferred,
		DispatchStatus:    legacyDeferredDispatchStatusRunningForTest,
		DispatchOwner:     "legacy-runner-expired",
		DispatchLockUntil: now - 1,
		DispatchAttempts:  1,
	}
	legacyActive := &model.Task{
		TaskID:            "task_deferred_legacy_active_restart",
		Status:            model.TaskStatusNotStart,
		Progress:          "0%",
		ExecutionMode:     model.TaskExecutionModeDeferred,
		DispatchStatus:    legacyDeferredDispatchStatusRunningForTest,
		DispatchOwner:     "legacy-runner-active",
		DispatchLockUntil: now + 60,
		DispatchAttempts:  1,
	}
	require.NoError(t, database.Create(legacyExpired).Error)
	require.NoError(t, database.Create(legacyActive).Error)

	stale, err := model.CreateSystemTask(model.SystemTaskTypeDeferredDispatch, nil, nil)
	require.NoError(t, err)
	_, claimed, err := model.ClaimSystemTask(
		stale.ID,
		model.SystemTaskTypeDeferredDispatch,
		"runner-before-crash",
		time.Now().Add(time.Minute).Unix(),
	)
	require.NoError(t, err)
	require.True(t, claimed)
	require.NoError(t, database.Model(&model.SystemTaskLock{}).
		Where("task_id = ?", stale.TaskID).
		Update("locked_until", time.Now().Add(-time.Second).Unix()).Error)
	require.NoError(t, model.ExpireStaleSystemTaskLocks(time.Now().Unix()))

	handler := deferredTaskDispatchHandler{}
	require.True(t, handler.Enabled(), "an uncertain-only queue must schedule a warning run")
	assert.Equal(t, deferredDispatchLease, handler.Interval())

	replacement, created, err := service.EnqueueSystemTask(model.SystemTaskTypeDeferredDispatch, nil)
	require.NoError(t, err)
	require.True(t, created)
	claimedReplacement, won, err := model.ClaimSystemTask(
		replacement.ID,
		model.SystemTaskTypeDeferredDispatch,
		"runner-after-restart",
		time.Now().Add(time.Minute).Unix(),
	)
	require.NoError(t, err)
	require.True(t, won)

	var providerCalls atomic.Int32
	handler.submit = func(
		_ *gin.Context,
		_ *relaycommon.RelayInfo,
		_ constant.TaskPlatform,
		_ int,
		_ func() error,
	) (*relay.TaskSubmitResult, *dto.TaskError) {
		providerCalls.Add(1)
		return nil, service.TaskErrorWrapperLocal(
			errors.New("unexpected provider call"),
			"unexpected_provider_call",
			http.StatusInternalServerError,
		)
	}
	handler.Run(t.Context(), claimedReplacement, "runner-after-restart")

	assert.Zero(t, providerCalls.Load())
	var storedTask model.Task
	require.NoError(t, database.First(&storedTask, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusUncertain, storedTask.DispatchStatus)
	assert.Equal(t, "runner-before-crash/task", storedTask.DispatchOwner)
	assert.Equal(t, int64(123), storedTask.DispatchStartedAt)
	assert.Equal(t, 1, storedTask.DispatchAttempts)
	assert.Equal(t, "provider outcome unknown", storedTask.DispatchError)
	for _, legacy := range []*model.Task{legacyExpired, legacyActive} {
		var storedLegacy model.Task
		require.NoError(t, database.First(&storedLegacy, legacy.ID).Error)
		assert.Equal(t, legacyDeferredDispatchStatusRunningForTest, storedLegacy.DispatchStatus)
		assert.Equal(t, legacy.DispatchOwner, storedLegacy.DispatchOwner)
		assert.Equal(t, legacy.DispatchLockUntil, storedLegacy.DispatchLockUntil)
		assert.Equal(t, legacy.DispatchAttempts, storedLegacy.DispatchAttempts)
	}

	var storedSystemTask model.SystemTask
	require.NoError(t, database.First(&storedSystemTask, replacement.ID).Error)
	assert.Equal(t, model.SystemTaskStatusSucceeded, storedSystemTask.Status)
	var summary deferredTaskDispatchSummary
	require.NoError(t, common.UnmarshalJsonStr(storedSystemTask.Result, &summary))
	assert.Zero(t, summary.Found)
	assert.Zero(t, summary.Claimed)
	assert.Zero(t, summary.Dispatched)
	assert.Equal(t, 2, summary.Uncertain)
}

func TestDeferredDispatchEnabledFailsOpenAndWarnsWhenUncertainCountFails(t *testing.T) {
	database, _, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_uncertain_count_enabled",
	)
	markDeferredTaskUncertain(t, database, task, false)

	var logs bytes.Buffer
	common.LogWriterMu.Lock()
	previousWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logs
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = previousWriter
		common.LogWriterMu.Unlock()
	})

	injected := errors.New("injected uncertain count failure")
	countFailed := injectDeferredUncertainCountError(t, database, injected)

	enabled := (deferredTaskDispatchHandler{}).Enabled()

	require.True(t, countFailed.Load())
	assert.True(t, enabled, "a count failure must keep warning work eligible")
	assert.Contains(t, logs.String(), "count uncertain deferred tasks")
	assert.Contains(t, logs.String(), injected.Error())

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusUncertain, stored.DispatchStatus)
	assert.Equal(t, "private-dispatch-owner", stored.DispatchOwner)
	assert.Equal(t, int64(123), stored.DispatchStartedAt)
	assert.Equal(t, 1, stored.DispatchAttempts)
	assert.Equal(t, task.Quota, stored.Quota)
}

func TestDeferredDispatchEnabledShortCircuitsUncertainCountForDispatchableTask(t *testing.T) {
	database, _, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_count_short_circuit",
	)
	countFailed := injectDeferredUncertainCountError(
		t,
		database,
		errors.New("uncertain count must not run"),
	)

	assert.True(t, (deferredTaskDispatchHandler{}).Enabled())
	assert.False(t, countFailed.Load())

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusPending, stored.DispatchStatus)
	assert.Zero(t, stored.DispatchAttempts)
	assert.Equal(t, task.Quota, stored.Quota)
}

func TestDeferredDispatchRunFailsWithoutMutationWhenFinalUncertainCountFails(t *testing.T) {
	database, user, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_uncertain_count_run",
	)
	markDeferredTaskUncertain(t, database, task, false)
	systemTask, err := model.CreateSystemTask(model.SystemTaskTypeDeferredDispatch, nil, nil)
	require.NoError(t, err)
	claimed, won, err := model.ClaimSystemTask(
		systemTask.ID,
		model.SystemTaskTypeDeferredDispatch,
		"runner-count-error",
		time.Now().Add(time.Minute).Unix(),
	)
	require.NoError(t, err)
	require.True(t, won)

	injected := errors.New("injected final uncertain count failure")
	countFailed := injectDeferredUncertainCountError(t, database, injected)
	var providerCalls atomic.Int32
	handler := deferredTaskDispatchHandler{
		submit: func(
			_ *gin.Context,
			_ *relaycommon.RelayInfo,
			_ constant.TaskPlatform,
			_ int,
			_ func() error,
		) (*relay.TaskSubmitResult, *dto.TaskError) {
			providerCalls.Add(1)
			return nil, service.TaskErrorWrapperLocal(
				errors.New("unexpected provider call"),
				"unexpected_provider_call",
				http.StatusInternalServerError,
			)
		},
	}

	handler.Run(t.Context(), claimed, "runner-count-error")

	require.True(t, countFailed.Load())
	assert.Zero(t, providerCalls.Load())
	var storedTask model.Task
	require.NoError(t, database.First(&storedTask, task.ID).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusNotStart), storedTask.Status)
	assert.Equal(t, model.TaskDispatchStatusUncertain, storedTask.DispatchStatus)
	assert.Equal(t, "private-dispatch-owner", storedTask.DispatchOwner)
	assert.Equal(t, int64(123), storedTask.DispatchStartedAt)
	assert.Equal(t, 1, storedTask.DispatchAttempts)
	assert.Equal(t, task.Quota, storedTask.Quota)

	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, user.Quota, storedUser.Quota)
	var logCount int64
	require.NoError(t, database.Model(&model.Log{}).Count(&logCount).Error)
	assert.Zero(t, logCount)

	var storedSystemTask model.SystemTask
	require.NoError(t, database.First(&storedSystemTask, systemTask.ID).Error)
	assert.Equal(t, model.SystemTaskStatusFailed, storedSystemTask.Status)
	assert.Nil(t, storedSystemTask.ActiveKey)
	assert.Contains(t, storedSystemTask.Error, injected.Error())
	var summary deferredTaskDispatchSummary
	require.NoError(t, common.UnmarshalJsonStr(storedSystemTask.Result, &summary))
	assert.Zero(t, summary.Uncertain)
	assert.True(t, handler.Enabled(), "a count failure must remain retry-eligible")
}

func TestResolveDeferredTaskProviderAcceptedRequiresRootAndAuditsSafeMetadata(t *testing.T) {
	database, user, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_resolution_accepted",
	)
	markDeferredTaskUncertain(t, database, task, false)
	const accessToken = "deferred-resolution-root-token"
	user.Role = common.RoleAdminUser
	user.AccessToken = stringPointer(accessToken)
	user.AuthVersion = 1
	require.NoError(t, database.Save(user).Error)
	router := deferredResolutionTestRouter()

	adminResponse := postDeferredResolution(
		t,
		router,
		task.TaskID,
		accessToken,
		`{"resolution":"provider_accepted","upstream_task_id":" upstream-accepted ","reason":" verified in provider console "}`,
	)
	require.Equal(t, http.StatusForbidden, adminResponse.Code)
	var unchanged model.Task
	require.NoError(t, database.First(&unchanged, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusUncertain, unchanged.DispatchStatus)

	require.NoError(t, database.Model(user).Update("role", common.RoleRootUser).Error)
	rootResponse := postDeferredResolution(
		t,
		router,
		task.TaskID,
		accessToken,
		`{"resolution":"provider_accepted","upstream_task_id":" upstream-accepted ","reason":" verified in provider console "}`,
	)
	require.Equal(t, http.StatusOK, rootResponse.Code, rootResponse.Body.String())
	assert.NotContains(t, rootResponse.Body.String(), "refunded")

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusDispatched, stored.DispatchStatus)
	assert.Equal(t, model.TaskStatus(model.TaskStatusSubmitted), stored.Status)
	assert.Equal(t, "10%", stored.Progress)
	assert.Equal(t, "upstream-accepted", stored.PrivateData.UpstreamTaskID)
	assert.Nil(t, stored.PrivateData.DeferredRequest)
	assert.Equal(t, task.Quota, stored.Quota)
	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, user.Quota, storedUser.Quota)
	var refundLogs int64
	require.NoError(t, database.Model(&model.Log{}).Where("type = ?", model.LogTypeRefund).Count(&refundLogs).Error)
	assert.Zero(t, refundLogs)

	var audit model.AuditLog
	require.NoError(t, database.Where("action = ?", "task.deferred_resolution").First(&audit).Error)
	auditJSON, err := common.Marshal(audit.Other)
	require.NoError(t, err)
	assert.Contains(t, string(auditJSON), task.TaskID)
	assert.Contains(t, string(auditJSON), "provider_accepted")
	assert.Contains(t, string(auditJSON), "verified in provider console")
	assert.Contains(t, string(auditJSON), `"upstream_id_attached":true`)
	assert.NotContains(t, string(auditJSON), "refunded")
	assert.NotContains(t, string(auditJSON), "upstream-accepted")
	assert.NotContains(t, string(auditJSON), "private request")

	repeat := postDeferredResolution(
		t,
		router,
		task.TaskID,
		accessToken,
		`{"resolution":"provider_accepted","upstream_task_id":"upstream-accepted","reason":"repeat"}`,
	)
	assert.Equal(t, http.StatusConflict, repeat.Code)
	require.NoError(t, database.Model(&model.AuditLog{}).
		Where("action = ?", "task.deferred_resolution").
		Count(&refundLogs).Error)
	assert.EqualValues(t, 1, refundLogs)
}

func TestResolveDeferredTaskProviderNotAcceptedIsUnsupportedAndPreservesAccounting(t *testing.T) {
	database, user, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_resolution_unsupported",
	)
	markDeferredTaskUncertain(t, database, task, false)
	router, accessToken := makeDeferredResolutionRoot(t, database, user)

	response := postDeferredResolution(
		t,
		router,
		task.TaskID,
		accessToken,
		`{"resolution":"provider_not_accepted","reason":"provider confirms no task exists"}`,
	)
	assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), `"code":"invalid_resolution"`)

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusUncertain, stored.DispatchStatus)
	assert.Equal(t, model.TaskStatus(model.TaskStatusNotStart), stored.Status)
	assert.Equal(t, "0%", stored.Progress)
	assert.Equal(t, task.PrivateData.DeferredRequest, stored.PrivateData.DeferredRequest)
	assert.Equal(t, task.Quota, stored.Quota)

	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, user.Quota, storedUser.Quota)

	var refundLogs int64
	require.NoError(t, database.Model(&model.Log{}).Where("type = ?", model.LogTypeRefund).Count(&refundLogs).Error)
	assert.Zero(t, refundLogs)

	var resolutionAudits int64
	require.NoError(t, database.Model(&model.AuditLog{}).
		Where("action = ?", "task.deferred_resolution").
		Count(&resolutionAudits).Error)
	assert.Zero(t, resolutionAudits)
}

func TestResolveDeferredTaskAbandonUnknownPreservesQuota(t *testing.T) {
	database, user, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_resolution_abandon",
	)
	markDeferredTaskUncertain(t, database, task, false)
	router, accessToken := makeDeferredResolutionRoot(t, database, user)

	response := postDeferredResolution(
		t,
		router,
		task.TaskID,
		accessToken,
		`{"resolution":"abandon_unknown","reason":"operator accepts unresolved accounting"}`,
	)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.NotContains(t, response.Body.String(), "refunded")

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusFailed, stored.DispatchStatus)
	assert.Equal(t, model.TaskStatus(model.TaskStatusFailure), stored.Status)
	assert.Nil(t, stored.PrivateData.DeferredRequest)
	assert.Equal(t, task.Quota, stored.Quota)
	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, user.Quota, storedUser.Quota)
	var refundLogs int64
	require.NoError(t, database.Model(&model.Log{}).Where("type = ?", model.LogTypeRefund).Count(&refundLogs).Error)
	assert.Zero(t, refundLogs)
}

func TestResolveDeferredTaskRecognizesLegacyFence(t *testing.T) {
	database, user, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_resolution_legacy",
	)
	markDeferredTaskUncertain(t, database, task, true)
	router, accessToken := makeDeferredResolutionRoot(t, database, user)

	response := postDeferredResolution(
		t,
		router,
		task.TaskID,
		accessToken,
		`{"resolution":"provider_accepted","upstream_task_id":"legacy-upstream","reason":"legacy row reconciled"}`,
	)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusDispatched, stored.DispatchStatus)
	assert.Equal(t, "legacy-upstream", stored.PrivateData.UpstreamTaskID)
}

func TestResolveDeferredTaskRecognizesExpiredLegacyFiniteLease(t *testing.T) {
	database, user, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_resolution_legacy_finite",
	)
	now := common.GetTimestamp()
	require.NoError(t, database.Model(&model.Task{}).Where("id = ?", task.ID).Updates(map[string]any{
		"dispatch_status":     legacyDeferredDispatchStatusRunningForTest,
		"dispatch_owner":      "legacy-runner",
		"dispatch_lock_until": now + 60,
		"dispatch_attempts":   1,
	}).Error)
	router, accessToken := makeDeferredResolutionRoot(t, database, user)

	activeResponse := postDeferredResolution(
		t,
		router,
		task.TaskID,
		accessToken,
		`{"resolution":"provider_accepted","upstream_task_id":"too-early","reason":"lease remains active"}`,
	)
	require.Equal(t, http.StatusConflict, activeResponse.Code, activeResponse.Body.String())

	require.NoError(t, database.Model(&model.Task{}).Where("id = ?", task.ID).
		Update("dispatch_lock_until", now-1).Error)
	expiredResponse := postDeferredResolution(
		t,
		router,
		task.TaskID,
		accessToken,
		`{"resolution":"provider_accepted","upstream_task_id":"legacy-finite-upstream","reason":"legacy lease expired"}`,
	)
	require.Equal(t, http.StatusOK, expiredResponse.Code, expiredResponse.Body.String())

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusDispatched, stored.DispatchStatus)
	assert.Equal(t, "legacy-finite-upstream", stored.PrivateData.UpstreamTaskID)
	assert.Nil(t, stored.PrivateData.DeferredRequest)
}

func TestResolveDeferredTaskRejectsMalformedAndWrongState(t *testing.T) {
	database, user, task := setupDeferredDispatchFailureFixture(
		t,
		"http://provider.invalid",
		"",
		"task_deferred_resolution_validation",
	)
	markDeferredTaskUncertain(t, database, task, false)
	router, accessToken := makeDeferredResolutionRoot(t, database, user)
	for _, body := range []string{
		`{"resolution":"provider_accepted","upstream_task_id":"upstream","reason":""}`,
		`{"resolution":"provider_accepted","reason":"missing upstream"}`,
		`{"resolution":"retry","reason":"not allowed"}`,
		`{"resolution":"provider_accepted","upstream_task_id":"` + strings.Repeat("x", 513) + `","reason":"too long"}`,
		`{"resolution":"abandon_unknown","reason":"` + strings.Repeat("x", 2001) + `"}`,
	} {
		response := postDeferredResolution(t, router, task.TaskID, accessToken, body)
		assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
	}

	var stored model.Task
	require.NoError(t, database.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskDispatchStatusUncertain, stored.DispatchStatus)
	assert.Equal(t, task.Quota, stored.Quota)

	require.NoError(t, database.Model(&model.Task{}).Where("id = ?", task.ID).
		Update("dispatch_status", model.TaskDispatchStatusPending).Error)
	wrongState := postDeferredResolution(
		t,
		router,
		task.TaskID,
		accessToken,
		`{"resolution":"abandon_unknown","reason":"wrong state"}`,
	)
	assert.Equal(t, http.StatusConflict, wrongState.Code)
	missing := postDeferredResolution(
		t,
		router,
		"task_missing",
		accessToken,
		`{"resolution":"abandon_unknown","reason":"missing"}`,
	)
	assert.Equal(t, http.StatusNotFound, missing.Code)
}

func deferredResolutionTestRouter() *gin.Engine {
	router := gin.New()
	router.POST(
		"/api/task/:task_id/deferred-resolution",
		middleware.RootAuth(),
		ResolveDeferredTask,
	)
	return router
}

func makeDeferredResolutionRoot(
	t *testing.T,
	database *gorm.DB,
	user *model.User,
) (*gin.Engine, string) {
	t.Helper()
	accessToken := "deferred-resolution-root-" + user.Username
	user.Role = common.RoleRootUser
	user.AccessToken = stringPointer(accessToken)
	user.AuthVersion = 1
	require.NoError(t, database.Save(user).Error)
	return deferredResolutionTestRouter(), accessToken
}

func postDeferredResolution(
	t *testing.T,
	router http.Handler,
	taskID, accessToken, body string,
) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/task/"+taskID+"/deferred-resolution",
		bytes.NewBufferString(body),
	)
	request.Header.Set("Authorization", "Bearer "+accessToken)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func markDeferredTaskUncertain(t *testing.T, database *gorm.DB, task *model.Task, legacy bool) {
	t.Helper()
	status := model.TaskDispatchStatusUncertain
	lockUntil := int64(0)
	startedAt := int64(123)
	if legacy {
		status = legacyDeferredDispatchStatusRunningForTest
		lockUntil = math.MaxInt64
		startedAt = 0
	}
	require.NoError(t, database.Model(&model.Task{}).Where("id = ?", task.ID).Updates(map[string]any{
		"dispatch_status":     status,
		"dispatch_owner":      "private-dispatch-owner",
		"dispatch_lock_until": lockUntil,
		"dispatch_started_at": startedAt,
		"dispatch_attempts":   1,
		"dispatch_error":      "provider outcome unknown",
	}).Error)
}

func injectDeferredUncertainCountError(
	t *testing.T,
	database *gorm.DB,
	injected error,
) *atomic.Bool {
	t.Helper()
	callbackName := "test:deferred-uncertain-count-error:" + strings.ReplaceAll(t.Name(), "/", "_")
	triggered := &atomic.Bool{}
	require.NoError(t, database.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "tasks" {
			return
		}
		selectClause, ok := tx.Statement.Clauses["SELECT"]
		if !ok {
			return
		}
		countExpression, ok := selectClause.Expression.(clause.Expr)
		if !ok || !strings.EqualFold(strings.TrimSpace(countExpression.SQL), "count(*)") {
			return
		}
		triggered.Store(true)
		tx.AddError(injected)
	}))
	t.Cleanup(func() {
		require.NoError(t, database.Callback().Query().Remove(callbackName))
	})
	return triggered
}

func stringPointer(value string) *string {
	return &value
}

func TestApplyDeferredTaskResultPersistsPluginState(t *testing.T) {
	task := &model.Task{
		PrivateData: model.TaskPrivateData{
			DeferredRequest: &model.TaskDeferredRequest{RequestBody: json.RawMessage(`{}`)},
			PluginState:     json.RawMessage(`{"round":"queued"}`),
		},
	}
	result := &relay.TaskSubmitResult{
		UpstreamTaskID: "upstream-task",
		PluginState:    []byte(`{"round":"submitted"}`),
	}

	applyDeferredTaskResult(task, result)

	assert.JSONEq(t, `{"round":"submitted"}`, string(task.PrivateData.PluginState))
	assert.Nil(t, task.PrivateData.DeferredRequest)
}

func TestDeferredTaskErrorRetryable(t *testing.T) {
	for _, tc := range []struct {
		name     string
		taskErr  *dto.TaskError
		expected bool
	}{
		{"accepted stream 502", &dto.TaskError{StatusCode: http.StatusBadGateway, NoRetry: true}, false},
		{"ordinary 502", &dto.TaskError{StatusCode: http.StatusBadGateway}, true},
		{"ordinary 400", &dto.TaskError{StatusCode: http.StatusBadRequest}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, deferredTaskErrorRetryable(tc.taskErr))
		})
	}
}

func TestDeferredSubmissionPersistsBeforeCallingUpstream(t *testing.T) {
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousMemoryCache := common.MemoryCacheEnabled
	previousRedisEnabled := common.RedisEnabled
	previousLogConsume := common.LogConsumeEnabled
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(
		&model.User{},
		&model.Channel{},
		&model.Task{},
		&model.Log{},
		&model.SystemTask{},
		&model.SystemTaskLock{},
	))
	model.DB = database
	model.LOG_DB = database
	common.MemoryCacheEnabled = false
	common.RedisEnabled = false
	common.LogConsumeEnabled = false
	previousRatios := ratio_setting.ModelRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"kling-v1":1}`))
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.MemoryCacheEnabled = previousMemoryCache
		common.RedisEnabled = previousRedisEnabled
		common.LogConsumeEnabled = previousLogConsume
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousRatios))
	})
	require.NoError(t, database.Create(&model.User{
		Id:       72,
		Username: "deferred-submit-user",
		Group:    "default",
		Quota:    1_000_000,
	}).Error)

	upstreamCalls := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		upstreamCalls++
		http.Error(w, "must not be called during enqueue", http.StatusInternalServerError)
	}))
	defer upstream.Close()
	channel := &model.Channel{
		Type:    constant.ChannelTypeKling,
		Name:    "deferred-kling-submit",
		Key:     "sk-current",
		BaseURL: &upstream.URL,
		Status:  common.ChannelStatusEnabled,
		Models:  "kling-v1",
		Group:   "default",
	}
	require.NoError(t, database.Create(channel).Error)

	generation := pluginruntime.DefaultRegistry.Generation()
	require.NotNil(t, generation)
	binding, found := generation.LookupDeclaredRoute(http.MethodPost, "/kling/v1/videos/text2video")
	require.True(t, found)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/kling/v1/videos/text2video",
		bytes.NewBufferString(`{"model_name":"kling-v1","prompt":"queued lighthouse"}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set(pluginruntime.ContextKeyPinnedRoute, pluginruntime.PinnedRoute{
		Generation: generation,
		Plugin:     binding.Plugin,
		Route:      binding.Route,
	})
	common.SetContextKey(c, constant.ContextKeyUserId, 72)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUserQuota, 1_000_000)
	middleware.PrepareTaskPluginRoute()(c)
	require.False(t, c.IsAborted(), recorder.Body.String())
	c.Set(pluginruntime.ContextKeyExecutionMode, pluginruntime.ExecutionModeDeferred)
	require.Nil(t, middleware.SetupContextForSelectedChannel(c, channel, "kling-v1"))

	events := make([]string, 0, 2)
	billing := &taskSubmissionTestBilling{events: &events}
	info := &relaycommon.RelayInfo{
		UserId:          72,
		UserGroup:       "default",
		UsingGroup:      "default",
		UserQuota:       1_000_000,
		TokenGroup:      "default",
		OriginModelName: "kling-v1",
		Billing:         billing,
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:        c.GetString("task_action"),
			PublicTaskID:  "task_deferred_submit",
			LockedChannel: channel,
		},
	}

	outcome, taskErr := executeTaskSubmissionWith(c, info, relay.RelayTaskSubmit)
	require.Nil(t, taskErr)
	require.NotNil(t, outcome)
	assert.Equal(t, 0, upstreamCalls)
	assert.Equal(t, []string{"reserve", "settle"}, events)
	assert.Equal(t, model.TaskExecutionModeDeferred, outcome.Task.ExecutionMode)
	assert.Equal(t, model.TaskDispatchStatusPending, outcome.Task.DispatchStatus)
	require.NotNil(t, outcome.Task.PrivateData.DeferredRequest)

	var stored model.Task
	require.NoError(t, database.Where("task_id = ?", "task_deferred_submit").First(&stored).Error)
	assert.Equal(t, model.TaskDispatchStatusPending, stored.DispatchStatus)
	require.NotNil(t, stored.PrivateData.DeferredRequest)
	privateJSON, err := json.Marshal(stored.PrivateData)
	require.NoError(t, err)
	assert.NotContains(t, string(privateJSON), "sk-current")
}
