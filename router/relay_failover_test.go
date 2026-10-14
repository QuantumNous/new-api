package router

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const relayFailoverModel = "gpt-3.5-turbo"

type failoverUpstream struct {
	name       string
	statusCode int
	disconnect bool
	delay      time.Duration
	trace      *failoverCallTrace
	mu         sync.Mutex
	calls      int
	paths      []string
	bodies     [][]byte
	server     *httptest.Server
}

type failoverCallTrace struct {
	mu    sync.Mutex
	names []string
}

func (t *failoverCallTrace) append(name string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.names = append(t.names, name)
}

func (t *failoverCallTrace) snapshot() []string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return append([]string(nil), t.names...)
}

func newFailoverUpstream(t *testing.T, name string, statusCode int, traces ...*failoverCallTrace) *failoverUpstream {
	t.Helper()
	upstream := &failoverUpstream{name: name, statusCode: statusCode}
	if len(traces) > 0 {
		upstream.trace = traces[0]
	}
	upstream.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		upstream.mu.Lock()
		upstream.calls++
		upstream.paths = append(upstream.paths, r.URL.Path)
		upstream.bodies = append(upstream.bodies, append([]byte(nil), body...))
		statusCode := upstream.statusCode
		disconnect := upstream.disconnect
		delay := upstream.delay
		upstream.mu.Unlock()
		if upstream.trace != nil {
			upstream.trace.append(name)
		}
		if delay > 0 {
			time.Sleep(delay)
		}

		if disconnect {
			hijacker, ok := w.(http.Hijacker)
			if !ok {
				http.Error(w, "hijacking unavailable", http.StatusInternalServerError)
				return
			}
			connection, _, err := hijacker.Hijack()
			if err != nil {
				return
			}
			_ = connection.Close()
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if statusCode >= http.StatusBadRequest {
			w.WriteHeader(statusCode)
			_, _ = fmt.Fprintf(w, `{"error":{"message":"%s failure","type":"upstream_error","code":"ha_test"}}`, name)
			return
		}
		_, _ = fmt.Fprintf(w, `{
			"id":"chatcmpl-ha-test",
			"object":"chat.completion",
			"created":1,
			"model":"%s",
			"choices":[{"index":0,"message":{"role":"assistant","content":"%s"},"finish_reason":"stop"}],
			"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}
		}`, relayFailoverModel, name)
	}))
	t.Cleanup(upstream.server.Close)
	return upstream
}

func newDisconnectingFailoverUpstream(t *testing.T, name string, trace *failoverCallTrace) *failoverUpstream {
	t.Helper()
	upstream := newFailoverUpstream(t, name, http.StatusOK, trace)
	upstream.disconnect = true
	return upstream
}

func (u *failoverUpstream) callCount() int {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.calls
}

func (u *failoverUpstream) setStatus(statusCode int) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.statusCode = statusCode
}

func (u *failoverUpstream) setDelay(delay time.Duration) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.delay = delay
}

func (u *failoverUpstream) requestSnapshot() ([]string, [][]byte) {
	u.mu.Lock()
	defer u.mu.Unlock()
	paths := append([]string(nil), u.paths...)
	bodies := make([][]byte, len(u.bodies))
	for index := range u.bodies {
		bodies[index] = append([]byte(nil), u.bodies[index]...)
	}
	return paths, bodies
}

func setupRelayFailoverTest(t *testing.T, memoryCache bool) (*gin.Engine, *model.User) {
	t.Helper()
	setupRelayRouterTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(
		&model.Channel{},
		&model.Log{},
		&model.UserSubscription{},
		&model.UpstreamManagedRoute{},
	))
	ratio_setting.InitRatioSettings()

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalAutomaticDisable := common.AutomaticDisableChannelEnabled
	originalAutomaticEnable := common.AutomaticEnableChannelEnabled
	originalLogConsume := common.LogConsumeEnabled
	originalBatchUpdate := common.BatchUpdateEnabled
	originalRetryRanges := append([]operation_setting.StatusCodeRange(nil), operation_setting.AutomaticRetryStatusCodeRanges...)
	originalDisableRanges := append([]operation_setting.StatusCodeRange(nil), operation_setting.AutomaticDisableStatusCodeRanges...)
	common.MemoryCacheEnabled = memoryCache
	common.AutomaticDisableChannelEnabled = true
	common.AutomaticEnableChannelEnabled = true
	common.LogConsumeEnabled = true
	common.BatchUpdateEnabled = false
	operation_setting.AutomaticRetryStatusCodeRanges = []operation_setting.StatusCodeRange{
		{Start: http.StatusUnauthorized, End: http.StatusUnauthorized},
		{Start: http.StatusTooManyRequests, End: http.StatusTooManyRequests},
		{Start: http.StatusInternalServerError, End: http.StatusNetworkAuthenticationRequired},
	}
	operation_setting.AutomaticDisableStatusCodeRanges = []operation_setting.StatusCodeRange{
		{Start: http.StatusTooManyRequests, End: http.StatusTooManyRequests},
	}
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.AutomaticDisableChannelEnabled = originalAutomaticDisable
		common.AutomaticEnableChannelEnabled = originalAutomaticEnable
		common.LogConsumeEnabled = originalLogConsume
		common.BatchUpdateEnabled = originalBatchUpdate
		operation_setting.AutomaticRetryStatusCodeRanges = originalRetryRanges
		operation_setting.AutomaticDisableStatusCodeRanges = originalDisableRanges
	})

	user := &model.User{
		Username: "ha-relay-user",
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Quota:    1_000_000,
	}
	require.NoError(t, model.DB.Create(user).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		UserId:      user.Id,
		Key:         "harelaytoken",
		Name:        "ha-relay-token",
		Status:      common.TokenStatusEnabled,
		ExpiredTime: -1,
		RemainQuota: 1_000_000,
	}).Error)

	engine := gin.New()
	SetRelayRouter(engine)
	return engine, user
}

func addRelayFailoverChannel(t *testing.T, id int, priority int64, upstream *failoverUpstream) model.Channel {
	t.Helper()
	weight := uint(100)
	autoBan := 1
	baseURL := upstream.server.URL
	channel := model.Channel{
		Id:       id,
		Type:     constant.ChannelTypeOpenAI,
		Key:      "test-key",
		Status:   common.ChannelStatusEnabled,
		Name:     upstream.name,
		Weight:   &weight,
		BaseURL:  &baseURL,
		Models:   relayFailoverModel,
		Group:    "default",
		Priority: &priority,
		AutoBan:  &autoBan,
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
	return channel
}

func performRelayFailoverRequest(t *testing.T, engine *gin.Engine) *httptest.ResponseRecorder {
	t.Helper()
	return performRelayFailoverRequestWithToken(t, engine, "harelaytoken")
}

func performRelayFailoverRequestWithToken(t *testing.T, engine *gin.Engine, token string) *httptest.ResponseRecorder {
	t.Helper()
	body := bytes.NewBufferString(`{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"ping"}]}`)
	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", body)
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	return recorder
}

func initializeRelayFailoverChannels() {
	if common.MemoryCacheEnabled {
		model.InitChannelCache()
	}
}

func enableManagedOrchestrationForFailoverTest(t *testing.T, budgetSeconds int, failureThreshold ...int) {
	t.Helper()
	original := operation_setting.GetUpstreamOrchestrationSetting()
	originalValues, err := config.ConfigToMap(original)
	require.NoError(t, err)
	next := operation_setting.GetUpstreamOrchestrationSetting()
	next.Enabled = true
	next.FailureThreshold = 2
	if len(failureThreshold) > 0 {
		next.FailureThreshold = failureThreshold[0]
	}
	next.FailureWindowMinutes = 5
	next.FailoverBudgetSeconds = budgetSeconds
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

func addManagedFailoverRoute(t *testing.T, channel model.Channel, sourceID int64) model.UpstreamManagedRoute {
	t.Helper()
	route := model.UpstreamManagedRoute{
		SourceID:        sourceID,
		ExternalGroupID: fmt.Sprintf("group-%d", channel.Id),
		Platform:        "openai",
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       channel.Id,
		State:           model.UpstreamRouteStateActive,
	}
	require.NoError(t, model.DB.Create(&route).Error)
	return route
}

func requireEventually(t *testing.T, assertion func() bool) {
	t.Helper()
	require.Eventually(t, assertion, 2*time.Second, 10*time.Millisecond)
}

type failoverAdminInfo struct {
	AttemptCount      int      `json:"attempt_count"`
	AttemptedChannels []string `json:"attempted_channels"`
	PriorityPath      []int64  `json:"priority_path"`
	FinalTier         int64    `json:"final_tier"`
	FallbackReason    string   `json:"fallback_reason"`
}

func latestConsumeLog(t *testing.T, userID int) (model.Log, failoverAdminInfo) {
	t.Helper()
	var log model.Log
	require.NoError(t, model.LOG_DB.Where("user_id = ? AND type = ?", userID, model.LogTypeConsume).
		Order("id DESC").First(&log).Error)
	var payload struct {
		AdminInfo failoverAdminInfo `json:"admin_info"`
	}
	require.NoError(t, common.Unmarshal([]byte(log.Other), &payload))
	return log, payload.AdminInfo
}

func requireRelayRefunded(t *testing.T, userID int) {
	t.Helper()
	requireEventually(t, func() bool {
		var user model.User
		var token model.Token
		if err := model.DB.First(&user, userID).Error; err != nil {
			return false
		}
		if err := model.DB.Where("user_id = ?", userID).First(&token).Error; err != nil {
			return false
		}
		return user.Quota == 1_000_000 && token.RemainQuota == 1_000_000
	})
}

func TestRelayChannelFailoverHealthyPrimary(t *testing.T) {
	engine, user := setupRelayFailoverTest(t, false)
	trace := &failoverCallTrace{}
	primary := newFailoverUpstream(t, "primary", http.StatusOK, trace)
	backup := newFailoverUpstream(t, "backup", http.StatusOK, trace)
	primaryChannel := addRelayFailoverChannel(t, 3101, 30, primary)
	addRelayFailoverChannel(t, 3102, 20, backup)
	initializeRelayFailoverChannels()

	response := performRelayFailoverRequest(t, engine)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), "primary")
	assert.Equal(t, 1, primary.callCount())
	assert.Zero(t, backup.callCount())
	assert.Equal(t, []string{"primary"}, trace.snapshot())
	paths, bodies := primary.requestSnapshot()
	assert.Equal(t, []string{"/v1/chat/completions"}, paths)
	require.Len(t, bodies, 1)
	assert.Contains(t, string(bodies[0]), `"model":"gpt-3.5-turbo"`)
	log, adminInfo := latestConsumeLog(t, user.Id)
	assert.Equal(t, primaryChannel.Id, log.ChannelId)
	assert.Equal(t, 1, adminInfo.AttemptCount)
	assert.Equal(t, []string{"3101"}, adminInfo.AttemptedChannels)
	assert.Equal(t, []int64{30}, adminInfo.PriorityPath)
	assert.Equal(t, int64(30), adminInfo.FinalTier)
	assert.Empty(t, adminInfo.FallbackReason)
}

func TestRelayChannelFailoverFrom500(t *testing.T) {
	for _, memoryCache := range []bool{false, true} {
		t.Run(fmt.Sprintf("memory_cache_%t", memoryCache), func(t *testing.T) {
			engine, user := setupRelayFailoverTest(t, memoryCache)
			trace := &failoverCallTrace{}
			primary := newFailoverUpstream(t, "primary", http.StatusInternalServerError, trace)
			backup := newFailoverUpstream(t, "backup", http.StatusOK, trace)
			addRelayFailoverChannel(t, 3201, 30, primary)
			backupChannel := addRelayFailoverChannel(t, 3202, 20, backup)
			initializeRelayFailoverChannels()

			response := performRelayFailoverRequest(t, engine)

			require.Equal(t, http.StatusOK, response.Code, response.Body.String())
			assert.Contains(t, response.Body.String(), "backup")
			assert.Equal(t, 1, primary.callCount())
			assert.Equal(t, 1, backup.callCount())
			assert.Equal(t, []string{"primary", "backup"}, trace.snapshot())
			log, adminInfo := latestConsumeLog(t, user.Id)
			assert.Equal(t, backupChannel.Id, log.ChannelId)
			assert.Equal(t, 2, adminInfo.AttemptCount)
			assert.Equal(t, []string{"3201", "3202"}, adminInfo.AttemptedChannels)
			assert.Equal(t, []int64{30, 20}, adminInfo.PriorityPath)
			assert.Equal(t, int64(20), adminInfo.FinalTier)
			assert.Equal(t, "status_500:ha_test", adminInfo.FallbackReason)
		})
	}
}

func TestManagedRelayRetrySkipsInitialSourceSiblings(t *testing.T) {
	engine, user := setupRelayFailoverTest(t, true)
	enableManagedOrchestrationForFailoverTest(t, 90)
	trace := &failoverCallTrace{}
	initial := newFailoverUpstream(t, "source-a-primary", http.StatusInternalServerError, trace)
	sibling := newFailoverUpstream(t, "source-a-sibling", http.StatusOK, trace)
	backup := newFailoverUpstream(t, "source-b", http.StatusOK, trace)
	initialChannel := addRelayFailoverChannel(t, 3681, 30, initial)
	siblingChannel := addRelayFailoverChannel(t, 3682, 20, sibling)
	backupChannel := addRelayFailoverChannel(t, 3683, 20, backup)
	require.NoError(t, model.DB.Model(&model.Channel{}).
		Where("id = ?", backupChannel.Id).
		Update("weight", 0).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).
		Where("channel_id = ?", backupChannel.Id).
		Update("weight", 0).Error)
	initialRoute := addManagedFailoverRoute(t, initialChannel, 101)
	siblingRoute := addManagedFailoverRoute(t, siblingChannel, 101)
	backupRoute := addManagedFailoverRoute(t, backupChannel, 202)
	nextProbeAt := common.GetTimestamp() + 3600
	require.NoError(t, model.DB.Model(&model.UpstreamManagedRoute{}).
		Where("id IN ?", []int64{initialRoute.ID, siblingRoute.ID}).
		Update("next_probe_at", nextProbeAt).Error)
	probeScanDone := make(chan struct{})
	var probeScanOnce sync.Once
	const callbackName = "test:initial_source_failover_probe_complete"
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "upstream_managed_routes" &&
			strings.Contains(tx.Statement.SQL.String(), "last_success_at <") {
			probeScanOnce.Do(func() {
				close(probeScanDone)
			})
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
	})
	initializeRelayFailoverChannels()

	response := performRelayFailoverRequest(t, engine)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), "source-b")
	assert.Equal(t, []string{"source-a-primary", "source-b"}, trace.snapshot())
	assert.Equal(t, 1, initial.callCount())
	assert.Zero(t, sibling.callCount())
	assert.Equal(t, 1, backup.callCount())
	log, adminInfo := latestConsumeLog(t, user.Id)
	assert.Equal(t, backupChannel.Id, log.ChannelId)
	assert.Equal(t, 2, adminInfo.AttemptCount)
	assert.Equal(t, []string{"3681", "3683"}, adminInfo.AttemptedChannels)
	assert.Equal(t, []int64{30, 20}, adminInfo.PriorityPath)
	requireEventually(t, func() bool {
		return model.DB.First(&backupRoute, backupRoute.ID).Error == nil &&
			backupRoute.LastSuccessAt > 0
	})
	requireEventually(t, func() bool {
		return model.DB.First(&initialRoute, initialRoute.ID).Error == nil &&
			initialRoute.ConsecutiveFailures == 1
	})
	select {
	case <-probeScanDone:
	case <-time.After(2 * time.Second):
		t.Fatal("managed success did not complete its stale-route scan")
	}
}

func TestManagedRelayHealthPersistenceFailureStopsFailover(t *testing.T) {
	for _, failingTable := range []string{"upstream_managed_routes", "channels", "abilities"} {
		t.Run(failingTable, func(t *testing.T) {
			testManagedRelayHealthPersistenceFailureStopsFailover(t, failingTable)
		})
	}
}

func testManagedRelayHealthPersistenceFailureStopsFailover(t *testing.T, failingTable string) {
	engine, _ := setupRelayFailoverTest(t, true)
	enableManagedOrchestrationForFailoverTest(t, 90, 1)
	operation_setting.AutomaticDisableStatusCodeRanges = []operation_setting.StatusCodeRange{
		{Start: http.StatusInternalServerError, End: http.StatusInternalServerError},
	}
	trace := &failoverCallTrace{}
	primary := newFailoverUpstream(t, "primary", http.StatusInternalServerError, trace)
	backup := newFailoverUpstream(t, "backup", http.StatusOK, trace)
	primaryChannel := addRelayFailoverChannel(t, 3691, 30, primary)
	backupChannel := addRelayFailoverChannel(t, 3692, 20, backup)
	primaryRoute := addManagedFailoverRoute(t, primaryChannel, 301)
	addManagedFailoverRoute(t, backupChannel, 302)
	initializeRelayFailoverChannels()

	injected := fmt.Errorf("injected managed health persistence failure")
	const callbackName = "test:managed_health_persistence_failure"
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == failingTable {
			tx.AddError(injected)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})

	response := performRelayFailoverRequest(t, engine)

	assert.Equal(t, http.StatusInternalServerError, response.Code, response.Body.String())
	assert.Equal(t, []string{"primary"}, trace.snapshot())
	assert.Equal(t, 1, primary.callCount())
	assert.Zero(t, backup.callCount())
	var storedChannel model.Channel
	require.NoError(t, model.DB.First(&storedChannel, primaryChannel.Id).Error)
	assert.Equal(t, common.ChannelStatusEnabled, storedChannel.Status)
	var storedAbility model.Ability
	require.NoError(t, model.DB.Where("channel_id = ?", primaryChannel.Id).First(&storedAbility).Error)
	assert.True(t, storedAbility.Enabled)
	var storedRoute model.UpstreamManagedRoute
	require.NoError(t, model.DB.First(&storedRoute, primaryRoute.ID).Error)
	assert.Equal(t, model.UpstreamRouteStateActive, storedRoute.State)
	assert.Zero(t, storedRoute.ConsecutiveFailures)
	cachedChannel, err := model.CacheGetChannel(primaryChannel.Id)
	require.NoError(t, err)
	assert.Equal(t, common.ChannelStatusEnabled, cachedChannel.Status)
}

func TestRelayChannelFailoverFrom429DisablesPrimary(t *testing.T) {
	engine, _ := setupRelayFailoverTest(t, true)
	trace := &failoverCallTrace{}
	primary := newFailoverUpstream(t, "primary", http.StatusTooManyRequests, trace)
	backup := newFailoverUpstream(t, "backup", http.StatusOK, trace)
	primaryChannel := addRelayFailoverChannel(t, 3301, 30, primary)
	addRelayFailoverChannel(t, 3302, 20, backup)
	initializeRelayFailoverChannels()

	firstResponse := performRelayFailoverRequest(t, engine)
	require.Equal(t, http.StatusOK, firstResponse.Code, firstResponse.Body.String())
	requireEventually(t, func() bool {
		var stored model.Channel
		if err := model.DB.First(&stored, primaryChannel.Id).Error; err != nil {
			return false
		}
		var ability model.Ability
		if err := model.DB.Where("channel_id = ?", primaryChannel.Id).First(&ability).Error; err != nil {
			return false
		}
		return stored.Status == common.ChannelStatusAutoDisabled && !ability.Enabled
	})

	secondResponse := performRelayFailoverRequest(t, engine)

	require.Equal(t, http.StatusOK, secondResponse.Code, secondResponse.Body.String())
	assert.Equal(t, []string{"primary", "backup", "backup"}, trace.snapshot())
	assert.Equal(t, 1, primary.callCount())
	assert.Equal(t, 2, backup.callCount())
}

func TestRelayChannelFailoverFromConnectionFailure(t *testing.T) {
	engine, _ := setupRelayFailoverTest(t, false)
	trace := &failoverCallTrace{}
	primary := newDisconnectingFailoverUpstream(t, "disconnect", trace)
	backup := newFailoverUpstream(t, "backup", http.StatusOK, trace)
	addRelayFailoverChannel(t, 3401, 30, primary)
	addRelayFailoverChannel(t, 3402, 20, backup)
	initializeRelayFailoverChannels()

	response := performRelayFailoverRequest(t, engine)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), "backup")
	assert.Equal(t, []string{"disconnect", "backup"}, trace.snapshot())
}

func TestRelayChannelErrorHonorsPinnedRetrySuppression(t *testing.T) {
	for _, test := range []struct {
		name      string
		managed   bool
		pinned    bool
		wantRetry bool
	}{
		{name: "pinned managed", managed: true, pinned: true, wantRetry: false},
		{name: "pinned unmanaged", pinned: true, wantRetry: false},
		{name: "unpinned", managed: true, wantRetry: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			engine, user := setupRelayFailoverTest(t, false)
			enableManagedOrchestrationForFailoverTest(t, 90)
			require.NoError(t, model.DB.Model(user).Update("role", common.RoleRootUser).Error)
			trace := &failoverCallTrace{}
			invalid := newFailoverUpstream(t, "invalid-channel", http.StatusOK, trace)
			backup := newFailoverUpstream(t, "backup", http.StatusOK, trace)
			channel := addRelayFailoverChannel(t, 3451, 30, invalid)
			require.NoError(t, model.DB.Model(&channel).Updates(map[string]any{
				"type":     constant.ChannelTypeXunfei,
				"key":      "invalid",
				"auto_ban": 0,
			}).Error)
			backupChannel := addRelayFailoverChannel(t, 3452, 20, backup)
			var backupRoute model.UpstreamManagedRoute
			if test.managed {
				addManagedFailoverRoute(t, channel, 3451)
				backupRoute = addManagedFailoverRoute(t, backupChannel, 3452)
			}
			managedSuccessDone := make(chan struct{})
			var managedSuccessOnce sync.Once
			const callbackName = "test:pinned_retry_managed_success_complete"
			require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
				if tx.Statement.Table == "upstream_managed_routes" &&
					strings.Contains(tx.Statement.SQL.String(), "last_success_at <") {
					managedSuccessOnce.Do(func() {
						close(managedSuccessDone)
					})
				}
			}))
			t.Cleanup(func() {
				require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
			})
			initializeRelayFailoverChannels()

			token := "harelaytoken"
			if test.pinned {
				token += fmt.Sprintf("-%d", channel.Id)
			}
			response := performRelayFailoverRequestWithToken(t, engine, token)

			if test.wantRetry {
				require.Equal(t, http.StatusOK, response.Code, response.Body.String())
				assert.Contains(t, response.Body.String(), "backup")
				assert.Equal(t, 1, backup.callCount())
				requireEventually(t, func() bool {
					return model.DB.First(&backupRoute, backupRoute.ID).Error == nil &&
						backupRoute.LastSuccessAt > 0
				})
				select {
				case <-managedSuccessDone:
				case <-time.After(2 * time.Second):
					t.Fatal("managed success did not complete its stale-route scan")
				}
			} else {
				assert.NotEqual(t, http.StatusOK, response.Code, response.Body.String())
				assert.Zero(t, backup.callCount())
			}
		})
	}
}

func TestRelayChannelFailoverDoesNotRetry400(t *testing.T) {
	engine, user := setupRelayFailoverTest(t, false)
	trace := &failoverCallTrace{}
	primary := newFailoverUpstream(t, "primary", http.StatusBadRequest, trace)
	backup := newFailoverUpstream(t, "backup", http.StatusOK, trace)
	addRelayFailoverChannel(t, 3501, 30, primary)
	addRelayFailoverChannel(t, 3502, 20, backup)
	initializeRelayFailoverChannels()

	response := performRelayFailoverRequest(t, engine)

	assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
	assert.Equal(t, []string{"primary"}, trace.snapshot())
	assert.Zero(t, backup.callCount())
	requireRelayRefunded(t, user.Id)
}

func TestRelayChannelFailoverCapsAttemptsAtFivePriorities(t *testing.T) {
	engine, user := setupRelayFailoverTest(t, false)
	enableManagedOrchestrationForFailoverTest(t, 90)
	trace := &failoverCallTrace{}
	priorities := []int64{30, 20, 10, 0, -10, -20}
	upstreams := make([]*failoverUpstream, 0, len(priorities))
	for index, priority := range priorities {
		name := fmt.Sprintf("tier-%d", priority)
		upstream := newFailoverUpstream(t, name, http.StatusInternalServerError, trace)
		upstreams = append(upstreams, upstream)
		addRelayFailoverChannel(t, 3601+index, priority, upstream)
	}
	initializeRelayFailoverChannels()

	response := performRelayFailoverRequest(t, engine)

	assert.Equal(t, http.StatusInternalServerError, response.Code, response.Body.String())
	assert.Equal(t, []string{"tier-30", "tier-20", "tier-10", "tier-0", "tier--10"}, trace.snapshot())
	for index, upstream := range upstreams {
		if index < 5 {
			assert.Equal(t, 1, upstream.callCount())
		} else {
			assert.Zero(t, upstream.callCount())
		}
	}
	requireRelayRefunded(t, user.Id)
}

func TestRelayChannelFailoverStopsWhenBudgetExpires(t *testing.T) {
	engine, user := setupRelayFailoverTest(t, false)
	enableManagedOrchestrationForFailoverTest(t, 1)
	trace := &failoverCallTrace{}
	primary := newFailoverUpstream(t, "slow-primary", http.StatusInternalServerError, trace)
	primary.setDelay(1100 * time.Millisecond)
	backup := newFailoverUpstream(t, "backup", http.StatusOK, trace)
	addRelayFailoverChannel(t, 3651, 30, primary)
	addRelayFailoverChannel(t, 3652, 20, backup)
	initializeRelayFailoverChannels()

	response := performRelayFailoverRequest(t, engine)

	assert.Equal(t, http.StatusInternalServerError, response.Code, response.Body.String())
	assert.Equal(t, []string{"slow-primary"}, trace.snapshot())
	assert.Zero(t, backup.callCount())
	requireRelayRefunded(t, user.Id)
}

func TestManagedRelayFailureQuarantinesAfterSecond500(t *testing.T) {
	engine, _ := setupRelayFailoverTest(t, true)
	enableManagedOrchestrationForFailoverTest(t, 90)
	trace := &failoverCallTrace{}
	primary := newFailoverUpstream(t, "managed-primary", http.StatusInternalServerError, trace)
	backup := newFailoverUpstream(t, "backup", http.StatusOK, trace)
	primaryChannel := addRelayFailoverChannel(t, 3661, 30, primary)
	addRelayFailoverChannel(t, 3662, 20, backup)
	route := addManagedFailoverRoute(t, primaryChannel, int64(primaryChannel.Id))
	initializeRelayFailoverChannels()

	first := performRelayFailoverRequest(t, engine)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	requireEventually(t, func() bool {
		return model.DB.First(&route, route.ID).Error == nil &&
			route.ConsecutiveFailures == 1 &&
			route.State == model.UpstreamRouteStateActive
	})

	second := performRelayFailoverRequest(t, engine)
	require.Equal(t, http.StatusOK, second.Code, second.Body.String())
	requireEventually(t, func() bool {
		var storedChannel model.Channel
		return model.DB.First(&route, route.ID).Error == nil &&
			model.DB.First(&storedChannel, primaryChannel.Id).Error == nil &&
			route.ConsecutiveFailures == 2 &&
			route.State == model.UpstreamRouteStateQuarantined &&
			storedChannel.Status == common.ChannelStatusAutoDisabled
	})
	assert.Equal(t, []string{
		"managed-primary", "backup",
		"managed-primary", "backup",
	}, trace.snapshot())
}

func TestManagedRelay408RetriesAndQuarantines(t *testing.T) {
	engine, _ := setupRelayFailoverTest(t, true)
	enableManagedOrchestrationForFailoverTest(t, 90)
	trace := &failoverCallTrace{}
	primary := newFailoverUpstream(t, "managed-timeout", http.StatusRequestTimeout, trace)
	backup := newFailoverUpstream(t, "backup", http.StatusOK, trace)
	primaryChannel := addRelayFailoverChannel(t, 3663, 30, primary)
	addRelayFailoverChannel(t, 3664, 20, backup)
	route := addManagedFailoverRoute(t, primaryChannel, int64(primaryChannel.Id))
	initializeRelayFailoverChannels()

	first := performRelayFailoverRequest(t, engine)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	requireEventually(t, func() bool {
		return model.DB.First(&route, route.ID).Error == nil &&
			route.ConsecutiveFailures == 1 &&
			route.State == model.UpstreamRouteStateActive
	})

	second := performRelayFailoverRequest(t, engine)
	require.Equal(t, http.StatusOK, second.Code, second.Body.String())
	requireEventually(t, func() bool {
		var storedChannel model.Channel
		return model.DB.First(&route, route.ID).Error == nil &&
			model.DB.First(&storedChannel, primaryChannel.Id).Error == nil &&
			route.ConsecutiveFailures == 2 &&
			route.State == model.UpstreamRouteStateQuarantined &&
			storedChannel.Status == common.ChannelStatusAutoDisabled
	})
	assert.Equal(t, []string{
		"managed-timeout", "backup",
		"managed-timeout", "backup",
	}, trace.snapshot())
}

func TestManagedRelayDoesNotRetryOrCountOrdinary400(t *testing.T) {
	engine, _ := setupRelayFailoverTest(t, false)
	enableManagedOrchestrationForFailoverTest(t, 90)
	trace := &failoverCallTrace{}
	primary := newFailoverUpstream(t, "managed-primary", http.StatusBadRequest, trace)
	backup := newFailoverUpstream(t, "backup", http.StatusOK, trace)
	primaryChannel := addRelayFailoverChannel(t, 3671, 30, primary)
	addRelayFailoverChannel(t, 3672, 20, backup)
	route := addManagedFailoverRoute(t, primaryChannel, int64(primaryChannel.Id))
	initializeRelayFailoverChannels()

	response := performRelayFailoverRequest(t, engine)

	assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
	assert.Equal(t, []string{"managed-primary"}, trace.snapshot())
	assert.Zero(t, backup.callCount())
	require.NoError(t, model.DB.First(&route, route.ID).Error)
	assert.Zero(t, route.ConsecutiveFailures)
	assert.Equal(t, model.UpstreamRouteStateActive, route.State)
	var storedChannel model.Channel
	require.NoError(t, model.DB.First(&storedChannel, primaryChannel.Id).Error)
	assert.Equal(t, common.ChannelStatusEnabled, storedChannel.Status)
}

func TestRelayChannelFailoverBillsLikeHealthyRequest(t *testing.T) {
	engine, user := setupRelayFailoverTest(t, false)
	primary := newFailoverUpstream(t, "primary", http.StatusOK)
	backup := newFailoverUpstream(t, "backup", http.StatusOK)
	addRelayFailoverChannel(t, 3701, 30, primary)
	addRelayFailoverChannel(t, 3702, 20, backup)
	initializeRelayFailoverChannels()

	quotaBefore := user.Quota
	baselineResponse := performRelayFailoverRequest(t, engine)
	require.Equal(t, http.StatusOK, baselineResponse.Code, baselineResponse.Body.String())
	var afterBaseline model.User
	require.NoError(t, model.DB.First(&afterBaseline, user.Id).Error)
	baselineCost := quotaBefore - afterBaseline.Quota
	require.Positive(t, baselineCost)

	primary.setStatus(http.StatusInternalServerError)
	failoverResponse := performRelayFailoverRequest(t, engine)
	require.Equal(t, http.StatusOK, failoverResponse.Code, failoverResponse.Body.String())
	var afterFailover model.User
	require.NoError(t, model.DB.First(&afterFailover, user.Id).Error)
	failoverCost := afterBaseline.Quota - afterFailover.Quota

	assert.Equal(t, baselineCost, failoverCost)
	var consumeCount int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).
		Where("user_id = ? AND type = ?", user.Id, model.LogTypeConsume).
		Count(&consumeCount).Error)
	assert.Equal(t, int64(2), consumeCount)
}
