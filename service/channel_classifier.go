package service

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
)

// ChannelErrorKind is the classifier output for an upstream error attached
// to a single channel. It is consumed by processChannelError to decide
// whether to disable, short-cooldown, or long-cooldown the channel.
//
// The taxonomy matches the operational reality seen in real provider APIs:
//   - BusinessError: account/quota/billing problems that won't self-heal
//     in seconds. Retry the same channel immediately and the user gets
//     the same 4xx. Long cooldown (or AutoDisabled) is the right move.
//   - TempError: upstream or transport hiccups that may self-heal within
//     seconds (5xx, 408, 429, gateway timeouts). Short cooldown so the
//     selector doesn't burn the user budget on retries, but the channel
//     comes back automatically.
//   - Unknown: anything else — keep the legacy behaviour (AutoDisabled
//     if the existing rules say so) to avoid surprising operators.
type ChannelErrorKind int

const (
	ChannelErrorUnknown ChannelErrorKind = iota
	ChannelErrorBusiness
	ChannelErrorTemp
)

func (k ChannelErrorKind) String() string {
	switch k {
	case ChannelErrorBusiness:
		return "business"
	case ChannelErrorTemp:
		return "temp"
	default:
		return "unknown"
	}
}

// ClassifyChannelError inspects the upstream error and decides which class
// it falls into. The classification drives the cooldown policy applied by
// processChannelError; see processChannelError for the wiring.
//
// BusinessError is matched first because the user-visible failure mode is
// worse (no retry, permanent disable) and the signal is also stricter
// (operator-curated status codes + keywords). TempError is matched
// second to avoid accidentally classifying a 5xx that happens to contain
// the word "suspended" in a non-business context — we only treat 4xx
// (plus 408) as business by status code, and keyword match takes
// precedence over the temp status-code match.
func ClassifyChannelError(err *types.NewAPIError) ChannelErrorKind {
	if err == nil {
		return ChannelErrorUnknown
	}

	// Fast path: status code classification. We look at the upstream HTTP
	// status, not the wrapper NewAPIError's own StatusCode, because the
	// latter is often 502/504 even when the upstream returned 400 — the
	// important question is what the upstream actually said.
	statusCode := err.StatusCode
	if statusCode <= 0 {
		statusCode = 0
	}

	if operation_setting.IsBusinessErrorStatusCode(statusCode) {
		return ChannelErrorBusiness
	}

	if messageMatchesBusinessKeyword(err.Error()) {
		return ChannelErrorBusiness
	}

	// Temporary upstream fault. The default retry list (5xx, 408, 429,
	// 1xx, 3xx) is already curated for this purpose.
	if operation_setting.ShouldRetryByStatusCode(statusCode) {
		return ChannelErrorTemp
	}

	return ChannelErrorUnknown
}

// messageMatchesBusinessKeyword does a case-insensitive substring match
// against the curated business keywords. The list is small (a few dozen
// phrases) and the message is bounded, so a linear scan is fine and
// avoids pulling another dep into the per-error hot path.
func messageMatchesBusinessKeyword(msg string) bool {
	if msg == "" {
		return false
	}
	lower := strings.ToLower(msg)
	for _, kw := range operation_setting.BusinessErrorKeywords {
		if kw == "" {
			continue
		}
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}
