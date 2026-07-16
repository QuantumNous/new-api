package service

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
)

func normalizeChannelHealthPath(requestPath string) string {
	path := strings.SplitN(requestPath, "?", 2)[0]
	switch {
	case strings.HasSuffix(path, "/chat/completions"):
		return "/v1/chat/completions"
	case strings.Contains(path, "/responses/compact"):
		return "/v1/responses/compact"
	case strings.Contains(path, "/responses"):
		return "/v1/responses"
	case strings.Contains(path, "/messages"):
		return "/v1/messages"
	case strings.Contains(path, "/embeddings") || strings.Contains(path, ":embedContent") || strings.Contains(path, ":batchEmbedContents"):
		return "/v1/embeddings"
	case strings.Contains(path, "/images/generations"):
		return "/v1/images/generations"
	case strings.Contains(path, "/images/edits"):
		return "/v1/images/edits"
	case strings.Contains(path, "/audio/speech"):
		return "/v1/audio/speech"
	case strings.Contains(path, "/audio/transcriptions"):
		return "/v1/audio/transcriptions"
	case strings.Contains(path, "/audio/translations"):
		return "/v1/audio/translations"
	case strings.Contains(path, ":streamGenerateContent"):
		return "/gemini/stream_generate"
	case strings.Contains(path, ":generateContent"):
		return "/gemini/generate"
	case strings.Contains(path, "/video") || strings.Contains(path, "/tasks"):
		return "/v1/tasks"
	default:
		return "/other"
	}
}

func channelHealthKey(channelID int, modelName, requestPath string) model.ChannelHealthKey {
	return model.ChannelHealthKey{
		ChannelID: channelID,
		Model:     modelName,
		Path:      normalizeChannelHealthPath(requestPath),
	}
}

func ChannelHealthPath(requestPath string) string {
	return normalizeChannelHealthPath(requestPath)
}

// channelAttributableErrorCodes are error codes that indicate the failure
// happened while communicating with (or interpreting a response from) the
// upstream channel, as opposed to a gateway-local failure in request
// conversion, serialization, pricing, or other pre-dispatch processing. Only
// these should count against a channel's adaptive health — everything else
// defaults to HTTP 500 without ever reaching the upstream, and would
// otherwise open a healthy channel's circuit on purely client/gateway
// failures.
var channelAttributableErrorCodes = map[types.ErrorCode]bool{
	types.ErrorCodeDoRequestFailed:             true,
	types.ErrorCodeReadResponseBodyFailed:      true,
	types.ErrorCodeBadResponseStatusCode:       true,
	types.ErrorCodeBadResponse:                 true,
	types.ErrorCodeBadResponseBody:             true,
	types.ErrorCodeEmptyResponse:               true,
	types.ErrorCodeAwsInvokeError:              true,
	types.ErrorCodeChannelAwsClientError:       true,
	types.ErrorCodeChannelInvalidKey:           true,
	types.ErrorCodeChannelResponseTimeExceeded: true,
	types.ErrorCodeChannelNoAvailableKey:       true,
	types.ErrorCodeModelNotFound:               true,
}

func isChannelAttributableError(apiErr *types.NewAPIError) bool {
	if apiErr == nil {
		return true
	}
	// A request the client aborted (context canceled) fails on whichever channel
	// happened to be in flight, but the channel did nothing wrong. Without this
	// the in-flight failure is reported as ErrorCodeDoRequestFailed and a single
	// client cancellation penalizes every channel the retry loop touches.
	// context.DeadlineExceeded is deliberately NOT matched here: that is our own
	// timeout firing and does indicate a slow/dead channel.
	if errors.Is(apiErr, context.Canceled) {
		return false
	}
	return channelAttributableErrorCodes[apiErr.GetErrorCode()]
}

// channelHealthOutcomeStatus derives the status a channel attempt should be
// scored with. A real upstream error uses its own status. Otherwise the attempt
// nominally succeeded (200) — except when the upstream returned 200 but emptied
// the stream (no usage, no output): that is scored as 502 so a channel that
// silently returns nothing is treated as failing rather than healthy.
func channelHealthOutcomeStatus(apiErr *types.NewAPIError, relayInfo *relaycommon.RelayInfo) (statusCode int, localError bool) {
	if apiErr != nil {
		return apiErr.StatusCode, !isChannelAttributableError(apiErr)
	}
	if relayInfo != nil && relayInfo.UpstreamEmptyResponse {
		return http.StatusBadGateway, false
	}
	return http.StatusOK, false
}

// RecordChannelHealthOutcome records the outcome of a single channel attempt.
// attemptStart must be the time this specific attempt (not the overall
// request) began, so retries on other channels don't inherit latency spent on
// earlier failed attempts.
func RecordChannelHealthOutcome(channelID int, modelName, requestPath string, relayInfo *relaycommon.RelayInfo, attemptStart time.Time, apiErr *types.NewAPIError, semanticError bool) {
	if channelID == 0 || modelName == "" {
		return
	}
	statusCode, localError := channelHealthOutcomeStatus(apiErr, relayInfo)
	outcome := model.ChannelOutcome{StatusCode: statusCode, SemanticError: semanticError, LocalError: localError}
	if relayInfo != nil && relayInfo.HasSendResponse() && relayInfo.FirstResponseTime.After(attemptStart) {
		outcome.Latency = relayInfo.FirstResponseTime.Sub(attemptStart)
	} else if !attemptStart.IsZero() {
		outcome.Latency = time.Since(attemptStart)
	}
	model.RecordChannelOutcome(channelHealthKey(channelID, modelName, requestPath), outcome)
}

func IsChannelHealthAvailable(channelID int, modelName, requestPath string) bool {
	return model.IsChannelHealthAvailable(channelHealthKey(channelID, modelName, requestPath))
}
