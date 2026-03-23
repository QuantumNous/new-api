package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDistributorBootstrapTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	require.NoError(t, i18n.Init())

	oldDB := model.DB
	oldLogDB := model.LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingMySQL := common.UsingMySQL
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldRedisEnabled := common.RedisEnabled
	oldMemoryCacheEnabled := common.MemoryCacheEnabled

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	common.MemoryCacheEnabled = true

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.InitChannelCache()

	t.Cleanup(func() {
		model.DB = oldDB
		model.LOG_DB = oldLogDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingMySQL = oldUsingMySQL
		common.UsingPostgreSQL = oldUsingPostgreSQL
		common.RedisEnabled = oldRedisEnabled
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		model.InitChannelCache()
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func withDistributorBootstrapRecoverySetting(t *testing.T, graceSeconds int, probeMilliseconds int, pingSeconds int) {
	t.Helper()

	settings := operation_setting.GetGeneralSetting()
	oldEnabled := settings.ResponsesStreamBootstrapRecoveryEnabled
	oldGrace := settings.ResponsesStreamBootstrapGracePeriodSeconds
	oldProbe := settings.ResponsesStreamBootstrapProbeIntervalMilliseconds
	oldPing := settings.ResponsesStreamBootstrapPingIntervalSeconds
	oldCodes := append([]int(nil), settings.ResponsesStreamBootstrapRetryableStatusCodes...)

	settings.ResponsesStreamBootstrapRecoveryEnabled = true
	settings.ResponsesStreamBootstrapGracePeriodSeconds = graceSeconds
	settings.ResponsesStreamBootstrapProbeIntervalMilliseconds = probeMilliseconds
	settings.ResponsesStreamBootstrapPingIntervalSeconds = pingSeconds
	settings.ResponsesStreamBootstrapRetryableStatusCodes = []int{401, 403, 408, 429, 500, 502, 503, 504}

	t.Cleanup(func() {
		settings.ResponsesStreamBootstrapRecoveryEnabled = oldEnabled
		settings.ResponsesStreamBootstrapGracePeriodSeconds = oldGrace
		settings.ResponsesStreamBootstrapProbeIntervalMilliseconds = oldProbe
		settings.ResponsesStreamBootstrapPingIntervalSeconds = oldPing
		settings.ResponsesStreamBootstrapRetryableStatusCodes = oldCodes
	})
}

func seedDistributorBootstrapChannel(db *gorm.DB, channelID int, modelName string) (*model.Channel, error) {
	weight := uint(100)
	priority := int64(0)
	autoBan := 1
	baseURL := "https://example.com"
	status := common.ChannelStatusManuallyDisabled
	settings := `{"responses_stream_bootstrap_recovery_enabled":true}`

	channel := &model.Channel{
		Id:            channelID,
		Type:          constant.ChannelTypeOpenAI,
		Key:           "test-key",
		Status:        status,
		Name:          fmt.Sprintf("bootstrap-%d", channelID),
		Weight:        &weight,
		BaseURL:       &baseURL,
		Models:        modelName,
		Group:         "default",
		Priority:      &priority,
		AutoBan:       &autoBan,
		OtherSettings: settings,
		CreatedTime:   time.Now().Unix(),
	}

	if err := db.Create(channel).Error; err != nil {
		return nil, err
	}
	if err := channel.AddAbilities(nil); err != nil {
		return nil, err
	}
	model.InitChannelCache()

	return channel, nil
}

func enableDistributorBootstrapChannel(db *gorm.DB, channel *model.Channel) error {
	channel.Status = common.ChannelStatusEnabled
	if err := db.Save(channel).Error; err != nil {
		return err
	}
	if err := channel.UpdateAbilities(nil); err != nil {
		return err
	}
	model.InitChannelCache()
	return nil
}

func newDistributorBootstrapRouter(handler gin.HandlerFunc) *gin.Engine {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("id", 1)
		c.Set(common.RequestIdKey, "req-bootstrap-test")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		c.Next()
	})
	router.POST("/v1/responses", Distribute(), handler)
	return router
}

func TestDistributeResponsesBootstrapRecoversBeforeGraceDeadline(t *testing.T) {
	db := setupDistributorBootstrapTestDB(t)
	withDistributorBootstrapRecoverySetting(t, 1, 50, 10)

	var handlerCalled atomic.Bool
	router := newDistributorBootstrapRouter(func(c *gin.Context) {
		handlerCalled.Store(true)
		require.Equal(t, "gpt-5", c.GetString("original_model"))
		require.Equal(t, "test-key", common.GetContextKeyString(c, constant.ContextKeyChannelKey))
		require.NoError(t, helper.StringData(c, `{"status":"ok"}`))
	})

	seedErrCh := make(chan error, 1)
	channel, err := seedDistributorBootstrapChannel(db, 1001, "gpt-5")
	require.NoError(t, err)
	go func() {
		time.Sleep(120 * time.Millisecond)
		seedErrCh <- enableDistributorBootstrapChannel(db, channel)
	}()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"gpt-5","stream":true}`))
	request.Header.Set("Content-Type", gin.MIMEJSON)

	start := time.Now()
	router.ServeHTTP(recorder, request)
	elapsed := time.Since(start)

	require.True(t, handlerCalled.Load())
	require.NoError(t, <-seedErrCh)
	require.GreaterOrEqual(t, elapsed, 100*time.Millisecond)
	require.Contains(t, recorder.Header().Get("Content-Type"), "text/event-stream")
	require.Contains(t, recorder.Body.String(), ": PING")
	require.Contains(t, recorder.Body.String(), `data: {"status":"ok"}`)
	require.NotContains(t, recorder.Body.String(), "event: error")
}

func TestDistributeResponsesBootstrapSkipsWaitWhenNoChannelOptIn(t *testing.T) {
	db := setupDistributorBootstrapTestDB(t)
	withDistributorBootstrapRecoverySetting(t, 1, 50, 10)

	channel, err := seedDistributorBootstrapChannel(db, 1002, "gpt-5")
	require.NoError(t, err)
	channel.OtherSettings = `{"responses_stream_bootstrap_recovery_enabled":false}`
	require.NoError(t, db.Save(channel).Error)
	require.NoError(t, channel.UpdateAbilities(nil))
	model.InitChannelCache()

	var handlerCalled atomic.Bool
	router := newDistributorBootstrapRouter(func(c *gin.Context) {
		handlerCalled.Store(true)
		require.NoError(t, helper.StringData(c, `{"status":"unexpected"}`))
	})

	enableErrCh := make(chan error, 1)
	go func() {
		time.Sleep(120 * time.Millisecond)
		enableErrCh <- enableDistributorBootstrapChannel(db, channel)
	}()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"gpt-5","stream":true}`))
	request.Header.Set("Content-Type", gin.MIMEJSON)

	start := time.Now()
	router.ServeHTTP(recorder, request)
	elapsed := time.Since(start)

	require.False(t, handlerCalled.Load())
	require.Less(t, elapsed, 100*time.Millisecond)
	require.Contains(t, recorder.Body.String(), "error")
	require.NotContains(t, recorder.Body.String(), ": PING")
	require.NoError(t, <-enableErrCh)
}

func TestDistributeResponsesBootstrapTimesOutWithStreamError(t *testing.T) {
	db := setupDistributorBootstrapTestDB(t)
	withDistributorBootstrapRecoverySetting(t, 1, 50, 10)
	_, err := seedDistributorBootstrapChannel(db, 1003, "gpt-5")
	require.NoError(t, err)

	var handlerCalled atomic.Bool
	router := newDistributorBootstrapRouter(func(c *gin.Context) {
		handlerCalled.Store(true)
		require.NoError(t, helper.StringData(c, `{"status":"unexpected"}`))
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"gpt-5","stream":true}`))
	request.Header.Set("Content-Type", gin.MIMEJSON)

	router.ServeHTTP(recorder, request)

	require.False(t, handlerCalled.Load())
	require.Contains(t, recorder.Header().Get("Content-Type"), "text/event-stream")
	require.Contains(t, recorder.Body.String(), ": PING")
	require.Contains(t, recorder.Body.String(), "event: error")
	require.Contains(t, recorder.Body.String(), "req-bootstrap-test")
	require.Contains(t, recorder.Body.String(), "gpt-5")
}
