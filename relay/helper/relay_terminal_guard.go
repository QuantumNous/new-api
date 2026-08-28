package helper

import (
	"fmt"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

// EmitRelayFailureTerminal emits an in-band terminal error event on the
// downstream SSE stream when the upstream relay ended abnormally
// (scanner_error, timeout, client_gone, panic, ...), before the normal
// [DONE] terminator.
//
// Background: StreamScannerHandler records the accurate relay end-state in
// info.StreamStatus, but stream handlers historically emitted a normal
// completion envelope unconditionally (final usage chunk + data: [DONE] /
// response.completed) even when the upstream connection had died mid-stream
// (see QuantumNous/new-api#7059). Strict downstream clients (e.g. OpenAI SDK
// consumers that validate finish_reason / terminal events) then observe a
// stream whose envelope claims success while the semantic terminal event
// (finish_reason, response.completed) is missing — indistinguishable from a
// truncated successful stream.
//
// The error chunk uses the OpenAI chat-completions stream chunk shape with
// empty choices and error fields in the model_extra position
// (error_type/error_message), the same convention some providers use for
// in-stream validation errors and which strict OpenAI-compatible clients
// already special-case (choices empty ⇒ not a content chunk; error fields
// ⇒ retryable relay failure). The stream is still terminated with [DONE]
// so every client — strict or lenient — sees a syntactically complete SSE
// stream; the semantic distinction lives in the error chunk.
//
// It returns true if a failure event was emitted (caller should skip any
// further normal-completion chunks it would have appended).
func EmitRelayFailureTerminal(c *gin.Context, info *relaycommon.RelayInfo) bool {
	if info == nil || info.StreamStatus == nil || info.StreamStatus.IsNormalEnd() {
		return false
	}

	errText := ""
	if info.StreamStatus.EndError != nil {
		errText = info.StreamStatus.EndError.Error()
	}
	// Truncate the upstream error string: it can embed IPs/hosts; keep enough
	// to diagnose, not enough to leak infra details wholesale.
	if len(errText) > 256 {
		errText = errText[:256]
	}

	reason := string(info.StreamStatus.EndReason)
	if reason == "" {
		reason = "unknown"
	}

	// Chat-completions-shaped error chunk. Empty choices signals "not a
	// content chunk"; the structured error object matches the in-stream
	// provider-error convention that OpenAI-compatible SDKs already parse.
	chunk := map[string]any{
		"id":      fmt.Sprintf("relay-error-%s", reason),
		"object":  "chat.completion.chunk",
		"choices": []any{},
		"error": map[string]any{
			"message": fmt.Sprintf("stream relay failure: %s: %s", reason, errText),
			"type":    "relay_stream_error",
			"code":    "upstream_stream_failure_" + reason,
			"param":   nil,
		},
	}
	_ = ObjectData(c, chunk)
	_ = FlushWriter(c)
	return true
}
