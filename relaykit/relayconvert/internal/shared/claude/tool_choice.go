package claude

import (
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

func MapOpenAIToolChoice(toolChoice any, parallelToolCalls *bool) *dto.ClaudeToolChoice {
	var claudeToolChoice *dto.ClaudeToolChoice

	if toolChoiceStr, ok := toolChoice.(string); ok {
		switch toolChoiceStr {
		case "auto":
			claudeToolChoice = &dto.ClaudeToolChoice{
				Type: "auto",
			}
		case "required":
			claudeToolChoice = &dto.ClaudeToolChoice{
				Type: "any",
			}
		case "none":
			claudeToolChoice = &dto.ClaudeToolChoice{
				Type: "none",
			}
		}
	} else if toolChoiceMap, ok := toolChoice.(map[string]interface{}); ok {
		if function, ok := toolChoiceMap["function"].(map[string]interface{}); ok {
			if toolName, ok := function["name"].(string); ok {
				claudeToolChoice = &dto.ClaudeToolChoice{
					Type: "tool",
					Name: toolName,
				}
			}
		}
	}

	if parallelToolCalls != nil {
		if claudeToolChoice == nil {
			claudeToolChoice = &dto.ClaudeToolChoice{
				Type: "auto",
			}
		}
		if claudeToolChoice.Type != "none" {
			claudeToolChoice.DisableParallelToolUse = !*parallelToolCalls
		}
	}

	return claudeToolChoice
}

// NormalizedClaudeToolChoice is the protocol-neutral form of a Claude
// tool_choice, shared by the Claude -> OpenAI Chat and Claude -> Responses
// request converters so both directions stay in lockstep.
type NormalizedClaudeToolChoice struct {
	// Type is one of "auto", "none", "required" or "tool".
	Type                   string
	Name                   string // set only when Type == "tool"
	DisableParallelToolUse bool
}

// NormalizeClaudeToolChoice validates a raw Claude tool_choice value. A nil
// value normalizes to "auto" so callers can decide whether to omit the field
// entirely.
func NormalizeClaudeToolChoice(value any) (NormalizedClaudeToolChoice, error) {
	normalized := NormalizedClaudeToolChoice{Type: "auto"}
	if value == nil {
		return normalized, nil
	}
	choice, err := kitutil.Any2Type[dto.ClaudeToolChoice](value)
	if err != nil {
		return NormalizedClaudeToolChoice{}, fmt.Errorf("invalid Claude tool_choice: %w", err)
	}
	switch choice.Type {
	case "", "auto":
		normalized.Type = "auto"
	case "none":
		normalized.Type = "none"
	case "any":
		normalized.Type = "required"
	case "tool":
		normalized.Type = "tool"
		normalized.Name = choice.Name
	default:
		return NormalizedClaudeToolChoice{}, fmt.Errorf("unsupported Claude tool_choice type %q", choice.Type)
	}
	normalized.DisableParallelToolUse = choice.DisableParallelToolUse
	return normalized, nil
}

// ClaudeToolChoiceToChat maps a raw Claude tool_choice to the Chat
// Completions tool_choice value plus the parallel_tool_calls override. The
// override is only produced when Claude explicitly disabled parallel tool use.
func ClaudeToolChoiceToChat(value any) (any, *bool, error) {
	choice, err := NormalizeClaudeToolChoice(value)
	if err != nil {
		return nil, nil, err
	}
	var converted any
	switch choice.Type {
	case "none":
		converted = "none"
	case "required":
		converted = "required"
	case "tool":
		converted = map[string]any{
			"type": "function",
			"function": map[string]any{
				"name": choice.Name,
			},
		}
	default:
		converted = "auto"
	}
	var parallelToolCalls *bool
	if choice.DisableParallelToolUse && choice.Type != "none" {
		parallelToolCalls = kitutil.GetPointer(false)
	}
	return converted, parallelToolCalls, nil
}
