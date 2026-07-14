package helper

import (
	"fmt"
	"net/http"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// StreamResult is passed to each dataHandler invocation, providing methods
// to record soft errors, signal fatal stops, or mark normal completion.
// StreamScannerHandler checks IsStopped() after each callback invocation.
type StreamResult struct {
	status  *relaycommon.StreamStatus
	stopped bool
}

func newStreamResult(status *relaycommon.StreamStatus) *StreamResult {
	return &StreamResult{status: status}
}

// Error records a soft error. The stream continues processing.
// Can be called multiple times per chunk.
func (r *StreamResult) Error(err error) {
	if err == nil {
		return
	}
	r.status.RecordError(err.Error())
}

// Stop records a fatal error and marks the stream to stop after this chunk.
func (r *StreamResult) Stop(err error) {
	if err != nil {
		r.status.RecordError(err.Error())
	}
	r.status.SetEndReason(relaycommon.StreamEndReasonHandlerStop, err)
	r.stopped = true
}

// Done signals that the handler has finished processing normally
// (e.g., Dify "message_end"). The stream stops after this chunk.
func (r *StreamResult) Done() {
	r.status.SetEndReason(relaycommon.StreamEndReasonDone, nil)
	r.stopped = true
}

// IsStopped returns whether Stop() or Done() was called during this chunk.
func (r *StreamResult) IsStopped() bool {
	return r.stopped
}

// reset clears the per-chunk stopped flag so the object can be reused.
func (r *StreamResult) reset() {
	r.stopped = false
}

func StreamErrorBeforeResponse(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	if HasWrittenUpstreamResponse(c) {
		return nil
	}
	return StreamError(info)
}

func StreamError(info *relaycommon.RelayInfo) *types.NewAPIError {
	if info == nil || info.StreamStatus == nil {
		return types.NewOpenAIError(fmt.Errorf("upstream returned an empty stream"), types.ErrorCodeEmptyResponse, http.StatusBadGateway)
	}

	status := info.StreamStatus
	if status.EndReason == relaycommon.StreamEndReasonDone && info.ReceivedResponseCount > 0 && !status.HasErrors() {
		return nil
	}

	message := "upstream stream ended before completion"
	if info.ReceivedResponseCount == 0 && !status.HasErrors() {
		message = "upstream returned an empty stream"
	}
	return types.NewOpenAIError(fmt.Errorf("%s: %s", message, status.Summary()), types.ErrorCodeBadResponse, http.StatusBadGateway)
}
