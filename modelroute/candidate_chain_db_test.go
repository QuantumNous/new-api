package modelroute

import (
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestMain(m *testing.M) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		panic(err)
	}
	model.DB = db
	model.LOG_DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.MemoryCacheEnabled = false
	sqlDB, err := db.DB()
	if err != nil {
		panic(err)
	}
	sqlDB.SetMaxOpenConns(1)
	if err := db.AutoMigrate(
		&model.Channel{},
		&model.Option{},
		&model.ChannelModelPolicy{},
		&model.ChannelModelMetrics{},
	); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

func clearRouteTables(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.Exec("DELETE FROM channel_model_policy").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM channel_model_metrics").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM channels").Error)
	InvalidateAllRoutePlans()
	SetRoutingPriorityMode(model.RoutingPriorityModeChannel)
	// identity mapping by default
	MappingProvider = func(channelID int64) (string, error) { return "", nil }
}

func TestBuildProductionCandidateChainFromDB(t *testing.T) {
	clearRouteTables(t)

	// channel 1 priority-like manual 50 HEALTHY, channel 2 manual 100 UNKNOWN
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 1, RequestedModel: "gpt-x", ManualPriority: 50, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 2, RequestedModel: "gpt-x", ManualPriority: 100, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 1, EffectiveModel: "gpt-x", RouteState: string(model.RouteHealthy),
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 2, EffectiveModel: "gpt-x", RouteState: string(model.RouteUnknown),
	}))

	chain, err := BuildProductionCandidateChain("gpt-x")
	require.NoError(t, err)
	require.Len(t, chain, 2)
	// HEALTHY ranks before UNKNOWN even with lower manual_priority
	assert.Equal(t, int64(1), chain[0].ChannelID)
	assert.Equal(t, 50, chain[0].ManualPriority)
	assert.Equal(t, int64(2), chain[1].ChannelID)

	// second call hits cache
	plan := GetCachedRoutePlan("gpt-x")
	require.NotNil(t, plan)
	require.NotNil(t, plan.Primary)
	assert.Equal(t, int64(1), plan.Primary.ChannelID)
}

func TestLazyEnsureForRequest(t *testing.T) {
	clearRouteTables(t)
	mapping := `{"req-a":"eff-a"}`
	policy, metrics, effective, err := LazyEnsureForRequest(9, "req-a", mapping, 7)
	require.NoError(t, err)
	require.NotNil(t, policy)
	require.NotNil(t, metrics)
	assert.Equal(t, "eff-a", effective)
	assert.Equal(t, int64(9), policy.ChannelID)
	assert.Equal(t, "req-a", policy.RequestedModel)
	assert.Equal(t, 7, policy.ManualPriority)
	assert.Equal(t, "eff-a", metrics.EffectiveModel)
	assert.Equal(t, string(model.RouteUnknown), metrics.RouteState)
}

func TestMaterializeDiscovery(t *testing.T) {
	clearRouteTables(t)
	mapping := `{"src":"tgt"}`
	pri := int64(15)
	ch := &model.Channel{
		Id: 5, Models: "src,other", ModelMapping: &mapping, Priority: &pri, Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, model.DB.Create(ch).Error)

	pairs := DiscoverFromChannel(ch)
	require.NotEmpty(t, pairs)
	pCount, mCount, err := MaterializeDiscovery(pairs)
	require.NoError(t, err)
	assert.Greater(t, pCount, 0)
	assert.Greater(t, mCount, 0)

	pol, err := model.GetChannelModelPolicy(5, "src")
	require.NoError(t, err)
	require.NotNil(t, pol)
	assert.Equal(t, 15, pol.ManualPriority)

	met, err := model.GetChannelModelMetrics(5, "tgt")
	require.NoError(t, err)
	require.NotNil(t, met)
	assert.Equal(t, string(model.RouteUnknown), met.RouteState)
}

func TestSharedMetricsDifferentPolicyPriority(t *testing.T) {
	clearRouteTables(t)
	// two requested models map to same effective
	MappingProvider = func(channelID int64) (string, error) {
		return `{"gpt-5.6":"provider-x/model-v3","gpt-5.6-latest":"provider-x/model-v3"}`, nil
	}
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 12, RequestedModel: "gpt-5.6", ManualPriority: 100, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 12, RequestedModel: "gpt-5.6-latest", ManualPriority: 60, Enabled: true, Source: model.PolicySourceMapped,
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 12, EffectiveModel: "provider-x/model-v3", RouteState: string(model.RouteHealthy),
	}))

	cA, err := ResolveCandidateFromPolicy(&model.ChannelModelPolicy{
		ChannelID: 12, RequestedModel: "gpt-5.6", ManualPriority: 100, Enabled: true,
	})
	require.NoError(t, err)
	cB, err := ResolveCandidateFromPolicy(&model.ChannelModelPolicy{
		ChannelID: 12, RequestedModel: "gpt-5.6-latest", ManualPriority: 60, Enabled: true,
	})
	require.NoError(t, err)
	assert.Equal(t, 100, cA.ManualPriority)
	assert.Equal(t, 60, cB.ManualPriority)
	assert.Equal(t, "provider-x/model-v3", cA.EffectiveModel)
	assert.Equal(t, cA.EffectiveModel, cB.EffectiveModel)
	assert.Equal(t, cA.MetricsKey, cB.MetricsKey)
}
