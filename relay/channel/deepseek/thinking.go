package deepseek

import (
	"strings"

	"github.com/QuantumNous/new-api/dto"
)

// EnsureThinkingBeforeToolUse ensures that when thinking mode is enabled,
// every tool_use block in assistant messages has a preceding thinking block.
// DeepSeek V4 requires thinking blocks before tool_use when thinking is enabled.
func EnsureThinkingBeforeToolUse(req *dto.ClaudeRequest) {
	if req == nil || len(req.Messages) == 0 {
		return
	}
	// Only process deepseek-v4-* models
	if !isDeepSeekV4(req.Model) {
		return
	}
	// Thinking disabled? skip
	if req.Thinking != nil && req.Thinking.Type == "disabled" {
		return
	}
	for i := range req.Messages {
		msg := &req.Messages[i]
		if msg.Role != "assistant" {
			continue
		}
		contentList, ok := msg.Content.([]any)
		if !ok || len(contentList) == 0 {
			continue
		}
		contentList, fixed := ensureThinkingInContentArray(contentList)
		if fixed {
			msg.Content = contentList
		}
	}
}

// isDeepSeekV4 checks if the model name belongs to DeepSeek V4 series.
func isDeepSeekV4(modelName string) bool {
	return strings.HasPrefix(modelName, "deepseek-v4-")
}

// ensureThinkingInContentArray inserts an empty thinking block at position 0
// if the content array contains any tool_use without a thinking block as the first element.
// Returns the modified slice and whether modifications were made.
func ensureThinkingInContentArray(contentList []any) ([]any, bool) {
	if len(contentList) == 0 {
		return contentList, false
	}
	// Check if the first element is already a thinking block
	if first, ok := contentList[0].(map[string]any); ok && first["type"] == "thinking" {
		return contentList, false
	}
	// Check if there are any tool_use blocks
	hasToolUse := false
	for _, item := range contentList {
		if m, ok := item.(map[string]any); ok && m["type"] == "tool_use" {
			hasToolUse = true
			break
		}
	}
	if !hasToolUse {
		return contentList, false
	}
	// Insert empty thinking block at the beginning
	emptyStr := ""
	thinkingBlock := map[string]any{
		"type":     "thinking",
		"thinking": emptyStr,
	}
	contentList = append(contentList, nil)
	copy(contentList[1:], contentList[0:])
	contentList[0] = thinkingBlock
	return contentList, true
}
