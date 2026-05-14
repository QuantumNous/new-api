package constant

const (
	AgentRoleUser      = "user"
	AgentRoleAssistant = "assistant"
	AgentRoleTool      = "tool"

	AgentEventTextDelta      = "text_delta"
	AgentEventToolCallStart  = "tool_call_start"
	AgentEventToolCallResult = "tool_call_result"
	AgentEventConfirmNeeded  = "confirm_required"
	AgentEventError          = "error"
	AgentEventDone           = "done"

	AgentRiskLow    = "low"
	AgentRiskMedium = "medium"
	AgentRiskHigh   = "high"

	AgentSessionActive   = "active"
	AgentSessionArchived = "archived"

	AgentAuditSuccess = "success"
	AgentAuditFailed  = "failed"
	AgentAuditRefused = "refused"
)
