package controller

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func updateUpstreamOrchestrationForTest(
	t *testing.T,
	update func(*operation_setting.UpstreamOrchestrationSetting),
) {
	t.Helper()
	original := operation_setting.GetUpstreamOrchestrationSetting()
	originalValues, err := config.ConfigToMap(original)
	require.NoError(t, err)
	next := operation_setting.GetUpstreamOrchestrationSetting()
	update(next)
	nextValues, err := config.ConfigToMap(next)
	require.NoError(t, err)
	updated, err := config.GlobalConfig.UpdateFromMap("upstream_orchestration", nextValues)
	require.NoError(t, err)
	require.True(t, updated)
	t.Cleanup(func() {
		updated, err := config.GlobalConfig.UpdateFromMap("upstream_orchestration", originalValues)
		require.NoError(t, err)
		require.True(t, updated)
	})
}

func TestProcessChannelErrorMasksSensitiveReasonsAcrossManagedAndDisablePaths(t *testing.T) {
	previousDB, previousType := model.DB, common.MainDatabaseType()
	previousCache, previousRedis := common.MemoryCacheEnabled, common.RedisEnabled
	previousOptionMap := common.OptionMap
	previousAutoDisable, previousErrorLog := common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled
	previousNotifyLimit := constant.NotifyLimitCount
	fetch := system_setting.GetFetchSetting()
	previousFetch := *fetch
	previousOutput, previousErrorOutput := gin.DefaultWriter, gin.DefaultErrorWriter
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		common.MemoryCacheEnabled, common.RedisEnabled = previousCache, previousRedis
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptionMap
		common.OptionMapRWMutex.Unlock()
		common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = previousAutoDisable, previousErrorLog
		constant.NotifyLimitCount = previousNotifyLimit
		*fetch = previousFetch
		common.LogWriterMu.Lock()
		gin.DefaultWriter, gin.DefaultErrorWriter = previousOutput, previousErrorOutput
		common.LogWriterMu.Unlock()
	})

	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	require.NoError(t, database.AutoMigrate(
		&model.Channel{},
		&model.Ability{},
		&model.User{},
		&model.Option{},
		&model.UpstreamSource{},
		&model.UpstreamGroup{},
		&model.UpstreamManagedRoute{},
	))
	model.DB = database
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.MemoryCacheEnabled, common.RedisEnabled = false, false
	common.OptionMapRWMutex.Lock()
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = true, false
	constant.NotifyLimitCount = 100
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.Enabled = true
		setting.FailureThreshold = 1
		setting.FailureWindowMinutes = 5
	})
	fetch.EnableSSRFProtection = false
	service.InitHttpClient()

	var logs bytes.Buffer
	common.LogWriterMu.Lock()
	gin.DefaultWriter, gin.DefaultErrorWriter = &logs, &logs
	common.LogWriterMu.Unlock()

	notifications := make(chan string, 4)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		notifications <- r.URL.RequestURI() + " " + string(body)
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(server.Close)
	settings, err := common.Marshal(map[string]any{
		"notify_type": kitdto.NotifyTypeWebhook,
		"webhook_url": server.URL,
		"bark_url":    server.URL + "/{{title}}/{{content}}",
	})
	require.NoError(t, err)
	require.NoError(t, database.Create(&model.User{
		Username: "relay-error-root",
		Role:     common.RoleRootUser,
		Status:   common.UserStatusEnabled,
		Setting:  string(settings),
	}).Error)

	const rawReason = "upstream https://user:password@private.example.com/v1?api_key=review-secret failed"
	const maskedReason = "status_code=500, upstream https://***.com/***?api_key=*** failed"

	createManaged := func(t *testing.T, name, externalID, modelName string) (*model.Channel, *model.UpstreamManagedRoute) {
		t.Helper()
		source := &model.UpstreamSource{Key: name, Name: name, ConsoleURL: "https://console.example.com", Enabled: true}
		require.NoError(t, database.Create(source).Error)
		groupModels, err := common.Marshal([]string{modelName})
		require.NoError(t, err)
		group := &model.UpstreamGroup{
			SourceID: source.ID, ExternalID: externalID, Name: name, Platform: "openai",
			HealthStatus: model.UpstreamHealthOperational, Models: string(groupModels),
		}
		require.NoError(t, database.Create(group).Error)
		channel := &model.Channel{
			Name: name, Key: "upstream-key", Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled,
			Group: "default", Models: modelName, AutoBan: common.GetPointer(1),
		}
		require.NoError(t, database.Create(channel).Error)
		require.NoError(t, channel.AddAbilities(nil))
		route := &model.UpstreamManagedRoute{
			SourceID: source.ID, ExternalGroupID: externalID, Platform: "openai", Protocol: model.UpstreamProtocolOpenAI,
			ChannelID: channel.Id, State: model.UpstreamRouteStateActive,
		}
		require.NoError(t, database.Create(route).Error)
		return channel, route
	}
	waitFor := func(t *testing.T, condition func() bool) {
		t.Helper()
		require.Eventually(t, condition, 5*time.Second, 10*time.Millisecond)
	}

	t.Run("managed unsupported model isolation", func(t *testing.T) {
		channel, route := createManaged(t, "managed-isolate", "isolate", "removed-model")
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Set("original_model", "removed-model")
		apiErr := relaytypes.NewErrorWithStatusCode(
			errors.New("model not supported by any configured account: "+rawReason),
			relaytypes.ErrorCodeBadResponseStatusCode,
			http.StatusNotFound,
		)
		processChannelError(c, *relaytypes.NewChannelError(channel.Id, channel.Type, channel.Name, false, "", true), apiErr, nil)

		require.NoError(t, database.First(route, route.ID).Error)
		assert.NotContains(t, route.LastReason, "review-secret")
		assert.NotContains(t, route.LastReason, "user:password")
		assert.NotContains(t, logs.String(), "review-secret")
		assert.NotContains(t, logs.String(), "user:password")
	})

	t.Run("managed failure disable and notification", func(t *testing.T) {
		channel, route := createManaged(t, "managed-disable", "disable", "managed-model")
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		apiErr := relaytypes.NewErrorWithStatusCode(errors.New(rawReason), relaytypes.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
		processChannelError(c, *relaytypes.NewChannelError(channel.Id, channel.Type, channel.Name, false, "", true), apiErr, nil)

		waitFor(t, func() bool {
			return database.First(route, route.ID).Error == nil && route.LastReason != ""
		})
		var loaded model.Channel
		waitFor(t, func() bool {
			return database.First(&loaded, channel.Id).Error == nil && loaded.Status == common.ChannelStatusAutoDisabled
		})
		var notification string
		select {
		case notification = <-notifications:
		case <-time.After(5 * time.Second):
			t.Fatal("managed disable notification was not delivered")
		}
		assert.Equal(t, maskedReason, route.LastReason)
		assert.Equal(t, maskedReason, loaded.GetOtherInfo()["status_reason"])
		assert.NotContains(t, notification, "review-secret")
		assert.NotContains(t, notification, "user:password")
	})

	t.Run("ordinary disable and notification", func(t *testing.T) {
		updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
			setting.Enabled = false
		})
		channel := &model.Channel{
			Name: "ordinary-disable", Key: "upstream-key", Type: constant.ChannelTypeOpenAI,
			Status: common.ChannelStatusEnabled, Group: "default", Models: "ordinary-model", AutoBan: common.GetPointer(1),
		}
		require.NoError(t, database.Create(channel).Error)
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		apiErr := relaytypes.NewErrorWithStatusCode(errors.New(rawReason), relaytypes.ErrorCodeChannelNoAvailableKey, http.StatusInternalServerError)
		processChannelError(c, *relaytypes.NewChannelError(channel.Id, channel.Type, channel.Name, false, "", true), apiErr, nil)

		var loaded model.Channel
		waitFor(t, func() bool {
			return database.First(&loaded, channel.Id).Error == nil && loaded.Status == common.ChannelStatusAutoDisabled
		})
		var notification string
		select {
		case notification = <-notifications:
		case <-time.After(5 * time.Second):
			t.Fatal("ordinary disable notification was not delivered")
		}
		assert.Equal(t, maskedReason, loaded.GetOtherInfo()["status_reason"])
		assert.NotContains(t, notification, "review-secret")
		assert.NotContains(t, notification, "user:password")
		assert.NotContains(t, logs.String(), "review-secret")
		assert.NotContains(t, logs.String(), "user:password")
	})
}

func TestManagedRelayLocal408DoesNotRetry(t *testing.T) {
	events := []string{}
	database := setupTaskSubmissionDatabase(t, false, &events, &model.UpstreamManagedRoute{})
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.Enabled = true
	})
	require.NoError(t, database.Create(&model.UpstreamManagedRoute{
		SourceID:        1,
		ExternalGroupID: "managed-408",
		Platform:        "task",
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       42,
		State:           model.UpstreamRouteStateActive,
	}).Error)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("channel_id", 42)
	require.True(t, service.IsManagedChannel(42), "fixture must exercise managed retry ordering")
	localTimeout := relaytypes.NewErrorWithStatusCode(
		errors.New("local request timeout"),
		relaytypes.ErrorCodeBadResponseStatusCode,
		http.StatusRequestTimeout,
		relaytypes.ErrOptionWithSkipRetry(),
	)

	retry, replacement := retryDecision(c, localTimeout, 1)

	assert.False(t, retry)
	assert.Nil(t, replacement)
}
