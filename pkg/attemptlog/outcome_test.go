package attemptlog

import (
	"context"
	"errors"
	"fmt"
	"net"
	"testing"

	"github.com/stretchr/testify/assert"
)

type fakeTimeoutError struct{}

func (fakeTimeoutError) Error() string   { return "i/o timeout" }
func (fakeTimeoutError) Timeout() bool   { return true }
func (fakeTimeoutError) Temporary() bool { return false }

var _ net.Error = fakeTimeoutError{}

// TestClassifyClientCancelledWins locks in the ordering guarantee that matters
// most for training data: a user closing the window must never be attributed to
// the provider, no matter what else the attempt looked like. If this regressed,
// success rates would be silently polluted by client behaviour, and because
// slower channels get cancelled more often the pollution would correlate with
// latency.
//
// client_cancelled is derived only from signals that fire during the failure:
// the stream scanner's client_gone end reason, or a context.Canceled error.
// It is deliberately NOT derived from c.Request.Context().Err() at Finish
// time, which is already done for any normally-completed request and would
// mislabel successes.
func TestClassifyClientCancelledWins(t *testing.T) {
	cases := []struct {
		name string
		in   ClassifyInput
	}{
		{
			name: "context.Canceled error alone",
			in:   ClassifyInput{Err: context.Canceled},
		},
		{
			name: "wrapped Canceled outranks upstream 500",
			in: ClassifyInput{
				HTTPStatus: 500,
				Err:        fmt.Errorf("internal server error: %w", context.Canceled),
			},
		},
		{
			name: "wrapped Canceled outranks 429",
			in: ClassifyInput{
				HTTPStatus: 429,
				Err:        fmt.Errorf("rate limited: %w", context.Canceled),
			},
		},
		{
			name: "stream end client_gone",
			in: ClassifyInput{
				IsStream:        true,
				StreamEndReason: streamEndClientGone,
				SentFirstToken:  true,
			},
		},
		{
			name: "wrapped context.Canceled",
			in: ClassifyInput{
				Err: fmt.Errorf("relay aborted: %w", context.Canceled),
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, OutcomeClientCancelled, Classify(tc.in))
			assert.Equal(t, TerminatedByClient, TerminatedBy(tc.in, OutcomeClientCancelled))
		})
	}
}

// TestClassifyStreamInterrupted covers the case that is invisible to a
// status-code-only view: the stream began, HTTP was 200, and the gateway's own
// handler returned no error, yet the stream died partway through. An idle-gap
// timeout after the first token is labelled stream_interrupted, not
// timeout_total, because the observable failure is an interrupted stream:
// timeout_total is reserved for a whole-call deadline with no such signal.
func TestClassifyStreamInterrupted(t *testing.T) {
	cases := []struct {
		name     string
		reason   string
		expected string
	}{
		{name: "idle timeout mid-stream", reason: streamEndTimeout, expected: OutcomeStreamInterrupted},
		{name: "upstream read failure", reason: streamEndScannerErr, expected: OutcomeStreamInterrupted},
		{name: "downstream write failure", reason: streamEndPingFail, expected: OutcomeStreamInterrupted},
		{name: "handler panic", reason: streamEndPanic, expected: OutcomeStreamInterrupted},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := ClassifyInput{
				IsStream:        true,
				HTTPStatus:      200,
				StreamEndReason: tc.reason,
				SentFirstToken:  true,
			}
			assert.Equal(t, tc.expected, Classify(in))
		})
	}
}

// TestClassifyAbnormalStreamEndWithoutError guards the specific bug that a
// stream which failed with a nil error and HTTP 200 must not be scored as a
// success. The stream scanner returns nil in exactly these cases.
func TestClassifyAbnormalStreamEndWithoutError(t *testing.T) {
	cases := []struct {
		name           string
		reason         string
		sentFirstToken bool
		expected       string
	}{
		{
			name:           "interrupted after first token",
			reason:         streamEndScannerErr,
			sentFirstToken: true,
			expected:       OutcomeStreamInterrupted,
		},
		{
			name:           "died before any content",
			reason:         streamEndScannerErr,
			sentFirstToken: false,
			expected:       OutcomeEmptyResponse,
		},
		{
			name:           "timed out before any content",
			reason:         streamEndTimeout,
			sentFirstToken: false,
			expected:       OutcomeTimeoutTTFT,
		},
		{
			name:           "clean end but no content",
			reason:         streamEndDone,
			sentFirstToken: false,
			expected:       OutcomeEmptyResponse,
		},
		{
			name:           "clean end with content",
			reason:         streamEndDone,
			sentFirstToken: true,
			expected:       OutcomeOK,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := ClassifyInput{
				IsStream:        true,
				HTTPStatus:      200,
				StreamEndReason: tc.reason,
				SentFirstToken:  tc.sentFirstToken,
			}
			assert.Equal(t, tc.expected, Classify(in))
		})
	}
}

// TestClassifyOutcomeCodes covers the full label vocabulary. These are the
// training labels, so every branch is pinned by an explicit case: a silent
// reclassification would invalidate previously collected data.
func TestClassifyOutcomeCodes(t *testing.T) {
	cases := []struct {
		name     string
		in       ClassifyInput
		expected string
	}{
		{
			name:     "success",
			in:       ClassifyInput{HTTPStatus: 200},
			expected: OutcomeOK,
		},
		{
			name:     "rate limited",
			in:       ClassifyInput{HTTPStatus: 429, Err: errors.New("rate limit")},
			expected: OutcomeRatelimit429,
		},
		{
			name:     "unauthorized",
			in:       ClassifyInput{HTTPStatus: 401, Err: errors.New("invalid key")},
			expected: OutcomeAuthError,
		},
		{
			name:     "forbidden",
			in:       ClassifyInput{HTTPStatus: 403, Err: errors.New("denied")},
			expected: OutcomeAuthError,
		},
		{
			name:     "invalid channel key",
			in:       ClassifyInput{InternalErrCode: "channel:invalid_key"},
			expected: OutcomeAuthError,
		},
		{
			name:     "context length exceeded",
			in:       ClassifyInput{HTTPStatus: 400, Err: errors.New("This model's maximum context length is 8192 tokens")},
			expected: OutcomeContextLengthExceeded,
		},
		{
			name:     "prompt too long",
			in:       ClassifyInput{HTTPStatus: 400, Err: errors.New("prompt is too long: 9000 tokens")},
			expected: OutcomeContextLengthExceeded,
		},
		{
			name:     "plain invalid request",
			in:       ClassifyInput{HTTPStatus: 400, Err: errors.New("unknown parameter")},
			expected: OutcomeInvalidRequest,
		},
		{
			name:     "payload too large maps to invalid request",
			in:       ClassifyInput{HTTPStatus: 413, Err: errors.New("body too large")},
			expected: OutcomeInvalidRequest,
		},
		{
			name:     "upstream quota exhausted by status",
			in:       ClassifyInput{HTTPStatus: 402, Err: errors.New("payment required")},
			expected: OutcomeQuotaExhausted,
		},
		{
			name:     "gateway quota exhaustion",
			in:       ClassifyInput{InternalErrCode: "insufficient_user_quota"},
			expected: OutcomeQuotaExhausted,
		},
		{
			name:     "server error 500",
			in:       ClassifyInput{HTTPStatus: 500, Err: errors.New("internal")},
			expected: OutcomeUpstream5xx,
		},
		{
			name:     "server error 503",
			in:       ClassifyInput{HTTPStatus: 503, Err: errors.New("overloaded")},
			expected: OutcomeUpstream5xx,
		},
		{
			name:     "gateway timeout status",
			in:       ClassifyInput{HTTPStatus: 504, Err: errors.New("gateway timeout")},
			expected: OutcomeTimeoutTotal,
		},
		{
			name:     "connect timeout",
			in:       ClassifyInput{Err: errors.New("dial tcp 10.0.0.1:443: i/o timeout")},
			expected: OutcomeTimeoutConnect,
		},
		{
			name:     "net timeout before any response",
			in:       ClassifyInput{Err: fakeTimeoutError{}},
			expected: OutcomeTimeoutTTFT,
		},
		{
			name:     "deadline exceeded after headers",
			in:       ClassifyInput{Err: context.DeadlineExceeded, HTTPStatus: 200},
			expected: OutcomeTimeoutTTFT,
		},
		{
			name:     "connection reset",
			in:       ClassifyInput{Err: errors.New("read tcp: connection reset by peer")},
			expected: OutcomeConnReset,
		},
		{
			name:     "empty response",
			in:       ClassifyInput{InternalErrCode: "empty_response"},
			expected: OutcomeEmptyResponse,
		},
		{
			name:     "malformed upstream body",
			in:       ClassifyInput{InternalErrCode: "bad_response_body"},
			expected: OutcomeMalformedResponse,
		},
		{
			name:     "sensitive words detected",
			in:       ClassifyInput{InternalErrCode: "sensitive_words_detected"},
			expected: OutcomeContentFilter,
		},
		{
			name:     "prompt blocked upstream",
			in:       ClassifyInput{InternalErrCode: "prompt_blocked", HTTPStatus: 400},
			expected: OutcomeContentFilter,
		},
		{
			name:     "unattributed error falls back",
			in:       ClassifyInput{Err: errors.New("something unknown"), HTTPStatus: 502},
			expected: OutcomeUpstream5xx,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, Classify(tc.in))
		})
	}
}

// TestTerminatedBy pins the attribution of who ended the attempt, which is the
// difference between blaming the provider and blaming the gateway or the user.
func TestTerminatedBy(t *testing.T) {
	cases := []struct {
		name     string
		in       ClassifyInput
		outcome  string
		expected string
	}{
		{
			name:     "clean completion",
			outcome:  OutcomeOK,
			expected: TerminatedByUpstream,
		},
		{
			name:     "client cancelled",
			outcome:  OutcomeClientCancelled,
			expected: TerminatedByClient,
		},
		{
			name:     "client gone stream",
			in:       ClassifyInput{StreamEndReason: streamEndClientGone},
			outcome:  OutcomeStreamInterrupted,
			expected: TerminatedByClient,
		},
		{
			name:     "gateway enforced timeout",
			outcome:  OutcomeTimeoutTotal,
			expected: TerminatedByGateway,
		},
		{
			name:     "provider error status",
			in:       ClassifyInput{HTTPStatus: 500},
			outcome:  OutcomeUpstream5xx,
			expected: TerminatedByUpstream,
		},
		{
			name:     "transport failure with no response",
			in:       ClassifyInput{Err: errors.New("connection reset")},
			outcome:  OutcomeConnReset,
			expected: TerminatedByGateway,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, TerminatedBy(tc.in, tc.outcome))
		})
	}
}
