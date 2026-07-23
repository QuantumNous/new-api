package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/storage"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type controllerArtifactStore struct{}

func (controllerArtifactStore) Put(context.Context, string, io.Reader, string) error { return nil }
func (controllerArtifactStore) Delete(context.Context, string) error                 { return nil }
func (controllerArtifactStore) SignedURL(_ context.Context, key string, _ time.Duration) (string, error) {
	return "https://objects.example/" + key + "?signed=test", nil
}

func setupAsyncControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.Task{}, &model.AsyncJob{}, &model.Artifact{}, &model.TaskEvent{}, &model.User{}, &model.Token{}, &model.Channel{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func createAsyncControllerFixture(t *testing.T, status model.AsyncExecutionStatus) (*model.Task, *model.AsyncJob) {
	t.Helper()
	var taskStatus model.TaskStatus = model.TaskStatusQueued
	progress := "0%"
	finish := int64(0)
	if status == model.AsyncStatusRunning {
		taskStatus = model.TaskStatusInProgress
		progress = "50%"
	} else if status == model.AsyncStatusSuccess {
		taskStatus = model.TaskStatusSuccess
		progress = "100%"
		finish = time.Now().Unix()
	} else if status == model.AsyncStatusUncertain {
		taskStatus = model.TaskStatusUncertain
		finish = time.Now().Unix()
	}
	task := &model.Task{
		TaskID:     "task_controller_fixture",
		Platform:   constant.TaskPlatformAsyncImage,
		UserId:     1,
		ChannelId:  2,
		Status:     taskStatus,
		Progress:   progress,
		SubmitTime: time.Now().Add(-time.Minute).Unix(),
		FinishTime: finish,
		Data:       json.RawMessage(`{}`),
	}
	job := &model.AsyncJob{TokenID: 11, ChannelID: 2, EndpointType: model.AsyncEndpointImageGeneration, RequestPayload: []byte("encrypted"), RequestHash: strings.Repeat("a", 64), IdempotencyKey: "controller-fixture", ExecutionStatus: status, BillingStatus: model.AsyncBillingReserved, ResultPayload: model.JSONValue(`{"created":1,"data":[{"url":"https://temporary.example/image.png"}]}`)}
	require.NoError(t, model.CreateAsyncTask(task, job))
	job.Task = *task
	return task, job
}

func asyncControllerContext(method, path, taskID string, tokenID int) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, path, nil)
	ctx.Params = gin.Params{{Key: "task_id", Value: taskID}}
	ctx.Set("token_id", tokenID)
	return ctx, recorder
}

func TestAsyncTaskOwnershipIsEnforced(t *testing.T) {
	setupAsyncControllerTestDB(t)
	task, _ := createAsyncControllerFixture(t, model.AsyncStatusQueued)
	ctx, recorder := asyncControllerContext(http.MethodGet, "/v1/async/tasks/"+task.TaskID, task.TaskID, 999)
	GetAsyncTask(ctx)
	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "task_not_found")
}

func TestAsyncResultUsesSignedArchivedURLs(t *testing.T) {
	setupAsyncControllerTestDB(t)
	task, _ := createAsyncControllerFixture(t, model.AsyncStatusSuccess)
	require.NoError(t, model.DB.Create(&model.Artifact{TaskID: task.ID, ObjectKey: "async/task/image.png", ContentType: "image/png", SizeBytes: 12, SHA256: strings.Repeat("b", 64), SourceURLHash: strings.Repeat("c", 64), ExpiresAt: time.Now().Add(24 * time.Hour).Unix()}).Error)

	originalFactory := newAsyncArtifactStore
	newAsyncArtifactStore = func(context.Context) (storage.ArtifactStore, error) { return controllerArtifactStore{}, nil }
	t.Cleanup(func() { newAsyncArtifactStore = originalFactory })

	ctx, recorder := asyncControllerContext(http.MethodGet, "/v1/async/tasks/"+task.TaskID+"/result", task.TaskID, 11)
	GetAsyncTaskResult(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "https://objects.example/async/task/image.png")
	assert.Contains(t, recorder.Body.String(), "https://temporary.example/image.png")
}

func TestAsyncResultCanOmitUpstreamPayload(t *testing.T) {
	setupAsyncControllerTestDB(t)
	task, _ := createAsyncControllerFixture(t, model.AsyncStatusSuccess)
	require.NoError(t, model.DB.Create(&model.Artifact{TaskID: task.ID, ObjectKey: "async/task/image.png", ContentType: "image/png", SizeBytes: 12, SHA256: strings.Repeat("b", 64), SourceURLHash: strings.Repeat("c", 64), ExpiresAt: time.Now().Add(24 * time.Hour).Unix()}).Error)

	originalFactory := newAsyncArtifactStore
	newAsyncArtifactStore = func(context.Context) (storage.ArtifactStore, error) { return controllerArtifactStore{}, nil }
	t.Cleanup(func() { newAsyncArtifactStore = originalFactory })

	ctx, recorder := asyncControllerContext(http.MethodGet, "/v1/async/tasks/"+task.TaskID+"/result?include_upstream=false", task.TaskID, 11)
	GetAsyncTaskResult(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "https://objects.example/async/task/image.png")
	assert.NotContains(t, recorder.Body.String(), "https://temporary.example/image.png")
	assert.NotContains(t, recorder.Body.String(), "upstream_response")
}

func TestAsyncResultReturnsGoneAfterArtifactRetentionExpires(t *testing.T) {
	setupAsyncControllerTestDB(t)
	task, _ := createAsyncControllerFixture(t, model.AsyncStatusSuccess)
	require.NoError(t, model.DB.Create(&model.Artifact{TaskID: task.ID, ObjectKey: "async/task/expired.png", ContentType: "image/png", SizeBytes: 12, SHA256: strings.Repeat("d", 64), SourceURLHash: strings.Repeat("e", 64), ExpiresAt: time.Now().Add(-time.Second).Unix()}).Error)

	ctx, recorder := asyncControllerContext(http.MethodGet, "/v1/async/tasks/"+task.TaskID+"/result", task.TaskID, 11)
	GetAsyncTaskResult(ctx)
	require.Equal(t, http.StatusGone, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "result_expired")
}

func TestRunningAsyncTaskCannotBeFalselyCancelled(t *testing.T) {
	setupAsyncControllerTestDB(t)
	task, _ := createAsyncControllerFixture(t, model.AsyncStatusRunning)
	ctx, recorder := asyncControllerContext(http.MethodPost, "/v1/async/tasks/"+task.TaskID+"/cancel", task.TaskID, 11)
	CancelAsyncTask(ctx)
	assert.Equal(t, http.StatusConflict, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "upstream_cancel_unsupported")
}

func TestAdminRetryRequiresExplicitRiskConfirmation(t *testing.T) {
	setupAsyncControllerTestDB(t)
	task, job := createAsyncControllerFixture(t, model.AsyncStatusUncertain)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/task/async/"+task.TaskID+"/retry", strings.NewReader(`{"confirm_risk":false}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "task_id", Value: task.TaskID}}
	ctx.Set("id", 99)
	RetryAdminAsyncTask(ctx)
	assert.Equal(t, http.StatusConflict, recorder.Code)

	var unchanged model.AsyncJob
	require.NoError(t, model.DB.First(&unchanged, job.ID).Error)
	assert.Equal(t, model.AsyncStatusUncertain, unchanged.ExecutionStatus)

	recorder = httptest.NewRecorder()
	ctx, _ = gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/task/async/"+task.TaskID+"/retry", strings.NewReader(`{"confirm_risk":true}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "task_id", Value: task.TaskID}}
	ctx.Set("id", 99)
	RetryAdminAsyncTask(ctx)
	assert.Equal(t, http.StatusOK, recorder.Code)

	var retried model.AsyncJob
	require.NoError(t, model.DB.First(&retried, job.ID).Error)
	assert.Equal(t, model.AsyncStatusQueued, retried.ExecutionStatus)
}
