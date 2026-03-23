package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newDistributorTestContext() *gin.Context {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Set("channel_affinity_cache_key", "new-api:channel_affinity:v1:codex cli trace:default:test-affinity-key")
	ctx.Set("channel_affinity_ttl_seconds", 60)
	return ctx
}

func TestSelectPreferredAffinityChannelClearsDisabledChannel(t *testing.T) {
	ctx := newDistributorTestContext()

	selected, group := selectPreferredAffinityChannel(
		ctx,
		&model.Channel{Id: 42, Status: common.ChannelStatusAutoDisabled},
		"gpt-5",
		"default",
		func(string) []string { return []string{"default"} },
		func(string, string, int) bool { return true },
	)

	require.Nil(t, selected)
	require.Empty(t, group)

	anyInfo, ok := ctx.Get("channel_affinity_log_info")
	require.True(t, ok)
	info, ok := anyInfo.(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, true, info["stale_affinity_cleared"])
	require.Equal(t, "preferred affinity channel 42 is disabled", info["stale_affinity_reason"])
}

func TestSelectPreferredAffinityChannelFallsBackForAutoGroupMismatch(t *testing.T) {
	ctx := newDistributorTestContext()
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")

	selected, group := selectPreferredAffinityChannel(
		ctx,
		&model.Channel{Id: 42, Status: common.ChannelStatusEnabled},
		"gpt-5",
		"auto",
		func(string) []string { return []string{"group-a", "group-b"} },
		func(string, string, int) bool { return false },
	)

	require.Nil(t, selected)
	require.Empty(t, group)

	anyInfo, ok := ctx.Get("channel_affinity_log_info")
	require.True(t, ok)
	info, ok := anyInfo.(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, true, info["stale_affinity_cleared"])
	require.Equal(t, "preferred affinity channel 42 no longer matches auto groups for model gpt-5", info["stale_affinity_reason"])
}

func TestSelectPreferredAffinityChannelUsesMatchingAutoGroup(t *testing.T) {
	ctx := newDistributorTestContext()
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")

	selected, group := selectPreferredAffinityChannel(
		ctx,
		&model.Channel{Id: 43, Status: common.ChannelStatusEnabled},
		"gpt-5",
		"auto",
		func(string) []string { return []string{"group-a", "group-b"} },
		func(group, modelName string, channelID int) bool {
			return group == "group-b" && modelName == "gpt-5" && channelID == 43
		},
	)

	require.NotNil(t, selected)
	require.Equal(t, 43, selected.Id)
	require.Equal(t, "group-b", group)
	require.Equal(t, "group-b", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
}
