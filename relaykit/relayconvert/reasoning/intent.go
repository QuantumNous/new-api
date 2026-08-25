package reasoning

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
)

// Intent is the Chat Completions thinking / reasoning signal after every
// vendor-specific field has been folded into one value. Converters project
// this onto the target format instead of each reading a different subset of
// GeneralOpenAIRequest.
type Intent struct {
	// Disabled means the caller asked to turn thinking off (none / false /
	// type=disabled). Converters must emit an explicit off switch when the
	// target format has one.
	Disabled bool
	// Level is the canonical effort string (minimal/low/medium/high/xhigh/max).
	// Empty means "no explicit level".
	Level string
	// Include means the caller wants thought text in the response. A disabled
	// intent always has Include=false.
	Include bool
}

func (i Intent) HasLevel() bool {
	return !i.Disabled && i.Level != ""
}

func (i Intent) WantsThoughts() bool {
	return !i.Disabled && i.Include
}

// IntentFromChatRequest reads Chat Completions thinking fields in priority
// order. extra_body.google.thinking_config is Gemini-specific and is applied
// by the Chat→Gemini converter before this intent is used.
func IntentFromChatRequest(req dto.GeneralOpenAIRequest) Intent {
	if strings.TrimSpace(req.ReasoningEffort) != "" {
		return intentFromLevel(req.ReasoningEffort)
	}
	if intent, ok := intentFromRaw(req.Reasoning); ok {
		return intent
	}
	if intent, ok := intentFromRaw(req.THINKING); ok {
		return intent
	}
	if intent, ok := intentFromRaw(req.EnableThinking); ok {
		return intent
	}
	if intent, ok := intentFromRaw(req.Think); ok {
		return intent
	}
	return Intent{}
}

func intentFromLevel(level string) Intent {
	if IsDisabledThinkingLevel(level) {
		return Intent{Disabled: true}
	}
	canonical := NormalizeThinkingLevel(level)
	if canonical == "" {
		trimmed := strings.ToLower(strings.TrimSpace(level))
		if trimmed == "" {
			return Intent{}
		}
		return Intent{Level: trimmed, Include: true}
	}
	return Intent{Level: canonical, Include: true}
}

func intentFromRaw(raw json.RawMessage) (Intent, bool) {
	s := strings.TrimSpace(string(raw))
	if s == "" || s == "null" {
		return Intent{}, false
	}
	switch s {
	case "true":
		return Intent{Include: true}, true
	case "false":
		return Intent{Disabled: true}, true
	}

	if strings.HasPrefix(s, "\"") {
		var str string
		if err := json.Unmarshal(raw, &str); err == nil {
			str = strings.TrimSpace(str)
			if str == "" {
				return Intent{}, false
			}
			return intentFromLevel(str), true
		}
	}

	if strings.HasPrefix(s, "{") {
		return intentFromObject(raw)
	}
	return Intent{}, false
}

func intentFromObject(raw json.RawMessage) (Intent, bool) {
	var probe map[string]any
	if err := json.Unmarshal(raw, &probe); err != nil || len(probe) == 0 {
		return Intent{}, false
	}

	if effort, ok := stringField(probe, "effort"); ok {
		intent := intentFromLevel(effort)
		if exclude, ok := probe["exclude"].(bool); ok && exclude {
			intent.Include = false
		}
		return intent, true
	}

	if enabled, ok := probe["enabled"].(bool); ok {
		if !enabled {
			return Intent{Disabled: true}, true
		}
		intent := Intent{Include: true}
		if exclude, ok := probe["exclude"].(bool); ok && exclude {
			intent.Include = false
		}
		return intent, true
	}

	if typ, ok := stringField(probe, "type"); ok {
		switch strings.ToLower(typ) {
		case "disabled", "none", "off":
			return Intent{Disabled: true}, true
		case "enabled", "adaptive":
			return Intent{Include: true}, true
		}
	}
	return Intent{}, false
}

func stringField(probe map[string]any, key string) (string, bool) {
	value, ok := probe[key]
	if !ok {
		return "", false
	}
	str, ok := value.(string)
	if !ok {
		return "", false
	}
	str = strings.TrimSpace(str)
	if str == "" {
		return "", false
	}
	return str, true
}
