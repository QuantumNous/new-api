package attemptlog

import (
	"context"
	"errors"
	"net"
	"strings"
)

// Outcome codes. These are the training labels, so the set is closed and the
// strings are stable: renaming one invalidates previously collected data.
const (
	OutcomeOK                    = "ok"
	OutcomeRatelimit429          = "ratelimit_429"
	OutcomeAuthError             = "auth_error"
	OutcomeContextLengthExceeded = "context_length_exceeded"
	OutcomeInvalidRequest        = "invalid_request"
	OutcomeQuotaExhausted        = "quota_exhausted"
	OutcomeUpstream5xx           = "upstream_5xx"
	OutcomeTimeoutConnect        = "timeout_connect"
	OutcomeTimeoutTTFT           = "timeout_ttft"
	OutcomeTimeoutTotal          = "timeout_total"
	OutcomeConnReset             = "conn_reset"
	OutcomeStreamInterrupted     = "stream_interrupted"
	OutcomeContentFilter         = "content_filter"
	OutcomeEmptyResponse         = "empty_response"
	OutcomeMalformedResponse     = "malformed_response"
	OutcomeClientCancelled       = "client_cancelled"
)

// terminated_by values.
const (
	TerminatedByUpstream = "upstream"
	TerminatedByGateway  = "gateway"
	TerminatedByClient   = "client"
)

// Stream end reasons, mirrored from relay/common.StreamEndReason as plain
// strings so this package does not import the relay layer.
const (
	streamEndDone        = "done"
	streamEndEOF         = "eof"
	streamEndHandlerStop = "handler_stop"
	streamEndClientGone  = "client_gone"
	streamEndTimeout     = "timeout"
	streamEndScannerErr  = "scanner_error"
	streamEndPingFail    = "ping_fail"
	streamEndPanic       = "panic"
)

// ClassifyInput carries everything the classifier needs. Every field is a
// primitive or a stdlib type so this stays testable in isolation.
type ClassifyInput struct {
	// Err is the gateway's error for this attempt, nil on success.
	Err error
	// InternalErrCode is the gateway's own error code string, e.g. "empty_response".
	InternalErrCode string
	// HTTPStatus is the upstream HTTP status. 0 when no response was received.
	HTTPStatus int
	// ErrMessage is the upstream/transport error text used for substring probes.
	ErrMessage string
	// StreamEndReason is StreamStatus.EndReason, empty for non-stream attempts.
	StreamEndReason string
	// SentFirstToken reports whether any content chunk reached the client.
	SentFirstToken bool
	// IsStream reports whether this attempt was a streaming request.
	IsStream bool
}

// Classify maps an attempt to an outcome code.
//
// client_cancelled is derived only from authoritative signals that fire during
// the failure itself: the stream scanner's client_gone end reason, or a
// context.Captured error propagated through the relay error. It is NOT derived
// from c.Request.Context().Err() at Finish time: that context is already done
// for any normally-completed request by the time Finish runs, so it would
// mislabel every success as a client cancellation.
//
// Order matters. client_cancelled is checked first on purpose: a user closing
// the window is not the provider's fault, and if it fell through to a generic
// failure branch it would pollute success-rate statistics. Because slower
// providers get cancelled more often, that would also form a feedback loop
// where latency is rewarded. stream_interrupted is checked next because it can
// carry HTTP 200 and would otherwise be invisible to a status-code-only view.
func Classify(in ClassifyInput) string {
	if in.StreamEndReason == streamEndClientGone || errors.Is(in.Err, context.Canceled) {
		return OutcomeClientCancelled
	}

	if in.SentFirstToken && isAbnormalStreamEnd(in.StreamEndReason) {
		return OutcomeStreamInterrupted
	}

	// Internal codes are checked before HTTP status on purpose: the gateway's
	// own code captures failures the status cannot distinguish, such as
	// sensitive-word rejections (prompt_blocked) that arrive with a generic 400.
	if code := classifyByInternalCode(in); code != "" {
		return code
	}

	if code := classifyByStatus(in); code != "" {
		return code
	}

	// An abnormal stream end must be caught before the success branch below. The
	// stream scanner returns a nil error even when the stream died on a timeout
	// or a read failure, so a status-and-error-only view would score these as
	// successes. Reaching here with no first token means the stream produced
	// nothing at all, which is a harsher failure than an interrupted one.
	if isAbnormalStreamEnd(in.StreamEndReason) {
		if in.StreamEndReason == streamEndTimeout {
			return timeoutOutcome(in)
		}
		return OutcomeEmptyResponse
	}

	if in.Err == nil {
		if in.IsStream && in.StreamEndReason != "" && !in.SentFirstToken {
			// The stream completed cleanly but never emitted content.
			return OutcomeEmptyResponse
		}
		return OutcomeOK
	}

	if code := classifyTransportError(in); code != "" {
		return code
	}

	// An error we could not attribute. Fall back to the coarsest honest label
	// rather than guessing a specific cause.
	if in.HTTPStatus >= 500 {
		return OutcomeUpstream5xx
	}
	return OutcomeMalformedResponse
}

func isAbnormalStreamEnd(reason string) bool {
	switch reason {
	case streamEndTimeout, streamEndScannerErr, streamEndPingFail, streamEndPanic:
		return true
	default:
		return false
	}
}

func classifyByStatus(in ClassifyInput) string {
	switch {
	case in.HTTPStatus == 429:
		return OutcomeRatelimit429
	case in.HTTPStatus == 401, in.HTTPStatus == 403:
		return OutcomeAuthError
	case in.HTTPStatus == 402:
		return OutcomeQuotaExhausted
	case in.HTTPStatus == 408, in.HTTPStatus == 504, in.HTTPStatus == 524:
		return timeoutOutcome(in)
	}

	if in.HTTPStatus >= 500 {
		return OutcomeUpstream5xx
	}

	if in.HTTPStatus == 400 || in.HTTPStatus == 413 || in.HTTPStatus == 422 {
		msg := strings.ToLower(errText(in))
		if isContextLengthMessage(msg) {
			return OutcomeContextLengthExceeded
		}
		if isContentFilterMessage(msg) {
			return OutcomeContentFilter
		}
		if isQuotaMessage(msg) {
			return OutcomeQuotaExhausted
		}
		return OutcomeInvalidRequest
	}

	return ""
}

// errText returns the probe text for an attempt's error, falling back to the
// error's own string when a distinct message was not provided.
func errText(in ClassifyInput) string {
	if in.ErrMessage != "" {
		return in.ErrMessage
	}
	if in.Err != nil {
		return in.Err.Error()
	}
	return ""
}

func isContextLengthMessage(msg string) bool {
	needles := []string{
		"context length",
		"context_length",
		"context window",
		"maximum context",
		"too many tokens",
		"reduce the length",
		"prompt is too long",
		"input is too long",
		"string too long",
		"exceeds the maximum",
	}
	return containsAny(msg, needles)
}

func isContentFilterMessage(msg string) bool {
	needles := []string{
		"content filter",
		"content_filter",
		"content policy",
		"safety",
		"blocked",
		"prohibited_content",
		"refusal",
	}
	return containsAny(msg, needles)
}

func isQuotaMessage(msg string) bool {
	needles := []string{
		"quota",
		"insufficient balance",
		"insufficient_quota",
		"billing",
		"exceeded your current",
		"credit",
	}
	return containsAny(msg, needles)
}

func containsAny(haystack string, needles []string) bool {
	for _, n := range needles {
		if strings.Contains(haystack, n) {
			return true
		}
	}
	return false
}

// classifyByInternalCode maps this gateway's own error codes. These are checked
// after HTTP status because a status carries more information about the
// upstream's own opinion of the failure.
func classifyByInternalCode(in ClassifyInput) string {
	switch in.InternalErrCode {
	case "empty_response":
		return OutcomeEmptyResponse
	case "bad_response_body", "json_marshal_failed", "convert_request_failed":
		return OutcomeMalformedResponse
	case "sensitive_words_detected", "prompt_blocked":
		return OutcomeContentFilter
	case "insufficient_user_quota", "pre_consume_token_quota_failed":
		return OutcomeQuotaExhausted
	case "invalid_request", "bad_request_body", "model_not_found":
		return OutcomeInvalidRequest
	case "channel:invalid_key":
		return OutcomeAuthError
	case "channel:response_time_exceeded":
		return OutcomeTimeoutTotal
	}
	return ""
}

// classifyTransportError inspects a connection-level failure, which has no HTTP
// status because no response was ever received.
func classifyTransportError(in ClassifyInput) string {
	msg := strings.ToLower(errText(in))

	var netErr net.Error
	if errors.As(in.Err, &netErr) && netErr.Timeout() {
		return timeoutOutcome(in)
	}
	if errors.Is(in.Err, context.DeadlineExceeded) {
		return timeoutOutcome(in)
	}

	if containsAny(msg, []string{
		"connection reset",
		"broken pipe",
		"unexpected eof",
		"connection refused",
		"connection aborted",
		"eof",
	}) {
		return OutcomeConnReset
	}

	if containsAny(msg, []string{"timeout", "timed out", "deadline exceeded"}) {
		return timeoutOutcome(in)
	}

	if in.StreamEndReason != "" && isAbnormalStreamEnd(in.StreamEndReason) {
		return OutcomeStreamInterrupted
	}

	return ""
}

// timeoutOutcome splits a timeout by how far the attempt had progressed.
//
// Note this gateway has no first-token-specific timeout: RELAY_TIMEOUT is 0
// (disabled) by default and STREAMING_TIMEOUT only bounds the gap between
// chunks. timeout_ttft therefore only appears when RELAY_TIMEOUT is configured.
func timeoutOutcome(in ClassifyInput) string {
	if in.SentFirstToken {
		return OutcomeTimeoutTotal
	}
	// A successful response was already streaming, so the timeout hit while
	// waiting for the first content chunk.
	if in.HTTPStatus >= 200 && in.HTTPStatus < 300 {
		return OutcomeTimeoutTTFT
	}
	// Explicit timeout status codes describe the whole call giving up, not just
	// the first token.
	if in.HTTPStatus == 408 || in.HTTPStatus == 504 || in.HTTPStatus == 524 {
		return OutcomeTimeoutTotal
	}
	msg := strings.ToLower(errText(in))
	if containsAny(msg, []string{"dial", "connect", "handshake", "no such host", "lookup"}) {
		return OutcomeTimeoutConnect
	}
	return OutcomeTimeoutTTFT
}

// TerminatedBy attributes who ended the attempt.
func TerminatedBy(in ClassifyInput, outcome string) string {
	switch outcome {
	case OutcomeClientCancelled:
		return TerminatedByClient
	case OutcomeTimeoutConnect, OutcomeTimeoutTTFT, OutcomeTimeoutTotal:
		// Timeouts are enforced by this gateway's own clocks and transport.
		return TerminatedByGateway
	case OutcomeOK:
		return TerminatedByUpstream
	}

	switch in.StreamEndReason {
	case streamEndClientGone:
		return TerminatedByClient
	case streamEndTimeout, streamEndPingFail, streamEndPanic:
		return TerminatedByGateway
	case streamEndDone, streamEndEOF, streamEndHandlerStop:
		return TerminatedByUpstream
	}

	if in.HTTPStatus > 0 {
		return TerminatedByUpstream
	}
	if in.Err != nil {
		return TerminatedByGateway
	}
	return TerminatedByUpstream
}
