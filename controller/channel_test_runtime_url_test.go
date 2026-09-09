package controller

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type channelTestHandlerResponse struct {
	Success   bool    `json:"success"`
	Message   string  `json:"message"`
	Time      float64 `json:"time"`
	ErrorCode string  `json:"error_code"`
}

func setupChannelRuntimeURLDB(t *testing.T) {
	t.Helper()

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousRedis := common.RedisEnabled
	previousLogConsume := common.LogConsumeEnabled
	previousMemoryCache := common.MemoryCacheEnabled
	previousMaster := common.IsMasterNode
	previousGinMode := gin.Mode()
	previousGinWriter := gin.DefaultWriter
	previousGinErrWriter := gin.DefaultErrorWriter

	gin.SetMode(gin.TestMode)
	gin.DefaultWriter = io.Discard
	gin.DefaultErrorWriter = io.Discard
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.LogConsumeEnabled = false
	common.MemoryCacheEnabled = false
	common.IsMasterNode = false

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err, "open in-memory sqlite")
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.User{}), "AutoMigrate")
	require.NoError(t, model.InitLogDB())
	model.LOG_DB = db

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		common.RedisEnabled = previousRedis
		common.LogConsumeEnabled = previousLogConsume
		common.MemoryCacheEnabled = previousMemoryCache
		common.IsMasterNode = previousMaster
		gin.SetMode(previousGinMode)
		gin.DefaultWriter = previousGinWriter
		gin.DefaultErrorWriter = previousGinErrWriter
		sqlDB, closeErr := db.DB()
		if closeErr == nil {
			_ = sqlDB.Close()
		}
	})
}

func createDualURLChannel(t *testing.T, actualURL string) (*model.Channel, *model.User) {
	t.Helper()

	displayURL := "https://display.example.invalid"
	channel := &model.Channel{
		Type:          1,
		Key:           "sk-test",
		BaseURL:       &displayURL,
		ActualBaseURL: &actualURL,
		Models:        "gpt-4o-mini",
		Status:        1,
	}
	require.NoError(t, model.DB.Create(channel).Error)

	user := &model.User{
		Username: "channel-test-user",
		Role:     common.RoleAdminUser,
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, model.DB.Create(user).Error)

	return channel, user
}

func callTestChannelHandler(t *testing.T, channelID, userID, role int) channelTestHandlerResponse {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(channelID)}}
	ctx.Request = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/channel/%d/test?model=gpt-4o-mini", channelID), nil)
	ctx.Set("id", userID)
	ctx.Set("role", role)

	TestChannel(ctx)

	var response channelTestHandlerResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response.Success)
	return response
}

func upstreamURLBearer502Server(t *testing.T) (actualURL, actualHost string) {
	t.Helper()

	var actualURLValue string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"error":{"message":"upstream failed at %s"}}`, actualURLValue)))
	}))
	t.Cleanup(server.Close)
	actualURLValue = server.URL
	return actualURLValue, strings.TrimPrefix(strings.TrimPrefix(actualURLValue, "https://"), "http://")
}

// The channel test must hit the real upstream (actual_base_url), never the display address.
func TestChannelTestUsesRuntimeBaseURL(t *testing.T) {
	setupChannelRuntimeURLDB(t)
	withSelfUseModeEnabled(t)

	displayHits := 0
	display := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		displayHits++
		w.WriteHeader(http.StatusTeapot)
	}))
	defer display.Close()
	actual := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"x","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`))
	}))
	defer actual.Close()

	displayURL, actualURL := display.URL, actual.URL
	channel := &model.Channel{Type: 1, Key: "sk-test", BaseURL: &displayURL, ActualBaseURL: &actualURL, Models: "gpt-4o-mini", Status: 1}
	require.NoError(t, model.DB.Create(channel).Error)
	user := &model.User{Username: "runtime-url-root", Role: common.RoleRootUser, Group: "default", Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(user).Error)

	result := testChannel(context.Background(), channel, user.Id, "gpt-4o-mini", "", false)
	assert.NoError(t, result.localErr)
	assert.Nil(t, result.newAPIError)
	assert.Equal(t, 0, displayHits, "display base url must not receive channel test traffic")
}

func TestChannelTestNonRootRedactsLocalErrBranch(t *testing.T) {
	setupChannelRuntimeURLDB(t)
	withSelfUseModeEnabled(t)

	actualURL, actualHost := upstreamURLBearer502Server(t)
	channel, user := createDualURLChannel(t, actualURL)

	response := callTestChannelHandler(t, channel.Id, user.Id, common.RoleAdminUser)

	assert.Equal(t, 0.0, response.Time, "localErr branch returns zero elapsed time")
	assert.NotEmpty(t, response.Message)
	assert.NotContains(t, response.Message, actualURL)
	assert.NotContains(t, response.Message, actualHost)
	assert.Contains(t, response.Message, "display.example.invalid")
}

func TestChannelTestRootPreservesLocalErrBranch(t *testing.T) {
	setupChannelRuntimeURLDB(t)
	withSelfUseModeEnabled(t)

	actualURL, actualHost := upstreamURLBearer502Server(t)
	channel, user := createDualURLChannel(t, actualURL)

	response := callTestChannelHandler(t, channel.Id, user.Id, common.RoleRootUser)

	assert.Equal(t, 0.0, response.Time, "localErr branch returns zero elapsed time")
	assert.NotEmpty(t, response.Message)
	assert.True(t, strings.Contains(response.Message, actualURL) || strings.Contains(response.Message, actualHost))
}

func TestChannelTestNonRootRedactsNewAPIErrorBranch(t *testing.T) {
	setupChannelRuntimeURLDB(t)
	withSelfUseModeEnabled(t)

	actualURL, actualHost := upstreamURLBearer502Server(t)
	channel, user := createDualURLChannel(t, actualURL)

	response := callTestChannelHandler(t, channel.Id, user.Id, common.RoleAdminUser)

	assert.Equal(t, 0.0, response.Time, "testChannel failures with newAPIError still exit via localErr branch")
	assert.NotEmpty(t, response.ErrorCode)
	assert.NotContains(t, response.Message, actualURL)
	assert.NotContains(t, response.Message, actualHost)
	assert.Contains(t, response.Message, "display.example.invalid")
}

func TestChannelTestRootPreservesNewAPIErrorBranch(t *testing.T) {
	setupChannelRuntimeURLDB(t)
	withSelfUseModeEnabled(t)

	actualURL, actualHost := upstreamURLBearer502Server(t)
	channel, user := createDualURLChannel(t, actualURL)

	response := callTestChannelHandler(t, channel.Id, user.Id, common.RoleRootUser)

	assert.Equal(t, 0.0, response.Time, "testChannel failures with newAPIError still exit via localErr branch")
	assert.NotEmpty(t, response.ErrorCode)
	assert.True(t, strings.Contains(response.Message, actualURL) || strings.Contains(response.Message, actualHost))
}
