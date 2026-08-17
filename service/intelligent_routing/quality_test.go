package intelligent_routing

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestQualityTrackerUsesPriorUntilThirtySamplesThenBetaSmoothing(t *testing.T) {
	var tracker QualityTracker
	for i := 0; i < 29; i++ {
		tracker.Record("cheap", TaskSummary, i < 20)
	}
	assert.InDelta(t, .92, tracker.Predict("cheap", TaskSummary, .92), .0001)
	tracker.Record("cheap", TaskSummary, true)
	assert.InDelta(t, float64(21+8)/float64(30+10), tracker.Predict("cheap", TaskSummary, .92), .0001)
}

func TestQualityTrackerSeparatesModelsAndTasks(t *testing.T) {
	var tracker QualityTracker
	for i := 0; i < 30; i++ {
		tracker.Record("cheap", TaskCode, false)
	}
	assert.InDelta(t, .8, tracker.Predict("cheap", TaskSummary, .8), .0001)
	assert.InDelta(t, .2, tracker.Predict("cheap", TaskCode, .8), .0001)
}
