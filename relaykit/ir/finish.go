package ir

import "strings"

func FinishFromClaude(stopReason string) Finish {
	switch strings.ToLower(strings.TrimSpace(stopReason)) {
	case "":
		return ""
	case "end_turn", "stop_sequence":
		return FinishStop
	case "max_tokens":
		return FinishLength
	case "tool_use":
		return FinishTool
	case "refusal":
		return FinishFilter
	default:
		return FinishUnknown
	}
}

func (f Finish) ToClaudeStopReason() string {
	switch f {
	case FinishStop:
		return "end_turn"
	case FinishLength:
		return "max_tokens"
	case FinishTool:
		return "tool_use"
	case FinishFilter:
		return "refusal"
	case "", FinishUnknown, FinishError:
		return ""
	default:
		return string(f)
	}
}

func FinishFromChat(reason string) Finish {
	switch strings.ToLower(strings.TrimSpace(reason)) {
	case "":
		return ""
	case "stop":
		return FinishStop
	case "length":
		return FinishLength
	case "tool_calls":
		return FinishTool
	case "content_filter":
		return FinishFilter
	default:
		return FinishUnknown
	}
}

func (f Finish) ToChatFinishReason() string {
	switch f {
	case FinishStop:
		return "stop"
	case FinishLength:
		return "length"
	case FinishTool:
		return "tool_calls"
	case FinishFilter:
		return "content_filter"
	case "", FinishUnknown, FinishError:
		return ""
	default:
		return string(f)
	}
}

func FinishFromGemini(reason string) Finish {
	switch strings.ToUpper(strings.TrimSpace(reason)) {
	case "":
		return ""
	case "STOP":
		return FinishStop
	case "MAX_TOKENS":
		return FinishLength
	case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT":
		return FinishFilter
	case "MALFORMED_FUNCTION_CALL":
		return FinishTool
	default:
		return FinishUnknown
	}
}

func (f Finish) ToGeminiFinishReason() string {
	switch f {
	case FinishStop:
		return "STOP"
	case FinishLength:
		return "MAX_TOKENS"
	case FinishFilter:
		return "SAFETY"
	case FinishTool:
		return "MALFORMED_FUNCTION_CALL"
	case "", FinishUnknown, FinishError:
		return ""
	default:
		return string(f)
	}
}
