package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestDistributeSkipsCoolingPreferredAffinityChannel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	model.ClearChannelCacheForTest()

	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		model.ClearChannelCacheForTest()
	})

	priority := int64(10)
	weight := uint(0)
	preferred := &model.Channel{Id: 17, Type: 1, Key: "key-17", Status: common.ChannelStatusEnabled, Name: "preferred", Weight: &weight, Priority: &priority, Models: "gpt-5.5", Group: "default"}
	fallback := &model.Channel{Id: 29, Type: 1, Key: "key-29", Status: common.ChannelStatusEnabled, Name: "fallback", Weight: &weight, Priority: &priority, Models: "gpt-5.5", Group: "default"}
	model.SetChannelCacheForTest(map[int]*model.Channel{17: preferred, 29: fallback}, map[string]map[string][]int{"default": {"gpt-5.5": {17, 29}}})
	model.CooldownChannel(17, "Insufficient account balance", time.Minute)
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
	})

	rule := operation_setting.ChannelAffinityRule{
		Name:            "cooling-affinity-test",
		ModelRegex:      []string{"^gpt-5\\.5$"},
		PathRegex:       []string{"/v1/responses"},
		KeySources:      []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Affinity-Key"}},
		IncludeRuleName: true,
	}
	affinityValue := "cooling-affinity-hit"
	cacheKeySuffix := service.BuildChannelAffinityCacheKeySuffixForTest(rule, "gpt-5.5", "default", affinityValue)
	cache := service.GetChannelAffinityCacheForTest()
	require.NoError(t, cache.SetWithTTL(cacheKeySuffix, 17, time.Minute))
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
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"gpt-5.5"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("X-Affinity-Key", affinityValue)
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")

	Distribute()(ctx)

	channelId, ok := common.GetContextKey(ctx, constant.ContextKeyChannelId)
	require.True(t, ok)
	require.Equal(t, 29, channelId)
	require.True(t, common.GetContextKeyBool(ctx, constant.ContextKeyAffinityColdStart), "leaving a cooled affinity must mark the fallback as a cold cache start")
}

func TestDistributeSkipsAffinityOnEnforcedSharedHostCircuit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	model.ClearChannelCacheForTest()
	model.ClearChannelHostCooldownsForTest()

	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldHostCircuitMode := common.UpstreamHostCircuitMode
	common.MemoryCacheEnabled = true
	common.UpstreamHostCircuitMode = common.UpstreamHostCircuitModeEnforce
	t.Cleanup(func() {
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.UpstreamHostCircuitMode = oldHostCircuitMode
		model.ClearChannelHostCooldownsForTest()
		model.ClearChannelCacheForTest()
	})

	priority := int64(10)
	weight := uint(0)
	sharedURL := "https://shared.example/v1"
	otherURL := "https://other.example/v1"
	preferred := &model.Channel{Id: 51, Type: 1, Key: "key-51", Status: common.ChannelStatusEnabled, Name: "preferred", Weight: &weight, Priority: &priority, BaseURL: &sharedURL, Models: "gpt-5.5", Group: "default"}
	fallback := &model.Channel{Id: 29, Type: 1, Key: "key-29", Status: common.ChannelStatusEnabled, Name: "fallback", Weight: &weight, Priority: &priority, BaseURL: &otherURL, Models: "gpt-5.5", Group: "default"}
	model.SetChannelCacheForTest(map[int]*model.Channel{51: preferred, 29: fallback}, map[string]map[string][]int{"default": {"gpt-5.5": {51, 29}}})
	require.False(t, model.RecordChannelHostFailure(sharedURL, "gpt-5.5", "/v1/responses", 41, "timeout"))
	require.False(t, model.RecordChannelHostFailure(sharedURL, "gpt-5.5", "/v1/responses", 41, "timeout"))
	require.True(t, model.RecordChannelHostFailure(sharedURL, "gpt-5.5", "/v1/responses", 42, "timeout"))

	rule := operation_setting.ChannelAffinityRule{
		Name:            "host-circuit-affinity-test",
		ModelRegex:      []string{"^gpt-5\\.5$"},
		PathRegex:       []string{"/v1/responses"},
		KeySources:      []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Affinity-Key"}},
		IncludeRuleName: true,
	}
	affinityValue := "shared-host-affinity-hit"
	cacheKeySuffix := service.BuildChannelAffinityCacheKeySuffixForTest(rule, "gpt-5.5", "default", affinityValue)
	cache := service.GetChannelAffinityCacheForTest()
	require.NoError(t, cache.SetWithTTL(cacheKeySuffix, 51, time.Minute))
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
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader("{\"model\":\"gpt-5.5\"}"))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("X-Affinity-Key", affinityValue)
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")

	Distribute()(ctx)

	channelId, ok := common.GetContextKey(ctx, constant.ContextKeyChannelId)
	require.True(t, ok)
	require.Equal(t, 29, channelId)
	require.True(t, common.GetContextKeyBool(ctx, constant.ContextKeyAffinityColdStart))
}
