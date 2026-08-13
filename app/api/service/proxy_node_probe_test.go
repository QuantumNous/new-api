package service

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestProxyNodeHealthSuccessCapsAndClearsFailureState(t *testing.T) {
	now := time.Date(2026, time.August, 11, 12, 0, 0, 0, time.UTC)
	cooldown := now.Add(time.Minute)
	node := &model.ProxyNode{
		Health:        0.96,
		FailureCount:  3,
		CooldownUntil: &cooldown,
		LastError:     "timeout",
	}

	ApplyProxyNodeProbeSuccess(node, now)

	assert.Equal(t, 1.0, node.Health)
	assert.Zero(t, node.FailureCount)
	assert.Nil(t, node.CooldownUntil)
	assert.Empty(t, node.LastError)
	require.NotNil(t, node.LastProbeAt)
	assert.Equal(t, now, *node.LastProbeAt)
}

func TestProxyNodeHealthFailureHasFloorAndExponentialCooldownCap(t *testing.T) {
	now := time.Date(2026, time.August, 11, 12, 0, 0, 0, time.UTC)
	node := &model.ProxyNode{Health: 1}

	for failure := 1; failure <= 12; failure++ {
		ApplyProxyNodeProbeFailure(node, now, "request failed")
		assert.Equal(t, failure, node.FailureCount)
		assert.GreaterOrEqual(t, node.Health, ProxyNodeHealthFloor)
		require.NotNil(t, node.CooldownUntil)
		wantCooldown := now.Add(proxyNodeProbeCooldown(failure))
		assert.Equal(t, wantCooldown, *node.CooldownUntil)
	}
	assert.Equal(t, ProxyNodeProbeCooldownMax, proxyNodeProbeCooldown(node.FailureCount))
	assert.InDelta(t, ProxyNodeHealthFloor, node.Health, 0.000001)
}

func TestProxyNodeHealthFailureDoesNotLeakSensitiveError(t *testing.T) {
	now := time.Date(2026, time.August, 11, 12, 0, 0, 0, time.UTC)
	node := &model.ProxyNode{Health: 1}

	ApplyProxyNodeProbeFailure(node, now, "request failed for user:pass@example.com")

	assert.Equal(t, "proxy handshake failed", node.LastError)
}

func TestProxyNodeProbeStatsTrackOnlyProbeOperations(t *testing.T) {
	ResetProxyNodeProbeStats()
	assert.Equal(t, ProxyNodeProbeStats{}, GetProxyNodeProbeStats())

	beginProxyNodeProbe()
	beginProxyNodeProbe()
	assert.Equal(t, int64(2), GetProxyNodeProbeStats().Total)
	assert.Equal(t, int64(2), GetProxyNodeProbeStats().Active)

	recordProxyNodeProbeResult(true)
	recordProxyNodeProbeResult(false)
	stats := GetProxyNodeProbeStats()
	assert.Equal(t, int64(2), stats.Total)
	assert.Equal(t, int64(1), stats.Success)
	assert.Zero(t, stats.Active)
}

func TestProxyNodeProbeFailurePersistsRedactedState(t *testing.T) {
	now := time.Date(2026, time.August, 11, 12, 0, 0, 0, time.UTC)
	node := &model.ProxyNode{Health: 0.1}

	ApplyProxyNodeProbeFailure(node, now, "https://user:password@example.com:8443/path")

	assert.Equal(t, "proxy handshake failed", node.LastError)
	assert.NotContains(t, node.LastError, "user")
	assert.NotContains(t, node.LastError, "password")
	require.NotNil(t, node.LastProbeAt)
	assert.Equal(t, now, *node.LastProbeAt)
}

func TestProbeProxyNodePersistsFailureState(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ProxyNode{}))
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })

	node := &model.ProxyNode{Name: "broken", Enabled: true, EncryptedProxyConfig: "not-valid-ciphertext", Health: 1}
	require.NoError(t, db.Create(node).Error)

	result, err := ProbeProxyNode(context.Background(), node)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.False(t, result.Success)
	assert.Equal(t, "proxy handshake failed", result.Error)

	var persisted model.ProxyNode
	require.NoError(t, db.First(&persisted, node.ID).Error)
	assert.Equal(t, 1, persisted.FailureCount)
	assert.Equal(t, result.Error, persisted.LastError)
	require.NotNil(t, persisted.LastProbeAt)
}
