package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestSelectChannelWithLimits_GateHandleReleaseIsSafe exercises the
// GateHandle.Release contract that the relay loop depends on: the handle must
// be safe to Release even when no slot was ever acquired (nil receiver, empty
// GateKeys), and Release must hand the slot back so the gate is reusable. We
// drive the gate helpers directly to avoid spinning up the channel cache (the
// orchestrator's full loop still needs integration coverage elsewhere).
func TestSelectChannelWithLimits_GateHandleReleaseIsSafe(t *testing.T) {
	// nil receiver must not panic
	var h *GateHandle // nil
	h.Release()
	require.Nil(t, h)

	// empty GateKeys slice — Release is a no-op
	h = &GateHandle{}
	h.Release()
	require.Nil(t, h.GateKeys)

	// acquire one slot via TryAcquireConcurrency, record it on a handle,
	// Release it, and assert the slot is reusable by a fresh acquire.
	const key = "test:safe-release"
	require.True(t, TryAcquireConcurrency(key, 1), "first acquire must succeed")

	h = &GateHandle{GateKeys: []string{key}}
	require.False(t, TryAcquireConcurrency(key, 1), "gate must be full before Release")

	h.Release()
	// After release, a fresh acquire must succeed.
	require.True(t, TryAcquireConcurrency(key, 1), "slot must be reusable after Release")
	ReleaseConcurrency(key)
}

func TestSelectChannelWithLimits_FailedConcurrencyAcquireSkipsAndExcludes(t *testing.T) {
	// fill the per-channel semaphore to capacity
	const ch = 9302
	gate := channelGateKey(ch, -1)
	require.True(t, TryAcquireConcurrency(gate, 1))
	t.Cleanup(func() { ReleaseConcurrency(gate) })

	excluded := map[int]bool{}
	lim := ChannelLimits{Enabled: true, MaxConcurrency: 1}
	skip := evaluateChannelForLimits(ch, -1, lim, excluded)
	require.True(t, skip)
	require.True(t, excluded[ch])
}

func TestSelectChannelWithLimits_DisabledLimitAllowsEverything(t *testing.T) {
	excluded := map[int]bool{}
	lim := ChannelLimits{Enabled: false}
	skip := evaluateChannelForLimits(9303, -1, lim, excluded)
	require.False(t, skip)
}
