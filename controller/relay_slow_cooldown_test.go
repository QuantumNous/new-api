package controller

import (
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
)

// TestShouldCooldownSlowChannelMeasuresFromAttemptStart is the core of the fix:
// slow-channel cooldown must measure first-token latency from the SUCCESSFUL
// attempt's start, not the overall request start. A request that failed over
// across dead channels for 30s and then got its first token 5s into a healthy
// channel's attempt must NOT cool that healthy channel — even though the
// StartTime-based latency (35s) exceeds the 30s threshold.
func TestShouldCooldownSlowChannelMeasuresFromAttemptStart(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)
	reqStart := base
	attemptStart := base.Add(30 * time.Second) // 30s burned on earlier dead channels
	firstResp := attemptStart.Add(5 * time.Second)

	info := &relaycommon.RelayInfo{StartTime: reqStart, FirstResponseTime: firstResp}

	// Guard the premise: the OLD StartTime-based frt would have tripped the cooldown.
	if firstResp.Sub(reqStart) < service.SlowChannelFRTThreshold {
		t.Fatal("test setup invalid: StartTime-based frt should exceed threshold")
	}

	frt, slow := shouldCooldownSlowChannel(info, attemptStart)
	if slow {
		t.Fatalf("a channel that served first token 5s into its own attempt must not be cooled (frt=%v)", frt)
	}
}

// TestShouldCooldownSlowChannelIgnoresAffinityColdStart guards the second, and
// far more damaging, way this cooldown can blame a channel for latency that is
// not its fault. When we release a request's prompt-cache affinity because its
// sticky channel went slow, the channel we migrate TO answers from a cold cache:
// a 240k-token prefill measured 23.3s in prod, and a larger prompt clears the
// 30s threshold outright. Cooling on that would pull the channel we just picked
// for being the fastest out of rotation for 30 minutes — and push the migrated
// traffic back onto the slow channels it just fled.
func TestShouldCooldownSlowChannelIgnoresAffinityColdStart(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)
	firstResp := base.Add(35 * time.Second) // full cold prefill on a huge prompt

	info := &relaycommon.RelayInfo{
		StartTime:         base,
		FirstResponseTime: firstResp,
		AffinityColdStart: true,
	}

	// Guard the premise: without the exemption this frt trips the cooldown.
	if firstResp.Sub(base) < service.SlowChannelFRTThreshold {
		t.Fatal("test setup invalid: frt should exceed the threshold")
	}

	if frt, slow := shouldCooldownSlowChannel(info, base); slow {
		t.Fatalf("a cold prefill we caused by migrating must not cool the destination channel (frt=%v)", frt)
	}
}

// TestShouldCooldownSlowChannelTripsOnGenuinelySlowAttempt confirms a channel
// that is genuinely slow to first token on its own attempt is still cooled.
func TestShouldCooldownSlowChannelTripsOnGenuinelySlowAttempt(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)
	firstResp := base.Add(35 * time.Second) // 35s to first token on this attempt

	info := &relaycommon.RelayInfo{StartTime: base, FirstResponseTime: firstResp}

	frt, slow := shouldCooldownSlowChannel(info, base)
	if !slow {
		t.Fatalf("a 35s-to-first-token attempt must be cooled (frt=%v)", frt)
	}
}

// TestShouldCooldownSlowChannelSkipsNonAttributable covers the guards: no
// response sent, and a first response that predates this attempt (set by an
// earlier failed attempt) — neither should cool the channel.
func TestShouldCooldownSlowChannelSkipsNonAttributable(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)

	if _, slow := shouldCooldownSlowChannel(&relaycommon.RelayInfo{StartTime: base}, base); slow {
		t.Fatal("no response sent must not cool the channel")
	}

	// First response was recorded before this attempt started.
	info := &relaycommon.RelayInfo{StartTime: base, FirstResponseTime: base.Add(2 * time.Second)}
	if _, slow := shouldCooldownSlowChannel(info, base.Add(10*time.Second)); slow {
		t.Fatal("a first response predating this attempt must not cool the channel")
	}
}
