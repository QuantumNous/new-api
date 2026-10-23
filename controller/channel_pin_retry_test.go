package controller

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestShouldRetryHonorsPinRetryMode(t *testing.T) {
	openaiErr := types.NewOpenAIError(errors.New("upstream"), types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError)

	c := newPinRetryContext()
	assert.True(t, service.ShouldRetryRelayError(c, openaiErr, 1))

	origin := newPinRetryContext()
	service.GetChannelConstraints(origin).AddPin(dto.ChannelPin{
		ChannelId: 2,
		Source:    dto.PinSourceOriginTask,
		Rank:      dto.PinRankOriginTask,
		RetryMode: dto.PinRetrySameChannel,
	})
	assert.True(t, service.ShouldRetryRelayError(origin, openaiErr, 1), "origin pin retries on the same channel")

	token := newPinRetryContext()
	service.GetChannelConstraints(token).AddPin(dto.ChannelPin{
		ChannelId: 1,
		Source:    dto.PinSourceToken,
		Rank:      dto.PinRankToken,
		RetryMode: dto.PinRetrySingleAttempt,
	})
	assert.Equal(t, service.PolicyDecision{Action: "stop", Reason: "pinned_channel", Source: "channel_constraint"}, service.DecideRelayRetry(token, openaiErr, 1), "token pin suppresses retry")
}

func TestShouldRetryTaskRelayHonorsPinRetryMode(t *testing.T) {
	taskErr := &dto.TaskError{StatusCode: http.StatusInternalServerError}

	c := newPinRetryContext()
	assert.Equal(t, "retry", decideTaskRetry(c, taskErr, 1).Action)

	origin := newPinRetryContext()
	service.GetChannelConstraints(origin).AddPin(dto.ChannelPin{
		ChannelId: 2,
		Source:    dto.PinSourceOriginTask,
		Rank:      dto.PinRankOriginTask,
		RetryMode: dto.PinRetrySameChannel,
	})
	assert.Equal(t, "retry", decideTaskRetry(origin, taskErr, 1).Action)

	token := newPinRetryContext()
	service.GetChannelConstraints(token).AddPin(dto.ChannelPin{
		ChannelId: 1,
		Source:    dto.PinSourceToken,
		Rank:      dto.PinRankToken,
		RetryMode: dto.PinRetrySingleAttempt,
	})
	assert.Equal(t, service.PolicyDecision{Action: "stop", Reason: "pinned_channel", Source: "channel_constraint"}, decideTaskRetry(token, taskErr, 1))
}

func TestSameChannelPinsMergeToStricterRetryMode(t *testing.T) {
	c := newPinRetryContext()
	constraints := service.GetChannelConstraints(c)
	constraints.AddPin(dto.ChannelPin{
		ChannelId: 7,
		Source:    dto.PinSourceOriginTask,
		Rank:      dto.PinRankOriginTask,
		RetryMode: dto.PinRetrySameChannel,
	})
	constraints.AddPin(dto.ChannelPin{
		ChannelId: 7,
		Source:    dto.PinSourceToken,
		Rank:      dto.PinRankToken,
		RetryMode: dto.PinRetrySingleAttempt,
	})
	pin, found, overridden := constraints.ResolvedPin()
	require.True(t, found)
	assert.Equal(t, 7, pin.ChannelId)
	assert.Equal(t, dto.PinRetrySingleAttempt, pin.RetryMode)
	assert.Empty(t, overridden)
	assert.False(t, service.ShouldRetryRelayError(c, types.NewOpenAIError(errors.New("upstream"), types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError), 1))
}

func newPinRetryContext() *gin.Context {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

func TestRequestPolicyConfigReturnsSettingsWithoutMigration(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	GetRequestPolicy(ctx)
	assert.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool           `json:"success"`
		Data    map[string]any `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Contains(t, response.Data, "options")
	assert.NotContains(t, response.Data, "migration")
	assert.NotContains(t, response.Data, "differences")
}

func TestRequestPolicyRoutingDatabaseMatrix(t *testing.T) {
	require.NoError(t, i18n.Init())
	for _, dialect := range []struct{ kind, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.kind, func(t *testing.T) {
			dsn := ""
			if dialect.env != "" {
				dsn = os.Getenv(dialect.env)
				if dsn == "" {
					t.Skipf("%s not configured", dialect.env)
				}
			}
			db := modelManagementDB(t, dialect.kind, dsn)
			previousGroups := setting.UserUsableGroups2JSONString()
			previousRatios, err := common.Marshal(ratio_setting.GetGroupRatioCopy())
			require.NoError(t, err)
			require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default"}`))
			require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))
			t.Cleanup(func() {
				require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousGroups))
				require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(string(previousRatios)))
			})
			// Channel 1 holds the session binding but is no longer usable.
			channels := []model.Channel{
				{Id: 1, Name: "A", Type: 1, Key: "test-only", Status: common.ChannelStatusAutoDisabled, Models: "policy-test", Group: "default", Priority: common.GetPointer(int64(10))},
				{Id: 2, Name: "B", Type: 1, Key: "test-only", Status: common.ChannelStatusEnabled, Models: "policy-test", Group: "default", Priority: common.GetPointer(int64(5))},
			}
			for i := range channels {
				require.NoError(t, db.Create(&channels[i]).Error)
				require.NoError(t, channels[i].AddAbilities(db))
			}
			affinity := operation_setting.GetChannelAffinitySetting()
			previousAffinity := *affinity
			t.Cleanup(func() { *affinity = previousAffinity })
			for _, cached := range []bool{false, true} {
				for _, keep := range []bool{false, true} {
					for _, tc := range []struct {
						globalMode, ruleMode string
						blocked              bool
					}{
						{"strict", "inherit", true},
						{"prefer", "strict", true},
						{"prefer", "inherit", false},
						{"strict", "prefer", false},
					} {
						t.Run(fmt.Sprintf("cache=%t/keep=%t/global=%s/rule=%s", cached, keep, tc.globalMode, tc.ruleMode), func(t *testing.T) {
							common.MemoryCacheEnabled = cached
							model.InitChannelCache()
							snapshot, err := model.BuildRequestPolicy(map[string]string{
								"channel_affinity_setting.enabled":                  "true",
								"channel_affinity_setting.session_mode":             tc.globalMode,
								"channel_affinity_setting.keep_on_channel_disabled": fmt.Sprint(keep),
								"channel_affinity_setting.rules":                    fmt.Sprintf(`[{"name":"session","model_regex":[".*"],"key_sources":[{"type":"request_header","key":"X-Session"}],"session_mode":%q}]`, tc.ruleMode),
							})
							require.NoError(t, err)
							*affinity = snapshot.Affinity
							seed := newPinRetryContext()
							seed.Request.Header.Set("X-Session", t.Name())
							_, found := service.GetPreferredChannelByAffinity(seed, "policy-test", "default")
							require.False(t, found)
							seed.Set("channel_id", 1)
							service.RecordChannelAffinity(seed, 1)
							t.Cleanup(func() { service.ClearCurrentChannelAffinityCache(seed) })
							bound, found := service.GetPreferredChannelByAffinity(seed, "policy-test", "default")
							require.True(t, found)
							require.Equal(t, 1, bound)

							request := newPinRetryContext()
							request.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"policy-test"}`))
							request.Request.Header.Set("Content-Type", "application/json")
							request.Request.Header.Set("X-Session", t.Name())
							common.SetContextKey(request, constant.ContextKeyUsingGroup, "default")
							middleware.Distribute()(request)
							events := service.RequestPolicy(request).Events()
							assert.True(t, slices.ContainsFunc(events, func(event service.PolicyEvent) bool { return event.Decision.Reason == "session_rule_matched" }), "decision events are recorded for every request")
							bound, found = service.GetPreferredChannelByAffinity(seed, "policy-test", "default")
							if tc.blocked {
								assert.Equal(t, http.StatusServiceUnavailable, request.Writer.Status())
								assert.True(t, request.IsAborted())
								assert.Equal(t, keep, found, "binding retention is independent of strict request handling")
								if found {
									assert.Equal(t, 1, bound)
								}
								return
							}
							assert.False(t, request.IsAborted())
							assert.Equal(t, 2, common.GetContextKeyInt(request, constant.ContextKeyChannelId), "prefer falls back to the next eligible channel")
							require.True(t, found)
							assert.Equal(t, 2, bound, "a successful fallback rebinds the session")
						})
					}
				}
			}
		})
	}
}

func TestRelayRetryPrefersUntriedChannels(t *testing.T) {
	require.NoError(t, i18n.Init())
	service.InitHttpClient()
	previousMetrics := config.GlobalConfig.ExportAllConfigs()["perf_metrics_setting.enabled"]
	config.UpdateConfigFromMap(config.GlobalConfig.Get("perf_metrics_setting"), map[string]string{"enabled": "false"})
	t.Cleanup(func() {
		config.UpdateConfigFromMap(config.GlobalConfig.Get("perf_metrics_setting"), map[string]string{"enabled": previousMetrics})
	})
	previousRetries, previousDisable := common.RetryTimes, common.AutomaticDisableChannelEnabled
	previousCount, previousErrors, previousConsume := constant.CountToken, constant.ErrorLogEnabled, common.LogConsumeEnabled
	previousSensitive := setting.CheckSensitiveEnabled
	previousFreePreConsume := operation_setting.GetQuotaSetting().EnableFreeModelPreConsume
	operation_setting.GetQuotaSetting().EnableFreeModelPreConsume = false
	common.RetryTimes, common.AutomaticDisableChannelEnabled = 3, false
	constant.CountToken, constant.ErrorLogEnabled, common.LogConsumeEnabled = false, false, false
	setting.CheckSensitiveEnabled = false
	t.Cleanup(func() {
		common.RetryTimes, common.AutomaticDisableChannelEnabled = previousRetries, previousDisable
		constant.CountToken, constant.ErrorLogEnabled, common.LogConsumeEnabled = previousCount, previousErrors, previousConsume
		setting.CheckSensitiveEnabled = previousSensitive
		operation_setting.GetQuotaSetting().EnableFreeModelPreConsume = previousFreePreConsume
	})
	for _, dialect := range []struct{ kind, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.kind, func(t *testing.T) {
			if dialect.env != "" && os.Getenv(dialect.env) == "" {
				t.Skip("set " + dialect.env + " to run this database")
			}
			db := modelManagementDB(t, dialect.kind, os.Getenv(dialect.env))
			require.NoError(t, db.Create(&model.User{Id: 1, Username: "retry-user", Group: "default"}).Error)
			require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"retry-test":0}`))
			for _, cached := range []bool{false, true} {
				for _, tc := range []struct {
					name           string
					backupPriority int64
					strict         bool
				}{
					{"same_priority", 0, false},
					{"lower_priority_affinity", 10, false},
					{"strict_affinity", 10, true},
				} {
					t.Run(fmt.Sprintf("cache=%t/%s", cached, tc.name), func(t *testing.T) {
						common.MemoryCacheEnabled = cached
						require.NoError(t, db.Where("1 = 1").Delete(&model.Ability{}).Error)
						require.NoError(t, db.Where("1 = 1").Delete(&model.Channel{}).Error)
						var mu sync.Mutex
						var calls []int
						var upstreams []*httptest.Server
						for id := range 2 {
							upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
								assert.Equal(t, "/v1/images/generations", r.URL.Path)
								mu.Lock()
								calls = append(calls, id+1)
								mu.Unlock()
								w.Header().Set("Content-Type", "application/json")
								if id == 0 {
									w.WriteHeader(http.StatusServiceUnavailable)
									_, _ = io.WriteString(w, `{"error":{"message":"temporarily unavailable","type":"server_error","code":"unavailable"}}`)
									return
								}
								_, _ = io.WriteString(w, `{"created":1,"data":[{"b64_json":"dGVzdA=="}]}`)
							}))
							t.Cleanup(upstream.Close)
							upstreams = append(upstreams, upstream)
							priority := int64(0)
							if id == 1 {
								priority = tc.backupPriority
							}
							channel := model.Channel{Id: id + 1, Name: fmt.Sprintf("upstream-%d", id+1), Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Key: "test-only", BaseURL: &upstream.URL, Models: "retry-test", Group: "default", Priority: &priority, Weight: common.GetPointer(uint(100 * (1 - id)))}
							require.NoError(t, db.Create(&channel).Error)
							require.NoError(t, channel.AddAbilities(db))
						}
						model.InitChannelCache()
						const body = `{"model":"retry-test","prompt":"a red square","n":1}`
						for id, upstream := range upstreams {
							response, err := http.Post(upstream.URL+"/v1/images/generations", "application/json", strings.NewReader(body))
							require.NoError(t, err)
							_, err = io.Copy(io.Discard, response.Body)
							require.NoError(t, err)
							require.NoError(t, response.Body.Close())
							assert.Equal(t, []int{503, 200}[id], response.StatusCode)
						}
						mu.Lock()
						calls = nil
						mu.Unlock()
						affinity := operation_setting.GetChannelAffinitySetting()
						previousAffinity := *affinity
						t.Cleanup(func() { *affinity = previousAffinity })
						sessionMode := "prefer"
						if tc.strict {
							sessionMode = "strict"
						}
						snapshot, err := model.BuildRequestPolicy(map[string]string{
							"channel_affinity_setting.enabled":      "true",
							"channel_affinity_setting.session_mode": sessionMode,
							"channel_affinity_setting.rules":        `[{"name":"retry-session","model_regex":[".*"],"key_sources":[{"type":"request_header","key":"X-Session"}],"session_mode":"inherit"}]`,
						})
						require.NoError(t, err)
						*affinity = snapshot.Affinity
						seed := newPinRetryContext()
						seed.Request.Header.Set("X-Session", t.Name())
						_, _ = service.GetPreferredChannelByAffinity(seed, "retry-test", "default")
						seed.Set("channel_id", 1)
						service.RecordChannelAffinity(seed, 1)
						t.Cleanup(func() { service.ClearCurrentChannelAffinityCache(seed) })
						engine := gin.New()
						var trail []string
						engine.POST("/v1/images/generations", func(c *gin.Context) {
							c.Set("id", 1)
							common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
							common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
							common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
							common.SetContextKey(c, constant.ContextKeyRequestStartTime, time.Now())
						}, middleware.Distribute(), func(c *gin.Context) {
							Relay(c, types.RelayFormatOpenAIImage)
							trail = c.GetStringSlice("use_channel")
						})
						request := httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(body))
						request.Header.Set("Content-Type", "application/json")
						request.Header.Set("X-Session", t.Name())
						response := httptest.NewRecorder()
						engine.ServeHTTP(response, request)
						mu.Lock()
						actualCalls := slices.Clone(calls)
						mu.Unlock()
						t.Logf("direct upstreams: A=503 B=200; gateway=%d calls=%v trail=%v", response.Code, actualCalls, trail)
						if tc.strict {
							assert.Equal(t, http.StatusServiceUnavailable, response.Code)
							assert.Equal(t, []int{1}, actualCalls)
							assert.Equal(t, []string{"1"}, trail)
							return
						}
						assert.Equal(t, http.StatusOK, response.Code, response.Body.String())
						assert.Contains(t, response.Body.String(), `"b64_json":"dGVzdA=="`)
						assert.Equal(t, []int{1, 2}, actualCalls)
						assert.Equal(t, []string{"1", "2"}, trail)
					})
				}
			}
		})
	}
}

func TestRetryChannelSelectionKeepsFallbackAndPins(t *testing.T) {
	for _, cached := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cached), func(t *testing.T) {
			db := modelManagementDB(t, "sqlite", "")
			common.MemoryCacheEnabled = cached
			channels := []model.Channel{
				{Id: 1, Name: "single", Type: 1, Key: "test-only", Status: common.ChannelStatusEnabled, Models: "retry-test", Group: "default", Priority: common.GetPointer(int64(10))},
				{Id: 2, Name: "multi", Type: 1, Key: "first\nsecond", Status: common.ChannelStatusEnabled, Models: "retry-test", Group: "default", Priority: common.GetPointer(int64(5)), ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyMode: constant.MultiKeyModePolling}},
			}
			for i := range channels {
				require.NoError(t, db.Create(&channels[i]).Error)
				require.NoError(t, channels[i].AddAbilities(db))
			}
			model.InitChannelCache()
			for _, tc := range []struct {
				name   string
				used   []string
				pinned bool
				auto   bool
				want   int
			}{
				{"untried_backup", []string{"1"}, false, false, 2},
				{"untried_higher_priority", []string{"2"}, false, false, 1},
				{"pool_exhausted_preserves_retry", []string{"1", "2"}, false, false, 2},
				{"pin_preserves_existing_selection", []string{"2"}, true, false, 2},
				{"auto_untried_backup", []string{"1"}, false, true, 2},
			} {
				t.Run(tc.name, func(t *testing.T) {
					c := newPinRetryContext()
					c.Set("use_channel", tc.used)
					if tc.pinned {
						service.GetChannelConstraints(c).AddPin(dto.ChannelPin{ChannelId: 2, Source: dto.PinSourceOriginTask, RetryMode: dto.PinRetrySameChannel})
					}
					param := &service.RetryParam{Ctx: c, TokenGroup: "default", ModelName: "retry-test", Retry: common.GetPointer(1)}
					if tc.auto {
						param.TokenGroup = "auto"
						common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
						common.SetContextKey(c, constant.ContextKeyTokenAutoGroups, []string{"default"})
					}
					channel, group, err := service.CacheGetRandomSatisfiedChannel(param)
					require.NoError(t, err)
					require.NotNil(t, channel)
					assert.Equal(t, tc.want, channel.Id)
					assert.Equal(t, "default", group)
					assert.Equal(t, 1, param.GetRetry(), "preference must not change the retry budget")
				})
			}
			// With only one channel left, a transient failure must retain its
			// configured retry opportunity instead of exhausting the pool.
			require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", false).Error)
			require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusManuallyDisabled).Error)
			model.InitChannelCache()
			c := newPinRetryContext()
			c.Set("use_channel", []string{"2"})
			channel, _, err := service.CacheGetRandomSatisfiedChannel(&service.RetryParam{Ctx: c, TokenGroup: "default", ModelName: "retry-test", Retry: common.GetPointer(1)})
			require.NoError(t, err)
			require.NotNil(t, channel)
			assert.Equal(t, 2, channel.Id)
		})
	}
}

func TestAutoGroupSelectionSkipsErrors(t *testing.T) {
	for _, dialect := range []struct{ kind, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.kind, func(t *testing.T) {
			if dialect.env != "" && os.Getenv(dialect.env) == "" {
				t.Skip("set " + dialect.env + " to run this database")
			}
			db := modelManagementDB(t, dialect.kind, os.Getenv(dialect.env))
			previousGroups := setting.UserUsableGroups2JSONString()
			previousRatios := ratio_setting.GroupRatio2JSONString()
			require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
			require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1}`))
			t.Cleanup(func() {
				require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousGroups))
				require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousRatios))
			})
			channel := model.Channel{Id: 2, Name: "backup", Type: 1, Key: "test-only", Status: common.ChannelStatusEnabled, Models: "retry-test", Group: "vip"}
			require.NoError(t, db.Create(&channel).Error)
			require.NoError(t, channel.AddAbilities(db))
			selectionErr := errors.New("test group selection failure")
			require.NoError(t, db.Callback().Query().After("gorm:query").Register("test:group_selection_failure", func(tx *gorm.DB) {
				if tx.Statement.Table == "abilities" && slices.ContainsFunc(tx.Statement.Vars, func(value any) bool { return value == "default" }) {
					tx.AddError(selectionErr)
				}
			}))
			t.Cleanup(func() { require.NoError(t, db.Callback().Query().Remove("test:group_selection_failure")) })
			for _, used := range [][]string{nil, {"1"}} {
				for _, tc := range []struct {
					name, group string
					autoGroups  []string
					wantID      int
					wantError   bool
				}{
					{"auto_fallback", "auto", []string{"default", "vip"}, 2, false},
					{"auto_exhausted", "auto", []string{"default"}, 0, false},
					{"fixed_group", "default", nil, 0, true},
				} {
					t.Run(fmt.Sprintf("%s/used=%v", tc.name, used), func(t *testing.T) {
						c := newPinRetryContext()
						c.Set("use_channel", used)
						common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
						common.SetContextKey(c, constant.ContextKeyTokenAutoGroups, tc.autoGroups)
						param := &service.RetryParam{Ctx: c, TokenGroup: tc.group, ModelName: "retry-test", Retry: common.GetPointer(1)}
						selected, group, err := service.CacheGetRandomSatisfiedChannel(param)
						if tc.wantError {
							require.ErrorIs(t, err, selectionErr)
							assert.Nil(t, selected)
							return
						}
						require.NoError(t, err)
						if tc.wantID == 0 {
							assert.Nil(t, selected)
							return
						}
						require.NotNil(t, selected)
						assert.Equal(t, tc.wantID, selected.Id)
						assert.Equal(t, "vip", group)
						assert.Equal(t, 0, param.GetRetry(), "skipping an unavailable group resets its retry count")
					})
				}
			}
		})
	}
}
