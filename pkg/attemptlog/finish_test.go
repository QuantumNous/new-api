package attemptlog

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestResolveFirstTokenTime pins the precedence between the content-aware
// timestamp and the relay layer's fallback. The distinction that matters is
// between nil meaning "the stream produced nothing" and nil meaning "we could
// not tell": the first is a measurement, the second must fall back.
func TestResolveFirstTokenTime(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	content := start.Add(900 * time.Millisecond)
	firstChunk := start.Add(50 * time.Millisecond)
	fallback := start.Add(60 * time.Millisecond)

	cases := []struct {
		name     string
		attempt  *Attempt
		fallback *time.Time
		want     *time.Time
	}{
		{
			name: "content time wins over the relay fallback",
			attempt: &Attempt{
				startTime:        start,
				firstChunkTime:   firstChunk,
				firstContentTime: content,
			},
			fallback: &fallback,
			want:     &content,
		},
		{
			name: "recognized chunks without content report no first token",
			attempt: &Attempt{
				startTime:      start,
				firstChunkTime: firstChunk,
			},
			fallback: &fallback,
			want:     nil,
		},
		{
			name: "unknown shape falls back to the relay timestamp",
			attempt: &Attempt{
				startTime:       start,
				firstChunkTime:  firstChunk,
				sawUnknownChunk: true,
			},
			fallback: &fallback,
			want:     &fallback,
		},
		{
			name: "no chunk observed falls back to the relay timestamp",
			attempt: &Attempt{
				startTime: start,
			},
			fallback: &fallback,
			want:     &fallback,
		},
		{
			name: "no chunk observed and no fallback yields nil",
			attempt: &Attempt{
				startTime: start,
			},
			fallback: nil,
			want:     nil,
		},
		{
			name: "content time is kept even when it precedes the fallback",
			attempt: &Attempt{
				startTime:        start,
				firstChunkTime:   firstChunk,
				firstContentTime: firstChunk,
			},
			fallback: &fallback,
			want:     &firstChunk,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := tc.attempt.resolveFirstTokenTime(tc.fallback)
			if tc.want == nil {
				assert.Nil(t, got)
				return
			}
			require.NotNil(t, got)
			assert.Equal(t, *tc.want, *got)
		})
	}
}

// TestResolveFirstTokenTimeRejectsStaleRetryFallback covers the carry-over bug.
// RelayInfo lives for the whole request and its first-response time is never
// reset between retries, so a retry must not inherit a timestamp from before it
// started. Without the guard this attempt would report a negative TTFT and an
// inflated generation window.
func TestResolveFirstTokenTimeRejectsStaleRetryFallback(t *testing.T) {
	t.Parallel()

	previousAttemptFirstToken := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	thisAttemptStart := previousAttemptFirstToken.Add(3 * time.Second)

	attempt := &Attempt{startTime: thisAttemptStart}

	assert.Nil(t, attempt.resolveFirstTokenTime(&previousAttemptFirstToken))
}

// TestContentFreeStreamClassifiesAsEmptyResponse ties the chunk verdict to the
// outcome code. An upstream that emits only a ping before dying used to be
// labelled stream_interrupted, which hid it among genuine mid-stream failures.
func TestContentFreeStreamClassifiesAsEmptyResponse(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	relayFirstResponse := start.Add(20 * time.Millisecond)

	attempt := &Attempt{
		startTime:      start,
		firstChunkTime: relayFirstResponse,
		features:       RequestFeatures{IsStream: true},
	}

	firstToken := attempt.resolveFirstTokenTime(&relayFirstResponse)
	require.Nil(t, firstToken, "a ping-only stream produced no token")

	outcome := Classify(ClassifyInput{
		StreamEndReason: streamEndScannerErr,
		SentFirstToken:  firstToken != nil,
		IsStream:        true,
	})
	assert.Equal(t, OutcomeEmptyResponse, outcome)
}

// TestContentStreamClassifiesAsInterrupted is the companion case: once real
// content has been delivered, an abnormal end is genuinely an interruption.
func TestContentStreamClassifiesAsInterrupted(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	relayFirstResponse := start.Add(20 * time.Millisecond)

	attempt := &Attempt{
		startTime:        start,
		firstChunkTime:   relayFirstResponse,
		firstContentTime: start.Add(800 * time.Millisecond),
		features:         RequestFeatures{IsStream: true},
	}

	firstToken := attempt.resolveFirstTokenTime(&relayFirstResponse)
	require.NotNil(t, firstToken)

	outcome := Classify(ClassifyInput{
		StreamEndReason: streamEndScannerErr,
		SentFirstToken:  firstToken != nil,
		IsStream:        true,
	})
	assert.Equal(t, OutcomeStreamInterrupted, outcome)
}

// TestBuildRecordTtftFromContentTime asserts the persisted columns, since
// ts_first_token and ttft_ms are what downstream training reads.
func TestBuildRecordTtftFromContentTime(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	roleOpener := start.Add(40 * time.Millisecond)
	content := start.Add(1200 * time.Millisecond)
	end := start.Add(5 * time.Second)

	attempt := &Attempt{
		startTime:        start,
		firstChunkTime:   roleOpener,
		firstContentTime: content,
		features:         RequestFeatures{IsStream: true},
		usageKnown:       true,
		outputTokens:     100,
	}

	firstToken := attempt.resolveFirstTokenTime(&roleOpener)
	record := attempt.buildRecord(nil, FinishInput{}, ClassifyInput{}, OutcomeOK, 200, end, firstToken)

	require.NotNil(t, record.TtftMs)
	assert.Equal(t, int64(1200), *record.TtftMs, "TTFT must be measured to the content chunk, not the role opener")
	require.NotNil(t, record.TsFirstToken)
	assert.Equal(t, content.UnixMilli(), *record.TsFirstToken)

	// The generation window runs from the first content chunk to the end, so
	// 100 tokens over the remaining 3.8s is ~26.3 tokens/sec.
	require.NotNil(t, record.TpsActual)
	assert.InDelta(t, 26.31, *record.TpsActual, 0.01)
}

func TestBuildRecordOmitsTtftForContentFreeStream(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Second)

	attempt := &Attempt{
		startTime:      start,
		firstChunkTime: start.Add(30 * time.Millisecond),
		features:       RequestFeatures{IsStream: true},
		usageKnown:     true,
		outputTokens:   0,
	}

	firstToken := attempt.resolveFirstTokenTime(nil)
	record := attempt.buildRecord(nil, FinishInput{}, ClassifyInput{}, OutcomeEmptyResponse, 200, end, firstToken)

	assert.Nil(t, record.TtftMs)
	assert.Nil(t, record.TsFirstToken)
	assert.Nil(t, record.TpsActual)
}

// TestBuildRecordTpsForNonStream covers the non-streaming rate, whose window is
// the whole attempt (ts_end - ts_start) because every token arrives with the
// single response.
func TestBuildRecordTpsForNonStream(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)

	cases := []struct {
		name         string
		end          time.Time
		outputTokens int
		wantTps      float64
	}{
		{
			name:         "whole-attempt window",
			end:          start.Add(4 * time.Second),
			outputTokens: 100,
			wantTps:      25.0,
		},
		{
			name:         "sub-millisecond window reports NULL, not Inf",
			end:          start,
			outputTokens: 100,
		},
		{
			name:         "zero output reports NULL",
			end:          start.Add(4 * time.Second),
			outputTokens: 0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			attempt := &Attempt{
				startTime:    start,
				features:     RequestFeatures{IsStream: false},
				usageKnown:   true,
				outputTokens: tc.outputTokens,
			}

			record := attempt.buildRecord(nil, FinishInput{}, ClassifyInput{}, OutcomeOK, 200, tc.end, nil)

			assert.Equal(t, tc.end.UnixMilli()-start.UnixMilli(), record.TsEnd-record.TsStart)
			if tc.wantTps == 0 {
				assert.Nil(t, record.TpsActual)
				return
			}
			require.NotNil(t, record.TpsActual)
			assert.InDelta(t, tc.wantTps, *record.TpsActual, 0.001)
		})
	}
}

// TestBuildRecordTpsSkipsStreamWithoutFirstToken pins the non-stream branch
// gate: an attempt that claims to stream but never produced a first token keeps
// TpsActual NULL instead of silently switching to the whole-attempt window.
func TestBuildRecordTpsSkipsStreamWithoutFirstToken(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	attempt := &Attempt{
		startTime:    start,
		features:     RequestFeatures{IsStream: true},
		usageKnown:   true,
		outputTokens: 100,
	}

	record := attempt.buildRecord(nil, FinishInput{}, ClassifyInput{}, OutcomeOK, 200, start.Add(4*time.Second), nil)

	assert.Nil(t, record.TpsActual)
}

func TestBuildRecordUsesClickHouseInt32PointerTypes(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Second)
	maxTokens := 4096
	retryAfter := 3

	attempt := &Attempt{
		startTime: start,
		features: RequestFeatures{
			MaxTokensReq: &maxTokens,
		},
		retryAfterHint: &retryAfter,
		usageKnown:     true,
		inputTokens:    100,
		outputTokens:   40,
		cachedTokens:   10,
		costActual:     20,
	}

	record := attempt.buildRecord(nil, FinishInput{}, ClassifyInput{}, OutcomeOK, 200, end, nil)

	require.NotNil(t, record.MaxTokensReq)
	require.NotNil(t, record.HttpStatus)
	require.NotNil(t, record.RetryAfterHint)
	require.NotNil(t, record.InputTokensActual)
	require.NotNil(t, record.OutputTokensActual)
	require.NotNil(t, record.CachedTokens)
	require.NotNil(t, record.CostActual)
	assert.Equal(t, int32(4096), *record.MaxTokensReq)
	assert.Equal(t, int32(200), *record.HttpStatus)
	assert.Equal(t, int32(3), *record.RetryAfterHint)
	assert.Equal(t, int32(100), *record.InputTokensActual)
	assert.Equal(t, int32(40), *record.OutputTokensActual)
	assert.Equal(t, int32(10), *record.CachedTokens)
	assert.Equal(t, int32(20), *record.CostActual)
}

func TestInt32PtrRejectsOutOfRangeValues(t *testing.T) {
	t.Parallel()

	assert.Nil(t, int32Ptr(1<<31))
	assert.Nil(t, int32Ptr(-1<<31-1))
	assert.Equal(t, int32(1<<31-1), *int32Ptr(1<<31 - 1))
}
