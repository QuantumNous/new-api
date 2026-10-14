package controller

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
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

func TestManagedPreselectedAttemptsSkipRouteLookupWhenOrchestrationDisabled(t *testing.T) {
	for _, surface := range []string{"http", "task"} {
		t.Run(surface, func(t *testing.T) {
			events := []string{}
			db := setupTaskSubmissionDatabase(t, true, &events, &model.UpstreamManagedRoute{})
			require.NoError(t, db.Create(&model.UpstreamManagedRoute{
				SourceID:        41,
				ExternalGroupID: "disabled-preselected",
				Platform:        "openai",
				Protocol:        model.UpstreamProtocolOpenAI,
				ChannelID:       7801,
				State:           model.UpstreamRouteStateActive,
			}).Error)
			updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
				setting.Enabled = false
			})
			previousRetries := common.RetryTimes
			previousErrorLog := constant.ErrorLogEnabled
			common.RetryTimes = 0
			constant.ErrorLogEnabled = false
			t.Cleanup(func() {
				common.RetryTimes = previousRetries
				constant.ErrorLogEnabled = previousErrorLog
			})

			routeQueries, schemaQueries := 0, 0
			const queryCallback = "test:disabled_preselected_route_query"
			require.NoError(t, db.Callback().Query().After("gorm:query").Register(queryCallback, func(tx *gorm.DB) {
				if tx.Statement.Table == "upstream_managed_routes" ||
					strings.HasSuffix(tx.Statement.Table, "_upstream_managed_routes") ||
					strings.Contains(tx.Statement.SQL.String(), "upstream_managed_routes") {
					routeQueries++
				}
			}))
			const rowCallback = "test:disabled_preselected_schema_query"
			require.NoError(t, db.Callback().Row().After("gorm:row").Register(rowCallback, func(tx *gorm.DB) {
				if strings.Contains(tx.Statement.SQL.String(), "upstream_managed_routes") {
					schemaQueries++
				}
			}))
			t.Cleanup(func() {
				require.NoError(t, db.Callback().Query().Remove(queryCallback))
				require.NoError(t, db.Callback().Row().Remove(rowCallback))
			})

			c := taskSubmissionTestContext()
			c.Set("channel_id", 7801)
			c.Set("channel_type", constant.ChannelTypeOpenAI)
			c.Set("channel_name", "disabled-preselected")
			c.Set("channel_priority", int64(10))
			c.Set("auto_ban", false)
			info := taskSubmissionRelayInfo(nil)
			info.ChannelMeta = nil
			info.LockedChannel = nil
			retry := &service.RetryParam{
				Ctx: c, TokenGroup: "default", ModelName: "plugin-model",
				RequestPath: c.Request.URL.Path, Retry: common.GetPointer(0),
			}

			if surface == "http" {
				selected, channelErr := getChannel(c, info, retry)
				require.Nil(t, channelErr)
				require.NotNil(t, selected)
			} else {
				outcome, taskErr := executeTaskSubmissionWith(c, info, func(
					*gin.Context,
					*relaycommon.RelayInfo,
				) (*relay.TaskSubmitResult, *dto.TaskError) {
					return nil, service.TaskErrorWrapperLocal(
						errors.New("terminal local rejection"),
						"terminal_local_rejection",
						http.StatusBadRequest,
					)
				})
				assert.Nil(t, outcome)
				require.NotNil(t, taskErr)
			}

			if surface == "http" {
				assert.Empty(t, retry.AttemptedChannelIDs)
				assert.Empty(t, retry.AttemptedSourceIDs)
			} else {
				assert.Equal(t, []string{"7801"}, c.GetStringSlice("use_channel"))
			}
			assert.Zero(t, routeQueries)
			assert.Zero(t, schemaQueries)
		})
	}

	t.Run("enabled managed records initial source without schema probe", func(t *testing.T) {
		events := []string{}
		db := setupTaskSubmissionDatabase(t, true, &events, &model.UpstreamManagedRoute{})
		require.NoError(t, db.Create(&model.UpstreamManagedRoute{
			SourceID:        42,
			ExternalGroupID: "enabled-preselected",
			Platform:        "openai",
			Protocol:        model.UpstreamProtocolOpenAI,
			ChannelID:       7802,
			State:           model.UpstreamRouteStateActive,
		}).Error)
		updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
			setting.Enabled = true
		})

		routeQueries, schemaQueries := 0, 0
		const queryCallback = "test:enabled_preselected_route_query"
		require.NoError(t, db.Callback().Query().After("gorm:query").Register(queryCallback, func(tx *gorm.DB) {
			if tx.Statement.Table == "upstream_managed_routes" ||
				strings.HasSuffix(tx.Statement.Table, "_upstream_managed_routes") ||
				strings.Contains(tx.Statement.SQL.String(), "upstream_managed_routes") {
				routeQueries++
			}
		}))
		const rowCallback = "test:enabled_preselected_schema_query"
		require.NoError(t, db.Callback().Row().After("gorm:row").Register(rowCallback, func(tx *gorm.DB) {
			if strings.Contains(tx.Statement.SQL.String(), "upstream_managed_routes") {
				schemaQueries++
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Query().Remove(queryCallback))
			require.NoError(t, db.Callback().Row().Remove(rowCallback))
		})

		c := taskSubmissionTestContext()
		c.Set("channel_id", 7802)
		c.Set("channel_type", constant.ChannelTypeOpenAI)
		c.Set("channel_name", "enabled-preselected")
		c.Set("channel_priority", int64(10))
		c.Set("auto_ban", false)
		info := taskSubmissionRelayInfo(nil)
		info.ChannelMeta = nil
		info.LockedChannel = nil
		retry := &service.RetryParam{
			Ctx: c, TokenGroup: "default", ModelName: "plugin-model",
			RequestPath: c.Request.URL.Path, Retry: common.GetPointer(0),
		}

		selected, channelErr := getChannel(c, info, retry)

		require.Nil(t, channelErr)
		require.NotNil(t, selected)
		assert.Equal(t, []int{7802}, retry.AttemptedChannelIDs)
		assert.Equal(t, []int64{42}, retry.AttemptedSourceIDs)
		assert.Equal(t, 1, routeQueries)
		assert.Zero(t, schemaQueries)
	})
}

func TestHTTPAndWebSocketChannelErrorRetryDecisionsMatch(t *testing.T) {
	db := modelManagementDB(t, "sqlite", "")
	require.NoError(t, db.AutoMigrate(&model.UpstreamManagedRoute{}))
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.Enabled = true
	})
	const managedChannelID = 7711
	require.NoError(t, db.Create(&model.UpstreamManagedRoute{
		SourceID:        1,
		ExternalGroupID: "http-ws-pin-parity",
		Platform:        "openai",
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       managedChannelID,
		State:           model.UpstreamRouteStateActive,
	}).Error)
	channelErr := types.NewError(
		errors.New("channel failed"),
		types.ErrorCodeChannelNoAvailableKey,
	)

	for _, test := range []struct {
		name      string
		channelID int
		pinned    bool
		wantRetry bool
	}{
		{name: "pinned managed", channelID: managedChannelID, pinned: true},
		{name: "pinned unmanaged", channelID: 7712, pinned: true},
		{name: "unpinned managed", channelID: managedChannelID, wantRetry: true},
		{name: "unpinned unmanaged", channelID: 7712, wantRetry: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			c := newPinRetryContext()
			c.Set("channel_id", test.channelID)
			if test.pinned {
				service.GetChannelConstraints(c).AddPin(dto.ChannelPin{
					ChannelId: test.channelID,
					Source:    dto.PinSourceToken,
					Rank:      dto.PinRankToken,
					RetryMode: dto.PinRetrySingleAttempt,
				})
			}

			httpRetry, replacement := retryDecision(c, channelErr, 1)
			wsDecision := service.DecideRelayRetry(c, channelErr, 1)

			assert.Equal(t, test.wantRetry, httpRetry)
			assert.Nil(t, replacement)
			assert.Equal(t, wsDecision.Action == "retry", httpRetry)
		})
	}
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

func TestShouldRetryStopsAfterGeminiLiveSetupForwarded(t *testing.T) {
	upstreamError := types.NewOpenAIError(
		errors.New("upstream disconnected"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusInternalServerError,
	)
	c := newPinRetryContext()
	assert.True(t, shouldRetry(c, upstreamError, 1))

	common.SetContextKey(c, constant.ContextKeyRealtimeSetupForwarded, true)
	assert.False(t, shouldRetry(c, upstreamError, 1))
}

func TestShouldRefundFailedRelayPreservesUncertainRealtimeSettlement(t *testing.T) {
	c := newPinRetryContext()
	assert.True(t, shouldRefundFailedRelay(c))

	c.Set("realtime_settlement_uncertain", true)
	assert.False(t, shouldRefundFailedRelay(c))
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
