package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type successfulAsyncExecutor struct{}

func (successfulAsyncExecutor) Execute(_ context.Context, _ []byte, markRequestSent func() error) AsyncExecutionOutcome {
	if err := markRequestSent(); err != nil {
		return AsyncExecutionOutcome{Status: model.AsyncStatusFailure, ErrorPhase: "mark", ErrorCode: "mark_failed", ErrorMessage: err.Error(), RefundEligible: true}
	}
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0}
	return AsyncExecutionOutcome{
		Status:  model.AsyncStatusSuccess,
		Payload: json.RawMessage(`{"created":1,"data":[{"b64_json":"iVBORw0KGgoAAAAA"}]}`),
		Media:   []AsyncMediaSource{{Base64: base64.StdEncoding.EncodeToString(png), ContentType: "image/png"}},
	}
}

type drainingAsyncExecutor struct {
	started chan struct{}
	release chan struct{}
	once    sync.Once
}

func (e *drainingAsyncExecutor) Execute(ctx context.Context, payload []byte, markRequestSent func() error) AsyncExecutionOutcome {
	if err := markRequestSent(); err != nil {
		return AsyncExecutionOutcome{Status: model.AsyncStatusFailure, ErrorPhase: "mark", ErrorCode: "mark_failed", ErrorMessage: err.Error(), RefundEligible: true}
	}
	e.once.Do(func() { close(e.started) })
	select {
	case <-e.release:
		return successfulAsyncExecutor{}.Execute(context.Background(), payload, func() error { return nil })
	case <-ctx.Done():
		return AsyncExecutionOutcome{Status: model.AsyncStatusUncertain, ErrorPhase: "shutdown", ErrorCode: "cancelled_after_send", ErrorMessage: "request context was cancelled"}
	}
}

func TestAsyncWorkerCompletesDisconnectedClientTask(t *testing.T) {
	t.Setenv("ASYNC_REQUEST_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(make([]byte, 32)))
	t.Setenv("ASYNC_YUNWU_ALLOWED_BASE_URLS", "https://yunwu.ai")
	model.DB.Exec("DELETE FROM task_events")
	model.DB.Exec("DELETE FROM artifacts")
	model.DB.Exec("DELETE FROM async_jobs")
	model.DB.Exec("DELETE FROM tasks")
	model.DB.Exec("DELETE FROM tokens")
	model.DB.Exec("DELETE FROM users")
	model.DB.Exec("DELETE FROM channels")

	user := &model.User{Id: 301, Username: "worker-user", Quota: 900, Status: common.UserStatusEnabled}
	token := &model.Token{Id: 302, UserId: user.Id, Key: "worker-token-placeholder", Name: "worker", Status: common.TokenStatusEnabled, RemainQuota: 900, UsedQuota: 100}
	baseURL := "https://yunwu.ai"
	archive := true
	channel := &model.Channel{Id: 303, Name: "yunwu-worker", Key: "upstream-placeholder", BaseURL: &baseURL, Status: common.ChannelStatusEnabled, Models: "image-model", Group: "default"}
	channel.SetSetting(dto.ChannelSettings{AsyncImageEnabled: true, AsyncImageModels: []string{"image-model"}, AsyncMaxConcurrency: 1, AsyncAutoArchive: &archive})
	require.NoError(t, model.DB.Create(user).Error)
	require.NoError(t, model.DB.Create(token).Error)
	require.NoError(t, model.DB.Create(channel).Error)

	payload, err := EncryptAsyncPayload([]byte(`{"model":"image-model","prompt":"kept after disconnect"}`))
	require.NoError(t, err)
	task := &model.Task{TaskID: "task_worker_disconnected", Platform: constant.TaskPlatformAsyncImage, UserId: user.Id, ChannelId: channel.Id, Quota: 100, Status: model.TaskStatusQueued, Progress: "0%", Properties: model.Properties{OriginModelName: "image-model"}, PrivateData: model.TaskPrivateData{BillingSource: BillingSourceWallet, TokenId: token.Id}, Data: json.RawMessage(`{}`)}
	job := &model.AsyncJob{TokenID: token.Id, ChannelID: channel.Id, EndpointType: model.AsyncEndpointImageGeneration, RequestPayload: payload, RequestHash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", IdempotencyKey: "worker-disconnected", ExecutionStatus: model.AsyncStatusQueued, BillingStatus: model.AsyncBillingReserved}
	require.NoError(t, model.CreateAsyncTask(task, job))
	claimed, won, err := model.ClaimAsyncJob(context.Background(), job.ID, "test-worker", time.Now().Add(time.Minute).Unix())
	require.NoError(t, err)
	require.True(t, won)

	store := &memoryArtifactStore{objects: map[string][]byte{}}
	worker := &AsyncWorker{ID: "test-worker", LeaseDuration: time.Minute, JobTimeout: time.Minute, Store: store, Factory: func(*model.Channel, string, time.Duration) (AsyncImageExecutor, error) {
		return successfulAsyncExecutor{}, nil
	}}
	worker.process(context.Background(), claimed)

	loaded, err := model.GetAsyncJobByPublicTaskID(context.Background(), task.TaskID, token.Id)
	require.NoError(t, err)
	require.NotNil(t, loaded)
	assert.Equal(t, model.AsyncStatusSuccess, loaded.ExecutionStatus)
	assert.Equal(t, model.AsyncBillingSettled, loaded.BillingStatus)
	artifacts, err := model.ListArtifactsByTaskID(context.Background(), task.ID)
	require.NoError(t, err)
	assert.Len(t, artifacts, 1)
	assert.Len(t, store.objects, 1)
}

func TestAsyncChannelAndModelSemaphoreKeepsExcessQueued(t *testing.T) {
	registry := newAsyncSemaphoreRegistry()
	release, acquired := registry.TryAcquire(1, "image-model", 1)
	require.True(t, acquired)
	_, acquired = registry.TryAcquire(1, "image-model", 1)
	assert.False(t, acquired)
	release()
	_, acquired = registry.TryAcquire(1, "image-model", 1)
	assert.True(t, acquired)
}

func TestAsyncWorkerShutdownDrainsRunningRequest(t *testing.T) {
	t.Setenv("ASYNC_REQUEST_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(make([]byte, 32)))
	t.Setenv("ASYNC_YUNWU_ALLOWED_BASE_URLS", "https://yunwu.ai")
	model.DB.Exec("DELETE FROM task_events")
	model.DB.Exec("DELETE FROM artifacts")
	model.DB.Exec("DELETE FROM async_jobs")
	model.DB.Exec("DELETE FROM tasks")
	model.DB.Exec("DELETE FROM tokens")
	model.DB.Exec("DELETE FROM users")
	model.DB.Exec("DELETE FROM channels")

	user := &model.User{Id: 401, Username: "drain-user", Quota: 900, Status: common.UserStatusEnabled}
	token := &model.Token{Id: 402, UserId: user.Id, Key: "drain-token-placeholder", Name: "worker", Status: common.TokenStatusEnabled, RemainQuota: 900, UsedQuota: 100}
	baseURL := "https://yunwu.ai"
	archive := true
	channel := &model.Channel{Id: 403, Name: "yunwu-drain", Key: "upstream-placeholder", BaseURL: &baseURL, Status: common.ChannelStatusEnabled, Models: "image-model", Group: "default"}
	channel.SetSetting(dto.ChannelSettings{AsyncImageEnabled: true, AsyncImageModels: []string{"image-model"}, AsyncMaxConcurrency: 1, AsyncAutoArchive: &archive})
	require.NoError(t, model.DB.Create(user).Error)
	require.NoError(t, model.DB.Create(token).Error)
	require.NoError(t, model.DB.Create(channel).Error)
	payload, err := EncryptAsyncPayload([]byte(`{"model":"image-model","prompt":"drain on shutdown"}`))
	require.NoError(t, err)
	task := &model.Task{TaskID: "task_worker_drain", Platform: constant.TaskPlatformAsyncImage, UserId: user.Id, ChannelId: channel.Id, Quota: 100, Status: model.TaskStatusQueued, Progress: "0%", Properties: model.Properties{OriginModelName: "image-model"}, PrivateData: model.TaskPrivateData{BillingSource: BillingSourceWallet, TokenId: token.Id}, Data: json.RawMessage(`{}`)}
	job := &model.AsyncJob{TokenID: token.Id, ChannelID: channel.Id, EndpointType: model.AsyncEndpointImageGeneration, RequestPayload: payload, RequestHash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", IdempotencyKey: "worker-drain", ExecutionStatus: model.AsyncStatusQueued, BillingStatus: model.AsyncBillingReserved}
	require.NoError(t, model.CreateAsyncTask(task, job))

	executor := &drainingAsyncExecutor{started: make(chan struct{}), release: make(chan struct{})}
	worker := &AsyncWorker{
		ID:            "draining-worker",
		Concurrency:   1,
		LeaseDuration: 30 * time.Second,
		PollInterval:  5 * time.Millisecond,
		JobTimeout:    2 * time.Second,
		Store:         &memoryArtifactStore{objects: map[string][]byte{}},
		Factory:       func(*model.Channel, string, time.Duration) (AsyncImageExecutor, error) { return executor, nil },
		semaphores:    newAsyncSemaphoreRegistry(),
	}
	runCtx, cancelRun := context.WithCancel(context.Background())
	runDone := make(chan error, 1)
	go func() { runDone <- worker.Run(runCtx) }()
	select {
	case <-executor.started:
	case <-time.After(2 * time.Second):
		t.Fatal("worker did not start the queued task")
	}
	cancelRun()
	select {
	case err := <-runDone:
		t.Fatalf("worker returned before the running request drained: %v", err)
	case <-time.After(75 * time.Millisecond):
	}
	close(executor.release)
	select {
	case err := <-runDone:
		require.NoError(t, err)
	case <-time.After(2 * time.Second):
		t.Fatal("worker did not finish after the running request drained")
	}

	loaded, err := model.GetAsyncJobByPublicTaskID(context.Background(), task.TaskID, token.Id)
	require.NoError(t, err)
	require.NotNil(t, loaded)
	assert.Equal(t, model.AsyncStatusSuccess, loaded.ExecutionStatus)
}
