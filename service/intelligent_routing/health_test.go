package intelligent_routing

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestHealthTrackerClassifiesAndExpiresRollingWindow(t *testing.T) {
	var tracker HealthTracker
	now := time.Unix(1000, 0)
	for i := 0; i < 20; i++ {
		tracker.RecordAt(7, i != 0, now)
	}
	got := tracker.SnapshotAt(7, now)
	assert.Equal(t, HealthDegraded, got.Tier)
	assert.InDelta(t, .05, got.FailureRate, .0001)
	tracker.RecordAt(7, true, now.Add(61*time.Second))
	got = tracker.SnapshotAt(7, now.Add(61*time.Second))
	assert.Equal(t, HealthProbation, got.Tier)
	assert.Zero(t, got.FailureRate)
}

func TestHealthTrackerOpensCircuitForRepeatedFailures(t *testing.T) {
	var tracker HealthTracker
	now := time.Unix(1000, 0)
	for i := 0; i < 20; i++ {
		tracker.RecordAt(9, false, now)
	}
	assert.Equal(t, HealthOpen, tracker.SnapshotAt(9, now).Tier)
}
