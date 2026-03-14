package claude

import (
	"net/http"
	"strings"
)

// GetAnthropicBetaFromHeaders extracts and normalizes all anthropic-beta header values
// into a single comma-separated string.
func GetAnthropicBetaFromHeaders(headers http.Header) string {
	vals := headers.Values("Anthropic-Beta")
	if len(vals) == 0 {
		return ""
	}
	var parts []string
	for _, v := range vals {
		for _, t := range strings.Split(v, ",") {
			t = strings.TrimSpace(t)
			if t != "" {
				parts = append(parts, t)
			}
		}
	}
	return strings.Join(parts, ",")
}

// MergeAnthropicBeta merges two comma-separated anthropic-beta value strings,
// deduplicating by lowercase key while preserving original casing and order.
func MergeAnthropicBeta(defaultValues, incoming string) string {
	seen := map[string]bool{}
	out := make([]string, 0)
	add := func(src string) {
		for _, t := range strings.Split(src, ",") {
			tt := strings.TrimSpace(t)
			if tt == "" {
				continue
			}
			key := strings.ToLower(tt)
			if !seen[key] {
				seen[key] = true
				out = append(out, tt)
			}
		}
	}
	add(defaultValues)
	if incoming != "" {
		add(incoming)
	}
	return strings.Join(out, ",")
}
