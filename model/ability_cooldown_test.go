package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestGetChannel_DBPath_FiltersCooldown verifies the cooldown filter
// applied in the DB-path selector. This is the path that runs when
// MemoryCacheEnabled is false, which is the default for single-node
// SQLite deployments. Before the fix, the DB path was completely
// bypassed by the cooldown overlay — a 400 overdue-payment would
// re-pick the same channel forever until manually disabled.
func TestGetChannel_DBPath_FiltersCooldown(t *testing.T) {
	ClearCooldown(8001)
	ClearCooldown(8002)
	t.Cleanup(func() {
		ClearCooldown(8001)
		ClearCooldown(8002)
	})

	// Mark channel 8001 in cooldown.
	MarkCooldown(8001, time.Now().Add(1*time.Hour))

	// We can't actually exercise GetChannel without a DB, but we can
	// verify the filter helper it uses. The actual DB call is covered
	// by the integration tests. The unit-level check is that
	// InCooldownIDs returns the expected set, since the filter is just
	// `if _, skip := cooldown[id]; skip { skip }`.
	now := time.Now()
	got := InCooldownIDs(now)
	require.Contains(t, got, 8001, "channel 8001 should be in cooldown")
	require.NotContains(t, got, 8002, "channel 8002 should not be in cooldown")
}

// TestInCooldownIDs_EmptyAfterGC documents that once the GC evicts
// expired entries, InCooldownIDs returns nil. This is the path that
// lets a channel "auto-recover" without operator action — the
// operator's "fix the upstream" workflow becomes "wait for the
// cooldown to elapse", which is the whole point of the redesign.
func TestInCooldownIDs_EmptyAfterGC(t *testing.T) {
	ClearCooldown(9001)
	t.Cleanup(func() { ClearCooldown(9001) })

	MarkCooldown(9001, time.Now().Add(50*time.Millisecond))
	require.True(t, IsInCooldown(9001, time.Now()))

	time.Sleep(80 * time.Millisecond)
	gcAllExpired(time.Now())

	require.False(t, IsInCooldown(9001, time.Now()),
		"after GC sweep, channel must no longer be in cooldown")
	require.Nil(t, InCooldownIDs(time.Now()),
		"empty cooldown set must return nil to avoid hot-path alloc")
}
