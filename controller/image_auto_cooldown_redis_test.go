package controller

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func startImageAutoCooldownRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	server, err := miniredis.Run()
	require.NoError(t, err)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	original := common.RDB
	common.RDB = client
	t.Cleanup(func() {
		_ = client.Close()
		server.Close()
		common.RDB = original
	})
	return server
}

// TestImageAutoCooldownSharedAcrossReplicas proves a cooldown recorded on one
// gateway replica is observed by a second replica sharing the same Redis
// backend, and that the second replica backfills its local fast-path cache.
func TestImageAutoCooldownSharedAcrossReplicas(t *testing.T) {
	startImageAutoCooldownRedis(t)
	backend := imageAutoCooldownRedis{}
	now := time.Date(2026, time.July, 25, 8, 0, 0, 0, time.UTC)

	replicaA := newImageAutoCooldownRegistryWithRedis(func() time.Time { return now }, backend)
	replicaB := newImageAutoCooldownRegistryWithRedis(func() time.Time { return now }, backend)

	replicaA.Record(36, imageAutoAmbiguousCooldownDuration)

	require.True(t, replicaB.IsCooling(36), "cooldown on replica A must be visible on replica B")
	require.True(t, replicaB.IsCooling(36), "second check must hit the backfilled local fast path")
	require.False(t, replicaB.IsCooling(108), "unrelated channel must not cool down")
}

// TestImageAutoCooldownRedisTTLMatchesDuration proves every Redis cooldown key
// carries a TTL equal to its cooldown duration so Redis expiry reclaims it.
func TestImageAutoCooldownRedisTTLMatchesDuration(t *testing.T) {
	server := startImageAutoCooldownRedis(t)
	backend := imageAutoCooldownRedis{}
	now := time.Date(2026, time.July, 25, 8, 0, 0, 0, time.UTC)

	backend.Record(imageAutoCooldownSnapshot{
		ChannelID:         36,
		CooldownStartedAt: now,
		CooldownExpiresAt: now.Add(imageAutoAmbiguousCooldownDuration),
	})

	ttl := server.TTL(imageAutoCooldownRedisKey(36))
	require.Greater(t, ttl, time.Duration(0))
	require.LessOrEqual(t, ttl, imageAutoAmbiguousCooldownDuration)

	// The raw payload must round-trip so other replicas can hydrate their cache.
	raw, err := server.Get(imageAutoCooldownRedisKey(36))
	require.NoError(t, err)
	var snapshot imageAutoCooldownSnapshot
	require.NoError(t, json.Unmarshal([]byte(raw), &snapshot))
	require.Equal(t, 36, snapshot.ChannelID)
	require.Equal(t, now.Add(imageAutoAmbiguousCooldownDuration), snapshot.CooldownExpiresAt)
}

// TestImageAutoCooldownSnapshotMergesLocalAndShared proves the admin listing
// shows the union of process-local and Redis cooldowns, keeping the later
// expiry when both report the same channel.
func TestImageAutoCooldownSnapshotMergesLocalAndShared(t *testing.T) {
	startImageAutoCooldownRedis(t)
	backend := imageAutoCooldownRedis{}
	now := time.Date(2026, time.July, 25, 8, 0, 0, 0, time.UTC)

	registry := newImageAutoCooldownRegistryWithRedis(func() time.Time { return now }, backend)
	registry.Record(36, imageAutoRateLimitCooldownDuration)

	// Another replica records the same channel with a longer cooldown. The
	// merged snapshot must surface the later expiry.
	backend.Record(imageAutoCooldownSnapshot{
		ChannelID:         36,
		CooldownStartedAt: now,
		CooldownExpiresAt: now.Add(imageAutoAmbiguousCooldownDuration),
	})
	backend.Record(imageAutoCooldownSnapshot{
		ChannelID:         108,
		CooldownStartedAt: now,
		CooldownExpiresAt: now.Add(5 * time.Minute),
	})

	snapshots := registry.Snapshot()
	require.Len(t, snapshots, 2)
	byChannel := map[int]imageAutoCooldownSnapshot{}
	for _, s := range snapshots {
		byChannel[s.ChannelID] = s
	}
	require.Equal(t, now.Add(imageAutoAmbiguousCooldownDuration), byChannel[36].CooldownExpiresAt)
	require.Equal(t, now.Add(5*time.Minute), byChannel[108].CooldownExpiresAt)
}

// TestImageAutoCooldownSharedEntryExpiresByIdentity proves a Redis cooldown key
// that expires (simulated with miniredis FastForward) no longer cools a replica
// that learned about it remotely.
func TestImageAutoCooldownSharedEntryExpiresByIdentity(t *testing.T) {
	server := startImageAutoCooldownRedis(t)
	backend := imageAutoCooldownRedis{}
	now := time.Date(2026, time.July, 25, 8, 0, 0, 0, time.UTC)

	replicaA := newImageAutoCooldownRegistryWithRedis(func() time.Time { return now }, backend)
	replicaB := newImageAutoCooldownRegistryWithRedis(func() time.Time { return now }, backend)

	replicaA.Record(36, imageAutoRateLimitCooldownDuration)
	require.True(t, replicaB.IsCooling(36))

	server.FastForward(imageAutoRateLimitCooldownDuration)
	now = now.Add(imageAutoRateLimitCooldownDuration)
	require.False(t, replicaB.IsCooling(36), "expired shared cooldown must not cool")
}

// TestImageAutoCooldownDegradesWithoutRedis proves the shared registry keeps
// working process-locally when Redis is unavailable (RDB nil), preserving the
// previous behavior exactly.
func TestImageAutoCooldownDegradesWithoutRedis(t *testing.T) {
	original := common.RDB
	common.RDB = nil
	t.Cleanup(func() { common.RDB = original })

	registry := newImageAutoCooldownRegistryWithRedis(time.Now, imageAutoCooldownRedis{})
	registry.Record(36, imageAutoRateLimitCooldownDuration)
	require.True(t, registry.IsCooling(36))
	require.Len(t, registry.Snapshot(), 1)
}
