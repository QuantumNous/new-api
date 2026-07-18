package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/openai/image_stream"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetImageGenerationTaskPollsOnlyOwnedTask(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Task{}))
	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})

	task := &model.Task{
		TaskID:     "task_image_poll",
		UserId:     17,
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     model.TaskStatusNotStart,
		Progress:   "40%",
		SubmitTime: 1710000000,
	}
	require.NoError(t, db.Create(task).Error)

	poll := func(userID int) (*httptest.ResponseRecorder, *image_stream.ImageTaskResponse) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/v1/images/generations/"+task.TaskID, nil)
		c.Params = gin.Params{{Key: "task_id", Value: task.TaskID}}
		c.Set("id", userID)
		GetImageGenerationTask(c)
		response := &image_stream.ImageTaskResponse{}
		if recorder.Code == http.StatusOK {
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), response))
		}
		return recorder, response
	}

	queued, queuedBody := poll(task.UserId)
	assert.Equal(t, http.StatusOK, queued.Code)
	assert.Equal(t, "2", queued.Header().Get("Retry-After"))
	assert.Equal(t, "queued", queuedBody.Status)
	assert.Equal(t, "40%", queuedBody.Progress)

	otherUser, _ := poll(task.UserId + 1)
	assert.Equal(t, http.StatusNotFound, otherUser.Code)

	result := json.RawMessage(`{"created":1710000001,"data":[{"url":"https://cdn.example.com/images/result.png"}]}`)
	require.NoError(t, db.Model(task).Updates(map[string]any{
		"status":      model.TaskStatusSuccess,
		"progress":    "100%",
		"finish_time": int64(1710000001),
		"data":        result,
	}).Error)

	completed, completedBody := poll(task.UserId)
	assert.Equal(t, http.StatusOK, completed.Code)
	assert.Empty(t, completed.Header().Get("Retry-After"))
	assert.Equal(t, "completed", completedBody.Status)
	require.NotNil(t, completedBody.Result)
	assert.JSONEq(t, string(result), string(*completedBody.Result))
}
