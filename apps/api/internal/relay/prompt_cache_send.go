package relay

import (
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/internal/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// doRequestWithPromptCacheFallback sends the relay request and absorbs the one
// failure mode automatic prompt-cache injection can cause by itself: a strict
// upstream that rejects the gateway-added marker field with a 4xx naming it.
// In that case the injection is undone and the body is rebuilt and resent
// exactly once, marker-free. Every other outcome keeps the established
// behavior — the upstream error, after status-code mapping, goes back to the
// failover loop unchanged.
//
// rebuild may be nil (paths that never inject, e.g. passthrough); undo is the
// handle returned by the injection call for this attempt.
func doRequestWithPromptCacheFallback(
	c contract.Context,
	info *relaycommon.RelayInfo,
	adaptor channel.Adaptor,
	requestBody io.Reader,
	rebuild func() (io.Reader, *types.NewAPIError),
	undo relaycommon.UndoPromptCache,
	markerField string,
	statusCodeMappingStr string,
) (*http.Response, *types.NewAPIError) {
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	for attempt := 0; ; attempt++ {
		if resp == nil {
			// Adaptors may legitimately return no response; callers already
			// handle the nil the same way as before.
			return nil, nil
		}
		httpResp, ok := resp.(*http.Response)
		if !ok {
			return nil, types.NewOpenAIError(nil, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
		if httpResp.StatusCode == http.StatusOK {
			// Only the accepted response decides stream mode: a strict upstream
			// could answer a rejected 4xx with an event-stream content type,
			// and that must not push the successful resend down the
			// stream-handler branch.
			info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
			return httpResp, nil
		}
		newAPIError := relaycommon.RelayErrorHandler(c.Context(), httpResp, false)
		if attempt > 0 || undo == nil || rebuild == nil ||
			!relaycommon.FallbackPromptCacheAfterRejection(c, info, undo, markerField, newAPIError) {
			// reset status code 重置状态码
			relaycommon.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return nil, newAPIError
		}
		retryBody, buildErr := rebuild()
		if buildErr != nil {
			relaycommon.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return nil, newAPIError
		}
		retryResp, retryErr := adaptor.DoRequest(c, info, retryBody)
		if retryErr != nil {
			return nil, types.NewOpenAIError(retryErr, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
		}
		if retryResp == nil {
			relaycommon.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return nil, newAPIError
		}
		resp = retryResp
	}
}
