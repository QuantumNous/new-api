package service

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/cachex"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/samber/hot"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func buildChannelAffinityTemplateContextForTest(meta channelAffinityMeta) *gin.Context {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	setChannelAffinityContext(ctx, meta)
	return ctx
}

func TestApplyChannelAffinityOverrideTemplate_NoTemplate(t *testing.T) {
	ctx := buildChannelAffinityTemplateContextForTest(channelAffinityMeta{
		RuleName: "rule-no-template",
	})
	base := map[string]any{
		"temperature": 0.7,
	}

	merged, applied := ApplyChannelAffinityOverrideTemplate(ctx, base)
	require.False(t, applied)
	require.Equal(t, base, merged)
}

func TestApplyChannelAffinityOverrideTemplate_MergeTemplate(t *testing.T) {
	ctx := buildChannelAffinityTemplateContextForTest(channelAffinityMeta{
		RuleName: "rule-with-template",
		ParamTemplate: map[string]any{
			"temperature": 0.2,
			"top_p":       0.95,
		},
		UsingGroup:     "default",
		ModelName:      "gpt-4.1",
		RequestPath:    "/v1/responses",
		KeySourceType:  "gjson",
		KeySourcePath:  "prompt_cache_key",
		KeyHint:        "abcd...wxyz",
		KeyFingerprint: "abcd1234",
	})
	base := map[string]any{
		"temperature": 0.7,
		"max_tokens":  2000,
	}

	merged, applied := ApplyChannelAffinityOverrideTemplate(ctx, base)
	require.True(t, applied)
	require.Equal(t, 0.7, merged["temperature"])
	require.Equal(t, 0.95, merged["top_p"])
	require.Equal(t, 2000, merged["max_tokens"])
	require.Equal(t, 0.7, base["temperature"])

	anyInfo, ok := ctx.Get(ginKeyChannelAffinityLogInfo)
	require.True(t, ok)
	info, ok := anyInfo.(map[string]any)
	require.True(t, ok)
	overrideInfoAny, ok := info["override_template"]
	require.True(t, ok)
	overrideInfo, ok := overrideInfoAny.(map[string]any)
	require.True(t, ok)
	require.Equal(t, true, overrideInfo["applied"])
	require.Equal(t, "rule-with-template", overrideInfo["rule_name"])
	require.EqualValues(t, 2, overrideInfo["param_override_keys"])
}

func TestApplyChannelAffinityOverrideTemplate_MergeOperations(t *testing.T) {
	ctx := buildChannelAffinityTemplateContextForTest(channelAffinityMeta{
		RuleName: "rule-with-ops-template",
		ParamTemplate: map[string]any{
			"operations": []map[string]any{
				{
					"mode":  "pass_headers",
					"value": []string{"Originator"},
				},
			},
		},
	})
	base := map[string]any{
		"temperature": 0.7,
		"operations": []map[string]any{
			{
				"path":  "model",
				"mode":  "trim_prefix",
				"value": "openai/",
			},
		},
	}

	merged, applied := ApplyChannelAffinityOverrideTemplate(ctx, base)
	require.True(t, applied)
	require.Equal(t, 0.7, merged["temperature"])

	opsAny, ok := merged["operations"]
	require.True(t, ok)
	ops, ok := opsAny.([]any)
	require.True(t, ok)
	require.Len(t, ops, 2)

	firstOp, ok := ops[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "pass_headers", firstOp["mode"])

	secondOp, ok := ops[1].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "trim_prefix", secondOp["mode"])
}

func TestShouldSkipRetryAfterChannelAffinityFailure(t *testing.T) {
	tests := []struct {
		name string
		ctx  func() *gin.Context
		want bool
	}{
		{
			name: "nil context",
			ctx: func() *gin.Context {
				return nil
			},
			want: false,
		},
		{
			name: "explicit skip retry flag in context",
			ctx: func() *gin.Context {
				ctx := buildChannelAffinityTemplateContextForTest(channelAffinityMeta{
					RuleName:   "rule-explicit-flag",
					SkipRetry:  false,
					UsingGroup: "default",
					ModelName:  "gpt-5",
				})
				ctx.Set(ginKeyChannelAffinitySkipRetry, true)
				return ctx
			},
			want: true,
		},
		{
			name: "fallback to matched rule meta",
			ctx: func() *gin.Context {
				return buildChannelAffinityTemplateContextForTest(channelAffinityMeta{
					RuleName:   "rule-skip-retry",
					SkipRetry:  true,
					UsingGroup: "default",
					ModelName:  "gpt-5",
				})
			},
			want: true,
		},
		{
			name: "no flag and no skip retry meta",
			ctx: func() *gin.Context {
				return buildChannelAffinityTemplateContextForTest(channelAffinityMeta{
					RuleName:   "rule-no-skip-retry",
					SkipRetry:  false,
					UsingGroup: "default",
					ModelName:  "gpt-5",
				})
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, ShouldSkipRetryAfterChannelAffinityFailure(tt.ctx()))
		})
	}
}

func TestExtractChannelAffinityValue_RequestHeader(t *testing.T) {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	ctx.Request.Header.Set("X-Affinity-Key", " tenant-123 ")

	value := extractChannelAffinityValue(ctx, operation_setting.ChannelAffinityKeySource{
		Type: "request_header",
		Key:  "X-Affinity-Key",
	})

	require.Equal(t, "tenant-123", value)
}

func TestGetPreferredChannelByAffinity_RequestHeaderKeySource(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rule := operation_setting.ChannelAffinityRule{
		Name:       "header-affinity",
		ModelRegex: []string{"^gpt-.*$"},
		PathRegex:  []string{"/v1/responses"},
		KeySources: []operation_setting.ChannelAffinityKeySource{
			{Type: "request_header", Key: "X-Affinity-Key"},
		},
		IncludeRuleName:  true,
		IncludeModelName: true,
	}

	affinityValue := fmt.Sprintf("header-hit-%d", time.Now().UnixNano())
	cacheKeySuffix := buildChannelAffinityCacheKeySuffix(rule, "gpt-5", "default", affinityValue)

	cache := getChannelAffinityCache()
	require.NoError(t, cache.SetWithTTL(cacheKeySuffix, 9528, time.Minute))
	t.Cleanup(func() {
		_, _ = cache.DeleteMany([]string{cacheKeySuffix})
	})

	setting := operation_setting.GetChannelAffinitySetting()
	originalRules := setting.Rules
	setting.Rules = append([]operation_setting.ChannelAffinityRule{rule}, originalRules...)
	t.Cleanup(func() {
		setting.Rules = originalRules
	})

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	ctx.Request.Header.Set("X-Affinity-Key", affinityValue)

	channelID, found := GetPreferredChannelByAffinity(ctx, "gpt-5", "default")
	require.True(t, found)
	require.Equal(t, 9528, channelID)

	meta, ok := getChannelAffinityMeta(ctx)
	require.True(t, ok)
	require.Equal(t, "request_header", meta.KeySourceType)
	require.Equal(t, "X-Affinity-Key", meta.KeySourceKey)
	require.Equal(t, buildChannelAffinityKeyHint(affinityValue), meta.KeyHint)
}

func TestClearCurrentChannelAffinityCache(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cacheKeySuffix := fmt.Sprintf("codex cli trace:default:clear-current-%d", time.Now().UnixNano())
	cacheKeyFull := channelAffinityCacheNamespace + ":" + cacheKeySuffix
	cache := getChannelAffinityCache()
	require.NoError(t, cache.SetWithTTL(cacheKeySuffix, 9527, time.Minute))
	t.Cleanup(func() {
		_, _ = cache.DeleteMany([]string{cacheKeySuffix})
	})

	ctx := buildChannelAffinityTemplateContextForTest(channelAffinityMeta{
		CacheKey:   cacheKeyFull,
		TTLSeconds: 60,
		RuleName:   "codex cli trace",
		SkipRetry:  true,
	})
	require.True(t, ShouldSkipRetryAfterChannelAffinityFailure(ctx))

	deleted := ClearCurrentChannelAffinityCache(ctx)
	require.True(t, deleted)
	_, found, err := cache.Get(cacheKeySuffix)
	require.NoError(t, err)
	require.False(t, found)
	require.False(t, ShouldSkipRetryAfterChannelAffinityFailure(ctx))
}

func TestChannelAffinityHitCodexTemplatePassHeadersEffective(t *testing.T) {
	gin.SetMode(gin.TestMode)

	setting := operation_setting.GetChannelAffinitySetting()
	require.NotNil(t, setting)

	var codexRule *operation_setting.ChannelAffinityRule
	for i := range setting.Rules {
		rule := &setting.Rules[i]
		if strings.EqualFold(strings.TrimSpace(rule.Name), "codex cli trace") {
			codexRule = rule
			break
		}
	}
	require.NotNil(t, codexRule)

	affinityValue := fmt.Sprintf("pc-hit-%d", time.Now().UnixNano())
	cacheKeySuffix := buildChannelAffinityCacheKeySuffix(*codexRule, "gpt-5", "default", affinityValue)

	cache := getChannelAffinityCache()
	require.NoError(t, cache.SetWithTTL(cacheKeySuffix, 9527, time.Minute))
	t.Cleanup(func() {
		_, _ = cache.DeleteMany([]string{cacheKeySuffix})
	})

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(fmt.Sprintf(`{"prompt_cache_key":"%s"}`, affinityValue)))
	ctx.Request.Header.Set("Content-Type", "application/json")

	channelID, found := GetPreferredChannelByAffinity(ctx, "gpt-5", "default")
	require.True(t, found)
	require.Equal(t, 9527, channelID)

	baseOverride := map[string]any{
		"temperature": 0.2,
	}
	mergedOverride, applied := ApplyChannelAffinityOverrideTemplate(ctx, baseOverride)
	require.True(t, applied)
	require.Equal(t, 0.2, mergedOverride["temperature"])

	info := &relaycommon.RelayInfo{
		RequestHeaders: map[string]string{
			"Originator": "Codex CLI",
			"Session_id": "sess-123",
			"User-Agent": "codex-cli-test",
		},
		ChannelMeta: &relaycommon.ChannelMeta{
			ParamOverride: mergedOverride,
			HeadersOverride: map[string]any{
				"X-Static": "legacy-static",
			},
		},
	}

	_, err := relaycommon.ApplyParamOverrideWithRelayInfo([]byte(`{"model":"gpt-5"}`), info)
	require.NoError(t, err)
	require.True(t, info.UseRuntimeHeadersOverride)

	require.Equal(t, "legacy-static", info.RuntimeHeadersOverride["x-static"])
	require.Equal(t, "Codex CLI", info.RuntimeHeadersOverride["originator"])
	require.Equal(t, "sess-123", info.RuntimeHeadersOverride["session_id"])
	require.Equal(t, "codex-cli-test", info.RuntimeHeadersOverride["user-agent"])

	_, exists := info.RuntimeHeadersOverride["x-codex-beta-features"]
	require.False(t, exists)
	_, exists = info.RuntimeHeadersOverride["x-codex-turn-metadata"]
	require.False(t, exists)
}

func TestMidjourneyPolicyAcceptance(t *testing.T) {
	for _, tc := range []struct {
		name       string
		status     int
		code       int
		properties map[string]any
		requestErr error
		accepted   bool
		reason     string
	}{
		{name: "submitted", status: 200, code: 1, accepted: true},
		{name: "existing task", status: 200, code: 21, accepted: true},
		{name: "queued", status: 200, code: 22, accepted: true},
		{name: "HTTP 200 with rejected prompt", status: 200, code: 24, reason: "non_retryable_error"},
		{name: "failed existing task", status: 200, code: 21, properties: map[string]any{"status": "FAILURE"}, reason: "task_accepted"},
		{name: "HTTP failure", status: 502, code: 1, reason: "non_retryable_error"},
		{name: "ambiguous transport failure", status: 502, requestErr: errors.New("connection reset"), reason: "non_retryable_error"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/mj/submit/imagine", strings.NewReader(`{}`))
			ctx.Set("channel_id", 7)
			state := RequestPolicy(ctx)
			state.BeginAttempt(&model.Channel{Id: 7}, "default")
			response := &dto.MidjourneyResponseWithStatusCode{StatusCode: tc.status, Response: dto.MidjourneyResponse{Code: tc.code, Properties: tc.properties}}
			accepted := RecordMidjourneyPolicyResponse(ctx, response, tc.requestErr)
			assert.Equal(t, tc.accepted, accepted)
			assert.False(t, state.Successful, "acceptance alone must not bind before local processing finishes")
			if accepted {
				MarkRequestPolicySuccess(ctx, nil)
				assert.True(t, state.Successful)
				return
			}
			events := state.Events()
			require.Len(t, events, 3)
			assert.Equal(t, PolicyDecision{Action: "failure", Reason: "upstream_failure", Source: "upstream"}, events[1].Decision)
			assert.Equal(t, tc.status, events[1].Status)
			assert.Equal(t, PolicyDecision{Action: "stop", Reason: tc.reason, Source: "system"}, events[2].Decision, "submissions are never replayed")
		})
	}
}

func TestSessionRulesInheritOrOverrideGlobalDefault(t *testing.T) {
	setting := operation_setting.GetChannelAffinitySetting()
	previous := *setting
	t.Cleanup(func() { *setting = previous })
	for _, globalMode := range []string{"", "off", "prefer", "strict"} {
		for _, tc := range []struct {
			name, mode, expected string
			skipRetry            bool
		}{
			{name: "inherit", mode: "inherit", expected: globalMode},
			{name: "override-strict", mode: "strict", expected: "strict"},
			{name: "override-prefer", mode: "prefer", expected: "prefer", skipRetry: true},
			{name: "override-off", mode: "off", expected: "off", skipRetry: true},
			{name: "legacy-strict", expected: "strict", skipRetry: true},
			{name: "legacy-prefer", expected: "prefer"},
		} {
			t.Run(globalMode+"/"+tc.name, func(t *testing.T) {
				expected := tc.expected
				if expected == "" {
					expected = "prefer"
				}
				source := "session_rule"
				if tc.mode == "inherit" {
					source = "global"
				}
				rule := operation_setting.ChannelAffinityRule{
					Name: tc.name, ModelRegex: []string{"^test-model$"},
					KeySources:  []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Session"}},
					SessionMode: tc.mode, SkipRetryOnFailure: tc.skipRetry,
					ParamOverrideTemplate: map[string]any{"temperature": 0}, IncludeRuleName: true,
				}
				encoded, err := common.Marshal([]operation_setting.ChannelAffinityRule{rule})
				require.NoError(t, err)
				snapshot, err := model.BuildRequestPolicy(map[string]string{"RetryTimes": "2", "channel_affinity_setting.enabled": "true", "channel_affinity_setting.session_mode": globalMode, "channel_affinity_setting.rules": string(encoded)})
				require.NoError(t, err)
				*setting = snapshot.Affinity
				key := t.Name()
				cacheKey := buildChannelAffinityCacheKeySuffix(rule, "test-model", "default", key)
				cache := getChannelAffinityCache()
				require.NoError(t, cache.SetWithTTL(cacheKey, 1, time.Minute))
				t.Cleanup(func() { _, err := cache.DeleteMany([]string{cacheKey}); assert.NoError(t, err) })
				ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
				ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
				ctx.Request.Header.Set("X-Session", key)
				state := RequestPolicy(ctx)
				channelID, found := GetPreferredChannelByAffinity(ctx, "test-model", "default")
				assert.Equal(t, expected != "off", found)
				if found {
					assert.Equal(t, 1, channelID)
				}
				assert.Equal(t, expected, state.SessionMode)
				assert.Equal(t, source, state.SessionModeSource)
				assert.Equal(t, expected == "strict", ShouldSkipRetryAfterChannelAffinityFailure(ctx))
				decision := DecideRelayRetry(ctx, types.NewOpenAIError(errors.New("upstream"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests), 2)
				if expected == "strict" {
					assert.Equal(t, PolicyDecision{Action: "stop", Reason: "strict_session", Source: source}, decision)
				} else {
					assert.Equal(t, "retry", decision.Action)
				}
				events := state.Events()
				require.Len(t, events, 1)
				assert.Equal(t, PolicyDecision{Action: "match", Reason: "session_rule_matched", Source: "session_rule"}, events[0].Decision)
				assert.Equal(t, tc.name, events[0].Rule)
				transformed, applied := ApplyChannelAffinityOverrideTemplate(ctx, nil)
				assert.True(t, applied, "session behavior does not disable request transforms")
				assert.EqualValues(t, 0, transformed["temperature"])
				if expected == "off" {
					ctx.Set("channel_id", 9)
					RecordChannelAffinity(ctx, 9)
					cached, found, err := cache.Get(cacheKey)
					require.NoError(t, err)
					assert.True(t, found)
					assert.Equal(t, 1, cached, "off does not refresh session bindings")
					_, err = cache.DeleteMany([]string{cacheKey})
					require.NoError(t, err)
					RecordChannelAffinity(ctx, 9)
					_, found, err = cache.Get(cacheKey)
					require.NoError(t, err)
					assert.False(t, found, "off does not establish session bindings")
				}
			})
		}
	}
}

// The observer runs at the exact point headers become client-visible, before
// the handler returns or performs any simulated cleanup.
type affinityObservingRecorder struct {
	*httptest.ResponseRecorder
	observe      func()
	observeWrite func()
}

func (r *affinityObservingRecorder) WriteHeader(status int) {
	if r.observe != nil {
		r.observe()
	}
	r.ResponseRecorder.WriteHeader(status)
}

func (r *affinityObservingRecorder) Write(data []byte) (int, error) {
	if r.observeWrite != nil {
		r.observeWrite()
	}
	return r.ResponseRecorder.Write(data)
}

func (r *affinityObservingRecorder) WriteString(data string) (int, error) {
	return r.Write([]byte(data))
}

// TestChannelAffinityBeforeResponseVisible checks binding before headers and body reach the client.
func TestChannelAffinityBeforeResponseVisible(t *testing.T) {
	setting := operation_setting.GetChannelAffinitySetting()
	previous := *setting
	setting.Enabled, setting.SwitchOnSuccess = true, true
	t.Cleanup(func() { *setting = previous })
	for _, method := range []string{"write", "string", "flush", "headers", "error"} {
		t.Run(method, func(t *testing.T) {
			key := t.Name()
			cache := getChannelAffinityCache()
			t.Cleanup(func() { _, err := cache.DeleteMany([]string{key}); assert.NoError(t, err) })
			seen := false
			recorder := &affinityObservingRecorder{ResponseRecorder: httptest.NewRecorder()}
			recorder.observe = func() {
				seen = true
				bound, found, err := cache.Get(key)
				require.NoError(t, err)
				if method == "error" {
					assert.False(t, found)
					return
				}
				assert.True(t, found)
				assert.Equal(t, 22, bound, "successful retry must be bound before response headers")
			}
			ctx, _ := gin.CreateTestContext(recorder)
			setChannelAffinityContext(ctx, channelAffinityMeta{CacheKey: key, TTLSeconds: 60})
			ctx.Set("channel_id", 22)
			BindChannelAffinityResponse(ctx, 11)
			switch method {
			case "write":
				_, err := ctx.Writer.Write([]byte("result"))
				require.NoError(t, err)
			case "string":
				_, err := ctx.Writer.WriteString("result")
				require.NoError(t, err)
			case "flush":
				ctx.Writer.Flush()
			case "headers":
				ctx.Writer.WriteHeader(http.StatusNoContent)
				ctx.Writer.WriteHeaderNow()
			case "error":
				ctx.Writer.WriteHeader(http.StatusBadRequest)
				_, err := ctx.Writer.WriteString("error")
				require.NoError(t, err)
			}
			assert.True(t, seen)
			// No late completion write may overwrite a newer binding.
			require.NoError(t, cache.SetWithTTL(key, 33, time.Minute))
			ctx.Writer.Flush()
			bound, found, err := cache.Get(key)
			require.NoError(t, err)
			assert.True(t, found)
			assert.Equal(t, 33, bound)
		})
	}
}

// TestConcurrentChannelAffinityReservation elects one channel and preserves newer cache values.
func TestConcurrentChannelAffinityReservation(t *testing.T) {
	for _, backend := range []string{"memory", "redis"} {
		t.Run(backend, func(t *testing.T) {
			var client *redis.Client
			if backend == "redis" {
				server := miniredis.RunT(t)
				client = redis.NewClient(&redis.Options{Addr: server.Addr()})
				t.Cleanup(func() { assert.NoError(t, client.Close()) })
			}
			config := cachex.HybridCacheConfig[int]{
				Namespace: "affinity-test", Redis: client, RedisCodec: cachex.IntCodec{},
				Memory: func() *hot.HotCache[string, int] { return hot.NewHotCache[string, int](hot.LRU, 10).Build() },
			}
			caches := []*cachex.HybridCache[int]{cachex.NewHybridCache(config), cachex.NewHybridCache(config)}
			if backend == "memory" {
				caches[1] = caches[0]
			}
			start := make(chan struct{})
			results := make(chan int, 2)
			failures := make(chan error, 2)
			var workers sync.WaitGroup
			for i := range 2 {
				workers.Go(func() {
					<-start
					winner, err := caches[i].GetOrSetWithTTL("session", i+1, time.Minute)
					failures <- err
					results <- winner
				})
			}
			close(start)
			workers.Wait()
			require.NoError(t, <-failures)
			require.NoError(t, <-failures)
			first, second := <-results, <-results
			assert.Equal(t, first, second)
			continued, err := caches[1].GetOrSetWithTTL("session", 3, time.Minute)
			require.NoError(t, err)
			assert.Equal(t, first, continued)
			// Simulate two requests that both observed an obsolete binding.
			deleted, err := caches[0].CompareAndDelete("session", first)
			require.NoError(t, err)
			require.True(t, deleted)
			replacement, err := caches[0].GetOrSetWithTTL("session", 3, time.Minute)
			require.NoError(t, err)
			assert.Equal(t, 3, replacement)
			deleted, err = caches[1].CompareAndDelete("session", first)
			require.NoError(t, err)
			assert.False(t, deleted, "stale cleanup must not delete the replacement")
			continued, err = caches[1].GetOrSetWithTTL("session", 4, time.Minute)
			require.NoError(t, err)
			assert.Equal(t, 3, continued)
		})
	}
}

// TestChannelAffinitySelectionReservesBeforeDispatch checks reservation before upstream work.
func TestChannelAffinitySelectionReservesBeforeDispatch(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	createChannelSelectAutoGroupsChannel(t, db, 2101, "default", "affinity-model")
	createChannelSelectAutoGroupsChannel(t, db, 2102, "default", "affinity-model")
	model.InitChannelCache()
	setting := operation_setting.GetChannelAffinitySetting()
	previous := *setting
	*setting = operation_setting.ChannelAffinitySetting{Enabled: true, DefaultTTLSeconds: 60, Rules: []operation_setting.ChannelAffinityRule{{
		Name: "race", ModelRegex: []string{"^affinity-model$"}, SessionMode: "strict",
		KeySources: []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Session"}},
	}}}
	t.Cleanup(func() {
		*setting = previous
		_, err := getChannelAffinityCache().DeleteMany([]string{t.Name()})
		assert.NoError(t, err)
	})
	var contexts []*gin.Context
	for range 2 {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
		ctx.Request.Header.Set("X-Session", t.Name())
		contexts = append(contexts, ctx)
	}
	first, _, selectErr := SelectChannelForRequest(contexts[0], "affinity-model", &RetryParam{Ctx: contexts[0], TokenGroup: "default", ModelName: "affinity-model"})
	require.Nil(t, selectErr)
	require.NotNil(t, first)
	// The first request has not contacted upstream or written any response yet.
	second, _, selectErr := SelectChannelForRequest(contexts[1], "affinity-model", &RetryParam{Ctx: contexts[1], TokenGroup: "default", ModelName: "affinity-model"})
	require.Nil(t, selectErr)
	require.NotNil(t, second)
	assert.Equal(t, first.Id, second.Id)
}

// TestChannelAffinityCacheFailureDoesNotExposeSuccess rejects output when binding storage fails.
func TestChannelAffinityCacheFailureDoesNotExposeSuccess(t *testing.T) {
	setting := operation_setting.GetChannelAffinitySetting()
	previous := *setting
	setting.Enabled = true
	t.Cleanup(func() { *setting = previous })
	getChannelAffinityCache()
	previousCache := channelAffinityCache
	t.Cleanup(func() { channelAffinityCache = previousCache })
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	require.NoError(t, client.Close()) // deterministic failure, without network timeouts
	channelAffinityCache = cachex.NewHybridCache(cachex.HybridCacheConfig[int]{Namespace: "affinity-failure", Redis: client, RedisCodec: cachex.IntCodec{}})
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	setChannelAffinityContext(ctx, channelAffinityMeta{CacheKey: "session", TTLSeconds: 60})
	ctx.Set(ginKeyChannelAffinityMissing, true)
	_, err := reserveChannelAffinity(ctx, 1)
	require.Error(t, err)
	BindChannelAffinityResponse(ctx, 1)
	_, err = ctx.Writer.WriteString("encrypted result")
	require.Error(t, err)
	ctx.Writer.WriteHeaderNow()
	assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	assert.Empty(t, recorder.Body.String())
}

// TestChannelAffinityHeartbeatThenRetry binds retry data without treating keepalive as success.
func TestChannelAffinityHeartbeatThenRetry(t *testing.T) {
	setting := operation_setting.GetChannelAffinitySetting()
	previous := *setting
	setting.Enabled = true
	t.Cleanup(func() { *setting = previous })
	for _, switchOnSuccess := range []bool{true, false} {
		t.Run(fmt.Sprint(switchOnSuccess), func(t *testing.T) {
			setting.SwitchOnSuccess = switchOnSuccess
			recorder := &affinityObservingRecorder{ResponseRecorder: httptest.NewRecorder()}
			ctx, _ := gin.CreateTestContext(recorder)
			setChannelAffinityContext(ctx, channelAffinityMeta{CacheKey: t.Name(), TTLSeconds: 60})
			t.Cleanup(func() { _, err := getChannelAffinityCache().DeleteMany([]string{t.Name()}); assert.NoError(t, err) })
			ctx.Set("channel_id", 11)
			BindChannelAffinityResponse(ctx, 11)
			require.NoError(t, getChannelAffinityCache().SetWithTTL(t.Name(), 11, time.Minute))
			require.NoError(t, ctx.Writer.(interface{ WriteHeartbeat([]byte) error }).WriteHeartbeat([]byte(": PING\n\n")))
			ctx.Set("channel_id", 22) // first upstream failed; permitted retry succeeded
			expected := 11
			if switchOnSuccess {
				expected = 22
			}
			recorder.observeWrite = func() {
				bound, found, err := getChannelAffinityCache().Get(t.Name())
				require.NoError(t, err)
				assert.True(t, found)
				assert.Equal(t, expected, bound, "bind the retry before its data becomes visible")
			}
			_, err := ctx.Writer.WriteString("data: encrypted-result-from-22\n\n")
			require.NoError(t, err)
		})
	}
}

type affinityTransportRecorder struct {
	*httptest.ResponseRecorder
	flushErr error
}

func (w *affinityTransportRecorder) SetWriteDeadline(time.Time) error { return nil }
func (w *affinityTransportRecorder) FlushError() error                { return w.flushErr }

// TestChannelAffinityPreservesTransportControls preserves deadlines and flush errors.
func TestChannelAffinityPreservesTransportControls(t *testing.T) {
	transportErr := errors.New("transport flush failed")
	ctx, _ := gin.CreateTestContext(&affinityTransportRecorder{httptest.NewRecorder(), transportErr})
	require.NoError(t, http.NewResponseController(ctx.Writer).SetWriteDeadline(time.Now()))
	setChannelAffinityContext(ctx, channelAffinityMeta{CacheKey: t.Name(), TTLSeconds: 60})
	// Off keeps this test focused on forwarding the transport's error.
	RequestPolicy(ctx).SessionMode = "off"
	BindChannelAffinityResponse(ctx, 11)
	assert.NoError(t, http.NewResponseController(ctx.Writer).SetWriteDeadline(time.Now()))
	assert.ErrorIs(t, http.NewResponseController(ctx.Writer).Flush(), transportErr)
}

// TestChannelAffinityReservesAfterInvalidBinding reserves a replacement for an unusable channel.
func TestChannelAffinityReservesAfterInvalidBinding(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	createChannelSelectAutoGroupsChannel(t, db, 2101, "default", "affinity-review")
	model.InitChannelCache()
	setting := operation_setting.GetChannelAffinitySetting()
	previous := *setting
	*setting = operation_setting.ChannelAffinitySetting{Enabled: true, DefaultTTLSeconds: 60, Rules: []operation_setting.ChannelAffinityRule{{
		Name: "review", ModelRegex: []string{"^affinity-review$"}, SessionMode: "prefer",
		KeySources: []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Session"}},
	}}}
	t.Cleanup(func() {
		*setting = previous
		_, err := getChannelAffinityCache().DeleteMany([]string{t.Name()})
		assert.NoError(t, err)
	})
	require.NoError(t, getChannelAffinityCache().SetWithTTL(t.Name(), 9999, time.Minute))
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	ctx.Request.Header.Set("X-Session", t.Name())
	selected, _, selectErr := SelectChannelForRequest(ctx, "affinity-review", &RetryParam{Ctx: ctx, TokenGroup: "default", ModelName: "affinity-review"})
	require.Nil(t, selectErr)
	require.NotNil(t, selected)
	bound, found, err := getChannelAffinityCache().Get(t.Name())
	require.NoError(t, err)
	assert.True(t, found, "replacement must reserve before upstream dispatch")
	assert.Equal(t, selected.Id, bound)
}

// TestChannelAffinityCacheFailureAfterHeartbeat blocks retry data after a cache failure.
func TestChannelAffinityCacheFailureAfterHeartbeat(t *testing.T) {
	setting := operation_setting.GetChannelAffinitySetting()
	previous := *setting
	setting.Enabled, setting.SwitchOnSuccess = true, true
	t.Cleanup(func() { *setting = previous })
	getChannelAffinityCache()
	previousCache := channelAffinityCache
	t.Cleanup(func() { channelAffinityCache = previousCache })
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	channelAffinityCache = cachex.NewHybridCache(cachex.HybridCacheConfig[int]{Namespace: "affinity-failure", Redis: client, RedisCodec: cachex.IntCodec{}})
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	setChannelAffinityContext(ctx, channelAffinityMeta{CacheKey: "session", TTLSeconds: 60})
	ctx.Set("channel_id", 11)
	BindChannelAffinityResponse(ctx, 11)
	require.NoError(t, ctx.Writer.(interface{ WriteHeartbeat([]byte) error }).WriteHeartbeat([]byte(": PING\n\n")))
	require.NoError(t, client.Close())
	ctx.Set("channel_id", 22)
	require.Error(t, FinalizeChannelAffinityResponse(ctx), "empty retry finalization must report binding failure")
	_, err := ctx.Writer.WriteString("data: encrypted result\n\n")
	require.Error(t, err)
	require.Error(t, http.NewResponseController(ctx.Writer).Flush())
	assert.Equal(t, http.StatusOK, recorder.Code, "already committed headers cannot become 503")
	assert.Equal(t, ": PING\n\n", recorder.Body.String(), "never expose data from the unbound retry")
	status := relaycommon.NewStreamStatus()
	status.MarkFailed("session_binding_unavailable", "gateway_error", http.StatusServiceUnavailable)
	common.SetContextKey(ctx, constant.ContextKeyResponseStreamStatus, status)
	_, err = ctx.Writer.WriteString("event: error\ndata: binding unavailable\n\n")
	require.NoError(t, err)
	require.NoError(t, http.NewResponseController(ctx.Writer).Flush())
	assert.Contains(t, recorder.Body.String(), "event: error")
	assert.NotContains(t, recorder.Body.String(), "encrypted result")
	require.Error(t, FinalizeChannelAffinityResponse(ctx), "error delivery must not erase the binding failure")
}

// TestChannelAffinityLongStreamRenewsBinding restores expired bindings without overwriting newer ones.
func TestChannelAffinityLongStreamRenewsBinding(t *testing.T) {
	setting := operation_setting.GetChannelAffinitySetting()
	previous := *setting
	setting.Enabled, setting.SwitchOnSuccess = true, true
	getChannelAffinityCache()
	previousCache := channelAffinityCache
	t.Cleanup(func() { *setting = previous; channelAffinityCache = previousCache })
	synctest.Test(t, func(t *testing.T) {
		channelAffinityCache = cachex.NewHybridCache(cachex.HybridCacheConfig[int]{
			Namespace: "long-stream", RedisCodec: cachex.IntCodec{},
			Memory: func() *hot.HotCache[string, int] { return hot.NewHotCache[string, int](hot.LRU, 10).Build() },
		})
		recorder := &affinityObservingRecorder{ResponseRecorder: httptest.NewRecorder()}
		ctx, _ := gin.CreateTestContext(recorder)
		setChannelAffinityContext(ctx, channelAffinityMeta{CacheKey: "session", TTLSeconds: 60})
		ctx.Set("channel_id", 11)
		BindChannelAffinityResponse(ctx, 11)
		_, err := ctx.Writer.WriteString("data: started\n\n")
		require.NoError(t, err)
		// Fake time drives the writer's renewal interval. Hot uses a runtime
		// clock outside synctest, so expire its entry explicitly without waiting.
		time.Sleep(31 * time.Second)
		require.NoError(t, channelAffinityCache.SetWithTTL("session", 11, -time.Second))
		require.NoError(t, ctx.Writer.(interface{ WriteHeartbeat([]byte) error }).WriteHeartbeat([]byte(": PING\n\n")))
		time.Sleep(31 * time.Second)
		bound, found, err := channelAffinityCache.Get("session")
		require.NoError(t, err)
		require.True(t, found, "binding must outlive the initial response's TTL")
		assert.Equal(t, 11, bound)
		// A silent upstream can still exceed the renewed TTL. Restore the binding
		// atomically before forwarding its next event, including the final event.
		time.Sleep(time.Minute)
		require.NoError(t, channelAffinityCache.SetWithTTL("session", 11, -time.Second))
		_, found, err = channelAffinityCache.Get("session")
		require.NoError(t, err)
		require.False(t, found)
		recorder.observeWrite = func() {
			bound, found, err := channelAffinityCache.Get("session")
			require.NoError(t, err)
			assert.True(t, found)
			assert.Equal(t, 11, bound, "restore before the completion event is visible")
		}
		_, err = ctx.Writer.WriteString("data: completed\n\n")
		require.NoError(t, err)
		recorder.observeWrite = nil
		// A newer binding wins over this stream's subsequent renewal attempts.
		require.NoError(t, channelAffinityCache.SetWithTTL("session", 22, time.Minute))
		time.Sleep(31 * time.Second)
		require.NoError(t, ctx.Writer.(interface{ WriteHeartbeat([]byte) error }).WriteHeartbeat([]byte(": PING\n\n")))
		bound, found, err = channelAffinityCache.Get("session")
		require.NoError(t, err)
		require.True(t, found)
		assert.Equal(t, 22, bound)
		_, err = ctx.Writer.WriteString("data: stale encrypted result\n\n")
		require.ErrorContains(t, err, "binding changed")
		assert.NotContains(t, recorder.Body.String(), "stale encrypted result")
	})
}

// TestChannelAffinityRedisConditionalRenewal checks conditional Redis value and TTL updates.
func TestChannelAffinityRedisConditionalRenewal(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { assert.NoError(t, client.Close()) })
	cache := cachex.NewHybridCache(cachex.HybridCacheConfig[int]{Namespace: "renewal", Redis: client, RedisCodec: cachex.IntCodec{}})
	require.NoError(t, cache.SetWithTTL("session", 11, time.Minute))
	server.FastForward(31 * time.Second)
	refreshed, err := cache.RefreshOrSetWithTTL("session", 11, time.Minute)
	require.NoError(t, err)
	require.True(t, refreshed)
	assert.Equal(t, time.Minute, server.TTL(cache.FullKey("session")))
	server.FastForward(61 * time.Second)
	refreshed, err = cache.RefreshOrSetWithTTL("session", 11, time.Minute)
	require.NoError(t, err)
	require.True(t, refreshed, "expired entries are restored")
	require.NoError(t, cache.SetWithTTL("session", 22, time.Minute))
	server.FastForward(31 * time.Second)
	refreshed, err = cache.RefreshOrSetWithTTL("session", 11, time.Minute)
	require.NoError(t, err)
	assert.False(t, refreshed)
	bound, found, err := cache.Get("session")
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, 22, bound)
	assert.Equal(t, 29*time.Second, server.TTL(cache.FullKey("session")), "do not extend another channel's binding")
}
