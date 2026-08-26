package ir

import "github.com/QuantumNous/new-api/relaykit/types"

// RequestProjectionLosses records first-class fields that To(target) cannot emit.
// X → IR → X does not add losses: extras are written back by To(X).
func RequestProjectionLosses(from, to types.RelayFormat, req *Request) Report {
	report := Report{From: from, To: to}
	if req == nil || from == to {
		return report
	}
	for _, message := range req.Messages {
		collectBlockLosses(to, message.Blocks, &report)
	}
	for _, tool := range req.Tools {
		if !toolSupported(to, tool.Kind) {
			report.AddOnce(LossDropped, "tools."+string(tool.Kind), "target protocol does not accept this tool kind")
		}
	}
	return report
}

// ResponseProjectionLosses is the response-side counterpart of RequestProjectionLosses.
func ResponseProjectionLosses(from, to types.RelayFormat, resp *Response) Report {
	report := Report{From: from, To: to}
	if resp == nil || from == to {
		return report
	}
	collectBlockLosses(to, resp.Blocks, &report)
	return report
}

func collectBlockLosses(to types.RelayFormat, blocks []Block, report *Report) {
	if report == nil {
		return
	}
	for _, block := range blocks {
		if block.Think != nil {
			if block.Think.Signature != "" && to != types.RelayFormatClaude {
				report.AddOnce(LossDropped, "thinking.signature", "target protocol has no Claude thinking signature")
			}
			if block.Think.Redacted && to != types.RelayFormatClaude {
				report.AddOnce(LossDropped, "thinking.redacted", "target protocol has no redacted_thinking")
			}
			if len(block.Think.ProviderSig) > 0 && to != types.RelayFormatGemini {
				report.AddOnce(LossDropped, "thinking.thought_signature", "target protocol has no Gemini thoughtSignature")
			}
		}
		if block.Text != nil && block.Text.CacheControl != nil && to != types.RelayFormatClaude {
			report.AddOnce(LossDropped, "cache_control", "target protocol has no Claude cache_control")
		}
		if block.Media != nil && block.Media.CacheControl != nil && to != types.RelayFormatClaude {
			report.AddOnce(LossDropped, "cache_control", "target protocol has no Claude cache_control")
		}
		if block.ToolResult != nil {
			if block.ToolResult.CacheControl != nil && to != types.RelayFormatClaude {
				report.AddOnce(LossDropped, "cache_control", "target protocol has no Claude cache_control")
			}
			collectBlockLosses(to, block.ToolResult.Blocks, report)
		}
		if block.ToolUse != nil && len(block.ToolUse.ProviderSig) > 0 && to != types.RelayFormatGemini {
			report.AddOnce(LossDropped, "tool_use.thought_signature", "target protocol has no Gemini thoughtSignature")
		}
		if block.Raw != nil && to == types.RelayFormatGemini {
			switch block.Raw.Type {
			case "custom_tool_call", "custom_tool_call_output":
				report.AddOnce(LossDropped, block.Raw.Type, "Gemini does not accept Responses custom tools")
			}
		}
	}
}

func toolSupported(to types.RelayFormat, kind ToolKind) bool {
	switch to {
	case types.RelayFormatClaude:
		switch kind {
		case ToolFunction, ToolWebSearch, ToolMCP, ToolComputer:
			return true
		}
	case types.RelayFormatGemini:
		switch kind {
		case ToolFunction, ToolGoogleSearch, ToolCodeExecution:
			return true
		}
	case types.RelayFormatOpenAI:
		switch kind {
		case ToolFunction, ToolWebSearch:
			return true
		}
	case types.RelayFormatOpenAIResponses:
		return true
	}
	return false
}

func (r *Report) AddOnce(kind LossKind, field, reason string) {
	if r == nil {
		return
	}
	for _, loss := range r.Losses {
		if loss.Kind == kind && loss.Field == field {
			return
		}
	}
	r.Add(kind, field, reason)
}
