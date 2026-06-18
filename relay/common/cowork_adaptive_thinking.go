package common

import (
	"fmt"
	"strings"

	appcommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

type CoworkAdaptiveThinkingFixStats struct {
	Changed                bool
	ThinkingBlocks         int
	RedactedThinkingBlocks int
}

func FixCoworkAdaptiveThinkingJSON(jsonData []byte, settings dto.ChannelOtherSettings) ([]byte, CoworkAdaptiveThinkingFixStats, error) {
	var stats CoworkAdaptiveThinkingFixStats
	if !settings.CoworkAdaptiveThinkingFix {
		return jsonData, stats, nil
	}

	var req map[string]interface{}
	if err := appcommon.Unmarshal(jsonData, &req); err != nil {
		return jsonData, stats, fmt.Errorf("unmarshal cowork adaptive thinking request: %w", err)
	}

	if !shouldFixCoworkAdaptiveThinking(req, jsonData) {
		return jsonData, stats, nil
	}

	messages, ok := req["messages"].([]interface{})
	if !ok {
		return jsonData, stats, nil
	}

	for _, msgAny := range messages {
		msg, ok := msgAny.(map[string]interface{})
		if !ok {
			continue
		}

		blocks, ok := msg["content"].([]interface{})
		if !ok {
			continue
		}

		msgChanged := false
		for i, blockAny := range blocks {
			block, ok := blockAny.(map[string]interface{})
			if !ok {
				continue
			}

			typ, _ := block["type"].(string)
			switch typ {
			case "thinking":
				thinking, _ := block["thinking"].(string)
				blocks[i] = map[string]interface{}{
					"type": "text",
					"text": "<previous_reasoning>\n" + thinking + "\n</previous_reasoning>",
				}
				stats.Changed = true
				stats.ThinkingBlocks++
				msgChanged = true
			case "redacted_thinking":
				blocks[i] = map[string]interface{}{
					"type": "text",
					"text": "<previous_reasoning_redacted/>",
				}
				stats.Changed = true
				stats.RedactedThinkingBlocks++
				msgChanged = true
			}
		}

		if msgChanged {
			msg["content"] = blocks
		}
	}

	if !stats.Changed {
		return jsonData, stats, nil
	}

	req["messages"] = messages
	out, err := appcommon.Marshal(req)
	if err != nil {
		return jsonData, stats, fmt.Errorf("marshal cowork adaptive thinking request: %w", err)
	}
	return out, stats, nil
}

func shouldFixCoworkAdaptiveThinking(req map[string]interface{}, jsonData []byte) bool {
	if !hasAdaptiveThinking(req) {
		return false
	}
	if !containsCoworkMarker(jsonData) {
		return false
	}
	return containsThinkingBlocks(req)
}

func hasAdaptiveThinking(req map[string]interface{}) bool {
	thinkingObj, ok := req["thinking"].(map[string]interface{})
	if !ok {
		return false
	}
	typ, _ := thinkingObj["type"].(string)
	return typ == "adaptive"
}

func containsCoworkMarker(jsonData []byte) bool {
	bodyText := strings.ToLower(string(jsonData))
	return strings.Contains(bodyText, "claude-desktop-3p") ||
		strings.Contains(bodyText, "cc_entrypoint=claude-desktop-3p") ||
		strings.Contains(bodyText, "cowork")
}

func containsThinkingBlocks(req map[string]interface{}) bool {
	messages, ok := req["messages"].([]interface{})
	if !ok {
		return false
	}

	for _, msgAny := range messages {
		msg, ok := msgAny.(map[string]interface{})
		if !ok {
			continue
		}
		blocks, ok := msg["content"].([]interface{})
		if !ok {
			continue
		}
		for _, blockAny := range blocks {
			block, ok := blockAny.(map[string]interface{})
			if !ok {
				continue
			}
			typ, _ := block["type"].(string)
			if typ == "thinking" || typ == "redacted_thinking" {
				return true
			}
		}
	}
	return false
}
