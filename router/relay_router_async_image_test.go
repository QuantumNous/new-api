package router

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestImageEditRoutesReplayAfterStrictTokenChecks(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Task{}))

	previousDB := model.DB
	previousRedisEnabled := common.RedisEnabled
	previousCryptoSecret := common.CryptoSecret
	model.DB = db
	common.RedisEnabled = false
	common.CryptoSecret = "router-replay-secret"
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedisEnabled
		common.CryptoSecret = previousCryptoSecret
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})

	user := &model.User{
		Username: "route-replay-user",
		Password: "password",
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, db.Create(user).Error)
	token := &model.Token{
		UserId:      user.Id,
		Key:         "routerreplaytoken",
		Status:      common.TokenStatusEnabled,
		ExpiredTime: -1,
		RemainQuota: 1000,
	}
	require.NoError(t, db.Create(token).Error)

	engine := gin.New()
	SetRelayRouter(engine)
	for index, path := range []string{"/v1/images/edits", "/v1/edits"} {
		idempotencyKey := "edit-replay-" + strings.ReplaceAll(path, "/", "-")
		clientRequestID := common.GenerateHMAC(idempotencyKey)
		task := &model.Task{
			TaskID:          "task_replayed_" + string(rune('a'+index)),
			Platform:        constant.TaskPlatformOpenAIImage,
			UserId:          user.Id,
			ClientRequestID: &clientRequestID,
			Status:          model.TaskStatusNotStart,
			SubmitTime:      1700000000,
		}
		require.NoError(t, db.Create(task).Error)

		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		require.NoError(t, writer.WriteField("prompt", "restyle"))
		require.NoError(t, writer.WriteField("async", "true"))
		part, createErr := writer.CreateFormFile("image", "source.png")
		require.NoError(t, createErr)
		_, createErr = part.Write([]byte("image-payload"))
		require.NoError(t, createErr)
		require.NoError(t, writer.Close())

		request := httptest.NewRequest(http.MethodPost, path, &body)
		request.Header.Set("Content-Type", writer.FormDataContentType())
		request.Header.Set("Authorization", "Bearer sk-"+token.Key)
		request.Header.Set("Idempotency-Key", idempotencyKey)
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, request)

		assert.Equal(t, http.StatusAccepted, recorder.Code, recorder.Body.String())
		assert.Equal(t, "true", recorder.Header().Get("Idempotency-Replayed"))
		assert.Contains(t, recorder.Body.String(), task.TaskID)
	}
}

func TestImageSubmitRoutesRejectTokenBeforeReadingBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Token{}))

	previousDB := model.DB
	previousRedisEnabled := common.RedisEnabled
	model.DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedisEnabled
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})

	token := &model.Token{
		UserId:      1,
		Key:         "exhausted-before-body-read",
		Status:      common.TokenStatusExhausted,
		ExpiredTime: -1,
		RemainQuota: 0,
	}
	require.NoError(t, db.Create(token).Error)

	engine := gin.New()
	SetRelayRouter(engine)
	for _, testCase := range []struct {
		path        string
		contentType string
	}{
		{path: "/v1/images/generations", contentType: "application/json"},
		{path: "/v1/images/edits", contentType: "multipart/form-data; boundary=security-test"},
		{path: "/v1/edits", contentType: "multipart/form-data; boundary=security-test"},
	} {
		t.Run(testCase.path, func(t *testing.T) {
			const bodySize = 1 << 20
			body := strings.NewReader(strings.Repeat("x", bodySize))
			request := httptest.NewRequest(http.MethodPost, testCase.path, body)
			request.Header.Set("Content-Type", testCase.contentType)
			request.Header.Set("Authorization", "Bearer sk-"+token.Key)
			request.Header.Set("Idempotency-Key", "must-not-be-parsed")
			recorder := httptest.NewRecorder()

			engine.ServeHTTP(recorder, request)

			assert.Equal(t, http.StatusUnauthorized, recorder.Code, recorder.Body.String())
			assert.Equal(t, bodySize, body.Len(), "request body must remain unread before strict token rejection")
		})
	}
}
