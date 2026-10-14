package service

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func TestManagedDetachedRouteUsesOrdinaryAutoDisable(t *testing.T) {
	previousCache, previousRedis := common.MemoryCacheEnabled, common.RedisEnabled
	previousAutoDisable, previousErrorLog := common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled
	previousNotifyLimit := constant.NotifyLimitCount
	previousClient, previousWorker := httpClient, system_setting.WorkerUrl
	fetch := system_setting.GetFetchSetting()
	previousFetch := *fetch
	t.Cleanup(func() {
		common.MemoryCacheEnabled, common.RedisEnabled = previousCache, previousRedis
		common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = previousAutoDisable, previousErrorLog
		constant.NotifyLimitCount = previousNotifyLimit
		httpClient, system_setting.WorkerUrl = previousClient, previousWorker
		*fetch = previousFetch
	})
	setupUpstreamOrchestrationTest(t)
	sqlDB, err := model.DB.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.User{}))
	common.MemoryCacheEnabled, common.RedisEnabled = false, false
	common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = true, false
	constant.NotifyLimitCount = 100
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.Enabled = true
		setting.FailureThreshold = 1
	})

	notifications := make(chan struct{}, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		notifications <- struct{}{}
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(server.Close)
	httpClient, system_setting.WorkerUrl = server.Client(), ""
	fetch.EnableSSRFProtection = false
	userSetting, err := common.Marshal(kitdto.UserSetting{
		NotifyType: kitdto.NotifyTypeWebhook,
		WebhookUrl: server.URL,
	})
	require.NoError(t, err)
	root := model.User{
		Username: "detached-route-root",
		Role:     common.RoleRootUser,
		Status:   common.UserStatusEnabled,
		Setting:  string(userSetting),
	}
	require.NoError(t, model.DB.Create(&root).Error)

	channel := model.Channel{
		Name: "detached-route", Key: "fixture-key", Type: constant.ChannelTypeOpenAI,
		Status: common.ChannelStatusEnabled, Group: "default", Models: "detached-model",
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
	route := model.UpstreamManagedRoute{
		SourceID:             1,
		ExternalGroupID:      "detached",
		Platform:             "openai",
		Protocol:             model.UpstreamProtocolOpenAI,
		ChannelID:            channel.Id,
		State:                model.UpstreamRouteStateDetached,
		Detached:             true,
		ConsecutiveFailures:  4,
		ConsecutiveSuccesses: 3,
		LastReason:           "detached by root",
	}
	require.NoError(t, model.DB.Create(&route).Error)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	apiErr := types.NewErrorWithStatusCode(
		errors.New("invalid detached credential"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusUnauthorized,
	)
	ProcessChannelError(
		c,
		types.ChannelError{ChannelId: channel.Id, ChannelName: channel.Name, AutoBan: true},
		apiErr,
		nil,
	)

	select {
	case <-notifications:
	case <-time.After(2 * time.Second):
		t.Fatal("ordinary auto-disable notification was not delivered")
	}
	require.Eventually(t, func() bool {
		var stored model.Channel
		return model.DB.First(&stored, channel.Id).Error == nil &&
			stored.Status == common.ChannelStatusAutoDisabled
	}, time.Second, 10*time.Millisecond)
	var ability model.Ability
	require.NoError(t, model.DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.False(t, ability.Enabled)
	var storedRoute model.UpstreamManagedRoute
	require.NoError(t, model.DB.First(&storedRoute, route.ID).Error)
	assert.True(t, storedRoute.Detached)
	assert.Equal(t, model.UpstreamRouteStateDetached, storedRoute.State)
	assert.Equal(t, 4, storedRoute.ConsecutiveFailures)
	assert.Equal(t, 3, storedRoute.ConsecutiveSuccesses)
	assert.Equal(t, "detached by root", storedRoute.LastReason)
}

func TestManagedHealthPersistenceErrorFailsClosed(t *testing.T) {
	for _, tc := range []struct {
		name            string
		apiErr          *types.NewAPIError
		modelName       string
		failingTable    string
		directDisable   bool
		memoryCache     bool
		expectUncertain bool
	}{
		{
			name: "failure record",
			apiErr: types.NewOpenAIError(
				errors.New("managed upstream failed"),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusInternalServerError,
			),
			failingTable:    "upstream_managed_routes",
			expectUncertain: true,
		},
		{
			name: "failure record channel write",
			apiErr: types.NewOpenAIError(
				errors.New("managed upstream failed"),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusInternalServerError,
			),
			failingTable:    "channels",
			memoryCache:     true,
			expectUncertain: true,
		},
		{
			name: "failure record ability write",
			apiErr: types.NewOpenAIError(
				errors.New("managed upstream failed"),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusInternalServerError,
			),
			failingTable:    "abilities",
			memoryCache:     true,
			expectUncertain: true,
		},
		{
			name: "unsupported model isolation",
			apiErr: types.NewOpenAIError(
				errors.New(`Model "managed-model" is not supported by any configured account in this group`),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusNotFound,
			),
			modelName:       "managed-model",
			failingTable:    "options",
			expectUncertain: true,
		},
		{
			name: "unsupported model channel write",
			apiErr: types.NewOpenAIError(
				errors.New(`Model "managed-model" is not supported by any configured account in this group`),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusNotFound,
			),
			modelName:       "managed-model",
			failingTable:    "channels",
			expectUncertain: true,
		},
		{
			name: "unsupported model ability write",
			apiErr: types.NewOpenAIError(
				errors.New(`Model "managed-model" is not supported by any configured account in this group`),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusNotFound,
			),
			modelName:       "managed-model",
			failingTable:    "abilities",
			expectUncertain: true,
		},
		{
			name:          "direct disable",
			failingTable:  "upstream_managed_routes",
			directDisable: true,
		},
		{
			name:          "direct disable channel write",
			failingTable:  "channels",
			directDisable: true,
			memoryCache:   true,
		},
		{
			name:          "direct disable ability write",
			failingTable:  "abilities",
			directDisable: true,
			memoryCache:   true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupManagedReconcileOrderingTest(t)
			require.NoError(t, model.DB.AutoMigrate(
				&model.Channel{},
				&model.Ability{},
				&model.Option{},
			))
			updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
				setting.Enabled = true
				setting.FailureThreshold = 1
				setting.ModelExclusions = map[string][]string{}
			})
			require.NoError(t, model.UpdateUpstreamOrchestrationPolicy(
				operation_setting.UpstreamRoutingPolicy{
					TargetGroups:            []string{"default"},
					ModelAliases:            map[string]string{},
					ModelExclusions:         map[string][]string{},
					ProtocolModelExclusions: map[string][]string{},
				},
			))
			previousDisable, previousErrorLog := common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled
			previousRanges := append([]operation_setting.StatusCodeRange(nil), operation_setting.AutomaticDisableStatusCodeRanges...)
			common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = true, false
			operation_setting.AutomaticDisableStatusCodeRanges = []operation_setting.StatusCodeRange{
				{Start: http.StatusNotFound, End: http.StatusInternalServerError},
			}
			t.Cleanup(func() {
				common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = previousDisable, previousErrorLog
				operation_setting.AutomaticDisableStatusCodeRanges = previousRanges
			})

			source := model.UpstreamSource{
				Key: "managed-health-source", Name: "Managed Health", ConsoleURL: "https://console.example.com",
			}
			require.NoError(t, model.DB.Create(&source).Error)
			group := model.UpstreamGroup{
				SourceID: source.ID, ExternalID: "managed-health", Name: "Managed Health",
				Platform: "openai", Models: `["managed-model"]`,
			}
			require.NoError(t, model.DB.Create(&group).Error)
			channel := model.Channel{
				Name: "managed-health", Key: "fixture-key", Type: constant.ChannelTypeOpenAI,
				Status: common.ChannelStatusEnabled, Group: "default", Models: "managed-model",
			}
			require.NoError(t, model.DB.Create(&channel).Error)
			require.NoError(t, channel.AddAbilities(nil))
			route := model.UpstreamManagedRoute{
				SourceID: source.ID, ExternalGroupID: group.ExternalID, Platform: group.Platform,
				Protocol: model.UpstreamProtocolOpenAI, ChannelID: channel.Id,
				State: model.UpstreamRouteStateActive,
			}
			require.NoError(t, model.DB.Create(&route).Error)
			common.MemoryCacheEnabled = tc.memoryCache
			if tc.memoryCache {
				model.InitChannelCache()
			}
			t.Cleanup(func() {
				require.NoError(t, model.DB.Where("channel_id = ?", channel.Id).Delete(&model.Ability{}).Error)
				require.NoError(t, model.DB.Delete(&route).Error)
				require.NoError(t, model.DB.Delete(&channel).Error)
				require.NoError(t, model.DB.Delete(&group).Error)
				require.NoError(t, model.DB.Delete(&source).Error)
			})

			injected := errors.New("injected managed health persistence failure")
			const callbackName = "test:managed_health_persistence_failure"
			require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
				if tx.Statement.Table == tc.failingTable {
					tx.AddError(injected)
				}
			}))
			require.NoError(t, model.DB.Callback().Delete().Before("gorm:delete").Register(callbackName, func(tx *gorm.DB) {
				if tx.Statement.Table == tc.failingTable {
					tx.AddError(injected)
				}
			}))
			t.Cleanup(func() {
				require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
				require.NoError(t, model.DB.Callback().Delete().Remove(callbackName))
			})
			taskCalls := 0
			previousTaskRunner := runChannelErrorTask
			runChannelErrorTask = func(task func()) {
				taskCalls++
				task()
			}
			t.Cleanup(func() { runChannelErrorTask = previousTaskRunner })

			channelError := types.ChannelError{
				ChannelId: channel.Id, ChannelName: channel.Name, AutoBan: true,
			}
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("channel_id", channel.Id)
			c.Set("original_model", tc.modelName)
			if tc.directDisable {
				DisableChannel(channelError, "managed upstream failed")
			} else {
				ProcessChannelError(c, channelError, tc.apiErr, nil)
			}

			assert.Equal(t, tc.expectUncertain, common.GetContextKeyBool(c, constant.ContextKeyManagedHealthPersistenceUncertain))
			assert.Zero(t, taskCalls)
			if tc.expectUncertain {
				assert.Equal(
					t,
					PolicyDecision{Action: "stop", Reason: "managed_health_persistence_uncertain", Source: "managed"},
					DecideRelayRetry(c, tc.apiErr, 1),
				)
			}
			var storedChannel model.Channel
			require.NoError(t, model.DB.First(&storedChannel, channel.Id).Error)
			assert.Equal(t, common.ChannelStatusEnabled, storedChannel.Status)
			var storedAbility model.Ability
			require.NoError(t, model.DB.Where("channel_id = ?", channel.Id).First(&storedAbility).Error)
			assert.True(t, storedAbility.Enabled)
			var storedRoute model.UpstreamManagedRoute
			require.NoError(t, model.DB.First(&storedRoute, route.ID).Error)
			assert.Equal(t, model.UpstreamRouteStateActive, storedRoute.State)
			assert.Zero(t, storedRoute.ConsecutiveFailures)
			var storedGroup model.UpstreamGroup
			require.NoError(t, model.DB.First(&storedGroup, group.ID).Error)
			assert.JSONEq(t, `["managed-model"]`, storedGroup.Models)
			var storedExclusions model.Option
			require.NoError(t, model.DB.Where(clause.Eq{
				Column: clause.Column{Name: "key"},
				Value:  managedModelExclusionsOption,
			}).First(&storedExclusions).Error)
			assert.JSONEq(t, `{}`, storedExclusions.Value)
			assert.Empty(t, operation_setting.GetUpstreamOrchestrationSetting().ModelExclusions)
			if tc.memoryCache {
				cachedChannel, err := model.CacheGetChannel(channel.Id)
				require.NoError(t, err)
				assert.Equal(t, common.ChannelStatusEnabled, cachedChannel.Status)
			}
		})
	}
}

func TestRecordManagedChannelFailureCommitsBeforeNotification(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	require.NoError(t, db.AutoMigrate(&model.UpstreamManagedRoute{}))
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.Enabled = true
		setting.FailureThreshold = 1
	})

	channel := model.Channel{
		Name: "managed-notification", Key: "fixture-key", Type: constant.ChannelTypeOpenAI,
		Status: common.ChannelStatusEnabled, Group: "default", Models: "managed-model",
	}
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(db))
	route := model.UpstreamManagedRoute{
		SourceID: 1, ExternalGroupID: "managed-notification", Platform: "openai",
		Protocol: model.UpstreamProtocolOpenAI, ChannelID: channel.Id,
		State: model.UpstreamRouteStateActive,
	}
	require.NoError(t, db.Create(&route).Error)
	model.InitChannelCache()

	webSocketClosed := make(chan string, 1)
	unregister, err := RegisterActiveWebSocketForChannel(
		channel.Id,
		"managed-notification-test",
		func(reason string) {
			webSocketClosed <- reason
		},
	)
	require.NoError(t, err)
	t.Cleanup(unregister)

	previousRunner := runManagedFailureNotification
	previousNotifier := notifyManagedFailure
	notificationStarted := make(chan struct{})
	releaseNotification := make(chan struct{})
	notificationDone := make(chan struct{})
	runManagedFailureNotification = func(task func()) {
		go func() {
			defer close(notificationDone)
			task()
		}()
	}
	notifyManagedFailure = func(_, _, _ string) error {
		close(notificationStarted)
		<-releaseNotification
		return errors.New("injected Bark failure")
	}
	t.Cleanup(func() {
		select {
		case <-releaseNotification:
		default:
			close(releaseNotification)
		}
		<-notificationDone
		runManagedFailureNotification = previousRunner
		notifyManagedFailure = previousNotifier
	})

	type recordResult struct {
		handled     bool
		quarantined bool
		err         error
	}
	recordDone := make(chan recordResult, 1)
	go func() {
		handled, quarantined, recordErr := RecordManagedChannelFailure(
			types.ChannelError{ChannelId: channel.Id, ChannelName: channel.Name},
			"threshold failure",
		)
		recordDone <- recordResult{handled: handled, quarantined: quarantined, err: recordErr}
	}()

	select {
	case <-notificationStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("managed failure notification did not start")
	}
	var result recordResult
	select {
	case result = <-recordDone:
	case <-time.After(2 * time.Second):
		t.Fatal("managed failure recording waited for notification")
	}
	require.NoError(t, result.err)
	assert.True(t, result.handled)
	assert.True(t, result.quarantined)

	var storedChannel model.Channel
	require.NoError(t, db.First(&storedChannel, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusAutoDisabled, storedChannel.Status)
	var storedAbility model.Ability
	require.NoError(t, db.Where("channel_id = ?", channel.Id).First(&storedAbility).Error)
	assert.False(t, storedAbility.Enabled)
	var storedRoute model.UpstreamManagedRoute
	require.NoError(t, db.First(&storedRoute, route.ID).Error)
	assert.Equal(t, model.UpstreamRouteStateQuarantined, storedRoute.State)
	assert.Equal(t, 1, storedRoute.ConsecutiveFailures)
	cachedChannel, err := model.CacheGetChannel(channel.Id)
	require.NoError(t, err)
	assert.Equal(t, common.ChannelStatusAutoDisabled, cachedChannel.Status)
	select {
	case reason := <-webSocketClosed:
		assert.Equal(t, ChannelDisabledCloseReason, reason)
	default:
		t.Fatal("active websocket was not closed before managed failure returned")
	}

	close(releaseNotification)
	select {
	case <-notificationDone:
	case <-time.After(2 * time.Second):
		t.Fatal("managed failure notification did not finish")
	}
}

func TestManagedUnsupportedModelIsolationRequiresOrchestration(t *testing.T) {
	previousAsync := runChannelErrorTask
	asyncTasks := make(chan func(), 1)
	runChannelErrorTask = func(task func()) { asyncTasks <- task }
	t.Cleanup(func() { runChannelErrorTask = previousAsync })

	for _, test := range []struct {
		name       string
		enabled    bool
		disable404 bool
	}{
		{name: "disabled default policy", enabled: false},
		{name: "disabled configured auto-disable", enabled: false, disable404: true},
		{name: "enabled isolation", enabled: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			db := setupChannelSelectAutoGroupsTest(t)
			require.NoError(t, db.AutoMigrate(
				&model.Option{},
				&model.UpstreamSource{},
				&model.UpstreamGroup{},
				&model.UpstreamManagedRoute{},
				&model.User{},
			))
			previousRedis := common.RedisEnabled
			previousAutoDisable, previousErrorLog := common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled
			previousRanges := append([]operation_setting.StatusCodeRange(nil), operation_setting.AutomaticDisableStatusCodeRanges...)
			common.RedisEnabled = false
			common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = true, false
			operation_setting.AutomaticDisableStatusCodeRanges = []operation_setting.StatusCodeRange{{Start: 401, End: 401}}
			if test.disable404 {
				operation_setting.AutomaticDisableStatusCodeRanges = []operation_setting.StatusCodeRange{{Start: 404, End: 404}}
			}
			t.Cleanup(func() {
				common.RedisEnabled = previousRedis
				common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = previousAutoDisable, previousErrorLog
				operation_setting.AutomaticDisableStatusCodeRanges = previousRanges
			})
			common.OptionMapRWMutex.Lock()
			previousOptions := common.OptionMap
			common.OptionMap = make(map[string]string)
			common.OptionMapRWMutex.Unlock()
			t.Cleanup(func() {
				common.OptionMapRWMutex.Lock()
				common.OptionMap = previousOptions
				common.OptionMapRWMutex.Unlock()
			})
			updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
				setting.Enabled = test.enabled
			})
			require.NoError(t, model.UpdateUpstreamOrchestrationPolicy(
				operation_setting.UpstreamRoutingPolicy{
					TargetGroups:            []string{"default"},
					ModelAliases:            map[string]string{},
					ModelExclusions:         map[string][]string{},
					ProtocolModelExclusions: map[string][]string{},
				},
			))

			source := model.UpstreamSource{
				Key: "historical-source", Name: "Historical Source", ConsoleURL: "https://console.example.com",
			}
			require.NoError(t, db.Create(&source).Error)
			group := model.UpstreamGroup{
				SourceID: source.ID, ExternalID: "historical", Name: "Historical", Platform: "openai",
				Models: `["historical-model","retained-model"]`,
			}
			require.NoError(t, db.Create(&group).Error)
			channel := model.Channel{
				Name: "historical-managed-route", Key: "fixture-key", Type: constant.ChannelTypeOpenAI,
				Status: common.ChannelStatusEnabled, Group: "default", Models: "historical-model,retained-model",
			}
			require.NoError(t, db.Create(&channel).Error)
			require.NoError(t, channel.AddAbilities(nil))
			route := model.UpstreamManagedRoute{
				SourceID: source.ID, ExternalGroupID: group.ExternalID, Platform: group.Platform,
				Protocol: model.UpstreamProtocolOpenAI, ChannelID: channel.Id,
				State: model.UpstreamRouteStateActive, ConsecutiveFailures: 4,
				ConsecutiveSuccesses: 3, FailureWindowStart: 111, LastFailureAt: 222,
				LastReason: "historical failure", UpdatedAt: 333,
			}
			require.NoError(t, db.Create(&route).Error)
			model.InitChannelCache()

			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("original_model", "historical-model")
			apiErr := types.NewOpenAIError(
				errors.New(`Model "historical-model" is not supported by any configured account in this group`),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusNotFound,
			)
			assert.Equal(t, test.disable404, ShouldDisableChannel(apiErr))
			ProcessChannelError(
				c,
				types.ChannelError{ChannelId: channel.Id, ChannelName: channel.Name, AutoBan: true},
				apiErr,
				nil,
			)

			if test.disable404 {
				updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
					setting.Enabled = true
				})
				select {
				case task := <-asyncTasks:
					task()
				case <-time.After(2 * time.Second):
					t.Fatal("ordinary auto-disable was not scheduled")
				}
			} else {
				assert.Empty(t, asyncTasks)
			}

			var storedChannel model.Channel
			require.NoError(t, db.First(&storedChannel, channel.Id).Error)
			var storedAbilities []model.Ability
			require.NoError(t, db.Where("channel_id = ?", channel.Id).Order("model asc").Find(&storedAbilities).Error)
			var storedGroup model.UpstreamGroup
			require.NoError(t, db.First(&storedGroup, group.ID).Error)
			var storedRoute model.UpstreamManagedRoute
			require.NoError(t, db.First(&storedRoute, route.ID).Error)
			var storedExclusions model.Option
			require.NoError(t, db.Where("key = ?", managedModelExclusionsOption).First(&storedExclusions).Error)

			assert.Equal(t, model.UpstreamRouteStateActive, storedRoute.State)
			assert.Equal(t, 4, storedRoute.ConsecutiveFailures)
			assert.Equal(t, 3, storedRoute.ConsecutiveSuccesses)
			assert.Equal(t, int64(111), storedRoute.FailureWindowStart)
			if !test.enabled {
				expectedStatus := common.ChannelStatusEnabled
				if test.disable404 {
					expectedStatus = common.ChannelStatusAutoDisabled
				}
				assert.Equal(t, expectedStatus, storedChannel.Status)
				assert.Equal(t, "historical-model,retained-model", storedChannel.Models)
				require.Len(t, storedAbilities, 2)
				assert.Equal(t, "historical-model", storedAbilities[0].Model)
				assert.Equal(t, "retained-model", storedAbilities[1].Model)
				assert.Equal(t, !test.disable404, storedAbilities[0].Enabled)
				assert.Equal(t, !test.disable404, storedAbilities[1].Enabled)
				assert.Equal(t, `["historical-model","retained-model"]`, storedGroup.Models)
				assert.Equal(t, int64(222), storedRoute.LastFailureAt)
				assert.Equal(t, "historical failure", storedRoute.LastReason)
				assert.Equal(t, int64(333), storedRoute.UpdatedAt)
				assert.JSONEq(t, `{}`, storedExclusions.Value)
				assert.Empty(t, operation_setting.GetUpstreamOrchestrationSetting().ModelExclusions)
				return
			}

			assert.Equal(t, common.ChannelStatusEnabled, storedChannel.Status)
			assert.Equal(t, "retained-model", storedChannel.Models)
			require.Len(t, storedAbilities, 1)
			assert.Equal(t, "retained-model", storedAbilities[0].Model)
			assert.True(t, storedAbilities[0].Enabled)
			assert.Equal(t, `["retained-model"]`, storedGroup.Models)
			assert.NotEqual(t, int64(222), storedRoute.LastFailureAt)
			assert.Contains(t, storedRoute.LastReason, "not supported by any configured account")
			assert.JSONEq(t, `{"historical-source:historical":["historical-model"]}`, storedExclusions.Value)
			assert.Equal(
				t,
				[]string{"historical-model"},
				operation_setting.GetUpstreamOrchestrationSetting().ModelExclusions["historical-source:historical"],
			)
		})
	}
}

func TestManagedDetachWinsBeforeFailureHandling(t *testing.T) {
	for _, tc := range []struct {
		name                 string
		apiErr               *types.NewAPIError
		modelName            string
		checkNoExclusion     bool
		detachAfterExclusion bool
	}{
		{
			name: "retryable failure falls back to ordinary disable",
			apiErr: types.NewErrorWithStatusCode(
				errors.New("invalid credential"),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusUnauthorized,
			),
		},
		{
			name: "unsupported model does not append exclusion",
			apiErr: types.NewOpenAIError(
				errors.New(`Model "detach-model" is not supported by any configured account in this group`),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusNotFound,
			),
			modelName:        "detach-model",
			checkNoExclusion: true,
		},
		{
			name: "detach queued during isolation remains final",
			apiErr: types.NewOpenAIError(
				errors.New(`Model "detach-model" is not supported by any configured account in this group`),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusNotFound,
			),
			modelName:            "detach-model",
			detachAfterExclusion: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupChannelSelectAutoGroupsTest(t)
			require.NoError(t, db.AutoMigrate(
				&model.Option{},
				&model.UpstreamSource{},
				&model.UpstreamGroup{},
				&model.UpstreamManagedRoute{},
				&model.User{},
			))
			updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
				setting.Enabled = true
				setting.FailureThreshold = 1
			})
			require.NoError(t, model.UpdateUpstreamOrchestrationPolicy(
				operation_setting.UpstreamRoutingPolicy{
					TargetGroups:            []string{"default"},
					ModelAliases:            map[string]string{},
					ModelExclusions:         map[string][]string{},
					ProtocolModelExclusions: map[string][]string{},
				},
			))
			previousDisable := common.AutomaticDisableChannelEnabled
			previousRanges := append([]operation_setting.StatusCodeRange(nil), operation_setting.AutomaticDisableStatusCodeRanges...)
			common.AutomaticDisableChannelEnabled = true
			operation_setting.AutomaticDisableStatusCodeRanges = []operation_setting.StatusCodeRange{{Start: 401, End: 404}}
			t.Cleanup(func() {
				common.AutomaticDisableChannelEnabled = previousDisable
				operation_setting.AutomaticDisableStatusCodeRanges = previousRanges
			})

			source := model.UpstreamSource{
				Key: "detach-source", Name: "Detach Source", ConsoleURL: "https://console.example.com",
			}
			require.NoError(t, db.Create(&source).Error)
			group := model.UpstreamGroup{
				SourceID: source.ID, ExternalID: "paid", Name: "Paid", Platform: "openai",
				Models: `["detach-model"]`,
			}
			require.NoError(t, db.Create(&group).Error)
			channel := model.Channel{
				Name: "detach-race", Key: "fixture-key", Type: constant.ChannelTypeOpenAI,
				Status: common.ChannelStatusEnabled, Group: "default", Models: "detach-model",
			}
			require.NoError(t, db.Create(&channel).Error)
			require.NoError(t, channel.AddAbilities(nil))
			route := model.UpstreamManagedRoute{
				SourceID: source.ID, ExternalGroupID: group.ExternalID, Platform: group.Platform,
				Protocol: model.UpstreamProtocolOpenAI, ChannelID: channel.Id,
				State: model.UpstreamRouteStateActive, ConsecutiveFailures: 4,
				ConsecutiveSuccesses: 3, LastReason: "healthy before detach",
			}
			require.NoError(t, db.Create(&route).Error)
			model.InitChannelCache()

			var detached atomic.Bool
			var exclusionUpdated atomic.Bool
			detachErr := make(chan error, 1)
			detach := func(writer *gorm.DB) {
				if !detached.CompareAndSwap(false, true) {
					return
				}
				detachErr <- writer.Session(&gorm.Session{NewDB: true}).
					Model(&model.UpstreamManagedRoute{}).
					Where("id = ?", route.ID).
					Updates(map[string]any{
						"detached": true,
						"state":    model.UpstreamRouteStateDetached,
					}).Error
			}
			const beforeCallback = "test:detach_before_managed_record"
			require.NoError(t, db.Callback().Query().Before("gorm:query").Register(beforeCallback, func(tx *gorm.DB) {
				if common.UsingMainDatabase(common.DatabaseTypeSQLite) ||
					tx.Statement.Table != "upstream_managed_routes" || detached.Load() {
					return
				}
				if tc.detachAfterExclusion {
					if exclusionUpdated.Load() {
						detach(db)
					}
					return
				}
				if tc.modelName == "" &&
					(len(tx.Statement.Selects) != 1 || tx.Statement.Selects[0] != "id") {
					detach(db)
				}
			}))
			const afterCallback = "test:detach_after_managed_precheck"
			require.NoError(t, db.Callback().Query().After("gorm:query").Register(afterCallback, func(tx *gorm.DB) {
				if !common.UsingMainDatabase(common.DatabaseTypeSQLite) &&
					!tc.detachAfterExclusion &&
					tx.Statement.Table == "upstream_managed_routes" &&
					len(tx.Statement.Selects) == 1 && tx.Statement.Selects[0] == "id" {
					detach(db)
				}
			}))
			const beforeUpdateCallback = "test:detach_before_managed_write_intent"
			require.NoError(t, db.Callback().Update().Before("gorm:update").Register(beforeUpdateCallback, func(tx *gorm.DB) {
				detachBeforeOptionWrite := !tc.detachAfterExclusion &&
					tc.modelName != "" && tx.Statement.Table == "options"
				detachBeforeRouteWrite := tx.Statement.Table == "upstream_managed_routes" &&
					(tc.modelName == "" || tc.detachAfterExclusion && exclusionUpdated.Load())
				if detachBeforeOptionWrite || detachBeforeRouteWrite {
					if tc.detachAfterExclusion {
						go detach(db)
					} else {
						detach(db)
					}
				}
			}))
			const updateCallback = "test:observe_managed_exclusion_commit"
			require.NoError(t, db.Callback().Update().After("gorm:update").Register(updateCallback, func(tx *gorm.DB) {
				if tc.detachAfterExclusion && tx.Statement.Table == "options" && tx.RowsAffected > 0 {
					exclusionUpdated.Store(true)
				}
			}))
			t.Cleanup(func() {
				require.NoError(t, db.Callback().Query().Remove(beforeCallback))
				require.NoError(t, db.Callback().Query().Remove(afterCallback))
				require.NoError(t, db.Callback().Update().Remove(beforeUpdateCallback))
				require.NoError(t, db.Callback().Update().Remove(updateCallback))
			})

			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("original_model", tc.modelName)
			ProcessChannelError(
				c,
				types.ChannelError{ChannelId: channel.Id, ChannelName: channel.Name, AutoBan: true},
				tc.apiErr,
				nil,
			)

			if tc.detachAfterExclusion {
				require.NoError(t, <-detachErr)
				var storedChannel model.Channel
				require.NoError(t, db.First(&storedChannel, channel.Id).Error)
				assert.Equal(t, common.ChannelStatusEnabled, storedChannel.Status)
				assert.Empty(t, storedChannel.Models)
				var abilityCount int64
				require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", channel.Id).Count(&abilityCount).Error)
				assert.Zero(t, abilityCount)
				var storedRoute model.UpstreamManagedRoute
				require.NoError(t, db.First(&storedRoute, route.ID).Error)
				assert.True(t, storedRoute.Detached)
				assert.Equal(t, model.UpstreamRouteStateDetached, storedRoute.State)
				assert.Equal(t, 4, storedRoute.ConsecutiveFailures)
				assert.Equal(t, 3, storedRoute.ConsecutiveSuccesses)
				assert.Contains(t, storedRoute.LastReason, "not supported by any configured account")
				var option model.Option
				require.NoError(t, db.Where("key = ?", managedModelExclusionsOption).First(&option).Error)
				assert.JSONEq(t, `{"detach-source:paid":["detach-model"]}`, option.Value)
				return
			}
			require.Eventually(t, func() bool {
				var stored model.Channel
				return db.First(&stored, channel.Id).Error == nil &&
					stored.Status == common.ChannelStatusAutoDisabled
			}, 2*time.Second, 10*time.Millisecond)
			require.NoError(t, <-detachErr)
			var ability model.Ability
			require.NoError(t, db.Where("channel_id = ?", channel.Id).First(&ability).Error)
			assert.False(t, ability.Enabled)
			var storedRoute model.UpstreamManagedRoute
			require.NoError(t, db.First(&storedRoute, route.ID).Error)
			assert.True(t, storedRoute.Detached)
			assert.Equal(t, model.UpstreamRouteStateDetached, storedRoute.State)
			assert.Equal(t, 4, storedRoute.ConsecutiveFailures)
			assert.Equal(t, 3, storedRoute.ConsecutiveSuccesses)
			assert.Equal(t, "healthy before detach", storedRoute.LastReason)
			if tc.checkNoExclusion {
				var option model.Option
				require.NoError(t, db.Where("key = ?", managedModelExclusionsOption).First(&option).Error)
				assert.JSONEq(t, `{}`, option.Value)
				assert.Empty(t, operation_setting.GetUpstreamOrchestrationSetting().ModelExclusions)
			}
		})
	}
}

func TestShouldRetryRelayErrorHonorsChannelPinOnChannelError(t *testing.T) {
	err := types.NewError(errors.New("channel failed"), types.ErrorCodeChannelNoAvailableKey)
	for _, test := range []struct {
		name      string
		pin       *dto.ChannelPin
		wantRetry bool
	}{
		{name: "unrestricted channel error", wantRetry: true},
		{
			name: "single attempt pin suppresses channel error retry",
			pin: &dto.ChannelPin{
				ChannelId: 1, Source: dto.PinSourceToken, Rank: dto.PinRankToken, RetryMode: dto.PinRetrySingleAttempt,
			},
			wantRetry: false,
		},
		{
			name: "origin task pin permits retry on the same channel",
			pin: &dto.ChannelPin{
				ChannelId: 1, Source: dto.PinSourceOriginTask, Rank: dto.PinRankOriginTask, RetryMode: dto.PinRetrySameChannel,
			},
			wantRetry: true,
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			if test.pin != nil {
				GetChannelConstraints(c).AddPin(*test.pin)
			}
			assert.Equal(t, test.wantRetry, ShouldRetryRelayError(c, err, 1))
		})
	}
}

func TestProcessChannelErrorMasksDisableReasonAndNotification(t *testing.T) {
	previousDB, previousType := model.DB, common.MainDatabaseType()
	previousCache, previousRedis := common.MemoryCacheEnabled, common.RedisEnabled
	previousAutoDisable, previousErrorLog := common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled
	previousNotifyLimit := constant.NotifyLimitCount
	previousClient, previousWorker := httpClient, system_setting.WorkerUrl
	fetch := system_setting.GetFetchSetting()
	previousFetch := *fetch
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		common.MemoryCacheEnabled, common.RedisEnabled = previousCache, previousRedis
		common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = previousAutoDisable, previousErrorLog
		constant.NotifyLimitCount = previousNotifyLimit
		httpClient, system_setting.WorkerUrl = previousClient, previousWorker
		*fetch = previousFetch
	})
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	require.NoError(t, database.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.User{}))
	model.DB = database
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.MemoryCacheEnabled, common.RedisEnabled = false, false
	common.AutomaticDisableChannelEnabled, constant.ErrorLogEnabled = true, false
	constant.NotifyLimitCount = 10
	channel := &model.Channel{Name: "relay-review", Key: "fixture-key", Type: 1, Status: common.ChannelStatusEnabled, Group: "default", Models: "test-model"}
	require.NoError(t, channel.Insert())
	notifications := make(chan []byte, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		notifications <- body
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(server.Close)
	httpClient, system_setting.WorkerUrl = server.Client(), ""
	fetch.EnableSSRFProtection = false
	settings, err := common.Marshal(kitdto.UserSetting{NotifyType: kitdto.NotifyTypeWebhook, WebhookUrl: server.URL})
	require.NoError(t, err)
	root := &model.User{Username: "notification-test-root", Role: common.RoleRootUser, Status: common.UserStatusEnabled, Setting: string(settings)}
	require.NoError(t, database.Create(root).Error)
	notifyKey := fmt.Sprintf("%d:%s:%s", root.Id, formatNotifyType(channel.Id, common.ChannelStatusAutoDisabled), time.Now().Format("2006010215"))
	notifyLimitStore.Delete(notifyKey)
	t.Cleanup(func() { notifyLimitStore.Delete(notifyKey) })
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	apiErr := types.NewErrorWithStatusCode(errors.New("upstream https://private.example.com/path?token=review-token api_key:review-secret"), types.ErrorCodeChannelNoAvailableKey, http.StatusUnauthorized)
	ProcessChannelError(c, types.ChannelError{ChannelId: channel.Id, ChannelName: channel.Name, AutoBan: true}, apiErr, nil)
	var notification WebhookPayload
	select {
	case payload := <-notifications:
		require.NoError(t, common.Unmarshal(payload, &notification))
	case <-time.After(5 * time.Second):
		t.Fatal("automatic channel-disable notification was not delivered")
	}
	loaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, common.ChannelStatusAutoDisabled, loaded.Status)
	wantReason := "status_code=401, upstream https://***.com/***?token=*** api_key:***"
	assert.Equal(t, wantReason, loaded.GetOtherInfo()["status_reason"])
	assert.Contains(t, notification.Content, wantReason)
	assert.NotContains(t, notification.Content, "review-token")
	assert.NotContains(t, notification.Content, "review-secret")
	assert.Equal(t, http.StatusUnauthorized, apiErr.StatusCode)
}

func TestDecideRelayRetryReasons(t *testing.T) {
	upstream := func(status int) *types.NewAPIError {
		return types.NewOpenAIError(errors.New("upstream"), types.ErrorCodeBadResponseStatusCode, status)
	}
	for _, tc := range []struct {
		name    string
		err     *types.NewAPIError
		retries int
		setup   func(*gin.Context)
		want    PolicyDecision
	}{
		{name: "retry status matched", err: upstream(http.StatusTooManyRequests), retries: 1, want: PolicyDecision{Action: "retry", Reason: "retry_status_matched", Source: "global"}},
		{name: "status outside retry rules", err: upstream(http.StatusBadRequest), retries: 1, want: PolicyDecision{Action: "stop", Reason: "status_not_retryable", Source: "global"}},
		{name: "attempt budget exhausted", err: upstream(http.StatusTooManyRequests), retries: 0, want: PolicyDecision{Action: "stop", Reason: "attempt_budget_exhausted", Source: "global"}},
		{name: "always skipped status", err: upstream(http.StatusGatewayTimeout), retries: 1, want: PolicyDecision{Action: "stop", Reason: "system_retry_exclusion", Source: "system"}},
		{name: "success status never retries", err: upstream(http.StatusOK), retries: 1, want: PolicyDecision{Action: "stop", Reason: "system_retry_exclusion", Source: "system"}},
		{name: "skip retry error", err: types.NewErrorWithStatusCode(errors.New("local"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry()), retries: 1, want: PolicyDecision{Action: "stop", Reason: "non_retryable_error", Source: "system"}},
		{name: "channel error retries without budget", err: types.NewError(errors.New("no key"), types.ErrorCodeChannelNoAvailableKey), retries: 0, want: PolicyDecision{Action: "retry", Reason: "channel_error", Source: "system"}},
		{name: "single attempt pin", err: upstream(http.StatusTooManyRequests), retries: 1, setup: func(c *gin.Context) {
			GetChannelConstraints(c).AddPin(dto.ChannelPin{ChannelId: 1, Source: dto.PinSourceToken, Rank: dto.PinRankToken, RetryMode: dto.PinRetrySingleAttempt})
		}, want: PolicyDecision{Action: "stop", Reason: "pinned_channel", Source: "channel_constraint"}},
		{name: "strict session", err: upstream(http.StatusTooManyRequests), retries: 1, setup: func(c *gin.Context) {
			c.Set(ginKeyChannelAffinitySkipRetry, true)
			RequestPolicy(c).SessionModeSource = "global"
		}, want: PolicyDecision{Action: "stop", Reason: "strict_session", Source: "global"}},
		{name: "nil error", retries: 1, want: PolicyDecision{Action: "stop", Reason: "request_completed", Source: "system"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			if tc.setup != nil {
				tc.setup(c)
			}
			decision := DecideRelayRetry(c, tc.err, tc.retries)
			assert.Equal(t, tc.want, decision)
			assert.Equal(t, tc.want.Action == "retry", ShouldRetryRelayError(c, tc.err, tc.retries))
		})
	}
}

func TestDecideRelayRetryManagedParity(t *testing.T) {
	setupUpstreamOrchestrationTest(t)
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.Enabled = true
	})
	const channelID = 991
	require.NoError(t, model.DB.Create(&model.UpstreamManagedRoute{
		SourceID:        1,
		ExternalGroupID: "managed-retry",
		Platform:        "openai",
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       channelID,
		State:           model.UpstreamRouteStateActive,
	}).Error)
	upstream := func(status int, message string, options ...types.NewAPIErrorOptions) *types.NewAPIError {
		return types.NewOpenAIError(errors.New(message), types.ErrorCodeBadResponseStatusCode, status, options...)
	}
	for _, tc := range []struct {
		name    string
		err     *types.NewAPIError
		retries int
		setup   func(*gin.Context)
		want    PolicyDecision
	}{
		{
			name: "request timeout", err: upstream(http.StatusRequestTimeout, "timeout"), retries: 1,
			want: PolicyDecision{Action: "retry", Reason: "managed_route_failure", Source: "managed"},
		},
		{
			name: "gateway timeout", err: upstream(http.StatusGatewayTimeout, "timeout"), retries: 1,
			want: PolicyDecision{Action: "retry", Reason: "managed_route_failure", Source: "managed"},
		},
		{
			name: "cloudflare timeout", err: upstream(524, "timeout"), retries: 1,
			want: PolicyDecision{Action: "retry", Reason: "managed_route_failure", Source: "managed"},
		},
		{
			name: "ordinary not found", err: upstream(http.StatusNotFound, "not found"), retries: 1,
			want: PolicyDecision{Action: "stop", Reason: "status_not_retryable", Source: "managed"},
		},
		{
			name: "unsupported model not found",
			err:  upstream(http.StatusNotFound, `Model "gpt-test" is not supported by any configured account in this group`), retries: 1,
			want: PolicyDecision{Action: "retry", Reason: "managed_route_failure", Source: "managed"},
		},
		{
			name: "channel error requires budget",
			err:  types.NewError(errors.New("no key"), types.ErrorCodeChannelNoAvailableKey), retries: 0,
			want: PolicyDecision{Action: "stop", Reason: "attempt_budget_exhausted", Source: "global"},
		},
		{
			name: "skip retry wins",
			err:  upstream(http.StatusInternalServerError, "local rejection", types.ErrOptionWithSkipRetry()), retries: 1,
			want: PolicyDecision{Action: "stop", Reason: "non_retryable_error", Source: "system"},
		},
		{
			name: "pin wins", err: upstream(http.StatusInternalServerError, "upstream"), retries: 1,
			setup: func(c *gin.Context) {
				GetChannelConstraints(c).AddPin(dto.ChannelPin{
					ChannelId: channelID, Source: dto.PinSourceToken, Rank: dto.PinRankToken, RetryMode: dto.PinRetrySingleAttempt,
				})
			},
			want: PolicyDecision{Action: "stop", Reason: "pinned_channel", Source: "channel_constraint"},
		},
		{
			name: "strict affinity wins", err: upstream(http.StatusInternalServerError, "upstream"), retries: 1,
			setup: func(c *gin.Context) {
				c.Set(ginKeyChannelAffinitySkipRetry, true)
				RequestPolicy(c).SessionModeSource = "global"
			},
			want: PolicyDecision{Action: "stop", Reason: "strict_session", Source: "global"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("channel_id", channelID)
			if tc.setup != nil {
				tc.setup(c)
			}
			assert.Equal(t, tc.want, DecideRelayRetry(c, tc.err, tc.retries))
		})
	}
}

func TestRequestPolicyEventsReachLogAdminInfo(t *testing.T) {
	previousAutoDisable := common.AutomaticDisableChannelEnabled
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() { common.AutomaticDisableChannelEnabled = previousAutoDisable })
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set("auto_ban", true)
	c.Set("channel_id", 7)
	state := RequestPolicy(c)
	state.BeginAttempt(&model.Channel{Id: 7}, "default")
	apiErr := types.NewOpenAIError(errors.New("invalid credential"), types.ErrorCodeBadResponseStatusCode, http.StatusUnauthorized)
	RecordPolicyFailure(c, 7, apiErr, DecideRelayRetry(c, apiErr, 0))

	failed := model.NewLogOther()
	AppendRelayLogAdminInfo(c, nil, failed)
	events, ok := failed.Snapshot()["admin_info"].(map[string]any)["request_policy"].([]PolicyEvent)
	require.True(t, ok, "a failed relay exposes its decision events to administrators")
	require.Len(t, events, 3)
	assert.Equal(t, PolicyDecision{Action: "attempt", Reason: "channel_selected", Source: "routing"}, events[0].Decision)
	assert.Equal(t, "default", events[0].Group)
	assert.Equal(t, PolicyDecision{Action: "failure", Reason: "upstream_failure", Source: "upstream"}, events[1].Decision)
	assert.Equal(t, http.StatusUnauthorized, events[1].Status)
	assert.Equal(t, PolicyDecision{Action: "stop", Reason: "attempt_budget_exhausted", Source: "global"}, events[2].Decision)
	assert.Equal(t, "channel_disable_requested", events[2].Health, "the health entry follows the automatic disable rules")
	common.SetContextKey(c, constant.ContextKeyChannelIsMultiKey, true)
	RecordPolicyFailure(c, 7, apiErr, DecideRelayRetry(c, apiErr, 0))
	assert.Equal(t, "key_disable_requested", state.Events()[4].Health)

	state.BeginAttempt(&model.Channel{Id: 8}, "default")
	c.Set("channel_id", 8)
	MarkRequestPolicySuccess(c, nil)
	MarkRequestPolicySuccess(c, nil)
	succeeded := model.NewLogOther()
	AppendRelayLogAdminInfo(c, nil, succeeded)
	events, ok = succeeded.Snapshot()["admin_info"].(map[string]any)["request_policy"].([]PolicyEvent)
	require.True(t, ok, "a successful relay exposes its decision events to administrators")
	require.Len(t, events, 7, "the outcome is recorded once")
	assert.Equal(t, PolicyDecision{Action: "success", Reason: "request_completed", Source: "upstream"}, events[6].Decision)
	assert.Equal(t, 8, events[6].ChannelID)
	assert.Equal(t, 2, events[6].Attempt)
	assert.True(t, state.Successful)

	untouched, _ := gin.CreateTestContext(httptest.NewRecorder())
	other := model.NewLogOther()
	AppendRelayLogAdminInfo(untouched, nil, other)
	assert.NotContains(t, other.Snapshot()["admin_info"], "request_policy", "requests without decisions do not carry an empty record")
}
