package perfmetrics

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/hwperf"
	"github.com/stretchr/testify/assert"
)

// The speed figure only takes requests that really generated text: a ping of one
// token or a request without output must not drag the average to about one
// word per second.
func TestSampleCountsForSpeedNeedsARealAnswer(t *testing.T) {
	minimum := int64(hwperf.MinOutputTokens)
	for _, tc := range []struct {
		name   string
		sample Sample
		want   bool
	}{
		{"real answer", Sample{OutputTokens: 200, GenerationMs: 4000}, true},
		{"exactly the minimum", Sample{OutputTokens: minimum, GenerationMs: 1000}, true},
		{"ping of one token", Sample{OutputTokens: 1, GenerationMs: 9000}, false},
		{"just under the minimum", Sample{OutputTokens: minimum - 1, GenerationMs: 1000}, false},
		{"no output", Sample{OutputTokens: 0, GenerationMs: 3000}, false},
		{"no generation time", Sample{OutputTokens: 200, GenerationMs: 0}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, tc.sample.countsForSpeed())
		})
	}
}

func TestBucketSpeedIgnoresPingsAndEmptyRequests(t *testing.T) {
	bucket := &atomicBucket{}
	bucket.add(Sample{Success: true, OutputTokens: 200, GenerationMs: 4000})
	for range 50 {
		bucket.add(Sample{Success: true, OutputTokens: 1, GenerationMs: 9000})
	}
	bucket.add(Sample{Success: true, OutputTokens: 0, GenerationMs: 3000})

	snapshot := bucket.snapshot()
	assert.Equal(t, int64(52), snapshot.requestCount, "every request still counts")
	assert.Equal(t, 50.0, avgTps(snapshot), "200 tokens over 4 s, not diluted by the pings")

	pingsOnly := &atomicBucket{}
	pingsOnly.add(Sample{Success: true, OutputTokens: 1, GenerationMs: 9000})
	assert.Zero(t, avgTps(pingsOnly.snapshot()), "no real answer, no speed")
}
