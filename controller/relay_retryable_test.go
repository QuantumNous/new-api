package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
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
