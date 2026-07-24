package service

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestEvaluateSafeFailover(t *testing.T) {
	makeErr := func(status int, code types.ErrorCode, message string) *types.NewAPIError {
		return types.NewErrorWithStatusCode(errors.New(message), code, status)
	}

	tests := []struct {
		name   string
		input  SafeFailoverInput
		retry  bool
		reason string
	}{
		{
			name: "capacity 429 switches once",
			input: SafeFailoverInput{
				MaxAttempts: 1,
				Error:       makeErr(http.StatusTooManyRequests, types.ErrorCodeBadResponseStatusCode, "capacity exhausted"),
			},
			retry: true, reason: "upstream_capacity",
		},
		{
			name: "content safety never switches",
			input: SafeFailoverInput{
				MaxAttempts: 1,
				Error:       makeErr(http.StatusForbidden, types.ErrorCodePromptBlocked, "prompt blocked"),
			},
			reason: "content_safety",
		},
		{
			name: "image 502 without non-acceptance evidence is blocked",
			input: SafeFailoverInput{
				MaxAttempts:    1,
				RelayMode:      relayconstant.RelayModeImagesGenerations,
				AttemptElapsed: 5 * time.Second,
				ImageGuard:     60 * time.Second,
				Error:          makeErr(http.StatusBadGateway, types.ErrorCodeBadResponseStatusCode, "generation unavailable"),
			},
			reason: "image_acceptance_ambiguous",
		},
		{
			name: "image 502 with non-acceptance evidence may switch",
			input: SafeFailoverInput{
				MaxAttempts:    1,
				RelayMode:      relayconstant.RelayModeImagesGenerations,
				AttemptElapsed: 5 * time.Second,
				ImageGuard:     60 * time.Second,
				Error:          makeErr(http.StatusBadGateway, types.ErrorCodeBadResponseStatusCode, "request rejected; task not created"),
			},
			retry: true, reason: "upstream_server_error",
		},
		{
			name: "image 503 direct rejection may switch",
			input: SafeFailoverInput{
				MaxAttempts:    1,
				RelayMode:      relayconstant.RelayModeImagesGenerations,
				AttemptElapsed: 5 * time.Second,
				ImageGuard:     60 * time.Second,
				Error:          makeErr(http.StatusServiceUnavailable, types.ErrorCodeBadResponseStatusCode, "service unavailable"),
			},
			retry: true, reason: "upstream_server_error",
		},
		{
			name: "long image 502 is blocked",
			input: SafeFailoverInput{
				MaxAttempts:    1,
				ModelName:      "gemini-3-pro-image-preview",
				AttemptElapsed: 61 * time.Second,
				ImageGuard:     60 * time.Second,
				Error:          makeErr(http.StatusBadGateway, types.ErrorCodeBadResponseStatusCode, "generation failed"),
			},
			reason: "image_guard_elapsed",
		},
		{
			name: "accepted image task is blocked",
			input: SafeFailoverInput{
				MaxAttempts: 1,
				ModelName:   "gpt-image-2",
				Error:       makeErr(http.StatusServiceUnavailable, types.ErrorCodeBadResponseStatusCode, "job_id=abc queued"),
			},
			reason: "upstream_accepted",
		},
		{
			name: "response bytes block switch",
			input: SafeFailoverInput{
				MaxAttempts:           1,
				ReceivedResponseCount: 1,
				Error:                 makeErr(http.StatusBadGateway, types.ErrorCodeBadResponseStatusCode, "stream interrupted"),
			},
			reason: "response_started",
		},
		{
			name: "client cancellation blocks switch",
			input: SafeFailoverInput{
				MaxAttempts:       1,
				RequestContextErr: context.Canceled,
				Error:             makeErr(http.StatusBadGateway, types.ErrorCodeBadResponseStatusCode, "connection closed"),
			},
			reason: "client_canceled",
		},
		{
			name: "transport failure switches",
			input: SafeFailoverInput{
				MaxAttempts: 1,
				Error:       makeErr(http.StatusInternalServerError, types.ErrorCodeDoRequestFailed, "dial tcp: connection refused"),
			},
			retry: true, reason: "transport_failure",
		},
		{
			name: "400 does not fan out",
			input: SafeFailoverInput{
				MaxAttempts: 1,
				Error:       makeErr(http.StatusBadRequest, types.ErrorCodeBadResponseStatusCode, "invalid argument"),
			},
			reason: "client_or_protocol_400",
		},
		{
			name: "positive attempt cap blocks the next switch",
			input: SafeFailoverInput{
				RetryIndex:  1,
				MaxAttempts: 1,
				Error:       makeErr(http.StatusTooManyRequests, types.ErrorCodeBadResponseStatusCode, "capacity exhausted"),
			},
			reason: "attempt_limit",
		},
		{
			name: "zero attempt cap allows safe retries until candidates exhaust",
			input: SafeFailoverInput{
				RetryIndex:  7,
				MaxAttempts: 0,
				Error:       makeErr(http.StatusTooManyRequests, types.ErrorCodeBadResponseStatusCode, "capacity exhausted"),
			},
			retry: true, reason: "upstream_capacity",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			decision := EvaluateSafeFailover(test.input)
			require.Equal(t, test.retry, decision.Retry)
			require.Equal(t, test.reason, decision.Reason)
		})
	}
}

func TestIsImageLikeRelay(t *testing.T) {
	require.True(t, IsImageLikeRelay(relayconstant.RelayModeImagesEdits, "anything"))
	require.True(t, IsImageLikeRelay(relayconstant.RelayModeUnknown, "gemini-3-pro-image-preview"))
	require.True(t, IsImageLikeRelay(relayconstant.RelayModeUnknown, "nano-banana-pro"))
	require.False(t, IsImageLikeRelay(relayconstant.RelayModeUnknown, "gpt-5.5"))
}
