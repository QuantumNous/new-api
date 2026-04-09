package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFilterOtherRatiosForDurationOnlyModel(t *testing.T) {
	filtered := FilterOtherRatiosForBillingModel("grok-imagine-1.0-video", map[string]float64{
		"seconds":    6,
		"size":       1.666667,
		"resolution": 1.5,
	})

	assert.Equal(t, map[string]float64{
		"seconds": 6,
	}, filtered)
}

func TestFilterOtherRatiosForResolutionOnlyModel(t *testing.T) {
	filtered := FilterOtherRatiosForBillingModel("nano-banana-pro", map[string]float64{
		"resolution":        2,
		"quality":           1.5,
		"output_resolution": 4,
		"n":                 3,
	})

	assert.Empty(t, filtered)
}
