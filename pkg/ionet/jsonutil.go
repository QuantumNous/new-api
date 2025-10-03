package ionet

import (
	"encoding/json"
	"strings"
	"time"
)

// decodeWithFlexibleTimes unmarshals API responses while tolerating timestamp strings
// that omit timezone information by normalizing them to RFC3339Nano.
func decodeWithFlexibleTimes(data []byte, target interface{}) error {
	var intermediate interface{}
	if err := json.Unmarshal(data, &intermediate); err != nil {
		return err
	}

	normalized := normalizeTimeValues(intermediate)
	reencoded, err := json.Marshal(normalized)
	if err != nil {
		return err
	}

	return json.Unmarshal(reencoded, target)
}

func normalizeTimeValues(value interface{}) interface{} {
	switch v := value.(type) {
	case map[string]interface{}:
		for key, val := range v {
			v[key] = normalizeTimeValues(val)
		}
		return v
	case []interface{}:
		for i, item := range v {
			v[i] = normalizeTimeValues(item)
		}
		return v
	case string:
		if normalized, changed := normalizeTimeString(v); changed {
			return normalized
		}
		return v
	default:
		return value
	}
}

func normalizeTimeString(input string) (string, bool) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return input, false
	}

	if _, err := time.Parse(time.RFC3339Nano, trimmed); err == nil {
		return trimmed, trimmed != input
	}
	if _, err := time.Parse(time.RFC3339, trimmed); err == nil {
		return trimmed, trimmed != input
	}

	layouts := []string{
		"2006-01-02T15:04:05.999999999",
		"2006-01-02T15:04:05.999999",
		"2006-01-02T15:04:05",
	}

	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			return parsed.UTC().Format(time.RFC3339Nano), true
		}
	}

	return input, false
}
