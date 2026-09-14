package helper

import (
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// StreamResult is passed to each dataHandler invocation, providing methods
// to record soft errors, signal fatal stops, or mark normal completion.
// StreamScannerHandler checks IsStopped() after each callback invocation.
type StreamResult struct {
	status   *relaycommon.StreamStatus
	stopped  bool
	accepted bool
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
	r.status.SetUpstreamResult(relaycommon.StreamUpstreamResultHandlerError, err)
	r.Accept()
	r.stopped = true
}

// ProtocolFailure records an explicit upstream failure terminal.
func (r *StreamResult) ProtocolFailure(err error) {
	if err != nil {
		r.status.RecordError(err.Error())
	}
	r.status.SetEndReason(relaycommon.StreamEndReasonHandlerStop, err)
	r.status.SetUpstreamResult(relaycommon.StreamUpstreamResultProtocolFailure, err)
	r.Accept()
	r.stopped = true
}

// Done signals that the handler has finished processing normally
// (e.g., Dify "message_end"). The stream stops after this chunk.
func (r *StreamResult) Done() {
	r.status.SetEndReason(relaycommon.StreamEndReasonDone, nil)
	r.status.SetUpstreamResult(relaycommon.StreamUpstreamResultTerminalSuccess, nil)
	r.Accept()
	r.stopped = true
}

// TerminalSuccess records a protocol success terminal and whether that
// terminal carried authoritative upstream usage.
func (r *StreamResult) TerminalSuccess(usageComplete bool) {
	if usageComplete {
		r.status.MarkUsageComplete()
	}
	r.Done()
}

// NeutralStop stops reading after accepting the current event without recording
// a protocol outcome.
func (r *StreamResult) NeutralStop() {
	r.Accept()
	r.stopped = true
}

// IsStopped returns whether the current chunk requested the stream to stop.
func (r *StreamResult) IsStopped() bool {
	return r.stopped
}

func (r *StreamResult) ClientGone() bool {
	return r != nil && r.status != nil && r.status.EndReason == relaycommon.StreamEndReasonClientGone
}

// Accept marks a parsed line as a protocol-recognized business event. Only
// accepted events may renew the post-disconnect idle deadline.
func (r *StreamResult) Accept() {
	if r != nil {
		r.accepted = true
	}
}

// Ignore marks a framed line as transport noise or an unrecognized event.
func (r *StreamResult) Ignore() {
	if r != nil {
		r.accepted = false
	}
}

func (r *StreamResult) IsIgnored() bool {
	return r == nil || !r.accepted
}

// reset clears the per-chunk stopped flag so the object can be reused.
func (r *StreamResult) reset() {
	r.stopped = false
	r.accepted = false
}
