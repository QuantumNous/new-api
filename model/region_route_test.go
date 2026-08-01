package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupRegionRouteTest(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&RegionRoute{}))
	require.NoError(t, DB.Exec("DELETE FROM region_routes").Error)
	require.NoError(t, DB.Exec("DELETE FROM channels").Error)
	InvalidateRegionRoutingCache()
	t.Cleanup(func() {
		DB.Exec("DELETE FROM region_routes")
		DB.Exec("DELETE FROM channels")
		InvalidateRegionRoutingCache()
	})
}

func newTestChannel(t *testing.T, id int, tag string, priority int64, responseTime int, status int) *Channel {
	t.Helper()
	channel := &Channel{
		Id:           id,
		Name:         tag,
		Key:          "sk-test",
		Status:       status,
		Priority:     &priority,
		ResponseTime: responseTime,
	}
	if tag != "" {
		channel.Tag = &tag
	}
	return channel
}

func TestNormalizeRegion(t *testing.T) {
	assert.Equal(t, "cn", NormalizeRegion("  CN "))
	assert.Equal(t, "", NormalizeRegion("   "))
	assert.Equal(t, "ap-southeast-1", NormalizeRegion("AP-Southeast-1"))
	// 超长输入被截断到 maxRegionLength，避免异常请求头进入 SQL
	assert.Len(t, NormalizeRegion("abcdefghijklmnopqrstuvwxyz"), maxRegionLength)
}

func TestResolveRegionRoutingInactiveCases(t *testing.T) {
	setupRegionRouteTest(t)

	// 无区域标识
	assert.False(t, ResolveRegionRouting("", "gpt-4").Active)
	// 有区域但无任何策略
	assert.False(t, ResolveRegionRouting("cn", "gpt-4").Active)

	// 策略未圈定任何渠道 -> 不生效
	require.NoError(t, CreateRegionRoute(&RegionRoute{
		Region: "cn", Model: "*", Strategy: "latency", Enabled: true,
	}))
	assert.False(t, ResolveRegionRouting("cn", "gpt-4").Active)

	// 策略被禁用 -> 不生效
	require.NoError(t, CreateRegionRoute(&RegionRoute{
		Region: "cn", Model: "*", ChannelIds: "1,2", Strategy: "latency", Enabled: false,
	}))
	assert.False(t, ResolveRegionRouting("cn", "gpt-4").Active)
}

func TestResolveRegionRoutingMergesChannelsAndPicksStrategy(t *testing.T) {
	setupRegionRouteTest(t)

	require.NoError(t, DB.Create(newTestChannel(t, 5, "cn-pool", 0, 100, common.ChannelStatusEnabled)).Error)
	require.NoError(t, DB.Create(newTestChannel(t, 9, "us-pool", 0, 100, common.ChannelStatusEnabled)).Error)

	// priority 最高的策略决定排序策略
	require.NoError(t, CreateRegionRoute(&RegionRoute{
		Region: "cn", Model: "*", ChannelIds: "1,2", Strategy: "latency", Priority: 10, Enabled: true,
	}))
	// global 策略对所有区域生效，渠道 id 与上一条去重合并
	require.NoError(t, CreateRegionRoute(&RegionRoute{
		Region: RegionGlobal, Model: "gpt-4", ChannelIds: "2,3", Strategy: "cost", Priority: 1, Enabled: true,
	}))
	// 按 tag 圈定渠道
	require.NoError(t, CreateRegionRoute(&RegionRoute{
		Region: "cn", Model: "*", Tag: "cn-pool", Strategy: "fixed", Priority: 0, Enabled: true,
	}))
	// 其他区域的策略不应命中
	require.NoError(t, CreateRegionRoute(&RegionRoute{
		Region: "us", Model: "*", Tag: "us-pool", Strategy: "fixed", Priority: 99, Enabled: true,
	}))

	routing := ResolveRegionRouting("  CN ", "gpt-4")
	require.True(t, routing.Active)
	assert.Equal(t, "cn", routing.Region)
	assert.Equal(t, "latency", routing.Strategy)
	assert.ElementsMatch(t, []int64{1, 2, 3, 5}, routing.AllowedIds)

	// 模型不匹配 global 那条时，只保留通配策略的渠道
	routing = ResolveRegionRouting("cn", "claude-3")
	require.True(t, routing.Active)
	assert.ElementsMatch(t, []int64{1, 2, 5}, routing.AllowedIds)
}

func TestRegionStrategyScore(t *testing.T) {
	fast := newTestChannel(t, 1, "", 5, 100, common.ChannelStatusEnabled)
	slow := newTestChannel(t, 2, "", 9, 800, common.ChannelStatusEnabled)
	down := newTestChannel(t, 3, "", 9, 50, common.ChannelStatusAutoDisabled)

	// latency：响应时间短的分数高
	assert.Greater(t, regionStrategyScore(fast, "latency"), regionStrategyScore(slow, "latency"))
	// availability：可用渠道永远优先于不可用渠道，即使后者更快
	assert.Greater(t, regionStrategyScore(slow, "availability"), regionStrategyScore(down, "availability"))
	// cost：优先级低的渠道视为低成本备用渠道，分数更高
	assert.Greater(t, regionStrategyScore(fast, "cost"), regionStrategyScore(slow, "cost"))
	// fixed / 未知策略：沿用渠道自身优先级
	assert.Equal(t, int64(9), regionStrategyScore(slow, "fixed"))
	assert.Equal(t, int64(9), regionStrategyScore(slow, ""))
	assert.Equal(t, int64(0), regionStrategyScore(nil, "latency"))
}

func TestFilterChannelsByRegion(t *testing.T) {
	candidates := []int{1, 2, 3}

	// 未命中区域路由时原样返回
	assert.Equal(t, candidates, filterChannelsByRegion(candidates, RegionRouting{}))

	// 命中时按白名单收窄，且保持原有顺序
	routing := RegionRouting{Active: true, AllowedIds: []int64{3, 1}}
	assert.Equal(t, []int{1, 3}, filterChannelsByRegion(candidates, routing))

	// 交集为空时降级为不过滤，避免请求整体失败
	routing = RegionRouting{Active: true, AllowedIds: []int64{99}}
	assert.Equal(t, candidates, filterChannelsByRegion(candidates, routing))
}

func TestFilterAbilitiesByRegion(t *testing.T) {
	setupRegionRouteTest(t)

	require.NoError(t, DB.Create(newTestChannel(t, 1, "", 0, 500, common.ChannelStatusEnabled)).Error)
	require.NoError(t, DB.Create(newTestChannel(t, 2, "", 0, 50, common.ChannelStatusEnabled)).Error)
	require.NoError(t, DB.Create(newTestChannel(t, 3, "", 0, 10, common.ChannelStatusEnabled)).Error)

	abilities := []Ability{{ChannelId: 1}, {ChannelId: 2}, {ChannelId: 3}}

	// 未命中区域路由时原样返回
	assert.Len(t, filterAbilitiesByRegion(abilities, RegionRouting{}), 3)

	// 白名单收窄 + latency 策略只保留最快的渠道
	routing := RegionRouting{Active: true, AllowedIds: []int64{1, 2}, Strategy: "latency"}
	filtered := filterAbilitiesByRegion(abilities, routing)
	require.Len(t, filtered, 1)
	assert.Equal(t, 2, filtered[0].ChannelId)

	// 白名单与候选无交集时降级为不过滤
	routing = RegionRouting{Active: true, AllowedIds: []int64{99}}
	assert.Len(t, filterAbilitiesByRegion(abilities, routing), 3)
}
