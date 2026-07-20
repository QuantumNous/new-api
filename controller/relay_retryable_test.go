package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func newTestContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	return c
}

func TestIsRetryableChannelError(t *testing.T) {
	cases := []struct {
		name string
		err  *types.NewAPIError
		want bool
	}{
		{
			name: "upstream 503 retryable",
			err:  types.NewErrorWithStatusCode(errors.New("no available accounts"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable),
			want: true,
		},
		{
			name: "upstream 502 retryable",
			err:  types.NewErrorWithStatusCode(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway),
			want: true,
		},
		{
			name: "capability 403 retryable",
			err:  types.NewErrorWithStatusCode(errors.New("Image generation is not enabled for this group"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden),
			want: true,
		},
		{
			name: "internal 500 retryable",
			err:  types.NewErrorWithStatusCode(errors.New("boom"), types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError),
			want: true,
		},
		{
			name: "client 400 not retryable",
			err:  types.NewErrorWithStatusCode(errors.New("invalid request"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry()),
			want: false,
		},
		{
			name: "success 200 not retryable",
			err:  types.NewErrorWithStatusCode(errors.New("ok"), types.ErrorCodeBadResponseStatusCode, http.StatusOK),
			want: false,
		},
		{
			name: "nil error not retryable",
			err:  nil,
			want: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := newTestContext()
			if got := isRetryableChannelError(c, tc.err); got != tc.want {
				t.Fatalf("isRetryableChannelError(%s) = %v, want %v", tc.name, got, tc.want)
			}
		})
	}
}

func TestShouldRetryAllowsTransientAffinityFailure(t *testing.T) {
	c := newTestContext()
	c.Set("channel_affinity_skip_retry_on_failure", true)
	err := types.NewErrorWithStatusCode(errors.New("upstream unavailable"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)

	if !shouldRetry(c, err, 1) {
		t.Fatal("expected transient 5xx from a sticky channel to fall back")
	}
}

func TestShouldRetryStopsOnSemanticContextLimitError(t *testing.T) {
	c := newTestContext()
	err := types.NewErrorWithStatusCode(
		errors.New("Your input exceeds the context window of this model. Please adjust your input and try again."),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadGateway,
	)

	if shouldRetry(c, err, 2) {
		t.Fatal("expected context-window errors to stop retrying even when upstream reports 502")
	}
	if isRetryableChannelError(c, err) {
		t.Fatal("expected context-window errors not to trigger transient channel cooldown")
	}
}

func TestProcessChannelErrorDoesNotCooldownSemanticContextLimitError(t *testing.T) {
	err := types.NewErrorWithStatusCode(
		errors.New("Your input exceeds the context window of this model. Please adjust your input and try again."),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadGateway,
	)

	if shouldCooldownForUpstreamError(err) {
		t.Fatal("expected semantic context errors not to trigger upstream cooldown")
	}
}

func TestIsRetryableChannelErrorSkipsSpecificChannel(t *testing.T) {
	c := newTestContext()
	c.Set("specific_channel_id", 5)
	err := types.NewErrorWithStatusCode(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)
	if isRetryableChannelError(c, err) {
		t.Fatalf("expected pinned specific channel to skip retry classification")
	}
}

// TestShouldRetrySkipsClientCanceled guards the prod bug where one client abort
// burned through every channel: doRequest surfaces context.Canceled as a
// channel-class error, and types.IsChannelError returns true unconditionally
// (before the retry-count gate), so the loop retried on channel after channel —
// each failing in milliseconds and each getting cooled for 5 minutes.
func TestShouldRetrySkipsClientCanceled(t *testing.T) {
	c := newTestContext()

	canceled := types.NewErrorWithStatusCode(
		fmt.Errorf("do request failed: %w", context.Canceled),
		types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	if shouldRetry(c, canceled, 3) {
		t.Fatal("a client-canceled request must not be retried onto other channels")
	}
	if !isClientCanceledError(canceled) {
		t.Fatal("isClientCanceledError must recognize a wrapped context.Canceled")
	}

	// Our own timeout is a real channel signal and must still fail over.
	timeout := types.NewErrorWithStatusCode(
		fmt.Errorf("do request failed: %w", context.DeadlineExceeded),
		types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	if isClientCanceledError(timeout) {
		t.Fatal("context.DeadlineExceeded must not be treated as a client cancellation")
	}
	if !shouldRetry(c, timeout, 3) {
		t.Fatal("an upstream timeout must still retry onto another channel")
	}
}

func TestUpstreamRateLimitExtraRetryRequiresUncommittedUpstream429(t *testing.T) {
	upstream429 := types.NewErrorWithStatusCode(
		errors.New("Too many pending requests, please retry later"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)
	upstream429.UpstreamStatusCode = http.StatusTooManyRequests

	assert.True(t, isUpstreamRateLimitError(upstream429))
	assert.True(t, shouldUseUpstreamRateLimitExtraRetry(newTestContext(), &relaycommon.RelayInfo{}, upstream429))

	mapped429 := types.NewErrorWithStatusCode(
		errors.New("Upstream rate limit exceeded, please retry later"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusServiceUnavailable,
	)
	mapped429.UpstreamStatusCode = http.StatusTooManyRequests
	assert.True(t, isUpstreamRateLimitError(mapped429), "client-facing status mappings must not hide the upstream 429")
	assert.True(t, shouldUseUpstreamRateLimitExtraRetry(newTestContext(), &relaycommon.RelayInfo{}, mapped429))

	local429 := types.NewErrorWithStatusCode(
		errors.New("local rate limit"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)
	assert.False(t, isUpstreamRateLimitError(local429), "local 429s must stay outside channel retry policy")
	assert.False(t, shouldUseUpstreamRateLimitExtraRetry(newTestContext(), &relaycommon.RelayInfo{}, local429))

	quota429 := types.NewOpenAIError(
		errors.New("You exceeded your current quota"),
		types.ErrorCode("insufficient_quota"),
		http.StatusTooManyRequests,
	)
	quota429.UpstreamStatusCode = http.StatusTooManyRequests
	assert.False(t, isUpstreamRateLimitError(quota429), "quota exhaustion is structural, not a transient rate-limit retry")
	assert.False(t, shouldUseUpstreamRateLimitExtraRetry(newTestContext(), &relaycommon.RelayInfo{}, quota429))

	pinned := newTestContext()
	pinned.Set("specific_channel_id", 17)
	assert.False(t, shouldUseUpstreamRateLimitExtraRetry(pinned, &relaycommon.RelayInfo{}, upstream429), "pinned channel requests must not switch channels")

	committed := newTestContext()
	committed.Writer.WriteHeaderNow()
	assert.True(t, relayResponseCommitted(committed, &relaycommon.RelayInfo{}))
	assert.False(t, shouldUseUpstreamRateLimitExtraRetry(committed, &relaycommon.RelayInfo{}, upstream429))
}

func TestUpstreamRateLimitExtraRetryStopsAfterAttemptStreamData(t *testing.T) {
	apiErr := types.NewErrorWithStatusCode(
		errors.New("rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)
	apiErr.UpstreamStatusCode = http.StatusTooManyRequests
	streamStatus := relaycommon.NewStreamStatus()
	streamStatus.RecordDataReceived()
	info := &relaycommon.RelayInfo{StreamStatus: streamStatus}

	assert.True(t, relayResponseCommitted(newTestContext(), info))
	assert.False(t, shouldUseUpstreamRateLimitExtraRetry(newTestContext(), info, apiErr))
}

func TestScheduleUpstreamRateLimitExtraRetryRestartsAutoSelection(t *testing.T) {
	c := newTestContext()
	apiErr := types.NewErrorWithStatusCode(
		errors.New("Too many pending requests, please retry later"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)
	apiErr.UpstreamStatusCode = http.StatusTooManyRequests
	retryParam := &service.RetryParam{
		Ctx:        c,
		TokenGroup: "auto",
		Retry:      common.GetPointer(0),
	}

	assert.True(t, scheduleUpstreamRateLimitExtraRetry(c, &relaycommon.RelayInfo{}, retryParam, apiErr, false, 2))
	retryParam.IncreaseRetry()
	assert.Equal(t, 2, retryParam.GetRetry())
	assert.False(t, scheduleUpstreamRateLimitExtraRetry(c, &relaycommon.RelayInfo{}, retryParam, apiErr, true, 2), "the dedicated fallback is single-use")
}
