package usage_log_export

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestResolveFieldsFiltersAdminOnly(t *testing.T) {
	fields, err := resolveFields([]string{"created_at", "request_id"}, false)
	if err != nil {
		t.Fatalf("resolveFields returned unexpected error: %v", err)
	}
	keys := make([]string, 0, len(fields))
	for _, field := range fields {
		keys = append(keys, field.Key)
	}
	joined := strings.Join(keys, ",")
	if strings.Contains(joined, "record_id") || strings.Contains(joined, "ip") || strings.Contains(joined, "other_json") {
		t.Fatalf("self export should filter admin-only fields, got %q", joined)
	}
	if joined != "created_at,request_id" {
		t.Fatalf("unexpected self fields: %q", joined)
	}
}

func TestResolveFieldsRejectsUnauthorizedFields(t *testing.T) {
	_, err := resolveFields([]string{"record_id"}, false)
	if err == nil {
		t.Fatal("expected self export to reject admin-only field")
	}
}

func TestCacheFieldsDoNotFallback(t *testing.T) {
	other := map[string]interface{}{
		"cache_tokens":             float64(11),
		"cache_write_tokens":       float64(99),
		"cache_creation_tokens_5m": float64(5),
		"cache_creation_tokens_1h": float64(7),
	}
	fields, err := resolveFields([]string{
		"cache_read_tokens",
		"cache_creation_tokens",
		"cache_creation_tokens_5m",
		"cache_creation_tokens_1h",
	}, true)
	if err != nil {
		t.Fatalf("resolveFields returned unexpected error: %v", err)
	}
	log := &model.Log{}
	values := map[string]interface{}{}
	for _, field := range fields {
		values[field.Key] = field.Value(log, other)
	}
	if values["cache_read_tokens"] != int64(11) {
		t.Fatalf("cache read should use cache_tokens directly, got %#v", values["cache_read_tokens"])
	}
	if values["cache_creation_tokens"] != 0 {
		t.Fatalf("cache_creation_tokens should not fallback to cache_write_tokens or split fields, got %#v", values["cache_creation_tokens"])
	}
	if values["cache_creation_tokens_5m"] != int64(5) {
		t.Fatalf("5m cache creation should use exact key, got %#v", values["cache_creation_tokens_5m"])
	}
	if values["cache_creation_tokens_1h"] != int64(7) {
		t.Fatalf("1h cache creation should use exact key, got %#v", values["cache_creation_tokens_1h"])
	}
}

func TestSanitizedOtherJSONRedactsSecretsAndTruncates(t *testing.T) {
	longSecret := strings.Repeat("x", maxOtherJSONRunes+100)
	text := sanitizedOtherJSON(map[string]interface{}{
		"admin_info": map[string]interface{}{
			"key_key": longSecret,
		},
		"headers": map[string]interface{}{
			"Authorization": longSecret,
			"apiKey":        longSecret,
		},
	})
	if strings.Contains(text, longSecret) {
		t.Fatal("sanitized other_json leaked secret value")
	}
	if !strings.Contains(text, "[redacted]") {
		t.Fatalf("expected redaction marker, got %q", text)
	}
}
