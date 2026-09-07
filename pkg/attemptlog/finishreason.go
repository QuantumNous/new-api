package attemptlog

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

// NoteFinishReason records the terminal finish/stop reason reported by the
// upstream model.
//
// The gateway previously kept a finish reason only for the content_filter and
// refusal cases, so ordinary terminations such as stop, length and tool_calls
// were never observable. Callers pass whatever the upstream actually said; the
// value is stored as-is rather than normalized, because the provider-specific
// vocabulary is itself a signal.
//
// The first non-empty reason wins. On a streaming response the terminal chunk
// arrives last, but some adaptors also inspect earlier chunks, and overwriting
// would let a later empty or generic value erase a specific one.
func NoteFinishReason(c *gin.Context, reason string) {
	if c == nil || reason == "" {
		return
	}
	if !Enabled() {
		return
	}
	if existing := common.GetContextKeyString(c, constant.ContextKeyFinishReason); existing != "" {
		return
	}
	common.SetContextKey(c, constant.ContextKeyFinishReason, reason)
}
