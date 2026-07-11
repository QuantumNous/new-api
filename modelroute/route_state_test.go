package modelroute

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func withFrozenNow(t *testing.T, ts time.Time) {
	t.Helper()
	prev := now
	now = func() time.Time { return ts }
	t.Cleanup(func() { now = prev })
}

func TestApplyTransitionRateLimitedBackoff(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)
	withFrozenNow(t, base)
	GlobalMetricsRuntime.Clear()
	GlobalRoles.Clear()

	m := &model.ChannelModelMetrics{
		ChannelID: 1, EffectiveModel: "m", RouteState: string(model.RouteHealthy),
	}
	changed := ApplyTransition(m, EventRateLimited, 0)
	assert.True(t, changed)
	assert.Equal(t, model.RouteRateLimited, m.State())
	assert.Equal(t, 1, m.BackoffLevel)
	// default first ladder 60s
	assert.Equal(t, base.Add(60*time.Second).Unix(), m.CooldownUntilTime().Unix())

	// advance past cooldown
	withFrozenNow(t, base.Add(61*time.Second))
	assert.True(t, MaybeAdvanceCooldown(m))
	assert.Equal(t, model.RouteProbing, m.State())
}

func TestDeterministicFailOpensImmediately(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)
	withFrozenNow(t, base)
	GlobalMetricsRuntime.Clear()

	m := &model.ChannelModelMetrics{
		ChannelID: 1, EffectiveModel: "m", RouteState: string(model.RouteHealthy),
	}
	ApplyTransition(m, EventDeterministicFail, 0)
	assert.Equal(t, model.RouteOpen, m.State())
	assert.Equal(t, model.ErrorDeterministic, m.GetLastErrorClass())
	assert.Equal(t, base.Add(30*time.Second).Unix(), m.CooldownUntilTime().Unix())
}

func TestTemporaryFailNeedsThreshold(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)
	withFrozenNow(t, base)
	GlobalMetricsRuntime.Clear()

	m := &model.ChannelModelMetrics{
		ChannelID: 2, EffectiveModel: "m", RouteState: string(model.RouteHealthy),
	}
	ApplyTransition(m, EventTemporaryFail, 0)
	assert.Equal(t, model.RouteHealthy, m.State()) // consecutive=1 < 2
	assert.Equal(t, 1, m.ConsecutiveFailures)

	ApplyTransition(m, EventTemporaryFail, 0)
	assert.Equal(t, model.RouteOpen, m.State()) // consecutive=2
	assert.Equal(t, model.ErrorTemporary, m.GetLastErrorClass())
}

func TestRecoverFlow(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)
	withFrozenNow(t, base)
	GlobalMetricsRuntime.Clear()

	m := &model.ChannelModelMetrics{
		ChannelID: 3, EffectiveModel: "m", RouteState: string(model.RouteOpen),
	}
	m.SetCooldownUntil(base.Add(-1 * time.Second))
	assert.True(t, MaybeAdvanceCooldown(m))
	assert.Equal(t, model.RouteProbing, m.State())

	ApplyTransition(m, EventProbeSuccess, 0)
	assert.Equal(t, model.RouteRecovering, m.State())
	assert.Equal(t, 1, m.RecoverSuccessCount)

	ApplyTransition(m, EventProbeSuccess, 0)
	assert.Equal(t, model.RouteRecovering, m.State())
	ApplyTransition(m, EventProbeSuccess, 0)
	assert.Equal(t, model.RouteHealthy, m.State())
	assert.Equal(t, 0, m.BackoffLevel)
}

func TestProductionSuccessFromUnknown(t *testing.T) {
	withFrozenNow(t, time.Unix(1_700_000_000, 0))
	GlobalMetricsRuntime.Clear()
	m := &model.ChannelModelMetrics{
		ChannelID: 4, EffectiveModel: "m", RouteState: string(model.RouteUnknown),
	}
	ApplyTransition(m, EventProductionSuccess, 0)
	assert.Equal(t, model.RouteHealthy, m.State())
}

func TestManualDisableAndRestore(t *testing.T) {
	withFrozenNow(t, time.Unix(1_700_000_000, 0))
	GlobalMetricsRuntime.Clear()
	GlobalRoles.Clear()
	m := &model.ChannelModelMetrics{
		ChannelID: 5, EffectiveModel: "m", RouteState: string(model.RouteHealthy),
	}
	mk := m.MetricsKey()
	GlobalRoles.Set(mk, model.RolePrimary)
	ApplyTransition(m, EventManualDisable, 0)
	assert.Equal(t, model.RouteManuallyDisabled, m.State())
	assert.Equal(t, model.RoleNone, GlobalRoles.Get(mk))

	ApplyTransition(m, EventRestoreAuto, 0)
	assert.Equal(t, model.RouteProbing, m.State())
}

func TestClassifyHTTPStatus(t *testing.T) {
	c, e := ClassifyHTTPStatus(429)
	assert.Equal(t, model.ErrorTemporary, c)
	assert.Equal(t, EventRateLimited, e)

	c, e = ClassifyHTTPStatus(401)
	assert.Equal(t, model.ErrorDeterministic, c)
	assert.Equal(t, EventDeterministicFail, e)

	c, e = ClassifyHTTPStatus(503)
	assert.Equal(t, model.ErrorTemporary, c)
	assert.Equal(t, EventTemporaryFail, e)

	c, e = ClassifyHTTPStatus(200)
	assert.Equal(t, EventProductionSuccess, e)
	assert.Equal(t, model.ErrorClass(""), c)
}

func TestIsRouteStale(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)
	withFrozenNow(t, base)
	// first_standby: max(3*120s, 30m) = 30m
	assert.Equal(t, 30*time.Minute, StaleAfter(true))
	// other: max(3*600s, 30m) = 30m
	assert.Equal(t, 30*time.Minute, StaleAfter(false))

	old := base.Add(-31 * time.Minute).Unix()
	m := &model.ChannelModelMetrics{
		ChannelID: 1, EffectiveModel: "m", RouteState: string(model.RouteHealthy), LastSuccessAt: &old,
	}
	assert.True(t, IsRouteStale(m, true))

	fresh := base.Add(-5 * time.Minute).Unix()
	m.LastSuccessAt = &fresh
	assert.False(t, IsRouteStale(m, true))

	// OPEN never stale-soft-mark for takeover path
	m.RouteState = string(model.RouteOpen)
	m.LastSuccessAt = &old
	assert.False(t, IsRouteStale(m, true))
}

func TestIsProductiveState(t *testing.T) {
	assert.True(t, IsProductiveState(model.RouteHealthy))
	assert.True(t, IsProductiveState(model.RouteRecovering))
	assert.True(t, IsProductiveState(model.RouteUnknown))
	assert.False(t, IsProductiveState(model.RouteOpen))
	assert.False(t, IsProductiveState(model.RouteRateLimited))
	assert.False(t, IsProductiveState(model.RouteProbing))
}

func TestRateLimitUsesRetryAfter(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)
	withFrozenNow(t, base)
	m := &model.ChannelModelMetrics{ChannelID: 1, EffectiveModel: "m", RouteState: string(model.RouteHealthy)}
	ApplyTransition(m, EventRateLimited, 120)
	require.Equal(t, model.RouteRateLimited, m.State())
	assert.Equal(t, base.Add(120*time.Second).Unix(), m.CooldownUntilTime().Unix())
}
