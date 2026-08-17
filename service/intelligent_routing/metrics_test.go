package intelligent_routing

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestMetricsObserveAggregatesRoutingOutcomes(t *testing.T) {
	var metrics Metrics
	metrics.Observe(Observation{CandidateTier: 1, ExpectedSaving: .4, PlanningDuration: 3 * time.Millisecond})
	metrics.Observe(Observation{NoRoute: true, PlanningDuration: time.Millisecond})
	got := metrics.Snapshot()
	assert.EqualValues(t, 2, got.Planned)
	assert.EqualValues(t, 1, got.NoRoute)
	assert.EqualValues(t, 1, got.ByTier[1])
	assert.InDelta(t, .2, got.AverageExpectedSaving, .0001)
	assert.Equal(t, 2*time.Millisecond, got.AveragePlanningDuration)
}
