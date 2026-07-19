package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type channelMonitorSettingsAPIResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Data    channelMonitorSettings `json:"data"`
}

type channelMonitorGroupSyncAPIResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Group         string  `json:"group"`
		UpstreamRatio float64 `json:"upstream_ratio"`
		Coefficient   float64 `json:"coefficient"`
		Ratio         float64 `json:"ratio"`
	} `json:"data"`
}

type channelMonitorUpstreamConfigAPIResponse struct {
	Success bool                         `json:"success"`
	Data    channelMonitorUpstreamConfig `json:"data"`
}

type channelMonitorUpstreamGroupsAPIResponse struct {
	Success bool                                       `json:"success"`
	Data    service.ChannelMonitorUpstreamGroupsResult `json:"data"`
}

type channelMonitorUpstreamGroupApplyAPIResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Result      service.NewAPIGroupRatioResult `json:"result"`
		KeysUpdated int                            `json:"keys_updated"`
		Changed     bool                           `json:"changed"`
	} `json:"data"`
}

type channelMonitorUpstreamBalanceAPIResponse struct {
	Success bool                                        `json:"success"`
	Data    service.ChannelMonitorUpstreamBalanceResult `json:"data"`
}

type channelMonitorOverviewAPIResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Channels     []channelMonitorItem `json:"channels"`
		ChannelOrder []int                `json:"channel_order"`
	} `json:"data"`
}

type channelMonitorOrderAPIResponse struct {
	Success bool `json:"success"`
	Data    struct {
		ChannelOrder []int `json:"channel_order"`
	} `json:"data"`
}

type channelMonitorTaskRunAPIResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Created bool                     `json:"created"`
		Task    model.SystemTaskResponse `json:"task"`
	} `json:"data"`
}

func useChannelMonitorOptionMap(t *testing.T, values map[string]string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	original := common.OptionMap
	common.OptionMap = make(map[string]string, len(values))
	for key, value := range values {
		common.OptionMap[key] = value
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = original
		common.OptionMapRWMutex.Unlock()
	})
}

func setupChannelMonitorControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalRedisEnabled := common.RedisEnabled

	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.MemoryCacheEnabled = false
	common.RedisEnabled = false
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(
		&model.Option{},
		&model.User{},
		&model.Log{},
		&model.Channel{},
		&model.Ability{},
		&model.ChannelRatioMonitor{},
		&model.ChannelRatioHistory{},
		&model.SystemTask{},
	))

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.RedisEnabled = originalRedisEnabled
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})
	return db
}

func disableChannelMonitorSSRFProtection(t *testing.T) {
	t.Helper()
	fetchSetting := system_setting.GetFetchSetting()
	originalFetchSetting := *fetchSetting
	fetchSetting.EnableSSRFProtection = false
	service.InitHttpClient()
	t.Cleanup(func() {
		*fetchSetting = originalFetchSetting
		service.InitHttpClient()
	})
}

func newChannelMonitorControllerContext(t *testing.T, method string, target string, body any) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	payload, err := common.Marshal(body)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", 1)
	ctx.Set("username", "root")
	return ctx, recorder
}

func TestChannelMonitorSettingsDefaultAndTaskInterval(t *testing.T) {
	tests := []struct {
		name             string
		values           map[string]string
		wantInterval     int
		wantRetryCount   int
		wantEmailEnabled bool
		wantEnabled      bool
		wantTaskInterval time.Duration
	}{
		{
			name:             "missing values are disabled",
			values:           map[string]string{},
			wantRetryCount:   defaultChannelMonitorAutoUpdateRetryCount,
			wantTaskInterval: time.Minute,
		},
		{
			name: "valid values",
			values: map[string]string{
				channelMonitorAutoUpdateIntervalOption:   "30",
				channelMonitorAutoUpdateRetryCountOption: "4",
				channelMonitorEmailNotificationOption:    "true",
				channelMonitorNotificationEmailOption:    "alerts@example.com",
			},
			wantInterval:     30,
			wantRetryCount:   4,
			wantEmailEnabled: true,
			wantEnabled:      true,
			wantTaskInterval: 30 * time.Minute,
		},
		{
			name: "invalid values use safe defaults",
			values: map[string]string{
				channelMonitorAutoUpdateIntervalOption:   "525601",
				channelMonitorAutoUpdateRetryCountOption: "11",
				channelMonitorEmailNotificationOption:    "invalid",
				channelMonitorNotificationEmailOption:    "invalid",
			},
			wantRetryCount:   defaultChannelMonitorAutoUpdateRetryCount,
			wantTaskInterval: time.Minute,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			useChannelMonitorOptionMap(t, test.values)
			settings := getChannelMonitorSettings()
			assert.Equal(t, test.wantInterval, settings.AutoUpdateIntervalMinutes)
			assert.Equal(t, test.wantRetryCount, settings.AutoUpdateRetryCount)
			assert.Equal(t, test.wantEmailEnabled, settings.EmailNotificationEnabled)
			if test.name == "valid values" {
				assert.Equal(t, "alerts@example.com", settings.NotificationEmail)
			} else {
				assert.Empty(t, settings.NotificationEmail)
			}

			handler := channelRatioMonitorTaskHandler{}
			assert.Equal(t, test.wantEnabled, handler.Enabled())
			assert.Equal(t, test.wantTaskInterval, handler.Interval())
			assert.Equal(t, model.SystemTaskTypeChannelRatioMonitor, handler.Type())
		})
	}
}

func TestChannelSmartScheduleHandlerUsesSavedSwitchAndInterval(t *testing.T) {
	useChannelMonitorOptionMap(t, map[string]string{
		channelMonitorSmartScheduleEnabledOption:  "true",
		channelMonitorSmartScheduleIntervalOption: "25",
		channelMonitorSmartScheduleStrategyOption: channelMonitorSmartScheduleStrategyStability,
	})

	settings := getChannelMonitorSettings()
	assert.True(t, settings.SmartScheduleEnabled)
	assert.Equal(t, 25, settings.SmartScheduleIntervalMinutes)
	assert.Equal(t, channelMonitorSmartScheduleStrategyStability, settings.SmartScheduleStrategy)
	assert.Equal(t, channelMonitorSmartScheduleApplyWeight, settings.SmartScheduleApplyMode)
	assert.Equal(t, defaultChannelMonitorSmartScheduleRange, settings.SmartSchedulePerformanceMinutes)
	assert.Equal(t, defaultChannelMonitorSmartScheduleSamples, settings.SmartScheduleMinSamples)

	handler := channelSmartScheduleTaskHandler{}
	assert.True(t, handler.Enabled())
	assert.Equal(t, 25*time.Minute, handler.Interval())
	assert.Equal(t, channelMonitorSmartScheduleTaskType, handler.Type())
}

func TestUpdateChannelMonitorSettingsValidatesAndPersists(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{})

	invalidRequests := []map[string]any{
		{},
		{"auto_update_interval_minutes": -1},
		{"auto_update_interval_minutes": maxChannelMonitorAutoUpdateIntervalMinutes + 1},
		{"auto_update_retry_count": -1},
		{"auto_update_retry_count": maxChannelMonitorAutoUpdateRetryCount + 1},
		{"email_notification_enabled": true},
		{"notification_email": "invalid"},
		{"notification_email": strings.Repeat("a", maxChannelMonitorNotificationEmailLength) + "@example.com"},
		{"smart_schedule_interval_minutes": 0},
		{"smart_schedule_strategy": "invalid"},
		{"smart_schedule_apply_mode": "invalid"},
		{"smart_schedule_performance_minutes": 30},
		{"smart_schedule_model": strings.Repeat("m", maxChannelMonitorSmartScheduleModelLength+1)},
		{"smart_schedule_min_samples": 0},
		{"smart_schedule_min_samples": maxChannelMonitorSmartScheduleMinSamples + 1},
	}
	for _, request := range invalidRequests {
		ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/settings", request)
		UpdateChannelMonitorSettings(ctx)
		assert.Equal(t, http.StatusBadRequest, recorder.Code)
	}

	request := map[string]any{
		"auto_update_interval_minutes":       15,
		"auto_update_retry_count":            3,
		"email_notification_enabled":         true,
		"notification_email":                 "alerts@example.com",
		"smart_schedule_enabled":             true,
		"smart_schedule_interval_minutes":    10,
		"smart_schedule_strategy":            channelMonitorSmartScheduleStrategySmart,
		"smart_schedule_apply_mode":          channelMonitorSmartScheduleApplyPriorityWeight,
		"smart_schedule_performance_minutes": 360,
		"smart_schedule_model":               "gpt-4o-mini",
		"smart_schedule_min_samples":         8,
	}
	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/settings", request)
	UpdateChannelMonitorSettings(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var response channelMonitorSettingsAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, 15, response.Data.AutoUpdateIntervalMinutes)
	assert.Equal(t, 3, response.Data.AutoUpdateRetryCount)
	assert.True(t, response.Data.EmailNotificationEnabled)
	assert.Equal(t, "alerts@example.com", response.Data.NotificationEmail)
	assert.True(t, response.Data.SmartScheduleEnabled)
	assert.Equal(t, 10, response.Data.SmartScheduleIntervalMinutes)
	assert.Equal(t, channelMonitorSmartScheduleStrategySmart, response.Data.SmartScheduleStrategy)
	assert.Equal(t, channelMonitorSmartScheduleApplyPriorityWeight, response.Data.SmartScheduleApplyMode)
	assert.Equal(t, 360, response.Data.SmartSchedulePerformanceMinutes)
	assert.Equal(t, "gpt-4o-mini", response.Data.SmartScheduleModel)
	assert.Equal(t, 8, response.Data.SmartScheduleMinSamples)

	var option model.Option
	require.NoError(t, db.Where("key = ?", channelMonitorAutoUpdateIntervalOption).First(&option).Error)
	assert.Equal(t, "15", option.Value)
	option = model.Option{}
	require.NoError(t, db.Where("key = ?", channelMonitorAutoUpdateRetryCountOption).First(&option).Error)
	assert.Equal(t, "3", option.Value)
	option = model.Option{}
	require.NoError(t, db.Where("key = ?", channelMonitorEmailNotificationOption).First(&option).Error)
	assert.Equal(t, "true", option.Value)
	option = model.Option{}
	require.NoError(t, db.Where("key = ?", channelMonitorNotificationEmailOption).First(&option).Error)
	assert.Equal(t, "alerts@example.com", option.Value)
	option = model.Option{}
	require.NoError(t, db.Where("key = ?", channelMonitorSmartScheduleEnabledOption).First(&option).Error)
	assert.Equal(t, "true", option.Value)
	option = model.Option{}
	require.NoError(t, db.Where("key = ?", channelMonitorSmartScheduleStrategyOption).First(&option).Error)
	assert.Equal(t, channelMonitorSmartScheduleStrategySmart, option.Value)
	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/settings", map[string]any{
		"email_notification_enabled": false,
		"notification_email":         "",
	})
	UpdateChannelMonitorSettings(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, 15, response.Data.AutoUpdateIntervalMinutes)
	assert.Equal(t, 3, response.Data.AutoUpdateRetryCount)
	assert.False(t, response.Data.EmailNotificationEnabled)
	assert.Empty(t, response.Data.NotificationEmail)
}

func TestEnablingChannelSmartScheduleExcludesEveryChannel(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{})
	require.NoError(t, db.Create([]model.Channel{
		{Id: 41, Name: "configured channel", Status: common.ChannelStatusEnabled, Group: "vip"},
		{Id: 42, Name: "new channel", Status: common.ChannelStatusEnabled, Group: "vip"},
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId:             41,
		Ratio:                 1.25,
		UpdatedTime:           100,
		SmartScheduleExcluded: false,
		SmartScheduleGroup:    "vip",
	}).Error)

	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/settings", map[string]any{
		"smart_schedule_enabled": true,
	})
	UpdateChannelMonitorSettings(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	for _, channelId := range []int{41, 42} {
		var monitor model.ChannelRatioMonitor
		require.NoError(t, db.Where("channel_id = ?", channelId).First(&monitor).Error)
		assert.True(t, monitor.SmartScheduleExcluded)
	}
	var configuredMonitor model.ChannelRatioMonitor
	require.NoError(t, db.Where("channel_id = ?", 41).First(&configuredMonitor).Error)
	assert.Equal(t, "vip", configuredMonitor.SmartScheduleGroup)
	assert.Equal(t, 1.25, configuredMonitor.Ratio)

	require.NoError(t, db.Model(&model.ChannelRatioMonitor{}).
		Where("channel_id = ?", 41).
		Update("smart_schedule_excluded", false).Error)
	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/settings", map[string]any{
		"smart_schedule_enabled":          true,
		"smart_schedule_interval_minutes": 20,
	})
	UpdateChannelMonitorSettings(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.NoError(t, db.Where("channel_id = ?", 41).First(&configuredMonitor).Error)
	assert.False(t, configuredMonitor.SmartScheduleExcluded)

	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/settings", map[string]any{
		"smart_schedule_enabled": false,
	})
	UpdateChannelMonitorSettings(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/settings", map[string]any{
		"smart_schedule_enabled": true,
	})
	UpdateChannelMonitorSettings(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.NoError(t, db.Where("channel_id = ?", 41).First(&configuredMonitor).Error)
	assert.True(t, configuredMonitor.SmartScheduleExcluded)
}

func TestRunChannelMonitorRatioUpdateReusesActiveTask(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{})

	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPost, "/api/channel_monitor/ratio/run", nil)
	RunChannelMonitorRatioUpdate(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	var firstResponse channelMonitorTaskRunAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &firstResponse))
	require.True(t, firstResponse.Success)
	assert.True(t, firstResponse.Data.Created)
	assert.Equal(t, model.SystemTaskTypeChannelRatioMonitor, firstResponse.Data.Task.Type)
	assert.Equal(t, model.SystemTaskStatusPending, firstResponse.Data.Task.Status)

	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPost, "/api/channel_monitor/ratio/run", nil)
	RunChannelMonitorRatioUpdate(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	var secondResponse channelMonitorTaskRunAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &secondResponse))
	require.True(t, secondResponse.Success)
	assert.False(t, secondResponse.Data.Created)
	assert.Equal(t, firstResponse.Data.Task.TaskID, secondResponse.Data.Task.TaskID)

	var taskCount int64
	require.NoError(t, db.Model(&model.SystemTask{}).
		Where("type = ?", model.SystemTaskTypeChannelRatioMonitor).
		Count(&taskCount).Error)
	assert.EqualValues(t, 1, taskCount)
}

func TestChannelMonitorOverviewIncludesLastFetchFailure(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{})
	testModel := "gpt-4.1-mini"
	channelRemark := "临时渠道，晚高峰可能波动"
	upstreamBalance := 18.75
	require.NoError(t, db.Create(&model.Channel{
		Id:        9,
		Name:      "failed upstream",
		Key:       "secret",
		Remark:    &channelRemark,
		Status:    common.ChannelStatusEnabled,
		Models:    "gpt-4.1-mini,gpt-4.1",
		TestModel: &testModel,
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId:           9,
		LastFetchStatus:     model.ChannelRatioFetchStatusFailed,
		LastFetchError:      "upstream timeout",
		LastFetchTime:       123456,
		ConsecutiveFailures: 3,
		UpstreamBalance:     &upstreamBalance,
		LastBalanceTime:     123400,
		LastBalanceError:    "balance refresh timeout",
	}).Error)

	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodGet, "/api/channel_monitor/", nil)
	GetChannelMonitorOverview(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var response channelMonitorOverviewAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Len(t, response.Data.Channels, 1)
	assert.Equal(t, []int{9}, response.Data.ChannelOrder)
	item := response.Data.Channels[0]
	assert.Equal(t, channelRemark, item.ChannelRemark)
	assert.Equal(t, "gpt-4.1-mini,gpt-4.1", item.Models)
	assert.Equal(t, &testModel, item.TestModel)
	assert.Equal(t, model.ChannelRatioFetchStatusFailed, item.LastFetchStatus)
	assert.Equal(t, "upstream timeout", item.LastFetchError)
	assert.EqualValues(t, 123456, item.LastFetchTime)
	assert.Equal(t, 3, item.ConsecutiveFailures)
	require.NotNil(t, item.UpstreamBalance)
	assert.InDelta(t, upstreamBalance, *item.UpstreamBalance, 1e-9)
	assert.EqualValues(t, 123400, item.LastBalanceTime)
	assert.Equal(t, "balance refresh timeout", item.LastBalanceError)
}

func TestUpdateChannelMonitorChannelOrderPersistsNormalizedOrder(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{})
	highPriority := int64(30)
	middlePriority := int64(20)
	lowPriority := int64(10)
	require.NoError(t, db.Create(&[]model.Channel{
		{Id: 1, Name: "one", Key: "secret-1", Priority: &highPriority},
		{Id: 2, Name: "two", Key: "secret-2", Priority: &middlePriority},
		{Id: 3, Name: "three", Key: "secret-3", Priority: &lowPriority},
	}).Error)

	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/order", map[string]any{
		"channel_ids": []int{3, 1},
	})
	UpdateChannelMonitorChannelOrder(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var response channelMonitorOrderAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, []int{3, 1, 2}, response.Data.ChannelOrder)

	common.OptionMapRWMutex.RLock()
	storedChannelOrder := common.OptionMap[channelMonitorChannelOrderOption]
	common.OptionMapRWMutex.RUnlock()
	var channelOrder []int
	require.NoError(t, common.UnmarshalJsonStr(storedChannelOrder, &channelOrder))
	assert.Equal(t, []int{3, 1, 2}, channelOrder)

	invalidRequests := []map[string]any{
		{"channel_ids": []int{1, 1}},
		{"channel_ids": []int{999}},
		{},
	}
	for _, request := range invalidRequests {
		ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/order", request)
		UpdateChannelMonitorChannelOrder(ctx)
		assert.Equal(t, http.StatusBadRequest, recorder.Code)
	}
}

func TestSaveChannelMonitorUpstreamConfigPersistsChannelPolicies(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	baseURL := "https://upstream.example"
	require.NoError(t, db.Create(&model.Channel{
		Id:      10,
		Name:    "stable",
		Key:     "secret",
		Group:   "vip",
		BaseURL: &baseURL,
		Status:  common.ChannelStatusEnabled,
	}).Error)

	request := map[string]any{
		"type":                     service.NewAPIUpstreamType,
		"base_url":                 "https://upstream.example",
		"group":                    "vip",
		"auth_type":                service.NewAPIUpstreamAuthPublic,
		"single_channel_action":    channelMonitorPolicyActionUpdateGroupRatio,
		"multiple_channels_action": channelMonitorPolicyActionDisableChannel,
	}
	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/10/upstream", request)
	ctx.Params = gin.Params{{Key: "id", Value: "10"}}
	SaveChannelMonitorUpstreamConfig(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var response channelMonitorUpstreamConfigAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, channelMonitorPolicyActionUpdateGroupRatio, response.Data.SingleChannelAction)
	assert.Equal(t, channelMonitorPolicyActionDisableChannel, response.Data.MultipleChannelsAction)

	monitor, err := model.GetChannelRatioMonitor(10)
	require.NoError(t, err)
	assert.Equal(t, channelMonitorPolicyActionUpdateGroupRatio, monitor.SingleChannelAction)
	assert.Equal(t, channelMonitorPolicyActionDisableChannel, monitor.MultipleChannelsAction)

	delete(request, "single_channel_action")
	delete(request, "multiple_channels_action")
	request["group"] = "standard"
	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/10/upstream", request)
	ctx.Params = gin.Params{{Key: "id", Value: "10"}}
	SaveChannelMonitorUpstreamConfig(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	monitor, err = model.GetChannelRatioMonitor(10)
	require.NoError(t, err)
	assert.Equal(t, "standard", monitor.UpstreamGroup)
	assert.Equal(t, channelMonitorPolicyActionUpdateGroupRatio, monitor.SingleChannelAction)
	assert.Equal(t, channelMonitorPolicyActionDisableChannel, monitor.MultipleChannelsAction)

	request["single_channel_action"] = "invalid"
	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/10/upstream", request)
	ctx.Params = gin.Params{{Key: "id", Value: "10"}}
	SaveChannelMonitorUpstreamConfig(ctx)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
}

func TestSaveChannelMonitorUpstreamConfigManagesBalanceWarningThreshold(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	baseURL := "https://upstream.example"
	require.NoError(t, db.Create(&model.Channel{
		Id:      11,
		Name:    "balance alert",
		Key:     "secret",
		Group:   "vip",
		BaseURL: &baseURL,
		Status:  common.ChannelStatusEnabled,
	}).Error)

	request := map[string]any{
		"type":                      service.NewAPIUpstreamType,
		"base_url":                  baseURL,
		"group":                     "vip",
		"auth_type":                 service.NewAPIUpstreamAuthPublic,
		"balance_warning_threshold": 20.5,
	}
	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/11/upstream", request)
	ctx.Params = gin.Params{{Key: "id", Value: "11"}}
	SaveChannelMonitorUpstreamConfig(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	var response channelMonitorUpstreamConfigAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.NotNil(t, response.Data.BalanceWarningThreshold)
	assert.Equal(t, 20.5, *response.Data.BalanceWarningThreshold)

	delete(request, "balance_warning_threshold")
	request["group"] = "standard"
	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/11/upstream", request)
	ctx.Params = gin.Params{{Key: "id", Value: "11"}}
	SaveChannelMonitorUpstreamConfig(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	monitor, err := model.GetChannelRatioMonitor(11)
	require.NoError(t, err)
	require.NotNil(t, monitor.BalanceWarningThreshold)
	assert.Equal(t, 20.5, *monitor.BalanceWarningThreshold)

	request["balance_warning_threshold"] = nil
	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/11/upstream", request)
	ctx.Params = gin.Params{{Key: "id", Value: "11"}}
	SaveChannelMonitorUpstreamConfig(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	monitor, err = model.GetChannelRatioMonitor(11)
	require.NoError(t, err)
	assert.Nil(t, monitor.BalanceWarningThreshold)

	for _, invalidThreshold := range []any{-0.01, maxChannelMonitorBalanceWarningThreshold + 1, "not-a-number"} {
		request["balance_warning_threshold"] = invalidThreshold
		ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/11/upstream", request)
		ctx.Params = gin.Params{{Key: "id", Value: "11"}}
		SaveChannelMonitorUpstreamConfig(ctx)
		assert.Equal(t, http.StatusBadRequest, recorder.Code)
	}
}

func TestSaveChannelMonitorUpstreamConfigManagesSyncCapabilities(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	baseURL := "https://upstream.example"
	require.NoError(t, db.Create(&model.Channel{
		Id:      12,
		Name:    "custom upstream",
		Key:     "secret",
		Group:   "vip",
		BaseURL: &baseURL,
		Status:  common.ChannelStatusEnabled,
	}).Error)

	request := map[string]any{
		"type":                 service.NewAPIUpstreamType,
		"base_url":             baseURL,
		"group":                "vip",
		"auth_type":            service.NewAPIUpstreamAuthPublic,
		"ratio_sync_enabled":   false,
		"balance_sync_enabled": false,
	}
	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/12/upstream", request)
	ctx.Params = gin.Params{{Key: "id", Value: "12"}}
	SaveChannelMonitorUpstreamConfig(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var response channelMonitorUpstreamConfigAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.False(t, response.Data.RatioSyncEnabled)
	assert.False(t, response.Data.BalanceSyncEnabled)
	monitor, err := model.GetChannelRatioMonitor(12)
	require.NoError(t, err)
	assert.True(t, monitor.UpstreamRatioSyncDisabled)
	assert.True(t, monitor.UpstreamBalanceSyncDisabled)

	delete(request, "ratio_sync_enabled")
	delete(request, "balance_sync_enabled")
	request["group"] = "standard"
	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/12/upstream", request)
	ctx.Params = gin.Params{{Key: "id", Value: "12"}}
	SaveChannelMonitorUpstreamConfig(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	monitor, err = model.GetChannelRatioMonitor(12)
	require.NoError(t, err)
	assert.True(t, monitor.UpstreamRatioSyncDisabled)
	assert.True(t, monitor.UpstreamBalanceSyncDisabled)

	request["ratio_sync_enabled"] = true
	request["balance_sync_enabled"] = true
	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/12/upstream", request)
	ctx.Params = gin.Params{{Key: "id", Value: "12"}}
	SaveChannelMonitorUpstreamConfig(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	monitor, err = model.GetChannelRatioMonitor(12)
	require.NoError(t, err)
	assert.False(t, monitor.UpstreamRatioSyncDisabled)
	assert.False(t, monitor.UpstreamBalanceSyncDisabled)
}

func TestSaveChannelMonitorSub2APIConfigPersistsToken(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	baseURL := "https://upstream.example"
	require.NoError(t, db.Create(&model.Channel{
		Id:      13,
		Name:    "session-bound upstream",
		Key:     "secret",
		Group:   "vip",
		BaseURL: &baseURL,
		Status:  common.ChannelStatusEnabled,
	}).Error)

	request := map[string]any{
		"type":          service.Sub2APIUpstreamType,
		"base_url":      baseURL,
		"group":         "vip",
		"auth_type":     service.Sub2APIAuthToken,
		"access_token":  "jwt-token",
	}
	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/13/upstream", request)
	ctx.Params = gin.Params{{Key: "id", Value: "13"}}
	SaveChannelMonitorUpstreamConfig(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	monitor, err := model.GetChannelRatioMonitor(13)
	require.NoError(t, err)
	assert.Equal(t, "jwt-token", monitor.UpstreamAccessToken)
	assert.NotContains(t, recorder.Body.String(), "jwt-token")
}

func TestSaveChannelMonitorSub2APIConfigAllowsChannelKeyOnly(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	baseURL := "https://upstream.example"
	require.NoError(t, db.Create(&model.Channel{
		Id:      14,
		Name:    "api-key-only upstream",
		Key:     "sk-direct",
		Group:   "vip",
		BaseURL: &baseURL,
		Status:  common.ChannelStatusEnabled,
	}).Error)

	request := map[string]any{
		"type":      service.Sub2APIUpstreamType,
		"base_url":  baseURL,
		"group":     "vip",
		"auth_type": service.Sub2APIAuthAPIKey,
	}
	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/channel/14/upstream", request)
	ctx.Params = gin.Params{{Key: "id", Value: "14"}}
	SaveChannelMonitorUpstreamConfig(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	monitor, err := model.GetChannelRatioMonitor(14)
	require.NoError(t, err)
	assert.Equal(t, service.Sub2APIUpstreamType, monitor.UpstreamType)
	assert.Equal(t, service.Sub2APIAuthAPIKey, monitor.UpstreamAuthType)
	assert.Empty(t, monitor.UpstreamAccessToken)
	assert.Contains(t, recorder.Body.String(), `"has_access_token":false`)
}

func TestListChannelMonitorUpstreamGroupsUsesSavedSub2APIToken(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	disableChannelMonitorSSRFProtection(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		assert.Equal(t, "Bearer jwt-token", r.Header.Get("Authorization"))
		switch r.URL.Path {
		case "/api/v1/groups/available":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":[{"id":7,"name":"vip","rate_multiplier":1.25}]}`))
		case "/api/v1/groups/rates":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{}}`))
		case "/api/v1/keys":
			assert.Equal(t, "secret", r.URL.Query().Get("search"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"items":[{"id":99,"key":"secret","group_id":7}],"total":1,"page":1,"page_size":1000,"pages":1}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	baseURL := server.URL
	require.NoError(t, db.Create(&model.Channel{
		Id:      20,
		Name:    "sub2api",
		Key:     "secret",
		Group:   "vip",
		BaseURL: &baseURL,
		Status:  common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId:            20,
		UpstreamType:         service.Sub2APIUpstreamType,
		UpstreamBaseURL:      server.URL,
		UpstreamGroup:        "vip",
		UpstreamAuthType:     service.Sub2APIAuthToken,
		UpstreamAccessToken:  "jwt-token",
	}).Error)

	request := map[string]any{
		"type":          service.Sub2APIUpstreamType,
		"base_url":      server.URL,
		"group":         "vip",
		"auth_type":     service.Sub2APIAuthToken,
		"access_token":  "",
	}
	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPost, "/api/channel_monitor/channel/20/upstream/groups", request)
	ctx.Params = gin.Params{{Key: "id", Value: "20"}}
	ListChannelMonitorUpstreamGroups(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var response channelMonitorUpstreamGroupsAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Len(t, response.Data.Groups, 1)
	assert.Equal(t, "vip", response.Data.Groups[0].Name)
	assert.Equal(t, 1.25, response.Data.Groups[0].Ratio)
	assert.Equal(t, "vip", response.Data.AppliedGroup)
	assert.Empty(t, response.Data.AppliedGroupError)

	monitor, err := model.GetChannelRatioMonitor(20)
	require.NoError(t, err)
	assert.Equal(t, "jwt-token", monitor.UpstreamAccessToken)
}

func TestListChannelMonitorUpstreamGroupsAcceptsUnsavedSub2APIToken(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	disableChannelMonitorSSRFProtection(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		assert.Equal(t, "Bearer jwt-token", r.Header.Get("Authorization"))
		switch r.URL.Path {
		case "/api/v1/groups/available":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":[{"id":7,"name":"vip","rate_multiplier":1.25}]}`))
		case "/api/v1/groups/rates":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{}}`))
		case "/api/v1/keys":
			assert.Equal(t, "secret", r.URL.Query().Get("search"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"items":[{"id":99,"key":"secret","group_id":7}],"total":1,"page":1,"page_size":1000,"pages":1}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	baseURL := server.URL
	require.NoError(t, db.Create(&model.Channel{
		Id:      21,
		Name:    "unconfigured sub2api",
		Key:     "secret",
		Group:   "vip",
		BaseURL: &baseURL,
		Status:  common.ChannelStatusEnabled,
	}).Error)

	request := map[string]any{
		"type":                 service.Sub2APIUpstreamType,
		"base_url":             server.URL,
		"group":                "",
		"auth_type":            service.Sub2APIAuthToken,
		"access_token":         "jwt-token",
		"balance_sync_enabled": false,
	}
	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPost, "/api/channel_monitor/channel/21/upstream/groups", request)
	ctx.Params = gin.Params{{Key: "id", Value: "21"}}
	ListChannelMonitorUpstreamGroups(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var response channelMonitorUpstreamGroupsAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Len(t, response.Data.Groups, 1)
	assert.Equal(t, "vip", response.Data.Groups[0].Name)
	assert.Equal(t, "vip", response.Data.AppliedGroup)

	_, err := model.GetChannelRatioMonitor(21)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestApplyChannelMonitorUpstreamGroupUpdatesRemoteTokenAndRecordsRatio(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	disableChannelMonitorSSRFProtection(t)

	updatedGroup := ""
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		assert.Equal(t, "Bearer dashboard-token", r.Header.Get("Authorization"))
		assert.Equal(t, "42", r.Header.Get("New-Api-User"))
		switch r.URL.Path {
		case "/api/user/self/groups":
			_, _ = w.Write([]byte(`{"success":true,"data":{"vip":{"ratio":1.4}}}`))
		case "/api/token/search":
			assert.Equal(t, "sk-channel", r.URL.Query().Get("token"))
			_, _ = w.Write([]byte(`{"success":true,"data":{"items":[{"id":31,"name":"channel","expired_time":-1,"remain_quota":0,"unlimited_quota":true,"model_limits_enabled":false,"model_limits":"","allow_ips":null,"group":"default","cross_group_retry":false}]}}`))
		case "/api/token/":
			var request struct {
				Group string `json:"group"`
			}
			require.NoError(t, common.DecodeJson(r.Body, &request))
			updatedGroup = request.Group
			_, _ = w.Write([]byte(`{"success":true,"message":""}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	baseURL := server.URL
	require.NoError(t, db.Create(&model.Channel{
		Id:      22,
		Name:    "new-api",
		Key:     "sk-channel",
		Group:   "vip",
		BaseURL: &baseURL,
		Status:  common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId:           22,
		Ratio:               1,
		UpdatedTime:         1,
		UpstreamType:        service.NewAPIUpstreamType,
		UpstreamBaseURL:     server.URL,
		UpstreamGroup:       "vip",
		UpstreamAuthType:    service.NewAPIUpstreamAuthUser,
		UpstreamUserId:      42,
		UpstreamAccessToken: "dashboard-token",
	}).Error)

	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPost, "/api/channel_monitor/channel/22/upstream/group/apply", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "22"}}
	ApplyChannelMonitorUpstreamGroup(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var response channelMonitorUpstreamGroupApplyAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, recorder.Body.String())
	assert.Equal(t, "vip", updatedGroup)
	assert.Equal(t, 1, response.Data.KeysUpdated)
	assert.True(t, response.Data.Changed)
	assert.InDelta(t, 1.4, response.Data.Result.Ratio, 1e-9)
	assert.NotContains(t, recorder.Body.String(), "dashboard-token")
	assert.NotContains(t, recorder.Body.String(), "sk-channel")

	monitor, err := model.GetChannelRatioMonitor(22)
	require.NoError(t, err)
	assert.InDelta(t, 1.4, monitor.Ratio, 1e-9)
	assert.Equal(t, model.ChannelRatioFetchStatusSucceeded, monitor.LastFetchStatus)
	assert.Contains(t, monitor.Remark, "切换到分组 vip")
}

func TestFetchChannelMonitorUpstreamBalanceRecordsSnapshot(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{})
	disableChannelMonitorSSRFProtection(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/user/self":
			assert.Equal(t, "Bearer dashboard-token", r.Header.Get("Authorization"))
			assert.Equal(t, "42", r.Header.Get("New-Api-User"))
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota":1750000}}`))
		case "/api/status":
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota_per_unit":500000}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	require.NoError(t, db.Create(&model.Channel{
		Id: 23, Name: "balance", Key: "secret", Status: common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId:           23,
		UpstreamType:        service.NewAPIUpstreamType,
		UpstreamBaseURL:     server.URL,
		UpstreamAuthType:    service.NewAPIUpstreamAuthUser,
		UpstreamUserId:      42,
		UpstreamAccessToken: "dashboard-token",
	}).Error)

	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPost, "/api/channel_monitor/channel/23/upstream/balance/fetch", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "23"}}
	FetchChannelMonitorUpstreamBalance(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var response channelMonitorUpstreamBalanceAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, recorder.Body.String())
	require.NotNil(t, response.Data.Amount)
	assert.InDelta(t, 3.5, *response.Data.Amount, 1e-9)

	monitor, err := model.GetChannelRatioMonitor(23)
	require.NoError(t, err)
	require.NotNil(t, monitor.UpstreamBalance)
	assert.InDelta(t, 3.5, *monitor.UpstreamBalance, 1e-9)
	assert.NotZero(t, monitor.LastBalanceTime)
	assert.Empty(t, monitor.LastBalanceError)
}

func TestManualUpstreamRefreshSkipsDisabledCapabilities(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	var upstreamRequests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		upstreamRequests.Add(1)
		http.Error(w, "unsupported", http.StatusNotFound)
	}))
	defer server.Close()

	require.NoError(t, db.Create(&model.Channel{
		Id: 24, Name: "custom upstream", Key: "secret", Status: common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId:                   24,
		UpstreamType:                service.NewAPIUpstreamType,
		UpstreamBaseURL:             server.URL,
		UpstreamGroup:               "vip",
		UpstreamAuthType:            service.NewAPIUpstreamAuthPublic,
		UpstreamRatioSyncDisabled:   true,
		UpstreamBalanceSyncDisabled: true,
	}).Error)

	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPost, "/api/channel_monitor/channel/24/upstream/fetch", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "24"}}
	FetchChannelMonitorUpstreamRatio(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "该渠道已关闭上游倍率同步")

	ctx, recorder = newChannelMonitorControllerContext(t, http.MethodPost, "/api/channel_monitor/channel/24/upstream/balance/fetch", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "24"}}
	FetchChannelMonitorUpstreamBalance(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "该渠道已关闭上游余额同步")
	assert.Zero(t, upstreamRequests.Load())
}

func TestResolveChannelMonitorUpstreamRequestDoesNotReuseCredentialsAcrossHosts(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	oldBaseURL := "https://old.example"
	require.NoError(t, db.Create(&model.Channel{
		Id:      21,
		Name:    "secure",
		Key:     "secret",
		BaseURL: &oldBaseURL,
		Status:  common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId:           21,
		UpstreamType:        service.NewAPIUpstreamType,
		UpstreamBaseURL:     oldBaseURL,
		UpstreamAuthType:    service.NewAPIUpstreamAuthUser,
		UpstreamUserId:      7,
		UpstreamAccessToken: "saved-token",
	}).Error)
	channel, err := model.GetChannelById(21, false)
	require.NoError(t, err)

	_, err = resolveChannelMonitorUpstreamRequest(channel, channelMonitorUpstreamRequest{
		Type:     service.NewAPIUpstreamType,
		BaseURL:  "https://new.example",
		Group:    "vip",
		AuthType: service.NewAPIUpstreamAuthUser,
		UserId:   7,
	}, true)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "访问令牌")
}

func TestPlanChannelMonitorPolicyActions(t *testing.T) {
	enabledChannel := func(id int, group string) *model.Channel {
		return &model.Channel{Id: id, Group: group, Status: common.ChannelStatusEnabled}
	}

	t.Run("single channel update uses coefficient", func(t *testing.T) {
		plan := planChannelMonitorPolicyActions(
			[]*model.Channel{enabledChannel(1, "vip")},
			map[int]channelMonitorPolicyInput{
				1: {UpstreamRatio: 1.2, SingleChannelAction: channelMonitorPolicyActionUpdateGroupRatio},
			},
			map[string]float64{"vip": 1},
			map[string]float64{"vip": 1.1},
		)
		require.Contains(t, plan.GroupRatioUpdates, "vip")
		assert.InDelta(t, 1.32, plan.GroupRatioUpdates["vip"], 1e-9)
		assert.Empty(t, plan.DisableChannelIds)
	})

	t.Run("disabled peers use single channel policy", func(t *testing.T) {
		disabled := &model.Channel{Id: 2, Group: "vip", Status: common.ChannelStatusManuallyDisabled}
		plan := planChannelMonitorPolicyActions(
			[]*model.Channel{enabledChannel(1, "vip"), disabled},
			map[int]channelMonitorPolicyInput{
				1: {UpstreamRatio: 1.25, SingleChannelAction: channelMonitorPolicyActionDisableChannel},
				2: {UpstreamRatio: 9, SingleChannelAction: channelMonitorPolicyActionUpdateGroupRatio},
			},
			map[string]float64{"vip": 1},
			nil,
		)
		assert.Equal(t, []int{1}, plan.DisableChannelIds)
	})

	t.Run("multiple channel update uses highest target", func(t *testing.T) {
		plan := planChannelMonitorPolicyActions(
			[]*model.Channel{enabledChannel(1, "vip"), enabledChannel(2, "vip")},
			map[int]channelMonitorPolicyInput{
				1: {UpstreamRatio: 1.1, MultipleChannelsAction: channelMonitorPolicyActionUpdateGroupRatio},
				2: {UpstreamRatio: 1.4, MultipleChannelsAction: channelMonitorPolicyActionUpdateGroupRatio},
			},
			map[string]float64{"vip": 1},
			map[string]float64{"vip": 1.2},
		)
		require.Contains(t, plan.GroupRatioUpdates, "vip")
		assert.InDelta(t, 1.68, plan.GroupRatioUpdates["vip"], 1e-9)
	})

	t.Run("multiple channel policies apply per channel", func(t *testing.T) {
		plan := planChannelMonitorPolicyActions(
			[]*model.Channel{
				enabledChannel(1, "vip"),
				enabledChannel(2, "vip"),
				enabledChannel(3, "vip"),
			},
			map[int]channelMonitorPolicyInput{
				1: {UpstreamRatio: 1.1, MultipleChannelsAction: channelMonitorPolicyActionNone},
				2: {UpstreamRatio: 1.3, MultipleChannelsAction: channelMonitorPolicyActionDisableChannel},
				3: {UpstreamRatio: 1.25, MultipleChannelsAction: channelMonitorPolicyActionUpdateGroupRatio},
			},
			map[string]float64{"vip": 1},
			nil,
		)
		assert.Equal(t, []int{2}, plan.DisableChannelIds)
		require.Contains(t, plan.GroupRatioUpdates, "vip")
		assert.InDelta(t, 1.25, plan.GroupRatioUpdates["vip"], 1e-9)
	})

	t.Run("temporary channel is disabled then stable channel uses single policy", func(t *testing.T) {
		plan := planChannelMonitorPolicyActions(
			[]*model.Channel{enabledChannel(1, "vip"), enabledChannel(2, "vip")},
			map[int]channelMonitorPolicyInput{
				1: {
					UpstreamRatio:          1.2,
					SingleChannelAction:    channelMonitorPolicyActionUpdateGroupRatio,
					MultipleChannelsAction: channelMonitorPolicyActionUpdateGroupRatio,
				},
				2: {
					UpstreamRatio:          1.5,
					SingleChannelAction:    channelMonitorPolicyActionDisableChannel,
					MultipleChannelsAction: channelMonitorPolicyActionDisableChannel,
				},
			},
			map[string]float64{"vip": 1},
			nil,
		)
		assert.Equal(t, []int{2}, plan.DisableChannelIds)
		require.Contains(t, plan.GroupRatioUpdates, "vip")
		assert.InDelta(t, 1.2, plan.GroupRatioUpdates["vip"], 1e-9)
	})

	t.Run("disabling a channel re-evaluates its other groups", func(t *testing.T) {
		plan := planChannelMonitorPolicyActions(
			[]*model.Channel{
				enabledChannel(1, "vip,team"),
				enabledChannel(2, "vip"),
				enabledChannel(3, "team"),
			},
			map[int]channelMonitorPolicyInput{
				1: {
					UpstreamRatio:          1.5,
					MultipleChannelsAction: channelMonitorPolicyActionDisableChannel,
				},
				2: {UpstreamRatio: 1.1},
				3: {
					UpstreamRatio:       2.5,
					SingleChannelAction: channelMonitorPolicyActionUpdateGroupRatio,
				},
			},
			map[string]float64{"vip": 1, "team": 2},
			nil,
		)
		assert.Equal(t, []int{1}, plan.DisableChannelIds)
		require.Contains(t, plan.GroupRatioUpdates, "team")
		assert.InDelta(t, 2.5, plan.GroupRatioUpdates["team"], 1e-9)
	})

	t.Run("incomplete current ratios skip group actions", func(t *testing.T) {
		plan := planChannelMonitorPolicyActions(
			[]*model.Channel{enabledChannel(1, "vip"), enabledChannel(2, "vip")},
			map[int]channelMonitorPolicyInput{
				1: {UpstreamRatio: 1.5, MultipleChannelsAction: channelMonitorPolicyActionDisableChannel},
			},
			map[string]float64{"vip": 1},
			nil,
		)
		assert.Empty(t, plan.DisableChannelIds)
		assert.Empty(t, plan.GroupRatioUpdates)
		assert.Equal(t, 1, plan.SkippedGroupCount)
	})
}

func TestApplyChannelMonitorPolicyPlanMarksGroupUpdateFailure(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	require.NoError(t, db.Migrator().DropTable(&model.Option{}))

	groupsUpdated, channelsDisabled, groupUpdateFailed, err := applyChannelMonitorPolicyPlan(
		context.Background(),
		channelMonitorPolicyPlan{GroupRatioUpdates: map[string]float64{"monitor-test": 2}},
	)

	require.Error(t, err)
	assert.Zero(t, groupsUpdated)
	assert.Zero(t, channelsDisabled)
	assert.True(t, groupUpdateFailed)
}

func TestSyncChannelMonitorGroupRatioUsesHighestEnabledChannel(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{"GroupRatio": `{"vip":1}`})
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"vip":1}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
	})

	channels := []model.Channel{
		{Id: 1, Name: "first", Key: "first-key", Group: "vip", Status: common.ChannelStatusEnabled},
		{Id: 2, Name: "highest", Key: "highest-key", Group: "vip", Status: common.ChannelStatusEnabled},
		{Id: 3, Name: "disabled", Key: "disabled-key", Group: "vip", Status: common.ChannelStatusManuallyDisabled},
	}
	require.NoError(t, db.Create(&channels).Error)
	monitors := []model.ChannelRatioMonitor{
		{ChannelId: 1, Ratio: 1.2, UpdatedTime: 1},
		{ChannelId: 2, Ratio: 1.5, UpdatedTime: 1},
		{ChannelId: 3, Ratio: 9, UpdatedTime: 1},
	}
	require.NoError(t, db.Create(&monitors).Error)

	ctx, recorder := newChannelMonitorControllerContext(t, http.MethodPut, "/api/channel_monitor/group/sync", map[string]any{
		"group": "vip", "coefficient": 1.1,
	})
	SyncChannelMonitorGroupRatio(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var response channelMonitorGroupSyncAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, "vip", response.Data.Group)
	assert.InDelta(t, 1.5, response.Data.UpstreamRatio, 1e-9)
	assert.InDelta(t, 1.1, response.Data.Coefficient, 1e-9)
	assert.InDelta(t, 1.65, response.Data.Ratio, 1e-9)
	assert.InDelta(t, 1.65, ratio_setting.GetGroupRatio("vip"), 1e-9)
	assert.InDelta(t, 1.1, getChannelMonitorGroupCoefficients()["vip"], 1e-9)
}

func TestRunChannelRatioMonitorTaskRespectsPerChannelSyncCapabilities(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{
		channelMonitorAutoUpdateRetryCountOption: "0",
	})
	disableChannelMonitorSSRFProtection(t)

	var ratioRequests atomic.Int32
	var balanceRequests atomic.Int32
	var statusRequests atomic.Int32
	var unexpectedRequests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/user/self/groups":
			ratioRequests.Add(1)
			assert.Equal(t, "42", r.Header.Get("New-Api-User"))
			assert.Equal(t, "Bearer ratio-token", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"success":true,"data":{"vip":{"ratio":1.25}}}`))
		case "/api/user/self":
			balanceRequests.Add(1)
			assert.Equal(t, "43", r.Header.Get("New-Api-User"))
			assert.Equal(t, "Bearer balance-token", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota":500}}`))
		case "/api/status":
			statusRequests.Add(1)
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota_per_unit":100}}`))
		default:
			unexpectedRequests.Add(1)
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	channels := []model.Channel{
		{Id: 1, Name: "ratio only", Key: "ratio-key", Group: "vip", Status: common.ChannelStatusEnabled},
		{Id: 2, Name: "balance only", Key: "balance-key", Group: "vip", Status: common.ChannelStatusEnabled},
		{Id: 3, Name: "fully disabled", Key: "disabled-key", Group: "vip", Status: common.ChannelStatusEnabled},
	}
	require.NoError(t, db.Create(&channels).Error)
	monitors := []model.ChannelRatioMonitor{
		{
			ChannelId: 1, Ratio: 1, UpdatedTime: 1,
			UpstreamType: service.NewAPIUpstreamType, UpstreamBaseURL: server.URL,
			UpstreamGroup: "vip", UpstreamAuthType: service.NewAPIUpstreamAuthUser,
			UpstreamUserId: 42, UpstreamAccessToken: "ratio-token",
			UpstreamBalanceSyncDisabled: true,
		},
		{
			ChannelId:    2,
			UpstreamType: service.NewAPIUpstreamType, UpstreamBaseURL: server.URL,
			UpstreamGroup: "vip", UpstreamAuthType: service.NewAPIUpstreamAuthUser,
			UpstreamUserId: 43, UpstreamAccessToken: "balance-token",
			UpstreamRatioSyncDisabled: true,
		},
		{
			ChannelId:    3,
			UpstreamType: service.NewAPIUpstreamType, UpstreamBaseURL: server.URL,
			UpstreamGroup: "vip", UpstreamAuthType: service.NewAPIUpstreamAuthUser,
			UpstreamUserId: 44, UpstreamAccessToken: "disabled-token",
			UpstreamRatioSyncDisabled: true, UpstreamBalanceSyncDisabled: true,
		},
	}
	require.NoError(t, db.Create(&monitors).Error)

	summary, err := runChannelRatioMonitorTaskOnce(context.Background(), nil, nil)
	require.NoError(t, err)
	assert.Equal(t, 3, summary.Total)
	assert.Equal(t, 2, summary.Updated)
	assert.Equal(t, 1, summary.Changed)
	assert.Equal(t, 1, summary.BalanceUpdated)
	assert.Equal(t, 1, summary.Skipped)
	assert.Zero(t, summary.Failed)
	assert.EqualValues(t, 1, ratioRequests.Load())
	assert.EqualValues(t, 1, balanceRequests.Load())
	assert.EqualValues(t, 1, statusRequests.Load())
	assert.Zero(t, unexpectedRequests.Load())

	ratioMonitor, err := model.GetChannelRatioMonitor(1)
	require.NoError(t, err)
	assert.InDelta(t, 1.25, ratioMonitor.Ratio, 1e-9)
	assert.Nil(t, ratioMonitor.UpstreamBalance)
	assert.Empty(t, ratioMonitor.LastBalanceError)

	balanceMonitor, err := model.GetChannelRatioMonitor(2)
	require.NoError(t, err)
	assert.Zero(t, balanceMonitor.UpdatedTime)
	require.NotNil(t, balanceMonitor.UpstreamBalance)
	assert.InDelta(t, 5, *balanceMonitor.UpstreamBalance, 1e-9)
}

func TestRunChannelRatioMonitorTaskContinuesAfterFailure(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{})
	disableChannelMonitorSSRFProtection(t)

	var failingRequestCount atomic.Int32
	failingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		failingRequestCount.Add(1)
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer failingServer.Close()
	successServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"group_ratio":{"vip":1.25}}`))
	}))
	defer successServer.Close()

	channels := []model.Channel{
		{Id: 1, Name: "failing disabled", Key: "first-key", Group: "vip", Status: common.ChannelStatusManuallyDisabled},
		{Id: 2, Name: "successful", Key: "second-key", Group: "vip", Status: common.ChannelStatusEnabled},
	}
	require.NoError(t, db.Create(&channels).Error)
	monitors := []model.ChannelRatioMonitor{
		{ChannelId: 1, UpstreamType: service.NewAPIUpstreamType, UpstreamBaseURL: failingServer.URL, UpstreamGroup: "vip", UpstreamAuthType: service.NewAPIUpstreamAuthPublic},
		{ChannelId: 2, UpstreamType: service.NewAPIUpstreamType, UpstreamBaseURL: successServer.URL, UpstreamGroup: "vip", UpstreamAuthType: service.NewAPIUpstreamAuthPublic},
	}
	require.NoError(t, db.Create(&monitors).Error)

	progress := make([][2]int, 0, 2)
	summary, err := runChannelRatioMonitorTaskOnce(context.Background(), func(processed, total int) {
		progress = append(progress, [2]int{processed, total})
	}, nil)
	require.NoError(t, err)
	assert.Equal(t, 2, summary.Total)
	assert.Equal(t, 1, summary.Updated)
	assert.Equal(t, 1, summary.Failed)
	assert.Equal(t, 2, summary.Retried)
	assert.Zero(t, summary.RecoveredAfterRetry)
	require.Len(t, summary.Failures, 1)
	assert.Equal(t, 1, summary.Failures[0].ChannelId)
	assert.Equal(t, "failing disabled", summary.Failures[0].ChannelName)
	assert.Contains(t, summary.Failures[0].Error, "重试 2 次后仍失败")
	assert.Contains(t, summary.Failures[0].Error, "502 Bad Gateway")
	assert.False(t, summary.FailureDetailsTruncated)
	assert.Equal(t, [][2]int{{1, 2}, {2, 2}}, progress)
	assert.EqualValues(t, 6, failingRequestCount.Load())

	failedMonitor, err := model.GetChannelRatioMonitor(1)
	require.NoError(t, err)
	assert.Equal(t, model.ChannelRatioFetchStatusFailed, failedMonitor.LastFetchStatus)
	assert.NotEmpty(t, failedMonitor.LastFetchError)
	assert.NotZero(t, failedMonitor.LastFetchTime)
	assert.Equal(t, 3, failedMonitor.ConsecutiveFailures)

	monitor, err := model.GetChannelRatioMonitor(2)
	require.NoError(t, err)
	assert.InDelta(t, 1.25, monitor.Ratio, 1e-9)
	assert.Equal(t, "系统自动更新", monitor.UpdatedByUsername)
	assert.NotZero(t, monitor.UpdatedTime)
	assert.Equal(t, model.ChannelRatioFetchStatusSucceeded, monitor.LastFetchStatus)
	assert.Empty(t, monitor.LastFetchError)
	assert.Zero(t, monitor.ConsecutiveFailures)
}

func TestRunChannelRatioMonitorTaskDoesNotRetrySub2APIAuthenticationFailure(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{
		channelMonitorAutoUpdateRetryCountOption: "2",
	})
	disableChannelMonitorSSRFProtection(t)

	var requestCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount.Add(1)
		w.Header().Set("Content-Type", "application/json")
		assert.Equal(t, "/api/v1/groups/available", r.URL.Path)
		assert.Equal(t, "Bearer jwt-token", r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"code":401,"message":"token expired","data":null}`))
	}))
	defer server.Close()

	require.NoError(t, db.Create(&model.Channel{
		Id: 1, Name: "session bound", Key: "test-key", Group: "vip", Status: common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId: 1, UpstreamType: service.Sub2APIUpstreamType, UpstreamBaseURL: server.URL,
		UpstreamGroup: "vip", UpstreamAuthType: service.Sub2APIAuthToken,
		UpstreamAccessToken: "jwt-token",
	}).Error)

	summary, err := runChannelRatioMonitorTaskOnce(context.Background(), nil, nil)
	require.NoError(t, err)
	assert.Equal(t, 1, summary.Failed)
	assert.Zero(t, summary.Retried)
	require.Len(t, summary.Failures, 1)
	assert.Contains(t, summary.Failures[0].Error, "token expired")
	assert.NotContains(t, summary.Failures[0].Error, "重试")
	assert.EqualValues(t, 1, requestCount.Load())

	monitor, err := model.GetChannelRatioMonitor(1)
	require.NoError(t, err)
	assert.Equal(t, 1, monitor.ConsecutiveFailures)
}

func TestRunChannelRatioMonitorTaskRecoversAfterRetry(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{
		channelMonitorAutoUpdateRetryCountOption: "2",
	})
	disableChannelMonitorSSRFProtection(t)

	var requestCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if requestCount.Add(1) <= 4 {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"group_ratio":{"vip":1.25}}`))
	}))
	defer server.Close()

	require.NoError(t, db.Create(&model.Channel{
		Id: 1, Name: "recovers", Key: "test-key", Group: "vip", Status: common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId: 1, UpstreamType: service.NewAPIUpstreamType, UpstreamBaseURL: server.URL,
		UpstreamGroup: "vip", UpstreamAuthType: service.NewAPIUpstreamAuthPublic,
	}).Error)

	summary, err := runChannelRatioMonitorTaskOnce(context.Background(), nil, nil)
	require.NoError(t, err)
	assert.Equal(t, 1, summary.Updated)
	assert.Zero(t, summary.Failed)
	assert.Equal(t, 2, summary.Retried)
	assert.Equal(t, 1, summary.RecoveredAfterRetry)
	assert.EqualValues(t, 5, requestCount.Load())

	monitor, err := model.GetChannelRatioMonitor(1)
	require.NoError(t, err)
	assert.InDelta(t, 1.25, monitor.Ratio, 1e-9)
	assert.Equal(t, model.ChannelRatioFetchStatusSucceeded, monitor.LastFetchStatus)
	assert.Zero(t, monitor.ConsecutiveFailures)
}

func TestRunChannelRatioMonitorTaskEmailsRatioChanges(t *testing.T) {
	tests := []struct {
		name            string
		emailEnabled    bool
		sendError       error
		wantEmailStatus string
		wantEmailCalls  int
	}{
		{name: "sent", emailEnabled: true, wantEmailStatus: "sent", wantEmailCalls: 1},
		{name: "send failure remains visible", emailEnabled: true, sendError: errors.New("smtp unavailable"), wantEmailStatus: "failed", wantEmailCalls: 1},
		{name: "disabled", emailEnabled: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			db := setupChannelMonitorControllerTestDB(t)
			emailEnabled := "false"
			if test.emailEnabled {
				emailEnabled = "true"
			}
			useChannelMonitorOptionMap(t, map[string]string{
				channelMonitorEmailNotificationOption: emailEnabled,
				channelMonitorNotificationEmailOption: "alerts@example.com",
			})
			disableChannelMonitorSSRFProtection(t)

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"success":true,"group_ratio":{"vip":1.25}}`))
			}))
			defer server.Close()

			require.NoError(t, db.Create(&model.Channel{
				Id:     1,
				Name:   "<Primary & API>",
				Key:    "secret",
				Group:  "vip",
				Status: common.ChannelStatusEnabled,
			}).Error)
			require.NoError(t, db.Create(&model.ChannelRatioMonitor{
				ChannelId:        1,
				Ratio:            1,
				UpdatedTime:      1,
				UpstreamType:     service.NewAPIUpstreamType,
				UpstreamBaseURL:  server.URL,
				UpstreamGroup:    "vip",
				UpstreamAuthType: service.NewAPIUpstreamAuthPublic,
			}).Error)

			var subject string
			var receiver string
			var content string
			emailCalls := 0
			summary, err := runChannelRatioMonitorTaskOnce(context.Background(), nil, func(gotSubject string, gotReceiver string, gotContent string) error {
				emailCalls++
				subject = gotSubject
				receiver = gotReceiver
				content = gotContent
				return test.sendError
			})
			require.NoError(t, err)
			assert.Equal(t, 1, summary.Changed)
			assert.Equal(t, test.wantEmailStatus, summary.EmailStatus)
			assert.Equal(t, test.wantEmailCalls, emailCalls)
			if test.wantEmailCalls > 0 {
				assert.Contains(t, subject, "1 个渠道")
				assert.Equal(t, "alerts@example.com", receiver)
				assert.Contains(t, content, "&lt;Primary &amp; API&gt;")
				assert.Contains(t, content, "vip")
				assert.Contains(t, content, ">1<")
				assert.Contains(t, content, ">1.25<")
			}
			if test.sendError == nil || !test.emailEnabled {
				assert.Empty(t, summary.EmailError)
			} else {
				assert.Contains(t, summary.EmailError, test.sendError.Error())
			}

			monitor, err := model.GetChannelRatioMonitor(1)
			require.NoError(t, err)
			assert.InDelta(t, 1.25, monitor.Ratio, 1e-9)
		})
	}
}

func TestRunChannelRatioMonitorTaskRefreshesBalanceAndDeduplicatesLowBalanceEmail(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{
		channelMonitorAutoUpdateRetryCountOption: "0",
		channelMonitorEmailNotificationOption:    "true",
		channelMonitorNotificationEmailOption:    "alerts@example.com",
	})
	disableChannelMonitorSSRFProtection(t)

	var upstreamQuota atomic.Int64
	upstreamQuota.Store(500)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/user/self/groups":
			assert.Equal(t, "Bearer dashboard-token", r.Header.Get("Authorization"))
			assert.Equal(t, "42", r.Header.Get("New-Api-User"))
			_, _ = w.Write([]byte(`{"success":true,"data":{"vip":{"ratio":1.25}}}`))
		case "/api/user/self":
			assert.Equal(t, "Bearer dashboard-token", r.Header.Get("Authorization"))
			assert.Equal(t, "42", r.Header.Get("New-Api-User"))
			_, _ = fmt.Fprintf(w, `{"success":true,"data":{"quota":%d}}`, upstreamQuota.Load())
		case "/api/status":
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota_per_unit":100}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	threshold := 10.0
	require.NoError(t, db.Create(&model.Channel{
		Id: 1, Name: "<Balance & API>", Key: "secret", Group: "vip", Status: common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId:               1,
		Ratio:                   1.25,
		UpdatedTime:             1,
		UpstreamType:            service.NewAPIUpstreamType,
		UpstreamBaseURL:         server.URL,
		UpstreamGroup:           "vip",
		UpstreamAuthType:        service.NewAPIUpstreamAuthUser,
		UpstreamUserId:          42,
		UpstreamAccessToken:     "dashboard-token",
		BalanceWarningThreshold: &threshold,
	}).Error)

	emailCalls := 0
	var emailSendError error
	var subject string
	var content string
	sendEmail := func(gotSubject string, receiver string, gotContent string) error {
		emailCalls++
		subject = gotSubject
		content = gotContent
		assert.Equal(t, "alerts@example.com", receiver)
		return emailSendError
	}

	summary, err := runChannelRatioMonitorTaskOnce(context.Background(), nil, sendEmail)
	require.NoError(t, err)
	assert.Equal(t, 1, summary.Updated)
	assert.Equal(t, 1, summary.BalanceUpdated)
	assert.Equal(t, 1, summary.BalanceWarnings)
	assert.Equal(t, "sent", summary.EmailStatus)
	assert.Equal(t, 1, emailCalls)
	assert.Contains(t, subject, "1 个余额预警")
	assert.Contains(t, content, "上游余额预警")
	assert.Contains(t, content, "&lt;Balance &amp; API&gt;")
	assert.Contains(t, content, ">5<")
	assert.Contains(t, content, ">10<")
	monitor, err := model.GetChannelRatioMonitor(1)
	require.NoError(t, err)
	require.NotNil(t, monitor.UpstreamBalance)
	assert.Equal(t, 5.0, *monitor.UpstreamBalance)
	assert.True(t, monitor.BalanceAlertNotified)

	summary, err = runChannelRatioMonitorTaskOnce(context.Background(), nil, sendEmail)
	require.NoError(t, err)
	assert.Equal(t, 1, summary.BalanceUpdated)
	assert.Zero(t, summary.BalanceWarnings)
	assert.Empty(t, summary.EmailStatus)
	assert.Equal(t, 1, emailCalls)

	upstreamQuota.Store(1500)
	summary, err = runChannelRatioMonitorTaskOnce(context.Background(), nil, sendEmail)
	require.NoError(t, err)
	assert.Equal(t, 1, summary.BalanceUpdated)
	assert.Zero(t, summary.BalanceWarnings)
	assert.Equal(t, 1, emailCalls)
	monitor, err = model.GetChannelRatioMonitor(1)
	require.NoError(t, err)
	require.NotNil(t, monitor.UpstreamBalance)
	assert.Equal(t, 15.0, *monitor.UpstreamBalance)
	assert.False(t, monitor.BalanceAlertNotified)

	upstreamQuota.Store(400)
	emailSendError = errors.New("smtp unavailable")
	summary, err = runChannelRatioMonitorTaskOnce(context.Background(), nil, sendEmail)
	require.NoError(t, err)
	assert.Equal(t, 1, summary.BalanceWarnings)
	assert.Equal(t, "failed", summary.EmailStatus)
	assert.Contains(t, summary.EmailError, "smtp unavailable")
	assert.Equal(t, 2, emailCalls)
	monitor, err = model.GetChannelRatioMonitor(1)
	require.NoError(t, err)
	assert.False(t, monitor.BalanceAlertNotified)

	emailSendError = nil
	summary, err = runChannelRatioMonitorTaskOnce(context.Background(), nil, sendEmail)
	require.NoError(t, err)
	assert.Equal(t, 1, summary.BalanceUpdated)
	assert.Equal(t, 1, summary.BalanceWarnings)
	assert.Equal(t, "sent", summary.EmailStatus)
	assert.Equal(t, 3, emailCalls)
	monitor, err = model.GetChannelRatioMonitor(1)
	require.NoError(t, err)
	assert.True(t, monitor.BalanceAlertNotified)
}

func TestRunChannelRatioMonitorTaskEmailsUpdateFailures(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{
		channelMonitorAutoUpdateRetryCountOption: "0",
		channelMonitorEmailNotificationOption:    "true",
		channelMonitorNotificationEmailOption:    "alerts@example.com",
	})
	disableChannelMonitorSSRFProtection(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer server.Close()

	require.NoError(t, db.Create(&model.Channel{
		Id: 1, Name: "<Failing & API>", Key: "test-key", Group: "vip", Status: common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId: 1, UpstreamType: service.NewAPIUpstreamType, UpstreamBaseURL: server.URL,
		UpstreamGroup: "vip", UpstreamAuthType: service.NewAPIUpstreamAuthPublic,
	}).Error)

	var subject string
	var receiver string
	var content string
	emailCalls := 0
	summary, err := runChannelRatioMonitorTaskOnce(context.Background(), nil, func(gotSubject string, gotReceiver string, gotContent string) error {
		emailCalls++
		subject = gotSubject
		receiver = gotReceiver
		content = gotContent
		return nil
	})

	require.NoError(t, err)
	assert.Equal(t, 1, summary.Failed)
	assert.Equal(t, "sent", summary.EmailStatus)
	assert.Equal(t, 1, emailCalls)
	assert.Contains(t, subject, "1 项更新失败")
	assert.Equal(t, "alerts@example.com", receiver)
	assert.Contains(t, content, "上游同步失败")
	assert.Contains(t, content, "&lt;Failing &amp; API&gt;")
	assert.Contains(t, content, "502 Bad Gateway")
}

func TestRunChannelRatioMonitorTaskEmailsGroupUpdateFailure(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)
	useChannelMonitorOptionMap(t, map[string]string{
		"GroupRatio":                          `{"vip":1}`,
		channelMonitorEmailNotificationOption: "true",
		channelMonitorNotificationEmailOption: "alerts@example.com",
	})
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"vip":1}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
	})
	disableChannelMonitorSSRFProtection(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"group_ratio":{"vip":1.25}}`))
	}))
	defer server.Close()

	require.NoError(t, db.Create(&model.Channel{
		Id: 1, Name: "stable", Key: "test-key", Group: "vip", Status: common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.ChannelRatioMonitor{
		ChannelId: 1, Ratio: 1.25, UpdatedTime: 1,
		UpstreamType: service.NewAPIUpstreamType, UpstreamBaseURL: server.URL,
		UpstreamGroup: "vip", UpstreamAuthType: service.NewAPIUpstreamAuthPublic,
		SingleChannelAction: channelMonitorPolicyActionUpdateGroupRatio,
	}).Error)
	require.NoError(t, db.Migrator().DropTable(&model.Option{}))

	var subject string
	var content string
	emailCalls := 0
	summary, err := runChannelRatioMonitorTaskOnce(context.Background(), nil, func(gotSubject string, _ string, gotContent string) error {
		emailCalls++
		subject = gotSubject
		content = gotContent
		return nil
	})

	require.Error(t, err)
	assert.True(t, summary.GroupUpdateFailed)
	assert.Equal(t, "sent", summary.EmailStatus)
	assert.Equal(t, 1, emailCalls)
	assert.Contains(t, subject, "1 项更新失败")
	assert.Contains(t, content, "分组倍率更新失败")
	assert.Contains(t, content, "失败原因")
}
