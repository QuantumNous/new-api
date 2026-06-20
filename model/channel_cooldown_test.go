package model

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestMarkCooldown_StoresExpiry(t *testing.T) {
	ClearCooldown(101)
	t.Cleanup(func() { ClearCooldown(101) })

	until := time.Now().Add(1 * time.Hour)
	MarkCooldown(101, until)
	require.True(t, IsInCooldown(101, time.Now()))
}

func TestMarkCooldown_RejectsPastTime(t *testing.T) {
	ClearCooldown(102)
	t.Cleanup(func() { ClearCooldown(102) })

	// A past time must not register. This guards against a clock-skew
	// bug where a caller passes the zero time.
	MarkCooldown(102, time.Now().Add(-1*time.Second))
	require.False(t, IsInCooldown(102, time.Now()))
}

func TestMarkCooldown_RejectsZeroID(t *testing.T) {
	// id == 0 is a sentinel; it must not be marked. Otherwise the
	// selector would skip a non-existent "channel 0" and the
	// InCooldownIDs map would carry a meaningless entry forever.
	MarkCooldown(0, time.Now().Add(1*time.Hour))
	require.False(t, IsInCooldown(0, time.Now()))
}

func TestMarkCooldown_LongerWins(t *testing.T) {
	id := 103
	ClearCooldown(id)
	t.Cleanup(func() { ClearCooldown(id) })

	earlier := time.Now().Add(5 * time.Second)
	later := time.Now().Add(1 * time.Hour)

	MarkCooldown(id, later)
	MarkCooldown(id, earlier) // this should be ignored

	// Just before the earlier expiry, channel is still in cooldown.
	require.True(t, IsInCooldown(id, time.Now()))

	// Just after the earlier expiry but before the later expiry, channel
	// is still in cooldown because the later expiry was kept.
	probeTime := earlier.Add(10 * time.Millisecond)
	require.True(t, IsInCooldown(id, probeTime))
}


func TestMarkCooldown_LaterWinsOverShorter(t *testing.T) {
	// Implementation policy: when a new MarkCooldown arrives with a
	// shorter expiry than what's already stored, the longer expiry
	// stays. This means a fresh failure (longer cooldown applied by
	// processChannelError) cannot be accidentally shortened by a
	// later stale or shorter signal. The opposite (shorter wins) is
	// also defensible, but the more conservative choice for the
	// "we hit another error" case is to keep the user-visible "this
	// channel is sick" window as long as possible.
	id := 104
	ClearCooldown(id)
	t.Cleanup(func() { ClearCooldown(id) })

	long := time.Now().Add(1 * time.Hour)
	short := time.Now().Add(10 * time.Second)

	MarkCooldown(id, long)
	MarkCooldown(id, short) // ignored: long.After(short)

	probeTime := short.Add(50 * time.Millisecond)
	require.True(t, IsInCooldown(id, probeTime),
		"longer expiry must be retained over a later shorter one")
}
func TestInCooldownIDs_EmptyReturnsNil(t *testing.T) {
	// Drain any prior test state.
	for id := range InCooldownIDs(time.Now()) {
		ClearCooldown(id)
	}
	// All-clear: result should be nil to avoid allocating empty maps
	// on the hot path.
	require.Nil(t, InCooldownIDs(time.Now()))
}

func TestGcExpiredCooldown(t *testing.T) {
	ClearCooldown(301)
	ClearCooldown(302)
	t.Cleanup(func() {
		ClearCooldown(301)
		ClearCooldown(302)
	})

	// Mark both as cooldowns starting from the *current* clock with
	// different durations, then advance the clock for the GC probe.
	// This is the realistic shape: a long-running process where
	// wall-clock time has passed since the cooldown was set.
	base := time.Now()
	MarkCooldown(301, base.Add(50*time.Millisecond))   // expires soon
	MarkCooldown(302, base.Add(1*time.Hour))           // long-lived

	time.Sleep(80 * time.Millisecond) // let the first cooldown elapse

	removed := gcExpiredCooldown(time.Now())
	require.Equal(t, 1, removed, "expected exactly one expired entry to be removed")

	// The still-active one must remain; the expired one must be gone.
	require.True(t, IsInCooldown(302, time.Now()))
	require.False(t, IsInCooldown(301, time.Now()))
}

// TestCooldownConcurrentSafe stresses the cooldown map under concurrent
// reads and writes to catch obvious data races. Run with `go test -race`.
func TestCooldownConcurrentSafe(t *testing.T) {
	const goroutines = 16
	const iterations = 200

	var wg sync.WaitGroup
	wg.Add(goroutines)
	for g := 0; g < goroutines; g++ {
		go func(base int) {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				id := base*goroutines + i%goroutines
				MarkCooldown(id, time.Now().Add(50*time.Millisecond))
				_ = IsInCooldown(id, time.Now())
				_ = InCooldownIDs(time.Now())
			}
		}(g)
	}
	wg.Wait()
}

func TestMarkKeyCooldown_StoresExpiry(t *testing.T) {
	channelId := 501
	keyIndex := 0
	ClearKeyCooldown(channelId, keyIndex)
	t.Cleanup(func() { ClearKeyCooldown(channelId, keyIndex) })

	MarkKeyCooldown(channelId, keyIndex, time.Now().Add(1*time.Hour))
	require.True(t, IsKeyInCooldown(channelId, keyIndex, time.Now()))
	require.False(t, IsKeyInCooldown(channelId, keyIndex+1, time.Now()),
		"cooldown on key 0 must not affect key 1")
}

func TestMarkKeyCooldown_RejectsPastTime(t *testing.T) {
	channelId, keyIndex := 502, 1
	ClearKeyCooldown(channelId, keyIndex)
	t.Cleanup(func() { ClearKeyCooldown(channelId, keyIndex) })

	MarkKeyCooldown(channelId, keyIndex, time.Now().Add(-1*time.Second))
	require.False(t, IsKeyInCooldown(channelId, keyIndex, time.Now()))
}

func TestMarkKeyCooldown_RejectsNegativeIndex(t *testing.T) {
	channelId := 503
	MarkKeyCooldown(channelId, -1, time.Now().Add(1*time.Hour))
	require.False(t, IsKeyInCooldown(channelId, -1, time.Now()))
}

func TestInCooldownKeyIndices_OnlyRequestedChannel(t *testing.T) {
	// Set cooldowns for two different channels; the result for one
	// must not bleed into the other.
	ClearKeyCooldown(601, 0)
	ClearKeyCooldown(601, 1)
	ClearKeyCooldown(602, 0)
	t.Cleanup(func() {
		ClearKeyCooldown(601, 0)
		ClearKeyCooldown(601, 1)
		ClearKeyCooldown(602, 0)
	})

	MarkKeyCooldown(601, 0, time.Now().Add(1*time.Hour))
	MarkKeyCooldown(601, 1, time.Now().Add(1*time.Hour))
	MarkKeyCooldown(602, 0, time.Now().Add(1*time.Hour))

	got601 := InCooldownKeyIndices(601, time.Now())
	require.Contains(t, got601, 0)
	require.Contains(t, got601, 1)
	require.NotContains(t, got601, 5,
		"key index from a different channel must not appear here")

	got602 := InCooldownKeyIndices(602, time.Now())
	require.Contains(t, got602, 0)
	require.NotContains(t, got602, 1)
}

func TestInCooldownKeyIndices_EmptyReturnsNil(t *testing.T) {
	// Drain prior test state.
	for id := range InCooldownIDs(time.Now()) {
		ClearCooldown(id)
	}
	for k := range keyCooldownMap {
		channelId := int(k >> keyCooldownKeyIndexBits)
		keyIndex := int(k & ((uint64(1) << keyCooldownKeyIndexBits) - 1))
		ClearKeyCooldown(channelId, keyIndex)
	}
	// Probe a channel that has no cooldowns; result must be nil so the
	// hot path in GetNextEnabledKey doesn't allocate a map.
	require.Nil(t, InCooldownKeyIndices(999, time.Now()))
}

func TestGcAllExpired_BothMaps(t *testing.T) {
	// Drain any leftover state from prior tests in the same binary
	// so the per-id counts we assert below are deterministic. This
	// only matters because the cooldown maps are package globals.
	for id := range InCooldownIDs(time.Now()) {
		ClearCooldown(id)
	}
	for k := range keyCooldownMap {
		cid := int(k >> keyCooldownKeyIndexBits)
		idx := int(k & ((uint64(1) << keyCooldownKeyIndexBits) - 1))
		ClearKeyCooldown(cid, idx)
	}

	ClearCooldown(701)
	ClearKeyCooldown(701, 0)
	t.Cleanup(func() {
		ClearCooldown(701)
		ClearKeyCooldown(701, 0)
		ClearKeyCooldown(701, 1)
	})

	base := time.Now()
	MarkCooldown(701, base.Add(50*time.Millisecond))         // expires soon
	MarkKeyCooldown(701, 0, base.Add(50*time.Millisecond))   // expires soon
	MarkKeyCooldown(701, 1, base.Add(1*time.Hour))            // long-lived

	time.Sleep(80 * time.Millisecond)

	ch, key := gcAllExpired(time.Now())
	require.Equal(t, 1, ch, "channel map: 1 expired, 0 retained")
	require.Equal(t, 1, key, "key map: 1 expired, 1 retained")

	// Long-lived key remains.
	require.True(t, IsKeyInCooldown(701, 1, time.Now()))
	require.False(t, IsKeyInCooldown(701, 0, time.Now()))
}

// TestClearChannelCooldown is the operator's escape hatch: it must
// remove every overlay entry that belongs to the given channel
// (channel-level + every per-key entry) and leave entries for other
// channels untouched. The returned counts let the caller report
// "cleared 1 channel + 3 keys" in the response.
func TestClearChannelCooldown(t *testing.T) {
	ClearCooldown(8001)
	ClearKeyCooldown(8001, 0)
	ClearKeyCooldown(8001, 1)
	ClearKeyCooldown(8002, 0)
	t.Cleanup(func() {
		ClearCooldown(8001)
		ClearCooldown(8002)
		ClearKeyCooldown(8001, 0)
		ClearKeyCooldown(8001, 1)
		ClearKeyCooldown(8002, 0)
	})

	MarkCooldown(8001, time.Now().Add(1*time.Hour))
	MarkKeyCooldown(8001, 0, time.Now().Add(1*time.Hour))
	MarkKeyCooldown(8001, 1, time.Now().Add(1*time.Hour))
	MarkKeyCooldown(8002, 0, time.Now().Add(1*time.Hour))

	ch, key := ClearChannelCooldown(8001)
	require.Equal(t, 1, ch, "channel-level entry for 8001 must be removed")
	require.Equal(t, 2, key, "both key entries for 8001 must be removed")

	require.False(t, IsInCooldown(8001, time.Now()),
		"channel 8001 must no longer be in cooldown after clear")
	require.False(t, IsKeyInCooldown(8001, 0, time.Now()),
		"key 0 of channel 8001 must no longer be in cooldown")
	require.False(t, IsKeyInCooldown(8001, 1, time.Now()),
		"key 1 of channel 8001 must no longer be in cooldown")

	// Channel 8002 must be untouched — the clear is per-channel,
	// not global. This is what makes the function safe to call
	// from a UI button that targets a single channel.
	require.True(t, IsKeyInCooldown(8002, 0, time.Now()),
		"channel 8002's cooldowns must not be touched when clearing 8001")
}

// TestClearChannelCooldown_NoEntries exercises the no-op case: the
// function must return (0, 0) when the channel had nothing pending.
// Important for the response semantics: 0 removed is a success,
// not a 404.
func TestClearChannelCooldown_NoEntries(t *testing.T) {
	ClearCooldown(8003)
	ClearKeyCooldown(8003, 0)
	t.Cleanup(func() {
		ClearCooldown(8003)
		ClearKeyCooldown(8003, 0)
	})

	ch, key := ClearChannelCooldown(8003)
	require.Equal(t, 0, ch)
	require.Equal(t, 0, key)
}

// TestClearChannelCooldown_ZeroID guards against a programming
// error (id=0 sentinel). A zero id would otherwise match every
// channel id shifted into the high bits, which would wipe the
// entire map. The function short-circuits to (0, 0) instead.
func TestClearChannelCooldown_ZeroID(t *testing.T) {
	MarkCooldown(8004, time.Now().Add(1*time.Hour))
	t.Cleanup(func() { ClearCooldown(8004) })

	ch, key := ClearChannelCooldown(0)
	require.Equal(t, 0, ch)
	require.Equal(t, 0, key)
	require.True(t, IsInCooldown(8004, time.Now()),
		"calling clear with id=0 must not wipe other channels")
}
