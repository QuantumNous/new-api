package service

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newRefusalFallbackContext(tokenID int, path, body string) *gin.Context {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", path, strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(ctx, constant.ContextKeyTokenId, tokenID)
	return ctx
}

func installRefusalFallbackTestSetting(t *testing.T) {
	t.Helper()
	setting := operation_setting.GetRefusalFallbackSetting()
	original := *setting
	redisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	*setting = operation_setting.RefusalFallbackSetting{
		Enabled: true,
		Rules: []operation_setting.RefusalFallbackRule{
			{
				Name:            "synthetic claude refusal",
				ModelRegex:      []string{"^claude-"},
				PathRegex:       []string{"^/v1/messages$"},
				Groups:          []string{"default"},
				FallbackGroup:   "claude-fallback",
				CooldownSeconds: 3600,
			},
		},
	}
	t.Cleanup(func() {
		*setting = original
		common.RedisEnabled = redisEnabled
	})
}

func TestRefusalFallbackUsesStableTokenScopeAcrossAffinityIdentityChanges(t *testing.T) {
	gin.SetMode(gin.TestMode)
	installRefusalFallbackTestSetting(t)

	primary := newRefusalFallbackContext(
		700001,
		"/v1/messages",
		`{"model":"claude-sonnet","metadata":{"user_id":"affinity-a"}}`,
	)
	fallbackGroup, active := GetRefusalFallbackGroup(primary, "claude-sonnet", "default")
	require.False(t, active)
	require.Empty(t, fallbackGroup)

	common.SetContextKey(primary, constant.ContextKeyUpstreamRefusal, true)
	common.SetContextKey(primary, constant.ContextKeyChannelId, 901)
	ObserveRefusalFallback(primary)

	retry := newRefusalFallbackContext(
		700001,
		"/v1/messages",
		`{"model":"claude-sonnet","metadata":{"user_id":"affinity-b"}}`,
	)
	fallbackGroup, active = GetRefusalFallbackGroup(retry, "claude-sonnet", "default")
	require.True(t, active)
	require.Equal(t, "claude-fallback", fallbackGroup)
	require.True(t, ClearCurrentRefusalFallback(retry))
}

func TestRefusalFallbackDoesNotLeakAcrossScope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	installRefusalFallbackTestSetting(t)

	primary := newRefusalFallbackContext(700002, "/v1/messages", `{}`)
	_, active := GetRefusalFallbackGroup(primary, "claude-sonnet", "default")
	require.False(t, active)
	common.SetContextKey(primary, constant.ContextKeyUpstreamRefusal, true)
	common.SetContextKey(primary, constant.ContextKeyChannelId, 901)
	ObserveRefusalFallback(primary)

	otherToken := newRefusalFallbackContext(700003, "/v1/messages", `{}`)
	_, active = GetRefusalFallbackGroup(otherToken, "claude-sonnet", "default")
	require.False(t, active)

	otherModel := newRefusalFallbackContext(700002, "/v1/messages", `{}`)
	_, active = GetRefusalFallbackGroup(otherModel, "gpt-5", "default")
	require.False(t, active)

	otherGroup := newRefusalFallbackContext(700002, "/v1/messages", `{}`)
	_, active = GetRefusalFallbackGroup(otherGroup, "claude-sonnet", "premium")
	require.False(t, active)

	retry := newRefusalFallbackContext(700002, "/v1/messages", `{}`)
	_, active = GetRefusalFallbackGroup(retry, "claude-sonnet", "default")
	require.True(t, active)
	require.True(t, ClearCurrentRefusalFallback(retry))
}

func TestRefusalFallbackSkipsAutoSourceGroupEvenWhenRuleMatchesAllGroups(t *testing.T) {
	gin.SetMode(gin.TestMode)
	installRefusalFallbackTestSetting(t)
	setting := operation_setting.GetRefusalFallbackSetting()
	setting.Rules[0].Groups = nil

	primary := newRefusalFallbackContext(700005, "/v1/messages", `{}`)
	_, active := GetRefusalFallbackGroup(primary, "claude-sonnet", "auto")
	require.False(t, active)
	common.SetContextKey(primary, constant.ContextKeyUpstreamRefusal, true)
	common.SetContextKey(primary, constant.ContextKeyChannelId, 901)
	ObserveRefusalFallback(primary)

	retry := newRefusalFallbackContext(700005, "/v1/messages", `{}`)
	_, active = GetRefusalFallbackGroup(retry, "claude-sonnet", "auto")
	require.False(t, active)
}

func TestShouldActivateRefusalFallbackKeepsFixedCooldownWindow(t *testing.T) {
	base := refusalFallbackMeta{FallbackGroup: "claude-fallback"}
	require.True(t, shouldActivateRefusalFallback(base, true, 901))
	require.False(t, shouldActivateRefusalFallback(base, false, 901))

	active := base
	active.Active = true
	require.False(t, shouldActivateRefusalFallback(active, true, 901))
}

func TestResolveRoutingGroupDoesNotChangeBillingGroup(t *testing.T) {
	ctx := newRefusalFallbackContext(700004, "/v1/messages", `{}`)
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "paid-user-group")
	common.SetContextKey(ctx, constant.ContextKeyRoutingGroup, "claude-fallback")

	require.Equal(t, "claude-fallback", ResolveRoutingGroup(ctx, "default"))
	require.Equal(
		t,
		"paid-user-group",
		common.GetContextKeyString(ctx, constant.ContextKeyUsingGroup),
	)
}
