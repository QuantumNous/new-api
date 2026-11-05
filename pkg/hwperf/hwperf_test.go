package hwperf

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// The speed figure only takes requests that really generated text: a ping of one
// token or a request without output must not drag the average to about one
// word per second.
func TestCountsForSpeedNeedsARealAnswer(t *testing.T) {
	for _, tc := range []struct {
		name         string
		outputTokens int64
		generationMs int64
		want         bool
	}{
		{"real answer", 200, 4000, true},
		{"exactly the minimum", MinOutputTokens, 1000, true},
		{"ping of one token", 1, 9000, false},
		{"just under the minimum", MinOutputTokens - 1, 1000, false},
		{"no output", 0, 3000, false},
		{"no generation time", 200, 0, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, CountsForSpeed(tc.outputTokens, tc.generationMs))
		})
	}
}
