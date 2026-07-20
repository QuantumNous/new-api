package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func TestShouldRetryUsesUpstream429ProvenanceAfterStatusMapping(t *testing.T) {
	err := types.NewErrorWithStatusCode(
		errors.New("Upstream rate limit exceeded, please retry later"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadRequest,
	)
	err.UpstreamStatusCode = http.StatusTooManyRequests

	c := newTestContext()
	assert.True(t, isRetryableChannelError(c, err))
	assert.True(t, shouldRetry(c, err, 1))
	assert.False(t, shouldRetry(c, err, 0), "upstream 429 must still respect the configured retry budget")

	pinned := newTestContext()
	pinned.Set("specific_channel_id", 17)
	assert.False(t, isRetryableChannelError(pinned, err))
	assert.False(t, shouldRetry(pinned, err, 1), "a pinned request cannot switch channels")

	affinity := newTestContext()
	affinity.Set("channel_affinity_skip_retry_on_failure", true)
	assert.True(t, isRetryableChannelError(affinity, err), "upstream provenance must override a mapped 400 affinity decision")
	assert.True(t, shouldRetry(affinity, err, 1))

	mapped503 := types.NewErrorWithStatusCode(
		errors.New("Upstream rate limit exceeded, please retry later"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusServiceUnavailable,
	)
	mapped503.UpstreamStatusCode = http.StatusTooManyRequests
	assert.True(t, isRetryableChannelError(affinity, mapped503))
	assert.True(t, shouldRetry(affinity, mapped503, 1), "429 retry behavior must not depend on the client-facing mapping")
}

func TestProcessChannelErrorCoolsMappedUpstream429ForTwoHours(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	t.Cleanup(model.ClearChannelCooldownsForTest)

	const channelID = 9005
	err := types.NewErrorWithStatusCode(
		errors.New("Upstream rate limit exceeded, please retry later"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadRequest,
	)
	err.UpstreamStatusCode = http.StatusTooManyRequests

	processChannelError(
		newTestContext(),
		*types.NewChannelError(channelID, 1, "rate-limited", false, "key", false),
		err,
	)

	reason, expires, cooling := model.GetChannelCooldown(channelID)
	require.True(t, cooling)
	assert.Contains(t, reason, "upstream_rate_limit")
	remaining := time.Until(time.Unix(expires, 0))
	assert.Greater(t, remaining, 119*time.Minute)
	assert.Less(t, remaining, 121*time.Minute)
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

func TestUpstreamCapacityFallbackRequiresUncommittedTransientCapacityError(t *testing.T) {
	newResponsesInfo := func() *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{IsStream: true, RelayMode: relayconstant.RelayModeResponses}
	}
	upstream429 := types.NewErrorWithStatusCode(
		errors.New("Too many pending requests, please retry later"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)
	upstream429.UpstreamStatusCode = http.StatusTooManyRequests

	assert.True(t, isUpstreamRateLimitError(upstream429))
	assert.True(t, isFastUpstreamCapacityError(upstream429))
	assert.True(t, shouldUseUpstreamCapacityFallback(newTestContext(), newResponsesInfo(), upstream429))

	mapped429 := types.NewErrorWithStatusCode(
		errors.New("Upstream rate limit exceeded, please retry later"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusServiceUnavailable,
	)
	mapped429.UpstreamStatusCode = http.StatusTooManyRequests
	assert.True(t, isUpstreamRateLimitError(mapped429), "client-facing status mappings must not hide the upstream 429")
	assert.True(t, isFastUpstreamCapacityError(mapped429))
	assert.True(t, shouldUseUpstreamCapacityFallback(newTestContext(), newResponsesInfo(), mapped429))

	distributor503 := types.WithOpenAIError(
		types.OpenAIError{
			Message: "No available channel for model gpt-5.6-sol under group gpt plus (distributor)",
			Type:    "new_api_error",
			Code:    string(types.ErrorCodeModelNotFound),
		},
		http.StatusServiceUnavailable,
	)
	distributor503.UpstreamStatusCode = http.StatusServiceUnavailable
	assert.True(t, isFastUpstreamCapacityError(distributor503), "an upstream distributor with no account capacity should try another channel")
	assert.True(t, shouldUseUpstreamCapacityFallback(newTestContext(), newResponsesInfo(), distributor503))

	provider503 := types.WithOpenAIError(
		types.OpenAIError{
			Message: "The requested model does not exist",
			Type:    "invalid_request_error",
			Code:    string(types.ErrorCodeModelNotFound),
		},
		http.StatusServiceUnavailable,
	)
	provider503.UpstreamStatusCode = http.StatusServiceUnavailable
	assert.False(t, isFastUpstreamCapacityError(provider503), "provider model errors are not transient distributor capacity failures")

	distributor404 := types.WithOpenAIError(
		types.OpenAIError{
			Message: "No available channel for model gpt-5.6-sol under group gpt plus (distributor)",
			Type:    "new_api_error",
			Code:    string(types.ErrorCodeModelNotFound),
		},
		http.StatusNotFound,
	)
	distributor404.UpstreamStatusCode = http.StatusNotFound
	assert.False(t, isFastUpstreamCapacityError(distributor404), "a 404 model capability error must stay within configured retries")

	generic503 := types.NewErrorWithStatusCode(
		errors.New("service unavailable"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusServiceUnavailable,
	)
	generic503.UpstreamStatusCode = http.StatusServiceUnavailable
	assert.False(t, isFastUpstreamCapacityError(generic503), "generic 503s may be slow outages and must stay within configured retries")

	local429 := types.NewErrorWithStatusCode(
		errors.New("local rate limit"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)
	assert.False(t, isUpstreamRateLimitError(local429), "local 429s must stay outside channel retry policy")
	assert.False(t, isFastUpstreamCapacityError(local429))
	assert.False(t, shouldUseUpstreamCapacityFallback(newTestContext(), newResponsesInfo(), local429))

	local503 := types.NewErrorWithStatusCode(
		errors.New("No available channel for model gpt-5.6-sol"),
		types.ErrorCodeModelNotFound,
		http.StatusServiceUnavailable,
	)
	assert.False(t, isFastUpstreamCapacityError(local503), "gateway-local capacity errors must not expand upstream attempts")

	quota429 := types.NewOpenAIError(
		errors.New("You exceeded your current quota"),
		types.ErrorCode("insufficient_quota"),
		http.StatusTooManyRequests,
	)
	quota429.UpstreamStatusCode = http.StatusTooManyRequests
	assert.True(t, isUpstreamRateLimitError(quota429), "every genuine upstream 429 must switch away from the affected channel")
	assert.False(t, isFastUpstreamCapacityError(quota429), "structural quota errors must stay inside the configured retry budget")
	assert.False(t, shouldUseUpstreamCapacityFallback(newTestContext(), newResponsesInfo(), quota429))

	imageInfo := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations}
	assert.False(t, shouldUseUpstreamCapacityFallback(newTestContext(), imageInfo, upstream429), "side-effecting generation routes must not expand attempts")
	nonStreamingInfo := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponses}
	assert.False(t, shouldUseUpstreamCapacityFallback(newTestContext(), nonStreamingInfo, upstream429), "non-streaming responses may legitimately wait longer than the fallback header deadline")
	compactInfo := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponsesCompact}
	assert.False(t, shouldUseUpstreamCapacityFallback(newTestContext(), compactInfo, upstream429), "response compaction must not inherit the streaming response-header deadline")

	pinned := newTestContext()
	pinned.Set("specific_channel_id", 17)
	assert.False(t, shouldUseUpstreamCapacityFallback(pinned, newResponsesInfo(), upstream429), "pinned channel requests must not switch channels")

	committed := newTestContext()
	committed.Writer.WriteHeaderNow()
	assert.True(t, relayResponseCommitted(committed, newResponsesInfo()))
	assert.False(t, shouldUseUpstreamCapacityFallback(committed, newResponsesInfo(), upstream429))
}

func TestUpstreamCapacityFallbackStopsAfterAttemptStreamData(t *testing.T) {
	apiErr := types.NewErrorWithStatusCode(
		errors.New("rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)
	apiErr.UpstreamStatusCode = http.StatusTooManyRequests
	streamStatus := relaycommon.NewStreamStatus()
	streamStatus.RecordDataReceived()
	info := &relaycommon.RelayInfo{IsStream: true, RelayMode: relayconstant.RelayModeResponses, StreamStatus: streamStatus}

	assert.True(t, relayResponseCommitted(newTestContext(), info))
	assert.False(t, shouldUseUpstreamCapacityFallback(newTestContext(), info, apiErr))
}

func TestScheduleUpstreamCapacityFallbackIsBoundedAndRestartsAutoSelection(t *testing.T) {
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
	startedAt := time.Unix(100, 0)

	info := &relaycommon.RelayInfo{IsStream: true, RelayMode: relayconstant.RelayModeResponses}
	assert.True(t, scheduleUpstreamCapacityFallback(c, info, retryParam, apiErr, 500*time.Millisecond, 0, 2, time.Time{}, startedAt))
	retryParam.IncreaseRetry()
	assert.Equal(t, 2, retryParam.GetRetry())

	assert.True(t, scheduleUpstreamCapacityFallback(c, info, retryParam, apiErr, 400*time.Millisecond, 1, 2, startedAt, startedAt.Add(2*time.Second)),
		"a second fast capacity failure may try one more untried channel")
	assert.False(t, scheduleUpstreamCapacityFallback(c, info, retryParam, apiErr, 300*time.Millisecond, 2, 2, startedAt, startedAt.Add(3*time.Second)),
		"capacity fallback attempts must have a hard count limit")
	assert.False(t, scheduleUpstreamCapacityFallback(c, info, retryParam, apiErr, 300*time.Millisecond, 1, 2, startedAt, startedAt.Add(6*time.Second)),
		"a slow fallback attempt must not expand first-token latency with another channel")
	assert.True(t, scheduleUpstreamCapacityFallback(c, info, retryParam, apiErr, 3*time.Second, 0, 2, time.Time{}, startedAt),
		"a delayed genuine upstream 429 must still be shielded from Codex")

	distributor503 := types.WithOpenAIError(
		types.OpenAIError{
			Message: "No available channel for model gpt-5.6-sol under group gpt plus (distributor)",
			Type:    "new_api_error",
			Code:    string(types.ErrorCodeModelNotFound),
		},
		http.StatusServiceUnavailable,
	)
	distributor503.UpstreamStatusCode = http.StatusServiceUnavailable
	assert.False(t, scheduleUpstreamCapacityFallback(c, info, retryParam, distributor503, 3*time.Second, 0, 2, time.Time{}, startedAt),
		"a slow distributor 503 must not expand first-token latency")
}

func TestChannelSelectionExhaustionIsDistinctFromSelectorFailure(t *testing.T) {
	exhausted := types.NewError(&channelSelectionExhaustedError{message: "no untried channel"}, types.ErrorCodeGetChannelFailed)
	selectorFailure := types.NewError(errors.New("database unavailable"), types.ErrorCodeGetChannelFailed)

	assert.True(t, isChannelSelectionExhausted(exhausted))
	assert.Equal(t, "no untried channel", exhausted.Error())
	assert.False(t, isChannelSelectionExhausted(selectorFailure))
}

func TestCapacityFallbackHeaderDeadlinePreservesSecondAttempt(t *testing.T) {
	startedAt := time.Unix(100, 0)

	firstDeadline := capacityFallbackHeaderDeadline(startedAt, startedAt.Add(500*time.Millisecond), 1)
	assert.Equal(t, startedAt.Add(2500*time.Millisecond), firstDeadline)
	assert.True(t, canContinueCapacityFallbackAfterHeaderDeadline(1, startedAt, firstDeadline))

	secondDeadline := capacityFallbackHeaderDeadline(startedAt, firstDeadline, 2)
	assert.Equal(t, startedAt.Add(upstreamCapacityFallbackWindow), secondDeadline)
	assert.False(t, canContinueCapacityFallbackAfterHeaderDeadline(2, startedAt, firstDeadline))

	nearOverallDeadline := capacityFallbackHeaderDeadline(startedAt, startedAt.Add(4*time.Second), 1)
	assert.Equal(t, startedAt.Add(upstreamCapacityFallbackWindow), nearOverallDeadline)
	assert.False(t, canContinueCapacityFallbackAfterHeaderDeadline(1, startedAt, startedAt.Add(upstreamCapacityFallbackWindow)))
}
