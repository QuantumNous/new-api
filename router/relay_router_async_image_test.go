package router

import (
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

func TestUnifiedImageRouteReplaysImageInputAfterStrictTokenChecks(t *testing.T) {
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
	idempotencyKey := "unified-image-input-replay"
	clientRequestID := common.GenerateHMAC(idempotencyKey)
	task := &model.Task{
		TaskID:          "task_replayed_image_input",
		Platform:        constant.TaskPlatformOpenAIImage,
		UserId:          user.Id,
		ClientRequestID: &clientRequestID,
		Status:          model.TaskStatusNotStart,
		SubmitTime:      1700000000,
	}
	require.NoError(t, db.Create(task).Error)

	body := strings.NewReader(`{
		"model":"gpt-image-2",
		"input":{
			"prompt":"restyle the source image",
			"image_input":["https://example.com/source.png"]
		}
	}`)
	request := httptest.NewRequest(http.MethodPost, "/v1/images/generations", body)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer sk-"+token.Key)
	request.Header.Set("Idempotency-Key", idempotencyKey)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusAccepted, recorder.Code, recorder.Body.String())
	assert.Equal(t, "true", recorder.Header().Get("Idempotency-Replayed"))
	assert.Contains(t, recorder.Body.String(), task.TaskID)
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
	const bodySize = 1 << 20
	body := strings.NewReader(strings.Repeat("x", bodySize))
	request := httptest.NewRequest(http.MethodPost, "/v1/images/generations", body)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer sk-"+token.Key)
	request.Header.Set("Idempotency-Key", "must-not-be-parsed")
	recorder := httptest.NewRecorder()

	engine.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	assert.Equal(t, bodySize, body.Len(), "request body must remain unread before strict token rejection")
}

func TestLegacyImageSubmitRoutesAreNotRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetRelayRouter(engine)

	for _, path := range []string{"/v1/images/edits", "/v1/edits", "/v1/images/variations"} {
		t.Run(path, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"model":"gpt-image-2"}`))
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()

			engine.ServeHTTP(recorder, request)

			assert.Equal(t, http.StatusNotFound, recorder.Code, recorder.Body.String())
		})
	}
}
