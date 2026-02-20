package reasonmap

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
)

func ClaudeStopReasonToOpenAIFinishReason(stopReason string) string {
	switch strings.ToLower(stopReason) {
	case "stop_sequence":
		return "stop"
	case "end_turn":
		return "stop"
	case "max_tokens":
		return "length"
	case "tool_use":
		return "tool_calls"
	case "refusal":
		return constant.FinishReasonContentFilter
	default:
		return stopReason
	}
}

func OpenAIFinishReasonToClaudeStopReason(finishReason string) string {
	switch strings.ToLower(finishReason) {
	case "stop":
		return "end_turn"
	case "stop_sequence":
		return "stop_sequence"
	case "length", "max_tokens":
		return "max_tokens"
	case constant.FinishReasonContentFilter:
		return "refusal"
	case "tool_calls":
		return "tool_use"
	default:
		return finishReason
	}
}
