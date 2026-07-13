package modelroute

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPruneOrphanPoliciesForChannel_ConfiguredOrphan(t *testing.T) {
	clearRouteTables(t)

	mapping := `{"dsf":"deepseek-v4-flash"}`
	pri := int64(0)
	ch := &model.Channel{
		Id: 19, Name: "test-19", Models: "dsf,deepseek-v4-flash",
		ModelMapping: &mapping, Priority: &pri, Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, model.DB.Create(ch).Error)

	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 19, RequestedModel: "dsp", ManualPriority: 0, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 19, RequestedModel: "dsf", ManualPriority: 0, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 19, EffectiveModel: "dsp", RouteState: string(model.RouteUnknown),
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 19, EffectiveModel: "deepseek-v4-flash", RouteState: string(model.RouteUnknown),
	}))

	res, err := PruneOrphanPoliciesForChannel(ch, PruneOptions{})
	require.NoError(t, err)
	assert.Equal(t, 1, res.PoliciesDeleted)
	assert.Equal(t, 1, res.MetricsDeleted)

	polDSP, err := model.GetChannelModelPolicy(19, "dsp")
	require.NoError(t, err)
	assert.Nil(t, polDSP)

	polDSF, err := model.GetChannelModelPolicy(19, "dsf")
	require.NoError(t, err)
	require.NotNil(t, polDSF)

	metDSP, err := model.GetChannelModelMetrics(19, "dsp")
	require.NoError(t, err)
	assert.Nil(t, metDSP)

	metFlash, err := model.GetChannelModelMetrics(19, "deepseek-v4-flash")
	require.NoError(t, err)
	require.NotNil(t, metFlash)
}

func TestPruneOrphanPoliciesForChannel_KeepsLazyCreated(t *testing.T) {
	clearRouteTables(t)

	mapping := `{}`
	ch := &model.Channel{
		Id: 7, Name: "lazy-ch", Models: "alive-model",
		ModelMapping: &mapping, Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, model.DB.Create(ch).Error)

	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 7, RequestedModel: "ghost", ManualPriority: 0, Enabled: true, Source: model.PolicySourceLazyCreated,
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 7, EffectiveModel: "ghost", RouteState: string(model.RouteUnknown),
	}))
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 7, RequestedModel: "alive-model", ManualPriority: 0, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 7, EffectiveModel: "alive-model", RouteState: string(model.RouteUnknown),
	}))

	res, err := PruneOrphanPoliciesForChannel(ch, PruneOptions{})
	require.NoError(t, err)
	assert.Equal(t, 0, res.PoliciesDeleted)
	// ghost metrics still reachable via remaining lazy policy
	assert.Equal(t, 0, res.MetricsDeleted)

	pol, err := model.GetChannelModelPolicy(7, "ghost")
	require.NoError(t, err)
	require.NotNil(t, pol)
	assert.Equal(t, model.PolicySourceLazyCreated, pol.Source)
}

func TestPruneOrphanPoliciesForChannel_DryRun(t *testing.T) {
	clearRouteTables(t)

	mapping := `{"a":"b"}`
	ch := &model.Channel{
		Id: 3, Name: "dry", Models: "a",
		ModelMapping: &mapping, Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, model.DB.Create(ch).Error)
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 3, RequestedModel: "orphan", ManualPriority: 0, Enabled: true, Source: model.PolicySourceMapped,
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 3, EffectiveModel: "orphan", RouteState: string(model.RouteUnknown),
	}))

	res, err := PruneOrphanPoliciesForChannel(ch, PruneOptions{DryRun: true})
	require.NoError(t, err)
	assert.Equal(t, 1, res.PoliciesDeleted)
	assert.Equal(t, 1, res.MetricsDeleted)
	require.Len(t, res.PolicyKeys, 1)
	assert.Equal(t, "orphan", res.PolicyKeys[0].RequestedModel)

	// still in DB
	pol, err := model.GetChannelModelPolicy(3, "orphan")
	require.NoError(t, err)
	require.NotNil(t, pol)
	met, err := model.GetChannelModelMetrics(3, "orphan")
	require.NoError(t, err)
	require.NotNil(t, met)
}

func TestPruneOrphanPoliciesForChannel_MappedKeyRemoved(t *testing.T) {
	clearRouteTables(t)

	// mapping no longer has dsp; only real-model in list
	mapping := `{}`
	ch := &model.Channel{
		Id: 11, Name: "map-rm", Models: "real-model",
		ModelMapping: &mapping, Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, model.DB.Create(ch).Error)
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 11, RequestedModel: "dsp", ManualPriority: 10, Enabled: true, Source: model.PolicySourceMapped,
	}))
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 11, RequestedModel: "real-model", ManualPriority: 0, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 11, EffectiveModel: "deepseek-v4-pro", RouteState: string(model.RouteUnknown),
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 11, EffectiveModel: "real-model", RouteState: string(model.RouteUnknown),
	}))

	res, err := PruneOrphanPoliciesForChannel(ch, PruneOptions{})
	require.NoError(t, err)
	assert.Equal(t, 1, res.PoliciesDeleted)
	// deepseek-v4-pro only pointed by removed dsp mapping
	assert.Equal(t, 1, res.MetricsDeleted)

	pol, err := model.GetChannelModelPolicy(11, "dsp")
	require.NoError(t, err)
	assert.Nil(t, pol)
	met, err := model.GetChannelModelMetrics(11, "deepseek-v4-pro")
	require.NoError(t, err)
	assert.Nil(t, met)
}
