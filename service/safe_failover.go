package service

import (
	"context"
	"strings"
	"time"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

type SafeFailoverInput struct {
	RetryIndex            int
	MaxAttempts           int
	RelayMode             int
	ModelName             string
	IsStream              bool
	ResponseWritten       bool
	ReceivedResponseCount int
	AttemptElapsed        time.Duration
	ImageGuard            time.Duration
	RequestContextErr     error
	Error                 *types.NewAPIError
}

type SafeFailoverDecision struct {
	Retry  bool
	Reason string
}

func EvaluateSafeFailover(input SafeFailoverInput) SafeFailoverDecision {
	if input.Error == nil {
		return SafeFailoverDecision{Reason: "no_error"}
	}
	if input.MaxAttempts > 0 && input.RetryIndex >= input.MaxAttempts {
		return SafeFailoverDecision{Reason: "attempt_limit"}
	}
	if input.RequestContextErr != nil {
		if input.RequestContextErr == context.Canceled {
			return SafeFailoverDecision{Reason: "client_canceled"}
		}
		return SafeFailoverDecision{Reason: "request_deadline"}
	}
	if input.ResponseWritten || input.ReceivedResponseCount > 0 {
		return SafeFailoverDecision{Reason: "response_started"}
	}
	if types.IsSkipRetryError(input.Error) {
		return SafeFailoverDecision{Reason: "skip_retry_error"}
	}

	message := strings.ToLower(input.Error.Error())
	if isSafetyFailure(input.Error, message) {
		return SafeFailoverDecision{Reason: "content_safety"}
	}
	if hasAcceptanceEvidence(message) {
		return SafeFailoverDecision{Reason: "upstream_accepted"}
	}

	imageLike := IsImageLikeRelay(input.RelayMode, input.ModelName)
	if imageLike && input.ImageGuard > 0 && input.AttemptElapsed >= input.ImageGuard {
		return SafeFailoverDecision{Reason: "image_guard_elapsed"}
	}

	if types.IsChannelError(input.Error) {
		return SafeFailoverDecision{Retry: true, Reason: "channel_local_error"}
	}

	code := input.Error.StatusCode
	if code >= 200 && code < 300 {
		return SafeFailoverDecision{Reason: "success_status"}
	}

	// Transport failures have no valid HTTP response and are safe to move once
	// while the request context is still alive.
	if input.Error.GetErrorCode() == types.ErrorCodeDoRequestFailed || code < 100 || code > 599 {
		return SafeFailoverDecision{Retry: true, Reason: "transport_failure"}
	}

	switch {
	case code == 400:
		return SafeFailoverDecision{Reason: "client_or_protocol_400"}
	case code == 408:
		if imageLike && !hasNonAcceptanceEvidence(message) {
			return SafeFailoverDecision{Reason: "image_acceptance_ambiguous"}
		}
		return SafeFailoverDecision{Retry: true, Reason: "upstream_timeout"}
	case code == 409:
		return SafeFailoverDecision{Reason: "conflict"}
	case code == 429:
		return SafeFailoverDecision{Retry: true, Reason: "upstream_capacity"}
	case code == 451:
		return SafeFailoverDecision{Reason: "content_safety"}
	case code == 401 || code == 403 || code == 404:
		return SafeFailoverDecision{Retry: true, Reason: "channel_auth_or_mapping"}
	case code >= 300 && code < 400:
		return SafeFailoverDecision{Retry: true, Reason: "upstream_redirect"}
	case code >= 500:
		// Image providers can return 500/502/504 after accepting a task. A fast
		// failure is not proof that no billable work started, so only a direct
		// 503 rejection or explicit non-acceptance evidence may move channels.
		if imageLike && code != 503 && !hasNonAcceptanceEvidence(message) {
			return SafeFailoverDecision{Reason: "image_acceptance_ambiguous"}
		}
		return SafeFailoverDecision{Retry: true, Reason: "upstream_server_error"}
	default:
		return SafeFailoverDecision{Reason: "non_retryable_status"}
	}
}

func IsImageLikeRelay(relayMode int, modelName string) bool {
	if relayMode == relayconstant.RelayModeImagesGenerations ||
		relayMode == relayconstant.RelayModeImagesEdits {
		return true
	}
	name := strings.ToLower(modelName)
	for _, marker := range []string{
		"image", "imagen", "dall-e", "dalle", "flux", "seedream",
		"banana", "recraft", "ideogram",
	} {
		if strings.Contains(name, marker) {
			return true
		}
	}
	return false
}

func isSafetyFailure(err *types.NewAPIError, message string) bool {
	if err.GetErrorCode() == types.ErrorCodePromptBlocked || err.StatusCode == 451 {
		return true
	}
	for _, marker := range []string{
		"content safety", "safety policy", "safety filter", "prompt blocked",
		"content policy", "responsible ai policy", "moderation blocked",
		"prohibited content",
	} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

func hasAcceptanceEvidence(message string) bool {
	for _, marker := range []string{
		"task_id", "task id", "job_id", "job id", "operation_id",
		"operation id", "queued", "generating", "generation started",
		"billing succeeded", "already billed", "request accepted",
	} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

func hasNonAcceptanceEvidence(message string) bool {
	for _, marker := range []string{
		"not accepted", "request rejected", "task not created", "job not created",
		"operation not created", "generation not started", "not billed",
		"before dispatch", "upstream unavailable before request",
	} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}
