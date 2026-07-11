package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPolicyKeyAndMetricsKeyString(t *testing.T) {
	pk := PolicyKey{ChannelID: 12, RequestedModel: "gpt-5.6"}
	mk := MetricsKey{ChannelID: 12, EffectiveModel: "provider-x/model-v3"}
	assert.Equal(t, pk.String(), PolicyKey{ChannelID: 12, RequestedModel: "gpt-5.6"}.String())
	assert.NotEqual(t, pk.String(), mk.String())
	assert.Contains(t, pk.String(), "gpt-5.6")
	assert.Contains(t, mk.String(), "provider-x/model-v3")
}

func TestRouteStateAndRoleConstants(t *testing.T) {
	assert.Equal(t, RouteState("UNKNOWN"), RouteUnknown)
	assert.Equal(t, RouteState("HEALTHY"), RouteHealthy)
	assert.Equal(t, RouteState("RATE_LIMITED"), RouteRateLimited)
	assert.Equal(t, RouteState("OPEN"), RouteOpen)
	assert.Equal(t, RouteState("PROBING"), RouteProbing)
	assert.Equal(t, RouteState("RECOVERING"), RouteRecovering)
	assert.Equal(t, RouteState("MANUALLY_DISABLED"), RouteManuallyDisabled)

	assert.Equal(t, RouteRole("NONE"), RoleNone)
	assert.Equal(t, RouteRole("BOOTSTRAP"), RoleBootstrap)
	assert.Equal(t, RouteRole("PRIMARY"), RolePrimary)
	assert.Equal(t, RouteRole("OVERFLOW"), RoleOverflow)

	assert.Equal(t, ErrorClass("TEMPORARY"), ErrorTemporary)
	assert.Equal(t, ErrorClass("DETERMINISTIC"), ErrorDeterministic)
}

func TestDefaultBackoffLadders(t *testing.T) {
	assert.Equal(t, []int{60, 120, 300, 600}, DefaultRateLimitBackoffSeconds)
	assert.Equal(t, []int{30, 60, 120, 300, 900, 1800}, DefaultOpenBackoffSeconds)
	assert.Equal(t, 0.10, DefaultSuccessEMAAlpha)
	assert.Equal(t, 0.20, DefaultTTFTEMAAlpha)
	assert.Equal(t, RoutingPriorityModeModel, "model_priority")
	assert.Equal(t, RoutingBehaviorExperienceFirst, "experience_first")
}

func TestCalibrationBucketJSONRoundTrip(t *testing.T) {
	m := &ChannelModelMetrics{
		ChannelID:      1,
		EffectiveModel: "m",
		RouteState:     string(RouteUnknown),
	}
	buckets := map[string]CalibrationBucket{
		CalibrationBucket0To1k: {
			Ratio:       1.25,
			SampleCount: 3,
			UpdatedAt:   time.Unix(1_700_000_000, 0).UTC(),
		},
	}
	require.NoError(t, m.SetShadowCalibration(buckets))
	require.NotEmpty(t, m.ShadowCalibrationJSON)

	parsed, err := m.ParseShadowCalibration()
	require.NoError(t, err)
	require.Contains(t, parsed, CalibrationBucket0To1k)
	assert.InDelta(t, 1.25, parsed[CalibrationBucket0To1k].Ratio, 1e-9)
	assert.Equal(t, int64(3), parsed[CalibrationBucket0To1k].SampleCount)
}

func TestChannelModelMetricsStateHelpers(t *testing.T) {
	m := &ChannelModelMetrics{RouteState: string(RouteHealthy)}
	assert.Equal(t, RouteHealthy, m.State())
	m.SetState(RouteOpen)
	assert.Equal(t, RouteOpen, m.State())
	m.SetLastErrorClass(ErrorTemporary)
	assert.Equal(t, ErrorTemporary, m.GetLastErrorClass())

	until := time.Unix(1_800_000_000, 0)
	m.SetCooldownUntil(until)
	assert.Equal(t, until.Unix(), m.CooldownUntilTime().Unix())
	m.SetCooldownUntil(time.Time{})
	assert.True(t, m.CooldownUntilTime().IsZero())
}

func TestResolvedRouteCandidateCarriesPolicyPriority(t *testing.T) {
	// PRD §10.1: manual_priority follows Policy of requested_model, not Metrics reverse lookup.
	metrics := &ChannelModelMetrics{
		ChannelID:      12,
		EffectiveModel: "provider-x/model-v3",
		RouteState:     string(RouteHealthy),
	}
	candA := ResolvedRouteCandidate{
		ChannelID:      12,
		RequestedModel: "gpt-5.6",
		EffectiveModel: "provider-x/model-v3",
		ManualPriority: 100,
		Metrics:        metrics,
	}
	candB := ResolvedRouteCandidate{
		ChannelID:      12,
		RequestedModel: "gpt-5.6-latest",
		EffectiveModel: "provider-x/model-v3",
		ManualPriority: 60,
		Metrics:        metrics,
	}
	assert.Same(t, candA.Metrics, candB.Metrics)
	assert.NotEqual(t, candA.ManualPriority, candB.ManualPriority)
	assert.Equal(t, 60, candB.ManualPriority)
}

func TestProbeQueueItemAndRoutePlanShapes(t *testing.T) {
	item := ProbeQueueItem{
		MetricsKey:     MetricsKey{ChannelID: 1, EffectiveModel: "m"},
		ManualPriority: 10,
		BackoffLevel:   2,
		NextProbeAt:    time.Unix(100, 0),
	}
	assert.Equal(t, int64(1), item.MetricsKey.ChannelID)

	plan := RoutePlan{
		RequestedModel: "gpt-5.6",
		Primary: &ResolvedRouteCandidate{
			ChannelID:      1,
			RequestedModel: "gpt-5.6",
			ManualPriority: 100,
		},
		OverflowChain: []*ResolvedRouteCandidate{
			{ChannelID: 2, RequestedModel: "gpt-5.6", ManualPriority: 50},
		},
	}
	require.NotNil(t, plan.Primary)
	require.Len(t, plan.OverflowChain, 1)
}
