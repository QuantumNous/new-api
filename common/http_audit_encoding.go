package common

import (
	"sort"
	"strings"
	"unicode/utf8"
)

const httpAuditMaxEventBytes = 16 * 1024

var httpAuditRequiredFields = map[string]bool{
	"timestamp": true, "event": true, "level": true, "direction": true,
	"request_id": true, "edge_request_id": true, "attempt_id": true,
	"status": true, "outcome": true, "duration_ms": true, "method": true,
	"path": true, "channel_id": true, "channel_type": true, "task_id": true,
	"error_type": true, "error_code": true, "stream_end": true,
}

type httpAuditField struct {
	parent map[string]any
	key    string
	path   string
	size   int
}

// encodeHTTPAuditEvent prunes an already filtered COPY, largest optional leaf
// first. Small diagnostic siblings survive; serialized JSON is never sliced.
// Size pruning is not a privacy filter: requests must be sanitized first.
func encodeHTTPAuditEvent(input map[string]any) []byte {
	raw, err := Marshal(input)
	if err != nil {
		return []byte(`{"event":"http_audit_encoding_error","level":"ERROR"}`)
	}
	if len(raw) <= httpAuditMaxEventBytes {
		return raw
	}
	var event map[string]any
	if Unmarshal(raw, &event) != nil {
		return []byte(`{"event":"http_audit_encoding_error","level":"ERROR"}`)
	}
	event["log_truncated"] = true
	var fields []httpAuditField
	collectHTTPAuditFields(event, "", &fields)
	sort.Slice(fields, func(i, j int) bool {
		if fields[i].size == fields[j].size {
			return fields[i].path < fields[j].path
		}
		return fields[i].size > fields[j].size
	})
	removed := make([]string, 0, 16)
	for i, field := range fields {
		delete(field.parent, field.key)
		if len(removed) < 16 {
			removed = append(removed, boundHTTPAuditString(field.path, 120))
		}
		event["dropped_fields"], event["dropped_field_count"] = removed, i+1
		raw, _ = Marshal(event)
		if len(raw) <= httpAuditMaxEventBytes {
			return raw
		}
	}
	minimal := map[string]any{"log_truncated": true, "minimal_event": true, "dropped_fields": removed, "dropped_field_count": len(fields)}
	for key := range httpAuditRequiredFields {
		switch value := event[key].(type) {
		case string:
			minimal[key] = boundHTTPAuditString(value, 128)
		case float64, bool:
			minimal[key] = value
		}
	}
	raw, _ = Marshal(minimal)
	if len(raw) > httpAuditMaxEventBytes {
		// JSON escaping can expand the bounded JSON-pointer paths sixfold.
		// The deletion count still records that pruning took place.
		delete(minimal, "dropped_fields")
		raw, _ = Marshal(minimal)
	}
	return raw
}

func collectHTTPAuditFields(object map[string]any, prefix string, fields *[]httpAuditField) {
	for key, value := range object {
		if prefix == "" && (httpAuditRequiredFields[key] || key == "log_truncated") {
			continue
		}
		path := prefix + "/" + strings.ReplaceAll(strings.ReplaceAll(key, "~", "~0"), "/", "~1")
		if child, ok := value.(map[string]any); ok && len(child) > 0 {
			collectHTTPAuditFields(child, path, fields)
			continue
		}
		encoded, _ := Marshal(value)
		encodedKey, _ := Marshal(key)
		*fields = append(*fields, httpAuditField{parent: object, key: key, path: path, size: len(encoded) + len(encodedKey) + 2})
	}
}

func boundHTTPAuditString(value string, maxBytes int) string {
	if len(value) <= maxBytes {
		return value
	}
	value = value[:maxBytes]
	for !utf8.ValidString(value) {
		value = value[:len(value)-1]
	}
	return value
}
